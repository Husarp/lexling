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
const { findMoves, computerMove, hint, LEVELS } = await import('../app/js/tiles-moves.js');
const { BOARDS, sizeOf, premiums, letterSet, fullBag, loadTileWords, newGame, placementError, wordsMade, checkMove,
  play, exchange, pass, resign, canExchange, apply, hinted, unseen, checkWord, RACK, BINGO, BLANK } = T;

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

// the word files the game loads (tools/build-tiles-words.mjs): sjp.pl's list for word games, and ENABLE
const dicts = {}, lexes = {};
for (const lang of ['pl', 'en']) {
  lexes[lang] = await loadWords(lang);
  const t0 = performance.now();
  const d = dicts[lang] = await loadTileWords(lang);
  console.log(`${lang}: ${d.words} words, ${d.final.length} nodes, ${d.letter.length} edges, tag ${d.tag.toString(16)}, ` +
    `loaded in ${Math.round(performance.now() - t0)} ms`);
  check(`${lang}: one loading for every caller`, await loadTileWords(lang) === d, true);
  check(`${lang}: a tag for the list`, d.tag > 0, true);
}
check('pl: the whole list - over 3 million words and forms', dicts.pl.words > 3_000_000, true);
check('en: ENABLE - over 160 000', dicts.en.words > 160_000, true);
check('pl: forms our own list lacked (pasłem)', ['kotem', 'psami', 'zrobiłem', 'pasę', 'pasłem', 'źdźbło'].map(w => has(dicts.pl, w)), [true, true, true, true, true, true]);
check('pl: no abbreviations', ['hr', 'pp', 'bp', 'cm', 'dr', 'itp'].map(w => has(dicts.pl, w)), [false, false, false, false, false, false]);
check('en: no abbreviations', ['hr', 'pp', 'cc', 'cf', 'abbr', 'abc'].map(w => has(dicts.en, w)), [false, false, false, false, false, false]);
check('letter names are words', ['es', 'ef', 'zet', 'żet', 'igrek', 'jot'].map(w => has(dicts.pl, w)).concat(['ess', 'ef', 'aitch', 'zed', 'zee'].map(w => has(dicts.en, w))), Array(11).fill(true));
check('pl: no slurs or vulgar words, forms included', ['kurwa', 'kurwy', 'chuj', 'mineta', 'minetą', 'jebać', 'pierdolony'].map(w => has(dicts.pl, w)), Array(7).fill(false));
check('en: no slurs, forms included', ['fuck', 'fucking', 'bitches', 'nigger', 'asses'].map(w => has(dicts.en, w)), Array(5).fill(false));
check('no one-letter words', [has(dicts.en, 'a'), has(dicts.pl, 'w')], [false, false]);
check('pl: words with q, v, x left out (no such tiles)', has(dicts.pl, 'ablativach'), false);
check('graph: the bytes keep the tag', fromBytes(toBytes(buildDawg(['ab', 'abc'], 'abc')).buffer).tag, buildDawg(['abc', 'ab'], 'abc').tag);

// ── placing tiles ──
const TWO = [{ name: 'Ada' }, { name: '', cpu: 'normal' }];
const en = (board = 'classic') => ({ ...newGame({ lang: 'en', board, players: TWO, first: 0, seed: 1 }), racks: [['c', 'a', 't', 's', 'e', 'r', BLANK], ['d', 'o', 'g', 'e', 'x', 'i', 'n']] });
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
  check('play: tiles on the board, each with who put it there', [s2.cells[112], s2.cells[113], s2.cells[114]], [{ ch: 'c', by: 0 }, { ch: 'a', by: 0 }, { ch: 't', by: 0 }]);
  check('play: a blank keeps who put it there too', play(s, row(7, 7, 'cat', [2]), isEn).cells[114], { ch: 't', blank: true, by: 0 });
  check('the second player\'s tiles are theirs', play({ ...s2, racks: [s2.racks[0], ['s', 'x', 'x', 'x', 'x', 'x', 'x']] }, [{ r: 7, c: 10, ch: 's' }], isEn).cells[115], { ch: 's', by: 1 });
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
  const x = exchange(s, ['c', 'a']);
  check('exchange: rack stays full, bag the same size', [x.racks[0].length, x.bag.length], [7, s.bag.length]);
  check('exchange: turn passes, nothing scored', [x.turn, x.scores[0], x.zeros], [1, 0, 1]);
  check('exchange: not tiles you lack', exchange(s, ['z']), null);
  check('exchange: the bag reshuffled from the game\'s seed', [x.seed !== s.seed, exchange(s, ['c', 'a']).bag], [true, x.bag]);
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

// ── players, actions and the seed ──
{
  check('players: 2 to 5', [1, 6].map(k => { try { newGame({ lang: 'en', players: Array(k).fill({}) }); return 'ok'; } catch { return 'refused'; } }), ['refused', 'refused']);
  const five = newGame({ lang: 'pl', players: [{ name: 'A' }, { name: 'B' }, { name: 'C', cpu: 'easy' }, { name: 'D' }, { cpu: 'hard' }], seed: 3 });
  check('five players: five racks of 7', five.racks.map(r => r.length), [7, 7, 7, 7, 7]);
  check('five players: the bag after dealing', five.bag.length, 65);
  check('players keep their names and who is the computer', five.players.map(x => [x.name, x.cpu]), [['A', null], ['B', null], ['C', 'easy'], ['D', null], ['', 'hard']]);
  check('scores and hints per player', [five.scores, five.hints], [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]);
  const again = newGame({ lang: 'pl', players: five.players, seed: 3 });
  check('the same seed deals the same game, and picks the same first player', [again.bag, again.racks, again.turn], [five.bag, five.racks, five.turn]);
  const starts = new Set([...Array(40)].map((_, i) => newGame({ lang: 'en', players: TWO, seed: i }).turn));
  check('who starts is drawn', [...starts].sort(), [0, 1]);
  let p = five;
  for (let i = 0; i < 9; i++) p = pass(p);
  check('five players: nine passes, still on', p.over, null);
  check('five players: ten passes (each twice) end it', pass(p).over.reason, 'passes');
  const r = resign(five, 2);
  check('giving up ends it for everyone; the rest ranked', [r.over.reason, r.over.by, r.over.winner], ['resign', 2, -1]);

  const s = en(), isWord = isEn;
  check('apply: place', apply(s, { type: 'place', placed: row(7, 7, 'cat') }, isWord).scores, [10, 0]);
  check('apply: exchange', apply(s, { type: 'exchange', tiles: ['c'] }).zeros, 1);
  check('apply: pass', apply(s, { type: 'pass' }).turn, 1);
  check('apply: resign', apply(s, { type: 'resign', p: 0 }).over.winner, 1);
  const refused = a => { try { apply(s, a, isWord); return 'ok'; } catch { return 'refused'; } };
  check('apply: refuses what is not allowed', [refused({ type: 'place', placed: row(3, 3, 'cat') }), refused({ type: 'exchange', tiles: ['q'] }), refused({ type: 'fly' })], ['refused', 'refused', 'refused']);
  const over = apply(s, { type: 'resign' });
  check('apply: nothing after the end', (() => { try { apply(over, { type: 'pass' }); return 'ok'; } catch { return 'refused'; } })(), 'refused');
}

// ── checking a word, any time ──
check('check: a word', checkWord(dicts.pl, 'pl', '  Żółw '), { word: 'żółw', ok: true, why: null });
check('check: every form', [checkWord(dicts.pl, 'pl', 'pasłem').ok, checkWord(dicts.en, 'en', 'casters').ok], [true, true]);
check('check: why not', ['a', 'konstantynopolitańczykowianeczka', 'quiz', 'zzkot'].map(w => checkWord(dicts.pl, 'pl', w).why), ['short', 'long', 'letters', 'unknown']);
check('check: slurs are not allowed', checkWord(dicts.pl, 'pl', 'kurwa').ok, false);

// ── hints and the tiles not yet seen ──
{
  const s = en(), best = hint(s, dicts.en);
  check('hint: the best move there is', best.score, Math.max(...findMoves(s, dicts.en).map(m => m.score)));
  check('hint: a legal move', checkMove(s, best.placed, isEn).error, undefined);
  check('hint: counted for the player to move', hinted(s).hints, [1, 0]);
  check('hint: none on an empty rack', hint({ ...s, racks: [[], s.racks[1]] }, dicts.en), null);
  const u = unseen(s);
  const total = Object.values(u).reduce((a, k) => a + k, 0);
  check('unseen at the start: everything but my rack', total, 100 - 7);
  check('unseen: in alphabetical order, blanks last', Object.keys(u).slice(-1)[0], BLANK);
  check('unseen: my blank is not counted', u[BLANK], 1);
  check('unseen: my C is not counted (en has 2)', u.c, 1);
  const s2 = play(s, row(7, 7, 'cat'), isEn);
  check('unseen after a move: the board is seen too', Object.values(unseen(s2, 1)).reduce((a, k) => a + k, 0), 100 - 3 - 7);
  check('unseen: Polish order (ą after a)', Object.keys(unseen(newGame({ lang: 'pl', players: TWO, seed: 9 }))).slice(0, 3).join(''), 'aąb');
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
  let s = newGame({ lang, board, players: TWO, seed });
  const isWord = w => has(dicts[lang], w);
  for (let i = 0; i < turns && !s.over; i++) s = apply(s, computerMove(s, dicts[lang], 'hard', undefined, rand), isWord);
  return s;
}
{
  const first = { ...newGame({ lang: 'en', board: 'quick', players: TWO, first: 0, seed: 5 }), racks: [['r', 'e', 't', 'a', 'i'], []] };
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
  ['pl', 'quick', ['relaxed', 'hard'], 23], ['en', 'bonus', ['normal', 'hard'], 24], ['pl', 'bonus', ['easy', 'hard'], 25],
  ['pl', 'classic', ['relaxed', 'easy', 'normal', 'hard', 'hard'], 26], ['en', 'quick', ['normal', 'hard', 'easy'], 27]]) {
  const rand = seeded(seed), isWord = w => has(dicts[lang], w);
  const start = newGame({ lang, board, players: levels.map(cpu => ({ cpu })), seed, words: dicts[lang].tag });
  let s = start;
  const total = fullBag(lang, board).length, actions = [];
  let worst = 0, sum = 0, turns = 0, ok = true;
  while (!s.over && turns < 300) {
    const t0 = performance.now();
    const a = computerMove(s, dicts[lang], s.players[s.turn].cpu, rankOf(lang), rand);
    const ms = performance.now() - t0;
    worst = Math.max(worst, ms); sum += ms; turns++;
    if (a.type === 'place' && checkMove(s, a.placed, isWord).error) ok = false;
    s = apply(s, a, isWord);
    actions.push(a);
    const onBoard = s.cells.filter(Boolean).length, inRacks = s.racks.reduce((n, r) => n + r.length, 0);
    if (onBoard + inRacks + s.bag.length !== total) ok = false;
  }
  const byMoves = levels.map((_, p) => s.moves.filter(x => x.p === p && x.kind === 'play').reduce((n, x) => n + x.score, 0) + s.over.adjust[p]);
  check(`${lang} ${board} game: replayed from its first state and actions, the same game`, actions.reduce((x, a) => apply(x, a, isWord), start), s);
  check(`${lang} ${board} game: the word list's tag kept`, s.words, dicts[lang].tag);
  check(`${lang} ${board} game: every move legal, no tile lost`, ok, true);
  check(`${lang} ${board} game: it ends`, !!s.over, true);
  check(`${lang} ${board} game: scores = moves + the end`, s.scores, byMoves);
  console.log(`${lang} ${board} (${levels.join(' vs ')}): ${turns} turns, ${s.scores.join(':')} (${s.over.reason}), ` +
    `words ${s.moves.filter(x => x.kind === 'play').map(x => x.words[0].w).slice(0, 10).join(' ')}…, ` +
    `computer ${Math.round(sum / turns)} ms a turn on average, ${Math.round(worst)} ms at most`);
}
check('levels: four, the app\'s names', Object.keys(LEVELS), ['relaxed', 'easy', 'normal', 'hard']);

console.log(`all ${passed} Tiles tests passed`);
