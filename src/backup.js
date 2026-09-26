import { SLEEP_KEY } from './sleep-store.js';
import { EVENT_KEY, EVENT_TYPES } from './event-store.js';
import { WAKE_KEY, NIGHT_WAKE_REASONS } from './night-wakes.js';

export const BIRTH_KEY = 'rosleeper.birthDate';

const readList = (storage, key) => {
  try {
    const list = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export function exportBackup(storage) {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    birthDate: storage.getItem(BIRTH_KEY),
    sleepEntries: readList(storage, SLEEP_KEY),
    events: readList(storage, EVENT_KEY),
    nightWakes: readList(storage, WAKE_KEY),
  });
}

const isIso = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

function validate(data) {
  if (data === null || typeof data !== 'object' || !('version' in data)) {
    throw new Error('Das ist keine gültige Sicherung von Rosleeper');
  }
  if (data.version !== 1) throw new Error(`Unbekannte Version der Sicherung: ${data.version}`);
  for (const key of ['sleepEntries', 'events', 'nightWakes']) {
    if (!Array.isArray(data[key])) throw new Error('Das ist keine gültige Sicherung von Rosleeper');
  }
  if (data.birthDate !== null && data.birthDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate)) {
    throw new Error('Ungültiges Geburtsdatum in der Sicherung');
  }
  for (const e of data.sleepEntries) {
    if (typeof e.id !== 'string' || !isIso(e.startedAt) || !(e.endedAt === null || isIso(e.endedAt))) {
      throw new Error('Ungültiger Schlaf-Eintrag in der Sicherung');
    }
  }
  for (const e of data.events) {
    if (typeof e.id !== 'string' || !(e.type in EVENT_TYPES) || !isIso(e.at)) {
      throw new Error('Ungültiges Ereignis in der Sicherung');
    }
  }
  for (const w of data.nightWakes) {
    if (typeof w.id !== 'string' || !(w.reason in NIGHT_WAKE_REASONS) || !isIso(w.at)) {
      throw new Error('Ungültige Nachtwache in der Sicherung');
    }
  }
}

export function importBackup(storage, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Das ist keine gültige Sicherung von Rosleeper');
  }
  validate(data);
  storage.setItem(SLEEP_KEY, JSON.stringify(data.sleepEntries));
  storage.setItem(EVENT_KEY, JSON.stringify(data.events));
  storage.setItem(WAKE_KEY, JSON.stringify(data.nightWakes));
  if (data.birthDate) storage.setItem(BIRTH_KEY, data.birthDate);
}
