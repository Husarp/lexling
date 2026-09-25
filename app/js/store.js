// Settings, saved games and lifetime stats. Everything lives in localStorage; the desktop/Android
// wrappers pin the WebView's storage folder outside the install dir so updates never touch it.
import { t } from './i18n.js';

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
  // "Allow Polish letters" on the new-game screens: on at first, then whatever the player chose last - one
  // choice for every game (owner, 2026-09-25)
  polish: true,
  // Only the language carries over between games; everything else starts from NEW_GAME each time.
  newGame: { lang: null },
});
export const saveSettings = () => write('wg.settings', settings);

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
  lt: { played: 0, won: 0, lost: 0, givenUp: 0, streak: 0, bestStreak: 0, wonTries: 0, wonLen: {}, hints: 0, hintGames: 0 },
  // Connect's own numbers: words = board words the player found, longest = { w, game, at } of any word found
  cn: { played: 0, solved: 0, givenUp: 0, words: 0, bonus: 0, hints: 0, longest: null },
});
const unique = new Set(stats.unique);
export const saveStats = () => { stats.unique = [...unique]; write('wg.stats', stats); };

let saves;
try { saves = JSON.parse(localStorage.getItem('wg.saves')) || []; } catch { saves = []; }
// saves from before the rename carry a baked-in "Game 4" / "Gra 4": give them their number back so
// they follow the interface language too
for (const g of saves) {
  const auto = g.name && /^(Game|Gra)\s+(\d+)$/.exec(g.name);
  if (auto) { g.auto = +auto[2]; g.name = ''; }
  g.mode ||= 'guess';   // every save from before Letters existed is a Guess game
}
const persistSaves = () => write('wg.saves', saves);

export const listSaves = () => [...saves].sort((a, b) => b.updated - a.updated);
export const getSave = id => saves.find(s => s.id === id);
export function putSave(game) {
  game.updated = Date.now();
  if (!saves.includes(game)) saves.push(game);
  persistSaves();
}
export function deleteSave(id) {
  saves = saves.filter(s => s.id !== id);
  persistSaves();
}

// An unnamed game keeps its number, not a baked-in "Game 4": gameName() spells it in whatever language
// the interface is in right now. A name the player typed is theirs and is left alone.
export const gameName = g => g.name || t('games.defaultName', { n: g.auto ?? 1 });

// `fields` is the game's own settings: Guess { lang, cat, band, diff, friend, secret },
// Letters { mode: 'letters', lang, cat, len, tries (0 = unlimited), diff, marks, secret }.
export function newGame(fields) {
  if (fields.mode === 'letters') stats.lt.played++;
  else if (fields.mode === 'connect') stats.cn.played++;
  else stats.played++;
  stats.gameNo++;
  saveStats();
  const game = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), auto: stats.gameNo, name: '',
    mode: 'guess', ...fields, guesses: [], status: 'playing', timeMs: 0, created: Date.now(), updated: Date.now() };
  putSave(game);
  return game;
}

export function recordGuess(game, word, typed) {
  stats.words++;
  stats.letters += [...typed].length;
  unique.add(game.lang + ':' + word);
  saveStats();
}

// What a win counts toward depends on how much help the player had:
//  * friend mode - somebody else chose the word, so it counts for nothing but the plain totals;
//  * a category - the hint makes the word quick to corner, so speed and difficulty are not comparable
//    with an open game. Those wins count toward the categories-won statistic only.
export function recordEnd(game, won, difficulty = -1, hinted = false) {
  stats.hints = (stats.hints || 0) + game.guesses.filter(g => g.hint).length;
  stats.hintGames = (stats.hintGames || 0) + 1;
  if (won) {
    stats.won++;
    // guesses per win, in four bands, for the statistics chart (counted from 0.24.0)
    const g = game.guesses.length, band = g <= 10 ? 'a' : g <= 25 ? 'b' : g <= 50 ? 'c' : 'd';
    stats.guessDist = { ...stats.guessDist, [band]: (stats.guessDist?.[band] || 0) + 1 };
    if (!game.friend) {
      stats.wonLang[game.lang] = (stats.wonLang[game.lang] || 0) + 1;
      stats.wonPools[game.cat] = true;
    }
    // …and a win the game helped you to is not a speed or difficulty record either
    if (!game.friend && !hinted && game.cat === 'all') {
      stats.wonGuesses += game.guesses.length;
      stats.wonRated++;
      if (!stats.bestWin || game.guesses.length < stats.bestWin) stats.bestWin = game.guesses.length;
      if (difficulty >= 0) {
        if (!stats.hardest || difficulty > stats.hardest.score) {
          stats.hardest = { w: game.secret, lang: game.lang, score: difficulty, guesses: game.guesses.length };
        }
        if (difficulty >= HARD_WIN) stats.hardWins++;
      }
    }
  } else {
    stats.givenUp++;
  }
  saveStats();
  deleteSave(game.id);   // finished games leave the picker; their numbers live on in the stats
}

// A Letters game ends won, lost (out of tries) or given up. Only a win keeps the streak going.
export function recordLettersEnd(game) {
  const s = stats.lt;
  s.hints = (s.hints || 0) + (game.hinted?.length || 0);
  s.hintGames = (s.hintGames || 0) + 1;
  // tries per win (1–6, 7+) and games lost, for the statistics chart (counted from 0.24.0)
  const tried = game.status === 'won' ? (game.guesses.length > 6 ? '7+' : String(game.guesses.length)) : game.status === 'lost' ? 'x' : null;
  if (tried) s.dist = { ...s.dist, [tried]: (s.dist?.[tried] || 0) + 1 };
  if (game.status === 'won') {
    s.won++;
    s.bestStreak = Math.max(s.bestStreak, ++s.streak);
    s.wonTries += game.guesses.length;
    s.wonLen[game.len] = (s.wonLen[game.len] || 0) + 1;
  } else {
    if (game.status === 'lost') s.lost++; else s.givenUp++;
    s.streak = 0;
  }
  saveStats();
  deleteSave(game.id);
}

// A Connect game ends solved ('won') or given up. Its words, bonus words and hints add to the totals;
// the longest word found - on the board or a bonus - is kept with the game's name and when.
export function recordConnectEnd(game) {
  const s = stats.cn;
  if (game.status === 'won') s.solved++; else s.givenUp++;
  s.words += game.found.length;
  s.bonus += game.bonus.length;
  s.hints += game.hints;
  const longest = [...game.found, ...game.bonus].reduce((a, w) => [...w].length > [...a].length ? w : a, '');
  if (longest && (!s.longest || [...longest].length > [...s.longest.w].length)) s.longest = { w: longest, game: gameName(game), at: Date.now() };
  saveStats();
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
