package com.husarp.ota

import android.content.pm.PackageInfo
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.ServiceWorkerWebSettings
import androidx.lifecycle.Lifecycle
import java.time.Duration
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.shadows.ShadowWebView

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = OtaApplication::class, shadows = [MainActivityStartupTest.TestServiceWorkerController::class])
class MainActivityStartupTest {
    @Implements(ServiceWorkerController::class)
    class TestServiceWorkerController {
        companion object {
            @JvmStatic @Implementation
            fun getInstance(): ServiceWorkerController = object : ServiceWorkerController() {
                override fun getServiceWorkerWebSettings(): ServiceWorkerWebSettings = error("Unused in this test")
                override fun setServiceWorkerClient(client: ServiceWorkerClient?) = Unit
            }
        }
    }

    @Test fun preparationFinishesAfterResumeWithTheSameBridge() {
        ShadowWebView.setCurrentWebViewPackage(PackageInfo().apply {
            packageName = "com.google.android.webview"
            versionName = "130.0.0.0"
        })
        val app = RuntimeEnvironment.getApplication() as OtaApplication
        app.startingBuiltIn = true
        val updater = app.updater
        val main = shadowOf(Looper.getMainLooper())
        Robolectric.buildActivity(MainActivity::class.java).use { controller ->
            val activity = controller.get()
            var prepared = false
            synchronized(updater.engine) {
                // Keep the worker in reconciliation until this activity is already RESUMED.
                controller.create().start().resume().visible()
                assertEquals(Lifecycle.State.RESUMED, activity.lifecycle.currentState)
                assertTrue(updater.launching)
                assertNotNull(activity.bridge)
                main.idle()
                assertEquals("https://localhost/ota-startup.html", shadowOf(activity.bridge.webView).lastLoadedUrl)
                updater.prepareLaunch { prepared = true }
                main.idleFor(Duration.ofSeconds(20))
                assertFalse(prepared)
                assertFalse(StartupCrashGuard(app).safeMode)
            }
            val bridge = activity.bridge
            val web = bridge.webView
            val overlay = activity.findViewById<ViewGroup>(android.R.id.content).let { content ->
                (0 until content.childCount).map(content::getChildAt).filterIsInstance<StartupScreen>().single()
            }
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
            while (!prepared && System.nanoTime() < deadline) {
                main.idle()
                if (!prepared) Thread.sleep(10)
            }

            assertTrue("Cold launch preparation did not finish", prepared)
            assertEquals(Lifecycle.State.RESUMED, activity.lifecycle.currentState)
            assertSame(bridge, activity.bridge)
            assertEquals("https://localhost/", shadowOf(web).lastLoadedUrl)
            web.webViewClient.onPageCommitVisible(web, bridge.appUrl)
            assertEquals(View.VISIBLE, overlay.visibility)
            web.webViewClient.onPageCommitVisible(web, "https://localhost/")
            assertEquals(View.GONE, overlay.visibility)
        }
    }
}
