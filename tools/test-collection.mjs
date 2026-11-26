// Collection language totals and category details (owner, 2026-11-26).
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<div id="root"></div>', { url: 'https://lexling.test/' });
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage,
  getComputedStyle: window.getComputedStyle.bind(window), matchMedia: () => ({ matches: false, addEventListener() {} }),
  ResizeObserver: class { observe() {} disconnect() {} } });
window.HTMLCanvasElement.prototype.getContext = () => ({ scale() {}, beginPath() {}, rect() {}, fill() {} });

const words = { pl: ['bar', 'kot', 'żółw'], en: ['cat', 'bar', 'dogs', 'apple'] };
let releasePolish;
const polishReady = new Promise(resolve => { releasePolish = resolve; });
globalThis.fetch = async path => {
  const [, lang, file] = path.split('/');
  if (lang === 'pl') await polishReady;
  if (file === 'vocab.json') {
    const secret = words[lang].map((_, i) => i);
    return Response.json({ lang, words: words[lang], secret, hard: { idx: [], score: [] },
      cats: lang === 'en' ? { food: [3] } : {}, posNames: ['noun'], pos: secret.map(() => 0) });
  }
  return new Response(file === 'pool.json' ? '{"drop":[]}' : '');
};

const { collectionScreen } = await import('../app/js/screens.js');
const { collect, settings } = await import('../app/js/store.js');
const { setLang, t } = await import('../app/js/i18n.js');
settings.lang = 'en';
setLang('en');
for (const [mode, lang, word] of [['guess', 'pl', 'bar'], ['guess', 'en', 'cat'], ['guess', 'en', 'dogs'],
  ['connect', 'pl', 'kot'], ['connect', 'en', 'cat']]) collect(mode, lang, word, { mode });

const root = document.querySelector('#root');
const $ = selector => root.querySelector(selector);
let rendering;
const render = () => rendering = collectionScreen(root, null, render);
const click = async selector => { $(selector).click(); await rendering; };
const count = selector => $(selector).textContent.split(' · ')[0];

const english = render();
assert.equal($('.co-lang .on').dataset.clang, 'en');
$('[data-clang=all]').click();
await english;
assert.ok($('.co-loading'), 'The older English load cannot replace the pending Both view');
releasePolish();
await rendering;
assert.equal($('.co-lang .on').textContent, 'Both');
assert.equal($('.co-hero .co-line').textContent, '4 of the 7 words the games can hide');
assert.equal($('.co-pct').textContent, '57%');
assert.equal(count('[data-ctab-go=guess] .co-count'), '3 / 7');
assert.equal(count('[data-ctab-go=connect] .co-count'), '2 / 7');

for (const [lang, label] of [['en', 'Both'], ['pl', 'Oba']]) {
  setLang(lang);
  await render();
  assert.equal($('[data-clang=all]').textContent, label);
  const tabs = [...root.querySelectorAll('[role=tab]')];
  assert.deepEqual(tabs.map(tab => [tab.getAttribute('aria-label'), tab.textContent, !!tab.querySelector('svg')]),
    ['col.all', 'mode.guess', 'mode.letters', 'mode.connect'].map(key => [t(key), '', true]));
}
setLang('en');
await click('[data-ctab-go=guess]');
assert.equal(count('[data-ccat=all] .co-count'), '3 / 7');
assert.equal(count('[data-ccat=food] .co-count'), '0 / 1');
await click('[data-ccat=all]');
assert.equal(count('.co-cat .co-line'), '3 / 7');
assert.equal($('.co-lenhead span').textContent, '2 of 4 found');
assert.deepEqual([...root.querySelectorAll('.co-w')].map(w => w.textContent), ['bar', 'cat']);
await click('[data-clen="4"]');
assert.equal($('.co-lenhead span').textContent, '1 of 2 found');
assert.equal($('.co-w').textContent, 'dogs');
await click('[data-ctab=connect]');
assert.equal(count('[data-ccat="3"] .co-count'), '2 / 4');
await click('[data-ccat="3"]');
assert.deepEqual([...root.querySelectorAll('.co-w')].map(w => w.textContent), ['kot', 'cat']);
await click('[data-clang=pl]');
assert.equal(count('[data-ccat="3"] .co-count'), '1 / 2');
await click('[data-clang=en]');
assert.equal(count('[data-ccat="3"] .co-count'), '1 / 2');
window.close();
console.log('Collection tabs, language totals and details passed');
