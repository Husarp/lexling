// Builds app/data/<lang>/spoken.txt: the Tiles words people really say, most said first, one per line - how the
// computer's levels below Hard tell an everyday word (kot, pasje, wyrzucał) from a word-game one (pe, esy, zwy, kotą,
// triu), which the frequency list the other games use cannot: it counts base words in web text, where pe, en and ad
// are common, and any form of a common base word counts as common (owner, 2026-10-12: words "I didn't even know were
// allowed"). Words said fewer than MIN times are left out.
// Run: node tools/build-spoken.mjs      (after node tools/build-tiles-words.mjs)
//
// The lists, downloaded into tools/raw/spoken/ (not in git) when missing: FrequencyWords, every word of OpenSubtitles
// 2018 with how often it is said (Hermit Dave, https://github.com/hermitdave/FrequencyWords - CC BY-SA 4.0, credited
// in the app).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../app/', import.meta.url), RAW = new URL('raw/spoken/', import.meta.url), MIN = 20;
const URL_OF = lang => `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${lang}/${lang}_full.txt`;
const realFetch = globalThis.fetch;
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadTileWords } = await import('../app/js/tiles.js');
const { has } = await import('../app/js/dawg.js');

// word -> its place in the list (1 = the most said), for the words said at least MIN times
async function said(lang) {
  const file = new URL(`${lang}_full.txt`, RAW);
  if (!existsSync(file)) {
    mkdirSync(RAW, { recursive: true });
    const r = await realFetch(URL_OF(lang));
    if (!r.ok) throw new Error(`${URL_OF(lang)}: ${r.status}`);
    writeFileSync(file, await r.text());
  }
  const rank = new Map();
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const [w, n] = line.split(' ');
    if (!w || +n < MIN) break;
    if (!rank.has(w)) rank.set(w, rank.size + 1);
  }
  return rank;
}
const fold = w => w.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
const en = await said('en');
for (const lang of ['pl', 'en']) {
  const rank = lang === 'en' ? en : await said(lang), dict = await loadTileWords(lang);
  // subtitles typed without Polish letters: "tez" is też, "juz" is już - a form whose spelling with the marks is said
  // far more is that word, not this one
  const best = new Map();
  for (const [w, r] of rank) { const f = fold(w); if (!best.has(f) || r < best.get(f)) best.set(f, r); }
  const out = [];
  for (const [w, r] of rank) {
    if (w.length < 2 || !has(dict, w)) continue;
    if (lang === 'pl' && w === fold(w) && best.get(w) * 8 < r) continue;
    // English in Polish films (for, may, his): said more in English than in Polish
    if (lang === 'pl' && en.has(w) && en.get(w) * 2 < r) continue;
    out.push(w);
  }
  writeFileSync(new URL(`data/${lang}/spoken.txt`, ROOT), out.join('\n') + '\n');
  console.log(lang, out.length, 'words');
}
