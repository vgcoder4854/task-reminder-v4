import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import TasksPage from './pages/TasksPage';
import CalendarPage from './pages/CalendarPage';
import TrackerPage from './pages/TrackerPage';
import { getState, useStore } from './store';
import { setupNotifications, scheduleAll } from './notify';
import { startAlarm, stopAlarm } from './alarm';
import { AlarmSound } from './sounds';
import { today, getItemsForDate, wantsRemind, isDone, fromMin, effectiveSound } from './logic';

export default function App() {
  const [tab, setTab] = useState('tasks');
  const [ring, setRing] = useState(null);
  useStore();

  useEffect(() => {
    setupNotifications().then(() => scheduleAll(getState()));
    // Native: if a reminder fires while the app is open, also ring loudly in-app
    let sub;
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.addListener('localNotificationReceived', (n) => {
        setRing({ title: n.title?.replace('⏰ ', '') || 'Reminder', time: n.body || '' });
        startAlarm();
      }).then((h) => (sub = h));
    }
    // Native custom-sound alarms ring from a service; show the Stop screen while one is ringing
    let poll;
    if (AlarmSound) {
      poll = setInterval(async () => {
        try {
          const r = await AlarmSound.getRinging();
          setRing((cur) => (r.ringing ? (cur && cur.native ? cur : { title: r.title, time: r.body, native: true }) : cur && cur.native ? null : cur));
        } catch {}
      }, 1500);
    }
    // Web preview: check every 10s
    const iv = setInterval(() => {
      if (Capacitor.isNativePlatform()) return;
      const now = new Date();
      const min = now.getHours() * 60 + now.getMinutes();
      for (const it of getItemsForDate(getState(), today())) {
        if (!it.slot || it.slot.start !== min || !wantsRemind(it.task, it.entry) || isDone(it.task, it.entry)) continue;
        const key = `fired|${today()}|${it.task.id}|${min}`;
        if (sessionStorage.getItem(key)) continue;
        sessionStorage.setItem(key, '1');
        setRing({ title: it.task.title, time: `${fromMin(it.slot.start)}–${fromMin(it.slot.end)}` });
        const snd = effectiveSound(it.task, getState().settings);
        startAlarm(snd?.path);
      }
    }, 10000);
    return () => {
      clearInterval(iv);
      clearInterval(poll);
      sub && sub.remove();
    };
  }, []);

  const dismiss = () => {
    if (AlarmSound) AlarmSound.stopAlarm().catch(() => {});
    stopAlarm();
    setRing(null);
  };

  return (
    <div className="app">
      <main>
        {tab === 'tasks' && <TasksPage />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'tracker' && <TrackerPage />}
      </main>
      <nav>
        {[
          ['tasks', '📝', 'Tasks'],
          ['calendar', '📅', 'Calendar'],
          ['tracker', '📈', 'Tracker'],
        ].map(([k, i, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            <span>{i}</span>
            {l}
          </button>
        ))}
      </nav>
      {ring && (
        <div className="ring">
          <div className="ring-box">
            <div style={{ fontSize: 48 }}>⏰</div>
            <h2>{ring.title}</h2>
            <p>{ring.time}</p>
            <button className="btn" onClick={dismiss}>Stop alarm</button>
          </div>
        </div>
      )}
    </div>
  );
}
