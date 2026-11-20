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
globalThis.document = { documentElement: { style: { setProperty(k, v) { this[k] = v; } } }, addEventListener() {}, createRange: () => ({}) };
const { settings } = await import('../app/js/store.js');
const { t, setLang, plural } = await import('../app/js/i18n.js');
const { newGame, sizeOf, premiums, apply } = await import('../app/js/tiles.js');
const { boardInner, boardStyleSeg, topics, LABEL, BONUS_LOOKS, TILE_LOOKS, RATE_LOOKS, tileSwatch, finalOrder, removedPlayer } = await import('../app/js/tiles-game.js');
const { tilesNewScreen } = await import('../app/js/screens.js');
const { playerIcon, TILE_SETUP_ICONS, settingRows, wireSettingRows } = await import('../app/js/ui.js');
const source = read('app/js/tiles-game.js');
// Exercise the live zoom-tool updater across overview, intermediate and maximum scales.
for (const z of [1, 1.5, 2, 2.5]) {
  const buttons = { zoomIn: {}, wholeBoard: {} };
  const context = { zoom: { z }, ZOOM_MAX: 2.5, status: { querySelector: selector => buttons[selector.match(/data-act="([^"]+)"/)[1]] } };
  runInNewContext(source.match(/function paintZoomTools\(\) \{[\s\S]*?\n  \}/)[0] + ';paintZoomTools()', context);
  check(`zoom ${z}: only useful zoom actions enabled`, [buttons.zoomIn.disabled, buttons.wholeBoard.disabled], [z >= 2.5, z <= 1]);
}

check('old preferences receive the classic board and shapes off', [settings.tilesBoardStyle, settings.tilesCb], ['classic', false]);

check('new look defaults', [settings.tilesFrame, settings.tilesLast, settings.tilesTile, settings.tilesColours], ['graphite', true, 'cream', false]);

const tiles = html => [...html.matchAll(/<b class="t ([^"]*)" data-i="(\d+)"/g)].map(m => ({ classes: m[1].split(' '), i: +m[2] }));
const lastAt = (s, opts) => tiles(boardInner(s, opts)).filter(x => x.classes.includes('last')).map(x => x.i);
for (const board of ['classic', 'bonus', 'quick']) {
  const initial = newGame({ lang: 'en', board, players: [{}, { cpu: 'medium' }], first: 0, seed: 1 });
  const n = sizeOf(board), mid = Math.floor(n / 2), a = mid * n + mid;
  const placed = [{ r: mid, c: mid, ch: 'a' }, { r: mid, c: mid + 1, ch: 't' }];
  const s = apply({ ...initial, racks: [['a', 't'], ['s']] }, { type: 'place', placed }, () => true);
  const snapshot = JSON.stringify(s);
  settings.tilesLast = false;
  check(`${board}: last-move highlight can be disabled`, lastAt(s), []);
  settings.tilesLast = true;
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
  check(`${board}: a hint draft shares the pending highlight without a last-move ring`, preview.find(x => x.i === a + 2).classes, ['new', 'hint']);
  check(`${board}: a committed tile crossed by a hint is not marked as new`, preview.find(x => x.i === a).classes.includes('new'), false);
  check(`${board}: a bad hint draft retains the error class`, tiles(boardInner(s, { bad: true, draft: [{ r: mid, c: mid + 2, ch: 's', hint: true }] })).find(x => x.i === a + 2).classes, ['new', 'hint', 'bad']);
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
    this.classList = { contains: k => classes.has(k), add: k => classes.add(k), toggle: (k, on) => on ? classes.add(k) : classes.delete(k) };
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
  const players = root.querySelector('.tl-players');
  const person = playerIcon({ players: [{}] }, 0), computer = playerIcon({ players: [{ cpu: 'medium' }] }, 0);
  const seatIcons = () => [...players.innerHTML.matchAll(/<i class="tl-player-icon" aria-hidden="true">(.*?)<\/i>/g)].map(m => m[1]);
  check(`${lang}: setup rows and starting chips share person/computer symbols`, seatIcons(), [person, computer, person, computer]);
  check(`${lang}: random start has a die and no question badge`, players.innerHTML.includes(TILE_SETUP_ICONS.dice) && !players.innerHTML.includes('?</span>'), true);
  const add = players.innerHTML.match(/<button[^>]*data-add>(.*?)<\/button>/)[1];
  check(`${lang}: Add player has one combined symbol and translated text`, [add.match(/<svg/g).length, add.replace(/<[^>]*>/g, '')], [1, t('tiles.addPlayer')]);
  for (const section of ['tl-assists', 'tl-rules']) {
    const summary = root.innerHTML.match(new RegExp(`<details class="card ${section}"[^>]*>\\s*<summary>(.*?)</summary>`))[1];
    check(`${lang}: ${section} leaves the chevron to shared CSS`, summary.includes('class="arrow"'), false);
  }
  for (const kind of ['person', 'cpu']) {
    players.fire({ closest: () => ({ dataset: { kind, p: '1' } }) });
    check(`${lang}: changing seat type updates row and starting chip to ${kind}`, seatIcons(), [person, kind === 'cpu' ? computer : person, person, kind === 'cpu' ? computer : person]);
  }
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
    check(`${lang}: How to play uses the current shape preference`, topics().includes('tl-legend cb'), cb);
  }
}

// Execute the real closed-over Options function, with a repaint counter and the real shared row wiring.
let dialog, repaints = 0;
const options = source.slice(source.indexOf('  function openOptions() {'), source.indexOf('  // ── several phones', source.indexOf('  function openOptions() {')));
const context = { playerIcon, S: { rules: {}, players: [{}, { cpu: true }] }, nameOf: (_, p) => p ? 'Computer' : 'You', esc: s => s, histHtml: () => '<p>History rows</p>', host: false, settings, t, BONUS_LOOKS, TILE_LOOKS, RATE_LOOKS, tileSwatch,
  window: { addEventListener() {}, removeEventListener() {} }, LIST: '', settingRows, wireSettingRows, applyTileLook() {}, repaint() { repaints++; }, confirmClick() {},
  openDialog(title, html) { dialog = new Element(); dialog.innerHTML = html; return { dlg: dialog, close() {} }; } };
runInNewContext(options + '\nopenOptions();', context);
check('Options Players uses the shared symbols for both seat types',
  [...dialog.innerHTML.matchAll(/<i class="tl-player-icon" aria-hidden="true">(.*?)<\/i>/g)].map(m => m[1]), context.S.players.map((_, p) => playerIcon(context.S, p)));
check('Options has exactly three tabs with History selected', (dialog.innerHTML.match(/role="tab" /g) || []).length, 3);
check('Options opens History by default', dialog.innerHTML.includes('id="op-tab-history" data-tab="history" aria-controls="op-history" aria-selected="true"'), true);
check('Options pins Give up after the scrolling content', dialog.innerHTML.includes('</div><footer class="op-foot"><button'), true);
check('Options uses real tiles for all colour choices', (dialog.innerHTML.match(/style="--tl-tile:/g) || []).length, TILE_LOOKS.length);
check('Options has no Settings or Resume action', /tiles.opt.settings|data-go="hist"|op-sec|Resume/.test(dialog.innerHTML), false);
check('Options places matching outline buttons on both sides of its footer',
  /<footer class="op-foot"><button class="btn btn-outline op-how"[^>]*data-guide>[\s\S]*?<\/button><button class="btn btn-outline btn-danger op-quit"/.test(dialog.innerHTML), true);
const guideActions = [];
context.openDialog = (title, html) => { dialog = new Element(); dialog.innerHTML = html; return { dlg: dialog, close() { guideActions.push('close'); } }; };
context.topics = rules => rules;
context.openRules = (mode, rules) => guideActions.push([mode, rules === context.S.rules]);
for (const lang of ['en', 'pl']) {
  setLang(lang);
  runInNewContext(options + '\nopenOptions();', context);
  check(`${lang}: footer uses existing translated labels`,
    dialog.innerHTML.includes(`data-guide>${t('tiles.guide')}</button>`) && dialog.innerHTML.includes(`${t('game.giveUp')}</button></footer>`), true);
  guideActions.length = 0;
  dialog.fire({ closest: selector => selector === '[data-guide]' ? {} : null });
  check(`${lang}: How to play closes Options before opening the existing rules`, guideActions, ['close', ['tiles', true]]);
}
check('Options puts board style and shapes directly after Bonus squares', dialog.innerHTML.indexOf('data-key="tilesBonus"') < dialog.innerHTML.indexOf('data-key="tilesBoardStyle"') && dialog.innerHTML.indexOf('data-key="tilesBoardStyle"') < dialog.innerHTML.indexOf('data-key="tilesCb"'), true);
check('Options puts move details immediately after Rate my moves', dialog.innerHTML.indexOf('data-key="tilesRate"') >= 0 && dialog.innerHTML.indexOf('data-key="tilesRate"') < dialog.innerHTML.indexOf('data-key="tilesUnder"'), true);
for (const [key, v] of [['buttonSize', '100'], ['buttonSize', '115'], ['buttonSize', '130'], ['buttonSize', '150'], ['buttonSize', '175'], ['tilesBoardStyle', 'muted'], ['tilesCb', undefined], ['tilesFrame', 'frameless'], ['tilesFrame', 'orange'], ['tilesFrame', 'graphite'], ['tilesLast', undefined], ['tilesUnder', 'rarity'], ['tilesUnder', 'both'], ['tilesUnder', 'rating']]) {
  const before = repaints;
  dialog.fire(new Element({ key, ...(v === undefined ? {} : { v }) }));
  check(`${key}: Options saves the choice`, JSON.parse(stored.get('wg.settings'))[key], key === 'tilesCb' ? true : key === 'tilesLast' ? false : v);
  check(`${key}: Options repaints immediately`, repaints, before + 1);
  if (key === 'buttonSize') check(`Options applies ${v}% immediately`, document.documentElement.style['--button-scale'], +v / 100);
}

context.S.rules.rating = false;
runInNewContext(options + '\nopenOptions();', context);
check('Options still offers all move-detail choices when the game disables rating', ['rating', 'rarity', 'both'].every(v => dialog.innerHTML.includes(`data-key="tilesUnder" data-v="${v}"`)), true);

context.host = true;
context.hostSection = () => '<button data-skipturn></button><button data-remove="1"></button>';
const confirmations = [];
context.confirmClick = (button, action) => confirmations.push(action);
runInNewContext(options + '\nopenOptions();', context);
check('Host end game lives inside Players', /id="op-players"[\s\S]*class="btn btn-ghost btn-danger op-end"[\s\S]*<\/section>/.test(dialog.innerHTML), true);
check('Host end and own Give up retain confirmation wiring', confirmations.length, 2);
check('Host management is not collapsed inside the Players tab', !source.match(/function hostSection\(\)[\s\S]*?\n  \}/)[0].includes('<details'), true);
context.host = false;

settings.tilesLast = true;
check('Options offers all frame choices', ['graphite', 'frameless', 'orange'].every(v => dialog.innerHTML.includes(`data-key="tilesFrame" data-v="${v}"`)), true);

// Both screen paths use the same look classes and renderer; exercise the class expression for all combinations.
const looks = source.slice(source.indexOf('  const looks = () =>'), source.indexOf('  const myTurn ='));
for (const style of [undefined, 'classic', 'muted']) for (const cb of [undefined, false, true]) for (const colours of [true, 'letters', false]) for (const raised of [false, true]) {
  Object.assign(settings, { tilesBoardStyle: style, tilesCb: cb, tilesColours: colours, tiles3d: raised });
  const classes = runInNewContext(looks + '\nlooks();', { settings }).split(' ');
  check('board classes reflect all current preferences, including older saves', [classes.includes('muted'), classes.includes('cb'), classes.includes('own'), classes.includes('inks'), classes.includes('raised')], [style === 'muted', !!cb, false, false, raised]);
}
check('final board shares live-board looks and rendering', source.includes('class="tb n${n}${looks()}" style="--n:${n}">${boardInner(S)}'), true);
settings.tilesBoardStyle = undefined;
check('missing style selects Classic', boardStyleSeg().includes('data-board-style="classic" class="on"'), true);
// Result eligibility agrees with the winner, even when an out player has more points.
{
  let state = newGame({ lang: 'en', players: [{}, {}, {}], first: 0, seed: 1 });
  state = apply(state, { type: 'resign', p: 2, removed: true }, () => true);
  state = { ...state, scores: [-10, -6, 3] };
  check('resigned high scorer ranks below eligible players', finalOrder(state), [1, 0, 2]);
  check('host removal is distinguished from giving up', [removedPlayer(state, 2), removedPlayer(state, 1)], [true, false]);
  for (const lang of ['en', 'pl']) {
    setLang(lang);
    check(`${lang}: host removal message exists`, t('net.removed').includes('net.removed'), false);
    for (const [n, bonus, hints] of lang === 'en' ? [[1, 'bonus word', 'hint'], [2, 'bonus words', 'hints']] : [[1, 'słowo bonusowe', 'podpowiedź'], [2, 'słowa bonusowe', 'podpowiedzi'], [5, 'słów bonusowych', 'podpowiedzi']]) {
      check(`${lang}: result plurals for ${n}`, [plural(n, 'cn.bonusLow'), plural(n, 'cn.hintsLow')], [bonus, hints]);
    }
    check(`${lang}: singular exchange`, plural(1, 'tiles.hist.exchanged').replace('{n}', 1), lang === 'en' ? 'Exchanged 1 tile' : 'Wymiana 1 płytki');
  }
}
console.log(`all ${passed} board look tests passed`);
