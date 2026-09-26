// A word graph (a DAWG - "directed acyclic word graph"): every word of a list in a few typed arrays, with
// shared beginnings AND shared endings stored once. Small enough to hold the whole Polish list, and quick
// to walk letter by letter, which is what Tiles' move finder does all day (tiles-moves.js).
// Built with the incremental algorithm for sorted input (Daciuk, Mihov, Watson & Watson, 2000).

// `words`: any order, duplicates allowed; `alphabet`: every letter a word may use (other words are left
// out). A node is a number; its edges sit together in `letter` / `target`, from first[node] to
// first[node + 1], in alphabet order. Node 0 is the root. `tag` = a hash of the word list (FNV-1a): a
// saved game records it, so it is known which list checked its words (owner's plan: "a hash of the dictionary version").
export function buildDawg(words, alphabet) {
  const letters = [...alphabet].sort();                 // code-point order = the order the words sort in
  const index = new Map(letters.map((ch, i) => [ch, i]));
  const list = [...new Set(words.filter(w => [...w].every(ch => index.has(ch))))].sort();

  let made = 0;
  const node = () => ({ id: made++, final: false, keys: [], kids: [] });
  const root = node();
  const register = new Map();                            // signature -> the one node kept for it
  const sign = n => (n.final ? '1' : '0') + n.keys.map((k, i) => k + ':' + n.kids[i].id).join(',');
  const open = [];                                       // the newest word's path, not yet merged: [parent, child]
  const merge = downTo => {
    while (open.length > downTo) {
      const [parent, child] = open.pop();
      const key = sign(child), same = register.get(key);
      if (same) parent.kids[parent.kids.length - 1] = same;   // the child is always its parent's newest edge
      else register.set(key, child);
    }
  };
  let prev = [];
  for (const w of list) {
    const chars = [...w].map(ch => index.get(ch));
    let common = 0;
    while (common < chars.length && common < prev.length && chars[common] === prev[common]) common++;
    merge(common);
    let at = open.length ? open[open.length - 1][1] : root;
    for (let i = common; i < chars.length; i++) {
      const next = node();
      at.keys.push(chars[i]); at.kids.push(next);
      open.push([at, next]);
      at = next;
    }
    at.final = true;
    prev = chars;
  }
  merge(0);

  // number the nodes that survived (root first) and lay their edges out flat
  const order = [root], num = new Map([[root, 0]]);
  for (let i = 0; i < order.length; i++) for (const k of order[i].kids) if (!num.has(k)) { num.set(k, order.length); order.push(k); }
  const first = new Uint32Array(order.length + 1), final = new Uint8Array(order.length);
  let edges = 0;
  order.forEach((n, i) => { first[i] = edges; edges += n.keys.length; final[i] = n.final ? 1 : 0; });
  first[order.length] = edges;
  const letter = new Uint8Array(edges), target = new Uint32Array(edges);
  order.forEach((n, i) => n.keys.forEach((k, j) => { letter[first[i] + j] = k; target[first[i] + j] = num.get(n.kids[j]); }));
  let tag = 0x811c9dc5;
  for (const w of list) for (let i = 0; i <= w.length; i++) tag = Math.imul(tag ^ (i < w.length ? w.charCodeAt(i) : 10), 0x01000193) >>> 0;
  return { letters, index, first, letter, target, final, words: list.length, tag };
}

// Building takes 1.6 s for the Polish list on a PC - several on a phone - so the game will load a graph
// built ahead of time: these turn one into bytes for a data file and back. Layout: five Uint32 (nodes,
// edges, letters, word count, tag), first[], target[], the alphabet as UTF-16, then letter[] and final[].
export function toBytes(d) {
  const nodes = d.final.length, edges = d.letter.length, abc = d.letters.join('');
  const buf = new ArrayBuffer(20 + 4 * (nodes + 1) + 4 * edges + 2 * abc.length + edges + nodes);
  new Uint32Array(buf, 0, 5).set([nodes, edges, abc.length, d.words, d.tag]);
  let at = 20;
  new Uint32Array(buf, at, nodes + 1).set(d.first); at += 4 * (nodes + 1);
  new Uint32Array(buf, at, edges).set(d.target); at += 4 * edges;
  new Uint16Array(buf, at, abc.length).set([...abc].map(ch => ch.charCodeAt(0))); at += 2 * abc.length;
  new Uint8Array(buf, at, edges).set(d.letter); at += edges;
  new Uint8Array(buf, at, nodes).set(d.final);
  return new Uint8Array(buf);
}
export function fromBytes(buf) {
  const [nodes, edges, n, words, tag] = new Uint32Array(buf, 0, 5);
  let at = 20;
  const first = new Uint32Array(buf, at, nodes + 1); at += 4 * (nodes + 1);
  const target = new Uint32Array(buf, at, edges); at += 4 * edges;
  const letters = [...new Uint16Array(buf, at, n)].map(c => String.fromCharCode(c)); at += 2 * n;
  const letter = new Uint8Array(buf, at, edges); at += edges;
  const final = new Uint8Array(buf, at, nodes);
  return { letters, index: new Map(letters.map((ch, i) => [ch, i])), first, letter, target, final, words, tag };
}

// the node reached from `n` by letter index `k`, or -1
export function step(d, n, k) {
  for (let e = d.first[n], end = d.first[n + 1]; e < end; e++) {
    if (d.letter[e] === k) return d.target[e];
    if (d.letter[e] > k) break;
  }
  return -1;
}

// is `word` in the graph?
export function has(d, word) {
  let n = 0;
  for (const ch of word) {
    const k = d.index.get(ch);
    if (k === undefined || (n = step(d, n, k)) < 0) return false;
  }
  return d.final[n] === 1;
}
