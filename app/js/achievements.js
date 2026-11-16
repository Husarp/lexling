import { stats, saveStats } from './store.js';

export const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'amethyst'];
export const TIERED = [
  { id: 'guess.won', game: 'guess', th: [3, 10, 30, 80, 200] },
  { id: 'letters.won', game: 'letters', th: [5, 25, 100, 300, 1000] },
  { id: 'connect.words', game: 'connect', th: [50, 250, 1000, 3000, 10000] },
  { id: 'tiles.words', game: 'tiles', th: [25, 100, 500, 2000, 5000] },
  { id: 'tiles.points', game: 'tiles', th: [500, 2500, 10000, 50000, 150000] },
];
export const CHALLENGES = [
  'tiles.bingo', 'tiles.len8', 'tiles.len10', 'tiles.triple', 'tiles.move100', 'tiles.rare1', 'tiles.multi3', 'tiles.beatHard', 'tiles.beatExpert',
].map(id => ({ id, game: 'tiles' }));

// Achievements return, counted from now on without back-filling old statistics (owner, 2026-11-14).
stats.ach ??= { since: Date.now(), n: {}, got: {} };
const ach = stats.ach;
export const gotAt = key => ach.got[key] ?? null;

// Reconcile lower Guess thresholds silently, keeping existing award dates.
const guess = TIERED.find(d => d.id === 'guess.won');
const reached = guess.th.flatMap((th, i) => (ach.n[guess.id] ?? 0) >= th && gotAt(`${guess.id}#${i}`) === null ? [`${guess.id}#${i}`] : []);
if (reached.length) {
  const at = Date.now();
  for (const key of reached) ach.got[key] = at;
  saveStats();
}

export function playChallenges(move, { rarePct = null } = {}) {
  if (move.kind !== 'play' || move.hinted || move.approved) return [];
  const words = (move.words ?? []).map(x => [...x.w]);
  const keys = [];
  if (move.placed?.length === 7) keys.push('tiles.bingo');
  if (words.some(w => w.length >= 8)) keys.push('tiles.len8');
  if (words.some(w => w.length >= 10)) keys.push('tiles.len10');
  if (words.some(w => {
    const counts = new Map();
    return w.some(ch => { const n = (counts.get(ch) ?? 0) + 1; counts.set(ch, n); return n >= 3; });
  })) keys.push('tiles.triple');
  if (move.score >= 100) keys.push('tiles.move100');
  // Outside the frequency list does not count as a rare-word challenge (owner, 2026-11-14).
  if (Number.isFinite(rarePct) && rarePct >= 0 && rarePct <= 1) keys.push('tiles.rare1');
  if (words.length >= 3) keys.push('tiles.multi3');
  return keys;
}

export function gameChallenges(state, mine) {
  const winner = state.over?.winner ?? -1;
  if (winner < 0 || !mine.includes(winner) || !state.players[winner] || state.players[winner].cpu) return [];
  const keys = [];
  if (state.players.some(p => p.cpu === 'hard' || p.cpu === 'expert')) keys.push('tiles.beatHard');
  if (state.players.some(p => p.cpu === 'expert')) keys.push('tiles.beatExpert');
  return keys;
}

function unlock(keys) {
  keys = keys.filter(key => gotAt(key) === null);
  const at = Date.now();
  for (const key of keys) ach.got[key] = at;
  saveStats();
  if (keys.length && typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('lexling:achievement', { detail: { keys } }));
  return keys;
}

export function bump(id, by = 1) {
  const def = TIERED.find(d => d.id === id);
  if (!def || !Number.isFinite(by) || by <= 0) return [];
  const value = ach.n[id] = (ach.n[id] ?? 0) + by;
  return unlock(def.th.flatMap((th, i) => value >= th ? [`${id}#${i}`] : []));
}

export function grant(id) {
  return CHALLENGES.some(d => d.id === id) ? unlock([id]) : [];
}

export function progress(def) {
  const value = ach.n[def.id] ?? 0, tiers = def.th.filter(th => value >= th).length;
  const next = def.th[tiers] ?? null;
  return { value, tiers, next, pct: next === null ? 100 : Math.round(Math.min(100, value / next * 100)) };
}
