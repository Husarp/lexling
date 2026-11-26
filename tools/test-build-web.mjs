import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { buildWeb } from '../scripts/build-web.mjs';
import { appVersion } from '../scripts/ota-config.mjs';
import { checkWebView } from '../scripts/webview-compat.mjs';

const app = fileURLToPath(new URL('../app/', import.meta.url));
const temp = new URL('../.local/', import.meta.url);
await mkdir(temp, { recursive: true });
const root = await mkdtemp(join(fileURLToPath(temp), 'build-web-'));
const output = join(root, 'first');
const copy = join(root, 'second');
let passed = 0;
async function test(name, run) {
  try { await run(); passed++; }
  catch (error) { throw new Error(name, { cause: error }); }
}

async function files(dir, skipSourceScripts = false) {
  const names = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skipSourceScripts && entry.name === 'js') continue;
    if (entry.isDirectory()) names.push(...(await files(join(dir, entry.name))).map(name => entry.name + '/' + name));
    else names.push(entry.name);
  }
  return names.sort();
}

const newApis = [
  'globalThis', 'Object.hasOwn', 'Object.fromEntries', 'Array.prototype.at', 'Array.prototype.flat', 'Array.prototype.flatMap',
  'Array.prototype.findLast', 'Array.prototype.findLastIndex', 'String.prototype.matchAll', 'Element.prototype.replaceChildren',
  'Element.prototype.toggleAttribute', 'Promise.prototype.finally', 'ResizeObserver',
];
const deleteNewApis = newApis.map(api => `delete ${api};`).join('\n');
const compat = await readFile(join(app, 'js/compat.js'), 'utf8');

try {
  await test('recreates the output and writes the exact classic HTML entry', async () => {
    await mkdir(output);
    await writeFile(join(output, 'stale.txt'), 'stale');
    await buildWeb(output);
    const original = await readFile(join(app, 'index.html'), 'utf8');
    const html = await readFile(join(output, 'index.html'), 'utf8');
    assert.equal(html, original.replace('type="module" src="js/main.js"', 'src="js/main.js"'));
    const { window } = new JSDOM(html);
    try {
      const scripts = [...window.document.scripts];
      assert.deepEqual(scripts.map(script => script.getAttribute('src')), ['js/compat.js', 'js/boot.js', null, 'js/main.js']);
      assert.equal(scripts[2].parentElement, window.document.head);
      assert.match(scripts[2].textContent, /Object\.hasOwn/);
      assert.equal(scripts[3], window.document.body.lastElementChild);
      assert.ok(scripts.every(script => script.type !== 'module'));
    } finally { window.close(); }
    assert.ok(!(await readdir(output)).includes('stale.txt'));
    await assert.rejects(buildWeb(app), /output overlaps app/);
  });
  await test('ships only the three classic scripts and passes Chrome 60 verification', async () => {
    await checkWebView(output);
    assert.deepEqual(await files(join(output, 'js')), ['boot.js', 'compat.js', 'main.js']);
    assert.match(await readFile(join(output, 'js/main.js'), 'utf8'), /^"use strict";/);
    for (const name of ['js/compat.js', 'js/boot.js']) {
      assert.deepEqual(await readFile(join(output, name)), await readFile(join(app, name)), name);
    }
  });
  await test('copies every static asset byte for byte', async () => {
    const assets = await files(app, true);
    const builtAssets = (await files(output)).filter(name => !name.startsWith('js/'));
    assert.deepEqual(builtAssets, assets);
    for (const name of assets) {
      if (name !== 'index.html') assert.deepEqual(await readFile(join(output, name)), await readFile(join(app, name)), name);
    }
  });
  await test('produces byte-identical output in a different directory', async () => {
    await buildWeb(copy);
    const names = await files(output);
    assert.deepEqual(await files(copy), names);
    for (const name of names) assert.deepEqual(await readFile(join(copy, name)), await readFile(join(output, name)), name);
  });
  await test('restores missing APIs in a VM and supports their use', async () => {
    const { window } = new JSDOM('');
    try {
      const context = createContext({ Element: window.Element, document: window.document, assert });
      runInContext(`window = this; ${deleteNewApis}\n${compat}`, context);
      runInContext(`
        assert.equal(globalThis, window);
        assert.equal(Object.hasOwn({x: 1}, 'x'), true);
        assert.equal(Object.hasOwn({x: 1}, 'toString'), false);
        const obj = Object.fromEntries([['__proto__', 7]]);
        assert.equal(obj.__proto__, 7);
        assert.equal(Object.getPrototypeOf(obj), Object.prototype);
        assert.equal([1, 2].at(-1), 2);
        assert.equal([1].at(1), undefined);
        assert.equal([1, , [2, [3]]].flat(2).join(','), '1,2,3');
        assert.equal([1, , 2].flatMap(x => [x, x]).join(','), '1,1,2,2');
        assert.equal([1, 2, 3].findLast(x => x % 2), 3);
        assert.equal([1, 2, 3].findLastIndex(x => x % 2), 2);
        const rx = /a(.)/g;
        rx.lastIndex = 2;
        assert.equal([...('ab ac ad'.matchAll(rx))].map(m => m[1]).join(','), 'c,d');
        assert.equal(rx.lastIndex, 2);
        assert.equal([...('😀'.matchAll(/(?:)/gu))].map(m => m.index).join(','), '0,2');
        assert.throws(() => 'a'.matchAll(/a/), /global RegExp/);
        const node = document.createElement('div');
        const child = document.createElement('span');
        node.append(child);
        node.replaceChildren('text', child, 3);
        assert.equal(node.innerHTML, 'text<span></span>3');
        assert.equal(node.toggleAttribute('hidden', true), true);
        assert.equal(node.toggleAttribute('hidden'), false);
        assert.equal(node.hasAttribute('hidden'), false);
      `, context);
      assert.equal(await runInContext('Promise.resolve(12).finally(() => 0)', context), 12);
      await assert.rejects(runInContext('Promise.reject(Error("original")).finally(() => {})', context), /original/);
      await assert.rejects(runInContext('Promise.resolve().finally(() => { throw Error("cleanup"); })', context), /cleanup/);
    } finally { window.close(); }
  });
  await test('ResizeObserver fallback observes, updates and disconnects', () => {
    const { window } = new JSDOM('');
    try {
      let pending;
      window.requestAnimationFrame = fn => { pending = fn; return 1; };
      window.cancelAnimationFrame = () => { pending = null; };
      const context = createContext({
        Element: window.Element, document: window.document,
        requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame,
        addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window),
      });
      runInContext(`window = this; ${compat}`, context);
      const target = window.document.body;
      const calls = [];
      const Observer = runInContext('ResizeObserver', context);
      const observer = new Observer(entries => calls.push(entries[0]));
      observer.observe(target);
      pending();
      assert.equal(calls[0].target, target);
      assert.equal(calls[0].contentRect.width, target.getBoundingClientRect().width);
      window.dispatchEvent(new window.Event('resize'));
      pending();
      window.dispatchEvent(new window.Event('orientationchange'));
      pending();
      assert.equal(calls.length, 3);
      observer.unobserve(target);
      window.dispatchEvent(new window.Event('resize'));
      assert.equal(pending, null);
      observer.observe(target);
      observer.disconnect();
      assert.equal(pending, null);
    } finally { window.close(); }
  });
  await test('preserves native implementations', () => {
    const { window } = new JSDOM('');
    try {
      const context = createContext({ Element: window.Element, ResizeObserver: class NativeObserver {}, assert });
      runInContext(`
        window = this;
        const natives = [${newApis}];
        ${compat}
        [${newApis}].forEach((api, index) => assert.equal(api, natives[index]));
      `, context);
    } finally { window.close(); }
  });
  await test('the built app draws its menu with Chrome 60 APIs absent', async () => {
    const html = await readFile(join(output, 'index.html'), 'utf8');
    const { window } = new JSDOM(html, { url: 'https://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
    try {
      const { document } = window;
      window.eval(deleteNewApis + '\ndelete window.AbortController;');
      window.RegExp = new Proxy(window.RegExp, {
        construct(target, args) {
          if (String(args[0]).includes('\\p{')) throw new SyntaxError('Unicode properties unavailable');
          return Reflect.construct(target, args);
        },
      });
      window.localStorage.setItem('wg.settings', JSON.stringify({ updateCheck: false, lang: 'pl' }));
      document.fonts = { load: async () => [] };
      let themeListener;
      window.MediaQueryList = class {
        get matches() { return false; }
        addListener(listener) { themeListener = listener; }
      };
      window.matchMedia = () => new window.MediaQueryList();
      window.scrollTo = () => {};
      window.Element.prototype.animate = () => {};
      window.Range.prototype.getBoundingClientRect = () => ({ left: 0, right: 0 });
      const diagnostics = [];
      window.console.info = message => diagnostics.push(message);
      window.console.error = message => diagnostics.push(message);
      for (const script of document.scripts) {
        const src = script.getAttribute('src');
        window.eval(src ? await readFile(join(output, src), 'utf8') : script.textContent);
      }
      await window.LXStartup.bounded('Draw the menu', () => new Promise(resolve => {
        const watch = new window.MutationObserver(() => {
          if (document.documentElement.dataset.ready) { watch.disconnect(); resolve(); }
        });
        watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ready'] });
        if (document.documentElement.dataset.ready) { watch.disconnect(); resolve(); }
      }), 2000);
      assert.equal(document.documentElement.dataset.ready, appVersion());
      assert.equal(document.documentElement.lang, 'pl');
      assert.ok(document.querySelector('[data-screen="menu"]'));
      assert.equal(typeof themeListener, 'function');
      assert.deepEqual(diagnostics, ['LXStartup: Loading app scripts', 'LXStartup: Fonts loaded', 'LXStartup: First screen drawn']);
    } finally { window.close(); }
  });
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log(`${passed} tests passed`);
