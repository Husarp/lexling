// The game screen - markup from design/handoff/game.html (states: 0 guesses / mid-game / won).
import { t, plural, esc, num, clock } from './i18n.js';
import { settings, stats, getSave, putSave, recordGuess, recordEnd, playClock } from './store.js';
import { load, resolve, suggest, rankAll, pct, hint, HINT_FLOOR } from './engine.js';
import { topbar, fillColor, confirmClick, outcome, gearButton, wireGear, meaningButton, wordLink, gameTitle, flashTap } from './ui.js';
import { fitAll } from './fit.js';
import { click, chime } from './sound.js';

const FORM_EXAMPLE = { pl: { a: 'psami', b: 'pies' }, en: { a: 'mice', b: 'mouse' } };

export async function gameScreen(root, id) {
  const game = getSave(id);
  const m = game && await load(game.lang);
  const secretIdx = m ? m.words.indexOf(game.secret) : -1;
  if (secretIdx < 0) { location.replace('#/games/guess'); return; }
  const rank = rankAll(m, secretIdx);

  root.innerHTML = `<div class="app" data-screen="game">
  ${topbar({ left: `<a class="btn btn-ghost" href="#/games/guess">${t('back.games')}</a>`, right: `${gameTitle(game)}${gearButton()}` })}
  <main class="main">
    <div class="status"></div>
    <div id="entry"></div>
    <div id="board"></div>
  </main>
</div>`;
  wireGear(root);
  const $ = sel => root.querySelector(sel);
  const board = $('#board');
  let input, ac, items = [], hl = 0, picked = false;
  const playing = () => game.status === 'playing';
  const refit = () => fitAll(root);

  function paintStatus() {
    const stat = (label, value, bold = true) => `<div class="stat"><span class="eyebrow">${label}</span><span class="num"${bold ? ' style="font-weight:700"' : ''}>${value}</span></div>`;
    $('.status').innerHTML = stat(t('game.guesses'), num(realGuesses()), false)
      + stat(t('game.category'), game.friend ? '—' : t('cat.' + game.cat))
      + stat(t('game.language'), game.lang.toUpperCase())
      + (playing()
        ? `<div class="status-actions"><a class="btn btn-ghost" href="#/games/guess">${t('game.saveExit')}</a><button class="btn btn-ghost btn-danger" type="button" id="give-up">${t('game.giveUp')}</button></div>`
        : stat(t('game.time'), clock(game.timeMs), false));
    if (playing()) confirmClick($('#give-up'), () => finish(false), refit);
  }

  function paintEntry() {
    if (!playing()) {
      // design v2: the outcome banner first, then the word and the numbers in a card - the same ending
      // as Letters. Giving up names the closest the player got; a win, their best win so far.
      const won = game.status === 'won', n = realGuesses(), dot = '<span class="dot">·</span>';
      const closest = game.guesses.filter(g => !g.hint).reduce((b, g) => !b || g.rank < b.rank ? g : b, null);
      const facts = [!game.friend && `<span>${t('game.endCat')} <b>${t('cat.' + game.cat)}</b></span>`,
        `<span><b>${num(n)}</b> ${plural(n, 'n.guesses')}</span>`, `<span><b>${clock(game.timeMs)}</b> ${t('game.inGame')}</span>`,
        won && stats.bestWin && `<span>${t('game.bestWin')} <b>${num(stats.bestWin)}</b></span>`,
        !won && closest && `<span>${t('end.closest', { w: esc(closest.w) })} <b>${num(closest.rank)}</b></span>`];
      $('#entry').outerHTML = `<div id="entry" class="ended">
      ${outcome(won, t(won ? 'end.won' : 'end.gaveUp'), num(n), plural(n, 'n.guesses'))}
      <div class="card result ${won ? 'won' : 'lost'}">
        <span class="eyebrow">${t(won ? 'end.guessWordWon' : 'end.wordLost')}</span>
        <p class="display">${esc(game.secret)}</p>
        <div class="result-stats">${facts.filter(Boolean).join(dot)}</div>
        <div class="result-actions"><a class="btn btn-outline" href="#/">${t('menu')}</a><a class="btn btn-primary" href="#/new">${t('games.new')} <span class="arrow">→</span></a>${meaningButton(game.secret, game.lang)}</div>
      </div>
    </div>`;
      return;
    }
    $('#entry').outerHTML = `<div id="entry">
      <p class="help err" id="msg" role="status" hidden></p>
      <div class="guess-input">
        <input class="input" type="text" placeholder="${t('game.placeholder')}" aria-label="${t('game.inputAria')}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go">
        <button class="btn btn-primary submit" type="button">${t('game.submit')}</button>
        <div class="ac" role="listbox" hidden></div>
      </div>
      <div class="entry-actions"><button class="btn btn-ghost" type="button" id="hint">${t('game.hint')}</button><span class="help" id="hint-note"></span></div>
    </div>`;
    input = $('#entry input');
    ac = $('#entry .ac');
    $('#hint').addEventListener('click', giveHint);
    paintHintNote();
    input.addEventListener('input', () => { picked = false; hl = 0; say(''); paintAc(); });
    input.addEventListener('blur', () => { ac.hidden = true; });
    input.addEventListener('focus', paintAc);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape' && !ac.hidden) { ac.hidden = true; e.stopPropagation(); }   // Esc closes the list first, leaves the game second
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
        e.preventDefault();
        hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        picked = true;
        paintAc();
      }
    });
    $('#entry .submit').addEventListener('click', () => { submit(); input.focus(); });
    ac.addEventListener('pointerdown', e => e.preventDefault());   // keep focus (and the phone keyboard) on the field
    ac.addEventListener('click', e => {
      const option = e.target.closest('button');
      if (option) submit(items[+option.dataset.i]);
    });
    input.focus();
  }

  function paintAc() {
    items = suggest(m, input.value, 4, settings.fuzzy);
    ac.hidden = !items.length;
    const n = input.value.trim().length;
    ac.innerHTML = items.map((h, i) => `<button type="button" role="option" data-i="${i}" class="${i === hl ? 'hl' : ''}"><span><b>${esc(h.w.slice(0, n))}</b>${esc(h.w.slice(n))}</span><span class="to">${
      h.form ? '→ ' + esc(m.words[h.idx]) : t('pos.' + m.posNames[m.pos[h.idx]])}</span></button>`).join('');
  }

  // The reply sits ABOVE the field: below it is where the suggestion list drops, and a message there
  // is simply not seen - it looks as if Guess did nothing. It is repainted with the field, so it is
  // looked up each time rather than held.
  function say(text) {
    const msg = $('#msg');
    if (!msg) return;
    msg.textContent = text;
    msg.hidden = !text;
  }

  const realGuesses = () => game.guesses.filter(g => !g.hint).length;
  const bestRank = () => game.guesses.reduce((b, g) => !b || g.rank < b ? g.rank : b, 0);

  function paintHintNote() {
    const used = game.guesses.filter(g => g.hint).length;
    const note = $('#hint-note');
    if (note) note.textContent = used ? t('game.hintsUsed', { n: used }) : '';
    const button = $('#hint');
    if (button) button.disabled = bestRank() > 0 && bestRank() <= HINT_FLOOR;
  }

  // A hint lands in the list like a guess, but marked as one: it shows its rank, so it moves the game
  // forward the same way a good guess would, and it is honest about where it came from.
  function giveHint() {
    const found = hint(m, rank, secretIdx, { best: bestRank(), taken: game.guesses.map(g => g.w) });
    if (!found) return say(t(bestRank() && bestRank() <= HINT_FLOOR ? 'game.hintNone' : 'game.hintFail'));
    const word = m.words[found.idx];
    game.guesses.push({ w: word, typed: '', rank: found.rank, pct: pct(found.rank, m.count), hint: true });
    putSave(game);
    flashTap($('#hint'));
    click();
    say('');
    paintStatus();
    paintHintNote();
    paintBoard(word);
    refit();
    [...board.querySelectorAll('.guess.new')].pop()?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    input?.focus();
  }

  // what gets scored: the highlighted suggestion if the player chose one, else the typed text itself,
  // else the top suggestion (so "zolw" + Enter plays "żółw")
  function submit(option) {
    const text = input.value.trim();
    if (!text) return;
    option ??= picked ? items[hl] : null;
    const hit = option ? { idx: option.idx, typed: option.w } : resolve(m, text) ?? (items[0] && { idx: items[0].idx, typed: items[0].w });
    if (!hit) return say(t('game.unknown', { w: text }));
    const word = m.words[hit.idx];
    const before = game.guesses.find(g => g.w === word);
    if (before) {
      // The word is right, it is just spent - so clear the field instead of leaving the player to
      // delete it by hand. Setting .value fires no input event, so the message below stays put.
      input.value = '';
      picked = false; hl = 0;
      paintAc();
      return say(t('game.already', { w: word, r: num(before.rank) }));
    }

    const r = rank[hit.idx];
    game.guesses.push({ w: word, typed: hit.typed !== word ? hit.typed : '', rank: r, pct: pct(r, m.count) });
    recordGuess(game, word, text);
    input.value = '';
    picked = false; hl = 0;
    say('');
    paintAc();
    if (hit.idx === secretIdx) return finish(true);
    putSave(game);
    click();
    paintStatus();
    paintBoard(word);
    refit();
    // With the keyboard open there is little room, and a poor guess lands at the very bottom of the
    // list. "nearest" scrolls only as far as it must, and not at all when the box is already in view.
    [...board.querySelectorAll('.guess.new')].pop()?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function finish(won) {
    game.status = won ? 'won' : 'gaveup';
    recordEnd(game, won, m.hardOf.get(secretIdx) ?? -1, game.guesses.some(x => x.hint));
    if (won) chime();
    say('');
    paintStatus();
    paintEntry();
    paintBoard();
    refit();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const box = (g, { latest = false, fresh = false } = {}) => {
    const secret = g.rank === 0;
    return `<li class="guess ${latest ? 'new' : ''} ${secret ? 'secret' : ''} ${g.hint ? 'tip' : ''} ${fresh ? 'enter' : ''}" data-w="${esc(g.w)}">
  <span class="fill" style="--pct:${fresh ? 0 : g.pct}%;--fill:${secret ? 'var(--fill-hot)' : fillColor(g.pct)}" data-pct="${g.pct}"></span>
  <span class="word">${wordLink(g.w, game.lang)}${g.typed ? `<span class="form">${esc(g.typed)} → ${esc(g.w)}</span>` : ''}</span>
  <span class="rank">${secret ? '✓' : num(g.rank)}${secret ? `<small>${t('game.secret')}</small>` : g.hint ? `<small>${t('game.hintMark')}</small>` : latest ? `<small>${t('game.latest')}</small>` : ''}</span>
</li>`;
  };

  // `fresh` = the word guessed a moment ago: its box slides in and its fill grows from zero, and the
  // boxes it pushes down glide to their new place instead of jumping.
  function paintBoard(fresh) {
    const all = game.guesses;
    if (!all.length) {
      const ex = FORM_EXAMPLE[game.lang];
      board.innerHTML = playing() ? `<div class="card empty">
      <h2>${t('game.emptyTitle')}</h2>
      <p class="help">${t('game.emptyText')}</p>
      <div class="legend"><span>${t('game.far')}</span><div class="ramp"></div><span>${t('game.close')}</span></div>
      <p class="help"><span class="arrow">→</span> ${t('game.formsHint', ex)}</p>
    </div>` : '';
      return;
    }
    const was = new Map([...board.querySelectorAll('.guesses.top .guess')].map(el => [el.dataset.w, el.getBoundingClientRect().top]));
    const open = board.querySelector('.history')?.open;
    const top = [...all].sort((a, b) => a.rank - b.rank).slice(0, 5);
    // The newest guess always gets its own box at the bottom, next to the input, even when it also
    // stands in the top five - by request: that is where the eye is after pressing Guess.
    const last = playing() ? all[all.length - 1] : null;
    board.innerHTML = `<ol class="guesses top" aria-label="${t('game.topAria')}">${top.map(g => box(g, { latest: g === last, fresh: g.w === fresh })).join('')}</ol>
    ${last ? `<div class="divider">${t('game.latest')}</div>
    <ol class="guesses" aria-label="${t('game.latestAria')}">${box(last, { latest: true, fresh: last.w === fresh })}</ol>` : ''}
    <details class="history"${open ? ' open' : ''}>
      <summary><span class="arrow">→</span> ${t('game.all')} <span class="num" style="color:var(--text)">${num(all.length)}</span></summary>
      <div class="hist">${all.map((g, i) => `<span class="i">${i + 1}</span><span>${esc(g.w)}${g.typed ? ` <span class="muted" style="font-size:12px">${esc(g.typed)} → ${esc(g.w)}</span>` : ''}</span><span><i class="bar"><i style="--pct:${g.pct}%;--fill:${fillColor(g.pct)}"></i></i></span><span class="r">${g.rank === 0 ? '✓' : num(g.rank)}</span>`).reverse().join('\n')}</div>
    </details>`;

    for (const el of board.querySelectorAll('.guesses.top .guess')) {
      const dy = was.has(el.dataset.w) ? was.get(el.dataset.w) - el.getBoundingClientRect().top : 0;
      if (!dy) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
      el.getBoundingClientRect();   // commit the start position before letting the transition run
      el.style.transition = el.style.transform = '';
    }
    if (fresh) for (const fill of board.querySelectorAll('.guess.enter .fill')) {
      fill.getBoundingClientRect();   // commit width 0 so the real width is a transition, not the first style
      fill.style.setProperty('--pct', fill.dataset.pct + '%');
    }
  }

  paintStatus();
  paintEntry();
  paintBoard();
  return playClock(root, game, () => board.isConnected);
}
