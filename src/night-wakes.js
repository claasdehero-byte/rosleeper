export const WAKE_KEY = 'rosleeper.nightWakes';

export const NIGHT_WAKE_REASONS = {
  breast: 'Stillen',
  bottle: 'Flasche',
  comfort: 'Trösten',
  diaper: 'Windel',
  other: 'Sonstiges',
};

export function createNightWakeStore(storage) {
  const load = () => {
    try {
      const wakes = JSON.parse(storage.getItem(WAKE_KEY) ?? '[]');
      return Array.isArray(wakes) ? wakes : [];
    } catch {
      return [];
    }
  };
  const save = (wakes) => storage.setItem(WAKE_KEY, JSON.stringify(wakes));

  return {
    addWake(at, reason) {
      if (!(reason in NIGHT_WAKE_REASONS)) {
        throw new Error(`Unbekannter Grund: ${reason}`);
      }
      const wake = { id: crypto.randomUUID(), at: at.toISOString(), reason };
      save([...load(), wake]);
      return wake;
    },
    removeWake(id) {
      save(load().filter((w) => w.id !== id));
    },
    list() {
      return load().sort((a, b) => b.at.localeCompare(a.at));
    },
  };
}
