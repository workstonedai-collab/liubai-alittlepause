// Pure local filtering. Search text is never written to storage or sent anywhere.
export function filterJournal(entries, { mood = 'all', query = '', tagText = tag => tag } = {}) {
  const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase().trim();
  const terms = normalize(query).split(/\s+/u).filter(Boolean);
  return entries.filter(entry => (mood === 'all' || entry.mood === Number(mood)) &&
    terms.every(term => normalize([entry.text, ...entry.tags.map(tagText)].join(' ')).includes(term)))
    .sort((a, b) => b.date.localeCompare(a.date));
}
