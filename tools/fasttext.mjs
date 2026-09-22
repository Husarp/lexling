// Streaming access to the fastText .vec.gz files (2M lines of "token v1 … v300", most frequent first).
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAW = join(dirname(fileURLToPath(import.meta.url)), 'raw');
const vecFile = lang => join(RAW, `cc.${lang}.300.vec.gz`);
export const DIMS = 300;

// calls onLine(buffer, start, end) for every line after the header; return false to stop early
async function eachLine(path, onLine) {
  let rest = Buffer.alloc(0), first = true;
  const stream = createReadStream(path).pipe(createGunzip());
  for await (const chunk of stream) {
    const buf = rest.length ? Buffer.concat([rest, chunk]) : chunk;
    let start = 0, nl;
    while ((nl = buf.indexOf(10, start)) !== -1) {
      if (first) first = false;
      else if (onLine(buf, start, nl) === false) { stream.destroy(); return; }
      start = nl + 1;
    }
    rest = buf.subarray(start);
  }
}

// Map token -> frequency rank, for the tokens accepted by `wordRe` (lower-case words only). Cached.
export async function tokenRanks(lang, wordRe) {
  const cache = join(RAW, `cc.${lang}.tokens.txt`);
  if (!existsSync(cache)) {
    const tokens = [];
    await eachLine(vecFile(lang), (buf, start) => {
      const token = buf.toString('utf8', start, buf.indexOf(32, start));
      if (wordRe.test(token)) tokens.push(token);
    });
    writeFileSync(cache, tokens.join('\n'));
  }
  return new Map(readFileSync(cache, 'utf8').split('\n').map((t, i) => [t, i]));
}

// Float32Array (words.length × 300) with the vectors of `words`, row i = words[i]. Cached per word list.
export async function vectorsOf(lang, words) {
  const cacheBin = join(RAW, `${lang}.vectors.f32`), cacheList = join(RAW, `${lang}.vectors.txt`);
  const key = words.join('\n');
  if (existsSync(cacheBin) && readFileSync(cacheList, 'utf8') === key) {
    const b = readFileSync(cacheBin);
    return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  }
  const row = new Map(words.map((w, i) => [w, i]));
  const out = new Float32Array(words.length * DIMS);
  let missing = words.length;
  await eachLine(vecFile(lang), (buf, start, end) => {
    const space = buf.indexOf(32, start);
    const i = row.get(buf.toString('utf8', start, space));
    if (i === undefined) return;
    const nums = buf.toString('latin1', space + 1, end).split(' ');
    for (let d = 0; d < DIMS; d++) out[i * DIMS + d] = +nums[d];
    row.delete(words[i]);   // a token can appear once only; first (most frequent) wins
    if (--missing === 0) return false;
  });
  if (missing) throw new Error(`${missing} words have no vector, e.g. ${[...row.keys()].slice(0, 5)}`);
  writeFileSync(cacheBin, Buffer.from(out.buffer));
  writeFileSync(cacheList, key);
  return out;
}
