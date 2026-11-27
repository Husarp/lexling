// Owner, 2026-11-20: the same quiet continuation cue on pages and in floating windows.
export const hasMoreBelow = el => el.scrollHeight - el.clientHeight - el.scrollTop > 1;
const SCROLLERS = '.games-scroll, .lt-board, .tl-vote, .tl-hand, .tl-pick, .tl-toast, .cn-pop, .op-content, .chapter-body, dialog[open], .tl-panel, .tl-messages, .tl-dock, .word-meaning, .cat-about, #level-help, #msg, .msg, .hist';

export function watchScrollFades(page) {
  const fades = new Map();
  let frame = 0;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const resize = new ResizeObserver(schedule);
  const watched = new Set();
  function paint() {
    frame = 0;
    const safe = page.getBoundingClientRect();
    const candidates = new Set([page, ...document.querySelectorAll(SCROLLERS)]);
    const topbar = document.querySelector('.topbar');
    document.documentElement.style.setProperty('--topbar-h', topbar && getComputedStyle(topbar).position === 'sticky' ? `${topbar.getBoundingClientRect().height}px` : '0px');
    const nextWatched = new Set([document.body, topbar, ...candidates].filter(Boolean));
    // Content can grow without changing its scroll box (expanded settings, loaded history).
    for (const el of candidates) if (el?.firstElementChild) nextWatched.add(el.firstElementChild);
    for (const el of watched) if (!nextWatched.has(el)) { resize.unobserve(el); watched.delete(el); }
    for (const el of nextWatched) if (!watched.has(el)) { resize.observe(el); watched.add(el); }
    for (const [el, fade] of fades) if (!candidates.has(el) || !el.isConnected) { fade.remove(); fades.delete(el); }
    for (const el of candidates) {
      if (!el) continue;
      const isPage = el === page;
      const css = getComputedStyle(el);
      const scrolling = isPage || /auto|scroll/.test(css.overflowY);
      let fade = fades.get(el);
      const rect = el.getBoundingClientRect();
      const visible = scrolling && hasMoreBelow(el) && rect.height > 32 && rect.bottom > safe.top + 28 && rect.top < safe.bottom;
      if (!visible) { if (fade) fade.hidden = true; continue; }
      if (!fade) {
        fade = document.createElement('div');
        fade.className = 'scroll-fade';
        fade.setAttribute('aria-hidden', 'true');
        // Modal dialogs live above the document's stacking contexts.
        (el.closest('dialog') ?? document.body).append(fade);
        fades.set(el, fade);
      }
      let surface = el;
      while (surface.parentElement && ['transparent', 'rgba(0, 0, 0, 0)'].includes(getComputedStyle(surface).backgroundColor)) surface = surface.parentElement;
      const left = Math.max(safe.left, rect.left), right = Math.min(safe.right, rect.right);
      fade.style.cssText = `left:${left}px;top:${Math.min(safe.bottom, rect.bottom) - 28}px;width:${Math.max(0, right - left)}px;--fade-surface:${getComputedStyle(surface).backgroundColor}`;
      fade.hidden = false;
    }
  }
  // Ignore our own decorations; otherwise adding a fade would schedule another scan.
  const mutations = new MutationObserver(records => {
    if (records.some(r => !r.target.classList?.contains('scroll-fade') && (r.type !== 'childList' || [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType !== 1 || !n.classList.contains('scroll-fade'))))) schedule();
  });
  mutations.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
  document.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    cancelAnimationFrame(frame); mutations.disconnect(); resize.disconnect();
    document.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    for (const fade of fades.values()) fade.remove();
  };
}
