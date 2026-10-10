package com.oranng.kazna.core

import java.security.MessageDigest
import kotlin.math.abs

/** Storage the ledger needs. The app backs it with SQLite, tests with a list. */
interface TxStore {
    fun inRange(from: Long, to: Long): List<Tx>
    fun hasFingerprint(fingerprint: String): Boolean
    fun insert(tx: Tx): Long
    fun update(tx: Tx)
    fun delete(id: Long)
    /** Latest stored transaction for this account that carries a balance, strictly before [before]. */
    fun lastWithBalance(source: String, account: String?, currency: String, before: Long): Tx?
    /** Same, but the newest one regardless of time. */
    fun newestWithBalance(source: String, account: String?, currency: String): Tx?
    fun rules(): Map<String, String>
}

enum class IngestResult { ADDED, MERGED, DUPLICATE, IGNORED }

/**
 * Applies parsed notifications to the store:
 *  1. ignores re-posted / re-scanned notifications (fingerprint);
 *  2. merges a Google Wallet payment with the bank's own notification for the same charge;
 *  3. pairs an outgoing and incoming movement of the same amount into a transfer between own cards;
 *  4. checks the reported balance and records a gap when a notification was missed;
 *  5. removes such a gap when the late notification finally arrives.
 */
class Ledger(
    private val store: TxStore,
    private val parser: NotificationParser = NotificationParser(),
) {
    companion object {
        const val MERGE_WINDOW = 5 * 60 * 1000L
        const val PAIR_WINDOW = 10 * 60 * 1000L
        const val GAP_HORIZON = 45L * 24 * 60 * 60 * 1000
        const val GAP_MERCHANT = "Неизвестная операция"
        private const val EPS = 0.005
    }

    fun fingerprint(n: RawNotification): String {
        val text = listOf(n.packageName, n.title, n.text, n.bigText, n.lines.joinToString("|"))
            .joinToString("\u0001") { it.trim() }
        val bytes = MessageDigest.getInstance("SHA-1").digest(text.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }.take(20)
    }

    fun ingest(n: RawNotification): IngestResult {
        val p = parser.parse(n) ?: return IngestResult.IGNORED
        val fp = fingerprint(n)
        if (store.hasFingerprint(fp)) return IngestResult.DUPLICATE

        mergeWithCounterpart(p, fp)?.let { return it }

        val tx = Tx(
            time = p.time,
            amount = p.amount,
            currency = p.currency,
            direction = p.direction,
            kind = p.kind,
            merchant = p.merchant,
            category = "",
            source = p.source,
            account = p.account,
            balance = p.balance,
            origin = Origin.AUTO,
            fingerprint = fp,
            transferHint = p.transferHint,
            purchaseHint = p.purchaseHint,
        )
        reconcile(tx)
        val paired = pairTransfer(tx)
        val category = Categorizer.categorize(paired.merchant, paired.kind, paired.transferHint, store.rules())
        store.insert(paired.copy(category = category, review = paired.kind == Kind.SPEND && category == Categories.OTHER))
        return IngestResult.ADDED
    }

    /** Wallet payment + bank notification for the same charge become one record. */
    private fun mergeWithCounterpart(p: ParsedTx, fp: String): IngestResult? {
        if (p.direction > 0) return null
        val isWallet = p.source == Bank.WALLET.display
        val candidates = store.inRange(p.time - MERGE_WINDOW, p.time + MERGE_WINDOW).filter {
            it.origin == Origin.AUTO && it.direction < 0 && it.currency == p.currency &&
                abs(it.amount - p.amount) < EPS && it.source != p.source &&
                ((it.source == Bank.WALLET.display) != isWallet)
        }
        val other = candidates.minByOrNull { abs(it.time - p.time) } ?: return null
        // The wallet knows the shop; the bank knows the account and balance.
        val merchant = if (isWallet) p.merchant else other.merchant
        var merged = other.copy(
            merchant = merchant,
            source = if (isWallet) other.source else p.source,
            account = if (isWallet) other.account else p.account ?: other.account,
            balance = if (isWallet) other.balance else p.balance ?: other.balance,
            time = minOf(other.time, p.time),
            fingerprint = other.fingerprint + "|" + fp,
            purchaseHint = true,
            transferHint = false,
            kind = if (other.kind == Kind.TRANSFER) Kind.TRANSFER else Kind.SPEND,
        )
        if (!isWallet && p.balance != null) {
            reconcile(merged.copy(id = 0))
        }
        val category = Categorizer.categorize(merged.merchant, merged.kind, false, store.rules())
        merged = merged.copy(category = category, review = merged.kind == Kind.SPEND && category == Categories.OTHER)
        store.update(merged)
        return IngestResult.MERGED
    }

    /** Outgoing + incoming of the same amount within minutes = a move between own cards. */
    private fun pairTransfer(tx: Tx): Tx {
        if (tx.purchaseHint) return tx
        val other = store.inRange(tx.time - PAIR_WINDOW, tx.time + PAIR_WINDOW).filter {
            it.origin == Origin.AUTO && it.direction == -tx.direction && it.currency == tx.currency &&
                abs(it.amount - tx.amount) < EPS && !it.purchaseHint &&
                (tx.transferHint || it.transferHint || tx.kind == Kind.TRANSFER || it.kind == Kind.TRANSFER)
        }.minByOrNull { abs(it.time - tx.time) } ?: return tx
        if (other.kind != Kind.TRANSFER) {
            store.update(other.copy(kind = Kind.TRANSFER, category = Categories.OWN, review = false))
        }
        return tx.copy(kind = Kind.TRANSFER)
    }

    /**
     * Compare the reported balance with the previous one for the same account. A mismatch
     * means a notification never reached the phone: record the difference so the month's
     * totals stay honest. A late notification that explains an earlier gap removes it.
     */
    private fun reconcile(tx: Tx) {
        val balance = tx.balance ?: return
        val newest = store.newestWithBalance(tx.source, tx.account, tx.currency)
        if (newest != null && newest.time > tx.time) {
            // Arrived late: an older operation. It may explain a gap recorded meanwhile.
            absorbGap(tx)
            return
        }
        val prev = store.lastWithBalance(tx.source, tx.account, tx.currency, tx.time) ?: return
        val prevBalance = prev.balance ?: return
        if (tx.time - prev.time > GAP_HORIZON) return
        val diff = balance - (prevBalance + tx.signed)
        if (abs(diff) < 0.01) return
        store.insert(
            Tx(
                time = tx.time - 1,
                amount = Math.round(abs(diff) * 100) / 100.0,
                currency = tx.currency,
                direction = if (diff < 0) -1 else 1,
                kind = if (diff < 0) Kind.SPEND else Kind.INCOME,
                merchant = GAP_MERCHANT,
                category = if (diff < 0) Categories.OTHER else Categories.INCOME,
                source = tx.source,
                account = tx.account,
                balance = null,
                origin = Origin.BALANCE_GAP,
                note = "Остаток не сходится: было ${fmt(prevBalance)}, стало ${fmt(balance)}, " +
                    "учтено ${fmt(tx.signed)}. Вероятно, уведомление не пришло.",
                review = true,
            ),
        )
    }

    private fun absorbGap(tx: Tx) {
        val gap = store.inRange(tx.time, tx.time + GAP_HORIZON).filter {
            it.origin == Origin.BALANCE_GAP && it.source == tx.source && it.account == tx.account &&
                it.currency == tx.currency && it.direction == tx.direction && it.amount >= tx.amount - 0.01
        }.minByOrNull { it.time } ?: return
        if (abs(gap.amount - tx.amount) < 0.01) {
            store.delete(gap.id)
        } else {
            store.update(gap.copy(amount = Math.round((gap.amount - tx.amount) * 100) / 100.0))
        }
    }

    private fun fmt(v: Double): String = "%.2f".format(java.util.Locale.ROOT, v)
}
