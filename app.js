import { createSleepStore } from './src/sleep-store.js';
import { ageInMonths, wakeStatus } from './src/wake-window.js';
import { createEventStore, EVENT_TYPES } from './src/event-store.js';
import { wakePhases, sleepPhases, weeklyReport, nightReport } from './src/analysis.js';
import { drawLineChart } from './src/chart.js';
import { wakeWindowForAge } from './src/wake-window.js';
import { assessTotalSleep } from './src/reference.js';
import { createNightWakeStore, NIGHT_WAKE_REASONS } from './src/night-wakes.js';
import { exportBackup, importBackup, BIRTH_KEY } from './src/backup.js';

const store = createSleepStore(window.localStorage);
const events = createEventStore(window.localStorage);
const wakes = createNightWakeStore(window.localStorage);
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
    $('status-emoji').textContent = '😴';
    const start = new Date(current.startedAt);
    $('status-main').textContent = `Schläft seit ${clock(start)}`;
    $('status-sub').textContent = duration(Math.floor((now - start) / 60_000));
    $('toggle').textContent = '☀️ Aufgewacht';
    $('wake-btn').hidden = false;
    $('toggle').dataset.mode = 'end';
    return;
  }

  $('toggle').textContent = '🌙 Schlaf starten';
  $('wake-btn').hidden = true;
  $('status-emoji').textContent = '🙂';
  $('toggle').dataset.mode = 'start';

  if (!birthDate()) {
    $('status-emoji').textContent = '📅';
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

const EVENT_EMOJI = { sick: '🤒', vaccination: '💉', teething: '🦷', tummy: '🤢' };
const DAY_MS = 86_400_000;
const decimal = (n) => String(n).replace('.', ',');

let weekOffset = 0;
const shortDate = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// Angezeigte Woche: 7 Tage bis (heute − 7 × Offset). Der Bericht der aktuellen Woche nimmt nur volle Tage (bis gestern).
function viewWindow(now) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() - 7 * weekOffset);
  const from = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - 6);
  const to = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1);
  return { from, to, lastDay, reportNow: weekOffset === 0 ? now : to, ageAt: weekOffset === 0 ? now : lastDay };
}

function renderWeekNav(now) {
  const { from, lastDay } = viewWindow(now);
  $('week-label').textContent = weekOffset === 0 ? 'Letzte 7 Tage' : `${shortDate(from)}–${shortDate(lastDay)}`;
  $('week-next').disabled = weekOffset === 0;
  const earliest = store.list().reduce((min, e) => Math.min(min, new Date(e.startedAt).getTime()), Infinity);
  $('week-prev').disabled = !(earliest < from.getTime());
}

function renderReport(now) {
  const box = $('report');
  box.replaceChildren();
  const birth = birthDate();
  if (!birth) return;
  const view = viewWindow(now);
  const report = weeklyReport(store.list(), { now: view.reportNow, days: 7, birthDate: birth });
  const note = (text) => {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = text;
    box.append(p);
  };
  if (report.daysCounted === 0) {
    note('Für diese Woche gibt es noch keine vollständigen Tage.');
    return;
  }
  const tiles = document.createElement('div');
  tiles.className = 'tiles';
  const add = (value, label) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const b = document.createElement('b');
    b.textContent = value;
    const span = document.createElement('span');
    span.textContent = label;
    tile.append(b, span);
    tiles.append(tile);
  };
  add(duration(report.avgTotalMinutes), 'Schlaf pro Tag');
  add(decimal(report.avgNaps), 'Naps pro Tag');
  add(report.avgNightMinutes === null ? '–' : duration(report.avgNightMinutes), 'Nachtschlaf');
  add(report.avgWakeMinutes === null ? '–' : duration(report.avgWakeMinutes), 'Wachphase');
  const night = nightReport(store.list(), wakes.list(), { now: view.reportNow, days: 7 });
  if (night.nightsCounted > 0) {
    add(decimal(night.avgWakes), 'Nachtwachen pro Nacht');
    add(duration(night.avgLongestStretchMinutes), 'Längster Abschnitt');
  }
  box.append(tiles);

  const age = ageInMonths(birth, view.ageAt);
  note(`Grundlage: ${report.daysCounted} vollständige${report.daysCounted === 1 ? 'r' : ''} Tag${report.daysCounted === 1 ? '' : 'e'}${weekOffset === 0 ? ' (ohne heute)' : ''}.`);
  if (report.napWakeInWindowShare !== null) {
    const { minMinutes, maxMinutes } = wakeWindowForAge(age);
    note(`${Math.round(report.napWakeInWindowShare * 100)} % der Wachphasen vor Naps lagen im Richtwert (${minMinutes}–${maxMinutes} min).`);
  }
  if (night.nightsCounted > 0) {
    note(`Nachts: Ø ${decimal(night.avgFeeds)} Mahlzeit(en) pro Nacht (Stillen/Flasche). Es zählt nur, was du unter „Kurz wach" einträgst.`);
  }
  const { status, range } = assessTotalSleep(report.avgTotalMinutes, age);
  if (status === 'none') {
    note(
      age < 4
        ? 'Für Säuglinge unter 4 Monaten gibt es keine AAP/AASM-Empfehlung (zu große Bandbreite). Zum Vergleich: im Mittel 12,8 Stunden pro Tag (9,7–15,9), Galland et al., 2012.'
        : 'Für dieses Alter ist keine Empfehlung hinterlegt.',
    );
  } else {
    const where = { within: 'im empfohlenen Bereich', below: 'unter dem empfohlenen Bereich', above: 'über dem empfohlenen Bereich' }[status];
    note(`Empfehlung mit ${age} Monaten: ${range.minHours}–${range.maxHours} Stunden pro 24 h inkl. Naps (AAP/AASM, Paruthi et al., 2016). Der Schnitt liegt ${where}. Richtwert, keine Diagnose.`);
  }
}

function renderCharts(now) {
  const birth = birthDate();
  const view = viewWindow(now);
  const from = view.from.getTime();
  const to = view.to.getTime();
  const marks = events.list().map((e) => ({ t: new Date(e.at).getTime(), emoji: EVENT_EMOJI[e.type] }));
  const entries = store.list();

  const phases = wakePhases(entries);
  const wakePoints = (beforeNight) =>
    phases.filter((p) => p.beforeNight === beforeNight).map((p) => ({ t: new Date(p.start).getTime(), v: p.minutes }));
  const band = birth
    ? (({ minMinutes, maxMinutes }) => ({ min: minMinutes, max: maxMinutes }))(wakeWindowForAge(ageInMonths(birth, view.ageAt)))
    : null;
  $('chart-wake').replaceChildren(
    drawLineChart({
      from, to, yMax: 360, yStep: 60, band, marks,
      series: [
        { points: wakePoints(false), color: 'var(--wake)' },
        { points: wakePoints(true), color: 'var(--wake)', hollow: true, line: false },
      ],
    }),
  );

  const sleeps = sleepPhases(entries);
  const pointsOf = (kind) => sleeps.filter((p) => p.kind === kind).map((p) => ({ t: new Date(p.start).getTime(), v: p.minutes }));
  $('chart-sleep').replaceChildren(
    drawLineChart({
      from, to, yMax: 720, yStep: 120, marks,
      series: [
        { points: pointsOf('nap'), color: 'var(--nap)' },
        { points: pointsOf('night'), color: 'var(--night)' },
      ],
    }),
  );
}

function renderEvents() {
  const list = $('events');
  list.replaceChildren();
  for (const event of events.list().slice(0, 6)) {
    const li = document.createElement('li');
    const text = document.createElement('div');
    text.className = 'ev-text';
    const when = new Date(event.at);
    text.textContent = `${EVENT_EMOJI[event.type]} ${EVENT_TYPES[event.type]} · ${dayLabel(when)} ${clock(when)}`;
    if (event.note) {
      const note = document.createElement('div');
      note.className = 'ev-note';
      note.textContent = event.note;
      text.append(note);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'ev-del';
    del.setAttribute('aria-label', 'Ereignis löschen');
    del.textContent = '✕';
    del.addEventListener('click', () => {
      if (window.confirm('Ereignis löschen?')) {
        events.removeEvent(event.id);
        render();
      }
    });
    li.append(text, del);
    list.append(li);
  }
}

const WAKE_EMOJI = { breast: '🤱', bottle: '🍼', comfort: '🤗', diaper: '🧷', other: '➕' };

function renderWakes() {
  const recent = wakes.list().slice(0, 6);
  $('wakes-section').hidden = recent.length === 0;
  const list = $('wakes');
  list.replaceChildren();
  for (const wake of recent) {
    const li = document.createElement('li');
    const text = document.createElement('div');
    text.className = 'ev-text';
    const when = new Date(wake.at);
    text.textContent = `${WAKE_EMOJI[wake.reason]} ${NIGHT_WAKE_REASONS[wake.reason]} · ${dayLabel(when)} ${clock(when)}`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'ev-del';
    del.setAttribute('aria-label', 'Nachtwache löschen');
    del.textContent = '✕';
    del.addEventListener('click', () => {
      if (window.confirm('Eintrag löschen?')) {
        wakes.removeWake(wake.id);
        render();
      }
    });
    li.append(text, del);
    list.append(li);
  }
}

function renderHistory() {
  const list = $('history');
  list.replaceChildren();
  const { from, to } = viewWindow(new Date());
  const inWeek = store.list().filter((e) => {
    const t = new Date(e.startedAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
  for (const entry of inWeek) {
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
  const hour = now.getHours();
  document.documentElement.dataset.theme = hour >= 19 || hour < 7 ? 'night' : 'day';
  renderStatus(now);
  renderWeekNav(now);
  renderReport(now);
  renderCharts(now);
  renderEvents();
  renderWakes();
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
$('edit-delete').addEventListener('click', () => {
  if (!window.confirm('Diesen Eintrag endgültig löschen?')) return;
  store.removeEntry(editing.id);
  $('edit').close();
  render();
});
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

let pendingType = null;
for (const [type, label] of Object.entries(EVENT_TYPES)) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = `${EVENT_EMOJI[type]} ${label}`;
  chip.addEventListener('click', () => {
    pendingType = type;
    $('event-title').textContent = `${EVENT_EMOJI[type]} ${label}`;
    $('event-when').value = toInputValue(new Date());
    $('event-note').value = '';
    $('event-dialog').showModal();
  });
  $('event-chips').append(chip);
}
$('event-cancel').addEventListener('click', () => $('event-dialog').close());
$('event-form').addEventListener('submit', (event) => {
  event.preventDefault();
  events.addEvent(pendingType, new Date($('event-when').value), $('event-note').value.trim() || null);
  $('event-dialog').close();
  render();
});

for (const [reason, label] of Object.entries(NIGHT_WAKE_REASONS)) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = `${WAKE_EMOJI[reason]} ${label}`;
  chip.addEventListener('click', () => {
    wakes.addWake(new Date(), reason);
    $('wake-dialog').close();
    render();
  });
  $('wake-reasons').append(chip);
}
$('wake-btn').addEventListener('click', () => $('wake-dialog').showModal());
$('wake-cancel').addEventListener('click', () => $('wake-dialog').close());

$('backup-export').addEventListener('click', () => {
  const blob = new Blob([exportBackup(window.localStorage)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rosleeper-sicherung-${toInputValue(new Date()).slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('backup-msg').textContent = 'Sicherung erstellt.';
});
$('backup-import').addEventListener('click', () => $('backup-file').click());
$('backup-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!window.confirm('Alle vorhandenen Daten auf diesem Gerät werden durch die Sicherung ersetzt. Fortfahren?')) return;
  try {
    importBackup(window.localStorage, await file.text());
    $('backup-msg').textContent = 'Sicherung geladen.';
    render();
  } catch (error) {
    $('backup-msg').textContent = error.message;
  }
});

$('week-prev').addEventListener('click', () => {
  weekOffset += 1;
  render();
});
$('week-next').addEventListener('click', () => {
  weekOffset = Math.max(0, weekOffset - 1);
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
