import { cloudAllowed } from './network-policy.js';
const KEY='liubai.service.web.v1';
const TOKEN='liubai.service-session.web.v1';
export function serviceAddress(){try{const saved=localStorage.getItem(KEY);if(saved)return saved;return /^https?:$/.test(location.protocol)?location.origin:'';}catch{return '';}}
export function validateServiceAddress(value){const u=new URL(value);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('请使用 HTTPS 地址，或本机 localhost 地址。');return u.origin;}
export function createServiceClient({fetcher=globalThis.fetch}={}){
 let token='',user='',abort=new AbortController();try{const x=JSON.parse(sessionStorage.getItem(TOKEN)||'null');if(x){token=x.token;user=x.user;}}catch{}
 function clear(){token='';user='';try{sessionStorage.removeItem(TOKEN);}catch{}abort.abort();abort=new AbortController();}
 globalThis.addEventListener?.('liubai-mode-change',()=>{if(!cloudAllowed())clear();});
 async function request(path,{method='GET',body}={}){
  if(!cloudAllowed())throw Error('关怀空间不连接云端。');if(!['login','status'].includes(path)&&!token)throw Error('请先在“我的 → 登录与跨设备同步”中连接自己的留白服务并登录。本次没有发送内容。');const base=serviceAddress();if(!base)throw Error('请先在“我的”中设置自己的服务地址。');
  const response=await fetcher(base+'/api/liubai/'+path,{method,credentials:'omit',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(65000)])});
  if(!(response.headers.get('content-type')||'').includes('application/json'))throw Error('这个地址没有运行留白服务。请参考仓库中的自托管说明。');
  const data=await response.json();if(!response.ok)throw Error(data.error||'这次请求没有完成。');return data;
 }
 return {request,get user(){return user;},get loggedIn(){return !!token;},async configure(address){const value=validateServiceAddress(address);if(globalThis.chrome?.permissions){const granted=await chrome.permissions.request({origins:[value+'/*']});if(!granted)throw Error('尚未允许连接这个服务地址。');}clear();localStorage.setItem(KEY,value);return value;},async login(username,password){const r=await request('login',{method:'POST',body:{username,password}});clear();token=r.token;user=r.user;sessionStorage.setItem(TOKEN,JSON.stringify({token,user}));return r;},async logout(){try{if(token)await request('logout',{method:'POST',body:{}});}finally{clear();}}};
}
