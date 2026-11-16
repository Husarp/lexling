// Achievements count from now on, without hint-assisted moves or old statistics (owner, 2026-11-14).
// Run: node tools/test-achievements.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('✗', name, '\n   got ', JSON.stringify(got), '\n   want', JSON.stringify(want)); }
};
const storage = new Map([['wg.stats', JSON.stringify({ won: 9000, words: 90000, lt: { won: 9000 }, cn: { words: 90000 }, tl: { 'pl|expert': { points: 999999 } } })]]);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
} });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en' } });
const realNow = Date.now;
let now = 1800000000000;
Date.now = () => now;
const { stats } = await import('../app/js/store.js');
const { TIERS, TIERED, CHALLENGES, playChallenges, gameChallenges, bump, grant, progress, gotAt, recordAchievementEnd, recordConnectBonus } = await import('../app/js/achievements.js');
const def = id => TIERED.find(d => d.id === id);

check('the five tiers, in order', TIERS, ['common', 'rare', 'epic', 'legendary', 'mythical']);
check('the counters belong to their games and have five thresholds', TIERED.slice(0, 5), [
  { id: 'guess.won', game: 'guess', th: [5, 20, 50, 100, 200] },
  { id: 'letters.won', game: 'letters', th: [5, 25, 100, 300, 1000] },
  { id: 'connect.words', game: 'connect', th: [50, 250, 1000, 3000, 10000] },
  { id: 'tiles.words', game: 'tiles', th: [25, 100, 500, 2000, 5000] },
  { id: 'tiles.points', game: 'tiles', th: [500, 2500, 10000, 50000, 150000] },
]);
check('the nine Tiles challenges', CHALLENGES.filter(d => d.game === 'tiles'), ['bingo', 'len8', 'len10', 'triple', 'move100', 'rare1', 'multi3', 'beatHard', 'beatExpert'].map(id => ({ id: 'tiles.' + id, game: 'tiles' })));
check('old statistics do not unlock anything or fill counters', stats.ach, { since: now, n: {}, got: {} });
check('an unseen counter starts at zero', progress(def('guess.won')), { value: 0, tiers: 0, next: 5, pct: 0 });
check('an unseen key has no timestamp', gotAt('tiles.bingo'), null);

const move = (words = ['cat'], fields = {}) => ({ kind: 'play', words: words.map(w => ({ w, score: 1 })), score: 20, bingo: false, placed: Array(3).fill({ ch: 'a' }), ...fields });
check('an ordinary move', playChallenges(move()), []);
check('two words do not earn multi3', playChallenges(move(['cat', 'dog'])), []);
check('three words earn multi3', playChallenges(move(['cat', 'dog', 'hen'])), ['tiles.multi3']);
check('four words earn multi3', playChallenges(move(['cat', 'dog', 'hen', 'fox'])), ['tiles.multi3']);
check('hinted three words do not earn multi3', playChallenges(move(['cat', 'dog', 'hen'], { hinted: true })), []);

check('all seven tiles', playChallenges(move(['cat'], { bingo: true, placed: Array(7).fill({}) })), ['tiles.bingo']);
check('six tiles', playChallenges(move(['cat'], { placed: Array(6).fill({}) })), []);
check('all seven with the seven-tile bonus disabled', playChallenges(move(['cat'], { bingo: true, placed: Array(7).fill({}), score: 20 })), ['tiles.bingo']);
for (const [w, want] of [
  ['abcdefg', []], ['abcdefgh', ['tiles.len8']], ['abcdefghi', ['tiles.len8']],
  ['abcdefghij', ['tiles.len8', 'tiles.len10']], ['abcdefghijk', ['tiles.len8', 'tiles.len10']],
  ['ąęćłńóś', []], ['ąęćłńóśź', ['tiles.len8']], ['ąęćłńóśźż', ['tiles.len8']],
  ['ąęćłńóśźża', ['tiles.len8', 'tiles.len10']],
]) check(`word length: ${w}`, playChallenges(move([w])), want);
check('an astral character is one letter', playChallenges(move(['abcdef𐐀'])), []);
check('a crossing word can meet both length challenges', playChallenges(move(['cat', 'abcdefghij'])), ['tiles.len8', 'tiles.len10']);
check('three identical letters anywhere', playChallenges(move(['ananas'])), ['tiles.triple']);
check('three adjacent identical letters', playChallenges(move(['aaa'])), ['tiles.triple']);
check('four identical letters', playChallenges(move(['aaaa'])), ['tiles.triple']);
check('only twice', playChallenges(move(['mama'])), []);
check('Polish letters can repeat', playChallenges(move(['ąbącą'])), ['tiles.triple']);
check('Polish letters are distinct from unmarked letters', playChallenges(move(['aąa'])), []);
check('counts do not carry across words', playChallenges(move(['cat', 'map', 'bar'])), ['tiles.multi3']);
check('a crossing word can have the triple', playChallenges(move(['cat', 'ananas'])), ['tiles.triple']);
check('99 points', playChallenges(move(['cat'], { score: 99 })), []);
check('100 points', playChallenges(move(['cat'], { score: 100 })), ['tiles.move100']);
check('more than 100 points', playChallenges(move(['cat'], { score: 101 })), ['tiles.move100']);
check('the whole move score counts', playChallenges(move(['cat', 'dog'], { score: 100 })), ['tiles.move100']);
for (const [rarePct, want] of [[0, ['tiles.rare1']], [0.5, ['tiles.rare1']], [1, ['tiles.rare1']], [1.01, []], [2, []], [null, []]]) {
  check(`rarity: ${rarePct}`, playChallenges(move(), { rarePct }), want);
}
check('no rarity supplied', playChallenges(move()), []);
check('non-numeric rarity is not a frequency rank', playChallenges(move(), { rarePct: '1' }), []);
const all = move(['ąęćłńóśźża', 'ananas'], { score: 100, bingo: true, placed: Array(7).fill({}) });
check('one move can meet every move challenge', playChallenges(all, { rarePct: 1 }), ['tiles.bingo', 'tiles.len8', 'tiles.len10', 'tiles.triple', 'tiles.move100', 'tiles.rare1']);
for (const hinted of [true, 'small', 'big', 'master']) check(`hinted move: ${hinted}`, playChallenges({ ...all, hinted }, { rarePct: 1 }), []);
check('false hint marker counts normally', playChallenges(move(['ananas'], { hinted: false })), ['tiles.triple']);
check('a non-play never meets a move challenge', playChallenges({ ...all, kind: 'pass' }, { rarePct: 1 }), []);

const game = (winner = 0, cpu = 'expert') => ({ over: { winner }, players: [{ name: 'A' }, { cpu }, { name: 'B' }] });
check('win against Expert', gameChallenges(game(), [0]), ['tiles.beatHard', 'tiles.beatExpert']);
check('another local person can win', gameChallenges(game(2), [0, 2]), ['tiles.beatHard', 'tiles.beatExpert']);
check('lost to Expert', gameChallenges(game(1), [0]), []);
check('draw against Expert', gameChallenges(game(-1), [0]), []);
check('win against Intermediate', gameChallenges(game(0, 'normal'), [0]), []);
check('win against Hard', gameChallenges(game(0, 'hard'), [0]), ['tiles.beatHard']);
check('win against people only', gameChallenges(game(0, null), [0]), []);
check('remote winner is not mine', gameChallenges(game(2), [0]), []);
check('no local seats', gameChallenges(game(), []), []);
check('a computer in mine is not a person', gameChallenges(game(1), [1]), []);
check('not finished yet', gameChallenges({ ...game(), over: null }, [0]), []);
check('older save without over', gameChallenges({ players: game().players }, [0]), []);
check('Expert need not be the only computer', gameChallenges({ over: { winner: 0 }, players: [{}, { cpu: 'hard' }, { cpu: 'expert' }] }, [0]), ['tiles.beatHard', 'tiles.beatExpert']);

// Storage and counters work without a DOM. The notice is dispatched only for new keys, after saving.
check('grant without document', grant('tiles.bingo'), ['tiles.bingo']);
check('grant timestamp', gotAt('tiles.bingo'), now);
now++;
check('grant only once', grant('tiles.bingo'), []);
check('grant keeps its first timestamp', gotAt('tiles.bingo'), now - 1);
check('add below a tier without document', bump('guess.won', 4), []);
check('save below a tier', JSON.parse(storage.get('wg.stats')).ach.n['guess.won'], 4);
check('progress below a tier', progress(def('guess.won')), { value: 4, tiers: 0, next: 5, pct: 80 });

const events = [];
Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class {
  constructor(type, options) { this.type = type; this.detail = options.detail; }
} });
Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: { dispatchEvent: event => {
  events.push({ type: event.type, detail: event.detail });
  const saved = JSON.parse(storage.get('wg.stats')).ach.got;
  check('notice follows persisted unlocks', event.detail.keys.every(key => saved[key] === now), true);
} } });
check('cross one tier with default increment', bump('guess.won'), ['guess.won#0']);
check('tier timestamp', gotAt('guess.won#0'), now);
check('progress at a tier', progress(def('guess.won')), { value: 5, tiers: 1, next: 20, pct: 25 });
check('tier notice', events, [{ type: 'lexling:achievement', detail: { keys: ['guess.won#0'] } }]);
now++;
check('cross two tiers together', bump('guess.won', 45), ['guess.won#1', 'guess.won#2']);
check('two tiers share a notice', events.at(-1), { type: 'lexling:achievement', detail: { keys: ['guess.won#1', 'guess.won#2'] } });
check('progress rounds percentage', progress(def('guess.won')), { value: 50, tiers: 3, next: 100, pct: 50 });
check('old tiers keep their timestamps', gotAt('guess.won#0'), now - 1);
check('new tiers have the current timestamp', [gotAt('guess.won#1'), gotAt('guess.won#2')], [now, now]);
check('no key twice', bump('guess.won'), []);
check('no notice below next threshold', events.length, 2);
check('finish the ladder', bump('guess.won', 149), ['guess.won#3', 'guess.won#4']);
check('completed progress', progress(def('guess.won')), { value: 200, tiers: 5, next: null, pct: 100 });
check('beyond the ladder', bump('guess.won'), []);
check('completed percentage stays at 100', progress(def('guess.won')), { value: 201, tiers: 5, next: null, pct: 100 });
check('another counter is independent', bump('letters.won', 5), ['letters.won#0']);
check('Connect ladder', bump('connect.words', 50), ['connect.words#0']);
check('Tiles word ladder', bump('tiles.words', 25), ['tiles.words#0']);
check('Tiles point ladder', bump('tiles.points', 500), ['tiles.points#0']);
check('a challenge notice', grant('tiles.rare1'), ['tiles.rare1']);
check('challenge event payload', events.at(-1), { type: 'lexling:achievement', detail: { keys: ['tiles.rare1'] } });
const eventCount = events.length;
check('duplicate grant returns no keys', grant('tiles.rare1'), []);
check('duplicate grant emits no event', events.length, eventCount);
check('a tiered id is not a challenge', grant('guess.won'), []);
check('a challenge id is not a counter', bump('tiles.bingo'), []);
check('unknown challenge', grant('unknown'), []);
check('unknown counter', bump('unknown'), []);
check('invalid increments do not damage the counter', [bump('guess.won', NaN), bump('guess.won', Infinity), bump('guess.won', -1), bump('guess.won', 0)], [[], [], [], []]);
check('all achievement changes were saved', JSON.parse(storage.get('wg.stats')).ach, stats.ach);
check('existing statistics stay intact', [stats.won, stats.words, stats.lt.won, stats.cn.words], [9000, 90000, 9000, 90000]);

// A fresh process re-imports both modules from the saved storage, without a shared module cache.
const reload = spawnSync(process.execPath, ['--input-type=module', '-e', `
  import { readFileSync } from 'node:fs';
  const storage = new Map(JSON.parse(readFileSync(0, 'utf8')));
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) } });
  Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' } });
  const { stats } = await import(${JSON.stringify(new URL('../app/js/store.js', import.meta.url).href)});
  const { TIERED, progress, gotAt, grant, bump } = await import(${JSON.stringify(new URL('../app/js/achievements.js', import.meta.url).href)});
  console.log(JSON.stringify({ ach: stats.ach, progress: progress(TIERED[0]), at: gotAt('tiles.bingo'), grant: grant('tiles.bingo'), bump: bump('guess.won') }));
`], { encoding: 'utf8', input: JSON.stringify([...storage]) });
check('fresh import succeeds', reload.status, 0);
if (reload.status === 0) {
  const restored = JSON.parse(reload.stdout);
  check('counters, unlocks and since survive a fresh import', restored.ach, { ...stats.ach, n: { ...stats.ach.n, 'guess.won': 202 } });
  check('progress survives a fresh import', restored.progress, progress(def('guess.won')));
  check('timestamps survive a fresh import', restored.at, gotAt('tiles.bingo'));
  check('restored unlocks are not awarded again', [restored.grant, restored.bump], [[], []]);
} else console.log(reload.stderr);
// Exercise the production game hooks without a browser or layout engine.
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
// Load old achievement counters with the production module body, including its migration.
const achievementSource = read('app/js/achievements.js').replace(/^import .*;\n/, '').replace(/export /g, '');
for (const value of [2, 3, 10, 30, 80, 200]) {
  const oldAt = now - 100, got = value >= 5 ? { 'guess.won#0': oldAt } : {};
  const oldStats = { ach: { since: 123, n: { 'guess.won': value }, got } };
  const notices = [], saves = [];
  const migrated = runInNewContext(achievementSource + ';({ progress: progress(TIERED[0]), bump, gotAt });', {
    stats: oldStats, saveStats: () => saves.push(JSON.parse(JSON.stringify(oldStats))),
    document: { dispatchEvent: e => notices.push(e) }, CustomEvent: globalThis.CustomEvent, Date,
  });
  const tiers = def('guess.won').th.filter(th => value >= th).length;
  check(`migration at ${value}: screen keys agree with progress`, [Object.keys(got).length, migrated.progress.tiers], [tiers, tiers]);
  check(`migration at ${value}: no notice storm`, notices.length, 0);
  check(`migration at ${value}: preserves start and counter`, [oldStats.ach.since, oldStats.ach.n['guess.won']], [123, value]);
  if (value >= 5) check(`migration at ${value}: preserves award date`, migrated.gotAt('guess.won#0'), oldAt);
  check(`migration at ${value}: saves newly reached tiers`, saves.length, tiers > (value >= 5 ? 1 : 0) ? 1 : 0);
  check(`migration at ${value}: next bump awards only newly crossed tiers`, migrated.bump('guess.won'), def('guess.won').th.flatMap((th, i) => value < th && value + 1 >= th ? [`guess.won#${i}`] : []));
}

const retiredStats = { ach: { since: 123, n: { 'guess.streak': 8, 'letters.streak': 5, 'connect.boards': 200, 'connect.bonusHunter': 20 }, got: { 'guess.streak#0': 1, 'guess.mindReader': 1, 'guess.deepCut': 1, 'guess.noHelp': 1, 'letters.streak#1': 1, 'connect.bonusHunter': 1 }, streak: { guess: 2 } } };
const retiredEvents = [];
runInNewContext(achievementSource, { stats: retiredStats, saveStats() {}, Date, document: { dispatchEvent: e => retiredEvents.push(e) } });
check('migration removes retired counters', Object.keys(retiredStats.ach.n).sort(), ['connect.boards', 'connect.bonusHunter']);
check('migration removes old streak state', 'streak' in retiredStats.ach, false);
check('migration reconciles boards and bonus best silently', [Object.keys(retiredStats.ach.got).sort(), retiredEvents.length], [
  ['connect.boards#0','connect.boards#1','connect.boards#2','connect.boards#3','connect.bonusHunter#0','connect.bonusHunter#1','connect.bonusHunter#2','connect.bonusHunter#3'].sort(), 0]);

const tilesSource = read('app/js/tiles-game.js');
const { listedPct } = await import('../app/js/rarity.js');
const { newGame: newTiles, apply } = await import('../app/js/tiles.js');
const { cellsOf } = await import('../app/js/connect.js');
const helper = tilesSource.slice(tilesSource.indexOf('  function countAchievements('), tilesSource.indexOf('  function pickLetter('));
function counter(state, { linked = false, linkMe = 0, canUndo = false, lex = { count: 100 }, done = 0 } = {}) {
  const calls = [], saved = [];
  const ctx = { S: state, game: { achDone: done }, linked, linkMe, canUndo, lex,
    people: state.players.flatMap((p, i) => p.cpu ? [] : [i]), cpu: p => !!ctx.S.players[p].cpu,
    rankOf: w => w === 'at' ? 99 : Infinity, listedPct, playChallenges, gameChallenges,
    bump: (...args) => calls.push(args), grant: id => calls.push([id]), putSave: g => saved.push(g.achDone) };
  return { ctx, calls, saved, count: runInNewContext('(' + helper + ')', ctx) };
}
const start = (fields = {}) => ({ ...newTiles({ lang: 'en', players: [{}, { cpu: 'expert' }, {}], first: 0, seed: 1 }), ...fields });
const placed = [{ r: 7, c: 7, ch: 'a' }, { r: 7, c: 8, ch: 't' }];
let played = apply(start({ racks: [['a', 't'], ['s'], ['s']] }), { type: 'place', placed }, () => true);
let c = counter(played);
c.count();
check('local settled play counts words, points and rarity', c.calls, [['tiles.words'], ['tiles.points', played.moves[0].score], ['tiles.rare1']]);
for (const words of [[{ w: 'xyz' }, { w: 'at' }], [{ w: 'at' }, { w: 'xyz' }]]) {
  const mixed = counter({ ...played, moves: [{ ...played.moves[0], words }] }); mixed.count();
  check('an unlisted word does not mask the top-1% challenge', mixed.calls, [['tiles.words'], ['tiles.points', played.moves[0].score], ['tiles.rare1']]);
}
check('cursor is saved after a settled move', [c.ctx.game.achDone, c.saved], [1, [1]]);
c.count();
check('re-evaluation counts a move once', c.calls.length, 3);
c = counter({ ...played, moves: [move(['ananas'], { p: 0, score: 100, placed: Array(7).fill({}) })] });
c.count();
check('a seven-tile move gets every applicable challenge', c.calls, [['tiles.words'], ['tiles.points', 100], ['tiles.bingo'], ['tiles.triple'], ['tiles.move100']]);
for (const hinted of [true, 'small', 'big', 'master']) {
  c = counter({ ...played, moves: [{ ...played.moves[0], hinted }] }); c.count();
  check(`hook skips hinted ${hinted} moves`, [c.calls, c.ctx.game.achDone], [[], 1]);
}
c = counter(played, { canUndo: true }); c.count(true);
check('undo-enabled game counts nothing', c.calls, []);
c = counter({ ...played, moves: [0, 1, 2].map(p => ({ ...played.moves[0], p })) }); c.count();
check('shared-device humans count, computers do not', c.calls.filter(x => x[0] === 'tiles.words').length, 2);
c = counter({ ...played, moves: [0, 1, 2].map(p => ({ ...played.moves[0], p })) }, { linked: true, linkMe: 2 }); c.count();
check('online counts just this device seat', c.calls.filter(x => x[0] === 'tiles.words').length, 1);
c = counter(played, { lex: null }); c.count();
check('no cursor advancement before lex arrives', [c.calls, c.ctx.game.achDone], [[], 0]);
c.ctx.lex = { count: 100 }; c.count();
check('lex arrival catches up rarity and counters exactly once', c.calls, [['tiles.words'], ['tiles.points', played.moves[0].score], ['tiles.rare1']]);
c.count(); check('lex catch-up is idempotent', c.calls.length, 3);
const pending = apply(start({ racks: [['a', 't'], ['s'], ['s']], rules: { ...played.rules, check: 'challenge' } }), { type: 'place', placed }, () => false);
c = counter(pending); c.count();
check('challenge window holds cursor and counts', [c.calls, c.ctx.game.achDone], [[], 0]);
c.ctx.S = apply(pending, { type: 'hint', level: 'small', cost: 0 }, () => false); c.count();
check('hint does not settle pending play', [c.calls, c.ctx.game.achDone], [[], 0]);
c.ctx.S = apply(pending, { type: 'challenge' }, () => false); c.count();
check('challenged-away play never counts', [c.calls, c.ctx.game.achDone], [[], 2]);
c = counter(pending); c.ctx.S = apply(pending, { type: 'pass' }, () => true); c.count();
check('next turn settles the previous play', c.calls, [['tiles.words'], ['tiles.points', pending.moves[0].score], ['tiles.rare1']]);
c = counter(pending); c.ctx.S = apply(pending, { type: 'challenge' }, () => true); c.count();
check('failed challenge settles the previous play', c.calls.filter(x => x[0] === 'tiles.words').length, 1);
const voting = apply(start({ racks: [['a', 't'], ['s'], ['s']], rules: { ...played.rules, veto: true } }), { type: 'place', placed }, () => true);
c = counter(voting); c.count();
check('voting move is not settled', c.calls, []);
c.ctx.S = apply(voting, { type: 'vote', p: 2, veto: true }, () => true); c.count();
check('vetoed move is not a play', [c.calls, c.ctx.game.achDone], [[], 1]);
c = counter(voting); c.ctx.S = apply(voting, { type: 'vote', p: 2, veto: false }, () => true); c.count();
check('accepted vote settles a play', c.calls.filter(x => x[0] === 'tiles.words').length, 1);
c = counter(played, { done: undefined });
delete c.ctx.game.achDone;
runInNewContext('game.achDone ??= S.moves.length;', c.ctx); c.count();
check('older save or new phone starts after existing moves', [c.calls, c.ctx.game.achDone], [[], 1]);
c.ctx.S = { ...played, moves: [...played.moves, { ...played.moves[0], p: 2 }] }; c.count();
check('a subsequent move on an old save counts', c.calls.filter(x => x[0] === 'tiles.words').length, 1);
for (const [options, winner, want] of [[{}, 0, [['tiles.beatHard'], ['tiles.beatExpert']]], [{ linked: true }, 2, []], [{ canUndo: true }, 0, []]]) {
  c = counter(start({ over: { winner } }), options); c.count(true);
  check(`end challenge: ${JSON.stringify(options)}/${winner}`, c.calls, want);
}
c = counter(start({ over: { winner: 0 } }), { lex: null }); c.count(true); c.ctx.lex = { count: 100 }; c.count();
check('end challenge catches up after delayed lex', c.calls, [['tiles.beatHard'], ['tiles.beatExpert']]);
check('action checks achievements before finishing', /countAchievements\(\);\s+if \(S.over\) \{ finish\(\); return true; \}/.test(tilesSource), true);
check('finish checks achievements after records', /recordTilesEnd\([^\n]+\n    countAchievements\(true\);/.test(tilesSource), true);
check('lex arrival catches up achievements', /lex = m;\s+countAchievements\(\);/.test(tilesSource), true);

// Rebuilding a guest for a different seat/history never back-fills achievements (owner, 2026-11-14).
const welcomeHook = tilesSource.slice(tilesSource.indexOf('  function welcomed(m)'), tilesSource.indexOf('  function up()'));
const setup = { lang: 'en', players: [{}, { cpu: 'expert' }, {}], first: 0, seed: 1, rules: { check: 'strict' } };
const initial = newTiles(setup), letters = initial.racks[0].filter(ch => ch !== '?').slice(0, 2);
const rebuilt = apply(initial, { type: 'place', placed: letters.map((ch, i) => ({ r: 7, c: 7 + i, ch })) }, () => true);
for (const [seat, done, oldLog] of [[2, 0, []], [2, 10, []], [0, 10, [{ type: 'pass' }]]]) {
  const guest = counter({ ...played, log: oldLog }, { linked: true, done });
  Object.assign(guest.ctx, { solo: 0, shown: 0, party: { relax() {}, synced() {} }, startOf: newTiles, apply, isWord: () => true,
    resetTurn() {}, paintAll() {}, next() {}, finish() {}, setNames() {} });
  guest.ctx.game.link = { me: 0 };
  const welcomed = runInNewContext('(' + welcomeHook + ')', guest.ctx);
  welcomed({ here: [], host: 0, seat, setup, log: rebuilt.log });
  check(`rebuilt guest seat=${seat}, cursor=${done}: cursor matches the new history`, guest.ctx.game.achDone, rebuilt.moves.length);
  guest.count();
  check(`rebuilt guest seat=${seat}, cursor=${done}: existing plays never count`, guest.calls, []);
  guest.ctx.S = { ...guest.ctx.S, moves: [...guest.ctx.S.moves, { ...played.moves[0], p: seat }] };
  guest.count();
  check(`rebuilt guest seat=${seat}, cursor=${done}: the next local play counts`, guest.calls, [['tiles.words'], ['tiles.points', played.moves[0].score], ['tiles.rare1']]);
}

function finishHook(file, signature, endMarker, ctx) {
  const source = read('app/js/' + file), at = source.indexOf(signature);
  return runInNewContext('(' + source.slice(at, source.indexOf(endMarker, at)).trim() + ')', ctx);
}
for (const [won, hint, expected] of [[true, false, 1], [true, true, 1], [false, false, 0]]) {
  const calls = [], ctx = { game: { guesses: hint ? [{ hint: true }] : [] }, m: { hardOf: new Map() }, secretIdx: 0,
    recordEnd() {}, recordAchievementEnd() {}, bump: id => calls.push(id), chime() {}, say() {}, paintStatus() {}, paintEntry() {}, paintBoard() {}, refit() {}, window: { scrollTo() {} } };
  finishHook('game.js', '  function finish(won)', '\n  const box', ctx)(won);
  check(`Guess win=${won}, hint=${hint}`, calls, Array(expected).fill('guess.won'));
}
for (const status of ['won', 'lost', 'gaveup']) {
  const calls = [], ctx = { game: {}, recordLettersEnd() {}, recordAchievementEnd() {}, chime() {}, bump: id => calls.push(id), paintEnd() {} };
  finishHook('letters-game.js', '  function finish(status', '\n  function paintEnd', ctx)(status);
  check('Letters ' + status, calls, status === 'won' ? ['letters.won'] : []);
}
const connectSource = read('app/js/connect-game.js');
const foundHook = connectSource.slice(connectSource.indexOf('      game.found.push(word);'), connectSource.indexOf('      unpick();', connectSource.indexOf('      game.found.push(word);')));
for (const shown of [[], ['1-1'], ['9-9']]) {
  const calls = [], ctx = { word: 'cat', x: { w: 'cat', r: 1, c: 1, d: 'a' }, game: { found: [], shown, lang: 'en' }, cellsOf,
    recordMove() {}, connectRecord() {}, collect() {}, bump: id => calls.push(id) };
  runInNewContext(foundHook, ctx);
  check('Connect board word with shown=' + shown, calls, shown.includes('1-1') ? [] : ['connect.words']);
}
const bonusHook = connectSource.slice(connectSource.indexOf('      game.bonus.push(word);'), connectSource.indexOf('      putSave(game);', connectSource.indexOf('      game.bonus.push(word);')));
const bonusCalls = [];
runInNewContext(bonusHook, { game: { bonus: [], shown: ['1-1'] }, word: 'bonus', recordConnectBonus() {}, recordMove() {}, connectRecord() {}, collect() {}, bump: id => bonusCalls.push(id) });
check('Connect bonus word is unhinted', bonusCalls, ['connect.words']);

check('new milestone thresholds', TIERED.slice(5).map(d => d.th), [[10,30,75,200,500],[5,10,15,20,30]]);
check('removed definitions are absent', [...TIERED, ...CHALLENGES].some(d => /streak|mindReader|deepCut|noHelp/.test(d.id)), false);
const end = (mode, fields = {}, difficulty = -1) => recordAchievementEnd({ status: 'won', guesses: Array(6).fill({}), secret: 'cat', hints: 0, shown: [], diff: 'normal', ...fields }, mode, difficulty);
end('guess', { guesses: Array(11).fill({}) });
check('eleven guesses misses sharpshooter', gotAt('guess.sharpshooter'), null);
end('guess', { status: 'gaveup', guesses: [{}] });
check('loss misses sharpshooter', gotAt('guess.sharpshooter'), null);
end('guess', { guesses: Array(10).fill({hint:true}) });
check('ten guesses including hints earns sharpshooter', gotAt('guess.sharpshooter'), now);
end('letters', {guesses:Array(3).fill({})});
check('three guesses misses lucky', gotAt('letters.lucky'), null);
end('letters', {guesses:[{}]});
check('one guess earns lucky', gotAt('letters.lucky'), now);
delete stats.ach.got['letters.lucky'];
end('letters', {guesses:[{},{}]});
check('two guesses earns lucky', gotAt('letters.lucky'), now);
end('letters', {secret:'abcdefg'});
check('seven letters is not long haul', gotAt('letters.longHaul'), null);
end('letters', {secret:'abcdefgh'});
check('eight letters is long haul', gotAt('letters.longHaul'), now);
for(let n=3;n<=12;n++) end('letters', {secret:'a'.repeat(n)});
check('missing one length keeps challenge locked', gotAt('letters.everyLength'), null);
end('letters', {secret:'a'.repeat(13),status:'lost'});
check('lost length does not count', gotAt('letters.everyLength'), null);
end('letters', {secret:'a'.repeat(13)});
check('all eleven lengths unlock challenge', gotAt('letters.everyLength'), now);
end('connect', {status:'gaveup'});
check('abandoned board does not count', progress(def('connect.boards')).value, 0);
end('connect', {hints:1,shown:['1-1']});
check('hinted board counts but unaided stays locked', [progress(def('connect.boards')).value, gotAt('connect.unaided')], [1,null]);
end('connect', {diff:'hard'});
check('hard unhinted board earns both challenges', [gotAt('connect.unaided'),gotAt('connect.hardBoard')], [now,now]);
recordConnectBonus({bonus:Array(4).fill('cat')});
check('four bonus words insufficient', gotAt('connect.bonusHunter#0'), null);
for (const n of [5,10,15,20,30]) {
  recordConnectBonus({bonus:Array(n).fill('cat')});
  check('bonus best at ' + n, progress(def('connect.bonusHunter')).value, n);
}
recordConnectBonus({bonus:Array(5).fill('cat')});
check('bonus never accumulates across boards', progress(def('connect.bonusHunter')).value, 30);
check('bonus all tiers', progress(def('connect.bonusHunter')).tiers, 5);
for(let i=2;i<500;i++) end('connect');
check('500 completed boards reaches all tiers',progress(def('connect.boards')).tiers,5);

const savedNew = spawnSync(process.execPath, ['--input-type=module', '-e', `
  const entries = new Map(JSON.parse(process.env.ACH_FIXTURE));
  globalThis.localStorage = { getItem: k => entries.get(k) ?? null, setItem() {} };
  const { stats } = await import(${JSON.stringify(new URL('../app/js/store.js', import.meta.url).href)});
  await import(${JSON.stringify(new URL('../app/js/achievements.js', import.meta.url).href)});
  console.log(JSON.stringify(stats.ach));
`], { encoding: 'utf8', env: { ...process.env, ACH_FIXTURE: JSON.stringify([...storage]) } });
check('new streaks, lengths, best counters and award dates survive reload', savedNew.status === 0 ? JSON.parse(savedNew.stdout) : savedNew.stderr, stats.ach);
for (const [file, mode] of [['game.js','guess'],['letters-game.js','letters'],['connect-game.js','connect']]) {
  check('production end hook: ' + mode, read('app/js/' + file).includes(`recordAchievementEnd(game, '${mode}'`), true);
}

// Render the actual screen and run the global notice listener against a tiny DOM stand-in.
const listeners = new Map(), notices = [], timers = [];
globalThis.window = { addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: {
  documentElement: {},
  addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) ?? []), fn]); },
  createRange() { return {}; },
  createElement() { return { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, remove() { notices.splice(notices.indexOf(this), 1); } }; },
  body: { append(node) { notices.push(node); } },
} });
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); };
const { achievementsScreen, statsScreen } = await import('../app/js/screens.js');
const { t, setLang, num, dateTime } = await import('../app/js/i18n.js');
const root = { innerHTML: '', querySelector() { return null; }, querySelectorAll() { return []; } };
for (const lang of ['en', 'pl']) {
  setLang(lang);
  for (const d of [...TIERED, ...CHALLENGES]) {
    check(`${lang}: achievement name ${d.id}`, t('ach.' + d.id) !== 'ach.' + d.id, true);
    check(`${lang}: achievement description ${d.id}`, t(`ach.${d.id}.d`) !== `ach.${d.id}.d`, true);
  }
  check(`${lang}: final tier names`, TIERS.map(k => t('tier.' + k)), lang === 'en' ? ['Common','Rare','Epic','Legendary','Mythical'] : ['Zwykły','Rzadki','Epicki','Legendarny','Mityczny']);
  check(`${lang}: action language`, t('ach.see'), lang === 'en' ? 'See it' : 'Zobacz');
  achievementsScreen(root);
  const html = root.innerHTML;
  check(`${lang}: five game tabs`, (html.match(/role="tab"/g) ?? []).length, 5);
  check(`${lang}: twenty-two achievement squares`, (html.match(/data-ach="/g) ?? []).length, 22);
  check(`${lang}: seven progress bars`, (html.match(/role="progressbar"/g) ?? []).length, 7);
  check(`${lang}: thirty-five tier pips plus summary`, (html.match(/class="ach-shape"/g) ?? []).length, 40);
  check(`${lang}: no challenge frames`, (html.match(/class="ach-frame"/g) ?? []).length, 0);
  check(`${lang}: locked and earned tiles`, html.includes('ach-tile locked') && html.includes('ach-tile earned'), true);
  check(`${lang}: no counted-since timestamp`, html.includes(t('ach.since', { d: dateTime(stats.ach.since) })), false);
  check(`${lang}: summary counts only milestone tiers`, html.includes(t('ach.tiers', { a: num(TIERED.reduce((n, d) => n + TIERS.filter((_, i) => gotAt(`${d.id}#${i}`) !== null).length, 0)), b: num(35) })), true);
  for (const key of ['tiers', 'milestones', 'challenges', 'see', 'nice', 'earned', 'detail']) check(`${lang}: translated ${key}`, t('ach.' + key) !== 'ach.' + key, true);
  statsScreen(root, null, () => {});
  check(`${lang}: Statistics links to achievements`, root.innerHTML.includes('href="#/achievements"'), true);
}
setLang('pl');
check('Polish Guess achievement uses the game name', t('ach.guess.won.d').includes(t('mode.guess')), true);
const { achievementIcon } = await import('../app/js/achievement-icons.js');
for (const d of [...TIERED, ...CHALLENGES]) check('drawing: ' + d.id, achievementIcon(d.id).includes('undefined'), false);
check('builder keeps approved rotation', achievementIcon('tiles.words').includes('rotate(-90 12 12)'), true);
const { achievementMedal } = await import('../app/js/ui.js');
check('locked medals use an outline; earned medals have a filled face', [achievementMedal(false).includes('fill="currentColor"'), achievementMedal(true).includes('fill="currentColor"')], [false, true]);
setLang('en');
check('one global achievement listener', listeners.get('lexling:achievement').length, 1);
const announce = keys => listeners.get('lexling:achievement')[0]({ detail: { keys } });
announce(['tiles.bingo', 'guess.won#0']);
check('only one notice visible at once', notices.length, 1);
check('notice has challenge name and accessible status', [notices[0].innerHTML.includes(t('ach.tiles.bingo')), notices[0].attrs.role], [true, 'status']);
check('notice uses the same SVG medal as the screen', notices[0].innerHTML.includes(achievementIcon('tiles.bingo')), true);
check('notice lasts three seconds', timers[0].ms, 3000);
announce(['tiles.move100']);
check('later unlock joins the queue', notices.length, 1);
root.innerHTML = '<div>another screen</div>';
timers.shift().fn();
check('tier notice follows across screen changes', notices[0].innerHTML.includes(t('ach.guess.won') + ' · ' + t('tier.common')), true);
timers.shift().fn();
check('later notice preserves queue order', notices[0].innerHTML.includes(t('ach.tiles.move100')), true);
timers.shift().fn();
check('notice queue clears completely', [notices.length, timers.length], [0, 0]);
check('notice has detail and dismiss actions', notices.length === 0 && read('app/js/ui.js').includes('data-see') && read('app/js/ui.js').includes('data-close'), true);
check('menu link follows Statistics', /href="#\/stats"[^\n]+\n\s+<a href="#\/achievements"/.test(read('app/js/screens.js')), true);
const mainSource = read('app/js/main.js');
check('route opens achievement screen', mainSource.includes('achievements: achievementsScreen'), true);
check('Escape goes up from achievements', mainSource.includes("achievements: () => '#/'"), true);
// Detail renders the same live ledger, including reached dates and the next goal.
const noticeDocument = globalThis.document, dialogs = [];
globalThis.document = {
  querySelectorAll: () => [...dialogs],
  createElement: () => ({ innerHTML: '', attrs: {}, handlers: {}, style: { setProperty() {} },
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this.handlers[k] = fn; },
    showModal() { this.open = true; }, close() { this.open = false; },
    remove() { const i = dialogs.indexOf(this); if (i >= 0) dialogs.splice(i, 1); },
  }),
  body: { append: d => dialogs.push(d) },
};
const { achievementDetail } = await import('../app/js/achievement-view.js');
for (const d of [...TIERED, ...CHALLENGES]) {
  achievementDetail(d.id);
  check('only one detail: ' + d.id, dialogs.length, 1);
  check('detail opens modally: ' + d.id, dialogs[0].open, true);
  check('detail description: ' + d.id, dialogs[0].innerHTML.includes(t('ach.' + d.id + '.d')), true);
  if (d.th) check('all five detail thresholds: ' + d.id, d.th.every(n => dialogs[0].innerHTML.includes('· ' + num(n))), true);
  else check('challenge date or lock: ' + d.id, dialogs[0].innerHTML.includes(gotAt(d.id) === null ? t('ach.locked') : t('ach.got', { d: dateTime(gotAt(d.id)) })), true);
}
achievementDetail('letters.won');
check('detail displays remaining progress', dialogs[0].innerHTML.includes(t('ach.toGo', { n: num(20), tier: t('tier.rare') })), true);
let prevented = false, stopped = false;
dialogs[0].handlers.keydown({ key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
check('Escape closes detail without navigating away', [dialogs[0].open, prevented, stopped], [false, true, true]);
globalThis.document = noticeDocument;
globalThis.setTimeout = realTimeout;
Date.now = realNow;

console.log(fail ? `${fail} of ${pass + fail} achievement tests FAILED` : `all ${pass} achievement tests passed`);
process.exit(fail ? 1 : 0);
