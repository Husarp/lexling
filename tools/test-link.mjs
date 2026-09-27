// Tests for app/js/link.js - one game on two devices, kept in step by its actions. Two "devices" play the real
// engine (tiles.js) over a pretend connection that can lose a message, deliver one twice, or drop altogether.
// Run: node tools/test-link.mjs
import { newGame, apply } from '../app/js/tiles.js';
import { createLink, hashOf, PROTOCOL } from '../app/js/link.js';

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('✗', name, '\n   got ', JSON.stringify(got), '\n   want', JSON.stringify(want)); }
};
const isWord = () => true;   // the link does not care what the words are - any move the rules allow will do
const setup = { lang: 'en', players: [{ name: 'Host' }, { name: 'Guest' }], first: 0, seed: 7, words: 0, rules: { exchange: 'always' } };

// a device: its game (from the setup plus its actions) and its link
function device(game = 'g1', log = []) {
  const d = { events: [] };
  d.state = log.reduce((s, a) => apply(s, a, isWord), newGame(setup));
  d.attach = send => {
    d.link = createLink({ game, send, actions: () => d.state.log, apply: a => { d.state = apply(d.state, a, isWord); }, onEvent: k => d.events.push(k) });
  };
  d.act = a => { d.state = apply(d.state, a, isWord); d.link.flush(); };
  return d;
}
// the connection between two devices: messages wait in a queue until flush(); lose(n) drops the next n from `a`,
// twice(n) delivers the next n from `a` two times
function pair(a, b) {
  const q = [];
  let lost = 0, dup = 0;
  const w = { open: false };
  a.attach(t => { if (!w.open) return; if (lost > 0) { lost--; return; } q.push([b, t]); if (dup > 0) { dup--; q.push([b, t]); } });
  b.attach(t => { if (w.open) q.push([a, t]); });
  w.connect = () => { w.open = true; a.link.connected(); b.link.connected(); w.flush(); };
  w.cut = () => { w.open = false; q.length = 0; a.link.disconnected(); b.link.disconnected(); };
  w.flush = () => { for (let i = 0; q.length && i < 1000; i++) { const [to, t] = q.shift(); to.link.receive(t); } };
  w.lose = n => { lost = n; };
  w.twice = n => { dup = n; };
  return w;
}
const same = (a, b) => JSON.stringify(a.state) === JSON.stringify(b.state);
const place = s => ({ type: 'place', placed: s.racks[s.turn].slice(0, 2).map((ch, i) => ({ r: 7, c: 7 + i, ch: ch === '?' ? 'e' : ch, ...(ch === '?' ? { blank: true } : {}) })) });
const swap = s => ({ type: 'exchange', tiles: s.racks[s.turn].slice(0, 2) });

// ── in step from the start, a move each way ──
{
  const host = device(), guest = device(), w = pair(host, guest);
  w.connect();
  check('both ready on connecting', [host.events, guest.events], [['ready'], ['ready']]);
  host.act(place(host.state)); w.flush();
  check('the host\'s move reaches the guest', [guest.events.at(-1), same(host, guest), guest.state.log.length], ['act', true, 1]);
  guest.act({ type: 'pass' }); w.flush();
  check('the guest\'s pass reaches the host', [host.events.at(-1), same(host, guest), host.state.turn], ['act', true, 0]);
}
// ── a move made while the connection was down arrives on reconnecting ──
{
  const host = device(), guest = device(), w = pair(host, guest);
  w.connect();
  host.act(place(host.state)); w.flush();
  w.cut();
  check('both see the drop', [host.events.at(-1), guest.events.at(-1)], ['down', 'down']);
  guest.act(swap(guest.state));                                   // the guest's turn: played while cut off
  check('the games differ while cut off', same(host, guest), false);
  w.connect();
  check('on reconnecting the host catches up', [host.events.includes('synced'), same(host, guest), host.state.log.length], [true, true, 2]);
}
// ── a lost message: the next heartbeat notices the gap and fetches it ──
{
  const host = device(), guest = device(), w = pair(host, guest);
  w.connect();
  w.lose(1);
  host.act(place(host.state)); w.flush();
  check('the move got lost', [guest.state.log.length, same(host, guest)], [0, false]);
  host.link.beat(); w.flush();
  check('a heartbeat brings it', [guest.state.log.length, same(host, guest)], [1, true]);
}
// ── a message delivered twice is played once ──
{
  const host = device(), guest = device(), w = pair(host, guest);
  w.connect();
  w.twice(1);
  host.act(place(host.state)); w.flush();
  check('a doubled message counts once', [guest.state.log.length, same(host, guest)], [1, true]);
}
// ── the app closed and opened again: the games rebuilt from their saved actions, connected anew ──
{
  const host = device(), guest = device(), w = pair(host, guest);
  w.connect();
  host.act(place(host.state)); w.flush();
  guest.act({ type: 'pass' }); w.flush();
  host.act(swap(host.state));                                      // made just before the host's app closed - never sent
  w.cut();
  const host2 = device('g1', host.state.log), guest2 = device('g1', guest.state.log), w2 = pair(host2, guest2);
  w2.connect();
  check('rebuilt from the saves and caught up', [same(host2, guest2), guest2.state.log.length, same(host2, host)], [true, 3, true]);
  check('both in step afterwards', [host2.events.includes('ready') || host2.events.includes('synced'), guest2.events.includes('synced')], [true, true]);
}
// ── games that went apart, the wrong game, the wrong version ──
{
  const host = device(), guest = device(), w = pair(host, guest);
  w.connect();
  w.cut();
  host.act(place(host.state));
  guest.state = apply(guest.state, { type: 'pass' }, isWord);      // a different first action on the other side
  w.connect();
  check('two different games are noticed on both sides', [host.events.includes('diverged'), guest.events.includes('diverged')], [true, true]);
}
{
  const host = device('g1'), guest = device('g2'), w = pair(host, guest);
  w.connect();
  check('another game\'s device is told apart', [host.events.includes('other-game'), guest.events.includes('other-game')], [true, true]);
}
{
  const d = device(), seen = [];
  d.attach(() => {});
  d.link.connected();
  d.link.receive(JSON.stringify({ t: 'hello', v: PROTOCOL + 1, game: 'g1', n: 0, h: hashOf([]) }));
  check('a newer protocol is told apart', d.events.includes('version'), true);
  d.link.receive('not json at all');
  check('rubbish is ignored', d.events.length, 1);
}
// ── several actions made at once (a hint, then a move) all go, in order; a remote one is never sent back ──
{
  const host = device(), guest = device(), w = pair(host, guest);
  w.connect();
  host.state = apply(host.state, { type: 'hint', level: 'big', cost: 3 }, isWord);
  host.act(place(host.state)); w.flush();
  check('two new actions both arrive', [guest.state.log.length, same(host, guest)], [2, true]);
  let echoed = 0; const was = host.link.receive; host.link.receive = t => { if (JSON.parse(t).t === 'act') echoed++; was(t); };
  guest.act({ type: 'pass' }); w.flush();
  host.link.flush(); guest.link.flush(); w.flush();
  check('the host plays the pass and sends nothing back', [echoed, same(host, guest), host.state.log.length], [1, true, 3]);
}
// ── going quiet, leaving ──
{
  const host = device(), guest = device(), w = pair(host, guest);
  check('quiet while never connected', host.link.quietFor(), Infinity);
  w.connect();
  check('just heard', host.link.quietFor() < 1000, true);
  guest.link.leave(); w.flush();
  check('leaving is told', host.events.at(-1), 'bye');
}

console.log(fail ? `${fail} of ${pass + fail} link tests FAILED` : `all ${pass} link tests passed`);
process.exit(fail ? 1 : 0);
