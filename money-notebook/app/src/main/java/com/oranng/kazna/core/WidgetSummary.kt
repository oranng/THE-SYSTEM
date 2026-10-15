package com.oranng.kazna.core

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** What one placed widget shows; chosen in its settings screen. */
data class WidgetConfig(
    val showIncome: Boolean = true,
    val showSpend: Boolean = true,
    val showHistory: Boolean = true,
    /** true: last 7 days, false: current month. */
    val week: Boolean = false,
)

/** Numbers for the home-screen widget. Plain values; formatting happens in the widget. */
data class WidgetSummary(
    val spent: Double,
    val income: Double,
    /** Today's operations, newest first (transfers between own cards left out). */
    val history: List<Tx>,
    val review: Int,
)

object Widget {
    const val HISTORY_LINES = 4

    fun summary(all: List<Tx>, config: WidgetConfig, zone: ZoneId, now: LocalDate = LocalDate.now(zone)): WidgetSummary {
        val (spent, income) = Stats.period(all, config.week, zone, now)
        val today = all.filter { Stats.dayOf(it.time, zone) == now && it.kind != Kind.TRANSFER }
            .sortedByDescending { it.time }
        return WidgetSummary(
            spent = spent,
            income = income,
            history = today.take(HISTORY_LINES),
            review = all.count { it.review },
        )
    }

    /** Next local midnight, when "today" and the period have to roll over. */
    fun nextMidnight(nowMillis: Long, zone: ZoneId): Long =
        Instant.ofEpochMilli(nowMillis).atZone(zone).toLocalDate().plusDays(1)
            .atStartOfDay(zone).toInstant().toEpochMilli()
}
