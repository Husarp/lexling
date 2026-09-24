// Tests for the Letters mode rules in app/js/letters.js. Run: node tools/test-letters.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { feedback, score, points } from '../app/js/letters.js';

const G = 'green', Y = 'yellow', _ = 'grey';
let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };

// ── feedback ─────────────────────────────────────────────────────────────────────────────────────
check('all right', feedback('kotek', 'kotek'), [G, G, G, G, G]);
check('nothing right', feedback('abcde', 'fghij'), [_, _, _, _, _]);
check('right letters, wrong places', feedback('tokek', 'kotek'), [Y, G, Y, G, G]);
check('case does not matter', feedback('KOT', 'kot'), [G, G, G]);

// the repeated-letter rule - the cases worth a test of their own
check('one e in the answer: only the green e counts', feedback('eerie', 'crane'), [_, _, Y, _, G]);
check('two a guessed, one in the answer: first yellow, second grey', feedback('aaxxx', 'plant'), [Y, _, _, _, _]);
check('greens use their letter up before yellows are handed out', feedback('lllll', 'hello'), [_, _, G, G, _]);
check('a leftover letter makes one yellow each', feedback('babes', 'abbey'), [Y, Y, G, G, _]);
// the owner's case (2026-09-25): with `ananas`, an `a` standing where the answer has an `a` is green -
// it is never turned yellow on the theory that it belongs to one of the other `a`s
check('ananas: every letter in its own place is green', feedback('granat', 'ananas'), [_, _, G, G, G, _]);
check('ananas: one a in place, the other a still yellow', feedback('atlasy', 'ananas'), [G, _, _, Y, Y, _]);
check('ananas: six a against three - the three in place green, the rest grey', feedback('aaaaaa', 'ananas'), [G, _, G, _, G, _]);
check('ananas: three a all out of place - all three yellow', feedback('panama', 'ananas'), [_, Y, Y, Y, _, Y]);

// Polish letters are separate letters
check('ó is not o, ż is not z', feedback('zolw', 'żółw'), [_, _, _, G]);
check('marked letters match themselves', feedback('żółw', 'żółw'), [G, G, G, G]);

// ── score ────────────────────────────────────────────────────────────────────────────────────────
check('the worked example in PLAN.md: żółw, 3rd guess, Normal', score('żółw', 3, true, 'normal'), 292);
check('first-guess 5 letters on Easy', score('kotek', 1, true, 'easy'), 500);
check('a loss scores nothing', score('kotek', 6, false, 'easy'), 0);
check('Relaxed pays less', score('kotek', 2, true, 'relaxed'), 188);
check('Hard pays more', score('kotek', 2, true, 'hard'), 375);
check('a marked letter counts as two', points('żółw'), 7);
check('fewer guesses, higher score', score('kotek', 2, true, 'easy') > score('kotek', 4, true, 'easy'), true);

// ── which words can be hidden — against the real word data ──────────────────────────────────────
const ROOT = new URL('../app/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords: load } = await import('../app/js/engine.js');   // what Letters loads: no vectors
const { pool, difficulty } = await import('../app/js/letters.js');
const has = (m, p, w) => p.some(i => m.words[i] === w);

for (const lang of ['pl', 'en']) {
  const m = await load(lang);
  const all = [];
  for (let len = 3; len <= 13; len++) for (const diff of ['relaxed', 'easy', 'normal', 'hard']) {
    const p = pool(m, { len, diff });
    check(`${lang} ${len} letters ${diff}: never empty`, p.length >= 20, true);
    check(`${lang} ${len} letters ${diff}: every word has ${len} letters`, p.every(i => [...m.words[i]].length === len), true);
    all.push(...p);
  }
  const blocked = new Set(m.blocked), formOf = new Set(m.formOf);
  check(`${lang}: nothing on the stoplist is ever hidden`, all.some(i => blocked.has(i)), false);
  check(`${lang}: no inflected form posing as a word is ever hidden`, all.some(i => formOf.has(i)), false);
  check(`${lang}: difficulty is 0-100`, all.every(i => difficulty(m, i) >= 0 && difficulty(m, i) <= 100), true);

  const avg = p => p.reduce((s, i) => s + difficulty(m, i), 0) / p.length;
  check(`${lang}: Hard is harder than Relaxed`, avg(pool(m, { len: 5, diff: 'hard' })) > avg(pool(m, { len: 5, diff: 'relaxed' })), true);

  // any length: one pool over 3-13, drawn like real words - lengths come up as often as words of them
  // exist. (Hard words run longer, so the 5-9 share is checked where the words are everyday ones.)
  for (const diff of ['relaxed', 'normal', 'hard']) {
    const any = pool(m, { diff });
    const lens = any.map(i => [...m.words[i]].length);
    check(`${lang} any length ${diff}: 3 to 13 letters only`, lens.every(n => n >= 3 && n <= 13), true);
    check(`${lang} any length ${diff}: a real pool`, any.length >= 500, true);
    if (diff !== 'hard') check(`${lang} any length ${diff}: mostly 5-9 letters, like the words themselves`, lens.filter(n => n >= 5 && n <= 9).length / lens.length > 0.6, true);
  }
  const animals = new Set(m.cats.animals);
  check(`${lang}: a category game hides only that category`, pool(m, { len: 5, cat: 'animals' }).every(i => animals.has(i)), true);
}

const pl = await load('pl');
// irregular forms the dictionary lists on their own are valid Letters guesses (asked 2026-09-25)
check('pasę, pasą, poszedłem, szedłem, poszliśmy are guessable', ['pasę', 'pasą', 'poszedłem', 'szedłem', 'poszliśmy'].every(w => pl.extra.has(w)), true);
check('the guess-only list holds only Letters lengths', [...pl.extra].every(w => [...w].length >= 3 && [...w].length <= 13), true);
const plForms = new Set(pl.ac);
check('the guess-only list repeats nothing the main list already has', [...pl.extra].some(w => plForms.has(w)), false);
const MARKS = /[ąćęłńóśźż]/;
check('Polish letters off: none in any hidden word', [5, 8, 12].every(len => pool(pl, { len, marks: false }).every(i => !MARKS.test(pl.words[i]))), true);
check('Polish letters on: they can appear', pool(pl, { len: 5 }).some(i => MARKS.test(pl.words[i])), true);
// the leaks that prompted formOf, and the real bases they must not take down with them
const pl5 = [4, 5].flatMap(len => ['relaxed', 'easy', 'normal', 'hard'].flatMap(diff => pool(pl, { len, diff })));
check('ptaki, stara, kota are inflected forms, never hidden', ['ptaki', 'stara', 'kota'].some(w => has(pl, pl5, w)), false);
check('ptak and stary, their bases, can still be hidden', ['ptak', 'stary'].every(w => has(pl, pl5, w)), true);
check('zajebisty is on the stoplist, never hidden',
  ['relaxed', 'easy', 'normal', 'hard'].some(diff => has(pl, pool(pl, { len: 9, diff }), 'zajebisty')), false);

console.log(`all ${passed} Letters tests passed`);
