import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { addDays, today, parse, fromMin, getItemsForDate, wantsRemind, isDone, effectiveSound } from './logic';
import { AlarmSound } from './sounds';

export const isNative = Capacitor.isNativePlatform();
const CHANNEL = 'alarm';

function hid(s) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 2147483000) + 1;
}

export async function setupNotifications() {
  if (!isNative) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL,
      name: 'Task alarms',
      description: 'Reminders for your scheduled tasks',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
    });
    await LocalNotifications.requestPermissions();
    if (!localStorage.getItem('exactAsked')) {
      localStorage.setItem('exactAsked', '1');
      const x = await LocalNotifications.checkExactNotificationSetting();
      if (x.exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting();
    }
  } catch (e) {
    console.warn('notification setup', e);
  }
}

// Re-schedule every upcoming reminder (next 60 days).
// On the phone every alarm goes through the native alarm-clock plugin: it is the most reliable
// kind of Android alarm, survives closing the app and rebooting, and loops until you press Stop.
// Without the plugin (should not happen in the APK) we fall back to plain notifications.
export async function scheduleAll(state) {
  if (!isNative) return;
  const list = [];
  const now = Date.now();
  const t0 = today();
  for (let i = 0; i < 60; i++) {
    const d = addDays(t0, i);
    for (const it of getItemsForDate(state, d)) {
      if (!it.slot || !wantsRemind(it.task, it.entry) || isDone(it.task, it.entry)) continue;
      const at = parse(d);
      at.setMinutes(it.slot.start);
      if (at.getTime() <= now) continue;
      const snd = effectiveSound(it.task, state.settings);
      list.push({
        id: hid(d + it.task.id),
        at: at.getTime(),
        title: it.task.title,
        body: `${fromMin(it.slot.start)}–${fromMin(it.slot.end)}${it.task.goal ? ' · ' + it.task.goal : ''}`,
        path: snd ? snd.path : '',
      });
    }
  }
  list.sort((a, b) => a.at - b.at);
  // clear anything scheduled by older versions of the app (plain notifications)
  try {
    const pend = await LocalNotifications.getPending();
    if (pend.notifications.length) await LocalNotifications.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
  } catch {}
  try {
    if (AlarmSound) {
      await AlarmSound.schedule({ alarms: list.slice(0, 400) });
    } else if (list.length) {
      await LocalNotifications.schedule({
        notifications: list.slice(0, 250).map((a) => ({
          id: a.id, title: '⏰ ' + a.title, body: a.body, schedule: { at: new Date(a.at), allowWhileIdle: true }, channelId: CHANNEL,
        })),
      });
    }
  } catch (e) {
    console.warn('schedule', e);
  }
}

// Test alarm: rings 10 seconds from now through the same path as real alarms
export async function scheduleTest(state) {
  const snd = state.settings?.universal?.path ? state.settings.universal : null;
  const at = Date.now() + 10000;
  if (AlarmSound) {
    // keeps the real alarms too: re-add them after the test
    await AlarmSound.addOne({ id: 999999, at, title: 'Test alarm', body: 'Tap Stop to silence', path: snd ? snd.path : '' });
    return;
  }
  await LocalNotifications.schedule({
    notifications: [{ id: 999999, title: '⏰ Test alarm', body: 'Your reminders will sound like this', schedule: { at: new Date(at), allowWhileIdle: true }, channelId: CHANNEL }],
  });
}
