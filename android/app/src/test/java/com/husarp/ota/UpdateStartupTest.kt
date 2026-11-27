package com.husarp.ota

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.os.Looper
import com.husarp.lexling.R
import com.husarp.ota.core.BundleFile
import com.husarp.ota.core.Engine
import com.husarp.ota.core.EventLog
import com.husarp.ota.core.Manifest
import com.husarp.ota.core.ManifestVerifier
import com.husarp.ota.core.atomicWrite
import com.husarp.ota.core.json
import java.io.IOException
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class UpdateStartupTest {
    private val app: Context get() = RuntimeEnvironment.getApplication()
    @get:Rule val tmp = TemporaryFolder()

    @Test fun legacyPreferencesMapToSixHoursAndKeepOtherSettings() {
        val prefs = app.getSharedPreferences("ota-settings", Context.MODE_PRIVATE)
        for (frequency in listOf("open", "manual", "garbled")) {
            prefs.edit().putString("checkFrequency", frequency).putBoolean("automatic", false)
                .putBoolean("setupAnswered", true).putInt("mobileLimitMb", 0).apply()
            val settings = updater().updateSettings()
            assertEquals(6L, settings.periodicHours)
            assertFalse(settings.smallFixes)
            assertTrue(settings.setupAnswered)
            assertEquals(0, settings.mobileLimitMb)
        }
        prefs.edit().putInt("checkFrequency", 6).apply()
        assertEquals(6L, updater().updateSettings().periodicHours)
        prefs.edit().putString("checkFrequency", "24h").apply()
        assertEquals(24L, updater().updateSettings().periodicHours)
    }

    @Test fun youngStagedBundleWaitsByDefaultAndCanBeUsedForRecovery() {
        val updater = updater()
        val engine = updater.engine
        val young = engine.embedded.copy(version = "0.74.1", publishedAt = System.currentTimeMillis())
        val staging = engine.root.resolve("staging/${young.version}")
        atomicWrite(staging.resolve("bundle.json"), json.toJson(young).toByteArray())
        engine.commit(young, staging)

        assertTrue(updater.settingsJson().getBoolean("waitForUpdates"))
        assertNull(updater.info().optJSONObject("staged"))
        assertEquals(young.version, engine.snapshot().pending)

        updater.prepareLaunch(startingBuiltIn = true, recovery = true) {}
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (updater.launching && System.nanoTime() < deadline) Thread.sleep(10)
        assertEquals(young.version, updater.launch.version)
    }

    @Test fun failedCheckAndThrowingObserversDoNotEscapeTheMainThread() {
        shadowOf(app.getSystemService(ConnectivityManager::class.java)).setActiveNetworkInfo(null)
        val updater = updater()
        var notified = false
        updater.onChange = { throw IllegalStateException("native notice failed") }
        updater.eventListeners.add { _, _ -> throw IOException("web listener failed") }
        updater.eventListeners.add { name, _ -> notified = name == "updateStateChanged" }

        requireNotNull(updater.check()).get(10, TimeUnit.SECONDS)
        shadowOf(Looper.getMainLooper()).idle()

        assertFalse(updater.lastCheckSucceeded)
        assertFalse(updater.shell.lastCheckSucceeded)
        assertTrue(updater.checks.hasError())
        assertTrue(notified)
        val logs = updater.engine.log.read()
        assertTrue(logs.contains("native notice failed"))
        assertTrue(logs.contains("web listener failed"))
    }

    @Test fun polishUpdateStringsAcceptTheArgumentsPassedByNativeCode() {
        val pl = NativeStrings.context(app, "pl")
        val version = "0.74.0"
        val versions = pl.getString(R.string.ota_combined_versions, version, "0.74.1")
        assertTrue(versions.contains(version) && versions.contains("0.74.1"))
        val singleString = listOf(
            R.string.ota_start_failed, R.string.ota_notification_channel, R.string.ota_notification_installed_text,
            R.string.ota_notification_open_version, R.string.ota_installing_version, R.string.ota_install_update,
            R.string.ota_get_update, R.string.ota_rollback_title, R.string.ota_rollback_blocked,
            R.string.ota_rollback_text, R.string.ota_downloading, R.string.ota_startup_fix_ready,
            R.string.ota_app_ready_version, R.string.ota_ready_version, R.string.ota_app_required_text,
            R.string.ota_lexling_version, R.string.ota_android_version, R.string.ota_ready_combined,
            R.string.ota_last_checked_today, R.string.ota_last_checked
        )
        for (id in singleString) assertTrue(pl.getString(id, version).contains(version))
        assertTrue(pl.getString(R.string.ota_versions, version, "0.74.1").contains("0.74.1"))
        assertTrue(pl.getString(R.string.ota_startup_fix_offer, version, "3 MiB").contains("3 MiB"))
        assertTrue(pl.getString(R.string.ota_megabytes, 20).contains("20"))
        assertTrue(pl.getString(R.string.ota_speed_bytes, 123L).contains("123"))
        assertTrue(pl.getString(R.string.ota_progress_percent, 42).contains("42%"))
        for (id in listOf(R.string.ota_speed_kb, R.string.ota_speed_mb, R.string.ota_amount_mb)) {
            assertTrue(pl.getString(id, 1.5).contains("1,5"))
        }
        assertTrue(pl.getString(R.string.ota_download_amount, 1.5, 2.5).contains("2,5"))
    }

    private fun updater(): Updater {
        val root = tmp.newFolder()
        val embedded = Manifest(version = "0.74.0", minShellApi = 2, releasedAt = 0, expiresAt = Long.MAX_VALUE,
            kind = "feature", message = "", files = listOf(BundleFile("index.html", "0".repeat(64), 0, "index")))
        val engine = Engine(root, embedded, 2, EventLog(root.resolve("updater.log")))
        return Updater(app, engine, ManifestVerifier(ByteArray(32)))
    }
}
