import { remoteRequest } from './network-policy.js';
import { makeAIRequest } from '../../packages/core/ai.js';

const errors = new Set(['aiDisabled', 'aiNotConfigured', 'aiBillingAcknowledgementRequired', 'aiConfigInvalid',
  'aiCancelled', 'aiTimeout', 'aiProviderUnavailable', 'aiProviderRejected', 'aiProviderRateLimited',
  'aiResponseTooLarge', 'aiOutputInvalid', 'unauthorized', 'rateLimited', 'aiConsentRequired', 'aiTextRequired', 'invalidAIRequest']);
const fail = code => { const error = new Error(code); error.code = code; throw error; };
// No storage, URL token, cookies or provider credential. One capability in page memory.
export function createAIClient({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let session = null, active = null, generation = 0;
  const connected = () => !!session && session.expiresAt > now();
  async function json(path, options = {}) {
    let response;
    try { response = await remoteRequest(fetchImpl, path, { cache: 'no-store', credentials: 'omit', redirect: 'error', ...options }); }
    catch { fail(options.signal?.aborted ? 'aiCancelled' : 'aiProviderUnavailable'); }
    let value; try { value = await response.json(); } catch { fail('aiNotConfigured'); }
    if (!response.ok) fail(errors.has(value?.error) ? value.error : 'aiNotConfigured');
    return value;
  }
  const cancel = () => { generation++; active?.abort(); active = null; };
  return {
    connected, mode: () => connected() ? session.mode : null,
    cancel,
    async status({ signal } = {}) {
      const value = await json('/api/ai/status', { signal });
      if (!['provider', 'mock'].includes(value.mode)) fail('aiNotConfigured');
      return { available: value.available === true, mode: value.mode, reason: errors.has(value.reason) ? value.reason : 'aiNotConfigured' };
    },
    async connect({ signal } = {}) {
      if (connected()) return { mode: session.mode };
      const revision = generation;
      const value = await json('/api/ai/session', { method: 'POST', headers: { 'X-Liubai-Connect': '1' }, signal });
      if (signal?.aborted || revision !== generation) fail('aiCancelled');
      if (!/^[a-f0-9]{64}$/.test(value.token) || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now() ||
          !['provider', 'mock'].includes(value.mode)) fail('aiNotConfigured');
      session = { token: value.token, expiresAt: value.expiresAt, mode: value.mode };
      return { mode: session.mode };
    },
    disconnect() {
      cancel(); const previous = session; session = null;
      if (previous) void json('/api/ai/session', { method: 'DELETE', headers: { 'X-Liubai-Connect': '1', 'X-Liubai-AI-Token': previous.token } }).catch(() => {});
    },
    async generate(entry, action, { consent = false, locale = 'zh' } = {}) {
      if (!connected()) { session = null; fail('unauthorized'); }
      if (active) fail('rateLimited');
      const body = JSON.stringify(makeAIRequest(entry, action, { enabled: true, consent, locale }));
      const controller = new AbortController(), revision = ++generation, expectedMode = session.mode;
      active = controller; let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 25000);
      try {
        const result = await json('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Liubai-AI-Token': session.token },
          body, signal: controller.signal });
        if (controller.signal.aborted || revision !== generation) fail(timedOut ? 'aiTimeout' : 'aiCancelled');
        if (result.mode !== expectedMode || result.entryId !== entry.id || result.action !== action || result.originalPreserved !== true ||
            typeof result.text !== 'string' || !result.text.trim() || result.text.length > 4000 ||
            (expectedMode === 'provider' && result.provider !== 'MiniMax')) fail('aiOutputInvalid');
        return { mode: result.mode, text: result.text, action, entryId: entry.id };
      } catch (error) {
        if (error.code === 'unauthorized') session = null;
        if (controller.signal.aborted) fail(timedOut ? 'aiTimeout' : 'aiCancelled');
        throw error;
      } finally { clearTimeout(timer); if (active === controller) active = null; }
    }
  };
}
