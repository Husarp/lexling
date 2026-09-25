// The Letters game screen - markup from handoff-letters/game-letters.html (playing) and
// game-letters-end.html (won / lost / gave up), with the dummy text replaced by t(...) and live data.
import { t, plural, esc, num, decimal } from './i18n.js';
import { stats, saveStats, getSave, putSave, gameName, recordLettersEnd, playClock } from './store.js';
import { loadWords, resolve } from './engine.js';
import { feedback, score, points, MULTIPLIER, MARKED } from './letters.js';
import { topbar, modeTag, confirmClick, TILE, squares, outcome } from './ui.js';
import { fitAll } from './fit.js';
import { click, chime } from './sound.js';

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

  // Only the row being typed is drawn empty, never the tries still to come: with 20 tries those rows
  // ran the screen out of room (owner, 2026-09-25). A new row appears after each guess and grows in,
  // tile by tile - the status row already says how many tries are left.
  function paintBoard(reveal = false) {
    const rows = game.guesses.map((w, i) => past(w, reveal && i === game.guesses.length - 1));
    if (playing()) rows.push(`<div class="lt-row now grow" style="--n:${n}">${tiles(blank())}</div>`);
    // A game that ends without the word shows it where it would have gone - given up or out of tries:
    // one more row, all green, growing in like a new row does (owner, 2026-09-25).
    if (game.status === 'gaveup' || game.status === 'lost') rows.push(`<div class="lt-row grow" style="--n:${n}" aria-label="${esc(game.secret)}">${
      tiles(Array(n).fill('hit'), [...game.secret])}</div>`);
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

  // While playing, the grid is the part that scrolls (the screen fits the window): keep it at the
  // newest row, the one being typed.
  const keepDown = () => {
    if (board?.isConnected && playing()) board.scrollTop = board.scrollHeight;
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
    // While playing, the screen is exactly the window's height: status on top, Guess under the grid,
    // and only the grid scrolls (css: .fit). The end screen goes back to an ordinary scrolling page.
    app.classList.add('fit');
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
    keepDown();
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
    // a word the list places under a base word, or a stand-alone dictionary form (pasę, poszedłem)
    if (!resolve(m, word) && !m.extra.has(word)) return say(t('lt.unknown', { w: word }), true);
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
    setTimeout(() => { if (app.isConnected) paintEnd(pts); }, Math.min(30, 300 / n) * (n - 1) + 180);   // = the reveal (app.css)
  }

  function paintEnd(pts) {
    const won = game.status === 'won', g = game.guesses.length, dot = '<span class="dot">·</span>';
    // first the banner - what happened, big, in green or red - then the word and the numbers in a card
    const head = outcome(won, t(won ? 'end.won' : game.status === 'lost' ? 'end.lost' : 'end.gaveUp'),
      `${won || !g ? g : 'X'}/${tries}`, t('lt.tries'));   // given up before a guess: 0/6, not X/6 (owner)
    // the category the game was played in, next to the word it hid
    const facts = [`<span>${t('game.endCat')} <b>${t('cat.' + game.cat)}</b></span>`,
      `<span><b>${g}</b> ${plural(g, 'n.guesses')}</span>`, `<span>${t('lt.score')} <b>${num(pts)}</b></span>`];
    let calc = '';
    if (won) {
      // the sum written out, so the score is never a mystery: 7 letters (ż ó ł count ×2) ÷ 3 guesses × 100 × 1.25
      const marked = [...new Set([...game.secret].filter(ch => MARKED.test(ch)))];
      calc = `<p class="calc">${t('lt.calc', { p: points(game.secret), g, guesses: plural(g, 'n.guesses'),
        double: marked.length ? ' ' + plural(marked.length, 'lt.double').replace('{l}', marked.join(' ')) : '',
        m: decimal(MULTIPLIER[game.diff]), diff: t('diff.' + game.diff) })}</p>`;
      if (stats.lt.bestScore > pts) facts.push(`<span>${t('lt.best')} <b>${num(stats.lt.bestScore)}</b></span>`);
    }
    const card = `<div class="card result ${won ? 'won' : 'lost'}">
      <span class="eyebrow">${t(won ? 'end.wordWon' : 'end.wordLost')}</span>
      <p class="display">${esc(game.secret)}</p>
      <div class="result-stats">${facts.join(dot)}</div>
      ${calc}
      <div class="result-actions"><a class="btn btn-primary" href="#/new/letters">${t('lt.again')} <span class="arrow">→</span></a><a class="btn btn-ghost" href="#/">${t('menu')}</a></div>
    </div>`;
    app.classList.remove('fit');
    main.innerHTML = `${head}${card}<div class="lt-board" role="grid" aria-label="${t('game.guesses')}"></div>`;
    board = $('.lt-board');
    paintBoard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
