package com.husarp.ota.core

import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.junit.Assert.*
import java.io.ByteArrayInputStream
import java.io.File
import java.nio.file.Files
import java.security.SecureRandom
import java.util.Base64

const val NOW = 1800000000000L
fun entry(path: String, text: String): BundleFile = BundleFile(path, hash(text.toByteArray()), text.toByteArray().size.toLong(), "f-${hash(text.toByteArray())}.bin")
fun bundle(version: String = "1.0.0", files: List<BundleFile> = listOf(entry("index.html", "embedded"),entry("stable.css", "style"))): Manifest =
    Manifest(version = version, releasedAt = NOW - 1000, expiresAt = NOW + 10000, kind = "fix", message = "Hello $version", files = files)
fun temp(): File = Files.createTempDirectory("ota-test-").toFile()
fun expectFailure(block: () -> Unit) { try { block(); fail("Expected failure") } catch (e: Exception) { /* expected */ } }
class Signing {
    val key = Ed25519PrivateKeyParameters(SecureRandom())
    val verifier = ManifestVerifier(key.generatePublicKey().encoded)
    fun sign(m: Manifest): ByteArray = signBytes(json.toJson(m).toByteArray())
    fun signBytes(bytes: ByteArray): ByteArray {
        val signer = Ed25519Signer(); signer.init(true, key); signer.update(bytes,0,bytes.size)
        return json.toJson(mapOf("payload" to Base64.getEncoder().encodeToString(bytes), "signature" to Base64.getEncoder().encodeToString(signer.generateSignature()))).toByteArray()
    }
}
class Harness(val root: File = temp(), val embedded: Manifest = bundle(), val shell: Int = 1) {
    val log = EventLog(File(root,"updater.log"))
    val engine = Engine(root,embedded,shell,log)
    fun stage(m: Manifest): File {
        val stage = File(root,"staging/${m.version}"); stage.mkdirs()
        atomicWrite(File(stage,"bundle.json"),json.toJson(m).toByteArray())
        return stage
    }
    fun pending(version: String): Manifest = bundle(version).also { engine.commit(it,stage(it)) }
    fun good(version: String) { pending(version); val l = engine.coldStart(); assertTrue(engine.ready(l.version,l.token)) }
}
