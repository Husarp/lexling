// Saved games snapshots and read-only result screens (owner, 2026-11-26).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<div id="root"></div>', { url: 'https://lexling.test/' });
for (const key of ['window', 'document', 'location', 'navigator', 'localStorage', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: window[key] });
}
window.Element.prototype.scrollTo = function ({ top }) { this.scrollTop = top; };
window.scrollTo = () => {};
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.Range.prototype.getBoundingClientRect = () => ({ left: 0, right: 0 });
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const fetches = [];
globalThis.fetch = async path => {
  fetches.push(path);
  assert.match(path, /^data\/en\/tiles(?:-familiar)?\.bin$/);
  const bytes = await readFile(new URL('../app/' + path, import.meta.url));
  return { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};

const { stats, settings, newGame, getSave, deleteSave, listFinished, listKept, listRecentFinished, getFinished, deleteFinished, recordMove, recordEnd, recordLettersEnd,
  recordConnectEnd, recordTilesEnd } = await import('../app/js/store.js');
const { newGame: newTiles, apply } = await import('../app/js/tiles.js');
const { menu, games, lastGamesScreen, statsScreen } = await import('../app/js/screens.js');
const { gameScreen } = await import('../app/js/game.js');
const { lettersGameScreen } = await import('../app/js/letters-game.js');
const { connectGameScreen } = await import('../app/js/connect-game.js');
const { tilesGameScreen } = await import('../app/js/tiles-game.js');
const { t, setLang, duration } = await import('../app/js/i18n.js');
const root = document.querySelector('#root');

lastGamesScreen(root);
const segment = name => root.querySelector(`[data-segment="${name}"]`);
const modeTab = mode => root.querySelector(`[data-mode="${mode}"]`);
const rows = () => [...root.querySelectorAll('.last-game')].map(el => el.hash.slice('#/result/'.length));
const star = () => root.querySelector('[data-keep]');
const dialog = () => document.querySelector('dialog[open]');
const cancelRemove = () => dialog().querySelector('[data-cancel]').click();
const confirmRemove = () => dialog().querySelector('[data-confirm]').click();

assert.equal(root.querySelector('.empty .help').textContent, t('lastGames.emptySaved'));
assert.equal(segment('saved').getAttribute('aria-pressed'), 'true');
assert.equal(modeTab('guess').getAttribute('aria-pressed'), 'true');
segment('recent').click();
assert.equal(root.querySelector('.empty .help').textContent, t('lastGames.emptyRecent'));
const discarded = newGame({ lang: 'en' });
deleteSave(discarded.id);
assert.equal(listFinished().length, 0);

const guessWin = () => {
  const game = newGame({ lang: 'en', cat: 'all', secret: 'stare' });
  game.guesses.push({ w: 'stare', rank: 0, pct: 100 });
  recordMove(game, { g: 1, cat: 'all' });
  recordEnd(game, true);
  return game;
};
const oldest = guessWin(), thirdGuess = guessWin(), nextOldest = guessWin();
const guess = guessWin();
guess.guesses[0].w = 'changed';
assert.equal(getFinished(guess.id).guesses[0].w, 'stare');
const letters = newGame({ mode: 'letters', lang: 'en', cat: 'all', len: 5, tries: 1, secret: 'stare' });
letters.guesses.push('stark');
letters.status = 'lost';
recordLettersEnd(letters);
const connect = newGame({ mode: 'connect', lang: 'en', ring: 'stare',
  board: { cols: 5, rows: 1, words: [{ w: 'stare', r: 1, c: 1, d: 'a' }] }, found: [], shown: [], bonus: [], hints: 0 });
connect.status = 'gaveup';
recordConnectEnd(connect, {});
const start = newTiles({ lang: 'en', players: [{ name: '<Ada>' }, {}], first: 0, seed: 1 });
const placed = [...'at'].map((ch, i) => ({ r: 7, c: 7 + i, ch }));
const state = apply(apply(apply(start, { type: 'place', placed }, w => w === 'at'),
  { type: 'pass' }), { type: 'resign', p: 1 });
const tiles = newGame({ mode: 'tiles', lang: 'en', state, evals: [{ word: 'at', best: 6 }],
  link: { role: 'host', me: 0, kind: 'web', room: 'test-room', conn: 'test-conn' } });
tiles.timeMs = 1122000;
recordMove(tiles, {});
recordTilesEnd(tiles, 0, {});
recordTilesEnd(tiles, 0, {});
const guest = newGame({ mode: 'tiles', lang: 'en', state, live: true, link: { role: 'guest', me: 1 } });
recordTilesEnd(guest, 1, {});

const newest = [tiles, connect, letters, guess, nextOldest].map(g => g.id);
assert.deepEqual(listFinished().map(g => g.id), newest);
assert.equal(getFinished(oldest.id), undefined);
assert.deepEqual(listRecentFinished('guess').map(g => g.id), [guess.id, nextOldest.id, thirdGuess.id]);
assert.equal(getFinished(thirdGuess.id).id, thirdGuess.id);
assert.equal(stats.rec[oldest.id].end, 'won');
assert.ok(newest.every(id => !getSave(id)));
assert.deepEqual(getFinished(tiles.id).link, { role: 'host', me: 0 });
const reloaded = await import('../app/js/store.js?reload');
assert.deepEqual(reloaded.listFinished(), listFinished());

const before = { ...localStorage };
const starShape = segment('saved').querySelector('svg path').getAttribute('d');
for (const [game, screen, mode, result] of [
  [guess, gameScreen, 'game', '.guess.secret'], [letters, lettersGameScreen, 'letters', '.lt-board .lt-row + .lt-row'],
  [connect, connectGameScreen, 'connect', '.cw-flow .c.left'], [tiles, tilesGameScreen, 'tiles', '.tl-final .tb'],
]) {
  location.hash = '#/result/' + game.id;
  const cleanup = await screen(root, game.id, true);
  assert.ok(root.querySelector(`[data-screen="${mode}"] ${result}`));
  if (game === letters) assert.equal(root.querySelector('.lt-board .lt-row:last-child').textContent, 'stare');
  assert.equal(root.querySelector('.topbar a[href="#/last-games"]').textContent, '← Saved games');
  assert.equal(root.querySelector('input, #give-up, .tl-play, [href^="#/new"], [data-rematch]'), null);
  assert.equal(star().getAttribute('aria-pressed'), 'false');
  assert.equal(star().textContent, t('lastGames.keep'));
  assert.equal(star().querySelector('svg path').getAttribute('d'), starShape);
  if (game === tiles) {
    assert.deepEqual([...root.querySelectorAll('.tl-highlights dd')].map(el => el.textContent),
      [`AT +${state.moves[0].score} pts`, 'AT · 2 letters', '18 min 42 s']);
    assert.deepEqual([...root.querySelectorAll('.tl-score-chart li')].map(el => el.textContent), ['<Ada>', 'Player 2']);
    assert.deepEqual([...root.querySelectorAll('.tl-score-chart polyline')].map(el => el.getAttribute('points').split(' ').length),
      [3, 3]);
    const board = root.querySelector('.tl-final .tb'), final = board.innerHTML;
    const replay = root.querySelector('[data-replay]'), controls = root.querySelector('.tl-replay-controls');
    const step = key => controls.querySelector(`[data-step="${key}"]`);
    const marker = root.querySelector('.replay-marker');
    const counter = () => controls.querySelector('b').textContent;
    settings.tilesLast = false; // Replay shows the selected move even with live highlights off.
    replay.click();
    assert.equal(counter(), 'Move 0 / 2');
    assert.equal(board.querySelectorAll('.t').length, 0);
    assert.equal(marker.getAttribute('visibility'), 'visible');
    assert.ok(step('first').disabled && step('prev').disabled);
    step('next').click();
    assert.equal(counter(), 'Move 1 / 2');
    assert.equal(controls.querySelector('p').textContent, `<Ada> · AT · ${state.moves[0].score} pts`);
    assert.equal(board.querySelectorAll('.t.last').length, 2);
    assert.equal(marker.getAttribute('x1'), '174');
    step('last').click();
    assert.equal(counter(), 'Move 2 / 2');
    assert.ok(controls.querySelector('p').textContent.includes(t('tiles.hist.passed')));
    assert.equal(board.querySelectorAll('.t.last').length, 0);
    assert.equal(marker.getAttribute('x1'), '304');
    assert.ok(step('next').disabled && step('last').disabled);
    step('prev').click();
    assert.equal(counter(), 'Move 1 / 2');
    step('first').click();
    assert.equal(counter(), 'Move 0 / 2');
    settings.tilesLast = true;
    replay.click();
    assert.equal(marker.getAttribute('visibility'), 'hidden');
    assert.equal(board.innerHTML, final);
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(root.querySelector('.tl-look').hidden, false);
    const history = root.querySelector('.tl-end-history');
    assert.equal(history.querySelector('h2').textContent, t('tiles.history'));
    assert.equal(history.querySelector('[data-share]').textContent, t('tiles.share'));
    const moveRows = () => [...history.querySelectorAll('.tl-hist li:not(.head) .w')].map(el => el.textContent);
    assert.deepEqual(moveRows(), [t('tiles.hist.passed'), 'at']);
    history.querySelector('[data-filter="1"]').click();
    assert.deepEqual(moveRows(), [t('tiles.hist.passed')]);
    history.querySelector('[data-filter="0"]').click();
    assert.deepEqual(moveRows(), ['at']);
    history.querySelector('[data-filter=""]').click();
    assert.deepEqual(moveRows(), [t('tiles.hist.passed'), 'at']);
    const canvas = window.HTMLCanvasElement.prototype;
    const noop = () => {};
    canvas.getContext = () => ({
      measureText: () => ({ width: 0 }), fillText: noop, fillRect: noop,
      beginPath: noop, moveTo: noop, arcTo: noop, closePath: noop, fill: noop,
    });
    canvas.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
    let saves = 0;
    window.pywebview = { api: { save_tiles_image: async () => { saves++; return true; } } };
    const share = history.querySelector('[data-share]');
    share.click();
    assert.equal(share.disabled, true);
    share.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(saves, 1);
    assert.equal(share.disabled, false);
    assert.equal(history.querySelector('.tl-share-status').textContent, t('tiles.share.saved'));
    delete window.pywebview;
  }
  cleanup?.();
}
assert.deepEqual({ ...localStorage }, before);
assert.deepEqual(fetches.sort(), ['data/en/tiles-familiar.bin', 'data/en/tiles.bin']);

// A resumable game still has its section heading and card (owner, 2026-11-26).
const resumable = newGame({ lang: 'en', cat: 'all', diff: 'normal' });
games(root, 'guess', () => {});
assert.equal(root.querySelector('h1').textContent, t('games.title'));
assert.ok(root.querySelector('.save'));
assert.equal(root.querySelector('.empty'), null);
deleteSave(resumable.id);

for (const lang of ['en', 'pl']) {
  setLang(lang);
  menu(root, null, () => {});
  const label = lang === 'en' ? 'Saved games' : 'Zapisane gry';
  const nav = root.querySelector('.games + .menu.cards');
  assert.equal(nav.previousElementSibling.children.length, 4);
  assert.deepEqual([...nav.children].map(el => el.hash), ['#/stats', '#/achievements', '#/collection', '#/settings', '#/last-games']);
  assert.equal(nav.lastElementChild.textContent, label);
  assert.equal(root.querySelectorAll('.g-desc').length, 0);
  lastGamesScreen(root);
  assert.equal(root.querySelector('h1').textContent, label);
  assert.equal(segment('recent').textContent, t('lastGames.recent'));
  assert.equal(segment('saved').textContent, t('lastGames.saved'));
  assert.equal(root.querySelectorAll('[data-mode]').length, 4);
  for (const mode of ['guess', 'letters', 'connect', 'tiles']) {
    const tab = modeTab(mode);
    assert.equal(tab.getAttribute('aria-label'), t('mode.' + mode));
    assert.equal(tab.textContent, '');
    assert.ok(tab.querySelector('svg'));
    tab.click();
  }
  assert.deepEqual(rows(), [tiles.id]);
  assert.equal(root.querySelectorAll('.last-game time[datetime]').length, 1);
  assert.ok(root.querySelector('.last-game').textContent.includes(t('tiles.end.wins', { name: '<Ada>' })));
  assert.equal(root.querySelector('a[href="#/kept-games"]'), null);
  for (const mode of ['guess', 'letters', 'connect', 'tiles']) {
    games(root, mode, () => {});
    assert.equal(root.querySelector('h1'), null);
    assert.equal(root.querySelector('.empty .display').textContent, t('games.emptyTitle'));
    assert.equal(root.querySelector('.empty.card'), null);
    assert.equal(root.querySelector('.games-actions .btn-primary').textContent.trim(), `${t('games.new')} →`);
  }
  const hours = lang === 'pl' ? '2 godz. 3 min' : '2 h 3 min';
  assert.deepEqual([null, 0, 57000, 60000, 252000, 7380000].map(duration), [null, '0 s', '57 s', '1 min', '4 min 12 s', hours]);
  stats.timeMs = 7380000;
  stats.rec = Object.fromEntries(['guess', 'letters', 'connect', 'tiles'].map(m => [m, { m, lang, ms: 57000 }]));
  const refresh = () => statsScreen(root, null, refresh);
  refresh();
  const times = () => [...root.querySelectorAll('.scell')].filter(el =>
    [t('stats.time'), t('stats.avgTime')].includes(el.querySelector('.lbl').textContent))
    .map(el => el.querySelector('.num').textContent);
  root.querySelector('[data-tab="general"]').click();
  assert.deepEqual(times(), [hours, '57 s']);
  for (const mode of ['guess', 'letters', 'connect', 'tiles']) {
    root.querySelector(`[data-tab="${mode}"]`).click();
    assert.deepEqual(times(), ['57 s', '57 s']);
  }
}

// Star from Recent and from a result, then reopen every mode after the reserve fills.
setLang('en');
lastGamesScreen(root);
assert.equal(segment('recent').getAttribute('aria-pressed'), 'true');
assert.equal(modeTab('tiles').getAttribute('aria-pressed'), 'true');
star().click();
assert.deepEqual(rows(), [tiles.id]);
assert.equal(star().getAttribute('aria-pressed'), 'true');
modeTab('connect').click();
star().click();
segment('saved').click();
modeTab('letters').click();
segment('recent').click();
assert.equal(modeTab('connect').getAttribute('aria-pressed'), 'true');
segment('saved').click();
lastGamesScreen(root);
assert.equal(segment('saved').getAttribute('aria-pressed'), 'true');
assert.equal(modeTab('letters').getAttribute('aria-pressed'), 'true');
assert.deepEqual(rows(), []);
for (const [game, screen] of [[guess, gameScreen], [letters, lettersGameScreen]]) {
  location.hash = '#/result/' + game.id;
  await screen(root, game.id, true);
  star().click();
  assert.equal(star().getAttribute('aria-pressed'), 'true');
  assert.equal(star().textContent, t('lastGames.kept'));
}
const keptOrder = [tiles, connect, letters, guess].map(g => g.id);
assert.deepEqual(listKept().map(g => g.id), keptOrder);
const later = Array.from({ length: 30 }, guessWin);
assert.equal(listFinished().length, 5);
assert.ok(keptOrder.every(id => !listFinished().some(g => g.id === id)));
assert.ok(JSON.parse(localStorage.getItem('wg.finished')).length <= 25);
const archive = await import('../app/js/store.js?kept-reload');
assert.deepEqual(archive.listKept().map(g => g.id), keptOrder);
assert.deepEqual(archive.listRecentFinished('guess').map(g => g.id), later.slice(-3).reverse().map(g => g.id));
assert.deepEqual(archive.listRecentFinished('letters').map(g => g.id), [letters.id]);
assert.deepEqual(archive.listRecentFinished('connect').map(g => g.id), [connect.id]);
assert.deepEqual(archive.listRecentFinished('tiles').map(g => g.id), [tiles.id]);
const keptTiles = archive.getFinished(tiles.id);
for (const key of ['racks', 'bag', 'pending', 'seed', 'turn']) assert.ok(!(key in keptTiles.state));
assert.deepEqual(keptTiles.state.moves, state.moves);

lastGamesScreen(root);
assert.deepEqual(rows(), [letters.id]);
modeTab('tiles').click();
assert.deepEqual(rows(), [tiles.id]);
setLang('pl');
lastGamesScreen(root);
star().click();
assert.equal(dialog().getAttribute('aria-label'), 'Usunąć gwiazdkę?');
assert.equal(dialog().querySelector('#unkeep-description').textContent,
  'Gra zostanie usunięta z zapisanych gier. Tej operacji nie można cofnąć.');
assert.equal(dialog().querySelector('svg path').getAttribute('d'), starShape);
cancelRemove();
assert.deepEqual(rows(), [tiles.id]);
assert.equal(star().getAttribute('aria-pressed'), 'true');
star().click();
confirmRemove();
assert.deepEqual(rows(), []);
assert.equal(document.activeElement, modeTab('tiles'));
segment('recent').click();
modeTab('tiles').click();
assert.deepEqual(rows(), [tiles.id]);
assert.equal(star().getAttribute('aria-pressed'), 'false');
setLang('en');

for (const [game, screen] of [[connect, connectGameScreen], [letters, lettersGameScreen], [guess, gameScreen]]) {
  location.hash = '#/result/' + game.id;
  const cleanup = await screen(root, game.id, true);
  assert.ok(root.querySelector('.topbar a[href="#/last-games"]'));
  assert.equal(star().textContent, t('lastGames.kept'));
  star().click();
  assert.ok(dialog().textContent.includes(t('lastGames.unkeepDescription')));
  assert.equal(star().getAttribute('aria-pressed'), 'true');
  cancelRemove();
  assert.equal(star().getAttribute('aria-pressed'), 'true');
  star().click();
  confirmRemove();
  assert.equal(star().getAttribute('aria-pressed'), 'false');
  assert.equal(star().textContent, t('lastGames.keep'));
  assert.equal(star().disabled, game === guess);
  assert.equal(getFinished(game.id)?.id, game === guess ? undefined : game.id);
  cleanup?.();
}
assert.deepEqual(listKept(), []);
lastGamesScreen(root);
modeTab('guess').click();
const newestId = later.at(-1).id;
const latestGuessIds = later.slice(-3).reverse().map(g => g.id);
assert.deepEqual(rows(), latestGuessIds);
star().click();
assert.deepEqual(rows(), latestGuessIds);
assert.equal(star().getAttribute('aria-pressed'), 'true');
star().click();
confirmRemove();
assert.deepEqual(rows(), latestGuessIds);
assert.equal(star().getAttribute('aria-pressed'), 'false');

// The board is available even if the optional end-rating dictionary has not loaded (owner, 2026-11-26).
let rejectWords, requests = 0;
const loadingWords = new Promise((_, reject) => { rejectWords = reject; });
globalThis.fetch = () => {
  requests++;
  return loadingWords;
};
const challenge = newTiles({ lang: 'pl', players: [{}, {}], first: 0, seed: 1, rules: { check: 'challenge' } });
const attempt = challenge.racks[0].slice(0, 2).map((ch, i) => ({ r: 7, c: 7 + i, ch }));
const proposed = apply(challenge, { type: 'place', placed: attempt }, () => false);
const withdrawn = apply(proposed, { type: 'challenge' }, () => false);
const challenged = apply(withdrawn, { type: 'resign', p: 1 });
const offline = newGame({ mode: 'tiles', lang: 'pl', state: challenged });
recordTilesEnd(offline, -1, {});
location.hash = '#/result/' + offline.id;
const cleanup = await tilesGameScreen(root, offline.id, true);
assert.ok(requests > 0);
root.querySelector('[data-replay]').click();
root.querySelector('[data-step="next"]').click();
assert.equal(root.querySelectorAll('.tl-final .t.last').length, 2);
root.querySelector('[data-step="next"]').click();
assert.equal(root.querySelectorAll('.tl-final .t').length, 0);
assert.ok(root.querySelector('.tl-replay-controls p').textContent.includes(t('tiles.hist.challengeWon')));
rejectWords(new Error('offline'));
cleanup();

assert.equal(deleteFinished(newestId), true);
lastGamesScreen(root);
assert.ok(!rows().includes(newestId));
const afterDelete = await import('../app/js/store.js?after-delete');
assert.equal(afterDelete.getFinished(newestId), undefined);
assert.equal(afterDelete.stats.rec[newestId].end, 'won');

window.close();
console.log('Saved games, home cards, game lists and statistics duration tests passed');
