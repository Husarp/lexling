// One game on two devices (owner, 2026-09-27: "Bluetooth first - and reconnecting when the connection drops").
// Both devices hold the whole game - its setup and every action since (tiles.js replays it the same way everywhere,
// seed and all) - so all that travels is the actions. This is the conversation between the two, whatever carries it
// (Bluetooth for now): each side says how far its game has got; the side ahead sends what the other is missing; a new
// action goes out numbered, and one that does not fit (a gap) makes the receiver ask again. A dropped connection so
// loses nothing: on reconnecting - or after the app was closed and opened again - the two games catch up.
//
// Messages, one JSON object each:
//   { t: 'hello', v, game, n, h } - I am in game `game` (protocol v), with n actions whose hash is h
//   { t: 'act', n, a }            - action a is the game's n-th (from 0)
//   { t: 'sync', from, acts }     - the actions from index `from` on
//   { t: 'ping', n } / { t: 'pong', n } - still here, with n actions (a lost action is so noticed within a beat)
//   { t: 'diverged' }             - our two games are not the same game any more
//   { t: 'bye' }                  - leaving on purpose
export const PROTOCOL = 1;

// FNV-1a over the actions as JSON: equal logs, equal hashes - so two games that went apart are noticed
export function hashOf(actions) {
  const text = JSON.stringify(actions);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

// game: the game's id, the same on both devices; send(text): hands a message to the transport; actions(): this
// device's actions so far; apply(a): plays another device's action here (after which actions() includes it);
// onEvent(kind, detail): 'ready' (in step), 'act' (an action came in), 'synced' (missing ones came in), 'bye',
// 'version' / 'other-game' / 'diverged' (cannot go on together), 'down' (the connection is gone).
export function createLink({ game, send, actions, apply, onEvent = () => {} }) {
  let up = false, heard = 0, known = 0;   // known: how many actions the other side is known to have
  const say = m => { if (up) send(JSON.stringify(m)); };
  const hello = () => say({ t: 'hello', v: PROTOCOL, game, n: actions().length, h: hashOf(actions()) });
  const catchUp = (from, acts) => {
    const have = actions().length;
    if (from > have) { hello(); return false; }                 // a gap: say where this side is
    known = from + acts.length;                                  // before applying: nothing of it goes back
    for (const a of acts.slice(have - from)) apply(a);
    return true;
  };
  return {
    get up() { return up; },
    // time since the other side was last heard - for noticing a connection that went quiet
    quietFor: () => up ? Date.now() - heard : Infinity,
    connected() { up = true; heard = Date.now(); hello(); },
    disconnected() { if (!up) return; up = false; onEvent('down'); },
    // the actions made on this device since the last flush (already played here), sent numbered - while the
    // connection is down they wait, and the next hello brings them
    flush() {
      if (!up) return;
      const all = actions();
      for (let i = known; i < all.length; i++) say({ t: 'act', n: i, a: all[i] });
      known = all.length;
    },
    beat() { say({ t: 'ping', n: actions().length }); },
    leave() { say({ t: 'bye' }); },
    receive(text) {
      let m;
      try { m = JSON.parse(text); } catch { return; }
      heard = Date.now();
      const mine = actions();
      if (m.t === 'hello') {
        if (m.v !== PROTOCOL) return onEvent('version', m.v);
        if (m.game !== game) return onEvent('other-game', m.game);
        if (m.n > mine.length) return;                              // they are ahead: my hello brings their sync
        // their game must be the start of mine
        if (hashOf(mine.slice(0, m.n)) !== m.h) { say({ t: 'diverged' }); return onEvent('diverged'); }
        if (m.n < mine.length) say({ t: 'sync', from: m.n, acts: mine.slice(m.n) });   // they are behind: the rest
        else onEvent('ready');
        known = mine.length;
      } else if (m.t === 'diverged') onEvent('diverged');
      else if (m.t === 'act') {
        if (m.n === mine.length) { known = m.n + 1; apply(m.a); onEvent('act', m.a); }
        else if (m.n > mine.length) hello();                         // one went missing: ask for it
      } else if (m.t === 'sync') {
        // caught up: said again, so the other side knows the two are in step now (it answers 'ready')
        if (catchUp(m.from, m.acts)) { onEvent('synced', m.acts.length); hello(); }
      } else if (m.t === 'ping' || m.t === 'pong') {
        if (m.t === 'ping') say({ t: 'pong', n: mine.length });
        if (m.n > mine.length) hello();                             // they have more: ask for it
      }
      else if (m.t === 'bye') onEvent('bye');
    },
  };
}
