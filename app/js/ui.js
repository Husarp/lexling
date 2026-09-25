import { settings } from './store.js';
import { t } from './i18n.js';

// Brand centred, whatever sits beside it: back on the left (only when the screen has one), the
// screen's own note on the right. The side slots are equal columns, so the brand stays centred.
export const topbar = ({ left = '', right = '' } = {}) =>
  `<header class="topbar"><span class="side">${left}</span><a class="brand" href="#/">Lex<b>/</b>ling</a><span class="side end">${right}</span></header>`;

// Which game a screen or a save belongs to: the mode's small glyph and its name.
export const GLYPH = { guess: '<span class="glyph guess" aria-hidden="true"></span>',
  letters: '<span class="glyph letters" aria-hidden="true"><i></i><i></i><i></i></span>' };
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
