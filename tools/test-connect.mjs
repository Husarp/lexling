// Tests for Connect rules against the real word data, and for the Hint button and its saved results.
// Run: node tools/test-connect.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('../app/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords } = await import('../app/js/engine.js');
const { makePuzzle, RANGE, cellsOf, visible, isDone, nextHint, hintCap, judge, solved, doneWords } = await import('../app/js/connect.js');
const { pool } = await import('../app/js/letters.js');
const { offensive } = await import('../app/js/offensive.js');

let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
// the same games every run
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Everything a board must be: every letter of every word on the grid where it says; crossings agree;
// every run of two or more letters, across or down, is one of the board's words (nothing accidental);
// all words joined into one piece; each word made from the circle's letters; one uses them all.
function sound(p) {
  const { board, ring } = p, cells = new Map();
  for (const x of board.words) cellsOf(x).forEach((k, i) => {
    const ch = [...x.w][i];
    if (cells.has(k) && cells.get(k) !== ch) throw new Error(`clash at ${k} in ${x.w}`);
    cells.set(k, ch);
    const [r, c] = k.split('-').map(Number);
    if (r < 1 || c < 1 || r > board.rows || c > board.cols) throw new Error(`${x.w} leaves the board`);
  });
  const runs = [];
  for (const d of ['a', 'd']) {
    for (let line = 1; line <= (d === 'a' ? board.rows : board.cols); line++) {
      let run = '', start = 0;
      const end = (d === 'a' ? board.cols : board.rows) + 1;
      for (let i = 1; i <= end; i++) {
        const ch = i < end ? cells.get(d === 'a' ? `${line}-${i}` : `${i}-${line}`) : undefined;
        if (ch) { if (!run) start = i; run += ch; }
        else { if ([...run].length > 1) runs.push({ w: run, r: d === 'a' ? line : start, c: d === 'a' ? start : line, d }); run = ''; }
      }
    }
  }
  const key = x => `${x.w}@${x.r},${x.c},${x.d}`;
  const onBoard = new Set(board.words.map(key));
  for (const run of runs) if (!onBoard.has(key(run))) throw new Error(`accidental word ${run.w}`);
  if (runs.length !== board.words.length) throw new Error('a board word is not a run of its own');
  // one piece: words meet at shared cells
  const seen = new Set([0]), stack = [0];
  while (stack.length) {
    const a = stack.pop(), ca = new Set(cellsOf(board.words[a]));
    board.words.forEach((x, b) => { if (!seen.has(b) && cellsOf(x).some(k => ca.has(k))) { seen.add(b); stack.push(b); } });
  }
  if (seen.size !== board.words.length) throw new Error('the board is in pieces');
  const have = [...ring].sort().join('');
  for (const x of board.words) {
    const left = [...ring];
    for (const ch of x.w) { const i = left.indexOf(ch); if (i < 0) throw new Error(`${x.w} is not made from ${ring}`); left.splice(i, 1); }
  }
  if (!board.words.some(x => [...x.w].sort().join('') === have)) throw new Error('no word uses every letter');
  return true;
}

const MARKS = /[ąćęłńóśźż]/;
for (const lang of ['pl', 'en']) {
  const m = await loadWords(lang);
  const common = new Set();
  for (let len = 3; len <= 10; len++) for (const i of pool(m, { len, diff: 'random' })) common.add(m.words[i]);
  // every board-worthy word by its letters, sorted: the words that use a whole circle
  const sorted = w => [...w].sort().join(''), byLetters = new Map();
  for (const w of common) byLetters.set(sorted(w), [...(byLetters.get(sorted(w)) || []), w]);
  for (const letters of [4, 5, 6, 7, 8, 9, 10]) for (const diff of ['relaxed', 'easy', 'normal', 'hard']) for (const marks of lang === 'pl' ? [false, true] : [true]) {
    const rand = seeded(letters * 100 + diff.length * 7 + (marks ? 1 : 0));
    const t0 = performance.now();
    let made = 0, words = 0, widest = 0, tallest = 0;
    for (let g = 0; g < 25; g++) {
      const p = makePuzzle(m, { letters, diff, marks, rand });
      if (!p) continue;
      made++;
      sound(p);
      const n = p.board.words.length;
      if (n < RANGE[letters][0] || n > RANGE[letters][1]) throw new Error(`${n} words for ${letters} letters`);
      if (!p.board.words.every(x => common.has(x.w))) throw new Error('a board word that is not a common base word');
      if (!marks && MARKS.test(p.ring)) throw new Error('Polish letters in the circle with the switch off');
      if ([...p.ring].length !== letters) throw new Error('circle size');
      if (p.board.words.some(x => offensive(m, x.w))) throw new Error('an offensive word on the board');
      // a base word that uses every letter is always on the board, however rare (owner, 2026-09-25)
      const onBoard = new Set(p.board.words.map(x => x.w));
      for (const w of byLetters.get(sorted(p.ring)) || []) if (!onBoard.has(w)) throw new Error(`${w} uses every letter of ${p.ring} but is not on the board`);
      words += n; widest = Math.max(widest, p.board.cols); tallest = Math.max(tallest, p.board.rows);
    }
    const ms = (performance.now() - t0) / 25;
    const label = `${lang} ${letters} letters ${diff}${lang === 'pl' ? (marks ? ' ą-ż' : ' plain') : ''}`;
    check(`${label}: every game gets a puzzle`, made, 25);
    const most = letters <= 7 ? [10, 8] : letters === 8 ? [11, 9] : [12, 10];
    check(`${label}: boards no bigger than ${most[0]} across, ${most[1]} down`, widest <= most[0] && tallest <= most[1], true);
    check(`${label}: quick (${ms.toFixed(0)} ms a puzzle)`, ms < 250, true);
    console.log(`  ${label.padEnd(30)} ${(words / made).toFixed(1)} words avg, largest ${widest} × ${tallest}, ${ms.toFixed(1)} ms`);
  }
}

// ── hints, "done", judging - on a fixed board: KARTON across, KORA and TRON down from it ──
// row 1: K A R T O N ; KORA down from the K (col 1), TRON down from the T (col 4)
const board = { cols: 6, rows: 4, words: [{ w: 'karton', r: 1, c: 1, d: 'a' }, { w: 'kora', r: 1, c: 1, d: 'd' }, { w: 'tron', r: 1, c: 4, d: 'd' }] };
check('cells of a word across', cellsOf(board.words[0]), ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6']);
check('cells of a word down', cellsOf(board.words[1]), ['1-1', '2-1', '3-1', '4-1']);
// hints (owner, 2026-09-25): a random letter not showing yet, anywhere - or in the chosen word; none once half of
// a word's letters (rounded down) show - letters from found crossing words count too (owner, later that day)
check('the cap: half a word, rounded up (owner, 2026-09-25)', [hintCap('kora'), hintCap('karton'), hintCap('kot'), hintCap('krowa')], [2, 3, 2, 3]);
const first = nextHint(board, [], [], null, () => 0);
check('a hint is a letter not showing yet', first.cell !== null && !visible(board, [], []).has(first.cell), true);
const spots = new Set(Array.from({ length: 60 }, (_, i) => nextHint(board, [], [], null, () => i / 60).cell));
check('hints land all over the board, not word by word', spots.size >= 8, true);
check('a chosen word gets the hint', cellsOf(board.words[2]).includes(nextHint(board, ['karton'], [], 'tron', () => .5).cell), true);
check('...and never a letter already showing', nextHint(board, ['karton'], [], 'tron', () => 0).cell, '2-4');
// KORA (4 letters, cap 2) with 2 hinted letters (and its K from KARTON): none of its cells may be hinted again
check('a word at its cap takes no more hints', nextHint(board, ['karton'], ['2-1', '3-1'], 'kora').cell, null);
// the crossing cell 1-1 (K of KARTON and KORA) counts for both: with KORA at its cap, 1-1 is off limits too
check('a crossing letter counts for both words', Array.from({ length: 40 }, (_, i) => nextHint(board, [], ['2-1', '3-1'], null, () => i / 40).cell).includes('1-1'), false);
// KARTON 3 of 6 hinted (A R O), KORA 2 of 4 (O R), TRON 2 of 4 (R O): every word at its cap
check('no hint left: says so', nextHint(board, [], ['1-2', '1-3', '1-5', '2-1', '3-1', '2-4', '3-4']).cell, null);
// KARTON found: KORA shows its K (1 of 4) and TRON its T (1 of 4) - one hint more each, then no more
{
  const shown = [];
  for (let h = nextHint(board, ['karton'], shown); h && h.cell; h = nextHint(board, ['karton'], shown)) shown.push(h.cell);
  check('letters from a found crossing word count: one hint each for KORA and TRON, then none', [shown.length, shown.filter(k => cellsOf(board.words[1]).includes(k)).length], [2, 1]);
}
// half of KORA showing through crossings alone: no hint at all for it
check('a word already half showing through crossings gets no hint', nextHint({ ...board, words: [...board.words, { w: 'rok', r: 3, c: 1, d: 'a' }] }, ['karton', 'rok'], [], 'kora'), { cell: null, words: [] });
// on real puzzles: pressing Hint until it has nothing left never puts a word over its cap, and ends
for (const lang of ['pl', 'en']) {
  const m = await loadWords(lang), rand = seeded(7);
  let fine = true, presses = 0;
  for (let g = 0; g < 40; g++) {
    const p = makePuzzle(m, { letters: 4 + (g % 4), diff: 'normal', rand });
    const shown = [];
    for (let h = nextHint(p.board, [], shown, null, rand); h && h.cell; h = nextHint(p.board, [], shown, null, rand)) { shown.push(h.cell); presses++; }
    for (const x of p.board.words) if (cellsOf(x).filter(k => shown.includes(k)).length > hintCap(x.w)) fine = false;
  }
  check(`${lang}: 40 boards hinted to the end - no word ever over half (${presses} hints)`, fine, true);
}
const vis = visible(board, ['karton'], ['2-4', '3-4', '4-4']);
check('a word whose letters all show is done (hints and a crossing word)', isDone(board.words[2], ['karton'], vis), true);
check('...and counts toward the board', doneWords(board, ['karton'], ['2-4', '3-4', '4-4']).length, 2);
check('not solved while a word is left', solved(board, ['karton'], ['2-4', '3-4', '4-4']), false);
check('solved when every word is done', solved(board, ['karton', 'kora'], ['2-4', '3-4', '4-4']), true);
check('no hint once everything is done', nextHint(board, ['karton', 'kora', 'tron'], []), null);

const pl = await loadWords('pl');
const state = { found: ['karton'], shown: [], bonus: ['kot'] };
check('judge: under 3 letters', judge(pl, board, state, 'ok'), 'short');
check('judge: a board word, new', judge(pl, board, state, 'kora'), 'found');
check('judge: a board word already found', judge(pl, board, state, 'karton'), 'again');
check('judge: another real word is a bonus', judge(pl, board, state, 'krata'), 'bonus');
check('judge: a Polish form is a bonus too', judge(pl, board, state, 'kotka'), 'bonus');
check('judge: a bonus word twice', judge(pl, board, state, 'kot'), 'bonusAgain');
check('judge: not a word', judge(pl, board, state, 'ntrak'), 'none');

// slurs and vulgar words: never on the board, never a bonus (owner, 2026-09-25) - their forms and compounds too
check('offensive: a vulgar word is not a bonus', judge(pl, board, state, 'kurwa'), 'none');
check('offensive: nor its forms', judge(pl, board, state, 'kurwy'), 'none');
check('offensive: nor a word built on its root', judge(pl, board, state, 'wkurwiony'), 'none');
check('offensive: the word a Hard board once used', judge(pl, board, state, 'mineta'), 'none');
const en = await loadWords('en');
check('offensive: an English slur is not a bonus', judge(en, board, state, 'faggot'), 'none');
check('offensive: nor its plural', judge(en, board, state, 'bitches'), 'none');
check('offensive: an innocent word that starts the same still counts', judge(en, board, state, 'niggle'), 'bonus');
check('offensive: an everyday word from the data stoplist still counts', judge(en, board, state, 'then'), 'bonus');

// A small DOM fixture keeps the real screen's header and main in separate subtrees.
class Element extends EventTarget {
  constructor(tag = 'div', attrs = {}) {
    super();
    this.tag = tag;
    this.attrs = attrs;
    this.className = attrs.class ?? '';
    this.dataset = { cell: attrs['data-cell'], i: attrs['data-i'] };
    this.children = [];
    this.style = { setProperty() {} };
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: name => { if (!this.classList.contains(name)) this.className += ' ' + name; },
      remove: name => { this.className = this.className.split(/\s+/).filter(c => c !== name).join(' '); },
      toggle: (name, on) => on ? this.classList.add(name) : this.classList.remove(name),
    };
  }
  get isConnected() { return this.parent?.isConnected ?? this.tag === 'root'; }
  get firstElementChild() { return this.children[0]; }
  get innerHTML() { return this.html; }
  set innerHTML(html) {
    this.html = html;
    for (const child of [...this.children]) child.remove();
    const stack = [this];
    for (const [, close, tag, attrs] of html.matchAll(/<(\/?)([\w-]+)\b([^>]*)>/g)) {
      if (close) { stack.pop(); continue; }
      const el = new Element(tag, Object.fromEntries([...attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m => [m[1], m[2] ?? ''])));
      stack.at(-1).append(el);
      if (!attrs.endsWith('/') && !['br', 'img'].includes(tag)) stack.push(el);
    }
  }
  append(el) { el.parent = this; this.children.push(el); }
  remove() { this.parent.children = this.parent.children.filter(el => el !== this); this.parent = null; }
  contains(el) { return el === this || this.children.some(child => child.contains(el)); }
  matches(s) {
    if (s.startsWith('.')) return s.slice(1).split('.').every(c => this.classList.contains(c));
    if (s.startsWith('#')) return this.attrs.id === s.slice(1);
    if (s.startsWith('[')) return Object.hasOwn(this.attrs, s.slice(1, -1));
    return this.tag === s;
  }
  querySelectorAll(selector) {
    const matches = el => selector.split(',').some(s => {
      const parts = s.trim().split(/\s+/);
      if (!el.matches(parts.pop())) return false;
      let parent = el.parent;
      while (parts.length) {
        const part = parts.pop();
        while (parent && !parent.matches(part)) parent = parent.parent;
        if (!parent) return false;
        parent = parent.parent;
      }
      return true;
    });
    return this.children.flatMap(el => [...(matches(el) ? [el] : []), ...el.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getBoundingClientRect() { return { left: 0, right: 200, top: 0, width: 200, height: 100 }; }
  click() { this.dispatchEvent(new Event('click')); }
  scrollTo({ top }) { this.scrollTop = top; }
}

const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en' } });
globalThis.document = Object.assign(new EventTarget(), {
  documentElement: {},
  createRange: () => ({ selectNodeContents() {}, getBoundingClientRect: () => ({ left: 0, right: 100 }) }),
});
globalThis.window = new EventTarget();
globalThis.getComputedStyle = () => ({ paddingLeft: '0', paddingRight: '0', borderLeftWidth: '0', borderRightWidth: '0' });
globalThis.matchMedia = () => ({ matches: true, addEventListener() {} });
globalThis.location = {};
globalThis.innerWidth = 800;
const { newGame, settings, totals } = await import('../app/js/store.js');
const { setLang, plural } = await import('../app/js/i18n.js');
const { connectGameScreen } = await import('../app/js/connect-game.js');
settings.sound = false;

const tapKey = key => document.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key }));
const storedGame = id => JSON.parse(storage.get('wg.saves')).find(g => g.id === id);
const storedRecord = id => JSON.parse(storage.get('wg.stats')).rec[id];
for (const [lang, grid, ring, bonuses] of [
  ['en', { cols: 5, rows: 1, words: [{ w: 'stare', r: 1, c: 1, d: 'a' }] }, 'stare', ['star', 'tear', 'rate', 'seat']],
  ['pl', board, 'karton', ['kot', 'rok', 'rak', 'ton']],
]) {
  setLang(lang);
  for (const earlierMove of [false, true]) {
    const label = `${lang} ${earlierMove ? 'after four bonus words' : 'blank board'}`;
    const game = newGame({ mode: 'connect', lang, board: grid, ring, found: [], shown: [], bonus: [], hints: 0 });
    location.hash = '#/game/' + game.id;
    const root = new Element('root');
    const cleanup = await connectGameScreen(root, game.id);
    try {
      if (earlierMove) for (const word of bonuses) [...word, 'Enter'].forEach(tapKey);
      const before = storedGame(game.id), record = storedRecord(game.id);
      const bonusCount = earlierMove ? bonuses.length : 0;
      check(label + ': bonus words saved', before.bonus, earlierMove ? bonuses : []);
      check(label + ': unassisted bonus total', totals('connect', lang).bonus, bonusCount);

      const hint = root.querySelector('.hint-btn'), crossword = root.querySelector('.cw');
      const parent = crossword.parent;
      crossword.remove();
      hint.click();
      check(label + ': missing board leaves save and stats intact', [storedGame(game.id), storedRecord(game.id)], [before, record]);
      parent.append(crossword);

      hint.click();
      const saved = storedGame(game.id);
      check(label + ': hint saved with practice', [saved.hints, saved.shown.length, saved.practice], [1, 1, true]);
      const shown = crossword.querySelectorAll('[data-cell]').filter(cell => cell.textContent);
      const word = grid.words.find(w => cellsOf(w).includes(saved.shown[0]));
      check(label + ': exactly one correct letter visible', shown.map(cell => [cell.dataset.cell, cell.textContent]),
        [[saved.shown[0], [...word.w][cellsOf(word).indexOf(saved.shown[0])]]]);
      check(label + ': practice badge and warning updated', [!!root.querySelector('.topbar .practice-badge'), root.querySelector('.practice-hint')], [true, null]);
      check(label + ': stats flag earlier moves only', storedRecord(game.id), earlierMove ? { ...record, pr: 1 } : undefined);
      const giveUp = root.querySelector('#give-up');
      giveUp.click();
      giveUp.click();
      await new Promise(resolve => setTimeout(resolve, 0));
      const result = root.querySelector('main').innerHTML;
      check(label + ': result counts bonus words and hints', [
        result.includes(`<b>${bonusCount}</b> ${plural(bonusCount, 'cn.bonusLow')}`),
        result.includes(`<b>1</b> ${plural(1, 'cn.hintsLow')}`),
      ], [true, true]);
      check(label + ': practice bonus words excluded from Statistics', [totals('connect', lang).bonus, totals('connect', lang).bonusPerGame], [0, null]);
    } finally {
      cleanup();
    }
  }
}

console.log(`all ${passed} Connect tests passed`);
