// How each Tiles computer level plays: every level plays games against the same fixed opponent - one that always
// plays the highest-scoring move, knowing every word - and the script prints its average score, its share of the
// opponent's, and how human its moves look: words made per move, moves making three or more words at once, and
// moves using a rare word (not among the 20 000 most common base words, or not in that list at all).
//   node tools/bot-strength.mjs [games per level, default 12] [pl|en, default pl]
import { readFileSync } from 'node:fs';

const ROOT = new URL('../app/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords, resolve } = await import('../app/js/engine.js');
const { has } = await import('../app/js/dawg.js');
const { newGame, apply, loadTileWords, wordsMade } = await import('../app/js/tiles.js');
const { computerMove, hint, LEVELS, loadSpoken } = await import('../app/js/tiles-moves.js');

const games = +(process.argv[2] ?? 12), lang = process.argv[3] ?? 'pl', RARE = 20000;
const lex = await loadWords(lang), dict = await loadTileWords(lang), spoken = await loadSpoken(lang);
const rankOf = w => resolve(lex, w)?.idx ?? Infinity, spokenOf = w => spoken.get(w) ?? Infinity, isWord = w => has(dict, w);
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const greedy = s => { const m = hint(s, dict); return m ? { type: 'place', placed: m.placed } : { type: 'pass' }; };

function match(level, seed, seen) {
  const rand = seeded(seed);
  let s = newGame({ lang, board: 'classic', players: [{ cpu: level }, { cpu: 'hard' }], seed, words: dict.tag });
  for (let turns = 0; !s.over && turns < 300; turns++) {
    const p = s.turn, t0 = performance.now();
    const a = (p === 0 ? computerMove(s, dict, level, rankOf, rand, spokenOf) : greedy(s)) ?? { type: 'pass' };
    if (p === 0) {
      seen.ms += performance.now() - t0; seen.turns++;
      if (a.type === 'place') {
        const { words } = wordsMade(s, a.placed);
        seen.moves++; seen.words += words.length;
        if (words.length >= 3) seen.multi++;
        if (words.some(x => rankOf(x.w) >= RARE)) seen.rare++;
      }
    }
    s = apply(s, a, isWord);
  }
  return s.scores;
}
console.log('level'.padEnd(9) + 'points  vs best-move player   won   words/move  3+ words  rare word  ms/turn');
for (const level of Object.keys(LEVELS)) {
  let mine = 0, ref = 0, wins = 0;
  const seen = { ms: 0, turns: 0, moves: 0, words: 0, multi: 0, rare: 0 };
  for (let g = 0; g < games; g++) { const [a, b] = match(level, 1000 + g, seen); mine += a; ref += b; if (a > b) wins++; }
  const pct = x => `${Math.round(x / seen.moves * 100)} %`;
  console.log(level.padEnd(9) + `${Math.round(mine / games)}`.padStart(6) + `  ${Math.round(ref / games)} (${Math.round(mine / ref * 100)} %)`.padEnd(21)
    + `${wins}/${games}`.padStart(6) + (seen.words / seen.moves).toFixed(2).padStart(13) + pct(seen.multi).padStart(10)
    + pct(seen.rare).padStart(11) + `${Math.round(seen.ms / seen.turns)}`.padStart(9));
}
