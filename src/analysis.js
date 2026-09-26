import { isNight, summarizeDays } from './history.js';
import { ageInMonths, wakeWindowForAge } from './wake-window.js';

const MINUTE = 60_000;
const MAX_WAKE_GAP_MINUTES = 360; // längere Lücken: vermutlich vergessen einzutragen

function wakePhasesWithNext(entries) {
  const sleeps = [...entries].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const phases = [];
  for (let i = 0; i + 1 < sleeps.length; i++) {
    if (sleeps[i].endedAt === null) continue;
    const minutes = Math.round((new Date(sleeps[i + 1].startedAt) - new Date(sleeps[i].endedAt)) / MINUTE);
    if (minutes > 0 && minutes <= MAX_WAKE_GAP_MINUTES) {
      phases.push({ start: sleeps[i].endedAt, minutes, nextStart: sleeps[i + 1].startedAt });
    }
  }
  return phases;
}

export function wakePhases(entries) {
  return wakePhasesWithNext(entries).map(({ start, minutes, nextStart }) => ({
    start,
    minutes,
    beforeNight: isNight(new Date(nextStart)),
  }));
}

export function sleepPhases(entries) {
  return entries
    .filter((e) => e.endedAt !== null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((e) => ({
      start: e.startedAt,
      minutes: Math.round((new Date(e.endedAt) - new Date(e.startedAt)) / MINUTE),
      kind: isNight(new Date(e.startedAt)) ? 'night' : 'nap',
    }));
}

const mean = (values, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * factor) / factor;
};

export function weeklyReport(entries, { now, days, birthDate }) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() - days);
  const yesterday = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() - 1, 12);

  const counted = summarizeDays(entries, yesterday, days).filter((d) => d.totalMinutes > 0);
  const nights = counted.filter((d) => d.nightMinutes > 0);
  const phases = wakePhasesWithNext(entries).filter((p) => {
    const start = new Date(p.start);
    return start >= windowStart && start < todayStart;
  });
  const beforeNap = phases.filter((p) => !isNight(new Date(p.nextStart)));
  const inWindow = beforeNap.filter((p) => {
    const { minMinutes, maxMinutes } = wakeWindowForAge(ageInMonths(birthDate, new Date(p.start)));
    return p.minutes >= minMinutes && p.minutes <= maxMinutes;
  });

  return {
    daysCounted: counted.length,
    avgTotalMinutes: counted.length ? mean(counted.map((d) => d.totalMinutes)) : null,
    avgNaps: counted.length ? mean(counted.map((d) => d.napCount), 1) : null,
    avgNightMinutes: nights.length ? mean(nights.map((d) => d.nightMinutes)) : null,
    avgWakeMinutes: phases.length ? mean(phases.map((p) => p.minutes)) : null,
    napWakeInWindowShare: beforeNap.length ? mean([inWindow.length / beforeNap.length], 2) : null,
  };
}

const FEED_REASONS = ['breast', 'bottle'];

export function nightReport(entries, wakes, { now, days }) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() - days);

  const nights = entries
    .filter((e) => e.endedAt !== null)
    .map((e) => ({ start: new Date(e.startedAt), end: new Date(e.endedAt) }))
    .filter((n) => isNight(n.start) && n.start >= windowStart && n.start < todayStart)
    .map((n) => {
      const inNight = wakes.filter((w) => new Date(w.at) > n.start && new Date(w.at) < n.end);
      const points = [n.start, ...inNight.map((w) => new Date(w.at)).sort((a, b) => a - b), n.end];
      const stretches = points.slice(1).map((p, i) => Math.round((p - points[i]) / MINUTE));
      return {
        wakes: inNight.length,
        feeds: inNight.filter((w) => FEED_REASONS.includes(w.reason)).length,
        longest: Math.max(...stretches),
      };
    });

  if (nights.length === 0) {
    return { nightsCounted: 0, avgWakes: null, avgLongestStretchMinutes: null, avgFeeds: null };
  }
  return {
    nightsCounted: nights.length,
    avgWakes: mean(nights.map((n) => n.wakes), 1),
    avgLongestStretchMinutes: mean(nights.map((n) => n.longest)),
    avgFeeds: mean(nights.map((n) => n.feeds), 1),
  };
}
