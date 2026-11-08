import { Capacitor, registerPlugin } from '@capacitor/core';

export const AlarmSound = Capacitor.isNativePlatform() ? registerPlugin('AlarmSound') : null;

export const FORMATS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
export const MAX_MB = 5;
export const FORMAT_TEXT = 'MP3, WAV, OGG, M4A, AAC or FLAC · max 5 MB';

const webUrls = {}; // web preview only: path -> blob url
let webAudio = null;

const extOf = (n) => (n.split('.').pop() || '').toLowerCase();

// Returns { name, path } or throws an Error with a user-friendly message
export async function importSound(file) {
  const ext = extOf(file.name);
  if (!FORMATS.includes(ext)) throw new Error(`.${ext || '?'} is not supported.\nUse: ${FORMAT_TEXT}`);
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`File is ${(file.size / 1048576).toFixed(1)} MB. Maximum is ${MAX_MB} MB.`);
  const id = Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  if (!AlarmSound) {
    const path = 'web:' + id;
    webUrls[path] = URL.createObjectURL(file);
    return { name: file.name, path };
  }
  const data = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('Could not read the file'));
    r.readAsDataURL(file);
  });
  const out = await AlarmSound.saveSound({ id, ext, data });
  return { name: file.name, path: out.path };
}

export async function previewSound(sound) {
  stopPreview();
  try {
    if (AlarmSound) {
      if (sound?.path) await AlarmSound.playPreview({ path: sound.path });
      else await AlarmSound.playPreview({ path: '' });
    } else if (sound?.path && webUrls[sound.path]) {
      webAudio = new Audio(webUrls[sound.path]);
      webAudio.play();
    } else {
      alert('On the web preview only sounds picked in this session can be played.');
    }
  } catch (e) {
    alert('Could not play this sound: ' + (e?.message || e));
  }
}

export function stopPreview() {
  try {
    if (AlarmSound) AlarmSound.stopPreview();
    if (webAudio) {
      webAudio.pause();
      webAudio = null;
    }
  } catch {}
}

export const webUrlFor = (path) => webUrls[path];
