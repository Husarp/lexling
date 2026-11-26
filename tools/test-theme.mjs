// Palettes before first paint, live system changes and the Settings / in-game controls.
// Run: node tools/test-theme.mjs (no browser or dependencies).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

// Only the DOM operations used by the settings controls; run the actual rendering and click handlers.
class Element {
  constructor(attrs = '') {
    this.attrs = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    this.dataset = Object.fromEntries(Object.entries(this.attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase()), v]));
    const classes = new Set((this.attrs.class || '').split(/\s+/));
    this.classList = { contains: k => classes.has(k), toggle: (k, on) => on ? classes.add(k) : classes.delete(k) };
    this.listeners = {};
    this.value = this.attrs.value ?? '';
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.firstElementChild = this;
  }
  set innerHTML(html) { this.html = html; this.buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(m => new Element(m[1])); this.inputs = [...html.matchAll(/<input\b([^>]*)>/g)].map(m => new Element(m[1])); }
  get innerHTML() { return this.html; }
  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.attrs.id === selector.slice(1);
    const m = /^\[([\w-]+)(?:="?([^"\]]+)"?)?\]$/.exec(selector);
    return !!m && (m[2] === undefined ? Object.hasOwn(this.attrs, m[1]) : this.attrs[m[1]] === m[2]);
  }
  closest(selector) { return this.matches(selector) ? this : null; }
  querySelectorAll(selector) { return [...(this.buttons || []), ...(this.inputs || [])].filter(b => selector.split(',').some(s => b.matches(s.trim()))); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  fire(target = this, type = 'click') { for (const fn of this.listeners[type] ?? []) fn({ target }); }
  showModal() { this.open = true; }
}
const stored = new Map([['wg.settings', JSON.stringify({ theme: 'system', accent: 'blue', rememberSetupOn: true })]]);
globalThis.localStorage = { getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v) };
const media = { matches: false, addEventListener(type, fn) { this.change = fn; } };
globalThis.matchMedia = () => media;
globalThis.window = { addEventListener() {} };
const html = new Element(), meta = {};
let lastDialog;
globalThis.document = { documentElement: html, querySelector: () => meta, addEventListener() {}, createRange: () => ({}),
  createElement: () => (lastDialog = new Element()), body: { append() {} } };
const { settings } = await import('../app/js/store.js');
const { PALETTES, applyTheme, applyAccent, wireGear } = await import('../app/js/ui.js');
const { t, setLang } = await import('../app/js/i18n.js');
check('old settings get Classic and retain the saved theme and accent', [settings.palette, settings.theme, settings.accent], ['classic', 'system', 'blue']);
check('old settings get rating-only move details and default rarity limits', [settings.tilesUnder, settings.tilesRareTiers], ['rating', [1, 5, 20]]);
check('five whole palettes are offered', Object.keys(PALETTES), ['classic', 'paper', 'ocean', 'forest', 'contrast']);
applyAccent();
const accent = html.style['--accent'];

const bootstrap = read('app/index.html').match(/<script>([\s\S]*?)<\/script>/)[1].split('// Tablets')[0];
function startup(raw, light, blocked = false) {
  const root = { dataset: {}, style: {} }, bar = {};
  runInNewContext(bootstrap, { localStorage: { getItem() { if (blocked) throw Error('blocked'); return raw; } },
    matchMedia: () => ({ matches: light }), document: { documentElement: root, querySelector: () => bar } });
  return [root.dataset.theme, root.dataset.palette, root.style.backgroundColor, bar.content];
}
for (const palette of Object.keys(PALETTES)) for (const theme of ['dark', 'light', 'system']) for (const light of [false, true]) {
  const effective = theme === 'system' ? light ? 'light' : 'dark' : theme;
  const expected = [effective, palette, PALETTES[palette][effective], PALETTES[palette][effective]];
  check(`${palette}/${theme}/${light}: correct before CSS loads`, startup(JSON.stringify({ palette, theme }), light), expected);
  Object.assign(settings, { palette, theme });
  media.matches = light;
  applyTheme();
  check(`${palette}/${theme}/${light}: runtime matches first paint`, [html.dataset.theme, html.dataset.palette, html.style.backgroundColor, meta.content], expected);
}
for (const raw of [null, '{broken', '{}', 'null', '{"palette":"unknown","theme":"unknown"}', '{"palette":"constructor"}']) {
  check('missing or invalid settings launch as Classic dark', startup(raw, false), ['dark', 'classic', '#000000', '#000000']);
}
check('blocked storage still sets first-paint defaults', startup(null, false, true), ['dark', 'classic', '#000000', '#000000']);
settings.palette = undefined;
settings.theme = 'light';
applyTheme();
check('missing runtime palette falls back to Classic', [html.dataset.palette, meta.content], ['classic', '#F5F5F5']);
settings.palette = 'forest'; settings.theme = 'system';
media.matches = false; media.change();
check('system change to dark retains the palette', [html.dataset.theme, meta.content], ['dark', PALETTES.forest.dark]);
media.matches = true; media.change();
check('system change to light retains the palette', [html.dataset.theme, meta.content], ['light', PALETTES.forest.light]);
settings.theme = 'dark'; media.change();
check('explicit dark ignores a light system', html.dataset.theme, 'dark');
check('theme and palette switches preserve the accent', html.style['--accent'], accent);

// The shared gear used by Guess, Letters and Connect: tap a real rendered choice and observe the callback.
const game = new Element();
game.innerHTML = '<button class="gs-open"></button>';
let changed;
wireGear(game, 'guess', [], key => { changed = [key, html.dataset.theme, meta.content]; });
game.fire(game.buttons[0]);
const dlg = lastDialog;
check('gear has Sound, then all three theme choices', dlg.buttons.filter(b => b.dataset.key).map(b => [b.dataset.key, b.dataset.v]),
  [['sound', undefined], ['theme', 'dark'], ['theme', 'light'], ['theme', 'system']]);
for (const theme of ['light', 'dark', 'system']) {
  const button = dlg.buttons.find(b => b.dataset.v === theme);
  dlg.fire(button);
  const effective = theme === 'system' ? 'light' : theme;
  check('theme is applied before the game callback', changed, ['theme', effective, PALETTES.forest[effective]]);
  check('in-game choice is saved', JSON.parse(stored.get('wg.settings')).theme, theme);
  check('only the chosen theme is marked on', dlg.buttons.filter(b => b.dataset.key === 'theme' && b.classList.contains('on')).map(b => b.dataset.v), [theme]);
}

globalThis.fetch = async () => ({ json: async () => ({ counts: { pl: 60000, en: 41158 }, dims: 1 }) });
const { settingsScreen } = await import('../app/js/screens.js');
for (const lang of ['en', 'pl']) {
  setLang(lang);
  const root = new Element();
  let refreshes = 0;
  await settingsScreen(root, null, () => { refreshes++; });
  check(`${lang}: Tiles controls are grouped in Games`, root.innerHTML.split('data-section="games"')[1].split('</details>')[0].includes('data-k="tilesUnder"'), true);
  for (const key of ['tiles.under', 'tiles.underHelp', 'tiles.under.rating', 'tiles.under.rarity', 'tiles.under.both', 'set.rareTiers', 'set.rareTiersHelp', 'set.rareReset', 'tiles.rare.tier.purple', 'tiles.rare.tier.gold', 'tiles.rare.tier.blue']) check(`${lang}: ${key} is translated`, t(key) !== key, true);
  for (const key of ['general', 'games', 'display', 'time', 'online', 'about']) {
    check(`${lang}: ${key} category has a translated heading`, t('set.section.' + key) !== 'set.section.' + key && root.innerHTML.includes(t('set.section.' + key)), true);
  }
  const theme = settings.theme;
  for (const value of ['rarity', 'both', 'rating']) {
    const before = refreshes;
    root.querySelectorAll('[data-k="tilesUnder"]').find(b => b.dataset.v === value).fire();
    check(`${lang}: move detail choice persists and refreshes without changing theme`, [settings.tilesUnder, JSON.parse(stored.get('wg.settings')).tilesUnder, refreshes, settings.theme], [value, value, before + 1, theme]);
  }
  const inputs = root.querySelectorAll('[data-rare-tier]');
  check(`${lang}: three integer percentage inputs have translated accessible labels`, inputs.map(i => [i.attrs.min, i.attrs.max, i.attrs.step, i.attrs['aria-label']]), ['purple', 'gold', 'blue'].map(tier => ['1', '100', '1', t('tiles.rare.tier.' + tier)]));
  check(`${lang}: rarity help includes both vocabulary sizes`, root.innerHTML.includes(t('set.rareTiersHelp', { pl: '60 000', en: '41 158' })), true);
  const persisted = () => JSON.parse(stored.get('wg.settings')).tilesRareTiers;
  for (const [values, expected] of [[[2, 10, 40], [2, 10, 40]], [[2, 2, 40], [1, 5, 20]], [[0, 5, 20], [1, 5, 20]], [[1, 5, 101], [1, 5, 20]], [[1, 5.5, 20], [1, 5, 20]], [['', 5, 20], [1, 5, 20]], [[20, 50, 100], [20, 50, 100]]]) {
    inputs.forEach((input, i) => { input.value = String(values[i]); });
    inputs[0].fire(inputs[0], 'change');
    check(`${lang}: changing limits persists and displays cleaned values`, [persisted(), inputs.map(i => +i.value)], [expected, expected]);
  }
  root.querySelector('#rare-reset').fire();
  check(`${lang}: Reset restores and shows 1 / 5 / 20`, [persisted(), inputs.map(i => +i.value)], [[1, 5, 20], [1, 5, 20]]);
  settings.tilesRareTiers = [99, 2, 0];
  const old = new Element();
  await settingsScreen(old, null, () => {});
  check(`${lang}: corrupt saved limits are cleaned before rendering`, old.querySelectorAll('[data-rare-tier]').map(i => +i.value), [1, 5, 20]);
  const buttons = root.querySelectorAll('[data-palette-choice]');
  check(`${lang}: every palette has its translated accessible name`, buttons.map(b => b.attrs['aria-label']), Object.keys(PALETTES).map(id => t('palette.' + id)));
  check(`${lang}: Colours follows Theme and precedes Accent`, root.innerHTML.indexOf(t('set.theme')) < root.innerHTML.indexOf(t('set.paletteDesc')) && root.innerHTML.indexOf(t('set.paletteDesc')) < root.innerHTML.indexOf(t('set.accentDesc')), true);
  for (const button of buttons) {
    button.fire();
    const id = button.dataset.paletteChoice;
    check(`${lang}: palette tap applies and persists`, [html.dataset.palette, meta.content, JSON.parse(stored.get('wg.settings')).palette], [id, PALETTES[id].light, id]);
    check(`${lang}: one palette marked on and pressed`, buttons.filter(b => b.classList.contains('on') && b.attrs['aria-pressed'] === 'true').map(b => b.dataset.paletteChoice), [id]);
  }
}

// Catch drift among the first-paint/runtime table and the actual CSS, and check board/text contrast numerically.
const css = read('app/css/app.css');
const tokens = selector => {
  const rule = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(m => m[1].split(',').some(s => s.trim() === selector));
  assert.ok(rule, selector);
  return Object.fromEntries([...rule[2].matchAll(/(--[\w-]+):([^;]+);/g)].map(m => [m[1], m[2].trim()]));
};
const luminance = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
for (const [theme, selector] of [['dark', ':root'], ['light', '[data-theme="light"]']]) {
  const tok = tokens(selector);
  for (const tier of ['purple', 'gold', 'blue', 'grey']) check(`${theme}: ${tier} rarity chip has readable ink on its soft background`, ratio(tok[`--rare-${tier}-ink`], tok[`--rare-${tier}-bg`]) >= 4.5, true);
}
for (const id of ['paper', 'ocean', 'forest', 'contrast']) for (const theme of ['dark', 'light']) {
  const tok = tokens(`[data-palette=${id}]${theme === 'light' ? '[data-theme=light]' : ':not([data-theme=light])'}`);
  check(`${id}/${theme}: CSS matches the startup background`, tok['--bg'], PALETTES[id][theme]);
  check(`${id}/${theme}: all page and board tokens exist`, ['bg', 'surface', 'surface-2', 'line', 'line-soft', 'text', 'text-muted', 'text-dim', 'tb-sq', 'tb-grid', 'tb-lbl', 'lt-empty', 'lt-edge'].every(k => tok['--' + k]), true);
  check(`${id}/${theme}: page text and board labels are readable`, ratio(tok['--text'], tok['--bg']) >= 7 && ratio(tok['--tb-lbl'], tok['--tb-sq']) >= 4.5, true);
  if (id === 'contrast') check(`${theme}: high contrast muted text and boundaries`, ratio(tok['--text-dim'], tok['--surface-2']) >= 4.5 && ratio(tok['--line-soft'], tok['--surface-2']) >= 3, true);
}
console.log(`all ${passed} theme tests passed`);
