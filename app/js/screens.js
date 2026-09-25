// Menu, game picker, new game, statistics, settings. Markup is the design handoff's
// (design/handoff/*.html), with the dummy text replaced by t(...) and live data.
import { t, plural, esc, num, decimal, clock, ago, dateTime, setLang, getLang, LANG_NAMES } from './i18n.js';
import { settings, saveSettings, stats, listSaves, getSave, putSave, deleteSave, newGame, gameName, HARD_WIN } from './store.js';
import { load, loadWords, preload, resolve, pickSecret, lengthStats } from './engine.js';
import { feedback, pool, pick, LEN_MIN, LEN_MAX, TRIES_MAX } from './letters.js';
import { makePuzzle, RANGE, RING_MIN, RING_MAX, visible, isDone } from './connect.js';
import { topbar, fillColor, confirmClick, applyTheme, applyAccent, ACCENTS, GLYPH, modeTag, TILE, squares } from './ui.js';
import { fitAll } from './fit.js';
import { click } from './sound.js';
import { VERSION, REPO } from './version.js';

const CATS = ['all', 'animals', 'food', 'household', 'clothing', 'tools', 'tech', 'vehicles', 'buildings',
  'nature', 'weather', 'body', 'people', 'jobs', 'school', 'science', 'sport', 'music', 'feelings',
  'abstract', 'verbs'];
const DIFFS = ['relaxed', 'easy', 'normal', 'hard'];
const BANDS = ['short', 'medium', 'long', 'any'];
const DOT = '<span class="dot">·</span>';
const on = cond => cond ? 'on' : '';

// Each game's icon in its menu row (design v4, "Lexling Menu Four Games"): Guess two ranked strips,
// Letters two rows of tiles, Connect a ring of real letters with a found word joined in green (SOWA /
// WORD), Tiles its glyph enlarged.
const RING5 = [[50, 14], [84.2, 38.9], [71.2, 79.1], [28.8, 79.1], [15.8, 38.9]];
const RING_WORD = { pl: 'sował', en: 'words' };   // the path joins the first four letters
const CUE = {
  guess: () => '<span class="strips"><i></i><i></i></span>',
  letters: () => `<span class="sq">${'<i></i>'.repeat(6)}</span>`,
  // the ring is grey only where the letters are not joined: from the last green letter round to the first
  connect: () => `<span class="cue-ring"><svg viewBox="0 0 100 100"><path d="M${RING5[3]} A36 36 0 0 1 ${RING5[4]} A36 36 0 0 1 ${RING5[0]}"></path><polyline points="${RING5.slice(0, 4).map(p => p.join(',')).join(' ')}"></polyline></svg>${
    [...RING_WORD[getLang()]].map((ch, i) => `<b class="${i < 4 ? 'on' : ''}" style="--x:${RING5[i][0]}%;--y:${RING5[i][1]}%">${ch}</b>`).join('')}</span>`,
  tiles: () => GLYPH.tiles,
};
// A game that is not built yet has its row, saying "soon", but does not open.
const GAMES = ['guess', 'letters', 'connect', 'tiles'];
const READY = new Set(['guess', 'letters', 'connect']);
const NEW_OF = { guess: '#/new', letters: '#/new/letters', connect: '#/new/connect' };
const LIST_OF = { guess: '#/games/guess', letters: '#/games/letters', connect: '#/games/connect' };

export function menu(root, _, refresh) {
  // One compact row per game, all the same size and weight - only the icon differs. Four of the old
  // big cards pushed Statistics and Settings off a phone's first screen. No count of games in progress
  // (owner, 2026-09-25) - only "soon" for a game not built yet.
  const row = key => {
    const live = READY.has(key) ? '' : `<span class="g-live">${t('menu.soon')}</span>`;
    const inner = `<span class="cue4" aria-hidden="true">${CUE[key]()}</span>
          <span class="g-text"><span class="g-head"><span class="g-name">${t('mode.' + key)}</span>${live}</span><span class="g-desc">${t(`mode.${key}.d`)}</span></span>`;
    return READY.has(key) ? `<a class="game" href="${LIST_OF[key]}">${inner}<span class="arrow" aria-hidden="true">→</span></a>`
      : `<div class="game soon" aria-disabled="true">${inner}</div>`;
  };
  root.innerHTML = `<div class="app" data-screen="menu">
  ${topbar({ right: `<span class="eyebrow lang-switch">${
    ['pl', 'en'].map(l => `<button type="button" data-lang="${l}" class="${on(getLang() === l)}" aria-label="${LANG_NAMES[l]}">${l.toUpperCase()}</button>`).join(DOT)}</span>` })}
  <section class="hero four">
    <div class="wm" aria-hidden="true">L/</div>
    <div class="hero-inner">
      <p class="eyebrow">${t('menu.eyebrow')} ${DOT} ${t('menu.offline')}</p>
      <h1 class="display">${t('menu.h1')}</h1>
      <p class="tagline">${t('menu.tagline')}</p>
      <nav class="games" aria-label="${t('menu.modesAria')}">${GAMES.map(row).join('')}</nav>
      <nav class="menu four" aria-label="${t('menu.nav')}">
        <a class="btn btn-outline" href="#/stats">${t('menu.stats')} <span class="arrow">→</span></a>
        <a class="btn btn-outline" href="#/settings">${t('menu.settings')} <span class="arrow">→</span></a>
      </nav>
    </div>
  </section>
  <footer class="footer"><span>v${VERSION}</span></footer>
</div>`;
  root.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => switchLang(b.dataset.lang, refresh)));
}

// `chosen` = the player picked the interface language themselves (menu switch or Settings). Until they
// do, the interface follows the language of the game they set up; afterwards their choice is kept.
function switchLang(lang, refresh, chosen = true) {
  if (!chosen && (settings.langChosen || settings.lang === lang)) return false;
  settings.lang = lang;
  settings.langChosen ||= chosen;
  saveSettings();
  setLang(lang);
  refresh();
  return true;
}

function saveMeta(g) {
  return [LANG_NAMES[g.lang],
    !g.friend && t(g.cat === 'all' ? 'cat.allLong' : 'cat.' + g.cat),
    !g.friend && g.band && g.band !== 'any' && t('band.' + g.band),
    !g.friend && g.diff !== 'normal' && t('diff.' + g.diff),
    g.friend && t('new.friend'),
    ago(g.updated)].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
}

function lettersMeta(g) {
  return [LANG_NAMES[g.lang], t(g.cat === 'all' ? 'cat.allLong' : 'cat.' + g.cat),
    `${g.len} ${plural(g.len, 'lt.letters')}`,
    g.tries ? `${g.tries} ${plural(g.tries, 'lt.triesUnit')}` : t('lt.noLimit'),
    t('diff.' + (g.diffRandom ? 'random' : g.diff)),
    g.marks && t('lt.marksShort'),
    ago(g.updated)].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
}

// Each mode has its own list of games in progress, reached from its card on the menu - never one
// mixed list (owner, 2026-09-25). New game on it starts that mode's game.
// A Connect card shows the words found of the board's, the bonus words, and one square per board word:
// green found, dashed finished by hints, empty still to find (design v4).
function connectMeta(g) {
  return [LANG_NAMES[g.lang], `${g.letters} ${plural(g.letters, 'lt.letters')}`, t('diff.' + (g.diffRandom ? 'random' : g.diff)),
    g.marks && t('lt.marksShort'), ago(g.updated)].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
}

export function games(root, mode, refresh) {
  if (!['letters', 'connect'].includes(mode)) mode = 'guess';
  const saves = listSaves().filter(g => g.mode === mode);
  // most likely the game about to be resumed
  if (saves.length) (mode === 'guess' ? preload(saves[0].lang) : loadWords(saves[0].lang).catch(() => {}));
  const actions = g => `<div class="save-actions">
    <a class="btn btn-primary" href="#/game/${g.id}">${t('games.resume')}</a>
    <button class="btn btn-ghost" type="button" data-act="rename">${t('games.rename')}</button>
    <button class="btn btn-ghost btn-danger" type="button" data-act="delete">${t('games.delete')}</button>
  </div>`;
  const guessCard = g => {
    const best = g.guesses.reduce((b, x) => !b || x.rank < b.rank ? x : b, null);
    return `<article class="card save" data-id="${g.id}">
  <div>
    <h2 class="save-name">${esc(gameName(g))}</h2>
    <div class="save-meta">${saveMeta(g)}</div>
  </div>
  ${actions(g)}
  <div class="save-best"><span>${g.guesses.length} ${plural(g.guesses.length, 'n.guesses')}</span><div class="bar"><i style="--pct:${best ? best.pct : 0}%;--fill:${fillColor(best ? best.pct : 0)}"></i></div><span>${t('games.best')} ${
    best ? `<b style="color:var(--text)">${esc(best.w)}</b> ${DOT} <b class="num" style="color:var(--text)">${num(best.rank)}</b>` : '—'}</span></div>
</article>`;
  };
  // A Letters card shows tries used and the last guess as bare squares - the colours, never the letters.
  const lettersCard = g => {
    const used = g.guesses.length, last = g.guesses.at(-1);
    return `<article class="card save" data-id="${g.id}">
  <div>
    <h2 class="save-name">${esc(gameName(g))}</h2>
    <div class="save-meta">${lettersMeta(g)}</div>
  </div>
  ${actions(g)}
  <div class="save-last">${last
    ? `<span><span>${g.tries ? t('games.triesOf', { g: `<b class="num">${used}</b>`, t: g.tries }) : `<b class="num">${used}</b> ${plural(used, 'lt.triesUnit')}`}</span></span>${
      squares(feedback(last, g.secret).map(f => TILE[f]))}`
    : `<span><span>${t('games.notStarted')}</span></span>`}</div>
</article>`;
  };
  const connectCard = g => {
    const vis = visible(g.board, g.found, g.shown);
    const marks = g.board.words.map(x => g.found.includes(x.w) ? 'hit' : isDone(x, g.found, vis) ? 'hintd' : '');
    const done = marks.filter(Boolean).length;
    return `<article class="card save" data-id="${g.id}">
  <div>
    <h2 class="save-name">${esc(gameName(g))}</h2>
    <div class="save-meta">${connectMeta(g)}</div>
  </div>
  ${actions(g)}
  <div class="save-last">${done || g.bonus.length
    ? `<span><b class="num">${done}</b> / ${g.board.words.length} ${t('cn.wordsLow')}${DOT}<b class="num">${g.bonus.length}</b> ${t('cn.bonusLow')}</span>`
    : `<span>${t('cn.noWords')}</span>`}${squares(marks, 14)}</div>
</article>`;
  };
  const card = { guess: guessCard, letters: lettersCard, connect: connectCard }[mode];
  const start = big => `<a class="btn btn-primary${big ? ' btn-lg' : ''}" href="${NEW_OF[mode]}">${t('games.new')} <span class="arrow">→</span></a>`;
  root.innerHTML = `<div class="app" data-screen="games">
  ${topbar({ left: `<a class="btn btn-ghost" href="#/">${t('back.menu')}</a>`, right: modeTag(mode) })}
  <main class="main">
    <div class="head"><h1 class="title">${t('games.title')}</h1>${saves.length ? start() : ''}</div>
    ${saves.length ? `<div class="saves">${saves.map(card).join('')}</div>` : `<div class="card empty">
      <p class="display">${t('games.emptyTitle')}</p>
      <p class="help" style="max-width:36ch">${t('games.emptyText')}</p>
      ${start(true)}
    </div>`}
  </main>
</div>`;
  root.querySelectorAll('.save').forEach(el => {
    const id = el.dataset.id;
    confirmClick(el.querySelector('[data-act=delete]'), () => { deleteSave(id); refresh(); }, () => fitAll(el));
    el.querySelector('[data-act=rename]').addEventListener('click', () => rename(el, getSave(id), refresh));
  });
}

function rename(el, game, refresh) {
  const title = el.querySelector('.save-name');
  if (title.querySelector('input')) return;
  title.innerHTML = `<input class="input" type="text" maxlength="40" aria-label="${t('games.nameLabel')}">`;
  const input = title.firstChild;
  input.value = gameName(game);
  input.focus();
  input.select();
  let done = false;
  const finish = keep => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (keep && name && name !== game.name) { game.name = name; putSave(game); }
    refresh();
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') { finish(false); e.stopPropagation(); }   // Esc cancels the rename, not the screen
  });
  input.addEventListener('blur', () => finish(true));
}

// ── How to play (owner, 2026-09-25) ── a card under the New game title that opens and closes: open until a
// game of that kind has been finished, closed after that - and once the player opens or closes it, as they left it.
const HOWTO = { guess: () => t('howto.guess'), letters: () => t('howto.letters'), connect: () => t('howto.connect') };
const FINISHED = { guess: () => stats.won + stats.givenUp, letters: () => stats.lt.won + stats.lt.lost + stats.lt.givenUp,
  connect: () => stats.cn.solved + stats.cn.givenUp };
const howTo = mode => `<details class="card howto" data-mode="${mode}"${settings.howTo?.[mode] ?? !FINISHED[mode]() ? ' open' : ''}>
      <summary><span class="eyebrow">${t('howto.title')}</span><span class="arrow" aria-hidden="true">›</span></summary>
      ${HOWTO[mode]().split('\n').map(line => `<p class="help"><span class="arrow">→</span> ${line}</p>`).join('')}
    </details>`;
// remember an open / close the player made (not the one the page makes as it draws the card)
function wireHowTo(root) {
  const el = root.querySelector('.howto');
  let shown = el.open;
  el.addEventListener('toggle', () => {
    if (el.open === shown) return;
    shown = el.open;
    settings.howTo = { ...settings.howTo, [el.dataset.mode]: el.open };
    saveSettings();
  });
}

// Every game starts from the same footing - the settings of the last one are rarely what you want for
// the next. The language is the exception: that is a preference, not a per-game choice.
const NEW_GAME = { cat: 'all', band: 'any', diff: 'normal', friend: false };
let pending = null;   // choices half-made, kept only across the re-render that a language switch causes

export function newGameScreen(root, _, refresh) {
  const o = pending ?? { ...NEW_GAME, lang: settings.newGame.lang || settings.lang };
  pending = null;
  root.innerHTML = `<div class="app" data-screen="new">
  ${topbar({ left: `<a class="btn btn-ghost" href="${LIST_OF.guess}">${t('back.games')}</a>`, right: modeTag('guess') })}
  <main class="main">
    <h1 class="title">${t('new.title')}</h1>
    ${howTo('guess')}
    <form class="form" novalidate>
      <div class="field">
        <span class="eyebrow">${t('new.lang')}</span>
        <div class="seg" role="radiogroup">${['pl', 'en'].map(l => `<button type="button" data-k="lang" data-v="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>
      </div>
      <div class="field">
        <div class="field-head"><span class="eyebrow">${t('new.cat')}</span><span class="help">${t('new.catHint')}</span></div>
        <div class="chips">${CATS.map(c => `<button type="button" class="chip" data-k="cat" data-v="${c}">${t('cat.' + c)}</button>`).join('')}</div>
        <p class="help cat-about" id="cat-about"></p>
      </div>
      <div class="field" style="gap:var(--space-4)">
        <span class="eyebrow">${t('new.len')}</span>
        <div class="seg" role="radiogroup" aria-label="${t('new.lenAria')}">${BANDS.map(b => `<button type="button" data-k="band" data-v="${b}">${t('band.' + b)}</button>`).join('')}</div>
        <div class="hist" aria-hidden="true" id="hist"></div>
        <div class="readout" id="readout"></div>
        <p class="help">${t('new.lenHelp', { any: t('band.any') })}</p>
      </div>
      <div class="field">
        <span class="eyebrow">${t('new.diff')}</span>
        <div class="seg" role="radiogroup">${DIFFS.map(d => `<button type="button" data-k="diff" data-v="${d}">${t('diff.' + d)}</button>`).join('')}</div>
        <p class="help"><span class="arrow">→</span> ${t('new.diffHelp')}</p>
      </div>
      <div class="card friend">
        <div class="row">
          <div class="row-text"><strong>${t('new.friend')}</strong><span>${t('new.friendDesc')}</span></div>
          <button type="button" class="toggle" role="switch" aria-label="${t('new.friend')}"></button>
        </div>
        <div class="field" id="secret-field">
          <div class="field-head"><span class="eyebrow">${t('new.secret')}</span><span class="help">${t('new.secretHint')}</span></div>
          <input class="input" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="${t('new.secretAria')}">
          <p class="help"><span class="arrow">→</span> <span id="forms-help"></span></p>
        </div>
      </div>
      <div class="cta">
        <p class="summary"></p>
        <p class="help err" id="new-err" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${t('new.start')} <span class="arrow">→</span></button>
      </div>
    </form>
  </main>
</div>`;
  wireHowTo(root);
  const $ = sel => root.querySelector(sel);
  const err = $('#new-err'), toggle = $('.toggle'), secret = $('input[type=password]');
  const sync = () => {
    root.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', String(o[b.dataset.k]) === b.dataset.v));
    lengths();
    toggle.classList.toggle('on', o.friend);
    toggle.setAttribute('aria-checked', o.friend);
    $('#secret-field').hidden = !o.friend;
    $('#forms-help').innerHTML = t('new.formsHelp', { forms: o.lang === 'pl' ? '<em>żyrafie</em>, <em>żyrafy</em>' : '<em>giraffes</em>, <em>mice</em>' });
    // what the chosen category actually covers, so you are not hunting for a word it never hides
    $('#cat-about').textContent = t('about.' + o.cat);
    $('.summary').innerHTML = [LANG_NAMES[o.lang], t('cat.' + o.cat), t('band.' + o.band), t('diff.' + o.diff), o.friend && t('new.friendShort')]
      .filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
    err.hidden = true;
  };

  // The histogram is this language and category's real word lengths, so it can only be drawn once the
  // word data is here (~1.3 s for Polish). Until then the bars stay flat rather than showing a guess.
  let token = 0;
  async function lengths(stats) {
    if (!stats) {
      const mine = ++token;
      const m = await load(o.lang).catch(() => null);
      if (!m || mine !== token) return;          // a newer click already asked for other numbers
      return lengths(lengthStats(m, o));
    }
    const tallest = Math.max(...stats.bars.map(b => b.count), 1);
    $('#hist').innerHTML = stats.bars.map(b =>
      `<span class="${b.on ? 'on' : ''}"><b style="height:${Math.round(b.count / tallest * 52) + (b.count ? 4 : 2)}px"></b><em>${b.len}${b.last ? '+' : ''}</em></span>`).join('');
    $('#readout').innerHTML = stats.count
      ? `<span class="num">${stats.from === stats.to ? stats.from : `${stats.from}–${stats.to}`}</span><span class="help">${
        t('new.lenCount', { n: num(stats.count), words: plural(stats.count, 'n.words') })}</span>`
      : `<span class="num">0</span><span class="help">${t('new.lenEmpty')}</span>`;
    fitAll(root);
  }
  $('#hist').innerHTML = Array.from({ length: 10 }, () => '<span><b style="height:2px"></b><em>&nbsp;</em></span>').join('');
  sync();
  root.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    o[b.dataset.k] = b.dataset.v;
    if (b.dataset.k === 'lang') {          // the interface follows, unless the player has chosen one
      settings.newGame = { lang: o.lang };
      saveSettings();
      pending = o;                         // this re-render is ours: keep what is already filled in
      if (switchLang(b.dataset.v, refresh, false)) return;
      pending = null;                      // …no re-render happened after all
    }
    sync();
  }));
  toggle.addEventListener('click', () => { o.friend = !o.friend; sync(); if (o.friend) secret.focus(); });
  secret.addEventListener('input', () => { err.hidden = true; });

  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const m = await load(o.lang);
    const idx = o.friend ? resolve(m, secret.value)?.idx ?? -1 : pickSecret(m, o);
    if (idx < 0) {
      err.textContent = t(o.friend ? 'new.errUnknown' : 'new.errNoWords');
      err.hidden = false;
      return;
    }
    settings.newGame = { lang: o.lang };   // the next game starts from NEW_GAME again
    saveSettings();
    const game = newGame({ ...o, secret: m.words[idx] });
    location.replace('#/game/' + game.id);   // Back from the game goes to the picker, not to this form
  });
}

// ── Letters: new game (design: handoff-letters/new-game-letters.html) ─────────────────────────────
// Same footing rule as above: every game starts from these; the language and "Allow Polish letters" carry over.
const LT_NEW = { cat: 'all', len: 5, anyLen: false, tries: 6, unlimited: false, diff: 'normal', diffRandom: false };
let ltPending = null;

export function lettersNewScreen(root, _, refresh) {
  const o = ltPending ?? { ...LT_NEW, lang: settings.newGame.lang || settings.lang, marks: settings.polish?.letters ?? true };
  ltPending = null;
  const lengths = Array.from({ length: LEN_MAX - LEN_MIN + 1 }, (_, i) => LEN_MIN + i);
  const stepper = (id, less, more) => `<div class="stepper" id="${id}"><button type="button" data-step="-1" aria-label="${less}">−</button><output></output><button type="button" data-step="1" aria-label="${more}">+</button></div>`;
  root.innerHTML = `<div class="app" data-screen="new">
  ${topbar({ left: `<a class="btn btn-ghost" href="${LIST_OF.letters}">${t('back.games')}</a>`, right: modeTag('letters') })}
  <main class="main">
    <h1 class="title">${t('new.title')}</h1>
    ${howTo('letters')}
    <form class="form" novalidate>
      <div class="field">
        <span class="eyebrow">${t('new.lang')}</span>
        <div class="seg" role="radiogroup">${['pl', 'en'].map(l => `<button type="button" data-k="lang" data-v="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>
      </div>
      <div class="field">
        <div class="field-head"><span class="eyebrow">${t('new.cat')}</span><span class="help">${t('new.catHint')}</span></div>
        <div class="chips">${CATS.map(c => `<button type="button" class="chip" data-k="cat" data-v="${c}">${t('cat.' + c)}</button>`).join('')}</div>
        <p class="help cat-about" id="cat-about"></p>
      </div>
      <div class="field" style="gap:var(--space-4)">
        <span class="eyebrow">${t('lt.len')}</span>
        <div class="tries">
          ${stepper('len', t('lt.shorter'), t('lt.longer'))}
          <button type="button" class="chip" role="switch" id="any-len"><span class="num">?</span>${t('lt.anyLen')}</button>
        </div>
        <div class="hist" role="group" aria-label="${t('lt.len')}" id="hist">${lengths.map(len =>
    `<button type="button" data-len="${len}" aria-label="${len}"><b style="height:3px"></b><em>${len}</em></button>`).join('')}</div>
        <div class="readout" id="readout"></div>
      </div>
      <div class="field">
        <div class="field-head"><span class="eyebrow">${t('lt.tries')}</span><span class="help">${t('lt.triesHint')}</span></div>
        <div class="tries">
          ${stepper('tries', t('lt.fewer'), t('lt.more'))}
          <button type="button" class="chip" role="switch" id="unlimited"><span class="num">∞</span>${t('lt.unlimited')}</button>
        </div>
      </div>
      <div class="field">
        <span class="eyebrow">${t('new.diff')}</span>
        <div class="tries">
          <div class="seg" role="radiogroup" id="diff">${DIFFS.map(d => `<button type="button" data-k="diff" data-v="${d}">${t('diff.' + d)}</button>`).join('')}</div>
          <button type="button" class="chip" role="switch" id="random-diff"><span class="num">?</span>${t('diff.random')}</button>
        </div>
        <p class="help"><span class="arrow">→</span> ${t('lt.diffHelp')}</p>
      </div>
      <div class="card polish" id="polish">
        <div class="row">
          <div class="row-text"><strong>${t('lt.polish')}</strong><span class="marks">ą ć ę ł ń ó ś ź ż</span></div>
          <button type="button" class="toggle" role="switch" aria-label="${t('lt.polish')}"></button>
        </div>
        <p class="help"><span class="arrow">→</span> <span id="polish-help"></span></p>
      </div>
      <div class="cta">
        <p class="summary"></p>
        <p class="help err" id="new-err" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${t('new.start')} <span class="arrow">→</span></button>
      </div>
    </form>
  </main>
</div>`;
  wireHowTo(root);
  const $ = sel => root.querySelector(sel);
  const form = $('form'), err = $('#new-err'), start = $('[type=submit]'), toggle = $('#polish .toggle'), unlimited = $('#unlimited'), anyLen = $('#any-len'), randomDiff = $('#random-diff');
  // Polish letters are a Polish-only choice; an English word never has them to begin with
  const marks = () => o.lang === 'pl' && o.marks;
  const choice = () => ({ cat: o.cat, diff: o.diffRandom ? 'random' : o.diff, marks: o.lang !== 'pl' || o.marks });

  const sync = () => {
    root.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', String(o[b.dataset.k]) === b.dataset.v));
    // a category means a noun (except Verbs) - said here rather than discovered in the game
    $('#cat-about').textContent = t('about.' + o.cat) + (o.cat === 'all' || o.cat === 'verbs' ? '' : ' ' + t('lt.catNouns'));
    // Random: the game draws one of the four levels when it starts and keeps it to itself
    $('#diff').classList.toggle('off', o.diffRandom);
    if (o.diffRandom) $('#diff').querySelectorAll('button').forEach(b => b.classList.remove('on'));
    randomDiff.classList.toggle('on', o.diffRandom);
    randomDiff.setAttribute('aria-checked', o.diffRandom);
    const [shorter, longer] = $('#len').querySelectorAll('button');
    // "any" = the game picks: a random word of any length, so lengths come up as often as words of them do
    $('#len').classList.toggle('off', o.anyLen);
    $('#len output').innerHTML = o.anyLen ? `<span class="num">${LEN_MIN}–${LEN_MAX}</span><span class="help">${plural(LEN_MAX, 'lt.letters')}</span>`
      : `<span class="num">${o.len}</span><span class="help">${plural(o.len, 'lt.letters')}</span>`;
    shorter.disabled = o.anyLen || o.len <= LEN_MIN;
    longer.disabled = o.anyLen || o.len >= LEN_MAX;
    anyLen.classList.toggle('on', o.anyLen);
    anyLen.setAttribute('aria-checked', o.anyLen);
    const [fewer, more] = $('#tries').querySelectorAll('button');
    $('#tries output').innerHTML = o.unlimited ? '<span class="num">∞</span><span class="help"></span>'
      : `<span class="num">${o.tries}</span><span class="help">${plural(o.tries, 'lt.triesUnit')}</span>`;
    fewer.disabled = !o.unlimited && o.tries <= 1;
    more.disabled = o.unlimited;
    unlimited.classList.toggle('on', o.unlimited);
    unlimited.setAttribute('aria-checked', o.unlimited);
    $('#polish').hidden = o.lang !== 'pl';
    toggle.classList.toggle('on', o.marks);
    toggle.setAttribute('aria-checked', o.marks);
    $('#polish-help').innerHTML = t(o.marks ? 'lt.polishOn' : 'lt.polishOff');
    $('.summary').innerHTML = [LANG_NAMES[o.lang], t('cat.' + o.cat), o.anyLen ? t('lt.anyLenLong') : `${o.len} ${plural(o.len, 'lt.letters')}`,
      o.unlimited ? `∞ ${plural(0, 'lt.triesUnit')}` : `${o.tries} ${plural(o.tries, 'lt.triesUnit')}`,
      t('diff.' + (o.diffRandom ? 'random' : o.diff)), marks() && t('lt.marksShort')].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
    counts();
    fitAll(root);
  };

  // The bars are how many words each length can hide with the other choices as they are, so they need
  // the word data (~9 MB for Polish). Until it is here they stay flat, and the readout empty.
  const ready = {};
  function counts() {
    const m = ready[o.lang];
    const bars = [...$('#hist').children];
    if (!m) {
      bars.forEach(bar => { bar.className = o.anyLen || +bar.dataset.len === o.len ? 'on' : ''; });
      $('#readout').innerHTML = '';
      loadWords(o.lang).then(data => { ready[o.lang] = data; if (form.isConnected) counts(); }).catch(() => {});
      return;
    }
    const n = new Map(lengths.map(len => [len, pool(m, { len, ...choice() }).length]));
    const tallest = Math.max(...n.values(), 1);
    bars.forEach(bar => {
      const len = +bar.dataset.len, c = n.get(len);
      bar.className = [(o.anyLen || len === o.len) && 'on', !c && 'none'].filter(Boolean).join(' ');
      bar.firstElementChild.style.height = (c ? Math.round(c / tallest * 52) + 4 : 3) + 'px';
    });
    const here = o.anyLen ? pool(m, choice()).length : n.get(o.len);
    $('#readout').className = 'readout' + (here ? '' : ' none');
    $('#readout').innerHTML = `<span class="num">${num(here)}</span><span class="help">${t(here ? 'lt.canHide' : 'lt.none')}</span>`;
    err.textContent = t('lt.errNoWords');
    err.hidden = !!here;
    start.disabled = !here;
  }

  sync();
  root.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    o[b.dataset.k] = b.dataset.v;
    if (b.dataset.k === 'diff') o.diffRandom = false;   // choosing a level is choosing not to leave it to chance
    if (b.dataset.k === 'lang') {          // the interface follows, unless the player has chosen one
      settings.newGame = { lang: o.lang };
      saveSettings();
      ltPending = o;                       // this re-render is ours: keep what is already filled in
      if (switchLang(b.dataset.v, refresh, false)) return;
      ltPending = null;                    // …no re-render happened after all
    }
    sync();
  }));
  $('#len').addEventListener('click', e => {
    const step = +e.target.closest('[data-step]')?.dataset.step;
    if (step) { o.len = Math.min(LEN_MAX, Math.max(LEN_MIN, o.len + step)); sync(); }
  });
  $('#hist').addEventListener('click', e => {
    const bar = e.target.closest('[data-len]');
    if (bar) { o.len = +bar.dataset.len; o.anyLen = false; sync(); }
  });
  $('#tries').addEventListener('click', e => {
    const step = +e.target.closest('[data-step]')?.dataset.step;
    if (!step) return;
    // ∞ is the step after the most tries (owner, 2026-09-25): + at 20 turns Unlimited on, − from it gives 20
    if (o.unlimited) { if (step < 0) { o.unlimited = false; o.tries = TRIES_MAX; } }
    else if (step > 0 && o.tries >= TRIES_MAX) o.unlimited = true;
    else o.tries = Math.min(TRIES_MAX, Math.max(1, o.tries + step));
    sync();
  });
  unlimited.addEventListener('click', () => { o.unlimited = !o.unlimited; sync(); });
  anyLen.addEventListener('click', () => { o.anyLen = !o.anyLen; sync(); });
  randomDiff.addEventListener('click', () => { o.diffRandom = !o.diffRandom; sync(); });
  toggle.addEventListener('click', () => { o.marks = !o.marks; settings.polish = { ...settings.polish, letters: o.marks }; saveSettings(); sync(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const m = await loadWords(o.lang);
    // Random draws one of the four levels now; the game keeps it for the score and shows only "Random"
    const diff = o.diffRandom ? DIFFS[Math.floor(Math.random() * DIFFS.length)] : o.diff;
    const idx = pick(m, { len: o.anyLen ? null : o.len, ...choice(), diff });
    if (idx < 0) { err.hidden = false; return; }
    settings.newGame = { lang: o.lang };
    saveSettings();
    const game = newGame({ mode: 'letters', lang: o.lang, cat: o.cat, len: [...m.words[idx]].length, tries: o.unlimited ? 0 : o.tries,
      diff, diffRandom: o.diffRandom, marks: marks(), secret: m.words[idx] });
    location.replace('#/game/' + game.id);   // Back from the game goes to the picker, not to this form
  });
}

// ── Connect: new game (design v4, "Lexling Connect" 2) ─────────────────────────────────────────────
// The Letters controls, rebuilt: letters in the circle, the level (+ Random), the Polish-letters card.
const CN_NEW = { letters: 6, diff: 'normal', diffRandom: false };
let cnPending = null;

export function connectNewScreen(root, _, refresh) {
  const o = cnPending ?? { ...CN_NEW, lang: settings.newGame.lang || settings.lang, marks: settings.polish?.connect ?? true };
  cnPending = null;
  root.innerHTML = `<div class="app" data-screen="new">
  ${topbar({ left: `<a class="btn btn-ghost" href="${LIST_OF.connect}">${t('back.games')}</a>`, right: modeTag('connect') })}
  <main class="main">
    <h1 class="title">${t('new.title')}</h1>
    ${howTo('connect')}
    <form class="form" novalidate>
      <div class="field">
        <span class="eyebrow">${t('new.lang')}</span>
        <div class="seg" role="radiogroup">${['pl', 'en'].map(l => `<button type="button" data-k="lang" data-v="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>
      </div>
      <div class="field" style="gap:var(--space-4)">
        <span class="eyebrow">${t('cn.count')}</span>
        <div class="stepper" id="letters"><button type="button" data-step="-1" aria-label="−">−</button><output></output><button type="button" data-step="1" aria-label="+">+</button></div>
        <div class="readout" id="range"></div>
      </div>
      <div class="field">
        <div class="field-head"><span class="eyebrow">${t('cn.level')}</span><span class="help">${t('cn.levelWhat')}</span></div>
        <div class="tries">
          <div class="seg" role="radiogroup" id="diff">${DIFFS.map(d => `<button type="button" data-k="diff" data-v="${d}">${t('diff.' + d)}</button>`).join('')}</div>
          <button type="button" class="chip" role="switch" id="random-diff"><span class="num">?</span>${t('diff.random')}</button>
        </div>
        <p class="help"><span class="arrow">→</span> <span id="level-help"></span></p>
      </div>
      <div class="card polish" id="polish">
        <div class="row">
          <div class="row-text"><strong>${t('cn.polish')}</strong><span class="marks">ą ć ę ł ń ó ś ź ż</span></div>
          <button type="button" class="toggle" role="switch" aria-label="${t('cn.polish')}"></button>
        </div>
        <p class="help"><span class="arrow">→</span> <span id="polish-help"></span></p>
      </div>
      <div class="cta">
        <p class="summary"></p>
        <p class="help err" id="new-err" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${t('new.start')} <span class="arrow">→</span></button>
      </div>
    </form>
  </main>
</div>`;
  wireHowTo(root);
  const $ = sel => root.querySelector(sel);
  const form = $('form'), err = $('#new-err'), toggle = $('#polish .toggle'), randomDiff = $('#random-diff');
  const marks = () => o.lang === 'pl' && o.marks;
  const sync = () => {
    root.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', String(o[b.dataset.k]) === b.dataset.v));
    $('#diff').classList.toggle('off', o.diffRandom);
    if (o.diffRandom) $('#diff').querySelectorAll('button').forEach(b => b.classList.remove('on'));
    randomDiff.classList.toggle('on', o.diffRandom);
    randomDiff.setAttribute('aria-checked', o.diffRandom);
    const [fewer, more] = $('#letters').querySelectorAll('button');
    $('#letters output').innerHTML = `<span class="num">${o.letters}</span><span class="help">${plural(o.letters, 'lt.letters')}</span>`;
    fewer.disabled = o.letters <= RING_MIN;
    more.disabled = o.letters >= RING_MAX;
    // how many words a circle of this size usually gives
    $('#range').innerHTML = `<span class="num">${RANGE[o.letters].join('–')}</span><span class="help">${t('cn.readout')}</span>`;
    $('#level-help').textContent = t('cn.lv.' + (o.diffRandom ? 'random' : o.diff));
    $('#polish').hidden = o.lang !== 'pl';
    toggle.classList.toggle('on', o.marks);
    toggle.setAttribute('aria-checked', o.marks);
    $('#polish-help').textContent = t(o.marks ? 'cn.polishOn' : 'cn.polishOff');
    $('.summary').innerHTML = [LANG_NAMES[o.lang], `${o.letters} ${plural(o.letters, 'lt.letters')}`,
      t('diff.' + (o.diffRandom ? 'random' : o.diff)), marks() && t('lt.marksShort')].filter(Boolean).map(s => `<span>${s}</span>`).join(DOT);
    err.hidden = true;
    fitAll(root);
  };
  sync();
  loadWords(o.lang).catch(() => {});      // the word data, ready by the time Start is pressed
  root.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    o[b.dataset.k] = b.dataset.v;
    if (b.dataset.k === 'diff') o.diffRandom = false;
    if (b.dataset.k === 'lang') {
      settings.newGame = { lang: o.lang };
      saveSettings();
      cnPending = o;
      if (switchLang(b.dataset.v, refresh, false)) return;
      cnPending = null;
      loadWords(o.lang).catch(() => {});
    }
    sync();
  }));
  $('#letters').addEventListener('click', e => {
    const step = +e.target.closest('[data-step]')?.dataset.step;
    if (step) { o.letters = Math.min(RING_MAX, Math.max(RING_MIN, o.letters + step)); sync(); }
  });
  randomDiff.addEventListener('click', () => { o.diffRandom = !o.diffRandom; sync(); });
  toggle.addEventListener('click', () => { o.marks = !o.marks; settings.polish = { ...settings.polish, connect: o.marks }; saveSettings(); sync(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const m = await loadWords(o.lang);
    // Random draws one of the four levels now; the game shows only "Random"
    const diff = o.diffRandom ? DIFFS[Math.floor(Math.random() * DIFFS.length)] : o.diff;
    const puzzle = makePuzzle(m, { letters: o.letters, diff, marks: o.lang !== 'pl' || o.marks });
    if (!puzzle) { err.textContent = t('cn.errNone'); err.hidden = false; return; }
    settings.newGame = { lang: o.lang };
    saveSettings();
    const game = newGame({ mode: 'connect', lang: o.lang, letters: o.letters, diff, diffRandom: o.diffRandom, marks: marks(),
      ring: puzzle.ring, key: puzzle.key, board: puzzle.board, found: [], shown: [], bonus: [], hints: 0 });
    location.replace('#/game/' + game.id);   // Back from the game goes to the list, not to this form
  });
}

let statsTab = 'guess';   // which game the stats screen shows, kept while the app is open
// one tab per game that exists (design v4): Tiles gets its tab when it is built
const STAT_TABS = ['guess', 'letters', 'connect'];

export function statsScreen(root, _, refresh) {
  const s = stats, lt = s.lt;
  if (!STAT_TABS.includes(statsTab)) statsTab = 'guess';
  // a game not played yet says so, above its numbers - which show in dim ink
  const cn = s.cn;
  const none = { guess: !s.played, letters: !lt.played, connect: !cn.played }[statsTab];
  const card = (label, value, sub = '') => `<div class="card stat-card${none ? ' dim' : ''}"><span class="eyebrow">${label}</span><span class="num">${value}</span>${sub && `<span class="sub">${sub}</span>`}</div>`;
  // Each game's one "shape" card (design v4): how many tries its wins took, the commonest bar in the
  // game's colour. Counted from 0.24.0 on - older wins were only ever kept as a total.
  // hints used, and how many a game on average - Guess and Letters counted since 0.29.0, Connect from the start
  const hintCard = (hints = 0, games = 0) => card(t('stats.hints'), num(hints), games ? t('stats.hintsPerGame', { n: decimal((hints / games).toFixed(1)) }) : '');
  const dist = (title, help, rows, tone = '', ink = '') => {
    const max = Math.max(...rows.map(r => r[1]));
    return `<div class="card dist"${tone ? ` style="--tone:${tone};--tone-ink:${ink}"` : ''}>
      <div class="dist-head"><span class="eyebrow">${title}</span><span class="help">${help}</span></div>
      <ol>${rows.map(([k, v]) => `<li class="${v === max ? 'top' : ''}"><span>${k}</span><b style="--pct:${Math.max(10, Math.round(v / max * 100))}%">${num(v)}</b></li>`).join('')}</ol>
    </div>`;
  };
  const gd = s.guessDist ?? {}, gWins = Object.values(gd).reduce((a, b) => a + b, 0);
  const guessPanel = () => `<div class="stats">
      ${card(t('stats.played'), num(s.played))}
      ${card(t('stats.won'), num(s.won), s.played ? Math.round(s.won / s.played * 100) + ' %' : '')}
      ${card(t('stats.givenUp'), num(s.givenUp))}
      ${card(t('stats.words'), num(s.words))}
      ${card(t('stats.unique'), num(s.unique.length))}
      ${card(t('stats.letters'), num(s.letters))}
      ${card(t('stats.time'), `${clock(s.timeMs, true)}<span class="muted" style="font:500 13px var(--font-body)"> h</span>`, t('stats.timeSub'))}
      ${card(t('stats.bestWin'), s.bestWin ? num(s.bestWin) : '—', s.bestWin ? plural(s.bestWin, 'n.guesses') : '')}
      ${card(t('stats.avgWin'), s.wonRated ? decimal((s.wonGuesses / s.wonRated).toFixed(1)) : '—', t('stats.perWon'))}
      ${card(t('stats.hardest'), s.hardest ? `<span style="font-size:.7em">${esc(s.hardest.w)}</span>` : '—',
    s.hardest ? t('stats.hardestSub', { n: s.hardest.score }) : '')}
      ${card(t('stats.hardWins'), num(s.hardWins ?? 0), t('stats.hardWinsSub', { n: HARD_WIN }))}
      ${card(t('stats.pools'), num(Object.keys(s.wonPools ?? {}).length), t('stats.poolsSub', { n: CATS.length }))}
      ${card(t('stats.byLang'), `${num(s.wonLang?.pl ?? 0)} / ${num(s.wonLang?.en ?? 0)}`)}
      ${hintCard(s.hints, s.hintGames)}
    </div>
    ${gWins ? dist(t('stats.perWinGuess'), `${num(gWins)} ${plural(gWins, 'n.wins')}`,
    [['1–10', gd.a || 0], ['11–25', gd.b || 0], ['26–50', gd.c || 0], ['51+', gd.d || 0]], 'var(--fill-hot)', '#000') : ''}
    <p class="help">${t('stats.noCat')}</p>`;
  const ld = lt.dist ?? {}, lWins = ['1', '2', '3', '4', '5', '6', '7+'].reduce((a, k) => a + (ld[k] || 0), 0), lLost = ld.x || 0;
  // wins at each word length, 3 to 13, so the player sees which ones are missing
  const lengthsStrip = `<div class="lengths" aria-label="${t('stats.byLen')}">${Array.from({ length: 11 }, (_, i) => i + 3).map(len =>
    `<span class="${lt.wonLen[len] ? 'won' : ''}"><b>${lt.wonLen[len] ? num(lt.wonLen[len]) : '·'}</b><em>${len}</em></span>`).join('')}</div>`;
  const lettersPanel = () => `<div class="stats">
        ${card(t('stats.played'), num(lt.played))}
        ${card(t('stats.won'), num(lt.won), lt.played ? Math.round(lt.won / lt.played * 100) + ' %' : '')}
        ${card(t('stats.streak'), num(lt.streak), t('stats.streakBest', { n: num(lt.bestStreak) }))}
        ${card(t('stats.avgWin'), lt.won ? decimal((lt.wonTries / lt.won).toFixed(1)) : '—', t('stats.perWonLt'))}
      </div>
      ${lWins + lLost ? dist(t('stats.perWinLt'), `${num(lWins)} ${plural(lWins, 'n.wins')} ${DOT} ${num(lLost)} ${plural(lLost, 'n.losses')}`,
    [...['1', '2', '3', '4', '5', '6'].map(k => [k, ld[k] || 0]), ...(ld['7+'] ? [['7+', ld['7+']]] : []), ['✕', lLost]]) : ''}
      <h2 class="title">${t('stats.byLen')}</h2>
      ${lengthsStrip}`;
  // Connect: its numbers, then the longest word found drawn in green tiles (design v4)
  const connectPanel = () => `<div class="stats">
        ${card(t('stats.played'), num(cn.played))}
        ${card(t('stats.solved'), num(cn.solved), cn.played ? Math.round(cn.solved / cn.played * 100) + ' %' : '')}
        ${card(t('stats.wordsFound'), num(cn.words))}
        ${card(t('stats.bonusWords'), num(cn.bonus))}
        ${hintCard(cn.hints, cn.solved + cn.givenUp)}
      </div>
      ${cn.longest ? `<div class="card best"><span class="eyebrow">${t('stats.longest')}</span>${squares(Array([...cn.longest.w].length).fill('hit'), 32, [...cn.longest.w])}
        <p class="help">${t('stats.longestSub', { n: [...cn.longest.w].length, letters: plural([...cn.longest.w].length, 'lt.letters'), g: esc(cn.longest.game), ago: ago(cn.longest.at) })}</p></div>` : ''}`;
  root.innerHTML = `<div class="app" data-screen="stats">
  ${topbar({ left: `<a class="btn btn-ghost" href="#/">${t('back.menu')}</a>` })}
  <main class="main">
    <h1 class="title">${t('stats.title')}</h1>
    <div class="seg tabs tabs4" role="tablist"${STAT_TABS.length < 4 ? ` style="grid-template-columns:repeat(${STAT_TABS.length},minmax(0,1fr))"` : ''}>${STAT_TABS.map(m =>
    `<button type="button" role="tab" data-tab="${m}" class="${on(statsTab === m)}" aria-selected="${statsTab === m}">${GLYPH[m]}${t('mode.' + m)}</button>`).join('')}</div>
    <section class="section" role="tabpanel">
      ${none ? `<div class="none"><strong>${t('stats.none', { g: t('mode.' + statsTab) })}</strong><p class="help">${t('stats.noneHelp')}</p></div>` : ''}
      ${{ letters: lettersPanel, connect: connectPanel }[statsTab]?.() ?? guessPanel()}
      <div class="shared"><span>${t('stats.allGames')} <b>${num(s.played + lt.played + cn.played)}</b></span>${DOT}<span><b>${clock(s.timeMs, true)}</b> ${t('stats.hours')}</span></div>
    </section>
  </main>
</div>`;
  root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { statsTab = b.dataset.tab; refresh(); }));
}

let dataIndex;
function newer(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

export async function settingsScreen(root, _, refresh) {
  dataIndex ??= await fetch('data/index.json').then(r => r.json());
  const seg = (key, values, label) => `<div class="seg">${values.map(v => `<button type="button" data-k="${key}" data-v="${v}" class="${on(settings[key] === v)}">${label(v)}</button>`).join('')}</div>`;
  const waiting = REPO && settings.latest && newer(settings.latest, VERSION);
  const updateLine = !REPO ? t('set.noRepo')
    : waiting ? t('set.available', { v: settings.latest })
      : settings.lastCheck ? `${t('set.upToDate')} ${DOT} ${t('set.checked', { d: dateTime(settings.lastCheck) })}` : t('set.never');
  root.innerHTML = `<div class="app" data-screen="settings">
  ${topbar({ left: `<a class="btn btn-ghost" href="#/">${t('back.menu')}</a>` })}
  <main class="main">
    <h1 class="title">${t('set.title')}</h1>
    <section class="group">
      <div class="row"><div class="row-text"><strong>${t('set.lang')}</strong><span>${t('set.langDesc')}</span></div>${seg('lang', ['pl', 'en'], l => LANG_NAMES[l])}</div>
      <div class="row"><div class="row-text"><strong>${t('set.theme')}</strong><span>${t('set.themeDesc')}</span></div>${seg('theme', ['dark', 'light', 'system'], v => t('theme.' + v))}</div>
      <div class="row"><div class="row-text"><strong>${t('set.accent')}</strong><span>${t('set.accentDesc')}</span></div>
        <div class="swatches">${Object.entries(ACCENTS).map(([name, hex]) =>
    `<button type="button" data-accent="${name}" class="${on(settings.accent === name)}" style="--swatch:${hex}" aria-label="${name}"></button>`).join('')}</div></div>
      <div class="row"><div class="row-text"><strong>${t('set.fuzzy')}</strong><span>${t('set.fuzzyDesc')}</span></div><button type="button" class="toggle ${on(settings.fuzzy)}" data-toggle="fuzzy" role="switch" aria-checked="${settings.fuzzy}" aria-label="${t('set.fuzzy')}"></button></div>
      <div class="row"><div class="row-text"><strong>${t('set.sound')}</strong><span>${t('set.soundDesc')}</span></div><button type="button" class="toggle ${on(settings.sound)}" data-toggle="sound" role="switch" aria-checked="${settings.sound}" aria-label="${t('set.sound')}"></button></div>
    </section>
    <section class="group">
      <h2 class="title">${t('mode.letters')}</h2>
      <div class="row"><div class="row-text"><strong>${t('set.phoneKb')}</strong><span>${t('set.phoneKbDesc')}</span></div><button type="button" class="toggle ${on(settings.phoneKb)}" data-toggle="phoneKb" role="switch" aria-checked="${settings.phoneKb}" aria-label="${t('set.phoneKb')}"></button></div>
    </section>
    <section class="group">
      <h2 class="title">${t('set.updates')}</h2>
      <div class="row"><div class="row-text"><strong>${t('set.version', { v: VERSION })}</strong><span id="update-line">${updateLine}</span></div>
        <div class="row-actions">${waiting
    ? `<button type="button" class="btn btn-primary" id="get">${t('set.get')} <span class="arrow">→</span></button>`
    : `<button type="button" class="btn btn-outline" id="check" ${REPO ? '' : 'disabled'}>${t('set.check')}</button>`}
        <button type="button" class="btn btn-ghost" id="manual" ${REPO ? '' : 'disabled'}>${t('set.manual')}</button></div></div>
    </section>
    <section class="group">
      <h2 class="title">${t('set.about')}</h2>
      <div class="card about">
        <p>${t('set.aboutText')}</p>
        <dl class="kv">
          <dt>${t('set.vocab')}</dt><dd>${t('set.vocabText', { pl: num(dataIndex.counts.pl), en: num(dataIndex.counts.en) })}</dd>
          <dt>${t('set.vectors')}</dt><dd>${t('set.vectorsReal', { d: dataIndex.dims })}</dd>
          <dt>${t('set.saves')}</dt><dd>${t('set.savesText')}</dd>
        </dl>
      </div>
    </section>
  </main>
  <footer class="footer"><span>Lexling v${VERSION}</span>${DOT}<span>© 2026 Husarp</span>${DOT}<span>${t('foot.rights')}</span></footer>
</div>`;
  root.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.k === 'lang') return switchLang(b.dataset.v, refresh);
    settings.theme = b.dataset.v;
    saveSettings();
    applyTheme();
    refresh();
  }));
  root.querySelectorAll('[data-toggle]').forEach(el => el.addEventListener('click', () => {
    const key = el.dataset.toggle;
    settings[key] = !settings[key];
    saveSettings();
    el.classList.toggle('on', settings[key]);
    el.setAttribute('aria-checked', settings[key]);
    if (key === 'sound') click();
  }));
  root.querySelectorAll('[data-accent]').forEach(el => el.addEventListener('click', () => {
    settings.accent = el.dataset.accent;
    saveSettings();
    applyAccent();
    root.querySelectorAll('[data-accent]').forEach(o => o.classList.toggle('on', o === el));
  }));
  // Telling someone an update exists and then leaving them to find it is half an answer, so when one
  // is waiting the button becomes the way to get it: the release page, with the installer and the
  // APK on it. It has to leave the app, and each of the three places this runs needs asking
  // differently - the desktop wrapper through its Python bridge, Android and a browser through the
  // ordinary one, which Capacitor hands to the system browser.
  const open = url => {
    const api = window.pywebview?.api;
    if (api?.open_url) api.open_url(url);
    else window.open(url, '_blank', 'noopener');
  };
  root.querySelector('#get')?.addEventListener('click', () => open(`https://github.com/${REPO}/releases/latest`));
  // "Check manually" (owner, 2026-09-25: the check sometimes fails): straight to the releases page on GitHub
  root.querySelector('#manual')?.addEventListener('click', () => open(`https://github.com/${REPO}/releases`));

  const check = root.querySelector('#check');
  check?.addEventListener('click', async () => {
    check.disabled = true;
    check.textContent = t('set.checking');
    try {
      const release = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } }).then(r => r.json());
      settings.latest = (release.tag_name || '').replace(/^v/i, '');
      settings.lastCheck = Date.now();
      saveSettings();
      refresh();
    } catch {
      root.querySelector('#update-line').textContent = t('set.failed');
      check.disabled = false;
      check.textContent = t('set.check');
    }
  });
}
