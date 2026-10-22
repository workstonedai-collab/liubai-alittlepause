export function mountAIDialog(root, { client, entry, locale, t, esc, unchanged, adopt }) {
  let disposed = false, busy = false, action = null, consent = false, candidate = null;
  let mode = client.mode(), message = 'aiChecking', revision = 0;
  const controller = new AbortController();
  const valid = () => unchanged(entry);
  function render() {
    if (disposed) return;
    const connected = client.connected();
    root.innerHTML = `<p>${t('aiNotice')}</p><p class="badge" id="ai-mode">${mode ? t(mode === 'mock' ? 'aiMockTransport' : 'aiProvider') : t('aiDisabled')}</p>
      <p id="ai-connection" role="status">${t(message)}</p><div class="dialog-actions"><button class="secondary" id="ai-connect" ${busy || connected ? 'disabled' : ''}>${t('aiConnect')}</button><button class="text-button" id="ai-disconnect" ${busy || !connected ? 'disabled' : ''}>${t('aiDisconnect')}</button></div>
      <h3>${t('aiSelectedText')}</h3><p id="ai-source" class="ai-copy">${esc(entry.text) || t('noText')}</p>
      <p id="ai-recipient">${t(mode === 'mock' ? 'aiMockRecipient' : 'aiRecipient')}</p><h3>${t('aiChoose')}</h3>
      <div class="dialog-actions"><button class="secondary" id="ai-brief" aria-pressed="${action === 'brief-response'}" ${busy || !connected ? 'disabled' : ''}>${t('aiBrief')}</button><button class="secondary" id="ai-rephrase" aria-pressed="${action === 'rephrase'}" ${busy || !connected ? 'disabled' : ''}>${t('aiRephrase')}</button></div>
      <p id="ai-purpose">${action ? t(action === 'rephrase' ? 'aiPurposeRephrase' : 'aiPurposeBrief') : ''}</p>
      <label class="ai-consent"><input type="checkbox" id="ai-consent" ${consent ? 'checked' : ''} ${busy || !action || !connected ? 'disabled' : ''}> ${t('aiConsent')}</label>
      <div class="dialog-actions"><button class="primary" id="ai-send" ${busy || !consent || !action || !connected || !entry.text.trim() ? 'disabled' : ''}>${t(mode === 'mock' ? 'aiMockSend' : 'aiSend')}</button><button class="secondary" id="ai-cancel" ${!busy ? 'hidden' : ''}>${t('aiCancel')}</button></div>
      <h3>${t('aiResult')}</h3><p id="ai-result" class="ai-copy" role="status">${candidate ? esc(candidate.text) : ''}</p><p class="rule-note">${t('aiAdoptHelp')}</p><p id="ai-error" role="alert"></p>
      <button class="secondary" id="ai-adopt" ${busy || candidate?.action !== 'rephrase' || candidate.text.length > 2000 ? 'disabled' : ''}>${t('aiAdopt')}</button>`;
    const find = id => root.querySelector('#' + id);
    find('ai-connect').onclick = async () => {
      if (busy || client.connected()) return;
      busy = true; message = 'aiConnecting'; render(); const version = ++revision;
      try {
        const status = await client.status({ signal: controller.signal });
        if (!status.available) { const error = new Error(status.reason); error.code = status.reason; throw error; }
        const connected = await client.connect({ signal: controller.signal });
        if (disposed || version !== revision) return;
        mode = connected.mode; message = 'aiConnected';
      } catch (error) { if (!disposed && version === revision) message = error.code || 'aiProviderUnavailable'; }
      finally { if (!disposed && version === revision) { busy = false; render(); } }
    };
    find('ai-disconnect').onclick = () => { client.disconnect(); mode = null; action = null; consent = false; candidate = null; message = 'aiDisabled'; render(); };
    for (const [id, value] of [['ai-brief', 'brief-response'], ['ai-rephrase', 'rephrase']]) find(id).onclick = () => {
      if (busy || !client.connected()) return;
      action = value; consent = false; candidate = null; render(); find('ai-consent').focus();
    };
    find('ai-consent').onchange = event => { consent = event.target.checked; find('ai-send').disabled = !consent || !entry.text.trim(); };
    find('ai-send').onclick = async () => {
      if (busy || !consent || !action || !client.connected()) return;
      if (!valid()) { message = 'aiEntryChanged'; consent = false; render(); return; }
      const selectedAction = action, version = ++revision;
      busy = true; consent = false; candidate = null; message = 'aiLoading'; render();
      try {
        const result = await client.generate(entry, selectedAction, { consent: true, locale });
        if (disposed || version !== revision) return;
        if (!valid()) { message = 'aiEntryChanged'; return; }
        candidate = result; message = 'aiConnected';
      } catch (error) { if (!disposed && version === revision) message = error.code || 'aiProviderUnavailable'; }
      finally { if (!disposed && version === revision) { busy = false; render(); } }
    };
    find('ai-cancel').onclick = () => { revision++; client.cancel(); busy = false; consent = false; candidate = null; message = 'aiCancelled'; render(); };
    find('ai-adopt').onclick = () => {
      if (busy || candidate?.action !== 'rephrase' || candidate.text.length > 2000) return;
      if (!valid()) { message = 'aiEntryChanged'; candidate = null; render(); return; }
      try { adopt(entry, candidate.text); candidate = null; message = 'aiAdopted'; render(); }
      catch (error) { find('ai-error').textContent = t(error.code || 'unknownError'); }
    };
  }
  render();
  const expiry = setInterval(() => {
    if (!disposed && !busy && message === 'aiConnected' && !client.connected()) {
      mode = null; action = null; consent = false; candidate = null; message = 'unauthorized'; render();
    }
  }, 1000);
  client.status({ signal: controller.signal }).then(status => {
    if (disposed || busy) return;
    mode = status.available ? status.mode : null;
    message = client.connected() ? 'aiConnected' : status.available ? 'aiDisabled' : status.reason;
    render();
  }).catch(error => { if (!disposed && !busy) { message = error.code || 'aiNotConfigured'; render(); } });
  return () => { disposed = true; revision++; clearInterval(expiry); controller.abort(); client.cancel(); };
}
