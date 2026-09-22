// Minimal Hunspell reader: enough of the .aff/.dic format to expand a base word into its affixed forms.
// (No compounding, no continuation flags - neither dictionary we use has them on the rules we apply.)
import { readFileSync } from 'node:fs';

export function readAff(path, encoding) {
  const aff = { SFX: {}, PFX: {} };
  for (const line of new TextDecoder(encoding).decode(readFileSync(path)).split(/\r?\n/)) {
    const p = line.trim().split(/\s+/);
    if ((p[0] !== 'SFX' && p[0] !== 'PFX') || p.length < 5) continue;   // headers ("SFX S Y 4") have 4 fields
    const [type, flag, strip, addRaw, cond] = p;
    const add = addRaw.split('/')[0];
    (aff[type][flag] ??= []).push({
      strip: strip === '0' ? '' : strip,
      add: add === '0' ? '' : add,
      cond: cond === '.' ? null : new RegExp(type === 'SFX' ? `${cond}$` : `^${cond}`),
    });
  }
  return aff;
}

export function readDic(path, encoding) {
  return new TextDecoder(encoding).decode(readFileSync(path)).split(/\r?\n/).slice(1).filter(Boolean).map(line => {
    const [word, flags = ''] = line.split(/\s/)[0].split('/');
    return { word, flags };
  });
}

export function suffixed(aff, word, flag) {
  const out = [];
  for (const r of aff.SFX[flag] || []) {
    if (r.cond && !r.cond.test(word)) continue;
    if (r.strip && !word.endsWith(r.strip)) continue;
    out.push(word.slice(0, word.length - r.strip.length) + r.add);
  }
  return out;
}

export function prefixed(aff, word, flag) {
  const out = [];
  for (const r of aff.PFX[flag] || []) {
    if (r.cond && !r.cond.test(word)) continue;
    if (r.strip && !word.startsWith(r.strip)) continue;
    out.push(r.add + word.slice(r.strip.length));
  }
  return out;
}
