package com.taskplanner.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

import java.io.File;

/** Plays the (custom) alarm sound in a loop until the user stops it. */
public class AlarmService extends Service {
    static final String ACTION_STOP = "com.taskplanner.app.STOP_ALARM";
    private static final String CHANNEL = "tp_alarm_ring";
    private static final int NOTIF_ID = 4242;
    private static final long AUTO_STOP_MS = 2 * 60 * 1000;

    static volatile boolean ringing = false;
    static volatile String ringTitle = "";
    static volatile String ringBody = "";

    private MediaPlayer player;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoStop = new Runnable() {
        @Override
        public void run() {
            stopRinging();
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopRinging();
            return START_NOT_STICKY;
        }
        String title = intent != null ? intent.getStringExtra("title") : "";
        String body = intent != null ? intent.getStringExtra("body") : "";
        String path = intent != null ? intent.getStringExtra("path") : "";
        ringTitle = title == null ? "" : title;
        ringBody = body == null ? "" : body;
        ringing = true;
        Notification n = buildNotification(ringTitle, ringBody);
        try {
            startForegroundCompat(n);
        } catch (Exception e) {
            // could not become a foreground service: show the notification normally and keep playing
            try {
                ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(NOTIF_ID, n);
            } catch (Exception ignored) {
            }
        }
        startSound(path);
        startVibration();
        handler.removeCallbacks(autoStop);
        handler.postDelayed(autoStop, AUTO_STOP_MS);
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String title, String body) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Ringing alarms", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            ch.enableVibration(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openPi = open == null ? null
                : PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(this, AlarmService.class);
        stop.setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 2, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title.isEmpty() ? "Task reminder" : title)
                .setContentText(body)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .addAction(0, "Stop", stopPi);
        if (openPi != null) b.setContentIntent(openPi);
        return b.build();
    }

    private void startForegroundCompat(Notification n) {
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private void startSound(String path) {
        releasePlayer();
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
        boolean ok = false;
        if (path != null && !path.isEmpty() && new File(path).exists()) {
            ok = tryPlay(path, null, attrs);
        }
        if (!ok) {
            Uri def = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (def == null) def = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            tryPlay(null, def, attrs);
        }
    }

    private boolean tryPlay(String path, Uri uri, AudioAttributes attrs) {
        try {
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(attrs);
            if (path != null) mp.setDataSource(path);
            else mp.setDataSource(this, uri);
            mp.setLooping(true);
            mp.prepare();
            mp.start();
            player = mp;
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private void startVibration() {
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null) return;
            long[] pattern = {0, 600, 400};
            if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            else vibrator.vibrate(pattern, 0);
        } catch (Exception ignored) {
        }
    }

    private void releasePlayer() {
        if (player != null) {
            try {
                player.stop();
            } catch (Exception ignored) {
            }
            player.release();
            player = null;
        }
    }

    private void stopRinging() {
        handler.removeCallbacks(autoStop);
        releasePlayer();
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) {
        }
        ringing = false;
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(autoStop);
        releasePlayer();
        ringing = false;
        super.onDestroy();
    }
}
