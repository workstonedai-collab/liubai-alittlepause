import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rename,realpath} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {systemPrompt} from './prompt.js';
const project=fileURLToPath(new URL('../',import.meta.url));
export const passwordHash=(password,salt)=>scryptSync(password,salt,64).toString('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function atomicJSON(path,value){await mkdir(resolve(path,'..'),{recursive:true,mode:0o700});const tmp=path+'.'+randomBytes(6).toString('hex')+'.tmp';await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,path);}
export async function loadJSON(path,fallback){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
export function createLiubaiServer({dataDir=resolve(process.env.LIUBAI_DATA_DIR||resolve(project,'.liubai-data')),webRoot=resolve(project,'dist/web'),publicOrigin=process.env.LIUBAI_PUBLIC_ORIGIN||'',allowedOrigins=(process.env.LIUBAI_ALLOWED_ORIGINS||'').split(',').filter(Boolean),aiKey=process.env.HUNYUAN_API_KEY||'',aiModel=process.env.HUNYUAN_MODEL||'',aiEndpoint=process.env.HUNYUAN_CHAT_ENDPOINT||'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',fetcher=globalThis.fetch}={}){
 const sessions=new Map(),attempts=new Map(),usage=new Map(),locks=new Map();
 const locked=async(key,fn)=>{const old=locks.get(key)||Promise.resolve();const next=old.catch(()=>{}).then(fn);locks.set(key,next);try{return await next;}finally{if(locks.get(key)===next)locks.delete(key);}};
 const aiEnabled=!!aiKey&&!!aiModel&&/^https:\/\//.test(aiEndpoint);
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 async function body(req,max=100000){let size=0,parts=[];if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))fail(415,'需要 JSON 请求。');for await(const chunk of req){size+=chunk.length;if(size>max)fail(413,'内容超过本服务的大小限制。');parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail(400,'内容格式不正确。');}}
 const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch{return res.writeHead(400).end();}
  if(!pathname.startsWith('/api/liubai/')){
   if(!['GET','HEAD'].includes(req.method))return res.writeHead(405).end();
   try{const p=decodeURIComponent(pathname);if(p.includes('\\')||p.split('/').some(s=>s==='..'||s.startsWith('.')))throw Error();const base=await realpath(webRoot),file=await realpath(resolve(base,'.'+(p==='/'?'/index.html':p)));if(relative(base,file).startsWith('..'))throw Error();const data=await readFile(file);const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.txt':'text/plain'}[extname(file)];if(!mime)throw Error();res.setHeader('Content-Type',mime);res.setHeader('Permissions-Policy','camera=(), microphone=(self)');res.writeHead(200).end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404).end();}return;
  }
  try{
   const origin=req.headers.origin,own=publicOrigin||'http://'+req.headers.host;
   if(!publicOrigin&&!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(req.headers.host||''))fail(403,'请为公开部署配置 LIUBAI_PUBLIC_ORIGIN。');
   if(origin&&origin!==own&&!allowedOrigins.includes(origin))fail(403,'这个来源尚未获得服务授权。');
   if(origin&&origin!=='null'){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');return res.writeHead(204).end();}
   const path=pathname.slice('/api/liubai/'.length);
   if(path==='status'&&req.method==='GET')return json(res,200,{service:'liubai',version:'1.0.0',ai:aiEnabled,sync:true,mail:true,registration:false});
   if(path==='login'&&req.method==='POST'){
    const key=req.socket.remoteAddress,rate=attempts.get(key)||{at:Date.now(),n:0};if(Date.now()-rate.at>900000){rate.at=Date.now();rate.n=0;}rate.n++;attempts.set(key,rate);if(attempts.size>2000)attempts.delete(attempts.keys().next().value);if(rate.n>10)fail(429,'尝试较多，请稍后再登录。');
    const b=await body(req);if(typeof b.username!=='string'||typeof b.password!=='string'||b.password.length>256)fail(400,'请填写账号和口令。');
    const users=await loadJSON(resolve(dataDir,'users.json'),[]),u=users.find(u=>u.username===b.username);const salt=u?.salt||'unregistered-user',hash=passwordHash(b.password,salt);if(!u||!timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(u.hash,'hex')))fail(401,'账号或口令不正确。');
    rate.n=0;for(const [t,s]of sessions)if(s.expires<Date.now())sessions.delete(t);const token=randomBytes(32).toString('hex');sessions.set(token,{id:u.id,user:u.username,expires:Date.now()+8*3600000});return json(res,200,{token,user:u.username});
   }
   const token=(req.headers.authorization||'').replace(/^Bearer /,''),session=sessions.get(token);if(!session||session.expires<Date.now())fail(401,'请先登录自己的留白服务。');
   const userDir=resolve(dataDir,session.id);
   if(path==='logout'&&req.method==='POST'){sessions.delete(token);return json(res,200,{ok:true});}
   if(path==='snapshot')return await locked(session.id,async()=>{
    const file=resolve(userDir,'snapshot.json'),current=await loadJSON(file,{revision:0,payload:null});
    if(req.method==='GET')return json(res,200,current);
    if(req.method==='DELETE'){await atomicJSON(file,{revision:current.revision+1,payload:null});return json(res,200,{revision:current.revision+1});}
    if(req.method==='PUT'){const b=await body(req,110*1048576);if(b.revision!==current.revision)fail(409,'云端已有更新，请先下载云端备份再决定如何合并。');if(b.payload?.format!=='liubai-portable'||b.payload.version!==1||b.payload.scope!=='main')fail(400,'只接收普通空间的完整备份。');const next={revision:current.revision+1,payload:b.payload};await atomicJSON(file,next);return json(res,200,{revision:next.revision});}fail(405,'不支持这个操作。');
   });
   if(path==='letters')return await locked(session.id,async()=>{
    const file=resolve(userDir,'letters.json'),threads=await loadJSON(file,[]);
    if(req.method==='GET')return json(res,200,{threads});
    if(req.method==='POST'){const b=await body(req);if(typeof b.text!=='string'||!b.text.trim()||b.text.length>2000||typeof b.requestId!=='string'||!/^[a-z0-9-]{1,128}$/i.test(b.requestId))fail(400,'请写下2000字以内的内容。');if(threads.some(t=>t.requestId===b.requestId))return json(res,200,{threads});if(threads.length>=100)fail(409,'来信较多，请联系维护者整理。');if(b.thread){const t=threads.find(t=>t.id===b.thread);if(!t)fail(404,'没有找到这封来信。');if(t.messages.length>=100)fail(409,'这封来信已较长，请新建来信。');t.messages.push({role:'user',text:b.text,date:new Date().toISOString()});}else threads.unshift({id:randomBytes(12).toString('hex'),requestId:b.requestId,messages:[{role:'user',text:b.text,date:new Date().toISOString()}]});await atomicJSON(file,threads);return json(res,200,{threads});}fail(405,'不支持这个操作。');
   });
   if(path==='ai'&&req.method==='POST'){
    if(!aiEnabled)fail(503,'维护者尚未接入混元服务，本次没有发送给模型。');const b=await body(req);
    if(b.confirmed!==true||!['chat','overview'].includes(b.kind)||!Array.isArray(b.messages)||!b.messages.length||b.messages.length>13||b.messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>18000)||b.messages.reduce((n,m)=>n+m.content.length,0)>24000||typeof b.personal!=='string'||b.personal.length>6000)fail(400,'请确认本次发送范围。');
    const key=session.id+':'+new Date().toISOString().slice(0,10),used=usage.get(key)||0;if(used>=10)fail(429,'今天的 AI 请求已到本服务上限。');usage.set(key,used+1);
    let response;try{response=await fetcher(aiEndpoint,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+aiKey,'Content-Type':'application/json'},body:JSON.stringify({model:aiModel,messages:[{role:'system',content:systemPrompt(b.kind,b.intent,b.language,b.personal)},...b.messages],max_tokens:b.kind==='overview'?1200:700,temperature:.6,stream:false}),signal:AbortSignal.timeout(55000)});}catch{fail(502,'模型暂时没有回应，请稍后再试。');}
    if(!response.ok)fail(502,'模型服务未完成请求，请维护者检查额度和配置。');const result=await response.json(),choice=result.choices?.[0],text=choice?.message?.content;if(typeof text!=='string'||!text.trim()||text.length>16000||choice.finish_reason==='length')fail(502,'这次回复不完整，请稍后重试。');return json(res,200,{text,model:aiModel,createdAt:new Date().toISOString()});
   }
   fail(404,'没有找到这个接口。');
  }catch(e){json(res,e.status||500,{error:e.status?e.message:'本次操作未完成，原内容仍保留。'});}
 });return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||4187);createLiubaiServer().listen(port,process.env.HOST||'127.0.0.1',()=>console.log('Liubai: http://127.0.0.1:'+port));}
