// Tests for the Letters mode rules in app/js/letters.js. Run: node tools/test-letters.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { feedback, typeLetter, eraseLetter, skipTile, keyStates, known, hintAt } from '../app/js/letters.js';

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

// ── the on-screen keyboard (design v4): typing into the row, Backspace, the keys' colours ─────────
const row = s => [...s].map(ch => ch === '_' ? '' : ch), str = r => r.map(ch => ch || '_').join('');
const typed = (r, sel, ch) => { const o = typeLetter(row(r), sel, ch); return [str(o.row), o.sel, o.at]; };
const erased = (r, sel) => { const o = eraseLetter(row(r), sel); return [str(o.row), o.sel]; };
check('a letter fills the first gap', typed('st___', null, 'e'), ['ste__', null, 2]);
check('a gap in the middle is filled first', typed('st_el', null, 'e'), ['steel', null, 2]);
check('a full row takes no more letters', typed('steel', null, 'x'), ['steel', null, -1]);
check('a selected tile is replaced and the selection moves on', typed('stael', 2, 'e'), ['steel', 3, 2]);
check('the selection ends after the last tile', typed('steex', 4, 'l'), ['steel', null, 4]);
check('Backspace takes the last letter off', erased('st_el', null), ['st_e_', null]);
check('Backspace on an empty row does nothing', erased('_____', null), ['_____', null]);
check('Backspace on a selected letter empties it and keeps it selected', erased('steel', 2), ['st_el', 2]);
check('Backspace on a selected gap steps back and empties that', erased('st_el', 2), ['s__el', 1]);
check('Backspace on a selected first gap does nothing', erased('_teel', 0), ['_teel', 0]);
// Space (owner, 2026-09-25): leave a tile empty and move on
const spaced = (r, sel) => { const o = skipTile(row(r), sel); return [str(o.row), o.sel]; };
check('Space: the first gap stays empty, the next tile is selected', spaced('st___', null), ['st___', 3]);
check('Space, then a letter: it goes after the gap', (() => { const a = skipTile(row('_____'), null); const b = typeLetter(a.row, a.sel, 'a'); return [str(b.row), b.sel]; })(), ['_a___', 2]);
check('Space on a selected letter empties it and moves on', spaced('steel', 1), ['s_eel', 2]);
check('Space on the last tile: nothing selected after it', spaced('stee_', 4), ['stee_', null]);
check('Space on a full row with nothing selected does nothing', spaced('steel', null), ['steel', null]);
const keys = keyStates(['crane', 'sheet'], 'steel');
check('keys: the design\'s example - C R A N H out, S green, T yellow, E green', [keys.state.c, keys.state.h, keys.state.s, keys.state.t, keys.state.e], ['miss', 'miss', 'hit', 'near', 'hit']);
check('keys: SHEET has two green E - E is known to be in STEEL twice', keys.count.e, 2);
check('keys: PALMA against KASZA - two green A', keyStates(['palma'], 'kasza').count.a, 2);
check('keys: once green, a letter stays green', keyStates(['tacos', 'stack'], 'steal').state.t, 'hit');
check('keys: a letter only ever grey counts nothing', keyStates(['crane'], 'steel').count.c, undefined);
// letter by letter, in step with the row's tiles (owner, 2026-09-25): only the newest guess is partial
const half = keyStates(['crane', 'sheet'], 'steel', 1);   // SHEET's S and H have turned, the rest not yet
check('keys, part-way: S and H of the new row have their colours', [half.state.s, half.state.h], ['hit', 'miss']);
check('keys, part-way: E is still what CRANE said - yellow, once', [half.state.e, half.count.e], ['near', 1]);
check('keys, part-way: an older guess always counts in full', keyStates(['crane', 'sheet'], 'steel', 0).state.c, 'miss');
check('keys, all turned: the same as no limit', keyStates(['crane', 'sheet'], 'steel', 4), keyStates(['crane', 'sheet'], 'steel'));

// ── what the player knows, and hints (owner, 2026-09-25) ────────────────────────────────────────
const k1 = known(['crane', 'sheet'], 'steel');
check('known: S E E placed by SHEET, the rest empty', k1.slots.map(s => s.how ? s.ch : '_').join(''), 's_ee_');
const k2 = known(['crane', 'sheet'], 'steel', [4]);
check('known: a hint fills its slot, marked as a hint', [k2.slots[4].ch, k2.slots[4].how], ['l', 'hint']);
check('hint: never a letter already known', [0, .3, .6, .99].every(r => hintAt(['kxxxx'], 'kotek', [], () => r) > 0), true);
check('hint: half the word at most - 2 of 5', hintAt([], 'kotek', [0, 3]), -2);
// green letters count too (owner, 2026-09-25): 1 green + 1 hint of 5 is half; 3 greens of 5 - no hint at all
check('hint: green letters count toward the half', [hintAt(['kxxxx'], 'kotek', [], () => 0) >= 0, hintAt(['kxxxx'], 'kotek', [2])], [true, -2]);
check('hint: half the word green already - none', hintAt(['crane', 'sheet'], 'steel'), -2);
check('hint: nothing left to show', hintAt(['kotek'], 'kotek'), -1);
check('hint: before any guess, any position', hintAt([], 'kotek', [], () => .5), 2);

// ── which words can be hidden — against the real word data ──────────────────────────────────────
const ROOT = new URL('../app/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords: load } = await import('../app/js/engine.js');   // what Letters loads: no vectors
const { pool, difficulty } = await import('../app/js/letters.js');
const { offensiveWord, offensive } = await import('../app/js/offensive.js');
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
  // slurs and vulgar words, the data's stoplist or not (owner, 2026-09-25): offensive.js
  check(`${lang}: no slur or vulgar word is ever hidden`, all.some(i => offensiveWord(lang, m.words[i])), false);
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
check('mineta - missing from the data\'s stoplist - is never hidden', [6].some(len => ['relaxed', 'easy', 'normal', 'hard'].some(diff => has(pl, pool(pl, { len, diff }), 'mineta'))), false);
check('a slur typed as a guess is refused, its forms too', ['kurwa', 'kurwy', 'czarnuch', 'czarnuchy'].every(w => offensive(pl, w)), true);
check('an innocent word is not caught by a vulgar root', ['kurek', 'ruch', 'suknia', 'cygaro'].some(w => offensive(pl, w)), false);
check('zajebisty is on the stoplist, never hidden',
  ['relaxed', 'easy', 'normal', 'hard'].some(diff => has(pl, pool(pl, { len: 9, diff }), 'zajebisty')), false);

console.log(`all ${passed} Letters tests passed`);
