export const QUOTE_KEY = 'liubai.daily-quotes.v1';
// Original bilingual lines written for this app; no attributed quotations or mood inference.
export const LEGACY_QUOTES = [
  ['今天不必解释所有感受。', 'You do not have to explain every feeling today.'],
  ['有些时刻，留一点空白就够了。', 'Sometimes a little space is enough.'],
  ['慢一点，也是一种自己的节奏。', 'A slower pace can still be your own.'],
  ['没写下来的日子，也属于你的生活。', 'Days you do not write about are part of your life too.'],
  ['休息可以没有理由。', 'Rest does not need a reason.'],
  ['一杯水、一扇窗，也能陪你片刻。', 'A glass of water or an open window can keep you company.'],
  ['此刻的你，不需要成为另一个人。', 'You do not need to become someone else right now.'],
  ['不确定的心情，也有可以停靠的地方。', 'Uncertain feelings can have a place to rest.'],
  ['今天的边界，可以由你来定。', 'You can choose your boundaries today.'],
  ['一件小事，可以只是一件小事。', 'A small thing can simply be a small thing.'],
  ['想说的时候再说，想停的时候可以停。', 'Speak when you want to; pause when you need to.'],
  ['照顾自己，有时是少做一点。', 'Caring for yourself sometimes means doing a little less.'],
  ['平常的一天，也值得被温柔看待。', 'An ordinary day deserves a gentle look too.'],
  ['你可以先听听自己的感受。', 'You can listen to your feelings first.'],
  ['不必把每一刻都变成成果。', 'Not every moment has to become an achievement.'],
  ['有些答案，可以晚一点再找。', 'Some answers can wait a little longer.'],
  ['你愿意的话，给今天留一张小小的照片。', 'If you wish, keep a small picture of today.'],
  ['安静和热闹，都可以是你的选择。', 'Quiet and company can both be your choice.'],
  ['把肩膀放松一点，不急着往前走。', 'Let your shoulders soften; there is no rush to move on.'],
  ['不开心的时候，也不必勉强感谢。', 'You do not have to force gratitude when you feel low.'],
  ['暂时没有话可说，也没有关系。', 'It is okay to have no words for now.'],
  ['留在窗边的光，不要求你做什么。', 'The light by the window asks nothing of you.'],
  ['想念、疲惫、轻松，可以同时在场。', 'Longing, tiredness and ease can share the same moment.'],
  ['今天可以从你愿意的地方开始。', 'Today can begin wherever you feel ready.'],
  ['给自己一段不被评价的时间。', 'Leave yourself a little time without judgment.'],
  ['不需要给每一种感受打分。', 'Not every feeling needs a score.'],
  ['路过的一阵风，也算今天的一部分。', 'A passing breeze is part of today too.'],
  ['有些重量，可以先放在这里。', 'Some of what feels heavy can rest here for a while.'],
  ['你可以只记录，不急着总结。', 'You can simply note something without summing it up.'],
  ['这一天，没有规定的正确过法。', 'There is no prescribed right way to live this day.'],
  ['喜欢的小角落，不必向别人证明。', 'You do not have to justify the small places you like.'],
  ['停一会儿，日子仍然会继续。', 'You can pause for a while; the day will continue.']
].map(([zh, en], index) => Object.freeze({ id: `pause-${index + 1}`, zh, en }));
// Original editorial writing. Legacy IDs keep previously saved lines unchanged.
export const EDITORIAL_QUOTES = [
  [
    "有些话，写下来以后才知道想说什么。",
    "Sometimes writing is how we find what we mean."
  ],
  [
    "把今天记下来，不一定要有结论。",
    "A note about today does not need a conclusion."
  ],
  [
    "走过熟悉的路，也会看见没留意过的树。",
    "Even a familiar street has trees we have yet to notice."
  ],
  [
    "书翻到哪一页，就从哪一页接着读。",
    "Begin again at the page you left open."
  ],
  [
    "日子里有许多细节，闲下来才想起。",
    "Some details of a day return only when we sit quietly."
  ],
  [
    "雨停以后，街上的声音慢慢回来了。",
    "After the rain, the sounds of the street return."
  ],
  [
    "一句没说完的话，也可以留在纸上。",
    "An unfinished thought can stay on the page."
  ],
  [
    "窗外的天色，和早上不一样了。",
    "The light outside has changed since morning."
  ],
  [
    "有时记住一天的，是一个很小的声音。",
    "Sometimes a small sound is what we remember of a day."
  ],
  [
    "喜欢的那一页，隔些日子还想再读。",
    "Some pages are worth coming back to."
  ],
  [
    "桌上的水凉了，话还可以慢慢写。",
    "The water on the desk has cooled. There is still time to write."
  ],
  [
    "散步回来，衣服上还带着一点风。",
    "Back from a walk, a little of the breeze comes indoors."
  ],
  [
    "有些事情，过了一晚再看，会多一种想法。",
    "A night can leave room for another way of seeing things."
  ],
  [
    "空着的一页，什么时候写都可以。",
    "A blank page can wait until you feel like writing."
  ],
  [
    "想起一个人，往往是从一件小事开始。",
    "A small thing can bring someone to mind."
  ],
  [
    "远处的灯亮了，手边还有半页书。",
    "Lights come on in the distance. Half a page remains."
  ],
  [
    "不曾拍下来的画面，也会在心里留一阵。",
    "A scene can stay with us even without a photograph."
  ],
  [
    "今天听见的一句话，到了晚上才想明白。",
    "A sentence heard in the day can become clearer at night."
  ],
  [
    "把一句话留在这里，改天再来接着写。",
    "Leave a sentence here and return to it another day."
  ],
  [
    "一段路走了很久，才发现季节已经换了。",
    "On a road we know well, we notice the season has changed."
  ],
  [
    "有时并没有发生什么，只是想记住这一天。",
    "Sometimes nothing much happened. We just want to remember the day."
  ],
  [
    "一件小事的细节，可能比结论留得更久。",
    "The details of a small event can outlast its conclusion."
  ],
  [
    "窗开着，书摊着，下午还没有过去。",
    "The window is open, the book lies unfolded, and the afternoon remains."
  ],
  [
    "再读以前的记录，会遇见当时没有留意的自己。",
    "An old entry can show us something we did not notice then."
  ]
].map(([zh,en],index)=>Object.freeze({id:`letter-${index+1}`,zh,en}));
import {CURATED_QUOTES} from '../../packages/content/curated-quotes.js';
export const QUOTES=Object.freeze([...LEGACY_QUOTES,...EDITORIAL_QUOTES,...CURATED_QUOTES]);
export const QUOTE_CYCLE_LENGTH=EDITORIAL_QUOTES.length;
export const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function quoteFor(date, offset = 0) {
  let hash = 0; for (const c of date) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return EDITORIAL_QUOTES[(hash + offset) % EDITORIAL_QUOTES.length];
}
const empty = () => ({ version: 1, hidden: false, favorites: [], date: '', offset: 0 });
const calendarDate = value => value === '' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + 'T00:00:00.000Z')) && new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) === value);
function validate(value) {
  if (!value || Object.keys(value).sort().join('|') !== 'date|favorites|hidden|offset|version' || value.version !== 1 ||
      typeof value.hidden !== 'boolean' || !Array.isArray(value.favorites) || value.favorites.length > QUOTES.length ||
      new Set(value.favorites).size !== value.favorites.length || value.favorites.some(id => !QUOTES.some(q => q.id === id)) ||
      !calendarDate(value.date) || !Number.isInteger(value.offset) || value.offset < 0 || value.offset >= QUOTES.length) throw Error('quoteStorageFailed');
  return value;
}
export function createQuoteStore(storage) {
  let state = empty(), raw = null, readable = true;
  const load = () => {
    try { raw = storage.getItem(QUOTE_KEY); state = raw === null ? empty() : validate(JSON.parse(raw)); readable = true; }
    catch { readable = false; }
  };
  load();
  return { load, get readable() { return readable; }, snapshot: () => structuredClone(state),
    current(date = localDateKey()) { return quoteFor(date, state.date === date ? state.offset : 0); },
    update(change) {
      try {
        if (!readable || storage.getItem(QUOTE_KEY) !== raw) { load(); throw Error('quoteStorageFailed'); }
        const next = validate(change(structuredClone(state))), text = JSON.stringify(next);
        storage.setItem(QUOTE_KEY, text); state = next; raw = text;
      } catch { const error = new Error('quoteStorageFailed'); error.code = 'quoteStorageFailed'; throw error; }
    }
  };
}
