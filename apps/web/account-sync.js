import { remoteRequest } from './network-policy.js';
import { validateData } from '../../packages/data-contract/index.js';
import { accountCache } from './account-scope.js';
const fail = code => { throw Object.assign(new Error(code), { code }); };
const equal = (a, b) => JSON.stringify(a ? [a.id, a.date, a.mood, [...a.tags].sort(), a.text] : null) ===
  JSON.stringify(b ? [b.id, b.date, b.mood, [...b.tags].sort(), b.text] : null);
export function checkEntries(entries) { return validateData({ version: 1, careCount: 0, entries }).entries; }
async function conflictID(entry) {
  const bytes = new TextEncoder().encode(JSON.stringify([entry.id, entry.date, entry.mood, [...entry.tags].sort(), entry.text]));
  return 'conflict_' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Three-way merge: both changed versions survive. IDs of conflict copies are
// content-derived, so retries after an interrupted acknowledgement converge.
export async function mergeAccountEntries(base, local, remote) {
  [base, local, remote].forEach(checkEntries);
  const maps = [base, local, remote].map(rows => new Map(rows.map(row => [row.id, row])));
  const result = new Map(remote.map(row => [row.id, row])); let conflicts = 0;
  for (const id of new Set([...maps[0].keys(), ...maps[1].keys(), ...maps[2].keys()])) {
    const [before, here, there] = maps.map(m => m.get(id));
    if (equal(here, before) || equal(here, there)) continue;
    if (equal(there, before)) { if (here) result.set(id, here); else result.delete(id); continue; }
    conflicts++;
    if (here) {
      const copyID = await conflictID(here), copy = { ...here, id: copyID };
      if (result.has(copyID) && !equal(result.get(copyID), copy)) fail('accountConflict');
      result.set(copyID, copy);
    }
    // A local delete against a remote edit keeps the edited remote version.
  }
  const entries = checkEntries([...result.values()].sort((a,b) => a.id.localeCompare(b.id)));
  if (entries.length > 500) fail('accountLimit');
  return { entries, conflicts };
}
export function createAccountTransport({ config, auth, fetch: request = globalThis.fetch }) {
  async function rpc(name, body) {
    const token = await auth.token(); let response;
    try { response = await remoteRequest(request, config.url + '/rest/v1/rpc/' + name, { method: 'POST',
      headers: { apikey: config.publishableKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000) }); }
    catch { fail('accountNetwork'); }
    if (!response.ok) {
      let message = ''; try { message = (await response.json()).message; } catch {}
      fail(['accountNotInvited','accountExpired','accountLimit','accountConflict'].includes(message) ? message :
        response.status === 429 ? 'accountRateLimited' : 'accountRequestFailed');
    }
    const value = await response.json();
    if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0) fail('accountInvalid');
    return { revision: value.revision, entries: value.unchanged === true && value.entries === null ? null : checkEntries(value.entries) };
  }
  return { read: async (revision, base) => {
    const row = await rpc('liubai_trial_read', { known_revision: revision });
    if (row.entries === null) { if (row.revision !== revision) fail('accountInvalid'); return { revision, entries: checkEntries(base) }; }
    return row;
  },
    write: (revision, entries) => rpc('liubai_trial_write', { expected_revision: revision, new_entries: checkEntries(entries) }) };
}
export function createAccountSync({ id, storage, journal, transport, onChange = () => {} }) {
  const cache = accountCache(storage, id); let busy = false;
  async function plan() {
    journal.load(); journal.requireReady();
    const before = cache.read(); checkEntries(before.value.base); validateData(before.value.journal);
    const cloud = await transport.read(before.value.revision, before.value.base);
    const merged = await mergeAccountEntries(before.value.base, before.value.journal.entries, cloud.entries);
    return { before, cloud, ...merged, upload: before.value.journal.entries.filter(row => !cloud.entries.some(r => equal(r,row))).length,
      download: cloud.entries.filter(row => !before.value.journal.entries.some(r => equal(r,row))).length };
  }
  async function apply(review, enable = true) {
    if (busy) fail('accountBusy'); busy = true;
    try {
      // The reviewed snapshot cannot upload a later unreviewed edit.
      if (cache.read().raw !== review.before.raw) fail('accountChanged');
      const same = review.entries.length === review.cloud.entries.length && review.entries.every(row => review.cloud.entries.some(other => equal(row,other)));
      const cloud = same ? review.cloud : await transport.write(review.cloud.revision, review.entries);
      // A save from another tab or while awaiting the server remains intact.
      // Its old base is retained, so the next merge preserves both versions.
      const current = cache.read(); if (current.raw !== review.before.raw) fail('accountChanged');
      cache.commit(current, { ...current.value, journal: { ...current.value.journal, entries: cloud.entries },
        base: cloud.entries, revision: cloud.revision, enabled: enable,
        lastSync: new Date().toISOString(), conflicts: review.conflicts });
      journal.load(); onChange(); return cloud;
    } finally { busy = false; }
  }
  return { plan, apply, get busy() { return busy; }, status: () => cache.read().value,
    pause() { const old = cache.read(); cache.commit(old, { ...old.value, enabled: false }); onChange(); },
    async synchronize() {
      if (busy || !cache.read().value.enabled) return;
      return apply(await plan());
    }
  };
}
