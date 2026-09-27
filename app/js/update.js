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
  if (!force && Date.now() - (settings.lastCheck || 0) < EVERY) return Promise.resolve(true);
  running ??= (async () => {
    try {
      const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 8000);
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
// the menu's banner: a newer version, not dismissed (✕ hides that version for good; the next one shows again)
export const updateShown = () => updateWaiting() && settings.updateDismissed !== settings.latest;

const platform = () => window.Capacitor?.getPlatform?.() === 'android' ? 'android' : window.pywebview ? 'windows' : 'web';
export const updateUrl = () => (platform() === 'android' && settings.latestFiles?.apk) || (platform() === 'windows' && settings.latestFiles?.exe)
  || `https://github.com/${REPO}/releases/latest`;

// Getting it (owner, 2026-09-27): on Android through Android's own download service - progress here and in the
// notification bar, the file in Downloads, named with its version - and installed by the phone's own installer from
// there, so Lexling needs no permission to install apps. Elsewhere (Windows, a browser): the browser downloads it.
let dl = { phase: 'idle' };   // 'running' { pct } | 'done' | 'failed' { why: 'offline' | 'download' }
export const downloadState = () => dl;
const emit = () => window.dispatchEvent(new Event('lexling:update'));
const downloader = () => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.() || C.getPlatform?.() !== 'android') return null;
  return C.Plugins?.UpdateDownload ?? C.registerPlugin?.('UpdateDownload') ?? null;
};
// true: downloading in the app; false: handed to the browser
export async function getUpdate() {
  const P = downloader(), url = settings.latestFiles?.apk;
  if (!P || !url) { openUrl(updateUrl()); return false; }
  if (dl.phase === 'running') return true;
  if (navigator.onLine === false) { dl = { phase: 'failed', why: 'offline' }; emit(); return true; }
  const version = settings.latest, name = `Lexling-${version}.apk`;
  try {
    if (settings.updateFile) await P.remove({ id: settings.updateFile.id }).catch(() => {});   // an earlier one, not needed
    const { id } = await P.download({ url, name, title: `Lexling ${version}` });
    settings.updateFile = { id, version };   // removed once this version runs (cleanUpdate)
    saveSettings();
    dl = { phase: 'running', pct: 0, name };
    emit();
    const poll = setInterval(async () => {
      const s = await P.progress({ id }).catch(() => ({ status: 'failed' }));
      if (s.status === 'running') dl = { phase: 'running', pct: s.total > 0 ? Math.round(s.done / s.total * 100) : 0, name };
      else { clearInterval(poll); dl = s.status === 'done' ? { phase: 'done', name } : { phase: 'failed', why: 'download' }; }
      emit();
    }, 700);
  } catch { dl = { phase: 'failed', why: 'download' }; emit(); }
  return true;
}
// the phone's Downloads, where the person taps the file to install it
export const openDownloads = () => downloader()?.openDownloads().catch(() => {});
// the new version runs: the downloaded file that brought it goes (owner: "after installation remove this file")
export function cleanUpdate() {
  const f = settings.updateFile, P = downloader();
  if (!f || !P || newer(f.version, VERSION)) return;
  P.remove({ id: f.id }).catch(() => {});
  delete settings.updateFile;
  saveSettings();
}

// Out of the app: the desktop wrapper through its Python bridge, Android and a browser through the ordinary way (which
// Capacitor hands to the system browser - there the file downloads, and opens with the phone's own installer).
export function openUrl(url) {
  const api = window.pywebview?.api;
  if (api?.open_url) api.open_url(url);
  else window.open(url, '_blank', 'noopener');
}
