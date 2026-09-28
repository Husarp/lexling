// Tiles on several phones (owner, 2026-09-27): the connections - Google's Nearby (Bluetooth and Wi-Fi together, since
// 0.63.0), Bluetooth or Wi-Fi, the Android app's own plugins (NearbyLinkPlugin, BluetoothLinkPlugin, LanLinkPlugin), and
// the internet (net-web.js: Firebase, on every device once it is set up), with
// the same calls and events. The tests put stand-ins on window.__netMock ({ near, bt, lan }).
import { webLink, webConfigured } from './net-web.js';
const PLUGIN = { near: 'NearbyLink', bt: 'BluetoothLink', lan: 'LanLink' };
export const KINDS = ['near', 'bt', 'lan', 'web'];
let web = null;

// what the host is told joins: the phone's own name (its Bluetooth name), else what it is
async function device() {
  const bt = plugin('bt'), name = bt ? (await bt.state().catch(() => ({}))).name : '';
  return name || (window.Capacitor?.getPlatform?.() === 'android' ? 'Android' : window.pywebview ? 'Windows' : 'Browser');
}

function plugin(kind) {
  if (window.__netMock) return window.__netMock[kind] ?? null;
  if (kind === 'web') return webConfigured() ? (web ??= webLink({ device })) : null;
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.() || C.getPlatform?.() !== 'android') return null;
  return C.Plugins?.[PLUGIN[kind]] ?? C.registerPlugin?.(PLUGIN[kind]) ?? null;
}
// which kinds this device has - a browser or the desktop only the internet, once it is set up
export const netKinds = () => KINDS.filter(k => plugin(k));

let turnedOn = false;   // Lexling switched Bluetooth on (for the reminder when the game is left)

export function net(kind) {
  const p = () => plugin(kind);
  return {
    kind,
    state: () => p().state(),
    host: (name, room) => p().host({ name, room }),   // room: the internet's code to host under again → { code }
    stopHosting: () => p().stopHosting(),
    search: () => p().search(),
    stopSearch: () => p().stopSearch(),
    paired: () => kind === 'bt' ? p().paired() : Promise.resolve({ devices: [] }),
    beVisible: seconds => kind === 'bt' ? p().beVisible({ seconds }) : Promise.resolve({ visible: true }),
    join: (address, pair) => p().join({ address, pair }),     // → { id }; pair: Bluetooth may ask both phones to pair
    send: (id, text) => p().send({ id, text }),
    close: id => p().close(id ? { id } : {}),                // one connection, or all of them and the hosting
    // an event ('found', 'searchDone', 'connected', 'message', 'disconnected'): resolves to a handle whose remove() stops it
    on: (event, fn) => Promise.resolve(p().addListener(event, fn)),
  };
}

// Ready to use: 'ok', or why not - 'unsupported', 'noPlay' (Nearby: no Google Play services), 'denied', 'off',
// 'location', 'offline'. Bluetooth and Nearby ask the system for the permission and to switch Bluetooth on where needed;
// up to Android 11 a search finds nothing while Location is off (Nearby's host too) - `searching`: this phone searches.
// Wi-Fi needs neither (whether the phones share a network shows when searching); the internet needs a connection.
export async function netReady(kind, searching = false) {
  const p = plugin(kind);
  if (!p) return 'unsupported';
  const s = await p.state();
  if (!s.supported) return kind === 'near' ? 'noPlay' : 'unsupported';
  if (kind === 'web') return s.on ? 'ok' : 'offline';
  if (kind === 'lan') return 'ok';
  if (!s.allowed && !(await p.requestAccess()).allowed) return 'denied';
  if (!(await p.state()).on) {
    if (!(await p.turnOn()).on) return 'off';
    turnedOn = true;
  }
  if ((searching || kind === 'near') && (await p.state()).locationOff) return 'location';
  return 'ok';
}
// Nearby works only where Google Play services is (almost every Android phone): false when it is not
export const nearbyHere = async () => !!(await plugin('near')?.state().catch(() => null))?.supported;
// Android's Location settings (for 'location')
export const openLocation = kind => plugin(kind)?.openLocation?.().catch(() => {});

// Bluetooth still on after a game, and Lexling was the one that switched it on (the reminder, owner 2026-09-27)
export async function btStillOn() {
  if (!turnedOn || !plugin('bt')) return false;
  const s = await plugin('bt').state().catch(() => ({}));
  if (!s.on) turnedOn = false;
  return !!s.on;
}
export const btLetBe = () => { turnedOn = false; };
// Android lets no app switch Bluetooth off: its Bluetooth settings, where the person can
export const btSettings = () => plugin('bt')?.openSettings().catch(() => {});
