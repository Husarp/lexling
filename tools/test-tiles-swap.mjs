// Exercise the screen's actual drag/drop handlers without a browser.
// Run: node tools/test-tiles-swap.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../app/js/tiles-game.js', import.meta.url), 'utf8');
const fn = name => {
  const match = source.match(new RegExp(`  function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n  \\}`));
  assert.ok(match, `${name} exists`);
  return match[0];
};
const tile = (slot, ch, r, c, extra = {}) => ({ slot, ch, r, c, blank: false, ...extra });
const copy = value => JSON.parse(JSON.stringify(value));
let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(copy(actual), copy(expected), name); passed++; };
function screen(draft = []) {
  const c = {
    draft: copy(draft), S: { cells: Array(225).fill(null) }, n: 15,
    active: true, mode: 'play', shown: 0, tiles: ['t', 'a', 'r', '?'], BLANK: '?',
    sel: -1, msg: null, cursor: null, desk: true, rackGap: -1, dropAt: -1,
    zoom: { z: 1 }, press: null, dragEl: { style: { setProperty() {} }, remove() {} },
    play: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    touches: new Map(), pinch: null, follows: 0, paints: 0, saved: 0, game: {},
    follow: () => c.follows++, paintTurn: () => c.paints++, paintBoard() {}, paintRack() {}, click() {},
    myTurn: () => c.active, rackOf: () => c.tiles,
    setOrder: (_, tiles) => { c.tiles = tiles; }, putSave: () => c.saved++,
    openPicker: i => { c.picker = i; }, peek: i => { c.peeked = i; },
    inDraft: slot => c.draft.some(d => d.slot === slot),
    squareAt: (x, y) => x >= 0 && x < 15 && y >= 0 && y < 15 ? { r: y, c: x } : null,
    overRack: (_, y) => y === 20, gapAt: () => 1,
    free: (r, col, skip = -1) => r >= 0 && col >= 0 && r < 15 && col < 15 && !c.S.cells[r * 15 + col]
      && !c.draft.some((d, i) => i !== skip && d.r === r && d.c === col),
  };
  const release = source.slice(source.indexOf('  const release = (e, cancelled) => {'), source.indexOf("  play.addEventListener('pointerup'"));
  runInNewContext(['placeAt', 'reorder', 'moveDrag', 'tap', 'unplace', 'swapTarget', 'drop'].map(fn).join('\n') + release + '\nthis.release = release;', c);
  c.hover = (p, x, y) => { c.press = p; c.moveDrag(x, y); };
  return c;
}

// TAR -> RAT, including both directions of travel and an untouched middle tile.
for (const [from, to] of [[0, 2], [2, 0]]) {
  const original = [...'tar'].map((ch, slot) => tile(slot, ch, 7, 7 + slot));
  const c = screen(original), p = { kind: 'tile', di: from };
  c.hover(p, 7 + to, 7);
  check('draft swap is highlighted', c.dropAt, 7 * 15 + 7 + to);
  c.drop(p, 7 + to, 7);
  check('draft swap changes both squares and keeps tile identities', c.draft,
    original.map((d, i) => ({ ...d, c: i === from ? 7 + to : i === to ? 7 + from : d.c })));
  check('swap follows the move', c.follows, 1);
  check('board swap preserves rack order', c.tiles, ['t', 'a', 'r', '?']);
}
{
  const a = tile(3, 'z', 5, 6, { blank: true }), b = tile(1, 'a', 7, 8);
  const c = screen([a, b]);
  c.drop({ kind: 'tile', di: 0 }, 8, 7);
  check('dragged blank keeps its chosen letter', c.draft, [{ ...a, r: 7, c: 8 }, { ...b, r: 5, c: 6 }]);
  c.drop({ kind: 'tile', di: 1 }, 8, 7);
  check('target blank keeps its chosen letter', c.draft, [a, b]);
}
for (const replacedBlank of [false, true]) {
  const a = tile(replacedBlank ? 3 : 0, replacedBlank ? 'z' : 't', 7, 7, { blank: replacedBlank });
  const other = tile(2, 'r', 7, 8), c = screen([a, other]), p = { kind: 'rack', slot: 1 };
  c.hover(p, 7, 7);
  check('rack replacement is highlighted', c.dropAt, 112);
  c.drop(p, 7, 7);
  check('rack replacement keeps other draft tiles', c.draft, [other, tile(1, 'a', 7, 7)]);
  check('replaced tile returns to rack by releasing its slot', c.inDraft(a.slot), false);
  check('rack replacement leaves rack order intact', c.tiles, ['t', 'a', 'r', '?']);
}
{
  const c = screen([tile(0, 't', 7, 7), tile(1, 'a', 7, 8)]);
  c.drop({ kind: 'rack', slot: 3 }, 7, 7);
  check('new rack blank opens its letter picker at the right draft index', c.picker, 1);
  check('new rack blank waits for a chosen letter', c.draft[1], tile(3, '', 7, 7, { blank: true }));
}
for (const kind of ['rack', 'tile']) {
  for (const blocked of ['settled', 'hint', 'other turn', 'exchange']) {
    const a = tile(0, 't', 7, 7), b = tile(1, 'a', 7, 8, blocked === 'hint' ? { hint: 'small' } : {});
    const c = screen([a, b]), p = kind === 'rack' ? { kind, slot: 2 } : { kind, di: 0 };
    if (blocked === 'settled') c.S.cells[113] = { ch: 'x', by: 1 };
    if (blocked === 'other turn') c.active = false;
    if (blocked === 'exchange') c.mode = 'exchange';
    const before = copy(c.draft), cells = copy(c.S.cells);
    c.hover(p, 8, 7);
    check(`${kind}/${blocked}: no swap highlight`, c.dropAt, -1);
    c.drop(p, 8, 7);
    check(`${kind}/${blocked}: draft stays put`, c.draft, before);
    check(`${kind}/${blocked}: played tiles stay put`, c.S.cells, cells);
  }
}
{
  const c = screen([tile(0, 't', 7, 7, { hint: 'big' }), tile(1, 'a', 7, 8)]);
  const before = copy(c.draft), p = { kind: 'tile', di: 0 };
  c.hover(p, 8, 7); c.drop(p, 8, 7);
  check('hint source cannot swap', c.draft, before);
  check('hint source cannot highlight a swap', c.dropAt, -1);
}
// Drive the actual release dispatcher: taps must take the tap path, never drop().
{
  const a = tile(0, 't', 7, 7), b = tile(1, 'a', 7, 8), c = screen([a, b]);
  c.press = { id: 1, kind: 'rack', slot: 2, drag: false };
  c.release({ pointerId: 1, clientX: 8, clientY: 7 }, false);
  check('rack tap over a draft never replaces it', c.draft, [a, b]);
  check('rack tap selects its tile', c.sel, 2);
  c.press = { id: 1, kind: 'tile', di: 0, drag: false };
  c.release({ pointerId: 1, clientX: 8, clientY: 7 }, false);
  check('board tap returns its tile without swapping', c.draft, [b]);
}
{
  const a = tile(0, 't', 7, 7), b = tile(1, 'a', 7, 8), c = screen([a, b]);
  c.press = { id: 1, kind: 'tile', di: 0, drag: true };
  c.release({ pointerId: 1, clientX: 8, clientY: 7 }, true);
  check('cancelled drag never swaps', c.draft, [a, b]);
}
{
  const c = screen([tile(1, 'a', 7, 7)]), p = { kind: 'rack', slot: 2 };
  c.hover(p, 0, 20);
  check('rack insertion gap is unchanged', c.rackGap, 1);
  c.drop(p, 0, 20);
  check('rack reordering still uses insertion, preserving draft slot mapping', [c.tiles, c.draft[0].slot, c.saved], [['t', 'r', '?', 'a'], 3, 1]);
}
{
  const c = screen([tile(0, 't', 7, 7)]), p = { kind: 'tile', di: 0 };
  c.hover(p, 8, 7);
  check('free square still highlights', c.dropAt, 113);
  c.drop(p, 8, 7);
  check('free square still accepts a draft tile', c.draft, [tile(0, 't', 7, 8)]);
  c.drop(p, 0, 20);
  check('drag to rack still recalls a draft tile', c.draft, []);
}
// The occupied face needs its own highlight: the square beneath it is obscured.
{
  const c = { S: { board: 'test', lang: 'en', cells: Array(225).fill(null) },
    draft: [tile(0, 't', 7, 7)], sizeOf: () => 15, premiums: () => Array(225).fill(''), centre: () => 112,
    settings: {}, LABEL: {}, esc: s => s, valueOf: () => 1 };
  const board = source.slice(source.indexOf('export function boardInner'), source.indexOf('\n}', source.indexOf('export function boardInner')) + 2).replace('export ', '');
  runInNewContext(board, c);
  const html = c.boardInner(c.S, { draft: c.draft, drop: 112, bad: true });
  check('occupied target face renders drop highlight even on an invalid move', /class="t new bad drop"/.test(html), true);
}
console.log(`all ${passed} tiles swap tests passed`);
