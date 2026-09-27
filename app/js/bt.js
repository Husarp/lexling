// Bluetooth, for Tiles on two phones (owner, 2026-09-27): the Android app's own plugin (BluetoothLinkPlugin.java).
// A browser or the desktop app has none. The tests put a stand-in on window.__btMock (two tabs of one browser).
function plugin() {
  if (window.__btMock) return window.__btMock;
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.() || C.getPlatform?.() !== 'android') return null;
  return C.Plugins?.BluetoothLink ?? C.registerPlugin?.('BluetoothLink') ?? null;
}
export const btAvailable = () => !!plugin();

export const bt = {
  state: () => plugin().state(),
  requestAccess: () => plugin().requestAccess(),
  turnOn: () => plugin().turnOn(),
  beVisible: seconds => plugin().beVisible({ seconds }),
  paired: () => plugin().paired(),
  search: () => plugin().search(),
  stopSearch: () => plugin().stopSearch(),
  host: () => plugin().host(),
  join: address => plugin().join({ address }),
  send: text => plugin().send({ text }),
  close: () => plugin().close(),
  // an event from the plugin ('found', 'searchDone', 'connected', 'message', 'disconnected'): resolves to a handle
  // whose remove() stops it
  on: (event, fn) => Promise.resolve(plugin().addListener(event, fn)),
};

// Bluetooth ready to use - the permission given and Bluetooth on, the system asked for each where needed:
// 'ok', or why not: 'unsupported', 'denied', 'off'.
export async function btReady() {
  const s = await bt.state();
  if (!s.supported) return 'unsupported';
  if (!s.allowed && !(await bt.requestAccess()).allowed) return 'denied';
  if (!(await bt.state()).on && !(await bt.turnOn()).on) return 'off';
  return 'ok';
}
