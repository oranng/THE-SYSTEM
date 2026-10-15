package com.oranng.kazna.ui

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.oranng.kazna.R
import com.oranng.kazna.core.Kind
import com.oranng.kazna.core.Widget
import com.oranng.kazna.core.WidgetConfig
import com.oranng.kazna.data.Db

/** Per-widget settings, kept in SharedPreferences under the widget id. */
object WidgetPrefs {
    private fun prefs(context: Context) = context.getSharedPreferences("widgets", Context.MODE_PRIVATE)

    fun load(context: Context, id: Int): WidgetConfig {
        val p = prefs(context)
        val d = defaults(context)
        return WidgetConfig(
            showIncome = p.getBoolean("$id.income", d.showIncome),
            showSpend = p.getBoolean("$id.spend", d.showSpend),
            showHistory = p.getBoolean("$id.history", d.showHistory),
            week = p.getBoolean("$id.week", d.week),
        )
    }

    fun save(context: Context, id: Int, c: WidgetConfig) {
        prefs(context).edit()
            .putBoolean("$id.income", c.showIncome).putBoolean("$id.spend", c.showSpend)
            .putBoolean("$id.history", c.showHistory).putBoolean("$id.week", c.week)
            .apply()
    }

    /** Settings used by widgets that were never configured (and by new ones as a start). */
    fun defaults(context: Context): WidgetConfig {
        val p = prefs(context)
        return WidgetConfig(
            showIncome = p.getBoolean("default.income", true),
            showSpend = p.getBoolean("default.spend", true),
            showHistory = p.getBoolean("default.history", true),
            week = p.getBoolean("default.week", false),
        )
    }

    /** Apply one setup to every placed widget and make it the default. */
    fun saveAll(context: Context, c: WidgetConfig) {
        prefs(context).edit()
            .putBoolean("default.income", c.showIncome).putBoolean("default.spend", c.showSpend)
            .putBoolean("default.history", c.showHistory).putBoolean("default.week", c.week)
            .apply()
        KaznaWidget.ids(context).forEach { save(context, it, c) }
    }

    fun forget(context: Context, ids: IntArray) {
        val e = prefs(context).edit()
        ids.forEach { id -> listOf("income", "spend", "history", "week").forEach { e.remove("$id.$it") } }
        e.apply()
    }
}

/**
 * Home-screen widget: income in green and spending in red for the month or the last
 * 7 days, today's operations and a "+" for cash. Each widget has its own settings.
 * Plain RemoteViews, no background work: redrawn on every database write and once
 * just after midnight.
 */
class KaznaWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { render(context, manager, it) }
        scheduleMidnight(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_MIDNIGHT) refresh(context)
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        WidgetPrefs.forget(context, ids)
    }

    override fun onDisabled(context: Context) {
        alarms(context).cancel(midnightIntent(context))
    }

    companion object {
        private const val ACTION_MIDNIGHT = "com.oranng.kazna.WIDGET_MIDNIGHT"
        const val ACTION_ADD = "com.oranng.kazna.ADD"

        fun ids(context: Context): IntArray =
            AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, KaznaWidget::class.java))

        /** Redraw every placed widget. Cheap; safe to call after each write. */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = ids(context)
            if (ids.isEmpty()) return
            ids.forEach { render(context, manager, it) }
            scheduleMidnight(context)
        }

        fun render(context: Context, manager: AppWidgetManager, id: Int) {
            val cfg = WidgetPrefs.load(context, id)
            val s = Widget.summary(Db.get(context).all(), cfg, Fmt.zone)
            val v = RemoteViews(context.packageName, R.layout.widget_kazna)

            v.setTextViewText(R.id.widget_title, if (cfg.week) "Казна · 7 дней" else "Казна · ${Fmt.monthTitle(java.time.YearMonth.now()).substringBefore(' ').lowercase()}")
            v.setViewVisibility(R.id.widget_income_box, if (cfg.showIncome) View.VISIBLE else View.GONE)
            v.setViewVisibility(R.id.widget_spend_box, if (cfg.showSpend) View.VISIBLE else View.GONE)
            v.setTextViewText(R.id.widget_income, "+" + Fmt.money(s.income))
            v.setTextViewText(R.id.widget_spend, "−" + Fmt.money(s.spent))

            if (cfg.showHistory) {
                v.setViewVisibility(R.id.widget_history, View.VISIBLE)
                v.setTextViewText(
                    R.id.widget_history,
                    if (s.history.isEmpty()) "Сегодня операций нет" else s.history.joinToString("\n") { t ->
                        val sign = if (t.kind == Kind.INCOME) "+" else "−"
                        "${Fmt.time(t.time)}  ${t.merchant.take(22)}  $sign${Fmt.money(t.amount, t.currency)}"
                    },
                )
            } else {
                v.setViewVisibility(R.id.widget_history, View.GONE)
            }

            if (s.review > 0) {
                v.setViewVisibility(R.id.widget_review, View.VISIBLE)
                v.setTextViewText(R.id.widget_review, "! ${s.review}")
            } else {
                v.setViewVisibility(R.id.widget_review, View.GONE)
            }

            val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            v.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
            )
            val add = Intent(context, MainActivity::class.java).setAction(ACTION_ADD)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            v.setOnClickPendingIntent(
                R.id.widget_add,
                PendingIntent.getActivity(context, 1, add, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
            )
            manager.updateAppWidget(id, v)
        }

        /** Inexact alarm (no exact-alarm permission needed); a few minutes late is fine. */
        private fun scheduleMidnight(context: Context) {
            val at = Widget.nextMidnight(System.currentTimeMillis(), Fmt.zone) + 60_000
            alarms(context).set(AlarmManager.RTC, at, midnightIntent(context))
        }

        private fun midnightIntent(context: Context): PendingIntent =
            PendingIntent.getBroadcast(
                context, 2,
                Intent(context, KaznaWidget::class.java).setAction(ACTION_MIDNIGHT),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

        private fun alarms(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    }
}
