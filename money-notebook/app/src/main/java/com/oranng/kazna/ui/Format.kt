package com.oranng.kazna.ui

import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

object Palette {
    val bg = Color(0xFF101413)
    val surface = Color(0xFF181E1C)
    val surface2 = Color(0xFF202826)
    val line = Color(0xFF2C3633)
    val text = Color(0xFFE9EEEB)
    val dim = Color(0xFF8C9A95)
    val gold = Color(0xFFE8C468)
    val spend = Color(0xFFEF8A7A)
    val income = Color(0xFF6FD6A0)
    val transfer = Color(0xFF8C9A95)
    val warn = Color(0xFFF2B35B)

    /** Stable colour per category for bars and chips. */
    private val catColors = listOf(
        0xFFE8C468, 0xFF6FB3D6, 0xFFEF8A7A, 0xFF8FD18A, 0xFFB79CF0, 0xFFF2B35B, 0xFF5ED1C4,
        0xFFE68FC0, 0xFFA7B86A, 0xFF9AA9F0, 0xFFD9A07A, 0xFF7FC7E8,
    ).map { Color(it) }

    fun forCategory(name: String): Color = catColors[abs(name.hashCode()) % catColors.size]

    val scheme = darkColorScheme(
        primary = gold, onPrimary = Color(0xFF1B1608), background = bg, onBackground = text,
        surface = surface, onSurface = text, surfaceVariant = surface2, onSurfaceVariant = dim,
        secondary = income, error = spend, outline = line,
    )
}

object Fmt {
    val zone: ZoneId get() = ZoneId.systemDefault()
    private val ru = Locale.forLanguageTag("ru")

    /** 1250.5 → "1 250,50 ₴"; whole amounts drop the kopecks. */
    fun money(v: Double, currency: String = "UAH", signed: Boolean = false): String {
        val sign = when {
            !signed -> ""
            v > 0 -> "+"
            v < 0 -> "−"
            else -> ""
        }
        val a = abs(v)
        val whole = a.roundToLong()
        val body = if (abs(a - whole) < 0.005) group(whole) else {
            val cents = (a * 100).roundToLong()
            group(cents / 100) + "," + "%02d".format(cents % 100)
        }
        val sym = when (currency) { "UAH" -> "₴"; "USD" -> "$"; "EUR" -> "€"; else -> currency }
        return "$sign$body $sym"
    }

    private fun group(n: Long): String = n.toString().reversed().chunked(3).joinToString(" ").reversed()

    fun monthTitle(m: YearMonth): String {
        val names = listOf("Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь")
        return "${names[m.monthValue - 1]} ${m.year}"
    }

    fun dayTitle(d: LocalDate, today: LocalDate = LocalDate.now(zone)): String {
        val months = listOf("января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря")
        return when (d) {
            today -> "Сегодня"
            today.minusDays(1) -> "Вчера"
            else -> "${d.dayOfMonth} ${months[d.monthValue - 1]}" + if (d.year != today.year) " ${d.year}" else ""
        }
    }

    fun time(t: Long): String {
        val z = Instant.ofEpochMilli(t).atZone(zone)
        return "%02d:%02d".format(z.hour, z.minute)
    }

    fun dateTime(t: Long): String {
        val z = Instant.ofEpochMilli(t).atZone(zone)
        return "%02d.%02d.%d %02d:%02d".format(z.dayOfMonth, z.monthValue, z.year, z.hour, z.minute)
    }

    fun parseAmount(s: String): Double? =
        s.replace(Regex("[\\s\\u00A0\\u202F₴]"), "").replace(',', '.').toDoubleOrNull()?.takeIf { it > 0 }

    @Suppress("unused") private val keepLocale = ru
}
