import { useSyncExternalStore } from 'react';
import { scheduleAll } from './notify';
import { entryKey, today } from './logic';

const KEY = 'taskplanner.v1';
let state = { tasks: [], entries: {}, settings: { universal: null } };
try {
  state = { ...state, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
} catch {}

const subs = new Set();
let timer;

function commit(next) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  subs.forEach((f) => f());
  clearTimeout(timer);
  timer = setTimeout(() => scheduleAll(state), 800);
}

export const getState = () => state;
export const useStore = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state
  );
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export function saveTask(task) {
  const tasks = [...state.tasks];
  const i = tasks.findIndex((x) => x.id === task.id);
  if (i >= 0) tasks[i] = task;
  else tasks.push(task);
  commit({ ...state, tasks });
}

export function deleteTask(id) {
  const entries = {};
  for (const k in state.entries) if (!k.endsWith('|' + id)) entries[k] = state.entries[k];
  const tasks = state.tasks
    .filter((t) => t.id !== id)
    .map((t) =>
      t.subtasks?.type === 'simple'
        ? { ...t, subtasks: { ...t.subtasks, items: t.subtasks.items.filter((i) => i.refTaskId !== id) } }
        : t
    );
  commit({ ...state, tasks, entries });
}

export function patchEntry(date, id, patch) {
  const k = entryKey(date, id);
  commit({ ...state, entries: { ...state.entries, [k]: { ...(state.entries[k] || {}), ...patch } } });
}

export function addToDay(date, id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  saveTask({ ...t, manualDates: [...new Set([...(t.manualDates || []), date])] });
}

export function removeFromDay(date, id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  saveTask({ ...t, manualDates: (t.manualDates || []).filter((d) => d !== date) });
}

export function newTask() {
  return {
    id: uid(),
    title: '',
    goal: '',
    recurring: {
      enabled: false,
      every: 1,
      unit: 'day',
      useDates: false,
      pattern: 'daily',
      weekdays: [],
      from: today(),
      to: today(),
      noEnd: false,
      dates: [],
      setTime: false,
      start: '09:00',
      end: '10:00',
      alwaysRemind: false,
    },
    subtasks: { enabled: false, type: 'todo', useWeight: false, items: [] },
    metric: { type: 'complete', target: '' },
    tracker: false,
    sound: { enabled: false, name: '', path: '' },
    notesOn: false,
    linksOn: false,
    links: [],
    manualDates: [],
  };
}

export function saveSettings(patch) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}
