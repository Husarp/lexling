// Tests for the Letters mode rules in app/js/letters.js. Run: node tools/test-letters.mjs
import assert from 'node:assert/strict';
import { feedback, score } from '../app/js/letters.js';

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

// Polish letters are separate letters
check('ó is not o, ż is not z', feedback('zolw', 'żółw'), [_, _, _, G]);
check('marked letters match themselves', feedback('żółw', 'żółw'), [G, G, G, G]);

// ── score ────────────────────────────────────────────────────────────────────────────────────────
check('the worked example in PLAN.md: żółw, 3rd guess, Normal', score('żółw', 3, true, 'normal'), 292);
check('first-guess 5 letters on Easy', score('kotek', 1, true, 'easy'), 500);
check('a loss scores nothing', score('kotek', 6, false, 'easy'), 0);
check('Relaxed pays less', score('kotek', 2, true, 'relaxed'), 188);
check('Hard pays more', score('kotek', 2, true, 'hard'), 375);
check('fewer guesses, higher score', score('kotek', 2, true, 'easy') > score('kotek', 4, true, 'easy'), true);

console.log(`all ${passed} Letters tests passed`);
