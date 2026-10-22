import { JournalError, validateDraft, validateData } from '../../packages/data-contract/index.js';

export const WEB_DRAFT_KEY = 'local-mood-journal.web-draft.v1';
const fail = code => { throw new JournalError(code); };
const copy = value => structuredClone(value);

// One local value contains both the draft and its retry identity. A confirmed
// journal save can therefore be retried after failed cleanup without duplicates.
export class WebJournalDraft {
  constructor(storage, { id = () => crypto.randomUUID(), now = () => new Date().toISOString() } = {}) {
    this.storage = storage; this.id = id; this.now = now; this.load();
  }
  load() {
    this.raw = undefined; this.value = null; this.status = 'unreadable';
    try { this.raw = this.storage.getItem(WEB_DRAFT_KEY); } catch { return; }
    try {
      const value = this.raw === null ? null : JSON.parse(this.raw);
      if (value !== null) {
        if (!value || Object.keys(value).sort().join() !== 'date,draft,id,version' || value.version !== 1) fail('draftInvalid');
        value.draft = validateDraft(value.draft);
        validateData({ version: 1, careCount: 0, entries: [{ id: value.id, date: value.date,
          mood: value.draft.mood ?? 0, tags: value.draft.tags, text: value.draft.text }] });
      }
      this.value = value; this.status = 'ready';
    } catch { this.status = 'corrupt'; }
  }
  snapshot() { return copy(this.value?.draft ?? null); }
  commit(value) {
    if (this.status !== 'ready') fail('draftInvalid');
    let latest;
    try { latest = this.storage.getItem(WEB_DRAFT_KEY); } catch { fail('storageLocked'); }
    if (latest !== this.raw) fail('storageChanged');
    const serialized = JSON.stringify(value);
    try { this.storage.setItem(WEB_DRAFT_KEY, serialized); } catch { fail('writeFailed'); }
    this.raw = serialized; this.value = copy(value);
  }
  update(draft) {
    const checked = validateDraft(draft);
    // Editing a saved-but-not-cleared draft creates a new identity, while an
    // unchanged retry keeps the exact entry ID and timestamp.
    const changed = this.value && JSON.stringify(this.value.draft) !== JSON.stringify(checked);
    this.commit({ version: 1, id: !this.value || changed ? this.id() : this.value.id,
      date: !this.value || changed ? this.now() : this.value.date, draft: checked });
  }
  setRecordDate(date) {
    if(!this.value)fail('draftInvalid');
    validateData({version:1,careCount:0,entries:[{id:this.value.id,date,mood:this.value.draft.mood??0,tags:this.value.draft.tags,text:this.value.draft.text}]});
    if(this.value.date!==date)this.commit({...this.value,id:this.id(),date});
  }
  clear() { this.commit(null); }
  save(store) {
    if (!this.value || this.value.draft.mood === null) fail('chooseMood');
    // Check draft ownership before touching the journal, including stale tabs.
    this.commit(this.value);
    const { id, date, draft } = this.value;
    store.merge({ version: 1, careCount: store.snapshot().careCount,
      entries: [{ id, date, mood: draft.mood, tags: draft.tags, text: draft.text.trim() }] });
    try { this.commit(null); return { retained: false }; }
    catch { return { retained: true }; }
  }
  discardCorrupt() {
    if (this.status !== 'corrupt') fail('draftInvalid');
    // Explicit recovery still refuses to erase a draft changed in another tab.
    let latest;
    try { latest = this.storage.getItem(WEB_DRAFT_KEY); } catch { fail('storageLocked'); }
    if (latest !== this.raw) fail('storageChanged');
    try { this.storage.setItem(WEB_DRAFT_KEY, 'null'); } catch { fail('writeFailed'); }
    this.load();
  }
}
