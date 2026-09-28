// For players who would rather not lose track of time (owner, 2026-09-28): the current time on screen, and a reminder
// every so often of how long they have been playing - since Lexling was opened, and since the last reminder. Only the
// time Lexling is on the screen counts; a reminder that falls due while it is in the background waits for its return.
// Both are Settings switches, off by default.
import { settings } from './store.js';
import { t, getLang } from './i18n.js';
import { openDialog } from './ui.js';

let played = 0, sinceLast = 0, last = Date.now();
const now = () => new Date().toLocaleTimeString(getLang() === 'pl' ? 'pl-PL' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
const span = ms => { const m = Math.round(ms / 60000), h = Math.floor(m / 60); return h ? t('time.hm', { h, m: m % 60 }) : t('time.m', { m }); };

// the time, under the Lexling name at the top (ui.js topbar)
export function paintClock() {
  for (const el of document.querySelectorAll('.tb-clock')) el.textContent = settings.showClock ? now() : '';
}
// the time since the last count goes to the play time - when it was on screen
function count(onScreen) {
  const at = Date.now();
  if (onScreen) { const d = Math.min(at - last, 120000); played += d; sinceLast += d; }
  last = at;
}
function remindIfDue() {
  const every = Math.max(5, settings.remindMin || 90) * 60000;
  if (!settings.playRemind || sinceLast < every || document.visibilityState !== 'visible' || document.querySelector('dialog[open]')) return;
  const text = played - sinceLast < 60000 ? t('remind.first', { total: span(played), time: now() })
    : t('remind.text', { total: span(played), since: span(sinceLast), time: now() });
  // the time played large, one line, OK (design "Lexling Menu Five Games": the game-settings window)
  const { dlg, close } = openDialog(t('remind.title'), `<span class="num">${span(played)}</span><p>${text}</p><button class="btn btn-primary" type="button" data-ok>${t('remind.ok')}</button>`);
  dlg.classList.add('remind');
  dlg.querySelector('[data-ok]').addEventListener('click', close);
  sinceLast = 0;
}
export function startPlaytime() {
  setInterval(() => { count(document.visibilityState === 'visible'); paintClock(); remindIfDue(); }, 15000);
  // hidden: what was on screen until now counts; back: from now on
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { last = Date.now(); paintClock(); remindIfDue(); } else count(true); });
  paintClock();
}
