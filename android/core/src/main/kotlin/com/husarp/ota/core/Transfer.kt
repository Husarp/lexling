package com.husarp.ota.core

import java.io.Closeable
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.util.concurrent.Executors
import java.util.concurrent.ExecutionException
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

class Response(val status: Int, val body: InputStream, val url: String, val rangeStart: Long? = null,
               private val disconnect: () -> Unit = {}) : Closeable {
    override fun close() { try { body.close() } finally { disconnect() } }
}
fun interface Transport { fun open(url: String, offset: Long): Response }
class HttpStatusException(val status: Int) : IOException("HTTP $status")
class HttpsTransport : Transport {
    override fun open(url: String, offset: Long): Response {
        var next = URI(url)
        val chain = mutableListOf<String>()
        repeat(8) {
            require(next.scheme == "https" && next.host != null && next.userInfo == null) { "Only HTTPS URLs are allowed" }
            chain.add(next.toString())
            val conn = next.toURL().openConnection() as HttpURLConnection
            conn.connectTimeout = 15000; conn.readTimeout = 15000; conn.instanceFollowRedirects = false
            conn.setRequestProperty("Accept-Encoding", "identity")
            if (offset > 0) conn.setRequestProperty("Range", "bytes=$offset-")
            val code = try { conn.responseCode } catch (e: Exception) { conn.disconnect(); throw e }
            if (code in listOf(301, 302, 303, 307, 308)) {
                val location = conn.getHeaderField("Location") ?: throw IOException("Redirect without Location")
                next = next.resolve(location); conn.disconnect()
            } else {
                if (code != 200 && code != 206) { conn.disconnect(); throw HttpStatusException(code) }
                val start = conn.getHeaderField("Content-Range")?.let { Regex("bytes ([0-9]+)-[0-9]+/[0-9]+").matchEntire(it)?.groupValues?.get(1)?.toLong() }
                val assetBase = assetManifestUrl(chain)
                return Response(code, conn.inputStream, assetBase, start) { conn.disconnect() }
            }
        }
        throw IOException("Too many redirects")
    }
}
// GitHub finally redirects each asset to a distinct expiring CDN URL. Its siblings are
// NOT sibling CDN paths. Preserve the tagged GitHub manifest URL from the redirect chain.
fun assetManifestUrl(chain: List<String>): String {
    require(chain.isNotEmpty())
    val tagged = chain.firstOrNull {
        val uri = URI(it)
        uri.host == "github.com" && Regex("/[^/]+/[^/]+/releases/download/[^/]+/[^/]+").matches(uri.path)
    }
    if (tagged != null) return tagged
    val initial = URI(chain.first())
    require(!(initial.host == "github.com" && initial.path.contains("/releases/latest/download/"))) { "Cannot pin GitHub release asset URLs" }
    return chain.last()
}
class IntegrityException(message: String) : IOException(message)
data class DownloadedManifest(val bytes: ByteArray, val finalUrl: String)
fun fetchManifest(url: String, transport: Transport, log: EventLog, allowMissing: Boolean = true): DownloadedManifest? {
    val started = System.nanoTime()
    try {
        transport.open(url, 0).use { r ->
            if (r.status != 200) throw HttpStatusException(r.status)
            val bytes = r.body.readBytesLimited(2 * 1024 * 1024)
            log.add("Manifest downloaded: ${bytes.size} bytes", (System.nanoTime() - started) / 1_000_000)
            return DownloadedManifest(bytes, r.url)
        }
    } catch (e: HttpStatusException) {
        if (!allowMissing || e.status != 404) throw e
        log.add("Manifest not found (HTTP 404): no update published", (System.nanoTime() - started) / 1_000_000)
        return null
    }
}
fun InputStream.readBytesLimited(limit: Int): ByteArray {
    val out = java.io.ByteArrayOutputStream(); val buf = ByteArray(8192)
    while (true) { val n = read(buf); if (n < 0) break; if (out.size().toLong() + n > limit) throw IntegrityException("Response too large"); out.write(buf, 0, n) }
    return out.toByteArray()
}

class Installer(private val root: File, private val embedded: Manifest, private val transport: Transport,
                private val log: EventLog, private val available: () -> Long = { root.usableSpace },
                private val progress: (String) -> Unit = {}, private val transferProgress: (Long, Long, Long) -> Unit = { _, _, _ -> }, private val beforeDownload: () -> Unit = {}) {
    fun stage(m: Manifest, current: Manifest, currentOverlay: (String) -> File?, manifestUrl: String): File? {
        val totalSize = m.files.sumOf { it.size }
        if (available() < 2 * totalSize) { log.add("Decision: storage low; need ${2 * totalSize} bytes, skip and retry later"); return null }
        val stagingRoot = File(root, "staging"); stagingRoot.mkdirs()
        val id = "${m.version}-${hash(json.toJson(m).toByteArray()).take(16)}"
        val staging = File(stagingRoot, id)
        stagingRoot.listFiles()?.filter { it.name != id }?.forEach { it.deleteRecursively() }
        val filesDir = File(staging, "files"); filesDir.mkdirs()
        val embeddedByPath = embedded.files.associateBy { it.path }
        val currentByPath = current.files.associateBy { it.path }
        val pool = Executors.newFixedThreadPool(4)
        val failure = AtomicReference<Exception?>()
        val networkBytes = AtomicLong()
        try {
            val tasks = m.files.mapIndexed { index, f -> pool.submit {
                try {
                    failure.get()?.let { throw it }
                    if (embeddedByPath[f.path]?.sha256 == f.sha256) {
                        log.add("Overlay ${f.path}: unchanged from APK; serve embedded")
                    } else {
                        val destination = File(filesDir, f.path); destination.parentFile!!.mkdirs()
                        if (destination.isFile && valid(destination, f)) {
                            log.add("Hash check ${f.path}: OK (verified staged file reused)")
                        } else {
                            destination.delete()
                            val source = if (currentByPath[f.path]?.sha256 == f.sha256) currentOverlay(f.path) else null
                            if (f.size == 0L) {
                                FileOutputStream(destination).use { it.fd.sync() }
                                log.add("Overlay ${f.path}: create empty file, 0 network bytes")
                            } else if (source != null && valid(source, f)) {
                                FileOutputStream(destination).use { out -> source.inputStream().use { it.copyTo(out) }; out.fd.sync() }
                                log.add("Overlay ${f.path}: reuse current overlay, 0 network bytes")
                            } else {
                                val url = URI(manifestUrl).resolve(f.asset).toString()
                                download(url, destination, f, index + 1, m.files.size, networkBytes) { failure.get()?.let { throw it } }
                            }
                            val started = System.nanoTime()
                            if (!valid(destination, f)) throw IntegrityException("Hash/size mismatch: ${f.path}")
                            log.add("Hash check ${f.path}: OK SHA-256 ${f.sha256}", (System.nanoTime() - started) / 1_000_000)
                        }
                    }
                } catch (e: Exception) {
                    // Integrity failure takes priority: never retain a poisoned staging tree.
                    if (e is IntegrityException) failure.set(e) else failure.compareAndSet(null, e)
                    throw e
                }
            } }
            // Join every writer before deleting, returning or publishing staging metadata.
            var interrupted = false
            for (task in tasks) {
                while (true) {
                    try { task.get(); break }
                    catch (_: InterruptedException) { interrupted = true; failure.compareAndSet(null, IOException("Download interrupted")) }
                    catch (e: ExecutionException) {
                        failure.compareAndSet(null, e.cause as? Exception ?: IOException("Download worker failed", e.cause))
                        break
                    }
                }
            }
            if (interrupted) Thread.currentThread().interrupt()
            failure.get()?.let { throw it }
            filesDir.walkBottomUp().filter { it.isDirectory }.forEach(::syncDirectory)
            atomicWrite(File(staging, "bundle.json"), json.toJson(m).toByteArray())
            syncDirectory(stagingRoot)
            log.add("All files ready; staging complete (state still points to old bundle)")
            return staging
        } catch (e: IntegrityException) {
            staging.deleteRecursively(); log.add("Hash check failed; whole staging deleted: ${e.message}"); throw e
        } catch (e: Exception) {
            log.add("Download interrupted/error; retain staging for resume: ${e.message}"); throw e
        } finally {
            pool.shutdown()
        }
    }
    private fun valid(file: File, f: BundleFile) = file.length() == f.size && hash(file) == f.sha256
    private fun download(url: String, target: File, f: BundleFile, index: Int, count: Int, networkBytes: AtomicLong, checkFailure: () -> Unit) {
        val part = File(target.parentFile, target.name + ".part")
        if (part.length() > f.size) part.delete()
        var offset = if (part.isFile) part.length() else 0L
        val started = System.nanoTime(); var received = 0L; var lastProgress = 0L
        if (offset > 0) log.add("Resume ${f.path} at $offset/${f.size} bytes")
        if (offset != f.size || !part.exists()) {
            checkFailure(); synchronized(this) { beforeDownload() }
            transport.open(url, offset).use { r ->
                if (r.status == 206) {
                    if (r.rangeStart != offset) throw IntegrityException("Incorrect Content-Range for ${f.path}")
                } else if (r.status == 200) {
                    if (offset > 0) log.add("Server ignored Range for ${f.path}; safely restart file")
                    offset = 0
                } else throw IOException("Unexpected HTTP ${r.status}")
                FileOutputStream(part, offset > 0).use { out ->
                    val buffer = ByteArray(65536)
                    while (true) {
                        checkFailure(); synchronized(this) { beforeDownload() }
                        val n = r.body.read(buffer); if (n < 0) break
                        if (offset + received + n > f.size) throw IntegrityException("Oversized file: ${f.path}")
                        out.write(buffer, 0, n); received += n
                        networkBytes.addAndGet(n.toLong())
                        val elapsed = (System.nanoTime() - started) / 1_000_000
                        if (elapsed - lastProgress >= 250) {
                            synchronized(this) {
                                transferProgress(offset + received, f.size, networkBytes.get())
                                progress("File $index/$count ${f.path}: ${offset + received}/${f.size} bytes · ${"%.1f".format(received * 1000.0 / elapsed.coerceAtLeast(1) / 1024)} KB/s")
                            }
                            lastProgress = elapsed
                        }
                    }
                    out.fd.sync()
                }
            }
        }
        if (part.length() != f.size) throw IOException("Incomplete file ${f.path}: ${part.length()}/${f.size}; will resume")
        check(part.renameTo(target)) { "File rename failed" }
        val ms = (System.nanoTime() - started) / 1_000_000
        val detail = "File downloaded ${f.path}: $received bytes (file ${f.size}), ${"%.1f".format(received * 1000.0 / ms.coerceAtLeast(1) / 1024)} KB/s · $index/$count"
        log.add(detail, ms); synchronized(this) { transferProgress(f.size, f.size, networkBytes.get()); progress(detail) }
    }
}
