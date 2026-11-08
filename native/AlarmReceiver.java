package com.taskplanner.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String FALLBACK_CHANNEL = "tp_alarm_fallback";

    @Override
    public void onReceive(Context context, Intent intent) {
        AlarmScheduler.forget(context, intent.getIntExtra("id", 0));
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        Intent svc = new Intent(context, AlarmService.class);
        svc.putExtra("title", title);
        svc.putExtra("body", body);
        svc.putExtra("path", intent.getStringExtra("path"));
        try {
            ContextCompat.startForegroundService(context, svc);
        } catch (Exception e) {
            // The system refused to start the ringing service: still make noise with a normal alarm notification
            postFallback(context, title, body);
        }
    }

    private void postFallback(Context c, String title, String body) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(FALLBACK_CHANNEL, "Alarm (backup)", NotificationManager.IMPORTANCE_HIGH);
                Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                ch.setSound(u, new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                ch.enableVibration(true);
                nm.createNotificationChannel(ch);
            }
            Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            PendingIntent pi = open == null ? null
                    : PendingIntent.getActivity(c, 3, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, FALLBACK_CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle(title == null || title.isEmpty() ? "Task reminder" : title)
                    .setContentText(body)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(Notification.DEFAULT_VIBRATE)
                    .setAutoCancel(true);
            if (pi != null) b.setContentIntent(pi);
            nm.notify((int) (System.currentTimeMillis() % 100000) + 10, b.build());
        } catch (Exception ignored) {
        }
    }
}
