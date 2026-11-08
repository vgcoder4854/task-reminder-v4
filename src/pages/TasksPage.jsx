import { useState } from 'react';
import TaskForm from '../components/TaskForm';
import { useStore } from '../store';
import { recurSummary } from '../logic';
import Settings from '../components/Settings';

export default function TasksPage() {
  const { tasks } = useStore();
  const [edit, setEdit] = useState(undefined); // undefined=closed, null=new, task=edit

  const [settings, setSettings] = useState(false);

  return (
    <div className="page">
      <div className="row between">
        <h2 style={{ margin: 0 }}>My tasks</h2>
        <button className="btn sm2 soft" onClick={() => setSettings(true)}>⚙ Settings</button>
      </div>
      {!tasks.length && (
        <div className="empty">
          <p>No tasks yet.</p>
          <p className="muted">Tap + to create your first task. Repeating tasks appear in the Calendar automatically.</p>
        </div>
      )}
      {tasks.map((t) => (
        <div key={t.id} className="card tap" onClick={() => setEdit(t)}>
          <b>{t.title}</b>
          {t.goal && <div className="muted sm">🎯 {t.goal}</div>}
          <div className="tags">
            <span>{recurSummary(t)}</span>
            {t.recurring?.enabled && t.recurring.setTime && <span>⏰ {t.recurring.start}–{t.recurring.end}</span>}
            {t.subtasks?.enabled && <span>☑ {t.subtasks.type} ({t.subtasks.items.length})</span>}
            {t.sound?.enabled && t.sound.path && <span>🎵 {t.sound.name}</span>}
            {t.tracker && <span>📈 tracked</span>}
          </div>
        </div>
      ))}
      <button className="fab" onClick={() => setEdit(null)}>+</button>
      {settings && <Settings onClose={() => setSettings(false)} />}
      {edit !== undefined && <TaskForm task={edit} onClose={() => setEdit(undefined)} />}
    </div>
  );
}
