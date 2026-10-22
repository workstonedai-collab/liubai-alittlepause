import { JournalStore } from './journal.js';
import { STORAGE_KEY, JournalError } from '../data-contract/index.js';

const memory = initial => {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
};
const fail = code => { throw new JournalError(code); };

// Promise-based ports store one JSON string, or return null for a missing key.
// Mutations are serialized per instance; external writers still need coordination.
export class AsyncJournalStore {
  constructor(port, key = STORAGE_KEY) {
    this.port = port; this.key = key; this.queue = Promise.resolve();
    this.core = new JournalStore(memory(null), key);
    this.core.status = 'unreadable'; this.core.raw = undefined;
  }
  get status() { return this.core.status; }
  snapshot() { return this.core.snapshot(); }
  serialize(task) {
    const result = this.queue.then(task);
    this.queue = result.catch(() => {});
    return result;
  }
  load() {
    return this.serialize(async () => {
      try { this.core = new JournalStore(memory(await this.port.getItem(this.key)), this.key); }
      catch { this.core.status = 'unreadable'; this.core.raw = undefined; }
      return this.status;
    });
  }
  mutate(action) {
    return this.serialize(async () => {
      if (this.status === 'unreadable') fail('storageLocked');
      let latest;
      try { latest = await this.port.getItem(this.key); }
      catch { this.core.status = 'unreadable'; this.core.raw = undefined; fail('storageLocked'); }
      if (latest !== this.core.raw) {
        this.core = new JournalStore(memory(latest), this.key);
        fail('storageChanged');
      }
      const draft = new JournalStore(memory(latest), this.key);
      action(draft);
      try { await this.port.setItem(this.key, draft.raw); }
      catch { fail('writeFailed'); }
      this.core = draft;
      return this.snapshot();
    });
  }
  add(entry) { return this.mutate(draft => draft.add(entry)); }
  remove(id) { return this.mutate(draft => draft.remove(id)); }
  completeCare() { return this.mutate(draft => draft.completeCare()); }
  merge(data) { return this.mutate(draft => draft.merge(data)); }
  replace(data, confirmation) { return this.mutate(draft => draft.replace(data, confirmation)); }
  backup() { return this.core.backup(); }
  rawBackup() { return this.core.rawBackup(); }
}
