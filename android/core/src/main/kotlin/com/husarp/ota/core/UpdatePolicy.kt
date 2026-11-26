package com.husarp.ota.core

const val QUICK_APPLY_MS = 2000L
data class ShellManifest(
    val schema: Int = 1, val versionCode: Long, val versionName: String, val shellApi: Int,
    val apk: String, val size: Long, val sha256: String, val embeddedWebVersion: String,
    val notes: String, val releasedAt: Long, val expiresAt: Long
)
fun validateShell(m: ShellManifest, now: Long, installedCode: Long) {
    require(m.schema == 1 && m.shellApi > 0) { "Invalid shell schema/API" }
    require(m.versionCode in 1..2147483647L && m.versionCode > installedCode) { "Shell downgrade/equal versionCode" }
    versionParts(m.versionName); versionParts(m.embeddedWebVersion)
    require(Regex("[A-Za-z0-9_-][A-Za-z0-9_.-]*\\.apk").matches(m.apk) && m.apk.length <= 200) { "Unsafe APK name" }
    require(m.size in 1..MAX_FILE && Regex("[0-9a-f]{64}").matches(m.sha256)) { "Invalid APK size/hash" }
    require(m.notes.length <= 10000) { "Shell notes too large" }
    require(m.releasedAt <= now && m.expiresAt > now && m.expiresAt > m.releasedAt) { "Shell expired/future release" }
}
// Shared by startup, worker and UI. Timeouts select the current bundle without cancelling work.
fun quickApplyRemaining(elapsedMs: Long, pending: Boolean): Long =
    if (pending) 0 else (QUICK_APPLY_MS - elapsedMs).coerceIn(0, QUICK_APPLY_MS)
fun webWaitsForShell(m: Manifest, shellApi: Int) = m.minShellApi > shellApi
fun bundleCompatible(m: Manifest, embedded: Manifest, shellApi: Int, overlayExists: (BundleFile) -> Boolean): Boolean =
    !webWaitsForShell(m, shellApi) && m.files.all { f ->
        embedded.files.any { it.path == f.path && it.sha256 == f.sha256 && it.size == f.size } || overlayExists(f)
    }

enum class QuickApplyResult { READY, CURRENT, TIMED_OUT, FAILED }
fun awaitQuickApply(check: java.util.concurrent.Future<*>?, elapsedMs: Long, pending: Boolean): QuickApplyResult {
    if(pending) return QuickApplyResult.READY
    if(check==null) return QuickApplyResult.CURRENT
    val remaining=quickApplyRemaining(elapsedMs,false)
    return try {
        if(remaining==0L && !check.isDone) return QuickApplyResult.TIMED_OUT
        check.get(remaining,java.util.concurrent.TimeUnit.MILLISECONDS)
        QuickApplyResult.READY
    } catch(_: java.util.concurrent.TimeoutException) { QuickApplyResult.TIMED_OUT }
      catch(_: Exception) { QuickApplyResult.FAILED }
}
