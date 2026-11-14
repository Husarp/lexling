import assert from 'node:assert/strict';
import { plain, parseMeaning, lookupMeaning } from '../app/js/meaning.js';
let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
const pl = text => ({ parse: { wikitext: { '*': `== kot ({{język polski}}) ==\n{{znaczenia}}\n${text}\n{{odmiana}}\n: (1.1) ignored\n== cat ({{język angielski}}) ==\n{{znaczenia}}\n: (1.1) ignored` } } });
const en = text => ({ en: [{ definitions: [{ definition: text }] }], fr: [{ definitions: [{ definition: 'ignored' }] }] });
check('PL section and markup', parseMeaning(pl(": (1.1) [[zwierzę]] '''domowe'''\n: (1.2) [[maszyna|urządzenie]]"), 'pl').meanings, ['zwierzę domowe', 'urządzenie']);
check('EN HTML', parseMeaning(en('<a href="/cat">A cat</a> &amp; animal.'), 'en').meanings, ['A cat & animal.']);
check('HTML styles are not definitions', plain('<style>.css{color:red}</style>animal'), 'animal');
check('scientific names', plain('{{zool}} {{nazwa systematyczna|Felis catus|Linnaeus}}, [[zwierzę]]'), 'Felis catus, zwierzę');
check('entities and references', plain('a<ref>ignore</ref> &#243; &#xF3; &quot;b&quot;'), 'a ó ó "b"');
check('PL form', parseMeaning(pl("''forma fleksyjna''\n: (1.1) narzędnik od [[kot]]"), 'pl').form, true);
check('EN form', parseMeaning(en('plural of <b>cat</b>'), 'en').form, true);
for (const line of ['plural of cat', 'singular of cats', 'third-person singular simple present indicative of house', 'past tense of walk', 'past participle of walk', 'present participle of walk', 'comparative of big', 'superlative of big', 'alternative form of color']) {
  check(`EN form: ${line}`, parseMeaning(en(line), 'en'), { meanings: [], form: true });
}
check('PL reference form', parseMeaning(pl(': (1.1) zob. [[kot]]'), 'pl'), { meanings: [], form: true });
check('mixed real and form definitions', parseMeaning({ en: [{ definitions: [{ definition: 'plural of cat' }, { definition: 'A real meaning.' }] }] }, 'en'), { meanings: ['A real meaning.'], form: false });
check('missing', parseMeaning({ error: { code: 'missingtitle' } }, 'pl').meanings, []);
check('wrong language', parseMeaning({ fr: [] }, 'en').meanings, []);
const response = data => ({ ok: true, json: async () => data });
for (const lang of ['pl', 'en']) {
  let calls = 0;
  const fetcher = async () => { calls++; return response(calls === 1 ? (lang === 'pl' ? pl("''forma fleksyjna''\n: (1.1) forma od [[kot]]") : en('plural of cat')) : (lang === 'pl' ? pl(': (1.1) zwierzę') : en('animal'))); };
  const result = await lookupMeaning(lang === 'pl' ? 'kotami' : 'cats', lang, lang === 'pl' ? 'kot' : 'cat', fetcher);
  check(`${lang} fallback`, [result.meanings, result.base, result.form, calls], [[lang === 'pl' ? 'zwierzę' : 'animal'], lang === 'pl' ? 'kot' : 'cat', true, 2]);
  await lookupMeaning(lang === 'pl' ? 'kotami' : 'cats', lang, lang === 'pl' ? 'kot' : 'cat', fetcher);
  check(`${lang} cached`, calls, 2);
}
let houseCalls = 0;
const houses = await lookupMeaning('houses', 'en', 'house', async () => {
  houseCalls++;
  return response(houseCalls === 1 ? en('third-person singular simple present indicative of <b>house</b>') : en('A building for living in.'));
});
check('houses uses house meanings and identifies base', houses, { meanings: ['A building for living in.'], form: true, base: 'house' });
check('houses reads base', houseCalls, 2);
check('missing fallback', (await lookupMeaning('missing-form', 'en', 'missing-base', async () => ({ status: 404 }))).meanings, []);
await assert.rejects(lookupMeaning('network-error', 'en', undefined, async () => { throw new Error('offline'); })); passed++;
await assert.rejects(lookupMeaning('http-error', 'en', undefined, async () => ({ ok: false, status: 503 }))); passed++;
console.log(`Meaning: ${passed} checks passed`);
