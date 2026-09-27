package com.husarp.lexling;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayDeque;

/**
 * Tiles on several phones over Wi-Fi (owner, 2026-09-27): the phones on the same network. The phone that starts the game
 * hosts - it listens on a port and announces the game on the network (Android's network service discovery, "mDNS");
 * a joining phone searches for such games and connects straight to the one it picks. The connections themselves are
 * Links, as over Bluetooth. No permission to ask for: the network ones are granted with the app.
 *
 * Events to the page: "found" {name, address: "ip:port"} while searching, "searchDone", and from Links "connected",
 * "message", "disconnected".
 */
@CapacitorPlugin(name = "LanLink")
public class LanLinkPlugin extends Plugin {

    private static final String TYPE = "_lexling._tcp.";
    private static final long SEARCH_MS = 8000;

    private NsdManager nsd;
    private ServerSocket server;
    private NsdManager.RegistrationListener announced;
    private NsdManager.DiscoveryListener searching;
    private WifiManager.MulticastLock multicast;
    private final ArrayDeque<NsdServiceInfo> toResolve = new ArrayDeque<>();
    private boolean resolving = false;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Links links = new Links(this::notifyListeners);

    @Override
    public void load() {
        nsd = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
    }

    /** Is there a network, and this phone's name (the one set in Android's "About phone"). */
    @PluginMethod
    public void state(PluginCall call) {
        JSObject r = new JSObject();
        r.put("supported", nsd != null);
        r.put("on", onLocalNetwork());
        r.put("allowed", true);
        r.put("connected", links.count() > 0);
        r.put("name", deviceName());
        call.resolve(r);
    }

    private boolean onLocalNetwork() {
        ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        Network n = cm.getActiveNetwork();
        NetworkCapabilities c = n == null ? null : cm.getNetworkCapabilities(n);
        return c != null && (c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || c.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
    }

    private String deviceName() {
        String name = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1
            ? Settings.Global.getString(getContext().getContentResolver(), Settings.Global.DEVICE_NAME) : null;
        return name == null || name.isEmpty() ? Build.MODEL : name;
    }

    /** Hosts a game under `name`: listens, announces it, takes every phone that joins until stopHosting. */
    @PluginMethod
    public void host(PluginCall call) {
        if (server != null) { call.resolve(); return; }
        final ServerSocket listening;
        try { listening = new ServerSocket(0); } catch (IOException e) { call.reject("cannot host: " + e.getMessage()); return; }
        server = listening;
        new Thread(() -> {
            while (server == listening) {
                try {
                    Socket s = listening.accept();
                    s.setTcpNoDelay(true);
                    String ip = s.getInetAddress().getHostAddress();
                    links.add(s, s.getInputStream(), s.getOutputStream(), ip, ip, "host");
                } catch (IOException e) { break; }   // stopped hosting
            }
        }, "lexling-lan-host").start();
        NsdServiceInfo info = new NsdServiceInfo();
        String name = call.getString("name", "Lexling");
        info.setServiceName(name.length() > 60 ? name.substring(0, 60) : name);
        info.setServiceType(TYPE);
        info.setPort(listening.getLocalPort());
        announced = new NsdManager.RegistrationListener() {
            @Override public void onServiceRegistered(NsdServiceInfo i) { }
            @Override public void onRegistrationFailed(NsdServiceInfo i, int error) { }
            @Override public void onServiceUnregistered(NsdServiceInfo i) { }
            @Override public void onUnregistrationFailed(NsdServiceInfo i, int error) { }
        };
        try { nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, announced); } catch (RuntimeException e) { announced = null; }
        call.resolve();
    }

    /** No more phones taken, the game no longer announced (the phones in stay). */
    @PluginMethod
    public void stopHosting(PluginCall call) {
        stopServer();
        call.resolve();
    }

    /** Looks for games on the network for a few seconds: each one a "found", the end a "searchDone". */
    @PluginMethod
    public void search(PluginCall call) {
        stopDiscovery();
        WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifi != null) { multicast = wifi.createMulticastLock("lexling"); multicast.setReferenceCounted(false); multicast.acquire(); }
        searching = new NsdManager.DiscoveryListener() {
            @Override public void onDiscoveryStarted(String type) { }
            @Override public void onDiscoveryStopped(String type) { }
            @Override public void onStartDiscoveryFailed(String type, int error) { main.post(() -> finishSearch()); }
            @Override public void onStopDiscoveryFailed(String type, int error) { }
            @Override public void onServiceFound(NsdServiceInfo info) { main.post(() -> { toResolve.add(info); resolveNext(); }); }
            @Override public void onServiceLost(NsdServiceInfo info) { }
        };
        try { nsd.discoverServices(TYPE, NsdManager.PROTOCOL_DNS_SD, searching); }
        catch (RuntimeException e) { searching = null; call.reject("search failed"); return; }
        main.postDelayed(this::finishSearch, SEARCH_MS);
        call.resolve();
    }

    // one at a time: older Android refuses a second resolve while one runs
    private void resolveNext() {
        if (resolving || toResolve.isEmpty() || searching == null) return;
        resolving = true;
        nsd.resolveService(toResolve.poll(), new NsdManager.ResolveListener() {
            @Override public void onResolveFailed(NsdServiceInfo info, int error) { main.post(() -> { resolving = false; resolveNext(); }); }
            @Override public void onServiceResolved(NsdServiceInfo info) {
                JSObject found = new JSObject();
                found.put("name", info.getServiceName());
                found.put("address", info.getHost().getHostAddress() + ":" + info.getPort());
                notifyListeners("found", found);
                main.post(() -> { resolving = false; resolveNext(); });
            }
        });
    }

    private void finishSearch() {
        if (searching == null) return;
        stopDiscovery();
        notifyListeners("searchDone", new JSObject());
    }

    @PluginMethod
    public void stopSearch(PluginCall call) {
        main.post(this::stopDiscovery);
        call.resolve();
    }

    /** Joins the game at "ip:port". Resolves with the connection's id once connected. */
    @PluginMethod
    public void join(PluginCall call) {
        String address = call.getString("address", "");
        int colon = address.lastIndexOf(':');
        if (colon < 0) { call.reject("no such game"); return; }
        String ip = address.substring(0, colon);
        int port;
        try { port = Integer.parseInt(address.substring(colon + 1)); } catch (NumberFormatException e) { call.reject("no such game"); return; }
        new Thread(() -> {
            try {
                Socket s = new Socket();
                s.connect(new InetSocketAddress(ip, port), 6000);
                s.setTcpNoDelay(true);
                JSObject r = new JSObject();
                r.put("id", links.add(s, s.getInputStream(), s.getOutputStream(), ip, address, "guest"));
                call.resolve(r);
            } catch (IOException e) { call.reject("cannot connect: " + e.getMessage()); }
        }, "lexling-lan-join").start();
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
        if (announced != null) { try { nsd.unregisterService(announced); } catch (RuntimeException e) { /* gone */ } announced = null; }
        ServerSocket s = server;
        server = null;
        if (s != null) try { s.close(); } catch (IOException e) { /* closing anyway */ }
    }

    private void stopDiscovery() {
        main.removeCallbacksAndMessages(null);
        toResolve.clear();
        resolving = false;
        if (searching != null) { try { nsd.stopServiceDiscovery(searching); } catch (RuntimeException e) { /* not running */ } searching = null; }
        if (multicast != null) { multicast.release(); multicast = null; }
    }

    @Override
    protected void handleOnDestroy() {
        stopDiscovery();
        links.closeAll();
        stopServer();
    }
}
