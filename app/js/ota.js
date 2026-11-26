import { VERSION } from './version.js';
import { t, esc, dateTime } from './i18n.js';
import { settings, saveSettings } from './store.js';
import { newer } from './whatsnew.js';
import { defaults, isNewShell, offers, selectFlow, failureStatus, noticeKey, sizeText, amountText, speedText, failureKind, checkStatus } from './ota-logic.js';

const plugin = () => typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android'
  ? window.Capacitor.Plugins?.Ota : null;
export const otaActive = () => !!plugin();

const githubIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.09c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.99 0 0 .95-.3 3.08 1.16a10.7 10.7 0 0 1 5.61 0c2.14-1.46 3.08-1.16 3.08-1.16.61 1.56.23 2.71.11 2.99.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.03.76 2.08v3.1c0 .3.21.64.77.53A11.2 11.2 0 0 0 12 .8Z"/></svg>';
const events = ['updateStateChanged', 'updateAvailable', 'updateStaged', 'updated', 'rolledBack', 'shellUpdateReady', 'updateSettingsChanged'];
const fields = [
  ['smallFixes'], ['majorUpdates'], ['shellUpdates'], ['updateNotifications'],
  ['wifiLimitMb', [5, 20, 50, 100, -1]],
  ['mobileLimitMb', [0, 5, 20, 50, -1]],
  ['checkFrequency', ['open', '1h', '6h', '24h', 'manual']],
];
const button = (action, label, style = 'outline') =>
  `<button type="button" class="btn btn-${style}" data-ota-action="${action}">${label}</button>`;
const icons = {
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/>',
  ready: '<path d="m5 12 4 4L19 6"/>',
  installing: '<path d="M20 11a8 8 0 1 0-2 6m2-12v6h-6"/>',
  rollback: '<path d="M9 5l-5 5 5 5m-5-5h10a5 5 0 0 1 0 10"/>',
  warning: '<path d="M12 5v9m0 4h.01"/>',
};
const progressMarkup = () => `<div class="ota-progress" hidden>
  <progress max="100" aria-label="${t('ota.progress')}"></progress>
  <span data-ota-transfer></span><p data-ota-keep-playing>${t('ota.keepPlaying')}</p></div>`;
const actionText = item => t(item.phase === 'ready' ? (item.channel === 'web' ? 'ota.installRestart' : 'ota.install') : 'ota.get', { v: item.version });
const route = () => window.location.hash.replace(/^#\/?/, '').split('/')[0];
const gameOnScreen = () => ['game', 'host', 'join', 'online'].includes(route());

function controlsMarkup() {
  const rows = fields.map(([key, values]) => {
    const label = t('ota.' + key);
    const controls = values ? `<select class="input">${values.map(value => {
      const title = key === 'checkFrequency' ? t('ota.frequency.' + value)
        : value === -1 ? t('ota.noLimit') : value === 0 ? t('ota.never') : t('ota.mib', { n: value });
      return `<option value="${value}">${title}</option>`;
    }).join('')}</select>` : `<button type="button" class="toggle" role="switch" aria-label="${label}"></button>`;
    return `<div class="row ota-control" data-ota-field="${key}">${values
      ? `<label class="ota-select"><span>${label}</span>${controls}</label>`
      : `<strong class="row-text">${label}</strong>${controls}`}</div>`;
  });
  return `${settingsGroup('automatic', rows.slice(0, 4).join(''))}
    ${settingsGroup('downloads', rows.slice(4).join(''))}<p class="ota-muted">${t('ota.limitNote')}</p>`;
}

const settingsGroup = (title, contents) => `<section class="ota-group">
  <h3>${t('ota.group.' + title)}</h3><div class="ota-group-body">${contents}</div></section>`;

function paintControls(container, values, disabled) {
  for (const row of container.querySelectorAll('[data-ota-field]')) {
    const key = row.dataset.otaField;
    row.hidden = key === 'updateNotifications' && typeof values?.[key] !== 'boolean';
    const control = row.querySelector('button, select');
    if (control.matches('button')) {
      const on = values?.[key] === true;
      control.classList.toggle('on', on);
      control.setAttribute('aria-checked', on);
    } else if (control.value !== String(values?.[key] ?? '')) control.value = values?.[key] ?? '';
    control.disabled = disabled || !values;
  }
}

function controlChange(target) {
  const control = target.closest('[data-ota-field] button, [data-ota-field] select');
  if (!control) return null;
  const key = control.closest('[data-ota-field]').dataset.otaField;
  return { [key]: control.matches('button') ? control.getAttribute('aria-checked') !== 'true'
    : key === 'checkFrequency' ? control.value : Number(control.value) };
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function paintProgress(container, item) {
  const wrap = container.querySelector('.ota-progress');
  wrap.hidden = item?.phase !== 'downloading';
  if (wrap.hidden) return;
  const { done, total, speed } = item.transfer || {};
  const bar = wrap.querySelector('progress');
  if (total >= 0) bar.value = total === 0 ? 100 : 100 * Math.min(total, Math.max(0, done || 0)) / total;
  else bar.removeAttribute('value');
  const percent = bar.hasAttribute('value') ? Math.floor(bar.value) + '%' : '';
  setText(wrap.querySelector('[data-ota-transfer]'), [percent, amountText(done, total), speedText(speed)].filter(Boolean).join(' · '));
  bar.setAttribute('aria-label', t('ota.progress'));
  setText(wrap.querySelector('[data-ota-keep-playing]'), t('ota.keepPlaying'));
}

function versionLine(channel, state) {
  const dates = state[channel + 'Timestamps'];
  const version = channel === 'web' ? t('ota.webName', { v: state.webVersion })
    : t('ota.appVersion', { v: state.shellVersion, api: state.shellApi });
  const times = ['publishedAt', 'availableAt', 'downloadedAt', 'installedAt'].filter(key => dates?.[key] > 0)
    .map(key => t('ota.date.' + key, { d: dateTime(dates[key]) }));
  return `<div class="row"><div class="row-text"><strong>${esc(version)}</strong>${times.length ? `<span>${esc(times.join(' · '))}</span>` : ''}</div></div>`;
}

function mount(ota) {
  const doc = window.document;
  const html = doc.documentElement;
  let panel, banner, bannerKey, shown, setup, setupRoute, setupDraft, setupLater = false;
  let launch, state, unavailable = false, pendingRefresh, refreshAgain = false;
  let flow, request, actionBusy = false, actionMessage = '', messageTimer, updatedTimer;
  let requestedAt = 0, retryNotice, claiming = false, claimAttempted = false, checkBusy = false;
  let updateNotice, rollbackNotice, releaseNotes, firstSnapshot = true;
  let savedTheme, themeTask, safeSent, safeTask;
  let saving, policyRevision = 0, saveError = false;

  const dismissed = new Set();
  const read = (key, session = false) => {
    try { return (session ? window.sessionStorage : window.localStorage).getItem(key); }
    catch { return null; }
  };
  const write = (key, value, session = false) => {
    try { (session ? window.sessionStorage : window.localStorage).setItem(key, value); }
    catch { /* storage blocked */ }
  };
  const dismissal = key => 'lx.ota.dismiss:' + key;
  const isDismissed = key => dismissed.has(key) || read(dismissal(key)) === '1';
  const dismiss = key => { dismissed.add(key); write(dismissal(key), '1'); };
  let checkClaimed = read('lx.ota.checkClaimed', true) === '1';

  function nativeAwait(label, action, ms = 3000) {
    if (window.LXStartup?.bounded) return window.LXStartup.bounded('OTA ' + label, action, ms);
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('OTA ' + label + ' timed out')), ms);
    });
    return Promise.race([Promise.resolve().then(action), deadline]).finally(() => window.clearTimeout(timer));
  }
  const call = (method, args, ms) => nativeAwait(method, () => args === undefined ? ota[method]() : ota[method](args), ms);

  const canInterrupt = () => !gameOnScreen() && !setup;
  function syncSafety() {
    if (!state) return Promise.resolve();
    if (safeTask) return safeTask.then(syncSafety);
    const safe = canInterrupt();
    if (safeSent === safe) return Promise.resolve();
    safeTask = call('setSafeToInterrupt', { safe }).then(() => { safeSent = safe; }).finally(() => { safeTask = null; });
    return safeTask.then(() => syncSafety());
  }

  function syncTheme() {
    if (!launch || themeTask) return;
    const theme = html.dataset.theme === 'light' ? 'light' : 'dark';
    const lang = html.lang === 'pl' ? 'pl' : 'en';
    const pair = theme + ':' + lang;
    if (savedTheme === pair) return;
    savedTheme = pair;
    themeTask = call('setUiTheme', { theme, lang }).catch(() => {}).finally(() => {
      themeTask = null;
      syncTheme();
    });
  }

  function say(key) {
    actionMessage = key;
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => { actionMessage = ''; paint(); }, 5000);
    paint();
  }

  async function activate(item) {
    if (!item || actionBusy || item.needsShell) return;
    if (item.phase === 'ready' && !canInterrupt()) return say('finishGame');
    actionBusy = true;
    request = {
      channel: item.channel, version: item.version, versionCode: item.versionCode,
      phase: item.phase === 'ready' ? 'installing' : 'downloading',
      transfer: { done: 0, total: item.size },
      baseline: failureStatus(state, item.channel), until: Date.now() + (item.phase === 'ready' ? 60000 : 6000),
    };
    paint();
    try {
      if (item.phase === 'ready') {
        await syncSafety();
        if (!canInterrupt()) { request = null; return say('finishGame'); }
        await call(item.channel === 'web' ? 'restart' : 'installShell', undefined, item.channel === 'shell' ? 60000 : 3000);
        if (request) request.until = Date.now() + 6000;
      } else {
        await call(item.channel === 'web' ? 'download' : 'downloadShell', { downloadOnly: true });
      }
    } catch { request = null; say('actionFailed'); }
    finally { actionBusy = false; void refresh(); }
  }

  async function check() {
    if (!state || checkBusy) return;
    checkBusy = true;
    retryNotice = null;
    if (!checkClaimed) claimAttempted = false;
    paint();
    try { await call('check'); requestedAt = Date.now(); }
    catch { say('actionFailed'); }
    finally { checkBusy = false; void refresh(); }
  }

  async function claimCheckNotice() {
    if (doc.hidden || checkClaimed || claiming || claimAttempted || !state.updateChecks?.noticePending) return;
    claiming = true;
    claimAttempted = true;
    try {
      const failure = await call('claimCheckNotice', { token: launch.token });
      if (!failure?.message && !failure?.code) return;
      checkClaimed = true;
      write('lx.ota.checkClaimed', '1', true);
      retryNotice = { type: 'retry', kind: failureKind(failure.code, failure.message), version: VERSION };
      paint();
    } catch { claimAttempted = false; }
    finally { claiming = false; }
  }

  function trackRelease(current) {
    const rolled = current.rolledBack;
    if (rolled?.from && rolled.to === VERSION) {
      const key = noticeKey('rollback', rolled.from, 'web');
      if (!isDismissed(key)) rollbackNotice = { ...rolled, type: 'rollback', key };
    }
    const update = current.updated?.to === VERSION ? current.updated : null;
    const { shellVersion, runningShellVersionCode: versionCode } = current;
    let shellUpgrade, legacyUpgrade;
    if (firstSnapshot) {
      let oldShell;
      try { oldShell = JSON.parse(read('lx.ota.appVersion')); } catch { /* old entry */ }
      shellUpgrade = oldShell && isNewShell({
        shellVersion: oldShell.version, runningShellVersionCode: oldShell.versionCode,
      }, shellVersion, versionCode);
      legacyUpgrade = !oldShell && settings.seenVersion && newer(VERSION, settings.seenVersion);
      if (shellVersion) write('lx.ota.appVersion', JSON.stringify({ version: shellVersion, versionCode }));
      firstSnapshot = false;
    }
    const version = update?.to || (shellUpgrade && shellVersion) || (legacyUpgrade && VERSION);
    if (!version || rolled?.to === version) return;
    const key = update || legacyUpgrade ? noticeKey('updated', version) : noticeKey('updated', version, 'shell', versionCode);
    if (!isDismissed(key)) updateNotice = { type: 'updated', version, key };
    const notes = update?.notes || (version === shellVersion && current.shellNotes);
    if (notes && (releaseNotes?.version !== version || releaseNotes.notes !== notes)) {
      releaseNotes = { version, notes };
      write('lx.ota.releaseNotes', JSON.stringify(releaseNotes));
    }
  }

  function refresh() {
    if (!launch || doc.hidden) return Promise.resolve();
    if (pendingRefresh) { refreshAgain = true; return pendingRefresh; }
    const policy = policyRevision;
    pendingRefresh = call('getState').then(current => {
      // The old page can still be on screen during a restart. Its Installing notice
      // stays up until the native handoff, even if the bridge already has a new token.
      if (current?.token !== launch.token || current.webVersion !== VERSION) return;
      if (!current.updateChecks?.noticePending) claimAttempted = false;
      state = policy === policyRevision ? current : { ...current, updateSettings: state.updateSettings };
      trackRelease(state);
      paint();
      void claimCheckNotice();
    }).catch(() => {}).finally(() => {
      pendingRefresh = null;
      if (refreshAgain) { refreshAgain = false; void refresh(); }
    });
    return pendingRefresh;
  }

  function nextBanner() {
    if (!state || doc.hidden || setup) return null;
    const canOffer = canInterrupt() && flow?.phase !== 'installing' && flow?.phase !== 'downloading';
    const queued = [
      flow?.phase === 'installing' && { ...flow, type: 'installing' },
      actionMessage && { type: 'message', kind: actionMessage, version: VERSION },
      rollbackNotice, updateNotice,
      flow?.phase === 'downloading' && { ...flow, type: 'downloading' },
      retryNotice,
      canOffer && failureStatus(state) && { type: 'failed', version: flow?.version || VERSION, channel: flow?.channel },
      ...(canOffer ? currentOffers().map(item => ({ ...item, type: item.phase })) : []),
    ];
    for (const item of queued) {
      if (!item) continue;
      const subtype = item.type === 'message' || item.type === 'retry' ? ':' + item.kind : '';
      item.key ||= noticeKey(item.type + subtype, item.version, item.channel, item.versionCode);
      if (item.key === shown?.key || !isDismissed(item.key)) return item;
    }
    return null;
  }

  function dismissBanner() {
    if (!shown) return;
    dismiss(shown.key);
    if (shown.type === 'updated') { updateNotice = null; window.clearTimeout(updatedTimer); }
    if (shown.type === 'rollback') rollbackNotice = null;
    if (shown.type === 'retry') retryNotice = null;
    if (shown.type === 'message') actionMessage = '';
    shown = null;
    paint();
  }

  function paintNotice(item) {
    let label, note = '', action = '', icon = 'warning';
    const args = { v: item.version };
    if (item.type === 'ready' || item.type === 'available') {
      icon = item.type === 'ready' ? 'ready' : 'download';
      if (item.needsShell) {
        label = t('ota.appRequired');
        note = t('ota.needsApp', args);
        action = button('details', t('ota.details'), 'primary');
      } else {
        const shell = item.channel === 'shell';
        label = t(item.type === 'ready' ? (shell ? 'ota.appReady' : 'ota.ready') : (shell ? 'ota.appUpdate' : 'ota.updateVersion'), args);
        const size = item.type === 'available' && sizeText(item.size);
        if (size) label += ' · ' + size;
        action = button('offer', !shell && item.type === 'available' ? t('ota.download') : esc(actionText(item)), 'primary');
      }
    } else if (item.type === 'updated') {
      icon = 'ready';
      label = t('ota.updated', args);
      action = `<a class="ota-notice-link" data-ota-news href="#/whatsnew">${t('ota.whatsNew')} <span aria-hidden="true">→</span></a>`;
    } else if (item.type === 'rollback') {
      icon = 'rollback';
      label = t('ota.rollback', { v: item.to });
      note = t('ota.rollbackNote', { v: item.from });
      action = button('logs', t('ota.rollbackDetails'), 'primary');
    } else if (item.type === 'retry') {
      label = t('ota.check.' + item.kind);
      if (item.kind === 'blocked') note = t('ota.blockedHint');
      action = button('check', t('ota.retry'), 'primary');
    } else if (item.type === 'message') {
      label = t('ota.' + item.kind);
      if (item.kind === 'finishGame') note = t('ota.finishGameNote');
    } else if (item.type === 'failed') {
      label = t('ota.failed');
      note = t('ota.failedNote');
      action = button('details', t('ota.details'), 'primary');
    } else {
      icon = item.type === 'installing' ? 'installing' : 'download';
      label = t('ota.' + item.type, args);
    }
    banner.querySelector('svg').innerHTML = icons[icon];
    setText(banner.querySelector('strong'), label);
    setText(banner.querySelector('[data-ota-note]'), note);
    const actions = banner.querySelector('[data-ota-notice-action]');
    if (actions.otaMarkup !== action) { actions.otaMarkup = action; actions.innerHTML = action; }
    const close = banner.querySelector('.ota-dismiss');
    close.hidden = item.type === 'installing';
    close.setAttribute('aria-label', t('ota.dismiss'));
  }

  function paintBanner() {
    const item = nextBanner();
    if (!item) {
      if (banner) banner.hidden = true;
      shown = null; bannerKey = null;
      return;
    }
    if (!banner) {
      banner = doc.createElement('aside');
      banner.className = 'ota-banner';
      // Keep the banner and progress nodes mounted across phases (owner, 2026-11-26).
      banner.innerHTML = `<span class="ota-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span>
        <div class="ota-notice-body"><strong role="status"></strong><p class="ota-muted" data-ota-note></p>
        ${progressMarkup()}<div data-ota-notice-action></div></div>
        <button type="button" class="btn btn-ghost ota-dismiss" data-ota-action="dismiss">✕</button>`;
      banner.addEventListener('click', event => {
        const action = event.target.closest('button')?.dataset.otaAction;
        if (event.target.closest('[data-ota-news]')) {
          window.location.hash = '#/whatsnew';
          dismissBanner();
        }
        if (action === 'dismiss') dismissBanner();
        if (action === 'offer') void activate(shown);
        if (action === 'check') void check();
        if (action === 'details') showSettings();
        if (action === 'logs') void call('logs').catch(() => say('actionFailed'));
      });
      doc.body.append(banner);
    }
    const identity = item.key + ':' + html.lang + ':' + item.version
      + (item.type === 'available' ? ':' + item.size + ':' + item.needsShell : '');
    if (identity !== bannerKey) {
      paintNotice(item);
      banner.dataset.notice = item.type;
      bannerKey = identity;
    }
    shown = item;
    banner.hidden = false;
    paintProgress(banner, item);
    if (item.type === 'rollback') dismiss(item.key);
    if (item.type === 'updated' && !isDismissed(item.key)) {
      dismiss(item.key);
      if (!settings.seenVersion || newer(VERSION, settings.seenVersion)) {
        settings.seenVersion = VERSION;
        saveSettings();
      }
      updatedTimer = window.setTimeout(() => { updateNotice = null; paint(); }, 5000);
    }
  }

  function paintPanel() {
    if (!panel?.isConnected) { panel = null; return; }
    const values = state?.updateSettings;
    paintControls(panel, saving ? { ...values, ...saving } : values, !!saving);
    const find = selector => panel.querySelector(selector);
    const checkButton = find('[data-ota-action="check"]');
    checkButton.disabled = !state || checkBusy;
    const get = find('[data-ota-action="offer"]');
    const item = panelOffer();
    get.hidden = !item;
    if (item) setText(get, actionText(item));
    else get.textContent = '';
    find('[data-ota-action="setup"]').hidden = values?.setupAnswered !== false;
    const address = find('[data-ota-address]');
    if (address.value !== (values?.url || '')) address.value = values?.url || '';
    const status = state && checkStatus(state, requestedAt);
    const label = unavailable ? t('ota.unavailable') : checkBusy ? t('ota.check.checking')
      : status ? t('ota.check.' + status.kind, { v: status.version }) : '';
    const time = !status?.last ? '' : t(status.previousSuccess ? 'ota.lastSuccess' : 'ota.lastCheck', { d: dateTime(status.last) });
    setText(find('[data-ota-check]'), label);
    setText(find('[data-ota-check-time]'), time);
    setText(find('[data-ota-feedback]'), saveError ? t('ota.saveFailed')
      : actionMessage ? t('ota.' + actionMessage)
      : flow?.phase === 'installing' ? t('ota.installing', { v: flow.version })
        : state && failureStatus(state) ? t('ota.actionFailed') : '');
    const requires = state && offers(state).find(offer => offer.needsShell);
    setText(find('[data-ota-needs-app]'), requires ? t('ota.needsApp', { v: requires.version }) : '');
    paintProgress(panel, flow);
    const versions = find('[data-ota-versions]');
    const markup = state ? versionLine('web', state) + versionLine('shell', state) : '';
    if (versions.otaMarkup !== markup) { versions.otaMarkup = markup; versions.innerHTML = markup; }
  }

  function panelOffer() {
    if (!state || actionBusy || flow?.phase === 'installing' || flow?.phase === 'downloading') return null;
    return currentOffers().find(item => !item.needsShell);
  }

  function currentOffers() {
    const items = offers(state);
    if (flow?.phase !== 'ready') return items;
    return [flow, ...items.filter(item => item.channel !== flow.channel || item.phase !== flow.phase)];
  }

  function showSettings() {
    window.location.hash = '#/settings';
    if (panel?.isConnected) {
      panel.closest('details')?.setAttribute('open', '');
      panel.scrollIntoView?.({ block: 'nearest' });
    } else {
      // The Settings route can await its data index before attaching the panel.
      openPanel = true;
    }
  }

  let openPanel = false;
  function renderSettings(container) {
    panel = container;
    panel.classList.add('ota-settings');
    panel.innerHTML = `<p class="ota-check-state" data-ota-check role="status"></p>
      <div class="ota-actions">${button('offer', '', 'primary')}${button('check', t('ota.check'))}</div>
      <p class="ota-muted" data-ota-check-time></p><p class="ota-muted" data-ota-needs-app></p>
      ${progressMarkup()}<p class="ota-muted" data-ota-feedback role="status"></p>
      <div class="ota-actions"><a class="btn btn-ghost" href="#/whatsnew">${t('ota.whatsNew')}</a>
      <button type="button" class="btn btn-ghost ota-github" data-ota-action="github" aria-label="${t('ota.github')}" title="${t('ota.github')}">${githubIcon}</button></div>
      ${controlsMarkup()}
      ${settingsGroup('installed', '<div data-ota-versions></div>')}
      ${settingsGroup('support', `<div class="row"><label class="ota-select"><span>${t('ota.address')}</span>
        <input class="input" data-ota-address readonly></label></div>`)}
      <div class="ota-actions">${button('maintenance', t('ota.maintenance'))}${button('logs', t('ota.logs'))}${button('setup', t('ota.finishSetup'))}</div>`;
    panel.onchange = event => {
      const patch = controlChange(event.target);
      if (patch) void savePreferences(patch);
    };
    panel.onclick = event => {
      const patch = event.target.closest('button') && controlChange(event.target);
      if (patch) { void savePreferences(patch); return; }
      const action = event.target.closest('button')?.dataset.otaAction;
      if (action === 'check') void check();
      if (action === 'offer') void activate(panelOffer());
      if (action === 'setup') openSetup();
      const methods = { github: 'openReleases', maintenance: 'settings', logs: 'logs' };
      if (methods[action]) void call(methods[action]).catch(() => say(action === 'github' ? 'browserUnavailable' : 'actionFailed'));
    };
    if (openPanel) {
      openPanel = false;
      panel.closest('details')?.setAttribute('open', '');
      panel.scrollIntoView?.({ block: 'nearest' });
    }
    paintPanel();
  }

  async function savePreferences(patch, finish = false) {
    if (!state?.updateSettings || saving) return;
    saving = patch;
    saveError = false;
    paintPanel();
    if (setup) setup.querySelectorAll('button, select').forEach(control => { control.disabled = true; });
    try {
      if (finish) await syncSafety();
      const values = await call('setUpdateSettings', patch);
      ++policyRevision;
      state.updateSettings = { ...state.updateSettings, ...patch, ...values };
      if (finish) closeSetup();
    } catch { saveError = true; }
    finally {
      saving = null;
      if (setup) paintSetup(!!setupDraft);
      paint();
      void refresh();
    }
  }

  function closeSetup() {
    if (!setup) return;
    const dialog = setup;
    // Defer the question for this launch only (owner, 2026-11-26).
    setup = null; setupDraft = null; setupLater = true;
    dialog.close();
    dialog.remove();
    paint();
  }

  function paintSetup(customize) {
    setup.innerHTML = `<h2 id="ota-setup-title" tabindex="-1">${t('ota.setupTitle')}</h2>
      ${customize ? controlsMarkup() : `<p>${t('ota.recommendedNote')}</p><p class="ota-preface">${t('ota.recommendedLimits')}</p>`}
      ${saveError ? `<p class="ota-muted" role="status">${t('ota.saveFailed')}</p>` : ''}
      <div class="ota-actions">${customize ? button('save', t('ota.save'), 'primary') + button('back', t('ota.back'))
        : button('recommended', `<span aria-hidden="true">✓</span> ${t('ota.recommended')}`, 'selected') + button('customize', t('ota.customize'))}
      ${button('later', t('ota.later'), 'ghost')}</div>`;
    if (customize) paintControls(setup, setupDraft, !!saving);
    // Focus the question so the recommended style is visible without a focus ring (owner, 2026-11-26).
    setup.querySelector('h2').focus();
  }

  function openSetup() {
    if (setup || !state?.updateSettings || saving || gameOnScreen()) return;
    saveError = false;
    setup = doc.createElement('dialog');
    setupRoute = route();
    setup.className = 'game-settings ota-setup';
    setup.setAttribute('aria-labelledby', 'ota-setup-title');
    setup.addEventListener('cancel', event => { event.preventDefault(); if (!saving) closeSetup(); });
    setup.addEventListener('change', event => {
      const patch = controlChange(event.target);
      if (!saving && patch) Object.assign(setupDraft, patch);
    });
    setup.addEventListener('click', event => {
      if (saving) return;
      const patch = event.target.closest('button') && controlChange(event.target);
      if (patch) {
        Object.assign(setupDraft, patch);
        paintControls(setup, setupDraft, false);
        return;
      }
      const action = event.target.closest('button')?.dataset.otaAction;
      if (action === 'recommended') void savePreferences({ ...defaults, setupAnswered: true }, true);
      if (action === 'customize') {
        setupDraft = { ...defaults };
        for (const [key] of fields) {
          if (state.updateSettings[key] !== undefined) setupDraft[key] = state.updateSettings[key];
        }
        paintSetup(true);
      }
      if (action === 'later') closeSetup();
      if (action === 'back') { setupDraft = null; paintSetup(false); }
      if (action === 'save') void savePreferences({ ...setupDraft, setupAnswered: true }, true);
    });
    doc.body.append(setup);
    setup.showModal();
    paintSetup(false);
    paint();
  }

  function paint() {
    if (state) {
      flow = selectFlow(state, request, flow);
      if (request) request = flow?.until ? flow : null;
      if (state.updateSettings?.setupAnswered === true) setupLater = false;
    }
    paintPanel();
    paintBanner();
    if (!doc.hidden && route() === '' && !setup && !setupLater && !updateNotice && !rollbackNotice
      && flow?.phase !== 'installing' && state?.updateSettings?.setupAnswered === false) openSetup();
    void syncSafety().catch(() => {});
  }

  function waitForScreen() {
    if (html.hasAttribute('data-ready')) return Promise.resolve();
    return new Promise(resolve => {
      const observer = new window.MutationObserver(() => {
        if (!html.hasAttribute('data-ready')) return;
        observer.disconnect();
        resolve();
      });
      observer.observe(html, { attributes: true, attributeFilter: ['data-ready'] });
    });
  }

  async function initialize() {
    const screen = waitForScreen();
    await Promise.all(events.map(event => {
      const subscribe = () => ota.addListener(event, () => { void refresh(); });
      return nativeAwait('listen for ' + event, subscribe).catch(() => {});
    }));
    await screen;
    await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    // A slow phone's first bridge calls can take seconds; giving up here would leave a working start unacknowledged.
    const info = await call('info', undefined, 10000);
    if (info?.webVersion !== VERSION || !info.token) throw new Error('OTA launch does not match the rendered version');
    if (!(await call('appReady', { version: VERSION, token: info.token, checkNotices: true }, 10000))?.accepted) {
      throw new Error('OTA readiness was not accepted');
    }
    launch = info;
    new window.MutationObserver(syncTheme).observe(html, { attributes: true, attributeFilter: ['data-theme', 'lang'] });
    syncTheme();
    window.addEventListener('hashchange', () => {
      if (setup && route() !== setupRoute && !saving) closeSetup();
      else paint();
    });
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden) void refresh(); });
    void refresh();
    window.setInterval(() => { if (!doc.hidden) void refresh(); }, 1000);
  }

  void initialize().catch(() => { unavailable = true; paintPanel(); });
  return {
    renderSettings,
    releaseNotes() {
      if (releaseNotes) return releaseNotes;
      try { return JSON.parse(read('lx.ota.releaseNotes')); } catch { return null; }
    },
  };
}

const ota = plugin();
const ui = ota ? mount(ota) : null;
export const renderOtaSettings = container => ui?.renderSettings(container);
export const otaReleaseNotes = () => ui?.releaseNotes();
