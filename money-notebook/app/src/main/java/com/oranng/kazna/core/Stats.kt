package com.oranng.kazna.core

import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

data class CategoryTotal(val category: String, val total: Double, val count: Int)
data class MerchantTotal(val merchant: String, val total: Double, val count: Int)
data class MonthPoint(val month: YearMonth, val spent: Double, val income: Double)

data class MonthStats(
    val month: YearMonth,
    /** Spending in hryvnias, foreign spends included at the NBU rate (transfers never count). */
    val spent: Double,
    val income: Double,
    val categories: List<CategoryTotal>,
    val merchants: List<MerchantTotal>,
    /** Foreign-currency spending in its own currency, e.g. USD from the Bybit card. */
    val otherCurrencies: Map<String, Double>,
    val today: Double,
    val week: Double,
    val review: Int,
    /** Foreign spends whose hryvnia value is not known yet (no internet so far). */
    val pendingRate: Int,
)

/** Statistics over several months (3, 6, 12). */
data class RangeStats(
    val months: List<MonthPoint>,
    val spent: Double,
    val income: Double,
    val avgSpent: Double,
    val categories: List<CategoryTotal>,
    val merchants: List<MerchantTotal>,
    val pendingRate: Int,
)

object Stats {
    const val BASE = "UAH"

    fun monthOf(time: Long, zone: ZoneId): YearMonth = YearMonth.from(Instant.ofEpochMilli(time).atZone(zone))

    fun dayOf(time: Long, zone: ZoneId): LocalDate = Instant.ofEpochMilli(time).atZone(zone).toLocalDate()

    private fun isSpend(t: Tx) = t.kind == Kind.SPEND && t.direction < 0
    private fun isIncome(t: Tx) = t.kind == Kind.INCOME

    private fun sumUah(list: List<Tx>) = list.sumOf { it.uahValue ?: 0.0 }

    private fun categories(spend: List<Tx>) = spend.filter { it.uahValue != null }
        .groupBy { it.category.ifBlank { Categories.OTHER } }
        .map { (c, l) -> CategoryTotal(c, sumUah(l), l.size) }
        .sortedByDescending { it.total }

    private fun merchants(spend: List<Tx>) = spend.filter { it.uahValue != null }
        .groupBy { it.merchant }
        .map { (m, l) -> MerchantTotal(m, sumUah(l), l.size) }
        .sortedByDescending { it.total }

    fun month(all: List<Tx>, month: YearMonth, zone: ZoneId, today: LocalDate = LocalDate.now(zone)): MonthStats {
        val inMonth = all.filter { monthOf(it.time, zone) == month }
        val spend = inMonth.filter(::isSpend)
        val weekStart = today.minusDays(6)
        val allSpend = all.filter(::isSpend)
        return MonthStats(
            month = month,
            spent = sumUah(spend),
            income = sumUah(inMonth.filter(::isIncome)),
            categories = categories(spend),
            merchants = merchants(spend),
            otherCurrencies = spend.filter { it.currency != BASE }.groupBy { it.currency }.mapValues { (_, l) -> l.sumOf { it.amount } },
            today = sumUah(allSpend.filter { dayOf(it.time, zone) == today }),
            week = sumUah(allSpend.filter { dayOf(it.time, zone) in weekStart..today }),
            review = inMonth.count { it.review },
            pendingRate = inMonth.count { it.pendingRate },
        )
    }

    /** The last [count] months ending with [end] (inclusive), oldest first. */
    fun range(all: List<Tx>, count: Int, end: YearMonth, zone: ZoneId): RangeStats {
        val months = (count - 1 downTo 0).map { end.minusMonths(it.toLong()) }
        val first = months.first()
        val inRange = all.filter { monthOf(it.time, zone) in first..end }
        val spend = inRange.filter(::isSpend)
        val byMonth = inRange.groupBy { monthOf(it.time, zone) }
        val points = months.map { m ->
            val l = byMonth[m].orEmpty()
            MonthPoint(m, sumUah(l.filter(::isSpend)), sumUah(l.filter(::isIncome)))
        }
        // Average over months that actually have data, so a fresh install is not diluted by empty months.
        val active = points.count { it.spent > 0 || it.income > 0 }.coerceAtLeast(1)
        val spent = sumUah(spend)
        return RangeStats(
            months = points,
            spent = spent,
            income = sumUah(inRange.filter(::isIncome)),
            avgSpent = spent / active,
            categories = categories(spend),
            merchants = merchants(spend),
            pendingRate = inRange.count { it.pendingRate },
        )
    }

    /** Spend and income over the last 7 days (today included) or the current month. */
    fun period(all: List<Tx>, week: Boolean, zone: ZoneId, today: LocalDate = LocalDate.now(zone)): Pair<Double, Double> {
        val inPeriod = all.filter {
            val d = dayOf(it.time, zone)
            if (week) d in today.minusDays(6)..today else YearMonth.from(d) == YearMonth.from(today)
        }
        return sumUah(inPeriod.filter(::isSpend)) to sumUah(inPeriod.filter(::isIncome))
    }

    fun csv(all: List<Tx>, zone: ZoneId): String {
        val sb = StringBuilder("Дата;Время;Сумма;Валюта;Сумма в гривнах;Тип;Категория;Магазин;Источник;Карта;Остаток;Комментарий\n")
        fun num(v: Double) = "%.2f".format(java.util.Locale.ROOT, v).replace('.', ',')
        for (t in all.sortedBy { it.time }) {
            val dt = Instant.ofEpochMilli(t.time).atZone(zone)
            val kind = when (t.kind) { Kind.SPEND -> "Трата"; Kind.INCOME -> "Доход"; Kind.TRANSFER -> "Перевод" }
            fun q(s: String) = "\"" + s.replace("\"", "\"\"") + "\""
            sb.append(dt.toLocalDate()).append(';')
                .append("%02d:%02d".format(dt.hour, dt.minute)).append(';')
                .append(num(t.signed)).append(';')
                .append(t.currency).append(';')
                .append(t.uahValue?.let { num(it * t.direction) } ?: "").append(';')
                .append(kind).append(';')
                .append(q(t.category)).append(';').append(q(t.merchant)).append(';')
                .append(q(t.source)).append(';').append(t.account ?: "").append(';')
                .append(t.balance?.let { num(it) } ?: "").append(';')
                .append(q(t.note)).append('\n')
        }
        return sb.toString()
    }
}
