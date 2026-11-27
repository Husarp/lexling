import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<div id="root"></div>', { url: 'https://lexling.test/' });
const { document } = window, root = document.querySelector('#root');
for (const key of ['window', 'document', 'location', 'navigator', 'localStorage', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: window[key] });
}
globalThis.matchMedia = query => ({ matches: query === '(pointer: coarse)', addEventListener() {} });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
window.innerWidth = 390;
window.innerHeight = 800;
const viewport = Object.assign(new window.EventTarget(), { height: 800, offsetTop: 0 });
window.visualViewport = viewport;
Object.defineProperty(root, 'clientHeight', { get: () => window.innerHeight - 20 });

let now = 0, nextId = 0;
const timers = new Map();
window.setTimeout = (fn, ms) => {
  timers.set(++nextId, { fn, at: now + ms });
  return nextId;
};
window.clearTimeout = id => timers.delete(id);
function advance(ms) {
  now += ms;
  for (const [id, { fn, at }] of timers) {
    if (at > now) continue;
    timers.delete(id);
    fn();
  }
}
const height = () => root.style.getPropertyValue('--safe-height');
const resize = px => {
  viewport.height = px;
  viewport.dispatchEvent(new window.Event('resize'));
};
const event = name => window.dispatchEvent(new window.Event(name));

let finishWords;
const words = new Promise(resolve => { finishWords = resolve; });
globalThis.fetch = async path => {
  if (path.endsWith('/vocab.json')) return { json: () => words };
  if (path.endsWith('/pool.json')) return { json: async () => ({ drop: [] }) };
  if (path.endsWith('/ac.bin')) return { arrayBuffer: async () => new ArrayBuffer(0) };
  if (path.endsWith('.txt')) return { text: async () => '' };
  assert.match(path, /^data\/en\/tiles\.bin$/);
  const bytes = await readFile(new URL('../app/' + path, import.meta.url));
  return { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};

const { tilesGameScreen } = await import('../app/js/tiles-game.js');
const { newGame: save } = await import('../app/js/store.js');
const { newGame } = await import('../app/js/tiles.js');
const { loadWords } = await import('../app/js/engine.js');
const state = newGame({ lang: 'en', players: [{}, {}], first: 0, seed: 1, rules: { open: true, rating: false } });
const game = save({ mode: 'tiles', lang: 'en', state, toasted: true });
window.location.hash = '#/game/' + game.id;
let cleanup = await tilesGameScreen(root, game.id);

try {
  const nativeFocus = window.HTMLInputElement.prototype.focus;
  let focusOptions;
  window.HTMLInputElement.prototype.focus = function (options) {
    focusOptions = options;
    nativeFocus.call(this, options);
  };
  const openCheck = () => root.querySelector('[data-open=check]').click();
  openCheck();
  const panel = root.querySelector('.tl-check-panel'), input = panel.querySelector('input');
  panel.getBoundingClientRect = () => ({ top: 130 });
  root.querySelector('.tl-bwrap').getBoundingClientRect = () => ({ bottom: 460 });
  assert.equal(document.activeElement, input);
  assert.deepEqual(focusOptions, { preventScroll: true });
  assert.equal(height(), '780px');

  // The visible viewport can shrink with or without a WebView layout resize.
  resize(420);
  assert.equal(panel.style.maxHeight, '290px');
  window.innerHeight = 390;
  event('resize');
  resize(390);
  advance(3000);
  assert.equal(panel.style.maxHeight, '260px');
  assert.equal(height(), '780px');

  // Background word data repaints the moves while the check field has focus.
  input.value = 'at';
  input.setSelectionRange(1, 1);
  panel.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const result = panel.querySelector('.res');
  assert.match(result.textContent, /AT/);
  const moveCards = root.querySelector('.mcards');
  finishWords({ words: [], hard: { idx: [], score: [] }, secret: [] });
  await loadWords('en');
  await Promise.resolve();
  assert.ok(!moveCards.isConnected);
  assert.equal(root.querySelector('.tl-check input'), input);
  assert.equal(document.activeElement, input);
  assert.equal(input.selectionStart, 1);
  assert.equal(panel.querySelector('.res'), result);

  // Android Back can leave the input focused and return a shorter viewport while the bar is visible.
  window.innerHeight = 752;
  resize(752);
  advance(2000);
  assert.equal(height(), '780px');
  event('ota-window-insets');
  advance(1000);
  assert.equal(height(), '780px');
  window.innerHeight = 800;
  resize(800);
  advance(2500);
  assert.equal(height(), '');
  assert.equal(panel.style.maxHeight, '');
  assert.equal(document.activeElement, input);

  // Older WebViews only send window resize. Closing the panel or leaving the game clears the hold.
  cleanup();
  delete window.visualViewport;
  cleanup = await tilesGameScreen(root, game.id);
  openCheck();
  window.innerHeight = 400;
  event('resize');
  assert.equal(height(), '780px');
  root.querySelector('.tl-check-panel [data-act=close]').click();
  window.innerHeight = 765;
  event('resize');
  advance(2500);
  assert.equal(height(), '');
  window.innerHeight = 800;
  openCheck();
  assert.equal(height(), '780px');
  cleanup();
  cleanup = null;
  assert.equal(height(), '');
  assert.equal(timers.size, 0);
} finally {
  if (cleanup) cleanup();
  window.close();
}
console.log('4 Tiles check-word cases passed (keyboard resize, repaint, transient navigation bar, legacy resize and cleanup)');
