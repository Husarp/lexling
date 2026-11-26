// Run: node tools/test-tiles-rating.mjs [--measure]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildDawg, has } from '../app/js/dawg.js';
import { loadWords, resolve } from '../app/js/engine.js';
import { t, esc, plural, setLang } from '../app/js/i18n.js';
import { apply, letterSet, loadTileWords, newGame, wordsMade } from '../app/js/tiles.js';
import { computerMove, evaluateMoves, findMoves, loadSpoken, lookBack } from '../app/js/tiles-moves.js';

const app = new URL('../app/', import.meta.url);
globalThis.fetch = async url => {
  const b = readFileSync(new URL(url, app));
  return { json: async () => JSON.parse(b.toString()), text: async () => b.toString(),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
};
globalThis.document = { documentElement: {} };
let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
const start = options => newGame({ lang: 'en', players: [{}, {}], first: 0, seed: 42, ...options });
const graph = words => buildDawg(words, letterSet('en').letters);
const oneWord = (word, score) => ({ word, score, made: 1 });

const familiar = graph(['at', 'cat']);
const state = start(), cat = oneWord('cat', 38), rare = oneWord('qoph', 80);
const both = { best: 80, word: 'qoph', reference: 40 };
const narrow = evaluateMoves(state, [oneWord('qoph', 39), cat], familiar);
const previous = { best: 38, word: 'cat', reference: 38, familiar: true, rarer: { word: 'qoph', score: 80, cross: 'it' } };
check('the best familiar play sets the benchmark when a rare play outscores it', evaluateMoves(state, [rare, cat], familiar), both);
check('candidate order does not change the maxima', evaluateMoves(state, [cat, rare], familiar), both);
check('a narrow lead uses the same benchmark as a wide lead', narrow, { ...both, best: 39 });
check('a rare jackpot uses the same benchmark', evaluateMoves(state, [oneWord('qoph', 120), cat], familiar), { ...both, best: 120 });
check('all familiar moves use raw points', evaluateMoves(state, [cat, oneWord('at', 2)], familiar), { best: 38, word: 'cat', reference: 38 });
check('a rare play tied for first keeps the raw benchmark', evaluateMoves(state, [oneWord('qoph', 38), cat], familiar), { ...both, best: 38, reference: 38 });
check('a rare-only rack uses the raw benchmark', evaluateMoves(state, [rare], familiar), { ...both, reference: 80 });
check('missing familiarity graph falls back to the raw benchmark', evaluateMoves(state, [cat, rare], null), { ...both, reference: 80 });
check('a zero-point familiar move leaves the raw benchmark in place', evaluateMoves(state, [oneWord('at', 0), rare], familiar), { ...both, reference: 80 });
check('no legal moves', evaluateMoves(state, [], familiar), { best: 0, word: '', reference: 0 });
check('zero score alone supplies no benchmark', evaluateMoves(state, [oneWord('at', 0)], familiar).reference, 0);

// Both orientations matter when a single tile makes two words.
{
  const crossing = { ...start(), cells: Array(225).fill(null), racks: [['t'], []] };
  crossing.cells[6 * 15 + 7] = { ch: 'i' };
  crossing.cells[7 * 15 + 6] = { ch: 'a' };
  const dict = graph(['at', 'it']);
  const move = findMoves(crossing, dict).find(m => m.made === 2);
  check('the finder produces a one-tile cross', [move.word, move.placed.length, move.placed[0].r, move.placed[0].c], ['at', 1, 7, 7]);
  const other = oneWord('cat', 1);
  check('a rare cross rules out the higher-scoring play as familiar', evaluateMoves(crossing, [move, other], graph(['at', 'cat'])),
    { best: move.score, word: 'at', reference: 1 / 0.95 });
  check('a rare main word also rules out the higher-scoring play as familiar', evaluateMoves(crossing, [move, other], graph(['it', 'cat'])).reference, 1 / 0.95);
  check('two familiar words keep the full score', evaluateMoves(crossing, [move, other], dict).reference, move.score);
}

const source = readFileSync(new URL('js/tiles-game.js', app), 'utf8');
const part = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const ratings = part('const BANDS =', '// The bonus squares').replace(/^export /gm, '');
const gates = part('  const rateOn =', '  // Whose turn now:');
const cards = part('  const cardWords =', '  function paintSay()');
const history = part('const historyAction =', '// Replay stays') + part('  function histHtml(', '  function unseenHtml()');
const ui = { t, esc, plural, settings: { tilesRate: true }, histOf: null, playerIcon: () => '', ICON: {},
  nameOf: (_, p) => ['You', 'Computer'][p], meaningWord: w => esc(w), wordLink: w => esc(w), lex: null,
  S: { rules: {}, moves: [{ kind: 'play', score: 38, words: [{ w: 'cat', score: 38 }], p: 0 }] }, game: { evals: [both] } };
runInNewContext(ratings + gates + cards + history + '\nthis.card = () => moveCard(0, "me"); this.hist = histHtml; this.rate = rateOf; this.pct = pctOf; this.credit = creditOf;', ui);
check('rating thresholds stay at 100, 85, 65 and 40 percent', [100, 85, 84, 65, 64, 40, 39].map(n => ui.rate(n, 100)),
  ['best', 'great', 'good', 'good', 'fair', 'fair', 'weak']);
check('a play between the best familiar and overall best gets partial credit', ui.credit(39, both), 39);
check('the raw leader gets full credit on both sides of the benchmark', [ui.credit(80, both), ui.credit(39, narrow)], [40, 40]);
check('no rating for a zero benchmark', ui.rate(2, 0), null);
for (const lang of ['en', 'pl']) {
  setLang(lang);
  for (const show of [ui.card, ui.hist]) {
    const where = show === ui.card ? 'card' : 'History';
    ui.game.evals = [both];
    const top = t('tiles.rate.bestWas', { w: '<b>QOPH</b>', n: 80 });
    check(`${lang} ${where} uses the benchmark and shows only the overall leader`, [show().includes('95%'),
      show().includes(top), show().includes('<b>CAT</b>')], [true, true, false]);
    ui.game.evals = [narrow];
    ui.S.moves[0].score = 39;
    check(`${lang} ${where} shows the narrow overall leader at 100 percent`, show().includes('100%'), true);
    ui.S.moves[0].score = 38;
    ui.game.evals = [both];
    ui.settings.tilesRate = 'score';
    check(`${lang} ${where} keeps suggestions hidden in rating-only mode`, /<b>(CAT|QOPH)<\/b>/.test(show()), false);
    ui.settings.tilesRate = true;
    ui.game.evals = [{ best: 80, word: 'qoph' }];
    check(`${lang} ${where} renders a raw legacy save`, [show().includes('48%'), show().includes(top)], [true, true]);
    ui.game.evals = [previous];
    check(`${lang} ${where} keeps the saved benchmark but shows only the overall leader`, [show().includes('100%'),
      show().includes(top), show().includes('<b>CAT</b>'), show().includes('<b>QOPH + IT</b>')], [true, true, false, false]);
  }
  const moves = ui.S.moves;
  ui.S.moves = [{ kind: 'pass', p: 0 }, { kind: 'swap', p: 1, n: 1 }];
  ui.game.evals = [both, both];
  check(`${lang}: History shows a dash for pass and exchange even with old evaluations`,
    (ui.hist().match(/<span class="pct">–<\/span>/g) ?? []).length, 2);
  check(`${lang}: the live card ignores a saved benchmark for a pass`, ui.card().includes(t('tiles.rate.bestWas', { w: '<b>QOPH</b>', n: 80 })), false);
  ui.S.moves = moves;
}
setLang('en');

// Run the end review against saved evaluations from both schemas, without another candidate search.
{
  const review = part('    // The end review replays', '    }, 60);') + '    }, 60);';
  const box = { isConnected: true, hidden: true, querySelector: () => null };
  const state = { players: [{}, {}], rules: {} }, evals = [narrow, both, { best: 80, word: 'qoph' }];
  let recorded;
  const ctx = { ...ui, S: state, game: { evals }, main: { querySelector: () => box }, dict: {}, linked: false,
    archived: false, ratedInStats: false, wordsReady: Promise.resolve(), setTimeout: action => action(),
    lookBack: (_, __, ___, evaluate) => [39, 20, 38].map((played, i) => ({ p: i === 2 ? 1 : 0,
      kind: 'place', played, word: 'cat', evaluation: evaluate(state, i) }))
      .concat(['pass', 'exchange'].map(kind => ({ p: 0, kind, played: 0, evaluation: null }))),
    recordTilesRating: (_, played, best) => { recorded = [played, best]; } };
  await runInNewContext(ratings + gates + review, ctx);
  check('end review credits a narrow leader in the row and aggregate', [box.innerHTML.includes('100%'), box.innerHTML.includes('75%'), recorded], [true, true, [98, 160]]);
  check('end review keeps the legacy benchmark', box.innerHTML.includes('48%'), true);
  check('end review shows only the overall leader', [box.innerHTML.includes('best: <b>QOPH</b> 39'), box.innerHTML.includes('<b>CAT</b>')], [true, false]);
  check('end review shows dashes for pass and exchange', (box.innerHTML.match(/<span class="pct">–<\/span>/g) ?? []).length, 2);
}

const loadGraphs = async lang => Promise.all([loadTileWords(lang), loadTileWords(lang, { dictionary: 'familiar' })]);
const familiarLeader = (state, moves, known) => moves.reduce((best, move) =>
  move.score > (best?.score ?? 0) && wordsMade(state, move.placed).words.every(({ w }) => has(known, w)) ? move : best, null);
for (const lang of ['en', 'pl']) {
  const [dict, known] = await loadGraphs(lang);
  const opening = start({ lang, rules: { veto: true } });
  const moves = findMoves(opening, dict);
  let reads = 0;
  const shared = computerMove(opening, dict, 'hard', () => 0, () => 0.75, () => 0, () => { reads++; return moves; });
  check(`${lang} bot reads the shared candidates once and makes the same move`, [reads, shared],
    [1, computerMove(opening, dict, 'hard', () => 0, () => 0.75, () => 0)]);
  const result = evaluateMoves(opening, moves, known);
  const raw = Math.max(0, ...moves.map(m => m.score));
  const leader = familiarLeader(opening, moves, known);
  const expected = leader && raw > leader.score ? leader.score / 0.95 : raw;
  check(`${lang} real opening benchmark matches an exhaustive reduction`, result.reference, expected);
  const isWord = w => has(dict, w);
  const hinted = apply(opening, { type: 'hint', level: 'small' }, isWord);
  const proposal = apply(hinted, { type: 'place', placed: moves[0].placed, hint: 'small' }, isWord);
  const accepted = apply(proposal, { type: 'vote', p: 1, veto: false }, isWord);
  const seen = [];
  const rows = lookBack(accepted, dict, true, (before, moveAt) => {
    seen.push([before.cells.some(Boolean), moveAt]);
    return result;
  });
  check(`${lang} look-back asks for the accepted move's saved evaluation`, seen, [[false, 1]]);
  check(`${lang} look-back retains the evaluation and hint`, [rows[0].evaluation, rows[0].hinted], [result, 'small']);
  const passed = apply(accepted, { type: 'pass' }, isWord);
  const exchanged = apply(passed, { type: 'exchange', tiles: [passed.racks[passed.turn][0]] }, isWord);
  const noRatings = lookBack(exchanged, dict, true, (_, i) => {
    assert.equal(i, 1, 'only the placed word asks for an evaluation');
    return result;
  }).slice(1);
  check(`${lang} replay keeps pass and exchange rows without ratings`, noRatings.map(x => [x.kind, x.evaluation]), [['pass', null], ['exchange', null]]);
}

console.log(`all ${passed} Tiles rating tests passed`);

if (process.argv.includes('--measure')) {
  const seeded = seed => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 2 ** 32;
  };
  const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
  const describe = values => ({ n: values.length, mean: values.reduce((a, v) => a + v, 0) / values.length,
    median: percentile(values, 0.5) });
  for (const lang of ['en', 'pl']) {
    const [[dict, known], lex, spoken] = await Promise.all([loadGraphs(lang), loadWords(lang), loadSpoken(lang)]);
    const rankOf = w => resolve(lex, w)?.idx ?? Infinity, spokenOf = w => spoken.get(w) ?? Infinity;
    const times = [], findTimes = [], best = [], rareBest = [], typical = [], examples = [];
    let sampled = 0, noLegal = 0, noFamiliar = 0, typicalPass = 0;
    for (let seed = 1000; sampled < 200; seed++) {
      const rand = seeded(seed), goodRand = seeded(seed + 10000);
      let s = start({ lang, seed, board: 'classic', players: [{ cpu: 'hard' }, { cpu: 'medium' }] });
      for (let turn = 0; !s.over && turn < 16 && sampled < 200; turn++) {
        let moves;
        const candidates = () => moves ??= findMoves(s, dict);
        if (turn >= 6) {
          sampled++;
          const startFind = performance.now();
          candidates();
          const startEval = performance.now();
          const ev = evaluateMoves(s, moves, known);
          times.push(performance.now() - startEval);
          findTimes.push(startEval - startFind);
          const raw = ev.best;
          if (!raw) noLegal++;
          else {
            const pair = score => [ui.pct(score, raw), ui.pct(ui.credit(score, ev), ev.reference)];
            const leader = familiarLeader(s, moves, known);
            if (leader) best.push(pair(leader.score));
            else noFamiliar++;
            if (leader && raw > leader.score) {
              rareBest.push(pair(leader.score));
              const top = moves.find(m => m.score === raw), topWords = wordsMade(s, top.placed).words.map(x => x.w);
              examples.push({ seed, turn, rack: s.racks[s.turn].join(''), familiar: leader.word, score: leader.score,
                topWords, raw, reference: ev.reference, pct: pair(leader.score) });
            }
            const good = computerMove(s, dict, 'normal', rankOf, goodRand, spokenOf, candidates);
            if (good.type === 'place') typical.push(pair(wordsMade(s, good.placed).score));
            else typicalPass++;
          }
        }
        const action = computerMove(s, dict, s.players[s.turn].cpu, rankOf, rand, spokenOf, candidates);
        s = apply(s, action, w => has(dict, w));
      }
    }
    const comparison = pairs => ({ old: describe(pairs.map(p => p[0])), new: describe(pairs.map(p => p[1])),
      newAtLeast90: pairs.filter(p => p[1] >= 90).length, newAtLeast95: pairs.filter(p => p[1] >= 95).length });
    console.log(JSON.stringify({ lang, sampled, noLegal, noFamiliar, typicalPass, best: comparison(best),
      rareBest: comparison(rareBest), typical: comparison(typical),
      findMs: { median: percentile(findTimes, 0.5), p95: percentile(findTimes, 0.95) },
      extraMs: { median: percentile(times, 0.5), p95: percentile(times, 0.95) },
      examples: examples.sort((a, b) => a.pct[0] - b.pct[0]).slice(0, 5) }, null, 2));
  }
}
