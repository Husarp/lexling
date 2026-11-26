package com.husarp.ota.core

import java.io.File
import java.time.Instant
import java.util.UUID

data class State(
    var shell: String = "", var current: String = "1.0.0", var previous: String? = null,
    var pending: String? = null, var trial: Boolean = false, var trialStarts: Int = 0,
    var notifiedVersion: String? = null,
    var rolledBack: RollbackNotice? = null,
    var failed: MutableList<String> = mutableListOf(), var blocked: MutableList<String> = mutableListOf()
)
class EventLog(private val file: File) {
    private var lines = runCatching { if (file.isFile) file.readLines().takeLast(500).toMutableList() else mutableListOf<String>() }.getOrDefault(mutableListOf())
    @Synchronized fun add(message: String, durationMs: Long = 0) {
        lines.add("${Instant.now()} | ${durationMs} ms | ${message.replace('\n', ' ')}")
        lines = lines.takeLast(500).toMutableList()
        // Diagnostic I/O must not stop startup or recovery when the device is full.
        runCatching { atomicWrite(file, (lines.joinToString("\n") + "\n").toByteArray()) }
    }
    @Synchronized fun read(): String = lines.asReversed().joinToString("\n")
    @Synchronized fun clear() { lines.clear(); runCatching { atomicWrite(file, byteArrayOf()) } }
}

data class RollbackNotice(val from: String, val to: String, val reason: String)
data class UpdatedNotice(val from: String, val to: String, val notes: String)
data class Launch(val version: String, val token: String, val notice: String?)
class Engine(val root: File, val embedded: Manifest, private val shellApi: Int, val log: EventLog) {
    val dates = UpdateDateStore(File(root, "update-dates.json"))
    private val stateFile = File(root, "state.json")
    val bundles = File(root, "bundles")
    private val fingerprint = "$shellApi:${embedded.version}"
    private var state: State = try {
        if (stateFile.exists()) json.fromJson(stateFile.readText(), State::class.java).also {
            versionParts(it.current); it.previous?.let(::versionParts); it.pending?.let(::versionParts)
            require(it.trialStarts >= 0); it.failed.forEach(::versionParts); it.blocked.forEach(::versionParts)
        } else State(shell = fingerprint, current = embedded.version)
    } catch (e: Exception) { log.add("State unreadable; emergency embedded fallback: ${e.message}"); State(shell = fingerprint, current = embedded.version) }
    private var token = ""
    private var loaded = embedded.version
    init { root.mkdirs(); bundles.mkdirs() }
    private fun save() = atomicWrite(stateFile, json.toJson(state).toByteArray())
    @Synchronized fun stateJson(): String = json.toJson(state)
    @Synchronized fun snapshot(): State = json.fromJson(json.toJson(state), State::class.java)
    fun manifest(version: String): Manifest = if (version == embedded.version) embedded else {
        versionParts(version)
        json.fromJson(File(bundles, "$version/bundle.json").readText(), Manifest::class.java).also { validateManifest(it); require(it.version == version) }
    }
    @Synchronized fun currentManifest(): Manifest = manifest(state.current)
    @Synchronized fun blocked(versions: List<String>) {
        versions.forEach { if (it !in state.blocked) state.blocked.add(it) }
        save()
        if (state.current in state.blocked) log.add("Kill switch: ${state.current} blocked; fallback scheduled for next start")
    }
    private fun fallback(): String = state.previous?.takeIf { it !in state.blocked && it !in state.failed && runCatching { manifest(it) }.isSuccess } ?: embedded.version
    private fun rollback(blocked: Boolean, reason: String = if (blocked) "blocked" else "failed-starts", notify: Boolean = true): String {
        val bad = state.current; val target = fallback()
        state.current = target; state.previous = null; state.trial = false; state.trialStarts = 0
        if (!blocked && bad !in state.failed) state.failed.add(bad)
        state.rolledBack = if (notify) RollbackNotice(bad, target, reason) else null
        state.notifiedVersion = target // Recovery is not a new-version announcement.
        save() // Make fallback durable before deleting the failed overlay.
        if (bad != embedded.version && bad != target) File(bundles, bad).deleteRecursively()
        val notice = if (blocked) "Update $bad was blocked; you're back on $target." else "Update $bad didn't start, you're back on $target. A fix is on the way."
        log.add("Rollback: $notice"); return notice
    }
    @Synchronized fun reconcileShell() {
        if (state.shell == fingerprint) return
        val started = System.nanoTime()
        fun usable(v: String?) = v != null && v !in state.blocked && v !in state.failed &&
            compareVersions(v, embedded.version) > 0 && runCatching {
                bundleCompatible(manifest(v), embedded, shellApi) { f ->
                    File(bundles, "$v/files/${f.path}").let { it.isFile && it.length() == f.size && hash(it) == f.sha256 }
                }
            }.getOrDefault(false)
        if (!usable(state.current)) {
            state.current = embedded.version; state.trial = false; state.trialStarts = 0
        }
        if (!usable(state.previous)) state.previous = null
        if (!usable(state.pending) || compareVersions(state.pending!!, state.current) <= 0) state.pending = null
        state.shell = fingerprint; save(); cleanup()
        File(root, "staging").deleteRecursively()
        log.add("New APK: selected newer compatible web; embedded ${embedded.version}, current ${state.current}, pending ${state.pending}; lists retained", (System.nanoTime()-started)/1_000_000)
    }
    @Synchronized fun coldStart(onApplying: (String) -> Unit = {}): Launch {
        val started = System.nanoTime(); var notice: String? = null; var activated = false
        try {
        reconcileShell()
        if (runCatching { manifest(state.current) }.isFailure) notice = rollback(false)
        if (state.current in state.blocked && state.current != embedded.version) notice = rollback(true)
        if (state.trial && state.trialStarts >= 2) notice = rollback(false)
        state.pending?.let { next ->
            if (next in state.failed || next in state.blocked || runCatching { manifest(next) }.isFailure) {
                log.add("Pending bundle unavailable/blocked; discard $next"); state.pending = null
            } else if (!state.trial) {
                onApplying(next)
                state.previous = state.current; state.current = next; state.pending = null
                state.trial = true; state.trialStarts = 0
                activated = true
                notice = "Updated to $next · ${manifest(next).message}"
                log.add("Staging → switch on start: ${state.previous} → $next")
            }
        }
        if (state.trial) { state.trialStarts++; log.add("Trial start count ${state.trialStarts}/2 for ${state.current}; recovery available before ready") }
        loaded = state.current; token = UUID.randomUUID().toString(); save()
        dates.record("web", loaded, manifest(loaded).releasedAt,
            installedAt = if (activated || loaded == embedded.version) System.currentTimeMillis() else null)
        cleanup()
        log.add("Cold start loaded $loaded", (System.nanoTime() - started) / 1_000_000)
        return Launch(loaded, token, notice)
        } catch (e: Exception) {
            // Never run an uncounted trial if its durable start record cannot be written.
            // Leave downloaded files alone; the next process can recover the last durable state.
            state = State(shell = fingerprint, current = embedded.version)
            loaded = embedded.version; token = UUID.randomUUID().toString()
            log.add("Startup storage/state error; emergency embedded fallback: ${e.message}")
            return Launch(loaded, token, null)
        }
    }
    @Synchronized fun ready(version: String, launchToken: String): Boolean {
        if (version != loaded || version != state.current || launchToken != token) {
            log.add("Ready signal ignored (stale page): $version"); return false
        }
        if (state.trial) {
            state.trial = false; state.trialStarts = 0; save(); cleanup()
            log.add("Ready signal accepted: $version; trial marked good, keep one previous")
        } else log.add("Ready signal accepted: $version (already good)")
        return true
    }
    // Claim only after the new page has drawn and accepted readiness. The durable
    // marker prevents duplicate events across repeated appReady calls and launches.
    @Synchronized fun takeUpdatedNotice(version: String, launchToken: String): UpdatedNotice? {
        if (version != loaded || version != state.current || launchToken != token || state.trial) return null
        val from = state.notifiedVersion ?: embedded.version
        if (from == version) return null
        val notice = UpdatedNotice(from,version,manifest(version).message)
        val previous = state.notifiedVersion
        state.notifiedVersion = version
        try { save() } catch (e: Exception) { state.notifiedVersion = previous; throw e }
        return notice
    }
    @Synchronized fun recoveryTarget(): String = fallback()
    @Synchronized fun recover(version: String, launchToken: String, reason: String): Boolean {
        if (!state.trial || version != loaded || version != state.current || launchToken != token) return false
        rollback(false, reason)
        return true
    }
    @Synchronized fun takeRollbackNotice(version: String, launchToken: String): RollbackNotice? {
        if (version != loaded || version != state.current || launchToken != token || state.trial) return null
        val notice = state.rolledBack ?: return null
        state.rolledBack = null
        try { save() } catch (e: Exception) { state.rolledBack = notice; throw e }
        return notice
    }
    @Synchronized fun commit(m: Manifest, staging: File, recoveryToken: String? = null) {
        validateManifest(m)
        require(m.minShellApi <= shellApi) { "Incompatible shell" }
        require(m.version !in state.failed && m.version !in state.blocked)
        require(compareVersions(m.version, state.current) > 0)
        require(recoveryToken == null || (recoveryToken == token && loaded == state.current && m.kind == "fix"))
        require(!state.trial || recoveryToken != null)
        val destination = File(bundles, m.version)
        // Unreferenced destination can exist if power failed after rename but before state write.
        require(m.version != state.current && m.version != state.previous)
        if (destination.exists()) destination.deleteRecursively()
        check(staging.renameTo(destination)) { "Staging rename failed" }
        syncDirectory(bundles); syncDirectory(staging.parentFile!!)
        dates.record("web", m.version, m.releasedAt, downloaded = true)
        state.pending = m.version
        if (state.trial) rollback(false, "startup-repair", notify = false) else save()
        cleanup()
        log.add("Staging → bundles/${m.version}; atomic state.json pending pointer committed")
    }
    @Synchronized fun reset() {
        state = State(shell = fingerprint, current = embedded.version); save()
        // The caller replaces the WebView immediately after this operation.
        bundles.deleteRecursively(); bundles.mkdirs(); File(root, "staging").deleteRecursively()
        log.add("Reset to embedded ${embedded.version}; downloaded bundles wiped")
    }
    private fun cleanup() {
        val keep = setOf(state.current, state.previous, state.pending)
        bundles.listFiles()?.filter { it.isDirectory && it.name !in keep }?.forEach { it.deleteRecursively() }
    }
    @Synchronized fun currentOverlayFile(path: String): File? =
        if (safePath(path) && state.current != embedded.version && manifest(state.current).files.any { it.path == path })
            File(bundles, "${state.current}/files/$path").takeIf { it.isFile } else null
    @Synchronized fun overlayFile(path: String): File? {
        if (!safePath(path) || loaded == embedded.version) return null
        // Only paths present in the signed inventory may be served.
        if (manifest(loaded).files.none { it.path == path }) return null
        return File(bundles, "$loaded/files/$path").takeIf { it.isFile }
    }
    @Synchronized fun hasPath(path: String): Boolean = safePath(path) && manifest(loaded).files.any { it.path == path }
}
