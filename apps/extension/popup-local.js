import {JournalStore} from '../../packages/core/journal.js';
import {validateData} from '../../packages/data-contract/index.js';
import {createWebStorage} from '../web/storage.js';
import {setAccountScope} from '../web/account-scope.js';
import {readMode,privateScope} from '../web/experience.js';
setAccountScope(readMode()==='care'?privateScope():null);
const $=s=>document.querySelector(s),port=createWebStorage(),store=new JournalStore(port),key='liubai.popup-draft.v1';let mood=2,draft='';
try{const d=JSON.parse(port.getItem(key)||'null');if(d){mood=d.mood;draft=d.text;}}catch{$('#status').textContent='旧草稿无法读取。请先导出原数据再继续。';$('#save').disabled=true;}
$('#text').value=draft;
const persist=()=>{try{port.setItem(key,JSON.stringify({mood,text:$('#text').value}));$('#status').textContent='草稿已保存在此扩展。';$('#save').disabled=false;}catch{$('#status').textContent='草稿没有保存。请先复制文字，保留这个窗口。';$('#save').disabled=true;}};
document.querySelectorAll('[data-mood]').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.mood)===mood));b.onclick=()=>{mood=Number(b.dataset.mood);document.querySelectorAll('[data-mood]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));persist();};});$('#text').oninput=persist;
$('#form').onsubmit=e=>{e.preventDefault();try{store.load();store.add({id:crypto.randomUUID(),date:new Date().toISOString(),mood,tags:[],text:$('#text').value.trim()});$('#text').value='';port.setItem(key,JSON.stringify({mood:2,text:''}));$('#status').textContent='这一刻，已经记下来了。';}catch{$('#status').textContent='没有保存成功。请先保留当前文字，再打开完整日记检查。';}};
$('#full').onclick=()=>{chrome.tabs.create({url:chrome.runtime.getURL('index.html')});};
// Older private builds used chrome.storage.local. Copy valid records once without deleting them.
try{if(!localStorage.getItem('liubai.extension-legacy-imported.v1')){const raw=(await chrome.storage.local.get('local-mood-journal.data.v1'))['local-mood-journal.data.v1'];if(raw){const value=validateData(typeof raw==='string'?JSON.parse(raw):raw);if(readMode()==='care'){$('#status').textContent='旧版普通空间记录仍在，切回普通空间后可接续。';}else{store.merge(value);localStorage.setItem('liubai.extension-legacy-imported.v1','1');}}else localStorage.setItem('liubai.extension-legacy-imported.v1','1');}}catch{$('#status').textContent='旧版数据未能自动接续，原内容没有删除。请用旧版 JSON 备份导入完整日记。';}
