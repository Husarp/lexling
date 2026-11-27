// Tests for Tiles: the rules (app/js/tiles.js), the word graph (app/js/dawg.js) and the move
// finder (app/js/tiles-moves.js), against the real word data.
// Run: node tools/test-tiles.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const ROOT = new URL('../app/', import.meta.url);
const UI_ICONS = runInNewContext('(' + readFileSync(new URL('js/ui.js', ROOT), 'utf8').match(/export const UI_ICONS = (\{[\s\S]*?\n\});/)[1] + ')');
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords, resolve } = await import('../app/js/engine.js');
const { buildDawg, has, toBytes, fromBytes } = await import('../app/js/dawg.js');
const T = await import('../app/js/tiles.js');
const { setupPractice } = await import('../app/js/store.js');
const { tilesMoveCue } = await import('../app/js/sound.js');
const { findMoves, computerMove, hint, lookBack, leaveValue, LEVELS, COMMON, loadSpoken } = await import('../app/js/tiles-moves.js');
const { BOARDS, sizeOf, premiums, letterSet, fullBag, loadTileWords, newGame, placementError, wordsMade, checkMove,
  play, exchange, pass, resign, canExchange, apply, replay, hinted, unseen, checkWord, results, STANDARD, RACK, BINGO, BLANK } = T;

let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// The result uses the recorded moves, including crosswords and scoreless turns (owner, 2026-11-26).
{
  const players = [{}, { cpu: 'normal' }, {}];
  const moves = [
    { kind: 'hint', p: 0, cost: 6 },
    { kind: 'pass', p: 0 },
    { kind: 'play', p: 1, score: 42, words: [{ w: 'żar' }, { w: 'gałązka' }] },
    { kind: 'vetoed', p: 2, score: 90, words: [{ w: 'niezatwierdzony' }] },
    { kind: 'withdrawn', p: 2, score: 70, words: [{ w: 'unieważniony' }] },
    { kind: 'challenge', p: 0, ok: true },
    { kind: 'play', p: 0, score: 10, words: [{ w: 'łódź' }] },
    { kind: 'swap', p: 2 },
  ];
  check('match summary: all seats, crossword length, settled plays, hint cost and move numbering',
    T.matchSummary({ players, moves, scores: [0, 55, -7], over: { adjust: [-4, 13, -7] } }), {
      best: { word: 'żar', score: 42 }, longest: { word: 'gałązka', letters: 7 },
      totals: [[0, 0, 0], [-6, 0, 0], [-6, 42, 0], [-6, 42, 0], [-6, 42, 0], [-6, 42, 0], [4, 42, 0], [4, 42, 0]],
    });
  check('match summary: game ended before a move', T.matchSummary({ players, moves: [] }),
    { best: null, longest: null, totals: [[0, 0, 0]] });
}

// Quality of life: calculations use the scoring rules, selections preserve duplicates.
{
  const source = readFileSync(new URL('../app/js/tiles-game.js', import.meta.url), 'utf8');
  const context = { BLANK, outOf: T.outOf };
  runInNewContext(source.slice(source.indexOf('export const exchangeLetters'), source.indexOf('const clampPan')).replaceAll('export ', '') + '\nthis.exchangeLetters = exchangeLetters; this.endingNext = endingNext;', context);
  check('exchange summary: duplicate letters and named blanks', context.exchangeLetters(['a', '?', 'a'], new Set([2, 1, 0]), 'Blank'), 'A, Blank, A');
  check('exchange summary: deselection', context.exchangeLetters(['a', '?', 'a'], new Set([2]), 'Blank'), 'A');
  check('exchange summary: cancellation', context.exchangeLetters(['a'], new Set(), 'Blank'), '');
  const state = newGame({ lang: 'en', players: [{}, {}, {}], first: 0, seed: 12 });
  for (const zeros of [0, 1, 2, 3]) check(`ending warning: two active players at ${zeros}`, context.endingNext({ ...state, out: [false, false, true], zeros }), zeros === 3);
  check('ending warning: scoring resets warning', context.endingNext({ ...state, zeros: 0 }), false);
  for (const lang of ['en', 'pl']) for (const premiums of ['new', 'always']) {
    const S = { ...state, lang, rules: { ...state.rules, premiums }, cells: Array(225).fill(null) };
    S.cells[6 * 15 + 7] = { ch: 'a' };
    const placed = [...'at'].map((ch, k) => ({ r: 7, c: 7 + k, ch, blank: k === 0 }));
    const detail = T.pointsBreakdown(S, placed);
    check(`${lang} ${premiums}: cross words and blanks sum`, detail.words.reduce((sum, w) => sum + w.letters.reduce((v, l) => v + l.value * l.multiplier, 0) * w.multiplier, detail.bonus), wordsMade(S, placed).score);
    check(`${lang} ${premiums}: blank has zero value`, detail.words[0].letters[0].value, 0);
    const seven = Array.from({ length: 7 }, (_, k) => ({ r: 7, c: 4 + k, ch: 'a' }));
    check(`${lang} ${premiums}: seven tile bonus sums`, T.pointsBreakdown(S, seven).score, T.pointsBreakdown(S, seven).words.reduce((sum, w) => sum + w.score, 50));
    const opening = { ...S, cells: Array(225).fill(null) };
    const air = [...'air'].map((ch, k) => ({ r: 7, c: 7 + k, ch }));
    if (lang === 'en') check(`${premiums}: centre double word`, T.pointsBreakdown(opening, air).score, 6);
    const consumed = { ...S, cells: [...S.cells] };
    consumed.cells[112] = { ch: 'a' };
    const extension = [{ r: 7, c: 8, ch: 't' }];
    check(`${lang} ${premiums}: consumed word multiplier`, T.pointsBreakdown(consumed, extension).words.find(w => w.w === 'at').multiplier, premiums === 'always' ? 2 : 1);
  }
}

// Unknown words use the same logged vote transport, with explicit consent required.
{
  check('approval: default off', STANDARD.wordsVote, false);
  check('approval: count clamps', [T.vetoNeed(3, 99), T.vetoNeed(3, 0), T.vetoNeed(3, null)], [3, 1, 2]);
  const base = newGame({ lang: 'en', players: [{}, {}, {}, {}], first: 0, seed: 42, rules: { wordsVote: true, veto: true, approvalNeed: 2 } });
  const placed = base.racks[0].slice(0, 2).map((ch, i) => ({ r: 7, c: 7 + i, ch: ch === BLANK ? 'a' : ch, ...(ch === BLANK ? { blank: true } : {}) }));
  const pending = apply(base, { type: 'place', placed }, () => false);
  check('approval: opens for unknown word', !!pending.vote.approval, true);
  const vote = (s, p, veto) => apply(s, { type: 'vote', p, veto, at: 0 }, () => false);
  const one = vote(pending, 1, true), accepted = vote(one, 2, true);
  check('approval: early success skips veto', [accepted.vote, accepted.moves.at(-1).approved], [null, pending.vote.approval]);
  check('approval: later dictionary check accepts word', checkMove({ ...accepted, cells: base.cells, racks: base.racks, turn: 0 }, placed, () => false).error, undefined);
  const rejected = vote(vote(pending, 1, false), 2, false);
  check('approval: early rejection restores same rack and turn', [rejected.vote, rejected.turn, rejected.racks, rejected.moves.at(-1).kind], [null, 0, base.racks, 'vetoed']);
  const silent = apply(one, { type: 'voteEnd', ms: 20000 }, () => false);
  check('approval: silence rejects and clock continues', [silent.turn, silent.moves.at(-1).kind, silent.used], [0, 'vetoed', 20000]);
  check('approval: replay identical on every phone', replay(accepted, () => false).at(-1), accepted);
  check('approval: replay rejection identical', replay(silent, () => false).at(-1), silent);
  const departed = apply(one, { type: 'resign', p: 3 }, () => false);
  check('approval: departure clamps required count', T.voteCertain({ ...departed, vote: { ...departed.vote, voters: [1] } }), true);
  check('approval: challenge disables rule', newGame({ lang: 'en', players: [{}, {}], rules: { wordsVote: true, check: 'challenge' } }).rules.wordsVote, false);
  check('approval: computer-only opponents disable rule', newGame({ lang: 'en', players: [{}, { cpu: 'easy' }], rules: { wordsVote: true } }).rules.wordsVote, false);
  const { playChallenges } = await import('../app/js/achievements.js');
  check('approval: excluded from challenges', playChallenges({ ...accepted.moves.at(-1), score: 100 }, { rarePct: 1 }), []);
  const source = readFileSync(new URL('../app/js/tiles-game.js', import.meta.url), 'utf8');
  const ctx = {};
  runInNewContext(source.slice(source.indexOf('export function guestAction'), source.indexOf('export const exchangeLetters')).replace('export ', '') + '\nthis.clean = guestAction;', ctx);
  check('approval: guest vote allowlist strips extra fields', JSON.stringify(ctx.clean({ type: 'vote', p: 1, veto: true, at: 0, approved: ['fake'] })), JSON.stringify({ type: 'vote', p: 1, veto: true, at: 0 }));
}

// ── rarity ──
{
  const { RARE_TIERS, TIER_KEYS, rarePct, tierOf, cleanTiers, moveRarity, listedPct } = await import('../app/js/rarity.js');
  check('rarity: default limits and colours', [RARE_TIERS, TIER_KEYS], [[1, 5, 20], ['purple', 'gold', 'blue', 'grey']]);
  check('rarity: first, last and only rank', [rarePct(0, 100), rarePct(99, 100), rarePct(0, 1)], [100, 1, 100]);
  check('rarity: rounds up', rarePct(98, 101), 3);
  check('rarity: unknown and out-of-list ranks', [Infinity, -Infinity, NaN, 100, 101].map(rank => rarePct(rank, 100)), Array(5).fill(null));
  check('rarity: invalid list size', [0, -1, Infinity, NaN].map(count => rarePct(0, count)), Array(4).fill(null));
  check('rarity: clamped at 100', rarePct(-1, 100), 100);
  check('rarity: default inclusive boundaries', [null, 1, 2, 5, 6, 20, 21, 100].map(pct => tierOf(pct)), ['purple', 'purple', 'gold', 'gold', 'blue', 'blue', 'grey', 'grey']);
  check('rarity: custom inclusive boundaries', [null, 2, 3, 10, 11, 50, 51].map(pct => tierOf(pct, [2, 10, 50])), ['purple', 'purple', 'gold', 'gold', 'blue', 'blue', 'grey']);
  check('rarity: valid settings', cleanTiers([2, 10, 100]), [2, 10, 100]);
  check('rarity: typed settings', cleanTiers([' 2 ', '10', '50']), [2, 10, 50]);
  for (const list of [undefined, null, '1,5,20', [], [1, 5], [1, 5, 20, 30], [5, 1, 20], [1, 1, 20], [0, 5, 20], [1, 5, 101], [1, 5.5, 20], [1, 'junk', 20], [1, '', 20], [true, 5, 20], [null, 5, 20], [1, NaN, 20], [1, Infinity, 20], Array(3)]) {
    check(`rarity: invalid setting ${JSON.stringify(list)} resets all limits`, cleanTiers(list), [1, 5, 20]);
  }
  const cleaned = cleanTiers(RARE_TIERS), fallback = cleanTiers();
  cleaned[0] = 2; fallback[0] = 3;
  check('rarity: cleaned settings do not mutate defaults', RARE_TIERS, [1, 5, 20]);
  const ranks = { common: 0, rare: 98, rarest: 99, unknown: Infinity, outside: 100 }, rankOf = w => ranks[w];
  check('listed rarity: empty move', listedPct([], rankOf, 100), null);
  check('listed rarity: unknown-only move', listedPct([{ w: 'unknown' }, { w: 'outside' }], rankOf, 100), null);
  check('listed rarity: invalid list size', listedPct([{ w: 'rarest' }], rankOf, 0), null);
  check('listed rarity: smallest percentage wins', listedPct([{ w: 'common' }, { w: 'rarest' }, { w: 'rare' }], rankOf, 100), 1);
  check('listed rarity: common-only move', listedPct([{ w: 'common' }], rankOf, 100), 100);
  check('rarity: empty move', moveRarity([], rankOf, 100), null);
  check('rarity: largest rank wins even within the same percentage', moveRarity([{ w: 'rare' }, { w: 'rarest' }, { w: 'common' }], rankOf, 1000), { w: 'rarest', rank: 99, pct: 91, tier: 'grey' });
  check('rarity: custom move tier', moveRarity([{ w: 'common' }, { w: 'rare' }], rankOf, 100, [2, 10, 50]), { w: 'rare', rank: 98, pct: 2, tier: 'purple' });
  for (const w of ['unknown', 'outside']) {
    for (const words of [[{ w }, { w: 'rarest' }], [{ w: 'rarest' }, { w }]]) {
      check('listed rarity: ignores unlisted words in either order', listedPct(words, rankOf, 100), 1);
      check('rarity: unknown word beats listed words in either order', moveRarity(words, rankOf, 100), { w, rank: ranks[w], pct: null, tier: 'purple' });
    }
  }
  for (const [lang, common, outside] of [['pl', 'dom', 'pasę'], ['en', 'house', 'zyzzyva']]) {
    const lex = await loadWords(lang), dict = await loadTileWords(lang), rankOf = w => resolve(lex, w)?.idx ?? Infinity;
    check(`${lang} rarity: common word is listed`, Number.isFinite(rankOf(common)), true);
    check(`${lang} rarity: common word is grey`, moveRarity([{ w: common }], rankOf, lex.count).tier, 'grey');
    check(`${lang} rarity: outside word is valid in Tiles`, has(dict, outside), true);
    check(`${lang} rarity: outside word has no frequency rank`, resolve(lex, outside), null);
    check(`${lang} rarity: outside word is very rare`, moveRarity([{ w: common }, { w: outside }], rankOf, lex.count), { w: outside, rank: Infinity, pct: null, tier: 'purple' });
    if (lang === 'pl') {
      check('pl rarity: inflected form resolves to its base rank', rankOf('domami'), rankOf('dom'));
      check('pl rarity: inflected form has its base rarity', rarePct(rankOf('domami'), lex.count), rarePct(rankOf('dom'), lex.count));
    }
  }
}

// The real move-card / History renderers and background load, without a browser (owner, 2026-11-14).
{
  const source = readFileSync(new URL('../app/js/tiles-game.js', import.meta.url), 'utf8');
  const { cleanTiers, moveRarity } = await import('../app/js/rarity.js');
  const { t, esc, setLang } = await import('../app/js/i18n.js');
  globalThis.document = { documentElement: {} };
  const ratings = source.slice(source.indexOf('const BANDS ='), source.indexOf('// The bonus squares')).replace(/^export /gm, '');
  const gates = source.slice(source.indexOf('  const rateOn ='), source.indexOf('  // Whose turn now:'));
  const meaningWord = source.slice(source.indexOf('  const meaningWord ='), source.indexOf('  let meaningBusy ='));
  const cards = source.slice(source.indexOf('  const cardWords ='), source.indexOf('  function paintSay()'));
  const history = source.slice(source.indexOf('const historyAction ='), source.indexOf('// Replay stays'))
    + source.slice(source.indexOf('  function histHtml('), source.indexOf('  function unseenHtml()'));
  const context = { playerIcon: () => '<svg></svg>', t, esc, cleanTiers, moveRarity, ICON: { hint: '' }, nameOf: (_, p) => ['You', 'Computer'][p],
    lang: 'en', histOf: null, wordLink: w => esc(w), settings: {}, lex: { count: 100 },
    rankOf: w => ({ common: 0, half: 50, blue: 80, gold: 95, purple: 99 })[w] ?? Infinity,
    S: { rules: {}, moves: [{ kind: 'play', p: 0, score: 10, words: [{ w: 'gold', score: 10 }] }] },
    game: { evals: [{ best: 20, word: 'better' }] } };
  runInNewContext(ratings + gates + meaningWord + cards + history + '\nthis.card = () => moveCard(0, "me"); this.hist = histHtml; this.chip = rarityChip;', context);
  check('move words open local meanings', context.card().includes('data-definition="gold"'), true);
  check('History words open local meanings', context.hist().includes('data-definition="gold"'), true);
  check('move words never invoke external meanings', context.card().includes('data-mean='), false);
  const hasRating = html => /class="rate rate-/.test(html), hasRare = html => /class="rare rare-/.test(html);
  const hasBest = html => /class="(bw|best)"/.test(html);
  for (const lang of ['en', 'pl']) {
    setLang(lang);
    for (const under of [undefined, 'rating', 'rarity', 'both']) for (const rule of [undefined, false, 'score']) for (const rate of [undefined, false, true, 'score']) {
      context.settings = { tilesUnder: under, tilesRate: rate };
      context.S.rules = { rating: rule };
      const rated = under !== 'rarity' && rule !== false && rate !== false, rare = under === 'rarity' || under === 'both';
      const best = rated && rate === true && rule !== 'score';
      const card = context.card(), hist = context.hist(), label = rated && rare ? 'tiles.under.both' : rare ? 'tiles.hist.rarity' : 'tiles.hist.rating';
      const name = `${lang}/${under}/${rule}/${rate}`;
      check(`${name}: card respects both independent display choices`, [hasRating(card), hasRare(card), hasBest(card)], [rated, rare, best]);
      check(`${name}: History respects both independent display choices`, [hasRating(hist), hasRare(hist), hasBest(hist)], [rated, rare, best]);
      check(`${name}: History keeps the optional column and matching heading`, [hist.includes('class="pct"'), hist.includes('tl-hist rated'), hist.includes(`<span>${t(label)}</span>`)], [rated || rare, rated || rare, rated || rare]);
    }
    context.settings = { tilesUnder: 'both', tilesRate: true };
    context.S.rules = {};
    for (const [w, label, tier] of [['common', 'tiles.rare.common', 'grey'], ['half', 'tiles.rare.top', 'grey'], ['blue', 'tiles.rare.top', 'blue'], ['gold', 'tiles.rare.top', 'gold'], ['purple', 'tiles.rare.top', 'purple'], ['unknown', 'tiles.rare.very', 'purple']]) {
      const chip = context.chip({ kind: 'play', words: [{ w: 'common' }, { w }] });
      const pct = w === 'half' ? 50 : w === 'blue' ? 20 : w === 'gold' ? 5 : 1;
      check(`${lang}/${w}: chip text, tier and rarest-word tooltip`, [chip.includes(`rare-${tier}`), chip.includes(`>${t(label, { n: pct })}</small>`), chip.includes(`title="${t('tiles.rare.of', { w })}"`), chip.includes('aria-label=')], [true, true, true, true]);
    }
    const malicious = '"><img src=x onerror=alert(1)>';
    check(`${lang}: rarity tooltip escapes word markup`, context.chip({ kind: 'play', words: [{ w: malicious }] }).includes('<img'), false);
    context.settings.tilesRareTiers = [10, 30, 50];
    check(`${lang}: custom limits are used on cards`, context.card().includes('rare-purple'), true);
    context.settings.tilesRareTiers = [100, 100, 100];
    check(`${lang}: invalid saved limits are cleaned for display`, context.card().includes('rare-gold'), true);
    context.settings.tilesRareTiers = [98, 99, 100];
    check(`${lang}: common words stay grey even with high custom limits`, context.chip({ kind: 'play', words: [{ w: 'common' }] }).includes('rare-grey'), true);
    context.lex = null;
    check(`${lang}: loading frequencies shows rating but no provisional rarity`, [hasRating(context.card()), hasRare(context.card()), hasRare(context.hist())], [true, false, false]);
    context.lex = { count: 100 };
    check(`${lang}: an older save without evaluations still shows rarity`, (() => { const old = context.game; context.game = {}; const result = [hasRating(context.card()), hasRare(context.card()), hasRare(context.hist())]; context.game = old; return result; })(), [false, true, true]);
    for (const kind of ['pass', 'swap', 'timeout', 'hint', 'withdrawn', 'vetoed']) check(`${lang}: ${kind} has no rarity`, context.chip({ kind, words: [{ w: 'unknown' }] }), '');
    const original = context.S.moves;
    context.S.moves = Array.from({ length: 200 }, (_, i) => ({ ...original[0], p: i % 2, kind: i % 3 ? 'play' : 'pass' }));
    const rows = [...context.hist().matchAll(/<li class="pc[\s\S]*?<\/li>/g)].map(m => m[0]);
    check(`${lang}: long History includes every player's moves`, [rows.length, rows.filter(hasRare).length], [200, 133]);
    check(`${lang}: every History row keeps all five aligned cells`, rows.every(row => (row.match(/<span class="(?:i|w|r|pct|who)"/g) ?? []).length === 5), true);
    context.histOf = 1;
    check(`${lang}: filtering History retains the computer's rarity`, (context.hist().match(/class="rare rare-/g) ?? []).length, 67);
    context.histOf = null; context.S.moves = original;
  }
  setLang('en');

  // Run the actual startup prefix with frequencies pending, including a computer that uses them.
  const startup = source.slice(source.indexOf('\n', source.indexOf('export async function tilesGameScreen(')), source.indexOf('  let S = game.state;'));
  const arrival = source.slice(source.indexOf('  lexReady.then(m => {'), source.indexOf("  document.addEventListener('keydown', onKey, true);"));
  for (const cpu of [undefined, 'relaxed', 'normal', 'hard', 'expert', 'legacy']) {
    let resolveLex, completed = false, wordLoads = 0;
    const pending = new Promise(resolve => { resolveLex = resolve; });
    const lex = { count: 100 }, slow = cpu === 'hard';
    const ctx = { id: 'old', archived: false, getSave: () => ({ lang: 'en', state: { players: [{}, { cpu }], rules: { hints: false } } }),
      loadWords: () => { wordLoads++; return pending; }, loadTileWords: async () => ({ words: 100 }), loadSpoken: async () => new Map(),
      LEVELS, location: { hash: '#/game/old', replace() { throw Error('unexpected redirect'); } } };
    const loading = runInNewContext('(async () => {' + startup + '\nreturn { dict, lex, lexReady }; })()', ctx).then(value => { completed = true; return value; });
    for (let k = 0; k < 10; k++) await Promise.resolve();
    check(`${cpu}: only computers with a finite known-word limit wait for frequencies`, [completed, wordLoads], [!slow, slow ? 2 : 1]);
    if (slow) resolveLex(lex);
    const started = await loading;
    check(`${cpu}: required frequencies are available at screen startup`, started.lex === lex, slow);
    let repaints = 0;
    Object.assign(ctx, { lex: started.lex, lexReady: started.lexReady, app: { isConnected: true }, say: { isConnected: true }, S: {}, countAchievements() {}, paintSay() { repaints++; }, paintMore() { repaints++; }, refit() {} });
    const arrived = runInNewContext(arrival, ctx);
    check(`${cpu}: frequency state is preserved until the arrival callback`, [ctx.lex === lex, repaints], [slow, 0]);
    resolveLex(lex); await arrived;
    check(`${cpu}: arrival updates rank data and both move cards and open History`, [ctx.lex === lex, repaints], [true, 2]);
    ctx.S.over = { reason: 'out' }; repaints = 0;
    await runInNewContext(arrival, ctx);
    check(`${cpu}: arrival refreshes the final move while its board is still visible`, repaints, 2);
    ctx.say.isConnected = false; repaints = 0;
    await runInNewContext(arrival, ctx);
    check(`${cpu}: arrival does not repaint move cards replaced by results`, repaints, 0);
    ctx.app.isConnected = false; ctx.lex = null; repaints = 0;
    await runInNewContext(arrival, ctx);
    check(`${cpu}: arrival can count a finished game after leaving, without repainting`, [ctx.lex === lex, repaints], [true, 0]);
    ctx.lex = null; ctx.S.over = null;
    await runInNewContext(arrival, ctx);
    check(`${cpu}: arrival cannot repaint an unfinished screen already left`, [ctx.lex, repaints], [null, 0]);
    ctx.app.isConnected = true; ctx.lexReady = Promise.resolve(null);
    await runInNewContext(arrival, ctx);
    check(`${cpu}: failed frequency loading leaves play usable without rarity`, [ctx.lex, repaints], [null, 0]);
  }
}

// ── boards ──
const tally = rows => [...rows.join('')].reduce((o, ch) => (ch === '.' ? o : { ...o, [ch]: (o[ch] || 0) + 1 }), {});
check('four boards: three full size, and Quick (back in 0.37.0, owner)', Object.keys(BOARDS), ['classic', 'bonus', 'romb', 'quick']);
check('classic: 8 T, 17 D, 12 t, 24 d', tally(BOARDS.classic), { T: 8, d: 24, D: 17, t: 12 });
check('bonus: 8 T, 12 D, 16 t, 28 d', tally(BOARDS.bonus), { t: 16, d: 28, D: 12, T: 8 });
check('romb: 4 T, 21 D, 12 t, 28 d', tally(BOARDS.romb), { t: 12, d: 28, T: 4, D: 21 });
check('quick: 4 T, 9 D, 8 t, 16 d', tally(BOARDS.quick), { T: 4, d: 16, D: 9, t: 8 });
for (const [id, b] of Object.entries(BOARDS)) {
  const n = b.length, at = (r, c) => b[r][c];
  check(`${id}: ${id === 'quick' ? 11 : 15} x ${id === 'quick' ? 11 : 15}`, b.every(row => row.length === n) && n === (id === 'quick' ? 11 : 15), true);
  let sym = true;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = at(r, c);
    if (v !== at(c, r) || v !== at(n - 1 - r, c) || v !== at(r, n - 1 - c)) sym = false;
  }
  check(`${id}: symmetrical both ways and across the diagonals`, sym, true);
}
check('classic centre is a double word', premiums('classic')[112], 'D');
check('bonus centre has no bonus', premiums('bonus')[112], '.');
check('classic: the original layout, row 0', BOARDS.classic[0], 'T..d...T...d..T');

// ── letter sets ──
for (const lang of ['pl', 'en']) {
  check(`${lang}: 100 tiles`, fullBag(lang).length, 100);
  check(`${lang}: two blanks`, fullBag(lang).filter(t => t === BLANK).length, 2);
}
// the Quick board's own tiles: about half, one blank, the letters that are hard to place left out (owner, 2026-09-25)
const vowels = { pl: 'aąeęioóuy', en: 'aeiou' };
for (const [lang, size, out] of [['pl', 53, 'ćńźóf'], ['en', 50, 'qzv']]) {
  const bag = fullBag(lang, 'quick'), letters = bag.filter(t => t !== BLANK);
  check(`${lang} quick: ${size} tiles, one blank`, [bag.length, bag.length - letters.length], [size, 1]);
  check(`${lang} quick: none of ${out}`, letters.filter(t => out.includes(t)), []);
  const share = letters.filter(t => vowels[lang].includes(t)).length / letters.length;
  const full = fullBag(lang).filter(t => t !== BLANK), fullShare = full.filter(t => vowels[lang].includes(t)).length / full.length;
  check(`${lang} quick: about the full set's share of vowels`, Math.abs(share - fullShare) < 0.03, true);
  check(`${lang} quick: a game starts with it`, (() => { const g = newGame({ lang, board: 'quick', players: [{}, {}], seed: 3 }); return g.bag.length + g.racks.flat().length; })(), size);
}
check('pl: 32 letters', letterSet('pl').letters.length, 32);
check('pl values', ['a', 'y', 'ł', 'ó', 'ć', 'ń', 'ź'].map(ch => letterSet('pl').values[ch]), [1, 2, 3, 5, 6, 7, 9]);
check('en values', ['e', 'd', 'b', 'f', 'k', 'x', 'q'].map(ch => letterSet('en').values[ch]), [1, 2, 3, 4, 5, 8, 10]);

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
  check('play: history retains word position for bonus statistics', s2.moves[0], { p: 0, kind: 'play', placed: row(7, 7, 'cat'), words: [{ w: 'cat', r: 7, c: 7, across: true, score: 10 }], score: 10, bingo: false });

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
  // giving up with more than two in (owner, 2026-09-27): out of the game, tiles back to the bag, the rest play on
  const r = resign(five, 2);
  check('five players: one gives up - the game goes on', [r.over, r.out, r.racks[2].length, r.bag.length], [null, [false, false, true, false, false], 0, five.bag.length + 7]);
  check('… their turn skipped', (() => { let x = { ...five, turn: 1 }; x = resign(x, 2); return pass(x).turn; })(), 3);
  check('… the one on turn gives up: the next plays', resign({ ...five, turn: 2 }, 2).turn, 3);
  check('… giving up twice: refused', (() => { try { resign(r, 2); return 'ok'; } catch { return 'refused'; } })(), 'refused');
  let four = r;
  for (let i = 0; i < 7; i++) four = pass(four);
  check('… four still in: eight passes end it', [four.over, pass(four).over?.reason], [null, 'passes']);
  const last = resign(resign(resign(r, 0), 1), 3);
  check('… until one is left: they win', [last.over?.reason, last.over?.winner, last.out], ['resign', 4, [true, true, true, true, false]]);
  check('… nobody out of the game wins, even with the most points', (() => { const x = resign({ ...five, scores: [0, 0, 90, 60, 3] }, 2); return apply(x, { type: 'end' }).over.winner; })(), 3);
  check('the host ends it: scored as usual', [apply(r, { type: 'end' }).over.reason, apply(r, { type: 'end' }).over.adjust.every(v => v <= 0)], ['ended', true]);
  const alone = newGame({ lang: 'en', players: [{ name: 'A' }, { name: 'B', cpu: 'easy' }, { name: 'C', cpu: 'hard' }], seed: 3 });
  check('the one person against computers gives up: over', resign(alone, 0).over?.reason, 'resign');
  check('a turn skipped for a player away: a pass, marked', apply(five, { type: 'pass', away: true }).moves.at(-1), { p: five.turn, kind: 'pass', away: true });

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

// ── rule options (the owner's plan) ──
{
  check('the standard rules by default', en().rules, STANDARD);
  // bonus squares every time: CAT on the centre (a double word), then S after it - CATS runs over the centre again
  const cat = play(en(), row(7, 7, 'cat'), isEn);
  const always = { ...cat, rules: { ...cat.rules, premiums: 'always' }, racks: [cat.racks[0], ['s', 'x', 'x', 'x', 'x', 'x', 'x']] };
  check('bonus squares once: CATS = 6', wordsMade({ ...always, rules: STANDARD }, [{ r: 7, c: 10, ch: 's' }]).score, 6);
  check('bonus squares every time: CATS = 6 x 2 = 12', wordsMade(always, [{ r: 7, c: 10, ch: 's' }]).score, 12);
  check('seven-tile bonus off', checkMove({ ...en(), rules: { ...STANDARD, bingo: 0 } }, row(7, 4, 'casters', [6]), isEn).score, 16);
  const low = { ...en(), bag: ['a', 'b', 'c'] };
  check('exchanges only with 7+ in the bag (standard)', canExchange(low), false);
  const anyTime = { ...low, rules: { ...STANDARD, exchange: 'always' } };
  check('exchanges always: while there are tiles to draw', [canExchange(anyTime, 3), canExchange(anyTime, 4), exchange(anyTime, ['c', 'a', 't']) !== null, exchange(anyTime, ['c', 'a', 't', 's'])], [true, false, true, null]);
}
{
  // challenges: a move goes down unchecked, the next player may challenge it
  const s = { ...en(), rules: { ...STANDARD, check: 'challenge' } };
  const bad = play(s, row(7, 7, 'cta'), isEn);
  check('challenges: a word that is not allowed goes down, waiting', [bad.scores[0] > 0, !!bad.pending, bad.turn], [true, true, 1]);
  const back = apply(bad, { type: 'challenge' }, isEn);
  check('challenged, not allowed: the move goes back - tiles, bag, points', [back.cells[112], back.racks[0], back.bag, back.scores], [null, s.racks[0], s.bag, [0, 0]]);
  check('...the challenger plays on; a turn that scored nothing', [back.turn, back.zeros, back.pending], [1, 1, null]);
  check('...the history shows it', back.moves.map(m => m.kind), ['withdrawn', 'challenge']);
  const good = play(s, row(7, 7, 'cat'), isEn);
  const lost = apply(good, { type: 'challenge' }, isEn);
  check('challenging a good word costs the challenger the turn', [lost.turn, lost.scores, lost.moves.at(-1)], [0, [10, 0], { p: 1, kind: 'challenge', ok: false, of: 0 }]);
  check('any other move accepts it', pass(good).pending, null);
  check('nothing to challenge: refused', (() => { try { apply(s, { type: 'challenge' }, isEn); return 'ok'; } catch { return 'refused'; } })(), 'refused');
  check('the computer challenges a word that is not allowed', computerMove(bad, dicts.en, 'relaxed').type, 'challenge');
  check('...and never a good one', computerMove(good, dicts.en, 'hard').type !== 'challenge', true);
  const lastTiles = { ...s, bag: [], racks: [['c', 't', 'a'], s.racks[1]] };
  check('the last tiles are checked at once: nobody is left to challenge', (() => { try { play(lastTiles, row(7, 7, 'cta'), isEn); return 'ok'; } catch { return 'refused'; } })(), 'refused');
}
{
  // the clock: per move, running out is a pass; per game, every started minute over costs 10
  const perMove = { ...en(), rules: { ...STANDARD, time: { per: 'move', seconds: 60 } } };
  const t = apply(perMove, { type: 'timeout', ms: 60000 });
  check('time per move: running out passes the turn', [t.turn, t.zeros, t.moves[0].kind, t.clock], [1, 1, 'timeout', [60000, 0]]);
  let g = { ...en(), rules: { ...STANDARD, time: { per: 'game', seconds: 60 } } };
  g = apply(g, { type: 'pass', ms: 200000 });              // player 0: 3 min 20 s - 2 min 20 s over: 3 started minutes
  for (let i = 0; i < 3; i++) g = apply(g, { type: 'pass', ms: 1000 });
  const left = en().racks.map(r => r.reduce((a, ch) => a + T.valueOf('en', ch), 0));
  check('time per game: 10 points for every started minute over, at the end', [g.over.late, g.scores], [[30, 0], [-left[0] - 30, -left[1]]]);
  const cpu = { ...perMove, players: [{ cpu: 'easy' }, {}] };
  assert.throws(() => apply(cpu, { type: 'timeout', ms: 60000 }), /computers are not timed/); passed++;
  const cpuPass = apply(cpu, { type: 'pass', ms: 200000 });
  check('computer moves never accumulate clock time', cpuPass.clock, [0, 0]);
  check('computer clock immunity survives replay', replay(cpuPass, () => true).at(-1).clock, [0, 0]);
  // Old saves may already contain a computer clock: it must not cost overtime points.
  const old = { ...cpu, clock: [200000, 200000], rules: { ...STANDARD, time: { per: 'game', seconds: 60 } } };
  const ended = apply(old, { type: 'end' });
  check('only people pay overtime, including old saves', ended.over.late, [0, 30]);

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
  const first = { ...newGame({ lang: 'en', board: 'bonus', players: TWO, first: 0, seed: 5 }), racks: [['r', 'e', 't', 'a', 'i'], []] };
  agree('en, bonus board, first move, 5 tiles', first, 'en');
  const mid = midGame('en', 'classic', 6, 7);
  agree('en, classic board, 6 moves in, 4 tiles', { ...mid, racks: mid.racks.map(r => r.filter(t => t !== BLANK).slice(0, 4)) }, 'en');
  agree('en, classic board, with a blank', { ...mid, racks: mid.racks.map(r => [...r.filter(t => t !== BLANK).slice(0, 2), BLANK]) }, 'en');
  // the rule options change the scores: the finder must still agree with wordsMade
  agree('en, bonus squares every time, no seven-tile bonus', { ...mid, rules: { ...STANDARD, premiums: 'always', bingo: 0 }, racks: mid.racks.map(r => r.filter(t => t !== BLANK).slice(0, 4)) }, 'en');
  const pl = midGame('pl', 'classic', 8, 11);
  agree('pl, classic board, 8 moves in, 4 tiles', { ...pl, racks: pl.racks.map(r => r.filter(t => t !== BLANK).slice(0, 4)) }, 'pl');
  const bonus = midGame('pl', 'bonus', 5, 13);
  agree('pl, bonus board, with a blank', { ...bonus, racks: bonus.racks.map(r => [...r.filter(t => t !== BLANK).slice(0, 2), BLANK]) }, 'pl');
  agree('pl, bonus squares every time, with a blank', { ...bonus, rules: { ...STANDARD, premiums: 'always' }, racks: bonus.racks.map(r => [...r.filter(t => t !== BLANK).slice(0, 2), BLANK]) }, 'pl');
  // the slowest rack there is: two blanks, in Polish (32 letters each), mid-game
  const two = { ...pl, racks: pl.racks.map(r => [...r.filter(t => t !== BLANK).slice(0, 5), BLANK, BLANK]) };
  const t0 = performance.now(), all = findMoves(two, dicts.pl), ms = Math.round(performance.now() - t0);
  check('two blanks: still quick (under 2 s here)', ms < 2000, true);
  console.log(`pl, two blanks, 8 moves in: ${all.length} moves found in ${ms} ms`);
}

// ── whole games, computer against computer: every move legal, every tile accounted for, and how fast ──
const rankOf = lang => w => resolve(lexes[lang], w)?.idx ?? Infinity;
const games = [];
for (const [lang, board, levels, seed, rules = {}] of [['pl', 'classic', ['hard', 'normal'], 21], ['en', 'classic', ['hard', 'easy'], 22],
  ['pl', 'classic', ['relaxed', 'hard'], 23], ['en', 'bonus', ['normal', 'hard'], 24], ['pl', 'bonus', ['easy', 'hard'], 25],
  ['pl', 'classic', ['relaxed', 'easy', 'normal', 'hard', 'hard'], 26], ['en', 'classic', ['normal', 'hard', 'easy'], 27],
  ['pl', 'classic', ['expert', 'hard'], 28], ['en', 'classic', ['expert', 'normal'], 29],
  ['en', 'bonus', ['hard', 'easy'], 30, { check: 'challenge', premiums: 'always', exchange: 'always' }]]) {
  const rand = seeded(seed), isWord = w => has(dicts[lang], w);
  const start = newGame({ lang, board, players: levels.map(cpu => ({ cpu })), seed, words: dicts[lang].tag, rules });
  let s = start;
  const total = fullBag(lang).length, actions = [];
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
  check(`${lang} ${board} game: and rebuilt from its own log`, replay(s, isWord).at(-1), s);
  const r = results(s);
  check(`${lang} ${board} game: computers only - nothing for the people's statistics`, [r.games, r.moves, r.vsCpu], [0, 0, 1]);
  games.push({ s, isWord, lang });
  check(`${lang} ${board} game: the word list's tag kept`, s.words, dicts[lang].tag);
  check(`${lang} ${board} game: every move legal, no tile lost`, ok, true);
  check(`${lang} ${board} game: it ends`, !!s.over, true);
  check(`${lang} ${board} game: scores = moves + the end`, s.scores, byMoves);
  console.log(`${lang} ${board} (${levels.join(' vs ')}): ${turns} turns, ${s.scores.join(':')} (${s.over.reason}), ` +
    `words ${s.moves.filter(x => x.kind === 'play').map(x => x.words[0].w).slice(0, 10).join(' ')}…, ` +
    `computer ${Math.round(sum / turns)} ms a turn on average, ${Math.round(worst)} ms at most`);
}
check('levels: the app\'s four, and Expert for this game', Object.keys(LEVELS), ['relaxed', 'easy', 'medium', 'normal', 'hard', 'expert']);

// ── a computer that plays like a person (owner, 2026-10-12) ──
{
  const spoken = await loadSpoken('pl'), spokenOf = w => spoken.get(w) ?? Infinity, isWord = w => has(dicts.pl, w), rand = seeded(50);
  let s = newGame({ lang: 'pl', players: [{ cpu: 'medium' }, { cpu: 'medium' }], seed: 50, words: dicts.pl.tag });
  let madeOk = true, words = [], multi = 0, plays = 0;
  while (!s.over) {
    if (!findMoves(s, dicts.pl).slice(0, 300).every(m => m.made === wordsMade(s, m.placed).words.length)) madeOk = false;
    const a = computerMove(s, dicts.pl, 'medium', rankOf('pl'), rand, spokenOf);
    if (a.type === 'place') { const w = wordsMade(s, a.placed).words.map(x => x.w); words.push(...w); plays++; if (w.length > 2) multi++; }
    s = apply(s, a, isWord);
  }
  check('a move knows how many words it makes', madeOk, true);
  const two = new Set('as au aż ba bo by ci co da do eh ej go ha hm iż ja je ją ku ma mi mu my na ni no od oh oj ok on oś pa po są ta tą te tę to tu ty uf ul we wy za ze że ów'.split(' '));
  check('Medium: only words people say - of two letters everyday ones, of three among the 4 000 most said, longer among 30 000',
    words.filter(w => w.length === 2 ? !two.has(w) : spokenOf(w) >= (w.length === 3 ? 4000 : 30000)), []);
  check('Medium: a move making three words or more is rare', multi <= plays * 0.1, true);
  check('Medium knows no word-game words: pe, esy, kotą not among the words people say', ['pe', 'esy', 'kotą'].map(w => spoken.has(w)), [false, false, false]);
}

// ── what the computer keeps on its rack ──
check('leave: a blank is worth keeping', leaveValue('en', ['?', 'e']) > leaveValue('en', ['e']), true);
check('leave: heavy letters and doubles are not', [leaveValue('pl', ['ź', 'ń']) < 0, leaveValue('en', ['u', 'u', 'u']) < leaveValue('en', ['u', 'r', 's'])], [true, true]);
check('leave: a balance of vowels and consonants', leaveValue('en', ['a', 'r', 't', 'e']) > leaveValue('en', ['a', 'e', 'i', 'o']), true);

// ── after the game: statistics and the look-back, a person against the computer ──
{
  const isWord = w => has(dicts.pl, w), rand = seeded(40);
  let s = newGame({ lang: 'pl', players: [{ name: 'Ada' }, { cpu: 'normal' }], seed: 40, words: dicts.pl.tag });
  // the person here plays the computer's Hard moves, and takes one hint
  s = hinted(s);
  while (!s.over) s = apply(s, computerMove(s, dicts.pl, s.players[s.turn].cpu ?? 'hard', rankOf('pl'), rand), isWord);
  const r = results(s);
  const mine = s.moves.filter(m => m.p === 0 && m.kind === 'play');
  check('results: one person, against Normal', [r.level, r.games, r.vsCpu, r.hints], ['normal', 1, 1, s.hints[0]]);
  check('results: won = the person beat the computer', r.won, s.over.winner === 0 ? 1 : 0);
  check('results: the person\'s moves and points', [r.moves, r.movePoints, r.bestGame], [mine.length, mine.reduce((a, m) => a + m.score, 0), s.scores[0]]);
  check('results: the best move', r.bestMove.score, Math.max(...mine.map(m => m.score)));
  const t0 = performance.now(), back = lookBack(s, dicts.pl), ms = Math.round(performance.now() - t0);
  check('look-back: every turn the person took', back.length, s.log.filter((a, i) => replay(s, isWord)[i].turn === 0 && a.type !== 'resign').length);
  check('look-back: the best move is never worse than what was played', back.every(x => !x.best || x.best.score >= x.played), true);
  check('look-back: only the person\'s turns', back.every(x => x.p === 0), true);
  console.log(`look-back of ${back.length} turns in ${ms} ms; the person (playing like Hard) scored ${back.reduce((a, x) => a + x.played, 0)} of a best ${back.reduce((a, x) => a + (x.best?.score ?? 0), 0)}`);
  const people = results(newGame({ lang: 'en', players: [{ name: 'A' }, { name: 'B' }], seed: 1 }));
  check('results: people only - level "people", no win against the computer', [people.level, people.vsCpu, people.won, people.games], ['people', 0, 0, 2]);
}

// ── undo (owner, 2026-09-25): one person against the computer takes moves back, the bag shuffled again ──
{
  const isWord = w => has(dicts.pl, w), rand = seeded(7);
  const cpuMove = s => apply(s, computerMove(s, dicts.pl, 'hard', rankOf('pl'), rand), isWord);
  let s = newGame({ lang: 'pl', players: [{ name: 'Ada' }, { cpu: 'normal' }], first: 0, seed: 7, words: dicts.pl.tag, rules: { undo: true } });
  check('undo: nothing to take back before the person has moved', T.undo(s, isWord), null);
  const start = s;
  s = cpuMove(s);          // the person (playing like Hard)
  s = cpuMove(s);          // the computer
  const mid = s;
  s = hinted(cpuMove(cpuMove(s)));
  const back = T.undo(s, isWord, 123);
  check('undo: back to the person\'s last turn - their rack, board and scores as they were', [back.turn, back.racks[0], back.cells, back.scores, back.moves],
    [mid.turn, mid.racks[0], mid.cells, mid.scores, mid.moves]);
  check('undo: the same tiles in the bag, in a new order', [[...back.bag].sort(), back.bag.join('') !== mid.bag.join('')], [[...mid.bag].sort(), true]);
  check('undo: hints used stay counted', back.hints, s.hints);
  check('undo: the shuffle goes into the log, so the game still replays', [back.log.at(-1).type, replay(back, isWord).at(-1).bag], ['shuffle', back.bag]);
  const again = T.undo(back, isWord, 5);
  check('undo again: back to the start, and no further', [again.cells, again.racks[0], again.scores, T.undo(again, isWord)], [start.cells, start.racks[0], start.scores, null]);
  const after = cpuMove(again);
  check('after an undo the game goes on - and the look-back skips the shuffles', [after.moves.length, lookBack(after, dicts.pl).length], [1, 1]);
}

// ── hints in three levels (owner, 2026-09-25): Small, Big, Master ──
{
  const { hintLevels, sameMove } = await import('../app/js/tiles-moves.js');
  const isWord = w => has(dicts.pl, w), rand = seeded(21);
  let s = newGame({ lang: 'pl', players: [{ name: 'Ada' }, { cpu: 'normal' }], first: 0, seed: 21, words: dicts.pl.tag });
  for (let k = 0; k < 4; k++) s = apply(s, computerMove(s, dicts.pl, 'hard', rankOf('pl'), rand), isWord);
  const lv = hintLevels(s, dicts.pl, rankOf('pl'), rand), all = findMoves(s, dicts.pl);
  check('hint Big: the move that scores the most', lv.big.score, Math.max(...all.map(m => m.score)));
  check('hint Small: every word it makes is an everyday one', lv.small && wordsMade(s, lv.small.placed).words.every(x => rankOf('pl')(x.w) < COMMON), true);
  check('hint Small: four tiles at most, and never the best move when the best takes more', [lv.small.placed.length <= 4, lv.big.placed.length <= 4 || !sameMove(lv.small, lv.big)], [true, true]);
  check('hint Small: never more points than Big', lv.small.score <= lv.big.score, true);
  check('hint Master: a legal move', checkMove(s, lv.master.placed, isWord).error, undefined);
  check('the same move, in any order of its tiles', [sameMove(lv.big, { placed: [...lv.big.placed].reverse() }), sameMove(lv.big, null)], [true, false]);
  const none = hintLevels({ ...s, racks: s.racks.map((r, p) => p === s.turn ? ['ź', 'ź'] : r) }, dicts.pl, rankOf('pl'), rand);
  check('no move: all three levels empty', none, { small: null, big: null, master: null });
}

// ── rating a game (owner, 2026-09-26): every player's turns, the computer's too ──
{
  const isWord = w => has(dicts.en, w), rand = seeded(33);
  let s = newGame({ lang: 'en', players: [{ name: 'Ada' }, { cpu: 'easy' }], first: 0, seed: 33, words: dicts.en.tag });
  for (let k = 0; k < 8 && !s.over; k++) s = apply(s, computerMove(s, dicts.en, k % 2 ? 'easy' : 'hard', rankOf('en'), rand), isWord);
  const all = lookBack(s, dicts.en, true), turns = s.log.filter(a => ['place', 'exchange', 'pass', 'timeout'].includes(a.type)).length;
  check('rating a game: every turn of every player', [all.length, new Set(all.map(x => x.p)).size], [turns, 2]);
  check('rating a game: the best move is never worse than what was played', all.every(x => !x.best || x.best.score >= x.played), true);
  check('rating a game: without "everyone", only the person', lookBack(s, dicts.en).every(x => x.p === 0), true);
}

// ── a hint as an action (owner, 2026-09-26): its cost off the score, counted, replayed; a move from it marked ──
{
  const isWord = w => has(dicts.en, w);
  let s = newGame({ lang: 'en', players: [{ name: 'Ada' }, { cpu: 'easy' }], first: 0, seed: 44, words: dicts.en.tag, rules: { hintCost: 'high', undo: true } });
  const best = hint(s, dicts.en), cost = T.hintCost(s.rules, 'big', { big: best });
  check('a hint\'s cost: a share of the move it shows (high, Big: 40 %)', cost, Math.ceil(best.score * 0.4));
  const h = apply(s, { type: 'hint', level: 'big', cost }, isWord);
  check('a hint taken: cost off the score, counted, the turn goes on', [h.scores[0], h.hints[0], h.turn, h.moves.at(-1).kind], [-cost, 1, 0, 'hint']);
  const p = apply(h, { type: 'place', placed: best.placed, hint: 'big' }, isWord);
  check('the move played from it is marked, and so are its tiles', [p.moves.at(-1).hinted, best.placed.every(x => p.cells[x.r * 15 + x.c].hint === 'big')], ['big', true]);
  check('the game still replays, hint and all', replay(p, isWord).at(-1).scores, p.scores);
  check('undo takes the move back, not the hint it cost', T.undo(p, isWord, 9).scores[0], -cost);
  check('the look-back knows the hinted move', lookBack(p, dicts.en).at(-1).hinted, 'big');
  check('no cost without the rule', T.hintCost({}, 'master', { master: { score: 70 } }), 0);
  check('a better hint never costs less than a smaller one', T.hintCost({ hintCost: 'low' }, 'master', { small: { score: 10 }, big: { score: 40 }, master: { score: 20 } }), 8);
}

// Vote cards use logged choices, including the final vote that removes the live proposal.
{
  for (const approval of [false, true]) {
    const base = { ...newGame({ lang: 'en', players: [{}, {}, {}], first: 0, seed: 12,
      rules: { veto: true, wordsVote: approval, vetoNeed: 1, approvalNeed: 1 } }) };
    const isWord = () => !approval;
    const pending = apply(base, { type: 'place', placed: base.racks[0].filter(ch => ch !== BLANK).slice(0, 3).map((ch, k) => ({ r: 7, c: 7 + k, ch })) }, isWord);
    check(`status ${approval}: pending rows`, T.voteStatus(pending).votes, {});
    for (const choice of [false, true]) {
      let state = apply(pending, { type: 'vote', p: 1, veto: choice, at: pending.vote.at }, isWord);
      if (state.vote) state = apply(state, { type: 'vote', p: 2, veto: choice, at: pending.vote.at }, isWord);
      const card = T.voteStatus(state, pending.vote, base.moves.length);
      check(`status ${approval} ${choice}: decisive result`, card.result, approval ? choice : !choice);
      check(`status ${approval} ${choice}: deciding vote from log`, card.votes[1], choice);
      check(`status ${approval} ${choice}: early finish preserves undecided row`, 2 in card.votes, !choice);
      check(`status ${approval} ${choice}: same card on replayed phone`, T.voteStatus(replay(state, isWord).at(-1), pending.vote, base.moves.length), card);
    }
    const silent = apply(pending, { type: 'voteEnd' }, isWord);
    check(`status ${approval}: timeout result`, T.voteStatus(silent, pending.vote, 0).result, !approval);
    check(`status ${approval}: cancellation has no result`, T.voteStatus(apply(pending, { type: 'timeout' }, isWord), pending.vote, 0), null);
  }
}

// ── veto ──
{
  const isWord = () => true, placed = row(7, 7, 'cat');
  const game = (n = 3, rules = {}) => ({ ...newGame({ lang: 'en', players: Array.from({ length: n }, (_, p) => ({ name: `P${p + 1}` })),
    first: 0, seed: 12, rules: { veto: true, ...rules } }), racks: Array.from({ length: n }, () => [...'caters?']), bag: [...'aeiourstn'] });
  const open = (s = game(), extra = {}) => apply(s, { type: 'place', placed, ...extra }, isWord);
  const refuses = (name, s, a, why, words = isWord) => { assert.throws(() => apply(s, a, words), why, name); passed++; };
  const fields = s => [s.cells, s.racks, s.bag, s.scores, s.zeros, s.turn, s.seed, s.moves, s.pending, s.over, s.clock];

  const fresh = newGame({ lang: 'en', players: [{}, {}], first: 0, seed: 12 });
  check('veto: off by default, no vote or turn time added at the start', [STANDARD.veto, fresh.rules.veto, 'vote' in fresh, 'used' in fresh], [false, false, false, false]);
  const five = game(5), mixed = { ...five, players: five.players.map((p, i) => i === 2 ? { ...p, cpu: 'hard' } : p), out: [false, false, false, true, false] };
  check('veto voters: other people only, computers and players out excluded', T.vetoVoters(mixed), [1, 4]);
  check('veto voters: an explicit mover', T.vetoVoters(mixed, 4), [0, 1]);
  check('veto voters: a computer move never waits', T.vetoVoters(mixed, 2), []);
  const old = { ...mixed }; delete old.out;
  check('veto voters: old saves without out still work', T.vetoVoters(old), [1, 3, 4]);
  check('veto need: half rounded up, for 1-4 voters', [1, 2, 3, 4].map(n => T.vetoNeed(n)), [1, 1, 2, 2]);
  check('veto need: host count is clamped to at least one and at most the voters',
    [T.vetoNeed(4, 0), T.vetoNeed(4, 9), T.vetoNeed(4, 3), T.vetoNeed(1, 4), T.vetoNeed(0, 4)], [1, 4, 3, 1, 0]);
  const earlyVeto = apply(open(game(5, { vetoNeed: 1 })), { type: 'vote', p: 1, veto: true, ms: 75 }, isWord);
  check('veto: enough vetoes closes before the other three vote and credits closing ms',
    [earlyVeto.vote, earlyVeto.moves.at(-1).kind, earlyVeto.used], [null, 'vetoed', 75]);
  let impossible = open(game(5, { vetoNeed: 3 }));
  impossible = apply(impossible, { type: 'vote', p: 1, veto: false, ms: 50 }, isWord);
  check('veto: an outcome still possible stays open without crediting ms', [!!impossible.vote, impossible.used], [true, 0]);
  impossible = apply(impossible, { type: 'vote', p: 2, veto: false, ms: 90 }, isWord);
  check('veto: too few possible vetoes accepts before everyone votes', [impossible.vote, impossible.moves.at(-1).kind, impossible.clock[0]], [null, 'play', 90]);
  let dropped = open(game(5, { vetoNeed: 4 }));
  dropped = apply(dropped, { type: 'vote', p: 1, veto: true }, isWord);
  dropped = apply(dropped, { type: 'resign', p: 4 }, isWord);
  check('veto: departing voters clamp the effective count without changing the saved rule', [dropped.rules.vetoNeed, dropped.vote.voters, T.vetoNeed(dropped.vote.voters.length, dropped.rules.vetoNeed)], [4, [1, 2, 3], 3]);
  dropped = apply(dropped, { type: 'vote', p: 2, veto: true }, isWord);
  dropped = apply(dropped, { type: 'resign', p: 3 }, isWord);
  check('veto: departure can make the logged vetoes decisive', [dropped.vote, dropped.moves.at(-1).kind], [null, 'vetoed']);
  const oldRules = game(4); delete oldRules.rules.vetoNeed;
  let oldVote = apply(open(oldRules), { type: 'vote', p: 1, veto: true }, isWord);
  check('veto: old saves still need half the electorate rounded up', !!oldVote.vote, true);
  oldVote = apply(oldVote, { type: 'vote', p: 2, veto: true }, isWord);
  check('veto: old saves close early at their default threshold', [oldVote.vote, oldVote.moves.at(-1).kind], [null, 'vetoed']);
  let custom = newGame({ lang: 'en', players: [{}, {}, {}, {}], first: 0, seed: 12, rules: { veto: true, vetoNeed: 3 } });
  const phones = [custom, custom, custom];
  for (const action of [{ type: 'place', placed: hint(custom, dicts.en).placed }, { type: 'vote', p: 1, veto: false, ms: 80 }]) {
    custom = apply(custom, action, isEn);
    for (let i = 0; i < phones.length; i++) phones[i] = apply(phones[i], action, isEn);
  }
  check('veto: custom rules and early acceptance replay identically across three phones', phones.map(s => JSON.stringify(replay(s, isEn).at(-1))), phones.map(() => JSON.stringify(custom)));

  const alone = { ...game(2), players: [{ name: 'A' }, { cpu: 'hard' }] };
  check('veto: without another person, a normal move', [open(alone).vote, open(alone).moves.at(-1).kind, open(alone).turn], [undefined, 'play', 1]);
  const cpu = { ...alone, turn: 1 };
  check('veto: the computer plays without a vote', [open(cpu).vote, open(cpu).moves.at(-1).kind, open(cpu).turn], [undefined, 'play', 0]);
  const disabled = game(3, { veto: false });
  check('veto off: a normal move with no used field', [open(disabled).vote, open(disabled).moves.at(-1).kind, 'used' in open(disabled)], [undefined, 'play', false]);
  const legacy = { ...disabled, rules: {} };
  check('veto: a save without the rule still plays normally', [open(legacy).moves.at(-1).kind, 'used' in open(legacy)], ['play', false]);

  const s = game(), snapshot = structuredClone(s), a = { type: 'place', placed, hint: 'big', ms: 120 }, v = apply(s, a, isWord);
  check('veto: place opens a vote, changing only the log, clock and used time', v, { ...s, log: [a], clock: [120, 0, 0], used: 120,
    vote: { at: 0, p: 0, placed, hint: 'big', words: [{ w: 'cat', r: 7, c: 7, across: true, score: 10 }], score: 10, bingo: false, voters: [1, 2], votes: {} } });
  check('veto: opening leaves its input unchanged', s, snapshot);
  refuses('veto: the mover cannot vote', v, { type: 'vote', p: 0, veto: true }, /not a voter/);
  refuses('veto: an unknown player cannot vote', v, { type: 'vote', p: 8, veto: true }, /not a voter/);
  refuses('veto: a late vote on another place is refused', v, { type: 'vote', p: 1, veto: true, at: 1 }, /not this vote/);
  refuses('veto: no vote to cast', s, { type: 'vote', p: 1, veto: true }, /no vote is open/);
  refuses('veto: no vote to end', s, { type: 'voteEnd' }, /no vote is open/);
  const voted = apply(v, { type: 'vote', p: 1, veto: false, at: 0, ms: 900 }, isWord);
  const phoneVote = { type: 'vote', p: 1, veto: true, at: v.vote.at };
  check('voteFits: a matching seat and proposal may vote', T.voteFits(v, 1, phoneVote), true);
  check('voteFits: either vote choice fits', T.voteFits(v, 1, { ...phoneVote, veto: false }), true);
  for (const [name, state, seat, action] of [
    ['no vote, including old saves', s, 1, phoneVote], ['closed vote', { ...v, vote: null }, 1, phoneVote],
    ['finished game', { ...v, over: {} }, 1, phoneVote], ['other seat', v, 2, phoneVote],
    ['mover', v, 0, { ...phoneVote, p: 0 }], ['unknown seat', v, 9, { ...phoneVote, p: 9 }],
    ['wrong proposal', v, 1, { ...phoneVote, at: 99 }], ['missing proposal', v, 1, { ...phoneVote, at: undefined }],
    ['already accepted', voted, 1, phoneVote], ['already vetoed', { ...v, vote: { ...v.vote, votes: { 1: true } } }, 1, phoneVote],
    ['not a vote', v, 1, { ...phoneVote, type: 'pass' }], ['missing action', v, 1, null],
  ]) check(`voteFits: ignores ${name}`, T.voteFits(state, seat, action), false);
  check('voteFits: another voter still fits after the first votes', T.voteFits(voted, 2, { ...phoneVote, p: 2 }), true);
  check('veto: a non-closing vote records acceptance and credits no ms', [voted.vote.votes, voted.clock, voted.used, voted.moves, voted.turn], [{ 1: false }, [120, 0, 0], 120, [], 0]);
  check('veto: casting a vote leaves the earlier vote unchanged', v.vote.votes, {});
  refuses('veto: an accept cannot be changed to a veto', voted, { type: 'vote', p: 1, veto: true }, /already voted/);
  for (const type of ['place', 'exchange', 'pass', 'hint', 'challenge', 'shuffle']) refuses(`veto: ${type} is blocked while voting`, v, { type }, /a vote is open/);
  const accepted = apply(voted, { type: 'vote', p: 2, veto: false, ms: 80 }, isWord);
  const normal = apply({ ...s, rules: { ...s.rules, veto: false } }, { ...a, ms: 200 }, isWord);
  check('veto: everyone voting closes, accepting exactly the normal move', [accepted.vote, fields(accepted), accepted.used], [null, fields(normal), 0]);
  check('veto: the accepted hinted move and its tiles keep the hint', [accepted.moves.at(-1).hinted, placed.every(t => accepted.cells[t.r * 15 + t.c].hint === 'big')], ['big', true]);
  const silent = apply(v, { type: 'voteEnd', ms: 80 }, isWord);
  check('veto: voteEnd treats all silence as acceptance and credits ms', [silent.vote, fields(silent)], [null, fields(normal)]);
  // a vote's time is charged to the mover, so it is capped and never negative (security review, 2026-11-14)
  check('veto: voteEnd time capped at 25 s', apply(v, { type: 'voteEnd', ms: 9e9 }, isWord).clock[0] - v.clock[0], 25000);
  check('veto: a closing vote time capped at 25 s', apply(voted, { type: 'vote', p: 2, veto: false, ms: 9e9 }, isWord).clock[0] - voted.clock[0], 25000);
  check('veto: negative or invalid time adds nothing', [-500, NaN, 'x'].map(ms => apply(v, { type: 'voteEnd', ms }, isWord).clock[0] - v.clock[0]), [0, 0, 0]);
  check('veto: giving up out of turn charges the mover no time', apply(v, { type: 'resign', p: 2, ms: 9e9 }, isWord).clock[0] - v.clock[0], 0);
  const partial = apply(v, { type: 'vote', p: 1, veto: false }, isWord);
  check('veto: silence accepts after a partial vote too', apply(partial, { type: 'voteEnd' }, isWord).moves.at(-1).kind, 'play');

  const against = apply(v, { type: 'vote', p: 1, veto: false, ms: 900 }, isWord);
  check('veto: an undecided vote keeps waiting', [!!against.vote, against.moves, against.clock], [true, [], [120, 0, 0]]);
  const vetoed = apply(against, { type: 'vote', p: 2, veto: true, ms: 30 }, isWord);
  check('vetoed: same player and rack, no board, bag, scores or zeros changed', [vetoed.turn, vetoed.racks, vetoed.cells, vetoed.bag, vetoed.scores, vetoed.zeros, vetoed.vote], [s.turn, s.racks, s.cells, s.bag, s.scores, s.zeros, null]);
  check('vetoed: a separate history entry, and the mover keeps the used time', [vetoed.moves, vetoed.used, vetoed.clock], [[{ p: 0, kind: 'vetoed', placed,
    words: [{ w: 'cat', r: 7, c: 7, across: true, score: 10 }], score: 10, vetoes: 1, voters: 2 }], 150, [150, 0, 0]]);
  const again = open(vetoed, { ms: 20 });
  check('vetoed: the same word can be proposed and vetoed again', [again.vote.at, again.used, apply(apply(again, { type: 'vote', p: 1, veto: false }, isWord), { type: 'vote', p: 2, veto: true }, isWord).moves.map(m => m.kind)], [3, 170, ['vetoed', 'vetoed']]);
  for (let n = 1; n <= 4; n++) {
    for (const count of [T.vetoNeed(n) - 1, T.vetoNeed(n)]) {
      let x = open(game(n + 1));
      for (let p = 1; p <= count; p++) x = apply(x, { type: 'vote', p, veto: true }, isWord);
      if (x.vote) x = apply(x, { type: 'voteEnd' }, isWord);
      check(`veto: ${count} vetoes among ${n} voters`, x.moves.at(-1).kind, count >= T.vetoNeed(n) ? 'vetoed' : 'play');
    }
  }
  for (const [tiles, error] of [[[], 'none'], [row(7, 7, 'dog'), 'rack'], [row(0, 0, 'cat'), 'centre'], [row(7, 14, 'cat'), 'outside']]) {
    refuses(`veto: the usual placement check (${error}) still runs`, s, { type: 'place', placed: tiles }, new RegExp('not a legal move: ' + error));
  }
  refuses('veto: an unknown word is refused before a vote opens', s, { type: 'place', placed }, /not a legal move: word/, () => false);

  const challenges = game(3, { check: 'challenge' }), badTiles = row(7, 7, 'cta');
  const badVote = apply(challenges, { type: 'place', placed: badTiles }, isEn);
  check('veto + challenge: words stay unchecked until their usual check', [badVote.vote.words[0].w, badVote.pending, badVote.scores], ['cta', null, [0, 0, 0]]);
  const badPlay = apply(badVote, { type: 'voteEnd' }, isEn), back = apply(badPlay, { type: 'challenge', ms: 15 }, isEn);
  check('veto + challenge: acceptance leaves the normal challenge pending', [badPlay.turn, badPlay.pending.p, badPlay.moves.at(-1).kind, badPlay.vote], [1, 0, 'play', null]);
  check('veto + challenge: a successful challenge restores tiles, bag and scores', [back.cells, back.racks, back.bag, back.scores, back.turn, back.zeros, back.used], [challenges.cells, challenges.racks, challenges.bag, challenges.scores, 1, 1, 15]);
  const goodPlay = apply(open(challenges), { type: 'voteEnd' }, isEn);
  check('veto + challenge: a good word costs its challenger a turn', [apply(goodPlay, { type: 'challenge' }, isEn).turn, apply(goodPlay, { type: 'challenge' }, isEn).moves.at(-1).ok], [2, false]);
  const nextVote = apply(goodPlay, { type: 'place', placed: row(8, 7, 'cat') }, isWord);
  check('veto + challenge: proposing the next move clears the earlier pending challenge', [nextVote.pending, nextVote.vote.p, nextVote.turn], [null, 1, 1]);
  const last = { ...challenges, bag: [], racks: [[...'cat'], ...challenges.racks.slice(1)] };
  refuses('veto + challenge: invalid last tiles are checked before voting', last, { type: 'place', placed: badTiles }, /not a legal move: word/, isEn);
  const lastVote = open(last), lastPlay = apply(lastVote, { type: 'voteEnd', ms: 40 }, isEn);
  check('veto: last tiles wait for acceptance, then finish normally', [lastVote.over, lastVote.racks[0], lastPlay.over.reason, lastPlay.pending, lastPlay.vote, lastPlay.used], [null, [...'cat'], 'out', null, null, 0]);

  const timed = apply(v, { type: 'timeout', ms: 60 }, isWord);
  check('veto: timeout drops the vote and passes with the tiles still on the rack', [timed.vote, timed.turn, timed.racks, timed.cells, timed.zeros, timed.clock, timed.used, timed.moves.at(-1).kind], [null, 1, s.racks, s.cells, 1, [180, 0, 0], 0, 'timeout']);
  const quitMover = apply(open(game(4)), { type: 'resign', p: 0 }, isWord);
  check('veto: mover resigns, dropping the vote and passing the turn', [quitMover.vote, quitMover.turn, quitMover.out, quitMover.cells.every(x => !x), quitMover.moves.at(-1).kind], [null, 1, [true, false, false, false], true, 'resign']);
  let quitting = open(game(4));
  quitting = apply(apply(quitting, { type: 'vote', p: 1, veto: true }, isWord), { type: 'vote', p: 3, veto: false }, isWord);
  quitting = apply(quitting, { type: 'resign', p: 1, ms: 30 }, isWord);
  check('veto: a resigning voter and their previous vote are removed', [quitting.vote.voters, quitting.vote.votes, quitting.turn, quitting.used], [[2, 3], { 3: false }, 0, 0]); // out of turn: no time charged (security review, 2026-11-14)
  quitting = apply(quitting, { type: 'resign', p: 2, ms: 20 }, isWord);
  check('veto: resignation closes when everyone remaining has accepted', [quitting.vote, quitting.moves.map(m => m.kind), quitting.turn, quitting.clock, quitting.used], [null, ['resign', 'resign', 'play'], 3, [0, 0, 0, 0], 0]);
  let shrinking = open(game(4));
  shrinking = apply(apply(shrinking, { type: 'vote', p: 1, veto: true }, isWord), { type: 'vote', p: 2, veto: false }, isWord);
  shrinking = apply(shrinking, { type: 'resign', p: 3 }, isWord);
  check('veto: a smaller electorate uses its new threshold when resignation closes voting', [shrinking.vote, shrinking.turn, shrinking.moves.at(-1).kind, shrinking.moves.at(-1).voters], [null, 0, 'vetoed', 2]);
  const oneVoter = { ...game(), players: [{}, {}, { cpu: 'hard' }] };
  const noneLeft = apply(open(oneVoter), { type: 'resign', p: 1 }, isWord);
  check('veto: no voters left accepts, while the mover and computer play on', [noneLeft.vote, noneLeft.over, noneLeft.turn, noneLeft.moves.at(-1).kind], [null, null, 2, 'play']);
  const withCpu = { ...game(4), players: [{}, {}, { cpu: 'hard' }, {}] }, cpuVote = open(withCpu);
  refuses('veto: a computer cannot cast a vote', cpuVote, { type: 'vote', p: 2, veto: true }, /not a voter/);
  check('veto: a computer resigning leaves the electorate unchanged', apply(cpuVote, { type: 'resign', p: 2 }, isWord).vote, cpuVote.vote);
  const outVote = open({ ...game(4), out: [false, true, false, false] });
  refuses('veto: a player out of the game cannot vote', outVote, { type: 'vote', p: 1, veto: true }, /not a voter/);
  for (const p of [0, 1]) {
    const ended = apply(open(game(2)), { type: 'resign', p }, isWord);
    check(`veto: resignation of player ${p} ending the game drops the vote`, [ended.vote, ended.over.reason, ended.cells.every(x => !x), ended.used], [null, 'resign', true, 0]);
  }
  const ended = apply(v, { type: 'end', ms: 30 }, isWord);
  check('veto: ending the game drops the unscored word and resets used', [ended.vote, ended.over.reason, ended.cells, ended.used, ended.clock], [null, 'ended', s.cells, 0, [150, 0, 0]]);
  check('veto: statistics ignore vetoed moves', [results(vetoed).moves, results(vetoed).movePoints, results(vetoed).bestMove, results(vetoed).bingos], [0, 0, null, 0]);
  const bingo = open({ ...game(), racks: [[...'caters?'], ...game().racks.slice(1)] }, { placed: row(7, 4, 'catersx', [6]) });
  check('veto: a seven-tile move carries its score and bingo while voting', [bingo.vote.bingo, bingo.vote.score, bingo.racks[0].length], [true, wordsMade(game(), row(7, 4, 'catersx', [6])).score, 7]);

  let clocked = apply(game(), { type: 'hint', level: 'small', ms: 30 }, isWord);
  clocked = open(clocked, { ms: 70 });
  clocked = apply(clocked, { type: 'vote', p: 1, veto: false, ms: 400 }, isWord);
  clocked = apply(clocked, { type: 'vote', p: 2, veto: true, ms: 60 }, isWord);
  check('veto used: hints, placement and closing vote accumulate across a veto', [clocked.used, clocked.clock], [160, [160, 0, 0]]);
  clocked = apply(open(clocked, { ms: 40 }), { type: 'voteEnd', ms: 50 }, isWord);
  check('veto used: acceptance resets used but keeps the total clock', [clocked.used, clocked.clock, clocked.turn], [0, [250, 0, 0], 1]);
  clocked = apply(clocked, { type: 'hint', level: 'small', ms: 20 }, isWord);
  check('veto used: the next player starts their own turn time', clocked.used, 20);
  clocked = apply(clocked, { type: 'pass', ms: 10 }, isWord);
  check('veto used: a pass resets used too', [clocked.used, clocked.clock, clocked.turn], [0, [250, 30, 0], 2]);

  // A real starting rack and dictionary make replay and the look-back exercise the complete action log.
  let live = newGame({ lang: 'en', players: [{}, {}, {}], first: 0, seed: 12, words: dicts.en.tag, rules: { veto: true } });
  const first = hint(live, dicts.en).placed;
  live = apply(live, { type: 'hint', level: 'big', ms: 10 }, isEn);
  live = apply(live, { type: 'place', placed: first, ms: 20 }, isEn);
  check('veto replay: an open vote rebuilds identically', replay(live, isEn).at(-1), live);
  live = apply(live, { type: 'vote', p: 1, veto: false, at: 1, ms: 900 }, isEn);
  live = apply(live, { type: 'vote', p: 2, veto: true, at: 1, ms: 40 }, isEn);
  check('veto look-back: a vetoed placement is no turn', lookBack(live, dicts.en), []);
  live = apply(live, { type: 'place', placed: first, hint: 'big', ms: 50 }, isEn);
  live = apply(live, { type: 'voteEnd', ms: 20 }, isEn);
  live = apply(live, { type: 'place', placed: hint(live, dicts.en).placed, ms: 30 }, isEn);
  check('veto look-back: an open vote is not rated yet', lookBack(live, dicts.en).map(m => m.i), [4]);
  live = apply(live, { type: 'timeout', ms: 50 }, isEn);
  live = apply(live, { type: 'place', placed: hint(live, dicts.en).placed, ms: 60 }, isEn);
  live = apply(live, { type: 'resign', p: 0 }, isEn);
  live = apply(live, { type: 'vote', p: 1, veto: false, ms: 25 }, isEn);
  live = apply(live, { type: 'end', ms: 15 }, isEn);
  check('veto replay: votes, vetoes, silence, timeout and resignation rebuild the identical state', replay(live, isEn).at(-1), live);
  const backLook = lookBack(live, dicts.en);
  check('veto look-back: only accepted moves and the timeout are turns', backLook.map(m => [m.i, m.p, m.kind]), [[4, 0, 'place'], [7, 1, 'timeout'], [8, 2, 'place']]);
  check('veto look-back: an accepted move is rated normally, with its hint', [backLook[0].played, backLook[0].hinted, backLook[0].best.score >= backLook[0].played], [live.moves.find(m => m.kind === 'play').score, 'big', true]);
  check('veto results: only accepted plays count', results(live).moves, 2);
}

// Exercise the screen's actual action, vote, rack and clock functions without a browser.
{
  const source = readFileSync(new URL('../app/js/tiles-game.js', import.meta.url), 'utf8');
  const { t, esc, clock, setLang } = await import('../app/js/i18n.js');
  const playerIcon = () => '<svg></svg>';
  const part = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
  const code = part('  function seeVote()', '  // The move as it stands:')
    + part('  const myTurn =', '  // several phones: every seat')
    + part('  const mmss =', '  // ── painting')
    + part('  function paintClock()', '  function paintBoard()')
    + part('  function paintRack()', '  // the panel: history')
    + part('  function resetTurn(', '  // the game\'s statistics record:');
  const nextCode = part('  function next(', '  // The computer\'s turn:');
  const ratings = part('const BANDS =', '// The bonus squares').replace(/^export /gm, '');
  const linkCode = part('  function linkLine()', '  function paintRack()');
  const cards = part('  const meaningWord =', '  let meaningBusy =') + part('  const cardWords =', '  function paintSay()');
  const history = part('  function histHtml(', '  function unseenHtml()');
  const board = part('export function boardInner(', 'export async function tilesGameScreen(').replace('export ', '');
  const topics = part('export function topics(', '// Check a word').replace('export ', '');
  const tickCode = part('  const tick = setInterval', '  // just joined (the Join screen)');
  const plain = x => JSON.parse(JSON.stringify(x));
  function screen(players = 2, rules = {}) {
    let now = 100000;
    const S = { ...newGame({ lang: 'en', players: Array.from({ length: players }, (_, p) => ({ name: `P${p + 1}` })), first: 0, seed: 12, rules: { veto: true, ...rules } }),
      racks: Array.from({ length: players }, () => [...'caters?']), bag: [...'aeiourstn'] };
    const chip = { textContent: '', classList: { toggle(k, on) { chip[k] = on; } } }, number = chip;
    const otherChip = { textContent: '', classList: { toggle() {} } };
    const ctx = { S, game: { state: S, turnMs: 120, evals: [], link: { id: 'game' } }, t, esc, clock, apply, isWord: () => true, voteFits: T.voteFits, voteCertain: T.voteCertain, voteStatus: T.voteStatus,
      Date: { now: () => now }, VOTE_MS: 20000, voteAt: null, seenAt: 0, sentVote: null, lastVote: null, voteMoveAt: 0, voteResult: null, frozenLive: null, linked: false, host: false, linkMe: 0, solo: -1, open: false,
      gone: () => ctx.missing ?? [], missing: [],
      remoteMs: 0, STILL_THINKING_MS: 30000, away: [], goneSince: [], linkNote: '', linkHtml: '', linkDraft: null, sentDraft: null,
      isOut: p => !!T.outOf(ctx.S)[p], say: { querySelector: () => linkLine },
      shown: 0, thinking: false, toast: false, handOver: false, linkUp: true, ended: '', party: null,
      tilesMoveCue, turnCuePending: false, cues: [], playCue: cue => ctx.cues.push(cue),
      draft: [], stashedDraft: null, sel: -1, mode: 'play', picks: new Set(), levels: null, cursor: null, blankFor: -1, turnHints: ['remember hint'], redoStack: [],
      press: null, rackGap: -1, fresh: null, msg: null, landing: null, n: 15, lang: 'en', settings: {}, dict: {}, histOf: null,
      BLANK, STANDARD, wordsMade, LABEL: { d: 'l2', t: 'l3', D: 'w2', T: 'w3' }, sizeOf, premiums, centre: T.centre, valueOf: T.valueOf,
      playerIcon, nameOf: (s, p) => s.players[p].name, cpu: p => !!ctx.S.players[p].cpu, remote: p => ctx.linked && p !== ctx.linkMe, netOk: () => true,
      rackOf: p => [...ctx.S.racks[p]], inDraft: i => ctx.draft.some(d => d.slot === i),
      rackEl: { innerHTML: '' }, dock: { innerHTML: '' }, voteEl: { hidden: true, innerHTML: '', querySelectorAll: () => [], addEventListener: (_, fn) => { ctx.voteClick = fn; } },
      status: { querySelector: s => s === '.ps.pc0 .tm' ? chip : otherChip }, play: { classList: { toggle() {} } }, app: { isConnected: true },
      timers: [], setTimeout: fn => { ctx.timers.push(fn); ctx.clearNotice = fn; }, document: { visibilityState: 'visible' }, setInterval: fn => { ctx.tickNow = fn; return 1; }, clearInterval() {},
      refit() {}, zoomOut() {}, paintSay() {}, paintAll: () => ctx.paintVote(), think() {}, putSave() {}, finish() {}, countAchievements() {}, quiet() {},
      statsNow: () => ({}), recorded: 0, drawn: [], evaluated: [], recordMove: () => ctx.recorded++, noteMove() {},
      drew: (...args) => ctx.drawn.push(args), familiar: null,
      findMoves: s => { ctx.evaluated.push(s); return [{ score: 20, word: 'cat' }]; },
      evaluateMoves: (s, moves) => ({ best: moves[0].score, word: moves[0].word }),
      rateOn: () => false, rareOn: () => false, bestOn: () => false, bonusMark: () => '', wordLink: w => esc(w), count() {}, ICON: { hint: '' } };
    const linkLine = { outerHTML: '' };
    runInNewContext(ratings + code + nextCode + linkCode + cards + history + board + topics + tickCode
      + '\nthis.turnTime = turnMs; this.totalTime = timeOf; this.canMove = myTurn; this.card = () => moveCard(S.moves.length - 1, "me"); this.latest = lastMove;', ctx);
    ctx.advance = ms => { now += ms; };
    ctx.number = number; ctx.chip = chip; ctx.linkLineEl = linkLine;
    return ctx;
  }
  for (const lang of ['en','pl']) {
    setLang(lang);
    const frozen = screen();
    frozen.linked = true;
    frozen.linkUp = false;
    frozen.frozenLive = 3200;
    frozen.S = { ...frozen.S, vote: { at: 0 } };
    frozen.advance(9000);
    frozen.tickNow();
    check(`${lang}: host gone freezes vote time on score card`, frozen.turnTime(), 3200);
    check(`${lang}: host gone freezes total elapsed time`, frozen.totalTime(0), 3200);
    frozen.S = { ...frozen.S, vote: null };
    frozen.tickNow();
    check(`${lang}: host gone freezes ordinary turn time`, frozen.game.turnMs, 120);
    for (const kind of ['bt', 'lan', 'near', 'web']) {
      check(`${lang}: ${kind} local disconnection translated`, t('net.disconnected.' + kind).includes('net.disconnected.'), false);
    }
    check(`${lang}: host disconnected translated`, t('net.hostDisconnected').includes('net.hostDisconnected'), false);
    const disconnected = screen(2, { veto: false, wordsVote: true });
    disconnected.linked = true; disconnected.host = true;
    disconnected.party = { flush() {} };
    disconnected.missing = [1];
    disconnected.S = { ...disconnected.S, racks: [['h','p'], disconnected.S.racks[1]] };
    disconnected.isWord = () => false;
    disconnected.act({ type: 'place', placed: row(7,7,'hp') });
    check(`${lang}: approval voter shows lost connection`, disconnected.voteEl.innerHTML.includes(t('net.noConnectionShort')), true);
    check(`${lang}: disconnected voter has no choosing spinner`, disconnected.voteEl.innerHTML.includes('tl-vote-state choosing'), false);
    check(`${lang}: approval silence reminder`, disconnected.voteEl.innerHTML.includes(t('tiles.approval.disconnected')), true);
    disconnected.advance(20000); disconnected.act({ type: 'voteEnd' }, true);
    disconnected.msg = null;
    check(`${lang}: rejected approval card says not approved`, disconnected.card().includes(t('tiles.hist.notApproved')), true);
    check(`${lang}: rejected approval card does not say vetoed`, disconnected.card().includes(t('tiles.hist.vetoed')), false);
    check(`${lang}: rejected approval history says not approved`, disconnected.histHtml().includes(t('tiles.hist.notApproved')), true);
  }
  setLang('en');
  const sound = screen(3, { veto: false });
  sound.linked = true;
  sound.solo = sound.linkMe = 0;
  sound.act({ type: 'pass' });
  check('own Tiles move is silent', sound.cues, []);
  sound.act({ type: 'pass' }, true);
  check('a remote move before another remote turn plays once', sound.cues, ['move']);
  sound.act({ type: 'pass' }, true);
  sound.next();
  check('a remote move into my turn plays only the turn cue, once', sound.cues, ['move', 'turn']);

  // The observer's estimate never creates an action or changes the logged time (owner, 2026-11-26).
  for (const [lang, moving, placing, still] of [
    ['en', 'is moving', 'is laying out a word', 'is still thinking'],
    ['pl', 'wykonuje ruch', 'układa słowo', 'wciąż myśli'],
  ]) {
    setLang(lang);
    const c = screen(3, { veto: false });
    c.linked = true; c.linkMe = c.solo = c.shown = 1;
    c.S.players[0].name = '<Mami>';
    c.tickNow();
    const line = () => c.linkLineEl.outerHTML;
    check(`${lang}: observer clock ticks without recording time`, [c.chip.textContent, c.S.clock[0], c.game.turnMs], ['0:01', 0, 120]);
    check(`${lang}: turn status has person icon, escaped bold name and three dots`,
      /class="tl-player-icon pc0"[^>]*><svg/.test(line()) && line().includes(`<strong>&lt;Mami&gt;</strong> ${moving}`) && line().includes('<i></i><i></i><i></i>'), true);
    const activity = { id: 'game', n: 0, placing: true };
    check(`${lang}: activity must match the round, action log and mover`,
      [c.receiveDraft({ ...activity, id: 'old' }), c.receiveDraft({ ...activity, n: 1 }), c.receiveDraft(activity, 2), c.receiveDraft(activity)],
      [false, false, false, true]);
    for (let i = 1; i < 30; i++) c.tickNow();
    check(`${lang}: placed tiles take priority over thinking`, line().includes(placing), true);
    c.receiveDraft({ ...activity, placing: false });
    check(`${lang}: clearing the draft after 30 seconds shows still thinking`, [c.chip.textContent, line().includes(still)], ['0:30', true]);
    c.away[0] = true; c.tickNow();
    check(`${lang}: remote clock pauses while the mover is in another app`, c.chip.textContent, '0:30');
    c.away[0] = false; c.missing = [0]; c.tickNow();
    check(`${lang}: remote clock pauses while the mover is disconnected`, c.chip.textContent, '0:30');
    c.missing = []; c.act({ type: 'pass', ms: 29500 }, true); c.tickNow();
    check(`${lang}: logged time replaces the estimate at handover`, [c.totalTime(0), c.turnTime()], [29500, 1000]);
  }
  setLang('en');
  const scoreless = screen();
  scoreless.act({ type: 'pass' });
  scoreless.act({ type: 'exchange', tiles: [scoreless.S.racks[scoreless.S.turn][0]] });
  check('live pass and exchange are saved without searching for a benchmark',
    [scoreless.S.moves.map(m => m.kind), plain(scoreless.game.evals), scoreless.evaluated.length], [['pass', 'swap'], [null, null], 0]);
  const timedRemote = screen(2, { time: { per: 'move', seconds: 1 } });
  timedRemote.linked = timedRemote.host = true; timedRemote.linkMe = 1;
  timedRemote.tickNow(); timedRemote.tickNow();
  check('remote per-move countdown does not time out from the watching host', [timedRemote.chip.textContent, timedRemote.S.log.length], ['−0:01', 0]);
  const mover = screen(), flags = [];
  mover.linked = true; mover.party = { draft: m => flags.push(plain(m)) };
  mover.sendDraft();
  mover.draft = row(7, 7, 'cat'); mover.sendDraft(); mover.sendDraft();
  mover.draft = []; mover.sendDraft();
  check('only first placement and final recall send draft activity', flags,
    [{ id: 'game', n: 0, placing: true }, { id: 'game', n: 0, placing: false }]);
  const placed = row(7, 7, 'cat');
  {
    const c = screen(2, { veto: false });
    c.S.cells[6 * 15 + 7] = { ch: 'x', by: 1 };
    c.S.cells[6 * 15 + 9] = { ch: 'z', by: 1 };
    const draft = row(7, 7, 'cat');
    const result = checkMove(c.S, draft, w => w === 'cat');
    check('multiple wrong words: all returned together', result.bad, ['xc', 'zt']);
    const html = c.boardInner(c.S, { draft, badWords: result.bad });
    const marked = [...html.matchAll(/<b class="([^"]*)" data-i="(\d+)"/g)]
      .filter(m => m[1].split(' ').includes('bad')).map(m => +m[2]).sort((a, b) => a - b);
    check('multiple wrong words: existing and new cells marked, valid-only cell spared', marked, [97, 99, 112, 114]);
    check('multiple wrong words: correcting the draft clears marks', c.boardInner(c.S, { draft }).includes(' bad'), false);
    const played = apply({ ...c.S, rules: { ...c.S.rules, check: 'challenge' } }, { type: 'place', placed: draft }, () => true);
    c.S = apply(played, { type: 'challenge' }, w => w === 'cat');
    for (const lang of ['en', 'pl']) {
      setLang(lang);
      const report = c.report({ type: 'challenge' }, 1);
      check(`${lang}: challenge lists every wrong word`, report.html.includes('XC, ZT'), true);
      check(`${lang}: rejection message lists every wrong word`, t('tiles.err.unknown', { w: 'XC, ZT' }).includes('XC, ZT'), true);
    }
  }
  for (const lang of ['en', 'pl']) {
    setLang(lang);
    const c = screen();
    c.act({ type: 'place', placed });
    check(`${lang} screen: a proposal waits without drawing, recording or passing the device`, [!!c.S.vote, c.canMove(), c.recorded, c.drawn.length, c.handOver, c.shown, c.S.used], [true, false, 0, 0, false, -1, 120]);
    c.paintRack(); c.paintDock();
    check(`${lang} screen: the shared-device rack is hidden and tools are off during voting`, [(c.rackEl.innerHTML.match(/visibility:hidden/g) ?? []).length, /data-slot|rt used/.test(c.rackEl.innerHTML), c.dock.innerHTML], [7, false, '']);
    const boardHtml = c.boardInner(c.S);
    check(`${lang} screen: proposed board tiles have their own look`, [(boardHtml.match(/class="t voting/g) ?? []).length, /class="t (new|hint|last)/.test(boardHtml)], [3, false]);
    check(`${lang} screen: shared vote shows both choices without a pending spinner`,
      [c.voteEl.hidden, (c.voteEl.innerHTML.match(/data-voter="1"/g) ?? []).length,
        c.voteEl.innerHTML.includes('tl-vote-state choosing'), c.voteEl.innerHTML.includes('aria-valuenow="20"')], [false, 2, false, true]);
    c.advance(5000); c.paintVote();
    check(`${lang} screen: repaint preserves first-seen time and shrinks the countdown`, [c.voteEl.innerHTML.includes('aria-valuenow="15"'), c.voteEl.innerHTML.includes('width:75%'), c.turnTime(), c.totalTime(0)], [true, true, 5120, 5120]);
    c.game.turnMs = 999;   // vote ms must never be overwritten by the mover's old accumulator
    c.voteClick({ target: { closest: () => ({ disabled: false, dataset: { voter: '1', veto: 'true' } }) } });
    check(`${lang} screen: veto keeps time, rack and hints, then hands back to the mover`, [c.S.moves.at(-1).kind, c.S.used, c.S.log.at(-1).ms, c.S.turn, c.handOver, c.shown, plain(c.turnHints), c.recorded, c.drawn.length], ['vetoed', 5120, 5000, 0, true, -1, ['remember hint'], 0, 0]);
    check(`${lang} screen: veto has an error message, a quiet history row and no points`, [c.msg.err, c.msg.html.includes('CAT'), c.msg.html.includes('P1'), c.histHtml().replace(/<[^>]*>/g, '').includes(`cat · ${t('tiles.hist.vetoed')}`), c.card().includes(t('tiles.hist.vetoed')), c.card().includes('<span class="pt">–</span>'), c.latest(() => true)], [true, true, true, true, true, true, 0]);
    c.clearNotice();
    check(`${lang} screen: veto notice clears itself`, c.msg, null);
    c.handOver = false; c.shown = 0; c.game.turnMs = 200;
    c.act({ type: 'place', placed });
    check(`${lang} screen: a re-move starts its own twenty-second window`, c.voteEl.innerHTML.includes('aria-valuenow="20"'), true);
    c.advance(800); c.castVote(1, false);
    check(`${lang} screen: acceptance scores, draws, records and animates the played move`, [c.S.moves.at(-1).kind, c.S.vote, c.S.turn, c.recorded, c.drawn.length, plain(c.drawn[0][2]), plain(c.landing), plain(c.game.evals.at(-1)), c.voteEl.hidden], ['play', null, 1, 1, 1, [...'cat'], [112, 113, 114], { best: 20, word: 'cat' }, false]);
    check(`${lang} screen: acceptance hands over with the next rack hidden`, [c.handOver, c.shown], [true, -1]);
    check(`${lang} screen: accepted result stays visible briefly`, c.voteEl.innerHTML.includes(t('tiles.vote.accepted')), true);
    c.timers.at(-1)();
    check(`${lang} screen: result card closes after its timer`, [c.voteEl.hidden, c.voteEl.innerHTML], [true, '']);
    check(`${lang} screen: only the accepted turn is rated, on its original board`, [c.evaluated.length, c.evaluated[0]?.cells.some(Boolean)], [1, false]);
    const chapters = rules => [...c.topics(rules).matchAll(/<summary>(.*?)<span.*?<\/summary>(.*?)<\/details>/g)].map(([, name, body]) => [name, body]);
    const basics = ['goal', 'turn', 'points', 'blank', 'swap', 'end'];
    const off = t('howto.tiles.off'), optional = t('howto.tiles.optional');
    const standard = chapters({});
    check(`${lang} screen: standard guide puts the goal first and labels every optional rule`,
      standard.map(([name, body]) => [name, body.includes(off)]),
      [...basics, 'hints', 'challenge', 'clock', 'veto'].map((key, i) => [t('howto.tiles.' + key), i >= basics.length]));
    const custom = chapters({ check: 'challenge', veto: true, exchange: 'always', premiums: 'always', bingo: 0 });
    check(`${lang} screen: active rules before inactive rules`, custom.slice(basics.length).map(([name, body]) => [name, body.includes(off)]),
      ['challenge', 'veto', 'hints', 'clock'].map((key, i) => [t('howto.tiles.' + key), i >= 2]));
    check(`${lang} screen: setup describes optional rules without saying they are off`,
      chapters().slice(basics.length).map(([name, body]) => [name, body.includes(optional), body.includes(off)]),
      ['challenge', 'clock', 'veto'].map(key => [t('howto.tiles.' + key), true, false]));
    check(`${lang} screen: custom scoring, checking and exchange rules are reflected`,
      [custom[1][1].includes(t('howto.tiles.turn.check.challenge')), custom[2][1].includes(t('howto.tiles.points.always')),
        custom[2][1].includes(t('howto.tiles.points.bingo', { n: STANDARD.bingo })), custom[4][1].includes(t('howto.tiles.swap.always'))],
      [true, true, false, true]);
    check(`${lang} screen: default scoring retains the seven-tile bonus`, standard[2][1].includes(t('howto.tiles.points.bingo', { n: STANDARD.bingo })), true);
  }
  setLang('en');
  const vetoPhones = [0, 1, 2].map(seat => {
    const phone = screen(4, { vetoNeed: 1 });
    phone.linked = true; phone.linkMe = phone.solo = seat; phone.party = { flush() {} };
    return phone;
  });
  for (const phone of vetoPhones) {
    phone.act({ type: 'place', placed, ms: 120 }, true);
    phone.act({ type: 'vote', p: 1, veto: true, at: 0, ms: 200 }, true);
  }
  check('screen: every phone sees the vetoed word and player, including uninvolved voters', vetoPhones.map(p => p.msg.html), vetoPhones.map(() => t('tiles.say.vetoed', { name: 'P1', w: 'CAT' })));
  check('screen: every phone shows the deciding vote and result', vetoPhones.map(p => [p.voteEl.hidden, p.voteEl.innerHTML.includes('tl-vote-state no'), p.voteEl.innerHTML.includes(t('tiles.vote.vetoed')), p.voteEl.innerHTML.includes('data-voter=')]), vetoPhones.map(() => [false, true, true, false]));
  check('screen: only undecided voters see the unneeded notice', vetoPhones.map(p => p.voteEl.innerHTML.includes(t('tiles.vote.unneeded'))), [false, false, true]);
  check('screen: early veto has the same state on every phone', vetoPhones.map(p => JSON.stringify(p.S)), vetoPhones.map(() => JSON.stringify(vetoPhones[0].S)));
  vetoPhones.forEach(p => p.clearNotice());
  check('screen: every phone clears its transient veto notice', vetoPhones.map(p => p.msg), [null, null, null]);
  const everyone = screen();
  everyone.open = true; everyone.act({ type: 'place', placed }); everyone.paintRack();
  check('screen: open-rack games retain the visible rack and mark proposed tiles used', [everyone.shown, (everyone.rackEl.innerHTML.match(/rt used/g) ?? []).length], [0, 3]);
  const multi = screen(3);
  multi.act({ type: 'place', placed }); multi.advance(1000); multi.castVote(1, false);
  check('screen: a shared voter loses buttons but keeps their logged status', [multi.voteEl.innerHTML.includes('data-voter="1"'), multi.voteEl.innerHTML.includes(t('tiles.veto.voted')), multi.voteEl.innerHTML.includes('data-voter="2"')], [false, false, true]);
  const guest = screen(3), proposals = [];
  guest.linked = true; guest.linkMe = guest.solo = 1;
  guest.party = { propose: (...a) => proposals.push(plain(a)), flush() {} };
  guest.act({ type: 'place', placed, ms: 120 }, true);
  check('screen: a linked voter retains only their own rack', guest.shown, 1);
  const before = JSON.stringify(guest.S);
  guest.advance(500); guest.castVote(2, true); guest.castVote(1, false); guest.castVote(1, true);
  check('screen: a guest sends only its own vote once, waiting for the echo', [JSON.stringify(guest.S), proposals, guest.voteEl.innerHTML.includes('data-voter='), guest.voteEl.innerHTML.includes('P2') && guest.voteEl.innerHTML.includes('P3') && (guest.voteEl.innerHTML.match(/tl-vote-state choosing/g) ?? []).length === 2], [before, [[1, { type: 'vote', p: 1, veto: false, at: 0, ms: 500 }]], false, true]);
  guest.advance(21000); guest.tickNow();
  check('screen: a guest updates the clock after expiry without closing the vote', [JSON.stringify(guest.S), guest.chip.textContent, guest.game.turnMs], [before, '0:21', 0]);
  for (const [name, rules, elapsed, host] of [['silence', {}, 20000, false], ['host silence', {}, 20000, true], ['timeout', { time: { per: 'move', seconds: 2 } }, 1900, true]]) {
    const c = screen(2, rules);
    c.linked = c.host = host; c.party = host ? { flush() {} } : null;
    c.act({ type: 'place', placed }); c.advance(elapsed); c.tickNow();
    check(`screen ${name}: only authority logs the correct closing action and elapsed ms`, [c.S.vote, c.S.log.at(-1).type, c.S.log.at(-1).ms, c.S.clock[0]], [null, name === 'timeout' ? 'timeout' : 'voteEnd', elapsed, elapsed + 120]);
  }
  const timed = screen(2, { time: { per: 'move', seconds: 2 } });
  timed.act({ type: 'place', placed }); timed.advance(1000); timed.paintClock();
  check('screen clock: used and vote time both count against a move', timed.number.textContent, '0:01');
  timed.castVote(1, true); timed.handOver = false; timed.shown = 0; timed.tickNow();
  check('screen clock: used survives a veto and the next tick times the mover out', [timed.S.moves.at(-1).kind, timed.S.clock[0], timed.S.turn], ['timeout', 2120, 1]);
  const gameClock = screen(2, { time: { per: 'game', seconds: 10 } });
  gameClock.act({ type: 'place', placed }); gameClock.advance(1000); gameClock.paintClock();
  check('screen clock: per-game time includes vote time without counting used twice', [gameClock.number.textContent, gameClock.totalTime(0)], ['0:09', 1120]);
  gameClock.advance(12000); gameClock.paintClock();
  check('score-card countdown shows negative game overtime and red low time', [gameClock.chip.textContent, gameClock.chip.low], ['−0:04', true]);
  const cpuClock = screen(2, { time: { per: 'move', seconds: 0.01 } });
  cpuClock.S.players[0].cpu = 'easy';
  cpuClock.tickNow();
  check('computer turn ignores even a tiny move limit', [cpuClock.S.log.length, cpuClock.game.turnMs, cpuClock.chip.textContent], [0, 120, '']);

}

// New game's actual rendering, rule clicks, player changes and Start normalisation.
{
  const source = readFileSync(new URL('../app/js/screens.js', import.meta.url), 'utf8');
  const { t, esc, setLang, LANG_NAMES } = await import('../app/js/i18n.js');
  const { botLevelIcon } = await import('../app/js/bot-level-icons.js');
  const code = source.slice(source.indexOf('const TL_NEW ='), source.indexOf('// ── Tiles: Play online')).replace('export function tilesNewScreen', 'function tilesNewScreen');
  class Element {
    constructor(dataset = {}) { this.dataset = dataset; this.children = new Map(); this.listeners = {}; this.classList = { toggle() {} }; }
    querySelector(s) { if (!this.children.has(s)) this.children.set(s, new Element()); return this.children.get(s); }
    querySelectorAll() { return []; }
    setAttribute() {}
    addEventListener(type, fn) { this.listeners[type] = fn; }
    closest() { return this; }
    fire(dataset) { this.listeners.click({ target: new Element(dataset) }); }
  }
  for (const lang of ['en', 'pl']) {
    setLang(lang);
    for (const [kind, cpus, expected] of [['alone', [null, 'medium'], false], ['friends', [null, null], true], ['computers', ['easy', 'hard'], false], ['online', [null, 'medium'], true]]) {
      const root = new Element(), ctx = { root, UI_ICONS, setupPractice, STANDARD, BOARDS, LABEL: { d: 'l2', t: 'l3', D: 'w2', T: 'w3' }, LEVEL_ORDER: T.LEVEL_ORDER, PLAYERS_MAX: T.PLAYERS_MAX,
        t, esc, LANG_NAMES, playerIcon: () => '<svg></svg>', botLevelIcon, TILE_SETUP_ICONS: { dice: '<svg></svg>', addPlayer: '<svg></svg>' }, levelKey: T.levelKey, fullBag, settings: { lang, newGame: {}, tilesRate: false }, on: b => b ? 'on' : '', DOT: ' · ', LIST_OF: { tiles: '' },
        remembered: () => ({ board: kind === 'friends' ? 'bonus' : 'classic', players: cpus.map((cpu, p) => ({ name: kind === 'friends' ? `Player ${p + 1}` : '', cpu })), first: 0, rules: { rating: false, veto: true } }),
        nameOf: (_, p) => `P${p + 1}`, topbar: () => '', modeTag: () => '', screenTitle: () => '', howTo: () => '', nameField: () => '',
        tileSeg: () => '', bonusSeg: () => '', boardStyleSeg: () => '', fitAll() {}, saveSettings() {}, remember() {},
        loadTileWords: async () => ({ tag: 1 }), tilesGame: o => { ctx.created = o; return newGame(o); }, newGame: o => ({ ...o, id: 'new' }),
        typedName: () => '', netKinds: () => ['web'], location: { replace() {} }, hostKind: kind === 'online' ? 'web' : null };
      runInNewContext(code + '\ntilesNewScreen(root, null, () => {}, hostKind);', ctx);
      const assists = root.querySelector('.assists-body');
      check(`${lang}/${kind}: Veto is offered only with other people`, assists.innerHTML.includes('data-rule="veto"'), expected);
      check(`${lang}/${kind}: Veto stays outside the records warning`, root.querySelector('.help-warn').hidden, true);
      check(`${lang}/${kind}: Veto alone does not make own rules`, root.querySelector('.tl-rules .state').textContent, t('tiles.rules.standard'));
      check(`${lang}/${kind}: Start stands alone`, /<div class="cta">\s*<button[^>]+type="submit"><\/button>\s*<\/div>/.test(root.innerHTML), true);
      check(`${lang}/${kind}: the Look section has a translated heading`, root.innerHTML.includes(`${UI_ICONS.display}${lang === 'pl' ? 'Wygląd' : 'Look'}</summary>`), true);
      if (expected) {
        check(`${lang}/${kind}: Veto has its translated help`, assists.innerHTML.includes(t('tiles.r.vetoHelp')), true);
        assists.fire({ rule: 'veto', v: 'false' });
        check(`${lang}/${kind}: turning Veto off hides the threshold`, assists.innerHTML.includes('data-veto-step'), false);
        assists.fire({ rule: 'veto', v: 'true' });
      }
      if (kind === 'alone') {
        const hints = root.querySelector('#hints');
        hints.fire({ hints: 'true' });
        check(`${lang}: enabling hints shows the practice warning`, [root.querySelector('.help-warn').hidden, root.querySelector('.help-warn span').textContent], [false, t('help.setupPractice')]);
        hints.fire({ hints: 'false' });
        check(`${lang}: disabling hints hides the practice warning`, root.querySelector('.help-warn').hidden, true);
      }
      await root.querySelector('form').listeners.submit({ preventDefault() {} });
      check(`${lang}/${kind}: Start forces Veto off without another person`, ctx.created.rules.veto, expected);
      if (kind === 'friends') {
        const players = root.querySelector('.tl-players');
        const rules = root.querySelector('.rules-body');
        check(`${lang}: standard rules hide the reset button despite custom assists`, rules.innerHTML.includes('data-reset-rules'), false);
        for (const [rule, v] of [['dictionary', 'familiar'], ['premiums', 'always'], ['check', 'challenge'], ['exchange', 'always'], ['bingo', '0'], ['open', 'true']]) rules.fire({ rule, v });
        rules.fire({ time: 'game' });
        rules.fire({ secs: '1200' });
        check(`${lang}: custom rules show the translated reset button at the bottom`, rules.innerHTML.endsWith(`data-reset-rules>${t('tiles.rules.restore')}</button></div>`), true);
        const before = ctx.created;
        rules.fire({ resetRules: '' });
        check(`${lang}: reset hides the button and selects clock off`, [rules.innerHTML.includes('data-reset-rules'), rules.innerHTML.includes('data-time="none" class="on"')], [false, true]);
        await root.querySelector('form').listeners.submit({ preventDefault() {} });
        check(`${lang}: reset restores all rule fields and preserves setup and assists`, JSON.stringify(ctx.created), JSON.stringify(before));
        const value = () => Number(assists.innerHTML.match(/<output>(\d+)<\/output>/)[1]);
        check(`${lang}: threshold starts at one`, value(), 1);
        for (let p = 2; p < 5; p++) { players.fire({ add: '' }); players.fire({ kind: 'person', p: String(p) }); }
        check(`${lang}: default follows a growing electorate`, value(), 2);
        assists.fire({ vetoStep: '1' });
        check(`${lang}: host can increase the threshold`, value(), 3);
        players.fire({ kind: 'cpu', p: '4' });
        check(`${lang}: manual threshold survives a player change`, value(), 3);
        players.fire({ kind: 'cpu', p: '3' });
        check(`${lang}: manual threshold clamps when the maximum drops`, value(), 2);
        for (let i = 0; i < 4; i++) assists.fire({ vetoStep: '-1' });
        check(`${lang}: stepper clamps at one`, value(), 1);
        for (let i = 0; i < 4; i++) assists.fire({ vetoStep: '1' });
        check(`${lang}: stepper clamps at electorate size`, value(), 2);
        assists.fire({ rule: 'veto', v: 'false' });
        check(`${lang}: threshold is hidden while Veto is off`, assists.innerHTML.includes('<output>'), false);
      }
      if (kind === 'alone') {
        root.querySelector('.tl-players').fire({ kind: 'person', p: '1' });
        check(`${lang}: changing a computer to a person reveals Veto`, assists.innerHTML.includes('data-rule="veto"'), true);
        root.querySelector('.tl-players').fire({ kind: 'cpu', p: '1' });
        check(`${lang}: changing the person back hides Veto`, assists.innerHTML.includes('data-rule="veto"'), false);
      }
    }
  }
  setLang('en');
}

// Every game, including guests and legacy saves, selects one graph for all callers.
{
  const source = readFileSync(new URL('../app/js/screens.js', import.meta.url), 'utf8');
  const gameSource = readFileSync(new URL('../app/js/tiles-game.js', import.meta.url), 'utf8');
  const { t, setLang } = await import('../app/js/i18n.js');
  const checker = gameSource.slice(gameSource.indexOf('function wireCheck('), gameSource.indexOf('// The board\'s squares'));
  check('guest loads the host rules before checking its graph tag', source.includes('loadTileWords(m.setup.lang, m.setup.rules)'), true);
  check('old saves select full', T.wordList({}), 'full');
  check('missing rules select full', T.wordList(), 'full');
  for (const lang of ['pl', 'en']) {
    const full = await loadTileWords(lang), familiar = await loadTileWords(lang, { dictionary: 'familiar' });
    check(`${lang}: full remains default`, await loadTileWords(lang, {}), full);
    check(`${lang}: separate familiar graph`, familiar === full, false);
    check(`${lang}: yoni in full`, has(full, 'yoni'), true);
    check(`${lang}: yoni absent in familiar`, has(familiar, 'yoni'), false);
    const word = lang === 'pl' ? 'żółw' : 'cat';
    for (const [dictionary, dict] of [['full', full], ['familiar', familiar]]) {
      const game = newGame({ lang, players: [{}, {}], seed: 123, rules: { dictionary, check: 'challenge' } });
      const move = hint(game, dict);
      const pending = apply(game, { type: 'place', placed: move.placed }, w => has(dict, w));
      const input = {}, res = {}, meaning = {};
      let submit;
      const elements = { input, '.res': res, '.mean-slot': meaning, form: { addEventListener: (_, handler) => { submit = handler; } } };
      const box = { querySelector: selector => elements[selector] };
      const before = JSON.stringify(pending);
      setLang(lang === 'pl' ? 'en' : 'pl');   // the screen language and game language can differ
      runInNewContext(checker + '\nwireCheck(box, state.lang, state.rules, dict);', {
        t, box, state: pending, dict, checkWord, wordList: T.wordList, meaningButton: () => ''
      });
      for (const [value, allowed] of [[word, true], ['yoni', dictionary === 'full']]) {
        input.value = `  ${value.toUpperCase()} `;
        submit({ preventDefault() {} });
        check(`${lang}/${dictionary}: offline checker uses the game's language and dictionary during a challenge`,
          [res.className, res.textContent], [allowed ? 'res ok' : 'res no',
            t('tiles.checkedList', { list: t('tiles.r.dictionary.' + dictionary) }) + ' · ' + t(allowed ? 'tiles.check.ok' : 'tiles.check.unknown', { w: value.toUpperCase() })]);
      }
      check(`${lang}/${dictionary}: checking leaves the challenge pending`, [!!pending.pending, JSON.stringify(pending)], [true, before]);
    }
    setLang('en');
    const walk = (n, prefix) => {
      if (familiar.final[n]) assert.ok(has(full, prefix), `${lang}: familiar subset: ${prefix}`);
      for (let e = familiar.first[n]; e < familiar.first[n + 1]; e++) walk(familiar.target[e], prefix + familiar.letters[familiar.letter[e]]);
    };
    walk(0, ''); passed++;
    const host = newGame({ lang, players: [{}, {}], rules: { dictionary: 'familiar' }, seed: 123 });
    const setup = JSON.parse(JSON.stringify({ lang, players: host.players, rules: host.rules, seed: host.start.seed }));
    const guest = newGame(setup);
    check(`${lang}: guest uses host graph`, await loadTileWords(lang, guest.rules), familiar);
    check(`${lang}: replay preserves list`, replay(host)[0].rules.dictionary, 'familiar');
    for (const w of lang === 'pl' ? ['dolewałaś', 'nakradniemy', 'zazębionemu', 'skarboneczka', 'kotami', 'zrobiłem', 'domy', 'we', 'ze'] : ['dogs', 'went', 'children', 'houses', 'color', 'colour']) {
      check(`${lang}: ordinary form ${w}`, has(familiar, w), true);
    }
    if (lang === 'pl') {
      for (const w of ['yoni', 'niebandżulskimi', 'odsztafirujże', 'buławinkowca']) {
        check(`pl: strange form ${w} absent`, has(familiar, w), false);
      }
      // Valid inflections of known kota/trio: deliberately retained by lemma policy.
      for (const w of ['kotą', 'triu']) check(`pl: odd form ${w} blocked by hand`, has(familiar, w), false);
    }
    const valid = w => has(familiar, w);
    const best = hint(host, familiar);
    check(`${lang}: familiar hint exists`, !!best, true);
    check(`${lang}: hint validates against familiar`, !checkMove(host, best.placed, valid).error, true);
    for (const level of Object.keys(LEVELS)) {
      const a = computerMove(host, familiar, level, () => 0, seeded(123), () => 0);
      check(`${lang}: ${level} uses familiar words`, a.type !== 'place' || !checkMove(host, a.placed, valid).error, true);
      assert.doesNotThrow(() => apply(host, a, valid)); passed++;
    }
  }
}

console.log(`all ${passed} Tiles tests passed`);
