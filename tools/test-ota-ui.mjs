// Android OTA UI and bridge contract. Run: node tools/test-ota-ui.mjs
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { VERSION } from '../app/js/version.js';
import { getLang, setLang } from '../app/js/i18n.js';
import { checkStatus, defaults, failureKind, failureStatus, isNewShell, noticeKey, offers, selectFlow, sizeText, speedText } from '../app/js/ota-logic.js';

const tests = [];
const test = (name, run) => tests.push([name, run]);
const update = '9.1.0', appUpdate = '9.2.0';
const readyWeb = { version: update }, readyApp = { version: appUpdate, versionCode: 9200 };
const available = { ...readyWeb, size: 1048576 };
const base = { token: 'launch-token', webVersion: VERSION, shellVersion: VERSION, shellApi: 1, runningShellVersionCode: 7201 };
const prefs = { ...defaults, setupAnswered: true, url: 'https://example.com/updates.json' };
const summary = items => items.map(({ channel, phase, version }) => [channel, phase, version]);
const flush = () => new Promise(resolve => setImmediate(resolve));
const pending = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let instances = 0, activeWindow, legacy, store;

async function boot({ platform = 'android', hasOta = true, snapshot = {}, hash = '#/', saved = {}, session = {}, overrides = {} } = {}) {
  const { window } = new JSDOM('<html lang="en" data-theme="dark"><body><main id="root"></main></body></html>', {
    pretendToBeVisual: true, url: 'https://localhost/' + hash,
  });
  activeWindow = globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.Event = window.Event;
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
  const html = document.documentElement;
  setLang('en');
  Object.entries(saved).forEach(([key, value]) => localStorage.setItem(key, value));
  Object.entries(session).forEach(([key, value]) => window.sessionStorage.setItem(key, value));
  const state = { ...base, updateSettings: { ...prefs }, ...snapshot };
  const log = [], callbacks = new Map(), frames = [], timers = [], intervals = [];
  let fetched = 0;
  globalThis.fetch = async () => { fetched++; return { ok: true, json: async () => ({ tag_name: update, counts: { pl: 10, en: 10 } }) }; };
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.requestAnimationFrame = callback => { frames.push(callback); };
  const schedule = window.setTimeout.bind(window);
  window.setTimeout = (callback, ms) => ms === 5000 ? (timers.push(callback), null) : schedule(callback, ms);
  window.setInterval = (callback, ms) => { intervals.push({ callback, ms }); };
  const method = (name, body = () => undefined) => async (...args) => {
    log.push([name, ...args]);
    return (overrides[name] || body)(...args);
  };
  const ota = {
    addListener: method('addListener', (event, callback) => { callbacks.set(event, callback); }),
    info: method('info', () => ({ ...state })),
    appReady: method('appReady', () => ({ accepted: true })),
    getState: method('getState', () => ({ ...state })),
    setSafeToInterrupt: method('setSafeToInterrupt'),
    setUiTheme: method('setUiTheme'),
    setUpdateSettings: method('setUpdateSettings', patch => (state.updateSettings = { ...state.updateSettings, ...patch })),
    claimCheckNotice: method('claimCheckNotice'),
    check: method('check'),
    download: method('download'), downloadShell: method('downloadShell'),
    restart: method('restart'), installShell: method('installShell'),
    openReleases: method('openReleases'), settings: method('settings'), logs: method('logs'),
  };
  window.Capacitor = { getPlatform: () => platform, isNativePlatform: () => platform === 'android',
    Plugins: { ...(hasOta ? { Ota: ota } : {}), AppUpdate: { remove: method('AppUpdate.remove') } } };
  const ui = await import('../app/js/ota.js?test=' + ++instances);
  store ??= await import('../app/js/store.js');
  store.settings.seenVersion = VERSION;
  const get = selector => document.querySelector(selector);
  const click = selector => get(selector).click();
  const calls = name => log.filter(([method]) => name === method).map(([, ...args]) => args);
  const markReady = async () => { html.setAttribute('data-ready', VERSION); await flush(); };
  const frame = async () => { frames.shift()?.(); await flush(); };
  const ready = async () => { await markReady(); await frame(); await frame(); };
  const emit = async (event = 'updateStateChanged', payload) => { callbacks.get(event)?.(payload); await flush(); };
  const navigate = async value => {
    window.history.replaceState(null, '', value);
    window.dispatchEvent(new window.Event('hashchange'));
    await flush();
  };
  return { window, html, state, ui, get, click, calls, log, frames, timers, intervals, markReady, frame, ready, emit, navigate, fetched: () => fetched };
}

test('offers prefer the ready APK, then the ready web update, then APK and web downloads', () => {
  const state = { ...base, available, shellAvailable: readyApp };
  assert.deepEqual(summary(offers(state)), [['shell', 'available', appUpdate], ['web', 'available', update]]);
  Object.assign(state, { staged: readyWeb, shellReady: readyApp });
  assert.deepEqual(summary(offers(state)), [['shell', 'ready', appUpdate], ['web', 'ready', update]]);
  assert.deepEqual(offers({ ...state, trial: true }), []);
});

test('running, ready and installing updates never appear as Get offers', () => {
  const state = { ...base, available, shellAvailable: readyApp };
  assert.deepEqual(offers({ ...state, webVersion: update, runningShellVersionCode: 9200 }), []);
  assert.equal(isNewShell(state, VERSION, state.runningShellVersionCode + 1), true);
  assert.equal(isNewShell(state, appUpdate, state.runningShellVersionCode), false);
  assert.equal(isNewShell(state, appUpdate), true);
  assert.deepEqual(summary(offers({ ...state, staged: readyWeb, installingVersion: update })), [['shell', 'available', appUpdate]]);
  assert.deepEqual(summary(offers({ ...state, shellReady: readyApp, installingVersion: appUpdate, installingChannel: 'shell' })), [['web', 'available', update]]);
});

test('Get, queued download, download, ready, installing, then updated snapshots', () => {
  const state = { ...base, available };
  const get = selectFlow(state);
  const requested = { ...get, phase: 'downloading', until: 1000 };
  assert.equal(get.phase, 'available');
  assert.equal(selectFlow(state, requested, get, VERSION, 1), requested);
  const transferring = { ...state, busy: true, webDownloadVersion: update, webTransfer: { done: 100, total: 1000, speed: 20 } };
  const download = selectFlow(transferring, requested, get);
  assert.equal(download.phase, 'downloading');
  assert.equal(download.transfer.done, 100);
  const staged = { ...transferring, staged: readyWeb };
  assert.equal(selectFlow(staged, null, download).phase, 'ready');
  assert.equal(selectFlow({ ...staged, installingVersion: update }).phase, 'installing');
  assert.equal(selectFlow({ ...staged, webVersion: update, updated: { to: update } }), null);
});

test('failed or expired requests return to the actionable offer', () => {
  const state = { ...base, staged: readyWeb };
  const ready = selectFlow(state);
  const request = { ...ready, phase: 'installing', until: 1000 };
  assert.equal(selectFlow(state, request, ready, VERSION, 10), request);
  assert.equal(selectFlow(state, request, ready, VERSION, 1000).phase, 'ready');
  const failed = { ...state, status: 'Restart failed; see Logs', shellStatus: 'Shell update processing failed' };
  assert.equal(selectFlow(failed, request, ready, VERSION, 10).phase, 'ready');
  assert.equal(failureStatus(failed, 'shell'), failed.shellStatus);
  assert.equal(failureStatus({ status: '9.0.0: Not enough storage; skipped' }), '9.0.0: Not enough storage; skipped');
});

test('notice keys include the phase and version, with APK code as its identity', () => {
  assert.equal(noticeKey('ready', update, 'web'), 'ready:web:' + update);
  assert.notEqual(noticeKey('ready', update, 'web'), noticeKey('available', update, 'web'));
  assert.notEqual(noticeKey('ready', update, 'web'), noticeKey('ready', appUpdate, 'web'));
  assert.notEqual(noticeKey('available', update, 'shell', 9123), noticeKey('available', update, 'shell', 9124));
});

test('binary size and download speed use the current language', async () => {
  await boot({ hasOta: false });
  assert.equal(sizeText(undefined), '');
  assert.equal(sizeText(0), '0 B');
  assert.equal(sizeText(1024), '1.0 KiB');
  assert.equal(sizeText(1572864), '1.5 MiB');
  assert.equal(speedText(2560), '2.5 KiB/s');
  assert.equal(speedText(0), '');
  setLang('pl');
  assert.equal(getLang(), 'pl');
  assert.equal(speedText(1572864), '1,5 MiB/s');
});

for (const [code, message, kind] of [
  ['OFFLINE', "Can't check for updates — no internet", 'offline'],
  ['UNREACHABLE', "Can't reach the update server", 'blocked'],
  ['TIMEOUT', 'The update server took too long to respond', 'blocked'],
  ['TLS', "Couldn't make a secure connection to the update server", 'blocked'],
  ['NOT_FOUND', "The update file wasn't found", 'blocked'],
  ['DENIED', 'The update server refused the request', 'blocked'],
  ['RATE_LIMITED', 'Too many update requests — try again later', 'blocked'],
  ['SERVER', 'The update server returned an error — try again later', 'blocked'],
  ['MANIFEST', "Can't check for updates — signature or manifest problem", 'invalid'],
]) test('classifies native check failure ' + code + ' with or without its code', () => {
  assert.equal(failureKind(code, 'localized result'), kind);
  assert.equal(failureKind(undefined, message), kind);
});

test('check status prefers failure codes and uses attempt timestamps when supplied', () => {
  const web = { code: 'MANIFEST', error: 'localized', lastAttemptAt: 20, lastSuccessAt: 10 };
  assert.deepEqual(checkStatus({ ...base, updateChecks: { web } }), { kind: 'invalid', last: 20, previousSuccess: false });
  delete web.lastAttemptAt;
  assert.deepEqual(checkStatus({ ...base, updateChecks: { web } }), { kind: 'invalid', last: 10, previousSuccess: true });
  assert.equal(checkStatus({ ...base, status: 'Checking…' }).kind, 'checking');
  assert.equal(checkStatus({ ...base, updateChecks: { web: { lastSuccessAt: 10 } } }).kind, 'upToDate');
});

test('Android without Ota preserves the old updater and creates no OTA UI', async () => {
  const game = await boot({ hasOta: false });
  legacy = await import('../app/js/update.js');
  await game.ready();
  assert.equal(game.ui.otaActive(), false);
  assert.equal(game.log.length, 0);
  assert.equal(game.get('.ota-banner, dialog'), null);
  assert.equal(await legacy.checkUpdate(true), true);
  assert.equal(game.fetched(), 1);
  assert.equal(legacy.updateShown(), true);
});

for (const platform of ['web', 'ios', 'windows']) {
  test(platform + ' never calls OTA even if a plugin with that name exists', async () => {
    const game = await boot({ platform, snapshot: { available } });
    await game.ready();
    game.ui.renderOtaSettings(game.get('#root'));
    assert.equal(game.ui.otaActive(), false);
    assert.equal(game.log.length, 0);
    assert.equal(game.get('#root').innerHTML, '');
    assert.equal(game.get('.ota-banner, dialog'), null);
  });
}

test('appReady follows all listeners, data-ready, then two animation frames', async () => {
  const game = await boot();
  assert.equal(game.calls('addListener').length, 7);
  assert.equal(game.calls('info').length, 0);
  await game.markReady();
  assert.equal(game.frames.length, 1);
  await game.frame();
  assert.equal(game.calls('info').length, 0);
  assert.equal(game.calls('appReady').length, 0);
  await game.frame();
  assert.deepEqual(game.calls('appReady'), [[{ version: VERSION, token: base.token, checkNotices: true }]]);
  assert.ok(game.log.findIndex(([name]) => name === 'getState') > game.log.findIndex(([name]) => name === 'appReady'));
  assert.deepEqual(game.intervals.map(({ ms }) => ms), [1000]);
});

for (const mismatch of [{ webVersion: update }, { token: '' }]) {
  test('rejects launch ' + Object.keys(mismatch)[0] + ' mismatch', async () => {
    const game = await boot({ snapshot: { ...mismatch, available } });
    await game.ready();
    assert.equal(game.calls('info').length, 1);
    assert.equal(game.calls('appReady').length, 0);
    assert.equal(game.calls('getState').length, 0);
    assert.equal(game.get('.ota-banner'), null);
  });
}

test('a stalled bridge uses the startup bound and never acknowledges it', async () => {
  const game = await boot({ overrides: { info: () => new Promise(() => {}) } });
  const labels = [];
  game.window.LXStartup = { bounded(label, action, ms) {
    labels.push([label, ms]);
    return label.endsWith(' info') ? Promise.reject(new Error('bounded')) : Promise.resolve().then(action);
  } };
  await game.ready();
  assert.deepEqual(labels.at(-1), ['OTA info', 10000]);
  assert.equal(game.calls('appReady').length, 0);
  game.ui.renderOtaSettings(game.get('#root'));
  assert.equal(game.get('[data-ota-check]').textContent, 'Updates are unavailable.');
});

test('game and online routes set false and returning to menu sets true', async () => {
  const game = await boot({ hash: '#/game/x', snapshot: { staged: readyWeb } });
  await game.ready();
  assert.deepEqual(game.calls('setSafeToInterrupt'), [[{ safe: false }]]);
  assert.equal(game.get('.ota-banner'), null);
  for (const path of ['host/bt', 'join/lan', 'online']) await game.navigate('#/' + path);
  assert.equal(game.calls('setSafeToInterrupt').length, 1);
  await game.navigate('#/');
  assert.deepEqual(game.calls('setSafeToInterrupt').at(-1), [{ safe: true }]);
  game.window.history.replaceState(null, '', '#/game/x');
  game.click('.ota-banner [data-ota-action=offer]');
  assert.match(game.get('.ota-banner').textContent, /Finish your game first/);
  assert.equal(game.calls('restart').length, 0);
});

test('legacy APK prompts and network check are disabled on OTA while cleanup still runs', async () => {
  const game = await boot();
  store.settings.latest = appUpdate;
  store.settings.updateFile = { id: 'cache', version: VERSION };
  store.settings.seenVersion = '0.1.0';
  assert.equal(await legacy.checkUpdate(true), false);
  assert.equal(game.fetched(), 0);
  assert.equal(legacy.updateWaiting(), false);
  assert.equal(legacy.updateShown(), false);
  assert.equal(legacy.recentUpdateShown(), false);
  legacy.cleanUpdate();
  assert.deepEqual(game.calls('AppUpdate.remove'), [[{ id: 'cache' }]]);
});

test('dismissed offers stay hidden through replay and reload but Settings and new versions still offer them', async () => {
  const game = await boot({ snapshot: { available } });
  await game.ready();
  assert.match(game.get('.ota-banner').textContent, /Get update 9\.1\.0 · 1\.0 MiB/);
  game.click('.ota-banner [data-ota-action=dismiss]');
  const key = 'lx.ota.dismiss:available:web:' + update;
  assert.equal(localStorage.getItem(key), '1');
  await game.emit('updateAvailable', readyApp);
  assert.equal(game.get('.ota-banner').hidden, true);
  game.window.close();
  const reloaded = await boot({ snapshot: { available }, saved: { [key]: '1' } });
  await reloaded.ready();
  assert.equal(reloaded.get('.ota-banner'), null);
  reloaded.ui.renderOtaSettings(reloaded.get('#root'));
  assert.equal(reloaded.get('[data-ota-action=offer]').textContent, 'Get update ' + update);
  reloaded.state.available = { version: appUpdate, size: 1024 };
  await reloaded.emit();
  assert.match(reloaded.get('.ota-banner').textContent, /9\.2\.0/);
});

test('web flow preserves progress DOM, uses downloadOnly and holds Installing through handoff', async () => {
  const game = await boot({ snapshot: { available } });
  await game.ready();
  game.click('.ota-banner [data-ota-action=offer]');
  await flush();
  assert.deepEqual(game.calls('download'), [[{ downloadOnly: true }]]);
  const progress = game.get('.ota-banner progress');
  Object.assign(game.state, { busy: true, webDownloadVersion: update, webTransfer: { done: 262144, total: 1048576, speed: 1024 } });
  await game.emit();
  assert.equal(game.get('.ota-banner progress'), progress);
  assert.equal(progress.value, 25);
  assert.match(game.get('.ota-banner').textContent, /256\.0 KiB \/ 1\.0 MiB · 1\.0 KiB\/s/);
  assert.match(game.get('.ota-banner').textContent, /You can keep playing/);
  Object.assign(game.state, { busy: false, staged: readyWeb });
  await game.emit('updateStaged');
  assert.equal(game.get('.ota-banner [data-ota-action=offer]').textContent, 'Install update ' + update);
  game.click('.ota-banner [data-ota-action=offer]');
  await flush();
  assert.equal(game.calls('restart').length, 1);
  assert.equal(game.get('.ota-banner').dataset.notice, 'installing');
  Object.assign(game.state, { token: 'next-token', webVersion: update, staged: null });
  await game.emit('updated');
  assert.equal(game.get('.ota-banner').dataset.notice, 'installing');
});

test('APK offers use native APK methods and a web update explains its app requirement', async () => {
  const game = await boot({ snapshot: { available: { ...available, needsShell: true } } });
  await game.ready();
  assert.match(game.get('.ota-banner').textContent, /Install the app update first/);
  assert.equal(game.get('.ota-banner [data-ota-action=offer]'), null);
  game.state.shellAvailable = { ...readyApp, size: 2048 };
  await game.emit();
  game.click('.ota-banner [data-ota-action=offer]');
  await flush();
  assert.deepEqual(game.calls('downloadShell'), [[{ downloadOnly: true }]]);
  game.state.shellReady = readyApp;
  await game.emit('shellUpdateReady');
  game.click('.ota-banner [data-ota-action=offer]');
  await flush();
  assert.equal(game.calls('installShell').length, 1);
});

test('an accepted updated notice lasts five seconds, advances seenVersion and ignores event replay', async () => {
  const notes = 'Literal <b>notes</b>';
  const game = await boot({ snapshot: { updated: { from: '0.1.0', to: VERSION, notes } } });
  store.settings.seenVersion = '0.1.0';
  assert.equal(game.get('.ota-banner'), null);
  await game.ready();
  assert.equal(game.get('.ota-banner a').textContent, 'Updated to ' + VERSION);
  assert.equal(game.get('.ota-banner a').getAttribute('href'), '#/whatsnew');
  assert.equal(JSON.parse(localStorage.getItem('wg.settings')).seenVersion, VERSION);
  assert.equal(game.ui.otaReleaseNotes().notes, notes);
  assert.equal(game.timers.length, 1);
  game.timers.shift()();
  await game.emit('updated');
  assert.equal(game.get('.ota-banner').hidden, true);
  assert.equal(game.timers.length, 0);
});

test('APK upgrade is detected from running version code even with an unchanged version name', async () => {
  const key = 'lx.ota.appVersion';
  const game = await boot({ saved: { [key]: JSON.stringify({ version: VERSION, versionCode: 7200 }) } });
  await game.ready();
  assert.equal(game.get('.ota-banner a').textContent, 'Updated to ' + VERSION);
  assert.equal(JSON.parse(localStorage.getItem(key)).versionCode, 7201);
  game.click('.ota-banner a');
  assert.equal(game.window.location.hash, '#/whatsnew');
  await game.emit('updated');
  assert.equal(game.get('.ota-banner').hidden, true);
});

test('rollback takes priority and stays dismissed across replayed snapshots', async () => {
  const game = await boot({ snapshot: { rolledBack: { from: update, to: VERSION }, available } });
  await game.ready();
  assert.match(game.get('.ota-banner').textContent, /Version 9\.1\.0 didn’t start/);
  game.click('.ota-banner [data-ota-action=dismiss]');
  await game.emit('rolledBack');
  assert.equal(game.get('.ota-banner').dataset.notice, 'available');
});

test('check failures are claimed once while visible and Retry checks again', async () => {
  const snapshot = { updateChecks: { noticePending: true, failed: true } };
  const game = await boot({ snapshot, overrides: { claimCheckNotice: () => ({ code: 'TLS' }) } });
  await game.markReady();
  assert.equal(game.calls('claimCheckNotice').length, 0);
  await game.frame();
  await game.frame();
  assert.deepEqual(game.calls('claimCheckNotice'), [[{ token: base.token }]]);
  assert.match(game.get('.ota-banner').textContent, /sign in first or try mobile data/);
  game.click('.ota-banner [data-ota-action=check]');
  await game.emit();
  assert.equal(game.calls('claimCheckNotice').length, 1);
  assert.equal(game.calls('check').length, 1);
  game.window.close();
  const reloaded = await boot({ snapshot, session: { 'lx.ota.checkClaimed': '1' } });
  await reloaded.ready();
  assert.equal(reloaded.calls('claimCheckNotice').length, 0);
});

test('visible polling and event hints leave a hidden WebView alone', async () => {
  const game = await boot();
  await game.ready();
  const first = game.calls('getState').length;
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  game.intervals[0].callback();
  await game.emit('updateStaged');
  assert.equal(game.calls('getState').length, first);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  document.dispatchEvent(new game.window.Event('visibilitychange'));
  await flush();
  assert.equal(game.calls('getState').length, first + 1);
});

test('Settings renders native fields and sends partials without losing an in-flight edit', async () => {
  const save = pending();
  const game = await boot({ hash: '#/settings', snapshot: {
    updateSettings: { ...prefs, updateNotifications: false }, staged: readyWeb,
    webTimestamps: { publishedAt: 1000, availableAt: 2000, downloadedAt: 3000, installedAt: 4000 },
    updateChecks: { web: { code: 'OFFLINE', lastAttemptAt: 5000 } },
  }, overrides: { setUpdateSettings: () => save.promise } });
  await game.ready();
  const host = game.get('#root');
  game.ui.renderOtaSettings(host);
  const get = selector => game.get('.ota-settings ' + selector);
  assert.deepEqual([...host.firstElementChild.children].map(control => control.textContent), ['Check', 'Install update ' + update, 'What’s new', '']);
  assert.ok(get('[data-ota-action=github] svg'));
  assert.equal(get('[data-ota-address]').value, prefs.url);
  assert.equal(get('[data-ota-address]').readOnly, true);
  assert.equal(host.querySelectorAll('.toggle').length, 4);
  assert.equal(get('[data-ota-field=updateNotifications]').hidden, false);
  assert.equal(host.querySelectorAll('.seg').length, 3);
  assert.match(get('[data-ota-check]').textContent, /No internet connection.*Last checked/);
  assert.match(get('[data-ota-versions]').textContent, /Published.*Available on this phone.*Downloaded.*Installed/);
  const never = get('[data-ota-field=mobileLimitMb] [data-ota-value="0"]');
  never.click();
  await flush();
  assert.deepEqual(game.calls('setUpdateSettings'), [[{ mobileLimitMb: 0 }]]);
  await game.emit('updateSettingsChanged', { mobileLimitMb: 5 });
  assert.equal(never.getAttribute('aria-pressed'), 'true');
  assert.equal(never.disabled, true);
  game.state.updateSettings.mobileLimitMb = 0;
  save.resolve(game.state.updateSettings);
  await flush();
  assert.equal(never.disabled, false);
  for (const action of ['github', 'maintenance', 'logs']) get('[data-ota-action=' + action + ']').click();
  await flush();
  for (const method of ['openReleases', 'settings', 'logs']) assert.equal(game.calls(method).length, 1);
});

test('setup makes interruption unsafe, Recommended saves defaults, and reset asks again', async () => {
  const game = await boot({ snapshot: { updateSettings: { ...prefs, setupAnswered: false, mobileLimitMb: 0 } } });
  await game.ready();
  assert.equal(game.get('dialog h2').textContent, 'How should updates work?');
  assert.deepEqual(game.calls('setSafeToInterrupt'), [[{ safe: false }]]);
  game.click('dialog [data-ota-action=recommended]');
  await flush();
  assert.deepEqual(game.calls('setUpdateSettings'), [[{ ...defaults, setupAnswered: true }]]);
  assert.equal(game.get('dialog'), null);
  assert.deepEqual(game.calls('setSafeToInterrupt').at(-1), [{ safe: true }]);
  game.state.updateSettings.setupAnswered = false;
  await game.emit();
  assert.ok(game.get('dialog[open]'));
});

test('Later leaves setup unanswered and Customize keeps its draft through a snapshot refresh', async () => {
  const game = await boot({ snapshot: { updateSettings: { ...prefs, setupAnswered: false } } });
  await game.ready();
  game.click('dialog [data-ota-action=later]');
  await game.emit();
  assert.equal(game.calls('setUpdateSettings').length, 0);
  assert.equal(game.get('dialog'), null);
  await game.navigate('#/settings');
  game.ui.renderOtaSettings(game.get('#root'));
  assert.equal(game.get('[data-ota-field=updateNotifications]').hidden, true);
  game.click('.ota-settings [data-ota-action=setup]');
  game.click('dialog [data-ota-action=customize]');
  const manual = game.get('dialog [data-ota-value=manual]');
  manual.click();
  await game.emit('updateSettingsChanged');
  assert.equal(manual.getAttribute('aria-pressed'), 'true');
  game.click('dialog [data-ota-action=save]');
  await flush();
  assert.deepEqual(game.calls('setUpdateSettings'), [[{ ...defaults, checkFrequency: 'manual', setupAnswered: true }]]);
  assert.equal(game.get('dialog'), null);
});

test('effective theme and language are forwarded after readiness and on change', async () => {
  const game = await boot({ snapshot: { available } });
  assert.equal(game.calls('setUiTheme').length, 0);
  await game.ready();
  assert.deepEqual(game.calls('setUiTheme'), [[{ theme: 'dark', lang: 'en' }]]);
  game.html.dataset.theme = 'light';
  setLang('pl');
  await flush();
  assert.deepEqual(game.calls('setUiTheme').at(-1), [{ theme: 'light', lang: 'pl' }]);
  await game.emit();
  assert.match(game.get('.ota-banner').textContent, /Pobierz aktualizację 9\.1\.0 · 1,0 MiB/);
});

let passed = 0;
for (const [name, run] of tests) {
  try { await run(); passed++; }
  catch (error) { console.error('✗ ' + name, error); }
  finally { activeWindow?.close(); activeWindow = null; }
}
console.log(`OTA UI: ${passed} passed, ${tests.length - passed} failed`);
if (passed !== tests.length) process.exitCode = 1;
