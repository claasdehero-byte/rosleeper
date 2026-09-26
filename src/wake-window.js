export function ageInMonths(birthDate, now) {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  let months = (now.getFullYear() - by) * 12 + (now.getMonth() + 1 - bm);
  if (now.getDate() < bd) months -= 1;
  return months;
}

// Erfahrungswerte, keine belegten Leitlinien: siehe docs/richtwerte.md
const WAKE_WINDOW_BANDS = [
  { fromMonth: 0, minMinutes: 35, maxMinutes: 90 },
  { fromMonth: 2, minMinutes: 60, maxMinutes: 90 },
  { fromMonth: 3, minMinutes: 75, maxMinutes: 120 },
  { fromMonth: 4, minMinutes: 90, maxMinutes: 135 },
  { fromMonth: 5, minMinutes: 120, maxMinutes: 150 },
  { fromMonth: 6, minMinutes: 120, maxMinutes: 180 },
  { fromMonth: 7, minMinutes: 150, maxMinutes: 195 },
  { fromMonth: 10, minMinutes: 180, maxMinutes: 240 },
];

export function wakeWindowForAge(months) {
  const band = [...WAKE_WINDOW_BANDS].reverse().find((b) => months >= b.fromMonth);
  return { minMinutes: band.minMinutes, maxMinutes: band.maxMinutes };
}

const MINUTE = 60_000;

export function wakeStatus({ lastSleepEnd, ageMonths, now }) {
  if (lastSleepEnd === null) {
    return { phase: 'unknown', awakeMinutes: null, sleepFrom: null, sleepBy: null };
  }
  const { minMinutes, maxMinutes } = wakeWindowForAge(ageMonths);
  const awakeMinutes = Math.floor((now - lastSleepEnd) / MINUTE);
  const phase =
    awakeMinutes < minMinutes ? 'early' : awakeMinutes <= maxMinutes ? 'in_window' : 'overdue';
  return {
    phase,
    awakeMinutes,
    sleepFrom: new Date(lastSleepEnd.getTime() + minMinutes * MINUTE),
    sleepBy: new Date(lastSleepEnd.getTime() + maxMinutes * MINUTE),
  };
}
