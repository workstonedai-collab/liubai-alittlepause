import { createLocalValue } from './local-settings.js';
export const FEATURES=['media','notes','quotes','insights','ai','care','cloud'];
export const PRESETS={simple:{media:false,notes:false,quotes:false,insights:false,ai:false,care:false,cloud:false},immersive:Object.fromEntries(FEATURES.map(k=>[k,true])),care:{media:true,notes:false,quotes:true,insights:false,ai:false,care:true,cloud:false}};
export const MODES=[['simple','轻记','Just a note','心情、文字与日历，写完就收起。','Mood, words and a calendar.'],['immersive','沉浸','Take your time','手帐、回望与关怀，慢慢用。','Scrapbooks, reflections and care.'],['care','关怀','Private care','单独的本机空间，不连接云端。','A separate local space, without cloud services.'],['custom','自选','Your own way','常用的留下，其余入口收起来。','Keep the tools you reach for.']];
export const FEATURE_LABELS={media:['照片、语音与手帐','Photos, voice and scrapbooks'],notes:['随手便签','Quick notes'],quotes:['日常一笺','A daily line'],insights:['主题与情绪回看','Topics and reflections'],ai:['AI 对话与偏好','AI conversations'],care:['放松与关怀工具','Care practices'],cloud:['跨设备同步','Cross-device sync']};
export const ART=[...['meadow','mist','paper','night'].flatMap((theme,i)=>['river','lake','dunes'].map((scene,j)=>({id:theme+'-'+scene,file:theme+'-'+scene+'.png',zh:['原野','雾岚','暖笺','夜航'][i]+' · '+['河岸','湖畔','沙丘'][j],en:['Meadow','Mist','Paper','Night'][i]+' · '+['River','Lake','Dunes'][j]}))),...[['journal-window','窗边手帐','Window journal'],['insight-ripples','湖面回声','Quiet ripples'],['modes-corner','自己的角落','A quiet corner'],['botanical-paper','枝叶信纸','Botanical paper'],['sticker-leaf-corner','枝叶角饰','Leaf corner']].map(([id,zh,en])=>({id,file:id+(id==='sticker-leaf-corner'?'.png':'.jpg'),zh,en}))];
export const artURL=id=>{const a=ART.find(a=>a.id===id);return a?new URL('../../assets/'+a.file,import.meta.url).href:'';};
const bounded=(s,n)=>typeof s==='string'&&s.length<=n;
export const blankDepth=()=>({version:1,topics:[],details:[],weeks:[],collections:[],care:[],series:[],savedCustomLines:[],quoteKinds:[],hiddenQuotes:[],customLine:'',customEnabled:false,art:''});
export function validateDepth(v){
 if(v){v.series??=[];v.savedCustomLines??=[];if(!Array.isArray(v.series)||v.series.length>12||v.series.some(s=>!bounded(s.id,128)||!Number.isInteger(s.step)||s.step<0||s.step>3||!Array.isArray(s.notes)||s.notes.length>3||s.notes.some(t=>!bounded(t,2000)))||!Array.isArray(v.savedCustomLines)||v.savedCustomLines.length>100||v.savedCustomLines.some(t=>!bounded(t,120)))throw Error('localSettingsLocked');}
 if(!v||v.version!==1||!['topics','details','weeks','collections','care','quoteKinds','hiddenQuotes'].every(k=>Array.isArray(v[k]))||!bounded(v.customLine,120)||typeof v.customEnabled!=='boolean'||!bounded(v.art,80)||v.art&&!ART.some(a=>a.id===v.art))throw Error('localSettingsLocked');
 for(const k of ['topics','details','weeks','collections','care']){if(v[k].length>1200)throw Error('localSettingsLimit');for(const x of v[k])if(!x||!bounded(x.id,128)||!x.id)throw Error('localSettingsLocked');}
 for(const t of v.topics)if(!bounded(t.title,100)||!bounded(t.note,2000)||!Array.isArray(t.records)||t.records.some(x=>!bounded(x,128))||typeof t.archived!=='boolean')throw Error('localSettingsLocked');
 for(const t of v.details)if(!bounded(t.feeling,100)||!bounded(t.need,100)||!bounded(t.energy,30))throw Error('localSettingsLocked');
 for(const k of ['weeks','collections'])for(const t of v[k])if(!bounded(t.title,100)||!bounded(t.text,2000)||!Array.isArray(t.records)||t.records.some(x=>!bounded(x,128)))throw Error('localSettingsLocked');
 for(const t of v.care)if(!bounded(t.text,2000)||!['text','breath','move','sound'].includes(t.kind)||!['','helped','same','no'].includes(t.rating))throw Error('localSettingsLocked');
 for(const k of ['quoteKinds','hiddenQuotes'])if(v[k].length>200||v[k].some(x=>!bounded(x,100)))throw Error('localSettingsLocked');
 return v;
}
export function createDepth(storage){return createLocalValue(storage,'liubai.depth.web.v1',blankDepth(),validateDepth,1800000);}
export function featureSet(mode,storage=globalThis.localStorage){if(mode!=='custom')return {...(PRESETS[mode]||PRESETS.simple)};try{const v=JSON.parse(storage.getItem('liubai.features.web.v1')||'{}');return Object.fromEntries(FEATURES.map(k=>[k,typeof v[k]==='boolean'?v[k]:true]));}catch{return {...PRESETS.simple};}}
export const id=()=>crypto.randomUUID();
export function validateChat(v){if(!v||v.version!==1||typeof v.keep!=='boolean'||typeof v.memoryEnabled!=='boolean'||!bounded(v.preferences,1000)||!Array.isArray(v.memories)||v.memories.length>30||v.memories.some(x=>!bounded(x.id,128)||!bounded(x.text,500))||!Array.isArray(v.threads)||v.threads.length>20)throw Error('localSettingsLocked');for(const t of v.threads)if(!bounded(t.id,128)||!bounded(t.title,100)||!Array.isArray(t.messages)||t.messages.length>100||t.messages.some(m=>!['user','assistant'].includes(m.role)||!bounded(m.content,18000)))throw Error('localSettingsLocked');return v;}
export function createChat(storage){return createLocalValue(storage,'liubai.chat.web.v1',{version:1,keep:false,memoryEnabled:false,preferences:'',memories:[],threads:[]},validateChat,1500000);}
export function overviewSelection(entries,days,now=Date.now()){
 if(![7,30].includes(days))throw Error('Invalid range');const start=new Date(now);start.setDate(start.getDate()-days+1);start.setHours(0,0,0,0);
 const all=entries.filter(r=>Date.parse(r.date)>=+start&&Date.parse(r.date)<=now+5000&&r.text.trim()).sort((a,b)=>b.date.localeCompare(a.date));let size=0;const records=[];
 for(const r of all.slice(0,30)){const row={date:r.date,mood:r.mood,text:r.text};const n=JSON.stringify(row).length;if(size+n>12000)break;size+=n;records.push(row);}
 return {coverage:{days,from:start.toISOString(),to:new Date(now).toISOString(),selected:records.length,available:all.length},records};
}
export function mergeRows(a,b){const map=new Map(a.map(v=>[v.id,v]));for(const v of b){const old=map.get(v.id);if(!old)map.set(v.id,v);else if(JSON.stringify(old)!==JSON.stringify(v)){let hash=2166136261;for(const ch of JSON.stringify(v))hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;const copy={...v,id:v.id.slice(0,80)+'-copy-'+hash.toString(16)};map.set(copy.id,copy);}}return [...map.values()];}
