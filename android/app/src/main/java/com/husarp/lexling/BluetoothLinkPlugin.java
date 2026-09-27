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
import java.util.UUID;

/**
 * Tiles on several phones over Bluetooth (owner, 2026-09-27). The phone that starts the game hosts: it listens and
 * takes each phone that joins, several at once; a joining phone connects to it. Classic Bluetooth (RFCOMM),
 * "insecure", so no pairing dialog: a joining phone finds the host by searching nearby, or among the phones it is
 * already paired with. The connections themselves are Links (also used over Wi-Fi, LanLinkPlugin).
 *
 * Events to the page: "found" {name, address} while searching, "searchDone", and from Links "connected", "message",
 * "disconnected".
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

    private BluetoothAdapter adapter;
    private BluetoothServerSocket server;
    private BroadcastReceiver finder;
    private final Links links = new Links(this::notifyListeners);

    @Override
    public void load() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
    }

    private String alias() { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "nearby" : "location"; }

    private boolean allowed() { return getPermissionState(alias()) == PermissionState.GRANTED; }

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
        finder = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (BluetoothDevice.ACTION_FOUND.equals(intent.getAction())) {
                    BluetoothDevice d = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (d == null) return;
                    JSObject o = describe(d);
                    // what it is (a phone, a computer, headphones…) and how near: the list keeps phones, nearest first
                    BluetoothClass kind = intent.getParcelableExtra(BluetoothDevice.EXTRA_CLASS);
                    o.put("major", kind == null ? -1 : kind.getMajorDeviceClass());
                    o.put("rssi", intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE));
                    notifyListeners("found", o);
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(intent.getAction())) {
                    notifyListeners("searchDone", new JSObject());
                }
            }
        };
        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        getContext().registerReceiver(finder, filter);
        adapter.cancelDiscovery();
        if (!adapter.startDiscovery()) { stopFinder(); call.reject("search failed"); return; }
        call.resolve();
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void stopSearch(PluginCall call) {
        if (adapter != null && allowed()) adapter.cancelDiscovery();
        stopFinder();
        call.resolve();
    }

    /** Hosts a game: takes every phone that joins ("connected" for each) until stopHosting. Resolves once listening. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void host(PluginCall call) {
        if (adapter == null || !allowed()) { call.reject("permission"); return; }
        if (server != null) { call.resolve(); return; }
        final BluetoothServerSocket listening;
        try {
            listening = adapter.listenUsingInsecureRfcommWithServiceRecord("Lexling", SERVICE);
        } catch (IOException e) { call.reject("cannot host: " + e.getMessage()); return; }
        server = listening;
        new Thread(() -> {
            while (server == listening) {
                try {
                    BluetoothSocket s = listening.accept();
                    BluetoothDevice d = s.getRemoteDevice();
                    String name = null;
                    try { name = d.getName(); } catch (SecurityException e) { /* address only */ }
                    links.add(s, s.getInputStream(), s.getOutputStream(), name, d.getAddress(), "host");
                } catch (IOException e) { break; }   // stopped hosting (or Bluetooth went off)
            }
        }, "lexling-bt-host").start();
        call.resolve();
    }

    /** No more phones taken (the ones in stay). */
    @PluginMethod
    public void stopHosting(PluginCall call) {
        stopServer();
        call.resolve();
    }

    /** Joins the phone at `address`, which hosts. Resolves with the connection's id once connected. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void join(PluginCall call) {
        String address = call.getString("address");
        if (adapter == null || !allowed()) { call.reject("permission"); return; }
        if (address == null || !BluetoothAdapter.checkBluetoothAddress(address)) { call.reject("no such phone"); return; }
        new Thread(() -> {
            adapter.cancelDiscovery();                           // a running search slows a connection right down
            BluetoothDevice d = adapter.getRemoteDevice(address);
            String why = "";
            // a first try often fails - the other phone's service not looked up yet, or looked up before it last started
            // hosting - so up to three, the service looked up afresh between them
            for (int attempt = 0; attempt < 3; attempt++) {
                try {
                    if (attempt > 0) { d.fetchUuidsWithSdp(); Thread.sleep(1200); }
                    BluetoothSocket s = d.createInsecureRfcommSocketToServiceRecord(SERVICE);
                    s.connect();
                    String name = null;
                    try { name = d.getName(); } catch (SecurityException e) { /* address only */ }
                    JSObject r = new JSObject();
                    r.put("id", links.add(s, s.getInputStream(), s.getOutputStream(), name, address, "guest"));
                    call.resolve(r);
                    return;
                } catch (IOException | SecurityException e) {
                    why = e.getMessage() == null ? e.toString() : e.getMessage();
                } catch (InterruptedException e) { break; }
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
        BluetoothServerSocket s = server;
        server = null;
        Links.closeQuietly(s);
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
