export const SOUND_IDS=['rain','waves','wind','stream','fire','noise','music'];
// Original procedural audio, no recording, licensed catalogue or network call.
export function createSoundEngine({AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,now=Date.now}={}) {
  let context=null,master=null,nodes=[],timer=null,stopAt=0,levels={},layerGains={},onChange=()=>{};
  function stop(){clearInterval(timer);timer=null;nodes.forEach(n=>{try{n.stop?.();n.disconnect?.();}catch{}});nodes=[];layerGains={};
    const old=context;context=null;master=null;stopAt=0;void old?.close().catch(()=>{});onChange();}
  async function play(next,{minutes=30,volume=.35,changed=()=>{}}={}){
    stop();onChange=changed;if(Object.keys(next).some(id=>!SOUND_IDS.includes(id))||Object.values(next).some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('audioInvalid');if(!AudioContext)throw Error('audioUnsupported');
    context=new AudioContext();await context.resume();master=context.createGain();master.gain.value=volume;master.connect(context.destination);
    const buffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate),data=buffer.getChannelData(0);let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+.02*(Math.random()*2-1))/1.02;data[i]=brown*3.5;}
    levels={...next};
    for(const id of SOUND_IDS){const level=Number(next[id]||0);layerGains[id]=[];
      if(id==='music'){
        for(const frequency of [130.813,196,261.626,329.628]){const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=frequency;gain.gain.value=level*.055;osc.connect(gain);gain.connect(master);osc.start();nodes.push(osc,gain);layerGains[id].push({node:gain,factor:.055});}
        continue;
      }
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;source.loop=true;
      filter.type=id==='stream'?'bandpass':'lowpass';filter.frequency.value={rain:1800,waves:700,wind:400,stream:1400,fire:450,noise:3500}[id];filter.Q.value=id==='stream'?1.5:.4;
      gain.gain.value=level*(id==='noise'?.18:.35);source.connect(filter);filter.connect(gain);gain.connect(master);source.start();nodes.push(source,filter,gain);layerGains[id].push({node:gain,factor:id==='noise'?.18:.35});
      if(['waves','wind','fire'].includes(id)){const lfo=context.createOscillator(),mod=context.createGain();lfo.frequency.value={waves:.09,wind:.04,fire:6}[id];mod.gain.value=level*.12;lfo.connect(mod);mod.connect(gain.gain);lfo.start();nodes.push(lfo,mod);layerGains[id].push({node:mod,factor:.12});}
    }
    stopAt=now()+minutes*60000;timer=setInterval(()=>{if(!context)return;if(now()>=stopAt){stop();return;}if(stopAt-now()<5000)master.gain.setTargetAtTime(0,context.currentTime,1);onChange();},1000);onChange();
  }
  return {play,stop,get playing(){return !!context;},get remaining(){return Math.max(0,stopAt-now());},get levels(){return {...levels};},
    setLevel(id,value){if(!SOUND_IDS.includes(id)||!Number.isFinite(value)||value<0||value>1)return;levels[id]=value;if(context)for(const row of layerGains[id]||[])row.node.gain.setTargetAtTime(value*row.factor,context.currentTime,.15);},
    volume(value){if(master)master.gain.setTargetAtTime(Math.min(1,Math.max(0,value)),context.currentTime,.15);},dispose:stop};
}
