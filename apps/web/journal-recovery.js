import { JournalError, validateData, utf8ByteLength, MAX_BYTES } from '../../packages/data-contract/index.js';

export const RECOVERY_DAYS = 30;
export const RECOVERY_LIMIT = 100;
const fail = code => { throw new JournalError(code); };
const canonical = entry => JSON.stringify([entry.id, entry.mood, [...entry.tags].sort(), entry.text, entry.date]);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
function validate(value) {
  if (!value || Object.keys(value).sort().join() !== 'items,version' || value.version !== 1 || !Array.isArray(value.items)) fail('recoveryLocked');
  if (value.items.length > RECOVERY_LIMIT) fail('recoveryCapacity');
  for (const row of value.items) if (!row || Object.keys(row).sort().join() !== 'deletedAt,entry' || !validDate(row.deletedAt)) fail('recoveryLocked');
  try { validateData({ version: 1, entries: value.items.map(row => row.entry), careCount: 0 }); }
  catch (error) { if (error.code === 'fileTooLarge') fail('recoveryCapacity'); throw error; }
  if (utf8ByteLength(JSON.stringify(value)) > MAX_BYTES) fail('recoveryCapacity');
  return structuredClone(value);
}

// Write a recovery copy before changing the original v1 journal. A failed
// journal write can leave a redundant copy, but can never lose the entry.
// This sidecar is local, account-key scoped, and excluded from cloud sync.
export class WebJournalRecovery {
  constructor(storage, journal, { now = () => new Date().toISOString() } = {}) {
    this.storage = storage; this.journal = journal; this.now = now;
    this.key = journal.key + '.recovery.v1'; this.load();
  }
  load() {
    this.status = 'unreadable'; this.raw = undefined; this.value = { version: 1, items: [] };
    try { this.raw = this.storage.getItem(this.key); } catch { return; }
    try {
      if (this.raw !== null && utf8ByteLength(this.raw) > MAX_BYTES) fail('recoveryCapacity');
      this.value = this.raw === null ? this.value : validate(JSON.parse(this.raw)); this.status = 'ready';
    } catch { this.status = 'corrupt'; }
  }
  unexpired(row) { return Date.parse(row.deletedAt) > Date.parse(this.now()) - RECOVERY_DAYS * 86400000; }
  items() {
    if (this.status !== 'ready') fail('recoveryLocked');
    this.journal.requireReady();
    const active = new Map(this.journal.snapshot().entries.map(entry => [entry.id, entry]));
    return structuredClone(this.value.items.filter(row => this.unexpired(row) &&
      (!active.has(row.entry.id) || canonical(active.get(row.entry.id)) !== canonical(row.entry)))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)));
  }
  commit(value) {
    if (this.status !== 'ready') fail('recoveryLocked');
    const checked = validate(value), serialized = JSON.stringify(checked);
    let latest;
    try { latest = this.storage.getItem(this.key); } catch { fail('recoveryLocked'); }
    if (latest !== this.raw) { this.load(); fail('storageChanged'); }
    try { this.storage.setItem(this.key, serialized); } catch { fail('writeFailed'); }
    this.value = checked; this.raw = serialized;
  }
  remove(id) {
    this.journal.requireReady(); this.load();
    if (this.status !== 'ready') fail('recoveryLocked');
    const entry = this.journal.snapshot().entries.find(row => row.id === id);
    if (!entry) fail('storageChanged');
    this.commit({ version: 1, items: [...this.value.items.filter(row => this.unexpired(row) && row.entry.id !== id),
      { entry, deletedAt: this.now() }] });
    return this.journal.remove(id);
  }
  restore(id) {
    this.load();
    const row = this.items().find(row => row.entry.id === id);
    if (!row) fail('recoveryMissing');
    const conflict = this.journal.snapshot().entries.some(entry => entry.id === id);
    // Stable retry identity also covers a successful copy whose cleanup failed.
    const entry = { ...row.entry, id: conflict ? `${id.slice(0, 100)}-recovered-${Date.parse(row.deletedAt).toString(36)}` : id };
    this.journal.merge({ version: 1, entries: [entry], careCount: this.journal.snapshot().careCount });
    // Restore is already durable. If cleanup fails, an identical original is
    // hidden and the retained copy can be explicitly removed on the next visit.
    try { this.purge(id); return { copied: conflict, retained: false }; }
    catch { return { copied: conflict, retained: true }; }
  }
  purge(id) {
    this.commit({ version: 1, items: this.value.items.filter(row => row.entry.id !== id) });
  }
  exportText() {
    if (typeof this.raw !== 'string') fail('recoveryLocked');
    return this.raw;
  }
}
