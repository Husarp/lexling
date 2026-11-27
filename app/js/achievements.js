import { stats, saveStats, counts, setupPractice } from './store.js';

export const TIERS = ['common', 'rare', 'epic', 'legendary', 'mythical'];
export const TIERED = [
  { id: 'guess.finished', game: 'guess', th: [5, 20, 50, 100, 200] },
  { id: 'letters.finished', game: 'letters', th: [5, 25, 100, 300, 1000] },
  { id: 'connect.words', game: 'connect', th: [50, 250, 1000, 3000, 10000] },
  { id: 'tiles.words', game: 'tiles', th: [25, 100, 500, 2000, 5000] },
  { id: 'tiles.letters', game: 'tiles', th: [100, 500, 2000, 10000, 30000] },
];
TIERED.push(
  { id: 'connect.boards', game: 'connect', th: [10, 30, 75, 200, 500] },
  { id: 'connect.bonus', game: 'connect', th: [10, 50, 150, 500, 1500] },
);
export const CHALLENGES = [
  'tiles.bingo', 'tiles.len8', 'tiles.len10', 'tiles.triple', 'tiles.rare1', 'tiles.multi3', 'tiles.beatHard', 'tiles.beatExpert', 'tiles.photoFinish',
].map(id => ({ id, game: 'tiles' }));

for (const game of ['guess', 'letters', 'connect']) {
  const ids = { guess: [], letters: ['longHaul', 'everyLength'], connect: ['hardBoard'] }[game];
  CHALLENGES.push(...ids.map(id => ({ id: `${game}.${id}`, game })));
}

// Live ledger: keep earned tiers; migrate renamed ladders without startup notifications.
stats.ach ??= { since: Date.now(), n: {}, got: {} };
const ach = stats.ach;
export const gotAt = key => ach.got[key] ?? null;

// Keep original keys and dates, including unknown/retired awards. Migration only adds data.
export function migrateAchievements(saved) {
  const a = saved.ach ??= { since: Date.now(), n: {}, got: {} };
  a.n ??= {}; a.got ??= {};
  if (a.fair === 1) return;
  for (const [old, id] of [['guess.won', 'guess.finished'], ['letters.won', 'letters.finished']]) {
    a.n[id] = Math.max(a.n[id] ?? 0, a.n[old] ?? 0);
    TIERS.forEach((_, i) => {
      if (a.got[`${old}#${i}`] != null && a.got[`${id}#${i}`] == null) a.got[`${id}#${i}`] = a.got[`${old}#${i}`];
    });
  }
  a.n['connect.bonus'] ??= (saved.cn?.bonus ?? 0) + Object.values(saved.rec ?? {}).filter(r => !r.pr && r.m === 'connect').reduce((n, r) => n + (r.b || 0), 0);
  a.n['tiles.letters'] ??= 0;
  a.fair = 1;
}
migrateAchievements(stats);
for (const def of TIERED) {
  def.th.forEach((th, i) => {
    const key = `${def.id}#${i}`;
    if ((ach.n[def.id] ?? 0) >= th && gotAt(key) === null) ach.got[key] = Date.now();
  });
}
saveStats();
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
  // Outside the frequency list does not count as a rare-word challenge (owner, 2026-11-14).
  if (Number.isFinite(rarePct) && rarePct >= 0 && rarePct <= 1) keys.push('tiles.rare1');
  if (words.length >= 3) keys.push('tiles.multi3');
  return keys;
}

export function gameChallenges(state, mine) {
  if (setupPractice({ mode: 'tiles', state }) || !['out', 'passes'].includes(state.over?.reason)) return [];
  const winner = state.over?.winner ?? -1;
  if (winner < 0 || !mine.includes(winner) || !state.players[winner] || state.players[winner].cpu) return [];
  const keys = [];
  // Compare before the winner's final turn, before rack/time adjustments (owner, 2026-11-20).
  const moves = state.moves ?? [];
  const last = moves.findLastIndex(m => m.p === winner && !['hint', 'resign'].includes(m.kind));
  if (last >= 0 && state.scores?.[winner] > Math.max(...state.scores.filter((_, p) => p !== winner && !state.out?.[p]))) {
    const before = state.players.map(() => 0);
    for (const m of moves.slice(0, last)) {
      if (m.kind === 'play') before[m.p] += m.score;
      if (m.kind === 'hint') before[m.p] -= m.cost;
    }
    if (before.some((score, p) => p !== winner && !state.out?.[p] && score >= before[winner])) keys.push('tiles.photoFinish');
  }
  if (state.players.length !== 2 || state.players.filter(p => !p.cpu).length !== 1 ||
    state.log?.some(a => a.type === 'resign')) return keys;
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

export function bump(id, by = 1, game) {
  if (!counts(game)) return [];
  const def = TIERED.find(d => d.id === id);
  if (!def || !Number.isFinite(by) || by <= 0) return [];
  const value = ach.n[id] = (ach.n[id] ?? 0) + by;
  return unlock(def.th.flatMap((th, i) => value >= th ? [`${id}#${i}`] : []));
}

export function grant(id, game) {
  if (!counts(game)) return [];
  return CHALLENGES.some(d => d.id === id) ? unlock([id]) : [];
}

export function progress(def) {
  const value = ach.n[def.id] ?? 0, tiers = Math.max(def.th.filter(th => value >= th).length,
    ...def.th.map((_, i) => gotAt(`${def.id}#${i}`) === null ? 0 : i + 1));
  const next = def.th[tiers] ?? null;
  return { value, tiers, next, pct: next === null ? 100 : Math.round(Math.min(100, value / next * 100)) };
}

// Called only on a new terminal transition; reopening a finished save never counts it again.
export function recordAchievementEnd(game, mode, difficulty = -1) {
  if (!counts(game)) return;
  const won = game.status === 'won';
  if (won && mode === 'letters') {
    const length = [...game.secret].length;
    if (length >= 8) grant('letters.longHaul', game);
    ach.lengths ??= [];
    if (length >= 3 && length <= 13 && !ach.lengths.includes(length)) ach.lengths.push(length);
    if (Array.from({ length: 11 }, (_, i) => i + 3).every(n => ach.lengths.includes(n))) grant('letters.everyLength', game);
  }
  if (won && mode === 'connect') {
    bump('connect.boards', 1, game);
    if (game.diff === 'hard') grant('connect.hardBoard', game);
  }
  saveStats();
}
export function recordConnectBonus(game) {
  bump('connect.bonus', 1, game);
}
