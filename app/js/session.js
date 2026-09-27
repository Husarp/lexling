// Tiles on several phones (owner, 2026-09-27): the game belongs to the phone that started it - the host. Every other
// phone takes a seat in it and keeps no copy of its own: on joining, and on every reconnection, it gets the whole game
// from the host (its start and its actions), and each move goes through the host, which plays it and passes it on to
// everyone. Nobody moves while a seat's phone is missing (tiles-game.js sees to that). Bluetooth or Wi-Fi carries the
// lines (net.js); this file only says what is in them.
//
//   host → phone: welcome {seat, id, title, setup, log, here}, act {n, a}, here {here}, names {names}, reject {n},
//                 refused, full, version, end {why}, ping, pong
//   phone → host: hello {v, name}, move {n, a}, ping, pong, bye
export const PROTOCOL = 2;
export const QUIET = 15000;   // nothing heard for this long: the connection counts as gone

const parse = text => { try { return JSON.parse(text); } catch { return null; } };

// The host. players: how many seats; me: the host's own seat. known: per seat, the phone that sat there last
// ({ address, device }) - that phone goes straight back to its seat. game(): what a joining phone gets
// ({ id, title, setup, log }). take(seat, n, action): a phone's move - the host plays it (true) or not (false).
// send(conn, text) / drop(conn): the connections. onChange({ seat, name, left }): a seat filled or emptied.
// onAsk(phone | null): a phone waits to be let in (one at a time), or nobody does any more. usable(seat): a seat a
// phone can take (not a player out of the game). extra(): more for every phone with who is here (the seats skipped).
export function createHost({ players, me = 0, known = [], game, take, send, drop, onChange = () => {}, onAsk = () => {}, usable = () => true, extra = () => ({}) }) {
  const seats = Array.from({ length: players }, (_, i) => ({ conn: null, heard: 0, address: known[i]?.address ?? null, device: known[i]?.device ?? '' }));
  const waiting = new Map();   // conn → { device, address, name, said } - connected, not seated yet
  let asking = null, sent = game().log.length;
  const say = (conn, m) => send(conn, JSON.stringify(m));
  const others = () => seats.map((s, i) => i).filter(i => i !== me);
  const seatOf = conn => others().find(i => seats[i].conn === conn) ?? -1;
  const here = () => seats.map((s, i) => i === me || !!s.conn);
  const everyone = m => others().forEach(i => { if (seats[i].conn) say(seats[i].conn, m); });
  const empty = () => others().filter(i => !seats[i].conn && usable(i));
  const free = () => empty()[0] ?? -1;
  const welcome = (conn, seat) => say(conn, { t: 'welcome', v: PROTOCOL, seat, ...game(), here: here(), ...extra() });
  const announce = () => everyone({ t: 'here', here: here(), ...extra() });
  function sit(conn, seat) {
    const w = waiting.get(conn);
    waiting.delete(conn);
    if (asking === conn) asking = null;
    seats[seat] = { conn, heard: Date.now(), address: w.address, device: w.device };
    onChange({ seat, name: w.name });   // the host takes the name in first, so the welcome carries it
    welcome(conn, seat);
    announce();
  }
  function turnAway(conn, t) {
    waiting.delete(conn);
    if (asking === conn) asking = null;
    say(conn, { t });
    drop(conn);
  }
  // the phones that said hello: back to their own seat, turned away when every seat is taken, else asked about -
  // one at a time
  function review() {
    for (const [conn, w] of [...waiting]) {
      if (!w.said || conn === asking) continue;
      const own = empty().find(i => seats[i].address && seats[i].address === w.address) ?? -1;
      if (own >= 0) sit(conn, own);
      else if (free() < 0) turnAway(conn, 'full');
    }
    if (asking && waiting.has(asking)) return;
    if (free() < 0) for (const [conn, w] of [...waiting]) if (w.said) turnAway(conn, 'full');
    asking = [...waiting].find(([, w]) => w.said)?.[0] ?? null;
    onAsk(asking === null ? null : { conn: asking, ...waiting.get(asking), seat: free(), seats: empty() });
  }
  function gone(conn) {
    const i = seatOf(conn), was = waiting.delete(conn);
    if (asking === conn) asking = null;
    if (i >= 0) {
      seats[i].conn = null;
      onChange({ seat: i, left: true });
      announce();
    }
    if (was || i >= 0) review();
  }
  return {
    here,
    announce,
    missing: empty,
    // who sat where last - saved with the game, so they go straight back to their seats next time
    known: () => seats.map((s, i) => i === me ? null : { address: s.address, device: s.device }),
    connected(conn, { name = '', address = '' } = {}) { waiting.set(conn, { device: name, address, name: '', said: false }); },
    message(conn, text) {
      const m = parse(text);
      if (!m) return;
      const i = seatOf(conn);
      if (i >= 0) seats[i].heard = Date.now();
      if (m.t === 'hello') {
        if (m.v !== PROTOCOL) return turnAway(conn, 'version');
        if (i >= 0) return welcome(conn, i);   // lost track: all again
        const w = waiting.get(conn);
        if (!w) return;
        w.name = String(m.name ?? '').trim().slice(0, 16);
        w.said = true;
        review();
      } else if (i < 0) return;
      else if (m.t === 'move') { if (!take(i, m.n, m.a)) say(conn, { t: 'reject', n: m.n }); }
      else if (m.t === 'ping') say(conn, { t: 'pong' });
      else if (m.t === 'bye') { gone(conn); drop(conn); }
    },
    disconnected: gone,
    // let it in - into the seat the host picked, or the first free one
    letIn(conn, seat = free()) {
      if (!waiting.has(conn) || !empty().includes(seat)) return;
      sit(conn, seat);
      review();
    },
    // the host took a player out: their phone is told and let go; nobody takes that seat any more
    kick(seat, why = 'removed') {
      const conn = seats[seat]?.conn;
      if (!conn || seat === me) return;
      seats[seat].conn = null;
      say(conn, { t: 'end', why });
      drop(conn);
      announce();
      review();
    },
    refuse(conn) {
      if (waiting.has(conn)) turnAway(conn, 'refused');
      review();
    },
    // the host's game moved on (its own move, or one it took from a phone): everyone gets it
    flush(log) {
      for (let n = sent; n < log.length; n++) everyone({ t: 'act', n, a: log[n] });
      sent = log.length;
    },
    names: names => everyone({ t: 'names', names }),
    end: why => everyone({ t: 'end', why }),
    // every few seconds: a ping keeps the line alive; a phone quiet for too long is let go
    tick() {
      const now = Date.now();
      for (const i of others()) {
        const s = seats[i];
        if (!s.conn) continue;
        if (now - s.heard > QUIET) { const conn = s.conn; gone(conn); drop(conn); } else say(s.conn, { t: 'ping' });
      }
    },
  };
}

// A phone in someone else's game. on: the host's messages by type (welcome, act, names, here, reject, refused, full,
// version, end). flush(log) sends this phone's own new actions; the host's copy of each comes back as an `act`.
export function createGuest({ name, send, on = {} }) {
  let up = false, heard = 0, sent = 0;
  const say = m => { if (up) send(JSON.stringify(m)); };
  return {
    get up() { return up; },
    connected() { up = true; heard = Date.now(); say({ t: 'hello', v: PROTOCOL, name }); },
    disconnected() { up = false; },
    message(text) {
      const m = parse(text);
      if (!m) return;
      heard = Date.now();
      if (m.t === 'welcome') sent = m.log.length;
      if (m.t === 'ping') return say({ t: 'pong' });
      on[m.t]?.(m);
    },
    flush(log) {
      for (let n = sent; n < log.length; n++) say({ t: 'move', n, a: log[n] });
      sent = Math.max(sent, log.length);
    },
    synced: length => { sent = Math.max(sent, length); },
    resync: () => say({ t: 'hello', v: PROTOCOL, name }),
    // every few seconds: true when the host has gone quiet
    tick() {
      if (!up) return false;
      say({ t: 'ping' });
      return Date.now() - heard > QUIET;
    },
    leave() { say({ t: 'bye' }); up = false; },
  };
}
