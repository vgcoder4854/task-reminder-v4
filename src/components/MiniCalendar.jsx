import { useState } from 'react';
import { fmt, parse, today, addDays } from '../logic';

// mode 'range': from/to (a single tap = one day, a second tap = the last day)
// mode 'multi': dates[]
export default function MiniCalendar({ mode, from, to, dates = [], onChange, showChips = true }) {
  const [cur, setCur] = useState(() => {
    const ref = mode === 'multi' ? dates[0] : from;
    const d = ref ? parse(ref) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // after the first tap we wait for the end of the range
  const [waitEnd, setWaitEnd] = useState(false);
  const y = cur.getFullYear();
  const m = cur.getMonth();
  const first = new Date(y, m, 1).getDay();
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(fmt(new Date(y, m, d)));

  function pick(d) {
    if (mode === 'multi') {
      onChange({ dates: dates.includes(d) ? dates.filter((x) => x !== d) : [...dates, d].sort() });
    } else if (!waitEnd) {
      onChange({ from: d, to: d, noEnd: false });
      setWaitEnd(true);
    } else {
      const a = from || d;
      onChange({ from: d < a ? d : a, to: d < a ? a : d, noEnd: false });
      setWaitEnd(false);
    }
  }

  function chip(days) {
    const t = today();
    onChange({ from: t, to: addDays(t, days - 1), noEnd: false });
    setWaitEnd(false);
    setCur(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  }
  function thisMonth() {
    const n = new Date();
    onChange({ from: fmt(new Date(n.getFullYear(), n.getMonth(), 1)), to: fmt(new Date(n.getFullYear(), n.getMonth() + 1, 0)), noEnd: false });
    setWaitEnd(false);
    setCur(new Date(n.getFullYear(), n.getMonth(), 1));
  }

  const cls = (d) => {
    let c = 'cal-d';
    if (d === today()) c += ' today';
    if (mode === 'multi') {
      if (dates.includes(d)) c += ' sel';
    } else if (from) {
      const end = to || from;
      if (d === from || d === end) c += ' sel';
      else if (d > from && (!to || d < to)) c += to ? ' inr' : ' inr faint';
      if (from !== end && d === from) c += ' rs';
      if (from !== end && d === end) c += ' re';
    }
    return c;
  };

  let hint;
  if (mode === 'multi') hint = dates.length ? `${dates.length} date${dates.length > 1 ? 's' : ''} selected — tap a date again to remove it` : 'Tap every date you want';
  else if (waitEnd) hint = 'Now tap the last day — or tap the same day again for just one day';
  else if (from) hint = from === (to || from) ? `One day: ${from}. Tap a day to pick a new range` : `${from} → ${to}. Tap a day to pick a new range`;
  else hint = 'Tap the first day';

  return (
    <div className="mini">
      {mode === 'range' && showChips && (
        <div className="chips">
          <button className="chip" onClick={() => chip(1)}>Today</button>
          <button className="chip" onClick={() => chip(7)}>Next 7 days</button>
          <button className="chip" onClick={() => chip(30)}>Next 30 days</button>
          <button className="chip" onClick={thisMonth}>This month</button>
        </div>
      )}
      <div className="cal-h">
        <button className="ghost" onClick={() => setCur(new Date(y, m - 1, 1))}>‹</button>
        <b>{cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
        <button className="ghost" onClick={() => setCur(new Date(y, m + 1, 1))}>›</button>
      </div>
      <div className="cal-g">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
          <div key={i} className="cal-w">{w}</div>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button key={i} className={cls(d)} onClick={() => pick(d)}>
              {+d.slice(8)}
            </button>
          ) : (
            <div key={i} />
          )
        )}
      </div>
      <div className={'hint' + (waitEnd ? ' act' : '')}>{hint}</div>
    </div>
  );
}
