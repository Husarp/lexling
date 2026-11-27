import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<div id="root"></div>', { url: 'https://lexling.test/' });
for (const key of ['window', 'document', 'location', 'navigator', 'localStorage', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: window[key] });
}
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
window.HTMLElement.prototype.scrollTo = function () {};
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
globalThis.fetch = async path => {
  if (path === 'data/index.json') return { json: async () => ({ counts: { pl: 1, en: 1 }, dims: 1 }) };
  if (path.endsWith('/vocab.json')) return { json: async () => ({ words: [], hard: { idx: [], score: [] }, secret: [] }) };
  if (path.endsWith('/pool.json')) return { json: async () => ({ drop: [] }) };
  if (path.endsWith('/ac.bin')) return { arrayBuffer: async () => new ArrayBuffer(0) };
  assert.match(path, /^data\/en\/tiles\.bin$/);
  const buffer = await readFile(new URL('../app/' + path, import.meta.url));
  return { arrayBuffer: async () => Uint8Array.from(buffer).buffer };
};

const { tilesGameScreen } = await import('../app/js/tiles-game.js');
const { settingsScreen } = await import('../app/js/screens.js');
const { newGame: save } = await import('../app/js/store.js');
const { newGame } = await import('../app/js/tiles.js');
const { REACTION_WINDOW, PROTOCOL } = await import('../app/js/session.js');
const { setLang } = await import('../app/js/i18n.js');
const { UI_ICONS } = await import('../app/js/ui.js');
const root = document.querySelector('#root');
const $ = s => root.querySelector(s);
const start = (players, link) => {
  const state = newGame({ lang: 'en', players, first: 0, seed: 1, rules: { rating: false } });
  const game = save({ mode: 'tiles', lang: 'en', state, toasted: true, link });
  location.hash = '#/game/' + game.id;
  return tilesGameScreen(root, game.id);
};
let count = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); count++; };

const css = await readFile(new URL('../app/css/app.css', import.meta.url), 'utf8');
const declarations = selector => css.slice(css.indexOf('\n' + selector + '{') + selector.length + 2).split('}')[0];
const lane = declarations('.tl-reaction-lane.has-reactions');
check(['grid-template-columns:minmax(0,1fr) 36px', 'grid-template-rows:36px', 'align-items:stretch']
  .every(rule => lane.includes(rule)), true, 'the lane fixes both tracks independently of their content');
check(declarations('.tl-reaction-link,.tl-reaction-picker').includes('grid-area:1/1'), true,
  'the live message and picker stretch into the same grid cell');
check(declarations('.tl-reaction-lane.has-reactions .mc-link').includes('height:100%;margin-bottom:0'), true,
  'the live message uses the full track height even when its text wraps');

check(declarations('.tl-reaction-rack').includes('position:absolute;grid-row:2;left:0;right:0;top:0;bottom:0'), true,
  'the lower picker overlays the rack track without contributing to its size');
check(declarations('.reactions-open .tl-reaction-link,.reactions-open .tl-rack').includes('visibility:hidden'), true,
  'opening the picker preserves both underlying boxes');

const listeners = new Map(), sent = [];
window.__netMock = { lan: {
  state: async () => ({ supported: true, on: true }),
  host: async () => ({}), close: async () => {},
  addListener: (event, fn) => { listeners.set(event, fn); return { remove() { listeners.delete(event); } }; },
  send: async ({ text }) => { sent.push(JSON.parse(text)); },
} };
const peer = (m, id = 'phone') => listeners.get('message')({ id, text: JSON.stringify(m) });
let clean;
const realSetTimeout = globalThis.setTimeout;
const realNow = Date.now;
try {
  clean = await start([{}, {}]);
  check($('.tl-reaction-toggle'), null, 'one-phone multiplayer has no reactions');
  clean();

  setLang('pl');
  clean = await start([{}, {}, {}], { kind: 'lan', role: 'host', me: 0, id: 'game' });
  await new Promise(resolve => setImmediate(resolve));
  const toggle = $('.tl-reaction-toggle'), picker = $('.tl-reaction-picker'), lower = $('.tl-reaction-rack');
  check(toggle.hidden, true, 'no button while waiting for the first peer');
  listeners.get('connected')({ id: 'phone', role: 'host', address: 'AA' });
  peer({ t: 'hello', v: PROTOCOL });
  $('[data-act=netLetIn]').click();
  listeners.get('connected')({ id: 'other', role: 'host', address: 'BB' });
  peer({ t: 'hello', v: PROTOCOL }, 'other');
  $('[data-act=netLetIn]').click();
  check([toggle.hidden, toggle.disabled, toggle.getAttribute('aria-label')], [false, false, 'Reakcje'], 'linked play enables the translated button by default');
  const face = toggle.innerHTML;
  const close = document.createElement('span');
  close.innerHTML = UI_ICONS.close;
  check(toggle.querySelector('img').getAttribute('src'), 'img/reactions/joy.svg', 'the closed picker shows the face');
  toggle.click();
  const ids = row => [...row.children].map(button => button.dataset.reaction);
  check([picker.hidden, lower.hidden, ids(picker), ids(lower)], [false, false,
    ['joy', 'wink', 'sunglasses', 'exploding-head', 'thinking', 'monocle'],
    ['pleading', 'rage', 'crying', 'yawning', 'clap', 'snail', 'heart']],
  'the picker opens with the six live-line reactions and seven rack reactions in order');
  check([toggle.innerHTML, toggle.getAttribute('aria-label'), toggle.getAttribute('aria-expanded')], [close.innerHTML, 'Zamknij reakcje', 'true'],
    'the open picker shows the close icon and announces its action');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
  check([picker.hidden, lower.hidden, document.activeElement === toggle], [true, true, true], 'Escape closes both rows and restores focus');
  toggle.click();
  toggle.click();
  check([picker.hidden, lower.hidden, toggle.innerHTML, toggle.getAttribute('aria-label'), toggle.getAttribute('aria-expanded')], [true, true, face, 'Reakcje', 'false'],
    'closing restores the face and its label');
  toggle.click();

  let unlock, now = realNow();
  Date.now = () => now;
  globalThis.setTimeout = (fn, ms, ...args) => {
    if (ms !== 8000) return realSetTimeout(fn, ms, ...args);
    unlock = fn;
    return 0x7fffffff;
  };
  $('[data-reaction=heart]').click();
  const local = $('.tl-reaction-pop');
  check([picker.hidden, lower.hidden, toggle.disabled, sent.at(-1), local.querySelector('img').alt], [
    true, true, false, { t: 'reaction', id: 'game', p: 0, icon: 'heart' }, 'Czerwone serce',
  ], 'sending from the rack closes both rows, relays once and animates locally');
  local.dispatchEvent(new window.Event('animationend'));
  check($('.tl-reaction-pop'), null, 'the animation removes the reaction');
  toggle.click();
  $('[data-reaction=wink]').click();
  check(toggle.disabled, false, 'two quick sends leave the toggle enabled');
  toggle.click();
  $('[data-reaction=joy]').click();
  check([toggle.disabled, toggle.classList.contains('cooldown'), picker.hidden, lower.hidden],
    [true, true, true, true], 'the third quick send closes the picker and starts the cooldown indicator');
  toggle.click();
  check(picker.hidden, true, 'the disabled button stays closed');
  now += 8000;
  unlock();
  check([toggle.disabled, toggle.classList.contains('cooldown')], [false, false], 'the toggle unlocks after eight seconds');
  const sentBefore = sent.length;
  toggle.click();
  $('[data-reaction=joy]').click();
  check([toggle.disabled, sent.length], [true, sentBefore], 'a fourth attempt inside the ten-second window locks without sending');
  now += 8000;
  unlock();
  toggle.click();
  $('[data-reaction=snail]').click();
  check([toggle.disabled, sent.at(-1).icon], [false, 'snail'], 'an expired window permits a fresh send');

  peer({ t: 'reaction', id: 'game', icon: 'rage' });
  check([...document.querySelectorAll('.tl-reaction-pop img')].at(-1).alt, 'Wściekłość', 'incoming reaction uses a translated label');
  $('[data-act=options]').click();
  const dlg = document.querySelector('.tl-options');
  dlg.querySelector('[data-tab=players]').click();
  const preference = dlg.querySelector('[data-key=tilesReactions]');
  preference.click();
  check([toggle.hidden, picker.hidden, $('.tl-reaction-pop'), JSON.parse(localStorage.getItem('wg.settings')).tilesReactions],
    [true, true, null, false], 'turning reactions off hides the picker and clears the current reaction immediately');
  now += REACTION_WINDOW;
  peer({ t: 'reaction', id: 'game', icon: 'joy' });
  check($('.tl-reaction-pop'), null, 'muted phones ignore incoming reactions');
  check(sent.at(-1), { t: 'reaction', id: 'game', p: 1, icon: 'joy' }, 'a muted host still relays to other phones');
  preference.click();
  check([toggle.hidden, JSON.parse(localStorage.getItem('wg.settings')).tilesReactions], [false, true], 'turning reactions back on restores the picker');
  dlg.querySelector('.gs-close').click();
  toggle.click();
  listeners.get('disconnected')({ id: 'phone' });
  check([picker.hidden, lower.hidden], [true, true], 'losing a peer closes both rows');
  clean();
  clean = null;

  setLang('en');
  await settingsScreen(root, null, () => {});
  check($('[data-section=about] a[href="img/reactions/LICENSE.txt"]').textContent,
    'Reaction icons by Google (Noto Emoji, Apache 2.0)', 'About links to the Noto Emoji licence');
  const settingsToggle = $('[data-section=games] [data-toggle=tilesReactions]');
  check([settingsToggle.getAttribute('aria-label'), settingsToggle.getAttribute('aria-checked')], ['Reactions', 'true'], 'Tiles settings expose the same preference in English');
  settingsToggle.click();
  check(JSON.parse(localStorage.getItem('wg.settings')).tilesReactions, false, 'Tiles settings save the preference');
} finally {
  Date.now = realNow;
  globalThis.setTimeout = realSetTimeout;
  if (clean) clean();
  window.close();
}
console.log(`all ${count} Tiles reaction UI tests passed`);
