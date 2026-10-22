import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {atomicJSON,loadJSON,passwordHash} from '../services/server.mjs';
const root=resolve(process.env.LIUBAI_DATA_DIR||'.liubai-data'),[action,username,threadId]=process.argv.slice(2);
const users=await loadJSON(resolve(root,'users.json'),[]);
if(action==='user'){
 const password=process.env.LIUBAI_USER_PASSWORD;if(!/^[a-zA-Z0-9_-]{3,60}$/.test(username||'')||!password||password.length<12||password.length>256)throw Error('Provide username and LIUBAI_USER_PASSWORD (12–256 characters).');
 if(users.some(u=>u.username===username))throw Error('User already exists; no account was changed.');const salt=randomBytes(16).toString('hex');users.push({id:randomBytes(16).toString('hex'),username,salt,hash:passwordHash(password,salt)});await atomicJSON(resolve(root,'users.json'),users);console.log('Created account:',username);
}else if(action==='inbox'||action==='reply'){
 const u=users.find(u=>u.username===username);if(!u)throw Error('User not found.');const path=resolve(root,u.id,'letters.json'),threads=await loadJSON(path,[]);
 if(action==='inbox')console.log(JSON.stringify(threads,null,2));
 else{const text=process.env.LIUBAI_REPLY_TEXT;if(!text?.trim()||text.length>2000)throw Error('Provide LIUBAI_REPLY_TEXT (up to 2000 characters).');const t=threads.find(t=>t.id===threadId);if(!t)throw Error('Thread not found.');t.messages.push({role:'maintainer',text,date:new Date().toISOString()});await atomicJSON(path,threads);console.log('Reply saved.');}
}else throw Error('Use: user USERNAME | inbox USERNAME | reply USERNAME THREAD_ID');
