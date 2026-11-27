// Your name in Settings, first-time joining and online setup (owner, 2026-11-14).
// Run: node tools/test-your-name.mjs (no browser or dependencies).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const stored = new Map();
const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
// Re-run the real settings initialization to cover upgrades and later launches independently.
const init = read('app/js/store.js').split('export const stats')[0].replace(/^import .*;$/gm, '').replace(/export /g, '') + '\nJSON.stringify(settings);';
const boot = saved => {
  stored.clear();
  if (saved) stored.set('wg.settings', JSON.stringify(saved));
  return JSON.parse(runInNewContext(init, { localStorage: storage, navigator: { language: 'en' } }));
};
check('a new install starts unnamed', boot().myName, '');
check('the old Join name is trimmed and migrated', boot({ btName: '  Łucja  ' }).myName, 'Łucja');
check('migration caps names at 16 characters', boot({ btName: '  abcdefghijklmnopq  ' }).myName, 'abcdefghijklmnop');
check('an existing new name wins over the legacy name', boot({ myName: ' Ola ', btName: 'Old' }).myName, 'Ola');
check('a whitespace-only name still takes the legacy name', boot({ myName: '  ', btName: ' Jan ' }).myName, 'Jan');
const migrated = boot({ btName: 'Old', rememberSetupOn: true, rememberSetup: false });
check('migration is persisted', JSON.parse(stored.get('wg.settings')).myName, 'Old');
check('migration preserves other preferences', migrated.rememberSetup, false);
check('clearing the name does not reimport the old one next launch', boot({ ...migrated, myName: '' }).myName, '');
check('a blank legacy name stays blank', boot({ btName: '   ' }).myName, '');

// A small DOM for the real screens: parsed controls, descendant selectors and bubbling events.
const decode = s => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: '\u00a0' }[k]));
class Element {
  constructor(tag = 'div', attrs = '') {
    this.tag = tag;
    this.attrs = Object.fromEntries([...attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m => [m[1], decode(m[2] ?? '')]));
    this.dataset = Object.fromEntries(Object.entries(this.attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
    this.value = this.attrs.value ?? '';
    this.children = []; this.listeners = {}; this.style = {};
    const classes = new Set((this.attrs.class ?? '').split(/\s+/));
    this.classList = { contains: k => classes.has(k), add: k => classes.add(k), remove: k => classes.delete(k), toggle: (k, on) => on ? classes.add(k) : classes.delete(k) };
  }
  set innerHTML(html) {
    this.html = html; this.children = [];
    const stack = [this];
    for (const token of html.match(/<[^>]+>|[^<]+/g) ?? []) {
      if (token.startsWith('</')) { stack.pop(); continue; }
      const m = /^<([\w-]+)\b([^>]*)>/.exec(token);
      if (!m) { stack.at(-1).children.push({ textContent: decode(token) }); continue; }
      const el = new Element(m[1], m[2]);
      el.parent = stack.at(-1); el.parent.children.push(el);
      if (!['input', 'meta', 'br', 'hr', 'img'].includes(el.tag) && !token.endsWith('/>')) stack.push(el);
    }
  }
  get innerHTML() { return this.html; }
  get firstElementChild() { return this.children.find(c => c instanceof Element); }
  get lastChild() { return this.children.at(-1); }
  get textContent() { return this.children.map(c => c.textContent).join(''); }
  set textContent(text) { this.children = [{ textContent: String(text) }]; }
  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.attrs.id === selector.slice(1);
    const m = /^\[([\w-]+)(?:="?([^"\]]+)"?)?\]$/.exec(selector);
    return m ? Object.hasOwn(this.attrs, m[1]) && (m[2] === undefined || this.attrs[m[1]] === m[2]) : selector === this.tag;
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
  querySelectorAll(selector) {
    const matches = el => selector.split(',').some(sel => {
      const parts = sel.trim().split(/\s+/);
      if (!el.matches(parts.pop())) return false;
      let parent = el.parent;
      while (parts.length) { const part = parts.pop(); while (parent && !parent.matches(part)) parent = parent.parent; if (!parent) return false; parent = parent.parent; }
      return true;
    });
    return this.children.flatMap(c => c instanceof Element ? [...(matches(c) ? [c] : []), ...c.querySelectorAll(selector)] : []);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  getBoundingClientRect() { return { left: 0, right: 200 }; }
  async fire(type) {
    const pending = [], event = { target: this, preventDefault() {} };
    for (let el = this; el; el = el.parent) for (const fn of el.listeners[type] ?? []) pending.push(fn(event));
    await Promise.all(pending);
  }
}
globalThis.localStorage = storage;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en' } });
globalThis.window = { addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
let root;
globalThis.document = { documentElement: new Element(), addEventListener() {}, querySelector: sel => root?.querySelector(sel),
  createRange: () => ({ selectNodeContents() {}, getBoundingClientRect: () => ({ left: 0, right: 100 }) }) };
globalThis.getComputedStyle = () => ({ paddingRight: '0', paddingLeft: '0', borderRightWidth: '0', borderLeftWidth: '0' });
globalThis.location = { replace(hash) { this.hash = hash; } };
globalThis.fetch = async path => {
  const bytes = readFileSync(new URL('../app/' + path, import.meta.url));
  return { json: async () => JSON.parse(bytes), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};
const { settings, getSave } = await import('../app/js/store.js');
const { setLang, t } = await import('../app/js/i18n.js');
const { settingsScreen, tilesJoinScreen, tilesNewScreen } = await import('../app/js/screens.js');
const { newGame, loadTileWords } = await import('../app/js/tiles.js');
const { createHost } = await import('../app/js/session.js');
const settle = () => new Promise(resolve => setImmediate(resolve));
const savedName = () => JSON.parse(stored.get('wg.settings')).myName;

for (const lang of ['en', 'pl']) {
  setLang(lang);
  settings.myName = 'Łucja';
  root = new Element();
  await settingsScreen(root, null, () => {});
  check(`${lang}: Your name is in Online`, root.querySelector('[data-section="online"]').querySelector('.row').querySelector('label').textContent, t('set.myName'));
  const input = root.querySelector('#my-name');
  check(`${lang}: migrated name displayed with safe input attributes`, [input.value, input.attrs.maxlength, input.attrs.autocomplete, input.attrs['aria-label']], ['Łucja', '16', 'off', t('set.myName')]);
  input.value = '  Anna Maria  '; await input.fire('input');
  check(`${lang}: saved immediately, trimmed, without interrupting typing`, [settings.myName, savedName(), input.value], ['Anna Maria', 'Anna Maria', '  Anna Maria  ']);
  input.value = 'abcdefghijklmnopq'; await input.fire('input');
  check(`${lang}: save also enforces maximum length`, savedName(), 'abcdefghijklmnop');
  for (const key of ['set.myName', 'set.myNameDesc', 'set.myNamePh', 'net.joinAs', 'net.joinAsChange', 'net.namedOnJoin']) check(`${lang}: translation for ${key}`, t(key) !== key, true);
}

// Join through the real session protocol and a transport stand-in, without opening a browser.
const listeners = new Map(), asks = [];
let host, hello;
window.__netMock = { lan: {
  state: async () => ({ on: true, supported: true }),
  addListener: (event, fn) => { listeners.set(event, fn); return { remove() { listeners.delete(event); } }; },
  search: async () => {}, stopSearch: async () => {}, close: async () => {},
  join: async () => { host.connected('c1', { name: 'Guest phone', address: 'AA' }); return { id: 'c1' }; },
  send: async ({ id, text }) => { if (JSON.parse(text).t === 'hello') hello = JSON.parse(text); host.message(id, text); },
} };
for (const [initial, typed] of [['', '  Kasia  '], ['<Ada & Jan>', null], ['', null]]) {
  const expected = initial || typed?.trim() || '';
  setLang('en');
  settings.myName = initial; settings.btName = 'Unused legacy name';
  root = new Element();
  const cleanup = tilesJoinScreen(root, 'lan');
  await settle();
  check('Join removes the old name field', root.querySelector('#bt-name'), null);
  if (initial) {
    check('Join shows escaped bold name', root.querySelector('strong').textContent, initial);
    check('named Join links to Settings', root.querySelector('[href="#/settings"]').textContent, t('net.joinAsChange'));
    check('named Join has no name input', root.querySelector('#my-name'), null);
  } else {
    const input = root.querySelector('#my-name');
    if (typed) {
      input.value = typed; await input.fire('input');
      check('first Join saves the same name setting immediately', [settings.myName, savedName()], [expected, expected]);
    }
  }
  const dict = await loadTileWords('en');
  const setup = { lang: 'en', players: [{ name: 'Host' }, { name: '' }], first: 0, seed: 11, words: dict.tag };
  host = createHost({ players: 2, game: () => ({ id: 'joined', title: 'Game', setup, log: [] }), take: () => false,
    send: (id, text) => listeners.get('message')({ id, text }), drop() {},
    onChange: c => { if (c.name) setup.players[c.seat].name = c.name; }, onAsk: a => { if (a) { asks.push(a); host.letIn(a.conn); } } });
  listeners.get('found')({ address: 'AA', name: 'Host phone' });
  await root.querySelector('[data-address="AA"]').fire('click');
  // The screen's click handler starts joining asynchronously; allow its dictionary load and handoff to finish.
  await settle();
  check('hello carries Your name', hello.name, expected);
  check('host receives the saved name and the device identity even when unnamed', [asks.at(-1).name, asks.at(-1).device], [expected, 'Guest phone']);
  check('joined game receives its own seat and name', [getSave('joined').link.me, getSave('joined').state.players[1].name], [1, expected]);
  check('joining leaves the legacy setting untouched', settings.btName, 'Unused legacy name');
  cleanup();
}

// Online setup retains the host object through edits, swaps, removal and choosing who starts.
settings.lang = 'en'; settings.newGame = { lang: 'en' }; settings.rememberSetup = true;
settings.myName = 'Host'; settings.setup = {};
root = new Element();
tilesNewScreen(root, null, () => {}, 'lan');
check('online host starts with Your name', root.querySelector('[data-name="0"]').value, 'Host');
check('online guests have default names and no name inputs', [root.querySelectorAll('[data-name]').length, root.querySelector('.tl-players').textContent.includes('Player 2'), root.querySelector('.tl-players').textContent.includes(t('net.namedOnJoin'))], [1, true, true]);
const edited = root.querySelector('[data-name="0"]');
edited.value = 'For this game'; await edited.fire('input');
await root.querySelector('[data-add]').fire('click');
await root.querySelector('[data-down="0"]').fire('click');
check('moving the host moves its editable row', root.querySelector('[data-name="1"]').value, 'For this game');
await root.querySelector('[data-first="1"]').fire('click');
await root.querySelector('[data-rm="0"]').fire('click');
check('removing another row keeps the host and chosen starter', [root.querySelector('[data-name="0"]').value, root.querySelector('[data-first="0"]').classList.contains('on')], ['For this game', true]);
await root.querySelector('[data-down="0"]').fire('click');
await root.querySelector('form').fire('submit');
const online = getSave(location.hash.split('/').at(-1));
check('saved game keeps the moved host seat, starter and empty remote name', [online.link.me, online.state.start.first, online.state.players.map(x => x.name)], [1, 1, ['', 'For this game']]);
settings.myName = 'Next game';
check('changing Settings does not rename an existing game', online.state.players[1].name, 'For this game');

settings.setup.tiles = { board: 'classic', players: [{ name: 'Own name', cpu: null }, { name: 'Friend', cpu: null }], first: 1 };
root = new Element(); tilesNewScreen(root, null, () => {}, 'lan');
check('online host keeps an existing setup name', root.querySelector('[data-name="0"]').value, 'Own name');
await root.querySelector('form').fire('submit');
check('remembered remote names are cleared for online games', getSave(location.hash.split('/').at(-1)).state.players.map(x => x.name), ['Own name', '']);
root = new Element(); tilesNewScreen(root, null, () => {});
check('local games keep both editable player names', root.querySelectorAll('[data-name]').map(x => x.value), ['Own name', 'Friend']);
await root.querySelector('form').fire('submit');
const local = getSave(location.hash.split('/').at(-1));
check('local game names and chosen starter are unchanged', [local.state.players.map(x => x.name), local.state.start.first, local.link], [['Own name', 'Friend'], 1, undefined]);

// Setup labels number the displayed seats, including bots (owner, 2026-11-26).
for (const [lang, label] of [['en', 'Player'], ['pl', 'Gracz']]) {
  setLang(lang);
  settings.setup.tiles = { board: 'classic', players: [{ name: 'Ada', cpu: null }, { name: 'Bot', cpu: 'medium' }] };
  root = new Element();
  tilesNewScreen(root, null, () => {});
  const seats = () => root.querySelectorAll('.tl-seat').map(seat => [seat.firstElementChild.textContent, seat.querySelector('.tl-prow input').value]);
  check(`${lang}: both players have numbered labels above their boxes`, seats(), [[label + ' 1', 'Ada'], [label + ' 2', 'Bot']]);
  await root.querySelector('[data-add]').fire('click');
  check(`${lang}: adding a bot labels the third box`, seats(), [[label + ' 1', 'Ada'], [label + ' 2', 'Bot'], [label + ' 3', '']]);
  await root.querySelector('[data-down="0"]').fire('click');
  check(`${lang}: reordering updates the numbers attached to each player`, seats(), [[label + ' 1', 'Bot'], [label + ' 2', 'Ada'], [label + ' 3', '']]);
  await root.querySelector('[data-rm="0"]').fire('click');
  check(`${lang}: removing the first player renumbers the remaining seats`, seats(), [[label + ' 1', 'Ada'], [label + ' 2', '']]);
}
console.log(`all ${passed} your-name tests passed`);
