package com.oranng.kazna.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.oranng.kazna.core.Kind
import com.oranng.kazna.core.Origin
import com.oranng.kazna.core.Stats
import com.oranng.kazna.core.Tx
import java.time.YearMonth

private enum class KindFilter(val label: String) { ALL("Все"), SPEND("Траты"), INCOME("Доходы"), TRANSFER("Переводы") }

@Composable
fun OperationsScreen(
    txs: List<Tx>,
    month: YearMonth,
    onMonth: (YearMonth) -> Unit,
    filter: OpsFilter,
    onFilter: (OpsFilter) -> Unit,
    openAdd: Boolean = false,
    onAddOpened: () -> Unit = {},
) {
    var kind by remember { mutableStateOf(KindFilter.ALL) }
    var editing by remember { mutableStateOf<Tx?>(null) }
    var adding by remember { mutableStateOf(false) }
    LaunchedEffect(openAdd) { if (openAdd) { adding = true; onAddOpened() } }

    val shown = remember(txs, month, filter, kind) {
        txs.filter { Stats.monthOf(it.time, Fmt.zone) == month }
            .filter { filter.category == null || it.category == filter.category }
            .filter { !filter.reviewOnly || it.review }
            .filter {
                when (kind) {
                    KindFilter.ALL -> true
                    KindFilter.SPEND -> it.kind == Kind.SPEND
                    KindFilter.INCOME -> it.kind == Kind.INCOME
                    KindFilter.TRANSFER -> it.kind == Kind.TRANSFER
                }
            }
    }
    val byDay = remember(shown) { shown.groupBy { Stats.dayOf(it.time, Fmt.zone) }.toSortedMap(compareByDescending { it }) }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
            item {
                Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Операции", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Palette.text, modifier = Modifier.weight(1f))
                    MonthSwitcher(month, onMonth)
                }
            }
            item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KindFilter.entries.forEach { k -> Chip(k.label, kind == k) { kind = k } }
                    if (filter.reviewOnly) Chip("Проверить ×", true) { onFilter(filter.copy(reviewOnly = false)) }
                    filter.category?.let { c -> Chip("$c ×", true) { onFilter(filter.copy(category = null)) } }
                }
                Spacer(Modifier.height(4.dp))
            }
            if (shown.isEmpty()) item {
                Text(
                    "Здесь пусто. Траты появятся автоматически из уведомлений банков, а наличные можно добавить кнопкой «+».",
                    color = Palette.dim, fontSize = 13.sp, modifier = Modifier.padding(vertical = 24.dp),
                )
            }
            byDay.forEach { (day, list) ->
                item(key = "h$day") {
                    val dayTotal = list.filter { it.kind == Kind.SPEND && it.currency == "UAH" }.sumOf { it.amount }
                    Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 6.dp)) {
                        Text(Fmt.dayTitle(day), color = Palette.dim, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                        if (dayTotal > 0) Text("−" + Fmt.money(dayTotal), color = Palette.dim, fontSize = 13.sp)
                    }
                }
                items(list, key = { it.id }) { tx -> TxRow(tx) { editing = tx } }
            }
            item { Spacer(Modifier.height(88.dp)) }
        }
        FloatingActionButton(
            onClick = { adding = true },
            containerColor = Palette.gold,
            modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp),
        ) { Text("+", fontSize = 26.sp, color = Palette.bg) }
    }

    editing?.let { tx -> EditTxDialog(tx = tx, onDismiss = { editing = null }) }
    if (adding) EditTxDialog(tx = null, onDismiss = { adding = false })
}

@Composable
private fun Chip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected, onClick = onClick, label = { Text(label) },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = Palette.surface2, selectedLabelColor = Palette.gold, labelColor = Palette.dim,
        ),
    )
}

@Composable
fun TxRow(tx: Tx, onClick: () -> Unit) {
    val color = when (tx.kind) {
        Kind.SPEND -> Palette.text
        Kind.INCOME -> Palette.income
        Kind.TRANSFER -> Palette.transfer
    }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Palette.surface)
            .clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(34.dp).clip(CircleShape).background(Palette.forCategory(tx.category).copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(tx.category.take(1), color = Palette.forCategory(tx.category), fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(tx.merchant, color = Palette.text, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (tx.review) {
                    Spacer(Modifier.width(6.dp))
                    Text("проверить", color = Palette.warn, fontSize = 10.sp,
                        modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(Palette.warn.copy(alpha = 0.15f)).padding(horizontal = 5.dp, vertical = 1.dp))
                }
            }
            val sub = buildList {
                add(tx.category)
                add(tx.source + (tx.account?.let { " *$it" } ?: ""))
                add(Fmt.time(tx.time))
                if (tx.origin == Origin.MANUAL) add("вручную")
            }.joinToString(" · ")
            Text(sub, color = Palette.dim, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        Text(
            Fmt.money(tx.signed, tx.currency, signed = true),
            color = color, fontWeight = FontWeight.SemiBold,
        )
    }
    Spacer(Modifier.height(6.dp))
}
