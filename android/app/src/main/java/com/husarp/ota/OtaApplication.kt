package com.husarp.ota

import android.app.Application
import com.husarp.ota.core.*
import com.husarp.lexling.BuildConfig
import java.io.File
import java.util.Base64

class OtaApplication : Application() {
    lateinit var updater: Updater
    override fun onCreate() {
        super.onCreate()
        val embedded = assets.open("embedded-manifest.json").bufferedReader().use { json.fromJson(it, Manifest::class.java) }
        val key = assets.open("public-key.b64").bufferedReader().use { Base64.getDecoder().decode(it.readText().trim()) }
        validateManifest(embedded)
        val root = File(filesDir, "ota")
        val log = EventLog(File(root, "updater.log"))
        updater = Updater(this, Engine(root, embedded, BuildConfig.SHELL_API, log, BuildConfig.VERSION_CODE.toLong()), ManifestVerifier(key))
        UpdateWorker.schedule(this)
        log.add("Automatic check frequency: ${updater.updateSettings().checkFrequency}; network constraint follows update settings")
    }
}
