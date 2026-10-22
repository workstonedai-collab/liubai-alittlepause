export function createLocalValue(storage, key, initial, validate, maxBytes=262144) {
  let raw, value, readable=false;
  function load() {
    readable=false;
    try { raw=storage.getItem(key);value=validate(raw===null?structuredClone(initial):JSON.parse(raw));readable=true; }
    catch { value=structuredClone(initial); }
    return readable;
  }
  load();
  return { load, get readable(){return readable;}, get raw(){return raw;}, snapshot:()=>structuredClone(value),
    save(next) {
      if(!readable)throw Error('localSettingsLocked');
      const checked=validate(structuredClone(next)), text=JSON.stringify(checked);
      if(new TextEncoder().encode(text).length>maxBytes)throw Error('localSettingsLimit');
      if(storage.getItem(key)!==raw){load();throw Error('localSettingsChanged');}
      storage.setItem(key,text);raw=text;value=checked;return structuredClone(value);
    }
  };
}
