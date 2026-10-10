package com.oranng.kazna.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId

class NotificationParserTest {
    private val zone = ZoneId.of("Europe/Kyiv")
    private val parser = NotificationParser(zone)
    private val post = LocalDateTime.of(2026, 10, 10, 22, 51, 30).atZone(zone).toInstant().toEpochMilli()

    private fun n(pkg: String, label: String, title: String, text: String, big: String = "") =
        RawNotification(pkg, label, title, text, big, emptyList(), post)

    // ── Real notifications from the screenshot (10.10.2026) ──────────────────

    @Test fun pumbDebit() {
        val p = parser.parse(n("ua.fuib.pumb", "PUMB", "Списання",
            "5.00UAH\n10-10-2026 22:51\nРахунок: *0952\nДоступно: 32.57UAH"))!!
        assertEquals(5.0, p.amount, 0.001)
        assertEquals("UAH", p.currency)
        assertEquals(-1, p.direction)
        assertEquals(Kind.SPEND, p.kind)
        assertEquals("0952", p.account)
        assertEquals(32.57, p.balance!!, 0.001)
        assertEquals("ПУМБ", p.source)
        assertEquals("ПУМБ · Списання", p.merchant)
        val expected = LocalDateTime.of(2026, 10, 10, 22, 51).atZone(zone).toInstant().toEpochMilli()
        assertEquals(expected, p.time)
    }

    @Test fun raifTopUpFromPumb() {
        val p = parser.parse(n("ua.raiffeisen.myraif", "MyRaif", "5,00 ₴",
            "Visa Fishka Virtual *1534 поповнення картки від FUIB MoneyTransfer\nБаланс: 9,11 ₴"))!!
        assertEquals(5.0, p.amount, 0.001)
        assertEquals(1, p.direction)
        assertEquals("1534", p.account)
        assertEquals(9.11, p.balance!!, 0.001)
        assertEquals("FUIB MoneyTransfer", p.merchant)
        assertEquals(Kind.TRANSFER, p.kind) // "MoneyTransfer" from the player's own PUMB card
        assertEquals("Райффайзен", p.source)
    }

    @Test fun privatIncomeFromJar() {
        val p = parser.parse(n("ua.privatbank.ap24", "Privat24", "Privat24", "+3.37₴ Зарахування з На подарунок"))!!
        assertEquals(3.37, p.amount, 0.001)
        assertEquals(1, p.direction)
        assertEquals(Kind.INCOME, p.kind)
        assertEquals("На подарунок", p.merchant)
        assertTrue(p.transferHint)
    }

    @Test fun privatTransferToOwnCard() {
        val p = parser.parse(n("ua.privatbank.ap24", "Privat24", "Privat24", "-3.37₴ Переказ на свою картку *5039"))!!
        assertEquals(-1, p.direction)
        assertEquals(Kind.TRANSFER, p.kind)
        assertEquals("5039", p.account)
    }

    // ── Likely purchase formats ──────────────────────────────────────────────

    @Test fun walletPaymentMerchantInTitle() {
        val p = parser.parse(n("com.google.android.apps.walletnfcrel", "Кошелёк", "SILPO",
            "245,50 ₴ · Bybit Mastercard ••4236"))!!
        assertEquals(245.5, p.amount, 0.001)
        assertEquals(-1, p.direction)
        assertEquals("SILPO", p.merchant)
        assertEquals("4236", p.account)
        assertEquals("Google Кошелёк", p.source)
        assertTrue(p.purchaseHint)
    }

    @Test fun walletEnglishCurrencyFirst() {
        val p = parser.parse(n("com.google.android.apps.walletnfcrel", "Google Wallet", "WOG 1234",
            "₴1,250.00 with PUMB Mastercard ••1132"))!!
        assertEquals(1250.0, p.amount, 0.001)
        assertEquals("WOG 1234", p.merchant)
        assertEquals("1132", p.account)
    }

    @Test fun walletUsdAmount() {
        val p = parser.parse(n("com.google.android.apps.walletnfcrel", "Кошелёк", "Netflix", "$9.99 · Bybit Mastercard ••4236"))!!
        assertEquals(9.99, p.amount, 0.001)
        assertEquals("USD", p.currency)
    }

    @Test fun raifPurchase() {
        val p = parser.parse(n("ua.raiffeisen.myraif", "MyRaif", "120,40 ₴",
            "Visa Fishka *1534 покупка ATB-MARKET KYIV\nБаланс: 1 080,60 ₴"))!!
        assertEquals(120.4, p.amount, 0.001)
        assertEquals(-1, p.direction)
        assertEquals(Kind.SPEND, p.kind)
        assertEquals("ATB-MARKET KYIV", p.merchant)
        assertEquals(1080.6, p.balance!!, 0.001)
    }

    @Test fun privatPurchase() {
        val p = parser.parse(n("ua.privatbank.ap24", "Privat24", "Privat24", "-89.00₴ Покупка: FOP Ivanenko, Kyiv"))!!
        assertEquals("FOP Ivanenko, Kyiv", p.merchant)
        assertEquals(Kind.SPEND, p.kind)
    }

    @Test fun thousandsWithSpaces() {
        assertEquals(12500.0, Amounts.find("Списання 12 500,00 UAH").single().value, 0.001)
        assertEquals(12500.0, Amounts.find("12 500.00 грн").single().value, 0.001)
    }

    @Test fun cardDigitsAreNotMoney() {
        val found = Amounts.find("Visa *1534 500,00 ₴")
        assertEquals(1, found.size)
        assertEquals(500.0, found[0].value, 0.001)
    }

    // ── Things that must not become transactions ─────────────────────────────

    @Test fun ignoresOtpCodes() {
        assertNull(parser.parse(n("ua.fuib.pumb", "PUMB", "Код підтвердження", "Код 4821 для оплати 300.00UAH")))
    }

    @Test fun ignoresDeclined() {
        assertNull(parser.parse(n("ua.fuib.pumb", "PUMB", "Операцію відхилено", "300.00UAH Недостатньо коштів")))
    }

    @Test fun ignoresTextWithoutMoney() {
        assertNull(parser.parse(n("ua.privatbank.ap24", "Privat24", "Privat24", "Оновіть застосунок до нової версії")))
    }

    @Test fun ignoresAmountWithoutDirection() {
        assertNull(parser.parse(n("ua.fuib.pumb", "PUMB", "Акція", "Отримайте 100 UAH за друга")).let {
            // "Отримайте" is not an income word; a promo has no direction and is skipped.
            it
        })
    }

    @Test fun lateNotificationKeepsOperationTime() {
        val late = post + 3 * 60 * 60 * 1000L // delivered 3 h later (phone was off)
        val p = parser.parse(RawNotification("ua.fuib.pumb", "PUMB", "Списання",
            "5.00UAH\n10-10-2026 22:51\nРахунок: *0952\nДоступно: 32.57UAH", "", emptyList(), late))
        assertNotNull(p)
        val expected = LocalDateTime.of(2026, 10, 10, 22, 51).atZone(zone).toInstant().toEpochMilli()
        assertEquals(expected, p!!.time)
    }

    @Test fun bankDetection() {
        assertEquals(Bank.PUMB, Banks.detect("com.fuib.android.spot.online", "PUMB"))
        assertEquals(Bank.RAIF, Banks.detect("ua.raiffeisen.myraif", "MyRaif"))
        assertEquals(Bank.PRIVAT, Banks.detect("ua.privatbank.ap24", "Privat24"))
        assertEquals(Bank.WALLET, Banks.detect("com.google.android.apps.walletnfcrel", "Кошелёк"))
        assertEquals(Bank.MONO, Banks.detect("com.ftband.mono", "monobank"))
        assertEquals(Bank.OTHER, Banks.detect("org.telegram.messenger", "Telegram"))
        assertTrue(Banks.watchedByDefault("com.fuib.android.spot.online", "PUMB"))
        assertTrue(!Banks.watchedByDefault("org.telegram.messenger", "Telegram"))
    }
}
