// The Connect game screen (design v4, "Lexling Connect"): the crossword, the circle of letters and
// the end. The rules - what a word is, the hints, when the board is done - are in connect.js.
import { t, esc, plural } from './i18n.js';
import { counts, getSave, getFinished, putSave, recordMove, noteMove, recordConnectEnd, playClock, gameName, collect } from './store.js';
import { loadWords } from './engine.js';
import { WORD_MIN, cellsOf, visible, isDone, nextHint, judge } from './connect.js';
import { isLetterKey } from './letters.js';
import { UI_ICONS, topbar, backToResults, keepButton, wireKeep, resultHref, modeTag, confirmClick, outcome, gearButton, wireGear, wordLink, gameTitle, flashTap } from './ui.js';
import { fitAll } from './fit.js';
import { playCue } from './sound.js';
import { bump, recordAchievementEnd, recordConnectBonus } from './achievements.js';

// Where the letters sit on the circle, in % of its box, clockwise from the top (design v4).
const POS = {
  4: [[50, 16], [84, 50], [50, 84], [16, 50]],
  5: [[50, 16], [82.3, 39.5], [70, 77.5], [30, 77.5], [17.7, 39.5]],
  6: [[50, 16], [79.4, 33], [79.4, 67], [50, 84], [20.6, 67], [20.6, 33]],
  7: [[50, 16], [76.6, 28.8], [83.1, 57.6], [64.8, 80.6], [35.2, 80.6], [16.9, 57.6], [23.4, 28.8]],
};
// 8-10 letters (owner, 2026-09-25): the same ring, radius 34 %, the first letter at the top
for (const n of [8, 9, 10]) POS[n] = Array.from({ length: n }, (_, i) => {
  const a = (i / n - .25) * 2 * Math.PI;
  return [+(50 + 34 * Math.cos(a)).toFixed(1), +(50 + 34 * Math.sin(a)).toFixed(1)];
});
const KEY = { 4: .28, 5: .26, 6: .24, 7: .215, 8: .2, 9: .185, 10: .17 };   // a letter's width as a share of the circle's (app.css .cn-ring.nN)
const DOT = '<span class="dot">·</span>';
const SHUFFLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 14 4 4-4 4"></path><path d="m18 2 4 4-4 4"></path><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22"></path><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"></path><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"></path></svg>';
const BULB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>';

export async function connectGameScreen(root, id, archived = false, kept = false) {
  const game = archived ? getFinished(id) : getSave(id);
  const m = !archived && game && await loadWords(game.lang);
  if (location.hash !== (archived ? resultHref(id, kept) : '#/game/' + id)) return;
  if (!archived && !m) { location.replace('#/games/connect'); return; }
  const { board } = game;
  const letters = [...game.ring], n = letters.length;
  const playing = () => game.status === 'playing';
  const desk = matchMedia('(pointer: fine)').matches;
  const min = game.two ? 2 : WORD_MIN;
  let slots = letters.map((_, i) => i);      // which place on the circle each letter is in (Shuffle moves them)
  let path = [];                             // the letters joined so far, as indexes into `letters`
  let finger = null;                         // [x, y] in % of the circle while dragging
  let press = null, tapped = false;
  let busy = false;                           // an answer is being shown (the shake), the circle waits
  let pick = null;                           // the word chosen for the next hint

  // every cell of the board and its letter
  const chars = new Map();
  for (const x of board.words) cellsOf(x).forEach((k, i) => chars.set(k, [...x.w][i]));
  const doneList = () => { const vis = visible(board, game.found, game.shown); return board.words.filter(x => isDone(x, game.found, vis)); };
  const state = () => ({ found: game.found, shown: game.shown, bonus: game.bonus });
  // the game's statistics record: a word found with a letter a hint had shown counts apart (owner, 2026-09-28: "don't
  // count the words with hints", nor for the longest word)
  function connectRecord() {
    const shown = new Set(game.shown);
    const own = game.found.filter(w => { const x = board.words.find(b => b.w === w); return !x || !cellsOf(x).some(k => shown.has(k)); });
    const long = [...own, ...game.bonus].reduce((a, w) => [...w].length > [...a].length ? w : a, '');
    return { f: own.length, fh: game.found.length - own.length, b: game.bonus.length, h: game.hints, long, gn: gameName(game) };
  }

  root.innerHTML = `<div class="app" data-screen="connect">
  ${topbar({ left: archived ? backToResults(kept) : modeTag('connect'), right: gameTitle(game, archived) })}
  <main class="main"></main>
</div>`;
  const app = root.firstElementChild, main = app.querySelector('main');
  if (!archived) wireGear(root, 'connect');
  const $ = sel => main.querySelector(sel);
  const refit = () => fitAll(root);
  let cells = new Map(), ring, dock, bonusBtn, tapActions, tapSubmit;

  // ── the crossword ──
  const boardHtml = max => `<div class="cw" role="grid" aria-label="${t('cn.board')}" style="--cols:${board.cols};--rows:${board.rows};--max:${max}px">${
    [...chars.keys()].map(k => { const [r, c] = k.split('-'); return `<span class="c" data-cell="${k}" style="grid-row:${r};grid-column:${c}"></span>`; }).join('')}</div>`;
  const collectCells = () => { cells = new Map([...main.querySelectorAll('[data-cell]')].map(el => [el.dataset.cell, el])); };

  // Green where a word the player found runs through, dashed where only a hint shows the letter, red
  // outline after giving up for what was left; the word chosen for a hint outlined in the theme colour. A hinted
  // letter in a word that is complete turns green but keeps its dashed edge, during the game and on the end screen
  // (owner, 2026-09-25: "it doesn't show where you used a hint").
  function paintCells(end = false, revealed = game.shown) {
    const found = new Set(board.words.filter(x => game.found.includes(x.w)).flatMap(cellsOf));
    const shown = new Set(revealed), vis = visible(board, game.found, revealed);
    const done = new Set(board.words.filter(x => isDone(x, game.found, vis)).flatMap(cellsOf));
    const picked = new Set(pick ? cellsOf(board.words.find(x => x.w === pick)) : []);
    for (const [k, el] of cells) {
      const f = found.has(k), h = shown.has(k), left = end && !f && !h;
      el.className = 'c' + (h && (f || done.has(k)) ? ' hit hinted' : f ? ' hit' : h ? ' hint' : left ? ' left' : '') + (picked.has(k) && !f ? ' pick' : '');
      el.textContent = f || h || left ? chars.get(k) : '';
    }
  }
  // a moment of motion on some cells: `fresh` fills a new word tile by tile, `flash` shows where a word
  // already is, `new-hint` brings a hinted letter in (app.css)
  function animate(keys, cls, ms) {
    keys.forEach((k, i) => {
      const el = cells.get(k);
      el.style.setProperty('--i', i);
      el.classList.remove(cls);
      void el.offsetWidth;                   // restart the animation if it is already running
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), ms + i * 25);
    });
  }

  function paintStatus() {
    const stat = (label, value, bold = true) => `<div class="stat"><span class="eyebrow">${label}</span><span class="num"${bold ? ' style="font-weight:700"' : ''}>${value}</span></div>`;
    $('.status').innerHTML = stat(t('cn.words'), `${doneList().length}<span class="muted" style="font-weight:700"> / ${board.words.length}</span>`, false)
      + stat(t('cn.letters'), n, false)
      + stat(t('cn.level'), t('diff.' + (game.diffRandom ? 'random' : game.diff)))
      + stat(t('game.language'), game.lang.toUpperCase())
      + `<div class="status-actions"><a class="btn btn-ghost" href="#/games/connect">${UI_ICONS.saveExit}${t('game.saveExit')}</a><button class="btn btn-ghost btn-danger" type="button" id="give-up">${UI_ICONS.giveUp}${t('game.giveUp')}</button>${gearButton('gs-inrow')}</div>`;
    confirmClick($('#give-up'), () => playing() && finish('gaveup'), refit);
    noFocus($('#give-up'));
  }

  // ── the slot between the board and the circle: the word while dragging, the answer after ──
  function sayWord(word, cls = '') {
    const say = $('.say');
    say.className = 'say' + (cls ? ' ' + cls : '');
    say.innerHTML = `<span class="w">${[...word].map(ch => `<i>${esc(ch)}</i>`).join('')}</span>`;
  }
  function sayText(text = '') {
    const say = $('.say');
    say.className = 'say';
    say.innerHTML = text ? `<p class="help">${text}</p>` : '';
  }
  // before anything has happened, the slot says what to do
  const sayIdle = () => sayText(game.found.length || game.bonus.length || game.shown.length ? '' : t(desk ? 'cn.msg.startDesktop' : 'cn.msg.start'));
  const loud = w => esc(w.toUpperCase());
  // A button pressed with the pointer does not take the focus: otherwise Enter and Space - check the word,
  // shuffle - would press it again instead. Tab still reaches it.
  const noFocus = el => el.addEventListener('pointerdown', e => e.preventDefault());
  // (a word chosen for a hint lets go once it is done, however that happened)
  const unpick = (vis = visible(board, game.found, game.shown)) => {
    const x = board.words.find(b => b.w === pick);
    if (x && isDone(x, game.found, vis)) pick = null;
  };

  // ── the circle ──
  function placeKeys() {
    ring.querySelectorAll('.cn-key').forEach(el => {
      const [x, y] = POS[n][slots[+el.dataset.i]];
      el.style.setProperty('--x', x + '%');
      el.style.setProperty('--y', y + '%');
    });
  }
  function paintPath() {
    ring.querySelectorAll('.cn-key').forEach(el => {
      const on = path.includes(+el.dataset.i);
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on);
    });
    const pts = path.map(i => POS[n][slots[i]]);
    if (finger && path.length) pts.push(finger);
    ring.querySelector('polyline').setAttribute('points', pts.map(p => p.join(',')).join(' '));
    const hideActions = !tapped || !path.length;
    if (tapActions.hidden !== hideActions) {
      tapActions.hidden = hideActions;
      if (!hideActions) fitAll(tapActions);
    }
    tapSubmit.disabled = path.length < min;
    if (path.length) sayWord(path.map(i => letters[i]).join(''));
  }
  const clearPath = () => { path = []; finger = null; tapped = false; paintPath(); };
  function tapLetter(i) {
    if (path.includes(i)) return;
    tapped = true;
    path.push(i);
    playCue('tile');
    paintPath();
  }
  function removeLast() {
    path.pop();
    if (!path.length) { clearPath(); sayIdle(); }
    else paintPath();
  }
  // the letter under the pointer (-1 if none), and where the pointer is, in % of the circle
  function under(e) {
    const box = ring.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width * 100, y = (e.clientY - box.top) / box.height * 100;
    let best = -1, near = KEY[n] * 50;       // within a letter's own circle
    letters.forEach((_, i) => {
      const [kx, ky] = POS[n][slots[i]], d = Math.hypot(x - kx, y - ky);
      if (d < near) { near = d; best = i; }
    });
    return { i: best, at: [x, y] };
  }

  // What a word made on the circle turns out to be (connect.js, judge), shown where it was made.
  function answer() {
    if (!playing()) return clearPath();
    const word = path.map(i => letters[i]).join('');
    if (path.length < min) { clearPath(); return sayIdle(); }   // a short swipe or typed word: nothing to judge
    const verdict = judge(m, board, state(), word, !!game.two);
    const x = board.words.find(b => b.w === word);
    if (verdict === 'none') {
      playCue('rejected');
      // not a word: the chips and the path go red and the letters shake, then it clears
      busy = true;
      tapActions.hidden = true;
      sayWord(word, 'bad');
      ring.classList.add('bad', 'shake');
      setTimeout(() => {
        ring.classList.remove('bad', 'shake');
        busy = false;
        if (!playing()) return;
        clearPath();
        sayText(t('cn.msg.notWord', { w: loud(word) }));
      }, 240);
      return;
    }
    clearPath();
    if (verdict === 'again' || verdict === 'bonusAgain') playCue('rejected');
    if (verdict === 'found') {
      game.found.push(word);
      recordMove(game, connectRecord());
      if (!cellsOf(x).some(k => game.shown.includes(k))) {
        collect('connect', game.lang, word, game);
        bump('connect.words', 1, game);
      }
      unpick();
      putSave(game);
      sayWord(word, 'old');
      paintCells();
      animate(cellsOf(x), 'fresh', 150);
      paintStatus();
      if (doneList().length === board.words.length) return finish('won', true);
      playCue('accepted');
      setTimeout(() => { if (playing() && !path.length) sayIdle(); }, 600);
    } else if (verdict === 'again') {
      sayWord(word, 'old');
      animate(cellsOf(x), 'flash', 320);
      setTimeout(() => { if (playing() && !path.length) sayText(t('cn.msg.already', { w: loud(word) })); }, 400);
    } else if (verdict === 'bonus') {
      playCue('accepted');
      // a real word that is not on the board: its chips fly into the counter, which then bumps
      game.bonus.push(word);
      recordConnectBonus(game);
      bump('connect.words', 1, game);
      recordMove(game, connectRecord());
      collect('connect', game.lang, word, game);
      putSave(game);
      sayWord(word, '');
      const chips = $('.say .w'), from = chips.getBoundingClientRect(), to = bonusBtn.getBoundingClientRect();
      chips.style.setProperty('--fx', `${(to.left + to.width / 2) - (from.left + from.width / 2)}px`);
      chips.style.setProperty('--fy', `${(to.top + to.height / 2) - (from.top + from.height / 2)}px`);
      chips.classList.add('fly');
      bonusBtn.classList.remove('bump');
      void bonusBtn.offsetWidth;
      bonusBtn.classList.add('bump');
      setTimeout(() => {
        bonusBtn.querySelector('.num').textContent = game.bonus.length;
        if (playing() && !path.length) sayIdle();
      }, 320);
    } else if (verdict === 'bonusAgain') {
      sayText(t('cn.msg.bonusAgain', { w: loud(word) }));
    }
  }

  function shuffle() {
    if (!playing() || busy || press) return;
    const next = [...slots];
    do {
      for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
    } while (next.every((s, i) => s === slots[i]));
    slots = next;
    clearPath();
    sayIdle();
    placeKeys();                             // the letters glide to their new places (200 ms, app.css)
  }

  // A hint: a random letter not showing yet (connect.js, nextHint) - in the chosen word if there is one -
  // and never more than half of any word's letters from hints.
  function hint() {
    if (!playing() || busy || !app.isConnected) return;
    const h = nextHint(board, game.found, game.shown, pick);
    if (!h) return;
    if (!h.cell) return sayText(pick ? t('cn.msg.wordCapped', { w: loud(pick) }) : t('cn.msg.noHints'));
    const cell = cells.get(h.cell);
    if (!cell || !main.contains(cell)) return;

    const revealed = [...game.shown, h.cell];
    const vis = visible(board, game.found, revealed);
    const finished = board.words.find(x => h.words.includes(x.w) && isDone(x, game.found, vis));
    const chosen = board.words.find(x => x.w === pick);
    unpick(vis);
    paintCells(false, revealed);

    game.shown = revealed;
    game.hints++;
    putSave(game);   // counts() marks practice from the revealed letter and flags any existing record
    noteMove(game, connectRecord());
    const title = app.querySelector('.topbar .side.end');
    if (title) title.innerHTML = gameTitle(game);
    $('.practice-hint')?.remove();
    flashTap($('.hint-btn'));
    if (finished) sayText(t('cn.msg.byHints', { w: loud(finished.w) }));
    else if (chosen) sayText(t('cn.msg.hint', { k: cellsOf(chosen).filter(k => vis.has(k)).length, n: [...chosen.w].length }));
    else sayText(t('cn.msg.hinted'));

    animate([h.cell], 'new-hint', 150);
    paintStatus();
    if (doneList().length === board.words.length) finish('won');
  }

  // Tapping a word on the board chooses it for the next hint; tapping it again lets it go. Where two
  // words cross, taps go from one to the other.
  function choose(cell) {
    if (!playing()) return;
    const vis = visible(board, game.found, game.shown);
    const words = board.words.filter(x => cellsOf(x).includes(cell) && !isDone(x, game.found, vis));
    if (!words.length) return;
    const at = words.findIndex(x => x.w === pick);
    pick = at < 0 ? words[0].w : at + 1 < words.length ? words[at + 1].w : null;
    paintCells();
    sayText(pick ? t('cn.msg.pick') : '');
  }

  // the bonus words so far, in a small list over the board; a tap anywhere else closes it
  function togglePop() {
    const open = dock.querySelector('.cn-pop');
    if (open) { open.remove(); bonusBtn.classList.remove('open'); return; }
    dock.insertAdjacentHTML('beforeend', `<div class="cn-pop" role="dialog" aria-label="${t('cn.bonusList')}">
      <div class="cn-pop-head"><span class="eyebrow">${t('cn.bonusList')}</span><span class="num" style="font-size:22px;color:var(--accent)">${game.bonus.length}</span></div>
      ${game.bonus.length ? `<div class="words">${game.bonus.map(w => `<span>${esc(w)}</span>`).join('')}</div>` : ''}
      <p class="help">${t('cn.bonusHelp')}</p>
    </div>`);
    bonusBtn.classList.add('open');
  }
  const closePop = () => { dock?.querySelector('.cn-pop')?.remove(); bonusBtn?.classList.remove('open'); };
  const onDocClick = e => { if (!e.target.closest?.('.cn-pop, .cn-bonus')) closePop(); };

  function paintPlay() {
    // While playing, the screen is exactly the window's height: status on top, the circle at the bottom
    // within reach of a thumb, the board in between - its tiles sized by width AND height (css: .fit).
    app.classList.add('fit');
    main.innerHTML = `<div class="status"></div>
    <div class="play">
      <div class="cw-wrap">${boardHtml(innerWidth > 900 ? 46 : 40)}</div>
      <div class="cn-entry"><div class="say" role="status" aria-live="polite"></div>
        <div class="cn-tap-actions" hidden><button class="btn btn-outline" type="button" data-remove>${t('cn.removeLast')}</button><button class="btn btn-primary" type="button" data-submit>${t('cn.submit')}</button></div>
      </div>
      <div class="dock">
        <div class="cn-ring n${n}"><svg class="cn-path" viewBox="0 0 100 100" aria-hidden="true"><polyline points=""></polyline></svg>${
          letters.map((ch, i) => `<button class="cn-key" type="button" data-i="${i}" aria-pressed="false">${esc(ch)}</button>`).join('')}</div>
        <button class="btn btn-ghost cn-tool shuf" type="button" aria-label="${t('cn.shuffle')}">${SHUFFLE}<span class="lbl">${t('cn.shuffle')}</span></button>
        <button class="btn btn-ghost cn-tool hint-btn" type="button" aria-label="${t('cn.hint')}">${BULB}<span class="lbl">${t('cn.hint')}</span></button>
        <button class="cn-bonus" type="button" aria-label="${t('cn.bonusList')}"><span class="num">${game.bonus.length}</span><small>${t('cn.bonus')}</small></button>
      </div>
      ${counts(game) ? `<p class="help practice-hint">${t('help.firstHintCn')}</p>` : ''}
      ${desk ? `<p class="cn-keys">${t('cn.keys')}</p>` : ''}
    </div>`;
    ring = $('.cn-ring');
    dock = $('.dock');
    bonusBtn = $('.cn-bonus');
    tapActions = $('.cn-tap-actions');
    tapSubmit = $('[data-submit]');
    collectCells();
    paintStatus();
    paintCells();
    placeKeys();
    sayIdle();

    // A short press adds to the draft. A swipe starts from the pressed letter and submits on release
    // (owner, 2026-11-26). Moving back onto the previous letter still takes the last off.
    ring.addEventListener('pointerdown', e => {
      if (!playing() || busy || press || !e.isPrimary || e.button !== 0) return;
      const { i } = under(e);
      if (i < 0) return;
      e.preventDefault();
      ring.setPointerCapture(e.pointerId);
      closePop();
      press = { id: e.pointerId, i, x: e.clientX, y: e.clientY };
    });
    ring.addEventListener('pointermove', e => {
      if (press?.id !== e.pointerId) return;
      const { i, at } = under(e);
      let added = false;
      if (!finger) {
        if ((i < 0 || i === press.i) && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8) return;
        path = [press.i];
        added = true;
        tapped = false;
      }
      finger = at;
      if (i >= 0 && path.length > 1 && i === path.at(-2)) path.pop();
      else if (i >= 0 && !path.includes(i)) { path.push(i); added = true; }
      if (added) playCue('tile');
      paintPath();
    });
    ring.addEventListener('pointerup', e => {
      if (press?.id !== e.pointerId) return;
      const { i } = press;
      press = null;
      if (!finger) return tapLetter(i);
      finger = null;
      answer();
    });
    const cancelPress = e => {
      if (press?.id !== e.pointerId) return;
      press = null;
      if (finger) { clearPath(); sayIdle(); }
    };
    ring.addEventListener('pointercancel', cancelPress);
    ring.addEventListener('lostpointercapture', cancelPress);
    ring.addEventListener('click', e => {
      const key = e.target.closest('.cn-key');
      if (key && e.detail === 0 && playing() && !busy && !press) tapLetter(+key.dataset.i);
    });
    const remove = $('[data-remove]');
    remove.addEventListener('click', () => { if (playing() && !busy && !press) removeLast(); });
    tapSubmit.addEventListener('click', () => { if (playing() && !busy && !press) answer(); });

    $('.cw').addEventListener('click', e => { const el = e.target.closest('[data-cell]'); if (el) choose(el.dataset.cell); });
    $('.shuf').addEventListener('click', shuffle);
    $('.hint-btn').addEventListener('click', hint);
    bonusBtn.addEventListener('click', togglePop);
    [$('.shuf'), $('.hint-btn'), bonusBtn, remove, tapSubmit].forEach(noFocus);
    refit();
  }

  // A computer types as well: each letter lights the first unused one on the circle and draws the path;
  // Backspace takes one off, Enter checks, Space shuffles, Esc lets go of the word (then leaves, main.js).
  function onKey(e) {
    if (!playing() || e.defaultPrevented || !app.isConnected || busy || press) return;
    if (e.target.closest?.('input, textarea')) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a')) return;   // a focused button presses itself
    if (e.metaKey || ((e.ctrlKey || e.altKey) && !e.getModifierState?.('AltGraph'))) return;
    const ch = e.key.toLowerCase();
    if (isLetterKey(e.key)) {
      const i = letters.findIndex((l, k) => l === ch && !path.includes(k));
      if (i < 0) return;
      e.preventDefault();
      closePop();
      path.push(i);
      playCue('tile');
      paintPath();
    } else if (e.key === 'Backspace' && path.length) {
      e.preventDefault();
      removeLast();
    } else if (e.key === 'Enter' && path.length) {
      e.preventDefault();
      answer();
    } else if (e.key === ' ') {
      e.preventDefault();
      shuffle();
    } else if (e.key === 'Escape' && (path.length || pick || dock.querySelector('.cn-pop'))) {
      e.preventDefault();
      pick = null;
      closePop();
      clearPath();
      paintCells();
      sayIdle();
    }
  }

  // The result is recorded at once; after a win the end waits for the last word to finish landing.
  function finish(status, accepted = false) {
    game.status = status;
    recordConnectEnd(game, connectRecord());
    recordAchievementEnd(game, 'connect');
    const cue = status === 'won' ? 'win' : 'loss';
    if (accepted) playCue('accepted', cue); else playCue(cue);
    setTimeout(() => { if (app.isConnected) paintEnd(); }, status === 'won' ? 700 : 0);
  }

  function paintEnd() {
    const won = game.status === 'won', done = doneList(), total = board.words.length;
    const left = board.words.filter(x => !done.includes(x));
    const count = `${done.length}/${total}`;
    const head = outcome(won, t(won ? 'cn.solved' : 'end.gaveUp'), count, t('cn.wordsLow'));
    const saved = archived ? game : getFinished(id);
    const card = `<div class="card result ${won ? 'won' : 'lost'}">
      <span class="eyebrow">${t(won ? 'cn.allLetters' : 'cn.left')}</span>
      ${won ? `<p class="display">${esc(game.key)}</p>` : `<p class="left-words">${left.map(x => `<span>${esc(x.w)}</span>`).join('')}</p>`}
      <div class="result-stats"><span><b>${count}</b> ${t('cn.wordsLow')}</span>${DOT}<span><b>${game.bonus.length}</b> ${plural(game.bonus.length, 'cn.bonusLow')}</span>${DOT}<span><b>${game.hints}</b> ${plural(game.hints, 'cn.hintsLow')}</span>${DOT}<span>${t('end.level')} <b>${t('diff.' + (game.diff ?? 'normal'))}</b></span></div>
      <p class="mean-words"><span class="eyebrow">${t('meaning.words')}</span>${board.words.map(x => wordLink(x.w, game.lang)).join('')}</p>
      <div class="result-actions">${archived ? '' : `<a class="btn btn-ghost" href="#/">${UI_ICONS.menu}${t('menu')}</a><a class="btn btn-primary" href="#/new/connect">${t('lt.again')} <span class="arrow">→</span></a>`}${keepButton(saved)}</div>
    </div>`;
    app.classList.remove('fit');
    main.innerHTML = `${head}${card}<div class="cw-flow">${boardHtml(40)}</div>
    <div class="cw-legend"><span><i class="c hit">a</i>${t('cn.lgFound')}</span><span><i class="c hit hinted">a</i>${t('cn.lgHintDone')}</span><span><i class="c hint">a</i>${t('cn.lgHint')}</span>${
      won ? '' : `<span><i class="c left">a</i>${t('cn.lgLeft')}</span>`}</div>`;
    wireKeep(main, saved);
    pick = null;
    collectCells();
    paintCells(!won);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refit();
  }

  if (playing()) paintPlay(); else paintEnd();
  if (archived) return;
  document.addEventListener('keydown', onKey, true);   // before main.js's Esc-goes-back
  document.addEventListener('click', onDocClick);
  const stop = playClock(root, game, () => app.isConnected);
  return () => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('click', onDocClick);
    stop();
  };
}
