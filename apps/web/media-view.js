import { createWebStorage } from './storage.js';
import { newDesign, ensurePlacements, applyScrapbookTemplate, SCRAPBOOK_TEMPLATES } from './scrapbook-design.js';
import { scrapbookHTML, renderScrapbookImage } from './scrapbook-render.js';
import { createScrapbookTools, createPageHistory } from './scrapbook-tools.js';
import { newMedia, validateMedia, mediaText, mediaSignature, mediaBytes, exportMedia, parseMediaBackup, MEDIA_LIMITS, mediaError } from './media-contract.js';
import { prepareImages, blobHash } from './gallery-files.js';
import { createGalleryStore } from './gallery-store.js';
import { createVoiceRecorder } from './voice-recorder.js';

export function downloadMedia(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function createMediaUI({ store, t, esc, dateText, openDialog, closeDialog, lifecycle, refresh, toast, storage=createWebStorage(), getLanguage=()=>'zh' }) {
  const minute = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const urls = new Set(), blobURLs=new Map();
  const tools=createScrapbookTools({storage,language:getLanguage,esc});
  const cardURLs = new Set(), previewURLs = new Set();
  const url = blob => { if(blobURLs.has(blob))return blobURLs.get(blob);const value = URL.createObjectURL(blob); urls.add(value);blobURLs.set(blob,value);return value; };
  const clearURLs = () => { urls.forEach(value => URL.revokeObjectURL(value)); urls.clear();blobURLs.clear(); previewURLs.forEach(value => URL.revokeObjectURL(value)); previewURLs.clear(); };
  const cardURL = blob => { const value = URL.createObjectURL(blob); cardURLs.add(value); return value; };
  const kindName = row => t(row.kind === 'voice' ? 'mediaVoice' : 'mediaScrapbook');
  function wirePlayer(audio, durationMs) {
    let holder = audio.nextElementSibling;
    if (!holder?.classList.contains('voice-progress')) {
      holder = document.createElement('label'); holder.className = 'voice-progress';
      holder.innerHTML = `<span>${t('voiceProgress')}</span><input type="range" min="0" step="0.1" value="0" aria-label="${t('voiceProgress')}"><span class="section-sub"></span>`;
      audio.after(holder);
    }
    const range = holder.querySelector('input'), counter = holder.querySelector('.section-sub');
    range.max = String(durationMs / 1000); range.value = '0';
    const update = () => { range.value = String(Math.min(durationMs / 1000, audio.currentTime || 0)); counter.textContent = `${minute((audio.currentTime || 0) * 1000)} / ${minute(durationMs)}`; };
    // WebM recordings may omit duration metadata; keep seeking available using
    // the measured recording duration without rewriting the original audio.
    audio.onloadedmetadata = () => { holder.hidden = Number.isFinite(audio.duration) && audio.duration > 0; update(); };
    audio.ontimeupdate = update;
    range.oninput = () => { if (audio.readyState) { audio.currentTime = Number(range.value); update(); } };
    audio.onerror = () => { const el = document.createElement('p'); el.className = 'rule-note'; el.textContent = t('voicePlaybackUnsupported'); holder.replaceChildren(el); holder.hidden = false; };
    holder.hidden = true;
  }
  function content(row, imageURL = url) {
    if(row.design)return scrapbookHTML(row,{esc,url:imageURL,language:getLanguage()});
    return `<div class="scrapbook-paper paper-${row.template}">${row.title ? `<h3>${esc(row.title)}</h3>` : ''}${row.blocks.map(b => b.type === 'text' ? `<p>${esc(b.text)}</p>` : (() => {
      const photo = row.photos.find(p => p.id === b.photo);
      return `<figure><img src="${imageURL(photo.blob)}" width="${photo.width}" height="${photo.height}" alt="${esc(b.caption || photo.name)}"><figcaption>${esc(b.caption)}</figcaption></figure>`;
    })()).join('')}</div>`;
  }
  const shell = (title, sub) => {
    openDialog(`<h2 id="dialog-title">${t(title)}</h2><p class="dialog-sub">${t(sub)}</p><div id="media-dialog-root"><p role="status">${t('mediaLoading')}</p></div>`);
    return document.querySelector('#media-dialog-root');
  };
  const get = (root, id) => root.querySelector('#' + id);
  function entryCard(row) {
    const preview = row.blocks.map(b => b.type === 'text' ? b.text : b.caption).join('\n').trim().slice(0, 180), photo = row.photos[0];
    return `<article class="panel entry media-entry" data-media-card="${row.id}"><div class="media-symbol" aria-hidden="true">${row.kind === 'voice' ? '◉' : '▧'}</div><div class="entry-content"><div class="entry-top"><strong>${row.title ? esc(row.title) : kindName(row)}</strong><time datetime="${row.date}">${dateText(row.date)}</time></div><p>${esc(preview || t('mediaNoText'))}</p><div class="tags"><span class="tag">${kindName(row)}${row.kind === 'voice' ? ' · ' + minute(row.durationMs) : ''}</span>${row.mood !== null ? `<span class="tag">${t('mood' + row.mood)}</span>` : ''}</div>${photo ? `<img class="media-card-photo" src="${cardURL(photo.blob)}" width="${photo.width}" height="${photo.height}" alt="${esc(photo.name)}" loading="lazy">` : ''}</div><button class="text-button" data-media-open="${row.id}">${t(row.kind === 'voice' ? 'voiceListen' : 'mediaOpen')}</button><button class="text-button" data-media-edit="${row.id}">${t('editEntry')}</button><button class="delete" data-media-delete="${row.id}">${t('delete')}</button></article>`;
  }
  async function openEntry(row) {
    clearURLs(); const root = shell(row.kind === 'voice' ? 'mediaVoice' : 'mediaScrapbook', 'mediaLocalOnly');
    root.innerHTML = `${row.audio ? `<audio controls preload="metadata" src="${url(row.audio)}"></audio><p class="section-sub">${minute(row.durationMs)}</p>` : ''}${content(row)}<div class="dialog-actions"><button class="secondary" id="media-edit">${t('editEntry')}</button>${row.audio ? `<button class="secondary" id="audio-download">${t('voiceDownload')}</button>` : ''}<button class="text-button" id="media-single-backup">${t('mediaExportOne')}</button>${row.kind==='scrapbook'?`<button class="secondary" id="media-duplicate-page">${getLanguage()==='zh'?'复制页面':'Duplicate page'}</button><button class="text-button" id="media-image-export">${getLanguage()==='zh'?'导出长图':'Export image'}</button>`:''}</div><p id="media-view-error" role="alert"></p>`;
    if (row.audio) wirePlayer(root.querySelector('audio'), row.durationMs);
    get(root, 'media-edit').onclick = () => { closeDialog(); void (row.kind === 'voice' ? openVoice(row) : openScrapbook(row)); };
    if (row.audio) get(root, 'audio-download').onclick = () => downloadAudio(row.audio, row.id);
    get(root, 'media-single-backup').onclick = async () => { try { downloadMedia(await exportMedia([row]), 'liubai-entry.backup.json'); } catch (e) { get(root, 'media-view-error').textContent = t(e.code || 'mediaWriteFailed'); } };
    if(get(root,'media-duplicate-page'))get(root,'media-duplicate-page').onclick=async()=>{try{const copied={...structuredClone(row),id:crypto.randomUUID(),date:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:0,title:row.title.slice(0,110)+(getLanguage()==='zh'?'（副本）':' (copy)')};await store.read();await store.save(copied);closeDialog();await refresh();toast(t('mediaSaved'));}catch(e){get(root,'media-view-error').textContent=t(e.code||'mediaWriteFailed');}};
    if(get(root,'media-image-export'))get(root,'media-image-export').onclick=async()=>{try{downloadMedia(await renderScrapbookImage(row),'liubai-scrapbook.png');}catch{get(root,'media-view-error').textContent=t('mediaWriteFailed');}};
    lifecycle({ dispose: () => { root.querySelectorAll('audio').forEach(a => a.pause()); clearURLs(); } });
  }
  function downloadAudio(blob, id) {
    const extension = /mp4|m4a/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : /wav/.test(blob.type) ? 'wav' : /mpeg/.test(blob.type) ? 'mp3' : 'webm';
    downloadMedia(blob, `liubai-voice-${id}.${extension}`);
  }
  async function openScrapbook(existing = null, resume = false) {
    if(!existing&&!resume){const snapshot=await store.read(),draft=snapshot.drafts.find(d=>d.id==='new-scrapbook');if(draft){const r=shell('mediaScrapbook','scrapbookSub');r.innerHTML=`<p>${getLanguage()==='zh'?'还有一页没有写完。想接着写，还是另开一页？':'A page is still in progress. Continue it, or start a new one?'}</p><div class="dialog-actions"><button class="primary" id="board-continue">${getLanguage()==='zh'?'接续这一页':'Continue page'}</button><button class="secondary" id="board-new">${getLanguage()==='zh'?'收好原页，另开一页':'Keep it and start a new page'}</button></div><p id="board-choice-error" role="alert"></p>`;get(r,'board-continue').onclick=()=>openScrapbook(null,true);get(r,'board-new').onclick=async()=>{try{await store.save(draft.row,{expectedRevision:draft.row.revision,draftId:draft.id,draftToken:draft.token});await refresh();await openScrapbook(null,true);}catch{get(r,'board-choice-error').textContent=getLanguage()==='zh'?'原页没有收好，请先接续并保存。':'The original page could not be saved. Continue and save it first.';}};return;}}

    clearURLs(); const root = shell('mediaScrapbook', 'scrapbookSub');
    let row, token = null, disposed = false, dirty = false, busy = false, timer, queue = Promise.resolve(), failure = '', library = [], preview = false, history=null;
    const key = existing?.id || 'new-scrapbook';
    const state = await store.read().catch(e => { if (root.isConnected) root.textContent = t(e.code || 'mediaReadFailed'); return null; });
    if (!state || !root.isConnected || !root.closest('dialog')?.open) return;
    const draft = state.drafts.find(d => d.id === key); row = structuredClone(draft?.row || existing || newMedia('scrapbook')); token = draft?.token || null;
    if(!draft&&!existing){row.design=newDesign();row.design.layout='collage';row.template='collage';}
    history=createPageHistory(()=>row,next=>{row=next;},()=>{draw();changed();});
    const status = () => { const el = get(root, 'media-draft-status'); if (el) el.textContent = t(failure || (dirty ? 'mediaDraftSaving' : 'mediaDraftSaved')); };
    function syncForm() {
      if (!get(root, 'scrapbook-title')) return;
      row.title = get(root, 'scrapbook-title').value; row.template = get(root, 'scrapbook-template').value;
      row.mood = get(root, 'scrapbook-mood').value === '' ? null : Number(get(root, 'scrapbook-mood').value);
      root.querySelectorAll('[data-block-text]').forEach(el => { const b = row.blocks.find(b => b.id === el.dataset.blockText); if (b) b[b.type === 'text' ? 'text' : 'caption'] = el.value; });
    }
    function persist() {
      clearTimeout(timer); syncForm(); const captured = structuredClone(row);
      queue = queue.then(async () => {
        try { const result = await store.saveDraft(key, captured, token); token = result.token; failure = ''; if (mediaSignature(row) === mediaSignature(captured)) dirty = false; }
        catch (e) { failure = e.code || 'mediaWriteFailed'; }
        if (!disposed) status();
      });
      return queue;
    }
    function changed(options={}) { dirty = true; syncForm();if(row.design)ensurePlacements(row);history?.observe();if(options?.refreshPreview!==false)root.querySelector('#scrapbook-tools-root')?.refreshPreview?.(); clearTimeout(timer); timer = setTimeout(persist, 400); status(); if (preview) updatePreview(); }
    function updatePreview() { const target = get(root, 'scrapbook-preview'); if (target) { previewURLs.forEach(value => URL.revokeObjectURL(value)); previewURLs.clear(); target.innerHTML = content(row, blob => { const value = URL.createObjectURL(blob); previewURLs.add(value); return value; }); } }
    function draw() {
      if (disposed) return;const opened=[...root.querySelectorAll('details[open][id]')].map(el=>el.id),scroll=root.closest('dialog')?.scrollTop||0; clearURLs();
      root.innerHTML = `<form id="scrapbook-form"><label for="scrapbook-title">${t('mediaTitle')}</label><input id="scrapbook-title" maxlength="120" value="${esc(row.title)}" placeholder="${t('scrapbookTitlePlaceholder')}"><div class="media-form-row"><label>${t('scrapbookTemplate')}<select id="scrapbook-template">${SCRAPBOOK_TEMPLATES.map(item => `<option value="${item.id}" ${row.template === item.id ? 'selected' : ''}>${getLanguage()==='zh'?item.zh:item.en}</option>`).join('')}</select></label><label>${t('mediaOptionalMood')}<select id="scrapbook-mood"><option value="">${t('mediaNoMood')}</option>${[0,1,2,3,4].map(v => `<option value="${v}" ${row.mood === v ? 'selected' : ''}>${t('mood' + v)}</option>`).join('')}</select></label></div><details id="scrapbook-content-details"><summary>${getLanguage()==='zh'?'添加文字与照片':'Add text and photos'}</summary><div class="scrapbook-blocks">${row.blocks.map((b, i) => `<section class="scrapbook-block">${b.type === 'text' ? `<label for="block-${b.id}">${t('scrapbookText')}</label><textarea id="block-${b.id}" data-block-text="${b.id}" maxlength="10000">${esc(b.text)}</textarea>` : (() => { const p = row.photos.find(p => p.id === b.photo); return `<img src="${url(p.blob)}" alt="${esc(p.name)}" width="${p.width}" height="${p.height}"><label for="block-${b.id}">${t('scrapbookCaption')}</label><input id="block-${b.id}" data-block-text="${b.id}" maxlength="500" value="${esc(b.caption)}">`; })()}<div class="block-actions"><button type="button" class="text-button" data-up="${b.id}" ${i === 0 ? 'disabled' : ''}>${t('mediaMoveUp')}</button><button type="button" class="text-button" data-down="${b.id}" ${i === row.blocks.length - 1 ? 'disabled' : ''}>${t('mediaMoveDown')}</button><button type="button" class="text-button" data-remove-block="${b.id}">${t('mediaRemoveBlock')}</button></div></section>`).join('')}</div><div class="dialog-actions"><button type="button" class="secondary" id="add-text">${t('scrapbookAddText')}</button><label class="secondary file-button">${t('scrapbookAddPhoto')}<input id="scrapbook-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><button type="button" class="text-button" id="choose-album">${t('scrapbookFromAlbum')}</button></div>${library.length ? `<div class="album-thumbs">${library.map(p => `<button type="button" class="album-thumb" data-album-photo="${p.id}" aria-label="${esc(p.name)}"><img src="${url(p.blob)}" alt="${esc(p.name)}" width="${p.width}" height="${p.height}"></button>`).join('')}</div>` : ''}</details><div id="scrapbook-tools-root"></div><p class="rule-note">${getLanguage()==='zh'?'本页最多12张图片、24个图文块；仅保存在当前本机空间。':'Up to 12 images and 24 blocks. Saved in this local space only.'}</p><p id="media-draft-status" role="status"></p><p id="scrapbook-error" role="alert"></p><details id="scrapbook-preview-details" ${preview ? 'open' : ''}><summary>${t('scrapbookPreview')}</summary><div id="scrapbook-preview">${preview ? content(row) : ''}</div></details><div class="dialog-actions"><button class="primary" type="submit" ${busy ? 'disabled' : ''}>${t('mediaSave')}</button><button type="button" class="secondary" id="download-draft">${t('mediaDownloadDraft')}</button><button type="button" class="text-button" id="discard-media-draft">${t('mediaDiscardDraft')}</button></div></form>`;
      root.querySelectorAll('input:not([type="file"]),textarea').forEach(el => { el.oninput = changed; });
      get(root, 'scrapbook-template').onchange = ()=>{syncForm();applyScrapbookTemplate(row,row.template,getLanguage());changed({refreshPreview:false});draw();}; get(root, 'scrapbook-mood').onchange = changed;
      const changeBlocks = fn => { syncForm(); fn(); changed({refreshPreview:false}); draw(); };
      get(root, 'add-text').onclick = () => { if (row.blocks.length >= MEDIA_LIMITS.blocks) { get(root, 'scrapbook-error').textContent = t('mediaCapacity'); return; } changeBlocks(() => row.blocks.push({ id: crypto.randomUUID(), type: 'text', text: '' })); };
      root.querySelectorAll('[data-up],[data-down]').forEach(b => { b.onclick = () => changeBlocks(() => { const at = row.blocks.findIndex(r => r.id === (b.dataset.up || b.dataset.down)), next = at + (b.dataset.up ? -1 : 1); [row.blocks[at], row.blocks[next]] = [row.blocks[next], row.blocks[at]]; }); });
      root.querySelectorAll('[data-remove-block]').forEach(b => { b.onclick = () => { if (!confirm(t('mediaRemoveBlockConfirm'))) return; changeBlocks(() => { row.blocks = row.blocks.filter(r => r.id !== b.dataset.removeBlock); const used = new Set(row.blocks.filter(b => b.type === 'photo').map(b => b.photo)); row.photos = row.photos.filter(p => used.has(p.id)); }); }; });
      const addPhotos = photos => {
        syncForm(); const fresh = photos.filter(p => !row.photos.some(old => old.id === p.id));
        if (row.photos.length + fresh.length > 12 || row.blocks.length + fresh.length > MEDIA_LIMITS.blocks) throw mediaError('mediaCapacity');
        for (const photo of fresh) { row.photos.push(photo); row.blocks.push({ id: crypto.randomUUID(), type: 'photo', photo: photo.id, caption: '' }); }
        changed(); library = []; draw();
      };
      get(root, 'scrapbook-photos').onchange = async event => { const files = [...event.target.files]; try { const photos = await prepareImages(files); if (!disposed) addPhotos(photos); } catch (e) { if (!disposed) get(root, 'scrapbook-error').textContent = t(e.code || 'mediaInvalid'); } };
      get(root, 'choose-album').onclick = async () => { syncForm(); const gallery = createGalleryStore(); try { const all = await gallery.read(); if (!disposed) { library = all.filter(r => !r.deletedAt); draw(); if (!library.length) get(root, 'scrapbook-error').textContent = t('scrapbookAlbumEmpty'); } } catch (e) { if (!disposed) get(root, 'scrapbook-error').textContent = t(e.code || 'mediaReadFailed'); } finally { gallery.close(); } };
      root.querySelectorAll('[data-album-photo]').forEach(b => { b.onclick = () => { try { addPhotos([library.find(p => p.id === b.dataset.albumPhoto)]); } catch (e) { get(root, 'scrapbook-error').textContent = t(e.code); } }; });
      get(root, 'scrapbook-preview-details').ontoggle = event => { preview = event.target.open; if (preview) { syncForm(); updatePreview(); } };
      get(root, 'download-draft').onclick = async () => { syncForm(); try { downloadMedia(await exportMedia([row]), 'liubai-scrapbook-draft.backup.json'); } catch (e) { get(root, 'scrapbook-error').textContent = t(e.code || 'mediaInvalid'); } };
      get(root, 'discard-media-draft').onclick = async () => {
        if (!confirm(t('mediaDiscardDraftConfirm'))) return; clearTimeout(timer); await queue;
        try { if (token) await store.discardDraft(key, token); dirty = false; token = null; closeDialog(); } catch (e) { get(root, 'scrapbook-error').textContent = t(e.code); }
      };
      get(root, 'scrapbook-form').onsubmit = async event => {
        event.preventDefault(); if (busy) return; syncForm();
        if (!mediaText(row).trim() && !row.photos.length && !row.audio && !row.design?.stamps.length && !row.design?.strokes.length) { get(root, 'scrapbook-error').textContent = t('mediaEmpty'); return; }
        busy = true; root.inert = true; const submit = root.querySelector('[type="submit"]'); submit.disabled = true;
        try { await persist(); if (failure) throw mediaError(failure); await store.save(row, { expectedRevision: row.revision, draftId: key, draftToken: token }); dirty = false; token = null; busy = false; closeDialog(); await refresh(); toast(t('mediaSaved')); }
        catch (e) { if (!disposed) get(root, 'scrapbook-error').textContent = t(e.code || 'mediaWriteFailed'); }
        finally { busy = false; root.inert = false; if (submit.isConnected) submit.disabled = false; }
      };
      tools.mount(get(root,'scrapbook-tools-root'),{getRow:()=>row,setRow:next=>{row=next;},changed,draw,syncForm,url,history,recordings:state.entries.filter(r=>r.kind==='voice'&&!r.deletedAt)});
      for(const id of opened){const el=get(root,id);if(el)el.open=true;}if(root.closest('dialog'))root.closest('dialog').scrollTop=scroll;
      status();
    }
    const unload = event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    lifecycle({ guard: () => {root.querySelector('#scrapbook-tools-root')?.cancelCanvas?.();return !busy && (!dirty || confirm(t('mediaLeaveDraft')));}, dispose: () => {root.querySelector('#scrapbook-tools-root')?.cancelCanvas?.(); if (dirty) void persist(); disposed = true; clearTimeout(timer); clearURLs(); window.removeEventListener('beforeunload', unload); } });
    draw();
  }
  async function openVoice(existing = null) {
    clearURLs(); const root = shell('mediaVoice', 'voiceSub'); let disposed = false, busy = false, dirty = false, title = existing?.title || '', note = existing?.blocks.map(b => b.text || '').join('\n') || '', ready = existing, session = null, objectURL = null;
    const state = await store.read().catch(e => { if (root.isConnected) root.textContent = t(e.code || 'mediaReadFailed'); return null; }); if (!state || !root.isConnected || !root.closest('dialog')?.open) return;
    const controller = createVoiceRecorder({ store, getDraft: () => ({ title, note }), onChange: update });
    function setPlayer(blob) { if (objectURL) { URL.revokeObjectURL(objectURL); urls.delete(objectURL); } objectURL = url(blob); const player = get(root, 'voice-player'); wirePlayer(player, session?.durationMs || existing?.durationMs || 0); player.src = objectURL; player.hidden = false; }
    function update(s) {
      if (disposed) return;
      get(root, 'voice-state').textContent = t('voiceState' + s.status); get(root, 'voice-time').textContent = minute(s.durationMs);
      get(root, 'voice-error').textContent = s.error ? t(s.error) : '';
      get(root, 'voice-start').disabled = s.status !== 'idle'; get(root, 'voice-pause').disabled = !['recording','paused'].includes(s.status);
      get(root, 'voice-pause').textContent = t(s.status === 'paused' ? 'voiceResume' : 'voicePause'); get(root, 'voice-stop').disabled = !['recording','paused'].includes(s.status);
      get(root, 'voice-save').disabled = busy || s.status !== 'stopped' || !s.session?.bytes || !!s.failureBlob;
      get(root, 'voice-retry').hidden = !s.failureBlob;
      if (s.status === 'stopped' && (s.session?.bytes || s.failureBlob)) { session = s.session; setPlayer(s.failureBlob || new Blob(session.chunks, { type: session.mimeType })); get(root, 'voice-download').disabled = false; }
    }
    const pending = state.sessions;
    root.innerHTML = `<label for="voice-title">${t('mediaTitle')}</label><input id="voice-title" maxlength="120" value="${esc(title)}" placeholder="${t('voiceTitlePlaceholder')}">${existing ? '' : `<div class="voice-recorder"><div class="voice-mark" aria-hidden="true">◉</div><p class="voice-time" id="voice-time">00:00</p><p id="voice-state" role="status">${t('voiceStateidle')}</p><div class="dialog-actions"><button class="primary" id="voice-start">${t('voiceStart')}</button><button class="secondary" id="voice-pause" disabled>${t('voicePause')}</button><button class="secondary" id="voice-stop" disabled>${t('voiceStop')}</button></div></div>`}<audio id="voice-player" controls preload="metadata" ${existing ? `src="${url(existing.audio)}"` : 'hidden'}></audio><label for="voice-note">${t('voiceNote')}</label><textarea id="voice-note" maxlength="2000">${esc(note)}</textarea><p class="rule-note">${t('voiceLimits')}</p><p id="voice-error" role="alert"></p><button class="secondary" id="voice-retry" hidden>${t('voiceRetry')}</button><div class="dialog-actions"><button class="primary" id="voice-save" ${existing ? '' : 'disabled'}>${t('mediaSave')}</button><button class="secondary" id="voice-download" ${existing ? '' : 'disabled'}>${t('voiceDownload')}</button></div>${!existing && pending.length ? `<details id="voice-pending"><summary>${t('voicePending')} (${pending.length})</summary>${pending.map(s => `<div class="album-trash-row"><span>${esc(s.title || dateText(s.date))} · ${minute(s.durationMs)}</span><button class="secondary" data-recover-session="${s.id}">${t('voiceRecover')}</button><button class="text-button" data-discard-session="${s.id}">${t('voiceDiscard')}</button></div>`).join('')}</details>` : ''}`;
    get(root, 'voice-title').oninput = e => { title = e.target.value; dirty = true; }; get(root, 'voice-note').oninput = e => { note = e.target.value; dirty = true; };
    if (existing) wirePlayer(get(root, 'voice-player'), existing.durationMs);
    get(root, 'voice-retry').onclick = () => controller.retry();
    if (!existing) {
      get(root, 'voice-start').onclick = () => controller.start();
      get(root, 'voice-pause').onclick = () => controller.snapshot().status === 'paused' ? controller.resume() : controller.pause();
      get(root, 'voice-stop').onclick = () => controller.stop();
    }
    root.querySelectorAll('[data-recover-session]').forEach(b => { b.onclick = async () => {
      if (controller.snapshot().status !== 'idle' || session) { get(root, 'voice-error').textContent = t('voiceFinishFirst'); return; }
      try {
        const latest = (await store.read()).sessions.find(s => s.id === b.dataset.recoverSession); if (!latest) throw mediaError('mediaChanged');
        if (!latest.bytes) throw mediaError('voiceEmpty');
        if (latest.status === 'recording' && Date.now() - Date.parse(latest.updatedAt) < 30000) throw mediaError('voiceOtherTab');
        session = await store.stopSession(latest.id); title = session.title; note = session.note;
        get(root, 'voice-title').value = title; get(root, 'voice-note').value = note;
        get(root, 'voice-start').disabled = true; get(root, 'voice-save').disabled = false; get(root, 'voice-download').disabled = false;
        get(root, 'voice-state').textContent = t('voiceRecovered'); get(root, 'voice-time').textContent = minute(session.durationMs);
        setPlayer(new Blob(session.chunks, { type: session.mimeType })); get(root, 'voice-error').textContent = t('voicePartial');
      } catch (e) { get(root, 'voice-error').textContent = t(e.code || 'mediaReadFailed'); }
    }; });
    root.querySelectorAll('[data-discard-session]').forEach(b => { b.onclick = async () => {
      if (!confirm(t('voiceDiscardConfirm'))) return;
      try { await store.discardSession(b.dataset.discardSession); b.parentElement.remove(); } catch (e) { get(root, 'voice-error').textContent = t(e.code || 'mediaWriteFailed'); }
    }; });
    get(root, 'voice-download').onclick = () => { const blob = controller.snapshot().failureBlob || existing?.audio || (session && new Blob(session.chunks, { type: session.mimeType })); if (blob) downloadAudio(blob, existing?.id || session.id); };
    get(root, 'voice-save').onclick = async () => {
      if (busy) return; busy = true; root.inert = true; get(root, 'voice-save').disabled = true;
      try {
        if (!existing) {
          if (!session?.bytes) throw mediaError('voiceEmpty');
          session = await store.stopSession(session.id, { title, note });
          const blob = new Blob(session.chunks, { type: session.mimeType });
          ready = { ...newMedia('voice'), id: session.id, date: session.date, audio: blob, audioHash: await blobHash(blob), durationMs: session.durationMs };
        }
        ready = { ...ready, title, blocks: [{ id: ready.blocks[0]?.id || crypto.randomUUID(), type: 'text', text: note }] };
        await store.save(ready, { expectedRevision: existing?.revision || 0, sessionId: existing ? null : session.id });
        dirty = false; session = null; busy = false; closeDialog(); await refresh(); toast(t('mediaSaved'));
      } catch (e) { if (!disposed) get(root, 'voice-error').textContent = t(e.code || 'mediaWriteFailed'); }
      finally { busy = false; root.inert = false; if (!disposed) get(root, 'voice-save').disabled = false; }
    };
    const hidden = () => { if (document.hidden && ['recording','paused'].includes(controller.snapshot().status)) void controller.stop('voiceInterrupted'); };
    const unload = event => { if (busy || ['requesting','recording','paused','stopping'].includes(controller.snapshot().status) || dirty || controller.snapshot().failureBlob) { event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('beforeunload', unload);
    lifecycle({ guard: () => !busy && (!dirty && !controller.snapshot().failureBlob && !['requesting','recording','paused','stopping'].includes(controller.snapshot().status) || confirm(t('voiceLeave'))), dispose: () => {
      disposed = true; if (session && !existing) void store.stopSession(session.id, { title, note }).catch(() => {});
      void controller.dispose(); root.querySelectorAll('audio').forEach(a => a.pause()); clearURLs(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('beforeunload', unload);
    } });
  }
  async function openBackup() {
    clearURLs(); const root = shell('mediaBackupTitle', 'mediaBackupHelp'); let pending = null, busy = false, disposed = false;
    lifecycle({ guard: () => !busy, dispose: () => { disposed = true; } });
    try {
      const state = await store.read(); if (disposed || !root.isConnected) return;
      root.innerHTML = `<p class="section-sub">${t('mediaUsage', { n: state.entries.length, size: ((state.entries.reduce((n, r) => n + mediaBytes(r), 0) + state.sessions.reduce((n, s) => n + s.bytes, 0) + state.drafts.reduce((n, d) => n + mediaBytes(d.row), 0)) / 1048576).toFixed(2) })}</p><div class="dialog-actions"><button class="secondary" id="media-export">${t('mediaExport')}</button><label class="secondary file-button">${t('mediaImport')}<input type="file" id="media-import-file" accept=".json,application/json"></label></div><p id="media-import-preview" role="status"></p><button class="primary" id="media-import-confirm" disabled>${t('mediaImportConfirm')}</button><p id="media-backup-error" role="alert"></p>`;
      const act = async fn => { if (busy) return; busy = true; root.inert = true; try { await fn(); } catch (e) { if (!disposed) get(root, 'media-backup-error').textContent = t(e.code || 'mediaWriteFailed'); } finally { busy = false; root.inert = false; } };
      get(root, 'media-export').onclick = () => act(async () => { downloadMedia(await exportMedia((await store.read()).entries), 'liubai-scrapbook-voice.backup.json'); toast(t('exported')); });
      get(root, 'media-import-file').onchange = e => { const file = e.target.files[0]; pending = null; get(root, 'media-import-confirm').disabled = true; if (file) void act(async () => { pending = await parseMediaBackup(file); if (!disposed) { get(root, 'media-import-preview').textContent = t('mediaImportPreview', { n: pending.length }); get(root, 'media-import-confirm').disabled = false; } }); };
      get(root, 'media-import-confirm').onclick = () => act(async () => { if (!pending) return; await store.merge(pending); pending = null; get(root, 'media-import-confirm').disabled = true; await refresh(); get(root, 'media-import-preview').textContent = t('imported'); });
    } catch (e) { if (!disposed) root.textContent = t(e.code || 'mediaReadFailed'); }
  }
  function mountTrash(root) {
    let disposed = false;
    async function draw() {
      try {
        const all = (await store.read()).entries, rows = all.filter(r => r.deletedAt && Date.now() - Date.parse(r.deletedAt) < 30 * 86400000);
        if (disposed) return;
        root.innerHTML = `<h3>${t('mediaTrashTitle')}</h3><p class="rule-note">${t('mediaTrashHelp')}</p><p id="media-trash-error" role="alert"></p>${rows.length ? rows.map(r => `<article class="recovery-row"><p>${esc(r.title || mediaText(r).slice(0, 80) || kindName(r))}</p><div class="dialog-actions"><button class="secondary" data-rich-restore="${r.id}">${t('recoveryRestore')}</button><button class="text-button" data-rich-purge="${r.id}">${t('recoveryPurge')}</button></div></article>`).join('') : `<p class="section-sub">${t('recoveryEmpty')}</p>`}`;
        root.querySelectorAll('[data-rich-restore],[data-rich-purge]').forEach(b => { b.onclick = async () => {
          const id = b.dataset.richRestore || b.dataset.richPurge, row = rows.find(r => r.id === id);
          if (b.dataset.richPurge && !confirm(t('recoveryPurgeConfirm'))) return; b.disabled = true;
          try { await store[b.dataset.richRestore ? 'restore' : 'purge'](id, row.revision); await refresh(); await draw(); }
          catch (e) { if (!disposed) { get(root, 'media-trash-error').textContent = t(e.code || 'mediaWriteFailed'); b.disabled = false; } }
        }; });
      } catch (e) { if (!disposed) root.textContent = t(e.code || 'mediaReadFailed'); }
    }
    void draw(); return () => { disposed = true; };
  }
  return { books:()=>tools.list().books, entryCard, openEntry, openScrapbook, openVoice, openBackup, mountTrash, clearURLs, clearCards: () => { cardURLs.forEach(value => URL.revokeObjectURL(value)); cardURLs.clear(); } };
}
