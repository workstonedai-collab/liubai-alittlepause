import { parseBackup,makeBackup,mergeData,MAX_BYTES,utf8ByteLength } from '../../packages/data-contract/index.js';
import { exportMedia,parseMediaBackup,mediaSignature,checkMediaCapacity } from './media-contract.js';
import { exportGallery,parseGalleryBackup,checkCapacity } from './gallery-files.js';
import { createGalleryStore } from './gallery-store.js';
import { validateDepth,mergeRows } from './mini-model.js';
import {validateNotes} from './quick-notes.js';
import {createScrapbookLibrary} from './scrapbook-design.js';
function validLibrary(value){const lib=createScrapbookLibrary({getItem:()=>JSON.stringify(value)});if(!lib.readable)throw Error('本子与模板格式不正确。');return lib.snapshot();}
export async function makePortable({journal,media,depth,notes,storage,scope='main',includeAttachments=true}){
 const m=await media.read();if(m.sessions.length||m.drafts.length)throw Error('还有未完成的手帐或录音。请先保存或下载草稿，再制作完整备份。');
 const gallery=createGalleryStore();try{const images=await gallery.read(),lib=storage?createScrapbookLibrary(storage):null;if(lib&&!lib.readable)throw Error('本子设置无法读取，请先保留原数据。');return {format:'liubai-portable',version:1,createdAt:new Date().toISOString(),scope,journal:JSON.parse(makeBackup(journal.snapshot())),depth:depth.snapshot(),notes:notes.snapshot(),library:lib?.snapshot()||null,media:includeAttachments?JSON.parse(await(await exportMedia(m.entries)).text()):null,gallery:includeAttachments?JSON.parse(await(await exportGallery(images)).text()):null};}finally{gallery.close();}
}
export async function validatePortable(v){
 if(!v||v.format!=='liubai-portable'||v.version!==1||!['main','care'].includes(v.scope))throw Error('备份格式不正确。');
 const journal=parseBackup(JSON.stringify(v.journal));validateDepth(v.depth);
 validateNotes(v.notes);
 const media=v.media?await parseMediaBackup(new Blob([JSON.stringify(v.media)],{type:'application/json'})):[];
 const gallery=v.gallery?await parseGalleryBackup(new Blob([JSON.stringify(v.gallery)],{type:'application/json'})):[];
 return {journal,depth:v.depth,notes:v.notes,library:v.library?validLibrary(v.library):null,media,gallery,scope:v.scope};
}
export async function importPortable(value,{journal,media,depth,notes,storage,scope='main'}){
 const v=await validatePortable(value);if(v.scope!==scope)throw Error('这个备份属于另一个空间，请切换到对应模式后导入。');
 // Preflight all schemas, IDs and capacities before starting writes. Separate browser
 // databases cannot share a transaction: a storage failure may leave a partial merge.
 const merged=mergeData(journal.snapshot(),v.journal);if(utf8ByteLength(JSON.stringify(merged))>MAX_BYTES)throw Error('文字记录超过本机容量。');
 const d=depth.snapshot();for(const k of ['topics','details','weeks','collections','care','series'])d[k]=mergeRows(d[k],v.depth[k]);d.savedCustomLines=[...new Set([...d.savedCustomLines,...v.depth.savedCustomLines])];d.quoteKinds=[...new Set([...d.quoteKinds,...v.depth.quoteKinds])];d.hiddenQuotes=[...new Set([...d.hiddenQuotes,...v.depth.hiddenQuotes])];if(!d.customLine){d.customLine=v.depth.customLine;d.customEnabled=v.depth.customEnabled;}if(!d.art)d.art=v.depth.art;validateDepth(d);
 const n=notes.snapshot(),mergedNotes={...n,notes:mergeRows(n.notes,v.notes.notes)};validateNotes(mergedNotes);
 let library=null,nextLibrary=null;if(storage&&v.library){library=createScrapbookLibrary(storage);if(!library.readable)throw Error('本子设置无法读取。');nextLibrary=library.snapshot();for(const b of v.library.books){const old=nextLibrary.books.find(x=>x.id===b.id);if(!old)nextLibrary.books.push(b);else if(old.title!==b.title||old.color!==b.color){if(old.id==='default'&&!old.title)Object.assign(old,b);else throw Error('同一个本子有不同设置，请先分别保留备份。');}}nextLibrary.recipes=mergeRows(nextLibrary.recipes,v.library.recipes);validLibrary(nextLibrary);}
 const oldMedia=await media.read(),all=new Map(oldMedia.entries.map(r=>[r.id,r]));for(const r of v.media){if(all.has(r.id)&&mediaSignature(all.get(r.id))!==mediaSignature(r))throw Error('手帐或录音存在不同版本。请先分别保留备份。');all.set(r.id,r);}checkMediaCapacity([...all.values()],oldMedia.sessions,oldMedia.drafts);
 const gallery=createGalleryStore();try{const images=await gallery.read(),ids=new Set(images.map(r=>r.id));checkCapacity([...images,...v.gallery.filter(r=>!ids.has(r.id))]);
  await media.merge(v.media);await gallery.add(v.gallery);journal.merge(v.journal);depth.save(d);notes.importText(JSON.stringify({schema:'liubai-quick-notes',version:1,data:mergedNotes}));if(library)library.save(nextLibrary);
 }catch(e){throw Error('本次合并没有全部完成，已写入的部分可能保留。原备份文件没有修改；请保留文件后检查。'+(e.message==='idConflict'?'日记存在不同版本。':''));}finally{gallery.close();}return v;
}
