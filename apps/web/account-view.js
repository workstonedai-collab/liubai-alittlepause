import { createAccountSync, createAccountTransport } from './account-sync.js';
import { UUID, scopedName, ACCOUNT_CACHE } from './account-scope.js';
const copy = {
  zh: {
    entry:'账号与同步', title:'你的记录，随身带着', local:'现在使用免登录本地模式。',
    intro:'邮箱账号用于在设备之间同步文字日记。未登录的记录留在本机，登录不会自动上传。',
    pending:'邮箱服务尚未开放：还需完成发信域名与验证邮件配置。你仍可完整使用本地功能。',
    email:'邮箱', password:'密码', signIn:'登录', signUp:'注册', forgot:'找回密码', resend:'重发验证邮件',
    verify:'验证邮箱', code:'邮件验证码', codeHelp:'也可以直接打开邮件里的验证链接。验证码仅在邮件模板已配置时可用。',
    sent:'如果这个邮箱符合条件，验证邮件将发送到收件箱，请同时查看垃圾邮件。',
    resetSent:'如果这个邮箱已注册，重置邮件将发送到收件箱。',
    passwordHint:'注册与新密码需 12–128 个字符。密码由认证服务处理，不保存在日记中。',
    recovery:'设置新密码', updatePassword:'保存新密码', updated:'密码已更新。',
    account:'当前邮箱：', useAccount:'进入这个账号', guest:'返回本地模式', signOut:'退出登录',
    privacy:'此账号的本地日记、草稿和附件独立存放。云同步仅包含文字日记；手帐、相册、录音、聊天与草稿仍留在本机。浏览器缓存未加密，共用设备请导出后清理浏览器数据。',
    preview:'预览同步', enabled:'文字同步已开启', paused:'文字同步已暂停', never:'尚未完成同步',
    last:'上次同步：', pause:'暂停同步', sync:'同步并开启自动同步',
    review:'这次同步', counts:'本机待合并 {up} 条 · 云端待合并 {down} 条 · 冲突 {conflicts} 处',
    reviewHelp:'确认后合并双方文字日记，之后在网页打开且可见时自动同步。冲突会保留副本，不覆盖手帐、录音或本地草稿。',
    done:'文字日记已同步。', conflict:'发现冲突，已保留双方内容。请在日记中查看。',
    import:'带入本机的未登录文字日记', importHelp:'未登录日记不会自动归入这个邮箱。只在这是你自己的记录时带入；开启同步后这些文字会上传。',
    importConfirm:'确认将未登录模式的文字日记复制到这个邮箱账号？后续同步会上传这些文字。', imported:'已复制文字日记，原本地记录仍保留。',
    more:'已有验证邮件？', back:'返回', working:'正在处理…', resetVerify:'验证重置码',
    accountNotReady:'账号服务尚未开放，继续使用本地模式即可。', accountSenderMissing:'验证邮件尚未配置完成，暂不能注册、重发或找回密码。',
    accountNetwork:'暂时连不上服务，内容仍保存在本机。请稍后再试。', accountRateLimited:'请求较频繁，请稍后再试。',
    accountCredentials:'邮箱或密码不正确。', accountUnverified:'请先验证邮箱后登录。', accountPasswordWeak:'密码需为 12–128 个字符。',
    accountEmailInvalid:'请填写有效的邮箱。', accountCodeExpired:'验证码或验证链接无效、已过期，请重新申请。',
    accountExpired:'登录已过期，请重新登录。此账号的本地内容仍保留。', accountStorage:'浏览器未能保存登录状态，请检查存储权限。',
    accountRequestFailed:'本次操作未完成，请稍后再试。', accountNotInvited:'这个邮箱尚未加入邀请试用名单，请联系留白的创建者。',
    accountLimit:'已达到试用容量上限，本机内容已保留。', accountConflict:'云端刚有变化，请重新预览同步。',
    accountChanged:'本机记录刚有变化，请重新预览同步。', accountBusy:'同步正在进行，请稍候。',
    accountInvalid:'服务返回的数据无法读取，已停止同步。', accountCacheInvalid:'账号本地缓存无法读取，已停止同步。请先导出备份。',
    accountError:'操作未完成，内容没有被覆盖。请检查网络与浏览器存储后重试。'
  },
  en: {
    entry:'Account & sync', title:'Keep your words with you', local:'You are using local mode without an account.',
    intro:'An email account syncs text entries between devices. Signing in never uploads guest records automatically.',
    pending:'Email service is not open yet. A verified sending domain and email delivery still need configuration. Local features remain available.',
    email:'Email', password:'Password', signIn:'Sign in', signUp:'Register', forgot:'Reset password', resend:'Resend verification', verify:'Verify email', code:'Email code',
    codeHelp:'You can also open the verification link in your email. Codes require a configured email template.',
    sent:'If this address is eligible, a verification email will arrive. Please check spam as well.', resetSent:'If this account exists, a password reset email will arrive.',
    passwordHint:'Registration and new passwords require 12–128 characters. Passwords are handled by the authentication service.',
    recovery:'Set a new password', updatePassword:'Save new password', updated:'Password updated.', account:'Email: ', useAccount:'Open this account',
    guest:'Return to local mode', signOut:'Sign out', privacy:'This account has its own local entries, drafts and attachments. Only text entries sync. Scrapbooks, photos, audio, chats and drafts stay on this device. Browser caches are not encrypted; export and clear browser data on shared devices.',
    preview:'Preview sync', enabled:'Text sync is on', paused:'Text sync is paused', never:'Not synced yet', last:'Last sync: ', pause:'Pause sync', sync:'Merge and enable auto sync',
    review:'Review this sync', counts:'Local to merge: {up} · Cloud to merge: {down} · Conflicts: {conflicts}',
    reviewHelp:'Merge text entries from both devices, then sync while this page is open and visible. Conflicts preserve both versions. Media and drafts are excluded.',
    done:'Text entries synced.', conflict:'Conflicts were preserved as separate entries. Please review your journal.',
    import:'Copy guest text entries into this account', importHelp:'Guest entries stay separate. Copy them only if they are yours; text will upload when sync is enabled.',
    importConfirm:'Copy guest text entries into this email account? Future sync will upload these words.', imported:'Text entries copied. Guest records are preserved.',
    more:'Already have a verification email?', back:'Back', working:'Working…', resetVerify:'Verify reset code',
    accountNotReady:'Account service is not open yet. Local mode remains available.', accountSenderMissing:'Email sending is not configured yet.',
    accountNetwork:'Service is unreachable. Your local entries are preserved. Try again later.', accountRateLimited:'Too many requests. Try again later.',
    accountCredentials:'Email or password is incorrect.', accountUnverified:'Verify your email before signing in.', accountPasswordWeak:'Use a password of 12–128 characters.',
    accountEmailInvalid:'Enter a valid email address.', accountCodeExpired:'The code or link is invalid or expired.', accountExpired:'Please sign in again. Local account data is preserved.',
    accountStorage:'The browser could not save your session.', accountRequestFailed:'The request did not complete. Try again later.',
    accountNotInvited:'This email is not on the trial invitation list. Contact the creator of Liubai.', accountLimit:'Trial capacity reached. Local entries are preserved.',
    accountConflict:'The cloud changed. Preview sync again.', accountChanged:'Local entries changed. Preview sync again.', accountBusy:'Sync is in progress.',
    accountInvalid:'The service returned invalid data. Sync stopped.', accountCacheInvalid:'This account cache is unreadable. Sync stopped. Export a backup first.',
    accountError:'The operation did not complete. Your entries were not overwritten. Check network and storage, then retry.'
  }
};
export function createAccountPanel({ auth, config, journal, storage, language, esc, openDialog, closeDialog,
  onChange, guestEntries, importGuest, lifecycle = () => {}, reload = () => location.reload() }) {
  const t = (key, vars = {}) => (copy[language()][key] || copy[language()].accountError).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  let review = null, formMode = 'signIn', address = '', message = '', lastError = '', timer, running = false, disposed = false;
  const sync = auth.active && UUID.test(auth.session?.user.id || '') ? createAccountSync({ id: auth.session.user.id,
    storage, journal, transport: createAccountTransport({ config, auth }), onChange }) : null;
  const get = id => document.querySelector('#account-' + id);
  function status() { try { return sync?.status(); } catch { lastError = 'accountCacheInvalid'; return null; } }
  const notice = () => `<p id="account-status" role="status">${esc(message ? t(message) : '')}</p><p id="account-error" role="alert">${esc(lastError ? t(lastError) : '')}</p>`;
  async function work(action, success) {
    if (running) return; running = true; lastError = ''; message = '';
    get('error')?.replaceChildren();
    if (get('status')) get('status').textContent = t('working');
    document.querySelectorAll('#account-root button').forEach(b => b.disabled = true);
    try { await action(); if (success) message = success; }
    catch (error) { review = null; lastError = error.code || error.message; }
    finally { running = false; if (get('root')) open(); }
  }
  function open() {
    if (running) return;
    const user = auth.session?.user, state = status();
    const field = (id, label, type, extra = '') => `<label for="account-${id}">${t(label)}</label><input id="account-${id}" type="${type}" ${extra} required>`;
    let body;
    if (auth.recovering && user) body = `<h3>${t('recovery')}</h3><form id="account-form">${field('password','password','password','minlength="12" maxlength="128" autocomplete="new-password"')}<button class="primary" type="submit">${t('updatePassword')}</button></form>`;
    else if (user && auth.active) body = `<p>${t('account')}${esc(user.email)}</p><p class="rule-note">${t('privacy')}</p><p class="badge">${t(state?.enabled ? 'enabled' : 'paused')}</p><p>${state?.lastSync ? t('last') + esc(new Date(state.lastSync).toLocaleString(language() === 'zh' ? 'zh-CN' : 'en-US')) : t('never')}</p>
      ${review ? `<section class="panel"><h3>${t('review')}</h3><p>${t('counts',{ up:review.upload,down:review.download,conflicts:review.conflicts })}</p><p class="rule-note">${t('reviewHelp')}</p><button id="account-confirm" class="primary">${t('sync')}</button></section>` : ''}
      <div class="dialog-actions"><button id="account-preview" class="primary">${t('preview')}</button>${state?.enabled ? `<button id="account-pause" class="secondary">${t('pause')}</button>` : ''}</div><details><summary>${t('import')}</summary><p class="rule-note">${t('importHelp')}</p><button id="account-import" class="secondary">${t('import')}</button></details><div class="dialog-actions"><button id="account-local" class="secondary">${t('guest')}</button><button id="account-signout" class="text-button">${t('signOut')}</button></div>`;
    else body = `<p>${t('local')}</p><p class="rule-note">${t('intro')}</p>${!auth.emailEnabled ? `<p class="rule-note">${t('pending')}</p>` : ''}${user ? `<p>${t('account')}${esc(user.email)}</p><button id="account-enter" class="primary">${t('useAccount')}</button><button id="account-signout" class="text-button">${t('signOut')}</button>` : ''}
      <form id="account-form"><h3>${t(formMode)}</h3>${field('email','email','email',`maxlength="254" autocomplete="email" value="${esc(address)}"`)}
      ${['signIn','signUp'].includes(formMode) ? field('password','password','password',`maxlength="128" ${formMode==='signUp'?'minlength="12" autocomplete="new-password"':'autocomplete="current-password"'}`) : ''}
      ${['verify','resetVerify'].includes(formMode) ? field('code','code','text','inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="10"') : ''}
      ${formMode==='signUp' ? `<p class="rule-note">${t('passwordHint')}</p>` : ''}${['verify','resetVerify'].includes(formMode) ? `<p class="rule-note">${t('codeHelp')}</p>` : ''}
      <button class="primary" type="submit" ${!auth.configured || (!auth.emailEnabled && formMode!=='signIn') ? 'disabled' : ''}>${t(formMode)}</button></form>
      <div class="dialog-actions">${['signIn','signUp','forgot'].filter(x=>x!==formMode).map(x=>`<button class="text-button" data-account-mode="${x}">${t(x)}</button>`).join('')}</div><details><summary>${t('more')}</summary><div class="dialog-actions">${['verify','resetVerify','resend'].filter(x=>x!==formMode).map(x=>`<button class="text-button" data-account-mode="${x}">${t(x)}</button>`).join('')}</div></details>`;
    openDialog(`<section id="account-root"><h2 id="dialog-title">${t('title')}</h2>${body}${notice()}</section>`);
    lifecycle(()=>!running);
    document.querySelectorAll('[data-account-mode]').forEach(b => b.onclick = () => { address = get('email')?.value || address; formMode = b.dataset.accountMode; message='';lastError='';open(); });
    if (get('form')) get('form').onsubmit = event => {
      event.preventDefault(); const secret = get('password')?.value;
      address = get('email')?.value || address; const code = get('code')?.value;
      void work(async () => {
        if (auth.recovering) { await auth.updatePassword(secret); message='updated'; }
        else if (formMode==='signIn') { await auth.signIn(address,secret); reload(); }
        else if (formMode==='signUp') { await auth.signUp(address,secret); formMode='verify'; message='sent'; }
        else if (formMode==='forgot') { await auth.sendRecovery(address);formMode='resetVerify';message='resetSent'; }
        else if (formMode==='resend') { await auth.resend(address);formMode='verify';message='sent'; }
        else { await auth.verify(address,code,formMode==='resetVerify'?'recovery':'signup');reload(); }
      });
    };
    if (get('preview')) get('preview').onclick = () => void work(async () => { review = await sync.plan(); });
    if (get('confirm')) get('confirm').onclick = () => void work(async () => { const current=review;await sync.apply(current);review=null;message=current.conflicts?'conflict':'done'; });
    if (get('pause')) get('pause').onclick = () => void work(async()=>{sync.pause();review=null;});
    if (get('local')) get('local').onclick = () => { auth.useLocal();reload(); };
    if (get('enter')) get('enter').onclick = () => { auth.useAccount();reload(); };
    if (get('signout')) get('signout').onclick = () => void work(async()=>{await auth.signOut();reload();});
    if (get('import')) get('import').onclick = () => {
      if (!confirm(t('importConfirm'))) return;
      void work(async()=>{ importGuest(guestEntries());review=null; }, 'imported');
    };
  }
  async function auto() {
    if (disposed || !sync || auth.recovering || document.hidden || running || document.querySelector('dialog[open]')) return;
    try { const before = status(); if (!before?.enabled) return; await sync.synchronize();lastError=''; }
    catch (error) { lastError=error.code || error.message; }
    if (lastError) { const button=document.querySelector('#account-open');if(button)button.textContent=t('entry')+' · !'; }
  }
  const focus = () => { clearTimeout(timer);timer=setTimeout(auto,1500); };
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  const interval=setInterval(auto,60000);
  return { open, get label(){return t('entry');}, get privacy(){return t('privacy');},
    localChanged(){if(sync)focus();}, physicalCacheKey: auth.active ? scopedName(ACCOUNT_CACHE, auth.session.user.id) : null,
    dispose(){disposed=true;clearTimeout(timer);clearInterval(interval);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);},
    start(){if(auth.recovering)open();else focus();},
    report(error){lastError=error.code||error.message;open();}
  };
}
