package com.oranng.kazna.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.ZoneId

class StatsTest {
    private val zone = ZoneId.of("Europe/Kyiv")
    private fun t(day: Int, amount: Double, kind: Kind, cat: String, dir: Int = if (kind == Kind.INCOME) 1 else -1, cur: String = "UAH", m: String = "X") =
        Tx(
            time = LocalDateTime.of(2026, 10, day, 12, 0).atZone(zone).toInstant().toEpochMilli(),
            amount = amount, currency = cur, direction = dir, kind = kind, merchant = m, category = cat,
            source = "ПУМБ", account = null, balance = null, origin = Origin.AUTO,
        )

    @Test fun transfersAreNeverSpending() {
        val txs = listOf(
            t(1, 100.0, Kind.SPEND, Categories.GROCERIES, m = "SILPO"),
            t(2, 50.0, Kind.SPEND, Categories.GROCERIES, m = "ATB"),
            t(3, 30.0, Kind.SPEND, Categories.TAXI, m = "Uklon"),
            t(3, 500.0, Kind.TRANSFER, Categories.OWN),
            t(5, 1000.0, Kind.INCOME, Categories.INCOME),
            t(6, 9.99, Kind.SPEND, Categories.SUBSCRIPTIONS, cur = "USD"),
            t(9, 40.0, Kind.SPEND, Categories.CAFE).copy(time = LocalDateTime.of(2026, 9, 30, 12, 0).atZone(zone).toInstant().toEpochMilli()),
        )
        val s = Stats.month(txs, YearMonth.of(2026, 10), zone, LocalDate.of(2026, 10, 6))
        assertEquals(180.0, s.spent, 0.001)
        assertEquals(1000.0, s.income, 0.001)
        assertEquals(Categories.GROCERIES, s.categories.first().category)
        assertEquals(150.0, s.categories.first().total, 0.001)
        assertEquals(9.99, s.otherCurrencies["USD"]!!, 0.001)
        assertEquals(220.0, s.week, 0.001) // Sep 30 cafe is inside the 7-day window
        assertEquals(0.0, s.today, 0.001)
        assertEquals("SILPO", s.merchants.first().merchant)
    }

    @Test fun csvHasHeaderAndSignedAmounts() {
        val csv = Stats.csv(listOf(t(1, 100.5, Kind.SPEND, Categories.GROCERIES, m = "SILPO")), zone)
        assertTrue(csv.startsWith("Дата;"))
        assertTrue(csv.contains("-100,50;UAH;Трата;\"Продукты\";\"SILPO\""))
    }
}
