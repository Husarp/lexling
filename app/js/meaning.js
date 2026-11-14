// Wiktionary responses stay local to this device, in memory for this session.
export function plain(text) {
  return String(text).replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1').replace(/\{\{nazwa systematyczna\|([^|}]+)[^}]*\}\}/g, '$1').replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/'{2,}/g, '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, e) => {
      if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()];
    }).replace(/\s+/g, ' ').trim();
}
const isForm = text => /forma fleksyjna|\bzob\.|form[ay] (?:od|czasownika|rzeczownika|przymiotnika)|\b(?:(?:plural|singular|third-person singular)(?:\s+\w+)*|inflection|past participle|past tense|present participle|comparative|superlative|alternative form) of\b/i.test(text);
export function parseMeaning(data, lang) {
  let definitions;
  if (lang === 'pl') {
    const raw = data?.parse?.wikitext, text = typeof raw === 'string' ? raw : raw?.['*'] ?? '';
    const section = text.split(/^==[^\n]*\{\{język polski\}\}[^\n]*==\s*$/m)[1]?.split(/^==[^=]/m)[0] ?? '';
    const meanings = section.split(/\{\{znaczenia\}\}/i)[1]?.split(/\{\{(?:odmiana|przykłady|składnia|kolokacje|synonimy|antonimy|etymologia|uwagi|tłumaczenia|źródła)\}\}/i)[0] ?? '';
    definitions = [...meanings.matchAll(/^:\s*\([\d.]+\)\s*(.+)$/gm)].map(m => ({ text: plain(m[1]), form: isForm(m[1]) }));
    if (/forma fleksyjna/i.test(meanings)) definitions = definitions.map(d => ({ ...d, form: true }));
  } else definitions = (data?.en ?? []).flatMap(entry => (entry.definitions ?? []).map(d => ({ text: plain(d.definition), form: isForm(plain(d.definition)) })));
  const real = definitions.filter(d => d.text && !d.form).map(d => d.text);
  return { meanings: [...new Set(real)].slice(0, 8), form: definitions.length > 0 && !real.length };
}
const cache = new Map();
export async function lookupMeaning(word, lang, base = word, fetcher = fetch) {
  const key = `${lang}:${word}:${base}`;
  if (globalThis.navigator?.onLine === false) throw new Error('offline');
  if (cache.has(key)) return cache.get(key);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6000);
  const read = async w => {
    const url = lang === 'pl' ? `https://pl.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(w)}&prop=wikitext&format=json&origin=*`
      : `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(w)}`;
    const res = await fetcher(url, { signal: controller.signal });
    if (res.status === 404) return { meanings: [], form: false };
    if (!res.ok) throw new Error('fetch');
    const data = await res.json();
    if (data.error && data.error.code !== 'missingtitle') throw new Error('fetch');
    return parseMeaning(data, lang);
  };
  try {
    let result = await read(word);
    if (!result.meanings.length && base && base !== word) result = { ...await read(base), form: true, base };
    cache.set(key, result);
    return result;
  } finally { clearTimeout(timer); }
}
