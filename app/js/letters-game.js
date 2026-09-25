// The Letters game screen - markup from handoff-letters/game-letters.html (playing) and
// game-letters-end.html (won / lost / gave up), with the dummy text replaced by t(...) and live data.
// The on-screen keyboard and editing a tile are design v4 ("Lexling Letters Keyboard").
import { t, plural, esc, num, decimal } from './i18n.js';
import { settings, stats, saveStats, getSave, putSave, gameName, recordLettersEnd, playClock } from './store.js';
import { loadWords, resolve } from './engine.js';
import { feedback, score, points, MULTIPLIER, MARKED, triesFactor, bestRow, lossScore, typeLetter, eraseLetter, keyStates } from './letters.js';
import { topbar, modeTag, confirmClick, TILE, outcome } from './ui.js';
import { fitAll } from './fit.js';
import { click, chime } from './sound.js';
import { offensive } from './offensive.js';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const PL_ROW = 'ąćęłńóśźż';   // a row of its own in Polish games: guesses may use them even when the word cannot
const BACKSPACE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"></path><path d="m12 9 6 6"></path><path d="m18 9-6 6"></path></svg>';

export async function lettersGameScreen(root, id) {
  const game = getSave(id);
  const m = game && await loadWords(game.lang);
  if (!m) { location.replace('#/games/letters'); return; }
  if (location.hash !== '#/game/' + id) return;   // left while the word data loaded: a newer screen is up
  const n = game.len;
  const tries = game.tries || '∞';           // 0 = unlimited
  const playing = () => game.status === 'playing';
  let bad = false;                           // the row was sent short: outlined red until the next key
  // The row being typed: one letter or '' per tile - it can have gaps, because a tapped tile can be
  // emptied or overwritten out of order. `sel` = the tile the player tapped to edit, or null.
  let cur = Array(n).fill(''), sel = null;
  const revealMs = Math.min(30, 300 / n) * (n - 1) + 180;   // = the row's colour reveal (app.css)

  root.innerHTML = `<div class="app" data-screen="letters">
  ${topbar({ left: modeTag('letters'), right: `<span class="eyebrow">${esc(gameName(game))}</span>` })}
  <main class="main"></main>
</div>`;
  const app = root.firstElementChild, main = app.querySelector('main');
  const $ = sel => main.querySelector(sel);
  const refit = () => fitAll(root);
  let board, sink, kb;

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

  // The current row: its letters, the tapped tile ringed (sel), otherwise the caret in the first gap.
  // `put` = the tile a key has just filled, which pops. Enter wakes up when the row is full.
  function paintNow(put = -1) {
    const now = board.querySelector('.lt-row.now');
    if (!now) return;                        // the game has just ended: no row to type into
    now.classList.toggle('bad', bad);
    const gap = cur.indexOf('');
    [...now.children].forEach((el, i) => {
      el.textContent = cur[i];
      el.className = 'lt' + (cur[i] ? ' typed' : '') + (sel === i ? ' sel' : sel === null && i === gap ? ' caret' : '') + (i === put ? ' put' : '');
    });
    kb.querySelector('.enter').classList.toggle('go', gap < 0);
  }

  // What the game has learnt about each letter, on its key (letters.js, keyStates): the tile colours,
  // and a small count when the letter is known to be in the word more than once.
  function paintKeys(guesses = game.guesses) {
    const { state, count } = keyStates(guesses, game.secret);
    kb.querySelectorAll('[data-k]').forEach(key => {
      const ch = key.dataset.k;
      key.classList.remove('hit', 'near', 'miss');
      if (state[ch]) key.classList.add(state[ch]);
      key.innerHTML = esc(ch) + (count[ch] > 1 ? `<span class="n">${count[ch]}</span>` : '');
    });
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
    $('#give-up').addEventListener('pointerdown', e => e.preventDefault());
  }

  // ── typing: the keys on screen, a computer's keyboard, and (with the setting) the phone's own ──
  function press(ch) {
    if (!playing() || revealing) return;
    let at;
    ({ row: cur, sel, at } = typeLetter(cur, sel, ch));
    if (at < 0) return;                      // the row is full and nothing is selected
    bad = false;
    say('');
    paintNow(at);
  }

  function back() {
    if (!playing() || revealing) return;
    ({ row: cur, sel } = eraseLetter(cur, sel));
    bad = false;
    say('');
    paintNow();
  }

  const select = i => { sel = i; paintNow(); };

  function paintPlay() {
    // While playing, the screen is exactly the window's height: status on top, the grid in the middle
    // (it scrolls), the keyboard at the bottom (css: .fit, .kbon). The end screen goes back to an
    // ordinary scrolling page. Enter on the keyboard is the one way to send a guess.
    app.classList.add('fit', 'kbon');
    const key = ch => `<button type="button" class="key" data-k="${ch}" aria-label="${ch}">${ch}</button>`;
    const row = (letters, pads = false) => `<div class="kb-row${letters === PL_ROW ? ' pl' : ''}">${pads ? '<span class="pad"></span>' : ''}${
      [...letters].map(key).join('')}${pads ? '<span class="pad"></span>' : ''}</div>`;
    main.innerHTML = `<div class="status"></div>
    <div class="play">
      <p class="msg help" role="status" aria-live="polite"></p>
      <div class="lt-board" role="grid" aria-label="${t('game.guesses')}"></div>
      <div class="kb" role="group" aria-label="${t('kb.label')}">
        ${game.lang === 'pl' ? row(PL_ROW, true) : ''}${row(ROWS[0])}${row(ROWS[1], true)}
        <div class="kb-row"><button type="button" class="key wide enter" data-act="enter">${t('kb.enter')}</button>${
          [...ROWS[2]].map(key).join('')}<button type="button" class="key wide" data-act="back" aria-label="${t('kb.backspace')}">${BACKSPACE}</button></div>
      </div>
      <input class="sink" type="text" inputmode="text" enterkeyhint="go" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="${n}" aria-label="${t('game.inputAria')}">
    </div>`;
    board = $('.lt-board');
    sink = $('.sink');
    kb = $('.kb');
    paintStatus();
    paintBoard();
    paintKeys();

    // A key acts on pointer-down, at once. preventDefault keeps the focus where it is, so no key ever
    // opens the phone's keyboard - and when the phone's keyboard is open, using the keys on screen
    // closes it (owner, 2026-09-25). The key stays pressed-looking for 90 ms after it is let go.
    const act = keyEl => {
      if (document.activeElement === sink) sink.blur();
      if (keyEl.dataset.act === 'enter') submit();
      else if (keyEl.dataset.act === 'back') back();
      else press(keyEl.dataset.k);
    };
    kb.addEventListener('pointerdown', e => {
      const keyEl = e.target.closest('button');
      if (!keyEl) return;
      e.preventDefault();
      keyEl.classList.add('down');
      keyEl.setPointerCapture(e.pointerId);
      keyEl.addEventListener('lostpointercapture', () => setTimeout(() => keyEl.classList.remove('down'), 90), { once: true });
      act(keyEl);
    });
    // a key reached with Tab and pressed with Enter / Space arrives as a click with no pointer
    kb.addEventListener('click', e => { if (e.detail === 0 && e.target.closest('button')) act(e.target.closest('button')); });

    // Tapping a tile of the row being typed selects it (tap it again to let go); a tap between the
    // tiles picks the nearest one. With the "phone keyboard" setting on, the tap opens the phone's
    // keyboard instead, to type with (owner, 2026-09-25).
    board.addEventListener('click', e => {
      const now = e.target.closest('.lt-row.now');
      if (!now || !playing()) return;
      e.stopPropagation();
      if (settings.phoneKb) { sink.blur(); sink.focus(); return; }
      let i = [...now.children].indexOf(e.target.closest('.lt'));
      if (i < 0) {
        const x = e.clientX, boxes = [...now.children].map(el => el.getBoundingClientRect());
        i = boxes.reduce((best, b, k) => Math.abs(x - (b.left + b.right) / 2) < Math.abs(x - (boxes[best].left + boxes[best].right) / 2) ? k : best, 0);
      }
      select(sel === i ? null : i);
    });
    // a tap anywhere else lets the selection go, and closes the phone's keyboard as Android does
    main.addEventListener('click', e => {
      if (!playing() || e.target.closest('.kb, button, a')) return;
      if (sel !== null) select(null);
      sink.blur();
    });

    // The phone's keyboard types into the hidden field, which then IS the row - letters from the left,
    // as the game always worked. Opening it gathers the row's letters into the field (and lets go of
    // any selection); the field is not rewritten while the keyboard composes, which would break it.
    sink.addEventListener('focus', () => {
      sel = null;
      sink.value = cur.filter(Boolean).join('');
      cur = [...sink.value, ...blank()].slice(0, n);
      paintNow();
    });
    sink.addEventListener('input', () => {
      // letters only, never more than the word holds. Case is left alone - rewriting the field while
      // the phone keyboard is composing a word breaks it - and is dropped when the guess is read.
      const clean = [...sink.value].filter(ch => /\p{L}/u.test(ch)).slice(0, n).join('');
      if (clean !== sink.value) sink.value = clean;
      cur = [...clean.toLowerCase(), ...blank()].slice(0, n);
      bad = false;
      say('');
      paintNow();
    });
    sink.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      // the caret always sits at the end, where the boxes draw it
      else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault();
    });
    refit();
    keepDown();
  }

  // A computer's keyboard always types, whatever the setting: letters, Backspace, Enter; Esc lets a
  // selection go (and only then leaves the screen, main.js); the arrows move the selection.
  function onKey(e) {
    if (!playing() || e.defaultPrevented || !app.isConnected || document.activeElement === sink) return;
    if (e.target.closest?.('input, textarea')) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a')) return;   // a focused button presses itself
    // AltGr (Polish letters on Windows) reports Ctrl + Alt; any other shortcut is not typing
    if (e.metaKey || ((e.ctrlKey || e.altKey) && !e.getModifierState?.('AltGraph'))) return;
    if (/^\p{L}$/u.test(e.key)) { e.preventDefault(); press(e.key.toLowerCase()); }
    else if (e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape' && sel !== null) { e.preventDefault(); select(null); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const gap = cur.indexOf(''), from = sel ?? (gap < 0 ? n - 1 : gap);
      select(Math.min(n - 1, Math.max(0, from + (e.key === 'ArrowLeft' ? -1 : 1))));
    }
  }

  let revealing = false;
  function submit() {
    if (!playing() || revealing) return;
    const word = cur.join('');
    const k = cur.filter(Boolean).length;
    sel = null;                              // sending the row ends any editing
    if (k < n) {
      bad = true;
      paintNow();
      return say(t('lt.needN', { n, letters: plural(n, 'lt.letters'), k }), true);
    }
    // a word the list places under a base word, or a stand-alone dictionary form (pasę, poszedłem)
    // ...and never a slur or a vulgar word (owner, 2026-09-25): those get the same answer as a non-word
    if ((!resolve(m, word) && !m.extra.has(word)) || offensive(m, word)) { paintNow(); return say(t('lt.unknown', { w: word }), true); }
    if (game.guesses.includes(word)) {
      cur = blank();
      sink.value = '';
      paintNow();
      return say(t('lt.already', { w: word }), true);
    }
    game.guesses.push(word);
    stats.letters += n;                      // letters typed are counted across every mode
    saveStats();
    cur = blank();
    sink.value = '';
    say('');
    click();
    const won = word === game.secret;
    const out = !won && game.tries && game.guesses.length >= game.tries;
    // decided before drawing, so a winning row is not followed by an empty one while it colours in
    if (won || out) game.status = won ? 'won' : 'lost'; else putSave(game);
    paintStatus();
    paintBoard(true);
    keepDown();
    refit();
    // the keys take their colours once the row has finished colouring in (a 150 ms fade, app.css),
    // so the keyboard never gives a result away before the tiles do
    setTimeout(() => { if (kb.isConnected) paintKeys(); }, revealMs);
    if (won || out) finish(game.status, true);
  }

  // The result is recorded at once; the end card waits for the last row to finish colouring in.
  function finish(status, afterReveal = false) {
    game.status = status;
    const pts = status === 'won' ? score(game.secret, game.guesses.length, true, game.diff, game.tries)
      : status === 'lost' ? lossScore(game.secret, game.guesses, game.diff, game.tries) : 0;
    recordLettersEnd(game, pts);
    if (status === 'won') chime();
    if (!afterReveal) return paintEnd(pts);
    revealing = true;
    setTimeout(() => { if (app.isConnected) paintEnd(pts); }, revealMs);
  }

  function paintEnd(pts) {
    const won = game.status === 'won', g = game.guesses.length, dot = '<span class="dot">·</span>';
    // first the banner - what happened, big, in green or red - then the word and the numbers in a card
    const head = outcome(won, t(won ? 'end.won' : game.status === 'lost' ? 'end.lost' : 'end.gaveUp'),
      `${g}/${tries}`, t('lt.tries'));   // the tries used, however it ended - never X (owner)
    // the category the game was played in, next to the word it hid
    const facts = [`<span>${t('game.endCat')} <b>${t('cat.' + game.cat)}</b></span>`,
      `<span><b>${g}</b> ${plural(g, 'n.guesses')}</span>`, `<span>${t('lt.score')} <b>${num(pts)}</b></span>`];
    let calc = '';
    // out of tries: the best row's share of the word, of a quarter of a win on the last try
    if (game.status === 'lost') {
      calc = `<p class="calc">${t('lt.calcLoss', { b: decimal(bestRow(game.guesses, game.secret)), n,
        w: num(score(game.secret, game.tries, true, game.diff, game.tries)) })}</p>`;
    }
    if (won) {
      // the sum written out, so the score is never a mystery: 7 letters (ż ó ł count ×2) ÷ 3 guesses × 100 × 1.25
      const marked = [...new Set([...game.secret].filter(ch => MARKED.test(ch)))];
      // and how many tries the player allowed themselves: × 6 ÷ tries, or × 0.5 unlimited
      const triesPart = t('lt.calcTries', { f: decimal(+triesFactor(game.tries).toFixed(2)),
        t: game.tries ? `${game.tries} ${plural(game.tries, 'lt.triesUnit')}` : t('lt.unlimitedLow') });
      calc = `<p class="calc">${t(game.diffRandom ? 'lt.calcRandom' : 'lt.calc', { p: points(game.secret), g, guesses: plural(g, 'n.guesses'),
        double: marked.length ? ' ' + plural(marked.length, 'lt.double').replace('{l}', marked.join(' ')) : '',
        m: decimal(MULTIPLIER[game.diff]), diff: t('diff.' + game.diff) })}${triesPart}</p>`;
      if (stats.lt.bestScore > pts) facts.push(`<span>${t('lt.best')} <b>${num(stats.lt.bestScore)}</b></span>`);
    }
    const card = `<div class="card result ${won ? 'won' : 'lost'}">
      <span class="eyebrow">${t(won ? 'end.wordWon' : 'end.wordLost')}</span>
      <p class="display">${esc(game.secret)}</p>
      <div class="result-stats">${facts.join(dot)}</div>
      ${calc}
      <div class="result-actions"><a class="btn btn-primary" href="#/new/letters">${t('lt.again')} <span class="arrow">→</span></a><a class="btn btn-ghost" href="#/">${t('menu')}</a></div>
    </div>`;
    app.classList.remove('fit', 'kbon');
    main.innerHTML = `${head}${card}<div class="lt-board" role="grid" aria-label="${t('game.guesses')}"></div>`;
    board = $('.lt-board');
    paintBoard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refit();
  }

  if (playing()) paintPlay(); else paintEnd(0);   // a finished game is deleted, so this is only a safeguard
  window.addEventListener('resize', keepDown);
  window.visualViewport?.addEventListener('resize', keepDown);
  document.addEventListener('keydown', onKey, true);   // before main.js's Esc-goes-back: Esc first lets a selection go
  const stop = playClock(root, game, () => app.isConnected);
  return () => {
    window.removeEventListener('resize', keepDown);
    window.visualViewport?.removeEventListener('resize', keepDown);
    document.removeEventListener('keydown', onKey, true);
    stop();
  };
}
