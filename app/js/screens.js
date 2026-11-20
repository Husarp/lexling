import { achievementIcon, achievementLock, tierShape } from './achievement-icons.js';
import { achievementInk, achievementState, achievementPips, achievementBar, achievementDetail } from './achievement-view.js';
// Menu, game picker, new game, statistics, settings. Markup is the design handoff's
// (design/handoff/*.html), with the dummy text replaced by t(...) and live data.
import { t, plural, esc, num, clock, ago, dateTime, setLang, getLang, LANG_NAMES } from './i18n.js';
import { settings, saveSettings, stats, listSaves, getSave, putSave, deleteSave, newGame, gameName, collected, totals, setupPractice } from './store.js';
import { net, netKinds, netReady, nearbyHere, openLocation } from './net.js';
import { createGuest } from './session.js';
import { has } from './dawg.js';
import { cleanTiers, RARE_TIERS } from './rarity.js';
import { TIERS, TIERED, CHALLENGES, gotAt, earlierAchievements } from './achievements.js';
import { load, loadWords, preload, resolve, pickSecret, secretPool, secretWords, lengthStats } from './engine.js';
import { feedback, pool, pick, LEN_MIN, LEN_MAX, TRIES_MAX } from './letters.js';
import { makePuzzle, RANGE, RING_MIN, RING_MAX, WORD_MIN, visible, isDone } from './connect.js';
import { BOARDS, STANDARD, LEVEL_ORDER, levelKey, PLAYERS_MAX, newGame as tilesGame, apply as tilesApply, loadTileWords, valueOf, fullBag } from './tiles.js';
import { nameOf, topics, LABEL, bonusSeg, bonusOf, boardStyleSeg, tileSeg, applyTileLook } from './tiles-game.js';
import { UI_ICONS, playerIcon, TILE_SETUP_ICONS, topbar, fillColor, confirmClick, applyTheme, applyAccent, applyButtonSize, ACCENTS, PALETTES, GLYPH, modeTag, TILE, squares, remindBt, practiceBadge, openRules } from './ui.js';
import { fitAll } from './fit.js';
import { click } from './sound.js';
import { VERSION, REPO } from './version.js';
import { cleanCode, isCode } from './net-web.js';
import { paintClock } from './playtime.js';
import { checkUpdate, newer, recentUpdateShown, closeRecentUpdate, updateShown, closeUpdate, updateUrl, openUrl, getUpdate, downloadState, installUpdate } from './update.js';
import { whatsnew, changesFor } from './whatsnew.js';

const CATS = ['all', 'animals', 'food', 'household', 'clothing', 'tools', 'tech', 'vehicles', 'buildings',
  'nature', 'weather', 'body', 'people', 'jobs', 'school', 'science', 'sport', 'music', 'feelings',
  'abstract', 'verbs'];
const DIFFS = ['relaxed', 'easy', 'normal', 'hard'];
const BANDS = ['short', 'medium', 'long', 'any'];
const DOT = '<span class="dot">·</span>';
const on = cond => cond ? 'on' : '';
// One name in Settings or on the first Join; changes apply to the next game (owner, 2026-11-14).
const myNameInput = () => `<input class="input" type="text" id="my-name" maxlength="16" autocomplete="off" value="${esc(settings.myName ?? '')}" placeholder="${t('set.myNamePh')}" aria-label="${t('set.myName')}">`;
const wireMyName = root => root.querySelectorAll('#my-name').forEach(i => i.addEventListener('input', () => { settings.myName = i.value.trim().slice(0, 16); saveSettings(); }));
// "Only new words" (owner, 2026-09-28, with the Collection): a switch on New game - the secret is one not yet in this
// mode's Collection; -2 when every word the choice could hide is there already
const onlyNewCard = () => `<div class="card polish" id="only-new"><div class="row"><div class="row-text"><strong>${UI_ICONS.onlyNew}${t('new.onlyNew')}</strong><span>${t('new.onlyNewDesc')}</span></div>
  <button type="button" class="toggle" role="switch" aria-label="${t('new.onlyNew')}"></button></div></div>`;
const paintOnlyNew = (root, o) => { const b = root.querySelector('#only-new .toggle'); b.classList.toggle('on', !!o.onlyNew); b.setAttribute('aria-checked', !!o.onlyNew); };
function freshPick(m, list, mode, lang) {
  const had = collected(mode, lang), left = list.filter(i => !had.has(m.words[i]));
  return left.length ? left[Math.floor(Math.random() * left.length)] : -2;
}

// A game that is not built yet has its row, saying "soon", but does not open.
const GAMES = ['guess', 'letters', 'connect', 'tiles'];
const READY = new Set(['guess', 'letters', 'connect', 'tiles']);
const NEW_OF = { guess: '#/new', letters: '#/new/letters', connect: '#/new/connect', tiles: '#/new/tiles' };
const LIST_OF = { guess: '#/games/guess', letters: '#/games/letters', connect: '#/games/connect', tiles: '#/games/tiles' };

// the menu's update banner, painted again when a check brings news (update.js)
let menuUpdate = null;
window.addEventListener('lexling:update', () => menuUpdate?.());

export function menu(root, _, refresh) {
  // One compact row per game, all the same size and weight - only the icon differs. Four of the old
  // big cards pushed Statistics and Settings off a phone's first screen. No count of games in progress
  // (owner, 2026-09-25) - only "soon" for a game not built yet.
  const row = key => {
    const live = READY.has(key) ? '' : `<span class="g-live">${t('menu.soon')}</span>`;
    const inner = `<img class="menu-art" src="img/menu/${key}.webp" alt=""><span class="g-name">${t('mode.' + key)}</span>${live}`;
    return READY.has(key) ? `<a class="game" href="${LIST_OF[key]}">${inner}<span class="arrow" aria-hidden="true">→</span></a>`
      : `<div class="game soon" aria-disabled="true">${inner}</div>`;
  };
  root.innerHTML = `<div class="app" data-screen="menu">
  ${topbar({ right: `<span class="eyebrow lang-switch">${
    ['pl', 'en'].map(l => `<button type="button" data-lang="${l}" class="${on(getLang() === l)}" aria-label="${LANG_NAMES[l]}">${l.toUpperCase()}</button>`).join(DOT)}</span>` })}
  <section class="hero four tight">
    <div class="wm" aria-hidden="true">L/</div>
    <div class="hero-inner">
      <p class="eyebrow">${t('menu.eyebrow')} ${DOT} ${t('menu.offline')}</p>
      <h1 class="display">${t('menu.h1')}</h1>
      <nav class="games tight" aria-label="${t('menu.modesAria')}">${GAMES.map(row).join('')}</nav>
      <nav class="menu cards" aria-label="${t('menu.nav')}">
        <a href="#/stats"><span class="menu-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="13" width="3" height="7" rx=".5"/><rect x="10.5" y="4" width="3" height="16" rx=".5"/><rect x="17" y="9" width="3" height="11" rx=".5"/></svg></span><span>${t('menu.stats')}</span></a>
        <a href="#/achievements"><span class="menu-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg></span><span>${t('menu.ach')}</span></a>
        <a href="#/collection"><span class="menu-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="4" height="15" rx=".5"/><rect x="10" y="3" width="4" height="17" rx=".5"/><path d="m16 6 3-1 3 14-3 1z"/></svg></span><span>${t('menu.collection')}</span></a>
        <a href="#/settings"><span class="menu-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9.5 3-.5 2a7.5 7.5 0 0 0-2 1.2l-2-.6-2 3.4L4.5 10a7.5 7.5 0 0 0 0 4L3 15l2 3.4 2-.6A7.5 7.5 0 0 0 9 19l.5 2h5l.5-2a7.5 7.5 0 0 0 2-1.2l2 .6 2-3.4-1.5-1a7.5 7.5 0 0 0 0-4L21 9l-2-3.4-2 .6A7.5 7.5 0 0 0 15 5l-.5-2z"/><circle cx="12" cy="12" r="3"/></svg></span><span>${t('menu.settings')}</span></a>
      </nav>
      <div class="upd-slot"></div>
    </div>
  </section>
  <footer class="footer"><span>v${VERSION}</span></footer>
</div>`;
  root.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => switchLang(b.dataset.lang, refresh)));
  // a newer version (owner, 2026-09-27): at the bottom - Download, or ✕ (hidden until Lexling next starts)
  const slot = root.querySelector('.upd-slot');
  // on Android the download runs here (update.js): its progress, then Android's installer by itself - after its settings
  // screen, the first time (install apps); Install asks again. On Windows too: its progress, then the installer starts
  // and Lexling closes.
  // A failed download: Try again, and GitHub next to it - the release page (owner, 2026-09-27)
  let handed = false;
  menuUpdate = () => {
    if (!slot.isConnected) return;
    const d = downloadState(), v = esc(settings.latest);
    const x = `<button class="btn btn-ghost upd-x" type="button" aria-label="${t('upd.close')}" title="${t('upd.close')}">✕</button>`;
    const btn = (cls, key) => `<button class="btn btn-primary ${cls}" type="button">${t(key)} <span class="arrow">→</span></button>`;
    slot.innerHTML = !updateShown() && d.phase === 'idle' ? ''
      : d.phase === 'running' ? `<div class="upd" role="status"><span class="upd-text">${t('upd.getting', { v, pct: d.pct })}</span><span class="upd-bar"><i style="width:${d.pct}%"></i></span></div>`
      : d.phase === 'done' ? `<div class="upd" role="status"><span class="upd-text">${t(d.asked === 'allow' ? 'upd.allow' : d.asked === 'notAllowed' ? 'upd.notAllowed' : 'upd.confirm', { v })}</span><div class="upd-acts">${btn('upd-install', 'upd.install')}</div></div>`
      : d.phase === 'starting' ? `<div class="upd" role="status"><span class="upd-text">${t('upd.starting', { v })}</span></div>`
      : d.phase === 'failed' ? `<div class="upd" role="status"><span class="upd-text">${t(d.why === 'offline' ? 'upd.offline' : 'upd.failed')}</span><div class="upd-acts">${btn('upd-get', 'upd.again')}<span class="upd-pair"><button class="btn btn-outline upd-gh" type="button">GitHub</button>${x}</span></div></div>`
      : `<div class="upd" role="status"><span class="upd-text">${t('upd.available', { v })}</span><div class="upd-acts">${btn('upd-get', 'upd.get')}${x}</div>${
        handed ? `<span class="upd-note">${t(navigator.onLine === false ? 'upd.offline' : 'upd.opened')}</span>` : ''}</div>`;
    if (recentUpdateShown()) slot.innerHTML += `<div class="upd" role="status"><a class="upd-text" href="#/whatsnew">${t('wn.updated', { v: VERSION })}</a><button class="btn btn-ghost wn-close" type="button" aria-label="${t('upd.close')}">✕</button></div>`;
  };
  menuUpdate();
  slot.addEventListener('click', async e => {
    if (e.target.closest('.wn-close')) { closeRecentUpdate(); return menuUpdate(); }
    if (e.target.closest('.upd-x')) { closeUpdate(); return menuUpdate(); }
    if (e.target.closest('.upd-gh')) return openUrl(`https://github.com/${REPO}/releases/latest`);
    if (e.target.closest('.upd-install')) return installUpdate();
    if (!e.target.closest('.upd-get')) return;
    if (navigator.onLine === false) { handed = true; return menuUpdate(); }
    handed = !(await getUpdate());
    menuUpdate();
  });
}

// `chosen` = the player picked the interface language themselves (menu switch or Settings). Until they
// do, the interface follows the language of the game they set up; afterwards their choice is kept.
function switchLang(lang, refresh, chosen = true) {
  if (!chosen && (settings.langChosen || settings.lang === lang)) return false;
  settings.lang = lang;
  settings.langChosen ||= chosen;
  saveSettings();
  setLang(lang);
  refresh();
  return true;
}

function saveMeta(g) {
  return [LANG_NAMES[g.lang],
    !g.friend && t(g.cat === 'all' ? 'cat.allLong' : 'cat.' + g.cat),
    !g.friend && g.band && g.band !== 'any' && t('band.' + g.band),
    !g.friend && g.diff !== 'normal' && t('diff.' + g.diff),
    g.friend && t('new.friend'),
    ago(g.updated)].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
}

function lettersMeta(g) {
  return [LANG_NAMES[g.lang], t(g.cat === 'all' ? 'cat.allLong' : 'cat.' + g.cat),
    `${g.len} ${plural(g.len, 'lt.letters')}`,
    g.tries ? `${g.tries} ${plural(g.tries, 'lt.triesUnit')}` : t('lt.noLimit'),
    t('diff.' + (g.diffRandom ? 'random' : g.diff)),
    g.marks && t('lt.marksShort'),
    ago(g.updated)].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
}

// Each mode has its own list of games in progress, reached from its card on the menu - never one
// mixed list (owner, 2026-09-25). New game on it starts that mode's game.
// A Connect card shows the words found of the board's, the bonus words, and one square per board word:
// green found, dashed finished by hints, empty still to find (design v4).
function connectMeta(g) {
  return [LANG_NAMES[g.lang], `${g.letters} ${plural(g.letters, 'lt.letters')}`, t('diff.' + (g.diffRandom ? 'random' : g.diff)),
    g.marks && t('lt.marksShort'), ago(g.updated)].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
}

// A Tiles card: language, board, the computers' levels and scores with each player's colour.
function tilesMeta(g) {
  const s = g.state, levels = s.players.filter(x => x.cpu).map(x => t(levelKey(x.cpu)));
  return [LANG_NAMES[g.lang], t('tiles.board.' + s.board), g.link ? t('net.tag.' + (g.link.kind ?? 'bt')) : levels.length ? [...new Set(levels)].join(', ') : t('stats.tiles.people'), ago(g.updated)]
    .map(v => `<span>${v}</span>`).join(DOT);
}

export function games(root, mode, refresh) {
  if (!['letters', 'connect', 'tiles'].includes(mode)) mode = 'guess';
  const saves = listSaves().filter(g => g.mode === mode);
  // most likely the game about to be resumed
  if (saves.length) (mode === 'guess' ? preload(saves[0].lang) : loadWords(saves[0].lang).catch(() => {}));
  const actions = g => `<div class="save-actions">
    <a class="btn btn-primary" href="#/game/${g.id}">${UI_ICONS.resume}${t('games.resume')}</a>
    <div class="save-tools">
      <button class="btn btn-ghost btn-danger save-icon" type="button" data-act="delete" aria-label="${t('games.delete')}" title="${t('games.delete')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button>
      <button class="btn btn-ghost save-icon" type="button" data-act="rename" aria-label="${t('games.rename')}" title="${t('games.rename')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/></svg></button>
    </div>
  </div>`;
  const guessCard = g => {
    const best = g.guesses.reduce((b, x) => !b || x.rank < b.rank ? x : b, null);
    return `<article class="card save" data-id="${g.id}">
  <div>
    <h2 class="save-name">${nameHtml(g)}${practiceBadge(g)}</h2>
    <div class="save-meta">${saveMeta(g)}</div>
  </div>
  ${actions(g)}
  <div class="save-best"><span>${g.guesses.length} ${plural(g.guesses.length, 'n.guesses')}</span><div class="bar"><i style="--pct:${best ? best.pct : 0}%;--fill:${fillColor(best ? best.pct : 0)}"></i></div><span>${t('games.best')} ${
    best ? `<b style="color:var(--text)">${esc(best.w)}</b> ${DOT} <b class="num" style="color:var(--text)">${num(best.rank)}</b>` : '—'}</span></div>
</article>`;
  };
  // A Letters card shows tries used and the last guess as bare squares - the colours, never the letters.
  const lettersCard = g => {
    const used = g.guesses.length, last = g.guesses.at(-1);
    return `<article class="card save" data-id="${g.id}">
  <div>
    <h2 class="save-name">${nameHtml(g)}${practiceBadge(g)}</h2>
    <div class="save-meta">${lettersMeta(g)}</div>
  </div>
  ${actions(g)}
  <div class="save-last">${last
    ? `<span><span>${g.tries ? t('games.triesOf', { g: `<b class="num">${used}</b>`, t: g.tries }) : `<b class="num">${used}</b> ${plural(used, 'lt.triesUnit')}`}</span></span>${
      squares(feedback(last, g.secret).map(f => TILE[f]))}`
    : `<span><span>${t('games.notStarted')}</span></span>`}</div>
</article>`;
  };
  const connectCard = g => {
    const vis = visible(g.board, g.found, g.shown);
    const marks = g.board.words.map(x => g.found.includes(x.w) ? 'hit' : isDone(x, g.found, vis) ? 'hintd' : '');
    const done = marks.filter(Boolean).length;
    return `<article class="card save" data-id="${g.id}">
  <div>
    <h2 class="save-name">${nameHtml(g)}${practiceBadge(g)}</h2>
    <div class="save-meta">${connectMeta(g)}</div>
  </div>
  ${actions(g)}
  <div class="save-last">${done || g.bonus.length
    ? `<span><b class="num">${done}</b> / ${g.board.words.length} ${t('cn.wordsLow')}${DOT}<b class="num">${g.bonus.length}</b> ${plural(g.bonus.length, 'cn.bonusLow')}</span>`
    : `<span>${t('cn.noWords')}</span>`}${squares(marks, 14)}</div>
</article>`;
  };
  const tilesCard = g => {
    const s = g.state, np = s.players.length;
    const playerIcon = p => `<svg class="player-icon pc${p}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${s.players[p].cpu
      ? '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5m-5 0h10"/>'
      : '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'}</svg>`;
    const vs = np === 2
      ? `<span class="vs">${playerIcon(0)}${esc(nameOf(s, 0))} <b class="num">${s.scores[0]}</b> : <b class="num">${s.scores[1]}</b> ${esc(nameOf(s, 1))}${playerIcon(1)}</span>`
      : `<span class="vs">${s.players.map((_, p) => `${playerIcon(p)}${esc(nameOf(s, p))} <b class="num">${s.scores[p]}</b>`).join(' ')}</span>`;
    return `<article class="card save" data-id="${g.id}">
  <div>
    <h2 class="save-name">${nameHtml(g)}${practiceBadge(g)}</h2>
    <div class="save-meta">${tilesMeta(g)}</div>
  </div>
  ${actions(g)}
  <div class="save-last">${vs}</div>
</article>`;
  };
  const card = { guess: guessCard, letters: lettersCard, connect: connectCard, tiles: tilesCard }[mode];
  // Tiles online (several phones): hosting and joining both start here - only where there is Bluetooth or Wi-Fi to do it
  const join = mode === 'tiles' && netKinds().length ? `<a class="btn btn-outline" href="#/online">${t('net.online')}</a>` : '';
  const start = () => `<a class="btn btn-primary" href="${NEW_OF[mode]}">${t('games.new')} <span class="arrow">→</span></a>`;
  root.innerHTML = `<div class="app" data-screen="games">
  ${topbar({ left: `<a class="btn btn-ghost" href="#/">${t('back.menu')}</a>`, right: modeTag(mode) })}
  <main class="main">
    <div class="head"><h1 class="title">${t('games.title')}</h1></div>
    <div class="games-scroll">${saves.length ? `<div class="saves">${saves.map(card).join('')}</div>` : `<div class="card empty">
      <img class="empty-art" src="img/empty.webp" alt=""><p class="display">${t('games.emptyTitle')}</p>
      <p class="help" style="max-width:36ch">${t('games.emptyText')}</p>
    </div>`}</div>
    <div class="games-actions">${join}${start()}</div>
  </main>
</div>`;
  root.querySelectorAll('.save').forEach(el => {
    const id = el.dataset.id;
    confirmClick(el.querySelector('[data-act=delete]'), () => { deleteSave(id); refresh(); }, () => fitAll(el), true);
    el.querySelector('[data-act=rename]').addEventListener('click', () => rename(el, getSave(id), refresh));
  });
}

// a card's title: the name, and the number beside it in a quieter colour
const nameHtml = g => g.name ? `${esc(g.name)} <span class="save-no">(${t('games.defaultName', { n: g.auto ?? 1 })})</span>` : esc(gameName(g));
// New game: an optional name (owner, 2026-09-26), just above Start - every mode
const nameField = () => `<div class="field">
        <span class="eyebrow">${t('games.nameLabel')}</span>
        <input class="input" type="text" id="game-name" maxlength="30" autocomplete="off" placeholder="${esc(t('games.defaultName', { n: stats.gameNo + 1 }))}" aria-label="${t('games.nameLabel')}">
      </div>`;
const typedName = () => document.querySelector('#game-name')?.value.trim() ?? '';

function rename(el, game, refresh) {
  const title = el.querySelector('.save-name');
  if (title.querySelector('input')) return;
  title.innerHTML = `<input class="input" type="text" maxlength="30" aria-label="${t('games.nameLabel')}">`;
  const input = title.firstChild;
  input.value = game.name;
  input.placeholder = t('games.defaultName', { n: game.auto ?? 1 });
  input.focus();
  input.select();
  let done = false;
  const finish = keep => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (keep && name !== game.name) { game.name = name; putSave(game); }   // empty: back to its number alone
    refresh();
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') { finish(false); e.stopPropagation(); }   // Esc cancels the rename, not the screen
  });
  input.addEventListener('blur', () => finish(true));
}

// Every game's help opens the same chapter reader; Tiles keeps its illustrated topics.
const howTo = mode => `<button type="button" class="card howto" data-howto="${mode}"><span class="eyebrow">${UI_ICONS.howTo}${t('howto.title')}</span><span class="arrow" aria-hidden="true">›</span></button>`;
document.addEventListener('click', e => {
  const mode = e.target.closest?.('[data-howto]')?.dataset.howto;
  if (mode) openRules(mode, mode === 'tiles' ? topics() : null);
});

// Every game starts from the same footing - the settings of the last one are rarely what you want for
// the next. The language is the exception: that is a preference, not a per-game choice.
// "Remember my New game choices" (Settings, owner 2026-09-26): each New game screen starts from the choices of the last
// game of its kind, saved as it starts - never its name, never a friend's word; off, from the defaults.
const remembered = mode => settings.rememberSetup ? settings.setup?.[mode] ?? {} : {};
const remember = (mode, choices) => { if (settings.rememberSetup) settings.setup = { ...settings.setup, [mode]: choices }; };

const NEW_GAME = { cat: 'all', band: 'any', diff: 'normal', friend: false, onlyNew: false };
let pending = null;   // choices half-made, kept only across the re-render that a language switch causes

export function newGameScreen(root, _, refresh) {
  const o = pending ?? { ...NEW_GAME, ...remembered('guess'), lang: settings.newGame.lang || settings.lang };
  pending = null;
  root.innerHTML = `<div class="app" data-screen="new">
  ${topbar({ left: `<a class="btn btn-ghost" href="${LIST_OF.guess}">${t('back.games')}</a>`, right: modeTag('guess') })}
  <main class="main">
    <h1 class="title">${t('new.title')}</h1>
    ${howTo('guess')}
    <form class="form" novalidate>
      <div class="field">
        <span class="eyebrow">${t('new.lang')}</span>
        <div class="seg" role="radiogroup">${['pl', 'en'].map(l => `<button type="button" data-k="lang" data-v="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>
      </div>
      <div class="field">
        <div class="field-head"><span class="eyebrow">${t('new.cat')}</span></div>
        <div class="chips">${CATS.map(c => `<button type="button" class="chip" data-k="cat" data-v="${c}">${t('cat.' + c)}</button>`).join('')}</div>
        <p class="help cat-about" id="cat-about"></p>
      </div>
      <div class="field" style="gap:var(--space-4)">
        <span class="eyebrow">${t('new.len')}</span>
        <div class="seg" role="radiogroup" aria-label="${t('new.lenAria')}">${BANDS.map(b => `<button type="button" data-k="band" data-v="${b}">${t('band.' + b)}</button>`).join('')}</div>
        <div class="hist" aria-hidden="true" id="hist"></div>
        <div class="readout" id="readout"></div>
      </div>
      <div class="field">
        <span class="eyebrow">${t('new.diff')}</span>
        <div class="seg" role="radiogroup">${DIFFS.map(d => `<button type="button" data-k="diff" data-v="${d}">${t('diff.' + d)}</button>`).join('')}</div>
        <p class="help"><span class="arrow">→</span> ${t('new.diffHelp')}</p>
      </div>
      <div class="card friend">
        <div class="row">
          <div class="row-text"><strong>${UI_ICONS.friend}${t('new.friend')}</strong><span>${t('new.friendDesc')}</span></div>
          <button type="button" class="toggle" role="switch" aria-label="${t('new.friend')}"></button>
        </div>
        <p class="help" id="practice-setup" hidden>${t('help.setupPractice')}</p>
        <div class="field" id="secret-field">
          <div class="field-head"><span class="eyebrow">${t('new.secret')}</span><span class="help">${t('new.secretHint')}</span></div>
          <input class="input" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="${t('new.secretAria')}">
          <p class="help"><span class="arrow">→</span> <span id="forms-help"></span></p>
        </div>
      </div>
      ${onlyNewCard()}
      ${nameField()}
      <div class="cta">
        <p class="summary"></p>
        <p class="help err" id="new-err" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${t('new.start')} <span class="arrow">→</span></button>
      </div>
    </form>
  </main>
</div>`;
  const $ = sel => root.querySelector(sel);
  const err = $('#new-err'), toggle = $('.toggle'), secret = $('input[type=password]');
  const sync = () => {
    root.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', String(o[b.dataset.k]) === b.dataset.v));
    lengths();
    toggle.classList.toggle('on', o.friend);
    toggle.setAttribute('aria-checked', o.friend);
    $('#practice-setup').hidden = !o.friend;
    $('#secret-field').hidden = !o.friend;
    $('#only-new').hidden = o.friend;
    paintOnlyNew(root, o);
    $('#forms-help').innerHTML = t('new.formsHelp', { forms: o.lang === 'pl' ? '<em>żyrafie</em>, <em>żyrafy</em>' : '<em>giraffes</em>, <em>mice</em>' });
    // what the chosen category actually covers, so you are not hunting for a word it never hides
    $('#cat-about').textContent = t('about.' + o.cat);
    $('.summary').innerHTML = [LANG_NAMES[o.lang], t('cat.' + o.cat), t('band.' + o.band), t('diff.' + o.diff), o.friend && t('new.friendShort')]
      .filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
    err.hidden = true;
  };

  // The histogram is this language and category's real word lengths, so it can only be drawn once the
  // word data is here (~1.3 s for Polish). Until then the bars stay flat rather than showing a guess.
  let token = 0;
  async function lengths(stats) {
    if (!stats) {
      const mine = ++token;
      const m = await load(o.lang).catch(() => null);
      if (!m || mine !== token) return;          // a newer click already asked for other numbers
      return lengths(lengthStats(m, o));
    }
    const tallest = Math.max(...stats.bars.map(b => b.count), 1);
    $('#hist').innerHTML = stats.bars.map(b =>
      `<span class="${b.on ? 'on' : ''}"><b style="height:${Math.round(b.count / tallest * 52) + (b.count ? 4 : 2)}px"></b><em>${b.len}${b.last ? '+' : ''}</em></span>`).join('');
    $('#readout').innerHTML = stats.count
      ? `<span class="num">${stats.from === stats.to ? stats.from : `${stats.from}–${stats.to}`}</span><span class="help">${
        t('new.lenCount', { n: num(stats.count), words: plural(stats.count, 'n.words') })}</span>`
      : `<span class="num">0</span><span class="help">${t('new.lenEmpty')}</span>`;
    fitAll(root);
  }
  $('#hist').innerHTML = Array.from({ length: 10 }, () => '<span><b style="height:2px"></b><em>&nbsp;</em></span>').join('');
  sync();
  root.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    o[b.dataset.k] = b.dataset.v;
    if (b.dataset.k === 'lang') {          // the interface follows, unless the player has chosen one
      settings.newGame = { lang: o.lang };
      saveSettings();
      pending = o;                         // this re-render is ours: keep what is already filled in
      if (switchLang(b.dataset.v, refresh, false)) return;
      pending = null;                      // …no re-render happened after all
    }
    sync();
  }));
  toggle.addEventListener('click', () => { o.friend = !o.friend; sync(); if (o.friend) secret.focus(); });
  $('#only-new .toggle').addEventListener('click', () => { o.onlyNew = !o.onlyNew; sync(); });
  secret.addEventListener('input', () => { err.hidden = true; });

  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const m = await load(o.lang);
    const idx = o.friend ? resolve(m, secret.value)?.idx ?? -1 : o.onlyNew ? freshPick(m, secretPool(m, o), 'guess', o.lang) : pickSecret(m, o);
    if (idx < 0) {
      err.textContent = t(o.friend ? 'new.errUnknown' : idx === -2 ? 'new.errAllFound' : 'new.errNoWords');
      err.hidden = false;
      return;
    }
    settings.newGame = { lang: o.lang };   // the next game starts from NEW_GAME again - or from these, remembered
    remember('guess', { cat: o.cat, band: o.band, diff: o.diff, friend: o.friend, onlyNew: o.onlyNew });
    saveSettings();
    const game = newGame({ ...o, secret: m.words[idx], name: typedName() });
    location.replace('#/game/' + game.id);   // Back from the game goes to the picker, not to this form
  });
}

// ── Letters: new game (design: handoff-letters/new-game-letters.html) ─────────────────────────────
// Same footing rule as above: every game starts from these; the language and "Allow Polish letters" carry over.
const LT_NEW = { cat: 'all', len: 5, anyLen: false, tries: 6, unlimited: false, diff: 'normal', onlyNew: false };
let ltPending = null;

export function lettersNewScreen(root, _, refresh) {
  const o = ltPending ?? { ...LT_NEW, ...remembered('letters'), lang: settings.newGame.lang || settings.lang, marks: settings.polish?.letters ?? true };
  ltPending = null;
  const lengths = Array.from({ length: LEN_MAX - LEN_MIN + 1 }, (_, i) => LEN_MIN + i);
  const stepper = (id, less, more) => `<div class="stepper" id="${id}"><button type="button" data-step="-1" aria-label="${less}">−</button><output></output><button type="button" data-step="1" aria-label="${more}">+</button></div>`;
  root.innerHTML = `<div class="app" data-screen="new">
  ${topbar({ left: `<a class="btn btn-ghost" href="${LIST_OF.letters}">${t('back.games')}</a>`, right: modeTag('letters') })}
  <main class="main">
    <h1 class="title">${t('new.title')}</h1>
    ${howTo('letters')}
    <form class="form" novalidate>
      <div class="field">
        <span class="eyebrow">${t('new.lang')}</span>
        <div class="seg" role="radiogroup">${['pl', 'en'].map(l => `<button type="button" data-k="lang" data-v="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>
      </div>
      <div class="field">
        <div class="field-head"><span class="eyebrow">${t('new.cat')}</span></div>
        <div class="chips">${CATS.map(c => `<button type="button" class="chip" data-k="cat" data-v="${c}">${t('cat.' + c)}</button>`).join('')}</div>
        <p class="help cat-about" id="cat-about"></p>
      </div>
      <div class="field" style="gap:var(--space-4)">
        <span class="eyebrow">${t('lt.len')}</span>
        <div class="tries">
          ${stepper('len', t('lt.shorter'), t('lt.longer'))}
          <button type="button" class="chip" role="switch" id="any-len"><span class="num">?</span>${t('lt.anyLen')}</button>
        </div>
        <div class="hist" role="group" aria-label="${t('lt.len')}" id="hist">${lengths.map(len =>
    `<button type="button" data-len="${len}" aria-label="${len}"><b style="height:3px"></b><em>${len}</em></button>`).join('')}</div>
        <div class="readout" id="readout"></div>
      </div>
      <div class="field">
        <p class="help" id="practice-setup" hidden>${t('help.setupPractice')}</p><div class="field-head"><span class="eyebrow">${t('lt.tries')}</span><span class="help">${t('lt.triesHint')}</span></div>
        <div class="tries">
          ${stepper('tries', t('lt.fewer'), t('lt.more'))}
          <button type="button" class="chip" role="switch" id="unlimited"><span class="num">∞</span>${t('lt.unlimited')}</button>
        </div>
      </div>
      <div class="field">
        <span class="eyebrow">${t('new.diff')}</span>
        <div class="tries">
          <div class="seg" role="radiogroup" id="diff">${DIFFS.map(d => `<button type="button" data-k="diff" data-v="${d}">${t('diff.' + d)}</button>`).join('')}</div>
        </div>
        <p class="help"><span class="arrow">→</span> ${t('lt.diffHelp')}</p>
      </div>
      <div class="card polish" id="polish">
        <div class="row">
          <div class="row-text"><strong>${t('lt.polish')}</strong><span class="marks">ą ć ę ł ń ó ś ź ż</span></div>
          <button type="button" class="toggle" role="switch" aria-label="${t('lt.polish')}"></button>
        </div>
        <p class="help"><span class="arrow">→</span> <span id="polish-help"></span></p>
      </div>
      ${onlyNewCard()}
      ${nameField()}
      <div class="cta">
        <p class="summary"></p>
        <p class="help err" id="new-err" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${t('new.start')} <span class="arrow">→</span></button>
      </div>
    </form>
  </main>
</div>`;
  const $ = sel => root.querySelector(sel);
  const form = $('form'), err = $('#new-err'), start = $('[type=submit]'), toggle = $('#polish .toggle'), unlimited = $('#unlimited'), anyLen = $('#any-len');
  // Polish letters are a Polish-only choice; an English word never has them to begin with
  const marks = () => o.lang === 'pl' && o.marks;
  const choice = () => ({ cat: o.cat, diff: o.diff, marks: o.lang !== 'pl' || o.marks });

  const sync = () => {
    root.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', String(o[b.dataset.k]) === b.dataset.v));
    // a category means a noun (except Verbs) - said here rather than discovered in the game
    $('#cat-about').textContent = t('about.' + o.cat) + (o.cat === 'all' || o.cat === 'verbs' ? '' : ' ' + t('lt.catNouns'));
    paintOnlyNew(root, o);
    const [shorter, longer] = $('#len').querySelectorAll('button');
    // "any" = the game picks: a random word of any length, so lengths come up as often as words of them do
    $('#len').classList.toggle('off', o.anyLen);
    $('#len output').innerHTML = o.anyLen ? `<span class="num">${LEN_MIN}–${LEN_MAX}</span><span class="help">${plural(LEN_MAX, 'lt.letters')}</span>`
      : `<span class="num">${o.len}</span><span class="help">${plural(o.len, 'lt.letters')}</span>`;
    shorter.disabled = o.anyLen || o.len <= LEN_MIN;
    longer.disabled = o.anyLen || o.len >= LEN_MAX;
    anyLen.classList.toggle('on', o.anyLen);
    anyLen.setAttribute('aria-checked', o.anyLen);
    $('#practice-setup').hidden = !o.unlimited;
    const [fewer, more] = $('#tries').querySelectorAll('button');
    $('#tries output').innerHTML = o.unlimited ? '<span class="num">∞</span><span class="help"></span>'
      : `<span class="num">${o.tries}</span><span class="help">${plural(o.tries, 'lt.triesUnit')}</span>`;
    fewer.disabled = !o.unlimited && o.tries <= 1;
    more.disabled = o.unlimited;
    unlimited.classList.toggle('on', o.unlimited);
    unlimited.setAttribute('aria-checked', o.unlimited);
    $('#polish').hidden = o.lang !== 'pl';
    toggle.classList.toggle('on', o.marks);
    toggle.setAttribute('aria-checked', o.marks);
    $('#polish-help').innerHTML = t(o.marks ? 'lt.polishOn' : 'lt.polishOff');
    $('.summary').innerHTML = [LANG_NAMES[o.lang], t('cat.' + o.cat), o.anyLen ? t('lt.anyLenLong') : `${o.len} ${plural(o.len, 'lt.letters')}`,
      o.unlimited ? `∞ ${plural(0, 'lt.triesUnit')}` : `${o.tries} ${plural(o.tries, 'lt.triesUnit')}`,
      t('diff.' + o.diff), marks() && t('lt.marksShort')].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
    counts();
    fitAll(root);
  };

  // The bars are how many words each length can hide with the other choices as they are, so they need
  // the word data (~9 MB for Polish). Until it is here they stay flat, and the readout empty.
  const ready = {};
  function counts() {
    const m = ready[o.lang];
    const bars = [...$('#hist').children];
    if (!m) {
      bars.forEach(bar => { bar.className = o.anyLen || +bar.dataset.len === o.len ? 'on' : ''; });
      $('#readout').innerHTML = '';
      loadWords(o.lang).then(data => { ready[o.lang] = data; if (form.isConnected) counts(); }).catch(() => {});
      return;
    }
    const n = new Map(lengths.map(len => [len, pool(m, { len, ...choice() }).length]));
    const tallest = Math.max(...n.values(), 1);
    bars.forEach(bar => {
      const len = +bar.dataset.len, c = n.get(len);
      bar.className = [(o.anyLen || len === o.len) && 'on', !c && 'none'].filter(Boolean).join(' ');
      bar.firstElementChild.style.height = (c ? Math.round(c / tallest * 52) + 4 : 3) + 'px';
    });
    const here = o.anyLen ? pool(m, choice()).length : n.get(o.len);
    $('#readout').className = 'readout' + (here ? '' : ' none');
    $('#readout').innerHTML = `<span class="num">${num(here)}</span><span class="help">${t(here ? 'lt.canHide' : 'lt.none')}</span>`;
    err.textContent = t('lt.errNoWords');
    err.hidden = !!here;
    start.disabled = !here;
  }

  sync();
  root.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    o[b.dataset.k] = b.dataset.v;
    if (b.dataset.k === 'lang') {          // the interface follows, unless the player has chosen one
      settings.newGame = { lang: o.lang };
      saveSettings();
      ltPending = o;                       // this re-render is ours: keep what is already filled in
      if (switchLang(b.dataset.v, refresh, false)) return;
      ltPending = null;                    // …no re-render happened after all
    }
    sync();
  }));
  $('#len').addEventListener('click', e => {
    const step = +e.target.closest('[data-step]')?.dataset.step;
    if (step) { o.len = Math.min(LEN_MAX, Math.max(LEN_MIN, o.len + step)); sync(); }
  });
  $('#hist').addEventListener('click', e => {
    const bar = e.target.closest('[data-len]');
    if (bar) { o.len = +bar.dataset.len; o.anyLen = false; sync(); }
  });
  $('#tries').addEventListener('click', e => {
    const step = +e.target.closest('[data-step]')?.dataset.step;
    if (!step) return;
    // ∞ is the step after the most tries (owner, 2026-09-25): + at 20 turns Unlimited on, − from it gives 20
    if (o.unlimited) { if (step < 0) { o.unlimited = false; o.tries = TRIES_MAX; } }
    else if (step > 0 && o.tries >= TRIES_MAX) o.unlimited = true;
    else o.tries = Math.min(TRIES_MAX, Math.max(1, o.tries + step));
    sync();
  });
  unlimited.addEventListener('click', () => { o.unlimited = !o.unlimited; sync(); });
  anyLen.addEventListener('click', () => { o.anyLen = !o.anyLen; sync(); });
  $('#only-new .toggle').addEventListener('click', () => { o.onlyNew = !o.onlyNew; sync(); });
  toggle.addEventListener('click', () => { o.marks = !o.marks; settings.polish = { ...settings.polish, letters: o.marks }; saveSettings(); sync(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const m = await loadWords(o.lang);
    const opts = { len: o.anyLen ? null : o.len, ...choice() };
    const idx = o.onlyNew ? freshPick(m, pool(m, opts), 'letters', o.lang) : pick(m, opts);
    if (idx < 0) { err.textContent = t(idx === -2 ? 'new.errAllFound' : 'lt.errNoWords'); err.hidden = false; return; }
    settings.newGame = { lang: o.lang };
    saveSettings();
    remember('letters', Object.fromEntries(Object.keys(LT_NEW).map(k => [k, o[k]])));
    saveSettings();
    const game = newGame({ name: typedName(), mode: 'letters', lang: o.lang, cat: o.cat, len: [...m.words[idx]].length, tries: o.unlimited ? 0 : o.tries,
      diff: o.diff, marks: marks(), secret: m.words[idx] });
    location.replace('#/game/' + game.id);   // Back from the game goes to the picker, not to this form
  });
}

// ── Connect: new game (design v4, "Lexling Connect" 2) ─────────────────────────────────────────────
// The Letters controls, rebuilt: letters in the circle, the level, the Polish-letters card. (No "Random" level since
// 0.37.0, here and in Letters - owner.)
const CN_NEW = { letters: 6, diff: 'normal', two: false };
let cnPending = null;

export function connectNewScreen(root, _, refresh) {
  const o = cnPending ?? { ...CN_NEW, ...remembered('connect'), lang: settings.newGame.lang || settings.lang, marks: settings.polish?.connect ?? true };
  cnPending = null;
  root.innerHTML = `<div class="app" data-screen="new">
  ${topbar({ left: `<a class="btn btn-ghost" href="${LIST_OF.connect}">${t('back.games')}</a>`, right: modeTag('connect') })}
  <main class="main">
    <h1 class="title">${t('new.title')}</h1>
    ${howTo('connect')}
    <form class="form" novalidate>
      <div class="field">
        <span class="eyebrow">${t('new.lang')}</span>
        <div class="seg" role="radiogroup">${['pl', 'en'].map(l => `<button type="button" data-k="lang" data-v="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>
      </div>
      <div class="field" style="gap:var(--space-4)">
        <span class="eyebrow">${t('cn.count')}</span>
        <div class="stepper" id="letters"><button type="button" data-step="-1" aria-label="−">−</button><output></output><button type="button" data-step="1" aria-label="+">+</button></div>
        <div class="readout" id="range"></div>
      </div>
      <div class="field">
        <div class="field-head"><span class="eyebrow">${t('cn.level')}</span><span class="help">${t('cn.levelWhat')}</span></div>
        <div class="tries">
          <div class="seg" role="radiogroup" id="diff">${DIFFS.map(d => `<button type="button" data-k="diff" data-v="${d}">${t('diff.' + d)}</button>`).join('')}</div>
        </div>
        <p class="help"><span class="arrow">→</span> <span id="level-help"></span></p>
      </div>
      <div class="card polish" id="two">
        <div class="row">
          <div class="row-text"><strong>${t('cn.two')}</strong></div>
          <button type="button" class="toggle" role="switch" aria-label="${t('cn.two')}"></button>
        </div>
        <p class="help"><span class="arrow">→</span> <span id="two-help"></span></p>
      </div>
      <div class="card polish" id="polish">
        <div class="row">
          <div class="row-text"><strong>${t('cn.polish')}</strong><span class="marks">ą ć ę ł ń ó ś ź ż</span></div>
          <button type="button" class="toggle" role="switch" aria-label="${t('cn.polish')}"></button>
        </div>
        <p class="help"><span class="arrow">→</span> <span id="polish-help"></span></p>
      </div>
      ${nameField()}
      <div class="cta">
        <p class="summary"></p>
        <p class="help err" id="new-err" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${t('new.start')} <span class="arrow">→</span></button>
      </div>
    </form>
  </main>
</div>`;
  const $ = sel => root.querySelector(sel);
  const form = $('form'), err = $('#new-err'), toggle = $('#polish .toggle');
  const marks = () => o.lang === 'pl' && o.marks;
  const sync = () => {
    root.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', String(o[b.dataset.k]) === b.dataset.v));
    const [fewer, more] = $('#letters').querySelectorAll('button');
    $('#letters output').innerHTML = `<span class="num">${o.letters}</span><span class="help">${plural(o.letters, 'lt.letters')}</span>`;
    fewer.disabled = o.letters <= RING_MIN;
    more.disabled = o.letters >= RING_MAX;
    // how many words a circle of this size usually gives
    $('#range').innerHTML = `<span class="num">${RANGE[o.letters].join('–')}</span><span class="help">${t('cn.readout')}</span>`;
    $('#level-help').textContent = t('cn.lv.' + o.diff);
    $('#polish').hidden = o.lang !== 'pl';
    toggle.classList.toggle('on', o.marks);
    toggle.setAttribute('aria-checked', o.marks);
    $('#polish-help').textContent = t(o.marks ? 'cn.polishOn' : 'cn.polishOff');
    $('#two .toggle').classList.toggle('on', !!o.two);
    $('#two .toggle').setAttribute('aria-checked', !!o.two);
    $('#two-help').textContent = t(o.two ? 'cn.twoOn' : 'cn.twoOff');
    $('.summary').innerHTML = [LANG_NAMES[o.lang], `${o.letters} ${plural(o.letters, 'lt.letters')}`,
      t('diff.' + o.diff), marks() && t('lt.marksShort'), o.two && t('cn.twoShort')].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
    err.hidden = true;
    fitAll(root);
  };
  sync();
  loadWords(o.lang).catch(() => {});      // the word data, ready by the time Start is pressed
  root.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    o[b.dataset.k] = b.dataset.v;
    if (b.dataset.k === 'lang') {
      settings.newGame = { lang: o.lang };
      saveSettings();
      cnPending = o;
      if (switchLang(b.dataset.v, refresh, false)) return;
      cnPending = null;
      loadWords(o.lang).catch(() => {});
    }
    sync();
  }));
  $('#letters').addEventListener('click', e => {
    const step = +e.target.closest('[data-step]')?.dataset.step;
    if (step) { o.letters = Math.min(RING_MAX, Math.max(RING_MIN, o.letters + step)); sync(); }
  });
  toggle.addEventListener('click', () => { o.marks = !o.marks; settings.polish = { ...settings.polish, connect: o.marks }; saveSettings(); sync(); });
  $('#two .toggle').addEventListener('click', () => { o.two = !o.two; sync(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const m = await loadWords(o.lang);
    const diff = o.diff;
    const puzzle = makePuzzle(m, { letters: o.letters, diff, marks: o.lang !== 'pl' || o.marks, two: !!o.two });
    if (!puzzle) { err.textContent = t('cn.errNone'); err.hidden = false; return; }
    settings.newGame = { lang: o.lang };
    saveSettings();
    remember('connect', Object.fromEntries(Object.keys(CN_NEW).map(k => [k, o[k]])));
    saveSettings();
    const game = newGame({ name: typedName(), mode: 'connect', lang: o.lang, letters: o.letters, diff, marks: marks(),
      ring: puzzle.ring, key: puzzle.key, board: puzzle.board, found: [], shown: [], bonus: [], hints: 0, two: !!o.two });
    location.replace('#/game/' + game.id);   // Back from the game goes to the list, not to this form
  });
}

// ── Tiles: New game (design v5, and the owner's additions) ── the language, the board (a tiny map of its bonus
// squares), 2-5 players - each a person or a computer with its level - who starts, and the rules, folded away.
// The list is the order of play (↑ ↓ move a player); `first` = the player who starts, or null: drawn at random
// (owner, 2026-09-25: "choose which player starts first, in which order they move, or random").
const TL_NEW = () => ({ board: 'classic', players: [{ name: '', cpu: null }, { name: '', cpu: 'medium' }], first: null, rules: { ...STANDARD }, rulesOpen: false });
const TL_TIMES = { move: [30, 60, 120, 180], game: [600, 1200, 1500, 1800] };   // seconds: per move, per game
const TL_RULES = [['dictionary', ['full', 'familiar']], ['premiums', ['once', 'always']], ['check', ['auto', 'challenge']], ['exchange', ['bag7', 'always']], ['bingo', [50, 0]],
  ['open', [false, true]]];
// Assists, a section of their own (owner, 2026-10-12: the settings behind the "this game leaves the records" warning were
// "hidden in the rules ... the user might not know where they are"): hints, undo, move ratings
const TL_ASSISTS = [['undo', [false, true]], ['veto', [false, true]], ['wordsVote', [false, true]], ['rating', [true, 'score', false]]];
const ASSIST_KEYS = ['hints', 'hintMax', 'hintCost', 'undo', 'rating', 'veto', 'vetoNeed', 'wordsVote', 'approvalNeed'];
// hints: how many of each level a player may take (null = no limit, 0 = that level off)
const TL_HINT_MAX = [0, 1, 3, 5, 10, null];
let tlPending = null;

const boardCard = b => {
  const rows = BOARDS[b], n = rows.length, mid = (n - 1) / 2;
  let cells = '';
  rows.forEach((row, r) => [...row].forEach((k, c) => {
    const cls = r === mid && c === mid ? 'st' : LABEL[k];
    if (cls) cells += `<i class="${cls}" style="grid-row:${r + 1};grid-column:${c + 1}"></i>`;
  }));
  return `<button type="button" class="tl-bcard" data-board="${b}" role="radio"><span class="tl-mini" style="--n:${n};--m:${Math.round(75 / n)}px" aria-hidden="true">${cells}</span><span><strong>${t('tiles.board.' + b)}</strong><span class="help">${
    t(`tiles.board.${b}.what`)}</span><span class="meta"></span></span></button>`;
};

// Hosting an online game (owner, 2026-09-27: "an info for the host ... how all the settings apply to all people"): what
// the host decides and can do
const hostInfo = () => `<div class="card tl-hostinfo"><p>${t('net.hostInfo.short')}</p><details><summary>${t('net.hostInfo.title')}</summary><ul>${
  ['rules', 'letIn', 'players', 'keep'].map(k => `<li>${t('net.hostInfo.' + k)}</li>`).join('')}</ul></details></div>`;

export function tilesNewScreen(root, _, refresh, hostKind = null) {
  if (hostKind && !netKinds().includes(hostKind)) return tilesOnlineScreen(root);
  const o = tlPending ?? (() => {
    const r = remembered('tiles'), fresh = { ...TL_NEW(), lang: settings.newGame.lang || settings.lang };
    if (!r.board) return fresh;
    const players = r.players.map(x => ({ ...x }));
    return { ...fresh, board: r.board, players, first: players[r.first] ?? null, rules: { ...STANDARD, ...r.rules } };
  })();
  tlPending = null;
  let approvalManual = o.approvalNeedManual ?? Number.isFinite(o.rules.approvalNeed);
  let vetoManual = o.vetoNeedManual ?? Number.isFinite(o.rules.vetoNeed);
  // hosting an online game (Play online → the connection → Host): people only, the first of them on this phone; undo
  // and the others' tiles off, no hints, ratings without the best move - all but undo can be changed below (owner)
  if (hostKind && o.net !== hostKind) {
    o.net = hostKind;
    o.players = o.players.map((x, p) => ({ name: p === 0 ? (x.cpu ? '' : x.name.trim()) || (settings.myName ?? '') : '', cpu: null, here: p === 0 }));
    if (!o.players.includes(o.first)) o.first = null;
    o.rules = { ...o.rules, hints: false, undo: false, open: false, rating: o.rules.rating === false ? false : 'score' };
  }
  root.innerHTML = `<div class="app" data-screen="new">
  ${topbar({ left: `<a class="btn btn-ghost" href="${hostKind ? '#/online' : LIST_OF.tiles}">${t('back.games')}</a>`, right: modeTag('tiles') })}
  <main class="main">
    <h1 class="title">${t(hostKind ? 'net.newTitle' : 'new.title')}</h1>
    ${hostKind ? `<p class="help tl-online-kind"><span class="eyebrow">${t('net.step.kind')}</span> ${t('net.kind.' + hostKind)}</p>${hostInfo()}` : ''}
    ${howTo('tiles')}
    <form class="form" novalidate>
      <div class="field">
        <span class="eyebrow">${t('new.lang')}</span>
        <div class="seg" role="radiogroup">${['pl', 'en'].map(l => `<button type="button" data-lang="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>
      </div>
      <div class="field">
        <span class="eyebrow">${t('tiles.new.board')}</span>
        <div class="tl-boards" role="radiogroup">${Object.keys(BOARDS).map(boardCard).join('')}</div>
      </div>
      <div class="field">
        <div class="field-head"><span class="eyebrow">${t('tiles.new.players')}</span><span class="help">${t(hostKind ? 'net.playersOnline' : 'tiles.new.playersWhat')}</span></div>
        <div class="tl-players"></div>
      </div>
      <details class="card polish" id="colours"><summary>${UI_ICONS.display}${t('howto.tiles.looks')}</summary>
        <div class="row"><div class="row-text"><strong>${t('tiles.tile')}</strong></div></div>
        <div id="tile-looks">${tileSeg()}</div>
        <p class="help"><span class="arrow">→</span> ${t('tiles.tileHelp')}</p>
        <div class="row"><div class="row-text"><strong>${t('tiles.bonus')}</strong></div></div>
        <div id="bonus">${bonusSeg()}</div>
        <p class="help"><span class="arrow">→</span> ${t('tiles.bonusHelp')}</p>
        <div class="row"><div class="row-text"><strong>${t('tiles.boardStyle')}</strong></div></div>
        <div id="board-style">${boardStyleSeg()}</div>
        <p class="help"><span class="arrow">→</span> ${t('tiles.boardStyleHelp')}</p>
        <div class="row"><div class="row-text"><strong>${t('tiles.cb')}</strong><span>${t('tiles.cbHelp')}</span></div>
          <button type="button" id="tiles-cb" class="toggle" role="switch" aria-label="${t('tiles.cb')}"></button></div>
      </details>
      <details class="card tl-assists"${o.assistsOpen ? ' open' : ''}>
        <summary><span class="eyebrow">${UI_ICONS.assists}${t('tiles.assists')} <span class="state"></span></span></summary>
        <p class="help">${t('tiles.assists.help')}</p>
        <div class="tl-hints" id="hints"></div>
        <div class="assists-body"></div>
      </details>
      <details class="card tl-rules"${o.rulesOpen ? ' open' : ''}>
        <summary><span class="eyebrow">${UI_ICONS.rules}${t('tiles.rules')} <span class="muted"></span></span></summary>
        <div class="rules-body"></div>
      </details>
      ${nameField()}
      <div class="cta">
        <p class="help-warn" role="status" hidden><span></span> <button type="button" class="btn-link" data-assists>${t('help.change')}</button></p>
        <p class="summary"></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit"></button>
      </div>
    </form>
  </main>
</div>`;
  const $ = sel => root.querySelector(sel);
  const list = () => ({ players: o.players.map(x => ({ name: '', cpu: x.cpu })) });   // for the default names
  const nameAt = p => o.players[p].name.trim() || nameOf(list(), p);
  const standard = () => Object.keys(STANDARD).every(k => ASSIST_KEYS.includes(k) || JSON.stringify(o.rules[k]) === JSON.stringify(STANDARD[k]));
  // one person against the computer: only then undo (owner, 2026-09-25)
  const alone = () => o.players.filter(x => !x.cpu).length === 1 && o.players.some(x => x.cpu);
  const canVeto = () => !!o.net || o.players.filter(x => !x.cpu).length > 1;
  const helps = () => setupPractice({ mode: 'tiles', rules: { ...o.rules, undo: alone() && o.rules.undo,
    open: !o.net && o.players.filter(x => !x.cpu).length > 1 && o.rules.open } }) ? [t('practice')] : [];

  function paintPlayers() {
    const last = o.players.length - 1, first = o.players.indexOf(o.first);
    $('.tl-players').innerHTML = o.players.map((x, p) => `<div class="tl-prow pc${p}">
        <div class="top"><i class="tl-player-icon" aria-hidden="true">${playerIcon(o, p)}</i>${o.net && !x.here ? `<strong>${esc(nameOf(list(), p))}</strong>` : `<input class="input" type="text" maxlength="16" data-name="${p}" value="${esc(x.name)}" placeholder="${esc(nameOf(list(), p))}" aria-label="${t('tiles.nameAria', { n: p + 1 })}">`}<span class="acts">
          <button type="button" class="btn btn-ghost mv" data-up="${p}" aria-label="${esc(t('tiles.up', { name: nameAt(p) }))}"${p === 0 ? ' disabled' : ''}>↑</button><button type="button" class="btn btn-ghost mv" data-down="${p}" aria-label="${esc(t('tiles.down', { name: nameAt(p) }))}"${p === last ? ' disabled' : ''}>↓</button>${
      o.players.length > 2 && !(o.net && x.here) ? `<button type="button" class="btn btn-ghost rm" data-rm="${p}" aria-label="${esc(t('tiles.remove', { name: nameAt(p) }))}">✕</button>` : ''}</span></div>
        ${o.net ? `<p class="help"><span class="arrow">→</span> ${t(x.here ? 'tiles.bt.you' : 'net.namedOnJoin')}</p>` : `<div class="kind"><div class="seg">${['person', 'cpu'].map(k => `<button type="button" data-kind="${k}" data-p="${p}" class="${on((k === 'cpu') === !!x.cpu)}">${t(k === 'cpu' ? 'tiles.cpu' : 'tiles.person')}</button>`).join('')}</div></div>`}
        ${x.cpu ? `<div class="lv">${LEVEL_ORDER.map(l => `<button type="button" class="chip ${on(x.cpu === l)}" data-lv="${l}" data-p="${p}">${t(levelKey(l))}</button>`).join('')}</div>
        <p class="help"><span class="arrow">→</span> ${t('tiles.lvHelp.' + x.cpu)}</p>` : ''}
      </div>`).join('') + (o.players.length < PLAYERS_MAX ? `<button type="button" class="btn btn-outline" data-add><i class="tl-setup-icon" aria-hidden="true">${TILE_SETUP_ICONS.addPlayer}</i>${t('tiles.addPlayer')}</button>` : '')
      + `<div class="tl-first"><span class="eyebrow">${t('tiles.first')}</span><div class="chips" role="radiogroup">
        <button type="button" class="chip ${on(first < 0)}" data-first="-1"><i class="tl-setup-icon" aria-hidden="true">${TILE_SETUP_ICONS.dice}</i>${t('tiles.first.random')}</button>${
      o.players.map((_, p) => `<button type="button" class="chip pc${p} ${on(first === p)}" data-first="${p}"><i class="tl-player-icon" aria-hidden="true">${playerIcon(o, p)}</i>${esc(nameAt(p))}</button>`).join('')}</div>
        <p class="help"><span class="arrow">→</span> ${t('tiles.first.help')}</p></div>`;
  }
  // Hints, a section of its own (owner, 2026-09-26): on or off, and how many of each level every player may take
  function paintHints() {
    const allowed = o.rules.hints !== false, max = o.rules.hintMax ?? {};
    $('#hints').innerHTML = `<div class="rule"><span class="eyebrow">${t('tiles.r.hints')}</span><div class="seg">${[true, false].map(v =>
      `<button type="button" data-hints="${v}" class="${on(o.rules.hints !== false === v)}">${t('tiles.r.hints.' + v)}</button>`).join('')}</div></div>${allowed ? `
      <div class="rule"><span class="eyebrow">${t('tiles.hints.max')}</span>${['small', 'big', 'master'].map(l => `<div class="hint-max"><span>${t('tiles.hint.' + l)}</span><div class="seg">${
        TL_HINT_MAX.map(v => `<button type="button" data-level="${l}" data-max="${v}" class="${on((max[l] ?? null) === v)}">${v === null ? '∞' : v}</button>`).join('')}</div></div>`).join('')}
        <p class="help"><span class="arrow">→</span> ${t('tiles.hints.maxHelp')}</p></div>
      <div class="rule"><span class="eyebrow">${t('tiles.hints.cost')}</span><div class="seg">${[null, 'low', 'high'].map(v =>
        `<button type="button" data-cost="${v}" class="${on((o.rules.hintCost ?? null) === v)}">${t('tiles.hints.cost.' + (v ?? 'none'))}</button>`).join('')}</div>
        <p class="help"><span class="arrow">→</span> ${t('tiles.hints.costHelp')}</p></div>` : ''}`;
  }
  const ruleRows = list => list.map(([k, vals]) => `<div class="rule"><span class="eyebrow">${t('tiles.r.' + k)}</span><div class="seg">${vals.map(v =>
    `<button type="button" data-rule="${k}" data-v="${v}" class="${on(String(o.rules[k]) === String(v))}">${t(`tiles.r.${k}.${v}`)}</button>`).join('')}</div>${
    ['dictionary', 'check', 'undo', 'open', 'rating', 'veto', 'wordsVote'].includes(k) ? `<p class="help">${t(`tiles.r.${k}Help`)}</p>` : ''}</div>`).join('');
  const voterMax = () => Math.max(1, o.players.filter(x => !x.cpu).length - 1);
  function paintAssists() {
    // Follow the player list until the host sets a count by hand (owner, 2026-11-14).
    o.rules.vetoNeed = Math.min(voterMax(), Math.max(1, vetoManual ? o.rules.vetoNeed : Math.ceil(voterMax() / 2)));
    o.vetoNeedManual = vetoManual;
    o.rules.approvalNeed = Math.min(voterMax(), Math.max(1, approvalManual ? o.rules.approvalNeed : Math.ceil(voterMax() / 2)));
    o.approvalNeedManual = approvalManual;
    if (!canVeto() || o.rules.check === 'challenge') o.rules.wordsVote = false;
    $('.assists-body').innerHTML = TL_ASSISTS.filter(([k]) => (k !== 'undo' || alone()) && (!['veto', 'wordsVote'].includes(k) || canVeto())).map(([k, vals]) => ruleRows([[k, vals]])
      + (k === 'veto' && o.rules.veto ? `<div class="rule"><span class="eyebrow">${t('tiles.r.vetoNeed')}</span><div class="seg"><button type="button" data-veto-step="-1" aria-label="${esc(t('tiles.r.vetoNeed'))} −" ${o.rules.vetoNeed <= 1 ? 'disabled' : ''}>−</button><output>${o.rules.vetoNeed}</output><button type="button" data-veto-step="1" aria-label="${esc(t('tiles.r.vetoNeed'))} +" ${o.rules.vetoNeed >= voterMax() ? 'disabled' : ''}>+</button></div></div>` : '') + (k === 'wordsVote' && o.rules.wordsVote ? `<div class="rule"><span class="eyebrow">${t('tiles.r.approvalNeed')}</span><div class="seg"><button type="button" data-approval-step="-1" aria-label="${esc(t('tiles.r.approvalNeed'))} −" ${o.rules.approvalNeed <= 1 ? 'disabled' : ''}>−</button><output>${o.rules.approvalNeed}</output><button type="button" data-approval-step="1" aria-label="${esc(t('tiles.r.approvalNeed'))} +" ${o.rules.approvalNeed >= voterMax() ? 'disabled' : ''}>+</button></div></div>` : '')).join('');
    const used = helps();
    $('.tl-assists').classList.toggle('used', used.length > 0);
    $('.tl-assists .state').textContent = used.length ? t('tiles.assists.on', { what: used.join(', ') }) : t('tiles.assists.off');
  }
  function paintRules() {
    const r = o.rules, per = r.time?.per ?? 'none';
    // everyone's tiles: only with two people or more (owner, 2026-09-25: "play with your friend")
    const friends = o.players.filter(x => !x.cpu).length > 1 && !o.net;   // on several phones each has their own
    $('.rules-body').innerHTML = ruleRows(TL_RULES.filter(([k]) => k !== 'open' || friends))
      + `<div class="rule"><span class="eyebrow">${t('tiles.r.time')}</span><div class="seg">${['none', 'move', 'game'].map(v =>
        `<button type="button" data-time="${v}" class="${on(per === v)}">${t('tiles.r.time.' + v)}</button>`).join('')}</div>${per === 'none' ? '' : `<div class="seg">${TL_TIMES[per].map(s =>
        `<button type="button" data-secs="${s}" class="${on(r.time.seconds === s)}">${s < 60 ? t('tiles.sec', { n: s }) : t('tiles.min', { n: s / 60 })}</button>`).join('')}</div><p class="help">${t('tiles.r.timeHelp.' + per)}</p>`}</div>`;
    $('.tl-rules .muted').textContent = t(standard() ? 'tiles.rules.standard' : 'tiles.rules.own');
  }
  // Play over Bluetooth (owner, 2026-09-27): the same setup, then Start waits for the other phone to join
  function paintSummary() {
    // help on: those games leave the statistics' records and averages (owner, 2026-09-28: "show the alert")
    const used = helps();
    $('.help-warn').hidden = !used.length;
    $('.help-warn span').textContent = used.length ? t('help.setupPractice') : '';
    const who = o.players.map((x, p) => esc(nameAt(p)) + (x.cpu ? ` (${t(levelKey(x.cpu))})` : '')).join(', ');
    const first = o.players.indexOf(o.first);
    $('.summary').innerHTML = [LANG_NAMES[o.lang], t('tiles.board.' + o.board), o.net && t('net.tag.' + o.net), who, first >= 0 && `${t('tiles.first')}: ${esc(nameAt(first))}`,
      canVeto() && o.rules.wordsVote && t('tiles.r.wordsVote'), canVeto() && o.rules.wordsVote && `${t('tiles.r.approvalNeed')}: ${o.rules.approvalNeed}`,
      canVeto() && o.rules.veto && t('tiles.r.veto'), canVeto() && o.rules.veto && `${t('tiles.r.vetoNeed')}: ${o.rules.vetoNeed}`, !standard() && t('tiles.rules.own')].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
  }
  const sync = () => {
    root.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === o.lang));
    root.querySelectorAll('[data-board]').forEach(b => {
      b.classList.toggle('on', b.dataset.board === o.board);
      b.setAttribute('aria-checked', b.dataset.board === o.board);
      // the size, and how many tiles in this language (Quick has its own set)
      const n = BOARDS[b.dataset.board].length, tiles = fullBag(o.lang, b.dataset.board).length;
      b.querySelector('.meta').innerHTML = `${n} × ${n} ${DOT} ${tiles} ${plural(tiles, 'tiles.tilesN')}`;
    });
    // the same choices as in Settings and in the game (owner, 2026-09-25: "also on the setup")
    $('#bonus').innerHTML = bonusSeg();
    $('#board-style').innerHTML = boardStyleSeg();
    $('#tiles-cb').classList.toggle('on', !!settings.tilesCb);
    $('#tiles-cb').setAttribute('aria-checked', !!settings.tilesCb);
    paintPlayers();
    paintHints();
    paintAssists();
    paintRules();
    paintSummary();
    $('[type=submit]').innerHTML = `${t(o.net ? 'net.start.' + o.net : 'new.start')} <span class="arrow">→</span>`;
    fitAll(root);
  };
  sync();
  loadTileWords(o.lang, o.rules).catch(() => {});      // the word list, ready by the time Start is pressed

  root.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    o.lang = b.dataset.lang;
    settings.newGame = { lang: o.lang };
    saveSettings();
    tlPending = o;
    if (switchLang(o.lang, refresh, false)) return;
    tlPending = null;
    loadTileWords(o.lang, o.rules).catch(() => {});
    sync();
  }));
  root.querySelectorAll('[data-board]').forEach(b => b.addEventListener('click', () => { o.board = b.dataset.board; sync(); }));
  $('#tile-looks').addEventListener('click', e => { const b = e.target.closest('[data-tc]'); if (b) { settings.tilesTile = b.dataset.tc; saveSettings(); applyTileLook(); $('#tile-looks').innerHTML = tileSeg(); } });
  $('#bonus').addEventListener('click', e => { const b = e.target.closest('[data-bonus]'); if (b) { settings.tilesBonus = bonusOf(b.dataset.bonus); saveSettings(); sync(); } });
  $('#board-style').addEventListener('click', e => { const b = e.target.closest('[data-board-style]'); if (b) { settings.tilesBoardStyle = b.dataset.boardStyle; saveSettings(); sync(); } });
  $('#tiles-cb').addEventListener('click', () => { settings.tilesCb = !settings.tilesCb; saveSettings(); sync(); });
  $('.tl-rules').addEventListener('toggle', e => { o.rulesOpen = e.target.open; });
  $('.tl-assists').addEventListener('toggle', e => { o.assistsOpen = e.target.open; });
  // "Change" by the warning: open the assists and bring them into view
  $('[data-assists]').addEventListener('click', () => { $('.tl-assists').open = true; $('.tl-assists').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('.tl-players').addEventListener('input', e => {
    const p = e.target.dataset.name;
    if (p === undefined) return;
    o.players[+p].name = e.target.value;
    // the name also shows in "Who starts"
    const chip = $(`[data-first="${p}"]`);
    if (chip) chip.lastChild.textContent = nameAt(+p);
    paintSummary();
  });
  $('.tl-players').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const p = +b.dataset.p, swap = (i, j) => { [o.players[i], o.players[j]] = [o.players[j], o.players[i]]; };
    if (b.dataset.kind) o.players[p].cpu = b.dataset.kind === 'cpu' ? o.players[p].cpu || 'medium' : null;
    else if (b.dataset.lv) o.players[p].cpu = b.dataset.lv;
    else if (b.dataset.up) swap(+b.dataset.up, +b.dataset.up - 1);
    else if (b.dataset.down) swap(+b.dataset.down, +b.dataset.down + 1);
    else if (b.dataset.first) o.first = o.players[+b.dataset.first] ?? null;
    else if (b.dataset.rm) { if (o.first === o.players[+b.dataset.rm]) o.first = null; o.players.splice(+b.dataset.rm, 1); }
    else if (b.dataset.add !== undefined) o.players.push({ name: '', cpu: o.net ? null : 'medium' });
    else return;
    sync();
  });
  $('#hints').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.hints) o.rules.hints = b.dataset.hints === 'true';
    else if (b.dataset.level) o.rules.hintMax = { ...(o.rules.hintMax ?? {}), [b.dataset.level]: b.dataset.max === 'null' ? null : +b.dataset.max };
    else if (b.dataset.cost) o.rules.hintCost = b.dataset.cost === 'null' ? null : b.dataset.cost;
    else return;
    paintHints();
    paintAssists();
    paintSummary();
    fitAll(root);
  });
  const onRule = e => {
    const b = e.target.closest('button');
    if (!b) return;
    const v = b.dataset.v;
    if (b.dataset.approvalStep) { approvalManual = true; o.rules.approvalNeed += +b.dataset.approvalStep; }
    if (b.dataset.vetoStep) { vetoManual = true; o.rules.vetoNeed += +b.dataset.vetoStep; }
    else if (b.dataset.rule) o.rules[b.dataset.rule] = b.dataset.rule === 'bingo' ? +v : v === 'true' ? true : v === 'false' ? false : v;
    else if (b.dataset.time) o.rules.time = b.dataset.time === 'none' ? null : { per: b.dataset.time, seconds: b.dataset.time === 'move' ? 60 : 1500 };
    else if (b.dataset.secs) o.rules.time = { ...o.rules.time, seconds: +b.dataset.secs };
    else return;
    paintAssists();
    paintRules();
    paintSummary();
    fitAll(root);
  };
  $('.rules-body').addEventListener('click', onRule);
  $('.assists-body').addEventListener('click', onRule);

  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const dict = await loadTileWords(o.lang, o.rules);
    settings.newGame = { lang: o.lang };
    saveSettings();
    const players = o.players.map(x => ({ name: o.net && !x.here ? '' : x.name.trim(), cpu: x.cpu })), first = o.players.indexOf(o.first);
    if (!o.net) remember('tiles', { board: o.board, players, first, rules: o.rules });
    saveSettings();
    const humans = players.filter(x => !x.cpu).length, vsCpu = humans === 1 && players.some(x => x.cpu);
    const state = tilesGame({ lang: o.lang, board: o.board, players, first: first >= 0 ? first : undefined, words: dict.tag,
      rules: { ...o.rules, undo: vsCpu && o.rules.undo, open: humans > 1 && !o.net && o.rules.open, wordsVote: canVeto() && o.rules.check !== 'challenge' && o.rules.wordsVote === true, veto: canVeto() && o.rules.veto === true } });
    // several phones: this one hosts - its player is the row marked "on this phone"; the others' seats fill as they join
    const link = o.net ? { link: { kind: o.net, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), role: 'host', me: Math.max(0, o.players.findIndex(x => x.here)), seats: [] } } : {};
    const game = newGame({ name: typedName(), mode: 'tiles', lang: o.lang, state, firstSet: first >= 0, order: [], turnMs: 0, ...link });
    location.replace('#/game/' + game.id);   // Back from the game goes to the list, not to this form
  });
}

// ── Tiles: Play online (owner, 2026-09-27: "a button that says just play online ... first the type of connection ...
// then join or host") ── the connection (Bluetooth, or the local network - Wi-Fi), then: host a game (New game, online)
// or join one. The connection chosen is remembered for next time.
// which phones can play (owner, 2026-09-27, after a Pixel would not connect over Bluetooth: "add an alert that only some
// devices support it")
const devicesInfo = kinds => `<div class="card tl-hostinfo"><span class="eyebrow">${t('net.devices.title')}</span><ul>${
  ['android', 'version', 'near', 'bt'].filter(k => !['near', 'bt'].includes(k) || kinds.includes(k)).map(k =>
    `<li>${t(k === 'android' && kinds.includes('web') ? 'net.devices.androidWeb' : 'net.devices.' + k, { v: VERSION })}</li>`).join('')}</ul></div>`;
export function tilesOnlineScreen(root) {
  const kinds = netKinds();
  if (!kinds.length) {
    root.innerHTML = `<div class="app">${topbar({ left: `<a class="btn btn-ghost" href="${LIST_OF.tiles}">${t('back.games')}</a>` })}<main class="main"><p role="status">${t('net.unavailable')}</p></main></div>`;
    return;
  }
  let kind = kinds.includes(settings.netKind) ? settings.netKind : kinds[0] ?? 'bt';
  root.innerHTML = `<div class="app" data-screen="new">
  ${topbar({ left: `<a class="btn btn-ghost" href="${LIST_OF.tiles}">${t('back.games')}</a>`, right: modeTag('tiles') })}
  <main class="main">
    <h1 class="title">${t('net.online')}</h1>
    ${devicesInfo(kinds)}
    <div class="field">
      <span class="eyebrow">${t('net.step.kind')}</span>
      <div class="tl-kinds" role="radiogroup">${kinds.map(k => `<button type="button" class="tl-kind" data-kind-net="${k}" role="radio"><strong>${t('net.kind.' + k)}</strong><span class="help">${
        t('net.kindHelp.' + k)}</span></button>`).join('')}</div>
      <p class="help" id="kind-no" hidden>${t('net.kindNo.near')}</p>
    </div>
    <div class="field">
      <span class="eyebrow">${t('net.step.role')}</span>
      <div class="tl-roles">
        <a class="tl-role" data-role="host"><strong>${t('net.host')} <span class="arrow">→</span></strong><span class="help">${t('net.hostHelp')}</span></a>
        <a class="tl-role" data-role="join"><strong>${t('net.join')} <span class="arrow">→</span></strong><span class="help">${t('net.joinWhat')}</span></a>
      </div>
    </div>
  </main>
</div>`;
  const paint = () => {
    root.querySelectorAll('[data-kind-net]').forEach(b => { b.classList.toggle('on', b.dataset.kindNet === kind); b.setAttribute('aria-checked', b.dataset.kindNet === kind); });
    root.querySelector('[data-role=host]').href = '#/host/' + kind;
    root.querySelector('[data-role=join]').href = '#/join/' + kind;
  };
  // on the screen itself, which goes when it is replaced (#root stays: a handler there stayed after leaving)
  root.firstElementChild.addEventListener('click', e => {
    const b = e.target.closest('[data-kind-net]');
    if (!b || b.disabled) return;
    kind = settings.netKind = b.dataset.kindNet;
    saveSettings();
    paint();
  });
  paint();
  fitAll(root);
  // Nearby needs Google Play services: without it, greyed out, and said why
  if (kinds.includes('near')) nearbyHere().then(ok => {
    if (ok || !root.isConnected) return;
    const b = root.querySelector('[data-kind-net=near]');
    b.disabled = true;
    root.querySelector('#kind-no').hidden = false;
    if (kind === 'near') { kind = kinds.find(k => k !== 'near') ?? 'bt'; paint(); }
  });
}

// ── Tiles: Join a game (owner, 2026-09-27) ── on another phone, over Bluetooth (the phones nearby, and those paired
// already) or Wi-Fi (the games announced on this network). Tap the one that waits for players; once its host lets this
// phone in, the game comes over and is played here - kept only while it is played (the host's phone keeps it).
export function tilesJoinScreen(root, chosen) {
  const kinds = netKinds();
  if (!kinds.length) return tilesOnlineScreen(root);
  const kind = kinds.includes(chosen) ? chosen : kinds.includes(settings.netKind) ? settings.netKind : kinds[0] ?? 'bt';
  // address → { name, rssi, seen }: phones found near by, dropped once not seen for a while
  const found = new Map();
  let busy = false, gone = false, joined = false, searching = false, answer = '', welcome = null, conn = null, party = null;
  const handles = [];
  root.innerHTML = `<div class="app" data-screen="new">
  ${topbar({ left: `<a class="btn btn-ghost" href="#/online">${t('back.games')}</a>`, right: modeTag('tiles') })}
  <main class="main">
    <h1 class="title">${t('net.join')}</h1>
    <p class="help tl-online-kind"><span class="eyebrow">${t('net.step.kind')}</span> ${t('net.kind.' + kind)}</p>
    <p class="help" id="join-help"></p>
    ${settings.myName ? `<p>${t('net.joinAs', { name: `<strong>${esc(settings.myName)}</strong>` })} <a class="btn-link" href="#/settings">${t('net.joinAsChange')}</a></p>` : `<div class="field"><label class="eyebrow" for="my-name">${t('set.myName')}</label>${myNameInput()}</div>`}
    <div class="card tl-join">
      <p class="tl-join-note"></p>
      ${kind === 'web' ? `<form class="tl-coderow" id="web-form"><input class="input" id="web-code" maxlength="9" value="${esc(settings.webCode ?? '')}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="KQ7M2P" aria-label="${
        t('net.web.code')}"><button class="btn btn-primary" type="submit" id="web-join">${t('net.web.join')} <span class="arrow">→</span></button></form>` : ''}
      <div class="tl-devices"></div>
    </div>
  </main>
</div>`;
  const $ = sel => root.querySelector(sel);
  wireMyName(root);
  const wire = () => net(kind);
  const note = (key, vars, dots) => { $('.tl-join-note').innerHTML = (dots ? '<span class="tl-dots" aria-hidden="true"><i></i><i></i><i></i></span> ' : '') + t(key, vars); };
  // what went wrong, small under the note - to tell a phone out of reach from one not hosting
  const why = e => { const m = String(e?.message ?? e ?? '').replace(/^cannot connect:\s*/, ''); if (m) $('.tl-join-note').insertAdjacentHTML('beforeend', `<small class="tl-why">${esc(m)}</small>`); };
  // not ready: why - with a button to Android's Location settings when that is it
  const noteLocation = why => {
    note('tiles.bt.' + why);
    if (why === 'location') $('.tl-join-note').insertAdjacentHTML('beforeend', ` <button class="btn btn-outline" type="button" data-act="location">${t('tiles.bt.locationOpen')}</button>`);
  };
  const paint = () => {
    $('#join-help').textContent = t('net.joinHelp.' + kind);
    if ($('#web-join')) $('#web-join').disabled = busy;
    $('.tl-devices').innerHTML = [...found].sort(([, a], [, b]) => (b.rssi ?? -999) - (a.rssi ?? -999)).map(([address, { name }]) =>
      `<button type="button" class="tl-device" data-address="${esc(address)}"${busy ? ' disabled' : ''}><strong>${esc(name || address)}</strong>${name && kind === 'bt' ? `<span class="help">${esc(address)}</span>` : ''}</button>`).join('');
  };
  // its permission, its events, the list
  async function start() {
    paint();
    const ready = await netReady(kind, true).catch(() => 'unsupported');
    if (gone) return;
    // Bluetooth off, or not allowed, or Location off (Android 11 and older): said so, and the search starts by itself
    // once it is on (owner: "refresh it all the time until you're connected or leave") - looked at every few seconds,
    // never asked again and again
    if (ready !== 'ok') {
      noteLocation(ready);
      const wait = setInterval(async () => {
        if (gone) return clearInterval(wait);
        const st = await wire().state().catch(() => ({}));
        if (st.on && st.allowed && !st.locationOff) { clearInterval(wait); start(); }
      }, 3000);
      return;
    }
    const on = async (event, fn) => { const h = await wire().on(event, fn); if (gone) h.remove(); else handles.push(h); };
    // the internet: no search - the host's code, typed in
    if (kind === 'web') {
      await on('message', ({ id, text }) => { if (id === conn) party?.message(text); });
      await on('disconnected', ({ id }) => { if (id === conn && !answer) answer = 'lost'; });
      if (!busy) note('net.web.enterCode');
      return;
    }
    // only what could host a game: phones, tablets and computers (not headphones, cars, watches…), and only found now -
    // never the phone's list of devices paired over the years (owner, 2026-09-27: "everything except what it should")
    await on('found', d => {
      if (kind === 'bt' && ![0x100, 0x200, 0x1f00, 0, -1].includes(d.major ?? -1)) return;
      const was = found.get(d.address);
      found.set(d.address, { name: d.name || was?.name || '', rssi: d.rssi ?? was?.rssi, seen: Date.now() });
      if (!gone) paint();
    });
    // a round done: those not seen for a while drop out, the list so far, and the next round
    await on('searchDone', () => {
      searching = false;
      if (gone) return;
      for (const [a, d] of found) if (Date.now() - d.seen > 45000) found.delete(a);
      paint();
      if (!busy) { note(found.size ? 'net.pick.' + kind : 'net.none.' + kind, {}, !found.size); setTimeout(search, 1000); }
    });
    await on('message', ({ id, text }) => { if (id === conn) party?.message(text); });
    await on('disconnected', ({ id }) => { if (id === conn && !answer) answer = 'lost'; });
    // Bluetooth: the direct connection did not come up - the last try pairs the phones (Android asks on both)
    if (kind === 'bt') await on('pairing', () => { if (busy && !conn) note('tiles.bt.pairing', {}, true); });
    if (!gone) search();
  }
  async function search() {
    if (busy || gone || searching || kind === 'web') return;
    if (kind === 'lan' && !(await wire().state().catch(() => ({}))).on) { note('net.noWifi'); return setTimeout(search, 3000); }
    searching = true;
    paint();
    if (!found.size) note('net.searching.' + kind, {}, true);
    try { await wire().search(); } catch (e) {
      searching = false;
      paint();
      if (/location/.test(e?.message ?? e)) noteLocation('location'); else note('tiles.bt.searchFailed');
      setTimeout(search, 3000);
    }
  }
  async function join(address) {
    busy = true;
    answer = '';
    welcome = null;
    paint();
    let name = esc(found.get(address)?.name || address);
    note('tiles.bt.joining', { name }, true);
    await wire().stopSearch().catch(() => {});
    searching = false;   // stopped, with no "done" to say so: else the search never started again (owner: "seen only once")
    try { const j = await wire().join(address, true); conn = j.id; if (j.name) name = esc(j.name); } catch (e) {
      busy = false;
      const m = String(e?.message ?? e), key = kind !== 'web' ? 'tiles.bt.joinFailed' : /no game/.test(m) ? 'net.web.noGame' : /bad code/.test(m) ? 'net.web.badCode' : 'net.web.joinFailed';
      if (!gone) { paint(); note(key, { name }); if (/joinFailed/.test(key)) why(e); setTimeout(search, 2500); }
      return;
    }
    if (kind === 'web') settings.webCode = address;   // there next time (back after the page was closed, or the next game)
    saveSettings();
    // The host lets this phone in (up to 2 minutes); its own name goes with it (owner, 2026-11-14).
    party = createGuest({ name: settings.myName ?? '', send: text => { wire().send(conn, text).catch(() => {}); }, on: {
      welcome: m => { welcome = m; }, refused: () => { answer = 'refused'; }, full: () => { answer = 'full'; }, version: () => { answer = 'version'; },
    } });
    party.connected();
    note('tiles.bt.letInWait', { name }, true);
    for (let i = 0; i < 480 && !welcome && !answer && !gone; i++) await new Promise(r => setTimeout(r, 250));
    if (gone) return;
    const fail = key => { wire().close(conn).catch(() => {}); conn = null; busy = false; paint(); note(key, { name }); setTimeout(search, 2500); };
    if (!welcome) return fail({ refused: 'tiles.bt.refused', full: 'net.full', version: 'tiles.bt.version', lost: 'tiles.bt.joinFailed' }[answer] ?? 'tiles.bt.noGame');
    const m = welcome, dict = await loadTileWords(m.setup.lang, m.setup.rules).catch(() => null);
    if (!dict || dict.tag !== m.setup.words) return fail('tiles.bt.words');
    // the game as the host has it, here only while it is played
    const state = m.log.reduce((st, x) => tilesApply(st, x, w => has(dict, w)), tilesGame(m.setup));
    putSave({ id: m.id, live: true, mode: 'tiles', lang: m.setup.lang, name: '', title: m.title, state, firstSet: true, order: [], turnMs: 0,
      guesses: [], status: 'playing', timeMs: 0, created: Date.now(),
      link: { kind, role: 'guest', me: m.seat, id: m.id, conn, hostAddress: address, hostSeat: m.host, here: m.here, fresh: true } });
    joined = gone = true;   // the game screen carries on with this connection
    location.replace('#/game/' + m.id);
  }
  // on the screen itself, which goes when it is replaced: on #root, every visit to Join left one more handler behind,
  // and one tap on a phone then started a join from each of them at once
  root.firstElementChild.addEventListener('click', e => {
    if (e.target.closest('[data-act=location]')) return openLocation(kind);
    const d = e.target.closest('[data-address]');
    if (d && !busy) join(d.dataset.address);
  });
  $('#web-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const code = cleanCode($('#web-code').value);
    if (busy) return;
    if (!isCode(code)) return note('net.web.badCode');
    join(code);
  });
  start();
  return () => {
    gone = true;
    handles.splice(0).forEach(h => h.remove());
    wire().stopSearch().catch(() => {});
    if (!joined && conn) { party?.leave(); const w = wire(), c = conn; setTimeout(() => w.close(c).catch(() => {}), 300); }
    if (!joined && (kind === 'bt' || kind === 'near')) remindBt();
  };
}

let statsTab = 'general';   // which tab the stats screen shows, kept while the app is open
// General, then one tab per game (Statistics v2 design, 2026-09-28)
const STAT_TABS = ['general', 'guess', 'letters', 'connect', 'tiles'];
const statFilter = {};      // language shown per game, kept while the app is open
const MODES = ['guess', 'letters', 'connect', 'tiles'];

// Approved square achievement grid; progress and dates come from the live ledger.
const gameTabs = (tabs, selected, attr, generalLabel) => `<div class="seg st-tabs" role="tablist">${tabs.map(m => {
  const label = t(m === 'general' || m === 'all' ? generalLabel : 'mode.' + m), iconsOnly = attr === 'ach-tab';
  return `<button type="button" role="tab" data-${attr}="${m}" class="${on(selected === m)}" ${iconsOnly ? `tabindex="${selected === m ? 0 : -1}" aria-label="${label}" title="${label}"` : ''} aria-selected="${selected === m}"><span class="tg" aria-hidden="true">${GLYPH[m === 'general' ? 'all' : m] ?? ''}</span>${iconsOnly ? '' : label}</button>`;
}).join('')}</div>`;
let achievementTab = 'all';
export function achievementsScreen(root) {
  const reached = TIERED.reduce((n, d) => n + TIERS.filter((_, i) => gotAt(`${d.id}#${i}`) !== null).length, 0);
  const filtered = ds => ds.filter(d => achievementTab === 'all' || d.game === achievementTab);
  const tile = d => {
    const level = achievementState(d);
    return `<button class="ach-tile ${level < 0 ? 'locked' : 'earned'}" data-ach="${d.id}" style="--ink:${achievementInk(level)}" aria-label="${t('ach.' + d.id)} · ${level < 0 ? t('ach.locked') : level === 5 ? t('ach.earned') : t('tier.' + TIERS[level])} · ${t('ach.detail')}">${achievementIcon(d.id)}${level < 0 ? achievementLock : ''}<strong>${t('ach.' + d.id)}</strong>${d.th ? achievementPips(level) + achievementBar(d) : ''}</button>`;
  };
  root.innerHTML = `<div class="app" data-screen="achievements">
    ${topbar({ left: `<a class="btn btn-ghost" href="#/">${t('back.menu')}</a>` })}
    <main class="main"><h1 class="title">${t('ach.title')}</h1>
      <div class="ach-summary"><div><b class="num">${num(reached)}</b><small>${t('ach.tiers', { a: num(reached), b: num(TIERED.length * TIERS.length) })}</small></div>${TIERS.map((tier, i) => `<span class="ach-count" title="${t('tier.' + tier)}" aria-label="${t('tier.' + tier)}: ${TIERED.filter(d => gotAt(`${d.id}#${i}`) !== null).length}">${tierShape(i)}${num(TIERED.filter(d => gotAt(`${d.id}#${i}`) !== null).length)}</span>`).join('')}</div>
      ${gameTabs(['all', ...GAMES], achievementTab, 'ach-tab', 'col.all')}
      <h2 class="ach-section-title">${t(achievementTab === 'all' ? 'col.all' : 'mode.' + achievementTab)}</h2>
      ${filtered(TIERED).length ? `<h2 class="ach-heading">${t('ach.milestones')}</h2><div class="ach-grid">${filtered(TIERED).map(tile).join('')}</div>` : ''}
      ${filtered(CHALLENGES).length ? `<h2 class="ach-heading">${t('ach.challenges')} · ${num(filtered(CHALLENGES).filter(d => gotAt(d.id) !== null).length)} / ${num(filtered(CHALLENGES).length)}</h2><div class="ach-grid">${filtered(CHALLENGES).map(tile).join('')}</div>` : ''}
      ${earlierAchievements().length ? `<details class="earlier-ach"><summary>${t('ach.earlier')}</summary>${earlierAchievements().filter(([key]) => achievementTab === 'all' || key.startsWith(achievementTab + '.')).map(([key, at]) => {
        const [id, tier] = key.split('#'), title = t('ach.' + id);
        return `<p>${esc(title === 'ach.' + id ? id : title)}${tier != null ? ' · ' + t('tier.' + TIERS[+tier]) : ''} <small>${t('ach.got', { d: dateTime(at) })}</small></p>`;
      }).join('')}</details>` : ''}
    </main></div>`;
  root.querySelectorAll('[data-ach-tab]').forEach(b => {
    b.addEventListener('click', () => { achievementTab = b.dataset.achTab; achievementsScreen(root); root.querySelector('[aria-selected=true]')?.focus(); });
    b.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const tabs = [...root.querySelectorAll('[data-ach-tab]')], i = tabs.indexOf(b);
      tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].click();
    });
  });
  root.querySelectorAll('[data-ach]').forEach(b => b.addEventListener('click', () => achievementDetail(b.dataset.ach)));
}

// Participation includes practice; quality figures use only unassisted records (owner, 2026-11-20).
export function statsScreen(root, _, refresh) {
  if (!STAT_TABS.includes(statsTab)) statsTab = 'general';
  const f = statFilter[statsTab] ??= { lang: 'all' };
  const values = Object.fromEntries(MODES.map(m => [m, totals(m, statsTab === 'general' ? 'all' : f.lang)]));
  const cell = (key, value, sub = '', cls = '', glyph = ({ 'stats.finished': UI_ICONS.finished, 'stats.solved': UI_ICONS.finished, 'stats.boardsCompleted': UI_ICONS.finished, 'stats.time': UI_ICONS.time }[key] ?? '')) => `<div class="scell ${cls}"><span class="lbl">${glyph}${t(key)}</span><span class="num">${value == null ? '—' : typeof value === 'number' ? num(value) : value}${sub ? `<small class="sub">${sub}</small>` : ''}</span></div>`;
  const decimal = value => value == null ? null : value.toLocaleString(getLang(), { maximumFractionDigits: 1 });
  const time = value => value == null ? null : clock(value, true);
  const times = value => cell('stats.time', time(value.timeMs)) + cell('stats.avgTime', value.avgTime == null ? null : clock(value.avgTime));
  const rows = {
    guess: [['stats.solved', 'finished'], ['game.guesses', 'guesses'], ['stats.unique', 'distinct'], ['stats.letters', 'letters']],
    letters: [['stats.finished', 'finished'], ['stats.won', 'solved'], ['stats.letters', 'letters'], ['stats.green', 'green'], ['stats.yellow', 'yellow']],
    connect: [['stats.boardsCompleted', 'finished'], ['stats.wordsFound', 'words'], ['stats.bonusWords', 'bonus']],
    tiles: [['stats.finished', 'finished'], ['stats.tiles.moves', 'words'], ['stats.tilesPlaced', 'tiles']],
  };
  const value = values[statsTab];
  const timedGames = MODES.reduce((n, m) => n + values[m].timedGames, 0);
  const timedMs = MODES.reduce((n, m) => n + values[m].timeMs, 0);
  let panel;
  if (statsTab === 'general') {
    panel = cell('stats.finished', MODES.reduce((n, m) => n + values[m].finished, 0))
      + cell('stats.played', MODES.reduce((n, m) => n + values[m].played, 0))
      + times({ timeMs: stats.timeMs, avgTime: timedGames ? timedMs / timedGames : null })
      + `<h2 class="eyebrow st-mode-heading">${t('stats.byMode')}</h2>`
      + MODES.map(m => cell('mode.' + m, values[m].finished, '', '', GLYPH[m])).join('');
  } else {
    panel = cell('stats.played', value.played) + rows[statsTab].map(([key, field]) => cell(key, value[field],
      statsTab === 'letters' && field === 'solved' && value.wonPct != null ? `${decimal(value.wonPct)} %` : '')).join('');
    if (statsTab === 'connect') panel += cell('stats.bonusPerGame', decimal(value.bonusPerGame));
    if (statsTab === 'tiles') {
      const word = (key, w, points = false) => cell(key, w ? esc(w.w) : null,
        w ? `${points ? t('stats.wordPoints', { n: num(w.score) }) + ' · ' : ''}${dateTime(w.at)}` : '', 'word');
      panel += cell('stats.tiles.wordsFormed', value.wordsFormed) + cell('stats.tiles.avgWordPoints', decimal(value.avgWordPoints))
        + word('stats.tiles.bestWord', value.bestWord, true) + word('stats.longest', value.longest)
        + cell('stats.tiles.seven', value.seven)
        + `<h2 class="eyebrow st-mode-heading">${t('stats.tiles.bonuses')}</h2>`
        + ['d', 't', 'D', 'T'].map(k => cell('stats.tiles.bonus.' + k, value.bonuses[k])).join('');
    }
    panel += times(value);
  }
  root.innerHTML = `<div class="app" data-screen="stats">
    ${topbar({ left: `<a class="btn btn-ghost" href="#/">${t('back.menu')}</a>` })}
    <main class="main"><h1 class="title">${t('stats.title')}</h1>
      ${gameTabs(STAT_TABS, statsTab, 'tab', 'stats.general')}
      ${statsTab === 'general' ? '' : `<div class="st-filters"><div class="seg" role="radiogroup">${['all', 'pl', 'en'].map(l => `<button type="button" data-f-lang="${l}" class="${on(f.lang === l)}">${l === 'all' ? t('stats.tiles.bothLangs') : LANG_NAMES[l]}</button>`).join('')}</div></div>`}
      <section class="card sgroup" role="tabpanel"><div class="scells">${panel}</div></section>
    </main></div>`;
  root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { statsTab = b.dataset.tab; refresh(); }));
  root.querySelectorAll('[data-f-lang]').forEach(b => b.addEventListener('click', () => { f.lang = b.dataset.fLang; refresh(); }));
}


// ── The Collection (owner, 2026-09-28: "which words from the category you have ever guessed; the ones you didn't as
// question marks ... and the percentage") ── every word typed in a game (store.js collect) against the words each game
// can hide: per mode, by category (Connect, which has none, by length), and all of them together. Menu → Collection.
const COL_TABS = ['all', 'guess', 'letters', 'connect'];
let colTab = 'all', colLang = null, colCat = null, colLen = 0;   // kept while the app is open
const colPools = new Map();                                        // 'lang|mode|cat' → word indexes, most common first
function colPool(m, mode, cat) {
  const k = `${m.lang}|${mode}|${cat}`;
  if (!colPools.has(k)) colPools.set(k, mode === 'guess' ? secretWords(m, cat)
    : mode === 'connect' ? pool(m, { diff: 'random', marks: true }).filter(i => [...m.words[i]].length === +cat)
    : pool(m, { cat, diff: 'random', marks: true }));
  return colPools.get(k);
}
const colCats = mode => mode === 'connect' ? Array.from({ length: RING_MAX - WORD_MIN + 1 }, (_, i) => String(i + WORD_MIN)) : CATS;

export async function collectionScreen(root, _, refresh) {
  colLang ??= settings.lang;
  const tabs = `<div class="seg st-tabs" role="tablist">${COL_TABS.map(m => `<button type="button" role="tab" data-ctab="${m}" class="${on(colTab === m)}" aria-selected="${colTab === m}"><span class="tg">${
    GLYPH[m] ?? ''}</span>${t(m === 'all' ? 'col.all' : 'mode.' + m)}</button>`).join('')}</div>
    <div class="seg co-lang" role="radiogroup">${['pl', 'en'].map(l => `<button type="button" data-clang="${l}" class="${on(colLang === l)}">${LANG_NAMES[l]}</button>`).join('')}</div>`;
  const shell = body => `<div class="app" data-screen="collection">
  ${topbar({ left: `<a class="btn btn-ghost" href="#/">${t('back.menu')}</a>` })}
  <main class="main">
    <h1 class="title">${t('col.title')}</h1>
    ${tabs}
    <section class="section">${body}<p class="co-help">${t('col.help')}</p></section>
  </main>
</div>`;
  // while the words load (~1 s): the line, and quiet rows where the rows will be
  root.innerHTML = shell(`<div class="co-loading"><p>${t('col.loading')}</p>${'<i></i>'.repeat(6)}</div>`);
  const wire = () => {
    root.querySelectorAll('[data-ctab]').forEach(b => b.addEventListener('click', () => { colTab = b.dataset.ctab; colCat = null; refresh(); }));
    root.querySelectorAll('[data-clang]').forEach(b => b.addEventListener('click', () => { colLang = b.dataset.clang; colCat = null; refresh(); }));
    root.querySelectorAll('[data-ccat]').forEach(b => b.addEventListener('click', () => { colCat = b.dataset.ccat; colLen = 0; refresh(); }));
    root.querySelectorAll('[data-clen]').forEach(b => b.addEventListener('click', () => { colLen = +b.dataset.clen; refresh(); }));
    root.querySelector('[data-cback]')?.addEventListener('click', () => { colCat = null; refresh(); });
  };
  wire();
  const m = await loadWords(colLang).catch(() => null);
  if (!m || !root.querySelector('[data-screen=collection]')) return;
  const pctOf = (a, b) => b ? Math.round(a / b * 100) : 0;
  // one bar everywhere, green = found - a sliver as soon as one word is
  const bar = (a, b) => `<span class="co-bar${a ? '' : ' zero'}"><i style="--p:${Math.max(pctOf(a, b), a ? 1 : 0)}%"></i></span>`;
  const pcs = (a, b) => `${pctOf(a, b)}\u202F%`;
  // a row: [glyph] name …… 34 / 120 · 28 %  ›, the bar under it; tapping opens the game or the category
  const row = (attr, name, a, b) => `<li><button type="button" class="co-row${a ? '' : ' none'}" ${attr}><span class="co-top"><span class="co-name">${name}</span><span class="co-count"><b>${num(a)}</b> / ${num(b)} · <span class="pc">${
    pcs(a, b)}</span></span></span><span class="chev" aria-hidden="true">›</span>${bar(a, b)}</button></li>`;
  const foundIn = (mode, list) => { const had = collected(mode, colLang); return list.filter(i => had.has(m.words[i])).length; };
  const letters = n => `${n} ${plural(+n, 'lt.letters')}`;
  let body, map = null;
  if (colTab === 'all') {
    // every word any game can hide (Letters' pool holds Connect's), and every one typed in any of them
    const everyWord = new Set([...colPool(m, 'guess', 'all'), ...colPool(m, 'letters', 'all')]);
    const typed = new Set(['guess', 'letters', 'connect'].flatMap(md => [...collected(md, colLang)]));
    const got = [...everyWord].filter(i => typed.has(m.words[i])).length;
    body = `<div class="card co-hero"><span class="eyebrow">${t('col.everything')}</span><span class="co-pct">${pctOf(got, everyWord.size)}<small>%</small></span>
      <p class="co-line">${t('col.totalLine', { n: `<b>${num(got)}</b>`, of: num(everyWord.size) })}</p>${bar(got, everyWord.size)}</div>
      <ul class="co-rows">${['guess', 'letters', 'connect'].map(md => {
        const list = md === 'connect' ? colCats('connect').flatMap(c => colPool(m, 'connect', c)) : colPool(m, md, 'all');
        return row(`data-ctab-go="${md}"`, `${GLYPH[md] ?? ''}${t('mode.' + md)}`, foundIn(md, list), list.length);
      }).join('')}</ul>`;
  } else if (!colCat) {
    body = `<p class="co-lead">${t(colTab === 'connect' ? 'col.byLength' : 'col.byCategory')}</p><ul class="co-rows two">${colCats(colTab).map(c => {
      const list = colPool(m, colTab, c);
      return list.length ? row(`data-ccat="${c}"`, colTab === 'connect' ? letters(c) : t('cat.' + c), foundIn(colTab, list), list.length) : '';
    }).join('')}</ul>`;
  } else {
    // one category: its lengths (how many found of each), then the words of one length - the found ones written out,
    // the rest a map, one dot per word, green where found (design option A: thousands of "???" would drown the found)
    const list = colPool(m, colTab, colCat), had = collected(colTab, colLang), f = foundIn(colTab, list);
    const byLen = new Map();
    for (const i of list) { const n = [...m.words[i]].length; if (!byLen.has(n)) byLen.set(n, []); byLen.get(n).push(i); }
    const lens = [...byLen.keys()].sort((x, y) => x - y);
    if (!byLen.has(colLen)) colLen = lens[0];
    const range = lens.length ? Array.from({ length: lens.at(-1) - lens[0] + 1 }, (_, k) => lens[0] + k) : [];
    const words = byLen.get(colLen) ?? [], got = words.filter(i => had.has(m.words[i]));
    map = words.map(i => had.has(m.words[i]));
    body = `<button type="button" class="btn btn-ghost co-back" data-cback>← ${t(colTab === 'connect' ? 'col.lengths' : 'col.categories')}</button>
      <div class="card co-cat"><h2>${colTab === 'connect' ? letters(colCat) : t('cat.' + colCat)}</h2><p class="co-line"><span><b>${num(f)}</b> / ${num(list.length)} · ${pcs(f, list.length)}</span></p>${bar(f, list.length)}</div>
      ${range.length > 1 ? `<div class="co-lens">${range.map(n => { const ws = byLen.get(n) ?? [], g = ws.filter(i => had.has(m.words[i])).length;
        return `<button type="button" class="co-len${n === colLen ? ' on' : ''}${ws.length ? '' : ' empty'}" data-clen="${n}"><span class="num">${n}</span><small class="${g ? 'got' : ''}">${num(g)}</small></button>`; }).join('')}</div>
      <div class="co-lenhead"><strong>${letters(colLen)}</strong><span>${t('col.foundOf', { n: num(got.length), of: num(words.length) })}</span></div>` : ''}
      ${got.length ? `<div class="co-found">${got.map(i => `<span class="co-w">${esc(m.words[i])}</span>`).join('')}</div>` : ''}
      ${words.length > got.length ? `<div class="co-map"><div class="co-maphead"><span><b>${num(words.length - got.length)}</b> ${t('col.notYet')}</span><span>${t('col.dotIs')}</span></div>
        <canvas class="co-dots" role="img" aria-label="${t('col.foundOf', { n: num(got.length), of: num(words.length) })}"></canvas><span class="co-dots" hidden><i></i><i class="g"></i></span></div>` : ''}`;
  }
  root.innerHTML = shell(body);
  wire();
  root.querySelectorAll('[data-ctab-go]').forEach(b => b.addEventListener('click', () => { colTab = b.dataset.ctabGo; colCat = null; refresh(); }));
  const canvas = root.querySelector('canvas.co-dots');
  if (canvas && map) dotMap(canvas, map);
}

// The words not found yet, as a map: a 6px dot per word in the list's order, 2px apart, green where found - drawn on one
// canvas (a category can hold thousands of words), again when its width changes.
function dotMap(canvas, flags) {
  const probe = canvas.nextElementSibling.children, colour = [getComputedStyle(probe[0]).backgroundColor, getComputedStyle(probe[1]).backgroundColor];
  const draw = () => {
    const w = canvas.clientWidth, cols = Math.max(1, Math.floor((w + 2) / 8)), rows = Math.ceil(flags.length / cols), h = Math.max(6, rows * 8 - 2);
    const step = cols > 1 ? (w - 6) / (cols - 1) : 0, dpr = window.devicePixelRatio || 1;
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    flags.forEach((got, k) => {
      ctx.fillStyle = colour[got ? 1 : 0];
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect((k % cols) * step, Math.floor(k / cols) * 8, 6, 6, 1.5); else ctx.rect((k % cols) * step, Math.floor(k / cols) * 8, 6, 6);
      ctx.fill();
    });
  };
  draw();
  let last = canvas.clientWidth;
  const watch = new ResizeObserver(() => { if (!canvas.isConnected) return watch.disconnect(); if (canvas.clientWidth !== last) { last = canvas.clientWidth; draw(); } });
  watch.observe(canvas);
}

let dataIndex;

const settingsSections = new Set(['general']);
export async function settingsScreen(root, _, refresh) {
  dataIndex ??= await fetch('data/index.json').then(r => r.json());
  const seg = (key, values, label) => `<div class="seg">${values.map(v => `<button type="button" data-k="${key}" data-v="${v}" class="${on(settings[key] === v)}">${label(v)}</button>`).join('')}</div>`;
  const rareTiers = cleanTiers(settings.tilesRareTiers);
  const waiting = REPO && settings.latest && newer(settings.latest, VERSION);
  const updateLine = !REPO ? t('set.noRepo')
    : waiting ? t('set.available', { v: settings.latest })
      : settings.lastCheck ? `${t('set.upToDate')} ${DOT} ${t('set.checked', { d: dateTime(settings.lastCheck) })}` : t('set.never');
  root.innerHTML = `<div class="app" data-screen="settings">
  ${topbar({ left: `<a class="btn btn-ghost" href="#/">${t('back.menu')}</a>` })}
  <main class="main">
    <h1 class="title">${t('set.title')}</h1>
    <details class="settings-section" data-section="general"${settingsSections.has('general') ? ' open' : ''}><summary><span class="category-icon" aria-hidden="true">${UI_ICONS.general}</span><span>${t('set.section.general')}</span><span class="category-arrow" aria-hidden="true">⌄</span></summary><div class="section-content">
<div class="row"><div class="row-text"><strong>${t('set.lang')}</strong><span>${t('set.langDesc')}</span></div>${seg('lang', ['pl', 'en'], l => LANG_NAMES[l])}</div><div class="row"><div class="row-text"><strong>${t('set.fuzzy')}</strong><span>${t('set.fuzzyDesc')}</span></div><button type="button" class="toggle ${on(settings.fuzzy)}" data-toggle="fuzzy" role="switch" aria-checked="${settings.fuzzy}" aria-label="${t('set.fuzzy')}"></button></div>
    </div></details>
    <details class="settings-section" data-section="games"${settingsSections.has('games') ? ' open' : ''}><summary><span class="category-icon" aria-hidden="true">${GLYPH.tiles}</span><span>${t('set.section.games')}</span><span class="category-arrow" aria-hidden="true">⌄</span></summary><div class="section-content">
<div class="row"><div class="row-text"><strong>${t('set.remember')}</strong><span>${t('set.rememberDesc')}</span></div><button type="button" class="toggle ${on(settings.rememberSetup)}" data-toggle="rememberSetup" role="switch" aria-checked="${!!settings.rememberSetup}" aria-label="${t('set.remember')}"></button></div>

      <h2 class="title">${t('set.tiles')}</h2>
      <div class="row"><div class="row-text"><strong>${t('tiles.under')}</strong><span>${t('tiles.underHelp')}</span></div>${seg('tilesUnder', ['rating', 'rarity', 'both'], v => t('tiles.under.' + v))}</div>
      <div class="row"><div class="row-text"><strong>${t('set.rareTiers')}</strong><span id="rare-help">${t('set.rareTiersHelp', { pl: num(dataIndex.counts.pl), en: num(dataIndex.counts.en) })}</span></div>
        <div class="rare-tiers">${['purple', 'gold', 'blue'].map((tier, i) => `<label class="rare-${tier}"><i aria-hidden="true"></i><input class="input" type="number" inputmode="numeric" min="1" max="100" step="1" data-rare-tier="${i}" value="${rareTiers[i]}" aria-label="${t('tiles.rare.tier.' + tier)}" aria-describedby="rare-help"><span>%</span></label>`).join('')}
        <button type="button" class="btn btn-ghost" id="rare-reset">${t('set.rareReset')}</button></div></div>

    </div></details>
    <details class="settings-section" data-section="display"${settingsSections.has('display') ? ' open' : ''}><summary><span class="category-icon" aria-hidden="true">${UI_ICONS.display}</span><span>${t('set.section.display')}</span><span class="category-arrow" aria-hidden="true">⌄</span></summary><div class="section-content">
<div class="row"><div class="row-text"><strong>${t('set.buttonSize')}</strong></div>${seg('buttonSize', ['100', '115', '130', '150', '175'], v => t('set.buttonSizePercent', { n: v }))}</div>
<div class="row"><div class="row-text"><strong>${t('set.theme')}</strong></div>${seg('theme', ['dark', 'light', 'system'], v => t('theme.' + v))}</div><div class="row"><div class="row-text"><strong>${t('set.palette')}</strong><span>${t('set.paletteDesc')}</span></div>
        <div class="palette-swatches">${Object.keys(PALETTES).map(id => `<button type="button" data-palette-choice="${id}" class="${on((settings.palette ?? 'classic') === id)}" aria-label="${t('palette.' + id)}" aria-pressed="${(settings.palette ?? 'classic') === id}"><span class="palette-preview" data-preview="${id}" aria-hidden="true"><i>Aa</i></span><span>${t('palette.' + id)}</span></button>`).join('')}</div></div><div class="row"><div class="row-text"><strong>${t('set.accent')}</strong><span>${t('set.accentDesc')}</span></div>
        <div class="swatches">${Object.entries(ACCENTS).map(([name, hex]) =>
    `<button type="button" data-accent="${name}" class="${on(settings.accent === name)}" style="--swatch:${hex}" aria-label="${name}"></button>`).join('')}</div></div><div class="row"><div class="row-text"><strong>${t('set.sound')}</strong><span>${t('set.soundDesc')}</span></div><button type="button" class="toggle ${on(settings.sound)}" data-toggle="sound" role="switch" aria-checked="${settings.sound}" aria-label="${t('set.sound')}"></button></div>
    </div></details>
    <details class="settings-section" data-section="time"${settingsSections.has('time') ? ' open' : ''}><summary><span class="category-icon" aria-hidden="true">${UI_ICONS.playTime}</span><span>${t('set.section.time')}</span><span class="category-arrow" aria-hidden="true">⌄</span></summary><div class="section-content">

      <h2 class="title">${t('set.time')}</h2>
      <div class="row"><div class="row-text"><strong>${t('set.clock')}</strong><span>${t('set.clockDesc')}</span></div><button type="button" class="toggle ${on(settings.showClock)}" data-toggle="showClock" role="switch" aria-checked="${!!settings.showClock}" aria-label="${t('set.clock')}"></button></div>
      <div class="row"><div class="row-text"><strong>${t('set.remind')}</strong><span>${t('set.remindDesc')}</span></div><button type="button" class="toggle ${on(settings.playRemind)}" data-toggle="playRemind" role="switch" aria-checked="${!!settings.playRemind}" aria-label="${t('set.remind')}"></button></div>
      <div class="row" id="rm-row"${settings.playRemind ? '' : ' hidden'}><div class="rm-every"><span>${t('set.every')}</span>
        <input class="input" type="number" inputmode="numeric" id="rm-h" min="0" max="12" value="${Math.floor((settings.remindMin || 90) / 60)}" aria-label="${t('set.hours')}"><span>${t('set.hours')}</span>
        <input class="input" type="number" inputmode="numeric" id="rm-m" min="0" max="59" step="5" value="${(settings.remindMin || 90) % 60}" aria-label="${t('set.minutes')}"><span>${t('set.minutes')}</span></div></div>

    </div></details>
    <details class="settings-section" data-section="online"${settingsSections.has('online') ? ' open' : ''}><summary><span class="category-icon" aria-hidden="true">${UI_ICONS.online}</span><span>${t('set.section.online')}</span><span class="category-arrow" aria-hidden="true">⌄</span></summary><div class="section-content">
<div class="row"><div class="row-text"><label for="my-name"><strong>${t('set.myName')}</strong></label><span>${t('set.myNameDesc')}</span></div>${myNameInput()}</div>${netKinds().includes('bt') ? `<div class="row"><div class="row-text"><strong>${t('set.btRemind')}</strong><span>${t('set.btRemindDesc')}</span></div><button type="button" class="toggle ${on(settings.btRemind)}" data-toggle="btRemind" role="switch" aria-checked="${!!settings.btRemind}" aria-label="${t('set.btRemind')}"></button></div>` : ''}
    </div></details>
    <details class="settings-section" data-section="about"${settingsSections.has('about') ? ' open' : ''}><summary><span class="category-icon" aria-hidden="true">${UI_ICONS.about}</span><span>${t('set.section.about')}</span><span class="category-arrow" aria-hidden="true">⌄</span></summary><div class="section-content">

      <h2 class="title">${t('set.updates')}</h2>
      <div class="row"><div class="row-text"><strong>${t('set.autoCheck')}</strong><span>${t('set.autoCheckDesc')}</span></div><button type="button" class="toggle ${on(settings.updateCheck)}" data-toggle="updateCheck" role="switch" aria-checked="${!!settings.updateCheck}" aria-label="${t('set.autoCheck')}"></button></div>
      <div class="row"><div class="row-text"><strong>${t('set.version', { v: VERSION })}</strong><span id="update-line">${updateLine}</span></div>
        <div class="row-actions">${waiting ? `<button type="button" class="btn btn-primary" id="get">${t('set.get')} <span class="arrow">→</span></button>` : ''}
        <button type="button" class="btn btn-outline" id="check" ${REPO ? '' : 'disabled'}>${t('set.check')}</button>
        <button type="button" class="btn btn-ghost" id="manual" ${REPO ? '' : 'disabled'}>${t('set.manual')}</button></div></div>
      <div class="row"><a class="btn btn-outline" href="#/whatsnew">${t('wn.title')} <span class="arrow">→</span></a></div>

      <h2 class="title">${t('set.about')}</h2>
      <div class="card about">
        <p>${t('set.aboutText')}</p>
        <dl class="kv">
          <dt>${t('set.vocab')}</dt><dd>${t('set.vocabText', { pl: num(dataIndex.counts.pl), en: num(dataIndex.counts.en) })}</dd>
          <dt>${t('set.saves')}</dt><dd>${t('set.savesText')}</dd>
          <dt>${t('set.tiles')}</dt><dd>${t('set.credits')} <a href="data/familiar-sources.txt" target="_blank" rel="noopener">${t('set.wordNotices')}</a> · <a href="data/SCOWL-Copyright.txt" target="_blank" rel="noopener">${t('set.scowlNotice')}</a></dd>
        </dl>
        <details><summary>${t('set.technical')}</summary><dl class="kv"><dt>${t('set.vectors')}</dt><dd>${t('set.vectorsReal', { d: dataIndex.dims })}</dd></dl></details>
      </div>

    </div></details>
  </main>
  <footer class="footer"><span>Lexling v${VERSION}</span>${DOT}<span>© 2026 Husarp</span>${DOT}<span>${t('foot.rights')}</span></footer>
</div>`;
  root.querySelectorAll('[data-section]').forEach(el => el.addEventListener('toggle', () => {
    if (el.open) settingsSections.add(el.dataset.section); else settingsSections.delete(el.dataset.section);
  }));
  wireMyName(root);
  // Save and show the same cleaned limits; invalid edits reset all three (owner, 2026-11-14).
  const tierInputs = [...root.querySelectorAll('[data-rare-tier]')];
  const saveTiers = values => {
    settings.tilesRareTiers = cleanTiers(values);
    saveSettings();
    tierInputs.forEach((input, i) => { input.value = settings.tilesRareTiers[i]; });
  };
  tierInputs.forEach(input => input.addEventListener('change', () => saveTiers(tierInputs.map(el => el.value))));
  root.querySelector('#rare-reset').addEventListener('click', () => saveTiers(RARE_TIERS));
  root.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.k === 'lang') return switchLang(b.dataset.v, refresh);
    settings[b.dataset.k] = b.dataset.v;
    saveSettings();
    if (b.dataset.k === 'theme') applyTheme();
    if (b.dataset.k === 'buttonSize') applyButtonSize();
    refresh();
  }));
  root.querySelectorAll('[data-toggle]').forEach(el => el.addEventListener('click', () => {
    const key = el.dataset.toggle;
    settings[key] = !settings[key];
    saveSettings();
    el.classList.toggle('on', settings[key]);
    el.setAttribute('aria-checked', settings[key]);
    if (key === 'sound') click();
    if (key === 'updateCheck' && settings.updateCheck) checkUpdate();
    if (key === 'showClock') paintClock();
    if (key === 'playRemind') root.querySelector('#rm-row').hidden = !settings.playRemind;
  }));
  root.querySelectorAll('[data-accent]').forEach(el => el.addEventListener('click', () => {
    settings.accent = el.dataset.accent;
    saveSettings();
    applyAccent();
    root.querySelectorAll('[data-accent]').forEach(o => o.classList.toggle('on', o === el));
  }));
  root.querySelectorAll('[data-palette-choice]').forEach(el => el.addEventListener('click', () => {
    settings.palette = el.dataset.paletteChoice;
    saveSettings();
    applyTheme();
    root.querySelectorAll('[data-palette-choice]').forEach(o => {
      o.classList.toggle('on', o === el);
      o.setAttribute('aria-pressed', o === el);
    });
  }));
  // Telling someone an update exists and then leaving them to find it is half an answer, so when one
  // is waiting the button becomes the way to get it: the release page, with the installer and the
  // APK on it. It has to leave the app, and each of the three places this runs needs asking
  // differently - the desktop wrapper through its Python bridge, Android and a browser through the
  // ordinary one, which Capacitor hands to the system browser.
  const open = openUrl;
  // the file for this device (update.js): the APK on Android, the installer on Windows, else the release page
  // on Android the download runs in the app: the menu shows how it goes
  root.querySelector('#get')?.addEventListener('click', async () => { if (await getUpdate()) location.hash = '#/'; });
  // GitHub (was "Check manually" - owner, 2026-09-25: the check sometimes fails): straight to the releases page
  root.querySelector('#manual')?.addEventListener('click', () => open(`https://github.com/${REPO}/releases`));

  // how often the reminder comes: hours and minutes, any mix (owner) - 5 minutes at least
  const every = () => {
    const h = Math.min(12, Math.max(0, parseInt(root.querySelector('#rm-h').value, 10) || 0)), m = Math.min(59, Math.max(0, parseInt(root.querySelector('#rm-m').value, 10) || 0));
    settings.remindMin = Math.max(5, h * 60 + m);
    root.querySelector('#rm-h').value = Math.floor(settings.remindMin / 60);
    root.querySelector('#rm-m').value = settings.remindMin % 60;
    saveSettings();
  };
  root.querySelectorAll('#rm-h, #rm-m').forEach(i => i.addEventListener('change', every));
  const check = root.querySelector('#check');
  check?.addEventListener('click', async () => {
    check.style.width = check.getBoundingClientRect().width + 'px';
    check.disabled = true;
    check.textContent = t('set.checking');
    if (await checkUpdate(true)) return refresh();
    root.querySelector('#update-line').textContent = t('set.failed');
    check.disabled = false;
    check.textContent = t('set.check');
  });
}

// Recent changes, reachable even after the menu notice has been dismissed.
export function whatsnewScreen(root) {
  closeRecentUpdate();
  root.innerHTML = `<div class="app" data-screen="whatsnew">
    ${topbar({ left: `<a class="btn btn-ghost" href="#/settings">${t('wn.back')}</a>` })}
    <main class="main"><h1 class="title">${t('wn.title')}</h1>
      ${whatsnew.map(release => `<section class="group">
        <h2 class="title">${esc(release.version)}</h2><time datetime="${esc(release.date)}">${esc(release.date)}</time>
        <ul class="wn-changes">${changesFor(release, getLang()).map(text => `<li>${esc(text)}</li>`).join('')}</ul>
      </section>`).join('')}
    </main></div>`;
}
