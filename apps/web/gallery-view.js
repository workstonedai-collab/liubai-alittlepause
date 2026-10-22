import { scopedName } from './account-scope.js';
import { createGalleryStore } from './gallery-store.js';
import { prepareImages, parseGalleryBackup, exportGallery } from './gallery-files.js';

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function mountGallery(root, { t, esc }) {
  let rows = [], staged = [], incoming = null, selected = null, busy = false, disposed = false, readable = false;
  let message = 'galleryLoading', values = {}, error = '', confirm = null, timer = null, playing = false, loadVersion = 0, operation = 0, trashOpen = false;
  const urls = new Set(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const channel = globalThis.BroadcastChannel ? new BroadcastChannel(scopedName('liubai-gallery-changes-v1')) : null;
  const store = createGalleryStore({ notify: () => channel?.postMessage({ changed: true }) });
  const pictures = () => rows.filter(row => !row.deletedAt);
  const pause = () => { clearInterval(timer); timer = null; playing = false; };
  const objectURL = blob => { const url = URL.createObjectURL(blob); urls.add(url); return url; };
  const clearURLs = () => { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); };
  const photo = (item, main = false) => `<img src="${objectURL(item.blob)}" alt="${esc(item.name)}" width="${item.width}" height="${item.height}" decoding="async" ${main ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
  const button = (id, label, disabled = false) => `<button class="secondary" id="${id}" ${disabled ? 'disabled' : ''}>${t(label)}</button>`;
  function render() {
    if (disposed) return;
    const focus = root.contains(document.activeElement) ? document.activeElement.id : null;
    clearURLs(); const active = pictures(); if (!active.some(row => row.id === selected)) selected = active[0]?.id || null;
    const current = active.find(row => row.id === selected), index = active.findIndex(row => row.id === selected), trash = rows.filter(row => row.deletedAt);
    root.innerHTML = `<p class="badge">${t('galleryPrivacy')}</p><p class="rule-note album-note">${t('galleryLimits')}</p><p class="rule-note album-note">${t('galleryBackupNote')}</p>
      <p id="gallery-status" role="status">${t(message, values)}</p><p id="gallery-error" role="alert">${t(error)}</p>
      <div class="album-tools"><label class="secondary file-button">${t('gallerySelect')}<input id="gallery-files" type="file" accept="image/jpeg,image/png,image/webp" multiple ${busy || !readable ? 'disabled' : ''}></label>${button('gallery-retry', 'galleryRetry', busy)}${button('gallery-export', 'galleryExport', busy || !readable)}<label class="secondary file-button">${t('galleryImport')}<input id="gallery-import" type="file" accept="application/json,.json" ${busy || !readable ? 'disabled' : ''}></label></div>
      <p class="section-sub">${t('galleryCount', { n: active.length, size: (rows.reduce((sum, row) => sum + row.blob.size, 0) / 1048576).toFixed(2) })}</p>
      ${staged.length ? `<section class="panel album-staged"><h2>${t('galleryPreview')}</h2><div class="album-thumbs">${staged.map(item => `<figure>${photo(item)}<figcaption>${esc(item.name)}</figcaption></figure>`).join('')}</div><div class="dialog-actions">${button('gallery-save', 'gallerySave', busy || !readable)}${button('gallery-discard', 'galleryDiscard', busy)}</div></section>` : ''}
      ${incoming ? `<section class="panel"><p>${t('galleryImportHelp', { n: incoming.length })}</p><div class="dialog-actions">${button('gallery-merge', 'galleryImportConfirm', busy || !readable)}${button('gallery-import-cancel', 'galleryCancel', busy)}</div></section>` : ''}
      ${current ? `<section class="panel album-view"><figure id="gallery-stage" class="album-frame" tabindex="0" role="group" aria-roledescription="carousel" aria-label="${t('galleryPosition', { n: index + 1, total: active.length })}">${photo(current, true)}<figcaption>${esc(current.name)}</figcaption></figure>
        <p id="gallery-position" aria-live="${playing ? 'off' : 'polite'}">${t('galleryPosition', { n: index + 1, total: active.length })}</p><div class="album-tools">${button('gallery-prev', 'galleryPrevious', busy || active.length < 2)}${button('gallery-next', 'galleryNext', busy || active.length < 2)}${button('gallery-play', playing ? 'galleryPause' : 'galleryPlay', busy || reduced.matches || active.length < 2)}${button('gallery-download', 'galleryDownloadImage', busy)}${button('gallery-remove', 'galleryRemove', busy || !readable)}</div>${reduced.matches ? `<p class="rule-note">${t('galleryReduced')}</p>` : ''}
        <div class="album-thumbs">${active.map((item, i) => `<button class="album-thumb" id="gallery-thumb-${i}" data-picture="${item.id}" aria-label="${t('galleryPosition', { n: i + 1, total: active.length })} ${esc(item.name)}" aria-pressed="${item.id === selected}">${photo(item)}</button>`).join('')}</div></section>` : `<section class="panel empty"><h2>${t('galleryEmpty')}</h2><p>${t('galleryEmptySub')}</p></section>`}
      ${confirm ? `<section class="panel album-confirm" role="group"><p>${t(confirm.op === 'purge' ? 'galleryPurgeHelp' : 'galleryRemoveHelp')}</p><p>${esc(rows.find(row => row.id === confirm.id)?.name || '')}</p><div class="dialog-actions">${button('gallery-confirm', confirm.op === 'purge' ? 'galleryConfirmPurge' : 'galleryConfirmRemove', busy || !readable)}${button('gallery-confirm-cancel', 'galleryCancel', busy)}</div></section>` : ''}
      <details id="gallery-trash" ${trashOpen ? 'open' : ''}><summary>${t('galleryTrash')} (${trash.length})</summary>${trash.map(row => `<div class="album-trash-row"><span>${esc(row.name)}</span><button class="secondary" data-restore="${row.id}" ${busy || !readable ? 'disabled' : ''}>${t('galleryRestore')}</button><button class="text-button" data-purge="${row.id}" ${busy || !readable ? 'disabled' : ''}>${t('galleryPurge')}</button></div>`).join('')}</details>`;
    const get = id => root.querySelector('#' + id);
    get('gallery-files').onchange = event => process(async () => { const prepared = await prepareImages([...event.target.files]); if (!disposed) { staged = prepared; incoming = null; } }, 'galleryPreparing');
    get('gallery-import').onchange = event => { const file = event.target.files[0]; if (file) process(async () => { const parsed = await parseGalleryBackup(file); if (!disposed) { incoming = parsed; staged = []; } }, 'galleryPreparing'); };
    get('gallery-retry').onclick = () => refresh();
    get('gallery-export').onclick = () => process(async () => { const all = await store.read(); const blob = await exportGallery(all); if (!disposed) saveBlob(blob, 'liubai-private-album.json'); message = 'galleryExported'; }, 'gallerySaving');
    if (get('gallery-save')) get('gallery-save').onclick = () => process(async () => { const result = await store.add(staged); staged = []; message = 'galleryDone'; values = { n: result.added, skipped: result.skipped }; await reload(); });
    if (get('gallery-discard')) get('gallery-discard').onclick = () => { staged = []; render(); };
    if (get('gallery-merge')) get('gallery-merge').onclick = () => process(async () => { const result = await store.add(incoming); incoming = null; message = 'galleryImported'; values = { n: result.added, skipped: result.skipped }; await reload(); });
    if (get('gallery-import-cancel')) get('gallery-import-cancel').onclick = () => { incoming = null; render(); };
    if (current) {
      get('gallery-prev').onclick = () => step(-1); get('gallery-next').onclick = () => step(1);
      get('gallery-play').onclick = () => {
        if (busy || reduced.matches || active.length < 2) return;
        if (playing) pause(); else { playing = true; timer = setInterval(() => step(1, true), 10000); } render();
      };
      get('gallery-download').onclick = () => saveBlob(current.blob, `liubai-picture-${current.id.slice(0, 8)}.${current.blob.type.split('/')[1]}`);
      get('gallery-remove').onclick = () => { pause(); confirm = { op: 'remove', id: current.id }; render(); get('gallery-confirm').focus(); };
      get('gallery-stage').onkeydown = event => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); if (busy) return; pause();
          if (event.key === 'Home' || event.key === 'End') { selected = active[event.key === 'Home' ? 0 : active.length - 1].id; render(); }
          else step(event.key === 'ArrowLeft' ? -1 : 1);
        }
      };
    }
    root.querySelectorAll('[data-picture]').forEach(el => { el.onclick = () => { pause(); selected = el.dataset.picture; render(); }; });
    root.querySelectorAll('[data-restore]').forEach(el => { el.onclick = () => process(async () => { await store.restore(el.dataset.restore); await reload(); }); });
    root.querySelectorAll('[data-purge]').forEach(el => { el.onclick = () => { pause(); confirm = { op: 'purge', id: el.dataset.purge }; render(); get('gallery-confirm').focus(); }; });
    if (get('gallery-confirm')) get('gallery-confirm').onclick = () => process(async () => { await store[confirm.op](confirm.id); confirm = null; await reload(); });
    if (get('gallery-confirm-cancel')) get('gallery-confirm-cancel').onclick = () => { confirm = null; render(); };
    get('gallery-trash').ontoggle = event => { trashOpen = event.target.open; };
    if (focus && get(focus)) get(focus).focus({ preventScroll: true });
  }
  function step(direction, automatic = false) {
    if (busy || document.hidden || (automatic && reduced.matches)) { pause(); return; }
    if (!automatic) pause(); const active = pictures(), index = active.findIndex(row => row.id === selected);
    if (active.length) selected = active[(index + direction + active.length) % active.length].id; render();
  }
  async function reload() { const version = ++loadVersion, all = await store.read(); if (!disposed && version === loadVersion) { rows = all; readable = true; } }
  async function refresh() {
    if (busy) return; pause(); busy = true; error = ''; message = 'galleryLoading'; render();
    try { await reload(); message = ''; } catch (failure) { readable = false; error = failure.code || 'galleryReadFailed'; }
    finally { if (!disposed) { busy = false; render(); } }
  }
  async function process(task, starting = 'gallerySaving') {
    if (busy || disposed) return; pause(); busy = true; error = ''; message = starting; values = {}; render(); const version = ++operation;
    try { await task(); if (message === starting) message = ''; }
    catch (failure) { error = failure.code || 'galleryWriteFailed'; message = ''; }
    finally { if (!disposed && version === operation) { busy = false; render(); } }
  }
  let deferredRefresh = false;
  if (channel) channel.onmessage = () => { pause(); if (busy) deferredRefresh = true; else void refresh(); };
  // Fallback for browsers without BroadcastChannel; also re-check when returning to a tab.
  const visible = () => { if (document.hidden) { pause(); render(); } else if (!busy) void refresh(); else deferredRefresh = true; };
  const preference = () => { pause(); render(); };
  document.addEventListener('visibilitychange', visible); reduced.addEventListener('change', preference);
  async function checkExternal() {
    const version = ++loadVersion;
    try {
      const all = await store.read(); if (disposed || busy || version !== loadVersion) return;
      const signature = items => JSON.stringify(items.map(item => [item.id, item.deletedAt, item.name, item.blob.size]));
      if (signature(all) !== signature(rows)) { pause(); rows = all; readable = true; render(); }
    } catch (failure) { if (!disposed && !busy) { readable = false; pause(); error = failure.code || 'galleryReadFailed'; render(); } }
  }
  const fallback = setInterval(() => {
    if (document.hidden || busy) return;
    if (deferredRefresh) { deferredRefresh = false; void refresh(); }
    else if (!channel) void checkExternal();
  }, 3000);
  void refresh();
  return () => { disposed = true; operation++; loadVersion++; pause(); clearInterval(fallback); clearURLs(); channel?.close(); store.close(); document.removeEventListener('visibilitychange', visible); reduced.removeEventListener('change', preference); staged = []; incoming = null; };
}
