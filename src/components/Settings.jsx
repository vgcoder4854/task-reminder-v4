import { useEffect, useState } from 'react';
import { Sheet } from './ui';
import SoundPicker from './SoundPicker';
import { useStore, saveSettings } from '../store';
import { isNative, scheduleTest, scheduleAll } from '../notify';
import { startAlarm } from '../alarm';
import { AlarmSound } from '../sounds';

// Makers whose battery managers are known to kill closed apps and cancel their alarms
const AGGRESSIVE = ['xiaomi', 'redmi', 'poco', 'oppo', 'realme', 'oneplus', 'vivo', 'iqoo', 'huawei', 'honor', 'samsung', 'tecno', 'infinix', 'itel', 'lenovo', 'motorola', 'asus', 'nothing'];
const STEPS = {
  xiaomi: 'Security app → Permissions → Autostart → turn ON for Task Planner. Then Settings → Apps → Task Planner → Battery saver → “No restrictions”.',
  redmi: 'Security app → Permissions → Autostart → turn ON for Task Planner. Then Settings → Apps → Task Planner → Battery saver → “No restrictions”.',
  poco: 'Security app → Permissions → Autostart → turn ON for Task Planner. Then Settings → Apps → Task Planner → Battery saver → “No restrictions”.',
  oppo: 'Settings → Battery → App battery management → Task Planner → allow Auto-launch, Background activity and Allow activity in the background.',
  realme: 'Settings → Battery → App battery management → Task Planner → allow Auto-launch, Background activity and Allow activity in the background.',
  oneplus: 'Settings → Battery → Battery optimisation → Task Planner → Don’t optimise. Also allow Auto-launch in the app’s info page.',
  vivo: 'Settings → Battery → Background power consumption → Task Planner → Allow. Also enable Autostart (iManager → App manager → Autostart).',
  iqoo: 'Settings → Battery → Background power consumption → Task Planner → Allow. Also enable Autostart.',
  huawei: 'Settings → Battery → App launch → Task Planner → turn off “Manage automatically” and enable all three switches.',
  honor: 'Settings → Battery → App launch → Task Planner → turn off “Manage automatically” and enable all three switches.',
  samsung: 'Settings → Battery → Background usage limits → remove Task Planner from “Sleeping apps” and “Deep sleeping apps”, and add it to “Never sleeping apps”.',
};
const fix = (m) => STEPS[m] || 'In your phone’s battery settings, set Task Planner to “Unrestricted / No restrictions” and allow auto-start / background activity.';

function Row({ ok, title, text, action, onAction }) {
  return (
    <div className="hrow2">
      <span className={'dotc ' + (ok === true ? 'good' : ok === false ? 'bad' : 'warn')}>{ok === true ? '✓' : ok === false ? '✕' : '!'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{title}</b>
        <div className="muted sm">{text}</div>
      </div>
      {action && <button className="btn sm2 soft" onClick={onAction}>{action}</button>}
    </div>
  );
}

export default function Settings({ onClose }) {
  const state = useStore();
  const uni = state.settings?.universal || { name: '', path: '' };
  const [st, setSt] = useState(null);

  async function refresh() {
    if (!AlarmSound) return;
    try {
      setSt(await AlarmSound.getStatus());
    } catch {}
  }
  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 2000);
    return () => clearInterval(i);
  }, []);

  async function test() {
    if (isNative) {
      try {
        await scheduleTest(state);
        refresh();
        alert('Test alarm in 10 seconds.\n\nFor the real test: now swipe this app away from your recent apps and lock the phone. It should still ring.');
      } catch (e) {
        alert('Could not schedule: ' + e);
      }
    } else {
      alert('Alarm will ring in 5 seconds');
      setTimeout(() => startAlarm(uni.path), 5000);
    }
  }

  async function ringNow() {
    if (AlarmSound) {
      try {
        await AlarmSound.ringNow({ title: 'Test alarm', body: 'Tap Stop to silence', path: uni.path || '' });
      } catch (e) {
        alert('Could not ring: ' + e);
      }
    } else startAlarm(uni.path);
  }

  const maker = (st?.manufacturer || '').toLowerCase();
  const aggressive = AGGRESSIVE.some((m) => maker.includes(m));
  const when = st?.nextAt ? new Date(st.nextAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <Sheet title="Settings" onClose={onClose}>
      {isNative && (
        <section className="sec">
          <h3><span className="sicon">🩺</span>Alarm health check</h3>
          {!st ? (
            <p className="muted sm">Checking…</p>
          ) : (
            <>
              <Row
                ok={st.count > 0 ? true : null}
                title={st.count ? `${st.count} alarm${st.count > 1 ? 's' : ''} scheduled` : 'No alarms scheduled'}
                text={st.count ? `Next: ${st.nextTitle} · ${when}` : 'Alarms exist only for tasks with a time, “Ring alarm” on, and a future day.'}
                action="Refresh"
                onAction={async () => { const { getState } = await import('../store'); await scheduleAll(getState()); refresh(); }}
              />
              <Row ok={st.notifications} title="Notifications" text={st.notifications ? 'Allowed' : 'Blocked — the alarm screen and Stop button cannot show.'} action={st.notifications ? null : 'Allow'} onAction={() => AlarmSound.openAppSettings()} />
              <Row ok={st.battery} title="Battery restriction" text={st.battery ? 'Not restricted' : 'Android may stop the app and cancel alarms when it is closed.'} action={st.battery ? null : 'Fix'} onAction={() => AlarmSound.requestBattery()} />
              <Row
                ok={aggressive ? null : true}
                title={`Auto-start (${st.manufacturer || 'your phone'})`}
                text={aggressive ? 'Cannot be checked automatically. Please make sure it is ON — see steps below.' : 'Usually not needed on this phone.'}
                action={aggressive ? 'Open' : null}
                onAction={() => AlarmSound.openAutostart()}
              />
              {aggressive && (
                <div className="tip">
                  <b>Steps for {st.manufacturer}:</b> {fix(maker.split(' ')[0])}
                </div>
              )}
              <div className="muted sm">
                Also: keep the app in Recents but locked (long-press its card → Lock), and never use <b>Force stop</b> — Android deletes all alarms of a force-stopped app until you open it again.
              </div>
            </>
          )}
        </section>
      )}

      <section className="sec">
        <h3><span className="sicon">🔔</span>Default alarm sound</h3>
        <p className="muted sm">Used by every task without its own custom sound. Leave empty to use your phone's normal alarm ringtone.</p>
        <SoundPicker value={uni} emptyLabel="Phone's alarm ringtone" onChange={(v) => saveSettings({ universal: v.path ? v : null })} />
      </section>

      <section className="sec">
        <h3><span className="sicon">🧪</span>Try it</h3>
        <div className="row">
          <button className="btn" onClick={test}>Test in 10 s</button>
          <button className="btn ghost-b" onClick={ringNow}>Ring now</button>
        </div>
        <p className="muted sm">Alarms loop until you tap Stop — on the alarm screen or on the notification.</p>
      </section>
    </Sheet>
  );
}
