import { useState } from 'react';
import { Sheet } from './ui';
import { Bars, Heat, HBars, Ring, Hours, Empty } from './charts';
import { useStore } from '../store';
import { overallStats, scoreLabel, insights, shortDate, hourLabel } from '../stats';

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, 'All']];
const hm = (min) => {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

export default function OverallPage({ onClose }) {
  const state = useStore();
  const [days, setDays] = useState(30);
  const o = overallStats(state, days);
  const prev = overallStats(state, days, days);
  const tips = insights(o, prev);
  const many = days > 45;

  const heat = {};
  for (const d of overallStats(state, 16 * 7).perDay) heat[d.date] = d.progress;

  // daily completion, grouped per week for long ranges
  let daily;
  if (many) {
    const wk = new Map();
    for (const p of o.perDay) {
      if (p.rate == null) continue;
      const dt = new Date(p.date + 'T00:00');
      const mon = new Date(dt);
      mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      const k = mon.toISOString().slice(0, 10);
      (wk.get(k) || wk.set(k, []).get(k)).push(p.rate);
    }
    daily = [...wk.entries()].map(([k, a]) => ({ label: shortDate(k), value: Math.round(a.reduce((x, y) => x + y, 0) / a.length) }));
  } else {
    daily = o.perDay.map((p) => ({ label: shortDate(p.date), value: p.rate ?? 0, color: p.rate == null ? 'var(--line)' : p.rate >= 100 ? 'var(--ok)' : undefined }));
  }

  return (
    <Sheet title="Overall performance" onClose={onClose}>
      <div className="seg">
        {RANGES.map(([d, l]) => (
          <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{l}</button>
        ))}
      </div>

      {!o.planned ? (
        <Empty text="Plan some tasks on the Calendar to see your performance." />
      ) : (
        <>
          <div className="card scorecard">
            <Ring value={o.score} size={128} stroke={12} color={o.score >= 70 ? 'var(--ok)' : o.score >= 40 ? 'var(--pri)' : 'var(--bad)'} />
            <div>
              <div className="muted sm">Overall score</div>
              <h2 style={{ margin: 0 }}>{scoreLabel(o.score)}</h2>
              {prev.score != null && (
                <div className={o.score >= prev.score ? 'ok' : 'bad'} style={{ fontWeight: 600 }}>
                  {o.score >= prev.score ? '▲' : '▼'} {Math.abs(o.score - prev.score)} vs previous period
                </div>
              )}
              <div className="muted sm">{o.done} of {o.planned} tasks finished</div>
            </div>
          </div>

          <div className="card">
            <b>The three pillars</b>
            <div className="pillars">
              <Ring value={o.consistency} size={84} stroke={8} color="var(--pri)" label="Consistency" sub={`${o.activeDays}/${o.planDays} days active`} />
              <Ring value={o.completeness} size={84} stroke={8} color="var(--pri2, #7c5cf5)" label="Completeness" sub="avg progress" />
              <Ring value={o.completion} size={84} stroke={8} color="var(--ok)" label="Productivity" sub="tasks finished" />
            </div>
            <div className="muted sm">
              <b>Consistency</b>: days you finished at least one task. <b>Completeness</b>: average progress, partial work counts. <b>Productivity</b>: share of planned tasks you finished. Score = 30% + 30% + 40%.
            </div>
          </div>

          {tips.length > 0 && (
            <div className="card">
              <b>Insights</b>
              {tips.map((t, i) => <div key={i} className="tip">{t}</div>)}
            </div>
          )}

          <div className="kpis">
            <div className="kpi"><big>🔥 {o.streak}</big><small>active-day streak</small></div>
            <div className="kpi"><big>🏆 {o.best}</big><small>best streak</small></div>
            <div className="kpi"><big>{o.donePerActiveDay.toFixed(1)}</big><small>tasks / active day</small></div>
            <div className="kpi"><big>{hm(o.totalMin)}</big><small>time tracked</small></div>
            <div className="kpi"><big>{hm(o.plannedMin)}</big><small>time planned</small></div>
            <div className={'kpi ' + (o.clashDays ? 'bad' : 'good')}><big>{o.clashDays}</big><small>days with clashes</small></div>
          </div>

          <div className="card">
            <b>Daily completion</b>
            <div className="muted sm" style={{ marginTop: -4 }}>{many ? 'Average per week' : 'Share of each day’s tasks finished · green = everything done'}</div>
            <Bars data={daily} />
          </div>

          <div className="card">
            <b>Consistency map</b>
            <div className="muted sm" style={{ marginTop: -4 }}>Last 16 weeks · every task, average progress per day</div>
            <Heat values={heat} weeks={16} />
          </div>

          <div className="card">
            <b>Strongest days of the week</b>
            <Bars data={o.weekdays.map((w) => ({ label: w.label, value: w.rate ?? 0, color: w.rate == null ? 'var(--line)' : undefined }))} height={110} allLabels />
          </div>

          <div className="card">
            <b>When you finish tasks</b>
            <div className="muted sm" style={{ marginTop: -4 }}>
              Completed tasks by scheduled start hour{o.bestHour != null ? ` · peak ${hourLabel(o.bestHour)}` : ''}
            </div>
            <Hours hours={o.hours} />
          </div>

          {o.top.length > 0 && (
            <div className="card">
              <b>🏅 Best tasks</b>
              <HBars rows={o.top.map((t) => ({ label: t.title, value: t.rate }))} color="var(--ok)" />
              {o.low.length > 0 && (
                <>
                  <b style={{ marginTop: 8 }}>🎯 Needs attention</b>
                  <HBars rows={o.low.map((t) => ({ label: t.title, value: t.rate }))} color="var(--bad)" />
                </>
              )}
            </div>
          )}

          <div className="card">
            <b>Planning quality</b>
            <HBars
              rows={[
                { label: 'Tasks with a time slot', value: o.scheduleDiscipline },
                { label: 'Days without clashes', value: o.planDays ? Math.round(((o.planDays - o.clashDays) / o.planDays) * 100) : 0, color: 'var(--ok)' },
              ]}
            />
          </div>
        </>
      )}
    </Sheet>
  );
}
