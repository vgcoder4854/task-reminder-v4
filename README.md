# Task Planner (Android app)

React + Capacitor. Tasks → Calendar/Day planning → Tracker dashboard, with real alarm notifications (sound + vibration).

## Get the APK (easiest, works from your phone)
1. Create a GitHub repo, upload/commit this whole folder (keep the `.github` folder).
2. Open the repo → **Actions** → **Build APK** → **Run workflow** (also runs on every push to main).
3. When it finishes (~5 min), open the run → **Artifacts** → download `task-planner-apk` → unzip → install `app-debug.apk`.
4. On first launch allow **Notifications** and **Alarms & reminders** (exact alarms). Use **🔔 Test alarm** on the Tasks tab.

## Try it in the browser (Codespace)
```
npm install
npm run dev
```
The web preview rings an in-page beep alarm while the tab is open (native notifications only work in the APK).

## Tracker, analysis, notes and links
- **Tracker tab:** overall score card + a compact list of tasks with “Track streaks & stats” on. Tap a task for its full analysis page, or the top card for the overall page.
- **Notes** toggle (task form): a note box per day on the task's day page. **Links** toggle: buttons that open the link in your phone's browser.

## Custom alarm sounds
- Per task: edit a task → **Alarm sound** → switch on **Custom alarm sound** → choose a file.
- For all tasks: Tasks tab → **⚙ Settings** → **Default alarm sound**.
- Supported: MP3, WAV, OGG, M4A, AAC, FLAC (max 5 MB). Order of choice: task sound → default sound → phone's notification sound.
- Custom-sound alarms are scheduled by a small native plugin (`native/*.java`, copied into the Android project by the workflow). They loop until you press Stop.

## If alarms do not ring after closing the app
Open **Tasks → ⚙ Settings → Alarm health check**. It shows how many alarms are scheduled, the next one, and whether notifications / battery restrictions / auto-start are blocking them, with buttons to fix each. All alarms use Android's alarm-clock mechanism and survive closing the app and rebooting; only **Force stop** (or a phone maker's aggressive battery cleaner) can delete them.

## Notes
- Data is stored on the phone (localStorage). Uninstalling the app erases it.
- Reminders are re-scheduled for the next 60 days whenever you change anything.
- Some phones (Xiaomi, Oppo, Vivo, Samsung) kill background apps: set Task Planner to "No restrictions" in battery settings so alarms are reliable.
