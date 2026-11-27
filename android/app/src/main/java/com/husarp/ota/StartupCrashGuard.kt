package com.husarp.ota

import android.content.Context
import android.util.Log
import com.husarp.lexling.BuildConfig
import com.husarp.ota.core.atomicWrite
import com.husarp.ota.core.shouldStartInSafeMode
import java.io.File
import java.time.Instant

internal class StartupCrashGuard(context: Context) {
    private val preferences = context.getSharedPreferences("startup-crash", Context.MODE_PRIVATE)
    private val report = File(context.noBackupFilesDir, "startup-crash.txt")
    private var pending = false

    private fun unfinishedStarts(): Int =
        if (preferences.getInt("versionCode", -1) == BuildConfig.VERSION_CODE) preferences.getInt("unfinishedStarts", 0)
        else 0

    private fun startupCrashRecorded(unfinishedStarts: Int): Boolean =
        unfinishedStarts > 0 && preferences.getBoolean("startupCrashRecorded", false)

    val safeMode: Boolean
        @Synchronized get() {
            val unfinished = unfinishedStarts()
            return !pending && shouldStartInSafeMode(unfinished, startupCrashRecorded(unfinished))
        }

    @Synchronized fun beginLaunch(retry: Boolean = false): Boolean {
        if (pending) return true
        if (!retry && safeMode) return false
        val unfinished = unfinishedStarts()
        val nextCount = if (startupCrashRecorded(unfinished)) 1 else unfinished.coerceIn(0, 1) + 1
        if (!preferences.edit().putInt("versionCode", BuildConfig.VERSION_CODE)
                .putInt("unfinishedStarts", nextCount).remove("startupCrashRecorded").commit()) {
            Log.w("LexlingStartup", "Could not save unfinished startup")
        }
        pending = true
        return true
    }

    @Synchronized fun ready() {
        if (!pending) return
        if (!preferences.edit().remove("unfinishedStarts").remove("startupCrashRecorded").commit()) {
            Log.w("LexlingStartup", "Could not clear unfinished startup")
            return
        }
        pending = false
    }

    fun reportText(): String = runCatching { report.readText() }.getOrDefault("")

    fun installExceptionHandler() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        var recorded = false
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            try {
                synchronized(this) {
                    if (!recorded) {
                        runCatching {
                            val trace = error.stackTraceToString().take(16_384)
                            val text = "Native crash at ${Instant.now()}\nversionCode: ${BuildConfig.VERSION_CODE}\n" +
                                "Thread: ${thread.name.take(128)}\n\n$trace"
                            atomicWrite(report, text.toByteArray())
                            recorded = true
                            if (pending && !preferences.edit().putBoolean("startupCrashRecorded", true).commit()) {
                                Log.w("LexlingStartup", "Could not save startup crash marker")
                            }
                        }
                    }
                }
            } finally {
                previous?.uncaughtException(thread, error)
            }
        }
    }
}
