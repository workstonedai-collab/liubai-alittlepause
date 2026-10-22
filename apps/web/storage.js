import { getAccountScope, scopedName, JOURNAL_KEY, accountCache, UUID } from './account-scope.js';
// Web boundary: access is deferred so blocked browser storage reaches the guarded store.
export function createWebStorage(getStorage = () => globalThis.localStorage) {
  const id = getAccountScope(), name = key => scopedName(key, id);
  return { physicalKey: name,
    getItem(key) {
      if (UUID.test(id || '') && key === JOURNAL_KEY) { const row = accountCache(getStorage(), id).read(); return row.raw === null ? null : JSON.stringify(row.value.journal); }
      return getStorage().getItem(name(key));
    },
    setItem(key, value) {
      if (UUID.test(id || '') && key === JOURNAL_KEY) { const cache = accountCache(getStorage(), id), old = cache.read(); cache.commit(old, { ...old.value, journal: JSON.parse(value) }); return; }
      getStorage().setItem(name(key), value);
    }
  };
}
