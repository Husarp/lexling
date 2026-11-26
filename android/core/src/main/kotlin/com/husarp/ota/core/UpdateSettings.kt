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
        require(checkFrequency in listOf("open","1h","6h","24h","manual")) { "Invalid check frequency" }
        require(wifiLimitMb in listOf(5,20,50,100,-1)) { "Invalid Wi-Fi limit" }
        require(mobileLimitMb in listOf(0,5,20,50,-1)) { "Invalid mobile limit" }
        return this
    }
    val automaticChecks get() = checkFrequency != "manual"
    val checksOnOpen get() = checkFrequency == "open"
    val periodicHours: Long? get() = when(checkFrequency) { "1h" -> 1L; "6h" -> 6L; "24h" -> 24L; else -> null }
    fun allowsBytes(bytes: Long, unmetered: Boolean): Boolean {
        val limit = if(unmetered) wifiLimitMb else mobileLimitMb
        return limit == -1 || (limit > 0 && bytes <= limit * MIB)
    }
}
fun migrateUpdateSettings(oldAutomatic: Boolean?) = UpdateSettings(
    smallFixes = oldAutomatic != false, majorUpdates = false
)
fun automaticDownload(settings: UpdateSettings, kind: String, bytes: Long, unmetered: Boolean, critical: Boolean = false): Boolean {
    val smallFix = kind == "fix" && bytes <= SMALL_FIX_LIMIT
    if (!settings.setupAnswered && !smallFix && kind != "shell") return false
    if (settings.setupAnswered && critical) return true
    val enabled = when {
        kind == "shell" -> settings.shellUpdates // Off: offer Later / Update; the user decides.
        smallFix -> settings.smallFixes
        else -> settings.majorUpdates
    }
    return enabled && settings.allowsBytes(bytes, unmetered)
}
fun automaticShellInstall(settings: UpdateSettings) = settings.shellUpdates
