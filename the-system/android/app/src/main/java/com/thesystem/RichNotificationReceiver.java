package com.thesystem;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.res.Resources;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Posts a Duolingo-style rich notification: large app icon + a BigPicture
 * banner (the player's chibi avatar) + action buttons. Invoked both directly
 * (present now) and by AlarmManager for scheduled reminders.
 */
public class RichNotificationReceiver extends BroadcastReceiver {

    public static final String CHANNEL_ID = "system-mandates";
    private static final int ACCENT = 0xFFD97757;

    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("id", 1);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String bigPic = intent.getStringExtra("bigPic");
        post(context, id, title, body, bigPic);
    }

    static void post(Context context, int id, String title, String body, String bigPicName) {
        ensureChannel(context);

        Resources res = context.getResources();
        String pkg = context.getPackageName();

        int smallIconId = res.getIdentifier("notification_icon", "drawable", pkg);
        if (smallIconId == 0) smallIconId = res.getIdentifier("ic_launcher", "mipmap", pkg);

        // Launch intent for taps + actions.
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(pkg);
        if (launch == null) launch = new Intent();
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent contentPi = PendingIntent.getActivity(context, id, launch, piFlags);

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(smallIconId)
                .setContentTitle(title != null ? title : "СИСТЕМА")
                .setContentText(body)
                .setColor(ACCENT)
                .setColorized(true)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(contentPi)
                .addAction(0, "Войти в Систему", contentPi)
                .addAction(0, "I'm on it", contentPi);

        // Large icon = the player's transparent avatar (system masks it into the
        // round large-icon slot). Falls back to the launcher icon.
        Bitmap largeIcon = null;
        if (bigPicName != null) {
            int picId = res.getIdentifier(bigPicName, "drawable", pkg);
            if (picId != 0) largeIcon = BitmapFactory.decodeResource(res, picId);
        }
        if (largeIcon == null) {
            int launcherId = res.getIdentifier("ic_launcher", "mipmap", pkg);
            if (launcherId != 0) largeIcon = BitmapFactory.decodeResource(res, launcherId);
        }
        if (largeIcon != null) b.setLargeIcon(largeIcon);

        // Expanded view: elegant full-text message (no dark picture box).
        if (body != null) b.setStyle(new NotificationCompat.BigTextStyle().bigText(body));

        try {
            NotificationManagerCompat.from(context).notify(id, b.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS not granted — silently skip.
        }
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Задания Системы", NotificationManager.IMPORTANCE_HIGH);
        ch.setLightColor(ACCENT);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 250, 120, 250});
        nm.createNotificationChannel(ch);
    }
}
