package com.oranng.kazna.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

class BybitAndRatesTest {
    private val zone = ZoneId.of("Europe/Kyiv")
    private val parser = NotificationParser(zone)
    private fun kyiv(d: Int, h: Int, m: Int, s: Int = 0) = LocalDateTime.of(2026, 10, d, h, m, s).atZone(zone).toInstant().toEpochMilli()
    private fun utc(d: Int, h: Int, m: Int, s: Int = 0) = LocalDateTime.of(2026, 10, d, h, m, s).atZone(ZoneId.of("UTC")).toInstant().toEpochMilli()

    // Real notifications, copied from the Казна log on 15.10.2026.
    private fun bybit(text: String, post: Long) = RawNotification(
        "com.bybit.app", "Bybit", "Bybit Card - Authorization Successful", text, "", emptyList(), post,
    )

    @Test fun bybitAuthorization() {
        val p = parser.parse(bybit("Authorization of 4.88 USD at box express market was made on 2026-10-15 17:17:20.", kyiv(15, 17, 17, 40)))!!
        assertEquals(4.88, p.amount, 0.001)
        assertEquals("USD", p.currency)
        assertEquals(-1, p.direction)
        assertEquals(Kind.SPEND, p.kind)
        assertEquals("box express market", p.merchant)
        assertEquals("Bybit", p.source)
        assertTrue(p.purchaseHint)
        assertEquals(kyiv(15, 17, 17, 20), p.time) // the stamp matches local time here
    }

    @Test fun bybitFopAndUtcStamp() {
        // If Bybit writes UTC, the notification arrives ~3 h "after" the stamp read as local.
        val p = parser.parse(bybit("Authorization of 1.70 USD at FOP DEMYANCHUK MM was made on 2026-10-15 04:33:20.", utc(15, 4, 33, 50)))!!
        assertEquals(1.70, p.amount, 0.001)
        assertEquals("FOP DEMYANCHUK MM", p.merchant)
        assertEquals(utc(15, 4, 33, 20), p.time)
        assertEquals(Categories.FOP, Categorizer.categorize(p.merchant, p.kind, p.transferHint))
    }

    @Test fun bybitFailedIsIgnored() {
        assertNull(parser.parse(RawNotification("com.bybit.app", "Bybit", "Bybit Card - Authorization Failed",
            "Authorization of 12.00 USD at SILPO failed: insufficient balance.", "", emptyList(), kyiv(15, 12, 0))))
    }

    @Test fun bybitIsWatchedByDefault() {
        assertEquals(Bank.BYBIT, Banks.detect("com.bybit.app", "Bybit"))
        assertTrue(Banks.watchedByDefault("com.bybit.app", "Bybit"))
    }

    @Test fun usdSpendWaitsForRate() {
        val store = FakeStore()
        Ledger(store, parser).ingest(bybit("Authorization of 4.88 USD at box express market was made on 2026-10-15 17:17:20.", kyiv(15, 17, 17, 40)))
        val tx = store.txs.single()
        assertTrue(tx.pendingRate)
        assertNull(tx.uahValue)
        assertEquals(Categories.GROCERIES, tx.category) // "market"
    }

    @Test fun walletHryvniaAndBybitDollarsAreOnePurchase() {
        val store = FakeStore()
        val ledger = Ledger(store, parser)
        ledger.ingest(RawNotification("com.google.android.apps.walletnfcrel", "Кошелёк", "BOX EXPRESS MARKET",
            "201,00 ₴ · Bybit Mastercard ••4236", "", emptyList(), kyiv(15, 17, 17, 25)))
        ledger.ingest(bybit("Authorization of 4.88 USD at box express market was made on 2026-10-15 17:17:20.", kyiv(15, 17, 17, 40)))
        val tx = store.txs.single()
        assertEquals(201.0, tx.amount, 0.001)
        assertEquals("UAH", tx.currency)
        assertEquals(201.0, tx.uahValue!!, 0.001)
        assertEquals("Bybit", tx.source)
        assertTrue(tx.note.contains("4,88 $"))
    }

    @Test fun bybitFirstThenWalletAlsoMerges() {
        val store = FakeStore()
        val ledger = Ledger(store, parser)
        ledger.ingest(bybit("Authorization of 1.70 USD at FOP DEMYANCHUK MM was made on 2026-10-15 09:33:20.", kyiv(15, 9, 33, 30)))
        ledger.ingest(RawNotification("com.google.android.apps.walletnfcrel", "Кошелёк", "FOP DEMYANCHUK",
            "70,00 ₴ · Bybit Mastercard ••4236", "", emptyList(), kyiv(15, 9, 34, 0)))
        val tx = store.txs.single()
        assertEquals(70.0, tx.amount, 0.001)
        assertEquals("UAH", tx.currency)
        assertEquals("FOP DEMYANCHUK", tx.merchant)
    }

    @Test fun nbuRate() {
        val json = """[{"r030":840,"txt":"Долар США","rate":41.2345,"cc":"USD","exchangedate":"15.10.2026"}]"""
        assertEquals(41.2345, Rates.parse(json)!!, 1e-9)
        assertNull(Rates.parse("[]"))
        // Real NBU answer for 15.10.2026, with its line breaks.
        val live = "[\n{ \n\"r030\":840,\"txt\":\"Долар США\",\"rate\":44.9801,\"cc\":\"USD\",\"exchangedate\":\"15.10.2026\",\"special\":\"N\"\n }\n]"
        assertEquals(44.9801, Rates.parse(live)!!, 1e-9)
        assertEquals(219.50, Rates.toUah(4.88, 44.9801), 0.001)
        assertEquals(201.22, Rates.toUah(4.88, 41.2345), 0.001) // 201.224 → kopecks
        assertEquals(
            "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&date=20261015&json",
            Rates.url("usd", LocalDate.of(2026, 10, 15)),
        )
    }
}
