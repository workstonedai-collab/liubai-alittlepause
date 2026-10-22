import { JournalError, validateData, cloneData } from '../data-contract/index.js';

const fail = code => { throw new JournalError(code); };
export function validateAIRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('|') !== 'action|consent|entry|locale|version') fail('invalidAIRequest');
  if (value.version !== 1) fail('unsupportedVersion');
  if (value.consent !== true) fail('aiConsentRequired');
  if (!['brief-response', 'rephrase'].includes(value.action) || !['zh', 'en'].includes(value.locale)) fail('invalidAIRequest');
  validateData({ version: 1, entries: [value.entry], careCount: 0 });
  if (!value.entry.text.trim()) fail('aiTextRequired');
  return cloneData(value);
}
export function makeAIRequest(entry, action, { enabled = false, consent = false, locale = 'zh' } = {}) {
  if (!enabled) fail('aiDisabled');
  return validateAIRequest({ version: 1, action, consent, entry, locale });
}
// This is an in-memory UI rehearsal. It has no transport, history, vendor or key access.
export function mockAI(request) {
  const { entry, action, locale } = validateAIRequest(request);
  const text = action === 'rephrase'
    ? (locale === 'zh' ? '本地演示改写预览：' : 'Local mock rewrite preview: ') + entry.text.slice(0, 400)
    : locale === 'zh' ? '本地演示回应：这份感受可以先被记下来。按自己的节奏，想休息时再停一会儿。'
      : 'Local mock response: you can leave this feeling here. Continue at your own pace, and pause if you want.';
  return { version: 1, mode: 'mock', action, entryId: entry.id, text, originalPreserved: true };
}
