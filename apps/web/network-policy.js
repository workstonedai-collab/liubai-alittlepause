import { readMode, EXPERIENCE_KEY } from './experience.js';
let privacyAbort = new AbortController();
const sync = () => { if (typeof globalThis.window !== 'undefined' && readMode() === 'care') privacyAbort.abort(); else if (privacyAbort.signal.aborted) privacyAbort = new AbortController(); };
globalThis.addEventListener?.('storage', event => { if (event.key === EXPERIENCE_KEY || event.key === null) sync(); });
globalThis.addEventListener?.('liubai-mode-change', sync);
export const cloudAllowed = () => typeof globalThis.window === 'undefined' || readMode() !== 'care';
export async function remoteRequest(fetcher, url, options = {}) {
  sync();
  if (!cloudAllowed()) throw Object.assign(new Error('cloudPaused'), { code:'cloudPaused' });
  const signal = options.signal ? AbortSignal.any([options.signal,privacyAbort.signal]) : privacyAbort.signal;
  return fetcher(url, { ...options, signal });
}
