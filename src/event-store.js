export const EVENT_KEY = 'rosleeper.events';

export const EVENT_TYPES = {
  sick: 'Krank / Fieber',
  vaccination: 'Impfung',
  teething: 'Zähne',
  tummy: 'Durchfall / Bauchweh',
};

export function createEventStore(storage) {
  const load = () => {
    try {
      const events = JSON.parse(storage.getItem(EVENT_KEY) ?? '[]');
      return Array.isArray(events) ? events : [];
    } catch {
      return [];
    }
  };
  const save = (events) => storage.setItem(EVENT_KEY, JSON.stringify(events));

  return {
    addEvent(type, at, note = null) {
      if (!(type in EVENT_TYPES)) {
        throw new Error(`Unbekannte Ereignis-Art: ${type}`);
      }
      const event = { id: crypto.randomUUID(), type, at: at.toISOString(), note };
      save([...load(), event]);
      return event;
    },
    removeEvent(id) {
      save(load().filter((e) => e.id !== id));
    },
    list() {
      return load().sort((a, b) => b.at.localeCompare(a.at));
    },
  };
}
