export const EXPERIENCE_KEY = 'liubai.experience.v1';
export const MODES = ['immersive','simple','care','custom'];
export function readMode(storage) {
  try { const value = (storage??globalThis.localStorage).getItem(EXPERIENCE_KEY); return MODES.includes(value) ? value : value===null?'immersive':'care'; }
  catch { return 'care'; }
}
export function initialExperience(storage){
  try{storage??=globalThis.localStorage;if(storage.getItem(EXPERIENCE_KEY)===null){const mode='immersive';storage.setItem(EXPERIENCE_KEY,mode);return mode;}return readMode(storage);}catch{return 'care';}
}
export function writeMode(mode, storage = globalThis.localStorage) {
  if (!MODES.includes(mode)) throw Error('experienceInvalid');
  storage.setItem(EXPERIENCE_KEY, mode);
  globalThis.dispatchEvent?.(new Event('liubai-mode-change'));
}
export function privateScope(storage) {
  try { const id = JSON.parse((storage??globalThis.sessionStorage).getItem('liubai.email-session.v1') || 'null')?.user?.id;
    return 'care_' + (/^[0-9a-f-]{36}$/i.test(id || '') ? id : 'guest'); }
  catch { return 'care_guest'; }
}
export const experienceContent = {
  zh: { experience:'模式与功能',immersive:'沉浸',simple:'轻记',care:'关怀',custom:'自选',
    immersiveHelp:'文字、手帐、语音与回顾，按需要使用。',
    simpleHelp:'写一句、放张照片，记下就好。需要时，再展开更多。',
    careHelp:'留给自己的空间。内容保存在独立的本机私密空间，不上传日记，也不使用云端 AI。',
    modeBoundary:'切换不搬移或删除记录。关怀空间的内容不会自动上传；之前已同步的云端副本不会因此删除。本机数据未加密，仍需备份。',
    modeApply:'使用这种方式',modeCurrent:'正在使用',modeFailed:'切换未保存，原方式保持不变。请检查浏览器存储。',
    modeOtherTab:'其他窗口切换了使用方式。已停止新的云端发送；请保存或下载当前输入，再刷新查看。',
    moreTools:'更多记录工具',modeLocal:'关怀 · 仅本机',modeBadge:'使用方式：{mode}',
    chatEntry:'陪我聊聊',chatSub:'从现在想说的事开始，也可以选一篇记录聊聊。',localReflect:'写给自己',
    localReflectSub:'本地书写引导，不是 AI 对话。只写你愿意留下的内容。',cloudPaused:'关怀模式不使用云端服务。切换使用方式后，可自行选择是否连接。' },
  en: { experience:'Modes & tools',immersive:'Immersive',simple:'Just a note',care:'Private care',custom:'Your own way',
    immersiveHelp:'Take your time. Text, scrapbooks, voice and reflections are all here.',
    simpleHelp:'A few words or a photo is enough. More tools are there when you want them.',
    careHelp:'A separate private space on this device. No journal uploads or cloud AI.',
    modeBoundary:'Switching never moves or deletes records. Private care stays local, even after switching back. Existing cloud copies are not deleted. Local data is not encrypted; keep backups.',
    modeApply:'Use this experience',modeCurrent:'Current',modeFailed:'The change was not saved. Check browser storage.',
    modeOtherTab:'Another tab changed the experience. New cloud requests are blocked. Save or download your current input, then refresh.',
    moreTools:'More recording tools',modeLocal:'Private care · on device',modeBadge:'Experience: {mode}',
    chatEntry:'Talk it through',chatSub:'Take your time, or begin with a journal entry.',localReflect:'Write for yourself',
    localReflectSub:'Local writing prompts, not an AI conversation. Keep only what you want.',cloudPaused:'Private care does not connect to cloud services. Switch experiences before choosing a connection.' }
};
