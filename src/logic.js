// ---------- date helpers ----------
export const pad = (n) => String(n).padStart(2, '0');
export const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => fmt(new Date());
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
};
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const prettyDate = (s) =>
  parse(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtSec = (s) => {
  s = Math.floor(s);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

// ---------- recurrence ----------
// pattern: 'daily' (every day in range) | 'weekdays' (chosen weekdays) | 'custom' (every N unit)
export function patternOf(r) {
  if (r.pattern) return r.pattern;
  return (+r.every || 1) === 1 && (r.unit || 'day') === 'day' ? 'daily' : 'custom';
}

export function occursOn(t, date) {
  if ((t.manualDates || []).includes(date)) return true;
  const r = t.recurring;
  if (!r || !r.enabled) return false;
  if (r.useDates) return (r.dates || []).includes(date);
  if (!r.from || date < r.from) return false;
  if (r.to && date > r.to) return false;
  const pat = patternOf(r);
  if (pat === 'daily') return true;
  if (pat === 'weekdays') return (r.weekdays || []).includes(parse(date).getDay());
  const n = Math.max(1, +r.every || 1);
  const a = parse(r.from);
  const b = parse(date);
  switch (r.unit) {
    case 'day':
      return diffDays(r.from, date) % n === 0;
    case 'week':
      return diffDays(r.from, date) % (7 * n) === 0;
    case 'month': {
      const m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
      return m >= 0 && m % n === 0 && b.getDate() === a.getDate();
    }
    case 'year': {
      const y = b.getFullYear() - a.getFullYear();
      return y >= 0 && y % n === 0 && b.getMonth() === a.getMonth() && b.getDate() === a.getDate();
    }
  }
  return false;
}

// How many days a recurring setup will land on (for the live preview). Open-ended = first 365 days.
export function countOccurrences(r) {
  if (!r.enabled) return 0;
  if (r.useDates) return (r.dates || []).length;
  if (!r.from) return 0;
  const end = r.to || addDays(r.from, 364);
  const t = { recurring: r, manualDates: [] };
  let n = 0;
  const span = Math.min(diffDays(r.from, end), 3660);
  for (let i = 0; i <= span; i++) if (occursOn(t, addDays(r.from, i))) n++;
  return n;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function recurSummary(t) {
  const r = t.recurring;
  if (!r?.enabled) return 'Added to days manually';
  if (r.useDates) return `${(r.dates || []).length} chosen date(s)`;
  const pat = patternOf(r);
  const range = r.to ? (r.to === r.from ? r.from : `${r.from} → ${r.to}`) : `from ${r.from}`;
  if (pat === 'daily') return `Every day · ${range}`;
  if (pat === 'weekdays') return `${(r.weekdays || []).map((d) => WEEKDAYS[d]).join(' ')} · ${range}`;
  const n = +r.every || 1;
  return `Every ${n > 1 ? n + ' ' : ''}${r.unit}${n > 1 ? 's' : ''} · ${range}`;
}

// ---------- per-day entries ----------
export const entryKey = (date, id) => `${date}|${id}`;

export function getSlot(t, e = {}) {
  if ('start' in e) return e.start && e.end ? { start: toMin(e.start), end: toMin(e.end) } : null;
  const r = t.recurring;
  if (r?.enabled && r.setTime && r.start && r.end) return { start: toMin(r.start), end: toMin(r.end) };
  return null;
}

export const wantsRemind = (t, e = {}) =>
  'remind' in e ? !!e.remind : !!(t.recurring?.enabled && t.recurring.alwaysRemind);

export const spentSec = (e = {}) => (e.spent || 0) + (e.timerStart ? (Date.now() - e.timerStart) / 1000 : 0);

export function getItemsForDate(state, date) {
  return state.tasks
    .filter((t) => occursOn(t, date))
    .map((t) => {
      const entry = state.entries[entryKey(date, t.id)] || {};
      return { task: t, entry, slot: getSlot(t, entry) };
    });
}

// ---------- progress ----------
export function progressOf(task, entry = {}) {
  const m = task.metric || { type: 'complete' };
  switch (m.type) {
    case 'complete':
      return entry.done ? 100 : 0;
    case 'time': {
      const slot = getSlot(task, entry);
      const mins = +m.target || (slot ? slot.end - slot.start : 60);
      return Math.min(100, (spentSec(entry) / (mins * 60)) * 100);
    }
    case 'subtasks': {
      const sb = task.subtasks;
      if (!sb?.enabled || !sb.items.length) return entry.done ? 100 : 0;
      const done = sb.items.filter((i) => entry.subDone?.[i.id]);
      if (sb.type === 'todo' && sb.useWeight) return Math.min(100, done.reduce((a, i) => a + (+i.weight || 0), 0));
      return (done.length / sb.items.length) * 100;
    }
    case 'cost': {
      const t = +m.target || 0;
      return t ? Math.min(100, ((+entry.cost || 0) / t) * 100) : 0;
    }
    case 'percent':
      return Math.min(100, +entry.percent || 0);
  }
  return 0;
}

export const isDone = (task, entry = {}) => !!entry.done || progressOf(task, entry) >= 99.99;

// ---------- overlaps / red groups ----------
export const overlaps = (a, b) => a.start < b.end && b.start < a.end;

export function groupItems(items) {
  const timed = items.filter((i) => i.slot).sort((a, b) => a.slot.start - b.slot.start);
  const free = items.filter((i) => !i.slot);
  const clusters = [];
  let cur = [];
  let end = -1;
  for (const it of timed) {
    if (cur.length && it.slot.start < end) {
      cur.push(it);
      end = Math.max(end, it.slot.end);
    } else {
      if (cur.length) clusters.push(cur);
      cur = [it];
      end = it.slot.end;
    }
  }
  if (cur.length) clusters.push(cur);
  const blocks = clusters.map((g) => {
    if (g.length === 1) return { type: 'single', item: g[0] };
    const s = g[1].slot.start;
    const e = Math.min(g[0].slot.end, g[1].slot.end);
    return { type: 'conflict', items: g, label: `time ${fromMin(s)}–${fromMin(Math.max(e, s))}` };
  });
  return { blocks, free };
}

export const hasConflict = (items) => groupItems(items).blocks.some((b) => b.type === 'conflict');

// ---------- tracker stats ----------
export function taskStats(task, state) {
  const t0 = today();
  let run = 0,
    best = 0,
    sched = 0,
    doneN = 0,
    s30 = 0,
    d30 = 0;
  for (let i = 364; i >= 0; i--) {
    const d = addDays(t0, -i);
    if (!occursOn(task, d)) continue;
    const ok = isDone(task, state.entries[entryKey(d, task.id)]);
    sched++;
    if (ok) {
      doneN++;
      run++;
      best = Math.max(best, run);
    } else if (d !== t0) run = 0;
    if (i < 30) {
      s30++;
      if (ok) d30++;
    }
  }
  let totalSec = 0;
  for (const k in state.entries) if (k.endsWith('|' + task.id)) totalSec += spentSec(state.entries[k]);
  const strip = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t0, -i);
    const on = occursOn(task, d);
    strip.push({ date: d, scheduled: on, done: on && isDone(task, state.entries[entryKey(d, task.id)]) });
  }
  return { streak: run, best, sched, doneN, rate30: s30 ? Math.round((d30 / s30) * 100) : 0, totalSec, strip };
}

// ---------- alarm sound ----------
// A task's own sound wins; otherwise the universal sound; otherwise null (system default)
export function effectiveSound(task, settings) {
  if (task.sound?.enabled && task.sound.path) return task.sound;
  return settings?.universal?.path ? settings.universal : null;
}

// ---------- links ----------
// Only normal web / mail / phone links are allowed (blocks javascript: etc.)
export function normUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : null;
}
export function linkLabel(l) {
  if (l.label?.trim()) return l.label.trim();
  try {
    return new URL(l.url).hostname.replace(/^www\./, '') || l.url;
  } catch {
    return l.url;
  }
}
