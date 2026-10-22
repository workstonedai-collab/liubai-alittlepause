export const GALLERY_LIMITS = Object.freeze({ inputBytes: 5 * 1024 * 1024, blobBytes: 2 * 1024 * 1024,
  totalBytes: 25 * 1024 * 1024, backupBytes: 36 * 1024 * 1024, count: 40, batch: 10, sourceEdge: 10000, sourcePixels: 24000000, edge: 1600 });
export const galleryError = code => Object.assign(new Error(code), { code });
const fail = code => { throw galleryError(code); };
const types = ['image/jpeg', 'image/png', 'image/webp'];
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
export function imageDimensions(bytes, type) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), text = (start, count) => String.fromCharCode(...bytes.slice(start, start + count));
  try {
    if (type === 'image/png' && bytes.length >= 24 && bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' && text(12, 4) === 'IHDR') {
      // Reject APNG; normalized storage must contain static pictures only.
      let cursor = 8;
      while (cursor + 12 <= bytes.length) { const size = view.getUint32(cursor); if (text(cursor + 4, 4) === 'acTL') fail('galleryFormat'); cursor += size + 12; }
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
      let cursor = 2;
      while (cursor + 4 < bytes.length) {
        if (bytes[cursor++] !== 255) break;
        while (bytes[cursor] === 255) cursor++;
        const marker = bytes[cursor++]; if (marker === 217 || marker === 218) break;
        const size = view.getUint16(cursor); if (size < 2) break;
        if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) return { height: view.getUint16(cursor + 3), width: view.getUint16(cursor + 5) };
        cursor += size;
      }
    }
    if (type === 'image/webp' && bytes.length >= 25 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
      const kind = text(12, 4), little24 = start => bytes[start] + bytes[start + 1] * 256 + bytes[start + 2] * 65536;
      if (kind === 'VP8X') { if (bytes[20] & 2) fail('galleryFormat'); return { width: little24(24) + 1, height: little24(27) + 1 }; }
      if (kind === 'VP8L' && bytes[20] === 47) { const bits = view.getUint32(21, true); return { width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 }; }
      if (kind === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) return { width: view.getUint16(26, true) & 16383, height: view.getUint16(28, true) & 16383 };
    }
  } catch (error) { if (error.code) throw error; }
  fail('galleryFormat');
}
export function checkDimensions({ width, height }, normalized = false) {
  const edge = normalized ? GALLERY_LIMITS.edge : GALLERY_LIMITS.sourceEdge;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > edge || height > edge || width * height > GALLERY_LIMITS.sourcePixels) fail('galleryDimensions');
}
export function checkCapacity(items) {
  if (items.length > GALLERY_LIMITS.count || items.reduce((sum, item) => sum + item.blob.size, 0) > GALLERY_LIMITS.totalBytes) fail('galleryCapacity');
}
export function validateImageRecord(item) {
  if (!item || Object.keys(item).sort().join('|') !== 'addedAt|blob|deletedAt|height|id|name|width' || !/^[a-f0-9]{64}$/.test(item.id) ||
      typeof item.name !== 'string' || item.name.length > 120 || /[\x00-\x1f]/.test(item.name) || !date(item.addedAt) ||
      (item.deletedAt !== null && !date(item.deletedAt)) || !(item.blob instanceof Blob) || !types.includes(item.blob.type) || item.blob.size < 1 || item.blob.size > GALLERY_LIMITS.blobBytes) fail('galleryBackupInvalid');
  checkDimensions(item, true); return item;
}
export async function blobHash(blob) {
  if (!globalThis.crypto?.subtle) fail('galleryUnsupported');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function bitmap(blob) {
  if (globalThis.createImageBitmap) { try { return await createImageBitmap(blob); } catch { fail('galleryDecode'); } }
  if (!globalThis.Image || !globalThis.URL?.createObjectURL) fail('galleryUnsupported');
  const image = new Image(), url = URL.createObjectURL(blob);
  try { await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(galleryError('galleryDecode')); image.src = url; });
    return { width: image.naturalWidth, height: image.naturalHeight, image, close() {} };
  } finally { URL.revokeObjectURL(url); }
}
export async function prepareImages(files) {
  if (!files.length || files.length > GALLERY_LIMITS.batch) fail('galleryBatch');
  const records = [];
  for (const file of files) {
    if (file.size > GALLERY_LIMITS.inputBytes) fail('galleryFileLarge');
    if (!types.includes(file.type)) fail('galleryFormat');
    let bytes; try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { fail('galleryDecode'); }
    checkDimensions(imageDimensions(bytes, file.type));
    const source = await bitmap(file);
    try {
      checkDimensions(source); const ratio = Math.min(1, GALLERY_LIMITS.edge / Math.max(source.width, source.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(source.width * ratio)); canvas.height = Math.max(1, Math.round(source.height * ratio));
      const context = canvas.getContext('2d'); if (!context) fail('galleryUnsupported');
      context.drawImage(source.image || source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .85));
      if (!blob) fail('galleryDecode'); if (blob.size > GALLERY_LIMITS.blobBytes) fail('galleryFileLarge');
      records.push(validateImageRecord({ id: await blobHash(blob), blob, width: canvas.width, height: canvas.height,
        name: String(file.name || 'picture').replace(/[\x00-\x1f]/g, '').slice(0, 120), addedAt: new Date().toISOString(), deletedAt: null }));
      canvas.width = canvas.height = 0;
    } finally { source.close(); }
  }
  return records;
}
export async function exportGallery(items) {
  checkCapacity(items); const records = [];
  for (const item of items) {
    validateImageRecord(item); let binary = ''; const bytes = new Uint8Array(await item.blob.arrayBuffer());
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const { blob, ...metadata } = item; records.push({ ...metadata, type: blob.type, base64: btoa(binary) });
  }
  const output = new Blob([JSON.stringify({ schema: 'liubai-private-gallery', version: 1, exportedAt: new Date().toISOString(), images: records })], { type: 'application/json' });
  if (output.size > GALLERY_LIMITS.backupBytes) fail('galleryFileLarge'); return output;
}
export async function parseGalleryBackup(file) {
  if (file.size > GALLERY_LIMITS.backupBytes) fail('galleryFileLarge');
  try {
    const data = JSON.parse(await file.text());
    if (Object.keys(data).sort().join('|') !== 'exportedAt|images|schema|version' || data.schema !== 'liubai-private-gallery' || data.version !== 1 || !date(data.exportedAt) || !Array.isArray(data.images) || data.images.length > GALLERY_LIMITS.count) fail('galleryBackupInvalid');
    const records = [], ids = new Set(); let size = 0;
    for (const image of data.images) {
      if (!image || Object.keys(image).sort().join('|') !== 'addedAt|base64|deletedAt|height|id|name|type|width' || !types.includes(image.type) || typeof image.base64 !== 'string' || image.base64.length > Math.ceil(GALLERY_LIMITS.blobBytes / 3) * 4 || image.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.base64)) fail('galleryBackupInvalid');
      const { base64, type, ...metadata } = image, bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)), blob = new Blob([bytes], { type });
      const item = validateImageRecord({ ...metadata, blob }); size += blob.size;
      if (size > GALLERY_LIMITS.totalBytes || ids.has(item.id) || await blobHash(blob) !== item.id) fail('galleryBackupInvalid');
      const dimensions = imageDimensions(bytes, type); if (dimensions.width !== item.width || dimensions.height !== item.height) fail('galleryBackupInvalid');
      const decoded = await bitmap(blob); decoded.close(); ids.add(item.id); records.push(item);
    }
    return records;
  } catch (error) { if (error.code === 'galleryUnsupported') throw error; fail('galleryBackupInvalid'); }
}
