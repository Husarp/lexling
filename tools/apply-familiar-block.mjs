// Removes the words in tools/familiar-block-pl.txt from the shipped Polish familiar graph,
// without the raw sources. build-familiar-lemmas.mjs reads the same file on a full rebuild.
import { readFileSync, writeFileSync } from 'node:fs';
import { fromBytes, buildDawg, toBytes } from '../app/js/dawg.js';
const file = new URL('../app/data/pl/tiles-familiar.bin', import.meta.url);
const block = new Set(readFileSync(new URL('familiar-block-pl.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(w => w && !w.startsWith('#')));
const buf = readFileSync(file);
const d = fromBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
function* enumerate(n = 0, prefix = '') {
  if (d.final[n]) yield prefix;
  for (let e = d.first[n]; e < d.first[n + 1]; e++) yield* enumerate(d.target[e], prefix + d.letters[d.letter[e]]);
}
const all = [...enumerate()], keep = all.filter(w => !block.has(w));
writeFileSync(file, toBytes(buildDawg(keep, d.letters)));
console.log(`pl familiar: ${all.length} -> ${keep.length} (${all.length - keep.length} removed)`);
