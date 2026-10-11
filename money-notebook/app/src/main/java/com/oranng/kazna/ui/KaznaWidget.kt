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
import com.oranng.kazna.core.Widget
import com.oranng.kazna.data.Db

/**
 * Home-screen widget: today's spend, the month, the last purchase and a "+" for cash.
 * Plain RemoteViews, no background work: it is redrawn whenever a transaction is
 * written (Db.changed) and once at midnight so "today" resets.
 */
class KaznaWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        render(context, manager, ids)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_MIDNIGHT) refresh(context)
    }

    override fun onDisabled(context: Context) {
        alarms(context).cancel(midnightIntent(context))
    }

    companion object {
        private const val ACTION_MIDNIGHT = "com.oranng.kazna.WIDGET_MIDNIGHT"
        const val ACTION_ADD = "com.oranng.kazna.ADD"

        /** Redraw every placed widget. Cheap; safe to call after each write. */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, KaznaWidget::class.java))
            if (ids.isNotEmpty()) render(context, manager, ids)
        }

        private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val s = Widget.summary(Db.get(context).all(), Fmt.zone)
            val views = RemoteViews(context.packageName, R.layout.widget_kazna)

            views.setTextViewText(R.id.widget_today, Fmt.money(s.today))
            views.setTextViewText(
                R.id.widget_month,
                "Месяц: ${Fmt.money(s.month)}" + if (s.perDay > 0) " · в день ${Fmt.money(s.perDay)}" else "",
            )
            views.setTextViewText(
                R.id.widget_last,
                s.last?.let { "${it.merchant}  −${Fmt.money(it.amount, it.currency)} · ${Fmt.time(it.time)}" }
                    ?: "Трат пока нет — они появятся сами",
            )
            if (s.review > 0) {
                views.setViewVisibility(R.id.widget_review, View.VISIBLE)
                views.setTextViewText(R.id.widget_review, "! ${s.review} проверить")
            } else {
                views.setViewVisibility(R.id.widget_review, View.GONE)
            }

            val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
            )
            val add = Intent(context, MainActivity::class.java).setAction(ACTION_ADD)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            views.setOnClickPendingIntent(
                R.id.widget_add,
                PendingIntent.getActivity(context, 1, add, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
            )

            manager.updateAppWidget(ids, views)
            scheduleMidnight(context)
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
