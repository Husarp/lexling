// Settings, saved games and lifetime stats. Everything lives in localStorage; the desktop/Android
// wrappers pin the WebView's storage folder outside the install dir so updates never touch it.
import { HARD_WIN } from './badges.js';
import { t } from './i18n.js';
const read = (key, fallback) => {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }; } catch { return { ...fallback }; }
};
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: play on, unsaved */ } };

export const settings = read('wg.settings', {
  lang: (navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en',
  theme: 'dark', accent: 'orange', sound: true, fuzzy: true, langChosen: false, lastCheck: 0, latest: '',
  // Only the language carries over between games; everything else starts from NEW_GAME each time.
  newGame: { lang: null },
});
export const saveSettings = () => write('wg.settings', settings);

export const stats = read('wg.stats', {
  // wonGuesses / wonRated are the average-win stat; they count only the wins that qualify (see recordEnd)
  played: 0, won: 0, givenUp: 0, words: 0, letters: 0, timeMs: 0, bestWin: 0, wonGuesses: 0, wonRated: 0,
  hardest: null,    // { w, lang, score, guesses } - the toughest secret beaten so far
  hardWins: 0,      // wins on a word of difficulty >= HARD_WIN
  wonPools: {},     // category key (or "all") -> true, for the explorer badge
  wonLang: {},      // language -> wins, for the polyglot badge
  seenTiers: {},    // badge id -> tiers the player had when they last opened the stats screen
  unique: [], gameNo: 0,
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

export function newGame({ lang, cat, band, diff, friend, secret }) {
  stats.played++; stats.gameNo++;
  saveStats();
  const game = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), auto: stats.gameNo, name: '',
    lang, cat, band, diff, friend, secret, guesses: [], status: 'playing', timeMs: 0, created: Date.now(), updated: Date.now() };
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
//    with an open game. Those wins feed the explorer badge instead (badges.js explains the reasoning).
export function recordEnd(game, won, difficulty = -1, hinted = false) {
  if (won) {
    stats.won++;
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
