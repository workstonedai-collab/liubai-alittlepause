import { readMode } from './experience.js';
import { scopedName } from './account-scope.js';
import { validateImageRecord, checkCapacity, galleryError } from './gallery-files.js';
export const GALLERY_DB = 'liubai-private-gallery-v1';
export function createGalleryStore({ indexedDB = globalThis.indexedDB, notify = () => {} } = {}) {
  const databaseName = scopedName(GALLERY_DB);
  const boundary=readMode()==='care';
  let database = null, pending = null, readable = false, closed = false;
  async function open() {
    if (closed) throw galleryError('galleryReadFailed');
    if (database) return database; if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(galleryError('galleryUnsupported')); return; }
      let request, settled = false;
      const finish = (error, db) => { if (settled) { db?.close(); return; } settled = true; clearTimeout(timer); error ? reject(error) : resolve(db); };
      const timer = setTimeout(() => finish(galleryError('galleryReadFailed')), 5000);
      try { request = indexedDB.open(databaseName, 1); }
      catch { finish(galleryError('galleryReadFailed')); return; }
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('images')) request.result.createObjectStore('images', { keyPath: 'id' }); };
      request.onerror = () => finish(galleryError('galleryReadFailed'));
      request.onblocked = () => finish(galleryError('galleryReadFailed'));
      request.onsuccess = () => { const db = request.result; if (closed) { db.close(); finish(galleryError('galleryReadFailed')); return; } db.onversionchange = () => { db.close(); database = null; readable = false; }; if (!settled) database = db; finish(null, db); };
    }).finally(() => { pending = null; });
    return pending;
  }
  async function read() {
    try {
      const db = await open(); const items = await new Promise((resolve, reject) => {
        let rows; const transaction = db.transaction('images', 'readonly'), request = transaction.objectStore('images').getAll();
        request.onsuccess = () => { rows = request.result; }; transaction.oncomplete = () => resolve(rows);
        transaction.onerror = transaction.onabort = () => reject(galleryError('galleryReadFailed'));
      });
      for (const item of items) validateImageRecord(item); checkCapacity(items); readable = true;
      return items.sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id));
    } catch (error) { readable = false; throw galleryError(error.code === 'galleryUnsupported' ? error.code : 'galleryReadFailed'); }
  }
  async function write(mutator) {
    if(boundary!==(readMode()==='care'))throw galleryError('galleryWriteFailed');
    if (!readable) throw galleryError('galleryReadFailed');
    const db = await open();
    const result = await new Promise((resolve, reject) => {
      let value, failure; let transaction;
      try {
        transaction = db.transaction('images', 'readwrite'); const store = transaction.objectStore('images'), request = store.getAll();
        request.onsuccess = () => { try { for (const item of request.result) validateImageRecord(item); value = mutator(store, request.result); } catch (error) { failure = error; transaction.abort(); } };
        transaction.oncomplete = () => resolve(value);
        transaction.onabort = transaction.onerror = () => reject(galleryError(failure?.code || 'galleryWriteFailed'));
      } catch { reject(galleryError('galleryWriteFailed')); }
    });
    try { notify(); } catch {} return result;
  }
  return { read,
    async add(items) {
      for (const item of items) validateImageRecord(item);
      return write((store, existing) => {
        const ids = new Set(existing.map(item => item.id)), next = [];
        for (const item of items) if (!ids.has(item.id)) { next.push(item); ids.add(item.id); }
        checkCapacity([...existing, ...next]); for (const item of next) store.add(item);
        return { added: next.length, skipped: items.length - next.length };
      });
    },
    remove(id) { return write((store, rows) => { const item = rows.find(row => row.id === id); if (item && !item.deletedAt) store.put({ ...item, deletedAt: new Date().toISOString() }); }); },
    restore(id) { return write((store, rows) => { const item = rows.find(row => row.id === id); if (item) store.put({ ...item, deletedAt: null }); }); },
    purge(id) { return write((store, rows) => { if (rows.find(row => row.id === id)?.deletedAt) store.delete(id); }); },
    close() { closed = true; database?.close(); database = null; readable = false; }
  };
}
