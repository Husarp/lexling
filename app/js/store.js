// Settings, saved games and lifetime stats. Everything lives in localStorage; the desktop/Android
// wrappers pin the WebView's storage folder outside the install dir so updates never touch it.
import { t } from './i18n.js';
import { results } from './tiles.js';

// "A hard word": the top ~10 % of the uncategorised pool, for the hard-words statistic.
export const HARD_WIN = 70;
const read = (key, fallback) => {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }; } catch { return { ...fallback }; }
};
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: play on, unsaved */ } };

export const settings = read('wg.settings', {
  lang: (navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en',
  theme: 'dark', accent: 'orange', sound: true, fuzzy: true, langChosen: false, lastCheck: 0, latest: '',
  // Letters: tapping the tiles also opens the phone's own keyboard (the keys on screen stay) - owner, 2026-09-25
  phoneKb: false,
  // "Allow Polish letters" on the new-game screens: on at first, then whatever the player chose last - each
  // game its own choice (owner, 2026-09-25)
  polish: { letters: true, connect: true },
  // Tiles: each player's letters in their own colour (design v5) - also switched in a game's History panel
  tilesColours: 'letters',   // letters in the players' colours - the default since 0.51.3 (owner)
  // Tiles: the bonus squares in their colours - off: one quiet grey with the labels only (owner, 2026-09-25: "too many
  // colours on the board")
  tilesBonus: 'text',        // labels only - the default since 0.51.3 (owner)
  // Tiles: after each of your moves, how good it was - its points against the best move there was (owner, 2026-09-26)
  tilesRate: true,
  // Tiles: the tiles on the board raised, like real ones - easier to see (owner, 2026-09-26)
  tiles3d: false,
  // Tiles: the tiles' own colour - yellow, white, cream, wood or mint (owner, 2026-09-26)
  tilesTile: 'white',        // the default since 0.51.3 (owner)
  // The language always carries over between games; the rest only with rememberSetup (owner, 2026-09-26: "remember my
  // setup choices") - setup then holds each mode's last choices, else a New game starts from its defaults.
  newGame: { lang: null },
  rememberSetup: true,   // on by default since 0.51.1 (owner)
  setup: {},
  // Tiles on several phones: after a game, a reminder when Bluetooth is still on and Lexling switched it on (owner,
  // 2026-09-27: on by default, can be switched off)
  btRemind: true,
  // Settings → Check for updates: on opening and on coming back (APP-STANDARDS.md: on by default)
  updateCheck: true,
  // Settings → Time (owner, 2026-09-28): the current time on screen; a reminder of the time played, every remindMin minutes
  showClock: false, playRemind: false, remindMin: 90,
});
export const saveSettings = () => write('wg.settings', settings);
// Remembering New game choices became the default in 0.51.1 (owner) - switched on once for those whose settings still
// carry the old default (off); off again after that stays off.
if (!settings.rememberSetupOn) { settings.rememberSetup = true; settings.rememberSetupOn = true; saveSettings(); }

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
// records and averages) ── made at the game's first move (a game nobody moved in does not count - not even when the
// computer did), brought up to date as it is played, and kept whatever happens to the game: finished, given up, left,
// deleted. The statistics screen works its numbers out of these. The totals above are from before 0.60.0: they cannot
// be split by level or cleaned of hints, so they are kept as they were and no longer added to; `before` says how many
// games they cover. `kept` (owner, 2026-09-29): what a player asked to keep from them, put on that phone by hand -
// { tilesBestMove: { w, score, lang, lv, at } }.
//   every record: m (mode), lang, lv (the difficulty; Tiles: the strongest computer, or 'people'), at (the first move),
//                 end (null while it is played; 'won' | 'lost' | 'gave' | 'left' (deleted unfinished) | 'done' (Tiles)),
//                 ea (when it ended)
//   Guess: g (guesses), ch (letters typed), h (hints), cat, fr (a friend chose the word); at the end dif (the word's
//          difficulty) and w (the word, when won)
//   Letters: g (tries), len
//   Connect: f (words found without a hinted letter), fh (with one), b (bonus words), h (hints), long, gn (the game's name)
//   Tiles: tiles.js results() for this device's people, u (undo on), bs (the best move shown), rp / rb (move rating)
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
export function collect(mode, lang, word) {
  const s = collected(mode, lang);
  if (!word || s.has(word)) return;
  s.add(word);
  (stats.col[mode + '|' + lang] ??= []).push(word);
  saveStats();
}

// a counted move: the game's record, made at the first one
export function recordMove(game, fields) {
  const r = stats.rec[game.id] ??= { m: game.mode ?? 'guess', lang: game.lang, lv: game.diff ?? 'normal', at: Date.now(), end: null };
  Object.assign(r, fields);
  saveStats();
}
// Guess: the fewest guesses a win took - a record, so without hints, a category, or a word a friend chose
export const bestGuessWin = () => Object.values(stats.rec).filter(r => r.m === 'guess' && r.end === 'won' && !r.h && !r.fr && r.cat === 'all')
  .reduce((a, r) => !a || r.g < a ? r.g : a, 0);
// anything else that changes a record (a hint, the computer's move): only once the game counts
export function noteMove(game, fields) { if (stats.rec[game.id]) recordMove(game, fields); }
function closeRecord(game, end, fields = {}) {
  const r = stats.rec[game.id];
  if (!r) return;
  Object.assign(r, fields, { end, ea: Date.now() });
  saveStats();
}

let saves;
try { saves = JSON.parse(localStorage.getItem('wg.saves')) || []; } catch { saves = []; }
// saves from before the rename carry a baked-in "Game 4" / "Gra 4": give them their number back so
// they follow the interface language too
for (const g of saves) {
  const auto = g.name && /^(Game|Gra)\s+(\d+)$/.exec(g.name);
  if (auto) { g.auto = +auto[2]; g.name = ''; }
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
  game.updated = Date.now();
  if (game.live) { live.set(game.id, game); return; }
  if (!saves.includes(game)) saves.push(game);
  persistSaves();
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
  unique.add(game.lang + ':' + word);
  collect('guess', game.lang, word);
  recordMove(game, { g: game.guesses.filter(x => !x.hint).length, ch: (stats.rec[game.id]?.ch || 0) + [...typed].length,
    h: game.guesses.filter(x => x.hint).length, cat: game.cat, fr: !!game.friend });
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
// `game` = its save; `help` = { u: undo on, bs: the best move shown } - those games keep out of points and records
export function recordTilesEnd(game, only, help) {
  closeRecord(game, 'done', { ...tilesRecord(game.state, only), ...help });
  deleteSave(game.id);
}
// a Tiles game's record: its numbers for this device's people (tiles.js results)
export const tilesRecord = (state, only) => { const r = results(state, only); return { ...r, lv: r.level, lang: r.lang }; };

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
