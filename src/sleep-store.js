export const SLEEP_KEY = 'rosleeper.sleepEntries';

export function createSleepStore(storage) {
  const load = () => {
    try {
      const entries = JSON.parse(storage.getItem(SLEEP_KEY) ?? '[]');
      return Array.isArray(entries) ? entries : [];
    } catch {
      return [];
    }
  };
  const save = (entries) => storage.setItem(SLEEP_KEY, JSON.stringify(entries));

  return {
    startSleep(now) {
      const entries = load();
      if (entries.some((e) => e.endedAt === null)) {
        throw new Error('Es läuft bereits ein Schlaf');
      }
      const entry = {
        id: `${now.getTime()}`,
        startedAt: now.toISOString(),
        endedAt: null,
        note: null,
      };
      save([...entries, entry]);
      return entry;
    },
    endSleep(now) {
      const laufend = load().find((e) => e.endedAt === null);
      if (!laufend) {
        throw new Error('Es ist kein laufender Schlaf vorhanden');
      }
      if (now < new Date(laufend.startedAt)) {
        throw new Error('Das Ende liegt vor dem Start');
      }
      save(load().map((e) => (e === laufend || e.id === laufend.id ? { ...e, endedAt: now.toISOString() } : e)));
    },
    correctEntry(id, { startedAt, endedAt }) {
      if (endedAt !== null && endedAt < startedAt) {
        throw new Error('Das Ende liegt vor dem Start');
      }
      save(
        load().map((e) =>
          e.id === id
            ? {
                ...e,
                startedAt: startedAt.toISOString(),
                endedAt: endedAt === null ? null : endedAt.toISOString(),
              }
            : e,
        ),
      );
    },
    list() {
      return load().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },
    current() {
      return load().find((e) => e.endedAt === null) ?? null;
    },
  };
}
