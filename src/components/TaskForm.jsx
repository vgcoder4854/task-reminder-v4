import { useState } from 'react';
import { Sheet, Toggle, Picker, Section } from './ui';
import MiniCalendar from './MiniCalendar';
import SoundPicker from './SoundPicker';
import { saveTask, deleteTask, newTask, uid, useStore } from '../store';
import { toMin, patternOf, countOccurrences, WEEKDAYS, normUrl } from '../logic';

export default function TaskForm({ task, onClose }) {
  const { tasks } = useStore();
  const [t, setT] = useState(() => {
    const base = task ? JSON.parse(JSON.stringify(task)) : newTask();
    // upgrade tasks saved by older versions
    base.sound = base.sound || { enabled: false, name: '', path: '' };
    base.links = base.links || [];
    base.recurring.pattern = patternOf(base.recurring);
    base.recurring.weekdays = base.recurring.weekdays || [];
    base.recurring.noEnd = !base.recurring.to;
    return base;
  });
  const [pick, setPick] = useState(false);
  const r = t.recurring;
  const s = t.subtasks;
  const m = t.metric;
  const up = (k, v) => setT((x) => ({ ...x, [k]: typeof v === 'object' && !Array.isArray(v) ? { ...x[k], ...v } : v }));
  const upR = (v) => up('recurring', v);
  const upS = (v) => up('subtasks', v);
  const upM = (v) => up('metric', v);

  const setItem = (i, v) => upS({ items: s.items.map((it, k) => (k === i ? { ...it, ...v } : it)) });
  const delItem = (i) => upS({ items: s.items.filter((_, k) => k !== i) });
  const move = (i, d) => {
    const a = [...s.items];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    upS({ items: a });
  };
  const addItem = () => upS({ items: [...s.items, { id: uid(), title: '', description: '', est: '', weight: '' }] });
  const total = s.items.reduce((a, i) => a + (+i.weight || 0), 0);
  const split = () => {
    const n = s.items.length;
    if (!n) return;
    const base = Math.floor(100 / n);
    upS({ items: s.items.map((it, k) => ({ ...it, weight: k === 0 ? base + (100 - base * n) : base })) });
  };
  const changeType = (type) => {
    if (type === s.type) return;
    if (s.items.length && !confirm('Changing the type clears the current subtasks. Continue?')) return;
    upS({ type, items: [] });
  };
  const toggleWeekday = (d) =>
    upR({ weekdays: r.weekdays.includes(d) ? r.weekdays.filter((x) => x !== d) : [...r.weekdays, d].sort() });

  const count = countOccurrences(r);

  function save() {
    if (!t.title.trim()) return alert('Please give the task a title');
    if (r.enabled) {
      if (r.useDates) {
        if (!r.dates.length) return alert('Tap at least one date on the calendar');
      } else {
        if (!r.from) return alert('Pick the first day on the calendar');
        if (!r.noEnd && !r.to) return alert('Pick the last day, or switch on "No end date"');
        if (r.to && r.to < r.from) return alert('The last day is before the first day');
        if (r.pattern === 'weekdays' && !r.weekdays.length) return alert('Choose at least one weekday');
      }
      if (r.setTime && toMin(r.end) <= toMin(r.start)) return alert('The end time must be after the start time');
    }
    if (s.enabled) {
      if (!s.items.length) return alert('Add at least one subtask, or switch subtasks off');
      if (s.items.some((i) => s.type !== 'simple' && !i.title.trim())) return alert('Every subtask needs a title');
      if (s.type === 'todo' && s.useWeight && total !== 100) return alert(`Weights must add up to 100% (now ${total}%)`);
    }
    let links = [];
    if (t.linksOn) {
      for (const l of t.links) {
        if (!l.url.trim()) continue;
        const u = normUrl(l.url);
        if (!u) return alert(`“${l.url}” is not a valid link. Use a web address (https://…), mailto: or tel:`);
        links.push({ ...l, url: u });
      }
      if (!links.length) return alert('Add at least one link, or switch links off');
    }
    if (t.sound.enabled && !t.sound.path) return alert('Choose a sound file, or switch "Custom alarm sound" off');
    const out = { ...t, title: t.title.trim(), links: t.linksOn ? links : t.links };
    if (r.noEnd) out.recurring = { ...r, to: '' };
    if (r.pattern === 'daily') out.recurring = { ...out.recurring, every: 1, unit: 'day' };
    if (!s.enabled && out.metric.type === 'subtasks') out.metric = { type: 'complete', target: '' };
    saveTask(out);
    onClose();
  }

  const metricLabel = { time: 'Target minutes (blank = length of the time slot)', cost: 'Budget / target amount' };

  return (
    <Sheet
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      footer={
        <>
          {task && (
            <button className="btn danger" onClick={() => confirm('Delete this task and all its history?') && (deleteTask(t.id), onClose())}>
              Delete
            </button>
          )}
          <button className="btn" onClick={save}>
            Save task
          </button>
        </>
      }
    >
      <Section icon="✏️" title="What is it?">
        <label className="lbl">Title</label>
        <input className="in" value={t.title} onChange={(e) => up('title', e.target.value)} placeholder="e.g. Morning run" />
        <label className="lbl">Goal <span className="muted sm">(optional)</span></label>
        <textarea className="in" rows={2} value={t.goal} onChange={(e) => up('goal', e.target.value)} placeholder="What do you want to achieve?" />
      </Section>

      <Section icon="🔁" title="When does it happen?">
        <Toggle on={r.enabled} onChange={(v) => upR({ enabled: v })} label="Repeat this task" hint="Off = you add it to days yourself from the Calendar" />
        {r.enabled && (
          <>
            <div className="seg">
              <button className={!r.useDates ? 'on' : ''} onClick={() => upR({ useDates: false })}>📅 Date range</button>
              <button className={r.useDates ? 'on' : ''} onClick={() => upR({ useDates: true })}>📌 Specific dates</button>
            </div>

            {r.useDates ? (
              <MiniCalendar mode="multi" dates={r.dates} onChange={upR} />
            ) : (
              <>
                <MiniCalendar mode="range" from={r.from} to={r.noEnd ? '' : r.to} onChange={upR} />
                <Toggle
                  on={r.noEnd}
                  onChange={(v) => upR({ noEnd: v, to: v ? '' : r.from })}
                  label="No end date"
                  hint="Keep repeating forever"
                />
                <label className="lbl">How often inside this range?</label>
                <div className="seg">
                  {[
                    ['daily', 'Every day'],
                    ['weekdays', 'Chosen weekdays'],
                    ['custom', 'Custom'],
                  ].map(([k, l]) => (
                    <button key={k} className={r.pattern === k ? 'on' : ''} onClick={() => upR({ pattern: k })}>{l}</button>
                  ))}
                </div>
                {r.pattern === 'weekdays' && (
                  <div className="chips">
                    {WEEKDAYS.map((w, d) => (
                      <button key={d} className={'chip' + (r.weekdays.includes(d) ? ' on' : '')} onClick={() => toggleWeekday(d)}>{w}</button>
                    ))}
                  </div>
                )}
                {r.pattern === 'custom' && (
                  <>
                    <div className="row">
                      <span>Every</span>
                      <input className="in sm" type="number" min="1" value={r.every} onChange={(e) => upR({ every: e.target.value })} />
                      <select className="in" value={r.unit} onChange={(e) => upR({ unit: e.target.value })}>
                        <option value="day">day(s)</option>
                        <option value="week">week(s)</option>
                        <option value="month">month(s)</option>
                        <option value="year">year(s)</option>
                      </select>
                    </div>
                    <div className="muted sm">
                      Counted from the first day.{' '}
                      {r.unit === 'month' && 'Lands on the same date each month.'}
                      {r.unit === 'year' && 'Lands on the same date each year.'}
                      {r.unit === 'week' && 'Lands on the same weekday.'}
                    </div>
                  </>
                )}
              </>
            )}

            <div className={'preview' + (count ? '' : ' warn')}>
              {count
                ? `✔ Will appear on ${count}${!r.useDates && r.noEnd ? '+' : ''} day${count > 1 ? 's' : ''}${!r.useDates && r.noEnd ? ' (next year shown)' : ''}`
                : '⚠ Nothing selected yet — it will not appear on any day'}
            </div>

            <hr />
            <Toggle on={r.setTime} onChange={(v) => upR({ setTime: v })} label="Fixed time slot" hint="Same start and end time on every day (you can still change one day later)" />
            {r.setTime && (
              <div className="row">
                <input className="in" type="time" value={r.start} onChange={(e) => upR({ start: e.target.value })} />
                <span>to</span>
                <input className="in" type="time" value={r.end} onChange={(e) => upR({ end: e.target.value })} />
              </div>
            )}
            <Toggle
              on={r.alwaysRemind}
              onChange={(v) => upR({ alwaysRemind: v })}
              label="Ring alarm every time"
              hint={r.setTime ? 'An alarm at the start time on every day' : 'Turn on “Fixed time slot” first'}
              disabled={!r.setTime}
            />
          </>
        )}
      </Section>

      <Section icon="🔔" title="Alarm sound">
        <Toggle
          on={t.sound.enabled}
          onChange={(v) => up('sound', { enabled: v })}
          label="Custom alarm sound"
          hint="Off = uses your default sound from Settings"
        />
        {t.sound.enabled && <SoundPicker value={t.sound} onChange={(v) => up('sound', v)} />}
      </Section>

      <Section icon="🧩" title="Subtasks">
        <Toggle on={s.enabled} onChange={(v) => upS({ enabled: v })} label="Break into subtasks" />
        {s.enabled && (
          <>
            <div className="seg">
              {[
                ['sequence', '➡ Step by step'],
                ['todo', '☑ Checklist'],
                ['simple', '🔗 Link tasks'],
              ].map(([k, l]) => (
                <button key={k} className={s.type === k ? 'on' : ''} onClick={() => changeType(k)}>{l}</button>
              ))}
            </div>
            <div className="muted sm">
              {s.type === 'sequence' && 'Steps unlock one after another, in order.'}
              {s.type === 'todo' && 'A checklist you tick in any order.'}
              {s.type === 'simple' && 'Pick tasks you already created to act as subtasks.'}
            </div>

            {s.type === 'simple' ? (
              <>
                {s.items.map((it, i) => (
                  <div className="row box" key={it.id}>
                    <b style={{ flex: 1 }}>{it.title}</b>
                    <button className="ghost" onClick={() => delItem(i)}>✕</button>
                  </div>
                ))}
                <button className="btn ghost-b" onClick={() => setPick(true)}>+ Choose from my tasks</button>
              </>
            ) : (
              <>
                {s.type === 'todo' && (
                  <>
                    <Toggle on={s.useWeight} onChange={(v) => upS({ useWeight: v })} label="Give items a weight (%)" hint="Split 100% between the items" />
                    {s.useWeight && (
                      <div className="row between">
                        <span className={total === 100 ? 'ok' : 'bad'}>Total {total} / 100%</span>
                        <button className="btn sm2" onClick={split}>Split evenly</button>
                      </div>
                    )}
                  </>
                )}
                {s.items.map((it, i) => (
                  <div className="box" key={it.id}>
                    <div className="row">
                      <span className="badge">{s.type === 'sequence' ? i + 1 : '☐'}</span>
                      <input className="in" placeholder="Title" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
                      {s.type === 'sequence' && (
                        <>
                          <button className="ghost" onClick={() => move(i, -1)}>↑</button>
                          <button className="ghost" onClick={() => move(i, 1)}>↓</button>
                        </>
                      )}
                      <button className="ghost" onClick={() => delItem(i)}>✕</button>
                    </div>
                    <input className="in" placeholder="Description (optional)" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                    {s.type === 'sequence' && (
                      <input className="in" type="number" min="0" placeholder="Estimated minutes (optional)" value={it.est} onChange={(e) => setItem(i, { est: e.target.value })} />
                    )}
                    {s.type === 'todo' && s.useWeight && (
                      <input className="in" type="number" min="0" max="100" placeholder="Weight %" value={it.weight} onChange={(e) => setItem(i, { weight: e.target.value })} />
                    )}
                  </div>
                ))}
                <button className="btn ghost-b" onClick={addItem}>+ Add {s.type === 'sequence' ? 'a step' : 'an item'}</button>
              </>
            )}
          </>
        )}
      </Section>

      <Section icon="📝" title="Notes & links">
        <Toggle on={t.notesOn} onChange={(v) => up('notesOn', v)} label="Notes" hint="Write a note on each day this task appears" />
        <Toggle on={t.linksOn} onChange={(v) => up('linksOn', v)} label="Links" hint="Buttons that open a web page, e.g. a video or document" />
        {t.linksOn && (
          <>
            {t.links.map((l, i) => (
              <div className="box" key={l.id}>
                <div className="row">
                  <input className="in" placeholder="Button name (optional)" value={l.label} onChange={(e) => up('links', t.links.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
                  <button className="ghost" onClick={() => up('links', t.links.filter((_, k) => k !== i))}>✕</button>
                </div>
                <input className="in" type="url" inputMode="url" autoCapitalize="none" placeholder="https://example.com" value={l.url} onChange={(e) => up('links', t.links.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />
              </div>
            ))}
            <button className="btn ghost-b" onClick={() => up('links', [...t.links, { id: uid(), label: '', url: '' }])}>+ Add a link</button>
          </>
        )}
      </Section>

      <Section icon="📏" title="How is progress measured?">
        <select className="in" value={m.type} onChange={(e) => upM({ type: e.target.value })}>
          <option value="complete">Done / not done</option>
          <option value="time">Time spent (with timer)</option>
          <option value="subtasks" disabled={!s.enabled}>Subtasks finished {s.enabled ? '' : '(turn on subtasks first)'}</option>
          <option value="cost">Money spent</option>
          <option value="percent">My own percentage</option>
        </select>
        {metricLabel[m.type] && (
          <input className="in" type="number" min="0" placeholder={metricLabel[m.type]} value={m.target} onChange={(e) => upM({ target: e.target.value })} />
        )}
      </Section>

      <Section icon="📈" title="Tracker">
        <Toggle on={t.tracker} onChange={(v) => up('tracker', v)} label="Track streaks & stats" hint="Shows this task on the Tracker dashboard" />
      </Section>

      {pick && (
        <Picker
          title="Choose subtasks"
          tasks={tasks.filter((x) => x.id !== t.id && !s.items.some((i) => i.refTaskId === x.id))}
          cta="Add as subtasks"
          onClose={() => setPick(false)}
          onDone={(ids) => {
            upS({
              items: [...s.items, ...ids.map((id) => ({ id: uid(), refTaskId: id, title: tasks.find((x) => x.id === id)?.title || '' }))],
            });
            setPick(false);
          }}
        />
      )}
    </Sheet>
  );
}
