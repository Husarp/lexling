import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('', { url: 'https://lexling.test/' });
for (const key of ['window', 'document', 'navigator', 'localStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: window[key] });
}
Object.defineProperty(navigator, 'language', { value: 'pl-PL' });
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };

const { settings } = await import('../app/js/store.js');
const { chooseFirstLanguage } = await import('../app/js/screens.js');
const { getLang } = await import('../app/js/i18n.js');

assert.equal(settings.lang, 'pl');
assert.equal(settings.langChosen, false);
let refreshes = 0;
chooseFirstLanguage(() => { refreshes++; });
const dialog = document.querySelector('dialog[open]');
assert.deepEqual([...dialog.querySelectorAll('h2 span')].map(span => span.textContent),
  ['Choose your language', 'Wybierz język']);
assert.deepEqual([...dialog.querySelectorAll('button')].map(button => button.textContent), ['Polski', 'English']);
assert.equal(dialog.querySelector('[autofocus]').id, 'first-language-title');
assert.equal(dialog.dispatchEvent(new window.Event('cancel', { cancelable: true })), false);
assert.equal(dialog.querySelector('[autofocus]').dispatchEvent(new window.KeyboardEvent('keydown', {
  key: 'Escape', bubbles: true, cancelable: true,
})), false);
dialog.querySelector('button[lang=en]').click();
assert.equal(refreshes, 1);
assert.equal(getLang(), 'en');
assert.equal(document.documentElement.lang, 'en');
assert.equal(document.querySelector('dialog'), null);
assert.equal(settings.langChosen, true);

chooseFirstLanguage(() => assert.fail('Already chosen'));
assert.equal(document.querySelector('dialog'), null);
const { settings: restarted } = await import('../app/js/store.js?restart');
assert.equal(restarted.langChosen, true);
assert.equal(restarted.lang, 'en');

localStorage.setItem('wg.settings', JSON.stringify({ lang: 'pl' }));
const { settings: legacy } = await import('../app/js/store.js?legacy');
assert.equal(legacy.langChosen, true);
assert.equal(legacy.lang, 'pl');

localStorage.setItem('wg.settings', JSON.stringify({ lang: 'en', langChosen: false }));
const { settings: unchosen } = await import('../app/js/store.js?unchosen');
assert.equal(unchosen.langChosen, false);

window.close();
console.log('First-start prompt, choice persistence, and legacy language passed');
