package com.husarp.ota

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class UpdateWorker(context: Context, params: WorkerParameters) : Worker(context,params) {
    override fun doWork(): Result {
        val updater=(applicationContext as OtaApplication).updater
        if (!updater.updateSettings().automaticChecks ||
            (if(inputData.getString("reason") == null) updater.updateSettings().periodicHours == null else !updater.updateSettings().checksOnOpen)) return Result.success()
        val start=System.nanoTime()
        updater.engine.log.add("WorkManager started: ${inputData.getString("reason") ?: "periodic ${updater.updateSettings().checkFrequency}"}; no trial start")
        // Independent executors: an incompatible/broken/large web release cannot block the shell.
        val web=updater.check()
        val shell=updater.shell.check()
        return try {
            web?.get(); shell.get()
            ShellUpdatedNotification.postWorkerOffers(applicationContext, updater)
            updater.engine.log.add("WorkManager finished",(System.nanoTime()-start)/1_000_000)
            if(updater.lastCheckSucceeded && updater.shell.lastCheckSucceeded) Result.success() else {
                updater.engine.log.add("WorkManager retry requested after failed check/download (network constraint + backoff)")
                Result.retry()
            }
        } catch(e: Exception) {
            updater.engine.log.add("WorkManager error: ${e.message}",(System.nanoTime()-start)/1_000_000)
            Result.retry()
        }
    }
    companion object {
        private fun network(context: Context): Constraints {
            val settings=(context.applicationContext as OtaApplication).updater.updateSettings()
            return Constraints.Builder().setRequiredNetworkType(if(settings.mobileLimitMb==0) NetworkType.UNMETERED else NetworkType.CONNECTED).build()
        }
        fun schedule(context: Context, settingsChanged: Boolean = false) {
            val manager=WorkManager.getInstance(context)
            if(settingsChanged) for(reason in listOf("start","stop")) {
                manager.cancelUniqueWork("ota-$reason"); manager.cancelUniqueWork("ota-critical-$reason")
            }
            val settings=(context.applicationContext as OtaApplication).updater.updateSettings()
            val hours=settings.periodicHours
            if(hours == null) {
                manager.cancelUniqueWork("ota-6h"); manager.cancelUniqueWork("ota-critical-6h")
                return
            }
            // A connected metadata check preserves the authenticated kill-switch
            // override even when normal background work must wait for Wi-Fi.
            if((context.applicationContext as OtaApplication).updater.updateSettings().mobileLimitMb==0) {
                manager.enqueueUniquePeriodicWork("ota-critical-6h",ExistingPeriodicWorkPolicy.UPDATE,
                    PeriodicWorkRequestBuilder<CriticalCheckWorker>(hours,TimeUnit.HOURS)
                        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
            } else manager.cancelUniqueWork("ota-critical-6h")
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("ota-6h",ExistingPeriodicWorkPolicy.UPDATE,
                PeriodicWorkRequestBuilder<UpdateWorker>(hours,TimeUnit.HOURS).setConstraints(network(context)).build())
        }
        fun once(context: Context, reason: String) {
            if(!(context.applicationContext as OtaApplication).updater.updateSettings().checksOnOpen) return
            if((context.applicationContext as OtaApplication).updater.updateSettings().mobileLimitMb==0) {
                WorkManager.getInstance(context).enqueueUniqueWork("ota-critical-$reason",ExistingWorkPolicy.KEEP,
                    OneTimeWorkRequestBuilder<CriticalCheckWorker>()
                        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setInputData(workDataOf("reason" to reason)).build())
            }
            (context.applicationContext as OtaApplication).updater.engine.log.add("WorkManager one-off enqueued: $reason; network connected required")
            WorkManager.getInstance(context).enqueueUniqueWork("ota-$reason",ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<UpdateWorker>().setConstraints(network(context)).setInputData(workDataOf("reason" to reason)).build())
        }
    }
}

/** Metadata can use mobile data; Updater permits payloads only by its native policy.
 * With mobile=never, that policy allows only critical payloads on metered networks.
 * This worker never launches a trial or bypasses first-run setup. */
class CriticalCheckWorker(context: Context, params: WorkerParameters) : Worker(context,params) {
    override fun doWork(): Result {
        val updater=(applicationContext as OtaApplication).updater
        if(!updater.updateSettings().automaticChecks || updater.updateSettings().mobileLimitMb!=0 ||
            (if(inputData.getString("reason") == null) updater.updateSettings().periodicHours == null else !updater.updateSettings().checksOnOpen)) return Result.success()
        return try {
            updater.check()?.get()
            ShellUpdatedNotification.postWorkerOffers(applicationContext, updater)
            if(updater.lastCheckSucceeded) Result.success() else Result.retry()
        } catch(_: Exception) { Result.retry() }
    }
}
