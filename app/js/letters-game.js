// The Letters game screen - markup from handoff-letters/game-letters.html (playing) and
// game-letters-end.html (won / lost / gave up), with the dummy text replaced by t(...) and live data.
import { t, plural, esc, num, decimal } from './i18n.js';
import { stats, saveStats, getSave, putSave, gameName, recordLettersEnd, playClock } from './store.js';
import { loadWords, resolve } from './engine.js';
import { feedback, score, points, MULTIPLIER, MARKED } from './letters.js';
import { topbar, modeTag, confirmClick, TILE, squares } from './ui.js';
import { fitAll } from './fit.js';
import { click, chime } from './sound.js';

const SHARE = { hit: '🟩', near: '🟨', miss: '⬛' };

export async function lettersGameScreen(root, id) {
  const game = getSave(id);
  const m = game && await loadWords(game.lang);
  if (!m) { location.replace('#/games/letters'); return; }
  const n = game.len;
  const tries = game.tries || '∞';           // 0 = unlimited
  const playing = () => game.status === 'playing';
  let bad = false;                           // the row was sent short: outlined red until the next key

  root.innerHTML = `<div class="app" data-screen="letters">
  ${topbar({ left: modeTag('letters'), right: `<span class="eyebrow">${esc(gameName(game))}</span>` })}
  <main class="main"></main>
</div>`;
  const app = root.firstElementChild, main = app.querySelector('main');
  const $ = sel => main.querySelector(sel);
  const refit = () => fitAll(root);
  let board, sink;

  // ── rows ──
  const tiles = (cls, letters = []) => cls.map((c, i) => `<span class="lt ${c}" style="--i:${i}">${esc(letters[i] ?? '')}</span>`).join('');
  const past = (w, reveal) => `<div class="lt-row${reveal ? ' reveal' : ''}" style="--n:${n}" aria-label="${esc(w)}">${
    tiles(feedback(w, game.secret).map(f => TILE[f]), [...w])}</div>`;
  const blank = () => Array(n).fill('');

  function paintBoard(reveal = false) {
    const rows = game.guesses.map((w, i) => past(w, reveal && i === game.guesses.length - 1));
    if (playing()) {
      rows.push(`<div class="lt-row now" style="--n:${n}">${tiles(blank())}</div>`);
      // with a limit, the tries still to come are drawn empty; unlimited just grows a row per guess
      if (game.tries) for (let k = game.guesses.length + 1; k < game.tries; k++) {
        rows.push(`<div class="lt-row future" style="--n:${n}" aria-hidden="true">${tiles(blank())}</div>`);
      }
    }
    board.innerHTML = rows.join('');
    if (playing()) paintNow();
  }

  // The current row only draws what the hidden field holds: typed letters, then the caret box.
  function paintNow() {
    const typed = [...sink.value.toLowerCase()];
    const now = board.querySelector('.lt-row.now');
    if (!now) return;                        // the game has just ended: no row to type into
    now.classList.toggle('bad', bad);
    [...now.children].forEach((el, i) => {
      el.textContent = typed[i] ?? '';
      el.className = 'lt' + (i < typed.length ? ' typed' : i === typed.length ? ' caret' : '');
    });
    $('.entry .count').innerHTML = !typed.length && document.activeElement !== sink
      ? `<span class="arrow">→</span> ${t('lt.tap')}`
      : t('lt.typed', { a: `<span class="num">${typed.length}</span>`, n, letters: plural(n, 'lt.letters') });
    const submit = $('.entry .submit');
    submit.classList.toggle('btn-primary', typed.length === n);
    submit.classList.toggle('btn-outline', typed.length < n);
  }

  // With the keyboard open the grid is the part that scrolls: keep it at the current row.
  const keepDown = () => {
    if (board?.isConnected && document.documentElement.hasAttribute('data-kb')) board.scrollTop = board.scrollHeight;
  };

  function say(text, error = false) {
    const msg = $('.msg');
    msg.textContent = text;
    msg.classList.toggle('err', error);
  }

  function paintStatus() {
    const stat = (label, value, bold = true) => `<div class="stat"><span class="eyebrow">${label}</span><span class="num"${bold ? ' style="font-weight:700"' : ''}>${value}</span></div>`;
    $('.status').innerHTML = stat(t('lt.tries'), `${game.guesses.length}<span class="muted" style="font-weight:700"> / ${tries}</span>`, false)
      + stat(t('lt.length'), n, false)
      + stat(t('game.category'), t('cat.' + game.cat))
      + stat(t('game.language'), game.lang.toUpperCase())
      + `<div class="status-actions"><a class="btn btn-ghost" href="#/games/letters">${t('game.saveExit')}</a><button class="btn btn-ghost btn-danger" type="button" id="give-up">${t('game.giveUp')}</button></div>`;
    confirmClick($('#give-up'), () => playing() && finish('gaveup'), refit);
  }

  function paintPlay() {
    main.innerHTML = `<div class="status"></div>
    <div class="play">
      <p class="msg help" role="status" aria-live="polite"></p>
      <div class="lt-board" role="grid" aria-label="${t('game.guesses')}"></div>
      <div class="entry">
        <span class="count"></span>
        <button class="btn btn-outline submit" type="button">${t('lt.submit')} <span class="arrow">→</span></button>
      </div>
      <input class="sink" type="text" inputmode="text" enterkeyhint="go" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="${n}" aria-label="${t('game.inputAria')}">
    </div>
    ${game.guesses.length ? '' : `<div class="card how">
      <h2>${t('lt.howTitle')}</h2>
      <ul class="key3">
        <li>${squares(['hit'], 28, ['a'])}${t('lt.hit')}</li>
        <li>${squares(['near'], 28, ['b'])}${t('lt.near')}</li>
        <li>${squares(['miss'], 28, ['c'])}${t('lt.miss')}</li>
      </ul>
      <p class="help"><span class="arrow">→</span> ${t('lt.howNote')}</p>
    </div>`}`;
    board = $('.lt-board');
    sink = $('.sink');
    paintStatus();
    paintBoard();

    // The field is invisible and takes no taps of its own: a tap anywhere on the game hands it the
    // focus, which is what opens the phone keyboard. Blur first - focusing a field that already has
    // the focus does not bring back a keyboard the player swiped away.
    main.addEventListener('click', e => {
      if (!playing() || e.target.closest('button, a')) return;
      sink.blur();
      sink.focus();
    });
    sink.addEventListener('focus', paintNow);
    sink.addEventListener('blur', paintNow);
    sink.addEventListener('input', () => {
      // letters only, never more than the word holds. Case is left alone - rewriting the field while
      // the phone keyboard is composing a word breaks it - and is dropped when the guess is read.
      const clean = [...sink.value].filter(ch => /\p{L}/u.test(ch)).slice(0, n).join('');
      if (clean !== sink.value) sink.value = clean;
      bad = false;
      say('');
      paintNow();
    });
    sink.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      // the caret always sits at the end, where the boxes draw it
      else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault();
    });
    const button = $('.entry .submit');
    button.addEventListener('pointerdown', e => e.preventDefault());   // keep the focus, and the phone keyboard
    button.addEventListener('click', () => { submit(); if (playing()) sink.focus(); });
    // A computer keyboard types straight away; a phone waits for a tap, so the keyboard does not jump
    // up over the how-to-play card the moment the screen opens.
    if (matchMedia('(pointer: fine)').matches) sink.focus();
    refit();
  }

  let revealing = false;
  function submit() {
    if (!playing() || revealing) return;
    const word = sink.value.toLowerCase();
    const k = [...word].length;
    if (k < n) {
      bad = true;
      paintNow();
      return say(t('lt.needN', { n, letters: plural(n, 'lt.letters'), k }), true);
    }
    if (!resolve(m, word)) return say(t('lt.unknown', { w: word }), true);
    if (game.guesses.includes(word)) {
      sink.value = '';
      paintNow();
      return say(t('lt.already', { w: word }), true);
    }
    game.guesses.push(word);
    stats.letters += n;                      // letters typed are counted across every mode
    saveStats();
    sink.value = '';
    say('');
    click();
    $('.how')?.remove();
    const won = word === game.secret;
    const out = !won && game.tries && game.guesses.length >= game.tries;
    // decided before drawing, so a winning row is not followed by an empty one while it colours in
    if (won || out) game.status = won ? 'won' : 'lost'; else putSave(game);
    paintStatus();
    paintBoard(true);
    keepDown();
    if (!document.documentElement.hasAttribute('data-kb')) board.querySelector('.lt-row.now')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    refit();
    if (won || out) finish(game.status, true);
  }

  // The result is recorded at once; the end card waits for the last row to finish colouring in.
  function finish(status, afterReveal = false) {
    game.status = status;
    const pts = score(game.secret, game.guesses.length, status === 'won', game.diff);
    recordLettersEnd(game, pts);
    if (status === 'won') chime();
    if (!afterReveal) return paintEnd(pts);
    revealing = true;
    setTimeout(() => { if (app.isConnected) paintEnd(pts); }, Math.min(120, 1000 / n) * (n - 1) + 360);
  }

  function paintEnd(pts) {
    const won = game.status === 'won', g = game.guesses.length;
    const actions = `<div class="win-actions"><a class="btn btn-primary" href="#/new/letters">${t('lt.again')} <span class="arrow">→</span></a><button class="btn btn-outline" type="button" id="copy">${t('lt.copy')}</button><a class="btn btn-ghost" href="#/">${t('menu')}</a></div>`;
    // the category the game was played in, next to the word it hid; each card keeps its own dot
    const tally = dot => `<span>${t('game.endCat')} <b>${t('cat.' + game.cat)}</b></span>${dot}<span><b>${g}</b> / ${tries} ${plural(g, 'n.guesses')}</span>`;
    let card;
    if (won) {
      // the sum written out, so the score is never a mystery: 7 letters (ż ó ł count ×2) ÷ 3 guesses × 100 × 1.25
      const marked = [...new Set([...game.secret].filter(ch => MARKED.test(ch)))];
      const calc = t('lt.calc', { p: points(game.secret), g, guesses: plural(g, 'n.guesses'),
        double: marked.length ? ' ' + plural(marked.length, 'lt.double').replace('{l}', marked.join(' ')) : '',
        m: decimal(MULTIPLIER[game.diff]), diff: t('diff.' + game.diff) });
      const best = stats.lt.bestScore;
      card = `<div class="win">
      <span class="eyebrow">${t('lt.won')}</span>
      <p class="display">${esc(game.secret)}</p>
      <div class="win-stats">${tally('<span>·</span>')}<span>·</span><span>${t('lt.score')} <b>${num(pts)}</b></span>${
        best > pts ? `<span>·</span><span>${t('lt.best')} <b>${num(best)}</b></span>` : ''}</div>
      <p class="calc">${calc}</p>
      ${actions}
    </div>`;
    } else {
      card = `<div class="lose">
      <span class="eyebrow">${t(game.status === 'lost' ? 'lt.lost' : 'lt.gaveUp')}</span>
      <p class="display">${esc(game.secret)}</p>
      <div class="win-stats muted">${tally('<span class="dot">·</span>')}<span class="dot">·</span><span>${t('lt.score')} <b>0</b></span></div>
      ${actions}
    </div>`;
    }
    main.innerHTML = `${card}<div class="lt-board" role="grid" aria-label="${t('game.guesses')}"></div>`;
    board = $('.lt-board');
    paintBoard();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Plain text, so it pastes anywhere: the header line and one row of squares per guess. The word
    // itself is never in it.
    const share = t('lt.share', { LANG: game.lang.toUpperCase(), n, letters: plural(n, 'lt.letters'), g: won ? g : 'X', t: tries,
      diff: t('diff.' + game.diff), score: num(pts) })
      + '\n' + game.guesses.map(w => feedback(w, game.secret).map(f => SHARE[TILE[f]]).join('')).join('\n');
    const copy = $('#copy');
    copy.addEventListener('click', async () => {
      if (!await copyText(share)) return;
      copy.textContent = t('lt.copied');
      copy.classList.add('copied');
      refit();
    });
    refit();
  }

  if (playing()) paintPlay(); else paintEnd(0);   // a finished game is deleted, so this is only a safeguard
  window.addEventListener('resize', keepDown);
  window.visualViewport?.addEventListener('resize', keepDown);
  const stop = playClock(root, game, () => app.isConnected);
  return () => {
    window.removeEventListener('resize', keepDown);
    window.visualViewport?.removeEventListener('resize', keepDown);
    stop();
  };
}

// The clipboard API needs a secure page; the desktop wrapper may not count as one, so the old way
// (select a hidden text area, "copy") is the fallback.
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.append(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* nothing left to try */ }
  area.remove();
  return ok;
}
