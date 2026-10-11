package com.oranng.kazna.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.oranng.kazna.core.Stats
import com.oranng.kazna.data.Db
import com.oranng.kazna.service.SpendListener
import java.io.File

@Composable
fun SettingsScreen(resumes: Int, version: Int) {
    val context = LocalContext.current
    val db = remember { Db.get(context) }
    val enabled = remember(resumes) { SpendListener.isEnabled(context) }
    val batteryFree = remember(resumes) { ignoresBattery(context) }
    val apps = remember(version) { db.apps() }
    val log = remember(version) { db.logEntries() }
    var showLog by remember { mutableStateOf(false) }
    var confirmWipe by remember { mutableStateOf(false) }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Text("Настройки", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Palette.text, modifier = Modifier.padding(top = 16.dp)) }

        item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Label("Автоматический учёт")
                    StatusLine("Доступ к уведомлениям", enabled)
                    Text(
                        "Система будит Казну только когда приходит уведомление: она читает его, записывает трату и снова засыпает. " +
                            "После перезагрузки и при разблокировке она перечитывает уведомления в шторке, чтобы ничего не пропустить.",
                        color = Palette.dim, fontSize = 12.sp,
                    )
                    Button(
                        onClick = { context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) },
                        colors = ButtonDefaults.buttonColors(containerColor = if (enabled) Palette.surface2 else Palette.gold),
                    ) { Text(if (enabled) "Доступ выдан — открыть настройки" else "Выдать доступ", color = if (enabled) Palette.text else Palette.bg) }

                    Spacer(Modifier.height(4.dp))
                    StatusLine("Без ограничений батареи", batteryFree)
                    Text(
                        "Некоторые прошивки (ColorOS, MIUI, One UI) усыпляют фоновые службы. В списке выбери Казну → «Не ограничивать», а в «О приложении» включи «Автозапуск», если он есть.",
                        color = Palette.dim, fontSize = 12.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (!batteryFree) OutlinedButton(onClick = { requestBattery(context) }) { Text("Снять ограничение", color = Palette.text) }
                        OutlinedButton(onClick = {
                            context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
                        }) { Text("О приложении", color = Palette.text) }
                    }
                }
            }
        }

        item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Label("Откуда считать траты")
                    if (apps.isEmpty()) {
                        Text("Список появится, когда придут первые уведомления. Банки и Google Кошелёк включаются сами.", color = Palette.dim, fontSize = 12.sp)
                    }
                    apps.take(40).forEach { a ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(a.label, color = Palette.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(a.packageName, color = Palette.dim, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Switch(
                                checked = a.watched, onCheckedChange = { db.setWatched(a.packageName, it) },
                                colors = SwitchDefaults.colors(checkedTrackColor = Palette.gold),
                            )
                        }
                    }
                    Text("Читается только текст уведомлений включённых приложений. Всё хранится на телефоне и никуда не отправляется.", color = Palette.dim, fontSize = 11.sp)
                }
            }
        }

        item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Label("Журнал уведомлений")
                            val failed = log.count { it.result == "не распознано" }
                            Text("${log.size} последних" + if (failed > 0) " · не распознано: $failed" else "", color = Palette.dim, fontSize = 12.sp)
                        }
                        TextButton(onClick = { showLog = !showLog }) { Text(if (showLog) "Скрыть" else "Показать", color = Palette.gold) }
                    }
                    if (showLog) {
                        Text("Нажми на запись, чтобы скопировать текст. Если трата не распознана — пришли его разработчику, формат добавится.", color = Palette.dim, fontSize = 11.sp)
                        log.take(60).forEach { e ->
                            Column(
                                Modifier.fillMaxWidth().clickable {
                                    copy(context, "${e.appLabel} | ${e.title}\n${e.text}")
                                }.padding(vertical = 6.dp),
                            ) {
                                Row {
                                    Text("${e.appLabel} · ${Fmt.dateTime(e.time)}", color = Palette.dim, fontSize = 11.sp, modifier = Modifier.weight(1f))
                                    Text(e.result, fontSize = 11.sp, color = if (e.result == "не распознано") Palette.warn else Palette.income)
                                }
                                Text(e.title, color = Palette.text, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                Text(e.text, color = Palette.dim, fontSize = 12.sp, maxLines = 5, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
        }

        item {
            Card {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Label("Данные")
                    OutlinedButton(onClick = { exportCsv(context, db) }) { Text("Экспорт в CSV (Excel, Google Таблицы)", color = Palette.text) }
                    TextButton(onClick = {
                        if (confirmWipe) { db.wipe(); confirmWipe = false } else confirmWipe = true
                    }) { Text(if (confirmWipe) "Точно удалить все операции и правила?" else "Удалить все данные", color = Palette.spend) }
                }
            }
        }
        item { Text("Казна 1.1 · данные только на этом телефоне", color = Palette.dim, fontSize = 11.sp, modifier = Modifier.padding(bottom = 24.dp)) }
    }
}

@Composable
private fun StatusLine(label: String, ok: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(if (ok) "●" else "○", color = if (ok) Palette.income else Palette.warn)
        Text("  $label: " + if (ok) "включено" else "выключено", color = Palette.text, fontSize = 14.sp)
    }
}

private fun ignoresBattery(context: Context): Boolean =
    (context.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(context.packageName)

/** Opens the system list; the player picks Казна → «Не ограничивать». No extra permission needed. */
private fun requestBattery(context: Context) {
    runCatching {
        context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }.onFailure {
        context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }
}

private fun copy(context: Context, text: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    cm.setPrimaryClip(ClipData.newPlainText("Казна", text))
    Toast.makeText(context, "Скопировано", Toast.LENGTH_SHORT).show()
}

private fun exportCsv(context: Context, db: Db) {
    val dir = File(context.cacheDir, "exports").apply { mkdirs() }
    val file = File(dir, "kazna.csv")
    // BOM so Excel opens Cyrillic correctly.
    file.writeText("﻿" + Stats.csv(db.all(), Fmt.zone))
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/csv"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(send, "Экспорт операций"))
}
