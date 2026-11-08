import { addDays, today, parse } from '../logic';

const W = 320;
const mono = { fontSize: 9, fill: 'var(--muted)' };

export function Empty({ text = 'Not enough data yet' }) {
  return <div className="chart-empty">{text}</div>;
}

// Vertical bars. data: [{label, value, color?}]
export function Bars({ data, max = 100, height = 130, target, unit = '%', color = 'var(--pri)', fmt = (v) => Math.round(v), allLabels = false }) {
  if (!data.length) return <Empty />;
  const H = height, L = 30, B = 18, T = 8;
  const top = max === 'auto' ? Math.max(1, target || 0, ...data.map((d) => d.value)) * 1.1 : max;
  const y = (v) => T + (H - T - B) * (1 - Math.min(v, top) / top);
  const bw = (W - L) / data.length;
  const gap = Math.min(5, bw * 0.25);
  const lab = (i) => allLabels || i === 0 || i === data.length - 1 || i === Math.floor((data.length - 1) / 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W} y1={y(top * f)} y2={y(top * f)} style={{ stroke: 'var(--line)' }} />
          <text x={L - 4} y={y(top * f) + 3} textAnchor="end" style={mono}>{fmt(top * f)}{f === 1 ? unit : ''}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <g key={i}>
          <rect
            x={L + i * bw + gap / 2}
            y={y(d.value)}
            width={Math.max(1, bw - gap)}
            height={Math.max(d.value > 0 ? 1.5 : 0, H - B - y(d.value))}
            rx={Math.min(3, bw / 3)}
            style={{ fill: d.color || color }}
          >
            <title>{`${d.label}: ${fmt(d.value)}${unit}`}</title>
          </rect>
          {lab(i) && (
            <text x={L + i * bw + bw / 2} y={H - 4} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} style={mono}>
              {d.label}
            </text>
          )}
        </g>
      ))}
      {target != null && target > 0 && target <= top && (
        <g>
          <line x1={L} x2={W} y1={y(target)} y2={y(target)} strokeDasharray="4 3" style={{ stroke: 'var(--bad)' }} />
          <text x={W} y={y(target) - 3} textAnchor="end" style={{ ...mono, fill: 'var(--bad)' }}>target {fmt(target)}{unit}</text>
        </g>
      )}
    </svg>
  );
}

// Line + soft area. data: [{label, value}]
export function Line({ data, max = 100, height = 130, unit = '%', color = 'var(--pri)', fmt = (v) => Math.round(v) }) {
  if (data.length < 2) return <Empty text="Needs at least 2 days of data" />;
  const H = height, L = 30, B = 18, T = 8, R = 6;
  const top = max === 'auto' ? Math.max(1, ...data.map((d) => d.value)) * 1.1 : max;
  const x = (i) => L + ((W - L - R) * i) / (data.length - 1);
  const y = (v) => T + (H - T - B) * (1 - Math.min(v, top) / top);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const lab = (i) => i === 0 || i === data.length - 1 || i === Math.floor((data.length - 1) / 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W} y1={y(top * f)} y2={y(top * f)} style={{ stroke: 'var(--line)' }} />
          <text x={L - 4} y={y(top * f) + 3} textAnchor="end" style={mono}>{fmt(top * f)}{f === 1 ? unit : ''}</text>
        </g>
      ))}
      <polygon points={`${x(0)},${H - B} ${pts} ${x(data.length - 1)},${H - B}`} style={{ fill: color, opacity: 0.12 }} />
      <polyline points={pts} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: color }} />
      {data.length <= 31 && data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r="2.5" style={{ fill: color }}>
          <title>{`${d.label}: ${fmt(d.value)}${unit}`}</title>
        </circle>
      ))}
      {data.map((d, i) => lab(i) && (
        <text key={'l' + i} x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} style={mono}>{d.label}</text>
      ))}
    </svg>
  );
}

// GitHub-style calendar heatmap. values: {date: 0..100 | null}. null = not scheduled
export function Heat({ values, weeks = 14 }) {
  const t0 = today();
  const end = addDays(t0, 6 - parse(t0).getDay()); // end of this week (Saturday)
  const cell = 15, gap = 3, L = 22;
  const wTotal = L + weeks * (cell + gap);
  const cells = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(end, -((weeks - 1 - w) * 7 + (6 - d)));
      if (date > t0) continue;
      const v = values[date];
      let st;
      if (v == null) st = { fill: 'var(--line)', opacity: 0.45 };
      else if (v === 0) st = { fill: 'var(--bad)', opacity: 0.4 };
      else st = { fill: 'var(--ok)', opacity: 0.25 + 0.75 * (v / 100) };
      cells.push(
        <rect key={date} x={L + w * (cell + gap)} y={d * (cell + gap)} width={cell} height={cell} rx="4" style={st}>
          <title>{`${date}: ${v == null ? 'not scheduled' : Math.round(v) + '%'}`}</title>
        </rect>
      );
    }
  }
  return (
    <div>
      <svg viewBox={`0 0 ${wTotal} ${7 * (cell + gap)}`} className="chart-svg" role="img">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((n, i) => (
          <text key={i} x="0" y={i * (cell + gap) + 11} style={mono}>{i % 2 ? n : ''}</text>
        ))}
        {cells}
      </svg>
      <div className="legend">
        <i style={{ background: 'var(--line)', opacity: 0.6 }} /> not scheduled
        <i style={{ background: 'var(--bad)', opacity: 0.5 }} /> missed
        <i style={{ background: 'var(--ok)', opacity: 0.4 }} /> partial
        <i style={{ background: 'var(--ok)' }} /> done
      </div>
    </div>
  );
}

// Horizontal bars. rows: [{label, value(0..100), right?}]
export function HBars({ rows, color = 'var(--pri)' }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="hbars">
      {rows.map((r, i) => (
        <div key={i} className="hrow">
          <div className="hlab">{r.label}</div>
          <div className="htrack"><div style={{ width: Math.max(2, r.value) + '%', background: r.color || color }} /></div>
          <div className="hval">{r.right ?? Math.round(r.value) + '%'}</div>
        </div>
      ))}
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 9, color = 'var(--pri)', label, sub }) {
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="ring-wrap" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--line)' }} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(c * v) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ stroke: color }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: size / 3.4, fontWeight: 700, fill: 'var(--text)' }}>
          {value == null ? '–' : Math.round(value)}
        </text>
      </svg>
      {label && <div className="ring-l">{label}</div>}
      {sub && <div className="muted ring-s">{sub}</div>}
    </div>
  );
}

// 24-hour histogram
export function Hours({ hours }) {
  const data = hours.map((v, h) => ({ label: h % 6 === 0 ? `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` : '', value: v }));
  if (!hours.some((v) => v)) return <Empty text="Finish tasks that have a time slot to see this" />;
  return <Bars data={data} max="auto" height={110} unit="" allLabels />;
}
