package com.husarp.ota.core

import java.io.File

/** Device lifecycle facts. Missing historical steps stay unknown; first observations never move. */
data class UpdateDates(val publishedAt: Long? = null, val availableAt: Long? = null,
                       val downloadedAt: Long? = null, val installedAt: Long? = null,
                       val approvedEarly: Boolean = false)

private const val UPDATE_DELAY_MS = 2 * 60 * 60 * 1000L

fun updateAgeAllows(wait: Boolean, publishedAt: Long?, firstSeenAt: Long?, now: Long,
                    manual: Boolean = false, recovery: Boolean = false): Boolean {
    if (!wait || manual || recovery) return true
    // If the release was already in the future at first sight, keep using first sight as time passes.
    val start = publishedAt?.takeIf { it > 0 && it <= now && (firstSeenAt == null || it <= firstSeenAt) }
        ?: firstSeenAt ?: return false
    return start <= now && now - start >= UPDATE_DELAY_MS
}

class UpdateDateStore(private val file: File, private val now: () -> Long = System::currentTimeMillis) {
    private val records: MutableMap<String, UpdateDates> = runCatching {
        val type = object : com.google.gson.reflect.TypeToken<MutableMap<String, UpdateDates>>() {}.type
        if (file.isFile) json.fromJson<MutableMap<String, UpdateDates>>(file.readText(), type) else mutableMapOf()
    }.getOrNull() ?: mutableMapOf()
    @Synchronized fun get(kind: String, version: String): UpdateDates = records["$kind:$version"] ?: UpdateDates()
    @Synchronized fun record(kind: String, version: String, publishedAt: Long? = null,
                             available: Boolean = false, downloaded: Boolean = false, installedAt: Long? = null,
                             approvedEarly: Boolean = false): UpdateDates {
        val old = get(kind, version)
        val next = old.copy(publishedAt = publishedAt?.takeIf { it > 0 } ?: old.publishedAt,
            availableAt = old.availableAt ?: if (available) now() else null,
            downloadedAt = old.downloadedAt ?: if (downloaded) now() else null,
            installedAt = if (kind == "shell") installedAt?.takeIf { it > 0 } ?: old.installedAt
                else old.installedAt ?: installedAt?.takeIf { it > 0 }, approvedEarly = old.approvedEarly || approvedEarly)
        if (next != old) {
            val updated = records.toMutableMap().apply { put("$kind:$version", next) }
            atomicWrite(file, json.toJson(updated).toByteArray())
            records["$kind:$version"] = next
        }
        return next
    }
}
