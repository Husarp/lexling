// Exercise the screen's actual tap, drag/drop and rack handlers without a browser.
// Run: node tools/test-tiles-swap.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { t, setLang } from '../app/js/i18n.js';

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
    cues: [], playCue: cue => c.cues.push(cue),
    follow: () => c.follows++, paintTurn: () => c.paints++, paintBoard() {}, paintRack() {},
    myTurn: () => c.active, rackOf: () => c.tiles,
    setOrder: (_, tiles) => { c.tiles = tiles; }, putSave: () => c.saved++,
    openPicker: i => { c.picker = i; }, peek: i => { c.peeked = i; },
    lang: 'en', fresh: null, rackEl: { children: [] }, motion: { querySelectorAll: () => [] }, esc: s => s, valueOf: () => 1,
    t: (key, vars) => key === 'tiles.locate' ? `Highlight ${vars.tile} on the board` : 'Blank',
    picks: new Set(), tb: { querySelector: selector => ({ animate: (_, options) => { c.located = [selector, options.duration]; } }) },
    inDraft: slot => c.draft.some(d => d.slot === slot),
    squareAt: (x, y) => x >= 0 && x < 15 && y >= 0 && y < 15 ? { r: y, c: x } : null,
    overRack: (_, y) => y === 20,
    free: (r, col, skip = -1) => r >= 0 && col >= 0 && r < 15 && col < 15 && !c.S.cells[r * 15 + col]
      && !c.draft.some((d, i) => i !== skip && d.r === r && d.c === col),
  };
  const release = source.slice(source.indexOf('  const release = (e, cancelled) => {'), source.indexOf("  play.addEventListener('pointerup'"));
  runInNewContext(['placeAt', 'rackOrder', 'reorder', 'gapAt', 'moveDrag', 'tap', 'swapTarget', 'swapDraft', 'drop', 'paintRack', 'locateTile'].map(fn).join('\n') + release + '\nthis.release = release;', c);
  c.hover = (p, x, y) => { c.press = p; c.moveDrag(x, y); };
  c.tapTile = (di, heldMs = 100, cancelled = false) => {
    c.press = { id: 1, kind: 'tile', di, at: 10, drag: false };
    c.release({ pointerId: 1, timeStamp: 10 + heldMs }, cancelled);
  };
  c.rackSlots = () => [...c.rackEl.innerHTML.matchAll(/data-slot="(\d+)"/g)].map(m => +m[1]);
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
  check('swap plays one placement cue', c.cues, ['tile']);
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
  c.tapTile(0);
  check('one board tap returns the tile and leaves its neighbour in place', c.draft, [b]);
  check('recalling a tile clears the rack selection', c.sel, -1);
  c.tapTile(0);
  check('a second tile is recalled without swapping or following', [c.draft, c.follows], [[], 0]);
}
{
  const blank = tile(3, 'z', 7, 7, { blank: true }), a = tile(1, 'a', 7, 8), c = screen([blank, a]);
  c.tapTile(0, 600, true);
  check('cancelled hold keeps the blank and does not open the picker', [c.draft, c.picker ?? null], [[blank, a], null]);
  c.tapTile(0, 600);
  check('holding a blank opens the picker and preserves its letter', [c.picker, c.draft], [0, [blank, a]]);
  c.tapTile(0);
  check('one short tap returns a blank to the rack', c.draft, [a]);
}
{
  const a = tile(0, 't', 7, 7), b = tile(1, 'a', 7, 8, { hint: 'small' }), c = screen([a, b]);
  c.tapTile(1);
  check('tap leaves a hint in place', c.draft, [a, b]);
  c.S.cells[114] = { ch: 'x' };
  c.tap({ kind: 'board', cell: { r: 7, c: 9 } });
  check('tapping a settled tile still peeks', c.peeked, 114);
}
{
  const a = tile(0, 't', 7, 7), b = tile(1, 'a', 7, 8), c = screen([a, b]);
  c.press = { id: 1, kind: 'tile', di: 0, drag: true };
  c.release({ pointerId: 1, clientX: 8, clientY: 7 }, true);
  check('cancelled drag never swaps', c.draft, [a, b]);
}
{
  const c = screen([tile(1, 'a', 7, 7)]), p = { kind: 'rack', slot: 3, drag: true };
  c.rackEl.children = c.tiles.map((_, i) => ({ dataset: { slot: i }, getBoundingClientRect: () => ({ left: i * 10, width: 10 }) }));
  c.hover(p, 5, 20);
  check('rack insertion gap skips the shadow', c.gapAt(25), 1);
  check('drag preview keeps the shadow fixed', c.rackSlots(), [3, 1, 0, 2]);
  c.drop(p, 5, 20);
  check('rack reorder moves loose tiles across the shadow and keeps its slot', [c.tiles, c.draft[0].slot, c.saved], [['?', 'a', 't', 'r'], 1, 1]);
}
{
  const c = screen();
  c.tiles[2] = 'a';
  c.placeAt(2, 7, 7);
  c.placeAt(3, 7, 8, 'z');
  check('placing a letter and a blank each plays the placement cue', c.cues, ['tile', 'tile']);
  c.paintRack();
  check('placement keeps every slot in the rack', c.rackSlots(), [0, 1, 2, 3]);
  check('only the placed duplicate is faded', [...c.rackEl.innerHTML.matchAll(/class="rt used shadow" data-slot="(\d+)"/g)].map(m => +m[1]), [2, 3]);
  check('blank shadow has a name', c.rackEl.innerHTML.includes('aria-label="Highlight Blank on the board"'), true);
  c.drop({ kind: 'tile', di: 0 }, 8, 7);
  c.locateTile(2);
  check('shadow highlights the matching tile after a swap for one second', c.located, ['[data-i="113"]', 1000]);
  c.tapTile(0);
  c.paintRack();
  check('returned duplicate is active again in its own slot', c.rackEl.innerHTML.includes('<span class="rt" data-slot="2">a'), true);
  c.mode = 'exchange';
  c.tap({ kind: 'rack', slot: 2 });
  c.paintRack();
  check('returned tile can still be picked for exchange', c.rackEl.innerHTML.includes('class="rt pick" data-slot="2"'), true);
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
// The dock can temporarily clear the board without losing the draft or its view.
{
  const tools = source.slice(source.indexOf('\n  const quiet ='), source.indexOf('  // why a hint level'));
  globalThis.document = { documentElement: {} };
  for (const lang of ['en', 'pl']) {
    setLang(lang);
    for (const mode of ['pass', 'exchange']) {
      const original = [tile(1, 'a', 7, 7), tile(3, 'z', 7, 8, { blank: true })], c = screen(original);
      const zoom = { z: 2, x: -0.3, y: -0.2 }, cursor = { r: 7, c: 9, down: false };
      Object.assign(c, { stashedDraft: null, blankFor: -1, levels: null, zoom: { ...zoom }, cursor, manualOverview: true,
        dock: {}, t, app: { isConnected: true }, turnHints: [], zoomOut() { c.zoom = { z: 1, x: 0, y: 0 }; },
        panel: null, pickerOpen: () => false, wide: false, toast: false, paintOver() {}, refit() {}, canExchange: () => true,
        act(action) { c.action = action; c.resetTurn(); } });
      runInNewContext([fn('paintDock'), fn('resetTurn'), tools, fn('onKey'), 'this.tools = TOOLS;'].join('\n'), c);
      c.tools[mode]();
      c.paintDock();
      check(`${lang} ${mode}: set aside the draft and offer Back to my word`,
        [c.mode, c.draft, c.dock.innerHTML.includes(t('tiles.backToWord'))], [mode, [], true]);
      c.paintRack();
      check(`${lang} ${mode}: all rack tiles are available`, c.rackSlots(), [0, 1, 2, 3]);
      if (mode === 'pass') c.onKey({ key: 'Escape', target: {}, preventDefault() {} });
      else { c.tap({ kind: 'rack', slot: 3 }); c.tools.cancel(); }
      check(`${lang} ${mode}: cancel restores the board, blank, selection and view`,
        [c.mode, c.draft, c.cursor, c.zoom, c.manualOverview, c.picks.size], ['play', original, cursor, zoom, true, 0]);
      c.tools[mode]();
      if (mode === 'pass') c.tools.passYes();
      else { c.tap({ kind: 'rack', slot: 3 }); c.tools.swap(); }
      check(`${lang} ${mode}: confirming uses the chosen action and discards the draft`,
        [c.action, c.draft, c.stashedDraft], [mode === 'pass' ? { type: 'pass' } : { type: 'exchange', tiles: ['?'] }, [], null]);
      c.tools[mode]();
      c.paintDock();
      check(`${lang} ${mode}: empty draft keeps the regular Cancel label`, c.dock.innerHTML.includes(t('tiles.cancel')), true);
    }
  }
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
