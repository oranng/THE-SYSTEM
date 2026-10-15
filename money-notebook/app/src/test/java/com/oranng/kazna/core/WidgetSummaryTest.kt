package com.oranng.kazna.core

import org.junit.Assert.assertEquals
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

    private val txs = listOf(
        tx(1, 10, 300.0),
        tx(5, 10, 2000.0, kind = Kind.INCOME, m = "Зарплата"),
        tx(10, 9, 120.0, m = "WOG"),
        tx(10, 18, 80.0, m = "ATB", review = true),
        tx(10, 20, 500.0, kind = Kind.TRANSFER), // never counted, never in history
        tx(10, 21, 1000.0, kind = Kind.INCOME, m = "Фриланс"),
    )

    @Test fun monthIncomeAndSpend() {
        val w = Widget.summary(txs, WidgetConfig(week = false), zone, LocalDate.of(2026, 10, 10))
        assertEquals(500.0, w.spent, 0.001)
        assertEquals(3000.0, w.income, 0.001)
        assertEquals(1, w.review)
    }

    @Test fun weekIncomeAndSpend() {
        val w = Widget.summary(txs, WidgetConfig(week = true), zone, LocalDate.of(2026, 10, 10))
        assertEquals(200.0, w.spent, 0.001)
        assertEquals(3000.0, w.income, 0.001) // Oct 5 is within the last 7 days
    }

    @Test fun todayHistoryNewestFirstWithoutTransfers() {
        val w = Widget.summary(txs, WidgetConfig(), zone, LocalDate.of(2026, 10, 10))
        assertEquals(listOf("Фриланс", "ATB", "WOG"), w.history.map { it.merchant })
    }

    @Test fun midnight() {
        val next = Widget.nextMidnight(at(10, 23), zone)
        assertEquals(LocalDateTime.of(2026, 10, 11, 0, 0).atZone(zone).toInstant().toEpochMilli(), next)
    }
}
