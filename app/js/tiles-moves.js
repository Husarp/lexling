// Kafelki / Tiles - finding moves: every legal move for a rack, and which one the computer plays
// (PLAN.md M13). The rules themselves are tiles.js; the word list is a word graph (dawg.js).
//
// The method is the classic one for this kind of game (Appel & Jacobson, "The World's Fastest Scrabble
// Program", 1988). Words are found along rows only - columns are the rows of the board turned on its side.
// A move must touch a tile already down, so it is built outward from an "anchor", an empty square next to
// one: first the part left of the anchor, then on to the right, walking the word graph letter by letter, so
// a branch no word begins with is never followed. A square with tiles above or below it only takes the
// letters that still make a word downwards there - worked out once per square before the search.
import { step, has } from './dawg.js';
import { sizeOf, centre, premiums, letterSet, wordsMade, valueOf, unseen, canExchange, apply, replay, RACK, BINGO, BLANK, LETTER_X, WORD_X } from './tiles.js';

// Every legal move for `rack` (default: the player whose turn it is) on the board of `state`, each
// { placed: [{ r, c, ch, blank }], word, score }. `word` = the word along the move's line; the full list
// of words it makes, and their scores, is wordsMade(state, placed).
export function findMoves(state, dict, rack = state.racks[state.turn]) {
  const n = sizeOf(state.board), prem = premiums(state.board), { values } = letterSet(state.lang);
  // the game's rules: bonus squares every time, not only under new tiles; the seven-tile bonus
  const always = state.rules?.premiums === 'always', bingo = state.rules?.bingo ?? BINGO;
  const val = dict.letters.map(ch => values[ch] ?? 0);
  const count = new Int8Array(dict.letters.length);
  let blanks = 0;
  for (const t of rack) {
    if (t === BLANK) blanks++;
    else if (dict.index.has(t)) count[dict.index.get(t)]++;
  }
  const cells = new Int16Array(n * n).fill(-1), blank = new Uint8Array(n * n);
  state.cells.forEach((x, i) => { if (x) { cells[i] = dict.index.get(x.ch); blank[i] = x.blank ? 1 : 0; } });
  const start = state.cells.every(x => !x) ? centre(state.board) : -1;

  const out = [];
  // across as it is, then down as across on the board turned over its diagonal (the same squares, r and c swapped)
  const turn = a => { const b = new a.constructor(n * n); for (let i = 0; i < n * n; i++) b[(i % n) * n + Math.floor(i / n)] = a[i]; return b; };
  const flip = [...prem].map((_, i) => prem[(i % n) * n + Math.floor(i / n)]).join('');
  rows(false, cells, blank, prem);
  rows(true, turn(cells), turn(blank), flip);
  return out;

  function rows(down, cells, blank, prem) {
    // Down each square: which letters can go there (a bit per letter) and the points of the tiles above and
    // below it, or -1 where there are none (then nothing is formed downwards and any letter will do).
    const allowed = new Int32Array(n * n).fill(-1), cross = new Int32Array(n * n).fill(-1), crossX = new Int32Array(n * n).fill(1);
    const anchor = new Uint8Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (cells[i] >= 0) continue;
      const up = r > 0 && cells[i - n] >= 0, below = r < n - 1 && cells[i + n] >= 0;
      anchor[i] = start >= 0 ? +(i === start)            // the centre is the same square both ways round
        : +(up || below || (c > 0 && cells[i - 1] >= 0) || (c < n - 1 && cells[i + 1] >= 0));
      if (!up && !below) continue;
      let top = r, pts = 0;
      while (top > 0 && cells[(top - 1) * n + c] >= 0) top--;
      let node = 0;
      const tile = k => { const v = blank[k] ? 0 : val[cells[k]]; if (!always) return v; crossX[i] *= WORD_X[prem[k]] || 1; return v * (LETTER_X[prem[k]] || 1); };
      for (let k = top; k < r && node >= 0; k++) { node = step(dict, node, cells[k * n + c]); pts += tile(k * n + c); }
      let bits = 0;
      if (node >= 0) {
        for (let e = dict.first[node]; e < dict.first[node + 1]; e++) {
          let m = dict.target[e];
          for (let k = r + 1; k < n && cells[k * n + c] >= 0 && m >= 0; k++) m = step(dict, m, cells[k * n + c]);
          if (m >= 0 && dict.final[m]) bits |= 1 << dict.letter[e];
        }
      }
      for (let k = r + 1; k < n && cells[k * n + c] >= 0; k++) pts += tile(k * n + c);
      allowed[i] = bits;
      cross[i] = pts;
    }

    // what is on the squares of the move being built: letter index and blank flag, -1 = not a new tile
    const newK = new Int16Array(n).fill(-1), newB = new Uint8Array(n);
    let r = 0, a = 0, placedCount = 0;
    const tiles = () => { let t = blanks; for (const k of count) t += k; return t; };

    for (r = 0; r < n; r++) {
      for (a = 0; a < n; a++) {
        if (!anchor[r * n + a]) continue;
        if (a > 0 && cells[r * n + a - 1] >= 0) {
          // tiles already on the left: the word starts with them
          let s = a;
          while (s > 0 && cells[r * n + s - 1] >= 0) s--;
          let node = 0;
          for (let k = s; k < a && node >= 0; k++) node = step(dict, node, cells[r * n + k]);
          if (node >= 0) right(node, a, s);
        } else {
          // empty on the left: up to as many rack tiles there as there are free squares that are not anchors
          let limit = 0;
          for (let k = a - 1; k >= 0 && cells[r * n + k] < 0 && !anchor[r * n + k] && limit < tiles() - 1; k--) limit++;
          left(0, limit, []);
        }
      }
    }

    function left(node, limit, part) {
      for (let i = 0; i < part.length; i++) { newK[a - part.length + i] = part[i][0]; newB[a - part.length + i] = part[i][1]; }
      right(node, a, a - part.length);
      if (limit === 0) return;
      for (let e = dict.first[node]; e < dict.first[node + 1]; e++) {
        const k = dict.letter[e], child = dict.target[e];
        if (count[k]) { count[k]--; placedCount++; left(child, limit - 1, [...part, [k, 0]]); placedCount--; count[k]++; }
        if (blanks) { blanks--; placedCount++; left(child, limit - 1, [...part, [k, 1]]); placedCount--; blanks++; }
      }
    }

    function right(node, c, s) {
      if (c < n && cells[r * n + c] >= 0) {
        const child = step(dict, node, cells[r * n + c]);
        if (child >= 0) right(child, c + 1, s);
        return;
      }
      if (c > a && c - s > 1 && dict.final[node]) record(s, c);
      if (c >= n) return;
      const i = r * n + c, ok = allowed[i];
      for (let e = dict.first[node]; e < dict.first[node + 1]; e++) {
        const k = dict.letter[e];
        if (!(ok & (1 << k))) continue;
        const child = dict.target[e];
        newK[c] = k;
        if (count[k]) { count[k]--; placedCount++; newB[c] = 0; right(child, c + 1, s); placedCount--; count[k]++; }
        if (blanks) { blanks--; placedCount++; newB[c] = 1; right(child, c + 1, s); placedCount--; blanks++; }
      }
      newK[c] = -1;
    }

    // a word from square s to e - 1 of row r: score it the way wordsMade does, and keep it
    function record(s, e) {
      // A single new tile makes a word both ways, so both passes would find it: the down pass leaves it to
      // the across pass whenever the tile has a neighbour across (which the across pass then built on).
      if (down && placedCount === 1) {
        for (let c = s; c < e; c++) if (cells[r * n + c] < 0 && cross[r * n + c] >= 0) return;
      }
      let sum = 0, mul = 1, extra = 0, word = '';
      const placed = [];
      for (let c = s; c < e; c++) {
        const i = r * n + c;
        if (cells[i] >= 0) {
          const v = blank[i] ? 0 : val[cells[i]];
          if (always) { sum += v * (LETTER_X[prem[i]] || 1); mul *= WORD_X[prem[i]] || 1; } else sum += v;
          word += dict.letters[cells[i]];
          continue;
        }
        const k = newK[c], b = newB[c], v = b ? 0 : val[k], lx = LETTER_X[prem[i]] || 1, wx = WORD_X[prem[i]] || 1;
        sum += v * lx;
        mul *= wx;
        if (cross[i] >= 0) extra += (cross[i] + v * lx) * wx * crossX[i];
        word += dict.letters[k];
        placed.push(down ? { r: c, c: r, ch: dict.letters[k], blank: !!b } : { r, c, ch: dict.letters[k], blank: !!b });
      }
      out.push({ placed, word, score: sum * mul + extra + (placed.length === RACK ? bingo : 0) });
    }
  }
}

// A hint (owner, 2026-09-25: yes): the best move for the rack of the player whose turn it is - the screen lays
// it on the board as a preview, to play or take back - or null when there is none. Count it: hinted() in tiles.js.
export function hint(state, dict) {
  const moves = findMoves(state, dict);
  return moves.length ? moves.reduce((a, b) => b.score > a.score ? b : a) : null;
}

// Hints in three levels (owner, 2026-09-25), each a move { placed, word, score } or null:
// small - an easy move: everyday words only (the ones the Easy computer knows), four tiles at most, worth about half the
//   best there is (owner, 2026-09-26: "how is a seven-tile 84 a small hint?", "small often gives super good words" - it
//   was the best common-word move, which could be the best move of all);
// big - the move that scores the most;
// master - the best move looking ahead, as Expert plays: what it leaves on the rack, what the next player could answer.
// `rankOf(word)` as for computerMove. Master takes the longest (~0.1-0.4 s on a PC).
export const SMALL_SHARE = 0.5, SMALL_TILES = 4;
export function hintLevels(state, dict, rankOf = () => 0, rand = Math.random) {
  const moves = findMoves(state, dict).sort((x, y) => y.score - x.score);
  if (!moves.length) return { small: null, big: null, master: null };
  const common = m => wordsMade(state, m.placed).words.every(x => rankOf(x.w) < LEVELS.easy.known);
  const rack = state.racks[state.turn];
  const valued = moves.map(m => ({ ...m, value: m.score + (state.bag.length ? leaveValue(state.lang, rest(rack, m.placed)) : 0) }))
    .sort((x, y) => y.value - x.value);
  const master = simulated(state, dict, valued.slice(0, 6), rand).sort((x, y) => y.value - x.value)[0].m;
  // the easy ones nearest half the best first; looking words up is the slow part, so only until one is common
  const aim = moves[0].score * SMALL_SHARE;
  const small = moves.filter(m => m.placed.length <= SMALL_TILES).sort((x, y) => Math.abs(x.score - aim) - Math.abs(y.score - aim)).find(common) ?? null;
  return { small, big: moves[0], master: { placed: master.placed, word: master.word, score: master.score } };
}
// the same move? (the same tiles on the same squares)
export const sameMove = (a, b) => !!a && !!b && JSON.stringify([...a.placed].sort((x, y) => x.r - y.r || x.c - y.c))
  === JSON.stringify([...b.placed].sort((x, y) => x.r - y.r || x.c - y.c));

// ── The computer ─────────────────────────────────────────────────────────────────────────────────
// A level is how many words the computer knows and how hard it tries. `known`: only words whose base word is
// among that many of the most common (the word list is most-common-first; the same measure as Connect's
// levels) - Hard and Expert know every word. `aim`: it plays the move scoring nearest to that share of the best
// it can see. Hard also weighs what it keeps on its rack (`leave`) and swaps a hopeless rack; Expert (the
// owner's plan) also tries its best few moves against what the next player could answer (`simulate`).
// First values, to be tuned by playing.
export const LEVELS = {
  relaxed: { known: 5000, aim: 0.5 },
  easy: { known: 8000, aim: 0.7 },
  normal: { known: 20000, aim: 0.85 },
  hard: { known: Infinity, aim: 1, leave: true },
  expert: { known: Infinity, aim: 1, leave: true, simulate: true },
};

// What the tiles kept on the rack are worth to the next turns, in points - a rule of thumb, as players think of
// it: a blank is gold; a balance of vowels and consonants keeps words coming; doubles, and the heavy letters (5+
// points), get stuck. English S is nearly a blank; Q without U is a burden.
const VOWELS = { pl: 'aąeęioóuy', en: 'aeiou' };
export function leaveValue(lang, tiles) {
  let v = 0, vowels = 0, letters = 0;
  const seen = {};
  for (const t of tiles) {
    if (t === BLANK) { v += 20; continue; }
    letters++;
    const pts = valueOf(lang, t);
    if (VOWELS[lang].includes(t)) vowels++;
    if (pts >= 5) v -= pts * 0.8;
    if (seen[t]) v -= 3 * seen[t];
    seen[t] = (seen[t] || 0) + 1;
    if (lang === 'en' && t === 's') v += 6;
    if (lang === 'en' && t === 'q' && !tiles.includes('u')) v -= 6;
  }
  return v - 2.5 * Math.abs(vowels - letters * 0.42);
}
const rest = (rack, placed) => { const r = [...rack]; for (const t of placed) r.splice(r.indexOf(t.blank ? BLANK : t.ch), 1); return r; };

// The best swap for a rack: which tiles to keep (the subset with the best leaveValue), and what that is worth.
function bestKeep(lang, rack) {
  let best = { keep: [], value: 0 };
  for (let mask = 0; mask < 1 << rack.length; mask++) {
    const keep = rack.filter((_, i) => mask & (1 << i));
    if (keep.length === rack.length) continue;
    const value = leaveValue(lang, keep);
    if (value > best.value) best = { keep, value };
  }
  return best;
}

// Expert: each candidate played out on a copy of the game, against racks the next player could hold - drawn at
// random from the tiles this player has not seen - and that player's best answer taken off.
function simulated(state, dict, moves, rand, samples = 10) {
  const isWord = w => has(dict, w), me = state.turn;
  const pool = Object.entries(unseen(state, me)).flatMap(([t, k]) => Array(k).fill(t));
  return moves.map(m => {
    let after;
    try { after = apply({ ...state, rules: { ...state.rules, check: 'auto' } }, { type: 'place', placed: m.placed }, isWord); } catch { return { m, value: -Infinity }; }
    if (after.over) return { m, value: m.value + 1000 };      // going out ends it: nothing to answer
    let answer = 0;
    for (let i = 0; i < samples; i++) {
      const bag = [...pool], rack = [];
      for (let k = 0; k < Math.min(RACK, bag.length); k++) rack.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
      answer += Math.max(0, ...findMoves(after, dict, rack).map(x => x.score));
    }
    return { m, value: m.value - answer / samples };
  });
}

// The computer's turn, as an action for apply() in tiles.js: { type: 'place', placed }, { type: 'exchange',
// tiles }, { type: 'pass' } - or { type: 'challenge' } when challenges are on and the move just made has a word
// that is not allowed (the computer knows the list; it never challenges a good word).
// `rankOf(word)` = the place of the word's base word in the frequency list, or Infinity when unknown.
// With nothing it knows to play, it swaps its whole rack while it may, and passes when it may not.
export function computerMove(state, dict, level = 'normal', rankOf = () => 0, rand = Math.random) {
  if (state.pending) {
    const move = state.moves[state.moves.length - 1];
    if (move.words.some(x => !has(dict, x.w))) return { type: 'challenge' };
  }
  const L = LEVELS[level] ?? LEVELS.normal, rack = state.racks[state.turn];
  const swapAll = () => canExchange(state, rack.length) ? { type: 'exchange', tiles: [...rack] } : { type: 'pass' };
  const moves = findMoves(state, dict).sort((x, y) => y.score - x.score);
  if (L.leave) {
    if (!moves.length) return swapAll();
    // what a move is worth: its points, and - while there is a bag to draw from - what it leaves on the rack
    const valued = moves.map(m => ({ ...m, value: m.score + (state.bag.length ? leaveValue(state.lang, rest(rack, m.placed)) : 0) }))
      .sort((x, y) => y.value - x.value);
    let best = valued[0];
    if (L.simulate) {
      const tried = simulated(state, dict, valued.slice(0, 6), rand).sort((x, y) => y.value - x.value);
      best = tried[0].m;
    }
    const keep = bestKeep(state.lang, rack);
    const out = rack.length - keep.keep.length;
    if (best.score < 10 && keep.value > best.value + 8 && canExchange(state, out)) {
      const tiles = [...rack];
      for (const t of keep.keep) tiles.splice(tiles.indexOf(t), 1);
      return { type: 'exchange', tiles };
    }
    return { type: 'place', placed: best.placed };
  }
  // looking words up is the slow part, so only as far as needed: the best move it knows, then outward from its aim
  const knows = m => L.known === Infinity || wordsMade(state, m.placed).words.every(x => rankOf(x.w) < L.known);
  const top = moves.find(knows);
  if (!top) return swapAll();
  const want = top.score * L.aim, gaps = new Map();
  for (const m of moves) { const g = Math.abs(m.score - want); gaps.set(g, [...gaps.get(g) ?? [], m]); }
  for (const g of [...gaps.keys()].sort((x, y) => x - y)) {
    const near = gaps.get(g).filter(knows);
    if (near.length) return { type: 'place', placed: near[Math.floor(rand() * near.length)].placed };
  }
}

// ── After the game: looking back (the owner's plan) ──────────────────────────────────────────────
// For each turn a person took: what they did and scored, next to the best move there was on that board with that
// rack - [{ i (the action's place in the log), p, kind, played, word (the one it made), best: { word, score, placed } | null }].
// `everyone`: the computers' turns too (the end of a game rates every player - owner, 2026-09-26).
export function lookBack(state, dict, everyone = false) {
  const states = replay(state, w => has(dict, w)), out = [];
  state.log.forEach((a, i) => {
    const before = states[i];
    if (!['place', 'exchange', 'pass', 'timeout'].includes(a.type) || (!everyone && before.players[before.turn].cpu)) return;
    const best = hint(before, dict);
    const made = a.type === 'place' ? wordsMade(before, a.placed) : null;
    out.push({ i, p: before.turn, kind: a.type, played: made ? made.score : 0, word: made?.words[0]?.w ?? '',
      best: best && { word: best.word, score: best.score, placed: best.placed } });
  });
  return out;
}
