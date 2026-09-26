const MINUTE = 60_000;

const isNight = (start) => start.getHours() >= 18 || start.getHours() < 6;

const isSameLocalDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function summarizeDay(entries, day) {
  const summary = { totalMinutes: 0, napCount: 0, napMinutes: 0, nightMinutes: 0 };
  for (const e of entries) {
    if (e.endedAt === null) continue;
    const start = new Date(e.startedAt);
    if (!isSameLocalDay(start, day)) continue;
    const minutes = Math.round((new Date(e.endedAt) - start) / MINUTE);
    summary.totalMinutes += minutes;
    if (isNight(start)) {
      summary.nightMinutes += minutes;
    } else {
      summary.napCount += 1;
      summary.napMinutes += minutes;
    }
  }
  return summary;
}

const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function summarizeDays(entries, lastDay, count) {
  const days = [];
  for (let back = count - 1; back >= 0; back--) {
    const day = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - back, 12);
    days.push({ date: isoDate(day), ...summarizeDay(entries, day) });
  }
  return days;
}
