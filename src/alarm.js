// In-app looping alarm (used when the app is open, and on the web preview)
import { webUrlFor } from './sounds';

let ctx = null;
let timer = null;
let fileAudio = null;

export function startAlarm(soundPath) {
  stopAlarm();
  // web preview: play the chosen file in a loop if we still have it
  const url = soundPath && webUrlFor(soundPath);
  if (url) {
    fileAudio = new Audio(url);
    fileAudio.loop = true;
    fileAudio.play().catch(() => {});
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  const beep = () => {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.value = 0.2;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  };
  let n = 0;
  beep();
  timer = setInterval(() => {
    beep();
    if (++n > 100) stopAlarm();
  }, 600);
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
}

export function stopAlarm() {
  if (fileAudio) {
    fileAudio.pause();
    fileAudio = null;
  }
  clearInterval(timer);
  timer = null;
  try {
    ctx && ctx.close();
  } catch {}
  ctx = null;
  if (navigator.vibrate) navigator.vibrate(0);
}
