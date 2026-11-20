import { TIERS, TIERED, CHALLENGES, progress, gotAt } from './achievements.js';
import { achievementIcon, achievementLock, tierShape } from './achievement-icons.js';
import { t, num, dateTime } from './i18n.js';

export const achievementInk = level => level < 0 ? 'var(--text-muted)' : level === 5 ? 'var(--accent)' : `var(--tier-${TIERS[level]})`;
export function achievementState(d) {
  return d.th ? progress(d).tiers - 1 : gotAt(d.id) === null ? -1 : 5;
}
export const achievementPips = level => `<span class="ach-pips">${TIERS.map((_, i) => tierShape(i, i <= level)).join('')}</span>`;
export function achievementBar(d) {
  const p = progress(d), max = p.next ?? d.th.at(-1);
  return `<div class="ach-bar" role="progressbar" aria-label="${t('ach.' + d.id)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(p.value, max)}"><i style="width:${p.pct}%"></i></div>`;
}
export function achievementDetail(id) {
  const d = [...TIERED, ...CHALLENGES].find(d => d.id === id);
  if (!d) return;
  document.querySelectorAll('.achievement-detail').forEach(d => { d.close(); d.remove(); });
  const dialog = document.createElement('dialog'), level = achievementState(d);
  dialog.className = 'achievement-detail';
  dialog.setAttribute('aria-labelledby', 'ach-detail-title');
  dialog.style.setProperty('--ink', achievementInk(level));
  dialog.innerHTML = `<form method="dialog"><button class="btn btn-ghost ach-close" aria-label="${t('ach.nice')}">×</button></form><div class="ach-hero ${level < 0 ? 'locked' : 'earned'}">${achievementIcon(id)}${level < 0 ? achievementLock : ''}${d.th ? achievementPips(level) : ''}<h2 id="ach-detail-title">${t('ach.' + id)}</h2><p class="help">${t('ach.' + id + '.d')}</p>${d.th ? `<b class="num">${num(progress(d).value)}</b>` : ''}</div>${d.th ? d.th.map((threshold, i) => {
    const at = gotAt(`${id}#${i}`), next = i === progress(d).tiers;
    return `<div class="ach-step" style="--ink:${achievementInk(i)}">${tierShape(i)}<div><strong>${t('tier.' + TIERS[i])} · ${num(threshold)}</strong>${at !== null ? `<small>${t('ach.got', { d: dateTime(at) })}</small>` : next ? `${achievementBar(d)}<small>${num(progress(d).value)} / ${num(threshold)} · ${t('ach.toGo', { n: num(threshold - progress(d).value), tier: t('tier.' + TIERS[i]) })}</small>` : `<small>${t('ach.locked')}</small>`}</div>${at === null ? achievementLock : '✓'}</div>`;
  }).join('') : `<p class="ach-step">${level < 0 ? achievementLock + t('ach.locked') : t('ach.got', { d: dateTime(gotAt(id)) })}</p>`}`;
  dialog.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dialog.close(); } });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  document.body.append(dialog);
  dialog.showModal();
}
