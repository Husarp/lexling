package com.husarp.ota.core

class UpdateActivation {
    enum class Step { CHECKING_FILES, APPLYING }
    data class Progress(val version: String, val step: Step)

    @Volatile var current: Progress? = null
        private set

    @Synchronized fun begin(version: String) {
        if (current == null) current = Progress(version, Step.CHECKING_FILES)
    }

    @Synchronized fun advance(version: String): Boolean {
        if (current != Progress(version, Step.CHECKING_FILES)) return false
        current = Progress(version, Step.APPLYING)
        return true
    }

    @Synchronized fun finish(version: String) {
        if (current?.version == version) clear()
    }

    @Synchronized fun clear() { current = null }
}

fun <T : Comparable<T>> isUpdateOffer(candidate: T, running: T, ready: T?, installing: T?): Boolean =
    candidate > running && candidate != ready && candidate != installing
