import { validateData, TAG_IDS } from '../data-contract/index.js';

function checked(entries) { return validateData({ version: 1, entries, careCount: 0 }).entries; }
export function summarizeJournal(entries, { dayKey } = {}) {
  if (typeof dayKey !== 'function') throw Error('A platform day-key formatter is required');
  const records = checked(entries);
  return { entryCount: records.length, dayCount: new Set(records.map(entry => dayKey(entry.date))).size,
    tags: TAG_IDS.map(tag => ({ tag, count: records.filter(entry => entry.tags.includes(tag)).length }))
      .filter(row => row.count).sort((a, b) => b.count - a.count) };
}
export function dailyTrend(entries, { dayKey, now = new Date(), days = 7 } = {}) {
  if (typeof dayKey !== 'function' || !Number.isInteger(days) || days < 1 || days > 31) throw Error('Invalid trend options');
  const records = checked(entries);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now); date.setDate(date.getDate() - days + 1 + i);
    const group = records.filter(entry => dayKey(entry.date) === dayKey(date));
    return { date, count: group.length, value: group.length ? group.reduce((sum, entry) => sum + entry.mood, 0) / group.length : null };
  });
}
