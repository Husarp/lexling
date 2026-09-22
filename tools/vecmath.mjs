// Vector post-processing for the word data. All matrices are Float32Array, n rows × d columns.

export function normalizeRows(x, n, d) {
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = i * d; k < (i + 1) * d; k++) s += x[k] * x[k];
    s = Math.sqrt(s) || 1;
    for (let k = i * d; k < (i + 1) * d; k++) x[k] /= s;
  }
}

export function meanRow(x, n, d) {
  const mu = new Float64Array(d);
  for (let i = 0; i < n; i++) for (let k = 0; k < d; k++) mu[k] += x[i * d + k];
  return mu.map(v => v / n);
}

// "All-but-the-top" (Mu & Viswanath 2018): subtract the mean vector and project out the few dominant
// principal components. Those directions encode word frequency rather than meaning, and they are what
// makes generic words ("well", "humanity") look close to everything.
export function allButTheTop(x, n, d, components) {
  const mu = meanRow(x, n, d);
  for (let i = 0; i < n; i++) for (let k = 0; k < d; k++) x[i * d + k] -= mu[k];
  if (!components) return;
  const cov = new Float64Array(d * d);
  for (let i = 0; i < n; i++) {
    const o = i * d;
    for (let a = 0; a < d; a++) { const xa = x[o + a]; for (let b = a; b < d; b++) cov[a * d + b] += xa * x[o + b]; }
  }
  for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) cov[a * d + b] = cov[b * d + a];
  for (let c = 0; c < components; c++) {
    let v = Float64Array.from({ length: d }, (_, k) => Math.sin(k * 12.9898 + c) + 0.1);   // power iteration
    for (let it = 0; it < 200; it++) {
      const w = new Float64Array(d);
      for (let a = 0; a < d; a++) { let s = 0; for (let b = 0; b < d; b++) s += cov[a * d + b] * v[b]; w[a] = s; }
      const norm = Math.hypot(...w);
      v = w.map(t => t / norm);
    }
    let lambda = 0;
    for (let a = 0; a < d; a++) { let s = 0; for (let b = 0; b < d; b++) s += cov[a * d + b] * v[b]; lambda += v[a] * s; }
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) cov[a * d + b] -= lambda * v[a] * v[b];   // deflate
    for (let i = 0; i < n; i++) {
      let p = 0;
      for (let k = 0; k < d; k++) p += x[i * d + k] * v[k];
      for (let k = 0; k < d; k++) x[i * d + k] -= p * v[k];
    }
  }
}

// hub[i] = average cosine of word i to the whole vocabulary = u_i · mean(u)   (rows must be unit length)
export function hubness(x, n, d) {
  const mu = meanRow(x, n, d), hub = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < d; k++) s += x[i * d + k] * mu[k]; hub[i] = s; }
  return hub;
}

// the game's score of every word against `secret` (must mirror app/js/engine.js rankAll)
export function scores(x, n, d, secret, hub, lambda, out = new Float32Array(n)) {
  const s0 = secret * d;
  for (let i = 0; i < n; i++) {
    let dot = 0;
    for (let k = 0, o = i * d; k < d; k++) dot += x[o + k] * x[s0 + k];
    out[i] = dot - lambda * hub[i];
  }
  return out;
}

export function ranksFrom(score, secret) {
  const n = score.length, order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => score[b] - score[a]);
  const rank = new Int32Array(n);
  let pos = 0;
  for (const i of order) rank[i] = i === secret ? 0 : ++pos;
  return { rank, order };
}
