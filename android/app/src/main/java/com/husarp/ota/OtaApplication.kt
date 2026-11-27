package com.husarp.ota

import android.app.Application
import com.husarp.ota.core.*
import com.husarp.lexling.BuildConfig
import java.io.File
import java.util.Base64

class OtaApplication : Application() {
    internal lateinit var startupCrashGuard: StartupCrashGuard
        private set
    @Volatile internal var startingBuiltIn = false
    private var updatesScheduled = false

    override fun onCreate() {
        startupCrashGuard = StartupCrashGuard(this).also { it.installExceptionHandler() }
        super.onCreate()
    }

    private val engine by lazy {
        val embedded = assets.open("embedded-manifest.json").bufferedReader().use { json.fromJson(it, Manifest::class.java) }
        validateManifest(embedded)
        val root = File(filesDir, "ota")
        Engine(root, embedded, BuildConfig.SHELL_API, EventLog(File(root, "updater.log")), BuildConfig.VERSION_CODE.toLong())
    }

    val updater by lazy {
        val key = assets.open("public-key.b64").bufferedReader().use { Base64.getDecoder().decode(it.readText().trim()) }
        Updater(this, engine, ManifestVerifier(key))
    }

    internal fun bundleSelected() {
        startingBuiltIn = false
        if (updatesScheduled) return
        updatesScheduled = true
        UpdateWorker.schedule(this)
        engine.log.add("Automatic check frequency: ${updater.updateSettings().checkFrequency}; network constraint follows update settings")
    }

    internal fun resetToBuiltin(label: String) {
        engine.resetWebBundle(label)
        check(getSharedPreferences(UPDATE_SETTINGS_PREFERENCES, MODE_PRIVATE).edit().putBoolean("setupAnswered", false).commit())
    }
}
