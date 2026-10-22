const fail = () => { throw Object.assign(new Error('offlineUnavailable'), { code: 'offlineUnavailable' }); };
// Only the static local build exposes this control. No APIs, journal content,
// login responses or third-party URLs are ever added to the offline cache.
export async function prepareOffline({ serviceWorker = globalThis.navigator?.serviceWorker } = {}) {
  if (!globalThis.isSecureContext || !serviceWorker) fail();
  const registration = await serviceWorker.register('./offline-worker.js', { scope: './', updateViaCache: 'none' });
  await registration.update();
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) fail();
  if (worker.state !== 'activated') await new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(false), 15000);
    const changed = () => { if (worker.state === 'activated') finish(true); else if (worker.state === 'redundant') finish(false); };
    function finish(ok) { clearTimeout(timer); worker.removeEventListener('statechange', changed); ok ? resolve() : reject(Object.assign(new Error('offlineUnavailable'), { code: 'offlineUnavailable' })); }
    worker.addEventListener('statechange', changed); changed();
  });
  return registration;
}

export async function offlineReady() {
  try {
    if (!globalThis.isSecureContext || !navigator.serviceWorker) return false;
    const registration = await navigator.serviceWorker.getRegistration('./');
    return !!registration?.active?.scriptURL?.endsWith('/offline-worker.js');
  } catch { return false; }
}
