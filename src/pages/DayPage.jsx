import { useState } from 'react';
import { Sheet, Bar, Picker } from '../components/ui';
import TaskDetail from '../components/TaskDetail';
import { useStore, addToDay, patchEntry } from '../store';
import { getItemsForDate, groupItems, progressOf, isDone, fromMin, prettyDate, wantsRemind } from '../logic';

export default function DayPage({ date, onClose }) {
  const state = useStore();
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const items = getItemsForDate(state, date);
  const { blocks, free } = groupItems(items);
  const doneN = items.filter((i) => isDone(i.task, i.entry)).length;

  const Row = ({ it, red }) => {
    const done = isDone(it.task, it.entry);
    const p = progressOf(it.task, it.entry);
    return (
      <div className={'trow' + (red ? ' red' : '')} onClick={() => setOpen(it.task.id)}>
        <button
          className={'chk' + (done ? ' on' : '')}
          onClick={(ev) => {
            ev.stopPropagation();
            patchEntry(date, it.task.id, { done: !it.entry.done });
          }}
        >
          {done ? '✓' : ''}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b className={done ? 'strike' : ''}>{it.task.title}</b>
          <div className="muted sm">
            {it.slot ? `🕘 ${fromMin(it.slot.start)}–${fromMin(it.slot.end)}` : 'Tap to choose a time'}
            {it.slot && wantsRemind(it.task, it.entry) ? '  ·  🔔' : ''}
            {it.task.linksOn && it.task.links?.length ? '  ·  🔗' : ''}
            {it.entry.note ? '  ·  📝' : ''}
          </div>
          <Bar v={done ? 100 : p} red={red} />
        </div>
      </div>
    );
  };

  const existing = new Set(items.map((i) => i.task.id));

  return (
    <Sheet
      title={prettyDate(date)}
      onClose={onClose}
      footer={<button className="btn" onClick={() => setAdding(true)}>+ Add a task to this day</button>}
    >
      <p className="muted">
        {items.length ? `${doneN} of ${items.length} done` : 'Nothing planned for this day yet.'}
      </p>
      {items.length > 0 && <Bar v={(doneN / items.length) * 100} />}

      {blocks.map((b, i) =>
        b.type === 'single' ? (
          <Row key={i} it={b.item} />
        ) : (
          <div className="group" key={i}>
            <div className="ghead">⚠ Time clash · {b.label}</div>
            <div className="muted sm" style={{ marginBottom: 6 }}>
              These tasks overlap. Open one and move its time to fix the clash.
            </div>
            {b.items.map((it) => (
              <Row key={it.task.id} it={it} red />
            ))}
          </div>
        )
      )}

      {free.length > 0 && (
        <>
          <h4>Not scheduled yet</h4>
          {free.map((it) => (
            <Row key={it.task.id} it={it} />
          ))}
        </>
      )}

      {open && <TaskDetail date={date} taskId={open} onClose={() => setOpen(null)} />}
      {adding && (
        <Picker
          title="Add tasks"
          tasks={state.tasks.filter((t) => !existing.has(t.id))}
          onClose={() => setAdding(false)}
          onDone={(ids) => {
            ids.forEach((id) => addToDay(date, id));
            setAdding(false);
          }}
        />
      )}
    </Sheet>
  );
}
