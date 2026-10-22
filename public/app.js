import { localDay,parseDay,dateForDay,calendarEntries,calendarHTML } from '../apps/web/day-calendar.js';
import { createMiniExperience } from '../apps/web/mini-experience.js';
import { createNotesStore,NOTES_KEY } from '../apps/web/quick-notes.js';
import { openQuickNotes } from '../apps/web/quick-notes-view.js';
import { createDailySettings,DAILY_SETTINGS_KEY,reminderDue,openDailySettings } from '../apps/web/daily-settings.js';
import { wellbeingHTML } from '../apps/web/wellbeing.js';
import { openFeedback } from '../apps/web/feedback-view.js';
import { APPEARANCES, createAppearance } from '../apps/web/appearance.js';
import { icon } from '../apps/web/ui-icons.js';
import { EXPERIENCE_KEY, readMode, initialExperience, writeMode, privateScope, experienceContent } from '../apps/web/experience.js';
import { createSpaceController } from '../apps/web/space-view.js';
import { openMeditation } from '../apps/web/meditation-view.js';
import { createCompanionPanel } from '../apps/web/companion-view.js';
import { ACCOUNT_CONFIG } from '../apps/web/account-config.js';
import { createAccountAuth } from '../apps/web/account-auth.js';
import { setAccountScope, scopedName, JOURNAL_KEY } from '../apps/web/account-scope.js';
import { createAccountPanel } from '../apps/web/account-view.js';
import { CONFIG, translate } from './config.js';
import { createWebStorage } from '../apps/web/storage.js';
import { WebJournalDraft } from '../apps/web/journal-draft.js';
import { WebJournalRecovery } from '../apps/web/journal-recovery.js';
import { prepareOffline, offlineReady } from '../apps/web/offline.js';
import { createMediaStore } from '../apps/web/media-store.js';
import { createMediaUI } from '../apps/web/media-view.js';
import { mediaContent } from '../apps/web/media-content.js';
import { mediaText } from '../apps/web/media-contract.js';
import { filterJournal } from '../packages/core/journal-search.js';
import { mediaDailyTrend as dailyTrend, mediaSummary as summarizeJournal, projectMoodRecords } from '../apps/web/media-stats.js';
import { formatJournalText } from '../packages/content/index.js';
import { createAIClient } from '../apps/web/ai-client.js';
import { mountAIDialog } from '../apps/web/ai-dialog.js';
import { webAIContent } from '../apps/web/ai-content.js';
import { comfortContent } from '../apps/web/comfort-content.js';
import { createQuoteStore, QUOTE_KEY, QUOTES, QUOTE_CYCLE_LENGTH, localDateKey } from '../apps/web/quotes.js';
import { mountGallery } from '../apps/web/gallery-view.js';
import { careContent } from '../apps/web/care-content.js';
import { createCareStore, CARE_KEY } from '../apps/web/care-store.js';
import { createCarePanel } from '../apps/web/care-view.js';
import { createOwnerConnection } from '../apps/web/owner-entry.js';
import { JournalStore, MAX_BACKUP_BYTES, parseBackup, makeBackup } from './storage.js';
import { PracticeSession, RainAudio, DURATIONS } from './practice.js';

const experience=initialExperience();
const accountAuth = createAccountAuth({config:experience==='care'?{...ACCOUNT_CONFIG,enabled:false}:ACCOUNT_CONFIG});
let accountInitError=null;
try { await accountAuth.initialize(); } catch(error) { accountInitError=error; }
setAccountScope(experience==='care'?privateScope():accountAuth.active ? accountAuth.session.user.id : null);

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let syncPanel=null, mediaUI=null, accountPanel=null, mini=null;
let mediaState={entries:[],sessions:[],drafts:[]}, mediaFailure='', mediaMode='all', mediaLoad=0;
const mediaChannel=globalThis.BroadcastChannel?new BroadcastChannel(scopedName('liubai-local-media-changes-v1')):null;
const mediaStore=createMediaStore({notify:()=>mediaChannel?.postMessage({changed:true})});
const scopedStorage=createWebStorage();
const browserStorage={getItem:key=>scopedStorage.getItem(key),physicalKey:scopedStorage.physicalKey,setItem(key,value){if((readMode()==='care')!==(experience==='care'))throw Object.assign(new Error('storageChanged'),{code:'storageChanged'});scopedStorage.setItem(key,value);}};
const observedStorage={getItem:key=>browserStorage.getItem(key),setItem(key,value){browserStorage.setItem(key,value);if(['local-mood-journal.data.v1',CARE_KEY].includes(key))queueMicrotask(()=>{syncPanel?.recordLocalChanges();accountPanel?.localChanged();});}};
const store = new JournalStore(observedStorage);
const notesStore=createNotesStore(browserStorage),dailySettings=createDailySettings(browserStorage);
let calendarMonth=localDay().slice(0,7),curtainOpener=null;
const recovery = new WebJournalRecovery(browserStorage, store);
const BACKUP_ACTIVITY_KEY = store.key + '.backup-download.v1';
const offlineCapable = document.querySelector('meta[name="liubai-offline"]')?.content === 'enabled';
const careStore=createCareStore(observedStorage);
const aiClient = createAIClient();
const quotes = createQuoteStore(createWebStorage());
let pageCleanup = null;
let carePanel = null;
let activeAIEntry = null, space=null, bookFilter='all', favoritesOnly=false, monthFilter='', simpleVolatile=null;
let language = 'zh';
try { const preferred = browserStorage.getItem('local-mood-journal.language'); if (['zh', 'en'].includes(preferred)) language = preferred; } catch {}
const pages = ['today', 'journal', 'insights', 'care', 'gallery'];
let page = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
let emotionDays=7;
let searchQuery = '', allowDialogClose = null;
let sampleMode = false, filter = 'all', cleanup = null, opener = null, toastTimer;
const t = (key, values = {}) => (experienceContent[language][key] ?? mediaContent[language][key] ?? careContent[language][key] ?? comfortContent[language][key] ?? webAIContent[language][key])?.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '')) ?? translate(language, key, values);
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const locale = () => language === 'zh' ? 'zh-CN' : 'en-US';
const dateText = date => new Date(date).toLocaleString(locale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const dayKey = date => new Date(date).toLocaleDateString('sv-SE');
const personal = () => store.status === 'ready' ? store.snapshot().entries : [];
const moodPersonal = () => projectMoodRecords(personal(),mediaState.entries);
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
function samples() {
  const texts = language === 'zh' ? ['虚构示例：午后散步。', '虚构示例：留一点休息时间。', '虚构示例：完成一个小目标。'] :
    ['Fictional example: an afternoon walk.', 'Fictional example: a little time to rest.', 'Fictional example: one small goal completed.'];
  return [2, 1, 3, 2, 0, 3, 4].map((mood, i) => {
    const date = new Date(); date.setDate(date.getDate() - 6 + i);
    return { id: `sample-${i}`, mood, tags: [CONFIG.tags[i % CONFIG.tags.length]], text: texts[i % texts.length], date: date.toISOString() };
  });
}
const shown = () => sampleMode ? samples() : personal();
function face(index) {
  const mood = CONFIG.moods[index], mouth = ['M14 29Q22 20 30 29', 'M15 27h14', 'M15 25Q22 29 29 25', 'M15 24Q22 32 29 24', 'M14 24Q22 36 30 24'][index];
  return `<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="21" fill="${mood.color}"/><path d="M15 18v2m14-2v2 ${mouth}" fill="none" stroke="${mood.line}" stroke-width="1.7" stroke-linecap="round"/></svg>`;
}
function moodButtons(selected = null) {
  return `<div class="moods" role="group" aria-label="${t('moodLabel')}">${CONFIG.moods.map((_, i) => `<button type="button" class="mood ${selected === i ? 'selected' : ''}" data-mood="${i}" aria-pressed="${selected === i}">${face(i)}<span>${t('mood' + i)}</span></button>`).join('')}</div>`;
}
function heading(title, subtitle) { return `<div class="page-heading"><div><h1>${t(title)}</h1><p class="subtitle">${t(subtitle)}</p></div></div>`; }
function chart(entries) {
  const days=dailyTrend(entries,{dayKey});
  const rows=days.map(day=>entries.filter(e=>!e.deletedAt&&dayKey(new Date(e.date))===dayKey(day.date)&&Number.isInteger(e.mood)&&e.mood>=0&&e.mood<=4));
  return `<svg class="chart category-chart" viewBox="0 0 415 150" role="img" aria-label="${language==='zh'?'最近七天记录的心情分类；圆点代表记录，空白表示未记录，不计算平均分':'Mood categories over seven days. Dots are entries; blanks are missing records. No average score.'}">${[0,1,2,3,4].map((m,i)=>`<line x1="75" y1="${18+i*25}" x2="402" y2="${18+i*25}"/><text x="2" y="${22+i*25}">${t('mood'+m)}</text>`).join('')}${rows.map((row,i)=>[0,1,2,3,4].filter(m=>row.some(e=>e.mood===m)).map(m=>{const count=row.filter(e=>e.mood===m).length;return `<circle cx="${95+i*49}" cy="${18+m*25}" r="${Math.min(7,3+count)}"><title>${days[i].date.toLocaleDateString(locale())}: ${t('mood'+m)} · ${count}${language==='zh'?'次':' entries'}</title></circle>`;}).join('')).join('')}${days.map((day,i)=>`<text x="${95+i*49}" y="143" text-anchor="middle">${i===6?t('todayShort'):(day.date.getMonth()+1)+'/'+day.date.getDate()}</text>`).join('')}</svg>`;
}
function careCards() {
  return `<div class="care-grid">${['breath', 'sound', 'move'].map((kind, i) => `<button class="care-card" data-practice="${kind}"><div class="care-art ${kind}" aria-hidden="true"><span class="duration">${kind==='sound'?(language==='zh'?'按需播放':'On demand'):kind==='breath'?(language==='zh'?'1–10 分钟':'1–10 min'):formatTime(DURATIONS[kind])}</span><span class="care-symbol">${['◯', '≋', '⌁'][i]}</span></div><div class="care-meta"><h3>${t(kind + 'Title')}</h3><p>${t(kind + 'Sub')}</p><span class="arrow" aria-hidden="true">↗</span></div></button>`).join('')}</div>`;
}
function sampleBanner() { return sampleMode ? `<div class="sample-banner"><span>${t('sampleNotice')}</span><button data-sample-off>${t('exitSample')}</button></div>` : ''; }
function dailyQuote() {
  const state=quotes.snapshot(),quote=quotes.current(),saved=state.favorites.includes(quote.id);
  if(state.hidden)return `<button class="quiet-control quote-show" id="quote-show">${icon('show')}<span>${t('quoteShow')}</span></button>`;
  return `<section class="panel daily-quote" aria-labelledby="daily-quote-heading"><div class="quote-heading"><h2 id="daily-quote-heading">${t('quoteTitle')}</h2><span class="quote-caption">${t('quoteOriginal')}</span><button class="quiet-control icon-control quote-hide" id="quote-hide" aria-label="${t('quoteHide')}" title="${t('quoteHide')}">${icon('close')}</button></div><p class="quote-line" id="quote-line" tabindex="-1" data-quote-id="${quote.id}">${esc(quote[language])}</p><div class="quote-actions" role="group" aria-label="${t('quoteActions')}"><div class="control-group"><button class="quiet-control" id="quote-next" title="${t('quoteNext')}">${icon('next')}<span>${t('quoteNext')}</span></button><button class="quiet-control" id="quote-save" aria-pressed="${saved}" title="${t(saved?'quoteSaved':'quoteSave')}">${icon('bookmark')}<span>${t(saved?'quoteSaved':'quoteSave')}</span></button></div><button class="quiet-control quote-library" id="quote-favorites">${icon('collection')}<span>${t('quoteFavorites')}</span><span class="control-count">${state.favorites.length}</span></button></div>${quotes.readable?'':`<p role="alert">${t('quoteStorageFailed')}</p>`}</section>`;
}

function today() {
  if(mini)return mini.home({moodButtons:moodButtons(),ready:store.status==='ready'});
  if(experience==='simple')return simpleHome();
  const records = moodPersonal(), preview = records.length ? records : samples();
  return `${heading('homeTitle', 'homeSub')}<section class="hero"><div class="hero-copy"><p class="eyebrow">${t('tagline')}</p><h2>${t('heroTitle')}</h2><p>${t('heroSub')}</p><button class="primary" data-record ${store.status !== 'ready' ? 'disabled' : ''}>${t('write')} <span aria-hidden="true">↗</span></button></div><div class="hero-art" role="img" aria-label="${t('landscape')}"></div></section><div class="home-note-entry">${notesEntry()}</div>${dailyQuote()}${experience==='immersive'&&dailySettings.snapshot().week?`<div id="week-calendar-root">${calendarHTML({month:calendarMonth,records:calendarRecords(),language,esc,compact:true,partial:store.status!=='ready'||!!mediaFailure||!notesStore.readable})}</div>`:''}<section class="panel album-invite"><div><h2>${t('gallery')}</h2><p>${t('galleryInvite')}</p></div><button class="secondary" data-goto="gallery">${t('galleryOpen')} ↗</button></section><div class="grid-two"><section class="panel"><h2>${t('checkIn')}</h2>${moodButtons()}<button class="primary" data-quick ${store.status !== 'ready' ? 'disabled' : ''}>${t('quick')}</button></section><section class="panel"><div class="section-head"><h2>${t('trend')}</h2><button class="text-button" data-goto="insights">${t('viewInsights')} ↗</button></div><p class="badge">${t(records.length ? 'realLabel' : 'sampleLabel')}</p>${chart(preview)}</section></div><section class="care-section"><h2>${t('careInvitation')}</h2>${careCards()}${companionInvite()}</section>`;
}
function notesEntry(){notesStore.load();const n=notesStore.snapshot().notes.filter(n=>!n.archived&&n.text.trim()).length;return `<button class="text-button" data-notes>${language==='zh'?'随手记':'Quick notes'}${n?' · '+n:''}</button>`;}
function companionInvite(){return `<section class="companion-invite"><div><h2>${t(experience==='care'?'localReflect':'chatEntry')}</h2><p class="section-sub">${t(experience==='care'?'localReflectSub':'chatSub')}</p></div><button class="secondary" data-companion>${t(experience==='care'?'localReflect':'chatEntry')}</button><button class="text-button" data-meditation>${language==='zh'?'缓一缓':'A quiet moment'}</button></section>`;}
function simpleHome(){return `${heading('homeTitle','homeSub')}<section class="hero simple-hero"><div class="hero-copy"><p class="eyebrow">${t('simple')}</p><h2>${t('heroTitle')}</h2><p>${t('simpleHelp')}</p></div><div class="hero-art" role="img" aria-label="${t('landscape')}"></div></section><section class="panel simple-composer"><form id="simple-form"><label for="simple-text">${t('textLabel')}</label><textarea id="simple-text" maxlength="2000" placeholder="${t('placeholder')}"></textarea><label>${t('moodLabel')}<select id="simple-mood" required><option value="">${t('chooseMood')}</option>${CONFIG.moods.map((_,i)=>`<option value="${i}">${t('mood'+i)}</option>`).join('')}</select></label><p id="simple-status" role="status"></p><button type="button" id="simple-download" class="text-button" hidden>${t('webDraftDownload')}</button><button class="primary" type="submit" ${store.status!=='ready'?'disabled':''}>${t('save')}</button></form><div class="dialog-actions">${notesEntry()}<button class="text-button" data-voice>${t('mediaVoice')}</button><button class="text-button" data-scrapbook>${t('mediaScrapbook')}</button><button class="text-button" data-sound>${language==='zh'?'听一会儿':'Listen'}</button></div><details><summary>${t('moreTools')}</summary><div class="dialog-actions"><button class="text-button" data-goto="gallery">${t('gallery')}</button><button class="text-button" data-goto="insights">${t('insights')}</button><button class="text-button" data-meditation>${language==='zh'?'缓一缓':'A quiet moment'}</button></div></details></section>${companionInvite()}`;}
function journal() {
  const candidates=(sampleMode?shown():[...personal().map(r=>({...r,kind:'text'})),...mediaState.entries.filter(r=>!r.deletedAt).map(r=>({...r,text:mediaText(r)}))].filter(r=>(mediaMode==='all'||r.kind===mediaMode)&&(bookFilter==='all'||r.kind==='scrapbook'&&(r.design?.book||'default')===bookFilter)&&(!favoritesOnly||r.kind==='scrapbook'&&r.design?.favorite)&&(!monthFilter||new Date(r.date).getFullYear()+'-'+String(new Date(r.date).getMonth()+1).padStart(2,'0')===monthFilter)));
  const records = filterJournal(candidates.filter(r=>!mini||mini.features.media||r.kind==='text'), { mood: filter, query: searchQuery, tagText: tag => t(tag) });
  return `${heading('journalTitle', 'journalSub')}${sampleBanner()}<div class="journal-toolbar"><p class="section-sub">${sampleMode ? t('sampleLabel') : t('recordCount', { n: personal().length+mediaState.entries.filter(r=>!r.deletedAt).length })}</p><div class="toolbar-controls"><select id="journal-filter" aria-label="${t('filter')}"><option value="all">${t('allMoods')}</option>${CONFIG.moods.map((_, i) => `<option value="${i}" ${filter === String(i) ? 'selected' : ''}>${t('mood' + i)}</option>`).join('')}</select><button class="secondary" data-backup>${t('dataPrivacy')}</button><button class="primary" data-record ${store.status !== 'ready' ? 'disabled' : ''}>＋ ${t('write')}</button></div></div><div class="media-toolbar"><div class="media-mode-tabs" role="group" aria-label="${t('mediaModeLabel')}">${['all','text','scrapbook','voice'].map(mode=>`<button class="text-button" data-media-mode="${mode}" aria-pressed="${mediaMode===mode}">${t({all:'mediaAll',text:'mediaTextMode',scrapbook:'mediaScrapbook',voice:'mediaVoice'}[mode])}</button>`).join('')}</div><div class="media-new-actions">${notesEntry()}<button class="text-button" data-scrapbook>＋ ${t('mediaScrapbook')}</button><button class="text-button" data-voice>◉ ${t('mediaVoice')}</button></div></div><div class="notebook-filters"><label>${language==='zh'?'月份':'Month'}<input id="journal-month" type="month" value="${monthFilter}"></label><label>${language==='zh'?'手帐本':'Notebook'}<select id="journal-book"><option value="all">${language==='zh'?'全部记录':'All records'}</option>${(mediaUI?.books()||[]).map(b=>`<option value="${b.id}" ${bookFilter===b.id?'selected':''}>${esc(b.title||(language==='zh'?'我的手帐':'My scrapbook'))}</option>`).join('')}</select></label><label class="checkbox"><input id="journal-favorites" type="checkbox" ${favoritesOnly?'checked':''}>${language==='zh'?'只看收藏手帐':'Favorite scrapbook pages'}</label></div>${mediaFailure?`<p role="alert">${t(mediaFailure)}</p>`:''}<div class="journal-search"><label for="journal-search">${t('journalSearch')}</label><div class="toolbar-controls"><input id="journal-search" type="search" maxlength="200" autocomplete="off" value="${esc(searchQuery)}" placeholder="${t('journalSearchPlaceholder')}"><button id="clear-search" class="secondary" ${searchQuery || filter !== 'all' ? '' : 'hidden'}>${t('resetSearch')}</button></div><p class="section-sub" role="status">${t('searchCount', { n: records.length })}</p></div>${records.length ? records.map(entry => ['scrapbook','voice'].includes(entry.kind) ? mediaUI.entryCard(entry) : `<article class="panel entry">${face(entry.mood)}<div class="entry-content"><div class="entry-top"><strong>${t('mood' + entry.mood)}</strong><time datetime="${entry.date}">${dateText(entry.date)}</time></div><p>${esc(entry.text) || t('noText')}</p><div class="tags">${entry.tags.map(tag => `<span class="tag">${t(tag)}</span>`).join('')}</div></div>${sampleMode ? '' : `<button class="text-button edit-entry" data-edit="${entry.id}">${t('editEntry')}</button><button class="delete" data-delete="${entry.id}" aria-label="${t('delete')} ${dateText(entry.date)}">${t('delete')}</button>`}${sampleMode ? '' : `<button class="text-button ai-entry" data-ai="${entry.id}">${t(experience==='care'?'localReflect':'chatEntry')}</button>`}</article>`).join('') : `<div class="empty"><h2>${t(searchQuery.trim() || filter !== 'all' ? 'searchEmpty' : 'emptyTitle')}</h2><p>${t(searchQuery.trim() || filter !== 'all' ? 'searchEmptyHelp' : 'emptySub')}</p><button class="primary" data-record ${store.status !== 'ready' ? 'disabled' : ''}>${t('write')}</button><button class="text-button" data-sample>${t('trySample')}</button></div>`}`;
}
function insights() {
  const month=`<div id="month-calendar-root">${calendarHTML({month:calendarMonth,records:sampleMode?samples().map(r=>({...r,kind:'text'})):calendarRecords(),language,esc,sample:sampleMode,partial:store.status!=='ready'||!!mediaFailure||!notesStore.readable})}</div>`;
  if(mini&&!mini.features.insights)return `${heading('insightsTitle','insightsSub')}${month}`;
  const records = sampleMode?samples():moodPersonal(), summary = summarizeJournal(records, { dayKey }), count = summary.dayCount;
  if (!records.length) return `${heading('insightsTitle', 'insightsSub')}${month}${wellbeingHTML(records,{language,esc,days:emotionDays,sample:sampleMode})}<div class="empty"><p>${t('chartEmpty')}</p><button class="primary" data-record ${store.status !== 'ready' ? 'disabled' : ''}>${t('write')}</button><button class="text-button" data-sample>${t('trySample')}</button></div>`;
  const counts = summary.tags;
  const top = counts[0];
  return `${heading('insightsTitle', 'insightsSub')}${sampleBanner()}${month}${wellbeingHTML(records,{language,esc,days:emotionDays,sample:sampleMode})}${mediaState.entries.some(r=>!r.deletedAt&&r.mood===null)?`<p class="rule-note">${t('mediaMoodStatsHelp')}</p>`:''}<div class="insight-stats">${[['moments', records.length, 'times'], ['days', count, 'dayUnit'], ['practices', sampleMode ? '—' : store.snapshot().careCount, 'times']].map(([title, n, unit]) => `<section class="panel stat"><h2>${t(title)}</h2><p class="number">${n}<span>${t(unit)}</span></p></section>`).join('')}</div><div class="grid-two"><section class="panel"><h2>${t('trend')}</h2>${chart(records)}<p class="rule-note">${t('ruleNote')}</p></section><section class="panel"><h2>${t('tagsTitle')}</h2>${counts.length ? counts.map(row => `<div class="bar-row"><span>${t(row.tag)}</span><div class="bar-track"><i style="width:${row.count / records.length * 100}%"></i></div><span>${row.count}</span></div>`).join('') : `<p>${t('noTags')}</p>`}</section></div><section class="panel reflection"><h2>${t('reflection')}</h2><p>${top ? t('reflectionText', { n: records.length, count: top.count, tag: t(top.tag) }) : t('noTags')}</p><p>${t('gentleSuggestion')}</p><button class="primary" data-goto="care">${t('careInvitation')} ↗</button><p class="rule-note">${t('ruleNote')}</p></section>`;
}
function care() { return `${heading('careTitle', 'careSub')}${companionInvite()}${careCards()}<section class="panel reflection"><p>${t('support')}</p></section>`; }
function gallery() { return `${heading('galleryTitle', 'gallerySub')}${ownerConnection?'<div id="owner-image-root"></div>':''}<div id="gallery-root"></div>`; }

function calendarRecords(){notesStore.load();return calendarEntries(personal(),mediaState.entries,notesStore.snapshot().notes);}
function quickNotes(initialID=null){openQuickNotes({storage:browserStorage,language,esc,openDialog,journal:store,initialID,onChange:()=>{notesStore.load();render();},openJournal:id=>{if(closeDialog()){const entry=personal().find(r=>r.id===id);if(entry)editEntry(id);else toast(language==='zh'?'原日记暂未找到，随手记仍保留。':'The journal entry was not found. Your note is preserved.');}},lifecycle:({guard=null,dispose=null})=>{allowDialogClose=guard;cleanup=dispose;}});}
function usageSettings(){openDailySettings({storage:browserStorage,language,openDialog,mask:maskPage,onChange:()=>{dailySettings.load();render();},lifecycle:({guard})=>{allowDialogClose=guard;}});}
function bindCalendars(){
 $$('[data-calendar-month]').forEach(b=>b.onclick=()=>{calendarMonth=b.dataset.calendarMonth;const host=$('#month-calendar-root');if(host){host.innerHTML=calendarHTML({month:calendarMonth,records:sampleMode?samples().map(r=>({...r,kind:'text'})):calendarRecords(),language,esc,sample:sampleMode,partial:store.status!=='ready'||!!mediaFailure||!notesStore.readable});bindCalendars();host.querySelector('h2').setAttribute('tabindex','-1');host.querySelector('h2').focus({preventScroll:true});}});
 $$('[data-calendar-full]').forEach(b=>b.onclick=()=>navigate('insights'));$$('[data-calendar-day]').forEach(b=>b.onclick=()=>openCalendarDay(b.dataset.calendarDay));
}
function openCalendarDay(day){
 const rows=(sampleMode?samples().map(r=>({...r,kind:'text'})):calendarRecords()).filter(r=>localDay(r.date)===day),L=(zh,en)=>language==='zh'?zh:en,kind={text:L('文字日记','Journal'),scrapbook:L('手帐','Scrapbook'),voice:L('录音','Voice'),note:L('随手记','Quick note')};
 if(openDialog(`<h2 id="dialog-title">${esc(parseDay(day).toLocaleDateString(locale(),{year:'numeric',month:'long',day:'numeric',weekday:'short'}))}</h2><p class="dialog-sub">${L('那天留下的记录','Records from this day')}</p>${store.status!=='ready'||mediaFailure||!notesStore.readable?`<p role="alert">${L('部分本机内容尚未读到，可能没有显示全部记录。','Some local content could not be read. The list may be incomplete.')}</p>`:''}${rows.length?rows.map(r=>`<article class="calendar-record"><div><span class="badge">${kind[r.kind]}</span><time>${esc(new Date(r.date).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'}))}</time>${Number.isInteger(r.mood)?`<span>${t('mood'+r.mood)}</span>`:''}</div><p>${esc(r.text?.slice(0,220)||r.title||L('没有附文字','No text attached'))}</p>${sampleMode?'':`<button class="secondary" data-day-entry="${r.id}" data-day-kind="${r.kind}">${L('打开记录','Open record')}</button>`}</article>`).join(''):`<p class="calendar-empty">${L('这天还没有记录，可以从一句话开始。','No records for this day yet. Start with one line.')}</p>`}${!sampleMode&&day<=localDay()?`<button class="primary" id="calendar-add">${L('为这天记一笔','Write for this day')}</button>`:''}`)===false)return;
 if($('#calendar-add'))$('#calendar-add').onclick=()=>{if(closeDialog())openRecord(null,day);};
 $$('[data-day-entry]').forEach(b=>b.onclick=()=>{const row=rows.find(r=>r.id===b.dataset.dayEntry&&r.kind===b.dataset.dayKind);if(!row||!closeDialog())return;if(row.kind==='text')editEntry(row.id);else if(row.kind==='note')quickNotes(row.id);else {const media=mediaState.entries.find(r=>r.id===row.id&&!r.deletedAt);if(media)void mediaUI.openEntry(media);}});
}
function updateLocalStatus(){const bad=store.status!=='ready'||!notesStore.readable||!!mediaFailure||!!simpleVolatile;$('#local-save-summary').innerHTML=`<span class="local-state-dot ${bad?'needs-attention':''}" aria-hidden="true"></span><span>${esc(language==='zh'?(simpleVolatile?'当前输入尚未保存':bad?'部分本机存储需要检查':experience==='care'?'关怀空间 · 保存位置：当前浏览器':accountAuth.active||syncPanel?'本机副本 · 同步状态见账号与同步':'保存位置：当前浏览器 · 云同步未启用'):(bad?'Some local content needs attention':experience==='care'?'Private care · This browser':accountAuth.active||syncPanel?'Local copy · See Account & sync':'This browser · Cloud sync is off'))}</span><button class="text-button" id="local-backup-link">${language==='zh'?'备份与恢复':'Back up & restore'}</button>`;$('#local-backup-link').onclick=backups;}
function maskPage(){const d=$('#privacy-curtain');if(d.open)return;curtainOpener=document.activeElement;$('#curtain-title').textContent=language==='zh'?'给自己留一点空间。':'A little space for yourself.';$('#curtain-note').textContent=language==='zh'?'页面已遮挡，输入仍保留。这不是密码锁或数据加密。':'Page covered; your input is preserved. This is not a password lock or encryption.';$('#curtain-return').textContent=language==='zh'?'返回我的页面':'Return to my page';space?.stop();try{d.showModal();}catch{} }
function checkReminder(){const host=$('#gentle-reminder');if(!host||document.hidden)return;dailySettings.load();const due=dailySettings.readable&&reminderDue(dailySettings.snapshot());host.hidden=!due;if(!due||host.querySelector('#reminder-write'))return;host.innerHTML=`<span>${language==='zh'?'要不要记一下今天？':'A moment to write about today?'}</span><button class="text-button" id="reminder-write">${language==='zh'?'写点什么':'Write a note'}</button><button class="text-button" id="reminder-dismiss">${language==='zh'?'今天先不提醒':'Dismiss for today'}</button>`;const dismiss=()=>{try{dailySettings.save({...dailySettings.snapshot(),lastSeen:localDay()});host.hidden=true;return true;}catch{toast(language==='zh'?'未能保存提醒偏好，请到使用设置中检查。':'Reminder preferences could not be saved. Check Preferences.');return false;}};$('#reminder-dismiss').onclick=dismiss;$('#reminder-write').onclick=()=>{if(dismiss()&&(!$('#dialog').open||closeDialog()))quickNotes();};}
function render() {
  if(mini&&(({gallery:'media',care:'care'})[page])&&!mini.features[({gallery:'media',care:'care'})[page]])page='today';
  carePanel?.sourcesChanged(); carePanel?.refresh();notesStore.load();dailySettings.load();
  pageCleanup?.(); pageCleanup = null; mediaUI?.clearCards();
  document.documentElement.dataset.experience=experience;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = CONFIG.name;
  $('#brand').textContent = t('brand'); $('#tagline').textContent = t('tagline'); $('#skip').textContent = t('skip');
  $('#copyright-copy').textContent=`© ${new Date().getFullYear()} ${language==='zh'?'留白 · Liubai':'Liubai'}`;
  $('#feedback-open').textContent=language==='zh'?'意见与反馈':'Feedback';$('#feedback-open').onclick=()=>openFeedback({language,esc,openDialog,lifecycle:({guard})=>{allowDialogClose=guard;}});
  $('#sidebar-note').textContent = t('gentleSuggestion'); $('#footer-copy').textContent = t('footer');
  $('#language-label').textContent = t('language'); $('#language').value = language; $('#language').setAttribute('aria-label', t('language'));
  let appearanceButton=$('#appearance-open');if(!appearanceButton){appearanceButton=document.createElement('button');appearanceButton.id='appearance-open';appearanceButton.className='quiet-control appearance-switch';$('header').insertBefore(appearanceButton,$('header .language'));}appearanceButton.innerHTML=icon(appearance.current==='night'?'moon':'palette')+`<span>${language==='zh'?'外观':'Appearance'}</span>`;appearanceButton.setAttribute('aria-label',language==='zh'?'选择外观主题':'Choose appearance');appearanceButton.onclick=appearanceSettings;
  let experienceButton=$('#experience-open');if(!experienceButton){experienceButton=document.createElement('button');experienceButton.id='experience-open';experienceButton.className='text-button experience-switch';$('header').insertBefore(experienceButton,$('#appearance-open'));}experienceButton.textContent=t(experience);experienceButton.onclick=experienceSettings;
  $('#date-label').textContent = new Date().toLocaleDateString(locale(), { month: 'long', day: 'numeric', weekday: 'short' });
  $('#navigation').setAttribute('aria-label', t('tagline'));
  $('#navigation').innerHTML = pages.map((name, i) => `<button class="nav ${page === name ? 'active' : ''}" data-page="${name}" ${page === name ? 'aria-current="page"' : ''}><span aria-hidden="true">${['◷', '▤', '⌁', '❋', '▧'][i]}</span>${name==='care'?translate(language,'care'):t(name)}</button>`).join('');
  $$('[data-page]').forEach(button => button.onclick = () => navigate(button.dataset.page));
  $$('[data-privacy]').forEach(button => { button.textContent = t('privacyTitle'); button.onclick = privacy; });
  $('#daily-settings-open').textContent=language==='zh'?'使用设置':'Preferences';$('#daily-settings-open').onclick=usageSettings;
  $('#quick-notes-open').textContent=language==='zh'?'随手记':'Quick notes';$('#quick-notes-open').onclick=()=>quickNotes();
  $('#privacy-cover-open').textContent=language==='zh'?'遮挡页面':'Cover page';$('#privacy-cover-open').onclick=maskPage;
  updateLocalStatus();checkReminder();
  $('#backup-open').textContent = t('dataPrivacy'); $('#backup-open').onclick = backups;
  let accountButton=$('#account-open');
  if(!accountButton){accountButton=document.createElement('button');accountButton.id='account-open';$('footer').insertBefore(accountButton,$('footer button'));}
  accountButton.textContent=accountPanel?.label || (language==='zh'?'账号与同步':'Account & sync');
  accountButton.onclick=()=>{if($('#dialog').open&&!closeDialog())return;if(experience==='care'){openDialog(`<h2 id="dialog-title">${t('modeLocal')}</h2><p class="dialog-sub">${t('cloudPaused')}</p><button id="care-experience-change" class="secondary">${t('experience')}</button>`);$('#care-experience-change').onclick=experienceSettings;}else accountPanel?.open();};
  syncPanel?.refresh();
  $('#dialog-close').textContent = '×'; $('#dialog-close').setAttribute('aria-label', t('close'));
  $('#main').innerHTML = ({ today, journal, insights, care, gallery })[page]();
  if(page==='today'){pageCleanup=space?.mountHero($('.hero-art'));}
  if (page === 'gallery') {const galleryCleanup=mountGallery($('#gallery-root'), { t, esc });const imageCleanup=ownerConnection?.mountImages($('#owner-image-root'),{getLanguage:()=>language,esc});pageCleanup=()=>{imageCleanup?.();galleryCleanup();};}
  const banner = $('#storage-banner'); banner.hidden = store.status === 'ready';
  banner.innerHTML = banner.hidden ? '' : `<p>${t(store.status === 'corrupt' ? 'lockedCorrupt' : 'lockedUnreadable')}</p><div><button class="secondary" id="retry-storage">${t('retry')}</button><button class="secondary" id="recover-storage">${t('dataPrivacy')}</button></div>`;
  if (!banner.hidden) { $('#retry-storage').onclick = () => { store.load(); render(); }; $('#recover-storage').onclick = backups; }
  bindCalendars();$$('[data-notes]').forEach(b=>b.onclick=()=>quickNotes());
  $$('[data-emotion-days]').forEach(b=>b.onclick=()=>{emotionDays=Number(b.dataset.emotionDays);render();});
  $$('[data-companion]').forEach(b=>b.onclick=()=>carePanel.open());
  $$('[data-meditation]').forEach(b=>b.onclick=meditation);$$('[data-sound]').forEach(b=>b.onclick=()=>space.openSound());
  if($('#journal-month'))$('#journal-month').onchange=e=>{monthFilter=e.target.value;render();};if($('#journal-book'))$('#journal-book').onchange=e=>{bookFilter=e.target.value;render();};if($('#journal-favorites'))$('#journal-favorites').onchange=e=>{favoritesOnly=e.target.checked;render();};
  if($('#simple-form'))mountSimpleComposer();
  $$('[data-record]').forEach(button => button.onclick = () => openRecord());
  $$('[data-goto]').forEach(button => button.onclick = () => navigate(button.dataset.goto));
  $$('[data-practice]').forEach(button => button.onclick = () => practice(button.dataset.practice));
  $$('[data-backup]').forEach(button => button.onclick = backups);
  $$('[data-sample]').forEach(button => button.onclick = () => { sampleMode = true; render(); });
  $$('[data-sample-off]').forEach(button => button.onclick = () => { sampleMode = false; render(); });
  $$('[data-delete]').forEach(button => button.onclick = () => deleteEntry(button.dataset.delete));
  $$('[data-edit]').forEach(button => button.onclick = () => editEntry(button.dataset.edit));
  $$('[data-scrapbook]').forEach(button=>button.onclick=()=>mediaUI.openScrapbook());
  $$('[data-voice]').forEach(button=>button.onclick=()=>mediaUI.openVoice());
  $$('[data-media-mode]').forEach(button=>button.onclick=()=>{mediaMode=button.dataset.mediaMode;render();});
  $$('[data-media-open]').forEach(button=>button.onclick=()=>mediaUI.openEntry(mediaState.entries.find(r=>r.id===button.dataset.mediaOpen)));
  $$('[data-media-edit]').forEach(button=>button.onclick=()=>{const row=mediaState.entries.find(r=>r.id===button.dataset.mediaEdit);void(row.kind==='voice'?mediaUI.openVoice(row):mediaUI.openScrapbook(row));});
  $$('[data-media-delete]').forEach(button=>button.onclick=()=>deleteMedia(button.dataset.mediaDelete));
  $$('[data-ai]').forEach(button => button.onclick = () => carePanel.open(personal().find(r=>r.id===button.dataset.ai)));
  if ($('#journal-filter')) $('#journal-filter').onchange = event => { filter = event.target.value; render(); $('#journal-filter').focus(); };
  if ($('#journal-search')) {
    const updateSearch = event => {
      if (event.isComposing) return;
      const input = event.target, position = input.selectionStart;
      searchQuery = input.value; render();
      const fresh = $('#journal-search'); fresh.focus();
      if (position !== null) fresh.setSelectionRange(position, position);
    };
    $('#journal-search').oninput = updateSearch;
    $('#journal-search').addEventListener('compositionend', updateSearch);
    $('#clear-search').onclick = () => { searchQuery = ''; filter = 'all'; mediaMode = 'all'; render(); $('#journal-search').focus(); };
  }
  let selected = null;
  $$('#main [data-mood]').forEach(button => button.onclick = () => { selected = Number(button.dataset.mood); selectMood('#main', selected); });
  if ($('[data-quick]')) $('[data-quick]').onclick = () => openRecord(selected);
  const updateQuote = (change, focus) => { try { quotes.update(change); render(); $('#' + focus)?.focus(); } catch (error) { toast(errorText(error)); } };
  if ($('#quote-next')) $('#quote-next').onclick = () => updateQuote(state => ({ ...state, date: localDateKey(), offset: ((state.date === localDateKey() ? state.offset : 0) + 1) % QUOTE_CYCLE_LENGTH }), 'quote-next');
  if ($('#quote-save')) $('#quote-save').onclick = () => updateQuote(state => { const id = quotes.current().id; state.favorites = state.favorites.includes(id) ? state.favorites.filter(value => value !== id) : [...state.favorites, id]; return state; }, 'quote-save');
  if ($('#quote-hide')) $('#quote-hide').onclick = () => updateQuote(state => ({ ...state, hidden: true }), 'quote-show');
  if ($('#quote-show')) $('#quote-show').onclick = () => updateQuote(state => ({ ...state, hidden: false }), 'quote-line');
  if ($('#quote-favorites')) $('#quote-favorites').onclick = () => {
    const favorites = quotes.snapshot().favorites;
    openDialog(`<h2 id="dialog-title">${t('quoteFavorites')}</h2><p class="badge">${t('quoteOriginal')}</p>${favorites.length ? favorites.map(id => `<p class="saved-quote">${esc(QUOTES.find(quote => quote.id === id)[language])}</p>`).join('') : `<p>${t('quoteEmpty')}</p>`}`);
  };
  mini?.afterRender(page);
}

function appearanceSettings(){
  if(openDialog(`<h2 id="dialog-title">${language==='zh'?'换一页底色':'A different light'}</h2><p class="dialog-sub">${language==='zh'?'选一个看着舒服的颜色。只改变外观，不移动或上传记录。':'Choose a palette that feels comfortable. Records stay where they are.'}</p><div class="appearance-grid">${APPEARANCES.map(item=>`<button class="appearance-card" data-choose-appearance="${item.id}" aria-pressed="${appearance.preference===item.id}"><span class="appearance-swatch" style="--swatch-bg:${item.colors[0]};--swatch-paper:${item.colors[1]};--swatch-ink:${item.colors[2]}"><i></i><b></b></span><strong>${language==='zh'?item.zh:item.en}</strong><small>${language==='zh'?item.note:item.noteEn}</small><span class="appearance-check">${icon('check')}</span></button>`).join('')}</div><label class="checkbox appearance-auto"><input id="appearance-auto" type="checkbox" ${appearance.preference==='auto'?'checked':''}>${language==='zh'?'跟随系统的明暗设置':'Follow system light and dark settings'}</label><p id="appearance-error" role="status"></p>` )===false)return;
  const choose=value=>{try{appearance.choose(value);$('#appearance-error').textContent=language==='zh'?'外观已保存。':'Appearance saved.';$$('[data-choose-appearance]').forEach(b=>b.setAttribute('aria-pressed',String(appearance.preference===b.dataset.chooseAppearance)));$('#appearance-auto').checked=appearance.preference==='auto';$('#appearance-open').innerHTML=icon(appearance.current==='night'?'moon':'palette')+`<span>${language==='zh'?'外观':'Appearance'}</span>`;}catch{$('#appearance-auto').checked=appearance.preference==='auto';$('#appearance-error').textContent=language==='zh'?'未能保存外观，原来的设置仍保留。':'The appearance could not be saved. Your previous setting is preserved.';}};
  $$('[data-choose-appearance]').forEach(b=>b.onclick=()=>choose(b.dataset.chooseAppearance));$('#appearance-auto').onchange=e=>choose(e.target.checked?'auto':appearance.current);
}

function experienceSettings(){
  if(mini)return mini.modes();
  openDialog(`<h2 id="dialog-title">${t('experience')}</h2><p class="dialog-sub">${t('modeBoundary')}</p><div class="experience-options">${['immersive','simple','care'].map(mode=>`<section class="panel"><h3>${t(mode)}</h3><p>${t(mode+'Help')}</p><button class="${mode===experience?'secondary':'primary'}" data-experience="${mode}" ${mode===experience?'disabled':''}>${t(mode===experience?'modeCurrent':'modeApply')}</button></section>`).join('')}</div><p id="experience-error" role="alert"></p>`);
  $$('button[data-experience]').forEach(button=>button.onclick=()=>{try{if(simpleVolatile){$('#experience-error').textContent=t('webDraftDownload');return;}writeMode(button.dataset.experience);space?.stop();location.reload();}catch{$('#experience-error').textContent=t('modeFailed');}});
}
function meditation(){openMeditation({language:()=>language,esc,openDialog,closeDialog,lifecycle:({dispose})=>{cleanup=dispose;},write:()=>carePanel.open(),sound:()=>space.openSound()});}
function mountSimpleComposer(){
  const draft=new WebJournalDraft(browserStorage),saved=simpleVolatile||draft.snapshot();if(saved){$('#simple-text').value=saved.text;$('#simple-mood').value=saved.mood===null?'':String(saved.mood);}
  const value=()=>({version:1,mood:$('#simple-mood').value===''?null:Number($('#simple-mood').value),tags:saved?.tags||[],text:$('#simple-text').value,updatedAt:new Date().toISOString()});
  if(simpleVolatile){$('#simple-status').textContent=t('webDraftDownload');$('#simple-download').hidden=false;}
  const persist=()=>{const current=value(),old=draft.snapshot();if(old&&old.text===current.text&&old.mood===current.mood&&JSON.stringify(old.tags)===JSON.stringify(current.tags))current.updatedAt=old.updatedAt;try{draft.update(current);simpleVolatile=null;$('#simple-download').hidden=true;$('#simple-status').textContent=t('webDraftSaved');updateLocalStatus();return true;}catch(error){simpleVolatile=current;$('#simple-download').hidden=false;$('#simple-status').textContent=errorText(error);updateLocalStatus();return false;}};
  $('#simple-download').onclick=()=>download(JSON.stringify(value(),null,2),'liubai-current-input.txt','text/plain;charset=utf-8');
  $('#simple-text').oninput=persist;$('#simple-mood').onchange=persist;
  $('#simple-form').onsubmit=event=>{event.preventDefault();if($('#simple-mood').value===''||!persist())return;try{const result=draft.save(store);simpleVolatile=null;render();toast(t(result.retained?'webDraftRetained':'saved'));}catch(error){$('#simple-status').textContent=errorText(error);}};
}
window.addEventListener('beforeunload',event=>{if(simpleVolatile){event.preventDefault();event.returnValue='';}});

function navigate(target) {
  if (!pages.includes(target)) return;
  if(mini&&(({gallery:'media',care:'care'})[target])&&!mini.features[({gallery:'media',care:'care'})[target]])return;
  if (carePanel?.close()===false) return;
  if ($('#dialog').open && !closeDialog()) return;
  page = target; location.hash = target; render(); $('#main').focus(); window.scrollTo(0, 0);
}
function disposeDialog() { allowDialogClose = null; const dispose = cleanup; cleanup = null; if (dispose) dispose(); }
function openDialog(content) {
  if ($('#care-dialog').open && carePanel?.close()===false) return false;
  disposeDialog();
  if (!$('#dialog').open) opener = document.activeElement;
  $('#dialog-content').innerHTML = content;
  if (!$('#dialog').open) $('#dialog').showModal();
  const focus = $('#dialog-content').querySelector('input, textarea, select, button');
  (focus || $('#dialog-close')).focus();
}
function closeDialog() {
  if (allowDialogClose && !allowDialogClose()) return false;
  disposeDialog(); $('#dialog').close();
  if (opener?.isConnected) opener.focus(); else $('#main').focus();
  return true;
}
$('#privacy-curtain').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();$('#curtain-return').focus();}});
const revealPage=()=>{$('#privacy-curtain').close();if(curtainOpener?.isConnected)curtainOpener.focus({preventScroll:true});};$('#curtain-return').onclick=revealPage;$('#privacy-curtain').addEventListener('cancel',e=>{e.preventDefault();revealPage();});
$('#dialog-close').onclick = closeDialog;
// Dispose synchronously on Escape, before the browser queues its native close event.
$('#dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
$('#dialog').addEventListener('close', () => { if (!$('#dialog').open) disposeDialog(); });
$('#dialog').addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const focusable = [...$('#dialog').querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length);
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000); }
function errorText(error) { return t(error?.code || 'unknownError'); }
function selectMood(scope, selected) {
  $$(`${scope} [data-mood]`).forEach(button => { const active = Number(button.dataset.mood) === selected; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
}
function openRecord(initialMood = null, recordDate = null) {
  if (store.status !== 'ready') { toast(t('storageLocked')); return; }
  const savedDraft = new WebJournalDraft(browserStorage);
  const recovered = savedDraft.snapshot();
  if(recordDate){try{dateForDay(recordDate);}catch{return;}if(recovered?.text.trim()&&!confirm(language==='zh'?`有一份未提交的输入草稿。保留文字，并将记录日期改为 ${recordDate} 吗？`:`Keep your existing input draft and use ${recordDate} as its record date?`))return;}
  let mood = recovered ? recovered.mood : initialMood, tags = recovered?.tags ?? [], dirty = false;
  if (savedDraft.status !== 'ready') {
    openDialog(`<h2 id="dialog-title">${t('recordTitle')}</h2><p role="alert">${t('webDraftInvalid')}</p><div class="dialog-actions"><button class="secondary" id="reload-web-draft">${t('webDraftReload')}</button>${typeof savedDraft.raw === 'string' ? `<button class="secondary" id="raw-web-draft">${t('webDraftRaw')}</button><button class="secondary" id="discard-web-draft">${t('webDraftDiscard')}</button>` : ''}</div>`);
    $('#reload-web-draft').onclick = () => openRecord(initialMood);
    if ($('#raw-web-draft')) $('#raw-web-draft').onclick = () => download(savedDraft.raw, 'liubai-original-draft.txt', 'text/plain;charset=utf-8');
    if ($('#discard-web-draft')) $('#discard-web-draft').onclick = () => {
      if (!confirm(t('webDraftDiscardConfirm'))) return;
      try { savedDraft.discardCorrupt(); openRecord(initialMood); } catch (error) { toast(errorText(error)); }
    };
    return;
  }
  openDialog(`<h2 id="dialog-title">${t('recordTitle')}</h2><p class="dialog-sub">${t('recordSub')}</p><div class="record-mode-links"><button class="text-button" id="record-scrapbook">${t('mediaScrapbook')} ↗</button><button class="text-button" id="record-voice">${t('mediaVoice')} ↗</button></div><form id="record-form"><label class="record-day-label">${language==='zh'?'记录日期':'Record date'}<input id="record-day" type="date" min="1900-01-01" max="${localDay()}" value="${recordDate||localDay(savedDraft.value?.date||new Date())}"></label>${moodButtons(mood)}<fieldset><legend>${t('tagLabel')}</legend><div class="tags">${CONFIG.tags.map(tag => `<button type="button" class="tag ${tags.includes(tag) ? 'selected' : ''}" data-tag="${tag}" aria-pressed="${tags.includes(tag)}">${t(tag)}</button>`).join('')}</div></fieldset><label for="diary-text">${t('textLabel')}</label><textarea id="diary-text" maxlength="2000" aria-describedby="text-limit" placeholder="${t('placeholder')}">${esc(recovered?.text ?? '')}</textarea><p class="section-sub" id="text-limit">${t('textLimit')}</p><p class="local-hint">${t('localHint')}</p><p id="web-draft-status" role="status">${recovered ? t('webDraftSaved') : ''}</p><div class="dialog-actions"><button type="button" class="secondary" id="web-draft-retry" hidden>${t('webDraftRetry')}</button><button type="button" class="secondary" id="web-draft-download" hidden>${t('webDraftDownload')}</button><button type="button" class="secondary" id="web-draft-reload" hidden>${t('webDraftReload')}</button></div><button type="button" class="text-button" id="web-draft-clear">${t('webDraftClear')}</button><p id="form-error" role="alert"></p><button type="submit" class="primary">${t('save')}</button></form>`);
  $('#record-scrapbook').hidden=!!mini&&!mini.features.media;$('#record-voice').hidden=!!mini&&!mini.features.media;
  $('#record-scrapbook').onclick=()=>{if(closeDialog())void mediaUI.openScrapbook();};
  $('#record-voice').onclick=()=>{if(closeDialog())void mediaUI.openVoice();};
  $('#dialog [data-mood]')?.focus();
  const persist = () => {
    dirty = true;
    try {
      const chosen=$('#record-day').value;const date=dateForDay(chosen);
      savedDraft.update({ version: 1, mood, tags, text: $('#diary-text').value, updatedAt: new Date().toISOString() });
      if(localDay(savedDraft.value.date)!==chosen)savedDraft.setRecordDate(date);
      dirty = false; $('#web-draft-status').textContent = t('webDraftSaved');
      $('#form-error').textContent = '';
    } catch (error) { $('#web-draft-status').textContent = t('webDraftFailed'); $('#form-error').textContent = errorText(error); }
    for (const id of ['web-draft-retry', 'web-draft-download', 'web-draft-reload']) $('#' + id).hidden = !dirty;
    return !dirty;
  };
  const unload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', unload);
  cleanup = () => window.removeEventListener('beforeunload', unload);
  allowDialogClose = () => !dirty || confirm(t('webDraftLeave'));
  $$('#dialog [data-mood]').forEach(button => button.onclick = () => { mood = Number(button.dataset.mood); selectMood('#dialog', mood); persist(); });
  $$('#dialog [data-tag]').forEach(button => button.onclick = () => { const tag = button.dataset.tag; tags = tags.includes(tag) ? tags.filter(value => value !== tag) : [...tags, tag]; button.classList.toggle('selected', tags.includes(tag)); button.setAttribute('aria-pressed', String(tags.includes(tag))); persist(); });
  $('#record-day').onchange=persist;
  $('#diary-text').oninput = persist;
  $('#web-draft-retry').onclick = persist;
  $('#web-draft-clear').onclick = () => { if (!confirm(t('webDraftClearConfirm'))) return; try { savedDraft.clear(); dirty = false; openRecord(null,recordDate); } catch (error) { $('#form-error').textContent = errorText(error); } };
  $('#web-draft-download').onclick = () => download(JSON.stringify({ mood, tags, text: $('#diary-text').value }, null, 2), 'liubai-current-input.txt', 'text/plain;charset=utf-8');
  $('#web-draft-reload').onclick = () => { if (confirm(t('webDraftReloadConfirm'))) openRecord(); };
  $('#record-form').onsubmit = event => {
    event.preventDefault(); if (mood === null) { $('#form-error').textContent = t('chooseMood'); return; }
    if ((dirty || !savedDraft.snapshot()||localDay(savedDraft.value.date)!==$('#record-day').value) && !persist()) return;
    let result;
    try { result = savedDraft.save(store); }
    catch (error) { $('#form-error').textContent = errorText(error); render(); return; }
    sampleMode = false; render();
    openDialog(`<h2 id="dialog-title">${t('saved')}</h2><p class="dialog-sub save-feedback">${t(result.retained ? 'webDraftRetained' : 'savedSub')}</p><div class="dialog-actions"><button class="primary" id="after-care">${t('breathTitle')}</button><button class="secondary" id="after-journal">${t('viewJournal')}</button></div>`);
    $('#after-care').onclick = () => practice('breath'); $('#after-journal').onclick = () => { closeDialog(); navigate('journal'); };
  };
}

async function refreshMedia() {
  const version=++mediaLoad;
  try{const state=await mediaStore.read();if(version!==mediaLoad)return;mediaState=state;mediaFailure='';}
  catch(e){if(version!==mediaLoad)return;mediaFailure=e.code||'mediaReadFailed';}
  if(['journal','insights','today'].includes(page))render();
}
function deleteMedia(id){
  const row=mediaState.entries.find(r=>r.id===id);if(!row)return;
  openDialog(`<h2 id="dialog-title">${t('deleteTitle')}</h2><p class="dialog-sub">${t('mediaDeleteSub')}</p><p id="delete-error" role="alert"></p><div class="dialog-actions"><button class="primary" id="confirm-delete">${t('confirmDelete')}</button><button class="secondary" id="cancel-delete">${t('cancel')}</button></div>`);
  $('#cancel-delete').onclick=closeDialog;
  $('#confirm-delete').onclick=async()=>{const button=$('#confirm-delete');button.disabled=true;try{await mediaStore.remove(row.id,row.revision);closeDialog();await refreshMedia();toast(t('webDeleted'));}catch(e){$('#delete-error').textContent=t(e.code||'mediaWriteFailed');button.disabled=false;}};
}
function editEntry(id) {
  if (store.status !== 'ready') { toast(t('storageLocked')); return; }
  const original = personal().find(entry => entry.id === id);
  if (!original) return;
  let mood = original.mood, tags = [...original.tags], dirty = false;
  openDialog(`<h2 id="dialog-title">${t('editTitle')}</h2><p class="dialog-sub">${t('editSub')}</p><form id="edit-form">${moodButtons(mood)}<fieldset><legend>${t('tagLabel')}</legend><div class="tags">${CONFIG.tags.map(tag => `<button type="button" class="tag ${tags.includes(tag) ? 'selected' : ''}" data-edit-tag="${tag}" aria-pressed="${tags.includes(tag)}">${t(tag)}</button>`).join('')}</div></fieldset><label for="edit-text">${t('textLabel')}</label><textarea id="edit-text" maxlength="2000" aria-describedby="edit-hint">${esc(original.text)}</textarea><p class="section-sub" id="edit-hint">${t('editHint')}</p><p id="edit-error" role="alert"></p><div class="dialog-actions"><button class="primary" type="submit">${t('editSave')}</button><button class="secondary" type="button" id="edit-download">${t('editDownload')}</button></div></form>`);
  const value = () => ({ ...original, mood, tags, text: $('#edit-text').value });
  const changed = () => { dirty = JSON.stringify(value()) !== JSON.stringify(original); };
  const unload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', unload);
  cleanup = () => window.removeEventListener('beforeunload', unload);
  allowDialogClose = () => !dirty || confirm(t('editLeave'));
  $$('#dialog [data-mood]').forEach(button => button.onclick = () => { mood = Number(button.dataset.mood); selectMood('#dialog', mood); changed(); });
  $$('[data-edit-tag]').forEach(button => button.onclick = () => {
    const tag = button.dataset.editTag; tags = tags.includes(tag) ? tags.filter(value => value !== tag) : [...tags, tag];
    button.classList.toggle('selected', tags.includes(tag)); button.setAttribute('aria-pressed', String(tags.includes(tag))); changed();
  });
  $('#edit-text').oninput = changed;
  $('#edit-download').onclick = () => download(JSON.stringify(value(), null, 2), 'liubai-current-edit.txt', 'text/plain;charset=utf-8');
  $('#edit-form').onsubmit = event => {
    event.preventDefault();
    try { store.update(value(), original); dirty = false; closeDialog(); render(); toast(t('editSaved')); }
    catch (error) { $('#edit-error').textContent = errorText(error); }
  };
  $('#edit-text').focus();
}
function localDataSummary() {
  recovery.load(); let count = null;
  try { count = recovery.items().length; } catch {}
  return `<section class="local-data-summary" aria-label="${t('localModeTitle')}"><p class="badge">${accountAuth.active ? esc(accountAuth.session.user.email) : t(ownerConnection ? 'connectedModeState' : 'localModeState')}</p><p class="rule-note">${accountAuth.active ? esc(accountPanel.privacy) : t(ownerConnection ? 'connectedModeHelp' : 'localModeHelp')}</p><p class="rule-note" id="backup-activity">${esc(backupActivity())}</p><p class="rule-note">${t('localBackupScope')}</p><div class="backup-inventory"><p>${language==='zh'?`文字日记 ${personal().length} 条 · 手帐／录音 ${mediaState.entries.filter(r=>!r.deletedAt).length} 条 · 随手记（含归档）${notesStore.snapshot().notes.length} 条`:`${personal().length} text entries · ${mediaState.entries.filter(r=>!r.deletedAt).length} scrapbook / voice entries · ${notesStore.snapshot().notes.length} notes including archive`}</p><p class="rule-note">${language==='zh'?'文字日记备份、手帐／录音备份、随手记备份分别导出。草稿不在文字日记备份里；清理浏览器前，请先保存或下载当前输入。':'Journal, media and quick notes have separate backup files. Journal backups do not include drafts. Save or download current input before clearing browser storage.'}</p><button class="secondary" id="notes-backup-open">${language==='zh'?'随手记备份与恢复':'Quick notes backup and restore'}</button></div><button class="text-button" id="recent-deleted">${count === null ? t('recentDeleted') : t('recentDeletedCount', { n: count })}</button><button class="text-button" id="media-backup-open">${t('mediaBackupOpen')}</button>${ownerConnection || !offlineCapable ? '' : `<details class="offline-options"><summary>${t('offlineTitle')}</summary><p class="rule-note">${t('offlineHelp')}</p><p class="rule-note" id="offline-status" role="status"></p><button class="secondary" id="offline-prepare">${t('offlinePrepare')}</button></details>`}</section>`;
}
function recentDeleted() {
  recovery.load(); let rows = [], error = '';
  try { rows = recovery.items(); } catch (failure) { error = errorText(failure); }
  const active = new Set(personal().map(entry => entry.id));
  openDialog(`<h2 id="dialog-title">${t('recentDeleted')}</h2><p class="dialog-sub">${t('recoverySub')}</p><p id="recovery-error" role="alert">${esc(error)}</p>${rows.length ? rows.map(row => `<article class="recovery-row"><time datetime="${row.entry.date}">${dateText(row.entry.date)}</time><p>${esc(row.entry.text) || t('noText')}</p><div class="dialog-actions"><button class="secondary" data-restore="${row.entry.id}">${t(active.has(row.entry.id) ? 'recoveryRestoreCopy' : 'recoveryRestore')}</button><button class="text-button" data-purge="${row.entry.id}">${t('recoveryPurge')}</button></div></article>`).join('') : error ? '' : `<p>${t('recoveryEmpty')}</p>`}<div class="dialog-actions">${rows.length ? `<button class="secondary" id="export-recovery">${t('recoveryExport')}</button>` : ''}${typeof recovery.raw === 'string' ? `<button class="text-button" id="export-raw-recovery">${t('recoveryRaw')}</button>` : ''}<button class="secondary" id="back-to-data">${t('dataPrivacy')}</button></div><section id="media-trash-root"></section>`);
  cleanup=mediaUI.mountTrash($('#media-trash-root'));
  $$('[data-restore]').forEach(button => button.onclick = () => {
    try { const result = recovery.restore(button.dataset.restore); render(); recentDeleted(); toast(t(result.retained ? 'recoveryRetained' : result.copied ? 'recoveryCopied' : 'recoveryRestored')); }
    catch (failure) { $('#recovery-error').textContent = errorText(failure); }
  });
  $$('[data-purge]').forEach(button => button.onclick = () => {
    if (!confirm(t('recoveryPurgeConfirm'))) return;
    try { recovery.purge(button.dataset.purge); recentDeleted(); } catch (failure) { $('#recovery-error').textContent = errorText(failure); }
  });
  if ($('#export-recovery')) $('#export-recovery').onclick = () => {
    try { recovery.load(); download(makeBackup({ version: 1, entries: recovery.items().map(row => row.entry), careCount: 0 }), `liubai-recently-deleted-${dayKey(new Date())}.backup.json`); toast(t('exported')); }
    catch (failure) { $('#recovery-error').textContent = errorText(failure); }
  };
  if ($('#export-raw-recovery')) $('#export-raw-recovery').onclick = () => download(recovery.exportText(), 'liubai-recovery-original.json');
  $('#back-to-data').onclick = backups;
}
function deleteEntry(id) {
  openDialog(`<h2 id="dialog-title">${t('deleteTitle')}</h2><p class="dialog-sub">${t('webDeleteSub')}</p><p id="delete-error" role="alert"></p><div class="dialog-actions"><button class="primary" id="confirm-delete">${t('confirmDelete')}</button><button class="secondary" id="cancel-delete">${t('cancel')}</button></div>`);
  $('#cancel-delete').onclick = closeDialog;
  $('#confirm-delete').onclick = () => { try { recovery.remove(id); closeDialog(); render(); toast(t('webDeleted')); } catch (error) { $('#delete-error').textContent = errorText(error); } };
  $('#cancel-delete').focus();
}
function download(content, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() {
  download(store.backup(), `mood-journal-${dayKey(new Date())}.backup.json`);
  try { browserStorage.setItem(BACKUP_ACTIVITY_KEY, new Date().toISOString()); } catch {}
  if ($('#backup-activity')) $('#backup-activity').textContent = backupActivity();
  toast(t('exported'));
}
function backupActivity() {
  try {
    const date = browserStorage.getItem(BACKUP_ACTIVITY_KEY);
    if (date && /^\d{4}-\d{2}-\d{2}T/.test(date) && Number.isFinite(Date.parse(date))) return t('localBackupLast', { date: dateText(date) });
  } catch {}
  return t('localBackupNever');
}
function exportTXT() {
  const entries = shown();
  const text = formatJournalText(entries, { language, sample: sampleMode, formatDate: dateText });
  download(text, `mood-journal-${language}-${dayKey(new Date())}.txt`, 'text/plain;charset=utf-8'); toast(t('exported'));
}
function exportCurrent() {
  if (store.status === 'ready') exportJSON();
  else { download(store.rawBackup(), `mood-journal-original-${dayKey(new Date())}.txt`, 'text/plain;charset=utf-8'); toast(t('rawDownloaded')); }
}
function backups() {
  let pending = null, generation = 0;
  const locked = store.status !== 'ready', unreadable = store.status === 'unreadable';
  openDialog(`<h2 id="dialog-title">${t('backupTitle')}</h2>${localDataSummary()}<p class="dialog-sub">${t('backupSub')}</p><div class="dialog-actions"><button id="export-json" class="secondary" ${locked ? 'disabled' : ''}>${t('exportJSON')}</button><button id="export-txt" class="secondary" ${locked && !sampleMode ? 'disabled' : ''}>${t('exportTXT')}</button>${store.status === 'corrupt' ? `<button class="secondary" id="export-raw">${t('rawBackup')}</button>` : ''}</div><label for="import-file">${t('importFile')}</label><input type="file" accept=".json,application/json" id="import-file" ${unreadable ? 'disabled' : ''}><label for="import-mode">${t('importMode')}</label><select id="import-mode"><option value="merge" ${locked ? 'disabled' : ''}>${t('merge')}</option><option value="replace" ${locked ? 'selected' : ''}>${t('replace')}</option></select><p class="rule-note">${t('mergeHelp')}</p><p class="rule-note">${t('replaceHelp')}</p><p id="import-preview" role="status"></p><p id="import-error" role="alert"></p><button class="primary" id="apply-import" disabled>${t('applyImport')}</button>`);
  $('#notes-backup-open').onclick=()=>quickNotes();
  $('#recent-deleted').onclick = recentDeleted;
  $('#media-backup-open').onclick=()=>mediaUI.openBackup();
  if ($('#offline-prepare')) {
    const status = $('#offline-status'), button = $('#offline-prepare');
    offlineReady().then(ready => { if (status.isConnected) status.textContent = t(ready ? 'offlineReady' : 'offlineNotReady'); });
    button.onclick = async () => {
      button.disabled = true; status.textContent = t('offlinePreparing');
      try { await prepareOffline(); if (status.isConnected) status.textContent = t('offlineReady'); }
      catch { if (status.isConnected) status.textContent = t('offlineUnavailable'); }
      finally { if (button.isConnected) button.disabled = false; }
    };
  }
  $('#export-json').onclick = () => { try { exportJSON(); } catch (error) { $('#import-error').textContent = errorText(error); } };
  $('#export-txt').onclick = exportTXT;
  if ($('#export-raw')) $('#export-raw').onclick = exportCurrent;
  $('#import-file').onchange = async event => {
    const request = ++generation, file = event.target.files[0]; pending = null; $('#apply-import').disabled = true; $('#import-preview').textContent = ''; $('#import-error').textContent = '';
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw { code: 'fileTooLarge' };
      const value = parseBackup(await file.text());
      if (request !== generation || !$('#import-preview')) return;
      pending = value; $('#import-preview').textContent = t('importPreview', { n: value.entries.length, count: value.careCount }); $('#apply-import').disabled = false;
    } catch (error) { if (request === generation && $('#import-error')) $('#import-error').textContent = errorText(error); }
  };
  cleanup = () => { generation++; };
  $('#apply-import').onclick = () => {
    if (!pending) return;
    if ($('#import-mode').value === 'replace') { confirmReplacement(pending); return; }
    try { store.merge(pending); sampleMode = false; closeDialog(); render(); toast(t('imported')); } catch (error) { $('#import-error').textContent = errorText(error); }
  };
}
function confirmReplacement(data) {
  openDialog(`<h2 id="dialog-title">${t('replaceTitle')}</h2><p class="dialog-sub">${t('replaceWarning')}</p><button class="secondary" id="backup-current">${t('backupCurrent')}</button><label class="checkbox"><input type="checkbox" id="backup-acknowledged"><span>${t('acknowledge')}</span></label><p id="replace-error" role="alert"></p><div class="dialog-actions"><button class="primary" id="confirm-replace" disabled>${t('confirmReplace')}</button><button class="secondary" id="cancel-replace">${t('cancel')}</button></div>`);
  $('#backup-current').onclick = () => { try { exportCurrent(); $('#backup-acknowledged').checked = true; $('#confirm-replace').disabled = false; } catch (error) { $('#replace-error').textContent = errorText(error); } };
  $('#backup-acknowledged').onchange = event => { $('#confirm-replace').disabled = !event.target.checked; };
  $('#cancel-replace').onclick = closeDialog;
  $('#confirm-replace').onclick = () => {
    try { store.replace(data, { confirmed: true, backupAcknowledged: $('#backup-acknowledged').checked }); sampleMode = false; closeDialog(); render(); toast(t('imported')); }
    catch (error) { $('#replace-error').textContent = errorText(error); }
  };
}
function aiPreview(id) {
  const entry = personal().find(record => record.id === id);
  if (!entry) return;
  openDialog(`<h2 id="dialog-title">${t('aiTitle')}</h2><div id="ai-panel"></div>`);
  activeAIEntry = id;
  const dispose = mountAIDialog($('#ai-panel'), { client: aiClient, entry, locale: language, t, esc,
    unchanged: original => JSON.stringify(personal().find(record => record.id === original.id)) === JSON.stringify(original),
    adopt: (original, text) => { store.add({ ...original, id: crypto.randomUUID(), text, date: new Date().toISOString() }); render(); }
  });
  cleanup = () => { dispose(); activeAIEntry = null; };
}
function privacy() { if(experience==='care'){openDialog(`<h2 id="dialog-title">${t('privacyTitle')}</h2><p class="dialog-sub">${t('careHelp')}</p><p class="rule-note">${t('modeBoundary')}</p><button id="privacy-backup" class="primary">${t('dataPrivacy')}</button>`);$('#privacy-backup').onclick=backups;return;} if(accountAuth.active){openDialog(`<h2 id="dialog-title">${t('privacyTitle')}</h2><p class="privacy-copy">${esc(accountPanel.privacy)}</p><button id="privacy-backup" class="primary">${t('dataPrivacy')}</button>`);$('#privacy-backup').onclick=backups;return;} openDialog(`<h2 id="dialog-title">${t('privacyTitle')}</h2><p class="privacy-copy">${t('privacyBody')}</p><p class="rule-note">${t('support')}</p><button class="primary" id="privacy-backup">${t('dataPrivacy')}</button>`); $('#privacy-backup').onclick = backups; }
function practice(kind) {
  if(kind==='sound'){space.openSound();return;}
  if(kind==='breath'){meditation();return;}
  let session, rain = kind === 'sound' ? new RainAudio() : null;
  openDialog(`<div class="practice"><h2 id="dialog-title">${t(kind + 'Title')}</h2><p class="dialog-sub">${t(kind + 'Help')}</p>${kind === 'breath' ? `<div class="breath-orb">${t('ready')}</div>` : kind === 'sound' ? `<div class="sound-visual" aria-hidden="true">≋</div><label for="volume">${t('volume')}</label><input type="range" id="volume" min="0" max="0.6" step="0.01" value="0.18">` : `<ol class="steps">${[0, 1, 2].map(i => `<li>${t('move' + i)}</li>`).join('')}</ol><p id="move-phase">${t('ready')}</p>`}<div class="timer" aria-label="${t('remaining')}">${formatTime(DURATIONS[kind])}</div><div class="dialog-actions"><button id="start-practice" class="primary">${t('start')}</button><button id="reset-practice" class="secondary">${t('reset')}</button></div><div id="practice-finished" aria-live="polite"></div></div>`);
  const update = state => {
    if (session?.disposed) return;
    $('.timer').textContent = formatTime(state.remaining);
    $('#start-practice').textContent = t(state.running ? 'pause' : state.remaining < DURATIONS[kind] ? 'resume' : 'start');
    $('#start-practice').disabled = state.completed;
    if (kind === 'breath') { const inhale = state.elapsed % 10 < 4; $('.breath-orb').classList.toggle('expand', state.running && inhale); $('.breath-orb').textContent = t(state.running ? inhale ? 'inhale' : 'exhale' : 'ready'); }
    if (kind === 'move') $('#move-phase').textContent = t(state.running ? 'move' + Math.min(2, Math.floor(state.elapsed / 40)) : 'ready');
    if (rain && !state.running) { rain.stop(); $('.sound-visual').classList.remove('playing'); }
  };
  session = new PracticeSession(kind, { onUpdate: update, onComplete: () => {
    let message = t('finished'); try { store.completeCare(); } catch { message += ' ' + t('countNotSaved'); }
    $('#practice-finished').innerHTML = `<p class="finished">${message}</p><button class="text-button" id="reflect">${t('reflect')}</button>`;
    $('#reflect').onclick = () => { closeDialog(); render(); openRecord(); };
  } });
  cleanup = () => { session.dispose(); rain?.stop(); };
  $('#start-practice').onclick = async () => {
    if (session.running) { session.pause(); return; }
    session.start();
    if (rain && session.running) { try { await rain.start(); if (!session.disposed && session.running) $('.sound-visual').classList.add('playing'); } catch { if (!session.disposed) { session.pause(); toast(t('audioUnavailable')); } } }
  };
  $('#reset-practice').onclick = () => { rain?.stop(); session.reset(); $('#practice-finished').innerHTML = ''; };
  if ($('#volume')) $('#volume').oninput = event => rain.setVolume(Number(event.target.value));
}
$('#language').onchange = event => { carePanel?.close(); if ($('#dialog').open && !closeDialog()) { event.target.value = language; return; } language = event.target.value; try { browserStorage.setItem('local-mood-journal.language', language); } catch {} render();syncPanel?.settingsChanged(); $('#language').focus(); };
window.addEventListener('hashchange', () => { const target = location.hash.slice(1); if (pages.includes(target) && target !== page) { carePanel?.close(); if ($('#dialog').open && !closeDialog()) { history.replaceState(null, '', '#' + page); return; } page = target; render(); $('#main').focus(); } });
window.addEventListener('pagehide', () => { disposeDialog(); pageCleanup?.(); carePanel?.dispose();syncPanel?.dispose();accountPanel?.dispose();space?.dispose(); });
window.addEventListener('pagehide', () => aiClient.disconnect());
window.addEventListener('storage', event => {if(event.key===browserStorage.physicalKey(NOTES_KEY)||event.key===browserStorage.physicalKey(DAILY_SETTINGS_KEY)){if(!$('#dialog').open)render();return;}if(event.key===EXPERIENCE_KEY){aiClient.cancel();space?.stop();carePanel?.sourcesChanged();const banner=$('#storage-banner');banner.hidden=false;banner.innerHTML=`<p>${t('modeOtherTab')}</p><button id="reload-experience" class="secondary">${t('retry')}</button>`;$('#reload-experience').onclick=()=>{if(!$('#dialog').open||closeDialog())location.reload();};return;}if(accountAuth.active){if(event.key===accountPanel?.physicalCacheKey){store.load();if(!$('#dialog').open)render();}else if(event.key?.startsWith(scopedName(''))){carePanel?.sourcesChanged();}return;} syncPanel?.storageChanged(event.key); if (event.key === CARE_KEY || event.key === null) carePanel?.sourcesChanged(); if (event.key === QUOTE_KEY) { quotes.load(); if (page === 'today' && !$('#dialog').open) render(); } if (event.key === store.key) { store.load(); if (activeAIEntry) { closeDialog(); toast(t('aiEntryChanged')); } if (!$('#dialog').open) render(); } });
const appearance=createAppearance({onChange(value,preference){const button=$('#appearance-open');if(button)button.innerHTML=icon(value==='night'?'moon':'palette')+`<span>${language==='zh'?'外观':'Appearance'}</span>`;if($('#appearance-auto'))$('#appearance-auto').checked=preference==='auto';$$('[data-choose-appearance]').forEach(b=>b.setAttribute('aria-pressed',String(preference===b.dataset.chooseAppearance)));}});
const ownerConnection = experience==='care'||accountAuth.active ? null : createOwnerConnection();
carePanel = createCompanionPanel({dialog:$('#care-dialog'),launcher:$('#care-launcher'),store:careStore,storage:browserStorage,...(ownerConnection?{connection:ownerConnection,client:ownerConnection.client}:{}),getJournal:()=>{store.load();return personal();},getLanguage:()=>language,esc,beforeOpen:()=>!$('#dialog').open||closeDialog(),saveEntry:entry=>store.add(entry),onSaved:()=>{sampleMode=false;bookFilter='all';favoritesOnly=false;searchQuery='';page='journal';location.hash='journal';render();toast(t('saved'));}});
syncPanel=ownerConnection?.mountSync?.({journal:store,care:careStore,storage:browserStorage,getLanguage:()=>language,onLanguage:next=>{carePanel?.close();language=next;try{browserStorage.setItem('local-mood-journal.language',language);}catch{}render();},esc,anchor:$('#backup-open')})||null;
mediaUI=createMediaUI({store:mediaStore,storage:browserStorage,getLanguage:()=>language,t,esc,dateText,openDialog,closeDialog,toast,refresh:async()=>{sampleMode=false;mediaMode='all';bookFilter='all';favoritesOnly=false;monthFilter='';searchQuery='';filter='all';await refreshMedia();},lifecycle:({guard=null,dispose=null})=>{allowDialogClose=guard;cleanup=dispose;}});
space=createSpaceController({storage:browserStorage,language:()=>language,esc,openDialog,closeDialog,toast,onChange:()=>{if(page==='today')render();},lifecycle:({guard=null,dispose=null})=>{allowDialogClose=guard;cleanup=dispose;}});
accountPanel=createAccountPanel({auth:accountAuth,config:ACCOUNT_CONFIG,journal:store,storage:localStorage,language:()=>language,esc,openDialog,closeDialog,
  lifecycle:guard=>{allowDialogClose=guard;},onChange:()=>{store.load();render();},
  guestEntries:()=>{const guest=new JournalStore({getItem:key=>localStorage.getItem(key),setItem:()=>{throw Error('Read only');}});guest.requireReady();return guest.snapshot();},
  importGuest:data=>{store.merge({...data,careCount:store.snapshot().careCount});render();}});
mini=createMiniExperience({storage:browserStorage,store,mediaStore,notesStore,quotes,appearance,getLanguage:()=>language,getMedia:()=>mediaState.entries,openDialog,closeDialog,render,toast,navigate,backups,appearanceSettings,usageSettings,refreshMedia,get mediaUI(){return mediaUI;},localReflect:()=>carePanel.open(),moodLabel:n=>t('mood'+n)});
render(); void refreshMedia();
if(!mini.hasGuide())setTimeout(()=>mini.guide(),200);
if(location.hash==='#notes')quickNotes();
const reminderClock=setInterval(()=>{if(!document.hidden)checkReminder();},30000);
window.addEventListener('pagehide',()=>clearInterval(reminderClock));
document.addEventListener('visibilitychange',()=>{dailySettings.load();if(document.hidden&&dailySettings.snapshot().autoCurtain)maskPage();else if(!document.hidden)checkReminder();});
accountPanel.start();if(accountInitError)accountPanel.report(accountInitError);
if(mediaChannel)mediaChannel.onmessage=()=>{if(!document.hidden)void refreshMedia();};
window.addEventListener('focus',()=>void refreshMedia());

let quoteDay = localDateKey();
setInterval(() => { const day = localDateKey(); if (day !== quoteDay) { quoteDay = day; if (page === 'today' && !$('#dialog').open) render(); } }, 60000);
