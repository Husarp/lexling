// Builds app/data/ - the real word data - from the fastText vectors in tools/raw/ and the Hunspell
// dictionaries that ship with LibreOffice.          node tools/build-data.mjs [pl|en]
//
//   tools/raw/cc.pl.300.vec.gz, cc.en.300.vec.gz   from https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/
//
// Output format: DESIGN.md §2 "Data files". Every choice below that looks like a number was measured -
// see DESIGN.md §2 "OP words" for the experiment behind the scoring.
import { mkdirSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenRanks, vectorsOf, DIMS as D } from './fasttext.mjs';
import { polish, polishStandalone, english, POS } from './lexicon.mjs';
import { normalizeRows, allButTheTop } from './vecmath.mjs';
import { SEEDS, NEVER_SECRET, NOT_IN, KEEP, CATEGORIES } from './seeds.mjs';
import { fold } from '../app/js/engine.js';
import { LEN_MIN, LEN_MAX } from '../app/js/letters.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'data');
const NOUN = 0, VERB = 2;
const CFG = {
  pl: { word: /^[a-ząćęłńóśźż]{2,}$/, lexicon: polish, standalone: polishStandalone, foldForms: true, check: [['pies', 'kot', 'śruba'], ['krab', 'homar', 'organizacja'], ['lekarz', 'szpital', 'góra']] },
  en: { word: /^[a-z]{2,}$/, lexicon: english, standalone: () => [], foldForms: false, check: [['dog', 'cat', 'screw'], ['crab', 'lobster', 'humanity'], ['doctor', 'hospital', 'mountain']] },
};
const VOCAB_SIZE = 60000;        // guessable words (English has ~41k in total)
const OTHER = { pl: 'en', en: 'pl' };
const FOREIGN_RATIO = 4;         // see foreignWords()
const SECRET_WITHIN = 12000;     // the secret is a noun among the 12k most common words; "hard" = the rarer half of those
const CATEGORY_WITHIN = 30000;   // with a category as a hint, rarer nouns are fair game too
const CATEGORY_MIN = 0.42;       // a noun joins a category when its 3 closest examples average at least this cosine…
const CATEGORY_MARGIN = 0.04;    // …and beat the runner-up category by this much. Unsure words stay in "All" only.
const CATEGORY_SURE = 0.56;      // members this close become examples themselves in the second round
                                 // (0.50 let "school" drift from stationery to office/abstract words)

// The Polish dictionary lists some inflected forms as words of their own (czasu, miastem, samochody).
// A listed word that is also a plain inflection of another word becomes a form of it when
//  · it has no inflection of its own (pos "other") and the base is a common word: czasu → czas, but
//    od / bez / co stay, because their "bases" (oda, beza, ca) are rarities; or
//  · it is a real word of the same part of speech as a MORE common base: samochody → samochód, while the
//    verb żyć is not swallowed by the noun życie (whose genitive plural it spells).
// Mutual pairs (kot/kota, polityk/polityka, wino/wina) are different words: both stay.
const COMMON_BASE_RANK = 40000;
function foldListedForms(lex, rank) {
  const OTHER = POS.indexOf('other');
  const owner = new Map();
  for (const [lemma, e] of lex) for (const [form, derived] of e.forms) {
    const f = lex.get(form);
    if (derived || !f || f.forms.get(lemma) === false) continue;
    const ok = f.pos === OTHER ? rank.get(lemma) < COMMON_BASE_RANK : f.pos === e.pos && rank.get(lemma) < rank.get(form);
    if (ok && (!owner.has(form) || rank.get(lemma) < rank.get(owner.get(form)))) owner.set(form, lemma);
  }
  const target = w => { const seen = new Set(); while (owner.has(w) && !seen.has(w)) { seen.add(w); w = owner.get(w); } return w; };
  let folded = 0;
  for (const form of [...owner.keys()].sort((a, b) => rank.get(a) - rank.get(b))) {
    const to = target(form);
    if (to === form || !lex.has(form) || !lex.has(to)) continue;
    for (const [sub, derived] of lex.get(form).forms) if (!lex.get(to).forms.has(sub)) lex.get(to).forms.set(sub, derived);
    lex.get(to).forms.set(form, false);
    lex.delete(form);
    folded++;
  }
  return folded;
}

// A bad secret ruins a whole game, so the secret pool is stricter than the guessable vocabulary: a word
// that can be read as a plain inflection of another word is out (wody = woda, nowe = nowy, bez = beza) -
// unless its own paradigm is clearly alive: kot is spelled like a form of the rarity "kota", but kotem
// and kotów are all over the web while kotę / kotą are not.
function ambiguousSpellings(lex, rank) {
  const readAs = new Map();
  for (const [lemma, e] of lex) for (const [form, derived] of e.forms) if (!derived && lex.has(form)) (readAs.get(form) ?? readAs.set(form, []).get(form)).push(lemma);
  const own = (a, b) => [...lex.get(a).forms].filter(([f, derived]) => !derived && f !== b && rank.has(f) && !lex.get(b).forms.has(f)).length;
  const out = new Set();
  for (const [word, bases] of readAs) if (bases.some(b => { const mine = own(word, b); return mine < 2 || mine * 2 < own(b, word); })) out.add(word);
  return out;
}

// The Polish dictionary lists plenty of English ("the", "game", "love", "crawl"), and a Polish player
// typing "cra" should not be offered "crack, crawl, cracker, cracking". A word is treated as belonging
// to the other language when it has no inflected form of its own here AND the other language uses it
// several times more (by frequency rank). Borrowings that Polish really inflects - link, team, weekend,
// crack/cracka - keep their forms and stay, and so do common Polish words that English also has
// ("do", "jest", "ale", "pod"), because Polish uses them at least as much.
function foreignWords(lex, rank, otherRank, lang) {
  const keep = new Set(KEEP[lang].split(' ').filter(Boolean));
  const out = new Set();
  for (const [word, e] of lex) {
    const theirs = otherRank.get(word);
    if (theirs === undefined || keep.has(word)) continue;
    if (rank.get(word) > theirs * FOREIGN_RATIO && ![...e.forms.keys()].some(f => rank.has(f))) out.add(word);
  }
  return out;
}

// mean and standard deviation of cos(word i, s) over all possible secrets s - exact, in O(n·d²)
function poolStats(x, n, pool) {
  const mu = new Float64Array(D), C = new Float64Array(D * D);
  for (const s of pool) {
    const o = s * D;
    for (let a = 0; a < D; a++) { const xa = x[o + a]; mu[a] += xa; for (let b = a; b < D; b++) C[a * D + b] += xa * x[o + b]; }
  }
  for (let a = 0; a < D; a++) { mu[a] /= pool.length; for (let b = a; b < D; b++) C[b * D + a] = C[a * D + b] /= pool.length; }
  const mean = new Float32Array(n), sd = new Float32Array(n), t = new Float64Array(D);
  for (let i = 0; i < n; i++) {
    const o = i * D;
    let m = 0, q = 0;
    for (let a = 0; a < D; a++) { m += x[o + a] * mu[a]; let s = 0; for (let b = 0; b < D; b++) s += C[a * D + b] * x[o + b]; t[a] = s; }
    for (let a = 0; a < D; a++) q += x[o + a] * t[a];
    mean[i] = m;
    sd[i] = Math.sqrt(Math.max(q - m * m, 1e-6));
  }
  return { mean, sd };
}

const cosine = (x, a, b) => { let s = 0; for (let k = 0; k < D; k++) s += x[a * D + k] * x[b * D + k]; return s; };

// How hard a word is to corner, 0-100, from two things a player actually feels:
//  * rarity - where the word sits in the frequency list;
//  * isolation - how far its nearest neighbours are. A word in a crowded neighbourhood (kot: kotek,
//    kocur, pies…) can be closed in on; a lonely one (sens, los) leaves guesses hovering.
// Neighbours are looked for among the NEIGHBOUR_POOL most common words - the ones a player would
// actually type - which keeps this an O(secrets × 20k × 300) pass instead of an all-pairs one.
const NEIGHBOURS = 10, NEIGHBOUR_POOL = 12000;   // 20k took 6 min/language for no visible gain

function difficulty(x, idx, n, words) {
  const pool = Math.min(n, NEIGHBOUR_POOL);
  const isolation = new Float64Array(idx.length);
  idx.forEach((s, at) => {
    const top = new Float64Array(NEIGHBOURS);          // the NEIGHBOURS highest cosines, ascending
    for (let i = 0; i < pool; i++) {
      if (i === s) continue;
      let c = 0;
      for (let k = 0, o = i * D, p = s * D; k < D; k++) c += x[o + k] * x[p + k];
      if (c <= top[0]) continue;
      let j = 0;
      while (j < NEIGHBOURS - 1 && c > top[j + 1]) { top[j] = top[j + 1]; j++; }
      top[j] = c;
    }
    isolation[at] = -top.reduce((a, b) => a + b, 0) / NEIGHBOURS;   // lonelier = higher
  });
  // each half scored as a percentile, so the two scales combine fairly
  const rank = arr => { const order = [...arr.keys()].sort((a, b) => arr[a] - arr[b]); const out = new Float64Array(arr.length); order.forEach((i, p) => { out[i] = p / (arr.length - 1 || 1); }); return out; };
  const rare = rank(Float64Array.from(idx));           // words are listed most-common-first
  const lonely = rank(isolation);
  const score = idx.map((_, i) => Math.round((rare[i] + lonely[i]) / 2 * 100));
  const show = [...score.keys()].sort((a, b) => score[b] - score[a]);
  return { idx, score, hardest: show.slice(0, 10).map(i => words[idx[i]]), easiest: show.slice(-10).map(i => words[idx[i]]) };
}

// A category full of kot, kotek, kociak, koteczka, kocur, kocurek is not twenty animals, it is five
// animals wearing hats. Polish makes a diminutive of almost anything, and they all sit in the same
// corner of the vector space as the plain word, so they all pass the category test - but as the
// ANSWER they are miserable: you have already typed the word, in the form everyone uses.
//
// So a member is dropped when the category already holds a shorter, more common word it is built
// from. Comparison is on folded spellings and needs only three characters to agree, because that is
// what rybka/ryba and ptaszek/ptak come down to. The shorter word is always the one kept.
// Matching on a plain prefix is not enough, because a Polish diminutive usually reshapes the stem:
// ryba → rybka, świnia → świnka, ptak → ptaszek. So the suffix is stripped first and what is left
// has to agree with the base to within two characters. Loosening the prefix rule instead would cost
// real words - at three characters `krowa` swallows `krokodyl`.
// Polish diminutives and feminines (kotek, rybka, słonica), plus the few English endings that do the
// same job (duckling, piglet, lioness). English compounds - rainbow, snowfall - are deliberately not
// here: they are new words, not small versions of an old one.
const ENDINGS = 'uszek|aszek|iczek|eczka|uszka|atko|czek|eczek|ulec|unia|usia|ica|yca|ling|ette|ess|let|ek|ik|yk|ka|ko|us';
const DIMINUTIVE = new RegExp(`^(${ENDINGS})$`);
const DIMINUTIVE_END = new RegExp(`(${ENDINGS})$`);
function dropDerived(members, words) {
  const sorted = [...members].sort((a, b) => a.w - b.w);          // most common first
  const kept = [];
  for (const m of sorted) {
    const mine = fold(words[m.w]);
    const stripped = mine.replace(DIMINUTIVE_END, '');
    const derived = kept.some(k => {
      // no length guard is needed: `kept` is walked most-common-first, so the base is already the
      // word people actually use. Requiring it to be shorter kept świnia/świnka, both six letters.
      const base = fold(words[k.w]);
      if (base === mine) return false;
      // The tail has to be a diminutive ending, not just anything. English builds compounds from the
      // same parts - rain+bow, sun+shine, snow+fall - and a plain prefix test deleted all three.
      if (mine.length > base.length && mine.startsWith(base) && DIMINUTIVE.test(mine.slice(base.length))) return true;
      // no early return above: zajączek keeps the whole of zając and still needs the test below
      return stripped.length >= 3 && base.startsWith(stripped) && base.length - stripped.length <= 2;
    });
    if (!derived) kept.push(m);
  }
  return kept;
}

// Words in the list that are really an inflected form of another word in it: `ptaki` (ptak), `stara`
// (stary), `staje` (stawać), `kota` (kot), `loved` (love). foldListedForms() leaves them as words of
// their own on purpose - each has a paradigm of its own on the web - but a mode that promises to hide
// only base forms needs to know. The app cannot work this out: once a form is a word, the
// autocomplete list stops recording whose form it also is. So it is listed here, while every word's
// forms are still known.
//
// Guards, each from a real case:
//  - only a DIRECT inflection counts. Participles and gerunds are flagged "derived" by the lexicon, and
//    they are everyday words in their own right: without this, `życie` (life), `spotkanie` and
//    `znany` were thrown out as mere forms of verbs;
//  - a Polish adjective ending in -y/-i or a verb ending in -ć is already in dictionary shape, so it
//    is a base whatever else it happens to spell: `stary` is also a plural of the noun `star`,
//    `długi` of `dług`, and both are plainly base words;
//  - a base far rarer than the word is a dictionary artefact, not a base: `głupi` is technically a
//    form of the junk noun `głup` (#50 904), so a base more than 10× rarer does not count;
//  - two words can each be a form of the other - `kota` is a form of `kot`, and `kot` is the
//    genitive plural of `kota`. The shorter one is the real base, so it stays.
const FORM_BASE_RARER = 10;
const DICTIONARY_SHAPE = { pl: { adj: /[yi]$/, verb: /ć$/ }, en: {} };
function inflectedWords(lex, words, index, lang) {
  const bases = new Map();                                   // word index -> [base index, derived?][]
  for (const [lemma, e] of lex) {
    const li = index.get(lemma);
    if (li === undefined) continue;
    for (const [form, derived] of e.forms) {
      const fi = index.get(form);
      if (fi !== undefined && fi !== li) (bases.get(fi) ?? bases.set(fi, []).get(fi)).push([li, derived]);
    }
  }
  const shape = DICTIONARY_SHAPE[lang] || {};
  const out = [];
  for (const [fi, list] of bases) {
    const word = words[fi], len = [...word].length;
    const own = shape[POS[lex.get(word).pos]];
    if (own && own.test(word)) continue;
    const isForm = list.some(([li, derived]) => {
      if (derived || li > fi * FORM_BASE_RARER) return false;
      const base = words[li], baseLen = [...base].length;
      const mutual = lex.get(word).forms.has(base);
      if (mutual && (len < baseLen || (len === baseLen && fi < li))) return false;
      return true;
    });
    if (isForm) out.push(fi);
  }
  return out.sort((a, b) => a - b);
}

// Two rounds: the hand-picked seeds tag the clear cases, then those confident members serve as extra
// examples, which reaches the corners a short seed list cannot describe (dog breeds, kitchen tools…).
function categorize(x, pool, index, seeds) {
  const cats = Object.entries(seeds).map(([name, list]) => ({ name, seeds: list.split(' ').map(w => index.get(w)).filter(i => i !== undefined), members: [] }));
  for (const round of [1, 2]) {
    const examples = cats.map(c => new Set([...c.seeds, ...c.members.filter(m => m.score >= CATEGORY_SURE).map(m => m.w)]));
    for (const c of cats) c.members = [];
    for (const w of pool) {
      const scored = examples.map((ex, ci) => {
        if (cats[ci].seeds.includes(w)) return 1;
        const top = [0, 0, 0];
        for (const s of ex) { if (s === w) continue; let v = cosine(x, w, s); for (let k = 0; k < 3; k++) if (v > top[k]) [top[k], v] = [v, top[k]]; }
        return (top[0] + top[1] + top[2]) / 3;
      });
      const best = scored.indexOf(Math.max(...scored));
      const second = Math.max(...scored.filter((_, i) => i !== best));
      if (scored[best] >= CATEGORY_MIN && scored[best] - second >= CATEGORY_MARGIN) cats[best].members.push({ w, score: scored[best] });
    }
  }
  return cats;
}

async function build(lang) {
  const cfg = CFG[lang], log = (...a) => console.log(`[${lang}]`, ...a);
  const rank = await tokenRanks(lang, cfg.word);
  const lex = cfg.lexicon(rank);
  const ambiguous = ambiguousSpellings(lex, rank);   // before folding: folding removes the evidence
  const foreign = foreignWords(lex, rank, await tokenRanks(OTHER[lang], CFG[OTHER[lang]].word), lang);
  for (const w of foreign) lex.delete(w);
  log(`words that belong to ${OTHER[lang]}, dropped: ${foreign.size} · most common:`,
    [...foreign].sort((a, b) => rank.get(a) - rank.get(b)).slice(0, 18).join(' '));
  if (cfg.foldForms) log('listed inflected forms folded into their base word:', foldListedForms(lex, rank));
  const words = [...lex.keys()].sort((a, b) => rank.get(a) - rank.get(b)).slice(0, VOCAB_SIZE);
  const n = words.length, index = new Map(words.map((w, i) => [w, i]));

  const x = await vectorsOf(lang, words);
  normalizeRows(x, n, D); allButTheTop(x, n, D, 0); normalizeRows(x, n, D);   // unit length, centred

  const never = new Set([...NEVER_SECRET[lang].split(' '), ...ambiguous]);
  const nouns = [];
  for (let i = 0; i < Math.min(n, CATEGORY_WITHIN); i++) if (lex.get(words[i]).pos === NOUN && [...words[i]].length >= 3 && !never.has(words[i])) nouns.push(i);
  const secret = nouns.filter(i => i < SECRET_WITHIN);
  const { mean, sd } = poolStats(x, n, secret);

  const cats = categorize(x, nouns, index, SEEDS[lang]);
  for (const c of cats) {
    // a category's answers must be members of it, not words about it, and not the same word twice
    const banned = new Set((NOT_IN[lang]?.[c.name] || '').split(' ').filter(Boolean));
    const named = c.members.length;
    c.members = c.members.filter(m => !banned.has(words[m.w]));
    const afterBanned = c.members.length;
    c.members = dropDerived(c.members, words);
    log(`category ${c.name}: ${named} tagged -> ${afterBanned} after the blocklist -> ${c.members.length} after dropping diminutives`);
    c.members.sort((a, b) => a.w - b.w);
    const weakest = [...c.members].sort((a, b) => a.score - b.score).slice(0, 10).map(m => words[m.w]);
    log(`category ${c.name}: ${c.members.length} words · e.g. ${c.members.filter((_, i) => i % Math.ceil(c.members.length / 12) === 0).map(m => words[m.w]).join(' ')}`);
    log(`   weakest members: ${weakest.join(' ')}`);
  }
  // "verbs" is a part-of-speech category, not a meaning one: it cannot be found with example words.
  const verbs = [];
  for (let i = 0; i < Math.min(n, CATEGORY_WITHIN); i++) if (lex.get(words[i]).pos === VERB && [...words[i]].length >= 3 && !never.has(words[i])) verbs.push(i);
  cats.push({ name: 'verbs', members: verbs.map(w => ({ w })) });
  log(`category verbs: ${verbs.length} words · e.g. ${verbs.filter((_, i) => i % Math.ceil(verbs.length / 12) === 0).map(i => words[i]).join(' ')}`);

  // how hard each possible secret is - the "hardest word beaten" statistic reads this
  console.time(`[${lang}] difficulty`);
  const hardness = difficulty(x, [...new Set([...secret, ...cats.flatMap(c => c.members.map(m => m.w))])].sort((a, b) => a - b), n, words);
  console.timeEnd(`[${lang}] difficulty`);
  log('hardest words:', hardness.hardest.join(' '));
  log('easiest words:', hardness.easiest.join(' '));

  // autocomplete list: every word (priority 0) and every inflected form that the web actually uses
  // (1 = direct inflection, 2 = participle / gerund reading), sorted by folded spelling
  // Among equal readings a noun beats an adjective beats a verb (żółwie = żółw, not the adjective żółwi):
  // the base word's own frequency cannot decide, it is inflated by exactly these shared spellings.
  const ac = words.map((w, idx) => ({ k: fold(w), w, idx, pri: 0 }));
  for (let idx = 0; idx < n; idx++) for (const [form, derived] of lex.get(words[idx]).forms) {
    if (rank.has(form) && !index.has(form)) ac.push({ k: fold(form), w: form, idx, pri: (derived ? 20 : 10) + lex.get(words[idx]).pos });
  }
  ac.sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : a.pri - b.pri || a.idx - b.idx);

  const bin = new Int8Array(n * D);
  for (let i = 0; i < n; i++) {
    let max = 0;
    for (let k = i * D; k < (i + 1) * D; k++) max = Math.max(max, Math.abs(x[k]));
    for (let k = i * D; k < (i + 1) * D; k++) bin[k] = Math.round(x[k] / max * 127);
  }

  const dir = join(OUT, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'vectors.bin'), Buffer.from(bin.buffer));
  writeFileSync(join(dir, 'ac.txt'), ac.map(e => e.w).join('\n'));
  writeFileSync(join(dir, 'ac.bin'), Buffer.from(Uint32Array.from(ac, e => e.idx).buffer));
  // Words that are valid guesses in Letters only: the dictionary's stand-alone entries the list above
  // cannot place under a base word (pasę, poszedłem). Letters asks "is this a word?", never "whose
  // form is it?", so they need no index - and Guess never sees them. Only the lengths Letters plays.
  // English has none it lacks (its irregular forms are mapped in lexicon.mjs), so its file is empty.
  const known = new Set(ac.map(e => e.w));
  const extra = [...new Set(cfg.standalone())].filter(w => !known.has(w) && [...w].length >= LEN_MIN && [...w].length <= LEN_MAX).sort();
  writeFileSync(join(dir, 'extra.txt'), extra.join('\n'));
  writeFileSync(join(dir, 'vocab.json'), JSON.stringify({
    lang, dims: D, posNames: POS, words, pos: words.map(w => lex.get(w).pos).join(''), secret,
    cats: Object.fromEntries(cats.map(c => [c.name, c.members.map(m => m.w)])),
    hard: { idx: hardness.idx, score: hardness.score },
    hub: Array.from(mean, v => +v.toFixed(4)), spread: Array.from(sd, v => +v.toFixed(4)),
    // The hand-kept stoplist, so any mode that picks its own words can keep them out. `secret` and
    // the categories already exclude these, but Letters draws adjectives and adverbs too, which
    // nothing else filters.
    blocked: NEVER_SECRET[lang].split(' ').map(w => index.get(w)).filter(i => i !== undefined).sort((a, b) => a - b),
    formOf: inflectedWords(lex, words, index, lang),
  }));

  // report
  const tagged = cats.reduce((s, c) => s + c.members.length, 0);
  log(`guess-only words for Letters ${extra.length}: ${extra.filter(w => /^(pas[ęą]|poszedłem|szedłem|poszliśmy)$/.test(w)).join(' ')}`);
  log(`words ${n} · inflected forms ${ac.length - n} · possible secrets ${secret.length} (${tagged} in a category)`);
  log('most generic words (highest average similarity to the secrets - the z-score cancels exactly this):',
    [...mean.keys()].sort((a, b) => mean[b] - mean[a]).slice(0, 14).map(i => words[i]).join(' '));
  for (const [s, near, far] of cfg.check) {
    const si = index.get(s), score = i => (cosine(x, i, si) - mean[i]) / sd[i];
    const all = Array.from({ length: n }, (_, i) => score(i)), r = w => all.filter(v => v > score(index.get(w))).length;   // (secret itself counts as one above)
    log(`check  ${s}: ${near} → rank ${r(near)}, ${far} → rank ${r(far)} · closest: ${[...all.keys()].sort((a, b) => all[b] - all[a]).slice(1, 11).map(i => words[i]).join(' ')}`);
  }
  log('files:', readdirSync(dir).map(f => `${f} ${(statSync(join(dir, f)).size / 1048576).toFixed(1)} MB`).join(' · '));
  return n;
}

const only = process.argv[2];
const counts = {};
for (const lang of Object.keys(CFG)) if (!only || only === lang) counts[lang] = await build(lang);
if (!only) writeFileSync(join(OUT, 'index.json'), JSON.stringify({ dims: D, source: 'fastText cc.pl.300 / cc.en.300', counts }));
