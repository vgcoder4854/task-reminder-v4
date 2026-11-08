import {
  today, addDays, parse, occursOn, entryKey, getSlot, progressOf, isDone, spentSec,
  getItemsForDate, hasConflict, taskStats,
} from './logic';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const shortDate = (d) => parse(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ---------------------------------------------------------------- one task
// Every day the task was scheduled inside the window (window ends `endOffset` days before today)
export function taskSeries(task, state, days, endOffset = 0) {
  const t0 = addDays(today(), -endOffset);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(t0, -i);
    if (!occursOn(task, d)) continue;
    const e = state.entries[entryKey(d, task.id)] || {};
    const done = isDone(task, e);
    const slot = getSlot(task, e);
    const items = task.subtasks?.enabled ? task.subtasks.items : [];
    out.push({
      date: d,
      entry: e,
      done,
      progress: Math.round(done ? 100 : progressOf(task, e)),
      min: spentSec(e) / 60,
      cost: +e.cost || 0,
      percent: +e.percent || 0,
      planned: slot ? slot.end - slot.start : 0,
      subDone: items.filter((i) => e.subDone?.[i.id]).length,
      note: e.note || '',
    });
  }
  return out;
}

export function weekdayRates(series) {
  const w = DAY_NAMES.map((label) => ({ label, n: 0, done: 0, prog: 0 }));
  for (const s of series) {
    const k = parse(s.date).getDay();
    w[k].n++;
    if (s.done) w[k].done++;
    w[k].prog += s.progress;
  }
  return w.map((x) => ({ label: x.label, n: x.n, rate: x.n ? Math.round(x.prog / x.n) : null, done: x.done }));
}

const monday = (d) => addDays(d, -((parse(d).getDay() + 6) % 7));

// Group a series into weeks (average progress / done-rate) – used when there are many points
export function weekly(series) {
  const m = new Map();
  for (const s of series) {
    const k = monday(s.date);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(s);
  }
  return [...m.entries()].map(([k, a]) => ({
    date: k,
    label: shortDate(k),
    progress: Math.round(avg(a.map((x) => x.progress))),
    doneRate: pct(a.filter((x) => x.done).length, a.length),
    min: a.reduce((x, y) => x + y.min, 0),
    cost: a.reduce((x, y) => x + y.cost, 0),
    n: a.length,
  }));
}

export function taskSummary(task, state, days) {
  const s = taskSeries(task, state, days);
  const prev = taskSeries(task, state, days, days);
  const n = s.length;
  const done = s.filter((x) => x.done).length;
  const rate = pct(done, n);
  const prevRate = prev.length ? pct(prev.filter((x) => x.done).length, prev.length) : null;
  const target = +task.metric?.target || 0;
  const st = taskStats(task, state);
  const totalMin = s.reduce((a, x) => a + x.min, 0);
  const wd = weekdayRates(s);
  const ranked = wd.filter((x) => x.n >= 2 && x.rate != null).sort((a, b) => b.rate - a.rate);
  return {
    series: s,
    n,
    done,
    rate,
    delta: prevRate == null ? null : rate - prevRate,
    avgProgress: Math.round(avg(s.map((x) => x.progress))),
    streak: st.streak,
    best: st.best,
    totalMin,
    avgMinDone: avg(s.filter((x) => x.done).map((x) => x.min)),
    totalCost: s.reduce((a, x) => a + x.cost, 0),
    avgCost: avg(s.map((x) => x.cost)),
    overBudget: target ? s.filter((x) => x.cost >= target).length : 0, // days the cost target was reached
    timeTargetHit: target ? s.filter((x) => x.min >= target).length : 0,
    avgPercent: Math.round(avg(s.map((x) => x.percent))),
    bestPercent: Math.max(0, ...s.map((x) => x.percent)),
    weekdays: wd,
    bestDay: ranked[0] || null,
    worstDay: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    target,
  };
}

// How often each subtask got ticked (shows where you usually stop in a sequence)
export function subtaskRates(task, series) {
  if (!task.subtasks?.enabled) return [];
  return task.subtasks.items.map((it) => ({
    label: it.title || '(untitled)',
    done: series.filter((s) => s.entry.subDone?.[it.id]).length,
    n: series.length,
    rate: pct(series.filter((s) => s.entry.subDone?.[it.id]).length, series.length),
  }));
}

// ---------------------------------------------------------------- everything
export function overallStats(state, days, endOffset = 0) {
  const t0 = addDays(today(), -endOffset);
  const perDay = [];
  const wd = DAY_NAMES.map(() => ({ n: 0, prog: 0, days: 0 }));
  const hours = Array(24).fill(0);
  const byTask = {};
  let planned = 0, done = 0, progSum = 0, sec = 0, withSlot = 0, planDays = 0, activeDays = 0, clashDays = 0;
  let streak = 0, best = 0, run = 0, plannedMin = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(t0, -i);
    const items = getItemsForDate(state, d);
    if (!items.length) {
      perDay.push({ date: d, n: 0, done: 0, rate: null, progress: null });
      continue;
    }
    let dn = 0, ps = 0;
    for (const it of items) {
      const ok = isDone(it.task, it.entry);
      const pr = ok ? 100 : progressOf(it.task, it.entry);
      planned++;
      progSum += pr;
      ps += pr;
      if (ok) {
        done++;
        dn++;
        if (it.slot) hours[Math.floor(it.slot.start / 60)]++;
      }
      if (it.slot) {
        withSlot++;
        plannedMin += it.slot.end - it.slot.start;
      }
      sec += spentSec(it.entry);
      const b = (byTask[it.task.id] ||= { id: it.task.id, title: it.task.title, n: 0, done: 0, prog: 0 });
      b.n++;
      b.prog += pr;
      if (ok) b.done++;
    }
    planDays++;
    if (dn > 0) activeDays++;
    if (hasConflict(items)) clashDays++;
    const k = parse(d).getDay();
    wd[k].n += items.length;
    wd[k].prog += ps;
    wd[k].days++;
    perDay.push({ date: d, n: items.length, done: dn, rate: Math.round((dn / items.length) * 100), progress: Math.round(ps / items.length) });
    if (dn > 0) {
      run++;
      best = Math.max(best, run);
    } else if (!(i === 0 && endOffset === 0)) run = 0; // today not finished yet doesn't break it
  }
  streak = run;

  const completion = pct(done, planned); // Productivity pillar
  const completeness = planned ? Math.round(progSum / planned) : 0;
  const consistency = pct(activeDays, planDays);
  const score = planned ? Math.round(0.4 * completion + 0.3 * completeness + 0.3 * consistency) : null;
  const tasks = Object.values(byTask).map((t) => ({ ...t, rate: pct(t.done, t.n), avgProg: Math.round(t.prog / t.n) }));
  const ranked = tasks.filter((t) => t.n >= 2).sort((a, b) => b.rate - a.rate);
  const wdRates = DAY_NAMES.map((label, i) => ({ label, n: wd[i].days, rate: wd[i].n ? Math.round(wd[i].prog / wd[i].n) : null }));
  const bestHour = hours.reduce((bi, v, i) => (v > hours[bi] ? i : bi), 0);

  return {
    perDay, planned, done, planDays, activeDays, clashDays, withSlot,
    completion, completeness, consistency, score,
    streak, best, totalMin: sec / 60, plannedMin,
    donePerActiveDay: activeDays ? done / activeDays : 0,
    minPerActiveDay: activeDays ? sec / 60 / activeDays : 0,
    scheduleDiscipline: planned ? Math.round(((withSlot - 0) / planned) * 100) : 0,
    weekdays: wdRates, hours, bestHour: hours[bestHour] ? bestHour : null,
    tasks, top: ranked.slice(0, 3), low: ranked.length > 3 ? ranked.slice(-3).reverse() : [],
  };
}

export function scoreLabel(s) {
  if (s == null) return 'No data yet';
  if (s >= 85) return 'Excellent';
  if (s >= 70) return 'Great';
  if (s >= 50) return 'Good';
  if (s >= 30) return 'Getting there';
  return 'Just starting';
}

export const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

export function insights(o, prev) {
  const out = [];
  if (!o.planned) return out;
  if (prev && prev.planned) {
    const d = o.completion - prev.completion;
    if (Math.abs(d) >= 3) out.push(d > 0 ? `📈 You finished ${d}% more tasks than the previous period.` : `📉 You finished ${-d}% fewer tasks than the previous period.`);
  }
  const wd = o.weekdays.filter((x) => x.rate != null && x.n >= 2).sort((a, b) => b.rate - a.rate);
  if (wd.length > 1) out.push(`🏆 ${wd[0].label} is your strongest day (${wd[0].rate}%); ${wd[wd.length - 1].label} is your weakest (${wd[wd.length - 1].rate}%).`);
  if (o.bestHour != null) out.push(`⏰ You finish most tasks scheduled around ${hourLabel(o.bestHour)}.`);
  if (o.clashDays) out.push(`⚠ ${o.clashDays} day${o.clashDays > 1 ? 's' : ''} had overlapping tasks — spreading them out may help.`);
  const noTime = o.planned - o.withSlot;
  if (noTime > o.planned * 0.4) out.push(`🕘 ${noTime} planned tasks have no time slot. Tasks with a time get done more reliably.`);
  if (o.streak >= 3) out.push(`🔥 You are on a ${o.streak}-day streak of finishing at least one task.`);
  if (o.low.length && o.low[0].rate < 50) out.push(`🎯 “${o.low[0].title}” needs attention (${o.low[0].rate}% finished).`);
  return out;
}
