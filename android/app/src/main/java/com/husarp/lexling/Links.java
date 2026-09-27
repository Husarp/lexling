package com.husarp.lexling;

import com.getcapacitor.JSObject;

import java.io.BufferedReader;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * The open connections of one kind - Bluetooth or Wi-Fi (owner, 2026-09-27: Tiles on several phones). The host holds
 * one per phone that joined; a joining phone holds one, to the host. Each gets an id; lines of text go both ways (JSON,
 * one message a line; app/js/session.js is what they say). The page hears "connected" {id, name, address, role},
 * "message" {id, text} and "disconnected" {id} - the last only when the other end went, not when this end closed it.
 */
final class Links {

    interface Events { void emit(String event, JSObject data); }

    private static final class Conn {
        final Closeable socket;
        final OutputStream out;
        Conn(Closeable socket, OutputStream out) { this.socket = socket; this.out = out; }
    }

    private final Map<String, Conn> conns = new ConcurrentHashMap<>();
    private final AtomicInteger next = new AtomicInteger(1);
    private final Events events;

    Links(Events events) { this.events = events; }

    /** A connection made, either way: kept, the page told, its lines read until it breaks. */
    String add(Closeable socket, InputStream in, OutputStream out, String name, String address, String role) {
        String id = "c" + next.getAndIncrement();
        conns.put(id, new Conn(socket, out));
        JSObject who = new JSObject();
        who.put("id", id);
        who.put("name", name == null ? "" : name);
        who.put("address", address == null ? "" : address);
        who.put("role", role);
        events.emit("connected", who);
        new Thread(() -> {
            try (BufferedReader lines = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line;
                while ((line = lines.readLine()) != null) {
                    JSObject m = new JSObject();
                    m.put("id", id);
                    m.put("text", line);
                    events.emit("message", m);
                }
            } catch (IOException e) { /* broken: below */ }
            gone(id);
        }, "lexling-link-read").start();
        return id;
    }

    /** One line to one connection; false when it is not there (any more). */
    boolean send(String id, String text) {
        Conn c = conns.get(id);
        if (c == null) return false;
        try {
            synchronized (c) {
                c.out.write((text.replace("\n", " ") + "\n").getBytes(StandardCharsets.UTF_8));
                c.out.flush();
            }
            return true;
        } catch (IOException e) {
            gone(id);
            return false;
        }
    }

    void sendAll(String text) { for (String id : new ArrayList<>(conns.keySet())) send(id, text); }

    /** Closed from this end: no "disconnected" for it. */
    void close(String id) {
        Conn c = conns.remove(id);
        if (c != null) closeQuietly(c.socket);
    }

    void closeAll() { for (String id : new ArrayList<>(conns.keySet())) close(id); }

    int count() { return conns.size(); }

    // the other end went (or the line broke): the page is told once
    private void gone(String id) {
        Conn c = conns.remove(id);
        if (c == null) return;
        closeQuietly(c.socket);
        JSObject d = new JSObject();
        d.put("id", id);
        events.emit("disconnected", d);
    }

    static void closeQuietly(Closeable c) {
        if (c == null) return;
        try { c.close(); } catch (IOException e) { /* closing anyway */ }
    }
}
