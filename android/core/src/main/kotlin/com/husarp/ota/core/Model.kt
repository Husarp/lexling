package com.husarp.ota.core

import com.google.gson.Gson
import com.google.gson.JsonParser
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.nio.channels.FileChannel
import java.nio.file.StandardOpenOption
import java.util.Base64

val json = Gson()
const val MAX_FILE = 512L * 1024 * 1024

data class BundleFile(val path: String, val sha256: String, val size: Long, val asset: String)
data class Manifest(
    val schema: Int = 1, val version: String, val minShellApi: Int = 1,
    val releasedAt: Long, val expiresAt: Long, val kind: String, val message: String,
    val blocked: List<String> = emptyList(), val files: List<BundleFile>
)

fun versionParts(version: String): List<Long> {
    require(Regex("(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})").matches(version)) { "Invalid version: $version" }
    return version.split('.').map { it.toLong() }
}
fun compareVersions(a: String, b: String): Int {
    val x = versionParts(a); val y = versionParts(b)
    for (i in 0..2) if (x[i] != y[i]) return x[i].compareTo(y[i])
    return 0
}
fun safePath(path: String): Boolean = path.length in 1..200 && path.split('/').all {
    it.isNotEmpty() && it != "." && it != ".." && Regex("[A-Za-z0-9_][A-Za-z0-9_.@-]*").matches(it)
}
fun hash(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
fun hash(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input -> val buffer = ByteArray(65536); while (true) { val n = input.read(buffer); if (n < 0) break; digest.update(buffer, 0, n) } }
    return digest.digest().joinToString("") { "%02x".format(it) }
}
fun syncDirectory(directory: File) {
    FileChannel.open(directory.toPath(), StandardOpenOption.READ).use { it.force(true) }
}
fun atomicWrite(target: File, bytes: ByteArray) {
    target.parentFile!!.mkdirs()
    val tmp = File(target.parentFile, target.name + ".tmp")
    FileOutputStream(tmp).use { it.write(bytes); it.fd.sync() }
    check(tmp.renameTo(target)) { "Atomic rename failed: ${target.name}" }
    syncDirectory(target.parentFile!!)
}

class ManifestVerifier(private val publicKey: ByteArray) {
    private fun payload(envelope: ByteArray): ByteArray {
        require(envelope.size <= 2 * 1024 * 1024) { "Manifest too large" }
        val tree = JsonParser.parseString(envelope.toString(Charsets.UTF_8)).asJsonObject
        val payload = Base64.getDecoder().decode(tree["payload"].asString)
        val signature = Base64.getDecoder().decode(tree["signature"].asString)
        val signer = Ed25519Signer()
        signer.init(false, Ed25519PublicKeyParameters(publicKey, 0))
        signer.update(payload, 0, payload.size)
        require(signer.verifySignature(signature)) { "Signature failed" }
        return payload
    }
    fun verifyShell(envelope: ByteArray, now: Long, installedCode: Long): ShellManifest {
        val m = json.fromJson(payload(envelope).toString(Charsets.UTF_8), ShellManifest::class.java)
        validateShell(m, now, installedCode)
        return m
    }
    fun verify(envelope: ByteArray, now: Long): Manifest {
        val m = json.fromJson(payload(envelope).toString(Charsets.UTF_8), Manifest::class.java)
        validateManifest(m)
        require(m.releasedAt <= now) { "Release is in the future (check phone clock)" }
        require(m.expiresAt > now && m.expiresAt > m.releasedAt) { "Manifest expired or invalid expiry" }
        return m
    }
}
fun validateManifest(m: Manifest) {
    require(m.schema == 1 && m.minShellApi >= 1) { "Unsupported schema/shell" }
    versionParts(m.version); m.blocked.forEach { versionParts(it) }
    require(m.kind in listOf("fix", "feature")) { "Invalid kind" }
    require(m.message.length <= 10000 && m.blocked.size <= 1000) { "Metadata too large" }
    require(m.files.size in 1..10000 && m.files.map { it.path }.distinct().size == m.files.size) { "Invalid file list" }
    m.files.forEach {
        require(safePath(it.path) && Regex("[0-9a-f]{64}").matches(it.sha256) && it.size in 0..MAX_FILE) { "Invalid file entry" }
        require(Regex("[A-Za-z0-9][A-Za-z0-9._-]*").matches(it.asset)) { "Unsafe asset name" }
    }
    require(m.files.sumOf { it.size } <= 1024L * 1024 * 1024) { "Bundle too large" }
    require(m.files.any { it.path == "index.html" }) { "Missing index.html" }
}

enum class Action { REJECT, FULL_APP, PROMPT, AUTO, WAIT }
data class Decision(val action: Action, val reason: String, val delta: Long = 0)
fun decide(m: Manifest, current: Manifest, embedded: Manifest, shellApi: Int, settings: UpdateSettings, unmetered: Boolean,
           failed: Collection<String>, blocked: Collection<String>, trial: Boolean, pending: String?, startupRecovery: Boolean = false): Decision {
    if (m.version in failed) return Decision(Action.REJECT, "Version previously failed")
    if (m.version in blocked || m.version in m.blocked) return Decision(Action.REJECT, "Version blocked")
    if (compareVersions(m.version, current.version) <= 0) return Decision(Action.REJECT, "Equal or lower version")
    if (pending != null) {
        val comparison = compareVersions(m.version, pending)
        if (comparison < 0 || (comparison == 0 && !startupRecovery)) return Decision(Action.WAIT, "Update already staged")
    }
    if (m.minShellApi > shellApi) return Decision(Action.FULL_APP, "This update needs the full app update (shellApi ${m.minShellApi})")
    if (startupRecovery && m.kind != "fix") return Decision(Action.REJECT, "No startup fix published")
    if (trial && !startupRecovery) return Decision(Action.WAIT, "Waiting for current trial to signal ready")
    val currentHashes = current.files.associate { it.path to it.sha256 }
    val embeddedHashes = embedded.files.associate { it.path to it.sha256 }
    val delta = m.files.filter { currentHashes[it.path] != it.sha256 && embeddedHashes[it.path] != it.sha256 }.sumOf { it.size }
    if (startupRecovery) return Decision(Action.PROMPT, "Startup repair needs consent", delta)
    val critical = current.version in blocked || current.version in m.blocked
    return if (automaticDownload(settings, m.kind, delta, unmetered, critical))
        Decision(Action.AUTO, "Automatic update allowed", delta)
    else Decision(Action.PROMPT, "Update needs consent (settings, setup or network limit)", delta)
}

