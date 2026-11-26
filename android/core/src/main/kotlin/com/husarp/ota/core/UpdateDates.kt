package com.husarp.ota.core

import java.io.File

/** Device lifecycle facts. Missing historical steps stay unknown; first observations never move. */
data class UpdateDates(val publishedAt: Long? = null, val availableAt: Long? = null,
                       val downloadedAt: Long? = null, val installedAt: Long? = null)
class UpdateDateStore(private val file: File, private val now: () -> Long = System::currentTimeMillis) {
    private val records: MutableMap<String, UpdateDates> = runCatching {
        val type = object : com.google.gson.reflect.TypeToken<MutableMap<String, UpdateDates>>() {}.type
        if (file.isFile) json.fromJson<MutableMap<String, UpdateDates>>(file.readText(), type) else mutableMapOf()
    }.getOrNull() ?: mutableMapOf()
    @Synchronized fun get(kind: String, version: String): UpdateDates = records["$kind:$version"] ?: UpdateDates()
    @Synchronized fun record(kind: String, version: String, publishedAt: Long? = null,
                             available: Boolean = false, downloaded: Boolean = false, installedAt: Long? = null): UpdateDates {
        val old = get(kind, version)
        val next = old.copy(publishedAt = publishedAt?.takeIf { it > 0 } ?: old.publishedAt,
            availableAt = old.availableAt ?: if (available) now() else null,
            downloadedAt = old.downloadedAt ?: if (downloaded) now() else null,
            installedAt = if (kind == "shell") installedAt?.takeIf { it > 0 } ?: old.installedAt
                else old.installedAt ?: installedAt?.takeIf { it > 0 })
        if (next != old) {
            val updated = records.toMutableMap().apply { put("$kind:$version", next) }
            atomicWrite(file, json.toJson(updated).toByteArray())
            records["$kind:$version"] = next
        }
        return next
    }
}
