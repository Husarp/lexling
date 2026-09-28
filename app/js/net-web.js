// Tiles over the internet (owner, 2026-09-27: "a ready-made free online database ... that I don't need to renew and it
// will just keep working"): Firebase's Realtime Database on its free plan, through its plain web interface - a request
// to write, a live stream (EventSource) to hear - so Lexling carries no library for it. Each hosted game is a room under
// a 6-character code:
//   rooms/<code>/host              { uid, name, at }   whose room it is
//   rooms/<code>/up/<uid>/<key>    text                a joined phone or computer → the host
//   rooms/<code>/down/<uid>/<key>  text                the host → that one
// Everyone signs in anonymously (players make no accounts); database.rules.json lets each write only its own part. What
// has been read is deleted; the host deletes the room when it stops hosting. Two messages belong to this file: HI (with
// the joiner's device) opens a connection, BYE closes it. The same calls and events as the Android plugins (net.js), so
// the game does not know the difference.
import { settings, saveSettings } from './store.js';
import { FIREBASE } from './online-config.js';

const cfg = () => window.__firebase ?? FIREBASE;   // the tests: a stand-in server
export const webConfigured = () => !!(cfg()?.apiKey && cfg()?.databaseURL);

const CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I/L - read out and typed without mix-ups
const newCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), n => CODE[n % CODE.length]).join('');
export const cleanCode = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isCode = s => s.length === 6 && [...s].every(c => CODE.includes(c));
const HI = '\u0001', BYE = '\u0002';
const NOW = { '.sv': 'timestamp' };

// ── signing in: once per device, kept (the same player - and the same host of its rooms - next time) ──
let idToken = '', idUntil = 0, signing = null;
async function call(url, body, type) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body });
  if (!r.ok) throw Object.assign(new Error('sign-in: ' + r.status), { status: r.status });
  return r.json();
}
function token() {
  if (idToken && Date.now() < idUntil - 60000) return Promise.resolve(idToken);
  return signing ??= (async () => {
    try {
      const c = cfg(), refresh = settings.webAuth?.refresh;
      let a = null;
      if (refresh) {
        const r = await call(`${c.tokenURL ?? 'https://securetoken.googleapis.com'}/v1/token?key=${c.apiKey}`,
          'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refresh), 'application/x-www-form-urlencoded')
          .catch(e => { if (e.status === 400) return null; throw e; });   // no longer valid: a new sign-in
        if (r) a = { uid: r.user_id, id: r.id_token, refresh: r.refresh_token, secs: +r.expires_in };
      }
      if (!a) {
        const r = await call(`${c.authURL ?? 'https://identitytoolkit.googleapis.com'}/v1/accounts:signUp?key=${c.apiKey}`,
          JSON.stringify({ returnSecureToken: true }), 'application/json');
        a = { uid: r.localId, id: r.idToken, refresh: r.refreshToken, secs: +r.expiresIn };
      }
      settings.webAuth = { uid: a.uid, refresh: a.refresh };
      saveSettings();
      idToken = a.id;
      idUntil = Date.now() + a.secs * 1000;
      return idToken;
    } finally { signing = null; }
  })();
}
const me = () => settings.webAuth?.uid ?? '';

// ── the database ──
async function db(method, path, body) {
  const r = await fetch(`${cfg().databaseURL}/${path}.json?auth=${await token()}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw Object.assign(new Error(`${method} ${path}: ${r.status}`), { status: r.status });
  return r.json();
}
// what arrives at `path`, as the stream tells it: on(type, path, data, first) - `first` the whole of it on (re)opening
function listen(path, on) {
  let es = null, stopped = false, timer = 0, first = true;
  const retry = () => { es?.close(); es = null; clearTimeout(timer); if (!stopped) timer = setTimeout(open, 3000); };
  async function open() {
    if (stopped) return;
    let tok;
    try { tok = await token(); } catch { return retry(); }
    if (stopped) return;
    es = new EventSource(`${cfg().databaseURL}/${path}.json?auth=${tok}`);
    es.onopen = () => { first = true; };
    const handle = type => e => { let m; try { m = JSON.parse(e.data); } catch { return; } const f = first; first = false; on(type, m.path, m.data, f); };
    es.addEventListener('put', handle('put'));
    es.addEventListener('patch', handle('patch'));
    es.addEventListener('auth_revoked', () => { idUntil = 0; retry(); });   // the sign-in ran out (after an hour)
    es.addEventListener('cancel', retry);                                  // not allowed any more
    es.onerror = () => { if (es?.readyState === 2) retry(); };            // else EventSource tries again itself
  }
  open();
  return () => { stopped = true; clearTimeout(timer); es?.close(); };
}
// every value `depth` levels below the stream's own path that an event sets: [keys, value] (value null: gone)
function leaves(type, path, data, depth) {
  const out = [], base = path.split('/').filter(Boolean);
  const walk = (ks, v) => {
    if (ks.length === depth || v === null) return out.push([ks, v]);
    if (ks.length > depth || typeof v !== 'object') return;
    for (const k of Object.keys(v).sort()) walk([...ks, k], v[k]);   // push keys sort in the order they were made
  };
  if (type === 'patch') for (const k of Object.keys(data ?? {}).sort()) walk([...base, k], data[k]);
  else walk(base, data);
  return out;
}

// ── the link, shaped like the Android plugins ──
export function webLink({ device = async () => '' } = {}) {
  const fns = {};
  const emit = (event, data) => (fns[event] ?? new Set()).forEach(fn => fn(data));
  let room = null, guest = null;
  // one message after another on each line - two at once could arrive the wrong way round
  const queue = (line, path, text) => (line.chain = line.chain.then(() => db('POST', path, text)).catch(() => {}));
  // read: deleted there, and then no longer remembered here
  const forget = (path, keys, done) => {
    if (!keys.length) return;
    db('PATCH', path, Object.fromEntries(keys.map(k => [k, null]))).then(() => keys.forEach(done), () => {});
  };

  // hosting: the room (again under the code it had, when it is still ours), and what the phones send
  async function host({ name = '', room: want = '' } = {}) {
    await stopHosting();
    await token();
    let code = isCode(want) ? want : newCode();
    for (let i = 0; ; i++) {
      try { await db('PUT', `rooms/${code}`, { host: { uid: me(), name: String(name).slice(0, 60), at: NOW } }); break; }
      catch (e) { if (e.status !== 401 || i > 4) throw e; code = newCode(); }   // someone else's: another code
    }
    const r = room = { code, conns: new Map(), seen: new Set() };
    r.stop = listen(`rooms/${code}/up`, (type, path, data) => {
      const read = new Map();
      for (const [[uid, key], v] of leaves(type, path, data, 2)) {
        if (!uid || !key || typeof v !== 'string' || r.seen.has(uid + '/' + key)) continue;
        r.seen.add(uid + '/' + key);
        (read.get(uid) ?? read.set(uid, []).get(uid)).push(key);
        if (v[0] === HI) {
          if (!r.conns.has(uid)) { r.conns.set(uid, { chain: Promise.resolve() }); emit('connected', { id: uid, name: v.slice(1), address: uid, role: 'host' }); }
        } else if (v === BYE) {
          if (r.conns.delete(uid)) emit('disconnected', { id: uid });
        } else if (r.conns.has(uid)) emit('message', { id: uid, text: v });
        else db('POST', `rooms/${code}/down/${uid}`, BYE).catch(() => {});   // not connected here (the host started again): it joins anew
      }
      for (const [uid, keys] of read) forget(`rooms/${code}/up/${uid}`, keys, k => r.seen.delete(uid + '/' + k));
    });
    return { code };
  }
  async function stopHosting() {
    const r = room;
    if (!r) return;
    room = null;
    r.stop();
    await db('DELETE', `rooms/${r.code}`).catch(() => {});   // the joined ones hear it: their line is gone
  }

  // joining: the room under this code, then HI
  async function join({ address }) {
    const code = cleanCode(address);
    if (!isCode(code)) throw new Error('bad code');
    if (guest) close({ id: guest.code });
    await token();
    const h = await db('GET', `rooms/${code}/host`);
    if (!h) throw new Error('no game');
    const inbox = `rooms/${code}/down/${me()}`;
    await db('DELETE', inbox);   // anything left from before
    const g = guest = { code, name: h.name ?? '', seen: new Set(), chain: Promise.resolve() };
    const lost = () => { if (guest !== g) return; close({ id: code }); emit('disconnected', { id: code }); };
    g.stop = listen(inbox, (type, path, data, first) => {
      if (type === 'put' && path === '/' && data === null && !first) {
        // all of it gone: the room deleted (the host stopped) - or only emptied
        return void db('GET', `rooms/${code}/host`).then(x => { if (!x) lost(); }, () => {});
      }
      const read = [];
      for (const [[key], v] of leaves(type, path, data, 1)) {
        if (!key || typeof v !== 'string' || g.seen.has(key)) continue;
        g.seen.add(key);
        read.push(key);
        if (v === BYE) return lost();
        if (guest === g) emit('message', { id: code, text: v });
      }
      forget(inbox, read, k => g.seen.delete(k));
    });
    queue(g, `rooms/${code}/up/${me()}`, HI + String(await device()).slice(0, 40));
    setTimeout(() => { if (guest === g) emit('connected', { id: code, name: g.name, address: code, role: 'guest' }); });
    return { id: code, name: g.name };
  }

  function send({ id, text }) {
    if (guest?.code === id) return queue(guest, `rooms/${id}/up/${me()}`, text);
    const c = room?.conns.get(id);
    return c ? queue(c, `rooms/${room.code}/down/${id}`, text) : Promise.resolve();
  }
  // one line (a joined one's, or this one's to the host), or all of them and the hosting
  async function close({ id } = {}) {
    if (guest && (!id || id === guest.code)) {
      const g = guest;
      guest = null;
      g.stop?.();
      queue(g, `rooms/${g.code}/up/${me()}`, BYE);
      g.chain.then(() => db('DELETE', `rooms/${g.code}/down/${me()}`)).catch(() => {});
    }
    if (room && id && room.conns.has(id)) {
      const c = room.conns.get(id), code = room.code;
      room.conns.delete(id);
      queue(c, `rooms/${code}/down/${id}`, BYE);
      c.chain.then(() => db('DELETE', `rooms/${code}/up/${id}`)).catch(() => {});
    }
    if (!id) await stopHosting();
  }

  return {
    state: async () => ({ supported: webConfigured(), allowed: true, on: navigator.onLine !== false, name: await device(), code: room?.code ?? '', connected: !!guest }),
    host,
    stopHosting,
    search: async () => {},
    stopSearch: async () => {},
    join,
    send,
    close,
    addListener: (event, fn) => { (fns[event] ??= new Set()).add(fn); return { remove: () => fns[event].delete(fn) }; },
  };
}
