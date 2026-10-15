package com.oranng.kazna.ui

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.oranng.kazna.core.Stats
import com.oranng.kazna.core.Tx
import com.oranng.kazna.service.SpendListener
import java.time.YearMonth

@Composable
fun MonthSwitcher(month: YearMonth, onMonth: (YearMonth) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        TextButton(onClick = { onMonth(month.minusMonths(1)) }) { Text("‹", fontSize = 22.sp, color = Palette.dim) }
        Text(Fmt.monthTitle(month), fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Palette.text)
        TextButton(onClick = { onMonth(month.plusMonths(1)) }, enabled = month < YearMonth.now()) {
            Text("›", fontSize = 22.sp, color = if (month < YearMonth.now()) Palette.dim else Palette.line)
        }
    }
}

@Composable
fun Card(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Palette.surface)
            .padding(16.dp),
    ) { content() }
}

@Composable
fun Label(text: String) {
    Text(text.uppercase(), color = Palette.dim, fontSize = 11.sp, letterSpacing = 1.2.sp, fontWeight = FontWeight.Medium)
}

@Composable
fun OverviewScreen(
    txs: List<Tx>,
    month: YearMonth,
    onMonth: (YearMonth) -> Unit,
    resumes: Int,
    onOpenOps: (OpsFilter) -> Unit,
    onOpenSettings: () -> Unit,
) {
    val context = LocalContext.current
    val enabled = remember(resumes) { SpendListener.isEnabled(context) }
    val s = remember(txs, month) { Stats.month(txs, month, Fmt.zone) }
    val isNow = month == YearMonth.now()

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Казна", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Palette.gold, modifier = Modifier.weight(1f))
                MonthSwitcher(month, onMonth)
            }
        }

        if (!enabled) item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Нужен доступ к уведомлениям", fontWeight = FontWeight.SemiBold, color = Palette.warn)
                    Text(
                        "Без него Казна не видит уведомления ПУМБ, Райфа, Приват24 и Google Кошелька и не может считать траты сама.",
                        color = Palette.dim, fontSize = 13.sp,
                    )
                    Button(
                        onClick = { context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) },
                        colors = ButtonDefaults.buttonColors(containerColor = Palette.gold),
                    ) { Text("Открыть настройки доступа") }
                    TextButton(onClick = onOpenSettings) { Text("Подробнее в Настройках", color = Palette.dim) }
                }
            }
        }

        item {
            Card {
                Column {
                    Label("Потрачено за месяц")
                    Text(Fmt.money(s.spent), fontSize = 36.sp, fontWeight = FontWeight.Bold, color = Palette.text)
                    if (s.otherCurrencies.isNotEmpty()) {
                        Text(
                            "в том числе с валютных карт " + s.otherCurrencies.entries.joinToString(" · ") { Fmt.money(it.value, it.key) },
                            color = Palette.dim, fontSize = 13.sp,
                        )
                    }
                    if (s.pendingRate > 0) {
                        Text(
                            "Ждут курса НБУ: ${s.pendingRate}. Пересчитаются в гривны, когда появится интернет.",
                            color = Palette.warn, fontSize = 12.sp,
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Stat("Доход", Fmt.money(s.income), Palette.income)
                        Stat("Разница", Fmt.money(s.income - s.spent, signed = true), if (s.income >= s.spent) Palette.income else Palette.spend)
                    }
                    if (isNow) {
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Stat("Сегодня", Fmt.money(s.today), Palette.text)
                            Stat("7 дней", Fmt.money(s.week), Palette.text)
                            if (s.spent > 0) {
                                val days = if (isNow) java.time.LocalDate.now().dayOfMonth else month.lengthOfMonth()
                                Stat("В день", Fmt.money(s.spent / days), Palette.text)
                            }
                        }
                    }
                }
            }
        }

        if (s.review > 0) item {
            Card(Modifier.clickable { onOpenOps(OpsFilter(reviewOnly = true)) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("!", color = Palette.warn, fontWeight = FontWeight.Bold, fontSize = 20.sp, modifier = Modifier.width(24.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Проверить: ${s.review}", color = Palette.warn, fontWeight = FontWeight.SemiBold)
                        Text("Неизвестные магазины и пропущенные уведомления. Укажи категорию один раз — дальше Казна запомнит.", color = Palette.dim, fontSize = 12.sp)
                    }
                    Text("›", color = Palette.dim, fontSize = 22.sp)
                }
            }
        }

        item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Label("Категории")
                    if (s.categories.isEmpty()) {
                        Text(
                            if (enabled) "Трат за этот месяц пока нет. Они появятся сами после первой покупки по карте."
                            else "Здесь появятся траты по категориям.",
                            color = Palette.dim, fontSize = 13.sp,
                        )
                    }
                    val max = s.categories.maxOfOrNull { it.total } ?: 1.0
                    s.categories.forEach { c ->
                        Column(
                            Modifier.fillMaxWidth().clickable { onOpenOps(OpsFilter(category = c.category)) }.padding(vertical = 2.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(Palette.forCategory(c.category)))
                                Spacer(Modifier.width(8.dp))
                                Text(c.category, color = Palette.text, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${(c.total / s.spent * 100).toInt()}%", color = Palette.dim, fontSize = 12.sp)
                                Spacer(Modifier.width(10.dp))
                                Text(Fmt.money(c.total), color = Palette.text, fontWeight = FontWeight.Medium)
                            }
                            Spacer(Modifier.height(5.dp))
                            Box(Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)).background(Palette.surface2)) {
                                Box(
                                    Modifier.fillMaxWidth((c.total / max).toFloat().coerceIn(0.02f, 1f)).height(5.dp)
                                        .clip(RoundedCornerShape(3.dp)).background(Palette.forCategory(c.category)),
                                )
                            }
                        }
                    }
                }
            }
        }

        if (s.merchants.isNotEmpty()) item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Label("Куда ушло больше всего")
                    s.merchants.take(7).forEach { m ->
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

@Composable
private fun Stat(label: String, value: String, color: Color) {
    Column {
        Text(label, color = Palette.dim, fontSize = 12.sp)
        Text(value, color = color, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
    }
}
