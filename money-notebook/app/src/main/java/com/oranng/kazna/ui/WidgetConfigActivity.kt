package com.oranng.kazna.ui

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.oranng.kazna.core.WidgetConfig

/** Opens when a Казна widget is placed, and from "Настроить" on a long press (Android 12+). */
class WidgetConfigActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val id = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        // Backing out without saving must not leave an empty widget behind.
        setResult(RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id))
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }

        val initial = WidgetPrefs.load(this, id)
        setContent {
            MaterialTheme(colorScheme = Palette.scheme) {
                var cfg by remember { mutableStateOf(initial) }
                Column(
                    Modifier.fillMaxSize().background(Palette.bg).safeDrawingPadding().padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text("Виджет Казны", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Palette.gold)
                    WidgetSettingsForm(cfg) { cfg = it }
                    Button(
                        onClick = {
                            WidgetPrefs.save(this@WidgetConfigActivity, id, cfg)
                            KaznaWidget.render(this@WidgetConfigActivity, AppWidgetManager.getInstance(this@WidgetConfigActivity), id)
                            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id))
                            finish()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Palette.gold),
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Готово", color = Palette.bg) }
                }
            }
        }
    }
}

/** The widget options; shared by the widget setup screen and the app's settings. */
@Composable
fun WidgetSettingsForm(cfg: WidgetConfig, onChange: (WidgetConfig) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Период", color = Palette.dim, fontSize = 12.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(false to "Месяц", true to "7 дней").forEach { (week, label) ->
                FilterChip(
                    selected = cfg.week == week, onClick = { onChange(cfg.copy(week = week)) }, label = { Text(label) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Palette.surface2, selectedLabelColor = Palette.gold),
                )
            }
        }
        ToggleRow("Доход (зелёным)", cfg.showIncome) { onChange(cfg.copy(showIncome = it)) }
        ToggleRow("Расход (красным)", cfg.showSpend) { onChange(cfg.copy(showSpend = it)) }
        ToggleRow("Операции за сегодня", cfg.showHistory) { onChange(cfg.copy(showHistory = it)) }
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Palette.text, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange, colors = SwitchDefaults.colors(checkedTrackColor = Palette.gold))
    }
}
