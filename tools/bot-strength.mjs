// How strong each Tiles computer level is: every level (the usual ones, and with "Better bot reasoning") plays games
// against Hard, and its average score and share of Hard's is printed - to see that the levels go up in even steps.
//   node tools/bot-strength.mjs [games per level, default 12] [pl|en, default pl]
import { readFileSync } from 'node:fs';

const ROOT = new URL('../app/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords, resolve } = await import('../app/js/engine.js');
const { has } = await import('../app/js/dawg.js');
const { newGame, apply, loadTileWords } = await import('../app/js/tiles.js');
const { computerMove, REASONING } = await import('../app/js/tiles-moves.js');

const games = +(process.argv[2] ?? 12), lang = process.argv[3] ?? 'pl';
const lex = await loadWords(lang), dict = await loadTileWords(lang);
const rankOf = w => resolve(lex, w)?.idx ?? Infinity, isWord = w => has(dict, w);
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function match(level, reasoning, seed) {
  const rand = seeded(seed);
  let s = newGame({ lang, board: 'classic', players: [{ cpu: level }, { cpu: 'hard' }], seed, words: dict.tag });
  for (let turns = 0; !s.over && turns < 300; turns++) {
    const p = s.turn, a = computerMove(s, dict, s.players[p].cpu, rankOf, rand, p === 0 && reasoning);
    s = apply(s, a ?? { type: 'pass' }, isWord);
  }
  return s.scores;
}
const rows = [];
for (const [level, reasoning] of [['relaxed', false], ['easy', false], ['medium', false], ['normal', false],
  ...Object.keys(REASONING).map(l => [l, true])]) {
  let mine = 0, hard = 0, wins = 0;
  for (let g = 0; g < games; g++) { const [a, b] = match(level, reasoning, 1000 + g); mine += a; hard += b; if (a > b) wins++; }
  rows.push(`${(reasoning ? 'reasoning ' : '') + level}`.padEnd(20) + `${Math.round(mine / games)}`.padStart(5) + ` vs Hard ${Math.round(hard / games)}`
    + `  (${Math.round(mine / hard * 100)} % of Hard's, won ${wins}/${games})`);
  console.log(rows.at(-1));
}
