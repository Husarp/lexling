// Letters mode - the rules, with no screen attached (PLAN.md M12).
import { DIFFS } from './engine.js';
import { offensiveWord } from './offensive.js';

// Polish letters with marks are separate letters here: ó is not o, so `zolw` is simply wrong for
// `żółw`. With the switch off, the hidden word has none of them.
export const MARKED = /[ąćęłńóśźż]/;

// ── Which words can be hidden ────────────────────────────────────────────────────────────────────
// Any common word, whatever its part of speech, but always in its base form and never on the stoplist.
const POOL_WITHIN = 20000;                     // the common end of the list; words[] is most-common-first
const KINDS = new Set(['noun', 'adj', 'verb', 'adv']);
const MIN_POOL = 20;                           // the same floor the main mode uses for a thin choice
const REPEAT = 0.5;                            // what one repeated letter adds to a word's letter score
const prepared = new WeakMap();

// Everything that depends only on the language, worked out once.
function prepare(m) {
  if (prepared.has(m)) return prepared.get(m);
  // `formOf` lists the words that are really an inflected form of another word - `ptaki`, `stara`,
  // `kota` - worked out by the pipeline, which still knows every word's forms (tools/build-data.mjs).
  const skip = new Set([...(m.blocked || []), ...(m.formOf || [])]);
  const words = [];
  for (let i = 0; i < Math.min(POOL_WITHIN, m.count); i++) {
    // never a slur or a vulgar word either - the data's stoplist missed some (mineta): offensive.js
    if (KINDS.has(m.posNames[m.pos[i]]) && !skip.has(i) && !offensiveWord(m.lang === 'pl' ? 'pl' : 'en', m.words[i])) words.push(i);
  }

  // Difficulty here is not the main mode's. That one measures how isolated a word is in MEANING,
  // and meaning plays no part in this game. What makes a word hard to find by its letters is:
  //  - how well known it is: its place in the frequency list;
  //  - how unusual its letters are: `ź`, `q`, `x` narrow nothing down for a player, and a repeated
  //    letter is easy to rule out by mistake.
  // Each is turned into a percentile among these words, and the two are averaged - the same shape as
  // the main mode's score, so the Relaxed / Easy / Normal / Hard bands mean something alike.
  const counts = new Map();
  let total = 0;
  for (const i of words) for (const ch of m.words[i]) { counts.set(ch, (counts.get(ch) || 0) + 1); total++; }
  const rarity = ch => -Math.log(counts.get(ch) / total);
  const letterScore = i => {
    const chars = [...m.words[i]];
    const repeats = chars.length - new Set(chars).size;
    return chars.reduce((s, ch) => s + rarity(ch), 0) / chars.length + REPEAT * repeats;
  };
  const scored = new Map(words.map(i => [i, letterScore(i)]));   // once each, not once per comparison
  const byLetters = [...words].sort((a, b) => scored.get(a) - scored.get(b));
  const letterPct = new Map(byLetters.map((i, n) => [i, n / (words.length - 1)]));
  const hard = new Map(words.map((i, n) => [i, Math.round((n / (words.length - 1) + letterPct.get(i)) / 2 * 100)]));

  const out = { words, hard };
  prepared.set(m, out);
  return out;
}

// How hard a word is to find by its letters, 0 (easiest) to 100 - or undefined for a word this mode
// would never hide.
export const difficulty = (m, i) => prepare(m).hard.get(i);

export const LEN_MIN = 3, LEN_MAX = 13;         // measured in PLAN.md M12: ~100+ common words at each

// The words a game with these settings can hide. `marks` false guarantees none of ąćęłńóśźż.
// Difficulty is an absolute band, as in the main mode; when the other choices leave fewer than 20
// words inside it, the 20 closest to it are offered rather than nothing. No `len` = any length:
// every word 3-13 letters long in one pool, so a length turns up as often as words of it exist.
export function pool(m, { len, cat = 'all', diff = 'normal', marks = true }) {
  const { words, hard } = prepare(m);
  const inCat = cat === 'all' ? null : new Set(m.cats[cat] || []);
  const size = n => len ? n === len : n >= LEN_MIN && n <= LEN_MAX;
  const fits = words.filter(i => size([...m.words[i]].length) && (!inCat || inCat.has(i)) && (marks || !MARKED.test(m.words[i])));
  // "random" (owner, 2026-09-25): the game draws one of the four levels when it starts; before that, the
  // words it could hide are those of every level together
  if (diff === 'random') return fits;
  const cap = DIFFS[diff] ?? DIFFS.normal;
  const within = fits.filter(i => diff === 'hard' ? hard.get(i) > DIFFS.normal : hard.get(i) <= cap);
  if (within.length >= MIN_POOL) return within;
  const toward = diff === 'hard' ? (a, b) => hard.get(b) - hard.get(a) : (a, b) => hard.get(a) - hard.get(b);
  return [...fits].sort(toward).slice(0, MIN_POOL);
}

export function pick(m, opts) {
  const p = pool(m, opts);
  return p.length ? p[Math.floor(Math.random() * p.length)] : -1;
}

// How each letter of a guess compares with the answer: 'green' (right letter, right place),
// 'yellow' (in the word, elsewhere) or 'grey' (not in it).
//
// Repeated letters follow Wordle exactly, which is the part that is easy to get wrong. Greens are
// settled first and use up their letter; only what is left over can turn a guessed letter yellow,
// and each leftover letter can do that once. So against `crane`, the guess `eerie` gets its last
// `e` green, and both other `e`s grey - the answer has only the one.
export function feedback(guess, answer) {
  const g = [...guess.toLowerCase()], a = [...answer.toLowerCase()];
  const out = g.map(() => 'grey');
  const left = new Map();
  g.forEach((ch, i) => {
    if (ch === a[i]) out[i] = 'green';
    else left.set(a[i], (left.get(a[i]) || 0) + 1);
  });
  g.forEach((ch, i) => {
    if (out[i] === 'green' || !left.get(ch)) return;
    out[i] = 'yellow';
    left.set(ch, left.get(ch) - 1);
  });
  return out;
}

// The most tries a game can have; one more step on the new-game stepper is Unlimited.
export const TRIES_MAX = 20;

// ── The row being typed (design v4, the on-screen keyboard) ──────────────────────────────────────
// `row` holds one letter or '' per tile - it can have gaps, because a tapped tile can be emptied or
// overwritten out of order. `sel` is the tile the player tapped to edit, or null. Both return the new
// state and never change what they were given.

// A letter replaces the selected tile, and the selection moves on (it ends after the last tile);
// without a selection it fills the first gap. `at` = the tile that changed, -1 if none (row full).
export function typeLetter(row, sel, ch) {
  const next = [...row];
  if (sel !== null) {
    next[sel] = ch;
    return { row: next, sel: sel + 1 < row.length ? sel + 1 : null, at: sel };
  }
  const at = next.indexOf('');
  if (at >= 0) next[at] = ch;
  return { row: next, sel: null, at };
}

// Backspace: with a selection it empties that tile and keeps it selected - on an already empty tile it
// steps back one and empties that. Without a selection it takes the last letter off.
export function eraseLetter(row, sel) {
  const next = [...row];
  if (sel !== null) {
    if (next[sel]) next[sel] = '';
    else if (sel > 0) next[--sel] = '';
    return { row: next, sel };
  }
  const last = next.findLastIndex(Boolean);
  if (last >= 0) next[last] = '';
  return { row: next, sel: null };
}

// What the guesses so far say about each letter, for its key: 'hit' if it has been in the right
// place, 'near' if only in the word, 'miss' if not in it. `count` = how many times the letter is known
// to be in the word - the most times it was green or yellow within one guess (shown from 2 up).
// `upto`: only the newest guess's letters up to this one count - the keys colour in letter by letter,
// in step with the row's tiles (owner, 2026-09-25).
export function keyStates(guesses, answer, upto = Infinity) {
  const state = {}, count = {}, rank = { miss: 1, near: 2, hit: 3 }, name = { green: 'hit', yellow: 'near', grey: 'miss' };
  guesses.forEach((w, g) => {
    const marks = feedback(w, answer).map(f => name[f]), inWord = {};
    [...w.toLowerCase()].forEach((ch, i) => {
      if (g === guesses.length - 1 && i > upto) return;
      if (!state[ch] || rank[marks[i]] > rank[state[ch]]) state[ch] = marks[i];
      if (marks[i] !== 'miss') inWord[ch] = (inWord[ch] || 0) + 1;
    });
    for (const [ch, k] of Object.entries(inWord)) count[ch] = Math.max(count[ch] || 0, k);
  });
  return { state, count };
}

// ── What the player knows, and hints (owner, 2026-09-25) ─────────────────────────────────────────
// `hinted` = the positions a hint has shown (0-based). A hint shows one letter in its right place and
// costs nothing but being counted; at most half the word (rounded down) may come from hints, as in Connect.

// The overview beside the grid: one slot per letter - 'hit' where some guess had the right letter there,
// 'hint' where a hint showed it, '' where nothing is known - and `loose`: the letters known to be in the
// word that no slot holds yet (the yellows still to place), once for each time they are still missing.
export function known(guesses, answer, hinted = []) {
  const a = [...answer.toLowerCase()];
  const slots = a.map((ch, i) => guesses.some(g => [...g.toLowerCase()][i] === ch) ? { ch, how: 'hit' }
    : hinted.includes(i) ? { ch, how: 'hint' } : { ch: '', how: '' });
  const { count } = keyStates(guesses, answer);
  const loose = [];
  for (const [ch, k] of Object.entries(count)) {
    const placed = slots.filter(s => s.ch === ch).length;
    for (let i = placed; i < k; i++) loose.push(ch);
  }
  return { slots, loose };
}

// The next hint: a random position whose letter is not known yet - or -1 when every letter is known,
// or -2 when half the word already came from hints.
export function hintAt(guesses, answer, hinted = [], rand = Math.random) {
  const open = known(guesses, answer, hinted).slots.map((s, i) => s.how ? -1 : i).filter(i => i >= 0);
  if (!open.length) return -1;
  if (hinted.length >= Math.floor([...answer].length / 2)) return -2;
  return open[Math.floor(rand() * open.length)];
}

