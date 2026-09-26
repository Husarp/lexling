// Builds the word files Tiles looks words up in: app/data/<lang>/tiles.bin, a word graph (dawg.js).
// Run: node tools/build-tiles-words.mjs      (after the app's own word data exists: node tools/build-data.mjs)
//
// The lists (owner's choice, 2026-09-25), downloaded into tools/raw/tiles/ (not in git):
//   Polish  - sjp.pl "słownik do gier", https://sjp.pl/sl/growy/ -> sjp-YYYYMMDD.zip -> slowa.txt
//             (GPL 2 or CC BY 4.0; we use CC BY 4.0 - the app credits it; changed: slurs and vulgar words left out)
//   English - ENABLE, public domain, https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
// Both are word-game lists: every form, no abbreviations, no proper nouns. Letter names (es, zet / ess, zed)
// are in both already (checked 2026-09-25), so no extra list is added.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../app/', import.meta.url), RAW = new URL('raw/tiles/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords } = await import('../app/js/engine.js');
const { buildDawg, toBytes } = await import('../app/js/dawg.js');
const { letterSet } = await import('../app/js/tiles.js');
const { offensiveWord } = await import('../app/js/offensive.js');
import { readAff, readDic, suffixed } from './hunspell.mjs';

const SOURCES = { pl: 'slowa.txt', en: 'enable1.txt' };
// The spell-checkers' dictionaries LibreOffice ships (pl_PL is sjp.pl's): the same ones tools/lexicon.mjs reads.
const OFFICE = process.env.WG_DICTS || 'C:/Program Files/LibreOffice/share/extensions/';
const HUNSPELL = { pl: ['dict-pl/pl_PL', 'iso-8859-2'], en: ['dict-en/en_US', 'utf-8'] };

for (const [lang, file] of Object.entries(SOURCES)) {
  if (!existsSync(new URL(file, RAW))) throw new Error(`tools/raw/tiles/${file} is missing - see the top of this file`);
  const list = readFileSync(new URL(file, RAW), 'utf8').split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean);
  // Never a slur or a vulgar word, as in every game here (offensive.js). The lists have no base words to catch
  // an inflected form by (MINETĄ), so they are gathered here: every form the spell-checker's dictionary makes
  // of an offensive word, and every form the app's own list links to one.
  const m = await loadWords(lang);
  const banned = new Set();
  m.ac.forEach((w, i) => { if (offensiveWord(lang, w) || offensiveWord(lang, m.words[m.acIdx[i]])) banned.add(w); });
  const [dic, enc] = HUNSPELL[lang], aff = readAff(OFFICE + dic + '.aff', enc);
  for (const { word, flags } of readDic(OFFICE + dic + '.dic', enc)) {
    if (!offensiveWord(lang, word.toLowerCase())) continue;
    banned.add(word.toLowerCase());
    for (const flag of new Set(flags)) for (const form of suffixed(aff, word, flag)) banned.add(form.toLowerCase());
  }
  const { letters } = letterSet(lang), abc = new Set(letters);
  const words = list.filter(w => { const n = [...w].length;
    return n >= 2 && n <= 15 && [...w].every(ch => abc.has(ch)) && !offensiveWord(lang, w) && !banned.has(w); });
  const t0 = performance.now();
  const d = buildDawg(words, letters);
  const bytes = toBytes(d);
  writeFileSync(new URL(`data/${lang}/tiles.bin`, ROOT), bytes);
  console.log(`${lang}: ${list.length} in the list, ${d.words} kept (${list.length - words.length} left out: too long or short, ` +
    `letters with no tile, offensive) -> ${d.final.length} nodes, ${d.letter.length} edges, ` +
    `${(bytes.byteLength / 1048576).toFixed(1)} MB, tag ${d.tag.toString(16)}, ${Math.round((performance.now() - t0) / 1000)} s`);
}
