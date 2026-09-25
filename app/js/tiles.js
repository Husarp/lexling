// Kafelki / Tiles - the rules, with no screen attached (PLAN.md M13). A game of letter tiles on a board for
// 2-5 players, people or the computer, in the manner of the classic crossword board game: the boards, the letter
// sets, the bag and racks, checking and scoring a move, exchanging, passing and the end of the game. Finding
// moves (the computer, hints) is tiles-moves.js; the word list lives in a word graph (dawg.js). "Scrabble" is a
// trademark - the game never uses the name.
import { fromBytes } from './dawg.js';

export const RACK = 7, BINGO = 50, BLANK = '?';

// ── Boards ───────────────────────────────────────────────────────────────────────────────────────
// One string per row: '.' plain, 'd' double letter, 't' triple letter, 'D' double word, 'T' triple word.
// The first move covers the centre. Every board is symmetrical left-right, top-bottom and across both
// diagonals. `bag`: 1 = the full set of tiles, 0.5 = each letter half as many (rounded up).
export const BOARDS = {
  // The original game's board (owner, 2026-09-25: "the normal board from the official game"): 15 × 15,
  // triple words on the edges, double words on the diagonals and in the centre - 8 T, 17 D, 12 t, 24 d.
  classic: { bag: 1, rows: [
    'T..d...T...d..T',
    '.D...t...t...D.',
    '..D...d.d...D..',
    'd..D...d...D..d',
    '....D.....D....',
    '.t...t...t...t.',
    '..d...d.d...d..',
    'T..d...D...d..T',
    '..d...d.d...d..',
    '.t...t...t...t.',
    '....D.....D....',
    'd..D...d...D..d',
    '..D...d.d...D..',
    '.D...t...t...D.',
    'T..d...T...d..T',
  ] },
  // A short game, and bigger squares on a phone: 11 × 11 with half the tiles - the idea of the 11 × 11 "Fast
  // Play" board of Words With Friends, our own layout. Tiles cover about as much of it as of the classic
  // board (45-50 %); bonuses sit a little denser (31 % of squares, the classic 27 %) - 4 T, 9 D, 8 t, 16 d.
  quick: { bag: 0.5, rows: [
    'T..d...d..T',
    '.D...t...D.',
    '..D.d.d.D..',
    'd..t...t..d',
    '..d.....d..',
    '.t...D...t.',
    '..d.....d..',
    'd..t...t..d',
    '..D.d.d.D..',
    '.D...t...D.',
    'T..d...d..T',
  ] },
  // Bigger scores: bonuses pulled in from the edges, more triple letters, a triple word beside a triple
  // letter - the idea of the Words With Friends board, our own layout. No bonus in the centre.
  // 8 T, 12 D, 16 t, 28 d.
  bonus: { bag: 1, rows: [
    't...d..D..d...t',
    '...T.......T...',
    '..D...d.d...D..',
    '.T...t...t...T.',
    'd...D.d.d.D...d',
    '...t...d...t...',
    '..d.d.t.t.d.d..',
    'D....d...d....D',
    '..d.d.t.t.d.d..',
    '...t...d...t...',
    'd...D.d.d.D...d',
    '.T...t...t...T.',
    '..D...d.d...D..',
    '...T.......T...',
    't...d..D..d...t',
  ] },
};
export const sizeOf = board => BOARDS[board].rows.length;
export const centre = board => { const n = sizeOf(board); return (n * n - 1) / 2; };
// a square's bonus, by its index r * size + c
const flat = {};
export const premiums = board => flat[board] ??= BOARDS[board].rows.join('');
export const LETTER_X = { d: 2, t: 3 }, WORD_X = { D: 2, T: 3 };

// ── The letter sets: the official ones, 100 tiles each (pl.wikipedia.org, "Rozkłady liter w Scrabble") ──
// points: 'letter + how many' - and two blanks, worth 0, that stand for any letter.
const SETS = {
  pl: { 1: 'a9 e7 i8 n5 o6 r4 s4 w4 z5', 2: 'c3 d3 k3 l3 m3 p3 t3 y4', 3: 'b2 g2 h2 j2 ł2 u2',
    5: 'ą1 ę1 f1 ó1 ś1 ż1', 6: 'ć1', 7: 'ń1', 9: 'ź1' },
  en: { 1: 'a9 e12 i9 l4 n6 o8 r6 s4 t6 u4', 2: 'd4 g3', 3: 'b2 c2 m2 p2', 4: 'f2 h2 v2 w2 y2', 5: 'k1',
    8: 'j1 x1', 10: 'q1 z1' },
};
const BLANKS = 2;
const sets = {};
// { values: { letter: points }, counts: { letter: how many }, letters: 'every letter' } for a language
export function letterSet(lang) {
  return sets[lang] ??= (() => {
    const values = {}, counts = {};
    for (const [pts, list] of Object.entries(SETS[lang])) {
      for (const item of list.split(' ')) { const ch = item[0]; values[ch] = +pts; counts[ch] = +item.slice(1); }
    }
    return { values, counts, letters: Object.keys(values).join('') };
  })();
}
export const valueOf = (lang, tile) => tile === BLANK ? 0 : letterSet(lang).values[tile];

// Every tile a game starts with, unshuffled.
export function fullBag(lang, board) {
  const { counts } = letterSet(lang), share = BOARDS[board].bag, bag = [];
  for (const [ch, k] of Object.entries(counts)) for (let i = 0; i < Math.ceil(k * share); i++) bag.push(ch);
  for (let i = 0; i < Math.ceil(BLANKS * share); i++) bag.push(BLANK);
  return bag;
}

// The words the game accepts, as a word graph built ahead of time (tools/build-tiles-words.mjs): sjp.pl's list
// for word games in Polish (3.2 million words and forms, CC BY 4.0) and ENABLE in English (168 000, public
// domain), 2 to 15 letters, minus slurs and vulgar words. The same promise to every caller.
const graphs = {};
export const loadTileWords = lang => graphs[lang] ??= fetch(`data/${lang}/tiles.bin`).then(r => r.arrayBuffer()).then(fromBytes)
  .catch(e => { delete graphs[lang]; throw e; });

// ── A game ───────────────────────────────────────────────────────────────────────────────────────
// Plain data, so a save is the state itself: `players[p]` = { name, cpu } (`cpu` = the computer's level, or
// null for a person - 2 to 5 of them, any mix: owner, 2026-09-25), `cells` holds null or { ch, blank } per
// square (r * size + c), `bag` is drawn from the end, `racks[p]` / `scores[p]` / `hints[p]` per player,
// `zeros` counts turns in a row that scored nothing, `moves` is the history, `over` null or how it ended,
// `words` the tag of the word list that checked the moves (dawg.js), `seed` the game's own random numbers.
// A placement is a list of { r, c, ch, blank }: `blank` true = a blank tile showing `ch`.
export const PLAYERS_MIN = 2, PLAYERS_MAX = 5;

// The owner's plan: an engine with a seed, so the same seed and the same moves always make the same game -
// for replays, and one day for games between devices, which must draw the same tiles. One step of it:
// [a number 0-1, the next seed] (mulberry32).
const roll = seed => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, seed];
};
const shuffle = (list, seed) => {
  const a = [...list];
  for (let i = a.length - 1, x; i > 0; i--) { [x, seed] = roll(seed); const j = Math.floor(x * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return { list: a, seed };
};
const draw = (bag, rack) => { const b = [...bag], r = [...rack]; while (r.length < RACK && b.length) r.push(b.pop()); return { bag: b, rack: r }; };

// `first`: who starts - drawn from the seed when not given (the real game draws tiles for it).
export function newGame({ lang, board = 'classic', players, first, seed = Math.floor(Math.random() * 2 ** 32), words = 0 }) {
  if (players.length < PLAYERS_MIN || players.length > PLAYERS_MAX) throw new Error(`${players.length} players: 2 to 5 play`);
  let { list: bag, seed: s } = shuffle(fullBag(lang, board), seed);
  const racks = [];
  for (let p = 0; p < players.length; p++) { const d = draw(bag, []); bag = d.bag; racks.push(d.rack); }
  if (first === undefined) { let x; [x, s] = roll(s); first = Math.floor(x * players.length); }
  const n = sizeOf(board), none = () => players.map(() => 0);
  return { lang, board, words, players: players.map(x => ({ name: x.name ?? '', cpu: x.cpu ?? null })),
    cells: Array(n * n).fill(null), bag, racks, scores: none(), hints: none(), turn: first, zeros: 0, moves: [], over: null, seed: s };
}

const firstMove = state => state.cells.every(x => !x);

// What is wrong with where the tiles went, before any word is looked at - or null. In the order a player
// would need to hear it: 'none' (nothing placed), 'rack' (tiles not on the rack), 'outside', 'taken' (a
// square already has a tile, or two tiles on one square), 'line' (not in one row or one column), 'gap' (an
// empty square between them), 'centre' (the first move must cover it), 'alone' (touches no tile on the
// board), 'single' (the first word needs two letters).
export function placementError(state, placed) {
  if (!placed.length) return 'none';
  const n = sizeOf(state.board), rack = [...state.racks[state.turn]];
  for (const t of placed) {
    const k = rack.indexOf(t.blank ? BLANK : t.ch);
    if (k < 0) return 'rack';
    rack.splice(k, 1);
  }
  const at = new Set();
  for (const { r, c } of placed) {
    if (r < 0 || c < 0 || r >= n || c >= n) return 'outside';
    if (state.cells[r * n + c] || at.has(r * n + c)) return 'taken';
    at.add(r * n + c);
  }
  const rows = new Set(placed.map(t => t.r)), cols = new Set(placed.map(t => t.c));
  if (rows.size > 1 && cols.size > 1) return 'line';
  const across = rows.size === 1;
  const line = placed.map(t => across ? t.c : t.r), lo = Math.min(...line), hi = Math.max(...line);
  for (let i = lo; i <= hi; i++) {
    const k = across ? placed[0].r * n + i : i * n + placed[0].c;
    if (!state.cells[k] && !at.has(k)) return 'gap';
  }
  if (firstMove(state)) {
    if (!at.has(centre(state.board))) return 'centre';
    if (placed.length < 2) return 'single';
    return null;
  }
  const filled = (r, c) => r >= 0 && c >= 0 && r < n && c < n && !!state.cells[r * n + c];
  if (!placed.some(({ r, c }) => filled(r - 1, c) || filled(r + 1, c) || filled(r, c - 1) || filled(r, c + 1))) return 'alone';
  return null;
}

// Every word a (sound) placement makes, with its score: the word along the line of the tiles, and one across
// it at each new tile that touches others. Bonus squares count only under new tiles; a blank is worth 0.
// Returns { words: [{ w, r, c, across, score }], score } - plus BINGO when a full rack goes down.
export function wordsMade(state, placed) {
  const n = sizeOf(state.board), prem = premiums(state.board);
  const fresh = new Map(placed.map(t => [t.r * n + t.c, t]));
  const tileAt = (r, c) => r < 0 || c < 0 || r >= n || c >= n ? null : fresh.get(r * n + c) ?? state.cells[r * n + c];
  const wordThrough = (r, c, across) => {
    const [dr, dc] = across ? [0, 1] : [1, 0];
    while (tileAt(r - dr, c - dc)) { r -= dr; c -= dc; }
    const start = { r, c };
    let w = '', sum = 0, mul = 1, len = 0;
    for (let t; (t = tileAt(r, c)); r += dr, c += dc, len++) {
      w += t.ch;
      const v = valueOf(state.lang, t.blank ? BLANK : t.ch), k = r * n + c;
      if (fresh.has(k)) { sum += v * (LETTER_X[prem[k]] || 1); mul *= WORD_X[prem[k]] || 1; }
      else sum += v;
    }
    return len > 1 ? { w, ...start, across, score: sum * mul } : null;
  };
  const across = placed.length > 1 ? placed[0].r === placed[1].r
    : !!(tileAt(placed[0].r, placed[0].c - 1) || tileAt(placed[0].r, placed[0].c + 1)) || !(tileAt(placed[0].r - 1, placed[0].c) || tileAt(placed[0].r + 1, placed[0].c));
  const words = [wordThrough(placed[0].r, placed[0].c, across), ...placed.map(t => wordThrough(t.r, t.c, !across))].filter(Boolean);
  const score = words.reduce((s, x) => s + x.score, 0) + (placed.length === RACK ? BINGO : 0);
  return { words, score };
}

// The whole check of a move, as the screen shows it before the player commits: { error } for a placement
// that breaks the rules, { error: 'word', bad: [...] } for words the game does not know, otherwise
// { words, score }. `isWord` = the word list's membership test.
export function checkMove(state, placed, isWord) {
  const error = placementError(state, placed);
  if (error) return { error };
  const made = wordsMade(state, placed);
  const bad = made.words.map(x => x.w).filter(w => !isWord(w));
  return bad.length ? { error: 'word', bad: [...new Set(bad)] } : made;
}

// ── Turns ────────────────────────────────────────────────────────────────────────────────────────
// Each returns a new state and leaves the old one as it was.
const next = (state, p) => (p + 1) % state.racks.length;
const rackPoints = (lang, rack) => rack.reduce((s, t) => s + valueOf(lang, t), 0);

// The end: whoever emptied their rack gets everyone else's leftover points, and everyone loses their own.
// `out` = that player, or -1 (ended by passes: everyone just loses their leftovers). `resigned` = a player
// who gave up: the game is over and the others win, whatever the scores.
function finish(state, reason, out = -1, resigned = -1) {
  const left = state.racks.map(r => rackPoints(state.lang, r));
  const adjust = reason === 'resign' ? left.map(() => 0)
    : left.map((v, p) => p === out ? left.reduce((s, x) => s + x, 0) - v : -v);
  const scores = state.scores.map((s, p) => s + adjust[p]);
  const best = Math.max(...scores.filter((_, p) => p !== resigned));
  const top = scores.map((s, p) => p !== resigned && s === best ? p : -1).filter(p => p >= 0);
  return { ...state, scores, over: { reason, adjust, winner: top.length === 1 ? top[0] : -1, by: reason === 'resign' ? resigned : out } };
}

// A move the player (or the computer) makes - checked with checkMove first; this refuses an unsound one.
export function play(state, placed, isWord) {
  const made = checkMove(state, placed, isWord);
  if (made.error) throw new Error('not a legal move: ' + made.error);
  const n = sizeOf(state.board), p = state.turn;
  const cells = [...state.cells];
  const rack = [...state.racks[p]];
  for (const t of placed) {
    cells[t.r * n + t.c] = t.blank ? { ch: t.ch, blank: true } : { ch: t.ch };
    rack.splice(rack.indexOf(t.blank ? BLANK : t.ch), 1);
  }
  const d = draw(state.bag, rack);
  const racks = state.racks.map((r, i) => i === p ? d.rack : r);
  const scores = state.scores.map((s, i) => i === p ? s + made.score : s);
  const moves = [...state.moves, { p, kind: 'play', placed, words: made.words.map(x => ({ w: x.w, score: x.score })),
    score: made.score, bingo: placed.length === RACK }];
  const after = { ...state, cells, bag: d.bag, racks, scores, moves, zeros: 0, turn: next(state, p) };
  return d.rack.length ? after : finish(after, 'out', p);
}

// Swap some tiles for new ones - only while the bag still holds a full rack (the official rule). Scores
// nothing. Returns null when it is not allowed.
export const canExchange = state => state.bag.length >= RACK;
export function exchange(state, tiles) {
  if (!canExchange(state) || !tiles.length) return null;
  const p = state.turn, rack = [...state.racks[p]];
  for (const t of tiles) { const k = rack.indexOf(t); if (k < 0) return null; rack.splice(k, 1); }
  const d = draw(state.bag, rack);
  const { list: bag, seed } = shuffle([...d.bag, ...tiles], state.seed);
  return scoreless({ ...state, bag, seed, racks: state.racks.map((r, i) => i === p ? d.rack : r),
    moves: [...state.moves, { p, kind: 'swap', n: tiles.length }] });
}

export const pass = state => scoreless({ ...state, moves: [...state.moves, { p: state.turn, kind: 'pass' }] });

// Every player passing (or exchanging) twice in a row ends the game - the Polish rule, "gdy wszyscy gracze
// spasują dwa razy z rzędu"; exchanges count too, so a game where nobody can move cannot run for ever.
function scoreless(state) {
  const zeros = state.zeros + 1, after = { ...state, zeros, turn: next(state, state.turn) };
  return zeros >= 2 * state.racks.length ? finish(after, 'passes') : after;
}

// Giving up ends the game for everyone; the others are ranked by their scores as they stand.
export const resign = (state, p = state.turn) => finish(state, 'resign', -1, p);

// The engine as one function (the owner's plan: "apply(state, action) -> state"). Everything that happens in a
// game is one of these, so a game can be replayed from its first state and its actions:
// { type: 'place', placed } | { type: 'exchange', tiles } | { type: 'pass' } | { type: 'resign', p }.
// An action that is not allowed throws, and the state stays as it was.
export function apply(state, action, isWord) {
  if (state.over) throw new Error('the game is over');
  if (action.type === 'place') return play(state, action.placed, isWord);
  if (action.type === 'exchange') {
    const after = exchange(state, action.tiles);
    if (!after) throw new Error('not an allowed exchange');
    return after;
  }
  if (action.type === 'pass') return pass(state);
  if (action.type === 'resign') return resign(state, action.p ?? state.turn);
  throw new Error('no such action: ' + action.type);
}

// A hint was shown to the player whose turn it is (the move itself: hint() in tiles-moves.js). Counted, as in
// the other games.
export const hinted = state => ({ ...state, hints: state.hints.map((h, p) => p === state.turn ? h + 1 : h) });

// The tiles player `p` has not seen (owner, 2026-09-25: yes): what is in the bag and on everyone else's
// racks, worked out as p sees it - the full set, minus the board, minus p's own rack. { letter: count } in
// the language's alphabetical order, blanks ('?') last; letters all gone are left out.
export function unseen(state, p = state.turn) {
  const left = {};
  for (const t of fullBag(state.lang, state.board)) left[t] = (left[t] || 0) + 1;
  for (const x of state.cells) if (x) left[x.blank ? BLANK : x.ch]--;
  for (const t of state.racks[p]) left[t]--;
  const order = [...letterSet(state.lang).letters].sort((a, b) => a.localeCompare(b, state.lang)).concat(BLANK);
  return Object.fromEntries(order.filter(ch => left[ch] > 0).map(ch => [ch, left[ch]]));
}
