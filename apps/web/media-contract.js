import { validateDesign, SCRAPBOOK_TEMPLATES } from './scrapbook-design.js';
import { TAG_IDS } from '../../packages/data-contract/index.js';
import { validateImageRecord, blobHash, imageDimensions } from './gallery-files.js';

export const MEDIA_LIMITS = Object.freeze({ entries: 200, photos: 6, blocks: 24, text: 10000,
  audioBytes: 10 * 1048576, audioMs: 600000, totalBytes: 50 * 1048576, backupBytes: 80 * 1048576 });
export const mediaError = code => Object.assign(new Error(code), { code });
const fail = code => { throw mediaError(code); };
const keys = (value, expected) => {
  if (!value || Array.isArray(value) || Object.keys(value).sort().join() !== [...expected].sort().join()) fail('mediaInvalid');
};
export const validMediaDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
export const validAudioType = value => typeof value === 'string' && /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a)(;\s*codecs=[a-zA-Z0-9.,_-]+)?$/.test(value);
export function mediaBytes(row) { return (row.audio?.size || 0) + row.photos.reduce((n, p) => n + p.blob.size, 0); }
export function validateMedia(row, { draft = false } = {}) {
  keys(row, ['id','kind','title','date','updatedAt','revision','deletedAt','mood','tags','template','blocks','photos','audio','audioHash','durationMs',...(Object.hasOwn(row||{},'design')?['design']:[])]);
  if (!validId(row.id) || !['scrapbook', 'voice'].includes(row.kind) || typeof row.title !== 'string' || row.title.length > 120 ||
    !validMediaDate(row.date) || !validMediaDate(row.updatedAt) || !Number.isSafeInteger(row.revision) || row.revision < 0 ||
    (row.deletedAt !== null && !validMediaDate(row.deletedAt)) || (row.mood !== null && (!Number.isInteger(row.mood) || row.mood < 0 || row.mood > 4)) ||
    !Array.isArray(row.tags) || row.tags.length > TAG_IDS.length || row.tags.some(t => !TAG_IDS.includes(t)) || new Set(row.tags).size !== row.tags.length ||
    !SCRAPBOOK_TEMPLATES.some(t=>t.id===row.template) || !Array.isArray(row.blocks) || row.blocks.length > MEDIA_LIMITS.blocks ||
    !Array.isArray(row.photos) || row.photos.length > (row.design ? 12 : MEDIA_LIMITS.photos)) fail('mediaInvalid');
  const ids = new Set(), used = new Set(); let length = 0;
  for (const photo of row.photos) { validateImageRecord(photo); if (photo.deletedAt || ids.has(photo.id)) fail('mediaInvalid'); ids.add(photo.id); }
  const blockIds = new Set();
  for (const block of row.blocks) {
    if (!validId(block.id) || blockIds.has(block.id)) fail('mediaInvalid'); blockIds.add(block.id);
    if (block.type === 'text') { keys(block, ['id','type','text']); if (typeof block.text !== 'string') fail('mediaInvalid'); length += block.text.length; }
    else if (block.type === 'photo') { keys(block, ['id','type','photo','caption']); if (!ids.has(block.photo) || (!row.design && used.has(block.photo)) || typeof block.caption !== 'string' || block.caption.length > 500) fail('mediaInvalid'); used.add(block.photo); length += block.caption.length; }
    else fail('mediaInvalid');
  }
  if (length > MEDIA_LIMITS.text || used.size !== ids.size) fail('mediaInvalid');
  if (row.design) { if(row.kind!=='scrapbook')fail('mediaInvalid');try{validateDesign(row.design,row.blocks);}catch{fail('mediaInvalid');} }
  if (row.kind === 'scrapbook') {
    if (!row.design && (row.audio !== null || row.audioHash !== null || row.durationMs !== 0)) fail('mediaInvalid');
    if (row.audio!==null && (!(row.audio instanceof Blob)||!validAudioType(row.audio.type)||row.audio.size<1||row.audio.size>MEDIA_LIMITS.audioBytes||!/^[a-f0-9]{64}$/.test(row.audioHash)))fail('mediaInvalid');
    if(row.audio===null&&(row.audioHash!==null||row.durationMs!==0))fail('mediaInvalid');
  } else if ((!draft || row.audio !== null) && (!(row.audio instanceof Blob) || !validAudioType(row.audio.type) || row.audio.size < 1 || row.audio.size > MEDIA_LIMITS.audioBytes || !/^[a-f0-9]{64}$/.test(row.audioHash))) fail('mediaInvalid');
  if (!Number.isFinite(row.durationMs) || row.durationMs < 0 || row.durationMs > MEDIA_LIMITS.audioMs || (row.kind === 'voice' && row.photos.length)) fail('mediaInvalid');
  return structuredClone(row);
}
export function checkMediaCapacity(entries, sessions = [], drafts = []) {
  if (entries.length > MEDIA_LIMITS.entries || sessions.length > 10 || drafts.length > 20 ||
    entries.reduce((n, r) => n + mediaBytes(r), 0) + sessions.reduce((n, r) => n + r.bytes, 0) + drafts.reduce((n, r) => n + mediaBytes(r.row), 0) > MEDIA_LIMITS.totalBytes) fail('mediaCapacity');
}
export function newMedia(kind) {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), kind, title: '', date: now, updatedAt: now, revision: 0, deletedAt: null,
    mood: null, tags: [], template: 'plain', blocks: [{ id: crypto.randomUUID(), type: 'text', text: '' }], photos: [], audio: null, audioHash: null, durationMs: 0 };
}
export const mediaText = row => [row.title, ...row.blocks.map(b => b.type === 'text' ? b.text : b.caption)].join('\n');
export function mediaSignature(row) {
  return JSON.stringify([row.id,row.kind,row.title,row.date,row.updatedAt,row.revision,row.deletedAt,row.mood,[...row.tags].sort(),row.template,
    row.blocks.map(b => b.type === 'text' ? [b.id,b.type,b.text] : [b.id,b.type,b.photo,b.caption]),
    row.photos.map(p => [p.id,p.name,p.width,p.height,p.addedAt,p.blob.type,p.blob.size]),row.audioHash,row.audio?.type,row.audio?.size,row.durationMs,row.design||null]);
}
async function encode(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return { type: blob.type, base64: btoa(binary), sha256: await blobHash(blob) };
}
async function decode(value, max) {
  keys(value, ['type','base64','sha256']);
  if (typeof value.type !== 'string' || typeof value.base64 !== 'string' || value.base64.length > Math.ceil(max / 3) * 4 || value.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.base64) || !/^[a-f0-9]{64}$/.test(value.sha256)) fail('mediaInvalid');
  const blob = new Blob([Uint8Array.from(atob(value.base64), c => c.charCodeAt(0))], { type: value.type });
  if (!blob.size || blob.size > max || await blobHash(blob) !== value.sha256) fail('mediaInvalid');
  return blob;
}
export async function exportMedia(entries) {
  checkMediaCapacity(entries); const rows = [];
  for (const source of entries) {
    const row = validateMedia(source); row.photos = await Promise.all(row.photos.map(async p => { const encoded = await encode(p.blob); if (encoded.sha256 !== p.id) fail('mediaInvalid'); return { ...p, blob: encoded }; }));
    if (row.audio) { row.audio = await encode(row.audio); if (row.audio.sha256 !== row.audioHash) fail('mediaInvalid'); } rows.push(row);
  }
  const blob = new Blob([JSON.stringify({ schema: 'liubai-local-media', version: entries.some(r=>r.design)?2:1, exportedAt: new Date().toISOString(), entries: rows })], { type: 'application/json' });
  if (blob.size > MEDIA_LIMITS.backupBytes) fail('mediaCapacity'); return blob;
}
export async function parseMediaBackup(file) {
  if (file.size > MEDIA_LIMITS.backupBytes) fail('mediaCapacity');
  try {
    const data = JSON.parse(await file.text()); keys(data, ['schema','version','exportedAt','entries']);
    if (data.schema !== 'liubai-local-media' || ![1,2].includes(data.version) || !validMediaDate(data.exportedAt) || !Array.isArray(data.entries) || data.entries.length > MEDIA_LIMITS.entries) fail('mediaInvalid');
    const ids = new Set(), result = []; let bytes = 0;
    for (const row of data.entries) {
      if (!Array.isArray(row.photos) || row.photos.length > (row.design ? 12 : MEDIA_LIMITS.photos)) fail('mediaInvalid');
      row.photos = await Promise.all(row.photos.map(async p => {
        const blob = await decode(p.blob, 2 * 1048576);
        if (await blobHash(blob) !== p.id) fail('mediaInvalid');
        const size = imageDimensions(new Uint8Array(await blob.arrayBuffer()), blob.type);
        if (size.width !== p.width || size.height !== p.height) fail('mediaInvalid');
        return { ...p, blob };
      }));
      if (row.audio) { row.audio = await decode(row.audio, MEDIA_LIMITS.audioBytes); if (await blobHash(row.audio) !== row.audioHash) fail('mediaInvalid'); }
      validateMedia(row); if (ids.has(row.id)) fail('mediaInvalid'); ids.add(row.id);
      bytes += mediaBytes(row); if (bytes > MEDIA_LIMITS.totalBytes) fail('mediaCapacity'); result.push(row);
    }
    return result;
  } catch (error) { if (error.code === 'mediaCapacity') throw error; fail('mediaInvalid'); }
}
