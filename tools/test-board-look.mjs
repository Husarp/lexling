// Board rendering and look controls, including old saves and the final board (owner, 2026-11-14).
// Run: node tools/test-board-look.mjs (no browser or dependencies).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const stored = new Map([['wg.settings', JSON.stringify({ lang: 'en', rememberSetupOn: true })]]);
globalThis.localStorage = { getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v) };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.window = { addEventListener() {} };
globalThis.document = { documentElement: {}, addEventListener() {}, createRange: () => ({}) };
const { settings } = await import('../app/js/store.js');
const { t, setLang } = await import('../app/js/i18n.js');
const { newGame, sizeOf, premiums, apply } = await import('../app/js/tiles.js');
const { boardInner, boardStyleSeg, topics, LABEL, BONUS_LOOKS, COLOUR_LOOKS, TILE_LOOKS, RATE_LOOKS, tileSwatch } = await import('../app/js/tiles-game.js');
const { tilesNewScreen } = await import('../app/js/screens.js');
const { settingRows, wireSettingRows } = await import('../app/js/ui.js');
const source = read('app/js/tiles-game.js');
check('old preferences receive the classic board and shapes off', [settings.tilesBoardStyle, settings.tilesCb], ['classic', false]);

const tiles = html => [...html.matchAll(/<b class="t ([^"]*)" data-i="(\d+)"/g)].map(m => ({ classes: m[1].split(' '), i: +m[2] }));
const lastAt = (s, opts) => tiles(boardInner(s, opts)).filter(x => x.classes.includes('last')).map(x => x.i);
for (const board of ['classic', 'bonus', 'quick']) {
  const initial = newGame({ lang: 'en', board, players: [{}, { cpu: 'medium' }], first: 0, seed: 1 });
  const n = sizeOf(board), mid = Math.floor(n / 2), a = mid * n + mid;
  const placed = [{ r: mid, c: mid, ch: 'a' }, { r: mid, c: mid + 1, ch: 't' }];
  const s = apply({ ...initial, racks: [['a', 't'], ['s']] }, { type: 'place', placed }, () => true);
  const snapshot = JSON.stringify(s);
  check(`${board}: first play is outlined`, lastAt(s), [a, a + 1]);
  check(`${board}: a pass keeps the outline`, lastAt(apply(s, { type: 'pass' }, () => true)), [a, a + 1]);
  const swap = apply({ ...s, racks: [s.racks[0], ['e']] }, { type: 'exchange', tiles: ['e'] }, () => true);
  check(`${board}: an exchange keeps the outline`, lastAt(swap), [a, a + 1]);
  const next = apply(s, { type: 'place', placed: [{ r: mid, c: mid + 2, ch: 's' }] }, () => true);
  check(`${board}: the computer's play replaces the whole previous outline`, lastAt(next), [a + 2]);
  for (const kind of ['withdrawn', 'vetoed']) {
    check(`${board}: ${kind} clears the outline despite earlier plays and later passes`,
      lastAt({ ...s, moves: [...s.moves, { kind, placed }, { kind: 'pass' }] }), []);
  }
  check(`${board}: old save without moves renders safely`, lastAt({ ...s, moves: undefined }), []);
  check(`${board}: old move without placement renders safely`, lastAt({ ...s, moves: [{ kind: 'play' }] }), []);
  const preview = tiles(boardInner(s, { hinted: new Set([a]), draft: [{ r: mid, c: mid + 2, ch: 's', hint: true }], peek: a + 1 }));
  check(`${board}: a hint crossing the last word retains its hint look`, preview.find(x => x.i === a).classes.includes('hint'), true);
  check(`${board}: a hint draft gets no last-move ring`, preview.find(x => x.i === a + 2).classes, ['hint']);
  check(`${board}: peek fades the same element as the last ring`, preview.find(x => x.i === a + 1).classes.includes('peek') && preview.find(x => x.i === a + 1).classes.includes('last'), true);
  for (const bad of [false, true]) {
    const draft = tiles(boardInner(s, { bad, draft: [{ r: mid, c: mid + 2, ch: 's' }] })).find(x => x.i === a + 2);
    check(`${board}: a ${bad ? 'bad' : 'valid'} draft has only this turn's ring`, draft.classes, bad ? ['new', 'bad'] : ['new']);
  }
  check(`${board}: rendering does not mutate saved state`, JSON.stringify(s), snapshot);

  const challenged = apply({ ...initial, racks: [['a', 't'], ['s']], rules: { ...initial.rules, check: 'challenge' } }, { type: 'place', placed }, () => false);
  check(`${board}: a challengeable play is outlined`, lastAt(challenged), [a, a + 1]);
  check(`${board}: a successful challenge clears the outline`, lastAt(apply(challenged, { type: 'challenge' }, () => false)), []);
  const voters = { ...s, players: [{}, {}], rules: { ...s.rules, veto: true } };
  const voting = apply(voters, { type: 'place', placed: [{ r: mid, c: mid + 2, ch: 's' }] }, () => true);
  check(`${board}: an unaccepted move keeps the previous outline`, lastAt(voting), [a, a + 1]);
  check(`${board}: accepting the vote moves the outline`, lastAt(apply(voting, { type: 'vote', p: 0, veto: false }, () => true)), [a + 2]);
  check(`${board}: vetoing the vote clears the previous outline too`, lastAt(apply(voting, { type: 'vote', p: 0, veto: true }, () => true)), []);

  for (const lang of ['en', 'pl']) for (const style of ['classic', 'muted']) for (const bonus of [true, 'text', false]) for (const cb of [false, true]) {
    setLang(lang);
    Object.assign(settings, { tilesBoardStyle: style, tilesBonus: bonus, tilesCb: cb });
    const html = boardInner(initial, { cursor: { r: mid, c: mid, down: true }, drop: 0, draft: placed });
    const squares = [...html.matchAll(/<span class="q ([^"]*)" style="[^"]*">(.*?)<\/span>/g)];
    const bonuses = squares.filter(m => /\b(l2|l3|w2|w3)\b/.test(m[1]));
    const expected = [...premiums(board)].filter(k => LABEL[k]).length;
    const name = `${board}/${lang}/${style}/${bonus}/${cb}`;
    check(`${name}: every bonus square exists`, bonuses.length, expected);
    check(`${name}: shapes follow the option`, (html.match(/class="bonus-mark"/g) || []).length, cb ? expected : 0);
    if (cb) check(`${name}: bonus labels survive start, cursor, drop and draft overlays`, bonuses.every(m => m[2].startsWith(t('tiles.label.' + /\b(l2|l3|w2|w3)\b/.exec(m[1])[1]))), true);
    const guide = topics(initial.rules);
    check(`${name}: all four legend shapes follow the option`, (guide.match(/class="bonus-mark"/g) || []).length, cb ? 4 : 0);
    check(`${name}: the guide explains the last move`, guide.includes(t('tiles.looks.last')), true);
  }
}

// Minimal DOM stand-ins: real New game rendering/handlers and Options rows, no layout engine.
class Element {
  constructor(dataset = {}) {
    this.dataset = dataset; this.attrs = {}; this.listeners = {}; this.children = new Map();
    const classes = new Set();
    this.classList = { contains: k => classes.has(k), toggle: (k, on) => on ? classes.add(k) : classes.delete(k) };
  }
  querySelector(selector) {
    if (selector === '.guess-input .submit' || selector === '[data-skipturn]') return null;
    if (!this.children.has(selector)) this.children.set(selector, new Element());
    return this.children.get(selector);
  }
  querySelectorAll() { return []; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  fire(target = this) { for (const fn of this.listeners.click ?? []) fn({ target }); }
  closest(selector) { return selector === '[data-board-style]' && this.dataset.boardStyle || selector === '[data-key]' && this.dataset.key ? this : null; }
}
for (const lang of ['en', 'pl']) {
  setLang(lang);
  Object.assign(settings, { tilesBoardStyle: 'classic', tilesCb: false });
  const root = new Element();
  tilesNewScreen(root, null, () => {});
  check(`${lang}: New game offers translated board and shapes controls`, ['tiles.boardStyle', 'tiles.boardStyleHelp', 'tiles.cb', 'tiles.cbHelp'].every(k => root.innerHTML.includes(t(k))), true);
  for (const style of ['muted', 'classic']) {
    root.querySelector('#board-style').fire(new Element({ boardStyle: style }));
    check(`${lang}: board style click persists`, JSON.parse(stored.get('wg.settings')).tilesBoardStyle, style);
    check(`${lang}: board style click refreshes its selection`, root.querySelector('#board-style').innerHTML.includes(`data-board-style="${style}" class="on"`), true);
  }
  for (const cb of [true, false]) {
    root.querySelector('#tiles-cb').fire();
    check(`${lang}: shape switch persists`, JSON.parse(stored.get('wg.settings')).tilesCb, cb);
    check(`${lang}: shape switch updates its accessible state`, root.querySelector('#tiles-cb').attrs['aria-checked'], String(cb));
    check(`${lang}: shape switch refreshes the How to play legend`, root.querySelector('.howto .tl-topics').outerHTML.includes('tl-legend cb'), cb);
  }
}

// Execute the real closed-over Options function, with a repaint counter and the real shared row wiring.
let dialog, repaints = 0;
const options = source.slice(source.indexOf('  function openOptions() {'), source.indexOf('  // ── several phones', source.indexOf('  function openOptions() {')));
const context = { S: { rules: {} }, host: false, settings, t, BONUS_LOOKS, COLOUR_LOOKS, TILE_LOOKS, RATE_LOOKS, tileSwatch,
  LIST: '', settingRows, wireSettingRows, applyTileLook() {}, repaint() { repaints++; }, confirmClick() {},
  openDialog(title, html) { dialog = new Element(); dialog.innerHTML = html; return { dlg: dialog, close() {} }; } };
runInNewContext(options + '\nopenOptions();', context);
check('Options puts board style and shapes directly after Bonus squares', dialog.innerHTML.indexOf('data-key="tilesBonus"') < dialog.innerHTML.indexOf('data-key="tilesBoardStyle"') && dialog.innerHTML.indexOf('data-key="tilesBoardStyle"') < dialog.innerHTML.indexOf('data-key="tilesCb"'), true);
check('Options puts move details immediately after Rate my moves', dialog.innerHTML.indexOf('data-key="tilesRate"') >= 0 && dialog.innerHTML.indexOf('data-key="tilesRate"') < dialog.innerHTML.indexOf('data-key="tilesUnder"'), true);
for (const [key, v] of [['tilesBoardStyle', 'muted'], ['tilesCb', undefined], ['tilesUnder', 'rarity'], ['tilesUnder', 'both'], ['tilesUnder', 'rating']]) {
  const before = repaints;
  dialog.fire(new Element({ key, ...(v === undefined ? {} : { v }) }));
  check(`${key}: Options saves the choice`, JSON.parse(stored.get('wg.settings'))[key], key === 'tilesCb' ? true : v);
  check(`${key}: Options repaints immediately`, repaints, before + 1);
}

context.S.rules.rating = false;
runInNewContext(options + '\nopenOptions();', context);
check('Options still offers all move-detail choices when the game disables rating', ['rating', 'rarity', 'both'].every(v => dialog.innerHTML.includes(`data-key="tilesUnder" data-v="${v}"`)), true);

// Both screen paths use the same look classes and renderer; exercise the class expression for all combinations.
const looks = source.slice(source.indexOf('  const looks = () =>'), source.indexOf('  const myTurn ='));
for (const style of [undefined, 'classic', 'muted']) for (const cb of [undefined, false, true]) for (const colours of [true, 'letters', false]) for (const raised of [false, true]) {
  Object.assign(settings, { tilesBoardStyle: style, tilesCb: cb, tilesColours: colours, tiles3d: raised });
  const classes = runInNewContext(looks + '\nlooks();', { settings }).split(' ');
  check('board classes reflect all current preferences, including older saves', [classes.includes('muted'), classes.includes('cb'), classes.includes('own'), classes.includes('inks'), classes.includes('raised')], [style === 'muted', !!cb, colours === true, colours === 'letters', raised]);
}
check('final board shares live-board looks and rendering', source.includes('class="tb n${n}${looks()}" style="--n:${n}">${boardInner(S)}'), true);
settings.tilesBoardStyle = undefined;
check('missing style selects Classic', boardStyleSeg().includes('data-board-style="classic" class="on"'), true);
console.log(`all ${passed} board look tests passed`);
