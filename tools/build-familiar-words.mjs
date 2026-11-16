// Base exact-form filters over the shipped SJP/ENABLE graphs, then Polish lemma rescue.
// Download into tools/raw/familiar/: NKJP 1grams.gz from
// https://zil.ipipan.waw.pl/NKJPNGrams?action=AttachFile&do=get&target=1grams.gz
// and extract https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz there.
// Run node tools/build-familiar-words.mjs. Raw sources stay outside git.
import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fromBytes, buildDawg, toBytes } from '../app/js/dawg.js';
import { TWO } from '../app/js/tiles-moves.js';
const raw = new URL('raw/familiar/', import.meta.url), app = new URL('../app/data/', import.meta.url);
const scowl = new URL('scowl-2020.12.07/', raw);
const bytes = readFileSync(new URL('1grams.gz', raw));
const freq = new Map();
for (const line of gunzipSync(bytes).toString('utf8').split('\n')) {
  const m = line.match(/^\s*(\d+)\s+(\S+)\s*$/);
  if (m && /^[a-ząćęłńóśźż]{2,15}$/.test(m[2])) freq.set(m[2], Number(m[1]));
}
const english = new Set();
for (const file of readdirSync(new URL('final/', scowl))) {
  const m = file.match(/^(english|american|british|british_z)-words\.(\d+)$/);
  if (m && Number(m[2]) <= 60) for (const w of readFileSync(new URL('final/' + file, scowl), 'utf8').split(/\r?\n/)) english.add(w);
}
export function* enumerate(d, n = 0, prefix = '') {
  if (d.final[n]) yield prefix;
  for (let e = d.first[n]; e < d.first[n + 1]; e++) yield* enumerate(d, d.target[e], prefix + d.letters[d.letter[e]]);
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
let report = `# Familiar words measurements\n\nExact spellings intersected with shipped graphs. No lemma expansion or case folding.\nNKJP compressed SHA-256: ${createHash('sha256').update(bytes).digest('hex')}.\nSCOWL 2020.12.07: english/american/british/british_z words categories, sizes ≤60.\nSpoken lists and exported TWO sets are unioned before blocking PL yoni / EN yoni, xu.\nNo additional allowlist. Samples: reservoir 30, LCG 1664525/1013904223, seeds 20261116 kept / 20261117 dropped.\n\n`;
for (const lang of ['pl', 'en']) {
  const buf = readFileSync(new URL(`${lang}/tiles.bin`, app));
  const d = fromBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const all = [...enumerate(d)], spoken = new Set(readFileSync(new URL(`${lang}/spoken.txt`, app), 'utf8').split('\n'));
  for (const k of lang === 'pl' ? [2, 3, 5, 10] : [60]) {
    const keep = [], drop = [], blocked = new Set(lang === 'pl' ? ['yoni'] : ['yoni', 'xu']);
    for (const w of all) ((lang === 'pl' ? (freq.get(w) ?? 0) >= k : english.has(w)) || spoken.has(w) || TWO[lang].has(w)) && !blocked.has(w) ? keep.push(w) : drop.push(w);
    report += `## ${lang.toUpperCase()} ${lang === 'pl' ? 'K=' : 'SCOWL size '}${k}\n\nFull: ${all.length}; kept: ${keep.length}; dropped: ${drop.length}; 2-letter: ${keep.filter(w => w.length === 2).length}; 3-letter: ${keep.filter(w => w.length === 3).length}.\n\nKept (30): ${sample(keep, 20261116)}.\n\nDropped (30): ${sample(drop, 20261117)}.\n\n`;
    if (lang === 'en' || k === 2) {
      const output = toBytes(buildDawg(keep, d.letters));
      writeFileSync(new URL(`${lang}/tiles-familiar.bin`, app), output);
      report += `Shipped graph: ${output.byteLength} bytes.\n\n`;
      console.log(`${lang}: ${keep.length} words, ${output.byteLength} bytes`);
    }
  }
}
report += '## Decision\n\nChoose K=2: it retains the most exact attested forms of the tested thresholds, while removing singleton corpus oddities; spoken words and TWO rescue ordinary omissions. Higher thresholds remove more attested inflections without evidence that they are strange. Frequency remains a proxy: this option cannot guarantee that every surviving word is familiar or every ordinary form survives. Explicit blocks remove yoni in both languages and xu in English.\n';
writeFileSync(new URL('../notes/familiar-words-measure.md', import.meta.url), report);
copyFileSync(new URL('Copyright', scowl), new URL('SCOWL-Copyright.txt', app));

// Ticket 27 is the final Polish selection; English stays at ticket 26.
await import('./build-familiar-lemmas.mjs');
