package com.husarp.lexling;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * A new version, downloaded by Android's own download service (owner, 2026-09-27): the progress in the notification
 * bar, the file in Downloads. Lexling never installs it - the person opens the file (the finished download's
 * notification, or the Downloads list this opens) and the phone's own installer does it. So Lexling needs no permission
 * to install apps; if Android asks at all, it asks once about the Files / Downloads app.
 */
@CapacitorPlugin(name = "UpdateDownload")
public class UpdateDownloadPlugin extends Plugin {

    private DownloadManager manager() { return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE); }

    /** Starts downloading `url` as `name` into Downloads. Resolves with the download's id. */
    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url"), name = call.getString("name", "Lexling.apk");
        DownloadManager m = manager();
        if (url == null || m == null) { call.reject("no download"); return; }
        try {
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url))
                .setTitle(call.getString("title", name))
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            // Downloads, where the person finds it (Android 10 on needs no permission for that; older ones keep it in
            // the download service's own place, still openable from its notification)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            JSObject o = new JSObject();
            o.put("id", String.valueOf(m.enqueue(r)));
            call.resolve(o);
        } catch (RuntimeException e) { call.reject("cannot download: " + e.getMessage()); }
    }

    /** How the download `id` is doing: status running / done / failed, and its bytes so far out of the whole. */
    @PluginMethod
    public void progress(PluginCall call) {
        DownloadManager m = manager();
        long id;
        try { id = Long.parseLong(call.getString("id", "")); } catch (NumberFormatException e) { call.reject("no such download"); return; }
        JSObject o = new JSObject();
        try (Cursor c = m == null ? null : m.query(new DownloadManager.Query().setFilterById(id))) {
            if (c == null || !c.moveToFirst()) { o.put("status", "failed"); call.resolve(o); return; }
            int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            o.put("status", status == DownloadManager.STATUS_SUCCESSFUL ? "done" : status == DownloadManager.STATUS_FAILED ? "failed" : "running");
            o.put("done", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
            o.put("total", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
            call.resolve(o);
        }
    }

    /** The download `id` and its file gone (the new version runs: the file that brought it is not needed any more). */
    @PluginMethod
    public void remove(PluginCall call) {
        DownloadManager m = manager();
        try { if (m != null) m.remove(Long.parseLong(call.getString("id", ""))); } catch (RuntimeException e) { /* gone already */ }
        call.resolve();
    }

    /** The phone's list of downloads - where the person taps the file to install it. */
    @PluginMethod
    public void openDownloads(PluginCall call) {
        Intent list = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
        list.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(list);
        call.resolve();
    }
}
