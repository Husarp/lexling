package com.husarp.ota.core

const val MIB = 1024L * 1024
const val SMALL_FIX_LIMIT = 5L * MIB
/** -1 = unlimited, 0 = never (mobile only). Limits count transfer bytes. */
data class UpdateSettings(
    val smallFixes: Boolean = true,
    val majorUpdates: Boolean = false,
    val shellUpdates: Boolean = true,
    val wifiLimitMb: Int = 20,
    val mobileLimitMb: Int = 5,
    val setupAnswered: Boolean = false,
    val checkFrequency: String = "6h"
) {
    fun validate(): UpdateSettings {
        require(checkFrequency in listOf("1h","6h","24h")) { "Invalid check frequency" }
        require(wifiLimitMb in listOf(5,20,50,100,-1)) { "Invalid Wi-Fi limit" }
        require(mobileLimitMb in listOf(0,5,20,50,-1)) { "Invalid mobile limit" }
        return this
    }
    val periodicHours: Long get() = checkFrequency.removeSuffix("h").toLong()
    fun allowsBytes(bytes: Long, unmetered: Boolean): Boolean {
        val limit = if(unmetered) wifiLimitMb else mobileLimitMb
        return limit == -1 || (limit > 0 && bytes <= limit * MIB)
    }
}
fun migrateCheckFrequency(value: String) = when (value) {
    "open", "manual" -> UpdateSettings().checkFrequency
    else -> value
}

fun migrateUpdateSettings(oldAutomatic: Boolean?) = UpdateSettings(
    smallFixes = oldAutomatic != false, majorUpdates = false
)
fun automaticDownload(settings: UpdateSettings, kind: String, bytes: Long, unmetered: Boolean, critical: Boolean = false): Boolean {
    // Unanswered setup is check-only, including after Later (owner, 2026-11-26).
    if (!settings.setupAnswered) return false
    val smallFix = kind == "fix" && bytes <= SMALL_FIX_LIMIT
    if (critical) return true
    val enabled = when {
        kind == "shell" -> settings.shellUpdates // Off: offer Later / Update; the user decides.
        smallFix -> settings.smallFixes
        else -> settings.majorUpdates
    }
    return enabled && settings.allowsBytes(bytes, unmetered)
}
fun automaticShellInstall(settings: UpdateSettings) = settings.setupAnswered && settings.shellUpdates
