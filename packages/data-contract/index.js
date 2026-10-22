export const STORAGE_KEY = 'local-mood-journal.data.v1';
// MAX_BYTES remains the v1 compact storage budget for existing consumers.
export const MAX_BYTES = 1024 * 1024;
// Keep all previously legal stores recoverable, including the pretty v1 envelope.
export const MAX_BACKUP_BYTES = 2 * MAX_BYTES;
export const TAG_IDS = ['work', 'relationships', 'partner', 'sleep', 'body', 'daily', 'alone', 'achievement'];
export const MAX_ENTRIES = 5000;
export const cloneData = value => JSON.parse(JSON.stringify(value));
const copy = cloneData;
export const emptyData = () => ({ version: 1, entries: [], careCount: 0 });

export class JournalError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new JournalError(code); };
function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail('invalidBackup');
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}
export function validateData(value) {
  exactKeys(value, ['version', 'entries', 'careCount']);
  if (value.version !== 1) fail('unsupportedVersion');
  if (!Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES ||
      !Number.isSafeInteger(value.careCount) || value.careCount < 0) fail('invalidBackup');
  const ids = new Set();
  for (const entry of value.entries) {
    exactKeys(entry, ['id', 'mood', 'tags', 'text', 'date']);
    if (typeof entry.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(entry.id) ||
        !Number.isInteger(entry.mood) || entry.mood < 0 || entry.mood > 4 ||
        typeof entry.text !== 'string' || entry.text.length > 2000 || !validDate(entry.date) ||
        !Array.isArray(entry.tags) || entry.tags.length > TAG_IDS.length ||
        entry.tags.some(tag => !TAG_IDS.includes(tag)) || new Set(entry.tags).size !== entry.tags.length) fail('invalidBackup');
    if (ids.has(entry.id)) fail('duplicateId');
    ids.add(entry.id);
  }
  if (utf8ByteLength(JSON.stringify(value)) > MAX_BYTES) fail('fileTooLarge');
  return copy(value);
}
function parseJSON(text) {
  if (typeof text !== 'string' || utf8ByteLength(text) > MAX_BACKUP_BYTES) fail('fileTooLarge');
  try { return JSON.parse(text); } catch { fail('invalidBackup'); }
}
export function parseBackup(text) {
  const backup = parseJSON(text);
  exactKeys(backup, ['schema', 'version', 'exportedAt', 'data']);
  if (backup.schema !== 'local-mood-journal') fail('invalidBackup');
  if (backup.version !== 1) fail('unsupportedVersion');
  if (!validDate(backup.exportedAt)) fail('invalidBackup');
  return validateData(backup.data);
}
export function makeBackup(data, now = new Date()) {
  const text = JSON.stringify({ schema: 'local-mood-journal', version: 1,
    exportedAt: now.toISOString(), data: validateData(data) }, null, 2);
  if (utf8ByteLength(text) > MAX_BACKUP_BYTES) fail('fileTooLarge');
  return text;
}
function equivalent(a, b) {
  return a.id === b.id && a.mood === b.mood && a.text === b.text && a.date === b.date &&
    [...a.tags].sort().join('|') === [...b.tags].sort().join('|');
}
export function mergeData(current, incoming) {
  current = validateData(current); incoming = validateData(incoming);
  const byId = new Map(current.entries.map(entry => [entry.id, entry]));
  for (const entry of incoming.entries) {
    if (byId.has(entry.id) && !equivalent(byId.get(entry.id), entry)) fail('idConflict');
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return validateData({ version: 1,
    entries: [...byId.values()].sort((a, b) => a.date.localeCompare(b.date)),
    careCount: Math.max(current.careCount, incoming.careCount) });
}


// Portable UTF-8 size, including replacement encoding for unpaired surrogates.
export function utf8ByteLength(text) {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}
export const CONTRACT = Object.freeze({ schema: 'local-mood-journal', version: 1,
  storageKey: STORAGE_KEY, moodCount: 5, maxTextLength: 2000, maxEntries: MAX_ENTRIES, maxBytes: MAX_BYTES, maxBackupBytes: MAX_BACKUP_BYTES });

export const DRAFT_KEY = 'local-mood-journal.draft.v1';
// Drafts are a separate, optional platform feature; they never enter a v1 backup.
export function validateDraft(value) {
  exactKeys(value, ['version', 'mood', 'tags', 'text', 'updatedAt']);
  if (value.version !== 1) fail('unsupportedVersion');
  validateData({ version: 1, careCount: 0, entries: [{ id: 'draft-validation',
    mood: value.mood === null ? 0 : value.mood, tags: value.tags, text: value.text, date: value.updatedAt }] });
  return cloneData(value);
}
