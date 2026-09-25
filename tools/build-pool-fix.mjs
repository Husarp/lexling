// Builds app/data/<lang>/pool.json: words Litery and Połącz must never hide, on top of the rules in letters.js
// (owner, 2026-09-25: "some words are not intuitive - SZER on Normal? - rule out weird words").
// Run: node tools/build-pool-fix.mjs   (needs tools/raw/tiles/slowa.txt - see tools/build-tiles-words.mjs)
//
// Polish: every word the word-game list (sjp.pl) does not know - English words, brands, abbreviations, fragments
// (video, nokia, ppłk, owy) - plus, by hand, the ones it knows but no player would think of as a Polish word to
// guess: plain English (download, street), words whose count in the web text belongs to something else
// (szer - the abbreviation of szerokość; rej), and inflected forms the data took for base words (staje, września).
// English: by hand only - ENABLE (2000) lacks everyday words such as email and website, which may stay.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../app/', import.meta.url), RAW = new URL('raw/tiles/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords } = await import('../app/js/engine.js');
const { pool } = await import('../app/js/letters.js');

const HAND = {
  // plain English in Polish web text; loanwords Polish really uses stay (menu, sushi, kebab, camping, show...)
  pl: 'shift look return register talk download support flash power full solid light border business background king '
    + 'management jack long soft display street help research browser keyboard patch break grid tweet down pink dual peak '
    + 'default enter track report trip shop screen error pool tour german brand minor network speed outdoor sweet grand '
    + 'root less upload spring stream button industrial drop song tell coach bold camera skin desktop popular football boot '
    + 'focus chart trial pass meeting august deal lead engineering zip brew swap hub sleep shirt plant superior spread '
    + 'stretch moon drag pet stuff stress flower listing kick dip loop skip trick camp mailing mirror bet independent rant '
    + 'truck kernel modeling bootleg trading proof lobbing iron setup pickup cruiser turf bang feeling lag sold insert skit '
    + 'corner bios hash achy brief jumping launch tracking soccer sandwich slash ping unit period curler taper split rating '
    + 'master backup speaker layout prepaid blank mastering multiplayer copyright pac tips pen nom rex nil deck scrub '
    + 'networking controlling consulting booking publishing sampling boyfriend '
    // the count belongs to something else: an abbreviation (szer. = szerokość, bryg. = brygada), a set phrase (wodzić
    // rej), a particle or a prefix; and inflected forms taken for base words
    + 'szer rej kard spid czyż mikro bryg causa staje wali żarty tam września osi ucha dań badan',
  en: 'non kinda asap corp cred pct inst vii viii kph bps bpm meg bbl ftp cert choc google christian fab',
};

for (const lang of ['pl', 'en']) {
  const m = await loadWords(lang);
  // start from the pool as the rules alone make it
  const all = pool({ ...m, poolFix: undefined }, { diff: 'random', marks: true }).map(i => m.words[i]);
  const drop = new Set(HAND[lang].split(' '));
  if (lang === 'pl') {
    if (!existsSync(new URL('slowa.txt', RAW))) throw new Error('tools/raw/tiles/slowa.txt is missing - see tools/build-tiles-words.mjs');
    const known = new Set(readFileSync(new URL('slowa.txt', RAW), 'utf8').split(/\r?\n/));
    for (const w of all) if (!known.has(w)) drop.add(w);
  }
  const words = [...drop].filter(w => all.includes(w)).sort((a, b) => a.localeCompare(b, lang));
  writeFileSync(new URL(`data/${lang}/pool.json`, ROOT), JSON.stringify({ drop: words }) + '\n');
  console.log(`${lang}: ${all.length} words could be hidden; ${words.length} dropped -> app/data/${lang}/pool.json`);
}
