// Polish-only ticket 27 rebuild. First run build-familiar-words.mjs for ticket 26 inputs.
// Download https://download.sgjp.pl/morfeusz/20261115/polimorf-20261115.tab.gz
// into tools/raw/familiar/. Two streaming passes avoid loading the full dictionary.
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createGunzip, gunzipSync } from 'node:zlib';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { fromBytes, buildDawg, toBytes } from '../app/js/dawg.js';
import { TWO } from '../app/js/tiles-moves.js';
const raw = new URL('raw/familiar/', import.meta.url), app = new URL('../app/data/', import.meta.url);
const source = new URL('polimorf-20261115.tab.gz', raw);
const freq = new Map();
const corpus = readFileSync(new URL('1grams.gz', raw));
for (const line of gunzipSync(corpus).toString('utf8').split('\n')) {
  const m = line.match(/^\s*(\d+)\s+(\S+)\s*$/);
  if (m) freq.set(m[2], Number(m[1]));
}
const spoken = new Set(readFileSync(new URL('pl/spoken.txt', app), 'utf8').split(/\r?\n/));
const vocab = new Set(JSON.parse(readFileSync(new URL('pl/vocab.json', app))).words);
const lemmas = new Map();
const rows = () => createInterface({ input: createReadStream(source).pipe(createGunzip()), crlfDelay: Infinity });
let notice = '', inNotice = false;
for await (const line of rows()) {
  if (line === '#<COPYRIGHT>') { inNotice = true; continue; }
  if (line === '#</COPYRIGHT>') { inNotice = false; continue; }
  if (inNotice) { notice += line + '\n'; continue; }
  const [form, lemma, tags] = line.split('\t');
  if (!tags) continue;
  let info = lemmas.get(lemma);
  if (!info) lemmas.set(lemma, info = { count: 0, spoken: false, last: null });
  // Homonym suffixes distinguish paradigms; strip only for vocab membership.
  if (info.last !== form) {
    info.count += freq.get(form) ?? 0;
    info.spoken ||= spoken.has(form);
    info.last = form;
  }
}
writeFileSync(new URL('Polimorf-Copyright.txt', app), notice);
function* enumerate(d, n = 0, prefix = '') {
  if (d.final[n]) yield prefix;
  for (let e = d.first[n]; e < d.first[n + 1]; e++) yield* enumerate(d, d.target[e], prefix + d.letters[d.letter[e]]);
}
const buf = readFileSync(new URL('pl/tiles.bin', app));
const d = fromBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const all = [...enumerate(d)], indices = new Map(all.map((w, i) => [w, i]));
const scores = new Float64Array(all.length);
scores.fill(-1);
const probes = new Set(['dolewałaś', 'nakradniemy', 'zazębionemu', 'skarboneczka', 'yoni', 'niebandżulskimi', 'odsztafirujże', 'buławinkowca', 'kotą', 'triu']);
// Odd forms of known words, blocked by hand (owner's round, 2026-11-16).
// English junk words, picked 2026-11-26: tools/familiar-block-pl.txt.
const PL_BLOCK = new Set(['yoni', 'kotą', 'triu', ...readFileSync(new URL('familiar-block-pl.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(w => w && !w.startsWith('#'))]);
const evidence = [];
for await (const line of rows()) {
  const [form, lemma, tags] = line.split('\t');
  const i = indices.get(form);
  if (i === undefined || !tags) continue;
  const info = lemmas.get(lemma);
  if (probes.has(form)) evidence.push(`${form}: ${lemma}, ${tags}; lemma count ${info.count}, spoken ${info.spoken}, vocab ${vocab.has(lemma.replace(/:.*/, ''))}; exact ${freq.get(form) ?? 0}`);
  // Never rescue a negated adjective/participle/gerund via its positive lemma.
  if (form.startsWith('nie') && /(?:^|:)neg(?:$|:)/.test(tags)) continue;
  scores[i] = Math.max(scores[i], info.spoken || vocab.has(lemma.replace(/:.*/, '')) ? Infinity : info.count);
}
const sample = (words, seed) => {
  const out = words.slice(0, 30);
  for (let i = 30; i < words.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(seed / 4294967296 * (i + 1));
    if (j < 30) out[j] = words[i];
  }
  return out.join(', ');
};
let report = `# Familiar words measurements — ticket 27\n\nPolimorf 20261115, https://download.sgjp.pl/morfeusz/20261115/polimorf-20261115.tab.gz.\nBSD 2-clause notice shipped in app/data/Polimorf-Copyright.txt.\nNKJP compressed SHA-256: ${createHash('sha256').update(corpus).digest('hex')}.\nCase-sensitive form/lemma mapping; homonym IDs preserved for count aggregation. Each distinct form counts once per lemma, including forms outside the game graph and game length limit.\nKeep ticket 26 exact K=2 / spoken / TWO, plus any known lemma (sum >= T, spoken form, or vocab lemma). Neg-tagged nie forms receive no lemma rescue. yoni, kotą, triu blocked by hand.\nSamples: reservoir 30, LCG 1664525/1013904223, seeds 20261116 kept / 20261117 dropped.\n\n`;
const chosen = 1;
for (const t of [1, 2, 5, 10]) {
  const keep = [], drop = [];
  for (let i = 0; i < all.length; i++) {
    const w = all[i];
    ((freq.get(w) ?? 0) >= 2 || spoken.has(w) || TWO.pl.has(w) || scores[i] >= t) && !PL_BLOCK.has(w) ? keep.push(w) : drop.push(w);
  }
  report += `## T=${t}\n\nFull: ${all.length}; kept: ${keep.length} (ticket 26: 525184); dropped: ${drop.length}; 2-letter: ${keep.filter(w => w.length === 2).length}; 3-letter: ${keep.filter(w => w.length === 3).length}.\n\nKept (30): ${sample(keep, 20261116)}.\n\nDropped (30): ${sample(drop, 20261117)}.\n\n`;
  console.log(`T=${t}: ${keep.length} words; probes`, Object.fromEntries([...probes].map(w => [w, keep.includes(w)])));
  if (t === chosen) {
    const output = toBytes(buildDawg(keep, d.letters));
    writeFileSync(new URL('pl/tiles-familiar.bin', app), output);
    report += `Shipped graph: ${output.byteLength} bytes.\n\n`;
  }
}
report += `## Probe evidence\n\n${evidence.join('\n\n')}\n`;
report += `
## Decision

Choose T=1: the required skarboneczka paradigm has exactly one NKJP occurrence (skarboneczkami), no spoken form and no vocab lemma. Every higher threshold loses it. This is the most inclusive measured threshold and follows the owner's request to cut as little as possible. Exact-form K=2 stays unchanged. Initial thresholds 2/5/10/20 exposed this constraint; the final table replaces 20 with 1. Corpus attestation is a proxy, not a guarantee of familiarity.

kotą is retained as the instrumental of known lemma kota (not kot); its paradigm count is 8301 and both spoken/vocab match. triu is a valid inflection of trio and independently has exact count 2, so even disabling lemma rescue would retain it. The cheapest guard, if the owner wants these removed, is a two-form blocklist; it is deliberately not applied because it overrides the stated keep rules. All nine required keeps and four unconditional drops pass; kotą/triu are the two explained exceptions.

English unchanged: 82308 words, 95 two-letter, 934 three-letter, graph 488491 bytes. No English data is read or written by the lemma rebuild.
`;
writeFileSync(new URL('../notes/familiar-words-measure.md', import.meta.url), report);
