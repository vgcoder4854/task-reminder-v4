import { useState } from 'react';
import DayPage from './DayPage';
import { useStore } from '../store';
import { fmt, today, getItemsForDate, hasConflict, isDone } from '../logic';

export default function CalendarPage() {
  const state = useStore();
  const [cur, setCur] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [day, setDay] = useState(null);
  const y = cur.getFullYear();
  const m = cur.getMonth();
  const first = new Date(y, m, 1).getDay();
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(fmt(new Date(y, m, d)));

  return (
    <div className="page">
      <div className="cal-h">
        <button className="ghost" onClick={() => setCur(new Date(y, m - 1, 1))}>‹</button>
        <h2 style={{ margin: 0 }}>{cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button className="ghost" onClick={() => setCur(new Date(y, m + 1, 1))}>›</button>
      </div>
      <div className="cal-g big">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
          <div key={w} className="cal-w">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const items = getItemsForDate(state, d);
          const bad = hasConflict(items);
          const all = items.length && items.every((it) => isDone(it.task, it.entry));
          return (
            <button key={i} className={'cal-d big' + (d === today() ? ' today' : '')} onClick={() => setDay(d)}>
              {+d.slice(8)}
              {items.length > 0 && (
                <span className={'dot' + (bad ? ' bad' : all ? ' ok' : '')}>{items.length}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="muted sm">🔴 time clash · 🟢 all done · 🔵 planned. Tap a date to open it.</p>
      <button className="btn ghost-b" onClick={() => { setCur(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setDay(today()); }}>
        Today
      </button>
      {day && <DayPage date={day} onClose={() => setDay(null)} />}
    </div>
  );
}
