"""Adds permissions, receivers and the alarm service to the generated AndroidManifest.xml."""
import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()

perms = [
    "POST_NOTIFICATIONS", "SCHEDULE_EXACT_ALARM", "USE_EXACT_ALARM", "VIBRATE",
    "RECEIVE_BOOT_COMPLETED", "WAKE_LOCK", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_MEDIA_PLAYBACK", "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
]
add = ""
for p in perms:
    line = f'<uses-permission android:name="android.permission.{p}" />'
    if f"android.permission.{p}\"" not in s:
        add += "    " + line + "\n"
s = s.replace("</manifest>", add + "</manifest>")

comps = """
        <receiver android:name="com.taskplanner.app.AlarmReceiver" android:exported="false" />
        <receiver android:name="com.taskplanner.app.BootReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
        <service android:name="com.taskplanner.app.AlarmService" android:exported="false" android:foregroundServiceType="mediaPlayback" />
    </application>"""
if "AlarmService" not in s:
    s = s.replace("</application>", comps, 1)
open(path, "w", encoding="utf-8").write(s)
print("manifest patched")
