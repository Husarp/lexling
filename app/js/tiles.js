// Kafelki / Tiles - the rules, with no screen attached (PLAN.md M13). A game of letter tiles on a board for
// 2-5 players, people or the computer, in the manner of the classic crossword board game: the boards, the letter
// sets, the bag and racks, checking and scoring a move, exchanging, passing, challenges, the clock and the end
// of the game. Finding moves (the computer, hints, the look-back) is tiles-moves.js; the word list lives in a
// word graph (dawg.js). "Scrabble" is a trademark - the game never uses the name.
import { fromBytes, has } from './dawg.js';

export const RACK = 7, BINGO = 50, BLANK = '?';

// ── Boards ───────────────────────────────────────────────────────────────────────────────────────
// One string per row: '.' plain, 'd' double letter, 't' triple letter, 'D' double word, 'T' triple word.
// The first move covers the centre. Every board is symmetrical left-right, top-bottom and across both
// diagonals. The 15 × 15 ones use all 100 tiles; Quick, 11 × 11, about half, chosen to be easy to use (below).
// (Quick was dropped in 0.32.0 - the owner had not understood what it was - and came back in 0.37.0: "a shorter
// version of the game, when you don't want to spend that much time".)
export const BOARDS = {
  // The original game's board (owner, 2026-09-25: "the normal board from the official game"): 15 × 15,
  // triple words on the edges, double words on the diagonals and in the centre - 8 T, 17 D, 12 t, 24 d.
  classic: [
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
  ],
  // Bigger scores: bonuses pulled in from the edges, more triple letters, a triple word beside a triple
  // letter - the idea of the Words With Friends board, our own layout. No bonus in the centre.
  // 8 T, 12 D, 16 t, 28 d.
  bonus: [
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
  ],
  // Romb (owner, 2026-09-25: yes to the proposal): the bonuses on diamond rings round the centre, the triple words
  // at the middle of each edge. 4 T, 21 D, 12 t, 28 d.
  romb: [
    't..d...T...d..t',
    '.D....d.d....D.',
    '.....D...D.....',
    'd...d..t..d...d',
    '...d..D.D..d...',
    '..D..t.d.t..D..',
    '.d..D.....D..d.',
    'T..t.d.D.d.t..T',
    '.d..D.....D..d.',
    '..D..t.d.t..D..',
    '...d..D.D..d...',
    'd...d..t..d...d',
    '.....D...D.....',
    '.D....d.d....D.',
    't..d...T...d..t',
  ],
  // Quick: 11 × 11 (the idea of the Fast Play board, our own layout - as in 0.30.0), played with the Quick tiles.
  // 4 T, 9 D, 8 t, 16 d.
  quick: [
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
  ],
};
export const sizeOf = board => BOARDS[board].length;
export const centre = board => { const n = sizeOf(board); return (n * n - 1) / 2; };
// a square's bonus, by its index r * size + c
const flat = {};
export const premiums = board => flat[board] ??= BOARDS[board].join('');
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

// The Quick board's tiles (owner, 2026-09-25: "fewer letters, picked carefully - the ones that are actually useful"):
// about half of each common letter, the same share of vowels as the full set (~40 %), and one blank; left out, the
// letters that are hard to place - Polish ć ń ź ó f, English q z v. Polish 52 + 1, English 49 + 1.
const QUICK = {
  pl: 'a5 e4 i4 o3 n3 z2 r2 s2 w2 c2 d2 k2 l1 m2 p2 t2 y2 b1 g1 h1 j1 ł1 u1 ą1 ę1 ś1 ż1',
  en: 'a5 e6 i4 o4 u2 n3 r3 s3 t3 l2 d2 g1 b1 c1 m1 p1 f1 h1 w1 y1 k1 j1 x1',
};
// Every tile a game on `board` starts with, unshuffled.
export function fullBag(lang, board = 'classic') {
  const quick = board === 'quick', bag = [];
  const counts = quick ? Object.fromEntries(QUICK[lang].split(' ').map(x => [x[0], +x.slice(1)])) : letterSet(lang).counts;
  for (const [ch, k] of Object.entries(counts)) for (let i = 0; i < k; i++) bag.push(ch);
  for (let i = 0; i < (quick ? 1 : BLANKS); i++) bag.push(BLANK);
  return bag;
}

// The words the game accepts, as a word graph built ahead of time (tools/build-tiles-words.mjs): sjp.pl's list
// for word games in Polish (3.2 million words and forms, CC BY 4.0) and ENABLE in English (168 000, public
// domain), 2 to 15 letters, minus slurs and vulgar words. The same promise to every caller.
const graphs = {};
export const loadTileWords = lang => graphs[lang] ??= fetch(`data/${lang}/tiles.bin`).then(r => r.arrayBuffer()).then(fromBytes)
  .catch(e => { delete graphs[lang]; throw e; });

// "Check a word" (owner, 2026-09-25: any time, just to see whether a word is allowed): { word, ok, why } -
// `why` = 'short' (under 2 letters), 'long' (over 15: no board holds it), 'letters' (a letter with no tile,
// such as q, v, x in Polish) or 'unknown'. Capitals and spaces around the word do not matter.
export function checkWord(dict, lang, text) {
  const word = text.trim().toLowerCase(), chars = [...word], { values } = letterSet(lang);
  const why = chars.length < 2 ? 'short' : chars.length > 15 ? 'long' : !chars.every(ch => values[ch]) ? 'letters'
    : !has(dict, word) ? 'unknown' : null;
  return { word, ok: !why, why };
}

// ── Rule options (the owner's plan; each game keeps its own in `rules`) ─────────────────────────────
// premiums: bonus squares count under new tiles only (the standard) or 'always', every time a word runs over them.
// check: words checked as they go down (the standard, as in the apps) or 'challenge' - they go down unchecked and
//   the next player may challenge: a word that is not allowed goes back and scores nothing; challenging a good one
//   costs the challenger their turn. A move that uses the last tiles is always checked at once (nobody is left
//   to challenge it).
// exchange: only while 7+ tiles are in the bag (the standard), or 'always' while there are enough to draw.
// bingo: the bonus for all seven tiles, 50 (the standard) or 0.
// time: null (the standard) or { per: 'move' | 'game', seconds } - per move, running out is a pass (the
//   'timeout' action); per game, every started minute over costs 10 points at the end (the tournament rule).
// hints: the Hint tool there (the standard) or not (owner, 2026-09-25: "allow turning hints off") - the screen's rule.
// undo: moves can be taken back - one person against the computer only (owner, 2026-09-25) - see undo() below.
// open: every person sees the other people's tiles all the time (owner, 2026-09-25: "so a friend can think while
//   you move") - the computer's never; the screen's rule.
// hintMax: how many hints of each level a player may take - a number, or null for no limit (owner, 2026-09-26).
export const STANDARD = { premiums: 'once', check: 'auto', exchange: 'bag7', bingo: BINGO, time: null, hints: true,
  hintMax: { small: null, big: null, master: null }, hintCost: null, undo: false, open: false, rating: true };
// rating: false - a game without move ratings for anyone (owner, 2026-09-26): nothing under the board, no rating in
// History, none at the end; each player's own setting ("Rate my moves") applies only when it is true.
// hintCost: null, or 'low' / 'high' - a hint takes a share of the points of the move it shows off its player's score, a
// bigger share for a better level (owner, 2026-09-26: "a better hint should cost more") - HINT_COST below.
const OVERTIME = 10;

// ── A game ───────────────────────────────────────────────────────────────────────────────────────
// Plain data, so a save is the state itself: `players[p]` = { name, cpu } (`cpu` = the computer's level, or
// null for a person - 2 to 5 of them, any mix: owner, 2026-09-25), `cells` holds null or { ch, blank, by } per
// square (r * size + c) - `by` = the player who put it there, for the frames in each player's colour that the
// owner can switch on in a game, `bag` is drawn from the end, `racks[p]` / `scores[p]` / `hints[p]` / `clock[p]`
// (ms used) per player, `zeros` counts turns in a row that scored nothing, `moves` is the history as it is
// shown, `log` every action in order, `pending` a move waiting for a challenge, `over` null or how it ended,
// `words` the tag of the word list (dawg.js), `seed` the game's own random numbers, `start` what it began with.
// A placement is a list of { r, c, ch, blank }: `blank` true = a blank tile showing `ch`.
export const PLAYERS_MIN = 2, PLAYERS_MAX = 5;

// The owner's plan: an engine with a seed, so the same seed and the same actions always make the same game -
// for the look-back after a game, and one day for games between devices, which must draw the same tiles. One
// step of it: [a number 0-1, the next seed] (mulberry32).
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
export function newGame({ lang, board = 'classic', players, first, seed = Math.floor(Math.random() * 2 ** 32), words = 0, rules = {} }) {
  if (players.length < PLAYERS_MIN || players.length > PLAYERS_MAX) throw new Error(`${players.length} players: 2 to 5 play`);
  let { list: bag, seed: s } = shuffle(fullBag(lang, board), seed);
  const racks = [];
  for (let p = 0; p < players.length; p++) { const d = draw(bag, []); bag = d.bag; racks.push(d.rack); }
  // the draw for who starts is made even when `first` is given, so a game rebuilt from its start (replay) runs
  // on the very same random numbers
  let x;
  [x, s] = roll(s);
  if (first === undefined) first = Math.floor(x * players.length);
  const n = sizeOf(board), none = () => players.map(() => 0);
  return { lang, board, words, rules: { ...STANDARD, ...rules }, start: { seed, first },
    players: players.map(x => ({ name: x.name ?? '', cpu: x.cpu ?? null })),
    cells: Array(n * n).fill(null), bag, racks, scores: none(), hints: none(), clock: none(), turn: first, zeros: 0,
    moves: [], log: [], pending: null, over: null, seed: s };
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
// it at each new tile that touches others. Bonus squares count only under new tiles (unless the game's rules
// say every time); a blank is worth 0. Returns { words: [{ w, r, c, across, score }], score } - plus the
// seven-tile bonus when a full rack goes down.
export function wordsMade(state, placed) {
  const n = sizeOf(state.board), prem = premiums(state.board), always = state.rules?.premiums === 'always';
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
      if (fresh.has(k) || always) { sum += v * (LETTER_X[prem[k]] || 1); mul *= WORD_X[prem[k]] || 1; }
      else sum += v;
    }
    return len > 1 ? { w, ...start, across, score: sum * mul } : null;
  };
  const across = placed.length > 1 ? placed[0].r === placed[1].r
    : !!(tileAt(placed[0].r, placed[0].c - 1) || tileAt(placed[0].r, placed[0].c + 1)) || !(tileAt(placed[0].r - 1, placed[0].c) || tileAt(placed[0].r + 1, placed[0].c));
  const words = [wordThrough(placed[0].r, placed[0].c, across), ...placed.map(t => wordThrough(t.r, t.c, !across))].filter(Boolean);
  const score = words.reduce((s, x) => s + x.score, 0) + (placed.length === RACK ? state.rules?.bingo ?? BINGO : 0);
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
// The engine as one function (the owner's plan: "apply(state, action) -> state"). Everything that happens in a
// game is one of these, and goes into `log`, so a game can be rebuilt from its start (replay):
// { type: 'place', placed } | { type: 'exchange', tiles } | { type: 'pass' } | { type: 'challenge' }
// | { type: 'timeout' } | { type: 'resign', p } | { type: 'shuffle', seed } (the bag shuffled again: undo() below)
// | { type: 'hint', level, cost } (a hint taken: counted, its cost off the score; the turn goes on). A 'place' may carry
// `hint` = the level of the hint it plays, and the move and its tiles remember it.
// Any of them may carry `ms`, the time the player took.
// An action that is not allowed throws, and the state stays as it was. Each returns a new state.
export function apply(state, action, isWord) {
  if (state.over) throw new Error('the game is over');
  if (action.type === 'challenge' && !state.pending) throw new Error('nothing to challenge');
  let s = state;
  // any other action accepts the move waiting for a challenge (shuffling the bag is no move)
  if (s.pending && !['challenge', 'shuffle', 'hint'].includes(action.type)) s = { ...s, pending: null };
  if (action.ms) s = { ...s, clock: s.clock.map((t, p) => p === s.turn ? t + action.ms : t) };
  s = { ...s, log: [...s.log, action] };
  const after = action.type === 'place' ? place(s, action.placed, isWord, action.hint)
    : action.type === 'exchange' ? swap(s, action.tiles)
    : action.type === 'pass' ? scoreless(s, { p: s.turn, kind: 'pass' })
    : action.type === 'timeout' ? scoreless(s, { p: s.turn, kind: 'timeout' })
    : action.type === 'challenge' ? challenge(s, isWord)
    : action.type === 'resign' ? finish(s, 'resign', -1, action.p ?? s.turn)
    : action.type === 'shuffle' ? reshuffle(s, action.seed)
    : action.type === 'hint' ? tookHint(s, action)
    : null;
  if (!after) throw new Error('no such action: ' + action.type);
  return after;
}
// the same, one action at a time
export const play = (state, placed, isWord) => apply(state, { type: 'place', placed }, isWord);
export const pass = state => apply(state, { type: 'pass' });
export const resign = (state, p = state.turn) => apply(state, { type: 'resign', p });
// Swap some tiles for new ones. Returns null when it is not allowed (see canExchange).
export function exchange(state, tiles) {
  try { return apply(state, { type: 'exchange', tiles }); } catch { return null; }
}
export const canExchange = (state, k = 1) => state.rules?.exchange === 'always' ? state.bag.length >= k : state.bag.length >= RACK;

const next = (state, p) => (p + 1) % state.racks.length;
const rackPoints = (lang, rack) => rack.reduce((s, t) => s + valueOf(lang, t), 0);

function place(state, placed, isWord, hint) {
  const p = state.turn, n = sizeOf(state.board);
  const out = placed.length === state.racks[p].length && !state.bag.length;
  // with challenges on, only the placement is checked now - the words wait for the next player
  const challenged = state.rules?.check === 'challenge' && !out;
  const error = placementError(state, placed);
  const made = error ? { error } : challenged ? wordsMade(state, placed) : checkMove(state, placed, isWord);
  if (made.error) throw new Error('not a legal move: ' + made.error);
  const cells = [...state.cells], rack = [...state.racks[p]];
  for (const t of placed) {
    cells[t.r * n + t.c] = { ch: t.ch, ...(t.blank ? { blank: true } : {}), by: p, ...(hint ? { hint } : {}) };
    rack.splice(rack.indexOf(t.blank ? BLANK : t.ch), 1);
  }
  const d = draw(state.bag, rack);
  const moves = [...state.moves, { p, kind: 'play', placed, words: made.words.map(x => ({ w: x.w, score: x.score })),
    score: made.score, bingo: placed.length === RACK, ...(hint ? { hinted: hint } : {}) }];
  const after = { ...state, cells, bag: d.bag, racks: state.racks.map((r, i) => i === p ? d.rack : r),
    scores: state.scores.map((s, i) => i === p ? s + made.score : s), moves, zeros: 0, turn: next(state, p),
    pending: challenged ? { before: state, p } : null };
  return d.rack.length ? after : finish(after, 'out', p);
}

function swap(state, tiles) {
  if (!tiles.length || !canExchange(state, tiles.length)) throw new Error('not an allowed exchange');
  const p = state.turn, rack = [...state.racks[p]];
  for (const t of tiles) { const k = rack.indexOf(t); if (k < 0) throw new Error('not on the rack: ' + t); rack.splice(k, 1); }
  const d = draw(state.bag, rack);
  const { list: bag, seed } = shuffle([...d.bag, ...tiles], state.seed);
  return scoreless({ ...state, bag, seed, racks: state.racks.map((r, i) => i === p ? d.rack : r) }, { p, kind: 'swap', n: tiles.length, tiles });
}

// Challenging the move just made (rules: challenges). Not allowed: the move goes back - tiles to its player's
// rack, the tiles drawn after it to the bag, its points off - and counts as a turn that scored nothing; the
// challenger then plays. Allowed: the challenger loses this turn.
function challenge(state, isWord) {
  const { before, p } = state.pending, move = state.moves[state.moves.length - 1];
  const bad = move.words.map(x => x.w).filter(w => !isWord(w));
  const who = state.turn;
  if (!bad.length) return scoreless({ ...state, pending: null }, { p: who, kind: 'challenge', ok: false, of: p });
  const moves = [...state.moves.slice(0, -1), { ...move, kind: 'withdrawn', bad }, { p: who, kind: 'challenge', ok: true, of: p }];
  const back = { ...before, moves, log: state.log, hints: state.hints, clock: state.clock, pending: null, turn: who, zeros: before.zeros + 1 };
  return back.zeros >= 2 * state.racks.length ? finish(back, 'passes') : back;
}

// Every player passing (or exchanging) twice in a row ends the game - the Polish rule, "gdy wszyscy gracze
// spasują dwa razy z rzędu"; exchanges count too, so a game where nobody can move cannot run for ever.
function scoreless(state, entry) {
  const zeros = state.zeros + 1;
  const after = { ...state, zeros, moves: [...state.moves, entry], turn: next(state, state.turn) };
  return zeros >= 2 * state.racks.length ? finish(after, 'passes') : after;
}

// The end: whoever emptied their rack gets everyone else's leftover points, and everyone loses their own; with a
// clock per game, every started minute over costs 10. `out` = that player, or -1 (ended by passes: everyone just
// loses their leftovers). `resigned` = a player who gave up: it ends the game for everyone, and the others are
// ranked by their scores as they stand.
function finish(state, reason, out = -1, resigned = -1) {
  const left = state.racks.map(r => rackPoints(state.lang, r));
  const t = state.rules?.time, limit = t?.per === 'game' ? t.seconds * 1000 : Infinity;
  const late = state.clock.map(ms => ms > limit ? OVERTIME * Math.ceil((ms - limit) / 60000) : 0);
  const adjust = reason === 'resign' ? left.map(() => 0)
    : left.map((v, p) => (p === out ? left.reduce((s, x) => s + x, 0) - v : -v) - late[p]);
  const scores = state.scores.map((s, p) => s + adjust[p]);
  const best = Math.max(...scores.filter((_, p) => p !== resigned));
  const top = scores.map((s, p) => p !== resigned && s === best ? p : -1).filter(p => p >= 0);
  return { ...state, scores, pending: null,
    over: { reason, adjust, late, winner: top.length === 1 ? top[0] : -1, by: reason === 'resign' ? resigned : out } };
}

// The game rebuilt from its start, one action at a time: [the first state, the state after each action] - for
// the look-back after a game (tiles-moves.js). Throws if the log does not replay (a changed word list can make
// an old move unplayable: `words` tells which list checked it).
export function replay(state, isWord) {
  let s = newGame({ lang: state.lang, board: state.board, players: state.players, first: state.start.first,
    seed: state.start.seed, words: state.words, rules: state.rules });
  const out = [s];
  for (const a of state.log) out.push(s = apply(s, a, isWord));
  return out;
}

// Undo (owner, 2026-09-25: "undo all the moves, even the computer's, back to the start - only against the computer"):
// back to the last turn a person took, before it - their move and every move after it come off - or null when there
// is none. The bag is then shuffled again from `seed` (owner: "the draws will be random"), so the next tiles are not
// the ones that came before; the shuffle is an action of its own, so the game still replays. Hints stay counted.
export function undo(state, isWord, seed = Math.floor(Math.random() * 2 ** 32)) {
  if (state.over) return null;
  const states = replay(state, isWord);
  for (let i = state.log.length - 1; i >= 0; i--) {
    const before = states[i];
    if (['shuffle', 'hint'].includes(state.log[i].type) || before.players[before.turn].cpu) continue;
    return { ...apply(before, { type: 'shuffle', seed }), hints: state.hints };
  }
  return null;
}
const reshuffle = (state, seed) => { const { list, seed: s } = shuffle(state.bag, seed); return { ...state, bag: list, seed: s }; };

// A hint was shown to the player whose turn it is (the move itself: hint() in tiles-moves.js). Counted, as in
// the other games.
export const hinted = state => ({ ...state, hints: state.hints.map((h, p) => p === state.turn ? h + 1 : h) });
// The same as an action (the screen's way since 0.43.0): counted, its cost off the score, a quiet entry in the history.
function tookHint(state, { level, cost = 0 }) {
  const p = state.turn;
  return { ...hinted(state), scores: state.scores.map((s, i) => i === p ? s - cost : s), moves: [...state.moves, { p, kind: 'hint', level, cost }] };
}
// What a hint costs with the rules' hintCost: a share of the points of the move it shows (owner, 2026-09-26) - and never
// less than a smaller level costs, as Master's move can score fewer points than Big's (it weighs the rack too).
// levels: { small, big, master } - each the move that level shows, or null.
export const HINT_COST = { low: { small: 0.1, big: 0.2, master: 0.3 }, high: { small: 0.25, big: 0.4, master: 0.6 } };
export function hintCost(rules, level, levels) {
  if (!rules?.hintCost) return 0;
  let cost = 0;
  for (const l of ['small', 'big', 'master']) {
    if (levels[l]) cost = Math.max(cost, Math.ceil(levels[l].score * HINT_COST[rules.hintCost][l]));
    if (l === level) return cost;
  }
}

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

// ── Statistics ───────────────────────────────────────────────────────────────────────────────────
// What a finished game adds to the statistics (store.js recordTilesEnd). Every game on the device counts,
// several people included (owner, 2026-09-25: "it's the phone's statistics") - the computer's own moves never
// do. `level` = the strongest computer in the game, or 'people'; `won` = a person beat the computer.
export const LEVEL_ORDER = ['relaxed', 'easy', 'normal', 'hard', 'expert'];
export function results(state) {
  const people = state.players.map((x, p) => x.cpu ? -1 : p).filter(p => p >= 0);
  const cpus = state.players.filter(x => x.cpu).map(x => LEVEL_ORDER.indexOf(x.cpu));
  const mine = state.moves.filter(m => people.includes(m.p));
  const plays = mine.filter(m => m.kind === 'play');
  const top = plays.reduce((a, m) => !a || m.score > a.score ? m : a, null);
  const winner = state.over?.winner ?? -1;
  return {
    lang: state.lang, level: cpus.length ? LEVEL_ORDER[Math.max(...cpus)] : 'people',
    played: 1, vsCpu: cpus.length ? 1 : 0, won: cpus.length && people.includes(winner) ? 1 : 0,
    games: people.length, points: people.reduce((s, p) => s + state.scores[p], 0),
    bestGame: people.length ? Math.max(...people.map(p => state.scores[p])) : 0,
    bestMove: top && { w: top.words[0]?.w ?? '', score: top.score },
    moves: plays.length, movePoints: plays.reduce((s, m) => s + m.score, 0), bingos: plays.filter(m => m.bingo).length,
    passes: mine.filter(m => m.kind === 'pass' || m.kind === 'timeout').length,
    hints: people.reduce((s, p) => s + state.hints[p], 0),
  };
}
