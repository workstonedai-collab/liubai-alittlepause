import { TAG_IDS } from '../../packages/data-contract/index.js';
// Read-only projection of already validated local sources. Media never enters
// the legacy journal store, owner sync queue or AI context through this adapter.
export function projectMoodRecords(legacy, media) {
  return [...legacy, ...media.filter(r => !r.deletedAt && r.mood !== null)]
    .map((r, i) => ({ id: `mood-${i}`, date: r.date, mood: r.mood, tags: [...r.tags], text: '' }));
}
export function mediaSummary(entries, { dayKey }) {
  return { entryCount: entries.length, dayCount: new Set(entries.map(e => dayKey(e.date))).size,
    tags: TAG_IDS.map(tag => ({ tag, count: entries.filter(e => e.tags.includes(tag)).length })).filter(t => t.count).sort((a, b) => b.count - a.count) };
}
export function mediaDailyTrend(entries, { dayKey, now = new Date(), days = 7 }) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now); date.setDate(date.getDate() - days + 1 + i);
    const group = entries.filter(e => dayKey(e.date) === dayKey(date));
    return { date, count: group.length, value: group.length ? group.reduce((n, e) => n + e.mood, 0) / group.length : null };
  });
}
