import { validateCareRequest,validateCareResponse,careError } from './care-contract.js';
const known=new Set(['careNotConnected','careCancelled','careTimeout','careBusy','careUnavailable','careOutputInvalid','careLimit','careRateLimited',
  'careAuthRequired','careForbidden','careBudgetExceeded','careBudgetPolicyChanged','careBudgetNotReady','careDuplicate']);
// No HTTP endpoint, secret access or built-in provider. Only explicit injection can generate.
export function createCareClient({transport=null,mode='test',timeoutMs=15000,now=Date.now}={}) {
  if(transport!==null&&typeof transport!=='function'||!['test','provider'].includes(mode)||!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>60000)throw careError('careInvalid');
  let active=null,revision=0,attempts=0,windowStart=0,windowCount=0;
  const cancel=()=>{revision++;active?.abort();};
  return {status:()=>({available:!!transport,mode:transport?mode:'preview'}),cancel,
    async generate(value){if(!transport)throw careError('careNotConnected');const request=validateCareRequest(value);if(active)throw careError('careBusy');const time=now();if(time-windowStart>=60000){windowStart=time;windowCount=0;}if(attempts>=20||windowCount>=3)throw careError('careRateLimited');attempts++;windowCount++;
      const controller=new AbortController(),version=++revision;active=controller;let timedOut=false,rejectAbort;
      const cancelled=new Promise((_,reject)=>{rejectAbort=()=>reject(careError(timedOut?'careTimeout':'careCancelled'));});controller.signal.addEventListener('abort',rejectAbort,{once:true});
      const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
      try{const result=await Promise.race([Promise.resolve().then(()=>{if(controller.signal.aborted||version!==revision)throw careError('careCancelled');return transport(request,{signal:controller.signal});}),cancelled]);if(controller.signal.aborted||version!==revision)throw careError('careCancelled');return validateCareResponse(result,request.requestId,mode);}
      catch(error){throw careError(controller.signal.aborted?(timedOut?'careTimeout':'careCancelled'):known.has(error.code)?error.code:'careUnavailable');}
      finally{clearTimeout(timer);controller.signal.removeEventListener('abort',rejectAbort);if(active===controller)active=null;}
    }
  };
}
