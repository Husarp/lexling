// Letters mode - the rules, with no screen attached (PLAN.md M12).
import { DIFFS } from './engine.js';

// Polish letters with marks are separate letters here: ó is not o, so `zolw` is simply wrong for
// `żółw`. When the player allows them they are worth two in the score.
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
    if (KINDS.has(m.posNames[m.pos[i]]) && !skip.has(i)) words.push(i);
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

export const MULTIPLIER = { relaxed: 0.75, easy: 1, normal: 1.25, hard: 1.5 };

// letters ÷ guesses actually used × 100 × difficulty, with a marked Polish letter counting as two.
// Tries left unused never enter the sum - that is the reward for finishing early, and it is why the
// score still means something when tries are unlimited. A loss scores nothing here (see lossScore).
//
// Since 0.22.0 also × the tries factor (owner, 2026-09-25): dividing by the guesses used alone made
// unlimited tries the obvious choice - it can never lose and still paid in full. Now 6 ÷ tries
// allowed: 6, the classic Wordle, is ×1; 3 tries is ×2 (more risk, more points); 12 is ×0.5. With
// unlimited tries every guess counts as two - ×0.5.
export const triesFactor = tries => tries ? 6 / tries : 0.5;

export function score(answer, guessesUsed, won, diff, tries = 6) {
  if (!won || guessesUsed < 1) return 0;
  return Math.round(points(answer) / guessesUsed * 100 * (MULTIPLIER[diff] ?? 1) * triesFactor(tries));
}

// Running out of tries still pays something (owner, 2026-09-25): the best row - its greens, and its
// yellows at half - as a share of the word, of a quarter of what a win on the very last try would
// have paid. Giving up pays nothing, and an unlimited game cannot run out.
export function bestRow(guesses, answer) {
  return Math.max(0, ...guesses.map(g => feedback(g, answer).reduce((s, f) => s + (f === 'green' ? 1 : f === 'yellow' ? 0.5 : 0), 0)));
}
export function lossScore(answer, guesses, diff, tries) {
  if (!tries || !guesses.length) return 0;
  const lastTryWin = score(answer, tries, true, diff, tries);
  return Math.round(bestRow(guesses, answer) / [...answer].length * lastTryWin / 4);
}

// the "letters" of the score: żółw is 2+2+2+1 = 7
export const points = answer => [...answer.toLowerCase()].reduce((n, ch) => n + (MARKED.test(ch) ? 2 : 1), 0);
