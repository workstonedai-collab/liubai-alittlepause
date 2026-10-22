import { remoteRequest } from './network-policy.js';
import { UUID } from './account-scope.js';
export const SESSION_KEY = 'liubai.email-session.v1';
export const MODE_KEY = 'liubai.email-mode.v1';
const fail = code => { throw Object.assign(new Error(code), { code }); };
export function createAccountAuth({ config, storage = globalThis.sessionStorage, fetch: request = globalThis.fetch,
  now = () => Date.now(), location = globalThis.location, history = globalThis.history } = {}) {
  let session = null, refreshing = null, recovery = false, generation = 0;
  const configured = config.enabled && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url) && /^sb_publishable_/.test(config.publishableKey);
  async function call(path, body, { method = 'POST', token = null } = {}) {
    if (!configured) fail('accountNotReady');
    let response;
    try { response = await remoteRequest(request, config.url + '/auth/v1/' + path, { method,
      headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) }); }
    catch { fail('accountNetwork'); }
    if (!response.ok) {
      if (response.status === 429) fail('accountRateLimited');
      let code; try { const error=await response.json();code=error.message==='accountNotInvited'?'accountNotInvited':error.error_code; } catch {}
      fail(({ accountNotInvited: 'accountNotInvited', invalid_credentials: 'accountCredentials', email_not_confirmed: 'accountUnverified',
        over_email_send_rate_limit: 'accountRateLimited', email_address_not_authorized: 'accountSenderMissing',
        weak_password: 'accountPasswordWeak', otp_expired: 'accountCodeExpired', refresh_token_not_found: 'accountExpired' })[code] ||
        ([401,403].includes(response.status) ? 'accountExpired' : 'accountRequestFailed'));
    }
    if (response.status === 204) return null;
    return response.json();
  }
  function persist(value, recovering = false) {
    if (!value?.access_token || !value?.refresh_token || !UUID.test(value.user?.id || '') || !value.user.email_confirmed_at) fail('accountUnverified');
    const next = { access_token: value.access_token, refresh_token: value.refresh_token,
      expires_at: Number(value.expires_at) || Math.floor(now()/1000) + Number(value.expires_in || 3600),
      user: { id: value.user.id, email: value.user.email }, recovery: recovering };
    try { storage.setItem(SESSION_KEY, JSON.stringify(next)); storage.setItem(MODE_KEY, 'account'); }
    catch { fail('accountStorage'); }
    session = next; recovery = recovering; return next;
  }
  const email = value => { const v = String(value).trim(); if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('accountEmailInvalid'); return v; };
  const password = value => { if (typeof value !== 'string' || value.length < 12 || value.length > 128) fail('accountPasswordWeak'); return value; };
  async function accept(value, recovering = false, epoch = generation) {
    const user = await call('user', undefined, { method: 'GET', token: value.access_token });
    if (epoch !== generation) fail('accountExpired');
    return persist({ ...value, user }, recovering);
  }
  return {
    get configured() { return configured; }, get emailEnabled() { return configured && config.emailEnabled; },
    get session() { return session; }, get recovering() { return recovery; },
    get active() { try { return !!session && storage.getItem(MODE_KEY) === 'account'; } catch { return false; } },
    async initialize() {
      // Remove email callback credentials from the URL before rendering anything.
      const hash = new URLSearchParams(location?.hash?.slice(1) || '');
      if (hash.has('access_token') || hash.has('error')) {
        history?.replaceState(null, '', location.pathname + location.search + '#journal');
        if (!configured) fail('accountNotReady');
        if (hash.has('error')) fail('accountCodeExpired');
        await accept(Object.fromEntries(hash), hash.get('type') === 'recovery'); return;
      }
      if (!configured) return;
      try { const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
        if (saved && UUID.test(saved.user?.id || '') && typeof saved.access_token === 'string' && typeof saved.refresh_token === 'string' && Number.isFinite(saved.expires_at)) {
          session = saved; recovery = !!saved.recovery;
          // An offline reload may use this account's own cache. Cloud operations
          // always require a live, authenticated token and membership check.
        }
      } catch { fail('accountStorage'); }
    },
    async signIn(address, secret) { const value = await call('token?grant_type=password', { email: email(address), password: String(secret) }); return accept(value); },
    async signUp(address, secret) {
      if (!config.emailEnabled) fail('accountSenderMissing');
      await call('signup?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { email: email(address), password: password(secret) });
    },
    async sendRecovery(address) {
      if (!config.emailEnabled) fail('accountSenderMissing');
      await call('recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { email: email(address) });
    },
    async resend(address) {
      if (!config.emailEnabled) fail('accountSenderMissing');
      await call('resend', { type: 'signup', email: email(address), email_redirect_to: location.origin + location.pathname });
    },
    async verify(address, code, type = 'signup') {
      if (!['signup','recovery'].includes(type) || !/^\d{6,10}$/.test(code)) fail('accountCodeExpired');
      return accept(await call('verify', { email: email(address), token: code, type }), type === 'recovery');
    },
    async token() {
      if (!session) fail('accountExpired');
      if (session.expires_at > now()/1000 + 60) return session.access_token;
      if (!refreshing) {
        const current = session, epoch = generation;
        refreshing = call('token?grant_type=refresh_token', { refresh_token: current.refresh_token })
          .then(value => { if (epoch !== generation || session !== current) fail('accountExpired'); return accept(value, recovery, epoch); })
          .finally(() => { refreshing = null; });
      }
      await refreshing; return session.access_token;
    },
    async updatePassword(secret) {
      const token = await this.token(); await call('user', { password: password(secret) }, { method: 'PUT', token });
      recovery = false; session = { ...session, recovery: false }; storage.setItem(SESSION_KEY, JSON.stringify(session));
    },
    useLocal() { storage.setItem(MODE_KEY, 'guest'); }, useAccount() { if (!session) fail('accountExpired'); storage.setItem(MODE_KEY, 'account'); },
    async signOut() {
      const token = session?.access_token; generation++;
      // Clearing this tab's credentials must work even when the network is down.
      storage.removeItem(SESSION_KEY); storage.removeItem(MODE_KEY); session = null; recovery = false;
      if (token) try { await call('logout?scope=local', {}, { token }); } catch {}
    }
  };
}
