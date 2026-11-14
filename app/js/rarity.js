// Rarity of the base word; configurable colour limits in percent (owner, 2026-11-14).
export const RARE_TIERS = [1, 5, 20];
export const TIER_KEYS = ['purple', 'gold', 'blue', 'grey'];

export function rarePct(rank, count) {
  if (!Number.isFinite(rank) || !Number.isFinite(count) || count <= 0 || rank >= count) return null;
  return Math.max(1, Math.min(100, Math.ceil((count - rank) / count * 100)));
}

export function tierOf(pct, tiers = RARE_TIERS) {
  return pct === null ? 'purple' : TIER_KEYS[tiers.findIndex(limit => pct <= limit)] ?? 'grey';
}

export function cleanTiers(list) {
  // Accept integers and numeric input strings; any invalid value/order resets the whole list.
  if (!Array.isArray(list) || list.length !== 3) return [...RARE_TIERS];
  const tiers = Array.from(list, v => typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN);
  return tiers.every((v, i) => Number.isInteger(v) && v >= 1 && v <= 100 && (!i || v > tiers[i - 1])) ? tiers : [...RARE_TIERS];
}

export function moveRarity(words, rankOf, count, tiers = RARE_TIERS) {
  // The rarest word counts; a word outside the list beats every listed word (owner, 2026-11-14).
  let rarest = null;
  for (const { w } of words) {
    const rank = rankOf(w), pct = rarePct(rank, count);
    if (!rarest || (rarest.pct !== null && (pct === null || rank > rarest.rank))) rarest = { w, rank, pct, tier: tierOf(pct, tiers) };
  }
  return rarest;
}

export function listedPct(words, rankOf, count) {
  // A listed rare word still earns its challenge beside an unlisted word (owner, 2026-11-14).
  let rarest = null;
  for (const { w } of words) {
    const pct = rarePct(rankOf(w), count);
    if (pct !== null && (rarest === null || pct < rarest)) rarest = pct;
  }
  return rarest;
}
