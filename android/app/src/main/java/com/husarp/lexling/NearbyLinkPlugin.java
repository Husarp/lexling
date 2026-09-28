package com.husarp.lexling;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Status;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionOptions;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionType;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Tiles on several phones through Google's Nearby Connections (owner, 2026-09-28: "make it work with as many devices as
 * possible - research how other apps do it"). What most offline multiplayer apps on Android use: Google Play services
 * finds the other phones and connects them over Bluetooth, Bluetooth LE or the Wi-Fi they share - whichever works
 * between those two phones - with no pairing and no findable-for-a-while. Here it never changes the phone's Wi-Fi (a
 * "non-disruptive" connection: the moves are small), and one phone hosts the others (a star, as over Bluetooth).
 *
 * The same calls and events as BluetoothLinkPlugin, so the page treats it as one more connection. A phone's address is
 * a key of its own, kept on the phone (Nearby's own ids change every time), so a joining phone finds its host again.
 */
@CapacitorPlugin(
    name = "NearbyLink",
    permissions = {
        // Android 13 and later: nearby devices, and nearby Wi-Fi devices
        @Permission(alias = "nearby33", strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.NEARBY_WIFI_DEVICES }),
        // Android 12: nearby devices, and the location permission for the Wi-Fi part
        @Permission(alias = "nearby31", strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.ACCESS_FINE_LOCATION }),
        // up to Android 11: the location permission (up to Android 9 Nearby asks for the coarse one)
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION })
    }
)
public class NearbyLinkPlugin extends Plugin {

    private static final String SERVICE_ID = "com.husarp.lexling.tiles";
    private static final int CHUNK = ConnectionsClient.MAX_BYTES_DATA_SIZE - 1;

    private BluetoothAdapter adapter;
    private String key;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean discovering, searching;
    private final Runnable tick = this::tick;

    /** Phones found hosting: key → { Nearby's endpoint id, name }. */
    private final Map<String, String[]> endpoints = new ConcurrentHashMap<>();
    /** Joins waiting for their host to be found: key → the call. */
    private final Map<String, PluginCall> wanted = new ConcurrentHashMap<>();
    /** Connections coming up: endpoint → { key, name, role }, and the join waiting on it. */
    private final Map<String, String[]> pending = new ConcurrentHashMap<>();
    private final Map<String, PluginCall> joining = new ConcurrentHashMap<>();
    /** Open connections: our id ↔ Nearby's endpoint id, and a message arriving in parts. */
    private final Map<String, String> endpointOf = new ConcurrentHashMap<>();
    private final Map<String, String> idOf = new ConcurrentHashMap<>();
    private final Map<String, ByteArrayOutputStream> partial = new ConcurrentHashMap<>();
    private final AtomicInteger next = new AtomicInteger(1);

    @Override
    public void load() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
        SharedPreferences prefs = getContext().getSharedPreferences("lexling-nearby", Context.MODE_PRIVATE);
        key = prefs.getString("key", null);
        if (key == null) {
            String abc = "abcdefghijkmnpqrstuvwxyz23456789";
            SecureRandom rnd = new SecureRandom();
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < 8; i++) b.append(abc.charAt(rnd.nextInt(abc.length())));
            key = b.toString();
            prefs.edit().putString("key", key).apply();
        }
    }

    private ConnectionsClient client() { return Nearby.getConnectionsClient(getContext()); }

    private static boolean supported(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false;   // the library wants Android 7
        try { return GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS; }
        catch (RuntimeException e) { return false; }
    }

    private String alias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "nearby33" : Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "nearby31" : "location";
    }

    private boolean allowed() { return getPermissionState(alias()) == PermissionState.GRANTED; }

    private String deviceName() {
        String name = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1
            ? Settings.Global.getString(getContext().getContentResolver(), Settings.Global.DEVICE_NAME) : null;
        return name == null || name.isEmpty() ? Build.MODEL : name;
    }

    // what the other phones see: this phone's key and its name
    private String endpointName() {
        String name = deviceName().replace('|', ' ');
        return key + "|" + (name.length() > 40 ? name.substring(0, 40) : name);
    }

    private static String[] parse(String endpointName) {
        String s = endpointName == null ? "" : endpointName;
        int bar = s.indexOf('|');
        return bar < 0 ? new String[] { s, s } : new String[] { s.substring(0, bar), s.substring(bar + 1) };
    }

    private static String why(Exception e) {
        if (e instanceof ApiException) return ConnectionsStatusCodes.getStatusCodeString(((ApiException) e).getStatusCode());
        return e.getMessage() == null ? e.toString() : e.getMessage();
    }

    private static int code(Exception e) { return e instanceof ApiException ? ((ApiException) e).getStatusCode() : -1; }

    /** Is Google Play services there, Bluetooth on, may the app use it - and this phone's name. */
    @PluginMethod
    public void state(PluginCall call) {
        JSObject r = new JSObject();
        r.put("supported", adapter != null && supported(getContext()));
        r.put("on", adapter != null && adapter.isEnabled());
        r.put("allowed", allowed());
        r.put("connected", !endpointOf.isEmpty());
        r.put("name", deviceName());
        r.put("locationOff", BluetoothLinkPlugin.locationOff(getContext(), Build.VERSION_CODES.R));
        call.resolve(r);
    }

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

    /** Asks the system to switch Bluetooth on - Nearby finds the other phones over it. */
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

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent settings = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(settings);
        call.resolve();
    }

    @PluginMethod
    public void openLocation(PluginCall call) {
        Intent settings = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(settings);
        call.resolve();
    }

    // ── finding the hosts ──

    private final EndpointDiscoveryCallback finder = new EndpointDiscoveryCallback() {
        @Override
        public void onEndpointFound(@NonNull String endpointId, @NonNull DiscoveredEndpointInfo info) {
            if (!SERVICE_ID.equals(info.getServiceId())) return;
            String[] who = parse(info.getEndpointName());
            endpoints.put(who[0], new String[] { endpointId, who[1] });
            found(who[0], who[1]);
            PluginCall call = wanted.remove(who[0]);
            if (call != null) request(who[0], endpointId, call);
        }

        @Override
        public void onEndpointLost(@NonNull String endpointId) { forget(endpointId); }
    };

    private void forget(String endpointId) {
        for (Map.Entry<String, String[]> e : endpoints.entrySet()) if (e.getValue()[0].equals(endpointId)) endpoints.remove(e.getKey());
    }

    private void found(String address, String name) {
        JSObject o = new JSObject();
        o.put("name", name);
        o.put("address", address);
        notifyListeners("found", o);
    }

    // Nearby's search goes on until stopped, telling each phone once: every few seconds the page hears the ones still
    // there again, and a "searchDone" - as a Bluetooth search's rounds
    private void tick() {
        if (!searching) return;
        for (Map.Entry<String, String[]> e : endpoints.entrySet()) found(e.getKey(), e.getValue()[1]);
        notifyListeners("searchDone", new JSObject());
        main.postDelayed(tick, 8000);
    }

    private interface Failed { void on(Exception e); }

    private void discover(Runnable ok, Failed failed) {
        if (discovering) { ok.run(); return; }
        DiscoveryOptions options = new DiscoveryOptions.Builder().setStrategy(Strategy.P2P_STAR).build();
        client().startDiscovery(SERVICE_ID, finder, options)
            .addOnSuccessListener(v -> { discovering = true; ok.run(); })
            .addOnFailureListener(e -> {
                if (code(e) == ConnectionsStatusCodes.STATUS_ALREADY_DISCOVERING) { discovering = true; ok.run(); }
                else failed.on(e);
            });
    }

    /** Looks for phones hosting a game: each a "found" {name, address}, and every few seconds a "searchDone". */
    @PluginMethod
    public void search(PluginCall call) {
        if (!allowed()) { call.reject("permission"); return; }
        discover(() -> {
            if (!searching) { searching = true; main.postDelayed(tick, 8000); }
            call.resolve();
        }, e -> call.reject(code(e) == ConnectionsStatusCodes.MISSING_SETTING_LOCATION_MUST_BE_ON ? "location" : "search failed: " + why(e)));
    }

    @PluginMethod
    public void stopSearch(PluginCall call) {
        stopDiscovery();
        call.resolve();
    }

    private void stopDiscovery() {
        searching = false;
        main.removeCallbacks(tick);
        if (!wanted.isEmpty()) return;   // a join still looking for its host
        discovering = false;
        client().stopDiscovery();
    }

    // ── hosting, joining ──

    private final PayloadCallback payloads = new PayloadCallback() {
        @Override
        public void onPayloadReceived(@NonNull String endpointId, @NonNull Payload payload) {
            byte[] b = payload.getType() == Payload.Type.BYTES ? payload.asBytes() : null;
            if (b == null || b.length == 0) return;
            ByteArrayOutputStream so = partial.get(endpointId);
            if (so == null) partial.put(endpointId, so = new ByteArrayOutputStream());
            so.write(b, 1, b.length - 1);
            if (b[0] != 'e') return;   // more to come
            partial.remove(endpointId);
            String id = idOf.get(endpointId);
            if (id == null) return;
            JSObject m = new JSObject();
            m.put("id", id);
            m.put("text", new String(so.toByteArray(), StandardCharsets.UTF_8));
            notifyListeners("message", m);
        }

        @Override
        public void onPayloadTransferUpdate(@NonNull String endpointId, @NonNull PayloadTransferUpdate update) { }
    };

    private final ConnectionLifecycleCallback lifecycle = new ConnectionLifecycleCallback() {
        @Override
        public void onConnectionInitiated(@NonNull String endpointId, @NonNull ConnectionInfo info) {
            String[] who = parse(info.getEndpointName());
            pending.put(endpointId, new String[] { who[0], who[1], info.isIncomingConnection() ? "host" : "guest" });
            // accepted here: Lexling asks the host itself ("let them join?") once the phone is in
            client().acceptConnection(endpointId, payloads).addOnFailureListener(e -> {
                pending.remove(endpointId);
                PluginCall call = joining.remove(endpointId);
                if (call != null) call.reject("cannot connect: " + why(e));
            });
        }

        @Override
        public void onConnectionResult(@NonNull String endpointId, @NonNull ConnectionResolution result) {
            String[] who = pending.remove(endpointId);
            PluginCall call = joining.remove(endpointId);
            Status status = result.getStatus();
            if (!status.isSuccess() || who == null) {
                if (call != null) call.reject("cannot connect: " + ConnectionsStatusCodes.getStatusCodeString(status.getStatusCode()));
                return;
            }
            String id = "n" + next.getAndIncrement();
            endpointOf.put(id, endpointId);
            idOf.put(endpointId, id);
            JSObject o = new JSObject();
            o.put("id", id);
            o.put("name", who[1]);
            o.put("address", who[0]);
            o.put("role", who[2]);
            notifyListeners("connected", o);
            if (call != null) {
                JSObject r = new JSObject();
                r.put("id", id);
                r.put("name", who[1]);
                call.resolve(r);
                stopDiscovery();   // a search going on slows the connection down
            }
        }

        @Override
        public void onDisconnected(@NonNull String endpointId) {
            partial.remove(endpointId);
            String id = idOf.remove(endpointId);
            if (id == null) return;   // closed from this end
            endpointOf.remove(id);
            JSObject d = new JSObject();
            d.put("id", id);
            notifyListeners("disconnected", d);
        }
    };

    /** Hosts a game: the phones searching see this one; each that joins is a "connected". */
    @PluginMethod
    public void host(PluginCall call) {
        if (!allowed()) { call.reject("permission"); return; }
        AdvertisingOptions options = new AdvertisingOptions.Builder().setStrategy(Strategy.P2P_STAR)
            .setConnectionType(ConnectionType.NON_DISRUPTIVE).build();
        client().startAdvertising(endpointName(), SERVICE_ID, lifecycle, options)
            .addOnSuccessListener(v -> call.resolve())
            .addOnFailureListener(e -> {
                if (code(e) == ConnectionsStatusCodes.STATUS_ALREADY_ADVERTISING) call.resolve();
                else call.reject("cannot host: " + why(e));
            });
    }

    @PluginMethod
    public void stopHosting(PluginCall call) {
        client().stopAdvertising();
        call.resolve();
    }

    /** Joins the phone `address` (its key). Found already: connects; else looks for it first, up to 20 seconds. */
    @PluginMethod
    public void join(PluginCall call) {
        String address = call.getString("address", "");
        if (!allowed()) { call.reject("permission"); return; }
        String[] e = endpoints.get(address);
        if (e != null) request(address, e[0], call);
        else look(address, call);
    }

    // the host not found (yet): looked for, up to 20 seconds
    private void look(String address, PluginCall call) {
        wanted.put(address, call);
        discover(() -> main.postDelayed(() -> {
            if (wanted.remove(address, call)) { call.reject("cannot connect: not found"); if (!searching) stopDiscovery(); }
        }, 20000), x -> { wanted.remove(address); call.reject("cannot connect: " + why(x)); });
    }

    private void request(String address, String endpointId, PluginCall call) {
        joining.put(endpointId, call);
        ConnectionOptions options = new ConnectionOptions.Builder().setConnectionType(ConnectionType.NON_DISRUPTIVE).build();
        client().requestConnection(endpointName(), endpointId, lifecycle, options).addOnFailureListener(x -> {
            if (joining.remove(endpointId) == null) return;
            // an id from an earlier search, gone meanwhile (the host started again): looked for afresh
            if (code(x) == ConnectionsStatusCodes.STATUS_ENDPOINT_UNKNOWN) { forget(endpointId); look(address, call); }
            else call.reject("cannot connect: " + why(x));
        });
    }

    /** One message: to the connection `id`, or to every one - in parts where it is longer than Nearby takes at once. */
    @PluginMethod
    public void send(PluginCall call) {
        String id = call.getString("id"), text = call.getString("text", "");
        List<String> to = new ArrayList<>();
        if (id == null) to.addAll(endpointOf.values());
        else if (endpointOf.containsKey(id)) to.add(endpointOf.get(id));
        else { call.reject("not connected"); return; }
        byte[] all = text.getBytes(StandardCharsets.UTF_8);
        for (int at = 0; at < all.length || at == 0; at += CHUNK) {
            int end = Math.min(all.length, at + CHUNK);
            byte[] part = new byte[end - at + 1];
            part[0] = (byte) (end == all.length ? 'e' : 'm');
            System.arraycopy(all, at, part, 1, end - at);
            for (String endpoint : to) client().sendPayload(endpoint, Payload.fromBytes(part));
            if (end == all.length) break;
        }
        call.resolve();
    }

    /** Closes the connection `id` - or, without one, every connection, the hosting and the search. */
    @PluginMethod
    public void close(PluginCall call) {
        String id = call.getString("id");
        if (id != null) {
            String endpoint = endpointOf.remove(id);
            if (endpoint != null) { idOf.remove(endpoint); partial.remove(endpoint); client().disconnectFromEndpoint(endpoint); }
        } else closeAll();
        call.resolve();
    }

    private void closeAll() {
        idOf.clear();   // closed from this end: no "disconnected"
        endpointOf.clear();
        partial.clear();
        wanted.clear();
        searching = discovering = false;
        main.removeCallbacks(tick);
        ConnectionsClient c = client();
        c.stopAllEndpoints();
        c.stopAdvertising();
        c.stopDiscovery();
    }

    @Override
    protected void handleOnDestroy() {
        if (supported(getContext())) closeAll();
    }
}
