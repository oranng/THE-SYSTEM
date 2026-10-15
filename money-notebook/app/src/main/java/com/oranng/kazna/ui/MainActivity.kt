package com.oranng.kazna.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import com.oranng.kazna.data.Db
import com.oranng.kazna.service.RateJob
import java.time.YearMonth

class MainActivity : ComponentActivity() {
    /** Bumped each time the widget's "+" is pressed; the UI opens the add dialog. */
    private val addRequests = mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) handle(intent)
        setContent {
            MaterialTheme(colorScheme = Palette.scheme) { App(addRequests.intValue) }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    override fun onResume() {
        super.onResume()
        KaznaWidget.refresh(this)
        if (Db.get(this).pendingRate().isNotEmpty()) RateJob.schedule(this)
    }

    private fun handle(intent: Intent?) {
        if (intent?.action == KaznaWidget.ACTION_ADD) addRequests.intValue++
    }
}

/** What the operations list is filtered by when opened from the overview. */
data class OpsFilter(val category: String? = null, val reviewOnly: Boolean = false)

@Composable
fun App(addRequests: Int = 0) {
    val context = LocalContext.current
    val db = remember { Db.get(context) }
    val version by Db.version.collectAsState()

    // Re-check permissions every time the app comes back from system settings.
    var resumes by remember { mutableIntStateOf(0) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val obs = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_RESUME) resumes++ }
        owner.lifecycle.addObserver(obs)
        onDispose { owner.lifecycle.removeObserver(obs) }
    }

    var tab by rememberSaveable { mutableIntStateOf(0) }
    var month by remember { mutableStateOf(YearMonth.now()) }
    var filter by remember { mutableStateOf(OpsFilter()) }

    val txs = remember(version) { db.all() }

    // One-shot: the widget's "+" opens the add dialog once, not on every tab switch.
    var pendingAdd by remember { mutableStateOf(false) }
    LaunchedEffect(addRequests) {
        if (addRequests > 0) { filter = OpsFilter(); tab = 1; pendingAdd = true }
    }

    Scaffold(
        containerColor = Palette.bg,
        bottomBar = {
            NavigationBar(containerColor = Palette.surface) {
                listOf("◔" to "Обзор", "≡" to "Операции", "▥" to "Статистика", "⚙" to "Настройки").forEachIndexed { i, (icon, label) ->
                    NavigationBarItem(
                        selected = tab == i,
                        onClick = { if (i == 1 && tab != 1) filter = OpsFilter(); tab = i },
                        icon = { Text(icon, fontSize = 20.sp) },
                        label = { Text(label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Palette.gold, selectedTextColor = Palette.gold,
                            indicatorColor = Palette.surface2, unselectedIconColor = Palette.dim, unselectedTextColor = Palette.dim,
                        ),
                    )
                }
            }
        },
    ) { pad ->
        Box(Modifier.fillMaxSize().padding(pad)) {
            when (tab) {
                0 -> OverviewScreen(
                    txs = txs, month = month, onMonth = { month = it }, resumes = resumes,
                    onOpenOps = { f -> filter = f; tab = 1 },
                    onOpenSettings = { tab = 3 },
                )
                1 -> OperationsScreen(txs = txs, month = month, onMonth = { month = it }, filter = filter, onFilter = { filter = it }, openAdd = pendingAdd, onAddOpened = { pendingAdd = false })
                2 -> StatsScreen(txs = txs)
                else -> SettingsScreen(resumes = resumes, version = version)
            }
        }
    }
}
