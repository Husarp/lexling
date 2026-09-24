// Which words exist, what part of speech they are, and which inflected forms collapse onto them.
// Source: the Hunspell dictionaries that ship with LibreOffice (pl_PL = sjp.pl, en_US = SCOWL) and,
// for English parts of speech, LibreOffice's WordNet-based thesaurus. Build-time only.
import { readFileSync } from 'node:fs';
import { readAff, readDic, suffixed, prefixed } from './hunspell.mjs';
import { INDECLINABLE } from './seeds.mjs';

const OFFICE = process.env.WG_DICTS || 'C:/Program Files/LibreOffice/share/extensions/';
export const POS = ['noun', 'adj', 'verb', 'adv', 'other'];
const [NOUN, ADJ, VERB, ADV, OTHER] = [0, 1, 2, 3, 4];

// A lexicon is Map lemma -> { pos, forms: Map form -> derived }, where `derived` marks a participle or
// gerund reading: it loses against a direct noun/adjective reading of the same form (DESIGN.md §2a).
const entry = (lex, lemma, pos) => { if (!lex.has(lemma)) lex.set(lemma, { pos, forms: new Map() }); return lex.get(lemma); };

// ---------- Polish ----------
const PL_VERB = new Set('BEFGHIJdeghijkv');      // conjugation classes (every word carrying one ends in -ć / -c)
const PL_ADJ = new Set('XYxy');                  // adjective declension (+ y: the adverb, szybki → szybko)
const PL_DERIVED = new Set('EGgvij');            // participles (-ący, -ony, -ty) and gerunds (-anie, -enie, -cie)
const PL_WORD = /^[a-ząćęłńóśźż]{2,}$/;
const FLAGLESS_MAX_RANK = 20000;                 // flagless entries are mostly stray inflected forms; keep only the common ones (i, na, się, jest…)
const PL_INDECLINABLE = new Set(INDECLINABLE.pl.split(' ').filter(Boolean));

export function polish(rank) {
  const aff = readAff(OFFICE + 'dict-pl/pl_PL.aff', 'iso-8859-2');
  const flagsOf = new Map();
  for (const { word, flags } of readDic(OFFICE + 'dict-pl/pl_PL.dic', 'iso-8859-2')) {
    if (PL_WORD.test(word) && rank.has(word)) flagsOf.set(word, (flagsOf.get(word) || '') + flags);
  }
  const lex = new Map();
  for (const [word, flags] of flagsOf) {
    // A flagless entry is usually a stray inflected form, so only the common ones are kept, and as
    // "other" rather than a noun. Indeclinable loanwords are the exception: kiwi, mango, salami are
    // ordinary nouns that simply never change ending, and this rule was leaving them out of the game
    // entirely. They are listed by hand because no flag tells them apart from the strays.
    if (!flags) {
      if (PL_INDECLINABLE.has(word)) entry(lex, word, NOUN);
      else if (rank.get(word) < FLAGLESS_MAX_RANK) entry(lex, word, OTHER);
      continue;
    }
    const fl = [...new Set(flags)];
    const pos = fl.some(f => PL_VERB.has(f)) ? VERB : fl.some(f => PL_ADJ.has(f)) ? ADJ : NOUN;
    const e = entry(lex, word, pos);
    for (const f of fl) {
      if (f === 'b') continue;                   // nie- prefix: a negation is a different word
      for (const form of suffixed(aff, word, f)) {
        if (form === word || !PL_WORD.test(form)) continue;
        const derived = PL_DERIVED.has(f);
        if (!e.forms.has(form) || !derived) e.forms.set(form, derived);
      }
    }
  }
  return lex;
}

// Every entry the dictionary lists with no flags at all. Most are irregular forms written out in full -
// pasę, pasą, poszedłem, szedłem - which no rule links back to their base word, so Guess cannot score
// them and polish() above drops the rare ones. Letters only needs to know they are words.
export function polishStandalone() {
  return readDic(OFFICE + 'dict-pl/pl_PL.dic', 'iso-8859-2').filter(e => !e.flags && PL_WORD.test(e.word)).map(e => e.word);
}

// ---------- English ----------
const EN_WORD = /^[a-z]{2,}$/;
const EN_PREFIX = 'AIUCEFK';                     // re- in- un- de- dis- con- pro-  → always a new word
// Past / participle / plural forms the affix rules cannot produce. Deliberately NOT listed: forms that are
// common words in their own right (left, saw, found, rose, felt, fell, lay, bit, bound, shot, lit, people,
// data, media, more, most, less, least, lives, bases…) - those stay separate words.
const EN_IRREGULAR = Object.entries({
  be: 'am is are was were been', have: 'has had', do: 'does did done', go: 'goes went gone', say: 'said', get: 'got gotten',
  make: 'made', know: 'knew known', think: 'thought', take: 'took taken', see: 'seen', come: 'came', give: 'gave given', tell: 'told',
  become: 'became', bring: 'brought', begin: 'began begun', keep: 'kept', hold: 'held', write: 'wrote written',
  stand: 'stood', hear: 'heard', mean: 'meant', meet: 'met', run: 'ran', pay: 'paid', sit: 'sat', speak: 'spoken', lead: 'led',
  grow: 'grew grown', lose: 'lost', fall: 'fallen', send: 'sent', build: 'built', understand: 'understood', draw: 'drew drawn',
  break: 'broke broken', spend: 'spent', rise: 'risen', drive: 'drove driven', buy: 'bought', wear: 'wore worn', choose: 'chose chosen',
  seek: 'sought', throw: 'threw thrown', catch: 'caught', deal: 'dealt', win: 'won', forget: 'forgot forgotten', sell: 'sold',
  fight: 'fought', teach: 'taught', eat: 'ate eaten', sing: 'sang sung', strike: 'struck', hang: 'hung', shake: 'shook shaken',
  ride: 'rode ridden', feed: 'fed', drink: 'drank', arise: 'arose arisen', fly: 'flew flown', sleep: 'slept', beat: 'beaten',
  hide: 'hid', swim: 'swam swum', blow: 'blew blown', freeze: 'froze frozen', steal: 'stole stolen', dig: 'dug', bite: 'bitten',
  tear: 'tore torn', wake: 'woke woken', sweep: 'swept', stick: 'stuck', sink: 'sank sunk', swing: 'swung', bend: 'bent', lend: 'lent',
  ring: 'rang rung', shine: 'shone', spin: 'spun', weep: 'wept', flee: 'fled', forgive: 'forgave forgiven', kneel: 'knelt',
  creep: 'crept', slide: 'slid', sting: 'stung', spit: 'spat',
  // plurals
  man: 'men', woman: 'women', child: 'children', foot: 'feet', tooth: 'teeth', goose: 'geese', mouse: 'mice', ox: 'oxen',
  leaf: 'leaves', knife: 'knives', wife: 'wives', wolf: 'wolves', shelf: 'shelves', half: 'halves', thief: 'thieves', loaf: 'loaves',
  calf: 'calves', elf: 'elves', scarf: 'scarves', hoof: 'hooves', crisis: 'crises', analysis: 'analyses', thesis: 'theses',
  phenomenon: 'phenomena', criterion: 'criteria', bacterium: 'bacteria', cactus: 'cacti', fungus: 'fungi', nucleus: 'nuclei',
  stimulus: 'stimuli',
  // comparison
  good: 'better best', bad: 'worse worst',
}).flatMap(([lemma, forms]) => forms.split(' ').map(form => [form, lemma]));

function englishPos() {
  // "word|n" followed by n sense lines "(noun)|…". The part of speech with the most senses wins.
  const tag = { noun: NOUN, adj: ADJ, verb: VERB, adv: ADV };
  const pos = new Map(), verbs = new Set(), lines = readFileSync(OFFICE + 'dict-en/th_en_US_v2.dat', 'utf8').split('\n');
  for (let i = 1; i < lines.length;) {
    const [word, n] = lines[i].split('|');
    const count = [0, 0, 0, 0];
    for (let k = 1; k <= +n; k++) { const p = tag[lines[i + k].slice(1, lines[i + k].indexOf(')'))]; if (p !== undefined) count[p]++; }
    i += (+n || 0) + 1;
    if (!EN_WORD.test(word)) continue;
    pos.set(word, count.indexOf(Math.max(...count)));
    if (count[VERB]) verbs.add(word);
  }
  return { pos, verbs };
}

export function english(rank) {
  const aff = readAff(OFFICE + 'dict-en/en_US.aff', 'utf-8');
  const { pos: posOf, verbs } = englishPos();
  const lex = new Map();
  const lemma = w => w !== undefined && EN_WORD.test(w) && rank.has(w) ? entry(lex, w, posOf.get(w) ?? OTHER) : null;
  const form = (lem, f) => { if (f !== undefined && f !== lem && EN_WORD.test(f) && rank.has(f)) lex.get(lem)?.forms.set(f, false); };

  const listed = new Set();   // words that are dictionary entries themselves (not produced by an affix rule)
  for (const { word, flags } of readDic(OFFICE + 'dict-en/en_US.dic', 'utf-8')) {
    if (!EN_WORD.test(word)) continue;
    listed.add(word);
    const bases = [word, ...[...flags].filter(f => EN_PREFIX.includes(f)).flatMap(f => prefixed(aff, word, f))];
    for (const base of bases) {
      if (!lemma(base)) continue;
      const one = f => flags.includes(f) ? suffixed(aff, base, f)[0] : undefined;
      for (const f of 'SDT') form(base, one(f));                        // plural / 3rd person, past, superlative
      // -ing: a noun of its own when it has a plural (building/buildings), otherwise a verb form
      if (flags.includes('J') && lemma(one('G'))) form(one('G'), one('J')); else form(base, one('G'));
      // -er: comparative when there is an -est too (fast/faster/fastest), otherwise an agent noun (teach → teacher)
      if (flags.includes('T')) form(base, one('R')); else if (lemma(one('R'))) form(one('R'), one('Z'));
      if (lemma(one('N'))) form(one('N'), one('X'));                    // creation / creations
      for (const f of 'VHYPBL') for (const w of flags.includes(f) ? suffixed(aff, base, f) : []) lemma(w);   // -ive -th -ly -ness -able -ment
    }
  }
  const fold = (f, to) => {
    if (f === to || !lex.has(to) || !rank.has(f)) return;
    for (const [sub] of lex.get(f)?.forms || []) lex.get(to).forms.set(sub, false);
    lex.delete(f);
    lex.get(to).forms.set(f, false);
  };
  for (const [f, to] of EN_IRREGULAR) fold(f, to);
  // doubled-consonant forms are listed as words of their own (stop · stopped · stopping): fold them into the
  // verb - except an -ing that is mainly a noun (wedding, bedding, shopping)
  for (const w of [...lex.keys()]) {
    const m = /^(.+([bdgklmnprt]))\2(ing|ed)$/.exec(w);
    if (!m || !listed.has(w) || !verbs.has(m[1]) || !lex.has(m[1])) continue;
    if (m[3] === 'ing' && lex.get(w).pos === NOUN) continue;
    fold(w, m[1]);
  }
  return lex;
}
