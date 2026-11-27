const LABELS = '.btn, .seg button, .chip, .topbar .mode-tag';
export const BUTTON_SCALES = [1, 1.15, 1.3, 1.5, 1.75];
export const TEXT_SCALES = [1, 1.15, 1.3];
let range;

function labelOverflows(el) {
  const css = getComputedStyle(el), box = el.getBoundingClientRect();
  range ??= document.createRange();
  range.selectNodeContents(el);
  const text = range.getBoundingClientRect();
  return text.right > box.right - parseFloat(css.paddingRight) - parseFloat(css.borderRightWidth) + 1
    || text.left < box.left + parseFloat(css.paddingLeft) + parseFloat(css.borderLeftWidth) - 1;
}

function fitLabels(root) {
  for (const el of root.querySelectorAll(LABELS)) {
    if (!el.offsetWidth) continue;
    el.classList.remove('tight-label', 'wrapped');
    if (!labelOverflows(el)) continue;
    el.classList.add('tight-label');
    if (labelOverflows(el)) el.classList.add('wrapped');
  }
  const submit = root.querySelector('.guess-input .submit');
  if (submit) submit.previousElementSibling.style.paddingRight = submit.offsetWidth + 16 + 'px';
}

function fitsScreen(screen, viewport) {
  if (screen.scrollWidth > screen.clientWidth + 1) return false;
  if (screen.matches('.fit, [data-screen=menu], [data-screen=games]')) {
    return screen.scrollHeight <= viewport.clientHeight + 1;
  }
  // Long pages can scroll. Keep the part of Guess above its scrolling history in view when possible.
  const entry = screen.querySelector('#entry');
  return !entry || entry.offsetTop + entry.offsetHeight <= viewport.clientHeight + 1;
}

function fitScope(scope, fits) {
  const style = scope.style;
  style.removeProperty('--spacing');
  style.removeProperty('--button-scale');
  style.removeProperty('--text-scale');
  const css = getComputedStyle(scope);
  const buttonScale = Number(css.getPropertyValue('--button-scale'));
  const textScale = Number(css.getPropertyValue('--text-scale'));
  const fitsWithLabels = () => { fitLabels(scope); return fits(); };

  // Always lay out within the safe viewport. Start at the saved sizes on each screen,
  // then tighten spacing, step down button size, and finally step down text size.
  // Stop at 100% for either size. Lists can scroll at the chosen sizes. If everything
  // else still needs more room, let the safe viewport (or dialog) scroll too.
  if (fitsWithLabels()) return;
  style.setProperty('--spacing', '.6');
  if (fitsWithLabels()) return;
  for (const scale of [...BUTTON_SCALES].reverse().filter(scale => scale < buttonScale)) {
    style.setProperty('--button-scale', scale);
    if (fitsWithLabels()) return;
  }
  for (const scale of [...TEXT_SCALES].reverse().filter(scale => scale < textScale)) {
    style.setProperty('--text-scale', scale);
    if (fitsWithLabels()) return;
  }
}

export function fitAll(root = document.getElementById('root')) {
  const screen = root.firstElementChild;
  if (root.clientWidth && screen?.matches('.app')) {
    fitScope(screen, () => fitsScreen(screen, root));
    const pop = screen.querySelector('.cn-pop');
    if (pop) {
      const room = pop.parentElement.getBoundingClientRect().top - root.getBoundingClientRect().top;
      pop.style.maxHeight = Math.max(0, room - 16) + 'px';
    }
  } else if (root.clientWidth && root.matches('dialog, .ota-banner')) {
    fitScope(root, () => root.scrollWidth <= root.clientWidth + 1 && root.scrollHeight <= root.clientHeight + 1);
  } else {
    fitLabels(root);
  }
}

export function watchResize(root) {
  const overlays = 'dialog[open], .ota-banner:not([hidden])';
  let frame;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fitAll(root);
      document.querySelectorAll(overlays).forEach(fitAll);
    });
  };
  new ResizeObserver(schedule).observe(root);
  // Viewport size can be unchanged when settings, a dialog, or the in-menu update notice changes.
  window.addEventListener('lexling:size', schedule);
  new MutationObserver(records => {
    if (records.some(({ target, addedNodes, removedNodes, type }) => {
      if (target.matches?.('.scroll-fade')) return false;
      if ([...addedNodes].some(node => node.matches?.(overlays))) return true;
      if (!target.closest?.(overlays + ', .upd-slot')) return false;
      return type !== 'childList'
        || [...addedNodes, ...removedNodes].some(node => !node.matches?.('.scroll-fade'));
    })) schedule();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] });
  schedule();
}
