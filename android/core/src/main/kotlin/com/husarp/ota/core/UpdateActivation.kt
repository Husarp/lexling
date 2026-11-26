package com.husarp.ota.core

class UpdateActivation {
    enum class Step { CHECKING_FILES, APPLYING }
    data class Progress(val version: String, val step: Step, val done: Int = 0, val total: Int = 0)

    @Volatile var current: Progress? = null
        private set

    @Synchronized fun begin(version: String) {
        if (current == null) current = Progress(version, Step.CHECKING_FILES)
    }

    @Synchronized fun advance(version: String): Boolean {
        val checking = current ?: return false
        if (checking.version != version || checking.step != Step.CHECKING_FILES) return false
        current = Progress(version, Step.APPLYING)
        return true
    }

    @Synchronized fun count(progress: Progress): Boolean {
        val previous = current ?: return false
        if (progress.version != previous.version || progress.step != previous.step || progress == previous) return false
        current = progress
        // Keep the exact counts but avoid posting one UI event per checked file (owner, 2026-11-26).
        fun percent(value: Progress) = if (value.total == 0) -1 else (value.done * 100L / value.total).toInt()
        return percent(previous) != percent(progress)
    }

    @Synchronized fun finish(version: String) {
        if (current?.version == version) clear()
    }

    @Synchronized fun clear() { current = null }
}

fun <T : Comparable<T>> isUpdateOffer(candidate: T, running: T, ready: T?, installing: T?): Boolean =
    candidate > running && candidate != ready && candidate != installing
