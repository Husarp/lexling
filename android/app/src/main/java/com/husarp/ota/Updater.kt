package com.husarp.ota
import com.husarp.lexling.BuildConfig
import com.husarp.lexling.R

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.getcapacitor.JSObject
import com.husarp.ota.core.*
import java.net.URI
import java.io.File
import java.util.Base64
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean

internal data class TransferState(val done: Long, val total: Long, val speed: Long) {
    fun snapshot() = JSObject().put("done", done).put("total", total).put("speed", speed)
}

class Updater(private val context: Context, val engine: Engine, private val verifier: ManifestVerifier) {
    companion object {
        val DEFAULT_URL = BuildConfig.OTA_BUNDLE_URL
        val RELEASES_URL = BuildConfig.OTA_RELEASES_URL
        val SHELL_URL = BuildConfig.OTA_SHELL_URL
    }
    private val prefs = context.getSharedPreferences("ota-settings", Context.MODE_PRIVATE)
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

    fun simulateBrokenStart() = prefs.edit().putBoolean("simulateBrokenStart", true).commit()

    private fun selectLaunch() {
        val next = engine.coldStart { version ->
            if (activation.advance(version)) changed()
        }
        val simulate = prefs.getBoolean("simulateBrokenStart", false) &&
            prefs.edit().remove("simulateBrokenStart").commit()
        watchdog.launch(next.token, SystemClock.elapsedRealtime(), simulate)
        launch = next
        if (simulate) engine.log.add("Ignoring ready for this launch (debug simulation)")
    }
    private var shellEventVersion: Long? = null
    private val waitingWeb = File(engine.root,"waiting-web.json")
    private data class WaitingWeb(val envelope: String, val source: String)
    private fun eligibleWaiting(): DownloadedManifest? {
        if (!waitingWeb.isFile) return null
        return runCatching {
            val saved=json.fromJson(waitingWeb.readText(), WaitingWeb::class.java)
            val bytes=Base64.getDecoder().decode(saved.envelope)
            val m=verifier.verify(bytes,System.currentTimeMillis())
            val state=engine.snapshot()
            if (compareVersions(m.version,state.current)<=0 || m.version in state.failed || m.version in state.blocked) { waitingWeb.delete(); null }
            else if (webWaitsForShell(m,BuildConfig.SHELL_API)) null
            else { engine.log.add("Rechecking signed waiting web ${m.version}: shell now compatible"); DownloadedManifest(bytes,saved.source) }
        }.getOrElse { engine.log.add("Waiting web invalid/expired: ${it.message}"); waitingWeb.delete(); null }
    }
    var onChange: (() -> Unit)? = null
    var onToast: ((Int) -> Unit)? = null
    val eventListeners = CopyOnWriteArrayList<(String, JSObject) -> Unit>()
    val checks = UpdateChecks(context, engine.log) { changed() }
    val shell = ShellUpdater(context.applicationContext, engine, verifier, checks, { safeToInterrupt }, { changed() }, { updateSettings() }, { unmetered() })
    @Volatile private var readyWeb: Pair<String, Boolean>? = null
    fun webCheckNotices() = readyWeb?.takeIf { it.first == launch.token }?.second
    fun retryChecks() { check(true); shell.check(manual = true) }
    fun retryCheck(channel: CheckChannel) {
        if (channel == CheckChannel.WEB) check(true) else shell.check(manual = true)
    }
    init {
        val installedAt = context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime
        // Only a date for Settings: a full disk must not stop the app before the built-in version can start.
        runCatching { engine.dates.record("shell", BuildConfig.VERSION_CODE.toString(), BuildConfig.SHELL_RELEASED_AT, installedAt = installedAt) }
            .onFailure { engine.log.add("Could not record the app install date: ${it.message}") }
        runCatching { engine.reconcileShell() }.onFailure { engine.log.add("Shell reconciliation failed: ${it.message}") } }
    @Volatile private var settings = readSettings()
    private fun readSettings(): UpdateSettings {
        val migrated = migrateUpdateSettings(if(prefs.contains("automatic")) prefs.getBoolean("automatic",true) else null)
        return UpdateSettings(
            prefs.getBoolean("smallFixes",migrated.smallFixes), prefs.getBoolean("majorUpdates",migrated.majorUpdates),
            prefs.getBoolean("shellUpdates",true), prefs.getInt("wifiLimitMb",20), prefs.getInt("mobileLimitMb",5),
            prefs.getBoolean("setupAnswered",false), prefs.getString("checkFrequency","6h")!!).validate()
    }
    fun updateSettings(): UpdateSettings = settings
    fun settingsJson(): JSObject = JSObject(json.toJson(settings)).put("url",url)
        .put("updateNotifications", ShellUpdatedNotification.enabled(context))
    var showShellMessages: Boolean
        get() = prefs.getBoolean("showShellMessages",false)
        set(value) { prefs.edit().putBoolean("showShellMessages",value).apply(); changed() }
    @Synchronized fun setUpdateSettings(partial: JSObject): JSObject {
        val allowed = setOf("smallFixes","majorUpdates","shellUpdates","wifiLimitMb","mobileLimitMb","setupAnswered","checkFrequency","url","updateNotifications")
        val keys = partial.keys()
        while(keys.hasNext()) {
            val key = keys.next(); require(key in allowed) { "Unknown setting: $key" }
            val value = partial.get(key)
            require(if(key == "checkFrequency" || key == "url") value is String else if(key.endsWith("Mb")) value is Number && value.toDouble() == value.toInt().toDouble() else value is Boolean) { "Invalid setting: $key" }
        }
        val oldUrl = url
        val nextUrl = partial.optString("url",oldUrl)
        validateUrl(nextUrl)
        val old = settings
        val next = UpdateSettings(partial.optBoolean("smallFixes",old.smallFixes),partial.optBoolean("majorUpdates",old.majorUpdates),
            partial.optBoolean("shellUpdates",old.shellUpdates),partial.optInt("wifiLimitMb",old.wifiLimitMb),
            partial.optInt("mobileLimitMb",old.mobileLimitMb),partial.optBoolean("setupAnswered",old.setupAnswered), partial.optString("checkFrequency",old.checkFrequency)).validate()
        val notifications = partial.optBoolean("updateNotifications", ShellUpdatedNotification.enabled(context))
        kotlin.check(prefs.edit().putBoolean("smallFixes",next.smallFixes).putBoolean("majorUpdates",next.majorUpdates)
            .putBoolean("updateNotifications", notifications)
            .putBoolean("shellUpdates",next.shellUpdates).putInt("wifiLimitMb",next.wifiLimitMb).putInt("mobileLimitMb",next.mobileLimitMb)
            .putString("checkFrequency",next.checkFrequency).putBoolean("setupAnswered",next.setupAnswered).putString("url",nextUrl).remove("automatic").commit())
        if (nextUrl != oldUrl) offer = null
        settings = next
        if (!notifications) ShellUpdatedNotification.cancel(context)
        event("updateSettingsChanged",settingsJson()); changed()
        UpdateWorker.schedule(context,true)
        shell.maybeInstall()
        if(next.automaticChecks) { check(); shell.check() }
        return settingsJson()
    }
    fun unmetered(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        return cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_NOT_METERED) == true
    }
    val automatic get() = settings.smallFixes // legacy info field
    var url: String
        get() = prefs.getString("url", DEFAULT_URL)!!
        set(value) { setUpdateSettings(JSObject().put("url",value)) }
    private fun validateUrl(value: String) {
        val u = URI(value)
        require(u.scheme == "https" && u.host != null && u.userInfo == null && u.fragment == null) { "Use an HTTPS manifest URL" }
    }
    private fun changed() { main.post {
        onChange?.invoke()
        eventListeners.forEach { it("updateStateChanged", JSObject()) }
        val m = shell.manifest()?.takeIf { shell.isReady() }
        if (m == null) shellEventVersion = null
        else if (shellEventVersion != m.versionCode) {
            shellEventVersion = m.versionCode
            event("shellUpdateReady", shell.state(m))
        }
    } }
    private fun message(text: String) { status = text; changed() }
    private fun toast(message: Int) { main.post { onToast?.invoke(message) } }
    private fun event(name: String, data: JSObject) { main.post { eventListeners.forEach { it(name, data) } } }
    fun subscribe(listener: (String, JSObject) -> Unit) {
        eventListeners.add(listener)
        // The startup check may finish before Capacitor creates the plugin.
        // Reconstruct the current offer/staged event for late web listeners.
        main.post {
            availableState()?.let { listener("updateAvailable",it) }
            stagedState()?.let { listener("updateStaged",it) }
            if (shell.isReady()) shell.manifest()?.let {
                listener("shellUpdateReady",shell.state(it))
            }

        }
    }
    fun setForeground(value: Boolean) {
        foreground = value; engine.log.add("App ${if(value) "start/resume" else "stop"}; safe=$safeToInterrupt")
        if (value) shell.maybeInstall()
        changed()
    }
    fun setSafeToInterrupt(value: Boolean) {
        if (safeToInterrupt == value) return
        safeToInterrupt = value; engine.log.add("Safe to interrupt = $value; deferred actions re-evaluated")
        if (value) shell.maybeInstall()
        changed()
    }
    // Workers never call coldStart: a background process must not consume a trial.
    fun prepareLaunch() {
        if (prepared) return
        safeToInterrupt = false
        val start = SystemClock.elapsedRealtime()
        engine.log.add("Quick apply start: launch held at most ${QUICK_APPLY_MS} ms")
        val pending = engine.snapshot().pending != null
        if (!pending && settings.checksOnOpen) {
            val check = check(false)
            val result=awaitQuickApply(check,SystemClock.elapsedRealtime()-start,false)
            engine.log.add("Quick apply $result; timeout/error keeps current and lets background work continue",SystemClock.elapsedRealtime()-start)
        }
        selectLaunch(); prepared = true; launching = false
        if(launch.notice!=null) status="Ready · ${launch.version}"
        engine.log.add("Quick apply finished: ${launch.version}; existing staged=$pending", SystemClock.elapsedRealtime()-start)
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
        put("token", launch.token); put("status", status); put("automatic", automatic); put("url", url)
        put("canDownload", !busy.get() && availableOffer() != null)
        put("needsShell", offer?.decision?.action == Action.FULL_APP)
        put("webDownloadVersion", webDownloadVersion); put("pending", engine.snapshot().pending); put("trial", engine.snapshot().trial)
        put("safeToInterrupt", safeToInterrupt); put("shellStatus", shell.status)
        val webInstalling = activation.current?.version
        val shellInstalling = shell.installingTarget()
        put("installingVersion", webInstalling ?: shellInstalling?.versionName)
        put("installingChannel", if (webInstalling != null) "web" else if (shellInstalling != null) "shell" else null)
        if (webInstalling == null) put("installingShellVersionCode", shellInstalling?.versionCode)
        put("available",availableState()); put("staged",stagedState()); put("updated",updated); put("rolledBack",rolledBack)
        put("shellUpdateReady",shell.isReady()); put("shellVersionCode",shell.manifest()?.versionCode)
        put("shellReady",shell.manifest()?.takeIf { shell.isReady() }?.let {
            shell.state(it)
        })
        put("busy",busy.get()); put("downloading",consentDownloading); put("progress",progressPercent)
        put("webTransfer",transfer?.snapshot()); put("shellTransfer",shell.transfer?.snapshot())
        val shellDownload = shell.downloadTarget()
        put("shellDownloading",shell.downloading); put("shellDownloadVersion",shellDownload?.versionName)
        put("shellDownloadVersionCode",shellDownload?.versionCode); put("shellNotes",shell.installedNotes())
        put("autoRestart",autoRestartPending)
        put("updateSettings",settingsJson()); put("shellAvailable",shell.availableState())
    }
    private fun availableState(): JSObject? = offer?.takeIf {
        it.decision.action in listOf(Action.PROMPT,Action.FULL_APP) && it.manifest.version != laterVersion &&
            compareVersions(it.manifest.version, launch.version) > 0 && it.manifest.version != activation.current?.version
    }?.let {
        webState(it.manifest).put("version",it.manifest.version).put("kind",it.manifest.kind)
            .put("size",it.decision.delta).put("needsShell",it.decision.action==Action.FULL_APP)
    }
    private fun stagedState(): JSObject? = engine.snapshot().pending?.let { version ->
        runCatching { engine.manifest(version) }.getOrNull()?.let {
            webState(it).put("version",it.version).put("kind",it.kind)
        }
    }
    private fun webState(m: Manifest): JSObject = JSObject(json.toJson(engine.dates.get("web", m.version)))
        .put("releasedAt", m.releasedAt).put("version", m.version)
    data class Available(val version: String, val size: Long)
    fun availableOffer(): Available? = offer?.takeIf { it.decision.action == Action.PROMPT && it.manifest.version != laterVersion }?.let { Available(it.manifest.version, it.decision.delta) }
    fun later() { laterVersion = offer?.manifest?.version; engine.log.add("Later: hide $laterVersion until next cold start"); changed() }
    @Synchronized fun check(manual: Boolean = false): Future<*>? {
        if (!manual && !settings.automaticChecks) return null
        if (!busy.compareAndSet(false, true)) { engine.log.add("Check coalesced: updater busy"); return currentCheck }
        lastCheckSucceeded = false
        val task = worker.submit {
            val started = System.nanoTime()
            try {
                engine.log.add("Check started (${if (manual) "Check now" else "background/start"})")
                message("Checking…")
                val sigStart = System.nanoTime()
                val waiting = if (manual) null else eligibleWaiting()
                val (downloaded, m) = if (waiting != null) waiting to verifier.verify(waiting.bytes, System.currentTimeMillis())
                else checks.fetch(CheckChannel.WEB, url, transport, manual) { verifier.verify(it.bytes, System.currentTimeMillis()) }
                engine.log.add("Signature OK (Ed25519); expiry/release/file inventory OK", (System.nanoTime()-sigStart)/1_000_000)
                if (compareVersions(m.version, engine.snapshot().current) > 0)
                    engine.dates.record("web", m.version, m.releasedAt, available = true)
                engine.blocked(m.blocked)
                val s = engine.snapshot()
                val d = decide(m, engine.currentManifest(), engine.embedded, BuildConfig.SHELL_API, settings, unmetered(), s.failed, s.blocked, s.trial, s.pending)
                engine.log.add("Decision ${d.action}: ${d.reason}; delta ${d.delta} bytes")
                offer = Offer(m, downloaded, d)
                when (d.action) {
                    Action.AUTO -> install(offer!!, false)
                    Action.PROMPT -> {
                        message("New version ${m.version} · ${formatSize(d.delta)}")
                        event("updateAvailable", webState(m).put("version",m.version).put("size",d.delta).put("kind",m.kind).put("needsShell",false))
                    }
                    Action.FULL_APP -> {
                        // Cache the signed envelope, not a trusted unsigned decision. Recheck after APK replacement.
                        atomicWrite(waitingWeb,json.toJson(WaitingWeb(Base64.getEncoder().encodeToString(downloaded.bytes),downloaded.finalUrl)).toByteArray())
                        engine.log.add("Web waits for shellApi ${m.minShellApi}; shell update proceeds independently")
                        message("${m.version}: ${d.reason}")
                        availableState()?.let { event("updateAvailable",it) }
                    }
                    else -> message("${m.version}: ${d.reason}")
                }
                lastCheckSucceeded=true
            } catch (e: Exception) {
                engine.log.add("Signature/check/download error: ${e.javaClass.simpleName}: ${e.message}")
                message(if (e is CheckException) e.failure.message else "Update processing failed. See Logs.")
            } finally {
                webDownloadVersion = null; transfer = null
                busy.set(false); engine.log.add("Check finished", (System.nanoTime()-started)/1_000_000); changed()
            }
        }
        currentCheck = task
        return task
    }
    fun download(installAfterDownload: Boolean = true): Boolean {
        val selected = offer ?: return false
        if (selected.decision.action != Action.PROMPT || !busy.compareAndSet(false, true)) return false
        webDownloadVersion = selected.manifest.version
        transfer = TransferState(0, selected.decision.delta, 0)
        consentDownloading = true; progressPercent = 0; message("Preparing download ${selected.manifest.version}")
        worker.execute {
            try { install(selected, true, installAfterDownload = installAfterDownload) } catch (e: Exception) {
                engine.log.add("Error downloading: ${e.message}"); message("Download failed; retry Check now. See Logs.")
            } finally { webDownloadVersion = null; transfer = null; busy.set(false); consentDownloading = false; changed() }
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

    private fun isStagedFix(manifest: Manifest) = engine.snapshot().pending == manifest.version &&
        runCatching { engine.manifest(manifest.version) == manifest }.getOrDefault(false)

    internal fun checkForStartupFix(complete: (StartupFix?, String, Boolean) -> Unit) {
        val strings = NativeStrings.context(context)
        if (!busy.compareAndSet(false, true)) { complete(null, strings.getString(R.string.ota_startup_fix_busy), false); return }
        val token = launch.token
        worker.execute {
            var fix: StartupFix? = null
            var failedCheck = false
            val result = try {
                val (source, manifest) = checks.fetch(CheckChannel.WEB, url, transport, reportFailure = false) {
                    verifier.verify(it.bytes, System.currentTimeMillis())
                }
                val selected = startupOffer(source, manifest)
                if (selected.decision.action != Action.PROMPT) {
                    engine.log.add("Startup fix unavailable: ${selected.decision.reason}")
                    strings.getString(if (selected.decision.action == Action.FULL_APP)
                        R.string.ota_app_update_first else R.string.ota_no_startup_fix)
                } else {
                    val staged = isStagedFix(selected.manifest)
                    val bytes = if (staged) 0 else selected.decision.delta
                    fix = StartupFix(token, staged, source)
                    if (staged) strings.getString(R.string.ota_startup_fix_ready, selected.manifest.version)
                    else strings.getString(R.string.ota_startup_fix_offer, selected.manifest.version, formatSize(bytes))
                }
            } catch (e: Exception) {
                engine.log.add("Startup fix check failed: ${e.message}")
                failedCheck = e is CheckException
                if (e is CheckException) strings.checkFailureText(e.failure) else strings.getString(R.string.ota_startup_fix_check_failed)
            } finally { busy.set(false); changed() }
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
                restartLaunch()
                null
            } catch (e: Exception) {
                engine.log.add("Startup fix failed: ${e.message}")
                strings.getString(R.string.ota_startup_fix_apply_failed)
            } finally { busy.set(false); changed() }
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
            message("New version ${m.version} · ${formatSize(d.delta)}")
            return false
        }
        require(d.action == Action.AUTO || (consent && d.action == Action.PROMPT)) { d.reason }
        webDownloadVersion = m.version
        offer = null
        val started = SystemClock.elapsedRealtime()
        val downloadSpeed = DownloadSpeed(started)
        engine.log.add("${if(consent) "Consented" else "Automatic"} download ${m.version}: ${d.delta} bytes")
        transfer = TransferState(0, d.delta, 0)
        message("Downloading ${m.version} · ${formatSize(d.delta)}")
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
        waitingWeb.delete()
        autoRestartPending = consent && recoveryToken == null && installAfterDownload
        message("Fixes downloaded (${m.version}) · Restart")
        engine.log.add("Update staged ${m.version}; consent=$consent, foreground=$foreground, safe=$safeToInterrupt", SystemClock.elapsedRealtime()-started)
        transfer?.let { engine.log.add("Web transfer ${it.done}/${it.total} bytes at ${it.speed} B/s") }
        event("updateStaged",webState(m).put("version",m.version).put("size",d.delta).put("kind",m.kind))
        return true
    }
    fun restart(reset: Boolean = false, startupRecovery: Boolean = false, complete: () -> Unit): Boolean {
        if (!startupRecovery && !safeToInterrupt) { toast(R.string.ota_wait_before_restart); return false }
        if (!busy.compareAndSet(false, true)) { toast(R.string.ota_wait_for_download); return false }
        launching = true
        if (!reset) engine.snapshot().pending?.let(activation::begin)
        changed()
        worker.execute {
            try {
                if (reset) {
                    engine.reset(); waitingWeb.delete()
                    setUpdateSettings(JSObject().put("setupAnswered",false))
                }
                restartLaunch()
                main.post { complete() }
            } catch (e: Exception) { activation.clear(); engine.log.add("Restart error: ${e.message}"); message("Restart failed; see Logs") }
            finally { busy.set(false); launching = false; changed() }
        }
        return true
    }
    private fun restartLaunch() {
        selectLaunch(); offer = null; laterVersion = null
        activation.current?.let { if (it.version != launch.version) activation.clear() }
        status = "Ready · ${launch.version}"; autoRestartPending = false; safeToInterrupt = true
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
        if (waitingWeb.exists()) check()
        return true
    }
    fun formatSize(bytes: Long) = if (bytes >= 1024*1024) "%.2f MiB".format(bytes/1048576.0) else "%.1f KiB".format(bytes/1024.0)
}
