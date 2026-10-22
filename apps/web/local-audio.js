import { readMode } from './experience.js';
import { scopedName } from './account-scope.js';
export const AUDIO_LIBRARY='liubai-personal-audio-v1';
export const AUDIO_LIMITS={count:10,fileBytes:15*1048576,totalBytes:50*1048576};
export function validateTrack(row) {
  if(!row||Object.keys(row).sort().join()!=='blob,date,id,title'||!/^[a-f0-9]{64}$/.test(row.id)||typeof row.title!=='string'||row.title.length>120||
    !/^\d{4}-\d\d-\d\dT/.test(row.date)||!(row.blob instanceof Blob)||!row.blob.size||row.blob.size>AUDIO_LIMITS.fileBytes||
    !/^audio\/(mpeg|mp4|x-m4a|wav|x-wav|ogg|webm|flac)(;.*)?$/.test(row.blob.type))throw Error('audioLibraryInvalid');
  return row;
}
export function createAudioLibrary({indexedDB=globalThis.indexedDB}={}) {
  const boundary=readMode()==='care';
  const name=scopedName(AUDIO_LIBRARY);let database,readable=false;
  async function open(){if(database)return database;return new Promise((resolve,reject)=>{if(!indexedDB)return reject(Error('audioLibraryRead'));
    const request=indexedDB.open(name,1),timer=setTimeout(()=>reject(Error('audioLibraryRead')),5000);
    request.onupgradeneeded=()=>request.result.createObjectStore('tracks',{keyPath:'id'});
    request.onerror=request.onblocked=()=>{clearTimeout(timer);reject(Error('audioLibraryRead'));};
    request.onsuccess=()=>{clearTimeout(timer);database=request.result;database.onversionchange=()=>{database.close();database=null;readable=false;};resolve(database);};});}
  async function transaction(write,mutate){if(write&&boundary!==(readMode()==='care'))throw Error('audioLibraryWrite');if(write&&!readable)throw Error('audioLibraryRead');const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction('tracks',write?'readwrite':'readonly'),store=tx.objectStore('tracks'),request=store.getAll();let value,error;
    request.onsuccess=()=>{try{const rows=request.result;rows.forEach(validateTrack);if(rows.length>AUDIO_LIMITS.count||rows.reduce((n,r)=>n+r.blob.size,0)>AUDIO_LIMITS.totalBytes)throw Error('audioLibraryLimit');value=mutate(store,rows);}catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>{readable=true;resolve(value);};tx.onabort=tx.onerror=()=>reject(error||Error('audioLibraryWrite'));
  });}
  return {read:()=>transaction(false,(_s,rows)=>rows),add:rows=>transaction(true,(s,existing)=>{rows.forEach(validateTrack);const unique=new Map(existing.map(r=>[r.id,r]));rows.forEach(r=>unique.set(r.id,r));
    if(unique.size>AUDIO_LIMITS.count||[...unique.values()].reduce((n,r)=>n+r.blob.size,0)>AUDIO_LIMITS.totalBytes)throw Error('audioLibraryLimit');rows.forEach(r=>s.put(r));}),
    remove:id=>transaction(true,s=>s.delete(id)),close(){database?.close();database=null;readable=false;}};
}
export async function prepareTrack(file) {
  const blob=new Blob([file],{type:file.type||(/\.mp3$/i.test(file.name)?'audio/mpeg':/\.(m4a|mp4)$/i.test(file.name)?'audio/mp4':/\.wav$/i.test(file.name)?'audio/wav':'')});
  const row={id:'0'.repeat(64),title:file.name.slice(0,120),date:new Date().toISOString(),blob};validateTrack(row);
  row.id=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');return row;
}
