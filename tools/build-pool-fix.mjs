// Builds app/data/<lang>/pool.json: words Letters, Connect and Guess must never hide, on top of their own rules
// (owner, 2026-09-25: "some words are not intuitive - SZER on Normal? - rule out weird words"; Guess too: yes).
// Run: node tools/build-pool-fix.mjs   (needs tools/raw/tiles/slowa.txt - see tools/build-tiles-words.mjs)
//
// Polish: every word the word-game list (sjp.pl) does not know - English words, brands, abbreviations, fragments
// (video, nokia, ppłk, owy) - plus, by hand, the ones it knows but no player would think of as a Polish word to
// guess: plain English (download, street), words whose count in the web text belongs to something else
// (szer - the abbreviation of szerokość; rej), and inflected forms the data took for base words (staje, września).
// English: by hand only - ENABLE (2000) lacks everyday words such as email and website, which may stay.
//
// And back in, Polish (owner, 2026-09-25: "check whether some words are wrongly ruled out"): words the data keeps
// out as "an inflected form of another word" (formOf) that are words in their own right - gra (also "on gra"),
// muzyka (also the genitive of muzyk), droga, polityka, wino. sjp.pl's inflection list (tools/raw/tiles/odm.txt,
// from sjp-odm-YYYYMMDD.zip, https://sjp.pl/sl/odmiany/) starts every line with a base form; a word heading its own
// line, with forms no other line has (grę, gry, grze) that the web text really uses (among its 60 000 commonest
// words), is a word to guess. Plain forms fail: every form of "ptaki" sits in the line of ptak; "kota" (a rare noun,
// really the genitive of kot) has forms of its own nobody uses (kotę).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../app/', import.meta.url), RAW = new URL('raw/tiles/', import.meta.url);
globalThis.fetch = async url => { const b = readFileSync(new URL(url, ROOT));
  return { json: async () => JSON.parse(b.toString('utf8')), text: async () => b.toString('utf8'),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadWords } = await import('../app/js/engine.js');
const { pool } = await import('../app/js/letters.js');
const { offensiveWord } = await import('../app/js/offensive.js');

const USED = 60000;
// Hard only (owner, 2026-09-25: "SEDAN on Normal - I don't know it"): Polish words that are also English words get their
// web-text count from English sentences too, so they look commoner than they are to a Polish player. Measured: the
// Polish-only forms of each (sedana, sedanem) against its own count - these, picked by hand from the ~250 whose Polish
// forms sit past the 50 000 commonest, are specialist words; everyday ones (beton, notes, kefir, zebra) keep their level.
const HARD_PL = 'sedan patio omega sigma lambda theta kappa colon pinyin personal zek mignon cabernet bypass petit siding '
  + 'sprinter opus credo modus cross imago agio ibis magenta pareo tenor dramaturg joint rep strongman reprint judoka '
  + 'teaser lager alb biker clip fagot hosta zonk lotion blister aga robusta lament pat tar roadster sampler fluid crack '
  + 'persona octan aspirant branding tors tuner spiker shaker floret spec bronzer nestor hart recital manifest token bel '
  + 'platan mural palm pled stoper proso raster gradient fon tensor gloria hospodar baronet stupa cep emir jar stela anion '
  + 'kation heros rota kalif china polar sepia gar sonar epos splendor grad wat delta slot bas step';
// by hand, the other way: its own forms are used, but its spelling mostly means something else (cech - cecha)
const KEEP_OUT = new Set(['cech']);

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
    + 'szer rej kard spid czyż mikro bryg causa staje wali żarty tam września osi ucha dań badan '
    // Guess's own list: brands and a fragment
    + 'retriever reebok torx acer toshiba boeing stradivarius ować',
  en: 'non kinda asap corp cred pct inst vii viii kph bps bpm meg bbl ftp cert choc google christian fab',
};

for (const lang of ['pl', 'en']) {
  const m = await loadWords(lang);
  // start from what the rules alone let each game hide: Letters' pool (Connect uses the same), and Guess's secrets
  const all = [...new Set([...pool({ ...m, poolFix: undefined }, { diff: 'random', marks: true }),
    ...m.secret, ...Object.values(m.cats).flat()].map(i => m.words[i]))];
  const drop = new Set(HAND[lang].split(' '));
  // never a slur or a vulgar word (offensive.js) - Letters and Connect check that themselves, Guess did not
  for (const w of all) if (offensiveWord(lang, w)) drop.add(w);
  if (lang === 'pl') {
    if (!existsSync(new URL('slowa.txt', RAW))) throw new Error('tools/raw/tiles/slowa.txt is missing - see tools/build-tiles-words.mjs');
    const known = new Set(readFileSync(new URL('slowa.txt', RAW), 'utf8').split(/\r?\n/));
    // the word-game list stops at 15 letters (a board's width): longer words (odpowiedzialność) are not missing from it
    for (const w of all) if ([...w].length <= 15 && !known.has(w)) drop.add(w);
  }
  const restore = lang === 'pl' ? wordsInTheirOwnRight(m) : [];
  const words = [...drop].filter(w => all.includes(w) || restore.includes(w)).sort((a, b) => a.localeCompare(b, lang));
  const back = restore.filter(w => !drop.has(w)).sort((a, b) => a.localeCompare(b, lang));
  const hard = lang === 'pl' ? HARD_PL.split(' ').filter(w => all.includes(w) && !drop.has(w)).sort((a, b) => a.localeCompare(b, lang)) : [];
  writeFileSync(new URL(`data/${lang}/pool.json`, ROOT), JSON.stringify({ drop: words, restore: back, hard }) + '\n');
  console.log(`${lang}: ${all.length} words could be hidden; ${words.length} dropped, ${back.length} back in, ${hard.length} Hard only -> app/data/${lang}/pool.json`);
}

function wordsInTheirOwnRight(m) {
  const odm = new URL('odm.txt', RAW), tokens = new URL('../cc.pl.tokens.txt', RAW);
  if (!existsSync(odm) || !existsSync(tokens)) throw new Error('tools/raw/tiles/odm.txt or tools/raw/cc.pl.tokens.txt is missing');
  const lines = readFileSync(odm, 'utf8').split(/\r?\n/).map(l => l.split(', ')).filter(l => l[0] && l[0] === l[0].toLowerCase());
  const inLines = new Map(), heads = new Map();
  for (const l of lines) {
    for (const f of new Set(l)) inLines.set(f, (inLines.get(f) || 0) + 1);
    (heads.get(l[0]) ?? heads.set(l[0], []).get(l[0])).push(l);
  }
  const rank = new Map(readFileSync(tokens, 'utf8').split(/\r?\n/).map((w, i) => [w, i + 1]));
  const KINDS = new Set(['noun', 'adj', 'verb', 'adv']), out = [];
  for (const i of m.formOf) {
    const w = m.words[i];
    if (i >= 20000 || !KINDS.has(m.posNames[m.pos[i]]) || KEEP_OUT.has(w)) continue;
    const own = (heads.get(w) ?? []).flatMap(l => l.slice(1)).filter(f => f !== w && inLines.get(f) === 1);
    if (own.some(f => (rank.get(f) ?? Infinity) <= USED)) out.push(w);
  }
  return out;
}
