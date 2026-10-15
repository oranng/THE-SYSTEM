package com.oranng.kazna.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.oranng.kazna.core.Categories
import com.oranng.kazna.core.Categorizer
import com.oranng.kazna.core.Kind
import com.oranng.kazna.core.Origin
import com.oranng.kazna.core.Tx
import com.oranng.kazna.data.Db

/** Edit an existing transaction, or add a manual one when [tx] is null. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EditTxDialog(tx: Tx?, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val db = Db.get(context)
    var merchant by remember { mutableStateOf(tx?.merchant.orEmpty()) }
    var amount by remember { mutableStateOf(tx?.let { "%.2f".format(java.util.Locale.ROOT, it.amount).replace('.', ',') }.orEmpty()) }
    var kind by remember { mutableStateOf(tx?.kind ?: Kind.SPEND) }
    var category by remember { mutableStateOf(tx?.category?.takeIf { it in Categories.spending } ?: if (tx == null) Categories.GROCERIES else Categories.OTHER) }
    var rememberRule by remember { mutableStateOf(true) }
    var confirmDelete by remember { mutableStateOf(false) }

    val parsedAmount = Fmt.parseAmount(amount)
    val canSave = parsedAmount != null && merchant.isNotBlank()

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Palette.surface,
        title = { Text(if (tx == null) "Новая операция" else "Операция", color = Palette.text) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                tx?.let {
                    Text("${it.source}${it.account?.let { a -> " *$a" } ?: ""} · ${Fmt.dateTime(it.time)}", color = Palette.dim, fontSize = 12.sp)
                    if (it.note.isNotBlank()) Text(it.note, color = Palette.warn, fontSize = 12.sp)
                    it.balance?.let { b -> Text("Остаток после операции: ${Fmt.money(b, it.currency)}", color = Palette.dim, fontSize = 12.sp) }
                    if (it.currency != "UAH") {
                        Text(
                            it.uah?.let { u -> "В гривнах по курсу НБУ на дату покупки: ${Fmt.money(u)}" }
                                ?: "Курс НБУ ещё не получен: пересчитается при подключении к интернету.",
                            color = Palette.dim, fontSize = 12.sp,
                        )
                    }
                }
                OutlinedTextField(
                    value = merchant, onValueChange = { merchant = it }, singleLine = true,
                    label = { Text("Магазин / получатель") }, modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = amount, onValueChange = { amount = it }, singleLine = true,
                    label = { Text("Сумма, ${if ((tx?.currency ?: "UAH") == "UAH") "₴" else tx?.currency}") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(Kind.SPEND to "Трата", Kind.INCOME to "Доход", Kind.TRANSFER to "Между своими").forEach { (k, l) ->
                        FilterChip(
                            selected = kind == k, onClick = { kind = k }, label = { Text(l, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Palette.surface2, selectedLabelColor = Palette.gold),
                        )
                    }
                }
                if (kind == Kind.SPEND) {
                    Text("Категория", color = Palette.dim, fontSize = 12.sp)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Categories.spending.forEach { c ->
                            FilterChip(
                                selected = category == c, onClick = { category = c }, label = { Text(c, fontSize = 12.sp) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Palette.forCategory(c).copy(alpha = 0.25f), selectedLabelColor = Palette.text),
                            )
                        }
                    }
                    if (merchant.isNotBlank()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = rememberRule, onCheckedChange = { rememberRule = it }, colors = CheckboxDefaults.colors(checkedColor = Palette.gold))
                            Text("Запомнить «$category» для «${merchant.take(24)}»", color = Palette.dim, fontSize = 12.sp)
                        }
                    }
                }
                if (tx != null) {
                    TextButton(onClick = { if (confirmDelete) { db.delete(tx.id); onDismiss() } else confirmDelete = true }) {
                        Text(if (confirmDelete) "Нажми ещё раз, чтобы удалить" else "Удалить операцию", color = Palette.spend)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(enabled = canSave, onClick = {
                val a = parsedAmount ?: return@TextButton
                val cat = when (kind) {
                    Kind.SPEND -> category
                    Kind.INCOME -> Categories.INCOME
                    Kind.TRANSFER -> Categories.OWN
                }
                val direction = when {
                    kind == Kind.INCOME -> 1
                    kind == Kind.SPEND -> -1
                    else -> tx?.direction ?: -1
                }
                if (tx == null) {
                    db.insert(
                        Tx(
                            time = System.currentTimeMillis(), amount = a, currency = "UAH", direction = direction,
                            kind = kind, merchant = merchant.trim(), category = cat, source = "Наличные",
                            account = null, balance = null, origin = Origin.MANUAL,
                        ),
                    )
                } else {
                    // A changed foreign amount needs a fresh conversion.
                    val uah = if (tx.currency != "UAH" && kotlin.math.abs(a - tx.amount) > 0.001) null else tx.uah
                    db.update(tx.copy(merchant = merchant.trim(), amount = a, kind = kind, direction = direction, category = cat, review = false, uah = uah))
                    if (tx.currency != "UAH" && uah == null) com.oranng.kazna.service.RateJob.schedule(context)
                }
                if (kind == Kind.SPEND && rememberRule && Categorizer.merchantKey(merchant).isNotBlank()) {
                    db.learnRule(merchant.trim(), category)
                }
                onDismiss()
            }) { Text("Сохранить", color = if (canSave) Palette.gold else Palette.dim) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена", color = Palette.dim) } },
    )
}

