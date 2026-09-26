import { createSleepStore } from './src/sleep-store.js';
import { ageInMonths, wakeStatus } from './src/wake-window.js';
import { summarizeDays } from './src/history.js';

const BIRTH_KEY = 'rosleeper.birthDate';
const store = createSleepStore(window.localStorage);
const birthDate = () => window.localStorage.getItem(BIRTH_KEY);
const $ = (id) => document.getElementById(id);

const clock = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (d) => d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const duration = (min) => {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  return h > 0 ? `${h} h ${m} min` : `${min} min`;
};
const pad = (n) => String(n).padStart(2, '0');
const toInputValue = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function renderStatus(now) {
  const current = store.current();
  const rec = $('status-rec');
  rec.dataset.phase = '';
  rec.textContent = '';
  $('status-sub').textContent = '';

  if (current) {
    const start = new Date(current.startedAt);
    $('status-main').textContent = `Schläft seit ${clock(start)}`;
    $('status-sub').textContent = duration(Math.floor((now - start) / 60_000));
    $('toggle').textContent = 'Aufgewacht';
    $('toggle').dataset.mode = 'end';
    return;
  }

  $('toggle').textContent = 'Schlaf starten';
  $('toggle').dataset.mode = 'start';

  if (!birthDate()) {
    $('status-main').textContent = 'Geburtsdatum fehlt';
    return;
  }

  const last = store.list().find((e) => e.endedAt !== null);
  const status = wakeStatus({
    lastSleepEnd: last ? new Date(last.endedAt) : null,
    ageMonths: ageInMonths(birthDate(), now),
    now,
  });

  if (status.phase === 'unknown') {
    $('status-main').textContent = 'Noch kein Schlaf erfasst';
    return;
  }
  $('status-main').textContent = `Wach seit ${duration(status.awakeMinutes)}`;
  $('status-sub').textContent = `seit ${clock(new Date(last.endedAt))}`;
  rec.dataset.phase = status.phase;
  rec.textContent = {
    early: `Schlaf ab ${clock(status.sleepFrom)}, spätestens ${clock(status.sleepBy)}`,
    in_window: `Jetzt passt Schlaf, spätestens ${clock(status.sleepBy)}`,
    overdue: `Überfällig seit ${clock(status.sleepBy)}`,
  }[status.phase];
}

function renderWeek(now) {
  const list = $('week');
  list.replaceChildren();
  for (const day of summarizeDays(store.list(), now, 7)) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = dayLabel(new Date(`${day.date}T12:00`));
    const total = document.createElement('span');
    total.className = 'total';
    total.textContent = day.totalMinutes
      ? `${duration(day.totalMinutes)} · ${day.napCount} ${day.napCount === 1 ? 'Nap' : 'Naps'}`
      : '–';
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.style.width = `${Math.min(100, (day.totalMinutes / (16 * 60)) * 100)}%`;
    bar.append(fill);
    li.append(label, total, bar);
    list.append(li);
  }
}

function renderHistory() {
  const list = $('history');
  list.replaceChildren();
  for (const entry of store.list().slice(0, 30)) {
    const start = new Date(entry.startedAt);
    const end = entry.endedAt ? new Date(entry.endedAt) : null;
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    const when = document.createElement('span');
    when.textContent = `${dayLabel(start)} ${clock(start)}–${end ? clock(end) : 'läuft'}`;
    const dur = document.createElement('span');
    dur.className = 'dur';
    dur.textContent = end ? duration(Math.round((end - start) / 60_000)) : '';
    button.append(when, dur);
    button.addEventListener('click', () => openEditor(entry));
    li.append(button);
    list.append(li);
  }
}

function render() {
  const now = new Date();
  renderStatus(now);
  renderWeek(now);
  renderHistory();
}

let editing = null;
function openEditor(entry) {
  editing = entry;
  $('edit-start').value = toInputValue(new Date(entry.startedAt));
  $('edit-end').value = entry.endedAt ? toInputValue(new Date(entry.endedAt)) : '';
  $('edit-end-label').hidden = entry.endedAt === null;
  $('edit-end').required = entry.endedAt !== null;
  $('edit-error').textContent = '';
  $('edit').showModal();
}

$('edit-cancel').addEventListener('click', () => $('edit').close());
$('edit-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    store.correctEntry(editing.id, {
      startedAt: new Date($('edit-start').value),
      endedAt: editing.endedAt === null ? null : new Date($('edit-end').value),
    });
    $('edit').close();
    render();
  } catch (error) {
    $('edit-error').textContent = error.message;
  }
});

$('toggle').addEventListener('click', () => {
  if (store.current()) store.endSleep(new Date());
  else store.startSleep(new Date());
  render();
});

function openSetup() {
  $('setup-date').max = toInputValue(new Date()).slice(0, 10);
  $('setup').showModal();
}
$('setup').addEventListener('close', () => {
  if (!birthDate()) openSetup();
});
$('setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  window.localStorage.setItem(BIRTH_KEY, $('setup-date').value);
  $('setup').close();
  render();
});

render();
if (!birthDate()) openSetup();
setInterval(render, 30_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}
