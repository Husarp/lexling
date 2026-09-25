// Tests for Kafelki / Tiles: the rules (app/js/tiles.js), the word graph (app/js/dawg.js) and the move
// finder (app/js/tiles-moves.js), against the real word data.
// Run: node tools/test-tiles.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('../app/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords, resolve } = await import('../app/js/engine.js');
const { buildDawg, has, toBytes, fromBytes } = await import('../app/js/dawg.js');
const T = await import('../app/js/tiles.js');
const { findMoves, computerMove, LEVELS } = await import('../app/js/tiles-moves.js');
const { BOARDS, sizeOf, premiums, letterSet, fullBag, tileWords, newGame, placementError, wordsMade, checkMove,
  play, exchange, pass, resign, canExchange, RACK, BINGO, BLANK } = T;

let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ── boards ──
const tally = rows => [...rows.join('')].reduce((o, ch) => (ch === '.' ? o : { ...o, [ch]: (o[ch] || 0) + 1 }), {});
check('classic: 8 T, 17 D, 12 t, 24 d', tally(BOARDS.classic.rows), { T: 8, d: 24, D: 17, t: 12 });
check('quick: 4 T, 9 D, 8 t, 16 d', tally(BOARDS.quick.rows), { T: 4, d: 16, D: 9, t: 8 });
check('bonus: 8 T, 12 D, 16 t, 28 d', tally(BOARDS.bonus.rows), { t: 16, d: 28, D: 12, T: 8 });
for (const [id, b] of Object.entries(BOARDS)) {
  const n = b.rows.length, at = (r, c) => b.rows[r][c];
  check(`${id}: square`, b.rows.every(row => row.length === n) && n % 2 === 1, true);
  let sym = true;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = at(r, c);
    if (v !== at(c, r) || v !== at(n - 1 - r, c) || v !== at(r, n - 1 - c)) sym = false;
  }
  check(`${id}: symmetrical both ways and across the diagonals`, sym, true);
}
check('classic centre is a double word', premiums('classic')[112], 'D');
check('bonus centre has no bonus', premiums('bonus')[112], '.');
check('classic: the original layout, row 0', BOARDS.classic.rows[0], 'T..d...T...d..T');

// ── letter sets ──
for (const lang of ['pl', 'en']) {
  check(`${lang}: 100 tiles`, fullBag(lang, 'classic').length, 100);
  check(`${lang}: two blanks`, fullBag(lang, 'classic').filter(t => t === BLANK).length, 2);
}
check('pl: 32 letters', letterSet('pl').letters.length, 32);
check('pl values', ['a', 'y', 'ł', 'ó', 'ć', 'ń', 'ź'].map(ch => letterSet('pl').values[ch]), [1, 2, 3, 5, 6, 7, 9]);
check('en values', ['e', 'd', 'b', 'f', 'k', 'x', 'q'].map(ch => letterSet('en').values[ch]), [1, 2, 3, 4, 5, 8, 10]);
check('quick bag: half, rounded up - pl 60, en 54', [fullBag('pl', 'quick').length, fullBag('en', 'quick').length], [60, 54]);
check('quick bag keeps every letter', new Set(fullBag('pl', 'quick')).size, 33);

// ── the word graph ──
{
  const d = buildDawg(['kot', 'kota', 'koty', 'pies', 'psy', 'kot', 'xyz'], 'kotaypies');
  check('graph: words in', ['kot', 'kota', 'koty', 'pies', 'psy'].map(w => has(d, w)), [true, true, true, true, true]);
  check('graph: words out', ['ko', 'kotx', 'pie', 'xyz', ''].map(w => has(d, w)), [false, false, false, false, false]);
  check('graph: duplicates once, foreign letters left out', d.words, 5);
  const back = fromBytes(toBytes(d).buffer);
  check('graph: bytes and back', ['kot', 'kota', 'psy', 'ps'].map(w => has(back, w)), [true, true, true, false]);
}

const dicts = {}, lexes = {};
for (const lang of ['pl', 'en']) {
  const m = lexes[lang] = await loadWords(lang);
  const words = tileWords(m);
  const t0 = performance.now();
  const d = dicts[lang] = fromBytes(toBytes(buildDawg(words, letterSet(lang).letters)).buffer);
  console.log(`${lang}: ${words.length} words -> ${d.final.length} nodes, ${d.letter.length} edges, ` +
    `${Math.round(toBytes(d).byteLength / 1024)} KB, built in ${Math.round(performance.now() - t0)} ms`);
  check(`${lang}: every word in the graph`, words.every(w => has(d, w)), true);
  check(`${lang}: nothing else`, d.words, words.length);
}
check('pl: inflected forms are words', ['kotem', 'psami', 'zrobiłem', 'pasę'].map(w => has(dicts.pl, w)), [true, true, true, true]);
check('pl: no slurs or vulgar words, forms included', ['kurwa', 'kurwy', 'chuj', 'mineta', 'minetą'].map(w => has(dicts.pl, w)), [false, false, false, false, false]);
check('en: no slurs, forms included', ['fuck', 'fucking', 'bitches', 'nigger'].map(w => has(dicts.en, w)), [false, false, false, false]);
check('no one-letter words', [has(dicts.en, 'a'), has(dicts.pl, 'w')], [false, false]);
check('pl: words with q, v, x left out (no such tiles)', has(dicts.pl, 'ex'), false);

// ── placing tiles ──
const en = (board = 'classic') => ({ ...newGame({ lang: 'en', board, rand: seeded(1) }), racks: [['c', 'a', 't', 's', 'e', 'r', BLANK], ['d', 'o', 'g', 'e', 'x', 'i', 'n']] });
const isEn = w => has(dicts.en, w);
const row = (r, c, word, blanks = []) => [...word].map((ch, i) => ({ r, c: c + i, ch, blank: blanks.includes(i) }));
const col = (r, c, word, blanks = []) => [...word].map((ch, i) => ({ r: r + i, c, ch, blank: blanks.includes(i) }));
{
  const s = en();
  check('error: nothing placed', placementError(s, []), 'none');
  check('error: not on the rack', placementError(s, row(7, 6, 'dog')), 'rack');
  check('error: outside', placementError(s, [{ r: 7, c: 15, ch: 'c' }, { r: 7, c: 14, ch: 'a' }]), 'outside');
  check('error: two on one square', placementError(s, [{ r: 7, c: 7, ch: 'c' }, { r: 7, c: 7, ch: 'a' }]), 'taken');
  check('error: not in a line', placementError(s, [{ r: 7, c: 7, ch: 'c' }, { r: 8, c: 8, ch: 'a' }]), 'line');
  check('error: a gap', placementError(s, [{ r: 7, c: 7, ch: 'c' }, { r: 7, c: 9, ch: 'a' }]), 'gap');
  check('error: first move misses the centre', placementError(s, row(3, 3, 'cat')), 'centre');
  check('error: first word of one letter', placementError(s, [{ r: 7, c: 7, ch: 'a' }]), 'single');
  check('first move across the centre', placementError(s, row(7, 5, 'cat')), null);
  check('first move down the centre', placementError(s, col(6, 7, 'cat')), null);
  check('a blank from the rack', placementError(s, row(7, 7, 'cab', [2])), null);
  check('two blanks, only one on the rack', placementError(s, row(7, 7, 'cxb', [1, 2])), 'rack');

  // CAT on the centre row from the centre: C 3 + A 1 + T 1 = 5, the centre doubles it: 10
  check('score: first word, centre doubles', checkMove(s, row(7, 7, 'cat'), isEn).score, 10);
  check('score: a blank is worth 0', checkMove(s, row(7, 7, 'cat', [0]), isEn).score, 4);
  check('unknown word', checkMove(s, row(7, 7, 'cta'), isEn), { error: 'word', bad: ['cta'] });
  const s2 = play(s, row(7, 7, 'cat'), isEn);
  check('play: score added', s2.scores, [10, 0]);
  check('play: rack refilled from the bag', [s2.racks[0].length, s2.bag.length], [7, s.bag.length - 3]);
  check('play: turn passes on', s2.turn, 1);
  check('play: the old state untouched', [s.cells[112], s.scores[0], s.racks[0].length], [null, 0, 7]);
  check('play: tiles on the board', [s2.cells[112], s2.cells[113], s2.cells[114]], [{ ch: 'c' }, { ch: 'a' }, { ch: 't' }]);
  check('play: history', s2.moves[0], { p: 0, kind: 'play', placed: row(7, 7, 'cat'), words: [{ w: 'cat', score: 10 }], score: 10, bingo: false });

  const s3 = { ...s2, racks: [s2.racks[0], ['d', 'o', 'g', 's', 'x', 'i', 'n']] };
  check('error: touches nothing', placementError(s3, row(2, 2, 'dog')), 'alone');
  check('error: a gap over empty squares', placementError(s3, [{ r: 6, c: 9, ch: 'o' }, { r: 4, c: 9, ch: 'd' }]), 'gap');
  // DOGS down column 10 from (4,10), its S after CAT making CATS
  // DOGS: D (4,10) is a double word, O G plain, S plain = (2 + 1 + 2 + 1) × 2 = 12; CATS = 3 + 1 + 1 + 1 = 6
  const dogs = col(4, 10, 'dogs');
  check('two words at once', wordsMade(s3, dogs).words.map(x => [x.w, x.score]), [['dogs', 12], ['cats', 6]]);
  check('two words: the total', checkMove(s3, dogs, isEn).score, 18);
  // one tile, S after CAT: the word across only
  check('one tile: its word', wordsMade(s3, [{ r: 7, c: 10, ch: 's' }]).words.map(x => x.w), ['cats']);
  // one tile below A: AX down - A 1 + X 8 doubled by the double letter under it = 17
  check('(8,8) is a double letter', premiums('classic')[8 * 15 + 8], 'd');
  check('one tile down, on a double letter', wordsMade(s3, [{ r: 8, c: 8, ch: 'x' }]).words.map(x => [x.w, x.score]), [['ax', 17]]);
}
{
  // A full rack down: +50. The rack C A T S E R ? makes CASTERS, the blank as the last S
  const s = en();
  const move = row(7, 4, 'casters', [6]);
  const got = checkMove(s, move, isEn);
  // C3 A1 S1 T1 E1 R1 blank 0 = 8; (7,7) doubles: 16; (7,3)? not covered. + 50
  check('bingo: all seven tiles +50', got.score, 16 + BINGO);
}

// ── exchanging, passing, the end ──
{
  const s = en();
  const x = exchange(s, ['c', 'a'], seeded(2));
  check('exchange: rack stays full, bag the same size', [x.racks[0].length, x.bag.length], [7, s.bag.length]);
  check('exchange: turn passes, nothing scored', [x.turn, x.scores[0], x.zeros], [1, 0, 1]);
  check('exchange: not tiles you lack', exchange(s, ['z'], seeded(2)), null);
  check('exchange: not with fewer than 7 in the bag', exchange({ ...s, bag: s.bag.slice(0, 6) }, ['c']), null);
  check('canExchange', [canExchange(s), canExchange({ ...s, bag: ['a'] })], [true, false]);
  let p = s;
  for (let i = 0; i < 3; i++) p = pass(p);
  check('three passes: still on', p.over, null);
  p = pass(p);
  const left = s.racks.map(r => r.reduce((t, ch) => t + T.valueOf('en', ch), 0));
  check('every player passing twice ends it; leftovers lost', [p.over.reason, p.scores], ['passes', [-left[0], -left[1]]]);
  check('ended by passes: the higher score wins', p.over.winner, left[0] < left[1] ? 0 : left[0] > left[1] ? 1 : -1);
  const r = resign(s);
  check('resign: the other player wins', [r.over.reason, r.over.winner, r.over.by], ['resign', 1, 0]);
  // going out: an empty bag, the whole rack down
  const out = { ...s, bag: [], racks: [['c', 'a', 't'], ['d', 'o', 'g', 'x']] };
  const done = play(out, row(7, 7, 'cat'), isEn);
  const dogx = 2 + 1 + 2 + 8;
  check('going out: the others\' leftovers added, theirs taken off', [done.over.reason, done.scores, done.over.adjust], ['out', [10 + dogx, -dogx], [dogx, -dogx]]);
  check('going out: winner', done.over.winner, 0);
}

// ── the move finder, against a search through every possible placement ──
// Slow and simple: every run of 1+ rack tiles laid from every empty square, across and down, kept when
// checkMove says it is a legal move. The finder must find exactly these, and score them the same.
function everyMove(state, isWord) {
  const n = sizeOf(state.board), rack = state.racks[state.turn], found = new Map();
  const walk = (dir, r, c, placed, left) => {
    if (r >= n || c >= n) return;
    const [dr, dc] = dir;
    if (state.cells[r * n + c]) return walk(dir, r + dr, c + dc, placed, left);
    for (const t of new Set(left)) {
      const rest = [...left]; rest.splice(rest.indexOf(t), 1);
      for (const ch of t === BLANK ? letterSet(state.lang).letters : t) {
        const p = [...placed, { r, c, ch, blank: t === BLANK }];
        const got = checkMove(state, p, isWord);
        if (!got.error) found.set(key(p), got.score);
        if (rest.length) walk(dir, r + dr, c + dc, p, rest);
      }
    }
  };
  for (const dir of [[0, 1], [1, 0]]) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!state.cells[r * n + c]) walk(dir, r, c, [], rack);
  }
  return found;
}
const key = placed => placed.map(t => `${t.r},${t.c},${t.ch}${t.blank ? '?' : ''}`).sort().join(' ');
function agree(name, state, lang) {
  const isWord = w => has(dicts[lang], w);
  const slow = everyMove(state, isWord);
  const fast = new Map();
  for (const m of findMoves(state, dicts[lang])) {
    const k = key(m.placed);
    if (fast.has(k)) throw new Error(`${name}: found twice: ${k}`);
    fast.set(k, m.score);
  }
  const missing = [...slow.keys()].filter(k => !fast.has(k)), extra = [...fast.keys()].filter(k => !slow.has(k));
  const wrong = [...fast].filter(([k, v]) => slow.has(k) && slow.get(k) !== v);
  check(`${name}: ${slow.size} moves, none missing`, missing.slice(0, 3), []);
  check(`${name}: nothing illegal`, extra.slice(0, 3), []);
  check(`${name}: same scores`, wrong.slice(0, 3), []);
  console.log(`${name}: the finder and the slow search agree on all ${slow.size} moves`);
}
// a game some turns in, the computer playing both sides
function midGame(lang, board, turns, seed) {
  const rand = seeded(seed);
  let s = newGame({ lang, board, rand });
  const isWord = w => has(dicts[lang], w);
  for (let i = 0; i < turns && !s.over; i++) {
    const m = computerMove(s, dicts[lang], 'hard', undefined, rand);
    s = m.kind === 'play' ? play(s, m.placed, isWord) : m.kind === 'swap' ? exchange(s, m.tiles, rand) : pass(s);
  }
  return s;
}
{
  const first = { ...newGame({ lang: 'en', board: 'quick', rand: seeded(5) }), racks: [['r', 'e', 't', 'a', 'i'], []] };
  agree('en, quick board, first move, 5 tiles', first, 'en');
  const mid = midGame('en', 'quick', 6, 7);
  agree('en, quick board, 6 moves in, 4 tiles', { ...mid, racks: mid.racks.map(r => r.filter(t => t !== BLANK).slice(0, 4)) }, 'en');
  agree('en, quick board, with a blank', { ...mid, racks: mid.racks.map(r => [...r.filter(t => t !== BLANK).slice(0, 2), BLANK]) }, 'en');
  const pl = midGame('pl', 'classic', 8, 11);
  agree('pl, classic board, 8 moves in, 4 tiles', { ...pl, racks: pl.racks.map(r => r.filter(t => t !== BLANK).slice(0, 4)) }, 'pl');
  const bonus = midGame('pl', 'bonus', 5, 13);
  agree('pl, bonus board, with a blank', { ...bonus, racks: bonus.racks.map(r => [...r.filter(t => t !== BLANK).slice(0, 2), BLANK]) }, 'pl');
  // the slowest rack there is: two blanks, in Polish (32 letters each), mid-game
  const two = { ...pl, racks: pl.racks.map(r => [...r.filter(t => t !== BLANK).slice(0, 5), BLANK, BLANK]) };
  const t0 = performance.now(), all = findMoves(two, dicts.pl), ms = Math.round(performance.now() - t0);
  check('two blanks: still quick (under 2 s here)', ms < 2000, true);
  console.log(`pl, two blanks, 8 moves in: ${all.length} moves found in ${ms} ms`);
}

// ── whole games, computer against computer: every move legal, every tile accounted for, and how fast ──
const rankOf = lang => w => resolve(lexes[lang], w)?.idx ?? Infinity;
for (const [lang, board, levels, seed] of [['pl', 'classic', ['hard', 'normal'], 21], ['en', 'classic', ['hard', 'easy'], 22],
  ['pl', 'quick', ['relaxed', 'hard'], 23], ['en', 'bonus', ['normal', 'hard'], 24], ['pl', 'bonus', ['easy', 'hard'], 25]]) {
  const rand = seeded(seed), isWord = w => has(dicts[lang], w);
  let s = newGame({ lang, board, rand });
  const total = fullBag(lang, board).length;
  let worst = 0, sum = 0, turns = 0, ok = true;
  while (!s.over && turns < 200) {
    const t0 = performance.now();
    const m = computerMove(s, dicts[lang], levels[s.turn], rankOf(lang), rand);
    const ms = performance.now() - t0;
    worst = Math.max(worst, ms); sum += ms; turns++;
    if (m.kind === 'play' && checkMove(s, m.placed, isWord).error) ok = false;
    s = m.kind === 'play' ? play(s, m.placed, isWord) : m.kind === 'swap' ? exchange(s, m.tiles, rand) : pass(s);
    const onBoard = s.cells.filter(Boolean).length, inRacks = s.racks.reduce((a, r) => a + r.length, 0);
    if (onBoard + inRacks + s.bag.length !== total) ok = false;
  }
  const byMoves = [0, 1].map(p => s.moves.filter(x => x.p === p && x.kind === 'play').reduce((a, x) => a + x.score, 0) + s.over.adjust[p]);
  check(`${lang} ${board} game: every move legal, no tile lost`, ok, true);
  check(`${lang} ${board} game: it ends`, !!s.over, true);
  check(`${lang} ${board} game: scores = moves + the end`, s.scores, byMoves);
  console.log(`${lang} ${board} (${levels.join(' vs ')}): ${turns} turns, ${s.scores.join(':')} (${s.over.reason}), ` +
    `words ${s.moves.filter(x => x.kind === 'play').map(x => x.words[0].w).slice(0, 8).join(' ')}…, ` +
    `computer ${Math.round(sum / turns)} ms a turn on average, ${Math.round(worst)} ms at most`);
}
check('levels: four, the app\'s names', Object.keys(LEVELS), ['relaxed', 'easy', 'normal', 'hard']);

console.log(`all ${passed} Tiles tests passed`);
