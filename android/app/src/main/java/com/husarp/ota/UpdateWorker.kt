package com.husarp.ota

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class UpdateWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        // A one-off request from an older APK may have survived until WorkManager cancels it.
        if (inputData.keyValueMap.containsKey("reason")) return Result.success()
        val app = applicationContext as OtaApplication
        if (app.startingBuiltIn || app.startupCrashGuard.safeMode) return Result.success()
        val updater = app.updater
        val start = System.nanoTime()
        return try {
            val hours = updater.updateSettings().periodicHours
            updater.engine.log.add("WorkManager started: every $hours hours; no trial start")
            updater.check()?.get()
            ShellUpdatedNotification.postWorkerOffers(applicationContext, updater)
            updater.engine.log.add("WorkManager finished", (System.nanoTime() - start) / 1_000_000)
            if (updater.lastCheckSucceeded && updater.shell.lastCheckSucceeded) Result.success() else Result.retry()
        } catch (error: Exception) {
            updater.engine.log.add("WorkManager error: ${error.message}")
            Result.retry()
        }
    }

    companion object {
        fun schedule(context: Context) {
            val updater = (context.applicationContext as OtaApplication).updater
            try {
                val manager = WorkManager.getInstance(context)
                // Cancel work left by versions that used separate workers for startup and metered checks.
                for (name in listOf("ota-start", "ota-stop", "ota-critical-start", "ota-critical-stop", "ota-critical-6h")) {
                    manager.cancelUniqueWork(name)
                }
                val hours = updater.updateSettings().periodicHours
                // Download policy applies its own limits. Metadata checks can use any connection.
                manager.enqueueUniquePeriodicWork("ota-6h", ExistingPeriodicWorkPolicy.UPDATE,
                    PeriodicWorkRequestBuilder<UpdateWorker>(hours, TimeUnit.HOURS)
                        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                        .build())
            } catch (e: RuntimeException) {
                updater.engine.log.add("Could not schedule periodic update checks: ${e.message}")
            }
        }
    }
}
