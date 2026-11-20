// Settings, saved games and lifetime stats. Everything lives in localStorage; the desktop/Android
// wrappers pin the WebView's storage folder outside the install dir so updates never touch it.
import { t } from './i18n.js';
import { results, premiums, sizeOf } from './tiles.js';
import { feedback } from './letters.js';

// "A hard word": the top ~10 % of the uncategorised pool, for the hard-words statistic.
export const HARD_WIN = 70;
// Owner, 2026-11-20: one allowance per mode; lifetime records survive eviction.
export const SAVE_LIMIT = 20;
const read = (key, fallback) => {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }; } catch { return { ...fallback }; }
};
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: play on, unsaved */ } };

export const settings = read('wg.settings', {
  lang: (navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en',
  buttonSize: '100',
  theme: 'dark', palette: 'classic', accent: 'orange', sound: true, fuzzy: true, langChosen: false, lastCheck: 0, latest: '',
  // Letters: tapping the tiles also opens the phone's own keyboard (the keys on screen stay) - owner, 2026-09-25
  phoneKb: false,
  // "Allow Polish letters" on the new-game screens: on at first, then whatever the player chose last - each
  // game its own choice (owner, 2026-09-25)
  polish: { letters: true, connect: true },
  // Legacy preference retained in old settings; board tiles now share one colour.
  tilesColours: false,
  // Tiles: the bonus squares in their colours - off: one quiet grey with the labels only (owner, 2026-09-25: "too many
  // colours on the board")
  tilesBonus: 'text',        // labels only - the default since 0.51.3 (owner)
  // Classic / muted board and bonus shapes as well as colour (owner, 2026-11-14).
  tilesBoardStyle: 'classic', tilesCb: false, tilesLast: true, tilesFrame: 'graphite',
  // Tiles: after each of your moves, how good it was - its points against the best move there was (owner, 2026-09-26)
  tilesRate: true,
  // Under a move: rating, base-word rarity or both; adjustable rarity colour limits (owner, 2026-11-14).
  tilesUnder: 'rating', tilesRareTiers: [1, 5, 20],
  // Tiles: the tiles on the board raised, like real ones - easier to see (owner, 2026-09-26)
  tiles3d: false,
  // Tiles: the tiles' own colour - yellow, white, cream, wood or mint (owner, 2026-09-26)
  tilesTile: 'cream',        // shared warm tile family (owner, 2026-11-19)
  // The language always carries over between games; the rest only with rememberSetup (owner, 2026-09-26: "remember my
  // setup choices") - setup then holds each mode's last choices, else a New game starts from its defaults.
  newGame: { lang: null },
  rememberSetup: true,   // on by default since 0.51.1 (owner)
  setup: {},
  // Tiles on several phones: after a game, a reminder when Bluetooth is still on and Lexling switched it on (owner,
  // 2026-09-27: on by default, can be switched off)
  btRemind: true,
  // Your name is set once in Settings and used when joining online Tiles (owner, 2026-11-14).
  myName: '',
  // Settings → Check for updates: on opening and on coming back (APP-STANDARDS.md: on by default)
  updateCheck: true, seenVersion: null,
  // Settings → Time (owner, 2026-09-28): the current time on screen; a reminder of the time played, every remindMin minutes
  showClock: false, playRemind: false, remindMin: 90,
});
export const saveSettings = () => write('wg.settings', settings);
// Remembering New game choices became the default in 0.51.1 (owner) - switched on once for those whose settings still
// carry the old default (off); off again after that stays off.
if (!settings.rememberSetupOn) { settings.rememberSetup = true; settings.rememberSetupOn = true; saveSettings(); }
// Carry the old Join name over once; clearing Your name later must not bring it back (owner, 2026-11-14).
if (!settings.myNameOn) { settings.myName = (settings.myName?.trim() || settings.btName?.trim() || '').slice(0, 16); settings.myNameOn = true; saveSettings(); }

export const stats = read('wg.stats', {
  // wonGuesses / wonRated are the average-win stat; they count only the wins that qualify (see recordEnd)
  played: 0, won: 0, givenUp: 0, words: 0, letters: 0, timeMs: 0, bestWin: 0, wonGuesses: 0, wonRated: 0,
  // hints used, and the games counted since hints were (0.29.0) - for "per game" - Guess, then Letters below
  hints: 0, hintGames: 0,
  hardest: null,    // { w, lang, score, guesses } - the toughest secret beaten so far
  hardWins: 0,      // wins on a word of difficulty >= HARD_WIN
  wonPools: {},     // category key (or "all") -> true: the categories-won statistic
  wonLang: {},      // language -> wins
  unique: [], gameNo: 0,
  // Letters keeps its own numbers: everything above except letters, timeMs and gameNo is the Guess
  // mode's. wonLen = word length -> wins, for the wins-by-length strip.
  lt: { played: 0, won: 0, lost: 0, givenUp: 0, streak: 0, bestStreak: 0, wonTries: 0, wonLen: {} },
  // Connect's own numbers: words = board words the player found, longest = { w, game, at } of any word found
  cn: { played: 0, solved: 0, givenUp: 0, words: 0, bonus: 0, hints: 0, longest: null },
  // Tiles' own numbers, kept per language and level ('pl|normal', 'en|people' ...) so its tab can show any mix
  // of them: the sums of tiles.js results(), and the best game and best move so far.
  tl: {},
});
const unique = new Set(stats.unique);
export const saveStats = () => { stats.unique = [...unique]; write('wg.stats', stats); };

// ── A record per game (owner, 2026-09-28: "stats saved live", every mode by language and level, help left out of
// quality records and averages) ── made at the game's first move (a game nobody moved in does not count - not even when the
// computer did), brought up to date as it is played, and kept whatever happens to the game: finished, given up, left,
// deleted. The statistics screen works its numbers out of these. The totals above are from before 0.60.0: they cannot
// be split by level or cleaned of hints, so they are kept as they were and no longer added to; `before` says how many
// games they cover.
//   every record: m (mode), lang, lv (the difficulty; Tiles: the strongest computer, or 'people'), at (the first move),
//                 end (null while it is played; 'won' | 'lost' | 'gave' | 'left' (deleted unfinished) | 'done' (Tiles)),
//                 ea (when it ended), ms (active time), pr (practice; excluded from quality stats)
//   Guess: g (guesses), ch (letters typed), h (hints), cat, fr (a friend chose the word); at the end dif (the word's
//          difficulty) and w (the word, when won)
//   Letters: g (tries), len, ch (typed letters), gr (green), yl (yellow)
//   Connect: f (words found without a hinted letter), fh (with one), b (bonus words), h (hints), long, gn (the game's name)
//   Tiles: device-owned settled placements and tiles, natural completion, plus historical result fields;
//          wc (words formed), wp (word points, without rack bonus), bw / long ({ w, score, at }), seven,
//          bx (bonus-square uses, d / t = 2× / 3× letter, D / T = 2× / 3× word).
stats.rec ??= {};
if (!stats.before) {
  const tl = Object.values(stats.tl ?? {}).reduce((a, x) => a + (x.played || 0), 0);
  stats.before = { games: (stats.played || 0) + (stats.lt?.played || 0) + (stats.cn?.played || 0) + tl, at: Date.now() };
}
// ── The Collection (owner, 2026-09-28): every word the player typed in a game - found, guessed, tried - per mode and
// language ('guess|pl' → words). A word a hint gave (or a Connect word with a hinted letter) is not theirs, so it does
// not go in. The Collection screen sets them against the words each mode can hide. Guess kept its typed words all along
// (stats.unique): they fill its part from the start; the other modes start now.
stats.col ??= {};
if (!stats.colFrom) {
  for (const x of stats.unique ?? []) { const i = x.indexOf(':'); (stats.col['guess|' + x.slice(0, i)] ??= []).push(x.slice(i + 1)); }
  stats.colFrom = Date.now();
}
const colSets = new Map();
export const collected = (mode, lang) => colSets.get(mode + '|' + lang) ?? colSets.set(mode + '|' + lang, new Set(stats.col[mode + '|' + lang] ?? [])).get(mode + '|' + lang);
export function collect(mode, lang, word, game) {
  if (!counts(game)) return;
  const s = collected(mode, lang);
  if (!word || s.has(word)) return;
  s.add(word);
  (stats.col[mode + '|' + lang] ??= []).push(word);
  saveStats();
}

// One irreversible eligibility flag. Setup rules are also available on every linked phone.
export function setupPractice(game) {
  const mode = game.mode ?? 'guess', r = game.state?.rules ?? game.rules ?? {};
  if (mode === 'guess') return !!game.friend;
  if (mode === 'letters') return game.tries === 0;
  if (mode !== 'tiles') return false;
  return !!(r.undo || r.open || r.wordsVote || r.rating === true ||
    (r.hints && ['small', 'big', 'master'].some(k => r.hintMax?.[k] == null || r.hintMax[k] > 0)));
}
export function counts(game) {
  if (!game) return false;
  if (!game.practice && (setupPractice(game) || (game.mode === 'connect' && (game.hints || game.shown?.length)) ||
    ((game.mode ?? 'guess') === 'guess' && game.guesses?.some(g => g.hint)))) {
    game.practice = true;
    game.practiceAt = Date.now();
  }
  // Keep earlier fields, but help disqualifies the whole record (owner, 2026-11-20).
  const r = stats.rec[game.id];
  if (game.practice && r && !r.pr) { r.pr = 1; saveStats(); }
  return !game.practice;
}
export function markPractice(game) {
  if (!game.practice) { game.practice = true; game.practiceAt = Date.now(); }
  putSave(game);
}

// a counted move: the game's record, made at the first one
export function recordMove(game, fields) {
  const fair = counts(game);
  const r = stats.rec[game.id] ??= { m: game.mode ?? 'guess', lang: game.lang, lv: game.diff ?? 'normal', at: Date.now(), end: null };
  if (fair) Object.assign(r, fields);
  else r.pr = 1;
  r.ms = game.timeMs || 0;
  saveStats();
}
// Guess: the fewest guesses a win took - a record, so without hints, a category, or a word a friend chose
export const bestGuessWin = () => Object.values(stats.rec).filter(r => !r.pr && r.m === 'guess' && r.end === 'won' && !r.h && !r.fr && r.cat === 'all')
  .reduce((a, r) => !a || r.g < a ? r.g : a, 0);
// anything else that changes a record (a hint, the computer's move): only once the game counts
export function noteMove(game, fields) { if (stats.rec[game.id]) recordMove(game, fields); }
function closeRecord(game, end, fields = {}) {
  const fair = counts(game);
  const r = stats.rec[game.id];
  if (!r) return;
  if (fair) Object.assign(r, fields);
  // Natural finishes count even in practice; scores and vocabulary do not (owner, 2026-11-20).
  if (fields.finished != null) r.finished = fields.finished;
  Object.assign(r, { end, ea: Date.now(), ms: game.timeMs || 0 });
  saveStats();
}

let saves;
try { saves = JSON.parse(localStorage.getItem('wg.saves')) || []; } catch { saves = []; }
// saves from before the rename carry a baked-in "Game 4" / "Gra 4": give them their number back so
// they follow the interface language too
for (const g of saves) {
  const auto = g.name && /^(Game|Gra)\s+(\d+)$/.exec(g.name);
  if (auto) { g.auto = +auto[2]; g.name = ''; }
  counts(g);
  g.mode ||= 'guess';   // every save from before Letters existed is a Guess game
}
// Tiles on several phones: since 0.53.0 only the phone that started a game keeps it (owner, 2026-09-27) - the copies
// the joining phone saved in 0.52 go
saves = saves.filter(g => g.link?.role !== 'guest');
const persistSaves = () => write('wg.saves', saves);

export const listSaves = () => [...saves].sort((a, b) => b.updated - a.updated);
// A game this phone joined on someone else's phone (Tiles on several phones): here only while it is played - never
// saved, never listed (owner, 2026-09-27: "the game isn't saved on his device").
const live = new Map();
export const getSave = id => saves.find(s => s.id === id) ?? live.get(id);
export function putSave(game) {
  counts(game);
  game.updated = Date.now();
  if (game.live) { live.set(game.id, game); return; }
  const index = saves.findIndex(s => s.id === game.id);
  if (index >= 0) saves[index] = game;
  else saves.push(game);
  const mode = game.mode ?? 'guess';
  const unfinished = saves.filter(s => (s.mode ?? 'guess') === mode && (!s.status || s.status === 'playing'))
    .sort((a, b) => (a.updated || a.created || 0) - (b.updated || b.created || 0));
  const evicted = unfinished.slice(0, Math.max(0, unfinished.length - SAVE_LIMIT));
  for (const old of evicted) deleteSave(old.id);
  persistSaves();
  if (evicted.length) globalThis.document?.dispatchEvent?.(new CustomEvent('lexling:save-evicted'));
}
export function deleteSave(id) {
  // a game deleted before it ended: its record stays, as left
  const r = stats.rec?.[id];
  if (r && !r.end) { r.end = 'left'; r.ea = Date.now(); saveStats(); }
  live.delete(id);
  saves = saves.filter(s => s.id !== id);
  persistSaves();
}

// An unnamed game keeps its number, not a baked-in "Game 4": gameName() spells it in whatever language
// the interface is in right now. A name the player typed is theirs and is left alone.
// A named game still shows its number (owner, 2026-09-26): "Name (Game 12)".
// A game joined on another phone shows the title the host's phone gives it, as it is.
export const gameName = g => { if (g.title) return g.title; const no = t('games.defaultName', { n: g.auto ?? 1 }); return g.name ? `${g.name} (${no})` : no; };

// `fields` is the game's own settings: Guess { lang, cat, band, diff, friend, secret },
// Letters { mode: 'letters', lang, cat, len, tries (0 = unlimited), diff, marks, secret },
// Tiles { mode: 'tiles', lang, state (tiles.js), firstSet (who starts was chosen, not drawn), order (each rack as
// arranged), turnMs (time of the turn under way) }.
export function newGame(fields) {
  stats.gameNo++;   // (counted as played at its first move: recordMove)
  saveStats();
  const game = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), auto: stats.gameNo, name: '',
    mode: 'guess', ...fields, guesses: [], status: 'playing', timeMs: 0, created: Date.now(), updated: Date.now() };
  putSave(game);
  return game;
}

export function recordGuess(game, word, typed) {
  if (counts(game)) {
    unique.add(game.lang + ':' + word);
    collect('guess', game.lang, word, game);
  }
  recordMove(game, { g: game.guesses.filter(x => !x.hint).length, ch: (stats.rec[game.id]?.ch || 0) + [...typed].length,
    h: game.guesses.filter(x => x.hint).length, cat: game.cat, fr: !!game.friend });
}

// Count submitted rows, including repeated letters, using the board's own colours (owner, 2026-11-20).
export function recordLettersMove(game, word) {
  const r = stats.rec[game.id], marks = feedback(word, game.secret);
  recordMove(game, { g: game.guesses.length, len: game.len, cat: game.cat,
    ch: (r?.ch || 0) + marks.length, gr: (r?.gr || 0) + marks.filter(x => x === 'green').length,
    yl: (r?.yl || 0) + marks.filter(x => x === 'yellow').length });
}

// What a win counts toward depends on how much help the player had:
//  * friend mode - somebody else chose the word, so it counts for nothing but the plain totals;
//  * a category - the hint makes the word quick to corner, so speed and difficulty are not comparable
//    with an open game. Those wins count toward the categories-won statistic only.
// (a win with hints, in a category, or with a word a friend chose is no record - the statistics screen sees to that)
export function recordEnd(game, won, difficulty = -1) {
  closeRecord(game, won ? 'won' : 'gave', { h: game.guesses.filter(x => x.hint).length, dif: difficulty, ...(won ? { w: game.secret } : {}) });
  deleteSave(game.id);   // finished games leave the picker; their numbers live on in the stats
}

// A Letters game ends won, lost (out of tries) or given up. Only a win keeps the streak going.
export function recordLettersEnd(game) {
  closeRecord(game, game.status === 'won' ? 'won' : game.status === 'lost' ? 'lost' : 'gave', { g: game.guesses.length });
  deleteSave(game.id);
}

// A Connect game ends solved ('won') or given up. Its words, bonus words and hints add to the totals;
// the longest word found - on the board or a bonus - is kept with the game's name and when.
// A finished Tiles game into the statistics - every game on this device, several people included; the
// computer's own moves never count (tiles.js results). `id` = its save, which goes.
// `game` = its save. Practice retains only participation and time.
export function recordTilesEnd(game, only, help) {
  closeRecord(game, 'done', { finished: tilesRecord(game.state, only).finished, ...help });
  deleteSave(game.id);
}
// a Tiles game's record: its numbers for this device's people (tiles.js results)
export const tilesRecord = (state, only) => { const r = results(state, only); return { ...r, lv: r.level, lang: r.lang }; };

// Only actions owned here since joining/rebuilding this seat can enter its live totals.
export function tilesProgress(game, only = -1) {
  const state = game.state, r = stats.rec[game.id];
  const end = state.pending?.before?.moves?.length ?? state.moves.length;
  const mine = state.moves.slice(game.statsDone ?? end, end).filter(m => m.kind === 'play' &&
    !state.players[m.p]?.cpu && (only < 0 || m.p === only));
  game.statsDone = end;
  // New fields start with locally owned, settled moves; never backfill a remote seat (owner, 2026-11-20).
  const quality = { wc: r?.wc || 0, wp: r?.wp || 0, seven: r?.seven || 0,
    bw: r?.bw ?? null, long: r?.long ?? null, bx: { d: 0, t: 0, D: 0, T: 0, ...r?.bx } };
  if (counts(game)) for (const m of mine.filter(m => !m.hinted && !m.approved)) {
    for (const w of m.words ?? []) {
      const word = { w: w.w, score: w.score, at: Date.now() };
      quality.wc++;
      quality.wp += w.score;
      if ([...w.w].length === 7) quality.seven++;
      if (!quality.bw || word.score > quality.bw.score) quality.bw = word;
      if (!quality.long || [...word.w].length > [...quality.long.w].length) quality.long = word;
    }
    const n = sizeOf(state.board), prem = premiums(state.board);
    const used = new Set((m.placed ?? []).map(t => t.r * n + t.c));
    if (state.rules?.premiums === 'always') for (const w of m.words ?? []) {
      if (w.r == null || w.c == null) continue;
      [...w.w].forEach((_, k) => used.add((w.r + (w.across ? 0 : k)) * n + w.c + (w.across ? k : 0)));
    }
    for (const k of used) if (prem[k] in quality.bx) quality.bx[prem[k]]++;
  }
  return { ...tilesRecord(state, only), moves: (r?.moves || 0) + mine.length,
    tiles: (r?.tiles || 0) + mine.reduce((n, m) => n + (m.placed?.length ?? 0), 0), ...quality };
}

// How good the people's moves were in a finished Tiles game - their points and the best there was, summed - for the
// statistics' move rating (owner, 2026-09-26). From the end review, so only games that have ratings; its entry was made
// by recordTilesEnd a moment before.
export function recordTilesRating(game, played, best) {
  if (best) noteMove(game, { rp: played, rb: best });
}

// `fields`: connect-game.js connectRecord() - words with a hinted letter kept apart
export function recordConnectEnd(game, fields) {
  closeRecord(game, game.status === 'won' ? 'won' : 'gave', fields);
  deleteSave(game.id);
}

// Time in game counts only while the player is actually playing: the game's screen open, the window
// visible, and something typed within the last IDLE_MS. A game left open on the desk adds nothing.
// Returns the screen's cleanup.
const IDLE_MS = 60000;
export function playClock(root, game, onScreen) {
  const playing = () => game.status === 'playing';
  let ticks = 0, lastActive = Date.now();
  const touch = () => { lastActive = Date.now(); };
  root.addEventListener('keydown', touch);
  root.addEventListener('pointerdown', touch);
  const persist = () => {
    if (playing()) putSave(game);
    saveStats();
  };
  const timer = setInterval(() => {
    if (!onScreen()) return clearInterval(timer);   // this screen has been replaced
    if (!playing() || document.visibilityState !== 'visible' || Date.now() - lastActive > IDLE_MS) return;
    game.timeMs += 1000;
    stats.timeMs += 1000;
    const r = stats.rec[game.id];
    if (r) r.ms = game.timeMs;
    if (++ticks % 10 === 0) persist();
  }, 1000);
  window.addEventListener('pagehide', persist);
  return () => {
    clearInterval(timer);
    window.removeEventListener('pagehide', persist);
    root.removeEventListener('keydown', touch);      // `root` outlives the screen, so these must go
    root.removeEventListener('pointerdown', touch);
    persist();
  };
}

// Historical totals with the same meaning remain included. Untagged old totals can only be
// shown for all languages; records and vocabulary retain their language attribution.
export function totals(mode, lang = 'all', saved = stats) {
  const legacy = lang === 'all', rs = Object.values(saved.rec ?? {}).filter(r => r.m === mode && (legacy || r.lang === lang));
  const fair = rs.filter(r => !r.pr);
  const sum = key => fair.reduce((n, r) => n + (+r[key] || 0), 0);
  const ended = ends => rs.filter(r => ends.includes(r.end)).length;
  // Missing fields stay unknown: an old game must never dilute a new average (owner, 2026-11-20).
  const timed = rs.filter(r => Number.isFinite(r.ms));
  const timeMs = timed.reduce((n, r) => n + r.ms, 0);
  const old = Object.entries(saved.tl ?? {}).filter(([k]) => legacy || k.startsWith(lang + '|')).map(([, r]) => r);
  const earlierPlayed = mode === 'tiles' ? old.reduce((n, r) => n + (r.played || 0), 0)
    : legacy ? (mode === 'guess' ? saved.played : mode === 'letters' ? saved.lt?.played : saved.cn?.played) || 0 : 0;
  const common = { played: rs.length + earlierPlayed, timeMs, timedGames: timed.length,
    avgTime: timed.length ? timeMs / timed.length : null };
  if (mode === 'guess') return { ...common, finished: ended(['won']) + (legacy ? saved.won || 0 : 0),
    guesses: sum('g') + (legacy ? saved.words || 0 : 0),
    distinct: (saved.unique ?? []).filter(w => legacy || w.startsWith(lang + ':')).length,
    letters: sum('ch') + (legacy ? saved.letters || 0 : 0) };
  if (mode === 'letters') {
    const solved = fair.filter(r => r.end === 'won').length + (legacy ? saved.lt?.won || 0 : 0);
    const rated = fair.filter(r => ['won', 'lost'].includes(r.end)).length + (legacy ? (saved.lt?.won || 0) + (saved.lt?.lost || 0) : 0);
    return { ...common, finished: ended(['won', 'lost']) + (legacy ? (saved.lt?.won || 0) + (saved.lt?.lost || 0) : 0),
      solved, wonPct: rated ? solved / rated * 100 : null, letters: sum('ch'), green: sum('gr'), yellow: sum('yl') };
  }
  if (mode === 'connect') {
    const bonusGames = fair.filter(r => Number.isFinite(r.b));
    return { ...common, finished: ended(['won']) + (legacy ? saved.cn?.solved || 0 : 0),
      words: sum('f') + (legacy ? saved.cn?.words || 0 : 0), bonus: sum('b') + (legacy ? saved.cn?.bonus || 0 : 0),
      bonusPerGame: bonusGames.length ? bonusGames.reduce((n, r) => n + r.b, 0) / bonusGames.length : null };
  }
  const wordGames = fair.filter(r => Number.isFinite(r.wc) && Number.isFinite(r.wp));
  const wordsFormed = wordGames.reduce((n, r) => n + r.wc, 0), wordPoints = wordGames.reduce((n, r) => n + r.wp, 0);
  const bestWord = fair.reduce((a, r) => r.bw && (!a || r.bw.score > a.score) ? r.bw : a, null);
  const longest = fair.reduce((a, r) => r.long && (!a || [...r.long.w].length > [...a.w].length) ? r.long : a, null);
  // Old Tiles 'played'/'done' included surrender, so they cannot establish a natural finish.
  return { ...common, finished: rs.reduce((n, r) => n + (r.finished || 0), 0),
    words: sum('moves') + old.reduce((n, r) => n + (r.moves || 0), 0), tiles: sum('tiles'),
    wordsFormed, wordPoints, avgWordPoints: wordsFormed ? wordPoints / wordsFormed : null,
    bestWord, longest, seven: sum('seven'),
    bonuses: Object.fromEntries(['d', 't', 'D', 'T'].map(k => [k, fair.reduce((n, r) => n + (r.bx?.[k] || 0), 0)])) };
}
