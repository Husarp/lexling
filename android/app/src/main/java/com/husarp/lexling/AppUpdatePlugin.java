package com.husarp.lexling;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * A new version, downloaded and handed to Android's installer by Lexling itself (APP-STANDARDS.md; owner, 2026-09-27 -
 * the same as Reckless Driving 3.35.0's AppUpdatePlugin). 0.57.0 used Android's download service and the phone's
 * Downloads instead: it still needed "install unknown apps" (for the Files / Downloads app), took more taps, and on a
 * phone behind a firewall the download never started. This needs "allow Lexling to install unknown apps" once.
 *
 * Android still shows its own "Update?" confirmation - a sideloaded app never replaces itself silently - and only an
 * APK signed with the same key installs over this one. The file goes to Lexling's own cache (no storage permission)
 * and is shared through the FileProvider Capacitor declares; a file:// URI would throw on Android 7 and later.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    // one download at a time; written by the download thread, read by progress()
    private volatile String dlStatus = "idle";   // idle / running / done / failed
    private volatile long dlDone = 0, dlTotal = -1;
    private volatile String dlError = null;
    private volatile File apk = null;

    /** A link in the phone's browser - window.open does nothing inside the app (Reckless Driving found). */
    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("no link"); return; }
        try {
            Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(view);
            call.resolve();
        } catch (Exception e) { call.reject("cannot open: " + e.getMessage()); }
    }

    /** Starts downloading `url` into the cache as `name` (Lexling-X.Y.Z.apk). Resolves at once; progress() tells how it goes. */
    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url"), name = call.getString("name", "Lexling.apk");
        if (url == null || url.isEmpty() || name.contains("/")) { call.reject("no download"); return; }
        if (!"running".equals(dlStatus)) {
            dlStatus = "running";
            dlDone = 0;
            dlTotal = -1;
            dlError = null;
            File file = new File(getContext().getCacheDir(), name);
            apk = file;
            new Thread(() -> {
                HttpURLConnection conn = null;
                try {
                    if (file.exists() && !file.delete()) throw new Exception("cannot clear the previous download");
                    conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setInstanceFollowRedirects(true);   // GitHub sends release files on to its file servers
                    conn.setConnectTimeout(30000);
                    conn.setReadTimeout(60000);
                    conn.connect();
                    int status = conn.getResponseCode();
                    if (status / 100 != 2) throw new Exception("HTTP " + status);
                    dlTotal = conn.getContentLength();
                    try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(file)) {
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = in.read(buffer)) > 0) {
                            out.write(buffer, 0, read);
                            dlDone += read;
                        }
                    }
                    // a cut-off file would fail to install with a baffling parser error
                    if (file.length() < 100000) throw new Exception("the download looks incomplete (" + file.length() + " bytes)");
                    dlStatus = "done";
                } catch (Exception e) {
                    dlError = e.getMessage() != null ? e.getMessage() : e.toString();
                    dlStatus = "failed";
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }).start();
        }
        call.resolve();
    }

    /** How the download is doing: status running / done / failed, and its bytes so far out of the whole. */
    @PluginMethod
    public void progress(PluginCall call) {
        JSObject o = new JSObject();
        o.put("status", dlStatus);
        o.put("done", dlDone);
        o.put("total", dlTotal);
        if (dlError != null) o.put("error", dlError);
        call.resolve(o);
    }

    /**
     * The downloaded file to Android's installer. Without "install unknown apps" it rejects with NEEDS_PERMISSION -
     * and with `openSettings` (the default) first opens the one settings screen that grants it. Lexling calls it again,
     * with openSettings false, when the person comes back from there.
     */
    @PluginMethod
    public void install(PluginCall call) {
        File file = apk;
        if (file == null || !file.exists()) { call.reject("the download is gone - download it again"); return; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            if (call.getBoolean("openSettings", true)) {
                Intent allow = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                allow.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(allow);
            }
            call.reject("NEEDS_PERMISSION");
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(install);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : e.toString());
        }
    }

    /**
     * The downloaded file gone - the new version runs, so the file that brought it is not needed. A numeric `id` is a
     * download from 0.57.x, through Android's download service: cancelled too, with its file in Downloads (on a phone
     * where it never started it would otherwise sit in the queue for good).
     */
    @PluginMethod
    public void remove(PluginCall call) {
        try {
            DownloadManager m = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (m != null) m.remove(Long.parseLong(call.getString("id", "")));
        } catch (RuntimeException e) { /* not a download-service id, or gone already */ }
        File[] cached = getContext().getCacheDir().listFiles((dir, n) -> n.endsWith(".apk"));
        if (cached != null) for (File f : cached) f.delete();
        call.resolve();
    }
}
