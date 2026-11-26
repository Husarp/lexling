// Finished Tiles Story contents and platform delivery (owner, 2026-11-26).
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { setLang } from '../app/js/i18n.js';
import { newGame } from '../app/js/tiles.js';
import { shareTilesStory, storyBestWord } from '../app/js/tiles-share.js';

const { window } = new JSDOM();
globalThis.window = window;
globalThis.document = window.document;
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const { finalOrder, nameOf } = await import('../app/js/tiles-game.js');
const S = newGame({ board: 'quick', lang: 'pl', players: [{ name: 'Ola' }, { name: 'Paweł' }, { name: 'Jan' }], seed: 3 });
S.over = { winner: 1, reason: 'resign', by: 2 };
S.scores = [112, 182, 200];
S.cells[0] = { ch: 'ż', blank: true, by: 0 };
S.cells[1] = { ch: 'e', by: 1 };
S.moves = [
  { kind: 'play', score: 77, placed: [], words: [{ w: 'gra', score: 27 }] },
  { kind: 'play', score: 54, placed: [{ r: 0, c: 1, ch: 'e' }], words: [
    { w: 'ale', score: 16 }, { w: 'że', score: 38, r: 0, c: 0, across: true },
  ] },
  { kind: 'vetoed', score: 90, words: [{ w: 'test', score: 90 }] },
];
assert.deepEqual(storyBestWord(S), { tiles: [{ ch: 'ż', blank: true }, { ch: 'e', blank: false }], score: 38 });
assert.deepEqual(storyBestWord({ ...S, moves: [{
  kind: 'play', words: [{ w: 'lala', score: 5 }], placed: [{ ch: 'a', blank: true }],
}] }), { tiles: [{ ch: 'l', blank: false }, { ch: 'a', blank: true }, { ch: 'l', blank: false }, { ch: 'a', blank: false }], score: 5 });
assert.equal(storyBestWord({ ...S, moves: [] }), null);

const text = [], fonts = [];
Object.defineProperty(document, 'fonts', { value: { load: font => fonts.push(font) } });
const png = 'iVBORw0KGgo=';
const image = { type: 'image/png' };
const context = {
  measureText: s => ({ width: s.length * 20 }),
  fillText: s => text.push(s),
  fillRect() {}, beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, fill() {},
};
const canvas = window.HTMLCanvasElement.prototype;
canvas.getContext = function (type) {
  assert.equal(type, '2d');
  assert.deepEqual([this.width, this.height], [1080, 1920]);
  return context;
};
canvas.toDataURL = type => {
  assert.equal(type, 'image/png');
  return 'data:image/png;base64,' + png;
};
canvas.toBlob = (done, type) => {
  assert.equal(type, 'image/png');
  done(image);
};

const release = 'github.com/Husarp/lexling/releases/latest';
const share = state => shareTilesStory(state, finalOrder(state), state.players.map((_, p) => nameOf(state, p)));
setLang('pl');
window.Capacitor = { getPlatform: () => 'android', Plugins: { AppUpdate: { shareTilesImage: async options => {
  assert.deepEqual(options, { png, caption: 'Kafelki w Lexlingu · https://' + release, title: 'Udostępnij' });
} } } };
assert.equal(await share(S), false);
assert.equal(fonts.length, 3);
for (const expected of ['LEX', '/', 'LING', 'KAFELKI', 'WYGRYWA PAWEŁ', '182–112–200', 'Paweł · Ola · Jan', 'Ż', 'E', '2S',
  'NAJLEPSZE SŁOWO', '38 pkt', 'Pobierz Lexling', release]) assert.ok(text.includes(expected), expected);
delete window.Capacitor;

setLang('en');
window.pywebview = { api: { save_tiles_image: async data => { assert.equal(data, png); return true; } } };
text.length = 0;
const draw = { ...S, over: { winner: -1, reason: 'passes' }, scores: [12, 12, -8], moves: [] };
assert.equal(await share(draw), true);
for (const expected of ['TILES', 'DRAW', '12–12–−8', 'BEST WORD', '—', 'Download Lexling', release]) assert.ok(text.includes(expected), expected);
window.pywebview.api.save_tiles_image = async () => false;
await assert.rejects(share(S), /PNG save failed/);
delete window.pywebview;

let download;
window.HTMLAnchorElement.prototype.click = function () { download = [this.href, this.download]; };
URL.createObjectURL = blob => { assert.equal(blob, image); return 'blob:tiles-story'; };
URL.revokeObjectURL = url => assert.equal(url, 'blob:tiles-story');
assert.equal(await share(S), true);
assert.deepEqual(download, ['blob:tiles-story', 'Lexling-Tiles.png']);
assert.equal(document.querySelector('a'), null);
canvas.toBlob = done => done(null);
await assert.rejects(share(S), /PNG encoding failed/);
console.log('Tiles Story contents and Android, desktop and browser handoffs passed');
