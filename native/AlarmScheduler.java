package com.taskplanner.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/** Schedules alarm-clock alarms and remembers them so they survive a reboot. */
final class AlarmScheduler {
    private static final String PREFS = "tp_alarms";
    private static final String KEY = "list";

    private AlarmScheduler() {}

    static JSONArray load(Context c) {
        try {
            return new JSONArray(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static void save(Context c, JSONArray list) {
        SharedPreferences.Editor ed = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        ed.putString(KEY, list.toString());
        ed.apply();
    }

    private static PendingIntent operation(Context c, int id, String title, String body, String path) {
        Intent i = new Intent(c, AlarmReceiver.class);
        i.putExtra("id", id);
        i.putExtra("title", title);
        i.putExtra("body", body);
        i.putExtra("path", path);
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void setOne(Context c, JSONObject o) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            int id = o.getInt("id");
            long at = o.getLong("at");
            PendingIntent op = operation(c, id, o.optString("title"), o.optString("body"), o.optString("path"));
            Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            PendingIntent show = null;
            if (launch != null) {
                show = PendingIntent.getActivity(c, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            }
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), op);
        } catch (Exception ignored) {
        }
    }

    static void cancelAll(Context c) {
        JSONArray old = load(c);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        for (int k = 0; k < old.length(); k++) {
            try {
                JSONObject o = old.getJSONObject(k);
                am.cancel(operation(c, o.getInt("id"), "", "", ""));
            } catch (Exception ignored) {
            }
        }
        save(c, new JSONArray());
    }

    static void replaceAll(Context c, JSONArray list) {
        cancelAll(c);
        JSONArray kept = new JSONArray();
        long now = System.currentTimeMillis();
        for (int k = 0; k < list.length(); k++) {
            try {
                JSONObject o = list.getJSONObject(k);
                if (o.getLong("at") <= now) continue;
                setOne(c, o);
                kept.put(o);
            } catch (Exception ignored) {
            }
        }
        save(c, kept);
    }

    /** Adds one alarm without touching the others. */
    static void addOne(Context c, JSONObject o) {
        setOne(c, o);
        JSONArray list = load(c);
        list.put(o);
        save(c, list);
    }

    static void forget(Context c, int id) {
        JSONArray old = load(c);
        JSONArray kept = new JSONArray();
        for (int k = 0; k < old.length(); k++) {
            try {
                JSONObject o = old.getJSONObject(k);
                if (o.getInt("id") != id) kept.put(o);
            } catch (Exception ignored) {
            }
        }
        save(c, kept);
    }

    static void restoreAfterBoot(Context c) {
        replaceAll(c, load(c));
    }
}
