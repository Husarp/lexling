// Exercise the real game screens with their word data (owner, 2026-11-26).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<div id="root"></div>', { url: 'https://localhost/', pretendToBeVisual: true });
const box = { left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 };
let reducedMotion = false;
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage,
  CustomEvent: window.CustomEvent,
  location: window.location, innerWidth: 360, getComputedStyle: window.getComputedStyle.bind(window),
  matchMedia: query => ({ matches: query.includes('pointer: fine') || (reducedMotion && query.includes('reduced-motion')), addEventListener() {} }),
  fetch: async url => new Response(readFileSync(new URL('../app/' + url, import.meta.url))),
});
window.Range.prototype.getBoundingClientRect = () => box;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.scrollTo = () => {};
window.HTMLElement.prototype.setPointerCapture = () => {};
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };

const { newGame, putSave, settings } = await import('../app/js/store.js');
const { load, rankAll, pct } = await import('../app/js/engine.js');
const { setLang, t } = await import('../app/js/i18n.js');
const { gameScreen } = await import('../app/js/game.js');
const { lettersGameScreen } = await import('../app/js/letters-game.js');
const { connectGameScreen } = await import('../app/js/connect-game.js');
const { tilesGameScreen } = await import('../app/js/tiles-game.js');
const { newGame: newTiles } = await import('../app/js/tiles.js');
const { settingsScreen } = await import('../app/js/screens.js');
settings.sound = false;
setLang('en');

const root = document.querySelector('#root');
const $ = sel => document.querySelector(sel);
const typed = key => document.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const base = mode => ({ id: mode, mode, status: 'playing', lang: 'en', diff: 'normal', timeMs: 0 });
const open = (screen, game) => { putSave(game); location.hash = '#/game/' + game.id; return screen(root, game.id); };
function guide(mode, board) {
  const before = $(board), hash = location.hash;
  $('.gs-open').click();
  assert.equal($('dialog .gs-head').nextElementSibling, $('dialog .gs-guide'));
  assert.equal($('dialog .gs-guide span').textContent, t('howto.title'));
  assert.equal($('dialog .gs-guide .arrow').getAttribute('aria-hidden'), 'true');
  $('dialog .gs-guide').click();
  assert.equal(document.querySelectorAll('dialog').length, 1);
  assert.equal($('dialog h2').textContent, t(`howto.${mode}.0`));
  const dots = $('.chapter-dots'), prev = $('[data-step="-1"]'), next = $('[data-step="1"]');
  const page = () => dots.style.getPropertyValue('--chapter');
  assert.equal(page(), '0');
  assert.ok(prev.disabled);
  next.click();
  assert.equal($('.chapter-dots'), dots);
  assert.equal(page(), '1');
  assert.ok(!prev.disabled);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.equal(page(), '0');
  for (let i = 1; i < dots.children.length; i++) next.click();
  assert.equal(page(), String(dots.children.length - 1));
  assert.ok(next.disabled);
  for (let i = 1; i < dots.children.length; i++) prev.click();
  assert.equal(page(), '0');
  if (mode !== 'guess') {
    $('[data-step="1"]').click();
    if (mode === 'connect') {
      assert.match($('.chapter-body').textContent, /Cofnij palec na poprzednią literę/);
    } else {
      const example = [...document.querySelectorAll('.chapter-body .lt')];
      const pl = document.documentElement.lang === 'pl';
      assert.equal(example.map(tile => tile.textContent).join(''), pl ? 'KAKAO' : 'EERIE');
      assert.deepEqual(example.map(tile => tile.classList[1]), pl ?
        ['hit', 'miss', 'miss', 'miss', 'near'] : ['miss', 'miss', 'near', 'miss', 'hit']);
      $('[data-step="1"]').click();
      const controls = document.querySelectorAll('.chapter-body ul li');
      assert.equal(controls.length, 3);
      assert.match(controls[2].textContent, pl ? /^Klawisze strzałek/ : /^Arrow keys/);
    }
  }
  $('dialog .gs-close').click();
  assert.equal(document.activeElement, $('dialog .gs-guide'));
  $('dialog .gs-close').click();
  assert.equal($('dialog'), null);
  assert.equal(location.hash, hash);
  assert.equal($(board), before);
}

const m = await load('en'), secret = 'cat', rank = rankAll(m, m.words.indexOf(secret));
const guesses = ['dog', 'horse', 'mouse', 'lion', 'tiger', 'spaceship'].map(w => {
  const r = rank[m.words.indexOf(w)];
  assert.ok(r, w);
  return { w, rank: r, pct: pct(r, m.count) };
}).sort((a, b) => a.rank - b.rank);
const outside = guesses.pop();
const guess = { ...base('guess'), cat: 'all', secret, guesses };
let stop = await open(gameScreen, guess);
assert.equal($('.guesses.top .guess.new').dataset.w, guesses.at(-1).w);
assert.equal($('.guesses:not(.top)'), null);
const input = $('#entry input');
input.value = outside.w;
guide('guess', '#board');
assert.equal(input.value, outside.w);
$('#entry .submit').click();
assert.equal($('.guesses:not(.top) .guess.new').dataset.w, outside.w);
assert.equal($('.guesses.top .guess.new'), null);
stop();

const hints = { ...base('guess'), id: 'guess-hints', cat: 'all', secret, guesses: [] };
stop = await open(gameScreen, hints);
assert.deepEqual([...$('.empty-ranks').querySelectorAll('text')].map(el => el.textContent), ['WORD', 'LETTER', 'TERM', '642', '42', '1']);
$('#hint').click();
assert.equal($('dialog .help').textContent, 'Use a hint? This game becomes practice.');
assert.equal($('[data-keep]').textContent, 'Keep playing');
$('[data-keep]').click();
assert.equal(hints.practice, undefined);
assert.equal(hints.guesses.length, 0);
$('#hint').click();
assert.equal($('[data-use]').textContent, 'Use hint');
$('[data-use]').click();
assert.equal(hints.practice, true);
assert.equal(hints.guesses.filter(g => g.hint).length, 1);
assert.equal($('.empty-ranks'), null);
$('#hint').click();
assert.equal($('dialog'), null);
assert.equal(hints.guesses.filter(g => g.hint).length, 2);
assert.equal(JSON.parse(localStorage.getItem('wg.saves')).find(g => g.id === hints.id).practice, true);
stop();

const letters = { ...base('letters'), len: 3, tries: 6, secret, guesses: [] };
stop = await open(lettersGameScreen, letters);
guide('letters', '.lt-board');
$('.gs-open').click();
const contrast = () => $('dialog [data-key="lettersContrast"]');
assert.equal(contrast().getAttribute('aria-label'), 'High contrast letters');
assert.equal(contrast().getAttribute('aria-checked'), 'false');
contrast().click();
assert.equal(document.documentElement.dataset.lettersContrast, 'true');
assert.equal(JSON.parse(localStorage.getItem('wg.settings')).lettersContrast, true);
$('dialog .gs-close').click();
stop();

setLang('pl');
await settingsScreen(root, null, () => {});
const displayContrast = $('[data-section="display"] [data-toggle="lettersContrast"]');
assert.equal(displayContrast.getAttribute('aria-label'), 'Wysoki kontrast liter');
assert.equal(displayContrast.getAttribute('aria-checked'), 'true');
displayContrast.click();
assert.equal(displayContrast.getAttribute('aria-checked'), 'false');
assert.equal(document.documentElement.dataset.lettersContrast, 'false');
assert.equal(JSON.parse(localStorage.getItem('wg.settings')).lettersContrast, false);

stop = await open(lettersGameScreen, letters);
$('.gs-open').click();
assert.equal(contrast().getAttribute('aria-checked'), 'false');
$('dialog .gs-close').click();
$('.kb [data-k="c"]').click();
guide('letters', '.lt-board');
assert.equal($('.lt-row.now').textContent, 'c');
stop();

for (const reduce of [false, true]) {
  reducedMotion = reduce;
  const win = { ...base('letters'), id: 'letters-win-' + reduce, len: 3, tries: 6, secret, guesses: [] };
  stop = await open(lettersGameScreen, win);
  for (const key of ['c', 'a', 't', 'Enter']) typed(key);
  assert.equal(win.status, 'won');
  await new Promise(resolve => setTimeout(resolve, 260));
  assert.ok($('.outcome.won'));
  assert.equal(!!$('.lt-win-pulse'), !reduce);
  assert.equal(document.querySelectorAll('.lt-confetti i').length, reduce ? 0 : 48);
  stop();
  location.hash = '#/result/' + win.id;
  await lettersGameScreen(root, win.id, true);
  assert.ok($('.outcome.won'));
  assert.equal($('.lt-confetti, .lt-win-pulse'), null);
}
reducedMotion = false;

const connect = { ...base('connect'), ring: 'scat', found: [], shown: [], bonus: [], hints: 0,
  board: { rows: 4, cols: 4, words: ['cat', 'act', 'sat', 'scat'].map((w, i) => ({ w, r: i + 1, c: 1, d: 'a' })) } };
const { setInterval: realInterval, clearInterval: realClear } = globalThis;
const intervals = new Set();
globalThis.setInterval = fn => { intervals.add(fn); return fn; };
globalThis.clearInterval = fn => intervals.delete(fn);
const tick = () => { for (const fn of [...intervals]) fn(); };
stop = await open(connectGameScreen, connect);
const ring = $('.cn-ring'), coords = [[50, 16], [84, 50], [50, 84], [16, 50]];
ring.getBoundingClientRect = () => box;
function pointer(type, i) {
  const [clientX, clientY] = coords[i];
  const e = new window.MouseEvent('pointer' + type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperties(e, { pointerId: { value: 1 }, isPrimary: { value: true } });
  ring.dispatchEvent(e);
}
const tap = i => { pointer('down', i); pointer('up', i); };
const draft = () => $('.say .w')?.textContent;
assert.ok($('.cn-tap-actions').hidden);
tap(1);
tick();
const connectTime = connect.timeMs;
assert.ok(connectTime > 0);
$('.cn-bonus').click();
assert.ok($('.cn-pop'));
assert.equal($('.cn-pop .cn-bonus-art').getAttribute('aria-hidden'), 'true');
tick();
assert.equal(connect.timeMs, connectTime);
$('.cn-bonus').click();
assert.equal($('[data-remove]').textContent, 'Usuń ostatnią');
assert.equal($('[data-submit]').textContent, 'Sprawdź');
assert.ok($('[data-submit]').disabled);
tap(1);
tap(2);
assert.equal(draft(), 'ca');
assert.equal($('polyline').getAttribute('points'), '84,50 50,84');
$('[data-remove]').click();
assert.equal(draft(), 'c');
guide('connect', '.cw');
assert.equal(draft(), 'c');
tap(2);
tap(3);
assert.equal(draft(), 'cat');
$('[data-submit]').click();
assert.deepEqual(connect.found, ['cat']);
assert.ok($('.cn-tap-actions').hidden);

tap(0);
pointer('down', 2);
pointer('cancel', 2);
assert.equal(draft(), 's');
pointer('down', 2);
pointer('move', 1);
pointer('move', 2);
assert.equal(draft(), 'a');
pointer('move', 1);
pointer('move', 3);
pointer('up', 3);
assert.deepEqual(connect.found, ['cat', 'act']);
assert.ok($('.cn-tap-actions').hidden);
for (const key of ['s', 'a', 't', 'Enter']) typed(key);
assert.deepEqual(connect.found, ['cat', 'act', 'sat']);
tap(0);
$('[data-remove]').click();
assert.ok($('.cn-tap-actions').hidden);
assert.equal($('polyline').getAttribute('points'), '');
connect.bonus.push('cast');
$('.cn-bonus').click();
assert.equal($('.cn-pop .cn-bonus-art'), null);
assert.equal($('.cn-pop .words').textContent, 'cast');
stop();

globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const tiles = newGame({ mode: 'tiles', lang: 'en', toasted: true,
  state: newTiles({ lang: 'en', players: [{}, { cpu: 'expert' }], first: 0, seed: 3, rules: { rating: false } }) });
location.hash = '#/game/' + tiles.id;
stop = await tilesGameScreen(root, tiles.id);
const activity = () => root.firstElementChild.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
activity();
tick();
assert.equal(tiles.timeMs, 1000);
$('[data-open="check"]').click();
assert.ok($('.tl-panel'));
tick();
assert.equal(tiles.timeMs, 2000);   // Tiles counts while a panel is open and during the others' turns
$('[data-act="close"]').click();
$('[data-act="pass"]').click();
$('[data-act="passYes"]').click();
assert.equal(tiles.state.turn, 1);
activity();
tick();
assert.equal(tiles.timeMs, 3000);
stop();

for (const bonus of [50, 0]) {
  const state = newTiles({ lang: 'en', players: [{}, { cpu: 'expert' }], first: 0, seed: 3, rules: { rating: false, bingo: bonus } });
  state.racks[0] = [...'letters'];
  const game = { ...base('tiles'), id: 'tiles-bingo-' + bonus, state, toasted: true };
  stop = await open(tilesGameScreen, game);
  $('.tl-board').getBoundingClientRect = $('.tb').getBoundingClientRect = () => box;
  for (const type of ['down', 'up']) {
    const e = new window.MouseEvent('pointer' + type, { bubbles: true, cancelable: true, clientX: 50, clientY: 50 });
    Object.defineProperties(e, { pointerId: { value: 1 }, isPrimary: { value: true } });
    $('.tb').dispatchEvent(e);
  }
  typed('l');
  assert.equal($('.tb .t.new.settling').firstChild.textContent, 'l');
  for (const ch of 'etters') typed(ch);
  assert.equal(document.querySelectorAll('.tb .t.new.settling').length, 1);
  assert.equal(document.querySelectorAll('.tb .t.new').length, 7);
  $('[data-act="play"]').click();
  assert.ok(game.state.moves[0].bingo);
  assert.equal($('.ps-bingo-label')?.textContent, bonus ? 'Bingo +50' : undefined);
  assert.equal(document.querySelectorAll('.ps[data-who="0"] .ps-bingo-tiles i').length, bonus ? 7 : 0);
  stop();
}
assert.equal(intervals.size, 0);
Object.assign(globalThis, { setInterval: realInterval, clearInterval: realClear });
root.replaceChildren();
window.close();

console.log('in-game controls and Connect/Tiles play time passed');
