// Tests for the Connect mode rules in app/js/connect.js, against the real word data.
// Run: node tools/test-connect.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('../app/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords } = await import('../app/js/engine.js');
const { makePuzzle, RANGE, cellsOf, visible, isDone, nextHint, judge, solved, doneWords } = await import('../app/js/connect.js');
const { pool } = await import('../app/js/letters.js');
const { offensive } = await import('../app/js/offensive.js');

let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
// the same games every run
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Everything a board must be: every letter of every word on the grid where it says; crossings agree;
// every run of two or more letters, across or down, is one of the board's words (nothing accidental);
// all words joined into one piece; each word made from the circle's letters; one uses them all.
function sound(p) {
  const { board, ring } = p, cells = new Map();
  for (const x of board.words) cellsOf(x).forEach((k, i) => {
    const ch = [...x.w][i];
    if (cells.has(k) && cells.get(k) !== ch) throw new Error(`clash at ${k} in ${x.w}`);
    cells.set(k, ch);
    const [r, c] = k.split('-').map(Number);
    if (r < 1 || c < 1 || r > board.rows || c > board.cols) throw new Error(`${x.w} leaves the board`);
  });
  const runs = [];
  for (const d of ['a', 'd']) {
    for (let line = 1; line <= (d === 'a' ? board.rows : board.cols); line++) {
      let run = '', start = 0;
      const end = (d === 'a' ? board.cols : board.rows) + 1;
      for (let i = 1; i <= end; i++) {
        const ch = i < end ? cells.get(d === 'a' ? `${line}-${i}` : `${i}-${line}`) : undefined;
        if (ch) { if (!run) start = i; run += ch; }
        else { if ([...run].length > 1) runs.push({ w: run, r: d === 'a' ? line : start, c: d === 'a' ? start : line, d }); run = ''; }
      }
    }
  }
  const key = x => `${x.w}@${x.r},${x.c},${x.d}`;
  const onBoard = new Set(board.words.map(key));
  for (const run of runs) if (!onBoard.has(key(run))) throw new Error(`accidental word ${run.w}`);
  if (runs.length !== board.words.length) throw new Error('a board word is not a run of its own');
  // one piece: words meet at shared cells
  const seen = new Set([0]), stack = [0];
  while (stack.length) {
    const a = stack.pop(), ca = new Set(cellsOf(board.words[a]));
    board.words.forEach((x, b) => { if (!seen.has(b) && cellsOf(x).some(k => ca.has(k))) { seen.add(b); stack.push(b); } });
  }
  if (seen.size !== board.words.length) throw new Error('the board is in pieces');
  const have = [...ring].sort().join('');
  for (const x of board.words) {
    const left = [...ring];
    for (const ch of x.w) { const i = left.indexOf(ch); if (i < 0) throw new Error(`${x.w} is not made from ${ring}`); left.splice(i, 1); }
  }
  if (!board.words.some(x => [...x.w].sort().join('') === have)) throw new Error('no word uses every letter');
  return true;
}

const MARKS = /[ąćęłńóśźż]/;
for (const lang of ['pl', 'en']) {
  const m = await loadWords(lang);
  const common = new Set();
  for (let len = 3; len <= 7; len++) for (const i of pool(m, { len, diff: 'random' })) common.add(m.words[i]);
  // every board-worthy word by its letters, sorted: the words that use a whole circle
  const sorted = w => [...w].sort().join(''), byLetters = new Map();
  for (const w of common) byLetters.set(sorted(w), [...(byLetters.get(sorted(w)) || []), w]);
  for (const letters of [4, 5, 6, 7]) for (const diff of ['relaxed', 'easy', 'normal', 'hard']) for (const marks of lang === 'pl' ? [false, true] : [true]) {
    const rand = seeded(letters * 100 + diff.length * 7 + (marks ? 1 : 0));
    const t0 = performance.now();
    let made = 0, words = 0, widest = 0, tallest = 0;
    for (let g = 0; g < 25; g++) {
      const p = makePuzzle(m, { letters, diff, marks, rand });
      if (!p) continue;
      made++;
      sound(p);
      const n = p.board.words.length;
      if (n < RANGE[letters][0] || n > RANGE[letters][1]) throw new Error(`${n} words for ${letters} letters`);
      if (!p.board.words.every(x => common.has(x.w))) throw new Error('a board word that is not a common base word');
      if (!marks && MARKS.test(p.ring)) throw new Error('Polish letters in the circle with the switch off');
      if ([...p.ring].length !== letters) throw new Error('circle size');
      if (p.board.words.some(x => offensive(m, x.w))) throw new Error('an offensive word on the board');
      // a base word that uses every letter is always on the board, however rare (owner, 2026-09-25)
      const onBoard = new Set(p.board.words.map(x => x.w));
      for (const w of byLetters.get(sorted(p.ring)) || []) if (!onBoard.has(w)) throw new Error(`${w} uses every letter of ${p.ring} but is not on the board`);
      words += n; widest = Math.max(widest, p.board.cols); tallest = Math.max(tallest, p.board.rows);
    }
    const ms = (performance.now() - t0) / 25;
    const label = `${lang} ${letters} letters ${diff}${lang === 'pl' ? (marks ? ' ą-ż' : ' plain') : ''}`;
    check(`${label}: every game gets a puzzle`, made, 25);
    check(`${label}: boards no bigger than 10 across, 8 down`, widest <= 10 && tallest <= 8, true);
    check(`${label}: quick (${ms.toFixed(0)} ms a puzzle)`, ms < 250, true);
    console.log(`  ${label.padEnd(30)} ${(words / made).toFixed(1)} words avg, largest ${widest} × ${tallest}, ${ms.toFixed(1)} ms`);
  }
}

// ── hints, "done", judging - on a fixed board: KARTON across, KORA and TRON down from it ──
// row 1: K A R T O N ; KORA down from the K (col 1), TRON down from the T (col 4)
const board = { cols: 6, rows: 4, words: [{ w: 'karton', r: 1, c: 1, d: 'a' }, { w: 'kora', r: 1, c: 1, d: 'd' }, { w: 'tron', r: 1, c: 4, d: 'd' }] };
check('cells of a word across', cellsOf(board.words[0]), ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6']);
check('cells of a word down', cellsOf(board.words[1]), ['1-1', '2-1', '3-1', '4-1']);
// nothing found: the hint goes to the shortest word (all show 0 letters) - KORA or TRON, 4 letters; the first of them
check('first hint: the shortest unfinished word, its first letter', nextHint(board, [], []), { word: 'kora', cell: '1-1' });
// KARTON found: KORA and TRON each show 1 letter (their first, through KARTON) - a press skips it
check('a hint skips a letter already showing through a crossing word', nextHint(board, ['karton'], []), { word: 'kora', cell: '2-1' });
check('a chosen word gets the hint', nextHint(board, ['karton'], [], 'tron'), { word: 'tron', cell: '2-4' });
check('repeated hints stay on the word showing the most', nextHint(board, ['karton'], ['2-4']), { word: 'tron', cell: '3-4' });
const vis = visible(board, ['karton'], ['2-4', '3-4', '4-4']);
check('a word whose letters all show is done - finished by hints', isDone(board.words[2], ['karton'], vis), true);
check('...and counts toward the board', doneWords(board, ['karton'], ['2-4', '3-4', '4-4']).length, 2);
check('not solved while a word is left', solved(board, ['karton'], ['2-4', '3-4', '4-4']), false);
check('solved when every word is done', solved(board, ['karton', 'kora'], ['2-4', '3-4', '4-4']), true);
check('no hint once everything is done', nextHint(board, ['karton', 'kora', 'tron'], []), null);

const pl = await loadWords('pl');
const state = { found: ['karton'], shown: [], bonus: ['kot'] };
check('judge: under 3 letters', judge(pl, board, state, 'ok'), 'short');
check('judge: a board word, new', judge(pl, board, state, 'kora'), 'found');
check('judge: a board word already found', judge(pl, board, state, 'karton'), 'again');
check('judge: another real word is a bonus', judge(pl, board, state, 'krata'), 'bonus');
check('judge: a Polish form is a bonus too', judge(pl, board, state, 'kotka'), 'bonus');
check('judge: a bonus word twice', judge(pl, board, state, 'kot'), 'bonusAgain');
check('judge: not a word', judge(pl, board, state, 'ntrak'), 'none');

// slurs and vulgar words: never on the board, never a bonus (owner, 2026-09-25) - their forms and compounds too
check('offensive: a vulgar word is not a bonus', judge(pl, board, state, 'kurwa'), 'none');
check('offensive: nor its forms', judge(pl, board, state, 'kurwy'), 'none');
check('offensive: nor a word built on its root', judge(pl, board, state, 'wkurwiony'), 'none');
check('offensive: the word a Hard board once used', judge(pl, board, state, 'mineta'), 'none');
const en = await loadWords('en');
check('offensive: an English slur is not a bonus', judge(en, board, state, 'faggot'), 'none');
check('offensive: nor its plural', judge(en, board, state, 'bitches'), 'none');
check('offensive: an innocent word that starts the same still counts', judge(en, board, state, 'niggle'), 'bonus');
check('offensive: an everyday word from the data stoplist still counts', judge(en, board, state, 'then'), 'bonus');

console.log(`all ${passed} Connect tests passed`);
