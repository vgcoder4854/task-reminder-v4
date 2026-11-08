import { useState } from 'react';
import { useBack } from '../nav';

export function Toggle({ on, onChange, label, hint, disabled }) {
  return (
    <label className={'tog' + (disabled ? ' dis' : '')}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={!!on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}

export function Sheet({ title, onClose, children, footer }) {
  useBack(onClose);
  return (
    <div className="sheet">
      <header>
        <button className="ghost" onClick={onClose}>
          ←
        </button>
        <h2>{title}</h2>
      </header>
      <div className="body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  );
}

export const Section = ({ icon, title, children }) => (
  <section className="sec">
    <h3>
      <span className="sicon">{icon}</span>
      {title}
    </h3>
    {children}
  </section>
);

export const Bar = ({ v, red }) => (
  <div className="bar">
    <div style={{ width: Math.round(v) + '%', background: red ? 'var(--bad)' : undefined }} />
  </div>
);

// Search + multi-select popup listing tasks
export function Picker({ title, tasks, onDone, onClose, cta = 'Add' }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const list = tasks.filter((t) => (t.title + ' ' + t.goal).toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <button className="btn" disabled={!sel.length} onClick={() => onDone(sel)}>
          {cta} {sel.length ? `(${sel.length})` : ''}
        </button>
      }
    >
      <input className="in" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!list.length && <p className="muted">No tasks to show.</p>}
      {list.map((t) => (
        <label key={t.id} className="row pick">
          <input type="checkbox" checked={sel.includes(t.id)} onChange={() => toggle(t.id)} />
          <div>
            <b>{t.title}</b>
            {t.goal && <div className="muted sm">{t.goal}</div>}
          </div>
        </label>
      ))}
    </Sheet>
  );
}
