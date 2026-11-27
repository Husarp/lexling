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
            strings.getString(R.string.ota_notification_installed_text, BuildConfig.VERSION_NAME))
    }

    fun postWorkerOffers(context: Context, updater: Updater) {
        val state = updater.info()
        val strings = NativeStrings.context(context)
        val prefs = context.getSharedPreferences("worker-update-notices", Context.MODE_PRIVATE)
        val paired = state.optJSONObject("combined")
        val shellReady = state.optJSONObject("shellReady")
        val shellOffer = shellReady ?: state.optJSONObject("shellAvailable")
        val webReady = state.optJSONObject("staged")
        val webOffer = webReady ?: state.optJSONObject("available")?.takeUnless { it.optBoolean("needsShell") }
        val id = if (paired != null || shellOffer != null) 703 else 702
        val offer = paired ?: shellOffer ?: webOffer
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(if (id == 703) 702 else 703)
        val version = offer?.optString("version") ?: return
        val ready = when {
            paired != null -> paired.optString("phase") == "ready"
            shellOffer != null -> shellReady != null
            else -> webReady != null
        }
        if (paired != null && paired.optString("phase") !in listOf("ready", "available")) return
        val title = when {
            paired != null -> if (ready) R.string.ota_combined_update_ready else R.string.ota_combined_update_available
            shellOffer != null -> if (ready) R.string.ota_app_update_ready else R.string.ota_app_update_available
            else -> if (ready) R.string.ota_update_ready else R.string.ota_update_available
        }
        val versions = when {
            paired != null -> strings.getString(R.string.ota_combined_versions, version, paired.optString("webVersion"))
            shellOffer != null -> strings.getString(R.string.ota_android_version, version)
            else -> strings.getString(R.string.ota_lexling_version, version)
        }
        post(strings, id, strings.getString(title), strings.getString(R.string.ota_notification_open_version, versions),
            prefs = prefs, key = "$id:$versions:${offer.optLong("versionCode")}:$ready")

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
