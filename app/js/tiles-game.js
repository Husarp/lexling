// The Tiles game screen (Kafelki, design v5 "Lexling Tiles"): the board, the rack, the tools, the computer's
// turns, the hand-over between people, the panel (history, letters left, check a word), the end and the
// look-back. The rules are tiles.js; finding moves - the computer, hints, the look-back - is tiles-moves.js.
import { t, esc, clock, plural } from './i18n.js';
import { settings, saveSettings, getSave, putSave, gameName, recordTilesEnd, playClock } from './store.js';
import { loadWords, resolve } from './engine.js';
import { has } from './dawg.js';
import { sizeOf, centre, premiums, valueOf, letterSet, placementError, wordsMade, checkMove, apply, canExchange, hinted,
  unseen, undo, loadTileWords, checkWord, fullBag, BLANK } from './tiles.js';
import { hint as bestMove, hintLevels, sameMove, computerMove, lookBack, LEVELS } from './tiles-moves.js';
import { topbar, modeTag, confirmClick, outcome, gearButton, wireGear, meaningButton, wordLink } from './ui.js';
import { fitAll } from './fit.js';
import { click, chime } from './sound.js';

// a bonus square's look and label: d / t = double / triple letter, D / T = double / triple word (tiles.js BOARDS)
export const LABEL = { d: 'l2', t: 'l3', D: 'w2', T: 'w3' };
const svg = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const ICON = {
  shuffle: svg('<path d="m18 14 4 4-4 4"></path><path d="m18 2 4 4-4 4"></path><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22"></path><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"></path><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"></path>'),
  recall: svg('<path d="M9 14 4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"></path>'),
  exchange: svg('<path d="m16 3 4 4-4 4"></path><path d="M20 7H4"></path><path d="m8 21-4-4 4-4"></path><path d="M4 17h16"></path>'),
  pass: svg('<path d="M5 5v14l10-7z"></path><path d="M19 5v14"></path>'),
  hint: svg('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path>'),
  challenge: svg('<path d="M4 22V4"></path><path d="M4 4h12l-2 4 2 4H4"></path>'),
};
const CLOSE = svg('<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>');
const FIND = svg('<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>');
const DOT = '<span class="dot">·</span>';
const ERR = { line: 'tiles.err.line', gap: 'tiles.err.gap', alone: 'tiles.err.touch', centre: 'tiles.err.centre', single: 'tiles.err.single' };
// motion and zoom (design NOTES): the computer "thinks" 900 ms, who-starts shows 1200 ms; the board zooms in on
// the move being built when its squares are under 32 px, and pinches up to 2.5 ×
const THINK_MS = 900, TOAST_MS = 1200, SMALL = 32, AUTO_ZOOM = 2, ZOOM_MAX = 2.5;
const clampPan = (v, z) => Math.min(0, Math.max(-(1 - 1 / z), v));

// How good a move was (owner, 2026-09-26): its points against the best move there was on that board with that rack -
// the best, excellent (85 %+), good (65 %+), fair (40 %+) or weak. No rating when there was no move to make.
const BANDS = [[1, 'best'], [0.85, 'great'], [0.65, 'good'], [0.4, 'fair'], [0, 'weak']];
export const rateOf = (played, best) => best > 0 ? BANDS.find(([k]) => played / best >= k - 1e-9)[1] : null;
const pctOf = (played, best) => Math.min(100, Math.round(played / best * 100));
const rateBadge = (played, best) => { const r = rateOf(played, best); return r ? `<span class="rate rate-${r}">${t('tiles.rate.' + r)} · ${pctOf(played, best)}%</span>` : ''; };

// The bonus squares' look (owner, 2026-09-26): in colour (true), only their labels coloured on a plain square ('text'),
// or one quiet grey (false) - a choice in the gear, History, New game and Settings.
export const BONUS_LOOKS = [[true, 'colour'], ['text', 'text'], [false, 'grey']];
// Player colours (owner, 2026-09-26): each player's tiles tinted (true - as before), the letters in the player's colour on
// yellow tiles ('letters', the design's way) or none (false). A choice in the gear, New game and Settings.
export const COLOUR_LOOKS = [[true, 'tiles'], ['letters', 'letters'], [false, 'off']];
export const coloursSeg = () => `<div class="seg" role="radiogroup">${COLOUR_LOOKS.map(([v, k]) =>
  `<button type="button" data-colours="${v}" class="${settings.tilesColours === v ? 'on' : ''}">${t('tiles.colours.' + k)}</button>`).join('')}</div>`;
export const bonusSeg = () => `<div class="seg" role="radiogroup">${BONUS_LOOKS.map(([v, k]) =>
  `<button type="button" data-bonus="${v}" class="${settings.tilesBonus === v ? 'on' : ''}">${t('tiles.bonus.' + k)}</button>`).join('')}</div>`;
export const bonusOf = v => v === 'true' ? true : v === 'false' ? false : v;

// A player's name as shown: the one typed on New game, or - in the interface language - "You" / "Computer" when
// there is one of the kind, "Player 2" / "Computer 2" when there are several.
export function nameOf(state, p) {
  const x = state.players[p];
  if (x.name) return x.name;
  const kind = y => !y.cpu === !x.cpu, same = state.players.filter(kind).length, k = state.players.slice(0, p + 1).filter(kind).length;
  return x.cpu ? t(same > 1 ? 'tiles.cpuN' : 'tiles.cpu', { n: k }) : t(same > 1 ? 'tiles.playerN' : 'tiles.you', { n: k });
}

// How to play, topic by topic (owner, 2026-09-25): on New game all of them; in a game (the "?") the ones its rules use.
export function topics(rules = null) {
  const keys = ['goal', 'turn', 'points', 'blank', 'swap', 'end'];
  if (!rules || rules.check === 'challenge') keys.push('challenge');
  if (!rules || rules.time) keys.push('clock');
  const legend = `<p class="tl-legend">${['l2', 'l3', 'w2', 'w3'].map(k => `<span><i class="q ${k}">${t('tiles.label.' + k)}</i></span>`).join('')}</p>`;
  return `<div class="tl-topics">${keys.map(k => `<details><summary>${t('howto.tiles.' + k)}<span class="arrow" aria-hidden="true">›</span></summary><p class="help">${
    t(`howto.tiles.${k}.t`)}</p>${k === 'points' ? legend : ''}</details>`).join('')}</div>`;
}

// Check a word (owner, 2026-09-25: any time) - the Check tab of a game's panel.
const checkHtml = () => `<div class="tl-check"><form novalidate><input class="input" type="text" maxlength="20" placeholder="${t('tiles.check.ph')}" aria-label="${
  t('tiles.check')}" autocomplete="off" autocapitalize="none" spellcheck="false"><button class="btn btn-outline" type="submit">${t('tiles.checkTab')}</button></form><p class="res" role="status"></p><div class="mean-slot"></div></div>`;
function wireCheck(box, langOf) {
  const input = box.querySelector('input'), res = box.querySelector('.res');
  box.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!input.value.trim()) return;
    const lang = langOf(), r = checkWord(await loadTileWords(lang), lang, input.value);
    res.className = 'res ' + (r.ok ? 'ok' : 'no');
    res.textContent = t(r.ok ? 'tiles.check.ok' : 'tiles.check.' + r.why, { w: r.word.toUpperCase() });
    // what it means - in the browser (owner, 2026-09-26); a word too short or with a letter no tile has, never
    box.querySelector('.mean-slot').innerHTML = r.why === 'short' || r.why === 'letters' ? '' : meaningButton(r.word, lang);
  });
}

// The board's squares and tiles (design: only bonus / start / marked squares and tiles are elements - plain
// squares are the grid's background). `draft` = this turn's tiles. No points on the board, ever (owner, 2026-09-26) - the
// message line and Play show them.
// `hinted` = squares of tiles already down that belong to a hinted word: they take the hint look too.
function boardInner(S, { draft = [], bad = false, cursor = null, drop = -1, hinted = new Set(), peek = -1 } = {}) {
  const n = sizeOf(S.board), prem = premiums(S.board), mid = centre(S.board);
  const fresh = new Map(draft.map(d => [d.r * n + d.c, d]));
  const at = i => `grid-row:${Math.floor(i / n) + 1};grid-column:${i % n + 1}`;
  let html = '';
  for (let i = 0; i < n * n; i++) {
    const k = LABEL[prem[i]], cur = cursor && i === cursor.r * n + cursor.c, cls = [];
    if (k) cls.push(k);
    if (i === mid) cls.push('st');
    if (cur) cls.push(cursor.down ? 'cur dn' : 'cur');
    if (i === drop) cls.push('drop');
    if (!cls.length) continue;
    const label = k && i !== mid && !cur && i !== drop && !fresh.has(i) ? t('tiles.label.' + k) : '';
    html += `<span class="q ${cls.join(' ')}" style="${at(i)}">${label}</span>`;
  }
  // who put a tile down: its class pN tints it in that player's colour (owner, 2026-09-25: coloured tiles, no frames)
  const tile = (i, ch, blank, cls) => `<b class="t ${cls}${blank ? ' bl' : ''}" data-i="${i}" style="${at(i)}">${esc(ch)}<i class="p">${blank || !ch ? '' : valueOf(S.lang, ch)}</i></b>`;
  S.cells.forEach((x, i) => { if (x) html += tile(i, x.ch, x.blank, (hinted.has(i) ? 'hint' : 'p' + x.by) + (i === peek ? ' peek' : '')); });
  for (const [i, d] of fresh) html += tile(i, d.ch, d.blank, d.hint ? 'hint' : bad ? 'new bad' : 'new');
  return html;
}

export async function tilesGameScreen(root, id) {
  const game = getSave(id);
  let dict = null, lex = null;
  if (game) {
    // the word frequencies matter to a computer that knows fewer words (tiles-moves.js LEVELS) - the Small hint
    // needs them too, but that can wait (below)
    const slow = game.state.players.some(x => x.cpu && LEVELS[x.cpu]?.known !== Infinity);
    try { [dict, lex] = await Promise.all([loadTileWords(game.lang), slow ? loadWords(game.lang) : null]); } catch { dict = null; }
  }
  if (!dict) { location.replace('#/games/tiles'); return; }
  if (location.hash !== '#/game/' + id) return;   // left while the words loaded: a newer screen is up

  let S = game.state;
  const { lang } = S, n = sizeOf(S.board);
  const isWord = w => has(dict, w);
  const rankOf = w => (lex && resolve(lex, w)?.idx) ?? Infinity;
  if (!lex && S.rules.hints !== false) loadWords(lang).then(m => { lex = m; }).catch(() => {});
  const cpu = p => !!S.players[p].cpu;
  const people = S.players.map((x, p) => x.cpu ? -1 : p).filter(p => p >= 0);
  const solo = people.length === 1 ? people[0] : -1;    // one person against computers: their rack is always shown
  const canUndo = solo >= 0 && S.rules.undo === true;   // undo: only one person against the computer (owner)
  // everyone's tiles shown (a rule): the people's racks stay in view, so nobody has to hand the device over
  const open = S.rules.open === true && people.length > 1;
  const desk = matchMedia('(pointer: fine)').matches;
  const abc = [...letterSet(lang).letters].sort((a, b) => a.localeCompare(b, lang));

  let shown = solo;           // whose rack is on screen: -1 = nobody's (between people, or a computer's turn)
  let draft = [];             // this turn's tiles: { slot (in the rack), r, c, ch, blank, hint }
  let sel = -1;               // a rack tile lifted by a tap, to be tapped onto a square
  let mode = 'play';          // 'play', 'exchange' (picking tiles to swap), 'pass' (asking first) or 'hint' (which one)
  let picks = new Set();      // exchange: the rack tiles picked
  let levels = null;          // the three hints for this turn, { small, big, master } (tiles-moves.js hintLevels)
  let cursor = null;          // computer: the square typing goes to, { r, c, down }
  let blankFor = -1;          // the draft tile whose blank letter is being picked
  // 'hist' (tap the scores) / 'unseen' (the bag) / 'check' (the magnifier) / 'guide' (the "?") - each its own panel, no
  // tabs (owner, 2026-09-25); over the board on a phone, beside it when wide (History until another is opened)
  let panel = null;
  let msg = null;             // what just happened, for the message line: { html, err }
  let landing = null;         // squares whose tiles just came down, to animate
  let thinking = false, toast = false, handOver = false, wide = false;
  let zoom = { z: 1, x: 0, y: 0 };      // x / y: the board's shift, in fractions of its size (0 or less)
  let press = null, pinch = null, dragEl = null, dropAt = -1, rackGap = -1;
  const touches = new Map();

  root.innerHTML = `<div class="app fit" data-screen="tiles">
  ${topbar({ left: modeTag('tiles'), right: `<span class="eyebrow">${esc(gameName(game))}</span><button class="btn btn-ghost tl-q" type="button" data-act="guide" aria-label="${t('tiles.guide')}">?</button>` })}
  <main class="main"><div class="tl-play">
    <div class="status"></div>
    <div class="tl-bwrap"><div class="tl-board"><div class="tb"></div></div></div>
    <p class="say" role="status"></p>
    <div class="tl-rack"></div>
    <div class="tl-dock"></div>
    <div class="tl-more"></div>
    <div class="tl-over"></div>
  </div></main>
</div>`;
  const app = root.firstElementChild, main = app.querySelector('main'), play = app.querySelector('.tl-play');
  wireGear(root, [['tilesRate', t('tiles.rate.setting'), t('tiles.rate.settingHelp')], ['tilesColours', t('tiles.colours'), t('tiles.coloursHelp'), COLOUR_LOOKS.map(([v, k]) => [v, t('tiles.colours.' + k)])], ['tiles3d', t('tiles.raised'), t('tiles.raisedHelp')], ['tilesBonus', t('tiles.bonus'), t('tiles.bonusHelp'), BONUS_LOOKS.map(([v, k]) => [v, t('tiles.bonus.' + k)])]],
    () => { if (S.over) return; paintStatus(); paintBoard(); paintMore(); });
  const $ = s => play.querySelector(s);
  const status = $('.status'), boardEl = $('.tl-board'), tb = $('.tb'), say = $('.say'), rackEl = $('.tl-rack'), dock = $('.tl-dock');
  const more = $('.tl-more'), over = $('.tl-over');
  const refit = () => fitAll(root);

  // the board's two colour switches (Settings, New game, the game): players' tiles tinted; bonus squares coloured
  const looks = () => (settings.tilesColours === 'letters' ? ' inks' : settings.tilesColours !== false ? ' own' : '') + (settings.tilesBonus === false ? ' mono' : settings.tilesBonus === 'text' ? ' tint' : '')
    + (settings.tiles3d ? ' raised' : '');
  const myTurn = () => !S.over && !thinking && !toast && !handOver && !cpu(S.turn) && shown === S.turn;
  // The rack in the order its player arranged it (reorder, shuffle): the saved order, then any tiles new to it.
  const rackOf = p => {
    const left = [...S.racks[p]], out = [];
    for (const x of game.order?.[p] ?? []) { const k = left.indexOf(x); if (k >= 0) out.push(left.splice(k, 1)[0]); }
    return [...out, ...left];
  };
  const setOrder = (p, list) => { game.order = S.racks.map((_, i) => i === p ? list : game.order?.[i] ?? []); };
  const inDraft = i => draft.some(d => d.slot === i);
  const free = (r, c, skip = -1) => r >= 0 && c >= 0 && r < n && c < n && !S.cells[r * n + c] && !draft.some((d, j) => j !== skip && d.r === r && d.c === c);
  const placedOf = () => draft.map(({ r, c, ch, blank }) => ({ r, c, ch, blank }));

  // The move as it stands: { error } or { words, score }. With challenges the words go down unchecked, so the
  // screen does not tell either - except for a move that uses the last tiles, which is checked at once.
  function judge() {
    if (!draft.length || draft.some(d => !d.ch)) return null;
    const placed = placedOf(), error = placementError(S, placed);
    if (error) return { error };
    const out = placed.length === S.racks[S.turn].length && !S.bag.length;
    return S.rules.check === 'challenge' && !out ? wordsMade(S, placed) : checkMove(S, placed, isWord);
  }
  // the words a move makes and the points: one word "KOT 5"; several (or the seven-tile bonus) added up -
  // "KOT 5 + TOK 6 = 11" (owner, 2026-09-25)
  const wordsLine = (words, score, all) => {
    const bonus = all && S.rules.bingo, sum = words.length > 1 || bonus;
    return words.map(x => `<b>${esc(x.w)}</b>${sum ? ' ' + x.score : ''}`).join(' + ')
      + (bonus ? ` + ${S.rules.bingo}` : '') + (sum ? ' =' : '') + ` <span class="pts">${score}</span>`;
  };

  // ── painting ──
  function paintStatus() {
    const np = S.players.length;
    // beside each score what that player's last turn brought (owner, 2026-09-25): +23, or +0 for a pass or exchange
    const last = p => { const m = S.moves.findLast(x => x.p === p); return m ? `<small class="delta">+${m.kind === 'play' ? m.score : 0}</small>` : ''; };
    // The scores (design "Lexling Tiles Scores", on top - owner, 2026-09-26): a box per player - a tile badge with the
    // initial, the name, the score - the player to move ringed; the bag a dashed box of its own. With three players or more
    // the boxes scroll sideways, and the row follows the turn: the player to move slides to the front.
    const ini = initials(), tint = settings.tilesColours === true;
    const chip = p => `<button type="button" class="ps pc${p}${!S.over && S.turn === p ? ' on' : ''}" data-open="hist" aria-label="${esc(nameOf(S, p))}: ${S.scores[p]}"><span class="pb${tint ? ' tint' : ''}" aria-hidden="true">${esc(ini[p])}</span><span class="nm">${esc(nameOf(S, p))}</span><span class="sc">${S.scores[p]}${last(p)}${
      thinking && S.turn === p ? `<span class="tl-dots" aria-label="${t('tiles.thinking')}"><i></i><i></i><i></i></span>` : ''}</span></button>`;
    const was = status.querySelector('.ps-row')?.scrollLeft ?? 0;
    status.innerHTML = `<div class="ps-row${np > 2 ? ' many' : ''}">${S.players.map((_, p) => chip(p)).join('')}</div>
      <button class="ps-bag" type="button" data-open="unseen" aria-label="${t('tiles.unseen')}"><span class="nm">${t('tiles.bag')}</span><span class="sc">${S.bag.length}</span></button>
      ${S.rules.time ? `<div class="tl-clock"><span class="eyebrow">${t('tiles.r.time')}</span><span class="num"></span></div>` : ''}
      ${open ? othersHtml() : ''}
      <div class="status-actions"><a class="btn btn-ghost" href="#/games/tiles">${t('game.saveExit')}</a><button class="btn btn-ghost btn-danger" type="button" id="give-up">${t('game.giveUp')}</button>${
        canUndo ? `<button class="btn btn-ghost" type="button" data-act="undo"${undo(S, isWord, 0) ? '' : ' disabled'}>${t('tiles.undo')}</button>` : ''}<button class="btn btn-ghost tl-find" type="button" data-open="check" aria-label="${t('tiles.check')}" title="${t('tiles.check')}">${FIND}</button>${gearButton('tl-find')}</div>`;
    confirmClick(status.querySelector('#give-up'), giveUp, refit);
    paintClock();
    const row = status.querySelector('.ps-row.many'), cur = row?.querySelector('.ps.on');
    if (row) { row.scrollLeft = was; if (cur) row.scrollTo({ left: cur.offsetLeft - row.firstElementChild.offsetLeft, behavior: 'smooth' }); }
  }
  // the badge's letters: a person's initial (two letters when two names start alike: KU, KA); with several computers,
  // each its number (design)
  function initials() {
    const names = S.players.map((_, p) => nameOf(S, p)), cpus = S.players.filter(x => x.cpu).length;
    const first = p => ([...names[p]][0] ?? '?').toUpperCase(), numbered = p => S.players[p].cpu && cpus > 1;
    return S.players.map((x, p) => numbered(p) ? String(S.players.slice(0, p + 1).filter(y => y.cpu).length)
      : S.players.some((_, q) => q !== p && !numbered(q) && first(q) === first(p)) ? [...names[p]].slice(0, 2).join('').toUpperCase() : first(p));
  }
  // Everyone's tiles (the rule): the other people's racks, one row each, always in view - never a computer's.
  const othersHtml = () => `<div class="tl-others">${people.filter(p => p !== shown).map(p => `<div class="tl-other pc${p}"><i aria-hidden="true"></i><span>${esc(nameOf(S, p))}</span><span class="mt-row">${
    rackOf(p).map(x => `<i class="mtl${x === BLANK ? ' bl' : ''}">${x === BLANK ? '' : `${esc(x)}<i class="p">${valueOf(lang, x)}</i>`}</i>`).join('')}</span></div>`).join('')}</div>`;
  // the clock of the player to move: what is left of the move, or of their game (below zero: "−0:42", in red)
  function paintClock() {
    const el = status.querySelector('.tl-clock .num'), T = S.rules.time;
    if (!el) return;
    const p = S.turn, left = T.seconds * 1000 - (T.per === 'game' ? S.clock[p] : 0) - (cpu(p) ? 0 : game.turnMs || 0);
    el.textContent = (left < 0 ? '−' : '') + clock(Math.ceil(Math.abs(left) / 1000) * 1000);
    el.parentElement.classList.toggle('low', left < (T.per === 'move' ? 10000 : 60000));
  }

  function paintBoard() {
    const res = judge(), lifted = press?.drag && press.kind === 'tile' ? press.di : -1;
    const shownDraft = draft.filter((_, i) => i !== lifted);
    tb.className = `tb n${n}${zoom.z > 1 ? ' zoom' : ''}${looks()}`;
    tb.innerHTML = boardInner(S, { draft: shownDraft, bad: !!res?.error, cursor: myTurn() && mode === 'play' ? cursor : null, drop: dropAt, hinted: hintedCells(), peek: peekAt });
    applyZoom(!!(pinch || press?.drag));
    // tiles that just came down settle in, 150 ms each, 60 apart (design: motion)
    landing?.forEach((i, k) => tb.querySelector(`[data-i="${i}"]`)?.animate([{ transform: 'translateY(-35%) scale(1.15)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 150, delay: k * 60, easing: 'ease-out', fill: 'backwards' }));
    landing = null;
  }
  // The zoom is one transform on the board grid, set on it directly (owner, 2026-09-26: "zooming lags a bit"): through the
  // --z / --tx / --ty custom properties every square and tile below restyled on each step, as they inherit them. While the
  // board moves it is a layer of its own (will-change), and once it rests it is drawn sharp again at its new size.
  // A hint shows its whole word in the hint look (owner, 2026-09-26: "when a word is from a hint all its letters should be
  // the hint version"): the tiles already on the board that the word runs through, found along the line of the move.
  function hintedCells() {
    const out = new Set();
    if (!draft[0]?.hint) return out;
    const d0 = draft[0], filled = (r, c) => r >= 0 && c >= 0 && r < n && c < n && (!!S.cells[r * n + c] || draft.some(d => d.r === r && d.c === c));
    const across = draft.length > 1 ? draft.every(d => d.r === d0.r)
      : filled(d0.r, d0.c - 1) || filled(d0.r, d0.c + 1) || !(filled(d0.r - 1, d0.c) || filled(d0.r + 1, d0.c));
    const [dr, dc] = across ? [0, 1] : [1, 0];
    let r = d0.r, c = d0.c;
    while (filled(r - dr, c - dc)) { r -= dr; c -= dc; }
    for (; filled(r, c); r += dr, c += dc) if (S.cells[r * n + c]) out.add(r * n + c);
    return out;
  }
  function applyZoom(instant = false) {
    const tr = `scale(${zoom.z}) translate(${zoom.x * 100}%, ${zoom.y * 100}%)`;
    tb.style.transition = instant ? 'none' : '';
    if (tr === shownZoom) return;
    shownZoom = tr;
    tb.style.willChange = 'transform';
    tb.style.transform = tr;
    tb.classList.toggle('zoom', zoom.z > 1);
    clearTimeout(settle);
    settle = setTimeout(() => { tb.style.willChange = ''; }, instant ? 150 : 260);
  }
  let shownZoom = '', settle = 0;
  tb.style.setProperty('--n', n);
  // Zoomed in on the move being built: the first tile down zooms in when the squares are small, and the view
  // follows the word while it grows (design NOTES "placing on a phone").
  function follow() {
    if (!draft.length || (zoom.z === 1 && boardEl.clientWidth / n >= SMALL)) return;
    if (zoom.z === 1) zoom.z = AUTO_ZOOM;
    const rs = draft.map(d => d.r), cs = draft.map(d => d.c);
    const cr = (Math.min(...rs) + Math.max(...rs) + 1) / 2 / n, cc = (Math.min(...cs) + Math.max(...cs) + 1) / 2 / n;
    zoom = { z: zoom.z, x: clampPan(0.5 / zoom.z - cc, zoom.z), y: clampPan(0.5 / zoom.z - cr, zoom.z) };
  }
  const zoomOut = () => { zoom = { z: 1, x: 0, y: 0 }; };

  function paintSay() {
    let html = '', err = false;
    const res = judge();
    if (mode === 'exchange') html = t('tiles.ex.pick', { n: picks.size });
    else if (mode === 'pass') html = t('tiles.pass.ask');
    else if (mode === 'hint') html = msg?.html ?? t('tiles.hint.pick');
    else if (res?.error) { err = true; html = res.error === 'word' ? t('tiles.err.unknown', { w: esc(res.bad[0].toUpperCase()) }) : t(ERR[res.error]); }
    else if (res) html = (draft[0].hint ? t('tiles.say.hint', { level: t('tiles.hint.' + draft[0].hint) }) + ' ' : '') + wordsLine(res.words, res.score, draft.length === 7);
    else if (msg) { html = msg.html; err = !!msg.err; }
    else if (thinking) html = t('tiles.say.think', { name: esc(nameOf(S, S.turn)) });
    else if (myTurn()) html = sel >= 0 ? t('tiles.say.tap') : !S.cells.some(Boolean) ? t('tiles.say.first')
      : solo >= 0 ? t('tiles.say.turn') : t('tiles.say.turnOf', { name: esc(nameOf(S, S.turn)) });
    say.className = 'say' + (err ? ' err' : '');
    say.innerHTML = html;
  }

  function paintRack() {
    if (shown < 0) { rackEl.innerHTML = '<span class="rt" style="visibility:hidden"></span>'.repeat(7); return; }
    const tiles = rackOf(shown), hintDraft = !!draft[0]?.hint, dragging = press?.drag && press.kind === 'rack';
    let order = tiles.map((_, i) => i).filter(i => hintDraft || !inDraft(i));
    if (dragging && rackGap >= 0) { order = order.filter(i => i !== press.slot); order.splice(rackGap, 0, press.slot); }
    rackEl.innerHTML = order.map(i => {
      const x = tiles[i], cls = ['rt'];
      if (hintDraft && inDraft(i)) cls.push('used');
      if (dragging && press.slot === i) cls.push('gap');
      if (sel === i) cls.push('sel');
      if (picks.has(i)) cls.push('pick');
      return `<span class="${cls.join(' ')}" data-slot="${i}">${x === BLANK ? '' : `${esc(x)}<i class="p">${valueOf(lang, x)}</i>`}${picks.has(i) ? '<i class="ck">✓</i>' : ''}</span>`;
    }).join('');
  }

  function paintDock() {
    const off = !myTurn();
    const tool = (act, cls = '') => `<button class="btn btn-ghost tl-tool${cls ? ' ' + cls : ''}" type="button" data-act="${act}">${ICON[act]}<span class="lbl">${
      t(act === 'challenge' ? 'tiles.chal.button' : 'tiles.' + act)}</span></button>`;
    const cancel = `<button class="btn btn-ghost wide" type="button" data-act="cancel">${t('tiles.cancel')}</button>`;
    if (mode === 'exchange') {
      const ok = picks.size && canExchange(S, picks.size);
      dock.innerHTML = `${cancel}<button class="btn btn-primary play${ok ? '' : ' off'}" type="button" data-act="swap">${t('tiles.exchangeN', { n: picks.size })} <span class="arrow">→</span></button>`;
    } else if (mode === 'hint') {
      dock.innerHTML = ['small', 'big', 'master'].map(l => `<button class="btn btn-outline lvl${levels && fadedWhy(l) ? ' off' : ''}" type="button" data-level="${l}"${levels ? '' : ' disabled'}>${t('tiles.hint.' + l)}</button>`).join('')
        + cancel;
    } else if (mode === 'pass') {
      dock.innerHTML = `${cancel}<button class="btn btn-primary play" type="button" data-act="passYes">${t('tiles.passConfirm')} <span class="arrow">→</span></button>`;
    } else {
      const res = judge(), ok = !off && res && !res.error;
      dock.innerHTML = [
        draft.length ? tool('recall') : tool('shuffle', shown < 0 ? 'off' : ''),
        tool('exchange', off || !canExchange(S, 1) ? 'off' : ''),   // stays tappable to say why (design)
        tool('pass', off ? 'off' : ''),
        S.rules.hints === false ? '' : tool('hint', off ? 'off' : ''),
        !off && S.pending ? tool('challenge', 'chal') : '',
        `<button class="btn btn-primary play${ok ? '' : ' off'}" type="button" data-act="play">${t('tiles.play')}${ok ? ` <span class="num">${res.score}</span>` : ''}</button>`,
      ].join('');
    }
    refit();
  }

  // the panel: history, letters left, check a word - or the guide
  function histHtml() {
    const words = m => m.words.map(x => wordLink(x.w, lang)).join(', ');
    const rows = S.moves.map((m, i) => {
      const quiet = m.kind !== 'play';
      const w = m.kind === 'play' ? words(m) + (m.bingo && S.rules.bingo ? `<small> +${S.rules.bingo}</small>` : '')
        : m.kind === 'swap' ? t('tiles.hist.exchanged', { n: m.n }) : m.kind === 'pass' ? t('tiles.hist.passed')
          : m.kind === 'timeout' ? t('tiles.hist.timeout') : m.kind === 'withdrawn' ? `${words(m)} · ${t('tiles.hist.withdrawn')}`
            : t(m.ok ? 'tiles.hist.challengeWon' : 'tiles.hist.challengeLost');
      const ev = settings.tilesRate !== false && m.kind === 'play' && game.evals?.[i], r = ev && rateOf(m.score, ev.best);
      return `<li class="pc${m.p}${quiet ? ' quiet' : ''}"><span class="i">${i + 1}</span><span class="who" title="${esc(nameOf(S, m.p))}"></span><span class="w">${w}</span><span class="r">${quiet ? '–' : m.score}${
        r ? `<small class="rate rate-${r}">${pctOf(m.score, ev.best)}%</small>` : ''}</span></li>`;
    }).reverse();
    return rows.length ? `<ol class="tl-hist">${rows.join('')}</ol>` : `<p class="help">${t('tiles.hist.empty')}</p>`;
  }
  function unseenHtml() {
    // as the player on screen sees it; with nobody's rack on screen, every tile not on the board
    const view = shown >= 0 ? shown : solo;
    const u = view >= 0 ? unseen(S, view) : unseen({ ...S, racks: [...S.racks, []] }, S.racks.length);
    const total = Object.values(u).reduce((a, b) => a + b, 0);
    const inGame = new Set(fullBag(lang, S.board));
    return `<p class="help">${t('tiles.unseen.head', { n: total, b: S.bag.length, r: total - S.bag.length })}</p><div class="tl-unseen">${[...abc, BLANK].filter(ch => inGame.has(ch)).map(ch =>
      `<span class="us${u[ch] ? '' : ' none'}${ch === BLANK ? ' blank' : ''}"><b>${ch === BLANK ? '' : ch}</b><em>${u[ch] || 0}</em></span>`).join('')}</div>`;
  }
  function paintMore() {
    const input = more.querySelector('.tl-check input'), res = more.querySelector('.tl-check .res');
    const kept = input && { value: input.value, cls: res.className, text: res.textContent, mean: more.querySelector('.tl-check .mean-slot').innerHTML };
    const which = panel ?? (wide ? 'hist' : null);
    let html = '';
    if (which === 'guide') {
      html = `<div class="tl-panel" role="dialog" aria-label="${t('tiles.guide')}"><div class="tl-panel-head"><span class="eyebrow grow">${t('tiles.guide')}</span><button class="btn btn-ghost" type="button" data-act="close">${t('tiles.close')}</button></div>${topics(S.rules)}</div>`;
    } else if (which) {
      const title = t({ hist: 'tiles.history', unseen: 'tiles.unseen', check: 'tiles.check' }[which]);
      html = `<div class="tl-panel" role="dialog" aria-label="${title}"><div class="tl-panel-head"><span class="eyebrow grow">${title}</span>
        <button class="btn btn-ghost tl-x" type="button" data-act="close" aria-label="${t('tiles.close')}">${CLOSE}</button></div>${{ hist: histHtml, unseen: unseenHtml, check: checkHtml }[which]()}</div>`;
    }
    if (wide) html += `<p class="tl-keys">${t('tiles.keys')}</p>`;
    more.innerHTML = html;
    const box = more.querySelector('.tl-check');
    if (box) {
      wireCheck(box, () => lang);
      if (kept) { box.querySelector('input').value = kept.value; box.querySelector('.res').className = kept.cls; box.querySelector('.res').textContent = kept.text; box.querySelector('.mean-slot').innerHTML = kept.mean; }
    }
    refit();
  }

  // over everything: the blank's letters, who starts, the hand-over between people
  function paintOver() {
    let html = '';
    if (blankFor >= 0) {
      const cur = draft[blankFor]?.ch;
      html += `<div class="tl-scrim" data-act="pickCancel"></div><div class="tl-pick" role="dialog"><div class="tl-pick-head"><strong>${t('tiles.blank.title')}</strong><button class="btn btn-ghost" type="button" data-act="pickCancel">${
        t('tiles.cancel')}</button></div><div class="abc">${abc.map(ch => `<button type="button" data-ch="${ch}" class="${ch === cur ? 'on' : ''}">${ch}</button>`).join('')}</div><p class="help">${t('tiles.blank.help')}</p></div>`;
    }
    if (toast) {
      const first = S.start.first;
      html += `<div class="tl-toast" role="status">${game.firstSet ? '' : `<span class="eyebrow">${t('tiles.drawn')}</span>`}<strong>${first === solo ? t('tiles.youStart') : t('tiles.starts', { name: esc(nameOf(S, first)) })}</strong></div>`;
    }
    if (handOver) {
      html += `<div class="tl-hand pc${S.turn}" role="dialog"><i class="dot-big" aria-hidden="true"></i><strong>${t('tiles.hand.title', { name: esc(nameOf(S, S.turn)) })}</strong><p class="help">${
        t('tiles.hand.help')}</p><button class="btn btn-primary" type="button" data-act="show">${t('tiles.hand.show')} <span class="arrow">→</span></button></div>`;
    }
    over.innerHTML = html;
    play.classList.toggle('tl-hidden', handOver);
    refit();
  }

  const paintTurn = () => { paintBoard(); paintSay(); paintRack(); paintDock(); };
  const paintAll = () => { paintStatus(); paintTurn(); paintMore(); paintOver(); };

  // ── turns ──
  function resetTurn() {
    draft = []; sel = -1; mode = 'play'; picks = new Set(); levels = null; cursor = null; blankFor = -1;
    zoomOut();
  }
  // Every action goes through here: into the engine (apply), the save, what the message line says, the next turn.
  function act(action) {
    const p = S.turn, before = S;
    if (!cpu(p)) action = { ...action, ms: game.turnMs || 0 };
    // the best move there was this turn - for rating it (settings: "Rate my moves"; History)
    const top = ['place', 'exchange', 'pass', 'timeout'].includes(action.type) ? bestMove(S, dict) : undefined;
    try { S = apply(S, action, isWord); } catch (e) { msg = { html: esc(e.message), err: true }; paintSay(); return false; }
    game.state = S;
    game.turnMs = 0;
    // game.evals lines up with S.moves: { best, word } for a turn a player took, null for anything else
    game.evals = (game.evals ?? []).slice(0, before.moves.length);
    if (S.moves.length > before.moves.length) game.evals[S.moves.length - 1] = top === undefined ? null : { best: top?.score ?? 0, word: top?.word ?? '' };
    resetTurn();
    // no points bubble on the board after a move (owner, 2026-09-25) - the message line says what was played
    const m = S.moves.at(-1);
    if (action.type === 'place' && m && S.moves.length > before.moves.length) {
      landing = [...m.placed].sort((a, b) => a.r - b.r || a.c - b.c).map(x => x.r * n + x.c);
    }
    // a challenge's outcome, or a turn lost to the clock, stays on the line while the next player moves
    const said = report(action, p, game.evals.at(-1));
    msg = msg?.keep && said && action.type !== 'challenge' ? { ...said, html: `${msg.html} ${said.html}` } : said;
    if (S.over) { finish(); return true; }
    putSave(game);
    next();
    return true;
  }
  function report(action, p, ev) {
    const name = esc(nameOf(S, p)), m = S.moves.at(-1);
    // a person's own turn, rated (the setting): it stays on the line while the computer answers
    const rate = !cpu(p) && settings.tilesRate !== false && ev?.best > 0 ? rated(action.type === 'place' ? m.score : 0, ev) : '';
    if (action.type === 'place') return { html: `${t('tiles.say.played', { name })} ${wordsLine(m.words, m.score, m.bingo)}${rate}`, keep: !!rate };
    if (rate && (action.type === 'exchange' || action.type === 'pass')) return { html: `${t(action.type === 'exchange' ? 'tiles.say.swapped' : 'tiles.say.passed', { name, n: action.tiles?.length })}${rate}`, keep: true };
    if (action.type === 'exchange') return { html: t('tiles.say.swapped', { name, n: action.tiles.length }) };
    if (action.type === 'pass') return { html: t('tiles.say.passed', { name }) };
    if (action.type === 'timeout') return { html: t('tiles.say.timeout'), keep: true };
    if (action.type === 'challenge') {
      if (!m.ok) return { html: p === solo ? t('tiles.chal.okYou') : t('tiles.chal.ok', { name }) };
      const w = esc(S.moves.at(-2).bad[0].toUpperCase());
      return { html: cpu(p) ? t('tiles.chal.cpu', { name, w }) : t('tiles.chal.gone', { w }), err: true, keep: true };
    }
    return null;
  }
  const rated = (played, ev) => ` ${played ? rateBadge(played, ev.best) : ''}${played < ev.best ? ` <small class="best-was">${t('tiles.rate.bestWas', { w: esc(ev.word.toUpperCase()), n: ev.best })}</small>` : ''}`;
  // Whose turn now: a computer thinks; between people the device changes hands first, the rack hidden.
  function next() {
    if (S.over) return;
    const p = S.turn;
    if (cpu(p)) { shown = solo; thinking = true; paintAll(); think(); return; }
    if (solo < 0 && !open && shown !== p) { handOver = true; shown = -1; } else shown = p;
    paintAll();
  }
  // The computer's turn: three dots on its side for ~900 ms (longer if it needs it), then its tiles land.
  function think() {
    const at = S, p = S.turn, started = Date.now();
    setTimeout(() => {
      if (!app.isConnected || S !== at) return;
      let action = null;
      try { action = computerMove(S, dict, S.players[p].cpu, rankOf); } catch { /* it passes */ }
      const took = Date.now() - started;
      setTimeout(() => {
        if (!app.isConnected || S !== at) return;
        thinking = false;
        if (!act({ ...(action ?? { type: 'pass' }), ms: took })) act({ type: 'pass', ms: took });
      }, Math.max(0, THINK_MS - took));
    }, 60);
  }
  function finish() {
    thinking = false;
    game.status = 'over';
    recordTilesEnd(S, game.id);
    if (S.over.winner >= 0 && !cpu(S.over.winner)) chime();
    paintEnd();
  }
  // Give up ends the game for everyone (tiles.js): the person to move gives up - or, on a computer's turn, the
  // one person playing (the first of several).
  function giveUp() {
    if (S.over) return;
    thinking = false;
    act({ type: 'resign', p: !cpu(S.turn) ? S.turn : solo >= 0 ? solo : people[0] ?? S.turn });
  }

  // ── the tools ──
  const quiet = () => { draft = []; sel = -1; cursor = null; blankFor = -1; zoomOut(); };
  const TOOLS = {
    shuffle() {
      if (shown < 0 || draft.length) return;
      const list = rackOf(shown);
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      setOrder(shown, list);
      sel = -1;
      paintRack();
      rackEl.querySelectorAll('.rt').forEach(el => el.animate([{ transform: 'scale(.85)', opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' }));
    },
    recall() { quiet(); paintTurn(); paintOver(); },
    exchange() {
      if (!myTurn()) return;
      if (!canExchange(S, 1)) {
        msg = { html: S.bag.length ? t('tiles.ex.off', { n: S.bag.length }) : t('tiles.ex.offAny'), err: true };
        return paintSay();
      }
      quiet();
      mode = 'exchange';
      picks = new Set();
      paintTurn();
    },
    pass() { if (!myTurn()) return; quiet(); mode = 'pass'; paintTurn(); },
    // Hint (owner, 2026-09-25): three levels - Small, Big, Master (tiles-moves.js hintLevels) - picked on the tool row;
    // the move goes straight onto the board as dashed tiles, in its place, with its points: Play plays it, Recall takes
    // it back. A level that would show the same move as a smaller one is faded, and says so when tapped.
    hint() {
      if (!myTurn() || S.rules.hints === false) return;
      quiet();
      msg = { html: t('tiles.hint.wait') };
      mode = 'hint';
      levels = null;
      paintTurn();
      const at = S;
      setTimeout(() => {         // let "…" show first: Master takes a moment
        if (!app.isConnected || S !== at || mode !== 'hint') return;
        levels = hintLevels(S, dict, rankOf);
        msg = levels.big ? null : { html: t('tiles.say.noMove') };
        if (!levels.big) mode = 'play';
        paintTurn();
      }, 30);
    },
    challenge() { if (myTurn() && S.pending) { quiet(); act({ type: 'challenge' }); } },
    play() {
      const res = judge();
      if (myTurn() && res && !res.error) act({ type: 'place', placed: placedOf() });
    },
    cancel() { mode = 'play'; picks = new Set(); levels = null; msg = null; paintTurn(); },
    swap() {
      if (!myTurn() || !picks.size || !canExchange(S, picks.size)) return;
      const tiles = rackOf(shown);
      act({ type: 'exchange', tiles: [...picks].map(i => tiles[i]) });
    },
    passYes() { if (myTurn()) act({ type: 'pass' }); },
    // Undo (the game's rules, one person against the computer): back to the person's last turn, the computer's
    // replies off too, the bag shuffled again (tiles.js undo). Also while the computer thinks.
    undo() {
      const back = canUndo && !S.over && undo(S, isWord);
      if (!back) return;
      S = back;
      game.state = S;
      game.evals = (game.evals ?? []).slice(0, S.moves.length);
      game.turnMs = 0;
      thinking = false;
      resetTurn();
      msg = { html: t('tiles.say.undone') };
      putSave(game);
      next();
    },
    guide() { if (!S.over) { panel = panel === 'guide' ? null : 'guide'; paintMore(); } },
    close() { panel = null; paintMore(); },
    show() { handOver = false; shown = S.turn; paintAll(); },
    pickCancel() {
      if (draft[blankFor] && !draft[blankFor].ch) draft.splice(blankFor, 1);   // a blank with no letter goes back
      blankFor = -1;
      paintOver();
      paintTurn();
    },
  };
  // why a hint level is faded - it would show the same move as a smaller one, or (Small) there is no common-word move
  function fadedWhy(level) {
    const { small, big, master } = levels, same = (a, b) => t('tiles.hint.same', { a: t('tiles.hint.' + a), b: t('tiles.hint.' + b) });
    if (level === 'small') return small ? null : t('tiles.hint.noSmall');
    if (level === 'big') return sameMove(big, small) ? same('big', 'small') : null;
    return sameMove(master, big) ? same('master', 'big') : sameMove(master, small) ? same('master', 'small') : null;
  }
  function pickHint(level) {
    if (!myTurn() || mode !== 'hint' || !levels) return;
    const why = fadedWhy(level);
    if (why) { msg = { html: why }; return paintSay(); }
    const tiles = rackOf(shown), used = new Set();
    draft = levels[level].placed.map(x => {
      const slot = tiles.findIndex((y, i) => !used.has(i) && y === (x.blank ? BLANK : x.ch));
      used.add(slot);
      return { slot, r: x.r, c: x.c, ch: x.ch, blank: x.blank, hint: level };
    });
    mode = 'play'; levels = null; msg = null; sel = -1; cursor = null;
    S = hinted(S);             // one hint, whichever level
    game.state = S;
    putSave(game);
    follow();
    paintTurn();
  }
  function pickLetter(ch) {
    if (blankFor < 0 || !draft[blankFor]) return;
    draft[blankFor].ch = ch;
    blankFor = -1;
    paintOver();
    paintTurn();
  }

  // ── placing: tap, drag, type ──
  function placeAt(slot, r, c, typed = '') {
    if (!myTurn() || mode !== 'play' || !free(r, c)) return;
    if (draft[0]?.hint) draft = [];     // the hint's word makes way for the player's own
    const x = rackOf(shown)[slot];
    draft.push({ slot, r, c, ch: x === BLANK ? typed : x, blank: x === BLANK });
    sel = -1; msg = null;
    click();
    follow();
    if (x === BLANK && !typed) openPicker(draft.length - 1);
    paintTurn();
  }
  // The blank's letters. A phone also sends the tap that opened them as a click, a moment later - onto the
  // picker's backdrop (= Cancel) or a letter, right under the finger - so clicks there are ignored at first.
  let pickOpened = 0;
  function openPicker(di) { blankFor = di; pickOpened = Date.now(); paintOver(); }
  app.addEventListener('click', e => {
    if (Date.now() - pickOpened < 600 && e.target.closest('.tl-scrim, .tl-pick')) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  function unplace(di) { draft.splice(di, 1); paintTurn(); }
  function reorder(slot, gap) {
    const tiles = rackOf(shown), vis = tiles.map((_, i) => i).filter(i => !inDraft(i) && i !== slot);
    vis.splice(gap, 0, slot);
    setOrder(shown, [...vis, ...draft.map(d => d.slot)].map(i => tiles[i]));
    draft.forEach((d, j) => { d.slot = vis.length + j; });
    sel = -1;
    putSave(game);
  }

  // the square under a point on the screen, through the zoom - or null off the board
  function squareAt(x, y) {
    const box = boardEl.getBoundingClientRect(), fx = (x - box.left) / box.width, fy = (y - box.top) / box.height;
    if (fx < 0 || fy < 0 || fx >= 1 || fy >= 1) return null;
    return { r: Math.floor((fy / zoom.z - zoom.y) * n), c: Math.floor((fx / zoom.z - zoom.x) * n) };
  }
  const overRack = (x, y) => { const b = rackEl.getBoundingClientRect(); return x >= b.left - 8 && x <= b.right + 8 && y >= b.top - 20 && y <= b.bottom + 20; };
  function gapAt(x) {
    let best = 0, d = Infinity;
    [...rackEl.children].forEach((el, k) => { const b = el.getBoundingClientRect(), dd = Math.abs(b.left + b.width / 2 - x); if (dd < d) { d = dd; best = k; } });
    return best;
  }

  function startDrag() {
    const tiles = rackOf(shown), x = press.kind === 'rack' ? tiles[press.slot] : draft[press.di].blank ? BLANK : draft[press.di].ch;
    const ch = press.kind === 'tile' ? draft[press.di].ch : x === BLANK ? '' : x;
    dragEl = document.createElement('span');
    dragEl.className = 'tl-drag';
    dragEl.innerHTML = `${esc(ch)}<i>${x === BLANK ? '' : valueOf(lang, x)}</i>`;
    play.append(dragEl);
  }
  function moveDrag(x, y) {
    const pb = play.getBoundingClientRect();
    dragEl.style.setProperty('--x', x - pb.left + 'px');
    dragEl.style.setProperty('--y', y - pb.top + 'px');
    // near the edge of a zoomed board, the board pans
    if (zoom.z > 1) {
      const b = boardEl.getBoundingClientRect(), fx = (x - b.left) / b.width, fy = (y - b.top) / b.height;
      if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
        const dx = fx < 0.08 ? 0.02 : fx > 0.92 ? -0.02 : 0, dy = fy < 0.08 ? 0.02 : fy > 0.92 ? -0.02 : 0;
        if (dx || dy) { zoom = { ...zoom, x: clampPan(zoom.x + dx, zoom.z), y: clampPan(zoom.y + dy, zoom.z) }; applyZoom(true); }
      }
    }
    const sq = myTurn() ? squareAt(x, y) : null;
    const drop = sq && free(sq.r, sq.c, press.kind === 'tile' ? press.di : -1) ? sq.r * n + sq.c : -1;
    if (drop !== dropAt) { dropAt = drop; paintBoard(); }
    const gap = press.kind === 'rack' && overRack(x, y) ? gapAt(x) : -1;
    if (gap !== rackGap) { rackGap = gap; paintRack(); }
  }
  function tap(p) {
    if (p.kind === 'rack') {
      if (mode === 'exchange') { if (picks.has(p.slot)) picks.delete(p.slot); else picks.add(p.slot); return; }
      if (mode === 'play') { sel = sel === p.slot ? -1 : p.slot; cursor = null; }
      return;
    }
    if (p.kind === 'tile') {
      if (draft[p.di].blank) openPicker(p.di); else unplace(p.di);
      return;
    }
    const sq = p.cell;
    if (sq && S.cells[sq.r * n + sq.c]) return peek(sq.r * n + sq.c);
    if (!sq || !myTurn() || mode !== 'play' || !free(sq.r, sq.c)) return;
    if (sel >= 0) return placeAt(sel, sq.r, sq.c);
    // a computer: click a square to type there, again to turn across ↔ down
    if (desk) cursor = cursor && cursor.r === sq.r && cursor.c === sq.c ? { ...cursor, down: !cursor.down } : { r: sq.r, c: sq.c, down: cursor?.down ?? false };
  }
  // A tile tapped on the board fades for a moment and shows the square under it - a bonus or a plain one (owner, 2026-09-26:
  // "click a letter to see if there is a bonus under it"). Any time, whoever's turn it is.
  let peekAt = -1, peekTimer = 0;
  function peek(i) {
    peekAt = i;
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { peekAt = -1; if (app.isConnected && !S.over) paintBoard(); }, 1500);
    paintBoard();
  }
  function drop(p, x, y) {
    const sq = squareAt(x, y);
    if (p.kind === 'rack') {
      if (sq && myTurn() && mode === 'play' && free(sq.r, sq.c)) return placeAt(p.slot, sq.r, sq.c);
      if (rackGap >= 0) reorder(p.slot, rackGap);
      return;
    }
    if (sq && free(sq.r, sq.c, p.di)) { draft[p.di] = { ...draft[p.di], r: sq.r, c: sq.c }; follow(); }
    else if (overRack(x, y)) draft.splice(p.di, 1);
  }

  play.addEventListener('pointerdown', e => {
    if (toast) { endToast(); return; }
    if (panel && !wide && !e.target.closest('.tl-panel, [data-open]')) { panel = null; paintMore(); return; }   // a tap outside closes it
    if (e.target.closest('button, a, input, .tl-panel, .tl-pick, .tl-hand, .tl-scrim')) return;
    const onBoard = !!e.target.closest('.tl-board'), rt = e.target.closest('.rt[data-slot]');
    if (onBoard && e.pointerType === 'touch') {
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size === 2) { startPinch(); return; }
    }
    if (!e.isPrimary || (!onBoard && !rt) || rt?.classList.contains('used')) return;
    const cell = onBoard ? squareAt(e.clientX, e.clientY) : null;
    const di = cell ? draft.findIndex(d => d.r === cell.r && d.c === cell.c) : -1;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false, cell, di, slot: rt ? +rt.dataset.slot : -1, pan: { ...zoom },
      kind: rt ? 'rack' : di >= 0 && myTurn() && !draft[di].hint ? 'tile' : 'board' };
    try { play.setPointerCapture(e.pointerId); } catch { /* not a real pointer (tests) */ }
    e.preventDefault();
  });
  play.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch) return movePinch();
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.drag && Math.hypot(dx, dy) < 8) return;
    if (press.kind === 'board') {
      // one finger pans a zoomed board
      if (zoom.z === 1) return;
      press.drag = true;
      const b = boardEl.getBoundingClientRect();
      zoom = { ...zoom, x: clampPan(press.pan.x + dx / b.width / zoom.z, zoom.z), y: clampPan(press.pan.y + dy / b.height / zoom.z, zoom.z) };
      return applyZoom(true);
    }
    if (mode !== 'play') return;
    if (!press.drag) {
      press.drag = true;
      sel = -1;
      if (press.kind === 'rack' && draft[0]?.hint) draft = [];
      startDrag();
      paintTurn();
    }
    moveDrag(e.clientX, e.clientY);
  });
  const release = (e, cancelled) => {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) { pinch = null; applyZoom(); } return; }
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    if (!cancelled) {
      if (!p.drag) tap(p);
      else if (p.kind !== 'board') drop(p, e.clientX, e.clientY);
    }
    press = null;
    dragEl?.remove();
    dragEl = null;
    dropAt = -1;
    rackGap = -1;
    paintTurn();
  };
  play.addEventListener('pointerup', e => release(e, false));
  play.addEventListener('pointercancel', e => release(e, true));

  // pinch, 1 × to 2.5 ×, about the point between the fingers (design: no double-tap zoom)
  function startPinch() {
    const [a, b] = [...touches.values()];
    press = null;
    dragEl?.remove();
    dragEl = null;
    dropAt = -1;
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ...zoom };
  }
  let pinchFrame = 0;
  const movePinch = () => { pinchFrame ||= requestAnimationFrame(() => { pinchFrame = 0; pinchStep(); }); };
  function pinchStep() {
    if (!pinch || touches.size < 2) return;
    const [a, b] = [...touches.values()], box = boardEl.getBoundingClientRect();
    const z = Math.min(ZOOM_MAX, Math.max(1, pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d));
    const u = (pinch.m[0] - box.left) / box.width / pinch.z - pinch.x, v = (pinch.m[1] - box.top) / box.height / pinch.z - pinch.y;
    const mx = ((a[0] + b[0]) / 2 - box.left) / box.width, my = ((a[1] + b[1]) / 2 - box.top) / box.height;
    zoom = z === 1 ? { z: 1, x: 0, y: 0 } : { z, x: clampPan(mx / z - u, z), y: clampPan(my / z - v, z) };
    applyZoom(true);
  }

  app.addEventListener('click', e => {
    const el = e.target.closest('[data-act], [data-open], [data-ch], [data-level]');
    if (!el || S.over) return;
    if (el.dataset.open) {
      panel = !wide && panel === el.dataset.open ? null : el.dataset.open;
      paintMore();
      if (panel === 'check') more.querySelector('.tl-check input')?.focus();   // ready to type
      return;
    }
    if (el.dataset.ch) return pickLetter(el.dataset.ch);
    if (el.dataset.level) return pickHint(el.dataset.level);
    TOOLS[el.dataset.act]?.();
  });
  // A button pressed with the pointer does not take the focus: Enter would press it again instead of playing.
  app.addEventListener('pointerdown', e => { if (e.target.closest('.tl-dock button, .status button')) e.preventDefault(); });

  // A computer keyboard: click a square, then type from the rack; the cursor skips tiles already down.
  // ← → across, ↑ ↓ down, Backspace takes the last tile back, Enter plays, Esc recalls (then leaves, main.js).
  function onKey(e) {
    if (!app.isConnected || e.defaultPrevented || S.over) return;
    if (e.target.closest?.('input, textarea')) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a')) return;
    if (e.metaKey || ((e.ctrlKey || e.altKey) && !e.getModifierState?.('AltGraph'))) return;
    if (toast) endToast();
    const ch = e.key.length === 1 ? e.key.toLowerCase() : '';
    if (blankFor >= 0) {
      if (letterSet(lang).values[ch]) { e.preventDefault(); pickLetter(ch); } else if (e.key === 'Escape') { e.preventDefault(); TOOLS.pickCancel(); }
      return;
    }
    if (e.key === 'Escape') {
      if (panel && !wide) { e.preventDefault(); panel = null; return paintMore(); }
      if (draft.length || cursor || sel >= 0 || mode !== 'play') { e.preventDefault(); mode = 'play'; picks = new Set(); levels = null; msg = null; TOOLS.recall(); }
      return;
    }
    if (!myTurn() || mode !== 'play') return;
    const down = { ArrowLeft: false, ArrowRight: false, ArrowUp: true, ArrowDown: true }[e.key];
    if (down !== undefined && cursor) { e.preventDefault(); cursor = { ...cursor, down }; return paintBoard(); }
    if (e.key === 'Enter') { e.preventDefault(); return TOOLS.play(); }
    if (e.key === 'Backspace' && draft.length) {
      e.preventDefault();
      const d = draft.pop();
      cursor = { r: d.r, c: d.c, down: cursor?.down ?? false };
      return paintTurn();
    }
    if (!cursor || !letterSet(lang).values[ch]) return;
    const tiles = rackOf(shown);
    if (draft[0]?.hint) draft = [];
    let slot = tiles.findIndex((x, i) => x === ch && !inDraft(i));
    if (slot < 0) slot = tiles.findIndex((x, i) => x === BLANK && !inDraft(i));
    if (slot < 0) return;
    e.preventDefault();
    const { r, c } = cursor;
    let nr = r, nc = c;
    do { if (cursor.down) nr++; else nc++; } while (nr < n && nc < n && !free(nr, nc));
    placeAt(slot, r, c, ch);
    cursor = nr < n && nc < n && free(nr, nc) ? { r: nr, c: nc, down: cursor.down } : null;
    paintBoard();
  }

  // ── the end ──
  function paintEnd() {
    app.classList.remove('fit');
    app.querySelector('.tl-q')?.remove();
    const o = S.over, np = S.players.length, whose = people.length ? people : S.players.map((_, p) => p);
    const inPlay = p => !(o.reason === 'resign' && p === o.by);
    const best = Math.max(...S.scores.filter((_, p) => inPlay(p)));
    let tone, what, pts;
    if (solo >= 0) {
      pts = S.scores[solo];
      [tone, what] = !inPlay(solo) ? ['lost', t('tiles.end.gaveUp')] : o.winner === solo ? ['won', t('tiles.end.won')]
        : o.winner < 0 && pts === best ? ['draw', t('tiles.end.draw')] : ['lost', t('tiles.end.lost')];
    } else {
      pts = o.winner >= 0 ? S.scores[o.winner] : best;
      [tone, what] = o.winner >= 0 ? ['won', t('tiles.end.wins', { name: esc(nameOf(S, o.winner)) })] : ['draw', t('tiles.end.draw')];
    }
    const head = tone === 'draw'
      ? `<div class="outcome draw" role="status"><span class="mark" aria-hidden="true">=</span><span class="what">${what}</span><span class="count">${pts}<small>${t('tiles.end.pts')}</small></span></div>`
      : outcome(tone === 'won', what, pts, t('tiles.end.pts'));
    const order = S.players.map((_, p) => p).sort((a, b) => S.scores[b] - S.scores[a]);
    const scores = np === 2
      ? `<div class="tl-fs">${[0, 1].map(p => `<span class="${S.scores[p] < best || !inPlay(p) ? 'lose' : ''}"><small class="eyebrow">${esc(nameOf(S, p))}</small><b>${S.scores[p]}</b></span>`).join('<span class="colon">:</span>')}</div>`
      : `<ol class="tl-places">${order.map((p, k) => `<li class="pc${p}${S.scores[p] === best && inPlay(p) ? ' first' : ''}"><span>${k + 1}.</span><i></i><span>${esc(nameOf(S, p))}</span><b>${S.scores[p]}</b></li>`).join('')}</ol>`;
    // what the leftover tiles did to the scores (and the clock, per game)
    const sign = v => v > 0 ? '+' + v : v < 0 ? '−' + -v : '0';
    const why = o.reason === 'out' ? (o.by === solo ? t('tiles.end.outYou') : t('tiles.end.out', { name: esc(nameOf(S, o.by)) }))
      : o.reason === 'passes' ? t('tiles.end.passes') : t('tiles.end.stopped');
    const adjust = o.reason === 'resign' ? '' : ' ' + S.players.map((_, p) => `${esc(nameOf(S, p))} ${sign(o.adjust[p] + o.late[p])}`).join(' · ');
    const late = o.late.map((v, p) => v ? t('tiles.end.late', { name: esc(nameOf(S, p)), n: v }) : '').filter(Boolean).join(' · ');
    // the best word of the game, in tiles (a blank pale, no points)
    const top = S.moves.filter(m => m.kind === 'play' && whose.includes(m.p)).reduce((a, m) => !a || m.score > a.score ? m : a, null);
    const tilesOf = m => {
      const blanks = {};
      m.placed.forEach(x => { if (x.blank) blanks[x.ch] = (blanks[x.ch] || 0) + 1; });
      return [...m.words[0].w].map(ch => { const b = blanks[ch] > 0 && blanks[ch]--; return `<i class="mtl${b ? ' bl' : ''}">${esc(ch)}<i class="p">${b ? '' : valueOf(lang, ch)}</i></i>`; }).join('');
    };
    const bingos = S.moves.filter(m => m.kind === 'play' && m.bingo && whose.includes(m.p)).length, hints = whose.reduce((s, p) => s + S.hints[p], 0);
    const levels = [...new Set(S.players.filter(x => x.cpu).map(x => t('diff.' + x.cpu)))].join(', ');
    main.innerHTML = `${head}
    <div class="card result ${tone}">
      <span class="eyebrow">${t('tiles.end.final')}</span>
      ${scores}
      <p class="calc">${why}${adjust}${late ? '<br>' + late : ''}</p>
      ${top ? `<div class="tl-best"><span class="eyebrow">${t('tiles.end.bestWord')}</span><span class="mt-row">${tilesOf(top)}</span><span class="num">${top.score}</span></div>` : ''}
      <div class="result-stats"><span><b>${bingos}</b> ${plural(bingos, 'tiles.end.bingos')}</span>${DOT}<span><b>${hints}</b> ${plural(hints, 'tiles.end.hints')}</span>${DOT}<span>${[t('tiles.board.' + S.board), levels].filter(Boolean).join(' · ')}</span></div>
      <div class="result-actions"><a class="btn btn-primary" href="#/new/tiles">${t('lt.again')} <span class="arrow">→</span></a><a class="btn btn-ghost" href="#/">${t('menu')}</a></div>
    </div>
    <div class="tl-final"><div class="tl-board"><div class="tb n${n}${looks()}" style="--n:${n}">${boardInner(S)}</div></div></div>
    <div class="card tl-look" hidden></div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refit();
    // How the game went (the owner's plan, 2026-09-26 for every player): each player's points against the best there
    // was, then every turn - who, what, its rating, the best move. It replays the game, so it comes a moment after the rest.
    setTimeout(() => {
      const box = main.querySelector('.tl-look');
      if (!box?.isConnected) return;
      let rows;
      try { rows = lookBack(S, dict, true); } catch { return; }
      if (!rows.length) return;
      const sum = (p, k) => rows.filter(x => x.p === p).reduce((a, x) => a + (k === 'best' ? x.best?.score ?? 0 : x.played), 0);
      const overall = S.players.map((_, p) => { const best = sum(p, 'best'), got = sum(p, 'played'), r = rateOf(got, best);
        return `<li class="pc${p}"><i></i><span>${esc(nameOf(S, p))}</span>${r ? `<span class="rate rate-${r}">${t('tiles.rate.' + r)} · ${pctOf(got, best)}%</span>` : '<span>—</span>'}</li>`; }).join('');
      box.innerHTML = `<span class="eyebrow">${t('tiles.eval')}</span><ul class="tl-evals">${overall}</ul><p class="help">${t('tiles.eval.help')}</p><ol><li class="head"><span></span><span>${t('tiles.look.played')}</span><span>${t('tiles.look.best')}</span></li>${rows.map((x, k) => {
        const same = !x.best || x.played >= x.best.score;
        const played = x.kind === 'place' ? `${esc(x.word)} <small>${x.played}</small>` : `<small>${t(x.kind === 'exchange' ? 'tiles.look.swap' : 'tiles.look.pass')}</small>`;
        return `<li class="pc${x.p}${same ? ' same' : ''}"><span class="i">${k + 1}</span><span class="w"><i class="dot" title="${esc(nameOf(S, x.p))}"></i>${played}${x.best ? ' ' + rateBadge(x.played, x.best.score) : ''}</span><span class="best"><span class="w">${
          x.best ? `${esc(x.best.word)} <small>${x.best.score}</small>` : '—'}</span></span></li>`;
      }).join('')}</ol>`;
      box.hidden = false;
    }, 60);
  }

  // ── start ──
  function endToast() { if (!toast) return; toast = false; if (app.isConnected) next(); }
  wide = app.clientWidth >= 900;
  const resize = new ResizeObserver(() => {
    if (!app.isConnected) return resize.disconnect();
    if ((app.clientWidth >= 900) !== wide && !S.over) { wide = !wide; paintMore(); }
  });
  resize.observe(app);
  // the time a person takes: counted only while it is their turn on screen (the clock, per move or per game)
  const tick = setInterval(() => {
    if (!app.isConnected) return clearInterval(tick);
    if (!myTurn() || document.visibilityState !== 'visible') return;
    game.turnMs = (game.turnMs || 0) + 1000;
    const T = S.rules.time;
    if (!T) return;
    paintClock();
    if (T.per === 'move' && game.turnMs >= T.seconds * 1000) { quiet(); act({ type: 'timeout' }); }
  }, 1000);

  if (S.over) finish();                                   // never saved like this; a safeguard
  else if (!S.log.length && !game.toasted) {
    // who starts (drawn at random, or chosen on New game): a card over the board for 1.2 s or until the first tap
    game.toasted = true;
    putSave(game);
    toast = true;
    shown = solo;
    paintAll();
    setTimeout(endToast, TOAST_MS);
  } else next();

  document.addEventListener('keydown', onKey, true);   // before main.js's Esc-goes-back
  const stop = playClock(root, game, () => app.isConnected);
  return () => {
    document.removeEventListener('keydown', onKey, true);
    clearInterval(tick);
    resize.disconnect();
    stop();
  };
}
