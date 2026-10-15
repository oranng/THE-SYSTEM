package com.oranng.kazna.core

/** What a money movement means for the spending statistics. */
enum class Kind {
    /** Money spent on something: counted in categories. */
    SPEND,
    /** Money received from outside: salary, refunds, cashback. */
    INCOME,
    /** Money moved between the player's own cards and jars: never counted. */
    TRANSFER,
}

/** Where a transaction record came from. */
enum class Origin {
    /** Parsed from a bank or wallet notification. */
    AUTO,
    /** Typed in by hand. */
    MANUAL,
    /** Created from a balance that did not add up: a missed notification. */
    BALANCE_GAP,
}

/** Raw notification as the listener saw it; plain data so the parser is JVM-testable. */
data class RawNotification(
    val packageName: String,
    val appLabel: String,
    val title: String,
    val text: String,
    val bigText: String = "",
    val lines: List<String> = emptyList(),
    val postTime: Long,
)

/** One parsed money movement, before it is stored. */
data class ParsedTx(
    /** Always positive. */
    val amount: Double,
    val currency: String,
    /** -1 money left the account, +1 money arrived. */
    val direction: Int,
    val kind: Kind,
    val merchant: String,
    val source: String,
    /** Last four digits of the card or account, when the text has them. */
    val account: String?,
    /** Balance after the operation, when the bank reports it. */
    val balance: Double?,
    /** Operation time: from the text when present (late notifications), else the post time. */
    val time: Long,
    /** True when the bank's own wording names a transfer or top-up (helps pairing). */
    val transferHint: Boolean,
    /** True when the notification is a card payment at a merchant. */
    val purchaseHint: Boolean,
)

/** A stored transaction. */
data class Tx(
    val id: Long = 0,
    val time: Long,
    val amount: Double,
    val currency: String,
    val direction: Int,
    val kind: Kind,
    val merchant: String,
    val category: String,
    val source: String,
    val account: String?,
    val balance: Double?,
    val origin: Origin,
    val note: String = "",
    /** Fingerprint of the notification text, used to ignore re-posts and rescans. */
    val fingerprint: String = "",
    val transferHint: Boolean = false,
    val purchaseHint: Boolean = false,
    /** Needs the player's attention: unknown gap or unsure category. */
    val review: Boolean = false,
    /**
     * Value in hryvnias for a foreign-currency operation (Bybit card in USD), at the
     * NBU rate of the operation's date. Null while the rate is not fetched yet.
     */
    val uah: Double? = null,
) {
    /** Signed effect on the account balance. */
    val signed: Double get() = amount * direction

    /** Amount in hryvnias, or null while a foreign amount waits for its rate. */
    val uahValue: Double? get() = if (currency == "UAH") amount else uah

    /** Waiting for the exchange rate. */
    val pendingRate: Boolean get() = currency != "UAH" && uah == null
}
