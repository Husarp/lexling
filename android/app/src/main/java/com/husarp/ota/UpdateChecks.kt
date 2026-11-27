package com.husarp.ota

import android.content.Context
import android.net.ConnectivityManager
import com.getcapacitor.JSObject
import com.husarp.lexling.R
import com.husarp.ota.core.*
import java.text.DateFormat
import java.util.Date
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class UpdateChecks(context: Context, private val log: EventLog, private val changed: () -> Unit) {
    private val prefs = context.getSharedPreferences("ota-checks", Context.MODE_PRIVATE)
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)
    private val manualNotices = CheckNoticeGate()
    private val automaticNotices = CheckNoticeGate()
    private var automaticNoticeClaimed = false

    private fun connected() = connectivity.activeNetwork != null

    fun <Manifest> fetch(channel: CheckChannel, url: String, transport: Transport,
                         manual: Boolean = false, reportFailure: Boolean = true,
                         verify: (DownloadedManifest) -> Manifest): Pair<DownloadedManifest, Manifest>? {
        // The signed release channels can be unpublished.
        val (source, manifest) = checked(channel, manual, reportFailure,
            { fetchManifest(url, transport, log, allowMissing = true) }) { it?.let(verify) }
        return if (source != null && manifest != null) source to manifest else null
    }

    private fun <Source, Manifest> checked(channel: CheckChannel, manual: Boolean, reportFailure: Boolean,
        fetch: () -> Source, verify: (Source) -> Manifest): Pair<Source, Manifest> {
        prefs.edit().putLong("$channel.attempt", System.currentTimeMillis()).apply()
        val result = try {
            verifyUpdateCheck(::connected, fetch, verify)
        } catch (error: CheckException) {
            failure(channel, error, manual, reportFailure)
            throw error
        }
        success(channel)
        return result
    }

    @Synchronized private fun failure(channel: CheckChannel, error: CheckException, manual: Boolean, reportFailure: Boolean) {
        prefs.edit().putString("$channel.error", error.failure.name).apply()
        if (reportFailure) {
            if (manual) {
                automaticNotices.succeeded(channel)
                manualNotices.failed(channel, error.failure, manual = true)
            } else if (!automaticNoticeClaimed && error.failure != CheckFailure.OFFLINE) {
                // Lexling is played offline a lot: a background check without internet is normal, not news.
                // Settings → Updates still shows it; blocked servers and invalid updates get one notice.
                automaticNotices.failed(channel, error.failure, manual = true)
            }
        }
        log.add("$channel: ${error.failure.message}${error.cause?.message?.let { ": $it" }.orEmpty()}")
        changed()
    }

    @Synchronized private fun success(channel: CheckChannel) {
        prefs.edit().putLong("$channel.success", System.currentTimeMillis()).remove("$channel.error").apply()
        manualNotices.succeeded(channel)
        automaticNotices.succeeded(channel)
        changed()
    }

    @Synchronized fun claim(): CheckNotice? {
        manualNotices.claim()?.let { return it }
        return automaticNotices.claim()?.also { automaticNoticeClaimed = true }
    }
    fun hasError() = CheckChannel.entries.any { error(it) != null }

    private fun error(channel: CheckChannel) = prefs.getString("$channel.error", null)?.let { name ->
        CheckFailure.entries.find { it.name == name }
    }

    fun displayStatus(strings: Context): String {
        if (hasError()) return strings.getString(R.string.ota_check_failed)
        val last = CheckChannel.entries.maxOf { prefs.getLong("$it.success", 0) }
        if (last == 0L) return ""
        val time = Instant.ofEpochMilli(last).atZone(ZoneId.systemDefault())
        val locale = strings.resources.configuration.locales[0]
        return if (time.toLocalDate() == LocalDate.now())
            strings.getString(R.string.ota_last_checked_today, time.format(DateTimeFormatter.ofPattern("HH:mm", locale)))
        else strings.getString(R.string.ota_last_checked,
            time.format(DateTimeFormatter.ofPattern("d MMM yyyy HH:mm", locale)))
    }

    fun summary(): String = (error(CheckChannel.WEB) ?: error(CheckChannel.SHELL))?.message ?: run {
        val last = CheckChannel.entries.maxOf { prefs.getLong("$it.success", 0) }
        if (last == 0L) "Last checked: never" else "Last checked: ${DateFormat.getDateTimeInstance().format(Date(last))}"
    }

    @Synchronized fun snapshot() = JSObject().apply {
        for (channel in CheckChannel.entries) {
            val failure = error(channel)
            put(channel.name.lowercase(), JSObject()
                .put("lastAttemptAt", prefs.getLong("$channel.attempt", prefs.getLong("$channel.success", 0)))
                .put("lastSuccessAt", prefs.getLong("$channel.success", 0))
                .put("error", failure?.message)
                .put("code", failure?.name))
        }
        put("summary", summary())
        put("failed", hasError())
        put("noticePending", manualNotices.hasPending() || automaticNotices.hasPending())
    }
}

internal fun Context.checkFailureText(failure: CheckFailure) = getString(when (failure) {
    CheckFailure.OFFLINE -> R.string.ota_check_offline
    CheckFailure.UNREACHABLE -> R.string.ota_check_unreachable
    CheckFailure.TIMEOUT -> R.string.ota_check_timeout
    CheckFailure.TLS -> R.string.ota_check_tls
    CheckFailure.NOT_FOUND -> R.string.ota_check_not_found
    CheckFailure.DENIED -> R.string.ota_check_denied
    CheckFailure.RATE_LIMITED -> R.string.ota_check_rate_limited
    CheckFailure.SERVER -> R.string.ota_check_server
    CheckFailure.MANIFEST -> R.string.ota_check_invalid
})
