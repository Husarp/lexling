package com.husarp.lexling;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.LocationManager;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tiles on several phones over Bluetooth (owner, 2026-09-27). The phone that starts the game hosts: it listens and
 * takes each phone that joins, several at once; a joining phone connects to it. Classic Bluetooth (RFCOMM),
 * "insecure", so no pairing dialog: a joining phone finds the host by searching nearby, or among the phones it is
 * already paired with. The connections themselves are Links (also used over Wi-Fi, LanLinkPlugin).
 *
 * Between some phones the insecure connection does not come up (owner, 2026-09-28: "make it work with as many devices
 * as possible"), so the host also listens for a paired connection, and a joining phone tries that last - Android then
 * asks both phones to pair, once (the Android Bluetooth Chat sample's two services). Other known pitfalls handled here:
 * a search also reports Bluetooth LE-only gadgets and random LE addresses, which never take a connection (left out, as
 * Briar does); names often come a moment after the phone (a second "found"); a search still stopping, or a failed
 * socket left open, makes the next connection fail; up to Android 11 a search finds nothing while Location is off.
 *
 * Events to the page: "found" {name, address, major, rssi} while searching, "searchDone", "pairing" {address} before a
 * paired try, and from Links "connected", "message", "disconnected".
 */
@CapacitorPlugin(
    name = "BluetoothLink",
    permissions = {
        // Android 12 and later: the "nearby devices" permissions
        @Permission(alias = "nearby", strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE }),
        // up to Android 11: searching for devices needs the location permission
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class BluetoothLinkPlugin extends Plugin {

    /** Lexling's own service: a host listens under it, a joining phone asks for it. */
    private static final UUID SERVICE = UUID.fromString("5a3f1c7e-8b2d-4c6a-9e1f-4d2b7a9c3e51");
    /** The same, paired (a secure connection): the last try, when the insecure one does not come up. */
    private static final UUID SERVICE_PAIRED = UUID.fromString("5a3f1c7e-8b2d-4c6a-9e1f-4d2b7a9c3e52");

    private BluetoothAdapter adapter;
    private volatile boolean hosting;
    private BluetoothServerSocket server, serverPaired;
    private BroadcastReceiver finder;
    /** The phones this search found (address → their kind), so a name that comes later reaches the list too. */
    private final Map<String, Integer> seen = new ConcurrentHashMap<>();
    private final Links links = new Links(this::notifyListeners);

    @Override
    public void load() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
    }

    private String alias() { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "nearby" : "location"; }

    private boolean allowed() { return getPermissionState(alias()) == PermissionState.GRANTED; }

    /** Up to Android 11 a search finds nothing while Location is off - even with the permission. */
    static boolean locationOff(Context context, int upToSdk) {
        if (Build.VERSION.SDK_INT > upToSdk) return false;
        LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return !lm.isLocationEnabled();
        return Settings.Secure.getInt(context.getContentResolver(), Settings.Secure.LOCATION_MODE, Settings.Secure.LOCATION_MODE_OFF) == Settings.Secure.LOCATION_MODE_OFF;
    }

    /** Is there Bluetooth, is it on, may the app use it - and this phone's Bluetooth name (what the other phones list). */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void state(PluginCall call) {
        JSObject r = new JSObject();
        String name = null;
        try { if (adapter != null && allowed()) name = adapter.getName(); } catch (SecurityException e) { /* no permission: no name */ }
        r.put("name", name == null ? "" : name);
        r.put("supported", adapter != null);
        r.put("on", adapter != null && adapter.isEnabled());
        r.put("allowed", allowed());
        r.put("connected", links.count() > 0);
        r.put("locationOff", locationOff(getContext(), Build.VERSION_CODES.R));
        // findable by other phones' search right now (it runs out: the host asks again)
        boolean visible = false;
        try { visible = adapter != null && allowed() && adapter.getScanMode() == BluetoothAdapter.SCAN_MODE_CONNECTABLE_DISCOVERABLE; } catch (SecurityException e) { /* unknown */ }
        r.put("visible", visible);
        call.resolve(r);
    }

    /** Asks for the permissions (the system's own dialog). */
    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (allowed()) { JSObject r = new JSObject(); r.put("allowed", true); call.resolve(r); return; }
        requestPermissionForAlias(alias(), call, "accessResult");
    }

    @PermissionCallback
    private void accessResult(PluginCall call) {
        JSObject r = new JSObject();
        r.put("allowed", allowed());
        call.resolve(r);
    }

    /** Asks the system to switch Bluetooth on. (Switching it off is the person's own: Android lets no app do that.) */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void turnOn(PluginCall call) {
        if (adapter == null) { call.reject("no Bluetooth"); return; }
        if (adapter.isEnabled()) { JSObject r = new JSObject(); r.put("on", true); call.resolve(r); return; }
        if (!allowed()) { call.reject("permission"); return; }
        startActivityForResult(call, new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), "turnOnResult");
    }

    @ActivityCallback
    private void turnOnResult(PluginCall call, ActivityResult result) {
        JSObject r = new JSObject();
        r.put("on", adapter != null && adapter.isEnabled());
        call.resolve(r);
    }

    /** Android's Bluetooth settings, where the person can switch it off (the reminder after a game). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent settings = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(settings);
        call.resolve();
    }

    /** Android's Location settings - up to Android 11 a search needs Location on. */
    @PluginMethod
    public void openLocation(PluginCall call) {
        Intent settings = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(settings);
        call.resolve();
    }

    /** Asks the system to make this phone findable for a while, so the other phones' search sees it. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void beVisible(PluginCall call) {
        if (!allowed()) { call.reject("permission"); return; }
        Intent visible = new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE);
        visible.putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, call.getInt("seconds", 300));
        startActivityForResult(call, visible, "beVisibleResult");
    }

    @ActivityCallback
    private void beVisibleResult(PluginCall call, ActivityResult result) {
        JSObject r = new JSObject();
        r.put("visible", result.getResultCode() != Activity.RESULT_CANCELED);
        call.resolve(r);
    }

    /** The phones this one is paired with already. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void paired(PluginCall call) {
        if (adapter == null || !allowed()) { call.reject("permission"); return; }
        JSArray list = new JSArray();
        for (BluetoothDevice d : adapter.getBondedDevices()) list.put(describe(d));
        JSObject r = new JSObject();
        r.put("devices", list);
        call.resolve(r);
    }

    /** Looks for phones nearby: each one found is a "found" event, the end a "searchDone". */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void search(PluginCall call) {
        if (adapter == null || !allowed()) { call.reject("permission"); return; }
        stopFinder();
        seen.clear();
        finder = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    BluetoothDevice d = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (d == null || leOnly(d)) return;
                    JSObject o = describe(d);
                    // what it is (a phone, a computer, headphones…) and how near: the list keeps phones, nearest first
                    BluetoothClass kind = intent.getParcelableExtra(BluetoothDevice.EXTRA_CLASS);
                    int major = kind == null ? -1 : kind.getMajorDeviceClass();
                    seen.put(d.getAddress(), major);
                    o.put("major", major);
                    o.put("rssi", intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE));
                    notifyListeners("found", o);
                } else if (BluetoothDevice.ACTION_NAME_CHANGED.equals(action)) {
                    // the name, often a moment after the phone itself: the list shows it instead of the address
                    BluetoothDevice d = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    Integer major = d == null ? null : seen.get(d.getAddress());
                    if (major == null) return;
                    JSObject o = describe(d);
                    o.put("major", major);
                    notifyListeners("found", o);
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    notifyListeners("searchDone", new JSObject());
                }
            }
        };
        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothDevice.ACTION_NAME_CHANGED);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        getContext().registerReceiver(finder, filter);
        adapter.cancelDiscovery();
        if (!adapter.startDiscovery()) { stopFinder(); call.reject("search failed"); return; }
        call.resolve();
    }

    // a Bluetooth LE-only device (or a phone seen only by its LE advertising, under a random address): never a host
    @SuppressLint("MissingPermission")
    private static boolean leOnly(BluetoothDevice d) {
        try { return d.getType() == BluetoothDevice.DEVICE_TYPE_LE; } catch (SecurityException e) { return false; }
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void stopSearch(PluginCall call) {
        if (adapter != null && allowed()) adapter.cancelDiscovery();
        stopFinder();
        call.resolve();
    }

    /** Hosts a game: takes every phone that joins ("connected" for each) until stopHosting. Resolves once listening. */
    @PluginMethod
    public void host(PluginCall call) {
        if (adapter == null || !allowed()) { call.reject("permission"); return; }
        if (hosting) { call.resolve(); return; }
        String why = listen(false);
        if (why != null) { call.reject("cannot host: " + why); return; }
        hosting = true;
        listen(true);   // the paired service too - not a reason to fail when only it will not open
        call.resolve();
    }

    // Listens under one of the two services, on a thread of its own. When the listening breaks while still hosting
    // (Bluetooth switched off and on, the Bluetooth service restarted), it opens again - else the host would wait for
    // phones it no longer hears. Returns why it could not open, or null.
    @SuppressLint("MissingPermission")
    private String listen(boolean paired) {
        final BluetoothServerSocket listening;
        try {
            listening = paired ? adapter.listenUsingRfcommWithServiceRecord("Lexling", SERVICE_PAIRED)
                : adapter.listenUsingInsecureRfcommWithServiceRecord("Lexling", SERVICE);
        } catch (IOException | SecurityException e) { return e.getMessage() == null ? e.toString() : e.getMessage(); }
        if (paired) serverPaired = listening; else server = listening;
        new Thread(() -> {
            while ((paired ? serverPaired : server) == listening) {
                try {
                    BluetoothSocket s = listening.accept();
                    BluetoothDevice d = s.getRemoteDevice();
                    String name = null;
                    try { name = d.getName(); } catch (SecurityException e) { /* address only */ }
                    links.add(s, s.getInputStream(), s.getOutputStream(), name, d.getAddress(), "host");
                } catch (IOException e) {
                    Links.closeQuietly(listening);
                    // still hosting: open again as soon as it can (Bluetooth back on); stopped hosting: done
                    while (hosting && (paired ? serverPaired : server) == listening) {
                        try { Thread.sleep(2000); } catch (InterruptedException x) { return; }
                        if (hosting && (paired ? serverPaired : server) == listening && listen(paired) == null) return;
                    }
                    return;
                }
            }
        }, paired ? "lexling-bt-host-paired" : "lexling-bt-host").start();
        return null;
    }

    /** No more phones taken (the ones in stay). */
    @PluginMethod
    public void stopHosting(PluginCall call) {
        stopServer();
        call.resolve();
    }

    /**
     * Joins the phone at `address`, which hosts. Resolves with the connection's id once connected. `pair`: when the
     * insecure connection does not come up, try a paired one (Android asks both phones to pair) - the Join screen's
     * tap; a phone reconnecting on its own only uses a pairing that is already there.
     */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void join(PluginCall call) {
        String address = call.getString("address");
        boolean pair = Boolean.TRUE.equals(call.getBoolean("pair", false));
        if (adapter == null || !allowed()) { call.reject("permission"); return; }
        if (address == null || !BluetoothAdapter.checkBluetoothAddress(address)) { call.reject("no such phone"); return; }
        new Thread(() -> {
            // a search still running (or still stopping) makes a connection fail: stopped, and waited for
            adapter.cancelDiscovery();
            for (int i = 0; i < 20 && adapter.isDiscovering(); i++) { try { Thread.sleep(100); } catch (InterruptedException e) { break; } }
            BluetoothDevice d = adapter.getRemoteDevice(address);
            boolean bonded = false;
            try { bonded = d.getBondState() == BluetoothDevice.BOND_BONDED; } catch (SecurityException e) { /* not known */ }
            String why = "";
            // a first try often fails - the other phone's service not looked up yet, or looked up before it last started
            // hosting - so a second, the service looked up afresh; then, where allowed, a paired one
            int tries = pair || bonded ? 3 : 2;
            for (int attempt = 0; attempt < tries; attempt++) {
                boolean secure = attempt == 2;
                BluetoothSocket s = null;
                try {
                    if (attempt > 0) { d.fetchUuidsWithSdp(); Thread.sleep(1200); }
                    if (secure && !bonded) { JSObject p = new JSObject(); p.put("address", address); notifyListeners("pairing", p); }
                    s = secure ? d.createRfcommSocketToServiceRecord(SERVICE_PAIRED) : d.createInsecureRfcommSocketToServiceRecord(SERVICE);
                    s.connect();
                    String name = null;
                    try { name = d.getName(); } catch (SecurityException e) { /* address only */ }
                    JSObject r = new JSObject();
                    r.put("id", links.add(s, s.getInputStream(), s.getOutputStream(), name, address, "guest"));
                    r.put("paired", secure);
                    call.resolve(r);
                    return;
                } catch (IOException | SecurityException e) {
                    Links.closeQuietly(s);   // a failed socket left open can block the next try
                    why = e.getMessage() == null ? e.toString() : e.getMessage();
                } catch (InterruptedException e) { Links.closeQuietly(s); break; }
            }
            call.reject("cannot connect: " + why);
        }, "lexling-bt-join").start();
    }

    /** One line: to the connection `id`, or to every one. */
    @PluginMethod
    public void send(PluginCall call) {
        String id = call.getString("id"), text = call.getString("text", "");
        if (id == null) { links.sendAll(text); call.resolve(); return; }
        if (links.send(id, text)) call.resolve(); else call.reject("not connected");
    }

    /** Closes the connection `id` - or, without one, every connection and the hosting. */
    @PluginMethod
    public void close(PluginCall call) {
        String id = call.getString("id");
        if (id != null) links.close(id);
        else { links.closeAll(); stopServer(); }
        call.resolve();
    }

    private void stopServer() {
        hosting = false;
        BluetoothServerSocket s = server, p = serverPaired;
        server = null;
        serverPaired = null;
        Links.closeQuietly(s);
        Links.closeQuietly(p);
    }

    private void stopFinder() {
        if (finder == null) return;
        try { getContext().unregisterReceiver(finder); } catch (IllegalArgumentException e) { /* not registered */ }
        finder = null;
    }

    @SuppressLint("MissingPermission")
    private JSObject describe(BluetoothDevice d) {
        JSObject o = new JSObject();
        String name = null;
        try { name = d.getName(); } catch (SecurityException e) { /* no permission: address only */ }
        o.put("name", name == null ? "" : name);
        o.put("address", d.getAddress());
        return o;
    }

    @Override
    protected void handleOnDestroy() {
        stopFinder();
        links.closeAll();
        stopServer();
    }
}
