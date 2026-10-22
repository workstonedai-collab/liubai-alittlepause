import { readMode } from './experience.js';
import { scopedName } from './account-scope.js';
import { validateMedia, checkMediaCapacity, mediaError, mediaSignature, validMediaDate, validAudioType, MEDIA_LIMITS } from './media-contract.js';

export const MEDIA_DB = 'liubai-local-media-v1';
const fail = code => { throw mediaError(code); };
const copy = value => structuredClone(value);
function sessionValid(s) {
  if (!s || !/^[a-zA-Z0-9_-]{1,128}$/.test(s.id) || !validMediaDate(s.date) || !validMediaDate(s.updatedAt) || !['recording','stopped'].includes(s.status) ||
    !validAudioType(s.mimeType) || !Array.isArray(s.chunks) || s.chunks.length > 2000 || typeof s.title !== 'string' || s.title.length > 120 ||
    typeof s.note !== 'string' || s.note.length > 2000 || !Number.isFinite(s.durationMs) || s.durationMs < 0 || s.durationMs > MEDIA_LIMITS.audioMs ||
    s.chunks.some(b => !(b instanceof Blob) || b.type !== s.mimeType) || s.bytes !== s.chunks.reduce((n, b) => n + b.size, 0) || s.bytes > MEDIA_LIMITS.audioBytes) fail('mediaReadFailed');
}
export function createMediaStore({ indexedDB = globalThis.indexedDB, notify = () => {} } = {}) {
  const databaseName = scopedName(MEDIA_DB);
  const boundary=readMode()==='care';
  let database = null, opening = null, readable = false;
  const names = ['entries','sessions','drafts'];
  async function open() {
    if (database) return database;
    if (!opening) opening = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(mediaError('mediaUnsupported')); return; }
      let settled = false, request;
      const finish = (error, db) => { if (settled) { db?.close(); return; } settled = true; clearTimeout(timer); error ? reject(error) : resolve(db); };
      const timer = setTimeout(() => finish(mediaError('mediaReadFailed')), 5000);
      try { request = indexedDB.open(databaseName, 1); } catch { finish(mediaError('mediaReadFailed')); return; }
      request.onupgradeneeded = () => { for (const name of names) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' }); };
      request.onerror = request.onblocked = () => finish(mediaError('mediaReadFailed'));
      request.onsuccess = () => {
        const db = request.result; if (settled) { db.close(); return; }
        database = db; db.onversionchange = () => { db.close(); database = null; readable = false; }; finish(null, db);
      };
    }).finally(() => { opening = null; });
    return opening;
  }
  function validateAll(rows) {
    rows.entries.forEach(r => validateMedia(r)); rows.sessions.forEach(sessionValid);
    rows.drafts.forEach(d => { if (!d || typeof d.id !== 'string' || typeof d.token !== 'string' || d.row.kind !== 'scrapbook') fail('mediaReadFailed'); validateMedia(d.row); });
    checkMediaCapacity(rows.entries, rows.sessions, rows.drafts);
  }
  async function transaction(write, mutate) {
    if(write&&boundary!==(readMode()==='care'))fail('mediaChanged');
    if (write && !readable) fail('mediaReadFailed');
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, write ? 'readwrite' : 'readonly'), rows = {}, stores = {}; let remaining = names.length, result, failure;
      for (const name of names) {
        stores[name] = tx.objectStore(name); const request = stores[name].getAll();
        request.onsuccess = () => {
          rows[name] = request.result;
          if (--remaining === 0) try { validateAll(rows); result = mutate(stores, rows); } catch (error) { failure = error; tx.abort(); }
        };
      }
      tx.oncomplete = () => { readable = true; if (write) try { notify(); } catch {} resolve(copy(result)); };
      tx.onerror = tx.onabort = () => { if (!write) readable = false; reject(mediaError(typeof failure?.code === 'string' ? failure.code : (write ? 'mediaWriteFailed' : 'mediaReadFailed'))); };
    });
  }
  const read = () => transaction(false, (_s, rows) => rows);
  const save = (row, { expectedRevision = 0, draftId = null, draftToken = null, sessionId = null } = {}) => transaction(true, (s, rows) => {
    const existing = rows.entries.find(r => r.id === row.id);
    if ((existing?.revision || 0) !== expectedRevision || existing?.deletedAt || (existing && (existing.kind !== row.kind || existing.date !== row.date))) fail('mediaChanged');
    const draft = draftId && rows.drafts.find(d => d.id === draftId);
    if (draftId && (!draft || draft.token !== draftToken)) fail('mediaChanged');
    const session = sessionId && rows.sessions.find(r => r.id === sessionId);
    if (sessionId && (!session || session.status !== 'stopped' || row.audio?.size !== session.bytes || row.id !== session.id)) fail('mediaChanged');
    const next = validateMedia({ ...row, revision: expectedRevision + 1, updatedAt: new Date().toISOString(), deletedAt: null });
    checkMediaCapacity([...rows.entries.filter(r => r.id !== row.id), next], rows.sessions.filter(r => r.id !== sessionId), rows.drafts.filter(d => d.id !== draftId));
    s.entries.put(next); if (draftId) s.drafts.delete(draftId); if (sessionId) s.sessions.delete(sessionId); return next;
  });
  const change = (id, revision, kind) => transaction(true, (s, rows) => {
    const row = rows.entries.find(r => r.id === id); if (!row || row.revision !== revision) fail('mediaChanged');
    if (kind === 'restore' && row.deletedAt && Date.now() - Date.parse(row.deletedAt) >= 30 * 86400000) fail('mediaChanged');
    if (kind === 'purge') { if (!row.deletedAt) fail('mediaChanged'); s.entries.delete(id); return; }
    s.entries.put({ ...row, deletedAt: kind === 'remove' ? new Date().toISOString() : null, revision: row.revision + 1, updatedAt: new Date().toISOString() });
  });
  return { read, save,
    saveDraft(id, row, expectedToken = null) { return transaction(true, (s, rows) => {
      validateMedia(row); const old = rows.drafts.find(d => d.id === id);
      if ((old?.token || null) !== expectedToken) fail('mediaChanged');
      const next = { id, token: crypto.randomUUID(), row: copy(row) };
      checkMediaCapacity(rows.entries, rows.sessions, [...rows.drafts.filter(d => d.id !== id), next]); s.drafts.put(next); return next;
    }); },
    discardDraft(id, token) { return transaction(true, (s, rows) => { if (rows.drafts.find(d => d.id === id)?.token !== token) fail('mediaChanged'); s.drafts.delete(id); }); },
    remove: (id, revision) => change(id, revision, 'remove'), restore: (id, revision) => change(id, revision, 'restore'), purge: (id, revision) => change(id, revision, 'purge'),
    merge(incoming) { return transaction(true, (s, rows) => {
      const all = new Map(rows.entries.map(r => [r.id, r])); let added = 0;
      const normalized = incoming.map(r => ({ ...r, revision: Math.max(1, r.revision) }));
      const seen = new Set();
      for (const row of normalized) {
        if (seen.has(row.id)) fail('mediaInvalid'); seen.add(row.id);
        validateMedia(row); const existing = all.get(row.id);
        if (existing && mediaSignature(existing) !== mediaSignature(row)) fail('mediaChanged');
        if (!existing) { all.set(row.id, row); added++; }
      }
      checkMediaCapacity([...all.values()], rows.sessions, rows.drafts);
      for (const row of normalized) if (!rows.entries.some(r => r.id === row.id)) s.entries.add(row); return { added };
    }); },
    startSession({ id = crypto.randomUUID(), mimeType, title = '', note = '' }) { return transaction(true, (s, rows) => {
      const now = new Date().toISOString(), session = { id, date: now, updatedAt: now, status: 'recording', mimeType, title, note, chunks: [], bytes: 0, durationMs: 0 };
      sessionValid(session); checkMediaCapacity(rows.entries, [...rows.sessions, session], rows.drafts); s.sessions.add(session); return session;
    }); },
    appendSession(id, blob, durationMs) { return transaction(true, (s, rows) => {
      const old = rows.sessions.find(r => r.id === id); if (!old || old.status !== 'recording') fail('mediaChanged');
      const next = { ...old, chunks: [...old.chunks, blob], bytes: old.bytes + blob.size, durationMs, updatedAt: new Date().toISOString() };
      if (next.bytes > MEDIA_LIMITS.audioBytes || next.durationMs > MEDIA_LIMITS.audioMs) fail('voiceLimit');
      sessionValid(next); checkMediaCapacity(rows.entries, rows.sessions.map(r => r.id === id ? next : r), rows.drafts); s.sessions.put(next); return next;
    }); },
    stopSession(id, { title, note, durationMs } = {}) { return transaction(true, (s, rows) => {
      const old = rows.sessions.find(r => r.id === id); if (!old) fail('mediaChanged');
      const next = { ...old, status: 'stopped', title: title ?? old.title, note: note ?? old.note, durationMs: durationMs ?? old.durationMs, updatedAt: new Date().toISOString() };
      sessionValid(next); s.sessions.put(next); return next;
    }); },
    retrySession(id, chunks, expectedBytes, durationMs) { return transaction(true, (s, rows) => {
      const old = rows.sessions.find(r => r.id === id); if (!old || old.status !== 'stopped' || old.bytes !== expectedBytes) fail('mediaChanged');
      const next = { ...old, chunks: [...old.chunks, ...chunks], bytes: old.bytes + chunks.reduce((n, b) => n + b.size, 0), durationMs, updatedAt: new Date().toISOString() };
      if (next.bytes > MEDIA_LIMITS.audioBytes) fail('voiceLimit'); sessionValid(next);
      checkMediaCapacity(rows.entries, rows.sessions.map(r => r.id === id ? next : r), rows.drafts); s.sessions.put(next); return next;
    }); },
    discardSession(id) { return transaction(true, (s, rows) => {
      const row = rows.sessions.find(r => r.id === id);
      if (row?.status === 'recording' && Date.now() - Date.parse(row.updatedAt) < 30000) fail('voiceOtherTab');
      s.sessions.delete(id);
    }); },
    close() { database?.close(); database = null; readable = false; }
  };
}
