package com.husarp.ota

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.husarp.ota.core.shellUpdatedNoticeRequested
import com.husarp.ota.core.UpdateNotificationGate
import com.husarp.lexling.BuildConfig
import com.husarp.lexling.R

object ShellUpdatedNotification {
    private val gate = UpdateNotificationGate()
    private val ids = listOf(701, 702, 703)

    fun enterForeground(context: Context) = gate.enter {
        cancel(context)
    }

    fun leaveForeground() = gate.leave()

    fun cancel(context: Context) = synchronized(gate) {
        val manager = context.getSystemService(NotificationManager::class.java)
        ids.forEach { manager.cancel(it) }
    }

    fun enabled(context: Context) = context.getSharedPreferences("ota-settings", Context.MODE_PRIVATE)
        .getBoolean("updateNotifications", true)

    fun postIfRequested(context: Context) {
        val prefs=context.getSharedPreferences("shell-install",Context.MODE_PRIVATE)
        val target=prefs.getInt("notifyTarget",-1)
        // Consume independently of installer callbacks/session cleanup; never repeat on a later replacement.
        if (!prefs.edit().remove("notifyTarget").commit()) return
        if (!shellUpdatedNoticeRequested(target,BuildConfig.VERSION_CODE)) return
        val strings = NativeStrings.context(context)
        post(strings, 701, strings.getString(R.string.ota_notification_installed),
            strings.getString(R.string.ota_notification_installed_text, strings.getString(R.string.app_name), BuildConfig.VERSION_NAME))
    }

    fun postWorkerOffers(context: Context, updater: Updater) {
        val state = updater.info()
        val strings = NativeStrings.context(context)
        val prefs = context.getSharedPreferences("worker-update-notices", Context.MODE_PRIVATE)
        listOf(Triple(702, "staged", "available"), Triple(703, "shellReady", "shellAvailable")).forEach { (id, readyKey, offerKey) ->
            val ready = state.optJSONObject(readyKey)
            val offer = ready ?: state.optJSONObject(offerKey)
            val version = offer?.optString("version")?.takeIf { it.isNotBlank() } ?: return@forEach
            val key = "$id:$version:${ready != null}"
            val title = if (id == 703) {
                if (ready != null) R.string.ota_app_update_ready else R.string.ota_app_update_available
            } else {
                if (ready != null) R.string.ota_update_ready else R.string.ota_update_available
            }
            post(strings, id, strings.getString(title),
                strings.getString(R.string.ota_notification_open_version, strings.getString(R.string.app_name), version), prefs = prefs, key = key)
        }
    }

    private fun post(context: Context, id: Int, title: String, text: String,
        prefs: android.content.SharedPreferences? = null, key: String? = null) = gate.postInBackground {
        if (!enabled(context) || (key != null && prefs?.getString(id.toString(), null) == key)) return@postInBackground
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return@postInBackground
        val manager=context.getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) return@postInBackground
        val channel = "app-updates"
        val name = context.getString(R.string.ota_notification_channel, context.getString(R.string.app_name))
        manager.createNotificationChannel(NotificationChannel(channel, name, NotificationManager.IMPORTANCE_DEFAULT))
        val open=PendingIntent.getActivity(context,0,Intent(context,MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notice=Notification.Builder(context,channel)
            .setSmallIcon(R.drawable.ic_stat_update)
            .setColor(NativeLook.accent)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open).setAutoCancel(true).build()
        // Permission can be revoked between the check and notify.
        try {
            manager.notify(id,notice)
            if (key != null) prefs?.edit()?.putString(id.toString(), key)?.apply()
        } catch (_: SecurityException) { }
    }
}
