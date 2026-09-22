// Text-fit guarantee: a label that is longer in one language must never overflow or clip its box.
// Single-line controls first shrink their font (down to 72 %), then drop letter-spacing, and only
// as a last resort wrap onto two lines.
const SELECTOR = '.btn, .seg button, .chip, .brand, .lang-switch button';
// scrollWidth only grows once text passes the padding too, so the content is measured against the
// content box: a label may not even eat into its button's padding.
const range = document.createRange();
function overflows(el) {
  if (el.scrollWidth > el.clientWidth + 0.5) return true;
  const css = getComputedStyle(el), box = el.getBoundingClientRect();
  range.selectNodeContents(el);
  const text = range.getBoundingClientRect();
  return text.right > box.right - parseFloat(css.paddingRight) - parseFloat(css.borderRightWidth) + 0.5
    || text.left < box.left + parseFloat(css.paddingLeft) + parseFloat(css.borderLeftWidth) - 0.5;
}

function fit(el) {
  el.style.fontSize = el.style.letterSpacing = '';
  el.classList.remove('wrapped');
  if (!overflows(el)) return;
  // Tracking goes first: nobody notices a label losing its letter-spacing, everybody notices it
  // shrinking. Only then the font size, and wrapping as a last resort.
  el.style.letterSpacing = '0';
  if (!overflows(el)) return;
  const base = parseFloat(getComputedStyle(el).fontSize);
  for (let size = base - 0.5; size >= base * 0.72; size -= 0.5) {
    el.style.fontSize = size + 'px';
    if (!overflows(el)) return;
  }
  if (overflows(el)) el.classList.add('wrapped');
}

export function fitAll(root = document) {
  root.querySelectorAll(SELECTOR).forEach(fit);
  // the guess field reserves room for its submit button, whose width depends on the language
  const submit = root.querySelector('.guess-input .submit');
  if (submit) submit.previousElementSibling.style.paddingRight = submit.offsetWidth + 16 + 'px';
}

// Re-fit when the window gets wider or narrower. Height changes are ignored: fitting can itself change
// the height (a label wrapping), and reacting to that would loop.
export function watchResize(root) {
  let width = 0;
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === width) return;
    width = entry.contentRect.width;
    fitAll(root);
  }).observe(root);
}
