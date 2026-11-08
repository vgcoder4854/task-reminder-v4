import { useState } from 'react';
import { Sheet } from './ui';
import { Bars, Line, Heat, HBars, Empty } from './charts';
import { useStore, patchEntry } from '../store';
import { taskSummary, subtaskRates, weekly, shortDate, taskSeries } from '../stats';
import { today, addDays, occursOn, entryKey, isDone, recurSummary } from '../logic';

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, 'All']];

const hm = (min) => {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

function Kpi({ v, l, tone }) {
  return (
    <div className={'kpi' + (tone ? ' ' + tone : '')}>
      <big>{v}</big>
      <small>{l}</small>
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <div className="card">
      <b>{title}</b>
      {sub && <div className="muted sm" style={{ marginTop: -4 }}>{sub}</div>}
      {children}
    </div>
  );
}

export default function TaskStatsPage({ taskId, onClose }) {
  const state = useStore();
  const task = state.tasks.find((t) => t.id === taskId);
  const [days, setDays] = useState(30);
  if (!task) return null;

  const S = taskSummary(task, state, days);
  const s = S.series;
  const m = task.metric.type;
  const many = s.length > 45;
  const wk = weekly(s);

  // heat map values over the last 16 weeks regardless of selected range
  const heat = {};
  for (const x of taskSeries(task, state, 16 * 7)) heat[x.date] = x.progress;

  // progress per day (or per week when there are many days)
  const progData = many
    ? wk.map((w) => ({ label: w.label, value: w.progress }))
    : s.map((x) => ({ label: shortDate(x.date), value: x.progress, color: x.done ? 'var(--ok)' : undefined }));

  const t0 = today();
  const strip = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t0, -i);
    const on = occursOn(task, d);
    strip.push({ d, on, done: on && isDone(task, state.entries[entryKey(d, task.id)]) });
  }
  const notes = s.filter((x) => x.note).slice(-8).reverse();
  const subs = subtaskRates(task, s);

  return (
    <Sheet title={task.title} onClose={onClose}>
      <p className="muted sm" style={{ margin: '0 0 8px' }}>🎯 {task.goal || 'No goal written'} · {recurSummary(task)}</p>

      <div className="seg">
        {RANGES.map(([d, l]) => (
          <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{l}</button>
        ))}
      </div>

      {!S.n ? (
        <Empty text="This task was not scheduled in this period yet." />
      ) : (
        <>
          <div className="kpis">
            <Kpi v={`🔥 ${S.streak}`} l="current streak" />
            <Kpi v={`🏆 ${S.best}`} l="best streak" />
            <Kpi v={`${S.rate}%`} l={`done · ${S.done}/${S.n} days`} tone={S.rate >= 70 ? 'good' : S.rate < 40 ? 'bad' : ''} />
            <Kpi v={`${S.avgProgress}%`} l="average progress" />
            {S.delta != null && (
              <Kpi v={`${S.delta > 0 ? '▲' : S.delta < 0 ? '▼' : '='} ${Math.abs(S.delta)}%`} l="vs previous period" tone={S.delta > 0 ? 'good' : S.delta < 0 ? 'bad' : ''} />
            )}
            {S.totalMin > 0 && <Kpi v={hm(S.totalMin)} l="time tracked" />}
          </div>

          <Card title="Progress" sub={many ? 'Average per week' : 'Each bar is one scheduled day · green = completed'}>
            <Bars data={progData} />
          </Card>

          <Card title="Consistency map" sub="Last 16 weeks · darker green = more progress">
            <Heat values={heat} weeks={16} />
          </Card>

          <Card title="Best days of the week" sub="Average progress by weekday">
            <Bars
              data={S.weekdays.map((w) => ({ label: w.label, value: w.rate ?? 0, color: w.rate == null ? 'var(--line)' : undefined }))}
              height={110}
              allLabels
            />
            {S.bestDay && (
              <div className="muted sm">
                Strongest: <b>{S.bestDay.label}</b> ({S.bestDay.rate}%){S.worstDay ? <> · weakest: <b>{S.worstDay.label}</b> ({S.worstDay.rate}%)</> : null}
              </div>
            )}
          </Card>

          {/* ---- metric specific ---- */}
          {m === 'complete' && (
            <Card title="Weekly completion" sub="Share of scheduled days you completed, per week">
              <Bars data={wk.slice(-12).map((w) => ({ label: w.label, value: w.doneRate }))} />
            </Card>
          )}

          {m === 'time' && (
            <Card title="Time spent" sub={S.target ? `Target ${S.target} min per day` : 'Minutes on the timer per day'}>
              <div className="kpis small">
                <Kpi v={hm(S.totalMin)} l="total" />
                <Kpi v={hm(S.totalMin / S.n)} l="average / day" />
                {S.target > 0 && <Kpi v={`${S.timeTargetHit}/${S.n}`} l="days target reached" tone={S.timeTargetHit / S.n >= 0.7 ? 'good' : ''} />}
              </div>
              <Bars
                data={many ? wk.map((w) => ({ label: w.label, value: w.min / Math.max(1, w.n) })) : s.map((x) => ({ label: shortDate(x.date), value: x.min }))}
                max="auto" unit="m" target={S.target || undefined} color="var(--pri2, var(--pri))"
              />
            </Card>
          )}

          {m === 'cost' && (
            <Card title="Spending" sub={S.target ? `Target ${S.target} per day · green = target reached` : 'Amount per day'}>
              <div className="kpis small">
                <Kpi v={Math.round(S.totalCost).toLocaleString()} l="total" />
                <Kpi v={Math.round(S.avgCost).toLocaleString()} l="average / day" />
                {S.target > 0 && <Kpi v={`${S.overBudget}/${S.n}`} l="days target reached" tone={S.overBudget / S.n >= 0.7 ? 'good' : ''} />}
              </div>
              <Bars
                data={many ? wk.map((w) => ({ label: w.label, value: w.cost / Math.max(1, w.n) })) : s.map((x) => ({ label: shortDate(x.date), value: x.cost, color: S.target && x.cost >= S.target ? 'var(--ok)' : undefined }))}
                max="auto" unit="" target={S.target || undefined} fmt={(v) => Math.round(v).toLocaleString()}
              />
            </Card>
          )}

          {m === 'percent' && (
            <Card title="Your own percentage" sub="What you entered each day">
              <div className="kpis small">
                <Kpi v={`${S.avgPercent}%`} l="average" />
                <Kpi v={`${S.bestPercent}%`} l="best day" />
              </div>
              <Line data={s.map((x) => ({ label: shortDate(x.date), value: x.percent }))} />
            </Card>
          )}

          {(m === 'subtasks' || subs.length > 0) && subs.length > 0 && (
            <Card
              title="Subtasks"
              sub={task.subtasks.type === 'sequence' ? 'How far you usually get through the steps' : 'How often each one gets done'}
            >
              <HBars rows={subs.map((x) => ({ label: x.label, value: x.rate, right: `${x.done}/${x.n}` }))} />
              {task.subtasks.type === 'sequence' && subs.length > 1 && subs[subs.length - 1].rate < subs[0].rate - 20 && (
                <div className="muted sm">You often stop before the last step — consider shortening the sequence or making steps smaller.</div>
              )}
            </Card>
          )}

          {task.notesOn && (
            <Card title="📝 Notes">
              {notes.length ? (
                notes.map((n) => (
                  <div key={n.date} className="noteitem">
                    <div className="muted sm">{shortDate(n.date)}</div>
                    <div>{n.note}</div>
                  </div>
                ))
              ) : (
                <div className="muted sm">No notes in this period.</div>
              )}
            </Card>
          )}
        </>
      )}

      <Card title="Last 14 days" sub="Tap a day to mark it done / not done">
        <div className="strip">
          {strip.map((c) => (
            <button
              key={c.d}
              disabled={!c.on}
              className={'sq' + (c.done ? ' on' : '') + (c.on ? '' : ' off')}
              onClick={() => patchEntry(c.d, task.id, { done: !state.entries[entryKey(c.d, task.id)]?.done })}
            >
              {+c.d.slice(8)}
            </button>
          ))}
        </div>
      </Card>
    </Sheet>
  );
}
