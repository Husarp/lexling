// Tests for app/js/session.js - Tiles on several phones, the game kept by the host. A host and phones play the real
// engine (tiles.js) over pretend connections: joining, being asked about, turned away, moving, a phone dropping out and
// coming back to its own seat, going quiet, the end.
// Run: node tools/test-session.mjs
import { newGame, apply } from '../app/js/tiles.js';
import { createHost, createGuest, PROTOCOL, QUIET } from '../app/js/session.js';

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
function table(players = 3) {
  const q = [], h = { S: newGame({ lang: 'en', players: Array.from({ length: players }, () => ({ name: '' })), first: 0, seed: 11, rules: { exchange: 'always' } }), asks: [], changes: [] };
  const phones = new Map();   // conn → phone
  h.phones = phones;
  h.session = createHost({
    players, me: 0,
    game: () => ({ id: 'g1', title: 'Game 1', setup: setupOf(h.S), log: h.S.log }),
    take: (seat, n, a) => {
      if (n !== h.S.log.length || h.session.missing().length || (a.type === 'resign' ? a.p !== seat : h.S.turn !== seat)) return false;
      h.S = apply(h.S, a, isWord);
      h.session.flush(h.S.log);
      return true;
    },
    send: (conn, text) => q.push([phones.get(conn), text]),
    drop: conn => q.push(['drop', conn]),
    onChange: c => {
      h.changes.push(c);
      if (c.name) { h.S = { ...h.S, players: h.S.players.map((x, i) => i === c.seat ? { ...x, name: c.name } : x) }; h.session.names(h.S.players.map(x => x.name)); }
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

console.log(fail ? `${fail} of ${pass + fail} session tests FAILED` : `all ${pass} session tests passed`);
process.exit(fail ? 1 : 0);
