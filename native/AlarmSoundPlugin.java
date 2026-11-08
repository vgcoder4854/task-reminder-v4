package com.taskplanner.app;

import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "AlarmSound")
public class AlarmSoundPlugin extends Plugin {
    private MediaPlayer preview;

    /** Saves a picked audio file into the app's private storage. */
    @PluginMethod
    public void saveSound(PluginCall call) {
        String id = call.getString("id");
        String ext = call.getString("ext", "mp3");
        String data = call.getString("data");
        if (id == null || data == null) {
            call.reject("Missing data");
            return;
        }
        try {
            File dir = new File(getContext().getFilesDir(), "sounds");
            dir.mkdirs();
            File f = new File(dir, id.replaceAll("[^A-Za-z0-9]", "") + "." + ext.replaceAll("[^A-Za-z0-9]", ""));
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            FileOutputStream out = new FileOutputStream(f);
            try {
                out.write(bytes);
            } finally {
                out.close();
            }
            JSObject r = new JSObject();
            r.put("path", f.getAbsolutePath());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not save the sound: " + e.getMessage());
        }
    }

    /** Replaces every scheduled custom-sound alarm. alarms: [{id, at, title, body, path}] */
    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray arr = call.getArray("alarms");
        JSONArray list = arr == null ? new JSONArray() : arr;
        AlarmScheduler.replaceAll(getContext(), list);
        call.resolve();
    }


    /** What is blocking alarms on this phone, plus how many alarms are scheduled. */
    @PluginMethod
    public void getStatus(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("notifications", NotificationManagerCompat.from(c).areNotificationsEnabled());
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        r.put("battery", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        r.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        r.put("sdk", Build.VERSION.SDK_INT);
        JSONArray list = AlarmScheduler.load(c);
        long nextAt = 0;
        String nextTitle = "";
        for (int i = 0; i < list.length(); i++) {
            try {
                JSONObject o = list.getJSONObject(i);
                long at = o.getLong("at");
                if (nextAt == 0 || at < nextAt) {
                    nextAt = at;
                    nextTitle = o.optString("title");
                }
            } catch (Exception ignored) {
            }
        }
        r.put("count", list.length());
        r.put("nextAt", nextAt);
        r.put("nextTitle", nextTitle);
        call.resolve(r);
    }

    private void openAppDetails() {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        openAppDetails();
        call.resolve();
    }

    /** Asks Android to stop restricting this app's battery use. */
    @PluginMethod
    public void requestBattery(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            openAppDetails();
        }
        call.resolve();
    }

    /** Tries to open the maker-specific "auto-start" screen; falls back to the app's settings page. */
    @PluginMethod
    public void openAutostart(PluginCall call) {
        String[][] known = {
                {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
        };
        boolean opened = false;
        PackageManager pm = getContext().getPackageManager();
        for (String[] k : known) {
            try {
                Intent i = new Intent();
                i.setComponent(new ComponentName(k[0], k[1]));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (pm.resolveActivity(i, 0) != null) {
                    getContext().startActivity(i);
                    opened = true;
                    break;
                }
            } catch (Exception ignored) {
            }
        }
        if (!opened) openAppDetails();
        JSObject r = new JSObject();
        r.put("opened", opened);
        call.resolve(r);
    }

    /** Schedules a single extra alarm (used by the test button). alarm fields at top level of the call. */
    @PluginMethod
    public void addOne(PluginCall call) {
        try {
            JSONObject o = new JSONObject();
            o.put("id", call.getInt("id", 999999));
            o.put("at", call.getLong("at", System.currentTimeMillis() + 10000));
            o.put("title", call.getString("title", "Test alarm"));
            o.put("body", call.getString("body", ""));
            o.put("path", call.getString("path", ""));
            AlarmScheduler.addOne(getContext(), o);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void getRinging(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ringing", AlarmService.ringing);
        r.put("title", AlarmService.ringTitle);
        r.put("body", AlarmService.ringBody);
        call.resolve(r);
    }

    @PluginMethod
    public void stopAlarm(PluginCall call) {
        Context c = getContext();
        if (AlarmService.ringing) {
            Intent i = new Intent(c, AlarmService.class);
            i.setAction(AlarmService.ACTION_STOP);
            c.startService(i);
        }
        call.resolve();
    }

    /** Rings immediately, as a real alarm would (used by "Test alarm"). */
    @PluginMethod
    public void ringNow(PluginCall call) {
        Context c = getContext();
        Intent i = new Intent(c, AlarmService.class);
        i.putExtra("title", call.getString("title", "Test alarm"));
        i.putExtra("body", call.getString("body", ""));
        i.putExtra("path", call.getString("path", ""));
        androidx.core.content.ContextCompat.startForegroundService(c, i);
        call.resolve();
    }

    @PluginMethod
    public void playPreview(PluginCall call) {
        stopPreviewInternal();
        String path = call.getString("path", "");
        try {
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            if (path.isEmpty() || !new File(path).exists()) {
                mp.setDataSource(getContext(), android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM));
            } else {
                mp.setDataSource(path);
            }
            mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer m) {
                    stopPreviewInternal();
                }
            });
            mp.prepare();
            mp.start();
            preview = mp;
            call.resolve();
        } catch (Exception e) {
            call.reject("Cannot play this file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopPreview(PluginCall call) {
        stopPreviewInternal();
        call.resolve();
    }

    private void stopPreviewInternal() {
        if (preview != null) {
            try {
                preview.stop();
            } catch (Exception ignored) {
            }
            preview.release();
            preview = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopPreviewInternal();
    }
}
