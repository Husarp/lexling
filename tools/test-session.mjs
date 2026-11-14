// Tests for app/js/session.js - Tiles on several phones, the game kept by the host. A host and phones play the real
// engine (tiles.js) over pretend connections: joining, being asked about, turned away, moving, a phone dropping out and
// coming back to its own seat, going quiet, the end.
// Run: node tools/test-session.mjs
import { newGame, apply, voteFits } from '../app/js/tiles.js';
import { createHost, createGuest, seatName, PROTOCOL, QUIET, QUIET_AWAY } from '../app/js/session.js';

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('✗', name, '\n   got ', JSON.stringify(got), '\n   want', JSON.stringify(want)); }
};
const isWord = () => true;   // any move the rules allow will do here
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const setupOf = s => ({ lang: s.lang, board: s.board, players: s.players, first: s.start.first, seed: s.start.seed, words: s.words, rules: s.rules });
const place = s => ({ type: 'place', placed: s.racks[s.turn].slice(0, 2).map((ch, i) => ({ r: 7, c: 7 + i, ch: ch === '?' ? 'e' : ch, ...(ch === '?' ? { blank: true } : {}) })) });

// the host's phone: its game, its session; the line to each phone is a queue flushed by run()
function table(players = 3, rules = {}) {
  const q = [], h = { S: newGame({ lang: 'en', players: Array.from({ length: players }, () => ({ name: '' })), first: 0, seed: 11, rules: { exchange: 'always', ...rules } }), asks: [], changes: [] };
  const phones = new Map();   // conn → phone
  h.phones = phones;
  h.session = createHost({
    players, me: 0,
    game: () => ({ id: 'g1', title: 'Game 1', setup: setupOf(h.S), log: h.S.log }),
    take: (seat, n, a) => {
      if (a.type === 'vote') { if (voteFits(h.S, seat, a)) h.play(a); return true; }
      if (a.type === 'voteEnd' || (h.S.vote && a.type === 'timeout')) return false;
      if (n !== h.S.log.length || h.session.missing().length || (a.type === 'resign' ? a.p !== seat : h.S.turn !== seat)) return false;
      h.S = apply(h.S, a, isWord);
      h.session.flush(h.S.log);
      return true;
    },
    send: (conn, text) => q.push([phones.get(conn), text]),
    drop: conn => q.push(['drop', conn]),
    onChange: c => {
      h.changes.push(c);
      if (!c.left) { h.S = { ...h.S, players: h.S.players.map((x, i) => i === c.seat ? { ...x, name: seatName(x.name, c.name) } : x) }; h.session.names(h.S.players.map(x => x.name)); }
    },
    onAsk: a => h.asks.push(a),
  });
  h.play = a => { h.S = apply(h.S, a, isWord); h.session.flush(h.S.log); };
  // a phone: connects as `conn` from `address`; keeps the game only while in it
  h.phone = (conn, address, name = '') => {
    const p = { conn, address, S: null, seat: -1, here: null, events: [], up: false };
    p.guest = createGuest({ name, send: text => q.push(['host', text, conn]), on: {
      welcome: m => { p.seat = m.seat; p.here = m.here; p.S = m.log.reduce((s, a) => apply(s, a, isWord), newGame(m.setup)); p.events.push('welcome'); },
      act: m => {
        if (!p.S) return;
        if (m.n === p.S.log.length) { p.S = apply(p.S, m.a, isWord); p.guest.synced(p.S.log.length); }
        else if (!(m.n < p.S.log.length && same(p.S.log[m.n], m.a))) p.guest.resync();
      },
      here: m => { p.here = m.here; },
      names: m => { if (p.S) p.S = { ...p.S, players: p.S.players.map((x, i) => ({ ...x, name: m.names[i] })) }; },
      reject: () => { p.events.push('reject'); p.guest.resync(); },
      refused: () => p.events.push('refused'), full: () => p.events.push('full'), version: () => p.events.push('version'), end: m => p.events.push('end:' + m.why),
    } });
    p.move = a => { p.S = apply(p.S, a, isWord); p.guest.flush(p.S.log); };
    p.connect = () => { phones.set(conn, p); p.up = true; h.session.connected(conn, { name: 'Phone ' + conn, address }); p.guest.connected(); };
    p.cut = () => { p.up = false; p.guest.disconnected(); h.session.disconnected(conn); };
    return p;
  };
  h.run = () => {
    for (let k = 0; q.length && k < 5000; k++) {
      const [to, text, from] = q.shift();
      if (to === 'drop') { const p = phones.get(text); if (p?.up) { p.up = false; p.guest.disconnected(); p.events.push('dropped'); h.session.disconnected(text); } }
      else if (to === 'host') { if (phones.get(from)?.up) h.session.message(from, text); }
      else if (to?.up) to.guest.message(text);
    }
  };
  return h;
}

// ── two phones join a game for three: each asked about, let in, given the whole game ──
{
  const h = table(3), a = h.phone('c1', 'AA'), b = h.phone('c2', 'BB', 'Kasia');
  a.connect(); h.run();
  check('the host is asked about the first phone', [h.asks.at(-1)?.conn, h.asks.at(-1)?.device, h.asks.at(-1)?.seat], ['c1', 'Phone c1', 1]);
  b.connect(); h.run();
  check('one at a time: still the first', h.asks.at(-1)?.conn, 'c1');
  h.session.letIn('c1'); h.run();
  check('the first gets seat 1 and the game', [a.seat, a.events, same(a.S, h.S)], [1, ['welcome'], true]);
  check('then the second is asked about, with its name', [h.asks.at(-1)?.conn, h.asks.at(-1)?.name], ['c2', 'Kasia']);
  h.session.letIn('c2'); h.run();
  check('the second gets seat 2, named', [b.seat, h.S.players[2].name, b.S.players[2].name], [2, 'Kasia', 'Kasia']);
  check('everyone here, on every phone', [h.session.missing(), a.here, b.here], [[], [true, true, true], [true, true, true]]);
  check('nobody left to ask about', h.asks.at(-1), null);

  // ── moves: the host's, then a phone's - all three the same game ──
  h.play(place(h.S)); h.run();
  check('the host\'s move reaches both', [a.S.log.length, b.S.log.length, same(a.S, h.S), same(b.S, h.S)], [1, 1, true, true]);
  a.move({ type: 'pass' }); h.run();
  check('a phone\'s move goes through the host to everyone', [h.S.log.length, same(a.S, h.S), same(b.S, h.S), h.S.turn], [2, true, true, 2]);
  a.move({ type: 'pass' }); h.run();
  check('a move out of turn: refused, and the phone gets the host\'s game back', [a.events.includes('reject'), a.S.log.length, same(a.S, h.S)], [true, 2, true]);
  b.move({ type: 'resign', p: 2 }); h.run();
  check('giving up is for one\'s own seat, any time', [h.S.log.length, same(b.S, h.S)], [3, true]);

  // ── a phone drops out, the game waits for it, and it comes back to its own seat without asking ──
  a.cut(); h.run();
  check('the seat is empty, the others told', [h.session.missing(), b.here], [[1], [true, false, true]]);
  a.S = null;   // it kept nothing
  const asksBefore = h.asks.length;
  a.connect(); h.run();
  check('back to its own seat, not asked about', [a.seat, h.asks.length === asksBefore || h.asks.at(-1) === null, same(a.S, h.S), b.here], [1, true, true, [true, true, true]]);
}
// ── a stranger: asked about, refused; a full table; another version ──
{
  const h = table(2), a = h.phone('c1', 'AA'), x = h.phone('c9', 'XX');
  a.connect(); h.run(); h.session.letIn('c1'); h.run();
  x.connect(); h.run();
  check('a full game turns a new phone away', x.events, ['full', 'dropped']);
  a.cut(); h.run();
  const y = h.phone('c7', 'YY'); y.connect(); h.run();
  check('a different phone for the empty seat is asked about', h.asks.at(-1)?.conn, 'c7');
  h.session.refuse('c7'); h.run();
  check('refused: told, and let go', y.events, ['refused', 'dropped']);
  const z = h.phone('c8', 'ZZ');
  h.phones.set('c8', z);
  h.session.connected('c8', { name: 'Old', address: 'ZZ' });
  z.up = true;
  h.session.message('c8', JSON.stringify({ t: 'hello', v: PROTOCOL + 1, name: '' }));
  h.run();
  check('another version: told so', z.events.includes('version'), true);
}
// ── quiet phones are let go; the end reaches everyone ──
{
  const h = table(2), a = h.phone('c1', 'AA');
  a.connect(); h.run(); h.session.letIn('c1'); h.run();
  const real = Date.now;
  Date.now = () => real() + QUIET + 1000;
  h.session.tick(); h.run();
  Date.now = real;
  check('a phone quiet too long: its seat emptied', [h.session.missing(), a.events.includes('dropped')], [[1], true]);
  a.connect(); h.run();
  h.session.end('left'); h.run();
  check('the host leaving: every phone told', a.events.at(-1), 'end:left');
  check('guest: a quiet host shows up in tick()', (() => { const g = createGuest({ name: '', send: () => {} }); g.connected(); Date.now = () => real() + QUIET + 1; const r = g.tick(); Date.now = real; return r; })(), true);
}

// ── the host picks the seat; a seat out of the game is not taken; a player removed ──
{
  const h = table(3), a = h.phone('c1', 'AA'), b = h.phone('c2', 'BB');
  a.connect(); h.run();
  check('the host is offered the free seats', h.asks.at(-1)?.seats, [1, 2]);
  h.session.letIn('c1', 2); h.run();
  check('the phone sits where the host put it', a.seat, 2);
  b.connect(); h.run();
  h.session.letIn('c2', 2); h.run();
  check('a taken seat: not let in there', b.seat, -1);
  h.session.letIn('c2', 1); h.run();
  check('… the free one then', b.seat, 1);
}
// ── a phone showing another app: the host told, and it is not let go for being quiet ──
{
  const h = table(2), a = h.phone('c1', 'AA');
  a.connect(); h.run(); h.session.letIn('c1'); h.run();
  a.guest.app(false); h.run();
  a.up = false;   // paused in the background: it answers nothing
  const now = Date.now;
  Date.now = () => now() + QUIET + 5000;
  h.session.tick(); h.run();
  Date.now = now;
  check('in the background: still seated after the usual quiet time', [h.session.missing(), a.events.includes('dropped')], [[], false]);
  Date.now = () => now() + QUIET_AWAY + 5000;
  h.session.tick(); h.run();
  Date.now = now;
  check('… but not for ever', h.session.missing(), [1]);
}
{
  const gone = new Set([2]);
  // a host whose seat 2 is out of the game
  const s2 = createHost({ players: 3, me: 0, game: () => ({ id: 'g', title: '', setup: {}, log: [] }), take: () => false, send: () => {}, drop: () => {}, usable: i => !gone.has(i), onAsk: () => {} });
  check('a seat out of the game: neither missing nor free', s2.missing(), [1]);
}

// the first name belongs to the seat for this game, not to the latest phone (owner, 2026-11-14)
{
  check('an unnamed seat takes the offered name', seatName('', 'Kasia'), 'Kasia');
  check('old saves without a name take the offered name', seatName(undefined, 'Jan'), 'Jan');
  check('a missing offered name stays empty', seatName('', undefined), '');
  check('an empty offered name stays empty', seatName('', ''), '');
  check('only spaces do not name a seat', seatName('', '   '), '');
  check('an offered name is trimmed', seatName('', '  Łucja  '), 'Łucja');
  check('an offered name is capped at 16 characters', seatName('', '  abcdefghijklmnopq  '), 'abcdefghijklmnop');
  check('an existing name stays exactly as it was', seatName('For this game', 'New name'), 'For this game');
}
{
  const h = table(3), a = h.phone('c1', 'AA', 'Kasia'), b = h.phone('c2', 'BB', 'Łucja');
  a.connect(); h.run();
  check('first phone: the next free seat and only empty choices', [h.asks.at(-1)?.seat, h.asks.at(-1)?.seats], [1, [1, 2]]);
  h.session.letIn('c1'); h.run();
  check('first phone names its seat before welcome', [h.S.players[1].name, a.S.players[1].name], ['Kasia', 'Kasia']);
  b.connect(); h.run();
  check('second phone: the next free seat is the only choice', [h.asks.at(-1)?.seat, h.asks.at(-1)?.seats], [2, [2]]);
  const changesBefore = h.changes.length;
  h.session.letIn('c2', 1); h.run();
  check('an occupied seat cannot be replaced or renamed', [b.seat, h.changes.length, h.S.players[1].name, a.up, a.here], [-1, changesBefore, 'Kasia', true, [true, true, false]]);
  h.session.letIn('c2'); h.run();
  check('the next name reaches the host, joining phone and existing phone', [h.S.players[2].name, b.S.players[2].name, a.S.players[2].name], ['Łucja', 'Łucja', 'Łucja']);

  a.cut(); h.run();
  const back = h.phone('c3', 'AA', 'Changed in Settings');
  back.connect(); h.run();
  check('the same phone returns to its own seat automatically', [back.seat, h.asks.at(-1), back.events], [1, null, ['welcome']]);
  check('reconnecting with another name keeps the first name everywhere', [h.S.players[1].name, back.S.players[1].name, b.S.players[1].name], ['Kasia', 'Kasia', 'Kasia']);

  h.play(place(h.S)); h.run();
  back.cut(); h.run();
  const replacement = h.phone('c4', 'CC', 'New person');
  replacement.connect(); h.run();
  check('mid-game: a new phone is offered only the missing seat', [h.S.log.length, h.asks.at(-1)?.conn, h.asks.at(-1)?.seat, h.asks.at(-1)?.seats], [1, 'c4', 1, [1]]);
  h.session.letIn('c4', 1); h.run();
  check('a replacement plays under that seat\'s original name everywhere', [replacement.seat, replacement.S.players[1].name, h.S.players[1].name, b.S.players[1].name], [1, 'Kasia', 'Kasia', 'Kasia']);
  replacement.move({ type: 'pass' }); h.run();
  check('the replacement can play on with the same game and names', [h.S.log.length, same(replacement.S, h.S), same(b.S, h.S)], [2, true, true]);
}

// A proposal is sent once, without applying it or consuming the next log index (owner, 2026-11-14).
{
  const messages = [], g = createGuest({ name: '', send: text => messages.push(JSON.parse(text)) });
  g.connected();
  g.message(JSON.stringify({ t: 'welcome', log: [{ type: 'pass' }] }));
  const vote = { type: 'vote', p: 1, veto: true, at: 0, ms: 123 };
  g.propose(1, vote);
  check('propose sends the exact move envelope', messages.at(-1), { t: 'move', n: 1, a: vote });
  g.flush([{ type: 'pass' }, { type: 'pass', ms: 7 }]);
  check('propose leaves sent unchanged for the next real action', messages.at(-1), { t: 'move', n: 1, a: { type: 'pass', ms: 7 } });
  g.synced(3); g.propose(3, vote);
  const count = messages.length;
  g.flush(Array(3).fill({ type: 'pass' }));
  check('propose also leaves a synced log cursor unchanged', messages.length, count);
  g.disconnected(); g.propose(3, vote);
  check('a disconnected guest sends no proposal', messages.length, count);
}

// Three phones: a guest's word, simultaneous votes, stale messages, acceptance, silence and the clock.
for (const outcome of ['veto', 'accept', 'silence', 'timeout']) {
  const h = table(3, { veto: true }), a = h.phone('v1', 'VA', 'Ada'), b = h.phone('v2', 'VB', 'Ben');
  a.connect(); h.run(); h.session.letIn('v1'); h.run();
  b.connect(); h.run(); h.session.letIn('v2'); h.run();
  h.play({ type: 'pass', ms: 10 }); h.run();   // seat 1 plays the first word
  const originalRack = [...a.S.racks[1]], originalCells = [...a.S.cells];
  a.move({ ...place(a.S), ms: 100 }); h.run();
  const at = h.S.vote.at;
  check(`${outcome}: a guest's word opens the same vote everywhere`, [h.S.vote.p, same(h.S, a.S), same(h.S, b.S), h.S.moves.at(-1).kind], [1, true, true, 'pass']);

  if (outcome === 'veto' || outcome === 'accept') {
    const vote = { type: 'vote', p: 2, veto: false, at, ms: 1800 }, n = b.S.log.length;
    b.guest.propose(n, vote);
    check(`${outcome}: a phone's vote is not applied before the host echoes it`, [b.S.log.length, b.S.vote.votes], [n, {}]);
    // The host votes before the guest's queued proposal arrives: its n is now behind, but the vote still fits.
    h.play({ type: 'vote', p: 0, veto: outcome === 'veto', at, ms: 1200 });
    b.guest.propose(n, { ...vote, at: at - 1 });
    b.guest.propose(n, { ...vote, p: 0 });
    b.guest.propose(n, vote);   // duplicate after closure
    h.run();
    check(`${outcome}: concurrent votes close on the host, with the expected result`, [h.S.vote, h.S.moves.at(-1).kind, h.S.log.length, h.S.clock[1]], [null, outcome === 'veto' ? 'vetoed' : 'play', outcome === 'veto' ? 3 : 4, outcome === 'veto' ? 1300 : 1900]);
    check(`${outcome}: every phone has the identical JSON state`, [JSON.stringify(a.S), JSON.stringify(b.S)], [JSON.stringify(h.S), JSON.stringify(h.S)]);
    check(`${outcome}: stale, forged and duplicate votes need no rejection or resync`, [a.events, b.events], [['welcome'], ['welcome']]);
    if (outcome === 'veto') {
      check('veto: the guest keeps its rack, board, turn and used time', [h.S.racks[1], h.S.cells, h.S.turn, h.S.used], [originalRack, originalCells, 1, 1300]);
      a.move({ ...place(a.S), ms: 200 }); h.run();
      check('veto: playing again opens a fresh vote on all phones', [h.S.vote.at > at, same(a.S, h.S), same(b.S, h.S)], [true, true, true]);
      const before = JSON.stringify(h.S);
      b.guest.propose(b.S.log.length, vote); h.run();
      check('veto: a previous proposal cannot vote on the next word', [JSON.stringify(h.S), b.events], [before, ['welcome']]);
      const now = h.S.vote.at;
      b.guest.propose(b.S.log.length, { ...vote, at: now, veto: false, ms: 400 }); h.run();
      const afterVote = JSON.stringify(h.S);
      b.guest.propose(b.S.log.length, { ...vote, at: now, veto: true, ms: 500 }); h.run();
      check('veto: a repeated vote while still open is silently ignored', [JSON.stringify(h.S), b.events], [afterVote, ['welcome']]);
      h.play({ type: 'vote', p: 0, veto: false, at: now, ms: 600 }); h.run();
      check('veto: the re-move can be accepted and is identical everywhere', [h.S.moves.map(m => m.kind), h.S.turn, h.S.clock[1], same(a.S, h.S), same(b.S, h.S)], [['pass', 'vetoed', 'play'], 2, 2100, true, true]);
    }
  } else {
    h.play(outcome === 'silence' ? { type: 'voteEnd', ms: 20000 } : { type: 'timeout', ms: 900 }); h.run();
    check(`${outcome}: the authority closes the unvoted word everywhere`, [h.S.vote, h.S.moves.at(-1).kind, h.S.turn, same(a.S, h.S), same(b.S, h.S)], [null, outcome === 'silence' ? 'play' : 'timeout', 2, true, true]);
    check(`${outcome}: the mover's clock includes proposal and voting time`, h.S.clock[1], outcome === 'silence' ? 20100 : 1000);
  }
}

console.log(fail ? `${fail} of ${pass + fail} session tests FAILED` : `all ${pass} session tests passed`);
process.exit(fail ? 1 : 0);
