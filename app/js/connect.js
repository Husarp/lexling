// Connect mode (Połącz) - the rules, with no screen attached (PLAN.md M14, design v4 "Lexling Connect").
// A circle of 4-7 letters, taken from one common word; a small crossword of words made from them.
import { resolve } from './engine.js';
import { pool } from './letters.js';
import { offensive } from './offensive.js';

export const RING_MIN = 4, RING_MAX = 10, WORD_MIN = 3;
// How many words a board aims for, by circle size - the new-game readout shows the same (design v4).
// 8-10 letters were added at the owner's wish (2026-09-25): a lot of words, for whoever wants that.
export const RANGE = { 4: [3, 5], 5: [4, 7], 6: [5, 8], 7: [6, 10], 8: [7, 12], 9: [8, 13], 10: [9, 14] };
// The largest board: on a phone the height is what runs out (the circle takes the bottom), so boards
// are kept wider than tall - the design's worst case is 10 across, 7 down, with 27 px tiles at 320 × 640.
// The bigger circles need more: a 10-letter word alone is 10 across.
const LIMIT = n => n <= 7 ? { cols: 10, rows: 8 } : n === 8 ? { cols: 11, rows: 9 } : { cols: 12, rows: 10 };
const TRIES = 300;            // letter sets tried before giving up (a thin choice: 4 Polish letters, Relaxed)

const count = letters => letters.reduce((c, ch) => c.set(ch, (c.get(ch) || 0) + 1), new Map());
// can `word` be spelt from the letters in `have`, each used once?
function fits(word, have) {
  const used = new Map();
  for (const ch of word) {
    const k = (used.get(ch) || 0) + 1;
    if (k > (have.get(ch) || 0)) return false;
    used.set(ch, k);
  }
  return true;
}
const shuffle = (list, rand) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// The words a board may use are Letters' hidden words - common base forms, never the stoplist or an
// inflected form posing as a word - of 3 to 7 letters. Any other real word, every Polish form included,
// is a bonus word instead (see judge).
//
// The level is how common the board's words are, by their place in the frequency list (the word list
// is most-common-first). Not Letters' difficulty: that also weighs how rare a word's letters are, which
// matters when letters must be guessed and not at all when the circle hands them over.
export const RANK_CAP = { relaxed: 5000, easy: 8000, normal: 12000, hard: 20000 };   // Relaxed at 5000: fewer words and 4 Polish letters cannot always make a board
const cache = new WeakMap();
function candidates(m, marks) {
  const mine = cache.get(m) ?? {};
  cache.set(m, mine);
  const key = marks ? 'marks' : 'plain';
  if (!mine[key]) {
    mine[key] = [];
    for (let len = WORD_MIN; len <= RING_MAX; len++) {
      for (const i of pool(m, { len, diff: 'random', marks })) {
        if (!offensive(m, m.words[i])) mine[key].push({ w: m.words[i], n: len, rank: i });   // no slurs on the board
      }
    }
  }
  return mine[key];
}

// A new puzzle: `letters` in the circle, words no harder than `diff` (Hard lets the rarer ones in too),
// `marks` false = none of ą ć ę ł ń ó ś ź ż. The circle is one word's letters, shuffled, so at least
// one word uses them all - and it is always on the board. Returns null when nothing fits.
export function makePuzzle(m, { letters: n, diff = 'normal', marks = true, rand = Math.random }) {
  const cap = RANK_CAP[diff] ?? RANK_CAP.normal;
  const usable = candidates(m, marks).filter(x => x.rank < cap);
  const keys = usable.filter(x => x.n === n);
  const [lo, hi] = RANGE[n];
  for (let attempt = 0; attempt < TRIES && keys.length; attempt++) {
    const key = keys[Math.floor(rand() * keys.length)].w;
    const have = count([...key]);
    // A word that uses every letter always goes on the board, however rare (owner, 2026-09-25: TORBA's circle
    // also spells TABOR - a player who finds it should see it land on the board, not as a bonus).
    const words = candidates(m, marks).filter(x => x.w !== key && (x.rank < cap || x.n === n) && fits(x.w, have)).map(x => x.w);
    if (words.length + 1 < lo) continue;
    const board = layout(key, words, hi, rand, LIMIT(n));
    if (board.words.length >= lo) return { ring: shuffle([...key], rand).join(''), key, board };
  }
  return null;
}

// ── the crossword ────────────────────────────────────────────────────────────────────────────────
// Words go in one at a time, each crossing at least one already there: across ('a') or down ('d'),
// never touching another word side by side or end to end, so no accidental words ever form. Of the
// places a word can go, the one with the most crossings and the smallest board wins. Rows and columns
// are 1-based, as in CSS grid.
export const cellsOf = ({ w, r, c, d }) => [...w].map((_, k) => d === 'a' ? `${r}-${c + k}` : `${r + k}-${c}`);

function layout(key, words, max, rand, limit) {
  const grid = new Map();                    // 'r,c' -> { ch, dirs: Set }
  const placed = [];
  let box = { r0: 0, r1: 0, c0: 0, c1: [...key].length - 1 };
  const put = (w, r, c, d) => {
    [...w].forEach((ch, k) => {
      const at = d === 'a' ? `${r},${c + k}` : `${r + k},${c}`;
      const cell = grid.get(at) ?? { ch, dirs: new Set() };
      cell.dirs.add(d);
      grid.set(at, cell);
    });
    placed.push({ w, r, c, d });
  };
  put(key, 0, 0, 'a');
  // longer words first - they cross more and hold the board together - in a new order every game
  const queue = shuffle(words, rand).sort((a, b) => [...b].length - [...a].length);
  for (const w of queue) {
    if (placed.length >= max) break;
    const spot = bestSpot(w, grid, box, rand, limit);
    if (!spot) continue;
    put(w, spot.r, spot.c, spot.d);
    box = spot.box;
  }
  const words0 = placed.map(p => ({ w: p.w, r: p.r - box.r0 + 1, c: p.c - box.c0 + 1, d: p.d }));
  return { cols: box.c1 - box.c0 + 1, rows: box.r1 - box.r0 + 1, words: words0 };
}

function bestSpot(w, grid, box, rand, limit) {
  const letters = [...w], L = letters.length;
  let best = null;
  for (const [at, cell] of grid) {
    if (cell.dirs.size !== 1) continue;      // already a crossing
    const [cr, cc] = at.split(',').map(Number);
    const d = cell.dirs.has('a') ? 'd' : 'a';
    letters.forEach((ch, k) => {
      if (ch !== cell.ch) return;
      const r = d === 'a' ? cr : cr - k, c = d === 'a' ? cc - k : cc;
      const crossings = fitsAt(letters, r, c, d, grid);
      if (!crossings) return;
      const nb = { r0: Math.min(box.r0, r), c0: Math.min(box.c0, c),
        r1: Math.max(box.r1, d === 'a' ? r : r + L - 1), c1: Math.max(box.c1, d === 'a' ? c + L - 1 : c) };
      const rows = nb.r1 - nb.r0 + 1, cols = nb.c1 - nb.c0 + 1;
      if (rows > limit.rows || cols > limit.cols) return;
      // most crossings first, then the smallest board, not taller than wide; ties broken at random
      const score = crossings * 1000 - rows * cols - Math.max(0, rows - cols) * 8 + rand();
      if (!best || score > best.score) best = { r, c, d, box: nb, score };
    });
  }
  return best;
}

// How many existing letters the word would cross at (r, c) going d - or 0 if it cannot go there.
function fitsAt(letters, r, c, d, grid) {
  const dr = d === 'd' ? 1 : 0, dc = d === 'a' ? 1 : 0, L = letters.length;
  const get = (y, x) => grid.get(`${y},${x}`);
  if (get(r - dr, c - dc) || get(r + dr * L, c + dc * L)) return 0;   // nothing just before or after it
  let crossings = 0;
  for (let k = 0; k < L; k++) {
    const y = r + dr * k, x = c + dc * k, cell = get(y, x);
    if (cell) {
      if (cell.ch !== letters[k] || cell.dirs.has(d)) return 0;       // a clash, or running along a word
      crossings++;
    } else if (get(y + dc, x + dr) || get(y - dc, x - dr)) {
      return 0;                                                        // would touch a word side by side
    }
  }
  return crossings;
}

// ── playing ──────────────────────────────────────────────────────────────────────────────────────
// A game's state: `found` = the board words the player made (in order), `shown` = the cells hints
// revealed ('r-c'), `bonus` = the other real words they made.

// every cell of a found word, and every hinted cell
export function visible(board, found, shown) {
  const v = new Set(shown);
  for (const x of board.words) if (found.includes(x.w)) cellsOf(x).forEach(k => v.add(k));
  return v;
}
// A word counts once the player found it - or once every one of its letters is showing, through
// hints and the words that cross it ("finished by hints": it counts, and keeps the hinted look).
export const isDone = (x, found, vis) => found.includes(x.w) || cellsOf(x).every(k => vis.has(k));
export const doneWords = (board, found, shown) => {
  const vis = visible(board, found, shown);
  return board.words.filter(x => isDone(x, found, vis));
};
export const solved = (board, found, shown) => doneWords(board, found, shown).length === board.words.length;

// The next hint (owner, 2026-09-25): a random letter that is not showing yet, anywhere on the board - or,
// when the player tapped a word first, anywhere in that word. A hint must stay a hint, not solve the word
// for you: at most half of a word's letters (rounded down) may come from hints - 3 of 6, 2 of 5, 1 of 3.
// Letters showing through a word the player found do not count; those were earned. A cell where two
// words cross counts for both. Returns null when every word is done, { cell: null } when no word may
// take another hinted letter (or the chosen one may not), otherwise { cell, words } - the unfinished
// words through that cell.
export const hintCap = word => Math.floor([...word].length / 2);
export function nextHint(board, found, shown, pick = null, rand = Math.random) {
  const vis = visible(board, found, shown), hinted = new Set(shown);
  const open = board.words.filter(x => !isDone(x, found, vis));
  if (!open.length) return null;
  const through = k => open.filter(x => cellsOf(x).includes(k));
  const allowed = k => !vis.has(k) && through(k).every(x => cellsOf(x).filter(c => hinted.has(c)).length < hintCap(x.w));
  const chosen = pick && open.find(x => x.w === pick);
  const cells = [...new Set((chosen ? [chosen] : open).flatMap(cellsOf))].filter(allowed);
  if (!cells.length) return { cell: null, words: [] };
  const cell = cells[Math.floor(rand() * cells.length)];
  return { cell, words: through(cell).map(x => x.w) };
}

// What a word made on the circle is: 'short' (under 3 letters), 'found' (a board word, new),
// 'again' (a board word already showing), 'bonus' (another real word, new), 'bonusAgain', or 'none'.
export function judge(m, board, state, word) {
  if ([...word].length < WORD_MIN) return 'short';
  const x = board.words.find(b => b.w === word);
  if (x) return isDone(x, state.found, visible(board, state.found, state.shown)) ? 'again' : 'found';
  if (state.bonus.includes(word)) return 'bonusAgain';
  if (offensive(m, word)) return 'none';                     // nor as a bonus word (offensive.js)
  return resolve(m, word) || m.extra.has(word) ? 'bonus' : 'none';
}
