import { settings, saveSettings, gameName } from './store.js';
import { t, esc } from './i18n.js';
import { click } from './sound.js';

// A game's name in its top bar (owner, 2026-09-26: "Name (Game 12)"): a long name gives way, its number always shows.
export const gameTitle = g => g.name
  ? `<span class="eyebrow gname"><span class="nm">${esc(g.name)}</span><span class="no">(${t('games.defaultName', { n: g.auto ?? 1 })})</span></span>`
  : `<span class="eyebrow">${esc(gameName(g))}</span>`;

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
// a word link takes no focus: typing stays in the game's field (Znaczenie)
document.addEventListener('pointerdown', e => { if (e.target.closest?.('.mw')) e.preventDefault(); });

// The gear in every game's top bar (owner, 2026-09-26: "a settings button, the usual icon only"): the settings that
// matter while playing, in a small window over the game - Sound for now. The keys go to the window alone while it
// is open (a game would otherwise type into itself, and Esc would leave the screen).
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
export const gearButton = (cls = '') => `<button class="btn btn-ghost gs-open${cls ? ' ' + cls : ''}" type="button" aria-label="${t('set.title')}" title="${t('set.title')}">${GEAR}</button>`;
// `extra` = the game's own settings, [[key, label, help]] - a switch - or [key, label, help, [[value, text], ...]] - a
// choice; `onChange()` repaints what they change.
export const wireGear = (root, extra = [], onChange = () => {}) =>
  wireDialog(root, '.gs-open', t('set.title'), [['sound', t('set.sound'), t('set.soundDesc')], ...extra], onChange);
// A small settings window opened by `trigger` (the gear; Tiles' palette): switches, and choices - [value, label, name],
// the label may be a picture (a colour swatch), `name` then says it.
export function wireDialog(root, trigger, title, items, onChange = () => {}) {
  root.firstElementChild.addEventListener('click', e => {        // the screen, which goes when it is replaced
    if (!e.target.closest(trigger)) return;
    const dlg = document.createElement('dialog');
    dlg.className = 'card game-settings';
    dlg.innerHTML = `<div class="gs-head"><span class="eyebrow">${title}</span><button class="btn btn-ghost gs-close" type="button" aria-label="${t('tiles.close')}">✕</button></div>${
      items.map(([key, label, help, choices]) => choices
        ? `<div class="gs-row col"><div class="row-text"><strong>${label}</strong><span>${help}</span></div><div class="seg" role="radiogroup">${choices.map(([v, text, name]) =>
          `<button type="button" data-key="${key}" data-v="${v}" class="${settings[key] === v ? 'on' : ''}"${name ? ` aria-label="${name}" title="${name}"` : ''}>${text}</button>`).join('')}</div></div>`
        : `<div class="gs-row"><div class="row-text"><strong>${label}</strong><span>${help}</span></div><button type="button" class="toggle${settings[key] ? ' on' : ''}" role="switch" aria-checked="${!!settings[key]}" aria-label="${label}" data-key="${key}"></button></div>`).join('')}`;
    const keys = e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    const close = () => { window.removeEventListener('keydown', keys, true); dlg.close(); dlg.remove(); };
    window.addEventListener('keydown', keys, true);
    dlg.addEventListener('click', e => {
      const toggle = e.target.closest('[data-key]');
      if (toggle) {
        const key = toggle.dataset.key, v = toggle.dataset.v;
        if (v === undefined) {
          settings[key] = !settings[key];
          toggle.classList.toggle('on', settings[key]);
          toggle.setAttribute('aria-checked', settings[key]);
        } else {
          settings[key] = v === 'true' ? true : v === 'false' ? false : v;
          dlg.querySelectorAll(`[data-key="${key}"]`).forEach(b => b.classList.toggle('on', b === toggle));
        }
        saveSettings();
        if (key === 'sound') click(); else onChange(key);
      } else if (e.target === dlg || e.target.closest('.gs-close')) close();   // the backdrop, or ✕
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

// Brand centred, whatever sits beside it: back on the left (only when the screen has one), the
// screen's own note on the right. The side slots are equal columns, so the brand stays centred.
export const topbar = ({ left = '', right = '' } = {}) =>
  `<header class="topbar"><span class="side">${left}</span><a class="brand" href="#/">Lex<b>/</b>ling</a><span class="side end">${right}</span></header>`;

// Which game a screen or a save belongs to: the mode's small glyph and its name.
export const GLYPH = { guess: '<span class="glyph guess" aria-hidden="true"></span>',
  letters: '<span class="glyph letters" aria-hidden="true"><i></i><i></i><i></i></span>',
  connect: `<span class="glyph connect" aria-hidden="true">${'<i></i>'.repeat(5)}</span>`,
  tiles: `<span class="glyph tiles" aria-hidden="true">${'<i></i>'.repeat(9)}</span>` };
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
export function confirmClick(btn, action, refit) {
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) return action();
    const label = btn.innerHTML;
    btn.dataset.armed = '1';
    btn.textContent = t('sure');
    refit();
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.innerHTML = label; refit(); } }, 3000);
  });
}

const systemLight = matchMedia('(prefers-color-scheme: light)');
export function applyTheme() {
  const theme = settings.theme === 'system' ? (systemLight.matches ? 'light' : 'dark') : settings.theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name=theme-color]').content = theme === 'light' ? '#F5F5F5' : '#000000';
}
systemLight.addEventListener('change', applyTheme);
