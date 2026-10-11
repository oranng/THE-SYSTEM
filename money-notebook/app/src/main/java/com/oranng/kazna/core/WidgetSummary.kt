package com.oranng.kazna.core

import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

/** What the home-screen widget shows. Plain numbers; formatting happens in the widget. */
data class WidgetSummary(
    val today: Double,
    val month: Double,
    /** Average spend per elapsed day of the current month. */
    val perDay: Double,
    val last: Tx?,
    val review: Int,
)

object Widget {
    fun summary(all: List<Tx>, zone: ZoneId, now: LocalDate = LocalDate.now(zone)): WidgetSummary {
        val s = Stats.month(all, YearMonth.from(now), zone, now)
        val last = all.filter { it.kind == Kind.SPEND && it.direction < 0 }.maxByOrNull { it.time }
        return WidgetSummary(
            today = s.today,
            month = s.spent,
            perDay = if (s.spent > 0) s.spent / now.dayOfMonth else 0.0,
            last = last,
            review = s.review,
        )
    }

    /** Next local midnight, when "today" has to reset to zero. */
    fun nextMidnight(nowMillis: Long, zone: ZoneId): Long =
        Instant.ofEpochMilli(nowMillis).atZone(zone).toLocalDate().plusDays(1)
            .atStartOfDay(zone).toInstant().toEpochMilli()
}
