import { createLocalValue } from './local-settings.js';
export const NOTES_KEY='liubai.quick-notes.v1',NOTES_BYTES=1048576;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.split(',').sort().join();
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const validID=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(v);
export function validateNotes(value){
 if(!exact(value,'version,notes')||value.version!==1||!Array.isArray(value.notes)||value.notes.length>200)throw Error('notesInvalid');const ids=new Set();
 for(const n of value.notes){if(!exact(n,'id,text,createdAt,updatedAt,pinned,archived,conversion')||!validID(n.id)||ids.has(n.id)||typeof n.text!=='string'||n.text.length>2000||!validDate(n.createdAt)||!validDate(n.updatedAt)||typeof n.pinned!=='boolean'||typeof n.archived!=='boolean')throw Error('notesInvalid');ids.add(n.id);
  const c=n.conversion;if(c!==null&&(!exact(c,'id,date,mood,text,done')||!validID(c.id)||!validDate(c.date)||!Number.isInteger(c.mood)||c.mood<0||c.mood>4||typeof c.text!=='string'||!c.text.trim()||c.text.length>2000||typeof c.done!=='boolean'))throw Error('notesInvalid');
 }if(new TextEncoder().encode(JSON.stringify(value)).length>NOTES_BYTES)throw Error('notesLimit');return structuredClone(value);
}
export function createNotesStore(storage,{id=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){
 const port=createLocalValue(storage,NOTES_KEY,{version:1,notes:[]},validateNotes,NOTES_BYTES);
 const saveNotes=notes=>port.save({version:1,notes}).notes;
 function find(id,expected){const n=port.snapshot().notes.find(n=>n.id===id);if(!n||!expected||JSON.stringify(n)!==JSON.stringify(expected))throw Error('notesChanged');return n;}
 function replace(n){saveNotes(port.snapshot().notes.map(r=>r.id===n.id?n:r));return structuredClone(n);}
 return {load:()=>port.load(),get readable(){return port.readable;},get raw(){return port.raw;},snapshot:()=>port.snapshot(),
  put({id:noteID=id(),text},expected=null){let n=port.snapshot().notes.find(n=>n.id===noteID);if(n){find(noteID,expected);if(n.conversion&&!n.conversion.done)throw Error('notesPending');n={...n,text,updatedAt:now()};return replace(n);}if(expected)throw Error('notesChanged');n={id:noteID,text,createdAt:now(),updatedAt:now(),pinned:false,archived:false,conversion:null};saveNotes([...port.snapshot().notes,n]);return n;},
  flag(noteID,key,value,expected){if(!['pinned','archived'].includes(key)||typeof value!=='boolean')throw Error('notesInvalid');const n=find(noteID,expected);return replace({...n,[key]:value,updatedAt:now()});},
  convert(noteID,mood,journal,expected){let n=find(noteID,expected);if(n.conversion?.done)return {entry:structuredClone(n.conversion),retained:false};if(!n.text.trim())throw Error('notesEmpty');
   if(!n.conversion){n=replace({...n,conversion:{id:id(),date:n.createdAt,mood,text:n.text.trim(),done:false}});}else port.save(port.snapshot());
   const c=n.conversion,entry={id:c.id,date:c.date,mood:c.mood,text:c.text,tags:[]};journal.load();journal.requireReady();journal.merge({version:1,entries:[entry],careCount:journal.snapshot().careCount});
   try{replace({...n,archived:true,conversion:{...c,done:true},updatedAt:now()});return {entry,retained:false};}catch{return {entry,retained:true};}
  },
  exportText(){if(!port.readable)throw Error('notesLocked');return JSON.stringify({schema:'liubai-quick-notes',version:1,data:port.snapshot()},null,2);},
  importText(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>NOTES_BYTES*2)throw Error('notesLimit');const doc=JSON.parse(text);if(!exact(doc,'schema,version,data')||doc.schema!=='liubai-quick-notes'||doc.version!==1)throw Error('notesInvalid');const incoming=validateNotes(doc.data),current=port.snapshot(),map=new Map(current.notes.map(n=>[n.id,n]));for(const n of incoming.notes){if(map.has(n.id)&&JSON.stringify(map.get(n.id))!==JSON.stringify(n))throw Error('notesImportConflict');map.set(n.id,n);}return port.save({version:1,notes:[...map.values()]});}
 };
}
