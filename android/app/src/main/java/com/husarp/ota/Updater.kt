package com.husarp.ota
import com.husarp.lexling.BuildConfig
import com.husarp.lexling.R

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.getcapacitor.JSObject
import com.husarp.ota.core.*
import java.io.File
import java.util.Base64
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean

internal const val UPDATE_SETTINGS_PREFERENCES = "ota-settings"
private val Engine.pairedReleaseFile get() = File(root, "paired-web.json")

internal fun Engine.resetWebBundle(label: String) {
    reset(label)
    pairedReleaseFile.delete()
}

internal data class TransferState(val done: Long, val total: Long, val speed: Long) {
    fun snapshot() = JSObject().put("done", done).put("total", total).put("speed", speed)
}

class Updater(private val context: Context, val engine: Engine, private val verifier: ManifestVerifier) {
    companion object {
        val DEFAULT_URL = BuildConfig.OTA_BUNDLE_URL
        val RELEASES_URL = BuildConfig.OTA_RELEASES_URL
        val SHELL_URL = BuildConfig.OTA_SHELL_URL
    }
    private val prefs = context.getSharedPreferences(UPDATE_SETTINGS_PREFERENCES, Context.MODE_PRIVATE)
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val busy = AtomicBoolean(false)
    @Volatile var lastCheckSucceeded = true
        private set
    @Volatile private var currentCheck: Future<*>? = null
    @Volatile var consentDownloading = false
        private set
    @Volatile var progressPercent = 0
        private set
    private val transport = HttpsTransport()
    private data class Offer(val manifest: Manifest, val source: DownloadedManifest, val decision: Decision)
    @Volatile private var offer: Offer? = null
    @Volatile var webDownloadVersion: String? = null
    @Volatile private var transfer: TransferState? = null
    @Volatile var status = "Ready"
        private set
    @Volatile var launch = Launch(engine.embedded.version, "", null)
        private set
    @Volatile var launching = true
        private set
    private var prepared = false
    private val launchCallbacks = mutableListOf<() -> Unit>()
    @Volatile var foreground = false
        private set
    @Volatile var safeToInterrupt = true
        private set
    @Volatile var autoRestartPending = false
        private set
    private var laterVersion: String? = null
    private var updated: JSObject? = null
    private var rolledBack: JSObject? = null
    val watchdog = StartupWatchdog()
    internal val activation = UpdateActivation()
    private val completingPairedLaunch = engine.snapshot().pendingShellCode?.let { it <= BuildConfig.VERSION_CODE } == true

    fun simulateBrokenStart() = prefs.edit().putBoolean("simulateBrokenStart", true).commit()

    private fun selectLaunch() {
        val state = engine.snapshot()
        val deferPending = !(launching && !prepared && completingPairedLaunch) &&
            state.pending != null && runCatching { pairedOffer()?.web?.version == state.pending }
                .onFailure { engine.log.add("Could not read combined update for launch: ${it.message}") }
                .getOrDefault(false)
        if (!deferPending && state.pendingShellCode == null) state.pending?.let(activation::begin)
        if (activation.current != null) changed()
        val next = engine.coldStart(deferPending = deferPending, onProgress = { progress ->
            if (activation.count(progress)) changed()
        }) { version ->
            if (activation.advance(version)) changed()
        }
        val simulate = (prefs.all["simulateBrokenStart"] == true) &&
            prefs.edit().remove("simulateBrokenStart").commit()
        watchdog.launch(next.token, SystemClock.elapsedRealtime(), simulate)
        launch = next
        activation.current?.let { if (it.version != next.version) activation.clear() }
        if (simulate) engine.log.add("Ignoring ready for this launch (debug simulation)")
    }
    private var shellEventVersion: Long? = null
    var onChange: (() -> Unit)? = null
    var onToast: ((Int) -> Unit)? = null
    val eventListeners = CopyOnWriteArrayList<(String, JSObject) -> Unit>()
    val checks = UpdateChecks(context, engine.log) { changed() }
    val shell = ShellUpdater(context.applicationContext, engine, verifier, checks, { safeToInterrupt }, { changed() }, { updateSettings() }, { unmetered() }, ::canInstallShell)
    @Volatile private var readyWeb: Pair<String, Boolean>? = null
    fun webCheckNotices() = readyWeb?.takeIf { it.first == launch.token }?.second
    fun retryChecks() { check(true) }

    fun retryCheck(channel: CheckChannel) {
        if (channel == CheckChannel.WEB) check(true)
        else shell.check(manual = true, metadataOnly = true)
    }
    init {
        // Only a date for Settings: a full disk must not stop the app before the built-in version can start.
        runCatching {
            val installedAt = context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime
            engine.dates.record("shell", BuildConfig.VERSION_CODE.toString(), BuildConfig.SHELL_RELEASED_AT, installedAt = installedAt)
        }.onFailure { engine.log.add("Could not record the app install date: ${it.message}") }
    }
    @Volatile private var settings = readSettings()
    private fun readSettings(): UpdateSettings {
        val saved = prefs.all
        val defaults = migrateUpdateSettings(saved["automatic"] as? Boolean)
        val frequency = (saved["checkFrequency"] as? String)?.let(::migrateCheckFrequency)
        return UpdateSettings(
            smallFixes = saved["smallFixes"] as? Boolean ?: defaults.smallFixes,
            majorUpdates = saved["majorUpdates"] as? Boolean ?: defaults.majorUpdates,
            shellUpdates = saved["shellUpdates"] as? Boolean ?: defaults.shellUpdates,
            wifiLimitMb = (saved["wifiLimitMb"] as? Int)?.takeIf { it in listOf(5, 20, 50, 100, -1) } ?: defaults.wifiLimitMb,
            mobileLimitMb = (saved["mobileLimitMb"] as? Int)?.takeIf { it in listOf(0, 5, 20, 50, -1) } ?: defaults.mobileLimitMb,
            setupAnswered = saved["setupAnswered"] as? Boolean ?: defaults.setupAnswered,
            checkFrequency = frequency?.takeIf { it in listOf("1h", "6h", "24h") } ?: defaults.checkFrequency
        )
    }
    fun updateSettings(): UpdateSettings = settings
    fun settingsJson(): JSObject = JSObject(json.toJson(settings))
        .put("updateNotifications", ShellUpdatedNotification.enabled(context))
    @Synchronized fun setUpdateSettings(partial: JSObject): JSObject {
        val allowed = setOf("smallFixes","majorUpdates","shellUpdates","wifiLimitMb","mobileLimitMb","setupAnswered","checkFrequency","updateNotifications")
        val keys = partial.keys()
        while(keys.hasNext()) {
            val key = keys.next(); require(key in allowed) { "Unknown setting: $key" }
            val value = partial.get(key)
            require(if(key == "checkFrequency") value is String else if(key.endsWith("Mb")) value is Number && value.toDouble() == value.toInt().toDouble() else value is Boolean) { "Invalid setting: $key" }
        }
        val old = settings
        val next = UpdateSettings(partial.optBoolean("smallFixes",old.smallFixes),partial.optBoolean("majorUpdates",old.majorUpdates),
            partial.optBoolean("shellUpdates",old.shellUpdates),partial.optInt("wifiLimitMb",old.wifiLimitMb),
            partial.optInt("mobileLimitMb",old.mobileLimitMb),partial.optBoolean("setupAnswered",old.setupAnswered), migrateCheckFrequency(partial.optString("checkFrequency",old.checkFrequency))).validate()
        val notifications = partial.optBoolean("updateNotifications", ShellUpdatedNotification.enabled(context))
        kotlin.check(prefs.edit().putBoolean("smallFixes",next.smallFixes).putBoolean("majorUpdates",next.majorUpdates)
            .putBoolean("updateNotifications", notifications)
            .putBoolean("shellUpdates",next.shellUpdates).putInt("wifiLimitMb",next.wifiLimitMb).putInt("mobileLimitMb",next.mobileLimitMb)
            .putString("checkFrequency",next.checkFrequency).putBoolean("setupAnswered",next.setupAnswered).remove("url").remove("automatic").commit())
        settings = next
        if (!notifications) ShellUpdatedNotification.cancel(context)
        event("updateSettingsChanged",settingsJson()); changed()
        UpdateWorker.schedule(context)
        shell.maybeInstall()
        check()
        return settingsJson()
    }
    fun unmetered(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        return cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_NOT_METERED) == true
    }
    val automatic get() = settings.smallFixes // legacy info field
    private inline fun deliverUpdate(label: String, action: () -> Unit) {
        try { action() }
        catch (e: Exception) { engine.log.add("Could not deliver $label: ${e.javaClass.simpleName}: ${e.message}") }
    }
    private fun changed() { main.post {
        deliverUpdate("native update state") { onChange?.invoke() }
        sendEvent("updateStateChanged", JSObject())
        deliverUpdate("Android app update state") {
            val m = shell.manifest()?.takeIf { shell.isReady() }
            if (m == null) shellEventVersion = null
            else if (shellEventVersion != m.versionCode) {
                val state = shell.state(m)
                shellEventVersion = m.versionCode
                event("shellUpdateReady", state)
            }
        }
    } }
    private fun message(text: String) { status = text; changed() }
    private fun toast(message: Int) { main.post { deliverUpdate("update notice") { onToast?.invoke(message) } } }
    private fun sendEvent(name: String, data: JSObject) {
        eventListeners.forEach { listener -> deliverUpdate(name) { listener(name, data) } }
    }
    private fun event(name: String, data: JSObject) { main.post { sendEvent(name, data) } }
    fun subscribe(listener: (String, JSObject) -> Unit) {
        eventListeners.add(listener)
        // The startup check may finish before Capacitor creates the plugin.
        // Reconstruct the current offer/staged event for late web listeners.
        main.post {
            deliverUpdate("initial update state") {
                availableState()?.let { listener("updateAvailable",it) }
                stagedState()?.let { listener("updateStaged",it) }
                if (shell.isReady()) shell.manifest()?.let {
                    listener("shellUpdateReady",shell.state(it))
                }
            }
        }
    }
    fun setForeground(value: Boolean) {
        foreground = value; engine.log.add("Lexling ${if(value) "start/resume" else "stop"}; safe=$safeToInterrupt")
        if (value && !launching) check(onForeground = true)
        changed()
    }
    fun setSafeToInterrupt(value: Boolean) {
        if (safeToInterrupt == value) return
        safeToInterrupt = value; engine.log.add("Safe to interrupt = $value; deferred actions re-evaluated")
        if (value) shell.maybeInstall()
        changed()
    }
    // Only an activity initiates coldStart. Keep its UI free to draw progress (owner, 2026-11-26).
    fun prepareLaunch(startingBuiltIn: Boolean = false, complete: () -> Unit) {
        if (prepared) { complete(); return }
        launchCallbacks.add(complete)
        if (launchCallbacks.size > 1) return
        safeToInterrupt = false
        Thread({ prepareColdLaunch(startingBuiltIn) }, "lexling-startup").start()
    }

    private fun prepareColdLaunch(startingBuiltIn: Boolean) {
        val start = SystemClock.elapsedRealtime()
        engine.log.add("Quick apply start: launch held at most ${QUICK_APPLY_MS} ms")
        runCatching { engine.reconcileShell() }.onFailure { engine.log.add("Shell reconciliation failed: ${it.message}") }
        val pending = engine.snapshot().pending != null
        if (!startingBuiltIn) {
            val check = check()
            if (!pending) {
                val result=awaitQuickApply(check,SystemClock.elapsedRealtime()-start,false)
                engine.log.add("Quick apply $result; timeout/error keeps current and lets background work continue",SystemClock.elapsedRealtime()-start)
            }
        }
        selectLaunch(); launching = false
        if(launch.notice!=null) status="Ready · Lexling ${launch.version}"
        engine.log.add("Quick apply finished: ${launch.version}; existing staged=$pending", SystemClock.elapsedRealtime()-start)
        main.post {
            prepared = true
            val callbacks = launchCallbacks.toList()
            launchCallbacks.clear()
            callbacks.forEach { it() }
        }
        changed()
    }
    fun info(): JSObject = JSObject().apply {
        put("updateChecks", checks.snapshot())
        put("webVersion", launch.version); put("shellVersion", BuildConfig.VERSION_NAME); put("shellApi", BuildConfig.SHELL_API)
        put("runningShellVersionCode", BuildConfig.VERSION_CODE)
        val webDates = engine.dates.get("web", launch.version)
        val shellDates = engine.dates.get("shell", BuildConfig.VERSION_CODE.toString())
        put("webTimestamps", JSObject(json.toJson(webDates)))
        put("shellTimestamps", JSObject(json.toJson(shellDates)))
        put("webReleasedAt", webDates.publishedAt); put("webInstalledAt", webDates.installedAt)
        put("shellReleasedAt", shellDates.publishedAt); put("shellInstalledAt", shellDates.installedAt)
        put("token", launch.token); put("status", status); put("automatic", automatic)
        put("canDownload", !busy.get() && availableOffer() != null)
        put("needsShell", offer?.decision?.action == Action.FULL_APP)
        put("webDownloadVersion", webDownloadVersion); put("pending", engine.snapshot().pending); put("trial", engine.snapshot().trial)
        put("safeToInterrupt", safeToInterrupt); put("shellStatus", shell.status)
        val webInstalling = activation.current?.version
        val shellInstalling = shell.installingTarget()
        put("installingVersion", webInstalling ?: shellInstalling?.versionName)
        put("installingChannel", if (webInstalling != null) "web" else if (shellInstalling != null) "shell" else null)
        if (webInstalling == null) put("installingShellVersionCode", shellInstalling?.versionCode)
        val pair = pairedState()
        put("combined", pair)
        put("available", if (pair == null) availableState()?.takeUnless { it.optBoolean("needsShell") && shell.candidate() != null } else null)
        put("staged", if (pair == null) stagedState() else null); put("updated",updated); put("rolledBack",rolledBack)
        put("shellUpdateReady",shell.isReady()); put("shellVersionCode",shell.manifest()?.versionCode)
        put("shellReady",shell.manifest()?.takeIf { pair == null && shell.isReady() && !checkingPair }?.let { shell.state(it) })
        put("busy",busy.get()); put("downloading",consentDownloading); put("progress",progressPercent)
        put("webTransfer",transfer?.snapshot()); put("shellTransfer",shell.transfer?.snapshot())
        val shellDownload = shell.downloadTarget()
        put("shellDownloading",shell.downloading); put("shellDownloadVersion",shellDownload?.versionName)
        put("shellDownloadVersionCode",shellDownload?.versionCode); put("shellNotes",shell.installedNotes())
        put("autoRestart",autoRestartPending)
        put("updateSettings",settingsJson()); put("shellAvailable",if (pair == null && !checkingPair) shell.availableState() else null)
    }
    private fun availableState(): JSObject? = offer?.takeIf {
        it.decision.action in listOf(Action.PROMPT,Action.FULL_APP) && it.manifest.version != laterVersion &&
            compareVersions(it.manifest.version, launch.version) > 0 && it.manifest.version != activation.current?.version
    }?.let {
        webState(it.manifest).put("version",it.manifest.version).put("kind",it.manifest.kind)
            .put("size",it.decision.delta).put("needsShell",it.decision.action==Action.FULL_APP)
    }
    private fun stagedState(): JSObject? = engine.snapshot().takeIf { it.pendingShellCode == null }?.pending?.let { version ->
        runCatching { engine.manifest(version) }.getOrNull()?.let {
            webState(it).put("version",it.version).put("kind",it.kind)
        }
    }
    private fun webState(m: Manifest): JSObject = JSObject(json.toJson(engine.dates.get("web", m.version)))
        .put("releasedAt", m.releasedAt).put("version", m.version)
    data class Available(val version: String, val size: Long)
    fun availableOffer(): Available? = offer?.takeIf { it.decision.action == Action.PROMPT && it.manifest.version != laterVersion }?.let { Available(it.manifest.version, it.decision.delta) }
    fun later() { laterVersion = offer?.manifest?.version; engine.log.add("Later: hide $laterVersion until next cold start"); changed() }
    private data class PairedOffer(
        val shell: ShellManifest, val web: Manifest, val release: Offer?, val payload: PairedWebUpdate
    )
    private data class SavedPair(val shellCode: Long, val envelope: String, val source: String)
    private val pairedReleaseFile = engine.pairedReleaseFile
    @Volatile private var lastWebRelease: Offer? = null
    @Volatile private var checkingPair = false
    @Volatile private var downloadingPair: PairedOffer? = null

    private fun restorePairedRelease(): Offer? {
        if (!pairedReleaseFile.isFile) return null
        return runCatching {
            val saved = json.fromJson(pairedReleaseFile.readText(), SavedPair::class.java)
            if (saved.shellCode <= BuildConfig.VERSION_CODE) {
                pairedReleaseFile.delete()
                return null
            }
            val source = DownloadedManifest(Base64.getDecoder().decode(saved.envelope), saved.source)
            val manifest = verifier.verify(source.bytes, System.currentTimeMillis())
            Offer(manifest, source, Decision(Action.PROMPT, "Resume combined update"))
        }.onFailure { engine.log.add("Combined update metadata unavailable: ${it.message}") }.getOrNull()
    }

    private fun savePairedRelease(pair: PairedOffer) {
        val source = pair.release?.source ?: return
        val saved = SavedPair(pair.shell.versionCode, Base64.getEncoder().encodeToString(source.bytes), source.finalUrl)
        atomicWrite(pairedReleaseFile, json.toJson(saved).toByteArray())
    }

    private fun pairedOffer(): PairedOffer? {
        val apk = shell.candidate() ?: return null
        val state = engine.snapshot()
        val release = offer?.takeIf {
            it.decision.action in listOf(Action.AUTO, Action.PROMPT, Action.FULL_APP) &&
                it.manifest.version !in state.failed && it.manifest.version !in state.blocked &&
                compareVersions(it.manifest.version, state.current) > 0
        }
        val pending = state.pending?.takeIf { it !in state.failed && it !in state.blocked }
            ?.let { runCatching { engine.manifest(it) }.getOrNull() }
        val web = when {
            pending == null -> release?.manifest
            release == null || compareVersions(pending.version, release.manifest.version) >= 0 -> pending
            else -> release.manifest
        } ?: return null
        val payload = pairedWebUpdate(web.version, web.minShellApi, apk)
        if (payload == PairedWebUpdate.UNSUPPORTED) return null
        return PairedOffer(apk, web, (release ?: lastWebRelease)?.takeIf { it.manifest == web }, payload)
    }

    private fun pairedReady(pair: PairedOffer): Boolean {
        if (!shell.readyFor(pair.shell)) return false
        if (pair.payload == PairedWebUpdate.EMBEDDED) return true
        val state = engine.snapshot()
        return state.pending == pair.web.version && state.pendingShellCode == pair.shell.versionCode
    }

    private fun canInstallShell(target: ShellManifest): Boolean {
        if (checkingPair) return false
        val pair = pairedOffer()
        return pair == null || (pair.shell.versionCode == target.versionCode && pairedReady(pair))
    }

    private fun pairedState(): JSObject? {
        val pair = downloadingPair ?: pairedOffer() ?: return null
        val shellBytes = if (shell.readyFor(pair.shell)) 0 else pair.shell.size
        val webBytes = if (pair.payload == PairedWebUpdate.EMBEDDED || pairedReady(pair)) 0
            else pair.web.files.sumOf { it.size }
        val active = downloadingPair != null
        val progress = if (!active) null else if (shellBytes == 0L) transfer else {
            shell.transfer?.let {
                if (pair.payload == PairedWebUpdate.OVERLAY) it.copy(total = -1) else it
            }
        }
        return shell.state(pair.shell).put("webVersion", pair.web.version)
            .put("size", shellBytes + webBytes)
            .put("estimatedSize", webBytes > 0)
            .put("phase", when {
                shell.installingTarget()?.versionCode == pair.shell.versionCode -> "installing"
                active -> "downloading"
                pairedReady(pair) -> "ready"
                else -> "available"
            })
            .put("transfer", progress?.snapshot())
    }

    private var checkAfterDownload = false

    @Synchronized fun check(manual: Boolean = false, onForeground: Boolean = false): Future<*>? {
        if (!busy.compareAndSet(false, true)) {
            if (onForeground && currentCheck == null) checkAfterDownload = true
            engine.log.add("Check coalesced: updater busy")
            return currentCheck
        }
        checkingPair = true
        lastCheckSucceeded = false
        val task = FutureTask {
            val started = System.nanoTime()
            try {
                engine.log.add("Check started (${if (manual) "Check now" else "background/start"})")
                engine.reconcileShell()
                message("Checking…")
                if (offer == null) offer = restorePairedRelease()
                val shellCheck = shell.check(manual = manual, metadataOnly = true)
                val release = try {
                    checks.fetch(CheckChannel.WEB, DEFAULT_URL, transport, manual) {
                        verifier.verify(it.bytes, System.currentTimeMillis())
                    }
                } finally { shellCheck.get() }
                if (release == null) {
                    pairedReleaseFile.delete()
                    offer = null
                    message("No Lexling update published")
                } else {
                    val (source, m) = release
                    if (compareVersions(m.version, engine.snapshot().current) > 0)
                        engine.dates.record("web", m.version, m.releasedAt, available = true)
                    engine.blocked(m.blocked)
                    val state = engine.snapshot()
                    val decision = decide(m, engine.currentManifest(), engine.embedded, BuildConfig.SHELL_API,
                        settings, unmetered(), state.failed, state.blocked, state.trial, state.pending)
                    engine.log.add("Lexling ${m.version}: ${decision.action}, ${decision.reason}; delta ${decision.delta} bytes")
                    offer = Offer(m, source, decision).also { lastWebRelease = it }
                    message("Lexling ${m.version}: ${decision.reason}")
                }
                checkingPair = false
                changed()
                val pair = pairedOffer()
                if (pair != null) {
                    val current = engine.snapshot()
                    val critical = current.current in current.blocked
                    val autoWeb = pair.payload == PairedWebUpdate.EMBEDDED ||
                        automaticDownload(settings, pair.web.kind, pair.web.files.sumOf { it.size }, unmetered(), critical)
                    val autoShell = shell.readyFor(pair.shell) ||
                        automaticDownload(settings, "shell", pair.shell.size, unmetered())
                    if (!pairedReady(pair) && !current.trial && autoWeb && autoShell) {
                        downloadPair(pair, consent = false)
                        shell.allowAutomaticInstall(pair.shell)
                    } else if (pairedReady(pair)) shell.maybeInstall()
                } else {
                    val selected = offer
                    // The ready APK may be installed independently when it cannot carry this Lexling release.
                    val apk = shell.candidate()
                    if (apk != null && !shell.readyFor(apk) &&
                        automaticDownload(settings, "shell", apk.size, unmetered())) shell.check(expected = apk).get()
                    else shell.maybeInstall()
                    if (selected?.decision?.action == Action.AUTO && engine.snapshot().pendingShellCode == null)
                        install(selected, false)
                    else availableState()?.let { event("updateAvailable", it) }
                }
                lastCheckSucceeded = true
            } catch (e: Exception) {
                engine.log.add("Signature/check/download error: ${e.javaClass.simpleName}: ${e.message}")
                message(if (e is CheckException) e.failure.message else "Update processing failed. See Logs.")
            } finally {
                checkingPair = false
                if (lastCheckSucceeded.not()) shell.maybeInstall()
                finishDownload()
                engine.log.add("Check finished", (System.nanoTime()-started)/1_000_000)
            }
        }
        currentCheck = task
        try { worker.execute(task) }
        catch (e: RejectedExecutionException) {
            checkingPair = false
            currentCheck = null
            busy.set(false)
            engine.log.add("Could not queue update check: ${e.message}")
            message("Update processing failed. See Logs.")
            return null
        }
        return task
    }

    fun downloadCombined(versionCode: Long, webVersion: String): Boolean {
        val pair = pairedOffer()?.takeIf { it.shell.versionCode == versionCode && it.web.version == webVersion }
            ?: return false
        if (pairedReady(pair) || shell.installingTarget() != null || engine.snapshot().trial ||
            !busy.compareAndSet(false, true)) return false
        downloadingPair = pair
        message("Preparing combined update")
        worker.execute {
            try { downloadPair(pair, consent = true) }
            catch (e: Exception) {
                engine.log.add("Combined update download failed: ${e.message}")
                message("Download failed; retry from Updates. See Logs.")
            } finally { finishDownload() }
        }
        return true
    }

    @Synchronized private fun finishDownload() {
        downloadingPair = null; webDownloadVersion = null; transfer = null
        consentDownloading = false; currentCheck = null
        busy.set(false); changed()
        if (checkAfterDownload) {
            checkAfterDownload = false
            check()
        }
    }

    private fun downloadPair(pair: PairedOffer, consent: Boolean) {
        downloadingPair = pair
        if (consent) shell.requireInstallTap(pair.shell)
        savePairedRelease(pair)
        message("Downloading Android app and Lexling")
        val apkBytes = if (shell.readyFor(pair.shell)) 0L else pair.shell.size
        if (apkBytes > 0) shell.check(consent = consent, downloadOnly = true, expected = pair.shell).get()
        require(shell.readyFor(pair.shell)) { "Android app download did not finish" }
        if (pairedReady(pair)) return
        val embedded = shell.embeddedFor(pair.shell)
        val web = pair.release?.let { verifier.verify(it.source.bytes, System.currentTimeMillis()) } ?: pair.web
        val state = engine.snapshot()
        val pending = state.pending?.let { engine.manifest(it) }
        val current = engine.currentManifest()
        val reusable = pending?.takeIf { it.version == web.version } ?: current
        val delta = web.files.filter { file ->
            embedded.files.none { it.path == file.path && it.sha256 == file.sha256 } &&
                reusable.files.none { it.path == file.path && it.sha256 == file.sha256 &&
                    (reusable != current || engine.currentOverlayFile(it.path) != null) }
        }.sumOf { it.size }
        val policy = { automaticDownload(settings, web.kind, delta, unmetered(), current.version in engine.snapshot().blocked) }
        require(consent || policy()) { "Lexling download needs consent" }
        webDownloadVersion = web.version
        transfer = TransferState(apkBytes, apkBytes + delta, 0)
        val speed = DownloadSpeed(SystemClock.elapsedRealtime())
        val installer = Installer(engine.root, embedded, transport, engine.log,
            transferProgress = { _, _, received ->
                transfer = TransferState(apkBytes + received, apkBytes + delta, speed.sample(received, SystemClock.elapsedRealtime()))
                changed()
            }, beforeDownload = { require(consent || policy()) { "Lexling download needs consent" } })
        val staged = installer.stage(web, reusable, { path ->
            if (reusable == current) engine.currentOverlayFile(path)
            else File(engine.bundles, "${reusable.version}/files/$path").takeIf { it.isFile }
        }, pair.release?.source?.finalUrl ?: DEFAULT_URL)
        requireNotNull(staged) { "Not enough storage" }
        engine.commit(web, staged, targetShell = pair.shell)
        message("Android app and Lexling ready to install")
    }

    fun combinedReady(versionCode: Long, webVersion: String): Boolean =
        !busy.get() && pairedOffer()?.let {
            it.shell.versionCode == versionCode && it.web.version == webVersion && pairedReady(it)
        } == true

    fun download(installAfterDownload: Boolean = true): Boolean {
        val selected = offer ?: return false
        if (pairedOffer() != null || selected.decision.action != Action.PROMPT ||
            engine.snapshot().pendingShellCode != null || !busy.compareAndSet(false, true)) return false
        webDownloadVersion = selected.manifest.version
        transfer = TransferState(0, selected.decision.delta, 0)
        consentDownloading = true; progressPercent = 0; message("Preparing Lexling ${selected.manifest.version} download")
        worker.execute {
            try { install(selected, true, installAfterDownload = installAfterDownload) } catch (e: Exception) {
                engine.log.add("Error downloading: ${e.message}"); message("Download failed; retry Check now. See Logs.")
            } finally { finishDownload() }
        }
        return true
    }
    internal data class StartupFix(val token: String, val staged: Boolean, val source: DownloadedManifest)

    private fun startupOffer(source: DownloadedManifest, manifest: Manifest = verifier.verify(source.bytes, System.currentTimeMillis())): Offer {
        val state = engine.snapshot()
        val decision = decide(manifest, engine.currentManifest(), engine.embedded, BuildConfig.SHELL_API,
            settings, unmetered(), state.failed, state.blocked, state.trial, state.pending, startupRecovery = true)
        return Offer(manifest, source, decision)
    }

    private fun isStagedFix(manifest: Manifest) = engine.snapshot().let {
        it.pending == manifest.version && it.pendingShellCode == null
    } && runCatching { engine.manifest(manifest.version) == manifest }.getOrDefault(false)

    internal fun checkForStartupFix(complete: (StartupFix?, String, Boolean) -> Unit) {
        val strings = NativeStrings.context(context)
        if (!busy.compareAndSet(false, true)) { complete(null, strings.getString(R.string.ota_startup_fix_busy), false); return }
        val token = launch.token
        worker.execute {
            var fix: StartupFix? = null
            var failedCheck = false
            val result = try {
                val release = checks.fetch(CheckChannel.WEB, DEFAULT_URL, transport, reportFailure = false) {
                    verifier.verify(it.bytes, System.currentTimeMillis())
                }
                val selected = release?.let { (source, manifest) -> startupOffer(source, manifest) }
                if (selected == null) {
                    strings.getString(R.string.ota_no_startup_fix)
                } else if (selected.decision.action != Action.PROMPT) {
                    engine.log.add("Startup fix unavailable: ${selected.decision.reason}")
                    if (selected.decision.action == Action.FULL_APP && shell.candidate() == null)
                        strings.getString(R.string.ota_app_required_text, selected.manifest.version)
                    else strings.getString(R.string.ota_no_startup_fix)
                } else {
                    val staged = isStagedFix(selected.manifest)
                    val bytes = if (staged) 0 else selected.decision.delta
                    fix = StartupFix(token, staged, selected.source)
                    if (staged) strings.getString(R.string.ota_startup_fix_ready, selected.manifest.version)
                    else strings.getString(R.string.ota_startup_fix_offer, selected.manifest.version, formatSize(bytes))
                }
            } catch (e: Exception) {
                engine.log.add("Startup fix check failed: ${e.message}")
                failedCheck = e is CheckException
                if (e is CheckException) strings.checkFailureText(e.failure) else strings.getString(R.string.ota_startup_fix_check_failed)
            } finally { finishDownload() }
            main.post { complete(fix, result, failedCheck) }
        }
    }

    internal fun applyStartupFix(fix: StartupFix, complete: (String?) -> Unit) {
        val strings = NativeStrings.context(context)
        if (!busy.compareAndSet(false, true)) { complete(strings.getString(R.string.ota_startup_fix_busy)); return }
        worker.execute {
            val error = try {
                require(launch.token == fix.token) { "Startup repair belongs to an earlier launch" }
                val selected = startupOffer(fix.source)
                require(selected.decision.action == Action.PROMPT) { selected.decision.reason }
                val staged = isStagedFix(selected.manifest)
                check(!fix.staged || staged) { "Previously staged fix is no longer available" }
                engine.blocked(selected.manifest.blocked)
                check(staged || (install(selected, true, fix.token) && isStagedFix(selected.manifest))) {
                    "Fix was not staged"
                }
                launching = true
                restartLaunch()
                null
            } catch (e: Exception) {
                engine.log.add("Startup fix failed: ${e.message}")
                strings.getString(R.string.ota_startup_fix_apply_failed)
            } finally { launching = false; finishDownload() }
            main.post { complete(error) }
        }
    }

    private fun install(selected: Offer, consent: Boolean, recoveryToken: String? = null, installAfterDownload: Boolean = true): Boolean {
        val m = verifier.verify(selected.source.bytes, System.currentTimeMillis())
        val s = engine.snapshot()
        val d = decide(m, engine.currentManifest(), engine.embedded, BuildConfig.SHELL_API, settings, unmetered(),
            s.failed, s.blocked, s.trial, s.pending, startupRecovery = recoveryToken != null)
        if (!consent && d.action == Action.PROMPT) {
            offer = selected.copy(decision=d)
            availableState()?.let { event("updateAvailable",it) }
            message("New Lexling version ${m.version} · ${formatSize(d.delta)}")
            return false
        }
        require(d.action == Action.AUTO || (consent && d.action == Action.PROMPT)) { d.reason }
        webDownloadVersion = m.version
        offer = null
        val started = SystemClock.elapsedRealtime()
        val downloadSpeed = DownloadSpeed(started)
        engine.log.add("${if(consent) "Consented" else "Automatic"} download ${m.version}: ${d.delta} bytes")
        transfer = TransferState(0, d.delta, 0)
        message("Downloading Lexling ${m.version} · ${formatSize(d.delta)}")
        val installer = Installer(engine.root, engine.embedded, transport, engine.log, progress = { message(it) }, transferProgress = { done, total, received ->
            progressPercent = if(total==0L) 100 else (done*100/total).toInt()
            transfer = TransferState(done, total, downloadSpeed.sample(received, SystemClock.elapsedRealtime()))
            changed()
        }, beforeDownload = {
            if (!consent && !automaticDownload(settings,m.kind,d.delta,unmetered(),engine.currentManifest().version in engine.snapshot().blocked)) {
                offer = selected.copy(decision=Decision(Action.PROMPT,"Settings/network changed; consent required",d.delta))
                availableState()?.let { event("updateAvailable",it) }
                error("Automatic download paused: settings/network changed; Later / Update")
            }
        })
        val staged = installer.stage(m, engine.currentManifest(), { engine.currentOverlayFile(it) }, selected.source.finalUrl)
        if (staged == null) { message("${m.version}: Not enough storage; skipped"); return false }
        engine.commit(m, staged, recoveryToken)
        autoRestartPending = consent && recoveryToken == null && installAfterDownload
        message("Lexling ${m.version} downloaded · Restart")
        engine.log.add("Update staged ${m.version}; consent=$consent, foreground=$foreground, safe=$safeToInterrupt", SystemClock.elapsedRealtime()-started)
        transfer?.let { engine.log.add("Web transfer ${it.done}/${it.total} bytes at ${it.speed} B/s") }
        event("updateStaged",webState(m).put("version",m.version).put("size",d.delta).put("kind",m.kind))
        return true
    }
    fun restart(reset: Boolean = false, startupRecovery: Boolean = false, complete: () -> Unit): Boolean {
        if (!startupRecovery && !safeToInterrupt) { toast(R.string.ota_wait_before_restart); return false }
        if (!busy.compareAndSet(false, true)) { toast(R.string.ota_wait_for_download); return false }
        launching = true
        changed()
        worker.execute {
            try {
                if (reset) {
                    engine.resetWebBundle(NativeStrings.context(context).getString(R.string.ota_reset_builtin))
                    offer = null
                    lastWebRelease = null
                    setUpdateSettings(JSObject().put("setupAnswered",false))
                }
                restartLaunch()
                main.post { complete() }
            } catch (e: Exception) { activation.clear(); engine.log.add("Restart error: ${e.message}"); message("Restart failed; see Logs") }
            finally { launching = false; finishDownload() }
        }
        return true
    }
    private fun restartLaunch() {
        selectLaunch(); offer = null; laterVersion = null
        status = "Ready · Lexling ${launch.version}"; autoRestartPending = false; safeToInterrupt = true
        updated = null; rolledBack = null
    }
    fun isBusy() = busy.get()
    @Synchronized fun ready(version: String, token: String, checkNotices: Boolean = false): Boolean {
        if (!watchdog.acceptsReady(token) || !engine.ready(version, token)) return false
        watchdog.markReady(token)
        activation.finish(version)
        readyWeb = token to checkNotices
        engine.takeRollbackNotice(version,token)?.let { notice ->
            rolledBack = JSObject().put("from",notice.from).put("to",notice.to).put("reason",notice.reason)
            event("rolledBack",rolledBack!!)
        }
        engine.takeUpdatedNotice(version,token)?.let { notice ->
            updated = JSObject().put("from",notice.from).put("to",notice.to).put("notes",notice.notes)
            event("updated",updated!!)
        }
        changed()
        if (offer?.decision?.action == Action.WAIT) check()
        return true
    }
    fun formatSize(bytes: Long) = if (bytes >= 1024*1024) "%.2f MiB".format(bytes/1048576.0) else "%.1f KiB".format(bytes/1024.0)
}
