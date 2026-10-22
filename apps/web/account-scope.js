// Scope is fixed before any stores open. Switching accounts reloads the app;
// in-flight old writes therefore retain the old namespace.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let account = null;
export function setAccountScope(id) {
  if (id !== null && !UUID.test(id) && !/^care_(guest|[0-9a-f-]{36})$/i.test(id)) throw Error('accountInvalid');
  account = id;
}
export const getAccountScope = () => account;
export const scopedName = (name, id = account) => id ? `liubai.account.${id}.${name}` : name;
export const JOURNAL_KEY = 'local-mood-journal.data.v1';
export const ACCOUNT_CACHE = 'text-cache.v1';
export const emptyCache = () => ({ version: 1, journal: { version: 1, careCount: 0, entries: [] },
  base: [], revision: 0, enabled: false, lastSync: null, conflicts: 0 });

export function accountCache(storage, id = account) {
  if (!UUID.test(id || '')) throw Error('accountRequired');
  const key = scopedName(ACCOUNT_CACHE, id);
  return { key,
    read() {
      const raw = storage.getItem(key), value = raw === null ? emptyCache() : JSON.parse(raw);
      if (!value || value.version !== 1 || !Array.isArray(value.base) || !value.journal ||
          !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.enabled !== 'boolean') throw Error('accountCacheInvalid');
      return { raw, value };
    },
    commit(before, value) {
      if (storage.getItem(key) !== before.raw) throw Error('accountChanged');
      storage.setItem(key, JSON.stringify(value));
    }
  };
}
