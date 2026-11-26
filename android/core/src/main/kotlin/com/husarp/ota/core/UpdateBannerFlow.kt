package com.husarp.ota.core

import java.util.Locale

fun updateOfferTitle(label: String, version: String, bytes: Long?): String {
    val size = when {
        bytes == null || bytes < 0 -> return "$label $version"
        bytes >= 1_000_000 -> String.format(Locale.ROOT, "%.1f MB", bytes / 1_000_000.0)
        bytes >= 1_000 -> String.format(Locale.ROOT, "%.1f kB", bytes / 1_000.0)
        else -> "$bytes B"
    }
    return "$label $version · $size"
}

enum class UpdateBannerPhase { AVAILABLE, DOWNLOADING, READY, INSTALLING }

data class UpdateBannerStep(val target: String, val phase: UpdateBannerPhase)

class UpdateBannerFlow<Item>(private val step: (Item) -> UpdateBannerStep?) {
    private var active: Item? = null

    fun clear() { active = null }

    fun select(items: List<Item>, failed: (UpdateBannerStep) -> Boolean = { false }, preferred: Item? = null): Item? {
        val previous = active?.let(step)
        val installing = items.firstOrNull { step(it)?.phase == UpdateBannerPhase.INSTALLING }
        val next = when {
            installing != null -> installing
            previous != null && previous.phase > UpdateBannerPhase.AVAILABLE && !failed(previous) ->
                items.filter { step(it)?.target == previous.target && step(it)!!.phase >= previous.phase }
                    .maxByOrNull { step(it)!!.phase } ?: active
            else -> items.filter { step(it)?.let { phase -> phase.phase > UpdateBannerPhase.AVAILABLE && !failed(phase) } == true }
                .maxByOrNull { step(it)!!.phase } ?: preferred ?: items.firstOrNull()
        }
        active = next
        return next
    }

    companion object {
        fun nativeOwns(webOwns: Boolean?, maintenance: Boolean) = webOwns == false || (webOwns == null && maintenance)
    }
}
