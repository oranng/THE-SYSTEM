package com.oranng.kazna.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId

/** In-memory TxStore with the same semantics as the SQLite one. */
class FakeStore : TxStore {
    val txs = mutableListOf<Tx>()
    val ruleMap = mutableMapOf<String, String>()
    private var nextId = 1L

    override fun inRange(from: Long, to: Long) = txs.filter { it.time in from..to }
    override fun hasFingerprint(fingerprint: String) =
        txs.any { tx -> tx.fingerprint.split('|').contains(fingerprint) }
    override fun insert(tx: Tx): Long { val id = nextId++; txs += tx.copy(id = id); return id }
    override fun update(tx: Tx) { txs.replaceAll { if (it.id == tx.id) tx else it } }
    override fun delete(id: Long) { txs.removeAll { it.id == id } }
    override fun lastWithBalance(source: String, account: String?, currency: String, before: Long) =
        txs.filter { it.balance != null && it.source == source && it.account == account && it.currency == currency && it.time < before }
            .maxByOrNull { it.time }
    override fun newestWithBalance(source: String, account: String?, currency: String) =
        txs.filter { it.balance != null && it.source == source && it.account == account && it.currency == currency }
            .maxByOrNull { it.time }
    override fun rules() = ruleMap
}

class LedgerTest {
    private val zone = ZoneId.of("Europe/Kyiv")
    private val store = FakeStore()
    private val ledger = Ledger(store, NotificationParser(zone))

    private fun at(h: Int, m: Int, s: Int = 0) =
        LocalDateTime.of(2026, 10, 10, h, m, s).atZone(zone).toInstant().toEpochMilli()

    private fun pumb(amount: String, balance: String, h: Int, m: Int, post: Long = at(h, m, 20), title: String = "Списання") =
        RawNotification("ua.fuib.pumb", "PUMB", title,
            "${amount}UAH\n10-10-2026 %02d:%02d\nРахунок: *0952\nДоступно: ${balance}UAH".format(h, m), "", emptyList(), post)

    private fun wallet(merchant: String, amount: String, post: Long) =
        RawNotification("com.google.android.apps.walletnfcrel", "Кошелёк", merchant, "$amount ₴ · PUMB Mastercard ••1132", "", emptyList(), post)

    @Test fun repostedNotificationIsCountedOnce() {
        val n = pumb("5.00", "32.57", 22, 51)
        assertEquals(IngestResult.ADDED, ledger.ingest(n))
        assertEquals(IngestResult.DUPLICATE, ledger.ingest(n))
        assertEquals(1, store.txs.size)
    }

    @Test fun screenshotPumbToRaifIsATransfer() {
        ledger.ingest(pumb("5.00", "32.57", 22, 51))
        ledger.ingest(RawNotification("ua.raiffeisen.myraif", "MyRaif", "5,00 ₴",
            "Visa Fishka Virtual *1534 поповнення картки від FUIB MoneyTransfer\nБаланс: 9,11 ₴", "", emptyList(), at(22, 51, 40)))
        assertEquals(2, store.txs.size)
        assertTrue(store.txs.all { it.kind == Kind.TRANSFER })
        assertTrue(store.txs.all { it.category == Categories.OWN })
    }

    @Test fun screenshotPrivatJarPairIsATransfer() {
        ledger.ingest(RawNotification("ua.privatbank.ap24", "Privat24", "Privat24", "+3.37₴ Зарахування з На подарунок", "", emptyList(), at(22, 50, 5)))
        ledger.ingest(RawNotification("ua.privatbank.ap24", "Privat24", "Privat24", "-3.37₴ Переказ на свою картку *5039", "", emptyList(), at(22, 50, 6)))
        assertTrue(store.txs.all { it.kind == Kind.TRANSFER })
    }

    @Test fun walletAndBankNotificationsMergeIntoOnePurchase() {
        ledger.ingest(wallet("SILPO", "245,50", at(12, 0, 1)))
        ledger.ingest(pumb("245.50", "1000.00", 12, 0, at(12, 0, 30)))
        assertEquals(1, store.txs.size)
        val tx = store.txs.single()
        assertEquals("SILPO", tx.merchant)
        assertEquals(Categories.GROCERIES, tx.category)
        assertEquals("ПУМБ", tx.source)
        assertEquals(1000.0, tx.balance!!, 0.001)
        assertEquals(Kind.SPEND, tx.kind)
    }

    @Test fun bankFirstThenWalletAlsoMerges() {
        ledger.ingest(pumb("99.00", "500.00", 9, 30))
        ledger.ingest(wallet("WOG 15", "99,00", at(9, 30, 50)))
        assertEquals(1, store.txs.size)
        assertEquals("WOG 15", store.txs.single().merchant)
        assertEquals(Categories.FUEL, store.txs.single().category)
    }

    @Test fun missedNotificationShowsUpAsBalanceGap() {
        ledger.ingest(pumb("100.00", "900.00", 10, 0))
        // A 150 UAH charge never reached the phone; the next one reveals it.
        ledger.ingest(pumb("50.00", "700.00", 18, 0))
        val gap = store.txs.single { it.origin == Origin.BALANCE_GAP }
        assertEquals(150.0, gap.amount, 0.001)
        assertEquals(-1, gap.direction)
        assertTrue(gap.review)
        assertEquals(3, store.txs.size)
    }

    @Test fun lateNotificationReplacesTheGap() {
        ledger.ingest(pumb("100.00", "900.00", 10, 0))
        ledger.ingest(pumb("50.00", "700.00", 18, 0)) // gap of 150 recorded
        // The missing 150 arrives late (phone was off), with its real operation time.
        ledger.ingest(pumb("150.00", "750.00", 14, 0, post = at(19, 0)))
        assertTrue(store.txs.none { it.origin == Origin.BALANCE_GAP })
        assertEquals(3, store.txs.size)
    }

    @Test fun matchingBalancesCreateNoGap() {
        ledger.ingest(pumb("100.00", "900.00", 10, 0))
        ledger.ingest(pumb("50.00", "850.00", 11, 0))
        assertTrue(store.txs.none { it.origin == Origin.BALANCE_GAP })
    }

    @Test fun learnedRuleWins() {
        store.ruleMap[Categorizer.merchantKey("FOP Petrenko")] = Categories.CAFE
        ledger.ingest(RawNotification("ua.privatbank.ap24", "Privat24", "Privat24", "-60.00₴ Покупка: FOP Petrenko", "", emptyList(), at(8, 0)))
        assertEquals(Categories.CAFE, store.txs.single().category)
    }

    @Test fun unknownMerchantIsFlaggedForReview() {
        ledger.ingest(pumb("5.00", "32.57", 22, 51))
        assertTrue(store.txs.single().review)
        assertEquals(Categories.OTHER, store.txs.single().category)
    }
}
