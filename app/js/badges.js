export const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'amethyst'];

// A win only counts toward the speed and difficulty badges when the player had no category hint:
// being told the secret is an animal cuts the search from 6 207 words to 150, which is exactly what
// makes those games quick. Categories have their own badge (explorer) instead.
export const HARD_WIN = 70;          // "a hard word": the top ~10 % of the uncategorised pool
const HOUR = 3600000;

// `lower: true` = smaller is better, and the tier is won by staying STRICTLY under the number, so the
// label can read "win in less than 12 moves" and be exactly true. 0 means no win yet.
// `fmt` formats the value and the thresholds where plain numbers would not read (hours).
export const BADGES = [
  { id: 'wordsmith', th: [100, 500, 2000, 10000, 30000], value: s => s.unique.length },
  { id: 'typist', th: [1000, 5000, 25000, 100000, 500000], value: s => s.letters },
  { id: 'sharpshooter', th: [50, 25, 12, 6, 3], value: s => s.bestWin, lower: true },
  // tiers from the data: uncategorised secrets top out at 82 (PL) / 85 (EN), and 79 is the 99th
  // percentile in both, so 79 is a real summit rather than an impossible one.
  { id: 'slayer', th: [45, 55, 65, 72, 79], value: s => s.hardest?.score ?? 0 },
  { id: 'deepcut', th: [1, 3, 10, 25, 50], value: s => s.hardWins ?? 0 },
  // 21 = the 20 categories plus "all", which store.js records under that name: the top tier therefore
  // needs one category-free win as well. Counting only real categories would make it unreachable.
  { id: 'explorer', th: [3, 6, 10, 15, 21], value: s => Object.keys(s.wonPools ?? {}).length },
  { id: 'marathon', th: [HOUR, 5 * HOUR, 20 * HOUR, 50 * HOUR, 100 * HOUR], value: s => s.timeMs,
    fmt: v => v >= HOUR ? (v / HOUR).toFixed(v < 10 * HOUR ? 1 : 0).replace(/\.0$/, '') + ' h' : Math.round(v / 60000) + ' min' },
  { id: 'polyglot', th: [1, 3, 10, 25, 50], value: s => Math.min(s.wonLang?.pl ?? 0, s.wonLang?.en ?? 0) },
];

export function progress(badge, stats) {
  const value = badge.value(stats);
  const unlocked = badge.lower ? (value ? badge.th.filter(t => value < t).length : 0) : badge.th.filter(t => value >= t).length;
  const next = unlocked < badge.th.length ? badge.th[unlocked] : null;
  const pct = next === null ? 100 : badge.lower ? unlocked / badge.th.length * 100 : Math.min(100, value / next * 100);
  return { value, unlocked, next, pct: Math.round(pct) };
}

