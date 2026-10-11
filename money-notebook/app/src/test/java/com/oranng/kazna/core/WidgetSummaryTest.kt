package com.oranng.kazna.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

class WidgetSummaryTest {
    private val zone = ZoneId.of("Europe/Kyiv")
    private fun at(day: Int, h: Int) = LocalDateTime.of(2026, 10, day, h, 0).atZone(zone).toInstant().toEpochMilli()
    private fun tx(day: Int, h: Int, amount: Double, kind: Kind = Kind.SPEND, m: String = "SILPO", review: Boolean = false) = Tx(
        time = at(day, h), amount = amount, currency = "UAH", direction = if (kind == Kind.INCOME) 1 else -1,
        kind = kind, merchant = m, category = Categories.GROCERIES, source = "Google Кошелёк",
        account = null, balance = null, origin = Origin.AUTO, review = review,
    )

    @Test fun todayMonthAndLastSpend() {
        val txs = listOf(
            tx(1, 10, 300.0),
            tx(10, 9, 120.0, m = "WOG"),
            tx(10, 18, 80.0, m = "ATB", review = true),
            tx(10, 20, 500.0, kind = Kind.TRANSFER), // never counted, never "last spend"
            tx(10, 21, 1000.0, kind = Kind.INCOME),
        )
        val w = Widget.summary(txs, zone, LocalDate.of(2026, 10, 10))
        assertEquals(200.0, w.today, 0.001)
        assertEquals(500.0, w.month, 0.001)
        assertEquals(50.0, w.perDay, 0.001)
        assertEquals("ATB", w.last!!.merchant)
        assertEquals(1, w.review)
    }

    @Test fun emptyIsZero() {
        val w = Widget.summary(emptyList(), zone, LocalDate.of(2026, 10, 10))
        assertEquals(0.0, w.today, 0.0)
        assertEquals(0.0, w.perDay, 0.0)
        assertNull(w.last)
    }

    @Test fun midnight() {
        val next = Widget.nextMidnight(at(10, 23), zone)
        assertEquals(LocalDateTime.of(2026, 10, 11, 0, 0).atZone(zone).toInstant().toEpochMilli(), next)
    }
}
