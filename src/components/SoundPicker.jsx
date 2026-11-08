import { useRef, useState, useEffect } from 'react';
import { importSound, previewSound, stopPreview, FORMATS, FORMAT_TEXT } from '../sounds';

// value: { name, path }   onChange({ name, path })
export default function SoundPicker({ value, onChange, emptyLabel = 'No file chosen' }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => stopPreview(), []);

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      onChange(await importSound(f));
    } catch (err) {
      alert(err.message || String(err));
    }
    setBusy(false);
  }

  return (
    <div className="soundbox">
      <div className="row">
        <span className="sico">🎵</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sname">{value?.path ? value.name : emptyLabel}</div>
          <div className="muted sm">{FORMAT_TEXT}</div>
        </div>
      </div>
      <input ref={ref} type="file" hidden accept={FORMATS.map((f) => '.' + f).join(',') + ',audio/*'} onChange={onFile} />
      <div className="row">
        <button className="btn ghost-b sm2" disabled={busy} onClick={() => ref.current.click()}>
          {busy ? 'Loading…' : value?.path ? 'Change file' : 'Choose file'}
        </button>
        {value?.path && (
          <>
            <button
              className="btn ghost-b sm2"
              onClick={() => {
                if (playing) {
                  stopPreview();
                  setPlaying(false);
                } else {
                  previewSound(value);
                  setPlaying(true);
                }
              }}
            >
              {playing ? '■ Stop' : '▶ Preview'}
            </button>
            <button
              className="btn ghost-b sm2 dangerline"
              onClick={() => {
                stopPreview();
                setPlaying(false);
                onChange({ name: '', path: '' });
              }}
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}
