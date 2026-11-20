import { achievementIcon } from './achievement-icons.js';
import { achievementDetail, achievementInk } from './achievement-view.js';
import { settings, saveSettings, gameName, counts } from './store.js';
import { t, esc } from './i18n.js';
import { TIERS } from './achievements.js';
import { click } from './sound.js';
import { btStillOn, btLetBe, btSettings } from './net.js';

// Owner-picked icons from notes/icon-places/index.html; geometry stays with its proposal.
export const UI_ICONS = {
  general: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/></svg>',
  display: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
  playTime: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  online: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>',
  about: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  saveExit: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" ><path d="M6 3h10l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 3v5h7V3M7 21v-7h10v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  giveUp: '<svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 5c3-2 6 2 9 0s4-1 5 0v8c-1-1-2-2-5 0s-6 2-9 0"/></svg>',
  hint: '<svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  enter: '<svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="m9 10-5 5 5 5"/></svg>',
  howTo: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/></svg>',
  assists: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>',
  rules: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v14m0-14C9 4 5 4 3 5v14c2-1 6-1 9 1 3-2 7-2 9-1V5c-2-1-6-1-9 1Z"/></svg>',
  friend: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>',
  onlyNew: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>',
  resume: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 4 13 8-13 8z"/></svg>',
  menu: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/></svg>',
  finished: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>',
  time: '<svg class="app-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>',
};

// Shared seat symbols keep setup and play consistent (owner, 2026-11-20).
const playerSvg = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
export const playerIcon = (S, p) => S.players[p].cpu
  ? playerSvg('<rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4M7 9h.01M17 9h.01M8 13h8"></path>')
  : playerSvg('<circle cx="12" cy="7" r="4"></circle><path d="M4 22v-3a8 8 0 0 1 16 0v3"></path>');
export const TILE_SETUP_ICONS = {
  dice: playerSvg('<rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01"></path>'),
  addPlayer: playerSvg('<circle cx="9" cy="7" r="4"></circle><path d="M2 22v-3a7 7 0 0 1 12-4.9M18 13v8M14 17h8"></path>'),
};

// The same SVG medal on Android and Windows, outlined while locked (owner, 2026-11-14).
export const achievementMedal = (earned = true) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m8 10-4-7h5l3 5 3-5h5l-4 7"></path><circle cx="12" cy="15" r="6"${earned ? ' fill="currentColor" fill-opacity=".18"' : ''}></circle>${earned ? '<path d="m12 11 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"></path>' : ''}</svg>`;

// A small notice on every screen, queued so simultaneous unlocks all get their moment (owner, 2026-11-14).
const achievementQueue = [];
let achievementNotice = null;
function showAchievement() {
  if (achievementNotice || !achievementQueue.length) return;
  const [id, tier] = achievementQueue.shift().split('#');
  const name = t('ach.' + id) + (tier === undefined ? '' : ' · ' + t('tier.' + TIERS[+tier]));
  const notice = achievementNotice = document.createElement('div');
  notice.className = 'achievement-notice';
  notice.setAttribute('role', 'status');
  notice.style?.setProperty('--ink', achievementInk(tier === undefined ? 5 : +tier));
  notice.innerHTML = `<span class="ach-notice-icon"><img src="img/achievement.webp" alt="">${achievementIcon(id)}</span><span><strong>${t('ach.unlocked')}</strong><b>${tier === undefined ? t('ach.earned') : t('tier.' + TIERS[+tier])}</b><span>${esc(name)}</span></span><span class="ach-notice-actions"><button data-see>${t('ach.see')}</button><button data-close>${t('ach.nice')}</button></span>`;
  let closed = false;
  const close = () => { if (closed) return; closed = true; notice.remove(); achievementNotice = null; showAchievement(); };
  notice.querySelector?.('[data-close]')?.addEventListener('click', close);
  notice.querySelector?.('[data-see]')?.addEventListener('click', () => { close(); achievementDetail(id); });
  document.body.append(notice);
  setTimeout(close, 3000);
}
document.addEventListener('lexling:achievement', e => {
  achievementQueue.push(...e.detail.keys);
  showAchievement();
});

// Owner, 2026-11-20: explain the automatic removal without interrupting play.
document.addEventListener('lexling:save-evicted', () => {
  document.querySelector('.save-notice')?.remove();
  const notice = document.createElement('div');
  notice.className = 'meaning-notice save-notice';
  notice.setAttribute('role', 'status');
  notice.textContent = t('games.limitRemoved');
  document.body.append(notice);
  setTimeout(() => notice.remove(), 4000);
});

// A game's name in its top bar (owner, 2026-09-26: "Name (Game 12)"): a long name gives way, its number always shows.
export const practiceBadge = g => counts(g) ? '' : `<span class="practice-badge">${t('practice')}</span>`;
export const gameTitle = g => (g.name
  ? `<span class="eyebrow gname"><span class="nm">${esc(g.name)}</span><span class="no">(${t('games.defaultName', { n: g.auto ?? 1 })})</span></span>`
  : `<span class="eyebrow">${esc(gameName(g))}</span>`) + practiceBadge(g);

// A word's meaning (owner, 2026-09-26: no dictionary inside the app - too big - "open the browser with the word"): sjp.pl
// for Polish (it knows every form, and says which word it comes from), Wiktionary for English. In the phone's own
// browser - the desktop wrapper through its bridge, Android and a browser through the ordinary way.
export const meaningUrl = (word, lang) => lang === 'pl' ? `https://sjp.pl/${encodeURIComponent(word)}`
  : `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#English`;
export function openExternal(url) {
  const api = window.pywebview?.api;
  if (api?.open_url) api.open_url(url);
  else window.open(url, '_blank', 'noopener');
}
const BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>';
// a button under a word ("What it means ↗"), or the word itself as a link (dotted underline) in a list
export const meaningButton = (word, lang) => `<button type="button" class="btn btn-ghost mean" data-mean="${esc(word)}" data-lang="${lang}">${BOOK}${t('meaning')} <span class="arrow">↗</span></button>`;
export const wordLink = (word, lang, text = word) => `<button type="button" class="mw" data-mean="${esc(word)}" data-lang="${lang}" title="${t('meaning')}">${esc(text)}</button>`;
document.addEventListener('click', e => {
  const el = e.target.closest?.('[data-mean]');
  if (el) openExternal(meaningUrl(el.dataset.mean, el.dataset.lang));
});
// a word link takes no focus: typing stays in the game's field (Guess)
document.addEventListener('pointerdown', e => { if (e.target.closest?.('.mw')) e.preventDefault(); });

// The gear in every game's top bar (owner, 2026-09-26: "a settings button, the usual icon only"): the settings that
// matter while playing, in a small window over the game. The keys go to the window alone while it
// is open (a game would otherwise type into itself, and Esc would leave the screen).
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
export const gearButton = (cls = '') => `<button class="btn btn-ghost gs-open${cls ? ' ' + cls : ''}" type="button" aria-label="${t('set.title')}" title="${t('set.title')}">${GEAR}</button>`;
// `extra` = the game's own settings, [[key, label, help]] - a switch - or [key, label, help, [[value, text], ...]] - a
// choice; `onChange()` repaints what they change.
// A tap that did something: the button's frame flashes in the theme colour for a moment (owner, 2026-09-26 - a hint
// was given). A touch screen has no hover to show it.
export function flashTap(el) {
  if (!el) return;
  el.classList.remove('tap-flash');
  void el.offsetWidth;                 // restarts the animation on a quick second tap
  el.classList.add('tap-flash');
  clearTimeout(el.flashTimer);
  el.flashTimer = setTimeout(() => el.classList.remove('tap-flash'), 500);
}
export const wireGear = (root, extra = [], onChange = () => {}) =>
  wireDialog(root, '.gs-open', t('set.title'), [['sound', t('set.sound'), t('set.soundDesc')],
    // the same theme choice inside every game (owner, 2026-11-14)
    ['theme', t('set.theme'), '', ['dark', 'light', 'system'].map(v => [v, t('theme.' + v)])], ...extra], onChange);
// A small settings window opened by `trigger` (the gear): its rows, changed as they are tapped.
export function wireDialog(root, trigger, title, items, onChange = () => {}) {
  root.firstElementChild.addEventListener('click', e => {        // the screen, which goes when it is replaced
    if (!e.target.closest(trigger)) return;
    wireSettingRows(openDialog(title, settingRows(items)).dlg, onChange);
  });
}
// A small window over the screen: a head with the title and ✕; Esc, ✕ or a tap outside closes it. (Tiles' Options is
// one too, with more in it - owner, 2026-09-26.) Returns the dialog and its close().
export function openDialog(title, body) {
  const dlg = document.createElement('dialog');
  dlg.className = 'card game-settings';
  dlg.innerHTML = `<div class="gs-head"><span class="eyebrow">${title}</span><button class="btn btn-ghost gs-close" type="button" aria-label="${t('tiles.close')}">✕</button></div>${body}`;
  const keys = e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  };
  const close = () => { window.removeEventListener('keydown', keys, true); dlg.close(); dlg.remove(); };
  window.addEventListener('keydown', keys, true);
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('.gs-close')) close(); });   // the backdrop, or ✕
  document.body.append(dlg);
  dlg.showModal();
  return { dlg, close };
}
// Bluetooth still on after a game on several phones, and Lexling switched it on: say so, with a way to switch it off
// (owner, 2026-09-27) - Android lets no app do that itself, so the button opens its Bluetooth settings. Settings has a
// switch for this reminder (on by default). Called on leaving: shown only once the next screen is not a game or joining.
export function remindBt() {
  setTimeout(async () => {
    if (/^#\/(game|join)\//.test(location.hash) || !settings.btRemind || !(await btStillOn())) return;
    const { dlg, close } = openDialog(t('net.remind.title'), `<p class="help">${t('net.remind.text')}</p><div class="gs-acts"><button class="btn btn-ghost" type="button" data-ok>${
      t('net.remind.ok')}</button><button class="btn btn-primary" type="button" data-off>${t('net.remind.off')}</button></div>`);
    dlg.querySelector('[data-ok]').addEventListener('click', () => { btLetBe(); close(); });
    dlg.querySelector('[data-off]').addEventListener('click', () => { btLetBe(); btSettings(); close(); });
  }, 400);
}
// Larger game tools share one preference in both Look controls (owner, 2026-11-20).
export function applyButtonSize() {
  const size = String(settings.buttonSize);
  document.documentElement.style.setProperty('--button-scale', ['100', '115', '130', '150', '175'].includes(size) ? Number(size) / 100 : 1.3);
}

// Settings as rows: [key, label, help] a switch; [key, label, help, choices] a choice - each [value, label, name], the
// label may be a picture (a colour swatch), `name` then says it.
export const settingRows = items => items.map(([key, label, help, choices]) => choices
  ? `<div class="gs-row col"><div class="row-text"><strong>${label}</strong><span>${help}</span></div><div class="seg" role="radiogroup">${choices.map(([v, text, name]) =>
    `<button type="button" data-key="${key}" data-v="${v}" class="${settings[key] === v ? 'on' : ''}"${name ? ` aria-label="${name}" title="${name}"` : ''}>${text}</button>`).join('')}</div></div>`
  : `<div class="gs-row"><div class="row-text"><strong>${label}</strong><span>${help}</span></div><button type="button" class="toggle${settings[key] ? ' on' : ''}" role="switch" aria-checked="${!!settings[key]}" aria-label="${label}" data-key="${key}"></button></div>`).join('');
// A tap on one of those rows: the setting changes and is saved, then onChange(key) - Sound answers with its click.
export function wireSettingRows(el, onChange = () => {}) {
  el.addEventListener('click', e => {
    const toggle = e.target.closest('[data-key]');
    if (!toggle) return;
    const key = toggle.dataset.key, v = toggle.dataset.v;
    if (v === undefined) {
      settings[key] = !settings[key];
      toggle.classList.toggle('on', settings[key]);
      toggle.setAttribute('aria-checked', settings[key]);
    } else {
      settings[key] = v === 'true' ? true : v === 'false' ? false : v;
      el.querySelectorAll(`[data-key="${key}"]`).forEach(b => b.classList.toggle('on', b === toggle));
    }
    saveSettings();
    if (key === 'theme') applyTheme();
    if (key === 'buttonSize') applyButtonSize();
    if (key === 'sound') click(); else onChange(key);
  });
}

// Brand centred, whatever sits beside it: back on the left (only when the screen has one), the
// screen's own note on the right. The side slots are equal columns, so the brand stays centred.
export const topbar = ({ left = '', right = '' } = {}) =>
  `<header class="topbar"><span class="side">${left}</span><a class="brand" href="#/">Lex<b>/</b>ling<small class="tb-clock" aria-live="off"></small></a><span class="side end">${right}</span></header>`;

// Which game a screen or a save belongs to: the mode's small glyph and its name.
// Chunky line icons from icon proposal C, shared by every mode label and tab.
const gameSvg = (mode, body) => `<svg class="glyph ${mode}" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const GLYPH = {
  guess: gameSvg('guess', '<circle cx="28" cy="36" r="24" stroke="#8E6CF0" stroke-width="7"/><circle cx="28" cy="36" r="11" stroke="#B999F5" stroke-width="6"/><path d="m8 22a24 24 0 0 1 27-9" stroke="#BEA2FF" stroke-width="2"/><path d="m28 36 23-23m-3 3 1-8 5-5 1 9 6 1-6 5-7-2Z" stroke="#8E6CF0" stroke-width="5"/><path d="m28 36 23-23m-3 3 1-8 5-5 1 9 6 1-6 5-7-2Z" stroke="#F3E5C8" stroke-width="2.8"/>'),
  letters: gameSvg('letters', '<path d="M10 41 23 9Q25 4 30 4h5q5 0 7 5l12 32q2 5-4 5h-4q-3 0-4-4l-2-5H24l-2 5q-1 4-4 4h-4q-6 0-4-5Z M28 28h9l-5-13Z" fill="#9DDD8D" fill-rule="evenodd" stroke="#4AA33D" stroke-width="3"/><path d="m24 13q2-6 8-6h3" stroke="#C9F1C1" stroke-width="3"/><circle cx="17" cy="56" r="5.5" fill="#58B747"/><circle cx="32" cy="56" r="5.5" fill="#FFCD19"/><circle cx="47" cy="56" r="5.5" fill="#999"/>'),
  connect: gameSvg('connect', '<path d="M32 12 11 52h42Z" stroke="#009E99" stroke-width="6"/><path d="m25 27-6 11m21-12 5 10M23 52h16" stroke="#58C9C1" stroke-width="2"/><g fill="#F3E3C2" stroke="#00A49E" stroke-width="4"><circle cx="32" cy="12" r="9"/><circle cx="11" cy="52" r="9"/><circle cx="53" cy="52" r="9"/></g><path d="M26 7q3-4 8-3M5 48q3-4 7-4m35 4q3-4 7-4" stroke="#75D6CD" stroke-width="2"/>'),
  tiles: gameSvg('tiles', '<g transform="rotate(-11 32 32)"><rect x="7" y="7" width="50" height="50" rx="11" fill="#28231B" stroke="#E9AF25" stroke-width="7"/><rect x="7" y="7" width="50" height="50" rx="11" stroke="#FFD65D" stroke-width="3"/><path d="M18 46 29 20q2-5 5 0l10 26m-22-8h17" stroke="#F3E3C2" stroke-width="7"/><path d="m45 17 3-2v8m-2 0h5" stroke="#F3E3C2" stroke-width="2.5"/><path d="M11 13q2-4 8-4h26" stroke="#FFE8A0" stroke-width="2"/></g>'),
  all: gameSvg('all', '<g stroke="#DC4F1C" stroke-width="4"><rect x="5" y="5" width="24" height="24" rx="7"/><rect x="35" y="5" width="24" height="24" rx="7"/><rect x="5" y="35" width="24" height="24" rx="7"/><rect x="35" y="35" width="24" height="24" rx="7"/></g><path d="M7 9q1-3 5-3h10m15 3q1-3 5-3h10M7 39q1-3 5-3h10m15 3q1-3 5-3h10" stroke="#F99966" stroke-width="2"/>'),
};
export const modeTag = mode => `<span class="mode-tag">${GLYPH[mode]}${t('mode.' + mode)}</span>`;

// How a game ended, first thing on its end screen and the same in every mode (design v2:
// handoff-letters/game-letters-end.html, game-guess-end.html): a banner in the success or error colour
// saying only what happened, with the guess count on the right.
// The ✓ / ✕ are drawn, not typed: the display font has neither sign, and the fallback font's glyph sat
// off-centre in the circle (owner, 2026-09-25).
const MARK = { won: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', lost: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>' };
export const outcome = (won, what, count, unit) => `<div class="outcome ${won ? 'won' : 'lost'}" role="status"><span class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${
  MARK[won ? 'won' : 'lost']}</svg></span><span class="what">${what}</span><span class="count">${count}<small>${unit}</small></span></div>`;

// Letters feedback (letters.js) -> the tile classes: hit = right place, near = elsewhere, miss = not in it.
export const TILE = { green: 'hit', yellow: 'near', grey: 'miss' };
// A row of mini squares, blank or lettered: the saved-game card, the menu cue, the how-to legend.
export const squares = (marks, size, letters = []) => `<span class="mt-row" aria-hidden="true">${marks.map((mark, i) =>
  `<i class="mt ${mark}"${size ? ` style="--s:${size}px"` : ''}>${letters[i] ?? ''}</i>`).join('')}</span>`;

// Accent colour ("theme colour"): the design's orange, or one of these. --accent-hover is the same
// colour darkened, --accent-soft the same colour at 16 %, so one pick restyles every accented thing.
export const ACCENTS = { orange: '#DB5126', red: '#E03131', amber: '#E8A317', green: '#2BA84A',
  teal: '#12A5A5', blue: '#3B7DD8', violet: '#7C5CD6', pink: '#D6459B' };

export function applyAccent() {
  const hex = ACCENTS[settings.accent] || ACCENTS.orange;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const style = document.documentElement.style;
  style.setProperty('--accent', hex);
  style.setProperty('--accent-hover', `rgb(${[r, g, b].map(c => Math.round(c * 0.78)).join(',')})`);
  style.setProperty('--accent-soft', `rgba(${r},${g},${b},.16)`);
}

// Fill colour follows closeness continuously along the design's four ramp tokens (cold → warm → mid → hot).
// The stops sit lower than the percentages they colour: with 60k words, rank 25 is already an excellent
// guess but only 71 % "close", so green has to start well before the top of the scale.
const STOPS = [15, 38, 58, 75];
let ramp;
export function fillColor(pct) {
  if (!ramp) {
    const css = getComputedStyle(document.documentElement);
    ramp = ['cold', 'warm', 'mid', 'hot'].map(name => {
      const hex = css.getPropertyValue('--fill-' + name).trim().slice(1);
      return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    });
  }
  const p = Math.min(Math.max(pct, STOPS[0]), STOPS[3]);
  const i = Math.max(1, STOPS.findIndex(s => p <= s));
  const f = (p - STOPS[i - 1]) / (STOPS[i] - STOPS[i - 1]);
  return `rgb(${ramp[i - 1].map((c, k) => Math.round(c + (ramp[i][k] - c) * f)).join(',')})`;
}

// Destructive buttons ask once: first click turns the label into "Sure?", a second one within 3 s acts.
export function confirmClick(btn, action, refit, iconOnly = false) {
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) return action();
    const label = btn.innerHTML;
    btn.dataset.armed = '1';
    const aria = btn.getAttribute('aria-label'), title = btn.getAttribute('title');
    if (iconOnly) {
      btn.setAttribute('aria-label', t('sure'));
      btn.setAttribute('title', t('sure'));
    } else btn.textContent = t('sure');
    refit();
    setTimeout(() => { if (btn.isConnected) {
      delete btn.dataset.armed;
      btn.innerHTML = label;
      if (iconOnly) { btn.setAttribute('aria-label', aria); btn.setAttribute('title', title); }
      refit();
    } }, 3000);
  });
}

// Whole palettes (owner, 2026-11-14); keep in step with the backgrounds in index.html and css/app.css.
export const PALETTES = { classic: { dark: '#000000', light: '#F5F5F5' }, paper: { dark: '#211D19', light: '#F7F0DF' },
  ocean: { dark: '#101C28', light: '#EDF5FA' }, forest: { dark: '#142019', light: '#EFF5EC' }, contrast: { dark: '#000000', light: '#FFFFFF' } };
const systemLight = matchMedia('(prefers-color-scheme: light)');
export function applyTheme() {
  const theme = settings.theme === 'system' ? (systemLight.matches ? 'light' : 'dark') : settings.theme === 'light' ? 'light' : 'dark';
  const palette = Object.hasOwn(PALETTES, settings.palette) ? settings.palette : 'classic';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.palette = palette;
  document.documentElement.style.backgroundColor = PALETTES[palette][theme];
  document.querySelector('meta[name=theme-color]').content = PALETTES[palette][theme];
}
systemLight.addEventListener('change', applyTheme);

// One floating chapter reader for setup help and the in-game Tiles guide.
export function openRules(mode, topicsHtml = null) {
  let chapters;
  if (topicsHtml) {
    const source = document.createElement('div');
    source.innerHTML = topicsHtml;
    chapters = [...source.querySelectorAll('details')].map(d => ({
      title: d.querySelector('summary').textContent.replace('›', '').trim(),
      body: [...d.children].slice(1).map(el => el.outerHTML).join(''),
    }));
  } else chapters = t('howto.' + mode).split('\n').map((body, i) => ({
    title: t(`howto.${mode}.${i}`), body: `<p class="help">${body}</p>`,
  }));
  const { dlg, close } = openDialog(`${GLYPH[mode]} ${t('mode.' + mode)} · ${t('howto.title')}`,
    '<div class="chapter-title"><span class="chapter-count"></span><h2 id="rules-chapter"></h2></div><div class="chapter-body"></div><nav class="rules-nav"></nav>');
  dlg.classList.add('rules-window', 'rules-a');
  dlg.setAttribute('aria-label', `${t('mode.' + mode)} · ${t('howto.title')}`);
  let at = 0, start = null;
  const paint = () => {
    dlg.querySelector('.chapter-count').textContent = `${at + 1} / ${chapters.length}`;
    dlg.querySelector('h2').textContent = chapters[at].title;
    const body = dlg.querySelector('.chapter-body');
    body.innerHTML = chapters[at].body;
    body.scrollTop = 0;
    dlg.querySelector('.rules-nav').innerHTML = `<button type="button" data-step="-1" aria-label="${t('howto.prev')}"${at === 0 ? ' disabled' : ''}>←</button><div class="chapter-dots" aria-hidden="true">${chapters.map((_, i) => `<i class="${i === at ? 'active' : ''}"></i>`).join('')}</div><button type="button" data-step="1" aria-label="${t('howto.next')}"${at === chapters.length - 1 ? ' disabled' : ''}>→</button>`;
  };
  const step = n => { at = Math.max(0, Math.min(chapters.length - 1, at + n)); paint(); };
  dlg.addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) step(+b.dataset.step); });
  // openDialog isolates all keys from the game; this listener handles chapter arrows in capture too.
  const keys = e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); } };
  window.addEventListener('keydown', keys, true);
  dlg.addEventListener('close', () => window.removeEventListener('keydown', keys, true), { once: true });
  dlg.addEventListener('touchstart', e => { start = [e.changedTouches[0].clientX, e.changedTouches[0].clientY]; }, { passive: true });
  dlg.addEventListener('touchend', e => {
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start[0], dy = e.changedTouches[0].clientY - start[1];
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    start = null;
  }, { passive: true });
  paint();
  return { dlg, close };
}
