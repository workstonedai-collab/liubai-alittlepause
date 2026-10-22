export const APPEARANCE_KEY='liubai.appearance.v1';
export const APPEARANCES=Object.freeze([
 {id:'meadow',zh:'原野',en:'Meadow',note:'浅绿与纸白，留白原来的样子。',noteEn:'The original pale greens and paper whites.',colors:['#f6f7f2','#fffefa','#3c5848']},
 {id:'night',zh:'夜航',en:'Nightfall',note:'深绿底色，适合灯光暗下来的时候。',noteEn:'Deep greens for quieter light.',colors:['#151d1a','#1c2722','#b6cbb5']},
 {id:'mist',zh:'雾岚',en:'Mist',note:'淡淡的蓝灰，清爽一些。',noteEn:'A cooler palette of blue and grey.',colors:['#f1f5f5','#fcfdfc','#3e6166']},
 {id:'paper',zh:'暖笺',en:'Warm paper',note:'米色纸张，配一点温暖的棕。',noteEn:'Cream paper with warm brown accents.',colors:['#f7f1e8','#fffaf2','#785a42']},
]);
export function readAppearance(storage){try{const value=(storage??globalThis.localStorage).getItem(APPEARANCE_KEY);return value==='auto'||APPEARANCES.some(t=>t.id===value)?value:'meadow';}catch{return 'meadow';}}
export const resolveAppearance=(preference,dark=false)=>preference==='auto'?(dark?'night':'meadow'):APPEARANCES.some(t=>t.id===preference)?preference:'meadow';
export function createAppearance({storage,root=globalThis.document?.documentElement,media=globalThis.matchMedia?.('(prefers-color-scheme: dark)'),onChange=()=>{}}={}){
 const port=storage??{getItem:key=>globalThis.localStorage.getItem(key),setItem:(key,value)=>globalThis.localStorage.setItem(key,value)};
 let preference=readAppearance(port);
 function apply(){const value=resolveAppearance(preference,!!media?.matches);if(root){root.dataset.appearance=value;root.style.colorScheme=value==='night'?'dark':'light';const meta=root.ownerDocument?.querySelector('meta[name="theme-color"]');if(meta)meta.content=APPEARANCES.find(t=>t.id===value).colors[0];}onChange(value,preference);return value;}
 const changed=()=>{if(preference==='auto')apply();},external=event=>{if(event.key===APPEARANCE_KEY||event.key===null){preference=readAppearance(port);apply();}};
 media?.addEventListener?.('change',changed);globalThis.addEventListener?.('storage',external);apply();
 return {get preference(){return preference;},get current(){return resolveAppearance(preference,!!media?.matches);},choose(value){if(value!=='auto'&&!APPEARANCES.some(t=>t.id===value))throw Error('appearanceInvalid');port.setItem(APPEARANCE_KEY,value);preference=value;return apply();},dispose(){media?.removeEventListener?.('change',changed);globalThis.removeEventListener?.('storage',external);}};
}
