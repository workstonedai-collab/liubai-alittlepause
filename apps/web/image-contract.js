// Visual prompts only: this contract has no journal, conversation or photo fields.
export const IMAGE_LIMITS = Object.freeze({prompt:600,bytes:2*1024*1024,jsonBytes:3*1024*1024,edge:1024});
export const imageError=code=>Object.assign(new Error(code),{code});
const fail=code=>{throw imageError(code);};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.split('|').sort().join('|');
export function validateImageRequest(value) {
  if(!exact(value,'version|requestId|prompt|consent')||value.version!==1||typeof value.requestId!=='string'||!/^image-[a-f0-9-]{36}$/.test(value.requestId)||typeof value.prompt!=='string')fail('careInvalid');
  if(value.consent!==true)fail('careConsentRequired');
  if(!value.prompt.trim()||value.prompt!==value.prompt.trim()||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.prompt))fail('careInvalid');
  if(value.prompt.length>IMAGE_LIMITS.prompt)fail('careLimit');
  return {...value};
}
export function validateImageResponse(value,requestId) {
  if(!exact(value,'version|requestId|provider|model|base64|mime|width|height|sourceId')||value.version!==1||value.requestId!==requestId||value.provider!=='MiniMax'||value.model!=='image-01'||
    !['image/png','image/jpeg','image/webp'].includes(value.mime)||value.width!==IMAGE_LIMITS.edge||value.height!==IMAGE_LIMITS.edge||typeof value.sourceId!=='string'||!/^[a-f0-9]{24}$/.test(value.sourceId)||
    typeof value.base64!=='string'||!value.base64.length||value.base64.length>Math.ceil(IMAGE_LIMITS.bytes/3)*4||value.base64.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.base64))fail('careOutputInvalid');
  return {...value};
}
// Existing v1 album backups already retain this name. No diary/album schema migration.
export const imageProvenance=value=>`AI生成·MiniMax · image-01 · ${value.sourceId}`;
