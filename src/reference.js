// AAP/AASM-Konsens (Paruthi et al., 2016), Stunden pro 24 h inkl. Naps.
// Für Säuglinge unter 4 Monaten gibt es keine Empfehlung. Die Bänder "4–12 Monate" und "1–2 Jahre"
// überlappen bei 12 Monaten; hier in vollendeten Monaten gelesen: 4–11, 12–35, 36–71.
const BANDS = [
  { fromMonth: 4, toMonth: 11, minHours: 12, maxHours: 16 },
  { fromMonth: 12, toMonth: 35, minHours: 11, maxHours: 14 },
  { fromMonth: 36, toMonth: 71, minHours: 10, maxHours: 13 },
];

export function referenceSleepRange(ageMonths) {
  const band = BANDS.find((b) => ageMonths >= b.fromMonth && ageMonths <= b.toMonth);
  return band ? { minHours: band.minHours, maxHours: band.maxHours } : null;
}

export function assessTotalSleep(avgTotalMinutes, ageMonths) {
  const range = referenceSleepRange(ageMonths);
  if (range === null) return { status: 'none', range: null };
  const status =
    avgTotalMinutes < range.minHours * 60 ? 'below' : avgTotalMinutes > range.maxHours * 60 ? 'above' : 'within';
  return { status, range };
}
