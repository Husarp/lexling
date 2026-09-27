// Updates (owner, 2026-09-27: "like Car Crash - checked every time the app opens or comes back; a new one shown at the
// bottom of the menu, dismissed with ✕ or downloaded"): the latest release on GitHub, and its file for this device - the
// APK on Android, the installer on Windows, else the release page.
import { settings, saveSettings } from './store.js';
import { VERSION, REPO } from './version.js';

export function newer(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

const EVERY = 5 * 60000;   // at most every five minutes: GitHub answers 60 unsigned checks an hour
let running = null;

// true when the check went through (or one was made just now); the menu hears 'lexling:update' when it has news
export function checkUpdate(force = false) {
  if (!REPO) return Promise.resolve(false);
  if (!force && !settings.updateCheck) return Promise.resolve(false);   // Settings → Check for updates, switched off
  if (!force && Date.now() - (settings.lastCheck || 0) < EVERY) return Promise.resolve(true);
  running ??= (async () => {
    try {
      const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 10000);   // ~10 s (APP-STANDARDS.md)
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, signal: stop.signal });
      clearTimeout(timer);
      if (!r.ok) return false;
      const release = await r.json();
      const file = end => release.assets?.find(a => a.name.toLowerCase().endsWith(end))?.browser_download_url || '';
      settings.latest = (release.tag_name || '').replace(/^v/i, '');
      settings.latestFiles = { apk: file('.apk'), exe: file('.exe') };
      settings.lastCheck = Date.now();
      saveSettings();
      window.dispatchEvent(new Event('lexling:update'));
      return true;
    } catch { return false; } finally { running = null; }
  })();
  return running;
}

export const updateWaiting = () => !!REPO && !!settings.latest && newer(settings.latest, VERSION);
// the menu's banner: a newer version, while Check for updates is on. ✕ hides it until Lexling next starts (owner,
// 2026-09-27): coming back from another app keeps it hidden; a fresh start - closed, or closed by the phone - shows it
let closed = null;
export const closeUpdate = () => { closed = settings.latest; };
export const updateShown = () => updateWaiting() && !!settings.updateCheck && closed !== settings.latest;

const platform = () => window.Capacitor?.getPlatform?.() === 'android' ? 'android' : window.pywebview ? 'windows' : 'web';
export const updateUrl = () => (platform() === 'android' && settings.latestFiles?.apk) || (platform() === 'windows' && settings.latestFiles?.exe)
  || `https://github.com/${REPO}/releases/latest`;

// Getting it (APP-STANDARDS.md; owner, 2026-09-27 - the same as Reckless Driving 3.35.0): on Android Lexling downloads
// the APK itself (the progress here) and hands it to Android's installer itself. That needs "install unknown apps" for
// Lexling, once: the first time Android's settings screen for it opens, and coming back from there carries on by itself.
// (0.57.0 used Android's download service and the phone's Downloads: on a phone behind a firewall it never started, and
// it still needed the same permission, for the Files app.) Windows: the desktop app downloads the installer and runs it.
// A browser: the release page.
let dl = { phase: 'idle' };   // 'running' { pct } | 'done' { version, asked } | 'starting' (Windows) | 'failed' { why }
export const downloadState = () => dl;
const emit = () => window.dispatchEvent(new Event('lexling:update'));
const updater = () => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.() || C.getPlatform?.() !== 'android') return null;
  return C.Plugins?.AppUpdate ?? C.registerPlugin?.('AppUpdate') ?? null;
};
// true: downloading in the app; false: handed to the browser
export async function getUpdate() {
  const api = window.pywebview?.api;
  if (api?.install_update && settings.latestFiles?.exe) return getSetup(api, settings.latestFiles.exe);
  const P = updater(), url = settings.latestFiles?.apk;
  if (!P || !url) { openUrl(updateUrl()); return false; }
  if (dl.phase === 'running') return true;
  if (dl.phase === 'done' && dl.version === settings.latest) { await install(true); return true; }   // Install again
  if (navigator.onLine === false) { dl = { phase: 'failed', why: 'offline' }; emit(); return true; }
  const version = settings.latest;
  try {
    // an earlier one, not needed (0.57.x: a download-service id - cancelled if it never finished)
    if (settings.updateFile) await P.remove({ id: settings.updateFile.id }).catch(() => {});
    await P.download({ url, name: `Lexling-${version}.apk` });
    settings.updateFile = { id: 'cache', version };   // removed once this version runs (cleanUpdate)
    saveSettings();
    dl = { phase: 'running', pct: 0 };
    emit();
    const poll = setInterval(async () => {
      const s = await P.progress().catch(() => ({ status: 'failed' }));
      if (s.status === 'running') { dl = { phase: 'running', pct: s.total > 0 ? Math.round(s.done / s.total * 100) : 0 }; emit(); return; }
      clearInterval(poll);
      if (s.status !== 'done') { dl = { phase: 'failed', why: 'download' }; emit(); return; }
      dl = { phase: 'done', version };
      install(true);
    }, 500);
  } catch { dl = { phase: 'failed', why: 'download' }; emit(); }
  return true;
}
// the downloaded file to Android's installer, which asks "Update this app?"; without the permission Android's settings
// screen for it opens first (openSettings), and coming back from there carries on without another tap
let allowing = false;
async function install(openSettings) {
  try {
    await updater().install({ openSettings });
    dl = { ...dl, asked: 'confirm' };
  } catch (e) {
    if (!String(e?.message ?? e).includes('NEEDS_PERMISSION')) dl = { phase: 'failed', why: 'download' };
    else { allowing = openSettings; dl = { ...dl, asked: openSettings ? 'allow' : 'notAllowed' }; }
  }
  emit();
}
export const installUpdate = () => install(true);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !allowing) return;
  allowing = false;
  install(false);
});
// Windows (APP-STANDARDS.md): the desktop app downloads LexlingSetup-X.Y.Z.exe itself (the progress here), starts it
// and closes, so the installer can replace it (desktop/main.py install_update)
async function getSetup(api, url) {
  if (dl.phase === 'running') return true;
  if (navigator.onLine === false) { dl = { phase: 'failed', why: 'offline' }; emit(); return true; }
  dl = { phase: 'running', pct: 0 };
  emit();
  const poll = setInterval(async () => {
    const s = await api.update_progress().catch(() => null);
    if (s && dl.phase === 'running') { dl = { phase: 'running', pct: s.total > 0 ? Math.round(s.done / s.total * 100) : 0 }; emit(); }
  }, 700);
  const r = await api.install_update(url, settings.latest).catch(e => 'failed: ' + e);
  clearInterval(poll);
  dl = r === 'ok' ? { phase: 'starting' } : { phase: 'failed', why: 'download' };
  emit();
  return true;
}
// the new version runs: the downloaded file that brought it goes (owner: "after installation remove this file")
export function cleanUpdate() {
  const f = settings.updateFile, P = updater();
  if (!f || !P || newer(f.version, VERSION)) return;
  P.remove({ id: f.id }).catch(() => {});
  delete settings.updateFile;
  saveSettings();
}

// Out of the app: the desktop wrapper through its Python bridge, Android through the update plugin (window.open does
// nothing inside the Android app - Reckless Driving found), a browser the ordinary way.
export function openUrl(url) {
  const api = window.pywebview?.api, P = updater();
  if (api?.open_url) api.open_url(url);
  else if (P?.openUrl) P.openUrl({ url }).catch(() => {});
  else window.open(url, '_blank', 'noopener');
}
