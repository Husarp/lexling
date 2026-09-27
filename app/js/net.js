// Tiles on several phones (owner, 2026-09-27): the connections - Bluetooth or Wi-Fi, the Android app's own plugins
// (BluetoothLinkPlugin, LanLinkPlugin), with the same calls and events. A browser or the desktop app has neither. The
// tests put stand-ins on window.__netMock ({ bt, lan }).
const PLUGIN = { bt: 'BluetoothLink', lan: 'LanLink' };
export const KINDS = ['bt', 'lan'];

function plugin(kind) {
  if (window.__netMock) return window.__netMock[kind] ?? null;
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.() || C.getPlatform?.() !== 'android') return null;
  return C.Plugins?.[PLUGIN[kind]] ?? C.registerPlugin?.(PLUGIN[kind]) ?? null;
}
// which kinds this device has - none in a browser or on the desktop
export const netKinds = () => KINDS.filter(k => plugin(k));

let turnedOn = false;   // Lexling switched Bluetooth on (for the reminder when the game is left)

export function net(kind) {
  const p = () => plugin(kind);
  return {
    kind,
    state: () => p().state(),
    host: name => p().host({ name }),
    stopHosting: () => p().stopHosting(),
    search: () => p().search(),
    stopSearch: () => p().stopSearch(),
    paired: () => kind === 'bt' ? p().paired() : Promise.resolve({ devices: [] }),
    beVisible: seconds => kind === 'bt' ? p().beVisible({ seconds }) : Promise.resolve({ visible: true }),
    join: address => p().join({ address }),                  // → { id }
    send: (id, text) => p().send({ id, text }),
    close: id => p().close(id ? { id } : {}),                // one connection, or all of them and the hosting
    // an event ('found', 'searchDone', 'connected', 'message', 'disconnected'): resolves to a handle whose remove() stops it
    on: (event, fn) => Promise.resolve(p().addListener(event, fn)),
  };
}

// Ready to use: 'ok', or why not - 'unsupported', 'denied', 'off'. Bluetooth asks the system for the permission and to
// switch on where needed; Wi-Fi needs neither (whether the phones share a network shows when searching).
export async function netReady(kind) {
  const p = plugin(kind);
  if (!p) return 'unsupported';
  const s = await p.state();
  if (!s.supported) return 'unsupported';
  if (kind !== 'bt') return 'ok';
  if (!s.allowed && !(await p.requestAccess()).allowed) return 'denied';
  if (!(await p.state()).on) {
    if (!(await p.turnOn()).on) return 'off';
    turnedOn = true;
  }
  return 'ok';
}

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
