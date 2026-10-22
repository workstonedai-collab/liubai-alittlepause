import { STORAGE_KEY, MAX_BYTES, JournalError, validateData, mergeData, makeBackup,
  cloneData, emptyData, utf8ByteLength } from '../data-contract/index.js';
const fail = code => { throw new JournalError(code); };
function parseJSON(text) {
  if (typeof text !== 'string' || utf8ByteLength(text) > MAX_BYTES) fail('fileTooLarge');
  try { return JSON.parse(text); } catch { fail('invalidBackup'); }
}
export class JournalStore {
  constructor(storage, key = STORAGE_KEY) {
    this.storage = storage; this.key = key; this.state = emptyData(); this.status = 'unreadable';
    this.raw = undefined; this.load();
  }
  load() {
    // A failed read must never create a writable empty state.
    this.status = 'unreadable'; this.raw = undefined;
    try { this.raw = this.storage.getItem(this.key); } catch { return this.status; }
    try {
      this.state = this.raw === null ? emptyData() : validateData(parseJSON(this.raw));
      this.status = 'ready';
    } catch { this.status = 'corrupt'; }
    return this.status;
  }
  snapshot() { return cloneData(this.state); }
  requireReady() { if (this.status !== 'ready') fail('storageLocked'); }
  commit(next) {
    const data = validateData(next), serialized = JSON.stringify(data);
    if (utf8ByteLength(serialized) > MAX_BYTES) fail('fileTooLarge');
    let latest;
    try { latest = this.storage.getItem(this.key); } catch { this.status = 'unreadable'; fail('storageLocked'); }
    if (latest !== this.raw) { this.load(); fail('storageChanged'); }
    try { this.storage.setItem(this.key, serialized); } catch { fail('writeFailed'); }
    this.state = data; this.raw = serialized; this.status = 'ready';
    return this.snapshot();
  }
  add(entry) { this.requireReady(); return this.commit({ ...this.state, entries: [...this.state.entries, entry] }); }
  update(entry, original) {
    this.requireReady();
    const current = this.state.entries.find(row => row.id === entry.id);
    if (!current || !original || original.id !== entry.id || JSON.stringify(current) !== JSON.stringify(original)) fail('storageChanged');
    // Preserve the entry identity/date; a stale editor never overwrites newer data.
    if (entry.date !== original.date) fail('invalidBackup');
    return this.commit({ ...this.state, entries: this.state.entries.map(row => row.id === entry.id ? entry : row) });
  }
  remove(id) { this.requireReady(); return this.commit({ ...this.state, entries: this.state.entries.filter(e => e.id !== id) }); }
  completeCare() { this.requireReady(); return this.commit({ ...this.state, careCount: this.state.careCount + 1 }); }
  merge(incoming) { this.requireReady(); return this.commit(mergeData(this.state, incoming)); }
  replace(incoming, { confirmed = false, backupAcknowledged = false } = {}) {
    // Unknown old data cannot safely be replaced, even with a generic confirmation.
    if (this.status === 'unreadable') fail('storageLocked');
    if (!confirmed || !backupAcknowledged) fail('confirmReplacement');
    return this.commit(validateData(incoming));
  }
  backup() { this.requireReady(); return makeBackup(this.state); }
  rawBackup() {
    if (typeof this.raw !== 'string') fail('storageLocked');
    return this.raw;
  }
}
