package com.oranng.kazna.core

import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

data class CategoryTotal(val category: String, val total: Double, val count: Int)
data class MerchantTotal(val merchant: String, val total: Double, val count: Int)

data class MonthStats(
    val month: YearMonth,
    /** Spending in hryvnias (SPEND only; transfers never count). */
    val spent: Double,
    val income: Double,
    val categories: List<CategoryTotal>,
    val merchants: List<MerchantTotal>,
    /** Spending in other currencies, e.g. USD from the Bybit card. */
    val otherCurrencies: Map<String, Double>,
    val today: Double,
    val week: Double,
    val review: Int,
)

object Stats {
    const val BASE = "UAH"

    fun monthOf(time: Long, zone: ZoneId): YearMonth = YearMonth.from(Instant.ofEpochMilli(time).atZone(zone))

    fun dayOf(time: Long, zone: ZoneId): LocalDate = Instant.ofEpochMilli(time).atZone(zone).toLocalDate()

    fun month(all: List<Tx>, month: YearMonth, zone: ZoneId, today: LocalDate = LocalDate.now(zone)): MonthStats {
        val inMonth = all.filter { monthOf(it.time, zone) == month }
        val spend = inMonth.filter { it.kind == Kind.SPEND && it.direction < 0 }
        val base = spend.filter { it.currency == BASE }
        // A refund (positive SPEND) would be odd; incomes are their own kind.
        val income = inMonth.filter { it.kind == Kind.INCOME && it.currency == BASE }.sumOf { it.amount }

        val categories = base.groupBy { it.category.ifBlank { Categories.OTHER } }
            .map { (c, l) -> CategoryTotal(c, l.sumOf { it.amount }, l.size) }
            .sortedByDescending { it.total }
        val merchants = base.groupBy { it.merchant }
            .map { (m, l) -> MerchantTotal(m, l.sumOf { it.amount }, l.size) }
            .sortedByDescending { it.total }
        val other = spend.filter { it.currency != BASE }.groupBy { it.currency }
            .mapValues { (_, l) -> l.sumOf { it.amount } }

        val weekStart = today.minusDays(6)
        val allBaseSpend = all.filter { it.kind == Kind.SPEND && it.direction < 0 && it.currency == BASE }
        return MonthStats(
            month = month,
            spent = base.sumOf { it.amount },
            income = income,
            categories = categories,
            merchants = merchants,
            otherCurrencies = other,
            today = allBaseSpend.filter { dayOf(it.time, zone) == today }.sumOf { it.amount },
            week = allBaseSpend.filter { dayOf(it.time, zone) in weekStart..today }.sumOf { it.amount },
            review = inMonth.count { it.review },
        )
    }

    fun csv(all: List<Tx>, zone: ZoneId): String {
        val sb = StringBuilder("Дата;Время;Сумма;Валюта;Тип;Категория;Магазин;Источник;Карта;Остаток;Комментарий\n")
        for (t in all.sortedBy { it.time }) {
            val dt = Instant.ofEpochMilli(t.time).atZone(zone)
            val kind = when (t.kind) { Kind.SPEND -> "Трата"; Kind.INCOME -> "Доход"; Kind.TRANSFER -> "Перевод" }
            fun q(s: String) = "\"" + s.replace("\"", "\"\"") + "\""
            sb.append(dt.toLocalDate()).append(';')
                .append("%02d:%02d".format(dt.hour, dt.minute)).append(';')
                .append("%.2f".format(java.util.Locale.ROOT, t.signed).replace('.', ',')).append(';')
                .append(t.currency).append(';').append(kind).append(';')
                .append(q(t.category)).append(';').append(q(t.merchant)).append(';')
                .append(q(t.source)).append(';').append(t.account ?: "").append(';')
                .append(t.balance?.let { "%.2f".format(java.util.Locale.ROOT, it).replace('.', ',') } ?: "").append(';')
                .append(q(t.note)).append('\n')
        }
        return sb.toString()
    }
}
