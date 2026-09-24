// Word data + scoring. The data files are described in DESIGN.md §2 and produced by tools/build-data.mjs.
const models = {}, lexicons = {};

// ż→z, ł→l … so that typing "zolw" finds "żółw". One char maps to one char, so prefix lengths line up.
// tools/build-data.mjs sorts the autocomplete list with this same function - keep them in step.
const PLAIN = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
export const fold = s => s.toLowerCase().replace(/[ąćęłńóśźż]/g, c => PLAIN[c]);

// Returns the same promise to every caller, so screens can start the load early (the Polish data is
// ~27 MB) and the game screen simply awaits what is already under way.
// load() is everything Guess needs. loadWords() is the words alone - the vocabulary and every
// inflected form, ~9 MB for Polish - which is all Letters needs: it never measures meaning, so the
// vectors (18 MB of the 27) would only make it start slower.
export const load = lang => models[lang] ??= readVectors(lang).catch(e => { delete models[lang]; throw e; });
export const loadWords = lang => lexicons[lang] ??= readWords(lang).catch(e => { delete lexicons[lang]; throw e; });
export const preload = lang => { load(lang).catch(() => {}); };

async function readWords(lang) {
  const base = `data/${lang}/`;
  const [vocab, acText, acBuf] = await Promise.all([
    fetch(base + 'vocab.json').then(r => r.json()),
    fetch(base + 'ac.txt').then(r => r.text()),
    fetch(base + 'ac.bin').then(r => r.arrayBuffer()),
  ]);
  const { words } = vocab;
  return {
    ...vocab,
    hardOf: new Map(vocab.hard.idx.map((w, i) => [w, vocab.hard.score[i]])),   // 0-100, see DESIGN.md §2
    count: words.length,
    folded: words.map(fold),              // words[] is most-frequent-first: scanning it finds the common words first
    ac: acText.split('\n'),               // every base word and inflected form, sorted by fold(); ac[i] belongs to word acIdx[i]
    acIdx: new Uint32Array(acBuf),
    secretSet: new Set(vocab.secret),     // for reading(): a word the engine can hide wins an ambiguity
  };
}

async function readVectors(lang) {
  const [lex, vecBuf] = await Promise.all([loadWords(lang), fetch(`data/${lang}/vectors.bin`).then(r => r.arrayBuffer())]);
  const { count, dims } = lex;
  const vec = new Int8Array(vecBuf);
  const norms = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let s = 0;
    for (let d = i * dims, e = d + dims; d < e; d++) s += vec[d] * vec[d];
    norms[i] = Math.sqrt(s);
  }
  return { ...lex, vec, norms };
}

// first position in the sorted list whose folded spelling is >= key
function lowerBound(m, key) {
  let lo = 0, hi = m.ac.length;
  while (lo < hi) { const mid = lo + hi >> 1; if (fold(m.ac[mid]) < key) lo = mid + 1; else hi = mid; }
  return lo;
}

// Every word one exact spelling can mean. 4.5 % of the Polish forms are ambiguous: "płazy" is a
// correct plural of both płaz (the animal) and płaza (the flat of a blade), "koty" of both kot and kota.
function readings(m, form) {
  const key = fold(form), out = [];
  for (let i = lowerBound(m, key); i < m.ac.length && fold(m.ac[i]) === key; i++) {
    if (m.ac[i] === form && !out.includes(m.acIdx[i])) out.push(m.acIdx[i]);
  }
  return out;
}

// Measured over all 19 928 ambiguous Polish forms: the shorter-base test below overrules frequency
// 952 times, and the widest gap among the ones it gets right is 5× (maj #273 under maja #51).
// Everything past 10× is a dictionary artefact - "głup" under "głupi", "ha" under "have" at 235×.
const MUCH_RARER = 10;

// ...and which one of them the game plays. Offering the same spelling twice, told apart only by an
// arrow to two words that differ by a letter, reads as a bug - so an ambiguous form gets one reading.
// The tests narrow the field in turn, and a test that would empty it is skipped. Frequency alone is
// not enough: the corpus makes płaza (#9745) look commoner than płaz (#15994), because its counts are
// inflated by this very ambiguity. Words are stored most-frequent-first, so a lower index is commoner.
function reading(m, form) {
  const all = readings(m, form);
  if (all.length < 2) return all[0];
  const only = (list, keep) => { const kept = list.filter(w => keep(w, list)); return kept.length ? kept : list; };
  let pool = only(all, w => m.words[w] === form);                  // a dictionary word typed in full means itself
  pool = only(pool, w => m.secretSet.has(w));                      // a word the engine can hide beats one it cannot
  pool = only(pool, (w, rest) => rest.every(o => o === w           // płaz over płaza, kot over kota, maj over maja:
    || (m.words[o].startsWith(m.words[w])                          // where one base starts the other the longer is
        && w <= o * MUCH_RARER)));                                 // the artefact - unless nobody uses the shorter
  return Math.min(...pool);                                        // otherwise the commoner word
}

// Typed text -> the word that gets scored. Same choice the suggestion list shows, so pressing Enter
// always plays the word sitting at the top of it.
export function resolve(m, text) {
  const typed = text.trim().toLowerCase();
  const idx = reading(m, typed);
  return idx === undefined ? null : { idx, typed };
}

// Spellings people actually mix up, written against the FOLDED text (fold() has already turned ż→z,
// ó→o, ą→a, ę→e). Each pair is tried both ways, so "rzaba" finds żaba and "morze" still finds morze.
const SPELLING = {
  pl: [['rz', 'z'], ['u', 'o'], ['om', 'a'], ['on', 'a'], ['em', 'e'], ['en', 'e'], ['ch', 'h'], ['ii', 'i']],
  en: [['ph', 'f'], ['ck', 'k'], ['ie', 'ei'], ['ance', 'ence'], ['able', 'ible'], ['our', 'or']],
};
const MAX_VARIANTS = 24;

// The typed text plus the ways it could have been meant. Cheap: each variant is one more binary
// search, and the list is capped.
function variants(key, lang) {
  const out = [key], seen = new Set(out);
  for (const [a, b] of SPELLING[lang] || []) {
    for (const [from, to] of [[a, b], [b, a]]) {
      for (const base of [...out]) {
        for (let at = base.indexOf(from); at >= 0 && out.length < MAX_VARIANTS; at = base.indexOf(from, at + 1)) {
          const v = base.slice(0, at) + to + base.slice(at + from.length);
          if (!seen.has(v)) { seen.add(v); out.push(v); }
        }
      }
    }
  }
  return out;
}

// Suggestions while typing: exact spellings first, then the most common base words starting with the
// text, then inflected forms. One row per word. `spelling` also tries the confusable spellings above.
export function suggest(m, text, limit = 4, spelling = true) {
  const written = text.trim().toLowerCase();
  const typed = fold(written);
  if (!typed) return [];
  const out = [], taken = new Set(), shown = new Set();
  // One row per spelling, for the reading() chose, and never the same word twice.
  const add = w => {
    if (shown.has(w) || out.length >= limit) return;
    shown.add(w);
    const idx = reading(m, w);
    if (idx === undefined || taken.has(idx)) return;
    taken.add(idx);
    out.push({ w, idx, form: w !== m.words[idx] });
  };
  const keys = spelling ? variants(typed, m.lang) : [typed];
  for (const key of keys) {                      // exact spellings, the typed one first
    const same = [];
    for (let i = lowerBound(m, key); i < m.ac.length && fold(m.ac[i]) === key; i++) same.push(i);
    // "płazy" and "plaży" fold to the same letters, so both land here and the list order decided which
    // came first. The spelling actually written wins: the list may correct you, never ahead of you.
    same.sort((a, b) => (m.ac[b] === written) - (m.ac[a] === written));
    for (const i of same) add(m.ac[i]);
  }
  for (const key of keys) {                      // then base words that start with it, most common first
    for (let idx = 0; idx < m.count && out.length < limit; idx++) if (m.folded[idx].startsWith(key)) add(m.words[idx]);
  }
  if (out.length < limit) {                      // and finally inflected forms
    const forms = [];
    for (const key of keys) {
      for (let i = lowerBound(m, key); i < m.ac.length && forms.length < 3000 && fold(m.ac[i]).startsWith(key); i++) forms.push(i);
    }
    forms.sort((a, b) => m.acIdx[a] - m.acIdx[b]);
    for (const i of forms) add(m.ac[i]);
  }
  return out;
}

// rank[i] = 1-based position of word i when the whole vocabulary is sorted by closeness to the secret.
// Closeness is the cosine standardised per guess word: minus that word's average similarity to the
// possible secrets (hub), divided by its spread. Without this, generic words score high against
// everything (DESIGN.md §2 "OP words"). The secret itself gets 0.
export function rankAll(m, secret) {
  const { vec, dims, norms, hub, spread, count } = m;
  const score = new Float32Array(count);
  const s0 = secret * dims;
  for (let i = 0; i < count; i++) {
    let dotp = 0;
    for (let d = 0, o = i * dims; d < dims; d++) dotp += vec[o + d] * vec[s0 + d];
    score[i] = (dotp / (norms[i] * norms[secret]) - hub[i]) / spread[i];
  }
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  order.sort((a, b) => score[b] - score[a]);
  const rank = new Int32Array(count);
  let pos = 0;
  for (const idx of order) rank[idx] = idx === secret ? 0 : ++pos;
  return rank;
}

// closeness percent for the fill bars: logarithmic, so 4000 → 300 is a visible jump (DESIGN.md §2)
export const pct = (rank, count) => rank <= 0 ? 100 : Math.max(0, Math.round(100 * (1 - Math.log(rank) / Math.log(Math.max(count - 1, 2)))));

const letters = w => [...w].length;

// Secret length is picked as a band, not a maximum (design v2). "Any" is the whole dictionary: long
// words are rare enough on their own that they need no extra rule.
export const BANDS = { short: [3, 5], medium: [6, 8], long: [9, Infinity], any: [0, Infinity] };
export const HIST_FROM = 3, HIST_TO = 12;      // last bar counts everything from 12 letters up

const candidates = (m, cat) => cat === 'all' ? m.secret : m.cats[cat] || [];

// Bars for the length histogram over the words this language + category + difficulty can hide, plus
// what the chosen band holds: { bars: [{ len, last, count, on }], count, share, from, to }. The
// difficulty is included so the count is what the engine will really draw from, not a larger promise.
export function lengthStats(m, { cat, band, diff }) {
  const pool = secretPool(m, { cat, band: 'any', diff });
  const [lo, hi] = BANDS[band];
  const bars = [];
  for (let len = HIST_FROM; len <= HIST_TO; len++) {
    const last = len === HIST_TO;          // the last bar stands for "12 letters or more"
    bars.push({ len, last, count: 0, on: len >= lo && (last ? hi >= HIST_TO : len <= hi) });
  }
  let count = 0, from = Infinity, to = 0;
  for (const i of pool) {
    const n = letters(m.words[i]);
    if (n >= HIST_FROM) bars[Math.min(n, HIST_TO) - HIST_FROM].count++;
    if (n < lo || n > hi) continue;
    count++;
    from = Math.min(from, n);
    to = Math.max(to, n);
  }
  return { bars, count, share: pool.length ? count / pool.length : 0, from: count ? from : 0, to };
}

// Difficulty is an absolute band on the word's own difficulty score (DESIGN.md §2), not a slice of
// whatever the category happens to hold. It used to be a slice, and that made "easy" mean something
// different everywhere: easy Animals averaged 49 while easy Jobs averaged 14, because there are only
// five genuinely easy animals in the language. Now Easy means Easy in every category.
export const DIFFS = { relaxed: 25, easy: 40, normal: 60, hard: 100 };
const MIN_POOL = 20;   // Tools has no easy words at all; rather than refuse, offer its easiest ones

export function secretPool(m, { cat, band, diff }) {
  const [lo, hi] = BANDS[band] || BANDS.any;
  const pool = candidates(m, cat).filter(i => { const n = letters(m.words[i]); return n >= lo && n <= hi; });
  const score = i => m.hardOf.get(i) ?? 50;
  const cap = DIFFS[diff] ?? DIFFS.normal;
  const within = pool.filter(i => diff === 'hard' ? score(i) > DIFFS.normal : score(i) <= cap);
  if (within.length >= MIN_POOL) return within;
  return [...pool].sort((a, b) => diff === 'hard' ? score(b) - score(a) : score(a) - score(b)).slice(0, MIN_POOL);
}

export function pickSecret(m, opts) {
  const pool = secretPool(m, opts);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : -1;
}

// ── Hints ────────────────────────────────────────────────────────────────────────────────────────
// Contexto's rule, which is a good one: a hint is a word at HALF the rank of your best guess. Early on
// that is still far away and only points a direction; as you close in, hints close in with you. There
// is no limit, but once your best guess is rank 2 there is nothing left to hint at.
//
// Three additions of our own, all from testing this against the real data:
//  * a hint must be CLOSER than anything you already have. Aiming at half your best rank is not
//    enough on its own: once the words near that target have been used, the cheapest one left is
//    simply further away, and the ladder walks backwards. Measured with a best guess of rank 12,
//    `żółw` handed out 5, 9, 11, 12, 15, 16, 19, 24 - each hint worse than the last, and four of
//    them worse than the guess the player already had.
//  * prefer a word of a DIFFERENT part of speech than the secret. For `kot` that gives długowłosy,
//    oswojony, koci - clues rather than near-answers like `pies`.
//  * only offer words people actually know. Without this, `żółw` hints came back as `sumatrzański`
//    and `jukatański`: species-name geography, perfectly well ranked and completely useless.
const HINT_FIRST = 1000;     // where the first hint sits when nothing has landed yet
const HINT_COMMON = 12000;   // "a word people know": its place in the frequency list
export const HINT_FLOOR = 2; // no hints left once the best guess is this close

// Same word family: żółw/żółwi, wiatr/wiatru, kot/kotek, lekarz/lekarski. These rank at the very top
// and simply hand over the answer, so they can never be hints.
function related(a, b) {
  const x = fold(a), y = fold(b);
  const n = Math.min(4, x.length, y.length);
  return x.startsWith(y.slice(0, n)) || y.startsWith(x.slice(0, n));
}

export function hint(m, rank, secret, { best = 0, taken = [] } = {}) {
  // Aim at half the best rank, but never hand back something no better than the player already has.
  // The ceiling is what makes a hint a hint: every one is progress, and when there is no progress
  // left to give, none is offered rather than a worse word dressed up as help.
  const ceiling = best ? best - 1 : HINT_FIRST;
  if (ceiling < 1) return null;
  const target = Math.max(1, Math.floor((best || HINT_FIRST) / 2));
  const skip = new Set(taken);
  const pos = m.pos[secret];
  const word = m.words[secret];
  let pick = null, pickCost = Infinity;
  for (let i = 0; i < m.count; i++) {
    const r = rank[i];
    if (!r || r > ceiling || i === secret || skip.has(m.words[i])) continue;
    if (related(word, m.words[i])) continue;
    // the cost decides the winner: rare words are heavily penalised, same part of speech mildly
    const cost = Math.abs(r - target) + (i > HINT_COMMON ? 1000 : 0) + (m.pos[i] === pos ? 25 : 0);
    if (cost < pickCost) { pickCost = cost; pick = i; }
  }
  return pick === null ? null : { idx: pick, rank: rank[pick] };
}
