// The Tiles game screen (design v5 "Lexling Tiles"): the board, the rack, the tools, the computer's
// turns, the hand-over between people, the panel (history, letters left, check a word), the end and the
// look-back. The rules are tiles.js; finding moves - the computer, hints, the look-back - is tiles-moves.js.
import { t, esc, clock, duration, plural } from './i18n.js';
import { counts, settings, saveSettings, getSave, getFinished, putSave, deleteSave, recordMove, noteMove, tilesProgress, recordTilesEnd, recordTilesRating, playClock, gameName, newGame as makeSave } from './store.js';
import { createHost, createGuest, seatName } from './session.js';
import { net, netReady } from './net.js';
import { loadWords, resolve } from './engine.js';
import { lookupMeaning } from './meaning.js';
import { has } from './dawg.js';
import { cleanTiers, moveRarity, listedPct } from './rarity.js';
import { bump, grant, playChallenges, gameChallenges } from './achievements.js';
import { sizeOf, centre, premiums, valueOf, letterSet, placementError, wordsMade, pointsBreakdown, checkMove, apply, canExchange,
  unseen, undo, wordList, loadTileWords, checkWord, fullBag, hintCost, BLANK, STANDARD, newGame as startOf, outOf, levelKey, voteFits, voteStatus, canApprove, matchSummary, replayBoard } from './tiles.js';
import { findMoves, evaluateMoves, hintLevels, sameMove, computerMove, lookBack, LEVELS, loadSpoken } from './tiles-moves.js';
import { UI_ICONS, playerIcon, practiceBadge, confirmClick, outcome, openDialog, openRules, settingRows, wireSettingRows, meaningButton, wordLink, remindBt, topbar, backToResults, keepButton, wireKeep, resultHref, gameTitle } from './ui.js';
import { fitAll } from './fit.js';
import { playCue, tilesMoveCue } from './sound.js';
import { shareTilesStory } from './tiles-share.js';

// a bonus square's look and label: d / t = double / triple letter, D / T = double / triple word (tiles.js BOARDS)
export const LABEL = { d: 'l2', t: 'l3', D: 'w2', T: 'w3' };
export { playerIcon } from './ui.js';
const svg = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const ICON = {
  shuffle: svg('<path d="m18 14 4 4-4 4"></path><path d="m18 2 4 4-4 4"></path><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22"></path><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"></path><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"></path>'),
  recall: svg('<path d="M9 14 4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"></path>'),
  exchange: svg('<path d="m16 3 4 4-4 4"></path><path d="M20 7H4"></path><path d="m8 21-4-4 4-4"></path><path d="M4 17h16"></path>'),
  pass: svg('<path d="M5 5v14l10-7z"></path><path d="M19 5v14"></path>'),
  hint: svg('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path>'),
  challenge: svg('<path d="M4 22V4"></path><path d="M4 4h12l-2 4 2 4H4"></path>'),
  undo: svg('<path d="M9 14 4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"></path>'),
  zoomIn: svg('<circle cx="10" cy="10" r="7"></circle><path d="m15 15 6 6M7 10h6M10 7v6"></path>'),
  wholeBoard: svg('<path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6"></path>'),
  redo: svg('<path d="m15 14 5-5-5-5"></path><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"></path>'),
  share: svg('<path d="M12 16V3m-4 4 4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
};
const CLOSE = svg('<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>');
const FIND = svg('<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>');
const DOOR = svg('<path d="M4 21V3h13v18M4 3l9 3v15l-9-3M10 12v2M2 21h19"></path>');
const LIST = svg('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"></path>');
const DOT = '<span class="dot">·</span>';
const ERR = { line: 'tiles.err.line', gap: 'tiles.err.gap', alone: 'tiles.err.touch', centre: 'tiles.err.centre', single: 'tiles.err.single' };
// motion and zoom (design NOTES): the computer "thinks" 900 ms, who-starts shows 1200 ms; the board zooms in on
// the move being built when its squares are under 32 px, and pinches up to 2.5 ×
const THINK_MS = 900, TOAST_MS = 1200, SMALL = 32, AUTO_ZOOM = 2, ZOOM_MAX = 2.5;
const VOTE_MS = 20000, STILL_THINKING_MS = 30000;
// What another phone may send on its turn, rebuilt from the fields each action needs (security review, 2026-11-14):
// no 'shuffle' (it reseeds the bag), no 'end' / 'voteEnd' / taking players out (the host's own), a hint's cost a
// non-negative number, time a non-negative number of at most an hour. null = refused.
export function guestAction(a) {
  const ms = Number.isFinite(a.ms) && a.ms > 0 ? Math.min(a.ms, 3600000) : 0, t = ms ? { ms } : {};
  switch (a.type) {
    case 'place': return { type: 'place', placed: a.placed, ...(a.hint ? { hint: a.hint } : {}), ...t };
    case 'vote': return typeof a.veto === 'boolean' && Number.isInteger(a.p) && Number.isInteger(a.at) ? { type: 'vote', p: a.p, veto: a.veto, at: a.at, ...t } : null;
    case 'exchange': return { type: 'exchange', tiles: a.tiles, ...t };
    case 'pass': case 'challenge': case 'timeout': return { type: a.type, ...t };
    case 'resign': return { type: 'resign', p: a.p, ...t };
    case 'hint': return ['small', 'big', 'master'].includes(a.level) && Number.isFinite(a.cost) && a.cost >= 0
      ? { type: 'hint', level: a.level, cost: a.cost, ...t } : null;
    default: return null;
  }
}
export const exchangeLetters = (rack, picks, blank) => [...picks].sort((a, b) => a - b).map(i => rack[i] === BLANK ? blank : rack[i].toUpperCase()).join(', ');
export const endingNext = S => S.zeros + 1 >= 2 * S.players.filter((_, p) => !outOf(S)[p]).length;

export const removedPlayer = (S, p) => S.log.some(a => a.type === 'resign' && a.p === p && a.removed);
export const finalOrder = S => {
  const inPlay = p => !outOf(S)[p] && !(S.over?.reason === 'resign' && p === S.over.by);
  return S.players.map((_, p) => p).sort((a, b) => Number(inPlay(b)) - Number(inPlay(a)) || S.scores[b] - S.scores[a]);
};

// Readiness failures belong to the selected transport; thrown retries say only that they failed.
export const readinessText = (kind, ready) => ready === 'retry' ? 'net.retryFailed'
  : kind === 'bt' ? 'tiles.bt.' + ready : `net.ready.${kind}.${ready}`;

const clampPan = (v, z) => Math.min(0, Math.max(-(1 - 1 / z), v));

// Older evaluations stored the raw best alone or stored the overall leader under rarer.
const BANDS = [[1, 'best'], [0.85, 'great'], [0.65, 'good'], [0.4, 'fair'], [0, 'weak']];
export const rateOf = (played, best) => best > 0 ? BANDS.find(([k]) => played / best >= k - 1e-9)[1] : null;
const pctOf = (played, best) => Math.min(100, Math.round(played / best * 100));
const referenceOf = ev => ev?.reference ?? ev?.best ?? 0;
const topScoreOf = ev => ev?.rarer?.score ?? ev?.best ?? 0;
const hasBetter = (ev, played) => topScoreOf(ev) > played;
// A narrow lead can put the top score below the benchmark. The top play still earns full credit.
const creditOf = (played, ev) => {
  const reference = referenceOf(ev);
  return !hasBetter(ev, played) ? reference : Math.min(played, reference);
};

// The bonus squares' look (owner, 2026-09-26): in colour (true), only their labels coloured on a plain square ('text'),
// or one quiet grey (false) - a choice in the gear, History, New game and Settings.
export const BONUS_LOOKS = [[true, 'colour'], ['text', 'text'], [false, 'grey']];
export const bonusSeg = () => `<div class="seg" role="radiogroup">${BONUS_LOOKS.map(([v, k]) =>
  `<button type="button" data-bonus="${v}" class="${settings.tilesBonus === v ? 'on' : ''}">${t('tiles.bonus.' + k)}</button>`).join('')}</div>`;
export const boardStyleSeg = () => `<div class="seg" role="radiogroup">${['classic', 'muted'].map(v =>
  `<button type="button" data-board-style="${v}" class="${(settings.tilesBoardStyle ?? 'classic') === v ? 'on' : ''}">${t('tiles.boardStyle.' + v)}</button>`).join('')}</div>`;
const bonusMark = () => settings.tilesCb ? '<span class="bonus-mark" aria-hidden="true"></span>' : '';
// the rating after a move: with the best move there was, the rating alone (find the better move yourself), or off
export const RATE_LOOKS = [[true, 'best'], ['score', 'score'], [false, 'off']];
// One tile colour for the rack and board, shared by every player. Set on <html> for every screen.
export const TILE_LOOKS = [['white', '#FFFFFF'], ['yellow', '#F3C237'], ['cream', '#F3E7D0'], ['wood', '#E3B888'], ['mint', '#BDE8D0']];
export const tileSwatch = c => `<b class="sw" style="--sw:${c}" aria-hidden="true">A</b>`;
export const tileSeg = () => `<div class="seg" role="radiogroup">${TILE_LOOKS.map(([k, c]) =>
  `<button type="button" data-tc="${k}" class="${(settings.tilesTile ?? 'cream') === k ? 'on' : ''}" aria-label="${t('tiles.tile.' + k)}" title="${t('tiles.tile.' + k)}">${tileSwatch(c)}</button>`).join('')}</div>`;
export const applyTileLook = () => {
  document.documentElement.dataset.tilecolour = settings.tilesTile ?? 'cream';
  document.documentElement.dataset.tileframe = settings.tilesFrame ?? 'graphite';
};
export const bonusOf = v => v === 'true' ? true : v === 'false' ? false : v;

// A player's name as shown: the one typed on New game, or - in the interface language - "You" / "Computer" when
// there is one of the kind, "Player 2" / "Computer 2" when there are several.
export function nameOf(state, p) {
  const x = state.players[p];
  if (x.name) return x.name;
  const kind = y => !y.cpu === !x.cpu, same = state.players.filter(kind).length, k = state.players.slice(0, p + 1).filter(kind).length;
  return x.cpu ? t(same > 1 ? 'tiles.cpuN' : 'tiles.cpu', { n: k }) : t(same > 1 ? 'tiles.playerN' : 'tiles.you', { n: k });
}

// Match highlights and score progression share the live and Last games results (owner, 2026-11-26).
function matchDetails(state, timeMs) {
  const { best, longest, totals } = matchSummary(state);
  const rows = [
    ['best', best && `<strong>${esc(best.word.toUpperCase())}</strong> <span>+${best.score} ${t('tiles.hist.pts')}</span>`],
    ['longest', longest && `<strong>${esc(longest.word.toUpperCase())}</strong> <span>· ${longest.letters} ${plural(longest.letters, 'lt.letters')}</span>`],
    ['length', duration(timeMs)],
  ];
  return `<section class="card tl-highlights">
    <h2 class="eyebrow">${t('tiles.match.title')}</h2>
    <dl>${rows.map(([key, value]) => `<div><dt>${t('tiles.match.' + key)}</dt><dd>${value ?? '–'}</dd></div>`).join('')}</dl>
  </section>
  ${scoreChart(state, totals)}`;
}

const scoreChartX = (move, last) => 44 + move / Math.max(1, last) * 260;
function scoreChart(state, totals) {
  let low = 0, high = 1;
  for (const scores of totals) {
    low = Math.min(low, ...scores);
    high = Math.max(high, ...scores);
  }
  const last = totals.length - 1, range = (high - low) / 4;
  const unit = 10 ** Math.floor(Math.log10(Math.max(1, range)));
  const step = [1, 2, 5, 10].find(n => n * unit >= range) * unit;
  const min = Math.floor(low / step) * step, max = Math.ceil(high / step) * step;
  const x = move => scoreChartX(move, last);
  const y = score => 124 - (score - min) / (max - min) * 100;
  const ticks = Array.from({ length: (max - min) / step + 1 }, (_, i) => min + i * step);
  const moves = [...new Set([0, Math.round(last / 3), Math.round(2 * last / 3), last])];
  return `<section class="card tl-score-chart">
    <h2 class="eyebrow">${t('tiles.match.chart')}</h2>
    <svg viewBox="0 0 320 169" role="img" aria-label="${t('tiles.match.chartLabel')}">
      <text x="44" y="12">${t('tiles.end.pts')}</text>
      ${ticks.map(score => `<line class="grid" x1="44" x2="304" y1="${y(score)}" y2="${y(score)}"/><text x="37" y="${y(score) + 4}" text-anchor="end">${score}</text>`).join('')}
      ${moves.map(move => `<text x="${x(move)}" y="143" text-anchor="middle">${move}</text>`).join('')}
      <text x="174" y="163" text-anchor="middle">${t('tiles.match.move')}</text>
      ${state.players.map((_, p) => `<g class="pc${p}">
        <polyline points="${totals.map((scores, i) => `${x(i).toFixed(2)},${y(scores[p]).toFixed(2)}`).join(' ')}"/>
        <circle cx="${x(last)}" cy="${y(totals[last][p])}" r="3"/>
      </g>`).join('')}
      <line class="replay-marker" x1="44" x2="44" y1="24" y2="124" visibility="hidden" aria-hidden="true"/>
    </svg>
    <ul>${state.players.map((_, p) => `<li class="pc${p}"><i aria-hidden="true"></i>${esc(nameOf(state, p))}</li>`).join('')}</ul>
  </section>`;
}

// Keep the basics first, then active rules, then the optional chapters (owner, 2026-11-26).
export function topics(rules = null) {
  const title = k => t('howto.tiles.' + k);
  const help = k => `<p class="help">${title(k)}</p>`;
  const active = [], optional = [];
  for (const [key, on] of [['hints', rules?.hints], ['challenge', rules?.check === 'challenge'], ['clock', rules?.time], ['veto', rules?.veto]]) {
    if (rules || key !== 'hints') (on ? active : optional).push(key);
  }
  const legend = `<p class="tl-legend${settings.tilesCb ? ' cb' : ''}">${['l2', 'l3', 'w2', 'w3'].map(k => `<span><i class="q ${k}">${t('tiles.label.' + k)}${bonusMark()}</i></span>`).join('')}</p>`;
  // every look a tile can have on the board, drawn as it is there (owner, 2026-09-26: "show what each tile style means")
  const looks = `<ul class="tl-looks">${[['', 'plain'], ['bl', 'blank'], ['last', 'last'], ['new', 'new'], ['new bad', 'bad'], ['new hint', 'hint'],
    ['p0 own hinted', 'hinted'], ['peek', 'peek']].map(([cls, k]) => `<li><b class="t ${cls}" aria-hidden="true">${k === 'blank' ? 'E' : 'A'}<i class="p">${
    k === 'blank' ? '' : 1}</i></b><span>${t('tiles.looks.' + k)}</span></li>`).join('')}</ul>`;
  const bingo = rules?.bingo ?? STANDARD.bingo;
  const bodies = {
    goal: help('goal.t'),
    turn: t('howto.tiles.turn.t', { check: title(rules?.check === 'challenge' ? 'turn.check.challenge' : 'turn.check.auto') }),
    points: help('points.t') + (rules ? help(rules.premiums === 'always' ? 'points.always' : 'points.once') +
      (bingo ? `<p class="help">${t('howto.tiles.points.bingo', { n: bingo })}</p>` : '') : '') + legend,
    blank: help('blank.t') + looks,
    swap: help('swap.t') + (rules ? help(rules.exchange === 'always' ? 'swap.always' : 'swap.bag7') : ''),
    end: help('end.t'),
    challenge: help('challenge.t') + help('challenge.end'),
  };
  return `<div class="tl-topics">${['goal', 'turn', 'points', 'blank', 'swap', 'end', ...active, ...optional].map(k =>
    `<details><summary>${title(k)}<span class="arrow" aria-hidden="true">›</span></summary>${
      optional.includes(k) ? `<p class="rule-status">${title(rules ? 'off' : 'optional')}</p>` : ''}${bodies[k] ?? help(k + '.t')}</details>`).join('')}</div>`;
}

// Check a word (owner, 2026-11-26): use the game's loaded dictionary, even during a challenge.
const checkHtml = () => `<div class="tl-check"><form novalidate><input class="input" type="text" maxlength="20" placeholder="${t('tiles.check.ph')}" aria-label="${
  t('tiles.check')}" autocomplete="off" autocapitalize="none" spellcheck="false"><button class="btn btn-outline" type="submit">${t('tiles.checkTab')}</button></form><p class="res" role="status"></p><div class="mean-slot"></div></div>`;
function wireCheck(box, lang, rules, dict) {
  const input = box.querySelector('input'), res = box.querySelector('.res');
  box.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    if (!input.value.trim()) return;
    const r = checkWord(dict, lang, input.value);
    res.className = 'res ' + (r.ok ? 'ok' : 'no');
    res.textContent = t('tiles.checkedList', { list: t('tiles.r.dictionary.' + wordList(rules)) }) + ' · ' + t(r.ok ? 'tiles.check.ok' : 'tiles.check.' + r.why, { w: r.word.toUpperCase() });
    // what it means - in the browser (owner, 2026-09-26); a word too short or with a letter no tile has, never
    box.querySelector('.mean-slot').innerHTML = r.why === 'short' || r.why === 'letters' ? '' : meaningButton(r.word, lang);
  });
}

// The board's squares and tiles (design: only bonus / start / marked squares and tiles are elements - plain
// squares are the grid's background). `draft` = this turn's tiles. No points on the board, ever (owner, 2026-09-26) - the
// message line and Play show them.
// `hinted` = squares of tiles already down that belong to a hinted word: they take the hint look too.
export function boardInner(S, { draft = [], bad = false, badWords = [], cursor = null, drop = -1, hinted = new Set(), peek = -1, highlight } = {}) {
  const n = sizeOf(S.board), prem = premiums(S.board), mid = centre(S.board);
  const fresh = new Map((S.vote?.placed ?? draft).map(d => [d.r * n + d.c, d]));
  // Mark the whole rejected word, including letters already on the board. Shared letters
  // belong to the rejected word too; other valid words keep their usual appearance.
  const rejected = new Set();
  if (badWords.length && draft.length) {
    for (const word of wordsMade(S, draft).words) {
      if (!badWords.includes(word.w)) continue;
      for (let k = 0; k < [...word.w].length; k++)
        rejected.add((word.r + (word.across ? 0 : k)) * n + word.c + (word.across ? k : 0));
    }
  }
  // Only the last move, by anyone; a withdrawn or vetoed word clears it (owner, 2026-11-14).
  const move = (S.moves ?? []).findLast(m => ['play', 'withdrawn', 'vetoed'].includes(m.kind));
  const marked = highlight ?? (settings.tilesLast !== false && move?.kind === 'play' ? move.placed : []);
  const last = new Set((marked ?? []).map(d => d.r * n + d.c));
  const at = i => `grid-row:${Math.floor(i / n) + 1};grid-column:${i % n + 1}`;
  let html = '';
  for (let i = 0; i < n * n; i++) {
    const k = LABEL[prem[i]], cur = cursor && i === cursor.r * n + cursor.c, cls = [];
    if (k) cls.push(k);
    if (i === mid) cls.push('st');
    if (cur) cls.push(cursor.down ? 'cur dn' : 'cur');
    if (i === drop) cls.push('drop');
    if (!cls.length) continue;
    const label = k && (settings.tilesCb || (i !== mid && !cur && i !== drop && !fresh.has(i))) ? t('tiles.label.' + k) : '';
    html += `<span class="q ${cls.join(' ')}" style="${at(i)}">${label}${k ? bonusMark() : ''}</span>`;
  }
  // Retain ownership classes for history; every player's board tiles now share the rack's look.
  // each row above the one before it, so a raised tile's face goes over the tile above (css .tb.raised)
  const tile = (i, ch, blank, cls) => `<b class="t ${cls}${blank ? ' bl' : ''}" data-i="${i}" style="${at(i)};z-index:${2 + Math.floor(i / n)}">${esc(ch)}<i class="p">${blank || !ch ? '' : valueOf(S.lang, ch)}</i></b>`;
  S.cells.forEach((x, i) => { if (x) html += tile(i, x.ch, x.blank, (hinted.has(i) ? 'hint' : 'p' + x.by + (x.hint ? ' hinted' : '')) + (last.has(i) ? ' last' : '') + (i === peek ? ' peek' : '') + (rejected.has(i) ? ' bad' : '')); });
  for (const [i, d] of fresh) html += tile(i, d.ch, d.blank, (S.vote ? 'voting' : d.hint ? 'new hint' : 'new') + (bad || rejected.has(i) ? ' bad' : '') + (i === drop ? ' drop' : ''));
  return html;
}

const historyAction = m => m.kind === 'swap' ? plural(m.n, 'tiles.hist.exchanged').replace('{n}', m.n)
  : m.kind === 'pass' ? t(m.away ? 'tiles.hist.away' : 'tiles.hist.passed')
    : m.kind === 'resign' ? t(m.removed ? 'tiles.hist.removed' : 'tiles.hist.resigned')
      : m.kind === 'timeout' ? t('tiles.hist.timeout')
        : ['withdrawn', 'vetoed'].includes(m.kind) ? t(m.approval ? 'tiles.hist.notApproved' : 'tiles.hist.' + m.kind)
          : t(m.ok ? 'tiles.hist.challengeWon' : 'tiles.hist.challengeLost');

// Replay stays on the results screen and only repaints its board and chart marker (owner, 2026-11-26).
function wireReplay(main, state, board) {
  const toggle = main.querySelector('[data-replay]'), controls = main.querySelector('.tl-replay-controls');
  const counter = controls.querySelector('b'), detail = controls.querySelector('p');
  const marker = main.querySelector('.replay-marker'), buttons = [...controls.querySelectorAll('[data-step]')];
  const moves = state.moves.filter(m => m.kind !== 'hint'), total = moves.length;
  let at = 0;
  function paint() {
    const move = moves[at - 1];
    const words = move?.words?.map(w => w.w.toUpperCase()).join(', ');
    const action = move?.kind === 'play' ? words : [words, move && historyAction(move)].filter(Boolean).join(' · ');
    detail.textContent = move ? t('tiles.replay.detail', { name: nameOf(state, move.p), action, points: move.kind === 'play' ? move.score : 0 })
      : t('tiles.replay.start');
    counter.textContent = t('tiles.replay.counter', { move: at, total });
    buttons.forEach((b, i) => { b.disabled = i < 2 ? at === 0 : at === total; });
    const highlight = move && ['play', 'withdrawn'].includes(move.kind) ? move.placed : [];
    const draft = move?.kind === 'vetoed' ? move.placed : [];
    board.innerHTML = boardInner(replayBoard(state, moves, at), { highlight, draft, bad: true });
    const x = scoreChartX(at, total);
    marker.setAttribute('x1', x);
    marker.setAttribute('x2', x);
  }
  toggle.addEventListener('click', () => {
    const active = controls.hidden;
    controls.hidden = !active;
    toggle.setAttribute('aria-expanded', active);
    toggle.textContent = t(active ? 'tiles.replay.final' : 'tiles.replay');
    marker.setAttribute('visibility', active ? 'visible' : 'hidden');
    if (active) paint();
    else board.innerHTML = boardInner(state);
  });
  const steps = [() => 0, () => at - 1, () => at + 1, () => total];
  buttons.forEach((b, i) => b.addEventListener('click', () => {
    at = steps[i]();
    paint();
  }));
}

export async function tilesGameScreen(root, id, archived = false) {
  let game = archived ? getFinished(id) : getSave(id);
  let dict = null, lex = null, spoken = null, familiar = null;
  let wordsReady;
  // Rarity loads in the background unless a computer needs frequencies to play (owner, 2026-11-14).
  const lexReady = game && !archived ? loadWords(game.lang).catch(() => null) : Promise.resolve(null);
  if (game && (!archived || game.state.rules?.rating !== false)) {
    // The words people say matter to a computer that knows fewer words (tiles-moves.js LEVELS).
    const levels = archived ? [] : game.state.players.filter(x => x.cpu).map(x => LEVELS[x.cpu] ?? LEVELS.normal);
    const slow = levels.some(L => L.known > 0 && L.known !== Infinity), says = levels.some(L => L.spoken);
    wordsReady = Promise.all([loadTileWords(game.lang, game.state.rules), slow ? loadWords(game.lang) : null,
      says ? loadSpoken(game.lang).catch(() => new Map()) : null,
      game.state.rules?.rating === false ? null : loadTileWords(game.lang, { dictionary: 'familiar' }).catch(() => null)])
      .then(words => { [dict, lex, spoken, familiar] = words; }).catch(() => { dict = null; });
    // Archived results and replay open while the optional analysis loads (owner, 2026-11-26).
    if (!archived) await wordsReady;
  }
  if (location.hash !== (archived ? resultHref(id) : '#/game/' + id)) return;
  if (!archived && !dict) { location.replace('#/games/tiles'); return; }

  let S = game.state;
  if (!archived) {
    game.statsDone ??= S.moves.length;
    game.achDone ??= S.moves.length;   // older saves and newly joined phones count from now (owner, 2026-11-14)
  }
  const { lang } = S, n = sizeOf(S.board);
  const isWord = w => has(dict, w);
  const rankOf = w => (lex && resolve(lex, w)?.idx) ?? Infinity, spokenOf = w => spoken?.get(w) ?? Infinity;
  const cpu = p => !!S.players[p].cpu;
  const people = S.players.map((x, p) => x.cpu ? -1 : p).filter(p => p >= 0);
  // several phones (owner, 2026-09-27): the game belongs to the phone that started it, the host; a joining phone plays
  // its seat (linkMe) with the game in memory only. Every move goes through the host (session.js), over Bluetooth or
  // Wi-Fi (net.js). Nobody moves while a seat's phone is missing.
  const linked = !!game.link, host = linked && game.link.role === 'host';
  let linkMe = linked ? game.link.me : -1;
  const remote = p => linked && p !== linkMe;
  const kind = game.link?.kind ?? 'bt', wire = linked && !archived ? net(kind) : null;
  let party = null, linkUp = false, linkNote = '', retry = 0, beat = 0, myPhone = '', myWifi = true, roomCode = '';
  let asked = null, hereList = [], ended = '', frozenLive = null;   // host: a phone waiting to be let in; guest: who is there, why it ended
  // the phones, for the host's decisions (owner, 2026-09-27): away[p] - that phone shows another app (Lexling in the
  // background); goneSince[p] - when it lost the connection. Meanwhile the others play on; the host can skip the move of
  // whoever is on turn, or make a player give up (Options → Players)
  let away = [], goneSince = [], askSeat = -1, visibleDeclined = false, visAsking = false, joinedAs = false;
  let remoteMs = 0, linkHtml = '', linkDraft = null, sentDraft = null;
  let findable = null;   // Bluetooth host: can other phones' search find this one now (null: not known)
  const handles = [];
  // one person here (against computers, or on their own phone): their rack is always shown
  let solo = linked ? linkMe : people.length === 1 ? people[0] : -1;
  const canUndo = solo >= 0 && S.rules.undo === true && !linked;   // undo: only one person against the computer (owner)
  // everyone's tiles shown (a rule): the people's racks stay in view, so nobody has to hand the device over
  const open = S.rules.open === true && people.length > 1;
  const desk = matchMedia('(pointer: fine)').matches;
  const abc = [...letterSet(lang).letters].sort((a, b) => a.localeCompare(b, lang));

  let shown = solo;           // whose rack is on screen: -1 = nobody's (between people, or a computer's turn)
  let draft = [];             // this turn's tiles: { slot (in the rack), r, c, ch, blank, hint }
  let stashedDraft = null;    // Pass or Exchange is open
  let sel = -1;               // a rack tile lifted by a tap, to be tapped onto a square
  let mode = 'play';          // 'play', 'exchange' (picking tiles to swap), 'pass' (asking first) or 'hint' (which one)
  let picks = new Set();      // exchange: the rack tiles picked
  let levels = null;          // the three hints for this turn, { small, big, master } (tiles-moves.js hintLevels)
  let cursor = null;          // computer: the square typing goes to, { r, c, down }
  let blankFor = -1;          // the draft tile whose blank letter is being picked
  // 'hist' (tap the scores) / 'unseen' (the bag) / 'check' (the magnifier) / 'guide' (the "?") - each its own panel, no
  // tabs (owner, 2026-09-25); over the board on a phone, beside it when wide (History until another is opened)
  let panel = null, histOf = null;   // histOf: the player whose History a score chip opened, or null for everyone's
  let msg = null;             // what just happened, for the message line: { html, err }
  let landing = null;         // squares whose tiles just came down, to animate
  let endStep = false;        // the end, before the results: what the tiles left on the racks cost (finish)
  let thinking = false, toast = false, handOver = false, wide = false;
  let turnCuePending = !S.log.length;
  let voteAt = null, seenAt = 0, sentVote = null, lastVote = null, voteMoveAt = 0, voteResult = null;
  let manualOverview = false, placedOnce = false;
  let zoom = { z: 1, x: 0, y: 0 };      // x / y: the board's shift, in fractions of its size (0 or less)
  let press = null, pinch = null, dragEl = null, dropAt = -1, rackGap = -1;
  const touches = new Map();

  root.innerHTML = `<div class="app fit" data-screen="tiles">
  ${archived ? topbar({ left: backToResults(), right: gameTitle(game, archived) }) : ''}
  <main class="main"><div class="tl-play">
    <div class="status"></div>
    <div class="tl-bwrap"><div class="tl-board"><div class="tb"></div></div></div>
    <div class="tl-messages"><div class="tl-moves" role="status"></div><div class="tl-vote" hidden></div></div>
    <div class="tl-rack-area"><div id="tl-move-error" class="tl-move-error" role="status" aria-atomic="true" aria-hidden="true"></div><div class="tl-rack"></div></div>
    <div class="tl-dock"></div>
    <div class="tl-more"></div>
    <div class="tl-over"></div>
  </div></main>
</div>`;
  const app = root.firstElementChild, main = app.querySelector('main'), play = app.querySelector('.tl-play');
  const repaint = () => { if (S.over) return; paintStatus(); paintTurn(); paintMore(); refit(); };
  const $ = s => play.querySelector(s);
  const status = $('.status'), boardEl = $('.tl-board'), tb = $('.tb'), say = $('.tl-moves'), rackEl = $('.tl-rack'), dock = $('.tl-dock');
  const more = $('.tl-more'), over = $('.tl-over'), voteEl = $('.tl-vote'), moveError = $('#tl-move-error');
  const refit = () => fitAll(root);

  // The board looks shared by the live and final boards (owner, 2026-11-14).
  const looks = () => (settings.tilesBonus === false ? ' mono' : settings.tilesBonus === 'text' ? ' tint' : '')
    + (settings.tiles3d ? ' raised' : '') + (settings.tilesBoardStyle === 'muted' ? ' muted' : '') + (settings.tilesCb ? ' cb' : '');
  const myTurn = () => !S.over && !S.vote && !thinking && !toast && !handOver && !cpu(S.turn) && shown === S.turn && netOk();
  // several phones: every seat's phone there - and, on a joining phone, the host within reach
  const netOk = () => !linked || (host ? !!party && !startWaits() : linkUp && !ended && !startWaits());
  const isOut = p => !!outOf(S)[p];
  // the seats without their phone (players out of the game aside)
  const gone = () => host ? party?.missing() ?? [] : hereList.map((x, p) => x || isOut(p) ? -1 : p).filter(p => p >= 0);
  // before the first move everyone is waited for; after it, a player only on their own turn (owner: "skip current player")
  const startWaits = () => !S.log.length && gone().length > 0;
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
  const keyOf = placed => placed.map(x => `${x.r},${x.c},${x.ch}`).sort().join(' ');
  // Each device starts its visible twenty seconds when it first sees this proposal (owner, 2026-11-14).
  function seeVote() {
    const at = S.vote?.at ?? null;
    if (S.vote) { lastVote = S.vote; voteMoveAt = S.moves.length; voteResult = null; }
    if (at === voteAt) return;
    if (at === null && lastVote) {
      voteResult = voteStatus(S, lastVote, voteMoveAt);
      const result = voteResult;
      setTimeout(() => { if (voteResult === result) { voteResult = null; if (app.isConnected) paintVote(); } }, 4000);
      lastVote = null;
    }
    voteAt = at; seenAt = Date.now(); sentVote = null;
  }
  const voteMs = () => Math.max(0, Date.now() - seenAt);
  // The watching phone estimates time until the mover's logged time arrives (owner, 2026-11-26).
  const liveMs = () => linked && !host && !linkUp ? frozenLive ?? game.turnMs ?? 0
    : S.vote ? voteMs() : remote(S.turn) ? remoteMs : game.turnMs || 0;
  const turnMs = () => (S.used || 0) + liveMs();

  // The move as it stands: { error } or { words, score }. With challenges the words go down unchecked, so the
  // screen does not tell either - except for a move that uses the last tiles, which is checked at once.
  function judge() {
    if (!draft.length || draft.some(d => !d.ch)) return null;
    const placed = placedOf(), error = placementError(S, placed);
    if (error) return { error };
    const out = placed.length === S.racks[S.turn].length && !S.bag.length;
    return S.rules.check === 'challenge' && !out ? wordsMade(S, placed) : checkMove(S, placed, isWord);
  }
  // a person's time so far (owner, 2026-09-26): on their chip, in the name line, and on the result screen
  const mmss = ms => { const x = Math.floor(ms / 1000), h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, sec = String(x % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`; };
  // S.clock already includes used; add only the part not yet credited by the action log.
  const timeOf = p => (S.clock?.[p] || 0) + (!S.over && p === S.turn ? liveMs() : 0);

  // ── painting ──
  function paintStatus() {
    const np = S.players.length;
    // beside each score what that player's last turn brought (owner, 2026-09-25): +23, or +0 for a pass or exchange
    const last = p => { const m = S.moves.findLast(x => x.p === p && x.kind !== 'hint'); return m ? `<small class="delta">+${m.kind === 'play' ? m.score : 0}</small>` : ''; };
    // A box per player: person/computer icon, name and score; the player to move ringed in the theme. With three players or more
    // the boxes scroll sideways, and the row follows the turn: the player to move slides to the front.
    const chip = p => `<button type="button" class="ps pc${p}${!S.over && S.turn === p ? ' on' : ''}${isOut(p) ? ' out' : ''}" data-open="hist" data-who="${p}" aria-label="${esc(nameOf(S, p))}: ${S.scores[p]}"><span class="pb" aria-hidden="true">${playerIcon(S, p)}</span><span class="nm">${esc(nameOf(S, p))}${linked && p === linkMe ? ` <small class="you">(${t('net.you')})</small>` : ''}</span>${cpu(p) ? '' : `<span class="tm">${mmss(timeOf(p))}</span>`}<span class="sc">${S.scores[p]}${last(p)}${
      thinking && S.turn === p ? `<span class="tl-dots" aria-label="${t('tiles.thinking')}"><i></i><i></i><i></i></span>` : ''}</span></button>`;
    const was = status.querySelector('.ps-row')?.scrollLeft ?? 0;
    status.innerHTML = `<div class="ps-row${np > 2 ? ' many' : ''}">${S.players.map((_, p) => chip(p)).join('')}</div>
      <button class="ps-bag" type="button" data-open="unseen" aria-label="${t('tiles.unseen')}"><span class="nm">${t('tiles.bag')}</span><span class="sc">${S.bag.length}</span></button>
      ${open ? othersHtml() : ''}
      <div class="status-actions"><a class="btn btn-ghost tl-exit" href="#/games/tiles">${DOOR}<span>${t(linked && !host ? 'net.leave' : 'game.saveExit')}</span></a>${practiceBadge(game)}<button class="btn btn-ghost tl-find" type="button" data-open="check" aria-label="${t('tiles.check')}" title="${t('tiles.check')}">${FIND}</button>${['zoomIn', 'wholeBoard'].map(act => `<button class="btn btn-ghost tl-find" type="button" data-act="${act}" aria-label="${t('tiles.' + act)}" title="${t('tiles.' + act)}">${ICON[act]}</button>`).join('')}<button class="btn btn-ghost tl-opts" type="button" data-act="options">${LIST}<span>${t('tiles.options')}</span></button></div>`;
    paintClock();
    paintZoomTools();
    const row = status.querySelector('.ps-row.many'), cur = row?.querySelector('.ps.on');
    if (row) { row.scrollLeft = was; if (cur) row.scrollTo({ left: cur.offsetLeft - row.firstElementChild.offsetLeft, behavior: 'smooth' }); }
  }
  // Everyone's tiles (the rule): the other people's racks, one row each, always in view - never a computer's.
  const othersHtml = () => `<div class="tl-others">${people.filter(p => p !== shown).map(p => `<div class="tl-other pc${p}"><i class="tl-player-icon" aria-hidden="true">${playerIcon(S, p)}</i><span>${esc(nameOf(S, p))}</span><span class="mt-row">${
    rackOf(p).map(x => `<i class="mtl${x === BLANK ? ' bl' : ''}">${x === BLANK ? '' : `${esc(x)}<i class="p">${valueOf(lang, x)}</i>`}</i>`).join('')}</span></div>`).join('')}</div>`;
  // Each person's score card shows their countdown, or elapsed time with no limit.
  function paintClock() {
    const T = S.rules.time;
    S.players.forEach((x, p) => {
      if (x.cpu) return;
      const el = status.querySelector(`.ps.pc${p} .tm`);
      if (!el) return;
      const left = T ? T.seconds * 1000 - (T.per === 'game' ? timeOf(p) : p === S.turn ? turnMs() : 0) : null;
      el.textContent = T ? (left < 0 ? '−' : '') + clock(Math.ceil(Math.abs(left) / 1000) * 1000) : mmss(timeOf(p));
      el.classList.toggle('low', !!T && left < (T.per === 'move' ? 10000 : 60000));
    });
  }

  function paintBoard() {
    const res = judge(), lifted = press?.drag && press.kind === 'tile' ? press.di : -1;
    const shownDraft = draft.filter((_, i) => i !== lifted);
    tb.className = `tb n${n}${zoom.z > 1 ? ' zoom' : ''}${looks()}`;
    tb.innerHTML = boardInner(S, { draft: shownDraft, bad: !!res?.error && res.error !== 'word', badWords: res?.bad ?? [], cursor: myTurn() && mode === 'play' ? cursor : null, drop: dropAt, hinted: hintedCells(), peek: peekAt });
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
  function paintZoomTools() {
    status.querySelector('[data-act="zoomIn"]').disabled = zoom.z >= ZOOM_MAX;
    status.querySelector('[data-act="wholeBoard"]').disabled = zoom.z <= 1;
  }
  function applyZoom(instant = false) {
    paintZoomTools();
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
    if (draft.length) placedOnce = true;
    if (manualOverview || !draft.length || (zoom.z === 1 && boardEl.clientWidth / n >= SMALL)) return;
    if (zoom.z === 1) zoom.z = AUTO_ZOOM;
    const rs = draft.map(d => d.r), cs = draft.map(d => d.c);
    const cr = (Math.min(...rs) + Math.max(...rs) + 1) / 2 / n, cc = (Math.min(...cs) + Math.max(...cs) + 1) / 2 / n;
    zoom = { z: zoom.z, x: clampPan(0.5 / zoom.z - cc, zoom.z), y: clampPan(0.5 / zoom.z - cr, zoom.z) };
  }
  const zoomOut = () => { zoom = { z: 1, x: 0, y: 0 }; };

  // Under the board, two move cards (owner, 2026-09-26: "merge the message line with the rating"): yours - what you are
  // placing, a message, or your last move - and the latest move by anyone else; each its words and points and, with
  // ratings on, how good it was and the best move there was. The columns line up as in History. Below them, the letters
  // just drawn from the bag.
  const meaningWord = w => `<button type="button" class="mw" data-definition="${esc(w)}" title="${esc(t('meaning'))}">${esc(w)}</button>`;
  let meaningBusy = false;
  app.addEventListener('click', async e => {
    const button = e.target.closest('[data-definition]');
    if (!button || meaningBusy) return;
    meaningBusy = true;
    const w = button.dataset.definition;
    try {
      if (navigator.onLine === false) throw new Error('offline');
      const words = lex ?? await loadWords(lang), found = resolve(words, w);
      const result = await lookupMeaning(w, lang, found ? words.words[found.idx] : w);
      if (!app.isConnected) return;
      openDialog(esc(w), `<div class="word-meaning">${result.base && result.meanings.length ? `<p class="help">${t('def.form', { w: esc(result.base) })}</p>` : ''}${result.meanings.length
        ? `<ol>${result.meanings.map(d => `<li>${esc(d)}</li>`).join('')}</ol>` : `<p>${t('def.none', { w: esc(w) })}</p>`}<p class="help">${t('def.credit')}</p></div>`);
    } catch {
      if (!app.isConnected) return;
      const notice = document.createElement('div');
      notice.className = 'meaning-notice'; notice.setAttribute('role', 'status');
      notice.innerHTML = `${UI_ICONS.wifiOff}<span>${t('def.offline')}</span>`;
      document.body.append(notice); setTimeout(() => notice.remove(), 3000);
    } finally { meaningBusy = false; }
  });
  const cardWords = (words, bingo) => {
    const bonus = bingo && S.rules.bingo;
    return words.length > 1 || bonus ? words.map(x => `${meaningWord(x.w)} <small>${x.score}</small>`).join(' + ') + (bonus ? ` + <small>${S.rules.bingo}</small>` : '') : meaningWord(words[0].w);
  };
  const hintMark = () => `<span class="hi" title="${t('tiles.rate.hinted')}" aria-label="${t('tiles.rate.hinted')}">${ICON.hint}</span>`;
  const whoCell = p => `<span class="who" title="${esc(nameOf(S, p))}" aria-label="${esc(nameOf(S, p))}">${playerIcon(S, p)}</span>`;
  const lastMove = test => S.moves.findLastIndex(m => ['play', 'swap', 'pass', 'timeout', 'vetoed'].includes(m.kind) && test(m.p));
  // Base-word rarity is independent of rating rules, also for computers (owner, 2026-11-14).
  function rarityChip(m) {
    if (!rareOn() || !lex?.count || m.kind !== 'play') return '';
    const rare = moveRarity(m.words ?? [], rankOf, lex.count, cleanTiers(settings.tilesRareTiers));
    if (!rare) return '';
    const label = t(rare.pct === null ? 'tiles.rare.very' : rare.pct > 50 ? 'tiles.rare.common' : 'tiles.rare.top', { n: rare.pct });
    const about = t('tiles.rare.of', { w: rare.w });
    return `<small class="rare rare-${rare.pct > 50 ? 'grey' : rare.tier}" title="${esc(about)}" aria-label="${esc(label + ' · ' + about)}">${label}</small>`;
  }
  function moveCard(i, cls) {
    const m = S.moves[i], play = m.kind === 'play', ev = rateOn() && (play || m.kind === 'timeout') && game.evals?.[i];
    const reference = referenceOf(ev), credit = creditOf(m.score, ev), band = play && rateOf(credit, reference);
    // under it: Master's own reason (it weighs the rest of the game - owner 1a), or the best move there was
    const under = m.hinted === 'master' && band && credit < reference ? t('tiles.rate.masterNote')
      : bestOn() && hasBetter(ev, play ? m.score : 0) ? bestWas(ev) : '';
    return `<div class="mc ${cls} pc${m.p}">${whoCell(m.p)}<span class="w${play ? '' : ' quiet'}">${m.hinted ? hintMark() : ''}${
      play ? cardWords(m.words, m.bingo) : m.kind === 'vetoed' ? `${cardWords(m.words, false)} · ${t(m.approval ? 'tiles.hist.notApproved' : 'tiles.hist.vetoed')}` : t(m.kind === 'swap' ? 'tiles.look.swap' : 'tiles.look.pass')}</span>${play ? `<button type="button" class="pt" data-points="${i}" aria-label="${t('tiles.pointsExplain')}">${m.score}</button>` : '<span class="pt">–</span>'}<span class="rr">${
      band ? `<small class="rate rate-${band}"><span class="bn">${t('tiles.rate.' + band)} · </span>${pctOf(credit, reference)}%</small>` : ''}${rarityChip(m)}</span>${under ? `<span class="bw">${under}</span>` : ''}</div>`;
  }
  const endWarning = () => endingNext(S) ? ' ' + t('tiles.endWarning', { n: S.zeros, limit: 2 * S.players.filter((_, p) => !isOut(p)).length }) : '';
  function paintSay() {
    sendDraft();
    const me = shown >= 0 ? shown : solo >= 0 ? solo : S.turn, res = judge();
    const prompt = myTurn() ? t(S.cells.some(Boolean) ? (solo >= 0 ? 'tiles.say.turn' : 'tiles.say.turnOf') : 'tiles.placeCentre', { name: esc(nameOf(S, S.turn)) }) + (!placedOnce && !S.cells.some(Boolean) ? ' ' + t('tiles.firstCue') : '') : '';
    // Validation belongs by the rack; keep the move bar neutral (owner, 2026-11-20).
    const error = myTurn() && mode === 'play' && res?.error ? (res.error === 'word'
      ? t(canApprove(S) ? 'tiles.approval.unknown' : 'tiles.err.unknown', { w: esc(res.bad.join(', ').toUpperCase()) }) : t(ERR[res.error])) : '';
    if (error) moveError.innerHTML = `<span aria-hidden="true">✕</span> ${error}`;
    moveError.classList.toggle('visible', !!error);
    moveError.setAttribute('aria-hidden', String(!error));
    let text = '';
    if (mode === 'exchange') text = t('tiles.ex.pick', { n: picks.size }) + (picks.size ? ' · ' + t('tiles.ex.summary', { letters: esc(exchangeLetters(rackOf(shown), picks, t('tiles.blankName'))) }) : '') + endWarning();
    else if (mode === 'pass') text = t('tiles.pass.ask') + endWarning();
    else if (mode === 'hint') text = msg?.html ?? (levels?.big && S.rules.hintCost ? t('tiles.hint.pickCost', Object.fromEntries(['small', 'big', 'master'].map(l => [l, levels[l] ? hintCost(S.rules, l, levels) : '–'])))
      : t('tiles.hint.pick'));
    else if (res?.error) text = prompt;
    else if (!res && msg) text = msg.html;
    else if (!res && myTurn() && sel >= 0) text = t('tiles.say.tap');
    const mine = lastMove(p => p === me), theirs = lastMove(p => p !== me);
    const card = text ? `<div class="mc me pc${me}">${whoCell(me)}<span class="msg">${text}</span></div>`
      : res && !res.error ? `<div class="mc me live pc${me}">${whoCell(me)}<span class="w">${draft[0].hint ? hintMark() : ''}${cardWords(res.words, draft.length === 7)}</span><button type="button" class="pt" data-points="draft" aria-label="${t('tiles.pointsExplain')}">${res.score}</button><span class="rr">${
        draft[0].hint ? `<small class="hlv">${t('tiles.hint.' + draft[0].hint)}${hintPaid ? ' −' + hintPaid : ''}</small>` : ''}</span></div>`
      : mine >= 0 ? moveCard(mine, 'me')
      : linked && remote(S.turn) ? ''   // the live line already covers the wait (owner, 2026-11-26)
      : `<div class="mc me pc${me}">${whoCell(me)}<span class="msg">${prompt}</span></div>`;
    const other = thinking && S.turn !== me && !linked ? `<div class="mc them pc${S.turn}">${whoCell(S.turn)}<span class="msg">${t('tiles.say.thinking')}</span></div>`
      : theirs >= 0 ? moveCard(theirs, 'them') : '';
    linkHtml = linked ? linkLine() : '';
    say.innerHTML = `${linkHtml}<div class="mcards">${card}${other}</div><p class="mc-bag">${fresh?.p === me ? t('tiles.drew', { l: `<b>${fresh.letters.map(x => x === BLANK ? '?' : esc(x.toUpperCase())).join(' · ')}</b>` }) : ''}</p>`;
    paintDock();
  }

  app.addEventListener('click', e => {
    const b = e.target.closest('[data-points]');
    if (!b || b.disabled) return;
    let state = S, placed = placedOf();
    if (b.dataset.points !== 'draft') {
      const i = +b.dataset.points, m = S.moves[i];
      placed = m.placed;
      // Remove this and subsequent plays; premiums are then evaluated on the original board.
      const cells = [...S.cells];
      for (const move of S.moves.slice(i)) if (move.kind === 'play') for (const d of move.placed) cells[d.r * n + d.c] = null;
      state = { ...S, cells };
    }
    const detail = pointsBreakdown(state, placed);
    openDialog(t('tiles.pointsExplain'), `<div class="tl-calculation">${detail.words.map(w => `<p><b>${esc(w.w.toUpperCase())}</b>: (${w.letters.map(l => `${esc(l.ch.toUpperCase())}${l.blank ? ' (' + t('tiles.blankName') + ')' : ''} ${l.value}${l.multiplier > 1 ? ' × ' + l.multiplier : ''}`).join(' + ')}) × ${w.multiplier} = <b>${w.score}</b></p>`).join('')}${detail.bonus ? `<p>${t('tiles.sevenBonus')}: +${detail.bonus}</p>` : ''}<p><b>${t('tiles.pointsTotal')}: ${detail.score}</b></p></div>`);
  });
  // Online: the mover's activity or the connection, above the move cards (owner, 2026-11-26).
  function linkLine() {
    if (S.over) return '<p class="mc-link"></p>';
    const line = (cls, text, dots, p) => `<p class="mc-link ${cls}"><i class="${p === undefined ? 'ld' : 'tl-player-icon pc' + p}" aria-hidden="true">${p === undefined ? '' : playerIcon(S, p)}</i><span>${text}</span>${dots ? '<span class="tl-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}</p>`;
    if (linkNote) return line('down', t(linkNote));
    if (!host && !linkUp) return line('down', t('net.hostDisconnected'), true);
    const missing = gone(), also = missing.filter(p => p !== S.turn);
    const more = also.length ? ' · ' + also.map(p => t('net.noConnection', { name: esc(nameOf(S, p)) })).join(' · ') : '';
    if (isOut(linkMe)) return line('down', t(removedPlayer(S, linkMe) ? 'net.removed' : 'net.youOut') + more);
    if (!remote(S.turn)) return line(also.length ? 'down' : 'on', t(also.length ? 'net.yourTurn' : 'net.yourMove') + more);
    // whoever is on turn: gone (and for how long - the host knows), in another app, or playing
    const p = S.turn, name = `<strong>${esc(nameOf(S, p))}</strong>`;
    if (missing.includes(p)) return line('down', t('net.turnGone', { name }) + (host && goneSince[p] ? ' · ' + mmss(Date.now() - goneSince[p]) : '') + more, true, p);
    if (away[p]) return line('down', t('net.turnApp', { name }) + more, true, p);
    const key = draftIsCurrent(linkDraft) ? 'placing' : turnMs() >= STILL_THINKING_MS ? 'stillThinking' : 'moving';
    return line('on', t('tiles.bt.' + key, { name }) + more, true, p);
  }
  function paintLinkLine() {
    const html = linkLine(), el = say.querySelector('.mc-link');
    if (el && linkHtml !== html) el.outerHTML = linkHtml = html;
  }

  // Only the current mover's draft flag travels, when it changes (owner, 2026-11-26).
  const draftIsCurrent = m => m && m.id === game.link.id && m.n === S.log.length;
  function sendDraft() {
    if (!linked || !party || remote(S.turn) || !myTurn()) return;
    const placing = draft.length > 0;
    if (placing === !!(draftIsCurrent(sentDraft) && sentDraft.placing)) return;
    sentDraft = { id: game.link.id, n: S.log.length, placing };
    if (host) linkDraft = placing ? sentDraft : null;
    party.draft(sentDraft);
  }
  function receiveDraft(m, p = S.turn) {
    if (S.over || S.vote || p !== S.turn || !remote(p) || !netOk() || !draftIsCurrent(m) || typeof m.placing !== 'boolean') return false;
    if (m.placing === !!draftIsCurrent(linkDraft)) return false;
    linkDraft = m.placing ? m : null;
    paintLinkLine();
    return true;
  }

  function paintRack() {
    if (shown < 0) { rackEl.innerHTML = '<span class="rt" style="visibility:hidden"></span>'.repeat(7); return; }
    const tiles = rackOf(shown), dragging = press?.drag && press.kind === 'rack' && !inDraft(press.slot);
    const voting = new Set(), left = S.vote?.p === shown ? S.vote.placed.map(x => x.blank ? BLANK : x.ch) : [];
    tiles.forEach((ch, i) => { const k = left.indexOf(ch); if (k >= 0) { voting.add(i); left.splice(k, 1); } });
    const order = dragging && rackGap >= 0 ? rackOrder(tiles, press.slot, rackGap) : tiles.map((_, i) => i);
    const drawn = new Set();
    if (fresh?.p === shown) {
      const want = [...fresh.letters];
      for (let i = tiles.length - 1; i >= 0 && want.length; i--) { const k = want.indexOf(tiles[i]); if (k >= 0) { want.splice(k, 1); drawn.add(i); } }
    }
    rackEl.innerHTML = order.map(i => {
      const x = tiles[i], cls = ['rt'];
      const face = x === BLANK ? '' : `${esc(x)}<i class="p">${valueOf(lang, x)}</i>`;
      // The slot stays put when its tile goes down (owner, 2026-11-26). Tap its shadow to find the tile.
      if (inDraft(i)) return `<button type="button" class="rt used shadow" data-slot="${i}" data-act="locate" aria-label="${esc(t('tiles.locate', { tile: x === BLANK ? t('tiles.blankName') : x.toUpperCase() }))}">${face}</button>`;
      if (drawn.has(i)) cls.push('fresh');
      if (voting.has(i)) cls.push('used');
      if (dragging && press.slot === i) cls.push('gap');
      if (sel === i) cls.push('sel');
      if (picks.has(i)) cls.push('pick');
      return `<span class="${cls.join(' ')}" data-slot="${i}">${face}${picks.has(i) ? '<i class="ck">✓</i>' : ''}</span>`;
    }).join('');
  }

  function paintDock() {
    if (S.vote) { dock.innerHTML = ''; return; }
    const off = !myTurn();
    const tool = (act, cls = '') => `<button class="btn btn-ghost tl-tool${cls ? ' ' + cls : ''}" type="button" data-act="${act}">${ICON[act]}<span class="lbl">${
      t(act === 'challenge' ? 'tiles.chal.button' : 'tiles.' + act)}</span></button>`;
    const cancel = `<button class="btn btn-ghost wide" type="button" data-act="cancel">${t(stashedDraft ? 'tiles.backToWord' : 'tiles.cancel')}</button>`;
    if (mode === 'exchange') {
      const ok = picks.size && canExchange(S, picks.size);
      dock.innerHTML = `${cancel}<button class="btn btn-primary play${ok ? '' : ' off'}" type="button" data-act="swap"${ok && !off ? '' : ' disabled'}>${t('tiles.exchangeN', { n: picks.size })} <span class="arrow">→</span></button>`;
    } else if (mode === 'hint') {
      dock.innerHTML = ['small', 'big', 'master'].map(l => { const left = hintsLeft(l);
        return `<button class="btn btn-outline lvl${levels && fadedWhy(l) ? ' off' : ''}" type="button" data-level="${l}"${levels ? '' : ' disabled'}>${t('tiles.hint.' + l)}${Number.isFinite(left) ? ` · ${Math.max(0, left)}` : ''}</button>`; }).join('')
        + cancel;
    } else if (mode === 'pass') {
      dock.innerHTML = `${cancel}<button class="btn btn-primary play" type="button" data-act="passYes"${off ? ' disabled' : ''}>${t('tiles.passConfirm')} <span class="arrow">→</span></button>`;
    } else {
      const res = judge(), ok = !off && res && (!res.error || (res.error === 'word' && canApprove(S)));
      let reason = ok || off || res?.error ? '' : t(S.cells.some(Boolean) ? 'tiles.placeTiles' : 'tiles.placeCentre');
      // Compare rendered text so escaped word errors and the onboarding cue also match.
      const reasonText = document.createElement('span');
      reasonText.innerHTML = reason;
      if (reason && say.querySelector('.mc.me .msg')?.textContent.includes(reasonText.textContent)) reason = '';
      dock.innerHTML = [
        draft.length ? tool('recall') : tool('shuffle', shown < 0 ? 'off' : ''),
        tool('exchange', off || !canExchange(S, 1) ? 'off' : ''),   // stays tappable to say why (design)
        tool('pass', off ? 'off' : ''),
        hintsOn() ? tool('hint', off ? 'off' : '') : '',
        !off && S.pending ? tool('challenge', 'chal') : '',
        canUndo ? `<i class="br" aria-hidden="true"></i><button class="btn btn-ghost tl-tool ur" type="button" data-act="undo" aria-label="${t('tiles.undo')}" title="${t('tiles.undo')}"${undo(S, isWord, 0) ? '' : ' disabled'}>${ICON.undo}</button><button class="btn btn-ghost tl-tool ur" type="button" data-act="redo" aria-label="${t('tiles.redo')}" title="${t('tiles.redo')}"${redoStack.length && !thinking ? '' : ' disabled'}>${ICON.redo}</button>` : '',
        `<button class="btn btn-primary play${ok ? '' : ' off'}" type="button" data-act="play" ${!off && res?.error ? 'aria-describedby="tl-move-error"' : reason ? 'aria-describedby="tl-play-reason"' : ''}${ok ? '' : ' disabled'}>${t(res?.error === 'word' && canApprove(S) ? 'tiles.approval.ask' : 'tiles.play')}${ok && !res.error ? ` <span class="num">${res.score}</span>` : ''}${reason ? `<small id="tl-play-reason">${reason}</small>` : ''}</button>`,
      ].join('');
    }
    refit();
  }

  function paintVote() {
    seeVote();
    const v = S.vote || voteResult;
    voteEl.hidden = !v;
    if (!v) { voteEl.innerHTML = ''; return; }
    const done = !S.vote, remaining = Math.max(0, VOTE_MS - voteMs());
    const buttons = p => `<button class="btn btn-outline" type="button" data-voter="${p}" data-veto="true">${t(v.approval ? 'tiles.approval.allow' : 'tiles.veto.veto')}</button><button class="btn btn-primary" type="button" data-voter="${p}" data-veto="false">${t(v.approval ? 'tiles.approval.reject' : 'tiles.veto.accept')}</button>`;
    const row = p => {
      const voted = p in v.votes, agreed = v.approval ? v.votes[p] : !v.votes[p];
      const disconnected = linked && !done && gone().includes(p);
      const label = disconnected ? t('net.noConnection', { name: nameOf(S, p) }) : voted ? t(v.approval ? agreed ? 'tiles.approval.allow' : 'tiles.approval.reject' : agreed ? 'tiles.veto.accept' : 'tiles.veto.veto') : t('tiles.vote.choosing');
      const canVote = !done && !voted && (!linked || p === linkMe && sentVote !== v.at);
      const status = `<i class="tl-vote-state ${voted ? agreed ? 'yes' : 'no' : done || disconnected ? '' : 'choosing'}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${voted ? agreed ? '✓' : '✕' : done || disconnected ? '–' : '◌'}</i>`;
      return `<div class="tl-voter pc${p}"><span>${esc(nameOf(S, p))}${disconnected ? `<small class="help"> · ${t('net.noConnectionShort')}</small>` : ''}</span>${canVote ? buttons(p) : status}</div>`;
    };
    voteEl.innerHTML = `<div class="tl-vote-head"><strong>${t(v.approval ? 'tiles.approval.title' : 'tiles.veto.title', { name: esc(nameOf(S, v.p)) })}</strong>${done ? '' : `<span class="num">${t('tiles.sec', { n: Math.ceil(remaining / 1000) })}</span>`}</div>
      <p class="tl-vote-words">${cardWords(v.words, v.bingo)} <b>· ${v.score}</b></p>
      ${!done && v.approval && (!linked || linkMe === v.p) ? `<p class="help">${t('tiles.approval.decide', { w: esc(v.approval.join(', ').toUpperCase()) })}</p>` : ''}
      ${done ? '' : `<div class="tl-vote-bar" role="progressbar" aria-label="${esc(t(v.approval ? 'tiles.r.wordsVote' : 'tiles.r.veto'))}" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${Math.ceil(remaining / 1000)}"><i style="width:${remaining / VOTE_MS * 100}%"></i></div>`}
      ${v.voters.map(row).join('')}
      ${!done && linked && v.voters.some(p => gone().includes(p)) ? `<p class="help">${t(v.approval ? 'tiles.approval.disconnected' : 'tiles.veto.disconnected')}</p>` : ''}
      ${done ? `<p class="tl-vote-result ${v.result ? 'yes' : 'no'}" role="status">${v.result ? '✓' : '✕'} ${t(v.approval ? v.result ? 'tiles.vote.allowed' : 'tiles.vote.denied' : v.result ? 'tiles.vote.accepted' : 'tiles.vote.vetoed')}</p>${v.voters.some(p => !(p in v.votes) && (!linked || p === linkMe)) ? `<p class="help">${t('tiles.vote.unneeded')}</p>` : ''}` : ''}`;
    voteEl.querySelectorAll('button').forEach(b => { b.disabled = linked && (!linkUp && !host || !party || !!ended); });
    refit();
  }

  function castVote(p, veto) {
    if (!S.vote || (linked && (p !== linkMe || !party || (!host && (!linkUp || ended)) || sentVote === S.vote.at))) return;
    const action = { type: 'vote', p, veto, at: S.vote.at, ms: voteMs() };
    if (!voteFits(S, p, action)) return;
    if (linked && !host) { sentVote = S.vote.at; party.propose(S.log.length, action); paintVote(); }
    else act(action, true);
  }
  voteEl.addEventListener('click', e => {
    const b = e.target.closest('[data-voter]');
    if (b && !b.disabled) castVote(+b.dataset.voter, b.dataset.veto === 'true');
  });

  // the panel: history, letters left, check a word - or the guide
  function histHtml(filter = histOf) {
    const words = m => m.words.map(x => meaningWord(x.w)).join(', ');
    const rated = rateOn(), rare = rareOn(), column = rated || rare;
    // a hint is not a move: it goes on the row of the move its player then made, as a second line (owner, 2026-09-26) -
    // until that move is made, on a short row of its own
    const hintsOf = new Map();
    let waiting = [];
    S.moves.forEach((m, i) => {
      if (m.kind === 'hint') { waiting.push(m); return; }
      const mine = waiting.filter(h => h.p === m.p);
      if (mine.length) { hintsOf.set(i, mine); waiting = waiting.filter(h => h.p !== m.p); }
    });
    const hintLine = hs => `<small class="hl">${hs.map(h => `<span class="hi" title="${esc(t('tiles.hist.hint', { level: t('tiles.hint.' + h.level) }) + (h.cost ? ` −${h.cost}` : ''))}" aria-label="${t('tiles.rate.hinted')}">${ICON.hint}</span>`).join(' ')}</small>`;
    let no = 0;
    const rows = S.moves.map((m, i) => {
      if (m.kind === 'hint' && !waiting.includes(m)) return '';
      if (m.kind !== 'hint') no++;
      if (filter !== null && m.p !== filter) return '';
      const quiet = m.kind !== 'play';
      const w = m.kind === 'play' ? words(m) + (m.bingo && S.rules.bingo ? `<small> +${S.rules.bingo}</small>` : '') + (m.hinted && !hintsOf.has(i) ? hintMark() : '')
        : m.kind === 'hint' ? hintMark()
          : ['withdrawn', 'vetoed'].includes(m.kind) ? `${words(m)} · ${historyAction(m)}` : historyAction(m);
      const ev = rated && m.kind === 'play' && game.evals?.[i], reference = referenceOf(ev), credit = creditOf(m.score, ev), r = rateOf(credit, reference);
      const best = r && bestOn() && hasBetter(ev, m.score) ? `<small class="best">${bestWas(ev)}</small>` : '';
      const rating = r ? `<small class="rate rate-${r}">${pctOf(credit, reference)}%</small>` : rated && (m.kind === 'pass' || m.kind === 'swap') ? '–' : '';
      return `<li class="pc${m.p}${quiet ? ' quiet' : ''}"><span class="i">${m.kind === 'hint' ? '' : no}</span><span class="w">${w}${best}${hintsOf.has(i) ? hintLine(hintsOf.get(i)) : ''}</span><span class="r">${m.kind === 'hint' ? (m.cost ? '−' + m.cost : '–') : quiet ? '–' : m.score}</span>${
        column ? `<span class="pct">${rating}${rarityChip(m)}</span>` : ''}<span class="who">${esc(nameOf(S, m.p))}</span></li>`;
    }).filter(Boolean).reverse();
    const head = `<li class="head"><span></span><span>${t('tiles.look.played')}</span><span>${t('tiles.hist.pts')}</span>${column ? `<span>${t(rated && rare ? 'tiles.under.both' : rare ? 'tiles.hist.rarity' : 'tiles.hist.rating')}</span>` : ''}<span>${t('tiles.hist.who')}</span></li>`;
    return rows.length ? `<ol class="tl-hist${column ? ' rated' : ''}">${head}${rows.join('')}</ol>` : `<p class="help">${t('tiles.hist.empty')}</p>`;
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
    const focus = kept && document.activeElement === input;
    const which = panel ?? (wide ? 'hist' : null);
    let html = '';
    if (which) {
      const title = which === 'hist' && histOf !== null ? `${t('tiles.history')} · ${esc(nameOf(S, histOf))}` : t({ hist: 'tiles.history', unseen: 'tiles.unseen', check: 'tiles.check' }[which]);
      html = `<div class="tl-panel" role="dialog" aria-label="${title}"><div class="tl-panel-head"><span class="eyebrow grow">${title}</span>
        <button class="btn btn-ghost tl-x" type="button" data-act="close" aria-label="${t('tiles.close')}">${CLOSE}</button></div>${{ hist: histHtml, unseen: unseenHtml, check: checkHtml }[which]()}</div>`;
    }
    if (wide) html += `<p class="tl-keys">${t('tiles.keys')}</p>`;
    more.innerHTML = html;
    const box = more.querySelector('.tl-check');
    if (box) {
      wireCheck(box, lang, S.rules, dict);
      if (kept) {
        const nextInput = box.querySelector('input');
        nextInput.value = kept.value;
        box.querySelector('.res').className = kept.cls;
        box.querySelector('.res').textContent = kept.text;
        box.querySelector('.mean-slot').innerHTML = kept.mean;
        if (focus) { nextInput.focus({ preventScroll: true }); nextInput.setSelectionRange(input.selectionStart, input.selectionEnd); }
      }
    }
    refit();
  }

  // over everything: the blank's letters, who starts, the hand-over between people
  function paintOver() {
    let html = '';
    if (endStep) {
      const o = S.over, sign = v => v > 0 ? '+' + v : v < 0 ? '−' + -v : '0';
      const rows = S.players.map((_, p) => isOut(p) ? '' : `<li class="pc${p}"><i class="tl-player-icon" aria-hidden="true">${playerIcon(S, p)}</i><span class="nm">${esc(nameOf(S, p))}</span><span class="mt-row">${
        S.racks[p].map(ch => `<i class="mtl" style="--s:24px">${ch === BLANK ? '' : esc(ch.toUpperCase())}<i class="p">${valueOf(S.lang, ch) || ''}</i></i>`).join('')}</span><b class="${o.adjust[p] > 0 ? 'plus' : o.adjust[p] < 0 ? 'minus' : ''}">${
        sign(o.adjust[p])}</b></li>`).join('');
      const title = o.reason === 'out' ? t(o.by === solo ? 'tiles.endStep.outYou' : 'tiles.endStep.out', { name: esc(nameOf(S, o.by)) }) : t('tiles.endStep.passes');
      html += `<div class="tl-scrim"></div><div class="tl-hand tl-endstep" role="dialog"><strong>${title}</strong><ul class="tl-left">${rows}</ul><p class="help">${
        t(o.reason === 'out' ? 'tiles.endStep.outHelp' : 'tiles.endStep.passesHelp')}${o.late?.some(Boolean) ? ' ' + t('tiles.endStep.late') : ''}</p><button class="btn btn-primary" type="button" data-act="endGo">${
        t('tiles.endStep.go')} <span class="arrow">→</span></button></div>`;
      over.innerHTML = html;
      return;
    }
    if (blankFor >= 0) {
      const cur = draft[blankFor]?.ch;
      html += `<div class="tl-scrim" data-act="pickCancel"></div><div class="tl-pick" role="dialog"><div class="tl-pick-head"><strong>${t('tiles.blank.title')}</strong><span class="acts"><button class="btn btn-ghost" type="button" data-act="pickRemove">${
        t('tiles.blank.remove')}</button><button class="btn btn-ghost" type="button" data-act="pickCancel">${t('tiles.cancel')}</button></span></div><div class="abc">${abc.map(ch => `<button type="button" data-ch="${ch}" class="${ch === cur ? 'on' : ''}">${ch}</button>`).join('')}</div><p class="help">${t('tiles.blank.help')}</p></div>`;
    }
    if (joinedAs) html += `<div class="tl-toast joined" role="status"><span class="eyebrow">${t('net.youAre')}</span><strong>${esc(nameOf(S, linkMe))}</strong></div>`;
    if (toast) {
      const first = S.start.first;
      html += `<div class="tl-toast" role="status">${game.firstSet ? '' : `<span class="eyebrow">${t('tiles.drawn')}</span>`}<strong>${first === solo ? t('tiles.youStart') : t('tiles.starts', { name: esc(nameOf(S, first)) })}</strong></div>`;
    }
    if (asked) {
      const who = asked.name ? `${esc(asked.name)} (${esc(asked.device || asked.address)})` : esc(asked.device || asked.address);
      if (!asked.seats?.includes(askSeat)) askSeat = asked.seat;
      // always show the next free seat in a small dropdown; only empty seats can be picked (owner, 2026-11-14)
      const pick = `<label class="tl-ask-seat">${t('net.seat')}<select class="input" data-net-seat>${(asked.seats ?? []).map(p => `<option value="${p}"${p === askSeat ? ' selected' : ''}>${esc(nameOf(S, p))}</option>`).join('')}</select></label>`;
      html += `<div class="tl-hand tl-wait" role="dialog"><strong>${t('tiles.bt.asks', { who })}</strong><p class="help">${t('net.asksSeat', { name: `<b>${esc(nameOf(S, askSeat))}</b>` })} ${
        t(game.link.seats?.[askSeat]?.address ? 'tiles.bt.asksOther' : 'tiles.bt.asksHelp')}</p><div class="acts"><button class="btn btn-primary" type="button" data-act="netLetIn">${
        t('tiles.bt.letIn')}</button><button class="btn btn-ghost" type="button" data-act="netRefuse">${t('tiles.bt.refuse')}</button></div>${pick}</div>`;
    } else if (waitCard()) {
      const here = party?.here() ?? [];
      const seats = S.players.map((_, p) => p === linkMe || isOut(p) ? '' : `<li class="pc${p}${here[p] ? ' in' : ''}"><i class="tl-player-icon" aria-hidden="true">${playerIcon(S, p)}</i><span>${esc(nameOf(S, p))}</span><small>${
        t(here[p] ? 'net.seat.in' : 'net.seat.wait')}</small></li>`).join('');
      html += `<div class="tl-hand tl-wait" role="dialog"><span class="tl-dots" aria-hidden="true"><i></i><i></i><i></i></span><strong>${t(S.players.length > 2 ? 'net.waiting' : 'tiles.bt.waiting')}</strong>${
        kind === 'web' ? (roomCode ? `<p class="tl-phone">${t('net.roomCode', { code: `<b class="tl-code">${esc(roomCode)}</b>` })}</p>` : '')
        : myPhone ? `<p class="tl-phone">${kind === 'bt' || kind === 'near' ? t('tiles.bt.thisPhone', { name: `<b>${esc(myPhone)}</b>` }) : t('net.thisGame', { name: `<b>${esc(lanName())}</b>` })}</p>` : ''}${
        kind === 'bt' && findable !== null ? `<p class="tl-findable ${findable ? 'on' : 'off'}">${t(findable ? 'net.findable' : 'net.notFindable')}</p>` : ''}<ul class="tl-seats">${seats}</ul><p class="help">${
        linkNote ? t(linkNote) : t(kind === 'bt' ? 'tiles.bt.waitingHelp' : kind === 'near' ? 'net.waitingHelpNear' : kind === 'web' ? 'net.waitingHelpWeb' : 'net.waitingHelpLan')}${kind === 'lan' && !myWifi ? ' ' + t('net.hostNoWifi') : ''}</p><div class="acts">${kind === 'bt' && (visibleDeclined || findable === false) ? `<button class="btn btn-primary" type="button" data-act="netVisible">${t('net.visible')}</button>` : ''}${linkNote ? `<button class="btn btn-primary" type="button" data-act="netRetry">${
        t('tiles.bt.retry')}</button>` : ''}<button class="btn btn-ghost" type="button" data-act="netLeave">${t(S.log.length ? 'game.saveExit' : 'tiles.cancel')}</button></div></div>`;
    } else if (linked && !host && !ended && linkUp && startWaits() && !joinedAs) {
      const seats = S.players.map((_, p) => p === linkMe || isOut(p) ? '' : `<li class="pc${p}${hereList[p] ? ' in' : ''}"><i class="tl-player-icon" aria-hidden="true">${playerIcon(S, p)}</i><span>${esc(nameOf(S, p))}</span><small>${
        t(hereList[p] ? 'net.seat.in' : 'net.seat.wait')}</small></li>`).join('');
      html += `<div class="tl-hand tl-wait" role="dialog"><span class="tl-dots" aria-hidden="true"><i></i><i></i><i></i></span><strong>${t('net.waiting')}</strong><p class="tl-phone">${
        t('net.youAreIn', { name: `<b>${esc(nameOf(S, linkMe))}</b>` })}</p><ul class="tl-seats">${seats}</ul><p class="help">${t('net.waitStart')}</p><div class="acts"><button class="btn btn-ghost" type="button" data-act="netBack">${
        t('net.leave')}</button></div></div>`;
    } else if (linked && !host && ended && !S.over) {
      const name = `<b>${esc(nameOf(S, hostSeat()))}</b>`;
      html += `<div class="tl-hand tl-wait" role="dialog"><strong>${t('net.ended.' + ended, { name })}</strong><p class="help">${t('net.ended.' + ended + 'Help', { name })}</p><div class="acts">${
        ended === 'lost' ? `<button class="btn btn-primary" type="button" data-act="netRetry">${t('tiles.bt.retry')}</button>` : ''}<button class="btn btn-ghost" type="button" data-act="netBack">${t('net.back')}</button></div></div>`;
    }
    if (handOver) {
      html += `<div class="tl-hand pc${S.turn}" role="dialog"><i class="tl-player-icon" aria-hidden="true">${playerIcon(S, S.turn)}</i><strong>${t('tiles.hand.title', { name: esc(nameOf(S, S.turn)) })}</strong><p class="help">${
        t('tiles.hand.help')}</p><button class="btn btn-primary" type="button" data-act="show">${t('tiles.hand.show')} <span class="arrow">→</span></button></div>`;
    }
    over.innerHTML = html;
    play.classList.toggle('tl-hidden', handOver || !!asked || waitCard() || (linked && !host && !S.over && (!!ended || (linkUp && startWaits()))));
    refit();
  }

  const paintTurn = () => { paintBoard(); paintSay(); paintRack(); paintVote(); };
  const paintAll = () => { seeVote(); paintStatus(); paintTurn(); paintMore(); paintOver(); };

  // ── turns ──
  function resetTurn(keepHints = false) {
    draft = []; sel = -1; mode = 'play'; picks = new Set(); levels = null; cursor = null; blankFor = -1;
    stashedDraft = null;
    if (!keepHints) turnHints = [];
    zoomOut();
  }
  // Every action goes through here: into the engine (apply), the save, what the message line says, the next turn.
  function act(action, fromLink = false, candidates, replaying = false) {
    const p = S.turn, before = S, rackBefore = [...S.racks[p]];
    if (!cpu(p)) redoStack = [];   // a new move: nothing to redo any more
    if (!cpu(p) && !fromLink && !['vote', 'voteEnd'].includes(action.type)) action = { ...action, ms: game.turnMs || 0 };
    let after;
    try { after = apply(before, action, isWord); } catch (e) { msg = { html: esc(e.message), err: true }; paintSay(); return false; }
    const added = after.moves.slice(before.moves.length), played = added.findLast(m => m.kind === 'play'), vetoed = added.findLast(m => m.kind === 'vetoed');
    // Passes and exchanges carry no rating (owner, 2026-11-26). A vote may append a resignation before the accepted move.
    const rated = before.rules.rating !== false && ['play', 'timeout'].includes(added.at(-1)?.kind);
    const evaluation = rated ? evaluateMoves(before, candidates?.() ?? findMoves(before, dict), familiar) : null;
    game.evals = (game.evals ?? []).slice(0, before.moves.length);
    if (added.length) game.evals[after.moves.length - 1] = evaluation;
    S = after;
    if (before.turn !== S.turn || before.vote || !(action.type === 'hint' || (action.type === 'resign' && action.p !== p))) remoteMs = 0;
    game.state = S;
    seeVote();
    // the statistics, as it is played (owner, 2026-09-28): a move of this device's own player makes the game count; the
    // rest keeps its record up to date. Best moves shown to that player mark the game as helped.
    if (!cpu(p) && !remote(p) && (played || (!before.vote && ['exchange', 'pass'].includes(action.type)))) {
      if (played && rateOn() && bestOn()) game.bsOn = true;
      recordMove(game, statsNow());
    } else noteMove(game, statsNow());
    party?.flush(S.log);   // the host: to every phone; a joining phone: to the host
    if (!cpu(p) && !remote(p) && (played || action.type === 'exchange')) drew(p, rackBefore, played ? played.placed.map(x => x.blank ? BLANK : x.ch) : action.tiles);
    game.turnMs = 0;
    resetTurn(!!S.vote || (!!before.vote && S.turn === p));
    // no points bubble on the board after a move (owner, 2026-09-25) - the message line says what was played
    if (played) {
      landing = [...played.placed].sort((a, b) => a.r - b.r || a.c - b.c).map(x => x.r * n + x.c);
    }
    // a challenge's outcome, or a turn lost to the clock, stays on the line while the next player moves
    const approvalMove = vetoed?.approval ? vetoed : played?.approved ? played : null;
    const said = approvalMove ? { html: t(played ? 'tiles.approval.allowed' : 'tiles.approval.denied', { name: esc(nameOf(S, approvalMove.p)), w: (approvalMove.approved || approvalMove.approval).map(w => esc(w.toUpperCase())).join(', ') }), err: !!vetoed } : vetoed ? { html: t('tiles.say.vetoed', { w: vetoed.words.map(x => esc(x.w.toUpperCase())).join(', '), name: esc(nameOf(S, vetoed.p)) }), err: true }
      : report(played ? { type: 'place' } : action, p, evaluation);
    msg = msg?.keep && said && action.type !== 'challenge' ? { ...said, html: `${msg.html} ${said.html}` } : said;
    if (vetoed || approvalMove) {
      const notice = msg;
      setTimeout(() => { if (msg === notice) { msg = null; if (app.isConnected) paintSay(); } }, 4500);
    }
    countAchievements();
    // A settled move either announces the local turn or acknowledges the other mover (owner, 2026-11-26).
    const cue = replaying ? null : tilesMoveCue(before, S, solo);
    if (S.over) { finish(cue, replaying); return true; }
    if (cue === 'turn') turnCuePending = true;
    else if (cue) playCue(cue);
    putSave(game);
    if (vetoed && !linked && !open && solo < 0) shown = -1;
    next(replaying);
    return true;
  }
  function report(action, p, ev) {
    if (S.vote) return null;
    const name = esc(nameOf(S, p)), m = S.moves.at(-1);
    // help used (the end's card): the best move there was, shown to this person under their move (not for Master's, which
    // shows its own reason there)
    const played = action.type === 'place' ? m.score : 0;
    if (!cpu(p) && !remote(p) && ['place', 'timeout'].includes(action.type) && rateOn() && bestOn() && hasBetter(ev, played)
      && !(action.type === 'place' && m.hinted === 'master' && creditOf(played, ev) < referenceOf(ev))) count('best', p);
    if (action.type === 'timeout') return { html: t('tiles.say.timeout'), keep: true };
    if (action.type === 'challenge') {
      if (!m.ok) return { html: p === solo ? t('tiles.chal.okYou') : t('tiles.chal.ok', { name }) };
      const w = esc(S.moves.at(-2).bad.map(w => w.toUpperCase()).join(', '));
      return { html: cpu(p) ? t('tiles.chal.cpu', { name, w }) : t('tiles.chal.gone', { w }), err: true, keep: true };
    }
    return null;
  }
  // the game's statistics record: its numbers for this device's player(s), and the help it had - undo on, the best
  // move shown (those keep a game out of points and records; moves made with a hint keep out by themselves)
  const statsNow = () => ({ ...tilesProgress(game, linked ? linkMe : -1), u: canUndo, bs: !!game.bsOn });
  // ratings shown: the game allows them (New game) and the player's setting has them on
  const rateOn = () => S.rules.rating !== false && settings.tilesRate !== false && (settings.tilesUnder ?? 'rating') !== 'rarity';
  const rareOn = () => ['rarity', 'both'].includes(settings.tilesUnder ?? 'rating');
  const bestOn = () => settings.tilesRate === true && S.rules.rating !== 'score';
  const bestWas = ev => t('tiles.rate.bestWas', { w: `<b>${esc((ev.rarer?.word ?? ev.word).toUpperCase())}</b>`, n: topScoreOf(ev) });
  // Whose turn now: a computer thinks; between people the device changes hands first, the rack hidden.
  function next(replaying = false) {
    if (S.over) return;
    // On one shared device the mover's rack stays private while others vote (owner, 2026-11-14).
    if (S.vote) { thinking = false; handOver = false; if (linked) shown = solo; else if (!open) shown = -1; paintAll(); return; }
    const p = S.turn;
    if (!replaying && turnCuePending && netOk()) {
      turnCuePending = false;
      if (!remote(p) && !cpu(p)) playCue('turn');
    }
    if (remote(p)) { shown = solo; thinking = true; paintAll(); return; }   // their move comes over the link
    if (cpu(p)) { shown = solo; thinking = true; paintAll(); think(); return; }
    if (solo < 0 && !open && shown !== p) { handOver = true; shown = -1; } else shown = p;
    paintAll();
  }
  // The computer's turn: three dots on its side for ~900 ms (longer if it needs it), then its tiles land.
  function think() {
    const at = S, p = S.turn, started = Date.now();
    setTimeout(() => {
      if (!app.isConnected || S !== at) return;
      let action = null, moves;
      const candidates = () => moves ??= findMoves(at, dict);
      try { action = computerMove(S, dict, S.players[p].cpu, rankOf, Math.random, spokenOf, candidates); } catch { /* it passes */ }
      const took = Date.now() - started;
      setTimeout(() => {
        if (!app.isConnected || S !== at) return;
        thinking = false;
        if (!act({ ...(action ?? { type: 'pass' }), ms: took }, false, candidates)) act({ type: 'pass', ms: took }, false, candidates);
      }, Math.max(0, THINK_MS - took));
    }, 60);
  }
  let finished = false;
  function finish(moveCue = null, quiet = false) {
    if (finished) return;   // once: the end and the statistics
    finished = true;
    thinking = false;

    game.status = 'over';
    recordTilesEnd(game, linked ? linkMe : -1, { u: canUndo, bs: !!game.bsOn });   // two phones: each counts its own player
    countAchievements(true);
    if (!quiet) {
      const winner = S.over.winner;
      const outcome = winner < 0 ? null : (solo >= 0 ? winner === solo : !cpu(winner)) ? 'win' : 'loss';
      if (moveCue && outcome) playCue(moveCue, outcome);
      else if (outcome || moveCue) playCue(outcome ?? moveCue);
    }
    // The end as it happened (owner, 2026-09-28: "the computer's last move is done in an instant and you are teleported
    // to the results"): that move lands on the board, then a card - the bag empty, or only passes - with the tiles left
    // on each rack and what they cost, then Continue → the results. Giving up goes straight there.
    if (['out', 'passes'].includes(S.over.reason)) {
      paintAll();
      setTimeout(() => { if (!app.isConnected) return; endStep = true; paintOver(); }, 1400);
      return;
    }
    paintEnd();
  }
  // Give up ends the game for everyone (tiles.js): the person to move gives up - or, on a computer's turn, the
  // one person playing (the first of several).
  function giveUp() {
    if (S.over || (linked && !host && !linkUp)) return;   // a joining phone gives up through the host
    thinking = false;
    act({ type: 'resign', p: linked ? linkMe : !cpu(S.turn) ? S.turn : solo >= 0 ? solo : people[0] ?? S.turn });
  }

  // ── the tools ──
  const quiet = () => { draft = []; sel = -1; cursor = null; blankFor = -1; zoomOut(); };
  // Pass and Exchange set the word and its view aside until the player decides (owner, 2026-11-26).
  function setAside(nextMode) {
    stashedDraft = draft.length ? { draft, sel, cursor, blankFor, zoom: { ...zoom }, manualOverview } : null;
    quiet();
    mode = nextMode;
    picks = new Set();
    paintTurn();
    paintOver();
  }
  const TOOLS = {
    shuffle() {
      if (S.vote || shown < 0 || draft.length) return;
      const list = rackOf(shown);
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      setOrder(shown, list);
      sel = -1;
      paintRack();
      rackEl.querySelectorAll('.rt').forEach(el => el.animate([{ transform: 'scale(.85)', opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' }));
    },
    recall() { quiet(); paintTurn(); paintOver(); },
    locate(el) { locateTile(+el.dataset.slot); },
    options() { openOptions(); },
    // the host stops waiting: a game with no move yet goes, one under way stays saved
    netLeave() {
      if (!S.log.length) { stopLink(); deleteSave(game.id); }
      location.replace('#/games/tiles');
    },
    netLetIn() { if (asked) party.letIn(asked.conn, askSeat); },
    netVisible() { visibleDeclined = false; paintOver(); askVisible(false); },
    netRefuse() { if (asked) party.refuse(asked.conn); },
    netRetry() {
      linkNote = '';
      if (host) { paintAll(); return hosting(); }
      ended = '';
        paintAll();
      connect();
    },
    netBack() { location.replace('#/games/tiles'); },
    endGo() { endStep = false; over.innerHTML = ''; paintEnd(); },
    // Redo: the move an undo took back, returned - until a new move is made
    redo() {
      const back = !thinking && redoStack.pop();
      if (!back) return;
      S = back.state;
      game.state = S;
      game.evals = back.evals;
      game.turnMs = 0;
      resetTurn();
      msg = { html: t('tiles.say.redone') };
      fresh = null;
      putSave(game);
      next();
    },
    exchange() {
      if (!myTurn()) return;
      if (!canExchange(S, 1)) {
        msg = { html: S.bag.length ? t('tiles.ex.off', { n: S.bag.length }) : t('tiles.ex.offAny'), err: true };
        return paintSay();
      }
      setAside('exchange');
    },
    pass() { if (myTurn()) setAside('pass'); },
    // Hint (owner, 2026-09-25): three levels - Small, Big, Master (tiles-moves.js hintLevels) - picked on the tool row;
    // the move goes straight onto the board as dashed tiles, in its place, with its points: Play plays it, Recall takes
    // it back. A level that would show the same move as a smaller one is faded, and says so when tapped.
    hint() {
      if (!myTurn() || !hintsOn()) return;
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
      // a hint's move, or the same move put down by hand after its tiles went back to the rack
      const hint = draft[0]?.hint ?? turnHints.find(h => h.key === keyOf(placedOf()))?.level;
      if (myTurn() && res && (!res.error || (res.error === 'word' && canApprove(S)))) act({ type: 'place', placed: placedOf(), ...(hint ? { hint } : {}) });
    },
    cancel() {
      if (stashedDraft) {
        ({ draft, sel, cursor, blankFor, zoom, manualOverview } = stashedDraft);
        stashedDraft = null;
      }
      mode = 'play'; picks = new Set(); levels = null; msg = null;
      paintTurn();
      paintOver();
    },
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
      redoStack.push({ state: S, evals: game.evals });
      S = back;
      game.state = S;
      game.evals = (game.evals ?? []).slice(0, S.moves.length);
      game.turnMs = 0;
      count('undo', solo);
      thinking = false;
      resetTurn();
      msg = { html: t('tiles.say.undone') };
      fresh = null;
      putSave(game);
      next();
    },
    guide() { if (!S.over) openRules('tiles', topics(S.rules)); },
    close() { panel = null; histOf = null; paintMore(); },
    show() { handOver = false; shown = S.turn; paintAll(); },
    pickCancel() {
      if (draft[blankFor] && !draft[blankFor].ch) draft.splice(blankFor, 1);   // a blank with no letter goes back
      blankFor = -1;
      paintOver();
      paintTurn();
    },
    // the blank alone back to the rack from its letter picker (owner, 2026-09-26)
    pickRemove() {
      if (draft[blankFor]) draft.splice(blankFor, 1);
      blankFor = -1;
      paintOver();
      paintTurn();
    },
  };
  // why a hint level is faded - it would show the same move as a smaller one, or (Small) there is no common-word move
  // how many hints of a level the player to move has left: Infinity with no limit (rules.hintMax - New game)
  const hintsLeft = level => { const max = S.rules.hintMax?.[level]; return max == null ? Infinity : max - (game.hintsBy?.[S.turn]?.[level] ?? 0); };
  const hintsOn = () => S.rules.hints !== false && ['small', 'big', 'master'].some(l => S.rules.hintMax?.[l] !== 0);
  function fadedWhy(level) {
    const name = t('tiles.hint.' + level);
    if (S.rules.hintMax?.[level] === 0) return t('tiles.hint.offLevel', { level: name });
    if (hintsLeft(level) <= 0) return t('tiles.hint.noneLeft', { level: name });
    const { small, big, master } = levels, same = (a, b) => t('tiles.hint.same', { a: t('tiles.hint.' + a), b: t('tiles.hint.' + b) });
    // "the same as a smaller one" only counts when that one can still be taken (not off, not used up)
    const usable = l => S.rules.hintMax?.[l] !== 0 && hintsLeft(l) > 0 && levels[l];
    if (level === 'small') return small ? null : t('tiles.hint.noSmall');
    if (level === 'big') return usable('small') && sameMove(big, small) ? same('big', 'small') : null;
    return usable('big') && sameMove(master, big) ? same('master', 'big') : usable('small') && sameMove(master, small) ? same('master', 'small') : null;
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
    turnHints.push({ level, key: keyOf(levels[level].placed) });
    mode = 'play'; msg = null; sel = -1; cursor = null;
    hintPaid = hintCost(S.rules, level, levels);
    S = apply(S, { type: 'hint', level, cost: hintPaid }, isWord);   // one hint, whichever level; its cost off the score
    game.hintsBy = S.players.map((_, p) => ({ small: 0, big: 0, master: 0, ...game.hintsBy?.[p] }));
    game.hintsBy[S.turn][level]++;   // and one of this level, for the limits (New game)
    levels = null;
    game.state = S;
    putSave(game);
    party?.flush(S.log);
    follow();
    paintStatus();   // the score, when the hint cost points
    paintTurn();
  }
  let hintPaid = 0, turnHints = [], ratedInStats = false;
  // The letters a person just drew from the bag: outlined on their rack for 5 s, or until a rack tile is touched (owner,
  // 2026-09-26). The rack after the move less what stayed of the rack before it.
  let fresh = null, freshTimer = 0, redoStack = [];
  function drew(p, before, gone) {
    const kept = [...before];
    for (const x of gone) { const k = kept.indexOf(x); if (k >= 0) kept.splice(k, 1); }
    const letters = [...S.racks[p]];
    for (const x of kept) { const k = letters.indexOf(x); if (k >= 0) letters.splice(k, 1); }
    fresh = letters.length ? { p, letters } : null;
    clearTimeout(freshTimer);
    if (fresh) freshTimer = setTimeout(() => { fresh = null; if (app.isConnected && !S.over) { paintRack(); paintSay(); } }, 5000);
  }
  // help used, per player, for the end's card: how often the best move was shown to them, how often they undid a move
  const count = (what, p) => { if (p < 0) return; game.aids ??= {}; (game.aids[what] ??= [])[p] = (game.aids[what][p] || 0) + 1; };   // the moves the hints showed this turn
  // Settled local plays only; wait for rarity, and never count undo-enabled games (owner, 2026-11-14).
  function countAchievements(atEnd = false) {
    if (!lex || !counts(game)) return;
    const mine = linked ? [linkMe] : people, before = game.achDone;
    while (game.achDone < S.moves.length) {
      if (S.pending && game.achDone >= (S.pending.before?.moves?.length ?? S.moves.length - 1)) break;
      const m = S.moves[game.achDone++];
      if (m.kind !== 'play' || m.hinted || m.approved || cpu(m.p) || !mine.includes(m.p)) continue;
      bump('tiles.words', 1, game);
      bump('tiles.letters', m.placed.length, game);
      const rarePct = listedPct(m.words ?? [], rankOf, lex.count);
      for (const id of playChallenges(m, { rarePct })) grant(id, game);
    }
    if (atEnd || S.over) for (const id of gameChallenges(S, mine)) grant(id, game);
    if (game.achDone !== before && !S.over) putSave(game);
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
    playCue('tile');
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
  function locateTile(slot) {
    const d = draft.find(d => d.slot === slot);
    if (!d) return;
    tb.querySelector(`[data-i="${d.r * n + d.c}"]`)?.animate([
      { backgroundColor: 'color-mix(in srgb, var(--tl-tile) 55%, var(--accent))', offset: 0.15 },
    ], { duration: 1000, easing: 'ease-out' });
  }
  function rackOrder(tiles, slot, gap) {
    const order = tiles.map((_, i) => i), loose = order.filter(i => i !== slot && !inDraft(i));
    loose.splice(gap, 0, slot);
    return order.map(i => inDraft(i) ? i : loose.shift());
  }
  function reorder(slot, gap) {
    const tiles = rackOf(shown);
    setOrder(shown, rackOrder(tiles, slot, gap).map(i => tiles[i]));
    sel = -1;
    putSave(game);
  }

  // the square under a point on the screen, through the zoom - or null off the board
  // measured on the grid as it is drawn (zoomed, panned, and a little lower with raised tiles), inside the board's frame
  // the grid as laid out (inside the board's frame, before any zoom)
  const gridBox = () => { const b = boardEl.getBoundingClientRect(); return { left: b.left + tb.offsetLeft, top: b.top + tb.offsetTop, width: tb.offsetWidth, height: tb.offsetHeight }; };
  function squareAt(x, y) {
    const box = boardEl.getBoundingClientRect();
    if (x < box.left || y < box.top || x >= box.right || y >= box.bottom) return null;
    const g = tb.getBoundingClientRect(), r = Math.floor((y - g.top) / g.height * n), c = Math.floor((x - g.left) / g.width * n);
    return r >= 0 && c >= 0 && r < n && c < n ? { r, c } : null;
  }
  const overRack = (x, y) => { const b = rackEl.getBoundingClientRect(); return x >= b.left - 8 && x <= b.right + 8 && y >= b.top - 20 && y <= b.bottom + 20; };
  function gapAt(x) {
    let best = 0, d = Infinity;
    [...rackEl.children].filter(el => !inDraft(+el.dataset.slot)).forEach((el, k) => {
      const b = el.getBoundingClientRect(), dd = Math.abs(b.left + b.width / 2 - x);
      if (dd < d) { d = dd; best = k; }
    });
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
      const b = gridBox(), fx = (x - b.left) / b.width, fy = (y - b.top) / b.height;
      if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
        const dx = fx < 0.08 ? 0.02 : fx > 0.92 ? -0.02 : 0, dy = fy < 0.08 ? 0.02 : fy > 0.92 ? -0.02 : 0;
        if (dx || dy) { zoom = { ...zoom, x: clampPan(zoom.x + dx, zoom.z), y: clampPan(zoom.y + dy, zoom.z) }; applyZoom(true); }
      }
    }
    const sq = myTurn() ? squareAt(x, y) : null;
    const drop = sq && (free(sq.r, sq.c, press.kind === 'tile' ? press.di : -1) || swapTarget(press, sq) >= 0) ? sq.r * n + sq.c : -1;
    if (drop !== dropAt) { dropAt = drop; paintBoard(); }
    const gap = press.kind === 'rack' && overRack(x, y) ? gapAt(x) : -1;
    if (gap !== rackGap) { rackGap = gap; paintRack(); }
  }
  function tap(p, heldMs) {
    if (p.kind === 'rack') {
      if (mode === 'exchange') { if (picks.has(p.slot)) picks.delete(p.slot); else picks.add(p.slot); return; }
      if (mode === 'play') { sel = sel === p.slot ? -1 : p.slot; cursor = null; }
      return;
    }
    if (p.kind === 'tile') {
      const d = draft[p.di];
      if (!myTurn() || mode !== 'play' || !d || d.hint) return;
      sel = -1; cursor = null;
      if (d.blank && heldMs >= 500) openPicker(p.di);
      else draft.splice(p.di, 1);
      return;
    }
    const sq = p.cell;
    if (sq && S.cells[sq.r * n + sq.c]) return peek(sq.r * n + sq.c);
    if (!sq || !myTurn() || mode !== 'play' || !free(sq.r, sq.c)) return;
    if (sel >= 0) return placeAt(sel, sq.r, sq.c);
    // a computer: click a square to type there, again to turn across ↔ down
    if (desk) cursor = cursor && cursor.r === sq.r && cursor.c === sq.c ? { ...cursor, down: !cursor.down } : { r: sq.r, c: sq.c, down: cursor?.down ?? false };
  }
  // A tile tapped on the board fades and shows the square under it - a bonus or a plain one (owner, 2026-09-26:
  // "click a letter to see if there is a bonus under it"). Any time, whoever's turn it is; back on a second tap, or by
  // itself after 5 s.
  let peekAt = -1, peekTimer = 0;
  function peek(i) {
    peekAt = peekAt === i ? -1 : i;
    clearTimeout(peekTimer);
    if (peekAt >= 0) peekTimer = setTimeout(() => { peekAt = -1; if (app.isConnected && !S.over) paintBoard(); }, 5000);
    paintBoard();
  }
  // Only the player's own draft can trade squares; hints and settled tiles stay put.
  function swapTarget(p, sq) {
    if (!sq || !myTurn() || mode !== 'play' || S.cells[sq.r * n + sq.c]) return -1;
    if (p.kind !== 'rack' && (p.kind !== 'tile' || !draft[p.di] || draft[p.di].hint)) return -1;
    return draft.findIndex((d, i) => i !== (p.kind === 'tile' ? p.di : -1) && !d.hint && d.r === sq.r && d.c === sq.c);
  }
  function swapDraft(from, to) {
    const { r, c } = draft[from], other = draft[to];
    draft[from] = { ...draft[from], r: other.r, c: other.c };
    draft[to] = { ...other, r, c };
    playCue('tile');
    follow();
  }
  function drop(p, x, y) {
    const sq = squareAt(x, y);
    const target = swapTarget(p, sq);
    if (p.kind === 'rack') {
      if (target >= 0) { draft.splice(target, 1); return placeAt(p.slot, sq.r, sq.c); }
      if (sq && myTurn() && mode === 'play' && free(sq.r, sq.c)) return placeAt(p.slot, sq.r, sq.c);
      if (rackGap >= 0) reorder(p.slot, rackGap);
      return;
    }
    if (target >= 0) swapDraft(p.di, target);
    else if (sq && free(sq.r, sq.c, p.di)) {
      if (draft[p.di].r !== sq.r || draft[p.di].c !== sq.c) playCue('tile');
      draft[p.di] = { ...draft[p.di], r: sq.r, c: sq.c };
      follow();
    } else if (overRack(x, y)) draft.splice(p.di, 1);
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
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp, drag: false, cell, di, slot: rt ? +rt.dataset.slot : -1, pan: { ...zoom },
      kind: rt ? 'rack' : di >= 0 && myTurn() && !draft[di].hint ? 'tile' : 'board' };
    if (rt && fresh) { fresh = null; clearTimeout(freshTimer); }
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
      const b = gridBox();
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
      if (!p.drag) tap(p, e.timeStamp - p.at);
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
    const [a, b] = [...touches.values()], box = gridBox();
    const z = Math.min(ZOOM_MAX, Math.max(1, pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d));
    const u = (pinch.m[0] - box.left) / box.width / pinch.z - pinch.x, v = (pinch.m[1] - box.top) / box.height / pinch.z - pinch.y;
    const mx = ((a[0] + b[0]) / 2 - box.left) / box.width, my = ((a[1] + b[1]) / 2 - box.top) / box.height;
    manualOverview = z === 1;
    zoom = z === 1 ? { z: 1, x: 0, y: 0 } : { z, x: clampPan(mx / z - u, z), y: clampPan(my / z - v, z) };
    applyZoom(true);
  }

  app.addEventListener('click', e => {
    const el = e.target.closest('[data-act], [data-open], [data-ch], [data-level]');
    if (!el || (S.over && el.dataset.act !== 'endGo')) return;   // (the end's card still leads on to the results)
    if (el.dataset.open) {
      const who = el.dataset.who === undefined ? null : +el.dataset.who;   // a score chip: that player's History only
      panel = !wide && panel === el.dataset.open && histOf === who ? null : el.dataset.open;
      histOf = who;
      paintMore();
      if (panel === 'check') more.querySelector('.tl-check input')?.focus();   // ready to type
      return;
    }
    if (el.dataset.ch) return pickLetter(el.dataset.ch);
    if (el.dataset.level) return pickHint(el.dataset.level);
    if (el.disabled) return;
    if (el.dataset.act === 'wholeBoard') { zoomOut(); manualOverview = true; applyZoom(); return; }
    if (el.dataset.act === 'zoomIn') { manualOverview = false; zoom.z = Math.min(ZOOM_MAX, zoom.z + .5); zoom.x = zoom.y = clampPan((1 / zoom.z - 1) / 2, zoom.z); follow(); applyZoom(); return; }
    TOOLS[el.dataset.act]?.(el);
  });
  over.addEventListener('change', e => {
    if (!e.target.matches('[data-net-seat]') || !asked?.seats?.includes(+e.target.value)) return;
    askSeat = +e.target.value;
    paintOver();
    over.querySelector('[data-net-seat]')?.focus();
  });
  // A button pressed with the pointer does not take the focus: Enter would press it again instead of playing.
  app.addEventListener('pointerdown', e => { if (e.target.closest('.tl-dock button, .status button')) e.preventDefault(); });

  // A computer keyboard: click a square, then type from the rack; the cursor skips tiles already down.
  // ← → across, ↑ ↓ down, Backspace takes the last tile back, Enter plays, Esc recalls (then leaves, main.js).
  function onKey(e) {
    if (!app.isConnected || e.defaultPrevented || S.over) return;
    if (e.target.closest?.('input, textarea, select')) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a')) return;
    if (e.metaKey || ((e.ctrlKey || e.altKey) && !e.getModifierState?.('AltGraph'))) return;
    if (toast) endToast();
    const ch = e.key.length === 1 ? e.key.toLowerCase() : '';
    if (blankFor >= 0) {
      if (letterSet(lang).values[ch]) { e.preventDefault(); pickLetter(ch); } else if (e.key === 'Escape') { e.preventDefault(); TOOLS.pickCancel(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); TOOLS.pickRemove(); }
      return;
    }
    if (e.key === 'Escape') {
      if (panel && !wide) { e.preventDefault(); panel = null; return paintMore(); }
      if (mode === 'pass' || mode === 'exchange') { e.preventDefault(); return TOOLS.cancel(); }
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
    const saved = archived ? game : getFinished(game.id);
    const o = S.over, np = S.players.length, whose = people.length ? people : S.players.map((_, p) => p);
    const inPlay = p => !outOf(S)[p] && !(o.reason === 'resign' && p === o.by);
    const best = Math.max(...S.scores.filter((_, p) => inPlay(p)));
    let tone, what, pts;
    if (solo >= 0) {
      pts = S.scores[solo];
      [tone, what] = !inPlay(solo) ? ['lost', t(removedPlayer(S, solo) ? 'net.removed' : 'tiles.end.gaveUp')] : o.winner === solo ? ['won', t('tiles.end.won')]
        : o.winner < 0 && pts === best ? ['draw', t('tiles.end.draw')] : ['lost', t('tiles.end.lost')];
    } else {
      pts = o.winner >= 0 ? S.scores[o.winner] : best;
      [tone, what] = o.winner >= 0 ? ['won', t('tiles.end.wins', { name: esc(nameOf(S, o.winner)) })] : ['draw', t('tiles.end.draw')];
    }
    const head = tone === 'draw'
      ? `<div class="outcome draw" role="status"><span class="mark" aria-hidden="true">=</span><span class="what">${what}</span><span class="count">${pts}<small>${t('tiles.end.pts')}</small></span></div>`
      : outcome(tone === 'won', what, pts, t('tiles.end.pts'));
    const order = finalOrder(S);
    // a computer's level beside its name (owner, 2026-09-26: "the difficulty is not shown")
    const nameLv = p => esc(nameOf(S, p)) + (!inPlay(p) ? ` <small>(${t('net.withdrawn')})</small>` : '') + (S.players[p].cpu ? ` <span class="lv">· ${t(levelKey(S.players[p].cpu))}</span>` : '');
    const scores = np === 2
      ? `<div class="tl-fs">${[0, 1].map(p => `<span class="${S.scores[p] < best || !inPlay(p) ? 'lose' : ''}"><small class="eyebrow">${cpu(p) ? playerIcon(S, p) : ''}${nameLv(p)}</small><b>${S.scores[p]}</b></span>`).join('<span class="colon">:</span>')}</div>`
      : `<ol class="tl-places">${order.map((p, k) => `<li class="pc${p}${S.scores[p] === best && inPlay(p) ? ' first' : ''}"><span>${k + 1}.</span><i class="tl-player-icon" aria-hidden="true">${playerIcon(S, p)}</i><span>${nameLv(p)}</span><b>${S.scores[p]}</b></li>`).join('')}</ol>`;
    // what the leftover tiles did to the scores (and the clock, per game)
    const sign = v => v > 0 ? '+' + v : v < 0 ? '−' + -v : '0';
    const why = o.reason === 'out' ? (o.by === solo ? t('tiles.end.outYou') : t('tiles.end.out', { name: esc(nameOf(S, o.by)) }))
      : o.reason === 'passes' ? t('tiles.end.passes') : o.reason === 'ended' ? t('tiles.end.ended') : t('tiles.end.stopped');
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
    // Help used, person by person (owner, 2026-09-26: "tell exactly how the user was playing - any easier features, or
    // fair and square"): hints by level and their cost, the points hinted words brought, the best move shown, undo
    const fairOf = p => {
      const hs = S.moves.filter(m => m.kind === 'hint' && m.p === p), plays = S.moves.filter(m => m.kind === 'play' && m.p === p);
      const byLevel = ['small', 'big', 'master'].map(l => [l, hs.filter(h => h.level === l).length]).filter(([, k]) => k);
      const cost = hs.reduce((a, h) => a + (h.cost || 0), 0);
      const pts = plays.reduce((a, m) => a + m.score, 0), fromHints = plays.filter(m => m.hinted).reduce((a, m) => a + m.score, 0);
      const shown = game.aids?.best?.[p] || 0, undone = game.aids?.undo?.[p] || 0;
      if (!hs.length && !shown && !undone) return `<div class="fair-p">${people.length > 1 ? `<b class="fair-who">${esc(nameOf(S, p))}</b>` : ''}<p class="fair-ok">✓ ${t('tiles.fair.none')}</p></div>`;
      const rows = [
        [t('tiles.fair.hints'), byLevel.length ? byLevel.map(([l, k]) => `${t('tiles.hint.' + l)} ×${k}`).join(' · ') + (cost ? ` (${t('tiles.fair.cost', { n: cost })})` : '') : t('tiles.fair.no')],
        ...(fromHints ? [[t('tiles.fair.points'), t('tiles.fair.pointsOf', { a: fromHints, b: pts, p: Math.round(fromHints / pts * 100) })]] : []),
        ...(S.rules.rating === true ? [[t('tiles.fair.best'), shown ? t('tiles.fair.bestAfter', { n: shown }) : t('tiles.fair.no')]] : []),
        ...(canUndo ? [[t('tiles.fair.undo'), undone || t('tiles.fair.no')]] : []),
      ];
      return `<div class="fair-p">${people.length > 1 ? `<b class="fair-who">${esc(nameOf(S, p))}</b>` : ''}<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
    };
    play.remove();
    main.innerHTML = `${head}
    <div class="card result ${tone}">
      <span class="eyebrow">${t('tiles.end.final')}</span>
      ${scores}
      <p class="calc">${why}${adjust}${late ? '<br>' + late : ''}</p>
      ${people.length ? `<p class="calc tl-times">${t('tiles.end.time')}: ${people.map(p => `${esc(nameOf(S, p))} ${mmss(S.clock?.[p] || 0)}`).join(' · ')}</p>` : ''}
      ${top ? `<div class="tl-best"><span class="eyebrow">${t('tiles.end.bestWord')}</span><span class="mt-row">${tilesOf(top)}</span><span class="num">${top.score}</span></div>` : ''}
      <div class="result-stats"><span><b>${bingos}</b> ${plural(bingos, 'tiles.end.bingos')}</span>${DOT}<span><b>${hints}</b> ${plural(hints, 'tiles.end.hints')}</span>${DOT}<span>${t('tiles.board.' + S.board)}</span></div>
      <div class="result-actions">${archived ? '' : `${host && party ? `<button class="btn btn-primary" type="button" data-rematch>${t('net.rematch')}</button>` : ''}<a class="btn btn-ghost" href="#/">${UI_ICONS.menu}${t('menu')}</a><a class="btn btn-primary" href="${linked ? '#/online' : '#/new/tiles'}">${t(linked ? 'games.new' : 'lt.again')} <span class="arrow">→</span></a>`}${keepButton(saved)}</div>
    </div>
    ${matchDetails(S, game.timeMs)}
    <div class="tl-final">
      <button class="btn btn-outline" type="button" data-replay aria-expanded="false" aria-controls="tl-replay-controls">${t('tiles.replay')}</button>
      <div class="tl-replay-controls" id="tl-replay-controls" hidden>
        <div class="tl-replay-steps">${[['⏮', 'first'], ['◀', 'prev'], ['▶', 'next'], ['⏭', 'last']].map(([icon, key]) =>
          `<button class="btn btn-outline" type="button" data-step="${key}" aria-label="${t('tiles.replay.' + key)}" title="${t('tiles.replay.' + key)}">${icon}</button>`).join('')}</div>
        <div role="status"><b></b><p></p></div>
      </div>
      <div class="tl-board"><div class="tb n${n}${looks()}" style="--n:${n}">${boardInner(S)}</div></div>
    </div>
    ${people.length ? `<div class="card tl-fair"><span class="eyebrow">${t('tiles.fair.title')}</span>${people.map(fairOf).join('')}</div>` : ''}
    <section class="card tl-end-history" aria-labelledby="tl-end-history-title">
      <div class="tl-end-history-head"><h2 id="tl-end-history-title">${t('tiles.history')}</h2>
        <button class="btn btn-outline" type="button" data-share>${ICON.share}${t('tiles.share')}</button></div>
      <p class="help tl-share-status" role="status"></p>
      <div class="seg">${[[null, t('tiles.hist.all')], ...S.players.map((_, p) => [p, esc(nameOf(S, p))])].map(([p, label]) =>
        `<button type="button" data-filter="${p ?? ''}" aria-pressed="${p === null}" class="${p === null ? 'on' : ''}">${label}</button>`).join('')}</div>
      <div class="tl-end-moves">${histHtml(null)}</div>
    </section>
    <div class="card tl-look" hidden></div>`;
    main.querySelector('[data-rematch]')?.addEventListener('click', rematch);
    wireKeep(main, saved);
    const finalBoard = main.querySelector('.tl-final .tb');
    wireReplay(main, S, finalBoard);
    // Finished History also opens from Last games (owner, 2026-11-26).
    const history = main.querySelector('.tl-end-history'), share = history.querySelector('[data-share]');
    history.querySelector('.seg').addEventListener('click', e => {
      const filter = e.target.closest('[data-filter]');
      if (!filter) return;
      history.querySelector('.tl-end-moves').innerHTML = histHtml(filter.dataset.filter === '' ? null : +filter.dataset.filter);
      history.querySelectorAll('[data-filter]').forEach(b => {
        b.classList.toggle('on', b === filter);
        b.setAttribute('aria-pressed', b === filter);
      });
    });
    share.addEventListener('click', async () => {
      if (share.disabled) return;
      share.disabled = true;
      const status = history.querySelector('.tl-share-status');
      status.textContent = '';
      try {
        if (await shareTilesStory(S, order, S.players.map((_, p) => nameOf(S, p)))) status.textContent = t('tiles.share.saved');
      } catch {
        status.textContent = t('tiles.share.failed');
      } finally {
        share.disabled = false;
      }
    });
    root.scrollTo({ top: 0, behavior: 'smooth' });
    cells.observe(finalBoard);
    refit();
    // The end review replays the moves and reuses the saved benchmarks where available.
    const box = main.querySelector('.tl-look');
    setTimeout(async () => {
      await wordsReady;
      if (!box?.isConnected || !dict || S.rules.rating === false) return;   // a game without ratings: none at the end either
      let rows;
      try {
        rows = lookBack(S, dict, true, (before, i) => game.evals?.[i] ?? evaluateMoves(before, findMoves(before, dict), familiar));
      } catch { return; }
      if (!rows.length) return;
      const sum = (p, k, hints = true) => rows.filter(x => x.p === p && (hints || !x.hinted)).reduce((a, x) => {
        return a + (k === 'best' ? referenceOf(x.evaluation) : creditOf(x.played, x.evaluation));
      }, 0);
      // the people's moves into the statistics' move rating, once
      if (!archived && !ratedInStats) {
        ratedInStats = true;
        const people = linked ? [linkMe] : S.players.map((x, p) => x.cpu ? -1 : p).filter(p => p >= 0);
        // without the moves from hints - else it says nothing about the player (owner, 2026-09-26)
        recordTilesRating(game, people.reduce((a, p) => a + sum(p, 'played', false), 0), people.reduce((a, p) => a + sum(p, 'best', false), 0));
      }
      const overall = hints => S.players.map((_, p) => { const best = sum(p, 'best', hints), got = sum(p, 'played', hints), r = rateOf(got, best);
        return `<li class="pc${p}"><i class="tl-player-icon" aria-hidden="true">${playerIcon(S, p)}</i><span>${esc(nameOf(S, p))}</span>${r ? `<span class="rate rate-${r}">${t('tiles.rate.' + r)} · ${pctOf(got, best)}%</span>` : '<span>—</span>'}</li>`; }).join('');
      // a switch right here (owner, 2026-09-26): the overall ratings with or without the moves from hints - not saved
      const hintSwitch = rows.some(x => x.hinted) ? `<div class="tl-hsw"><span>${t('tiles.eval.countHints')}</span><button type="button" class="toggle on" role="switch" aria-checked="true" aria-label="${t('tiles.eval.countHints')}"></button></div>` : '';
      // the best move of each turn only where the game shows best moves - at the end nobody remembers what they could have
      // played, so there it is the ratings alone (owner, 2026-09-27)
      const withBest = bestOn();
      box.innerHTML = `<span class="eyebrow">${t('tiles.eval')}</span><ul class="tl-evals">${overall(true)}</ul>${hintSwitch}<p class="help">${t('tiles.eval.help')}</p><ol${withBest ? '' : ' class="nobest"'}><li class="head"><span></span><span>${t('tiles.look.played')}</span><span>${t('tiles.hist.rating')}</span>${withBest ? `<span>${t('tiles.look.best')}</span>` : ''}<span>${t('tiles.hist.who')}</span></li>${rows.map((x, k) => {
        const ev = x.evaluation, reference = referenceOf(ev), same = !hasBetter(ev, x.played);
        const played = x.kind === 'place' ? `${esc(x.word)} <small>${x.played}</small>` : `<small>${t(x.kind === 'exchange' ? 'tiles.look.swap' : 'tiles.look.pass')}</small>`;
        const credit = creditOf(x.played, ev), r = rateOf(credit, reference);
        return `<li class="pc${x.p}${same ? ' same' : ''}"><span class="i">${k + 1}</span><span class="w">${played}${x.hinted ? ` <span class="hi" title="${t('tiles.rate.hinted')}" aria-label="${t('tiles.rate.hinted')}">${ICON.hint}</span>` : ''}</span><span class="pct">${
          r ? `<small class="rate rate-${r}">${pctOf(credit, reference)}%</small>` : x.kind === 'pass' || x.kind === 'exchange' ? '–' : ''}</span>${withBest ? `<span class="best"><span class="w">${
          ev?.word ? bestWas(ev) : '—'}</span></span>` : ''}<span class="who">${esc(nameOf(S, x.p))}</span></li>`;
      }).join('')}</ol>`;
      box.querySelector('.tl-hsw .toggle')?.addEventListener('click', e => {
        const b = e.currentTarget, on = !b.classList.contains('on');
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
        box.querySelector('.tl-evals').innerHTML = overall(on);
      });
      box.hidden = false;
    }, 60);
  }

  // V1 text tabs (owner, 2026-11-20); the shared floating frame and rules window stay unchanged.
  function openOptions() {
    if (S.over) return;
    const playerItems = [
      ...(S.rules.rating === false ? [] : [['tilesRate', t('tiles.rate.setting'), t('tiles.rate.settingHelp') + (S.rules.rating === 'score' ? ' ' + t('tiles.rate.fixed') : ' ' + t('help.bestNote')), RATE_LOOKS.map(([v, k]) => [v, t('tiles.rate.look.' + k)])]]),
      ['tilesUnder', t('tiles.under'), t('tiles.underHelp'), ['rating', 'rarity', 'both'].map(v => [v, t('tiles.under.' + v)])]];
    const tile = (ch, colour = '') => `<span class="rt" aria-hidden="true"${colour ? ` style="--tl-tile:${colour}"` : ''}>${ch}<i class="p">1</i></span>`;
    const lookItems = [['buttonSize', t('set.buttonSize'), '', ['100', '115', '130', '150', '175'].map(v => [v, t('set.buttonSizePercent', { n: v })])],
      ['theme', t('set.theme'), '', ['dark', 'light', 'system'].map(v => [v, t('theme.' + v)])],
      ['tilesLast', t('tiles.last'), t('tiles.lastHelp')],
      ['tilesFrame', t('tiles.frame'), '', ['graphite', 'frameless', 'orange'].map(v => [v, t('tiles.frame.' + v)])],
      ['tilesTile', t('tiles.tile'), t('tiles.tileHelp'), TILE_LOOKS.map(([k, c]) => [k, tile('A', c) + `<small>${t('tiles.tile.' + k)}</small>`, t('tiles.tile.' + k)])], ['tiles3d', t('tiles.raised'), t('tiles.raisedHelp')],
      ['tilesBonus', t('tiles.bonus'), t('tiles.bonusHelp'), BONUS_LOOKS.map(([v, k]) => [v, t('tiles.bonus.' + k)])],
      ['tilesBoardStyle', t('tiles.boardStyle'), t('tiles.boardStyleHelp'), ['classic', 'muted'].map(v => [v, t('tiles.boardStyle.' + v)])],
      ['tilesCb', t('tiles.cb'), t('tiles.cbHelp')]];
    const tabs = [['history', t('tiles.history')], ['look', t('tiles.visual')], ['players', t('net.players')]];
    const { dlg, close } = openDialog(t('tiles.options'), `<div class="op-tabs" role="tablist" aria-label="${t('tiles.options')}">${tabs.map(([id, label], i) => `<button type="button" role="tab" id="op-tab-${id}" data-tab="${id}" aria-controls="op-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${label}</button>`).join('')}</div>
      <div class="op-content">
        <section id="op-history" role="tabpanel" aria-labelledby="op-tab-history"><h2><span class="category-icon" aria-hidden="true">${UI_ICONS.time}</span>${t('tiles.history')}</h2><div class="seg op-filter">${[[null, t('tiles.hist.all')], ...S.players.map((_, p) => [p, esc(nameOf(S, p))])].map(([p, label]) => `<button type="button" data-filter="${p ?? ''}" aria-pressed="${p === null}" class="${p === null ? 'on' : ''}">${label}</button>`).join('')}</div><div class="op-history-list">${histHtml(null)}</div></section>
        <section id="op-look" role="tabpanel" aria-labelledby="op-tab-look" hidden><div class="op-look-head"><h2><span class="category-icon" aria-hidden="true">${UI_ICONS.display}</span>${t('tiles.visual')}</h2><div class="op-preview">${[...'TILES'].map(ch => tile(ch)).join('')}</div></div>${settingRows(lookItems)}</section>
        <section id="op-players" role="tabpanel" aria-labelledby="op-tab-players" hidden><h2><span class="category-icon" aria-hidden="true">${UI_ICONS.online}</span>${t('net.players')}</h2>${host ? hostSection() : `<ul class="op-players">${S.players.map((_, p) => `<li><div class="op-who pc${p}"><i class="tl-player-icon" aria-hidden="true">${playerIcon(S, p)}</i><span>${esc(nameOf(S, p))}</span></div></li>`).join('')}</ul>`}${settingRows(playerItems)}${host ? `<button class="btn btn-ghost btn-danger op-end" type="button">${t('net.endGame')}</button>` : ''}</section>
      </div><footer class="op-foot"><button class="btn btn-outline op-how" type="button" data-guide>${t('tiles.guide')}</button><button class="btn btn-outline btn-danger op-quit" type="button">${t('game.giveUp')}</button></footer>`);
    dlg.classList.add('tl-options');
    const selectTab = id => {
      dlg.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
      dlg.querySelectorAll('[role=tabpanel]').forEach(p => { p.hidden = p.id !== 'op-' + id; });
      dlg.querySelector('.op-content').scrollTop = 0;
      if (id === 'history') {
        const value = dlg.querySelector('[data-filter][aria-pressed=true]').dataset.filter;
        dlg.querySelector('.op-history-list').innerHTML = histHtml(value === '' ? null : +value);
      }
    };
    const tabKeys = e => {
      const tab = e.target.closest('[data-tab]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const i = tabs.findIndex(([id]) => id === tab.dataset.tab);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
      selectTab(tabs[next][0]);
      dlg.querySelector(`[data-tab="${tabs[next][0]}"]`).focus();
    };
    window.addEventListener('keydown', tabKeys, true);
    dlg.addEventListener('close', () => window.removeEventListener('keydown', tabKeys, true), { once: true });
    dlg.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]'), filter = e.target.closest('[data-filter]');
      if (tab) selectTab(tab.dataset.tab);
      if (filter) {
        dlg.querySelector('.op-history-list').innerHTML = histHtml(filter.dataset.filter === '' ? null : +filter.dataset.filter);
        dlg.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('on', b === filter); b.setAttribute('aria-pressed', b === filter); });
      }
      if (e.target.closest('[data-guide]')) { close(); openRules('tiles', topics(S.rules)); }
    });
    // the rules keep the best move hidden in this game (an online host's choice, fixed at the start): not the player's
    // to switch on (owner, 2026-09-27) - ratings alone or none are
    if (S.rules.rating === 'score') dlg.querySelectorAll('[data-key=tilesRate][data-v=true]').forEach(b => {
      b.disabled = true;
      if (b.classList.contains('on')) { b.classList.remove('on'); dlg.querySelector('[data-key=tilesRate][data-v=score]')?.classList.add('on'); }
    });
    // the host: skip the move of whoever is on turn, make a player give up, end the game - each asked twice
    const skipNow = dlg.querySelector('[data-skipturn]');
    if (skipNow) confirmClick(skipNow, () => { close(); skipTurn(); }, () => fitAll(dlg));
    dlg.querySelectorAll('[data-remove]').forEach(b => confirmClick(b, () => { close(); removeSeat(+b.dataset.remove); }, () => fitAll(dlg)));
    const endAll = dlg.querySelector('.op-end');
    if (endAll) confirmClick(endAll, () => { close(); thinking = false; act({ type: 'end' }, true); }, () => fitAll(dlg));
    wireSettingRows(dlg, key => { if (key === 'tilesTile' || key === 'tilesFrame') applyTileLook(); repaint(); });
    confirmClick(dlg.querySelector('.op-quit'), () => { close(); giveUp(); }, () => fitAll(dlg));
  }

  // ── several phones (owner, 2026-09-27) ──
  // The host listens (Bluetooth: findable when nobody is in yet; Wi-Fi: the game announced on the network) and takes each
  // phone that joins - asking about any it does not know. A joining phone connects to the host; if the line breaks it
  // tries again every few seconds until the host returns.
  const setupOf = () => ({ lang: S.lang, board: S.board, players: S.players, first: S.start.first, seed: S.start.seed, words: S.words, rules: S.rules });
  const hostSeat = () => host ? linkMe : game.link.hostSeat ?? 0;
  const lanName = () => `${gameName(game)} · ${myPhone}`.slice(0, 60);
  // the host's players in Options (owner, 2026-09-27): the move of whoever is on turn skipped, and any player made to give
  // up - each with how their phone is: here, in another app, without a connection, out of the game
  function hostSection() {
    const here = party?.here() ?? [];
    const state = p => t(isOut(p) ? 'net.seat.out' : !here[p] ? 'net.seat.away' : away[p] ? 'net.seat.app' : 'net.seat.in');
    const who = p => `<div class="op-who pc${p}"><i class="tl-player-icon" aria-hidden="true">${playerIcon(S, p)}</i><span>${esc(nameOf(S, p))}</span><small>${state(p)}</small></div>`;
    const turn = !S.over && remote(S.turn) ? `<div class="op-turn"><span class="eyebrow">${t('net.nowPlays')}</span>${who(S.turn)}<button class="btn btn-outline op-act" type="button" data-skipturn>${
      t('net.skipTurn', { name: esc(nameOf(S, S.turn)) })}</button></div>` : '';
    const rows = S.players.map((_, p) => p === linkMe ? '' : `<li>${who(p)}${isOut(p) ? '' : `<button class="btn btn-ghost btn-danger op-act" type="button" data-remove="${p}">${
      t('net.giveUpFor', { name: esc(nameOf(S, p)) })}</button>`}</li>`).join('');
    return `<div class="op-body">${turn}<ul class="op-players">${rows}</ul><p class="help">${t('net.playersHelp')}</p></div>`;
  }
  // the move of whoever is on turn passes (History: skipped by the host); they play on as usual
  function skipTurn() {
    if (S.over || !remote(S.turn)) return;
    thinking = false;
    act({ type: 'pass', away: true }, true);
  }
  // out of the game: the engine's giving up, marked as the host's doing - their phone stays, and they can watch (owner)
  function removeSeat(p) {
    if (S.over || isOut(p)) return;
    thinking = false;
    act({ type: 'resign', p, removed: true }, true);
  }
  // Bluetooth: findable for the phones still to come - asked again once it has run out (owner: "ask him again"); not
  // again after a no, until the button
  async function askVisible(onlyIfHidden) {
    if (visAsking || !party) return;
    visAsking = true;
    const s = await wire.state().catch(() => ({}));
    if (typeof s.visible === 'boolean' && s.visible !== findable) { findable = s.visible; if (app.isConnected) paintOver(); }
    if (!onlyIfHidden || s.visible === false) {
      const r = await wire.beVisible(300).catch(() => ({}));
      if (!r.visible) visibleDeclined = true;
      else findable = true;
      if (app.isConnected) paintAll();
    }
    visAsking = false;
  }
  // host: the wait over the board - while the game has no move yet, or while nobody at all is in
  const waitCard = () => host && !asked && !!gone().length && !S.log.length && !S.over;
  // the players' names, seat by seat (from the host, or a joining phone's own)
  function setNames(names) {
    if (names.every((x, p) => (S.players[p]?.name ?? '') === (x ?? ''))) return;
    S = { ...S, players: S.players.map((x, p) => ({ ...x, name: names[p] ?? x.name })) };
    game.state = S;
    putSave(game);
    paintAll();
  }
  // this phone showing Lexling or another app: the host knows, and through it the others (owner: "is it possible to check
  // if the player is looking at it?")
  function onShown() {
    const open = document.visibilityState === 'visible';
    if (host) { away[linkMe] = !open; party?.announce(); }
    else party?.app(open);
  }
  async function startLink() {
    document.addEventListener('visibilitychange', onShown);
    const on = async (event, fn) => { const h = await wire.on(event, fn); if (app.isConnected) handles.push(h); else h.remove(); };
    if (host) {
      // (a game from 0.52 remembers its one other phone as `peer`)
      const known = game.link.seats ?? (game.link.peer ? [null, { address: game.link.peer.address, device: game.link.peer.name }] : []);
      party = createHost({ players: S.players.length, me: linkMe, known, usable: p => !isOut(p),
        extra: () => ({ away, ...(draftIsCurrent(linkDraft) ? { draft: linkDraft } : {}) }),
        onApp: (p, open) => { away[p] = !open; party.announce(); paintAll(); },
        onDraft: (p, m) => { if (receiveDraft(m, p)) party.draft(m); },
        game: () => ({ id: game.link.id, title: gameName(game), host: linkMe, setup: setupOf(), log: S.log }),
        // a phone's move: its seat's turn (giving up: its own seat, any time), everyone there, the game where the phone
        // thought it was
        take: (seat, n, action) => {
          // Concurrent votes may name an earlier log length; the proposal and seat identify them (owner, 2026-11-14).
          if (action.type === 'vote') { const clean = guestAction(action); if (clean && voteFits(S, seat, clean)) act(clean, true); return true; }
          // ending the game for everyone and taking a player out are the host's alone (security review, 2026-11-14)
          if (action.type === 'voteEnd' || action.type === 'end' || action.removed || (S.vote && action.type === 'timeout')) return false;
          if (S.over || n !== S.log.length || startWaits() || (action.type === 'resign' ? action.p !== seat : S.turn !== seat)) return false;
          const clean = guestAction(action);
          if (!clean) return false;
          thinking = false;
          return act(clean, true);
        },
        send: (conn, text) => { wire.send(conn, text).catch(() => {}); },
        drop: conn => setTimeout(() => wire.close(conn).catch(() => {}), 500),   // what was said to it goes first
        onChange: ({ seat, name, left }) => {
          // gone: since when (the host shows it); back: in the app again
          goneSince[seat] = left ? Date.now() : 0;
          away[seat] = false;
          if (left && seat === S.turn) linkDraft = null;
          game.link.seats = party.known();
          if (!left) {
            setNames(S.players.map((x, p) => p === seat ? seatName(x.name, name) : x.name));
            party.names(S.players.map(x => x.name));
          }
          putSave(game);
          paintAll();
          if (!S.over && !startWaits()) next();
        },
        onAsk: phone => { asked = phone; askSeat = phone?.seat ?? -1; paintAll(); },
      });
      await on('connected', c => { if (c.role === 'host') party?.connected(c.id, c); });
      await on('message', ({ id, text }) => party?.message(id, text));
      await on('disconnected', ({ id }) => party?.disconnected(id));
      beat = setInterval(() => {
        if (!app.isConnected) return clearInterval(beat);
        checkConnection();
        party?.tick();
        if (kind === 'bt' && party?.missing().length && !visibleDeclined) askVisible(true);
      }, 5000);
      hosting();
    } else {
      party = createGuest({ name: settings.myName ?? '', send: text => { if (game.link.conn) wire.send(game.link.conn, text).catch(() => {}); }, on: {
        welcome: welcomed,
        act: m => {
          // counted as the host's first: else act() would send the host its own move back
          if (m.n === S.log.length) { thinking = false; party?.synced(m.n + 1); act(m.a, true); }
          else if (!(m.n < S.log.length && JSON.stringify(S.log[m.n]) === JSON.stringify(m.a))) party.resync();   // lost track
        },
        names: m => setNames(m.names),
        here: m => {
          hereList = m.here; away = m.away ?? [];
          if (!hereList[S.turn]) linkDraft = null;
          party?.relax(!!away[hostSeat()]); paintAll(); if (netOk() && !S.over) next();
        },
        draft: receiveDraft,
        reject: () => { msg = { html: t('net.rejected'), err: true }; party.resync(); },
        end: () => { if (S.over) return; ended = 'left'; closeGuest(); },
        refused: () => { ended = 'refused'; closeGuest(); },
        full: () => { ended = 'full'; closeGuest(); },
        version: () => { ended = 'version'; closeGuest(); },
      } });
      await on('connected', c => { if (c.role === 'guest') { game.link.conn = c.id; up(); } });
      await on('message', ({ id, text }) => { if (id === game.link.conn) party?.message(text); });
      await on('disconnected', ({ id }) => { if (id === game.link.conn) down(); });
      beat = setInterval(() => {
        if (!app.isConnected) return clearInterval(beat);
        checkConnection();
        if (party?.tick()) { wire.close(game.link.conn).catch(() => {}); down(); }   // the host went quiet
      }, 5000);
      if (game.link.conn && (await wire.state().catch(() => ({}))).connected) up();
      else connect();
    }
  }
  // host: listening for the phones
  async function hosting() {
    const ready = await netReady(kind).catch(() => 'retry');
    if (!app.isConnected || !party) return;
    if (ready !== 'ok') { linkNote = readinessText(kind, ready); return paintAll(); }
    const s = await wire.state().catch(() => ({}));
    myPhone = s.name || '';
    myWifi = s.on !== false;
    if (kind === 'bt' && party.missing().length) await askVisible(true);
    const h = await wire.host(kind === 'bt' ? 'Lexling' : lanName(), game.link.room).catch(() => { linkNote = 'net.cannotHost'; });
    // the internet: the game's code - the same one next time, so the others' phones find it again
    if (h?.code) { roomCode = h.code; if (game.link.room !== h.code) { game.link.room = h.code; putSave(game); } }
    paintAll();
  }
  // a joining phone: the whole game from the host - the moves it did not have yet played in, or (another seat, another
  // course of the game) everything rebuilt
  function beginRound(state, title, roundId) {
    const link = { ...game.link, id: roundId }, live = game.live;
    const fields = { mode: 'tiles', lang, state, link, name: game.name, firstSet: true };
    game = live ? { ...fields, id: roundId, live: true, title, status: 'playing', timeMs: 0, created: Date.now() } : makeSave(fields);
    counts(game);
    S = state;
    game.statsDone = game.achDone = 0;
    game.link.id = roundId ?? game.id;
    history.replaceState(null, '', '#/game/' + game.id);
    finished = endStep = ratedInStats = thinking = toast = handOver = false;
    turnCuePending = true;
    voteAt = lastVote = sentVote = voteResult = null;
    msg = null; panel = null; landing = null; hintPaid = 0; redoStack = [];
    remoteMs = 0; linkDraft = sentDraft = null;
    shown = solo;
    resetTurn();
    main.replaceChildren(play);
    app.classList.add('fit');
    stop();
    stop = playClock(root, game, () => app.isConnected);
    putSave(game);
  }
  function rematch() {
    if (!host || !party || !S.over) return;
    const setup = { ...setupOf(), seed: (S.start.seed + 1 + Math.floor(Math.random() * 0x7ffffffe)) >>> 0 };
    beginRound(startOf(setup));
    party.restart();
    next();
  }
  function welcomed(m) {
    hereList = m.here;
    away = m.away ?? [];
    party.relax(!!away[m.host]);
    game.link.hostSeat = m.host;
    if (m.title) game.title = m.title;
    if (m.id !== game.link.id || m.setup.seed !== S.start.seed) beginRound(startOf(m.setup), m.title, m.id);
    const before = S, had = S.log, now = m.log;
    const prefix = had.length <= now.length && had.every((x, i) => JSON.stringify(x) === JSON.stringify(now[i]));
    if (m.seat !== linkMe || !prefix) {
      linkMe = solo = shown = game.link.me = m.seat;
      S = now.reduce((st, x) => apply(st, x, isWord), startOf(m.setup));
      game.state = S;
      game.statsDone = S.moves.length;
      game.achDone = S.moves.length;   // a rebuilt history counts only from now (owner, 2026-11-14)
      game.evals = [];
      redoStack = [];
      remoteMs = 0;
      resetTurn();
    } else {
      for (let i = had.length; i < now.length && !S.over; i++) { thinking = false; act(now[i], true, undefined, true); }
      setNames(m.setup.players.map(x => x.name));
    }
    party.synced(S.log.length);
    linkDraft = m.draft?.placing === true && draftIsCurrent(m.draft) ? m.draft : null;
    sentDraft = null;   // tell the host again if the mover rejoined with tiles on the board
    sentVote = null;   // a reconnect may retry an unconfirmed vote
    putSave(game);
    paintAll();
    if (S.over) finish(null, true);
    else {
      if (S.turn === linkMe && (S.turn !== before.turn || S.moves.length > before.moves.length)) turnCuePending = true;
      next();
    }
  }
  function up() {
    if (S.vote && frozenLive !== null) seenAt = Date.now() - frozenLive;
    frozenLive = null;
    linkUp = true;
    if (ended === 'lost') ended = '';
    linkNote = '';
    party?.connected();
    if (document.visibilityState !== 'visible') party?.app(false);
    paintAll();
  }
  function down() {
    if (!linkUp) return;
    frozenLive = liveMs();
    linkUp = false;
    checkConnection();
    party?.disconnected();
    game.link.conn = null;
    if (S.over || ended) return paintAll();
    paintAll();
    retryLater();
  }
  function closeGuest() {
    clearTimeout(retry);
    if (linkUp) frozenLive = liveMs();
    linkUp = false;
    party?.disconnected();
    if (game.link.conn) wire.close(game.link.conn).catch(() => {});
    game.link.conn = null;
    paintAll();
  }
  // Read the local radio/network separately from the connection to another phone.
  async function checkConnection() {
    const state = await Promise.resolve().then(() => wire.state()).catch(() => ({}));
    if (!app.isConnected) return false;
    const on = state.on !== false && !(kind === 'web' && navigator.onLine === false);
    const note = on ? '' : 'net.disconnected.' + kind;
    if (note || linkNote.startsWith('net.disconnected.')) {
      linkNote = note;
      paintAll();
    }
    return on;
  }
  // A dropped host stays a waiting line, with automatic retries for as long as needed.
  async function connect() {
    clearTimeout(retry);
    if (!app.isConnected || linkUp || S.over || (ended && ended !== 'lost') || !party) return;
    const on = await checkConnection();
    if (!app.isConnected || linkUp || S.over || (ended && ended !== 'lost')) return;
    if (!on) return retryLater();
    wire.join(game.link.hostAddress).catch(retryLater);   // "connected" does the rest
  }
  const retryLater = () => { clearTimeout(retry); retry = setTimeout(connect, 4000); };
  function stopLink() {
    clearTimeout(retry);
    clearInterval(beat);
    document.removeEventListener('visibilitychange', onShown);
    if (party && host) party.end(S.over ? 'over' : 'left');
    else if (party && linkUp) party.leave();
    handles.splice(0).forEach(h => h.remove());
    if (party) setTimeout(() => wire.close().catch(() => {}), 300);   // what was just said goes first
    party = null;
    linkUp = false;
  }

  // ── start ──
  function endToast() { if (!toast) return; toast = false; if (app.isConnected) next(); }
  wide = app.clientWidth >= 900;
  // the squares' size in pixels: the tiles' points are drawn at 10px and scaled to a quarter of a square - Android draws
  // no text under 8px, so on a narrow phone they grew over the letters (owner, 2026-09-27: "numbers should never overlap")
  const cells = new ResizeObserver(entries => entries.forEach(e => { const el = e.target; el.style.setProperty('--cpx', ((el.offsetWidth - (n - 1)) / n).toFixed(2)); }));
  // Reopen the analysis directly, without finishing or starting a session (owner, 2026-11-26).
  if (archived) { paintEnd(); return () => cells.disconnect(); }
  cells.observe(tb);
  const resize = new ResizeObserver(() => {
    if (!app.isConnected) return resize.disconnect();
    if ((app.clientWidth >= 900) !== wide && !S.over) { wide = !wide; paintMore(); }
  });
  resize.observe(app);
  // the time a person takes: counted only while it is their turn on screen (the clock, per move or per game)
  const tick = setInterval(() => {
    if (!app.isConnected) return clearInterval(tick);
    if (S.over || (linked && !host && !linkUp)) return;
    if (S.vote) {
      seeVote();
      // Only the host (or the shared device) closes the vote or times its mover out (owner, 2026-11-14).
      const elapsed = voteMs(), T = S.rules.time;
      if (!linked || host) {
        if (!cpu(S.turn) && T?.per === 'move' && turnMs() >= T.seconds * 1000) { quiet(); act({ type: 'timeout', ms: elapsed }, true); return; }
        if (elapsed >= VOTE_MS) { act({ type: 'voteEnd', ms: elapsed }, true); return; }
      }
      paintVote();
    } else if (remote(S.turn)) {
      if (!cpu(S.turn) && netOk() && !away[S.turn] && !gone().includes(S.turn)) remoteMs += 1000;
      paintLinkLine();
      paintClock();
      return;   // only the mover can run out of time on their phone
    } else {
      if (!myTurn() || document.visibilityState !== 'visible') return;
      game.turnMs = (game.turnMs || 0) + 1000;
    }
    paintClock();
    const T = S.rules.time;
    if (!T) return;
    if (!cpu(S.turn) && !S.vote && T.per === 'move' && turnMs() >= T.seconds * 1000) { quiet(); act({ type: 'timeout' }); }
  }, 1000);

  // just joined (the Join screen): "you are playing as …" for a moment (owner, 2026-09-27)
  joinedAs = !!game.link?.fresh;
  if (joinedAs) { delete game.link.fresh; setTimeout(() => { joinedAs = false; if (app.isConnected) paintOver(); }, 2600); }
  if (linked && !S.over) startLink();
  if (S.over) finish(null, true);                         // never saved like this; a safeguard
  else if (!S.log.length && !game.toasted && !linked) {
    // who starts (drawn at random, or chosen on New game): a card over the board for 1.2 s or until the first tap
    game.toasted = true;
    putSave(game);
    toast = true;
    shown = solo;
    paintAll();
    setTimeout(endToast, TOAST_MS);
  } else next();

  lexReady.then(m => {
    if (!m || (!app.isConnected && !S.over)) return;
    lex = m;
    countAchievements();
    if (say.isConnected) { paintSay(); paintMore(); refit(); }
  });

  document.addEventListener('keydown', onKey, true);   // before main.js's Esc-goes-back
  let stop = playClock(root, game, () => app.isConnected);
  return () => {
    if (linked) { stopLink(); if (!host) deleteSave(game.id); if (kind === 'bt' || kind === 'near') remindBt(); }
    document.removeEventListener('keydown', onKey, true);
    clearInterval(tick);
    cells.disconnect();
    resize.disconnect();
    stop();
  };
}
