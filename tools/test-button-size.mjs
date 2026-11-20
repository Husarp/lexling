// Shared Button size controls, immediate application and persistence (owner, 2026-11-20).
// Run: node tools/test-button-size.mjs (DOM stand-ins; no browser layout engine).
import assert from 'node:assert/strict';
let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
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

const stored = new Map([['wg.settings', JSON.stringify({ lang: 'en', rememberSetupOn: true })]]);
globalThis.localStorage = { getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v) };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.window = { addEventListener() {} };
const html = new Element();
globalThis.document = { documentElement: html, addEventListener() {}, createRange: () => ({}) };
globalThis.fetch = async () => ({ json: async () => ({ counts: { pl: 60000, en: 41158 }, dims: 1 }) });
const { settings } = await import('../app/js/store.js');
const { applyButtonSize, settingRows, wireSettingRows } = await import('../app/js/ui.js');
const { t, setLang } = await import('../app/js/i18n.js');
const { settingsScreen } = await import('../app/js/screens.js');
check('old saves default to 100%', settings.buttonSize, '100');
applyButtonSize();
check('default CSS scale', html.style['--button-scale'], 1);
for (const lang of ['en', 'pl']) {
  setLang(lang);
  check('translated label', t('set.buttonSize'), lang === 'en' ? 'Button size' : 'Rozmiar przycisków');
  const root = new Element();
  await settingsScreen(root, null, () => {});
  const display = root.innerHTML.split('data-section="display"')[1].split('</details>')[0];
  check('Appearance offers the label and four steps', display.includes(t('set.buttonSize')) && root.querySelectorAll('[data-k="buttonSize"]').length === 4, true);
  for (const size of ['100', '115', '130', '150']) {
    root.querySelectorAll('[data-k="buttonSize"]').find(b => b.dataset.v === size).fire();
    check(`${lang}/${size}: Settings persists`, JSON.parse(stored.get('wg.settings')).buttonSize, size);
    check(`${lang}/${size}: Settings applies immediately`, html.style['--button-scale'], +size / 100);
    // The same row renderer and click wiring used by Tiles Options.
    const options = new Element();
    options.innerHTML = settingRows([['buttonSize', t('set.buttonSize'), '', ['100', '115', '130', '150'].map(v => [v, t('set.buttonSizePercent', { n: v })])]]);
    wireSettingRows(options);
    check(`${lang}/${size}: Options reflects Settings`, options.querySelectorAll('.on').map(b => b.dataset.v), [size]);
    const next = size === '150' ? '100' : '150';
    options.fire(options.querySelectorAll('[data-key="buttonSize"]').find(b => b.dataset.v === next));
    check(`${lang}/${size}: Options persists and applies`, [JSON.parse(stored.get('wg.settings')).buttonSize, html.style['--button-scale']], [next, +next / 100]);
    await settingsScreen(root, null, () => {});
    check(`${lang}/${size}: Settings reflects Options`, root.querySelectorAll('[data-k="buttonSize"]').filter(b => b.classList.contains('on')).map(b => b.dataset.v), [next]);
    const reloaded = await import(`../app/js/store.js?button-size-${lang}-${size}`);
    check(`${lang}/${size}: fresh store restores the preference`, reloaded.settings.buttonSize, next);
  }
}
for (const invalid of [undefined, 'bad', '200', 0]) {
  settings.buttonSize = invalid;
  applyButtonSize();
  check('invalid stored size falls back safely', html.style['--button-scale'], 1);
}
console.log(`all ${passed} button size tests passed`);
