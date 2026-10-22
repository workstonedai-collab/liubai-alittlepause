import { CARE_LIMITS,careError,careKeys,careText,careDate,validCareID,validateCareRefs } from './care-contract.js';
export const CARE_KEY='liubai.care.v1';
export const emptyCareData=()=>({version:1,saveChats:false,memories:[],conversations:[]});
export function validateCareData(value) {
  careKeys(value,['version','saveChats','memories','conversations']);
  if (value.version!==1 || typeof value.saveChats!=='boolean' || !Array.isArray(value.memories) || value.memories.length>CARE_LIMITS.memories || !Array.isArray(value.conversations) || value.conversations.length>CARE_LIMITS.conversations || (!value.saveChats && value.conversations.length)) throw careError('careInvalid');
  const ids=new Set();
  for(const memory of value.memories){careKeys(memory,['id','text','createdAt','updatedAt','sourceRefs']);careText(memory.text,CARE_LIMITS.memoryText);validateCareRefs(memory.sourceRefs);if(!validCareID(memory.id)||ids.has(memory.id)||!careDate(memory.createdAt)||!careDate(memory.updatedAt))throw careError('careInvalid');ids.add(memory.id);}
  for(const conversation of value.conversations){careKeys(conversation,['id','updatedAt','messages']);if(!validCareID(conversation.id)||ids.has(conversation.id)||!careDate(conversation.updatedAt)||!Array.isArray(conversation.messages)||conversation.messages.length>CARE_LIMITS.messages||conversation.messages.length%2)throw careError('careInvalid');ids.add(conversation.id);
    conversation.messages.forEach((message,index)=>{careKeys(message,['id','role','text','sourceRefs','directRefs']);if(!validCareID(message.id)||ids.has(message.id)||message.role!==(index%2?'assistant':'user'))throw careError('careInvalid');careText(message.text,message.role==='user'?CARE_LIMITS.input:CARE_LIMITS.output);validateCareRefs(message.sourceRefs);if(!Array.isArray(message.directRefs)||message.directRefs.length>CARE_LIMITS.references||new Set(message.directRefs).size!==message.directRefs.length||message.directRefs.some(key=>!message.sourceRefs.some(ref=>ref.kind+':'+ref.id===key)))throw careError('careInvalid');ids.add(message.id);});
  }
  if(new TextEncoder().encode(JSON.stringify(value)).length>CARE_LIMITS.storeBytes)throw careError('careLimit');return structuredClone(value);
}
export function createCareStore(storage) {
  let data=emptyCareData(),raw=null,readable=false;
  function load(){try{const current=storage.getItem(CARE_KEY);const next=current===null?emptyCareData():validateCareData(JSON.parse(current));data=next;raw=current;readable=true;}catch{readable=false;}return readable;}
  load();
  function update(change){if(!readable)throw careError('careStorageFailed');try{if(storage.getItem(CARE_KEY)!==raw){load();throw careError('careStorageChanged');}const next=validateCareData(change(structuredClone(data))),text=JSON.stringify(next);storage.setItem(CARE_KEY,text);data=next;raw=text;return structuredClone(data);}catch(error){throw careError(['careStorageChanged','careLimit','careInvalid'].includes(error.code)?error.code:'careWriteFailed');}}
  return {load,snapshot:()=>structuredClone(data),get readable(){return readable;},update,
    saveMemory(memory){return update(next=>{const index=next.memories.findIndex(item=>item.id===memory.id);if(index<0)next.memories.push(memory);else next.memories[index]=memory;return next;});},
    deleteMemory(id){return update(next=>({...next,memories:next.memories.filter(item=>item.id!==id)}));},
    setSaveChats(enabled){return update(next=>({...next,saveChats:enabled,conversations:enabled?next.conversations:[]}));},
    saveConversation(conversation){if(!data.saveChats)return;return update(next=>{const index=next.conversations.findIndex(item=>item.id===conversation.id);if(index<0)next.conversations.push(conversation);else next.conversations[index]=conversation;return next;});},
    clearChats(){return update(next=>({...next,conversations:[]}));},
    exportText(){if(!readable)throw careError('careStorageFailed');return JSON.stringify({schema:'liubai-care',version:1,exportedAt:new Date().toISOString(),data},null,2);}
  };
}
