import { MEDIA_LIMITS, mediaError, validAudioType } from './media-contract.js';

export function createVoiceRecorder({ store, onChange = () => {}, getDraft = () => ({ title: '', note: '' }),
  mediaDevices = globalThis.navigator?.mediaDevices, Recorder = globalThis.MediaRecorder,
  now = () => performance.now(), setTimer = setInterval, clearTimer = clearInterval } = {}) {
  let stream = null, recorder = null, timer = null, session = null, elapsed = 0, started = 0, status = 'idle', error = '', queue = Promise.resolve(), disposed = false;
  let stopPromise = null, resolveStop = null, failedChunks = [], retrying = false;
  const duration = () => Math.min(MEDIA_LIMITS.audioMs, Math.max(0, elapsed + (status === 'recording' ? now() - started : 0)));
  const snapshot = () => ({ status, error, session, durationMs: duration(), bytes: session?.bytes || 0,
    failureBlob: failedChunks.length ? new Blob([...(session?.chunks || []), ...failedChunks], { type: session?.mimeType || '' }) : null });
  const changed = () => { if (!disposed) onChange(snapshot()); };
  const tracksOff = () => { stream?.getTracks().forEach(track => track.stop()); stream = null; };
  const clear = () => { if (timer !== null) clearTimer(timer); timer = null; };
  function stop(reason = '') {
    if (reason) error = reason;
    if (['recording','paused'].includes(status)) { elapsed = duration(); status = 'stopping'; clear(); if (recorder?.state !== 'inactive') recorder.stop(); tracksOff(); changed(); }
    return stopPromise || Promise.resolve(snapshot());
  }
  async function start() {
    if (disposed || status !== 'idle') return;
    if (!globalThis.isSecureContext || !mediaDevices?.getUserMedia || !Recorder) { error = 'voiceUnsupported'; changed(); return; }
    if(typeof CustomEvent!=='undefined')globalThis.dispatchEvent?.(new CustomEvent('liubai-audio-focus',{detail:'recording'}));
    error = ''; status = 'requesting'; changed();
    try {
      stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      if (disposed) { tracksOff(); status = 'idle'; return; }
      const mimeType = ['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(type => Recorder.isTypeSupported(type));
      if (!mimeType) throw mediaError('voiceUnsupported');
      recorder = new Recorder(stream, { mimeType, audioBitsPerSecond: 64000 });
      if (!validAudioType(recorder.mimeType)) throw mediaError('voiceUnsupported');
      session = await store.startSession({ mimeType: recorder.mimeType, ...getDraft() });
      if (disposed) { await store.stopSession(session.id); tracksOff(); return; }
      stopPromise = new Promise(resolve => { resolveStop = resolve; });
      recorder.ondataavailable = event => {
        if (!event.data.size) return;
        const at = duration(), chunk = new Blob([event.data], { type: session.mimeType });
        queue = queue.then(async () => {
          if (failedChunks.length) { failedChunks.push(chunk); changed(); return; }
          try {
            session = await store.appendSession(session.id, chunk, at);
            if (session.bytes >= MEDIA_LIMITS.audioBytes - 131072) void stop('voiceLimit');
          } catch (failure) { failedChunks.push(chunk); error = typeof failure.code === 'string' ? failure.code : 'mediaWriteFailed'; void stop(error); }
          changed();
        });
      };
      recorder.onstop = () => {
        if (status === 'recording' || status === 'paused') { elapsed = duration(); status = 'stopping'; error ||= 'voiceInterrupted'; }
        tracksOff(); clear();
        queue = queue.then(async () => {
          try { session = await store.stopSession(session.id, { ...getDraft(), durationMs: elapsed }); }
          catch (failure) { error = failure.code || 'mediaWriteFailed'; }
          status = 'stopped'; changed(); resolveStop?.(snapshot());
        });
      };
      recorder.onerror = () => { void stop('voiceInterrupted'); };
      stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => { if (status === 'recording' || status === 'paused') void stop('voiceInterrupted'); }));
      status = 'recording'; started = now(); recorder.start(2000);
      timer = setTimer(() => { if (duration() >= MEDIA_LIMITS.audioMs) void stop('voiceLimit'); else changed(); }, 250); changed();
    } catch (failure) {
      tracksOff(); clear(); status = 'idle'; error = failure.name === 'NotAllowedError' ? 'voicePermission' : (typeof failure.code === 'string' ? failure.code : 'voiceUnavailable');
      if (session) try { await store.stopSession(session.id); } catch {} changed();
    }
  }
  function pause() {
    if (status !== 'recording' || typeof recorder?.pause !== 'function') return;
    elapsed = duration(); recorder.pause(); status = 'paused'; changed();
  }
  function resume() {
    if (status !== 'paused') return; recorder.resume(); started = now(); status = 'recording'; changed();
  }
  return { start, pause, resume, stop, snapshot,
    async retry() {
      if (status !== 'stopped' || !failedChunks.length || retrying) return; retrying = true;
      try { session = await store.stopSession(session.id, { ...getDraft(), durationMs: elapsed }); session = await store.retrySession(session.id, failedChunks, session.bytes, elapsed); failedChunks = []; error = ''; }
      catch (failure) { error = typeof failure.code === 'string' ? failure.code : 'mediaWriteFailed'; }
      finally { retrying = false; changed(); }
    },
    async dispose() { disposed = true; if (status === 'recording' || status === 'paused') await stop('voiceInterrupted'); tracksOff(); clear(); }
  };
}
