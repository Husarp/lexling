package com.husarp.lexling;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

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

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Tiles on two phones over Bluetooth (owner, 2026-09-27). One phone hosts - it listens - and the other joins it; then
 * the two exchange lines of text (JSON, one message a line; app/js/link.js is what they say). Classic Bluetooth
 * (RFCOMM), "insecure", so no pairing dialog: the joining phone finds the host by searching nearby, or among the phones
 * it is already paired with.
 *
 * Events to the page: "found" {name, address} while searching, "searchDone", "connected" {name, address, role},
 * "message" {text}, "disconnected".
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
    private BluetoothSocket socket;
    private OutputStream out;
    private BroadcastReceiver finder;

    @Override
    public void load() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
    }

    private String alias() { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "nearby" : "location"; }

    private boolean allowed() { return getPermissionState(alias()) == PermissionState.GRANTED; }

    /** Is there Bluetooth, is it on, may the app use it. */
    @PluginMethod
    public void state(PluginCall call) {
        JSObject r = new JSObject();
        r.put("supported", adapter != null);
        r.put("on", adapter != null && adapter.isEnabled());
        r.put("allowed", allowed());
        r.put("connected", socket != null && socket.isConnected());
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

    /** Asks the system to switch Bluetooth on. */
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

    /** Asks the system to make this phone findable for a while, so the other phone's search sees it. */
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
                    if (d != null) notifyListeners("found", describe(d));
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

    /** Hosts a game: waits for the other phone (a "connected" event when it comes). Resolves once listening. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void host(PluginCall call) {
        if (adapter == null || !allowed()) { call.reject("permission"); return; }
        closeAll();
        try {
            server = adapter.listenUsingInsecureRfcommWithServiceRecord("Lexling", SERVICE);
        } catch (IOException e) { call.reject("cannot host: " + e.getMessage()); return; }
        final BluetoothServerSocket listening = server;
        new Thread(() -> {
            try {
                BluetoothSocket s = listening.accept();          // one other phone: then no more listening
                closeQuietly(listening);
                if (server == listening) server = null;
                opened(s, "host");
            } catch (IOException e) { /* closed while waiting (the game left): nothing to say */ }
        }, "lexling-bt-host").start();
        call.resolve();
    }

    /** Joins the phone at `address`, which hosts. Resolves when connected. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void join(PluginCall call) {
        String address = call.getString("address");
        if (adapter == null || !allowed()) { call.reject("permission"); return; }
        if (address == null || !BluetoothAdapter.checkBluetoothAddress(address)) { call.reject("no such phone"); return; }
        closeAll();
        new Thread(() -> {
            adapter.cancelDiscovery();                           // a running search slows a connection right down
            try {
                BluetoothSocket s = adapter.getRemoteDevice(address).createInsecureRfcommSocketToServiceRecord(SERVICE);
                s.connect();
                opened(s, "guest");
                call.resolve();
            } catch (IOException e) { call.reject("cannot connect: " + e.getMessage()); }
        }, "lexling-bt-join").start();
    }

    /** One message to the other phone. */
    @PluginMethod
    public void send(PluginCall call) {
        String text = call.getString("text", "");
        OutputStream o = out;
        if (o == null) { call.reject("not connected"); return; }
        try {
            synchronized (this) { o.write((text.replace("\n", " ") + "\n").getBytes(StandardCharsets.UTF_8)); o.flush(); }
            call.resolve();
        } catch (IOException e) { call.reject("send failed"); dropped(); }
    }

    /** Closes the connection (and stops listening). */
    @PluginMethod
    public void close(PluginCall call) {
        closeAll();
        call.resolve();
    }

    // a connection made: remember it, tell the page, read its lines until it breaks
    @SuppressLint("MissingPermission")
    private void opened(BluetoothSocket s, String role) {
        socket = s;
        try { out = s.getOutputStream(); } catch (IOException e) { dropped(); return; }
        JSObject who = describe(s.getRemoteDevice());
        who.put("role", role);
        notifyListeners("connected", who);
        new Thread(() -> {
            try (BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = in.readLine()) != null) {
                    JSObject m = new JSObject();
                    m.put("text", line);
                    notifyListeners("message", m);
                }
            } catch (IOException e) { /* broken: below */ }
            if (socket == s) dropped();
        }, "lexling-bt-read").start();
    }

    private void dropped() {
        closeQuietly(socket);
        socket = null;
        out = null;
        notifyListeners("disconnected", new JSObject());
    }

    private void closeAll() {
        closeQuietly(server);
        server = null;
        BluetoothSocket s = socket;
        socket = null;
        out = null;
        closeQuietly(s);
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

    private static void closeQuietly(java.io.Closeable c) {
        if (c == null) return;
        try { c.close(); } catch (IOException e) { /* closing anyway */ }
    }

    @Override
    protected void handleOnDestroy() {
        stopFinder();
        closeAll();
    }
}
