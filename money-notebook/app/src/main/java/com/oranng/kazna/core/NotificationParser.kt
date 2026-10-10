package com.oranng.kazna.core

import java.time.LocalDateTime
import java.time.ZoneId

/** Known notification senders. Anything else is parsed generically if the player enables it. */
enum class Bank(val display: String) {
    WALLET("Google Кошелёк"),
    PUMB("ПУМБ"),
    RAIF("Райффайзен"),
    PRIVAT("Приват24"),
    MONO("monobank"),
    OTHER(""),
}

object Banks {
    private val rules: List<Pair<Bank, Regex>> = listOf(
        Bank.WALLET to Regex("(?iu)walletnfcrel|google wallet|google pay|кошел[её]к|гаманець|^wallet$"),
        Bank.PUMB to Regex("(?iu)pumb|пумб|fuib"),
        Bank.RAIF to Regex("(?iu)raif|райф|raiffeisen|aval"),
        Bank.PRIVAT to Regex("(?iu)privat|приват"),
        Bank.MONO to Regex("(?iu)monobank|ftband|^mono$"),
    )

    fun detect(packageName: String, appLabel: String): Bank {
        for ((bank, re) in rules) {
            if (re.containsMatchIn(packageName) || re.containsMatchIn(appLabel)) return bank
        }
        return Bank.OTHER
    }

    /** Apps watched without the player having to switch them on. */
    fun watchedByDefault(packageName: String, appLabel: String): Boolean =
        detect(packageName, appLabel) != Bank.OTHER ||
            Regex("(?iu)\\bbank\\b|банк|a-bank|sense|ukrsib|oschad|ощад|izibank|bybit").containsMatchIn("$packageName $appLabel")

    fun sourceName(packageName: String, appLabel: String): String {
        val bank = detect(packageName, appLabel)
        return if (bank == Bank.OTHER) appLabel.ifBlank { packageName } else bank.display
    }
}

/** A money amount found in text. */
data class Money(val value: Double, val currency: String, val sign: Int, val range: IntRange)

object Amounts {
    private const val NUM = "\\d{1,3}(?:[ \\u00A0\\u202F]\\d{3})+(?:[.,]\\d{1,2})?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?"
    private const val CUR = "UAH|грн\\.?|₴|USD|\\$|EUR|€|PLN|zł|GBP|£"
    private const val SIGN = "[+\\-−–]"

    private val numberFirst = Regex("(?<![\\d*•.,])($SIGN)?\\s?($NUM)\\s?($CUR)(?![\\p{L}])", RegexOption.IGNORE_CASE)
    private val currencyFirst = Regex("($SIGN)?\\s?($CUR)\\s?($SIGN)?\\s?($NUM)(?![\\d])", RegexOption.IGNORE_CASE)

    fun find(text: String): List<Money> {
        val found = mutableListOf<Money>()
        for (m in numberFirst.findAll(text)) {
            val value = toNumber(m.groupValues[2]) ?: continue
            found += Money(value, currency(m.groupValues[3]), sign(m.groupValues[1]), m.range)
        }
        for (m in currencyFirst.findAll(text)) {
            if (found.any { it.range.first <= m.range.last && m.range.first <= it.range.last }) continue
            val value = toNumber(m.groupValues[4]) ?: continue
            val s = sign(m.groupValues[1]).takeIf { it != 0 } ?: sign(m.groupValues[3])
            found += Money(value, currency(m.groupValues[2]), s, m.range)
        }
        return found.sortedBy { it.range.first }
    }

    fun toNumber(raw: String): Double? {
        var s = raw.replace(Regex("[ \\u00A0\\u202F]"), "")
        val lastComma = s.lastIndexOf(',')
        val lastDot = s.lastIndexOf('.')
        s = when {
            lastComma >= 0 && lastDot >= 0 ->
                if (lastComma > lastDot) s.replace(".", "").replace(',', '.') else s.replace(",", "")
            lastComma >= 0 ->
                if (Regex(",\\d{1,2}$").containsMatchIn(s)) s.replace(',', '.') else s.replace(",", "")
            lastDot >= 0 ->
                if (Regex("\\.\\d{1,2}$").containsMatchIn(s)) s else s.replace(".", "")
            else -> s
        }
        return s.toDoubleOrNull()?.takeIf { it > 0 }
    }

    fun currency(raw: String): String = when (raw.lowercase().trimEnd('.')) {
        "uah", "грн", "₴" -> "UAH"
        "usd", "$" -> "USD"
        "eur", "€" -> "EUR"
        "pln", "zł" -> "PLN"
        "gbp", "£" -> "GBP"
        else -> raw.uppercase()
    }

    private fun sign(raw: String): Int = when (raw) {
        "+" -> 1
        "-", "−", "–" -> -1
        else -> 0
    }
}

/**
 * Turns bank / wallet notifications into money movements. Pure Kotlin so it can
 * be unit-tested on the JVM. Formats covered from real notifications:
 *  - ПУМБ:   title "Списання", lines "5.00UAH", "10-10-2026 22:51", "Рахунок: *0952", "Доступно: 32.57UAH"
 *  - MyRaif: title "5,00 ₴", "Visa Fishka Virtual *1534 поповнення картки від FUIB MoneyTransfer", "Баланс: 9,11 ₴"
 *  - Privat24: "+3.37₴ Зарахування з На подарунок", "-3.37₴ Переказ на свою картку *50…"
 *  - Google Кошелёк: merchant in the title, amount and card ("••4236") in the text
 * Anything else falls back to a generic reading of amount, direction and merchant.
 */
class NotificationParser(private val zone: ZoneId = ZoneId.systemDefault()) {

    private val balanceLine = Regex("(?iu)(доступно|доступний|баланс|залишок|остаток|available|balance|\\bbal\\b|кредитн)")
    private val accountLine = Regex("(?iu)^\\s*(рахунок|рахунку|счет|сч[её]т|картка|карта|card|account)\\b[^\\p{L}]*$|^\\s*(рахунок|счет|сч[её]т|card|account)\\s*:")
    private val dateRe = Regex("(\\d{2})[-./](\\d{2})[-./](\\d{4})[ ,T]+(\\d{1,2}):(\\d{2})")
    private val maskRe = Regex("(?:\\*|•{1,2}|·{2}|\\.{2,3})\\s?(\\d{4})(?!\\d)")
    private val ignoreRe = Regex("(?iu)(?<![\\p{L}])(код|code|пароль|password|otp|cvv)(?![\\p{L}])|відхилено|отклонен|declined|недостатньо коштів|недостаточно средств|insufficient")

    private val transferWords = listOf(
        "на свою картку", "на свою карту", "на свій рахунок", "на свой сч", "між своїми", "между своими",
        "власн", "собственн", "moneytransfer", "money transfer", "з власної", "own card", "own account",
    )
    private val transferHintWords = transferWords + listOf(
        "переказ", "перевод", "поповнення", "пополнение", "зарахування", "зачисление", "p2p",
    )
    private val incomeWords = listOf(
        "зарахування", "поповнення", "надходження", "повернення", "кешбек", "кэшбэк", "cashback", "refund",
        "зачисление", "пополнение", "поступление", "возврат", "отримано", "отримання", "received", "income",
    )
    private val expenseWords = listOf(
        "списання", "списание", "покупка", "оплата", "оплачено", "платіж", "платеж", "зняття", "снятие",
        "переказ", "перевод", "payment", "purchase", "withdrawal", "комісія", "комиссия", "paid",
    )
    private val purchaseWords = listOf("покупка", "оплата", "оплачено", "payment", "purchase", "paid")

    private val opPrefix = Regex(
        "(?iu)^(?:переказ на свою картку|переказ на свою карту|переказ на картку|переказ на карту|переказ з картки|" +
            "поповнення картки|поповнення рахунку|зняття готівки|отримання переказу|" +
            "покупка|оплата|оплачено|платіж|платеж|списання|списание|зарахування|зачисление|поповнення|пополнение|" +
            "переказ|перевод|надходження|повернення|возврат|зняття|payment|purchase)" +
            "(?:\\s+(?:від|з|із|в|у|на|до|от|из|at|to|from)(?![\\p{L}]))?[:\\s]*",
    )

    fun parse(n: RawNotification): ParsedTx? {
        val bank = Banks.detect(n.packageName, n.appLabel)
        val body = n.bigText.ifBlank { n.text }
        val bodyLines = (body.split('\n') + n.lines).map { it.trim() }.filter { it.isNotEmpty() }.distinct()
        val title = n.title.trim()
        val all = (listOf(title) + bodyLines).filter { it.isNotEmpty() }
        val full = all.joinToString("\n")
        if (full.isBlank() || ignoreRe.containsMatchIn(full)) return null

        // Balance: first amount on a line that talks about the balance.
        var balance: Double? = null
        val opLines = mutableListOf<String>()
        for (line in all) {
            if (balanceLine.containsMatchIn(line)) {
                if (balance == null) balance = Amounts.find(line).firstOrNull()?.value
            } else {
                opLines += line
            }
        }

        val money = opLines.asSequence().flatMap { Amounts.find(it).asSequence() }.firstOrNull() ?: return null
        val lower = full.lowercase()

        val direction = when {
            money.sign != 0 -> money.sign
            incomeWords.any { lower.contains(it) } -> 1
            expenseWords.any { lower.contains(it) } -> -1
            bank == Bank.WALLET -> -1
            else -> return null
        }
        val isTransfer = transferWords.any { lower.contains(it) }
        val kind = when {
            isTransfer -> Kind.TRANSFER
            direction > 0 -> Kind.INCOME
            else -> Kind.SPEND
        }
        val purchaseHint = bank == Bank.WALLET || purchaseWords.any { lower.contains(it) }
        val transferHint = !purchaseHint && transferHintWords.any { lower.contains(it) }

        val account = maskRe.findAll(full).lastOrNull()?.groupValues?.get(1)
        val time = parseTime(full, n.postTime)
        val source = Banks.sourceName(n.packageName, n.appLabel)
        val merchant = merchant(bank, title, opLines, kind, source)

        return ParsedTx(
            amount = money.value,
            currency = money.currency,
            direction = direction,
            kind = kind,
            merchant = merchant,
            source = source,
            account = account,
            balance = balance,
            time = time,
            transferHint = transferHint,
            purchaseHint = purchaseHint,
        )
    }

    private fun parseTime(text: String, postTime: Long): Long {
        val m = dateRe.find(text) ?: return postTime
        val (d, mo, y, h, mi) = m.destructured
        return try {
            val t = LocalDateTime.of(y.toInt(), mo.toInt(), d.toInt(), h.toInt(), mi.toInt())
                .atZone(zone).toInstant().toEpochMilli()
            // Sanity: a bank cannot report an operation from the future or ages ago.
            if (t > postTime + 60 * 60 * 1000L || t < postTime - 40L * 24 * 60 * 60 * 1000) postTime else t
        } catch (e: Exception) {
            postTime
        }
    }

    private fun merchant(bank: Bank, title: String, lines: List<String>, kind: Kind, source: String): String {
        if (bank == Bank.WALLET && title.isNotBlank() && Amounts.find(title).isEmpty() &&
            !Regex("(?iu)wallet|кошел|гаманець|google").containsMatchIn(title)
        ) {
            return clean(title)
        }
        for (line in lines) {
            if (dateRe.containsMatchIn(line) && line.replace(dateRe, "").none { it.isLetter() }) continue
            if (accountLine.containsMatchIn(line)) continue
            if (Banks.detect("", line) != Bank.OTHER && line.split(' ').size <= 2) continue
            var s = line
            for (m in Amounts.find(line).reversed()) s = s.removeRange(m.range)
            // Drop "Visa Fishka Virtual *1534" style card names in front of the operation.
            maskRe.find(s)?.let { if (it.range.first < s.length / 2 + 8) s = s.substring(it.range.last + 1) }
            s = s.trim().replace(opPrefix, "")
            s = clean(s)
            if (s.count { it.isLetter() } >= 2 && !isBareOperation(s)) return s
        }
        val op = title.takeIf { it.isNotBlank() && Amounts.find(it).isEmpty() }
        return when {
            kind == Kind.TRANSFER -> "Перевод между своими"
            op != null -> "$source · $op"
            else -> source
        }
    }

    private fun isBareOperation(s: String): Boolean =
        Regex("(?iu)^(списання|списание|зарахування|зачисление|поповнення|пополнение|покупка|оплата|переказ|перевод|платіж|платеж)$").matches(s)

    private fun clean(s: String): String =
        s.replace(Regex("[.…]+$"), "")
            .replace(Regex("\\s+"), " ")
            .trim(' ', ',', ':', ';', '-', '·')
            .take(48)
}
