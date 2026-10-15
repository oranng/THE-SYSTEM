package com.oranng.kazna.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.oranng.kazna.core.MonthPoint
import com.oranng.kazna.core.Stats
import com.oranng.kazna.core.Tx
import java.time.YearMonth

private val SHORT = listOf("янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек")

@Composable
fun StatsScreen(txs: List<Tx>) {
    var months by rememberSaveable { mutableIntStateOf(3) }
    val r = remember(txs, months) { Stats.range(txs, months, YearMonth.now(), Fmt.zone) }

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Column(Modifier.padding(top = 12.dp)) {
                Text("Статистика", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Palette.text)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(3 to "3 месяца", 6 to "6 месяцев", 12 to "Год").forEach { (n, label) ->
                        FilterChip(
                            selected = months == n, onClick = { months = n }, label = { Text(label) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Palette.surface2, selectedLabelColor = Palette.gold),
                        )
                    }
                }
            }
        }

        item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        Big("Доход", "+" + Fmt.money(r.income), Palette.income)
                        Big("Расход", "−" + Fmt.money(r.spent), Palette.spend)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        Small("Разница", Fmt.money(r.income - r.spent, signed = true), if (r.income >= r.spent) Palette.income else Palette.spend)
                        Small("Расход в месяц", Fmt.money(r.avgSpent), Palette.text)
                    }
                    if (r.pendingRate > 0) {
                        Text("Валютных операций ждут курса НБУ: ${r.pendingRate}. Пересчитаются при подключении к интернету.",
                            color = Palette.warn, fontSize = 12.sp)
                    }
                }
            }
        }

        item {
            Card {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Label("По месяцам")
                        Spacer(Modifier.weight(1f))
                        Legend(Palette.income, "доход"); Spacer(Modifier.width(10.dp)); Legend(Palette.spend, "расход")
                    }
                    Spacer(Modifier.height(12.dp))
                    MonthBars(r.months)
                }
            }
        }

        item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Label("Категории за период")
                    if (r.categories.isEmpty()) Text("Пока нет трат за этот период.", color = Palette.dim, fontSize = 13.sp)
                    val max = r.categories.maxOfOrNull { it.total } ?: 1.0
                    r.categories.forEach { c ->
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(Palette.forCategory(c.category)))
                                Spacer(Modifier.width(8.dp))
                                Text(c.category, color = Palette.text, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${(c.total / r.spent * 100).toInt()}%", color = Palette.dim, fontSize = 12.sp)
                                Spacer(Modifier.width(10.dp))
                                Text(Fmt.money(c.total), color = Palette.text)
                            }
                            Spacer(Modifier.height(4.dp))
                            Box(Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)).background(Palette.surface2)) {
                                Box(Modifier.fillMaxWidth((c.total / max).toFloat().coerceIn(0.02f, 1f)).height(5.dp).background(Palette.forCategory(c.category)))
                            }
                            Text("в месяц ≈ ${Fmt.money(c.total / months)}", color = Palette.dim, fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        if (r.merchants.isNotEmpty()) item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Label("Куда ушло больше всего")
                    r.merchants.take(10).forEach { m ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(m.merchant, color = Palette.text, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text("×${m.count}", color = Palette.dim, fontSize = 12.sp)
                            Spacer(Modifier.width(10.dp))
                            Text(Fmt.money(m.total), color = Palette.text)
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

/** Income (green) and spending (red) side by side for every month, on one scale. */
@Composable
private fun MonthBars(points: List<MonthPoint>) {
    val max = points.maxOfOrNull { maxOf(it.spent, it.income) }?.takeIf { it > 0 } ?: 1.0
    Canvas(Modifier.fillMaxWidth().height(140.dp)) {
        val slot = size.width / points.size
        val bar = (slot * 0.32f).coerceAtMost(28.dp.toPx())
        val gap = bar * 0.15f
        // Faint guide lines at 50% and 100% of the busiest month.
        listOf(0.5f, 1f).forEach { f ->
            val y = size.height - size.height * f
            drawLine(Palette.line, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
        }
        points.forEachIndexed { i, p ->
            val cx = slot * i + slot / 2
            fun draw(value: Double, x: Float, color: Color) {
                val h = (value / max * size.height).toFloat()
                if (h <= 0f) return
                drawRoundRect(color, Offset(x, size.height - h), Size(bar, h), CornerRadius(4.dp.toPx()))
            }
            draw(p.income, cx - bar - gap / 2, Palette.income)
            draw(p.spent, cx + gap / 2, Palette.spend)
        }
    }
    Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
        points.forEach { p ->
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(SHORT[p.month.monthValue - 1], color = Palette.dim, fontSize = 11.sp, textAlign = TextAlign.Center)
                if (points.size <= 6 && p.spent > 0) {
                    Text(compact(p.spent), color = Palette.spend, fontSize = 10.sp, textAlign = TextAlign.Center)
                }
            }
        }
    }
}

/** 12500 → "12,5к" for labels under narrow bars. */
private fun compact(v: Double): String = when {
    v >= 1000 -> "%.1fк".format(java.util.Locale.ROOT, v / 1000).replace('.', ',').replace(",0к", "к")
    else -> v.toInt().toString()
}

@Composable
private fun Legend(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(2.dp)).background(color))
        Spacer(Modifier.width(4.dp))
        Text(label, color = Palette.dim, fontSize = 11.sp)
    }
}

@Composable
private fun Big(label: String, value: String, color: Color) {
    Column {
        Text(label, color = Palette.dim, fontSize = 12.sp)
        Text(value, color = color, fontSize = 24.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun Small(label: String, value: String, color: Color) {
    Column {
        Text(label, color = Palette.dim, fontSize = 12.sp)
        Text(value, color = color, fontWeight = FontWeight.SemiBold)
    }
}
