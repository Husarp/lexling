import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<div id="root"></div>', { url: 'https://lexling.test/' });
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage,
  getComputedStyle: window.getComputedStyle.bind(window), matchMedia: () => ({ matches: false, addEventListener() {} }) });
window.Range.prototype.getBoundingClientRect = () => ({ left: 0, right: 0 });
let release;
const loading = new Promise(resolve => { release = resolve; });
globalThis.fetch = async path => {
  await loading;
  return new Response(readFileSync(new URL('../app/' + path, import.meta.url)));
};

const { settings } = await import('../app/js/store.js');
const { newGameScreen } = await import('../app/js/screens.js');
settings.newGame = { lang: 'en' };
const root = document.querySelector('#root');
const open = () => newGameScreen(root, null, () => {});

open();
root.innerHTML = '<p>Games</p>';
release();
await setImmediate();
assert.equal(root.textContent, 'Games');

open();
root.innerHTML = '<div id="hist">other bars</div><div id="readout">other readout</div>';
await setImmediate();
assert.equal(root.querySelector('#hist').textContent, 'other bars');
assert.equal(root.querySelector('#readout').textContent, 'other readout');

open();
await setImmediate();
assert.match(root.querySelector('#readout .num').textContent, /^\d/);
console.log('Guess histogram draws only on its own screen');
