package com.oranng.kazna.service

import android.app.Notification
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.oranng.kazna.core.Banks
import com.oranng.kazna.core.IngestResult
import com.oranng.kazna.core.Ledger
import com.oranng.kazna.core.RawNotification
import com.oranng.kazna.data.Db

/**
 * The system binds this service and calls it only when a notification is posted:
 * no polling and no wake-ups of its own, so it costs almost no battery. When the
 * binding is (re)established — after boot, an update or the system killing the app —
 * it rescans the notifications still in the shade, and it does the same on every
 * unlock, so anything that arrived while it was not listening is still counted.
 */
class SpendListener : NotificationListenerService() {

    private var unlockReceiver: BroadcastReceiver? = null

    override fun onListenerConnected() {
        super.onListenerConnected()
        unlockReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) = rescan()
        }.also { registerReceiverCompat(it, IntentFilter(Intent.ACTION_USER_PRESENT)) }
        rescan()
    }

    override fun onListenerDisconnected() {
        unlockReceiver?.let { runCatching { unregisterReceiver(it) } }
        unlockReceiver = null
        // Ask the system to bind us again as soon as it can.
        requestRebind(ComponentName(this, SpendListener::class.java))
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        handle(this, sbn)
    }

    private fun rescan() {
        val active = runCatching { activeNotifications }.getOrNull() ?: return
        active.sortedBy { it.postTime }.forEach { handle(this, it) }
    }

    private fun registerReceiverCompat(receiver: BroadcastReceiver, filter: IntentFilter) {
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(receiver, filter)
        }
    }

    companion object {
        private val lock = Any()

        fun isEnabled(context: Context): Boolean {
            val flat = android.provider.Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
            val me = ComponentName(context, SpendListener::class.java)
            return flat.split(':').any { ComponentName.unflattenFromString(it) == me }
        }

        fun handle(context: Context, sbn: StatusBarNotification) {
            if (sbn.packageName == context.packageName) return
            val n = sbn.notification ?: return
            if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
            val label = appLabel(context, sbn.packageName)
            val db = Db.get(context)
            synchronized(lock) {
                val watched = db.seeApp(sbn.packageName, label, Banks.watchedByDefault(sbn.packageName, label), sbn.postTime)
                if (!watched) return
                val raw = toRaw(sbn, label)
                if (raw.title.isBlank() && raw.text.isBlank() && raw.bigText.isBlank()) return
                val result = Ledger(db).ingest(raw)
                if (result != IngestResult.DUPLICATE) {
                    val body = listOf(raw.text, raw.bigText.takeIf { it != raw.text } ?: "", raw.lines.joinToString("\n"))
                        .filter { it.isNotBlank() }.joinToString("\n")
                    db.log(sbn.postTime, sbn.packageName, label, raw.title, body, resultName(result))
                }
            }
        }

        private fun resultName(r: IngestResult) = when (r) {
            IngestResult.ADDED -> "добавлено"
            IngestResult.MERGED -> "объединено"
            IngestResult.DUPLICATE -> "повтор"
            IngestResult.IGNORED -> "не распознано"
        }

        private fun toRaw(sbn: StatusBarNotification, label: String): RawNotification {
            val e = sbn.notification.extras
            fun cs(key: String) = e?.getCharSequence(key)?.toString().orEmpty()
            val lines = e?.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.map { it.toString() }.orEmpty()
            val title = cs(Notification.EXTRA_TITLE).ifBlank { cs(Notification.EXTRA_TITLE_BIG) }
            return RawNotification(
                packageName = sbn.packageName,
                appLabel = label,
                title = title,
                text = cs(Notification.EXTRA_TEXT),
                bigText = cs(Notification.EXTRA_BIG_TEXT),
                lines = lines,
                postTime = sbn.postTime,
            )
        }

        private fun appLabel(context: Context, pkg: String): String = try {
            val pm = context.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            pkg
        }
    }
}

/** After a reboot or an app update, ask the system to bind the listener right away. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (SpendListener.isEnabled(context)) {
            NotificationListenerService.requestRebind(ComponentName(context, SpendListener::class.java))
        }
    }
}
