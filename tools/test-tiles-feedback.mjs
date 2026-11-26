// Live validation rendering and controls without a browser (owner, 2026-11-20).
// Run: node tools/test-tiles-feedback.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const stored = new Map();
globalThis.localStorage = { getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v) };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.window = { addEventListener() {} };
const element = () => ({
  innerHTML: '', attrs: {}, classes: new Set(),
  get textContent() { return this.innerHTML.replace(/<[^>]*>/g, ''); },
  setAttribute(k, v) { this.attrs[k] = v; },
  querySelector() { return null; },
  get classList() { return { toggle: (k, on) => on ? this.classes.add(k) : this.classes.delete(k) }; },
});
globalThis.document = { documentElement: {}, addEventListener() {}, createRange: () => ({}), createElement: element };
const { t, esc, setLang } = await import('../app/js/i18n.js');
const { newGame, placementError, wordsMade, checkMove, canApprove, canExchange, apply } = await import('../app/js/tiles.js');
const { boardInner } = await import('../app/js/tiles-game.js');
const source = readFileSync(new URL('../app/js/tiles-game.js', import.meta.url), 'utf8');
const fn = name => source.match(new RegExp(`  function ${name}\\(\\) \\{[\\s\\S]*?\\n  \\}`))[0];
let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; };
const draft = word => [...word].map((ch, slot) => ({ r: 7, c: 7 + slot, ch, slot }));
const button = c => c.dock.innerHTML.match(/<button[^>]*data-act="play"[^>]*>[\s\S]*?<\/button>/)[0];

for (const lang of ['en', 'pl']) {
  setLang(lang);
  const c = {
    S: { ...newGame({ lang, players: [{}, {}], first: 0, seed: 12 }), racks: [[...'atx'], [...'cat']] },
    shown: 0, solo: 0, mode: 'play', draft: [], stashedDraft: null, placedOnce: true, sel: -1, msg: null,
    myTurn: () => c.active && !c.S.vote, active: true, placedOf: () => c.draft,
    placementError, wordsMade, checkMove, isWord: w => w === 'at', canApprove, canExchange,
    t, esc, document, ERR: { line: 'tiles.err.line', gap: 'tiles.err.gap', alone: 'tiles.err.touch', centre: 'tiles.err.centre', single: 'tiles.err.single' },
    moveError: element(), say: element(), dock: element(),
    nameOf: () => 'You', whoCell: () => '<span class="who"><svg></svg></span>',
    lastMove: () => -1, thinking: false, linked: false, fresh: null, linkHtml: '',
    sendDraft() {}, remote: p => p !== c.solo, linkLine: () => '<p class="mc-link"></p>',
    cardWords: words => words.map(x => x.w).join(', '), hintMark: () => '', hintPaid: 0,
    ICON: {}, hintsOn: () => false, canUndo: false, refit() {},
  };
  runInNewContext(fn('judge') + fn('paintSay') + fn('paintDock'), c);
  c.paintSay();
  const neutral = c.say.innerHTML;
  check(`${lang}: initial prompt is translated`, neutral.includes(t('tiles.placeCentre')), true);
  check(`${lang}: no error without a draft`, c.moveError.classes.has('visible'), false);
  check(`${lang}: no draft disables PLAY`, button(c).includes(' disabled'), true);

  for (const [name, tiles, key] of [
    ['single', draft('a'), 'single'],
    ['off centre', draft('at').map(d => ({ ...d, r: 0 })), 'centre'],
    ['gap', draft('at').map((d, i) => ({ ...d, c: 7 + i * 2 })), 'gap'],
    ['not in a line', draft('at').map((d, i) => ({ ...d, r: 7 + i })), 'line'],
    ['unknown word', draft('ax'), 'unknown'],
  ]) {
    c.draft = tiles;
    c.paintSay();
    const res = c.judge();
    check(`${lang}/${name}: invalid move keeps the neutral prompt`, c.say.innerHTML, neutral);
    check(`${lang}/${name}: note fades in`, c.moveError.classes.has('visible'), true);
    check(`${lang}/${name}: note is accessible`, c.moveError.attrs['aria-hidden'], 'false');
    check(`${lang}/${name}: translated explanation`, c.moveError.innerHTML.includes(t(`tiles.err.${key}`, { w: 'AX' })), true);
    check(`${lang}/${name}: PLAY disabled and linked to the note`, /aria-describedby="tl-move-error" disabled/.test(button(c)), true);
    check(`${lang}/${name}: error is not repeated inside PLAY`, button(c).includes('<small'), false);
    const board = boardInner(c.S, { draft: tiles, bad: res.error !== 'word', badWords: res.bad ?? [] });
    check(`${lang}/${name}: bad tiles remain marked on the board`, /class="t [^"]*bad/.test(board), true);
  }

  // Correction removes the note and enables the score preview; recall restores onboarding.
  c.draft = draft('at'); c.paintSay();
  check(`${lang}: corrected move fades the note out`, c.moveError.classes.has('visible'), false);
  check(`${lang}: corrected move hides stale error from accessibility`, c.moveError.attrs['aria-hidden'], 'true');
  check(`${lang}: corrected move enables PLAY with score`, !button(c).includes(' disabled') && button(c).includes('class="num"'), true);
  c.draft = []; c.paintSay();
  check(`${lang}: recall restores the neutral prompt`, c.say.innerHTML, neutral);

  // The online turn line takes the place of the empty move card (owner, 2026-11-26).
  c.linked = true; c.active = false; c.S.turn = 1; c.paintSay();
  check(`${lang}: remote turn hides the empty card`, c.say.innerHTML.includes('class="mc me'), false);
  c.lastMove = predicate => predicate(0) ? 0 : -1;
  c.moveCard = () => '<div class="mc me">previous move</div>';
  c.paintSay();
  check(`${lang}: remote turn keeps my previous move`, c.say.innerHTML.includes('previous move'), true);
  c.linked = false; c.active = true; c.S.turn = 0; c.lastMove = () => -1;

  c.draft = draft('ax'); c.paintSay();
  c.active = false; c.paintSay();
  check(`${lang}: another player's turn hides the error`, c.moveError.classes.has('visible'), false);
  check(`${lang}: another player's turn disables PLAY`, button(c).includes(' disabled'), true);
  c.active = true;

  // Human-only approval remains an action rather than disabling the approval button.
  c.S.rules.wordsVote = true;
  c.S.players[1].cpu = 'medium'; c.paintSay();
  check(`${lang}: a computer cannot approve an unknown word`, button(c).includes(' disabled'), true);
  delete c.S.players[1].cpu;
  c.draft = draft('ax'); c.paintSay();
  check(`${lang}: approval note uses dictionary explanation`, c.moveError.innerHTML.includes(t('tiles.approval.unknown', { w: 'AX' })), true);
  check(`${lang}: eligible unknown word enables Ask for approval`, !button(c).includes(' disabled') && button(c).includes(t('tiles.approval.ask')), true);
  c.S = apply(c.S, { type: 'place', placed: c.draft }, c.isWord);
  c.paintSay();
  check(`${lang}: actual proposal opens a vote`, !!c.S.vote, true);
  check(`${lang}: vote hides validation and dock`, [c.moveError.classes.has('visible'), c.dock.innerHTML], [false, '']);
}
console.log(`all ${passed} tiles feedback tests passed`);
