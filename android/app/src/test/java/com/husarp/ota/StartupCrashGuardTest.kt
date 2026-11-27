package com.husarp.ota

import android.app.Application
import android.content.Context
import com.husarp.lexling.BuildConfig
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class StartupCrashGuardTest {
    private val app: Context get() = RuntimeEnvironment.getApplication()
    private val prefs get() = app.getSharedPreferences("startup-crash", Context.MODE_PRIVATE)

    @Test fun twoInterruptedStartsOpenSafeModeAndReadyClearsTheStreak() {
        val first = StartupCrashGuard(app)
        assertTrue(first.beginLaunch())
        assertTrue(first.beginLaunch()) // Activity recreation stays within the same attempt.
        assertEquals(1, prefs.getInt("unfinishedStarts", 0))
        val second = StartupCrashGuard(app)
        assertFalse(second.safeMode)
        assertTrue(second.beginLaunch())
        assertEquals(2, prefs.getInt("unfinishedStarts", 0))

        val recovery = StartupCrashGuard(app)
        assertFalse(recovery.beginLaunch())
        assertTrue(recovery.safeMode)
        assertEquals(2, prefs.getInt("unfinishedStarts", 0))

        assertTrue(recovery.beginLaunch(retry = true))
        assertFalse(recovery.safeMode)
        assertTrue(StartupCrashGuard(app).safeMode)
        recovery.ready()
        assertFalse(StartupCrashGuard(app).safeMode)
        assertFalse(prefs.contains("unfinishedStarts"))
        assertTrue(recovery.beginLaunch())
        assertFalse(StartupCrashGuard(app).safeMode)
    }

    @Test fun aNewApkGetsAFreshStart() {
        prefs.edit().putInt("versionCode", BuildConfig.VERSION_CODE - 1).putInt("unfinishedStarts", 2)
            .putBoolean("startupCrashRecorded", true).commit()
        assertTrue(StartupCrashGuard(app).beginLaunch())
        assertEquals(1, prefs.getInt("unfinishedStarts", 0))
    }

    @Test fun exceptionHandlerSavesTheReportAndTriggersSafeModeAfterOneStart() {
        val original = Thread.getDefaultUncaughtExceptionHandler()
        val guard = StartupCrashGuard(app)
        val error = IllegalStateException("test startup crash")
        val thread = Thread.currentThread()
        var chained = false
        try {
            assertTrue(guard.beginLaunch())
            Thread.setDefaultUncaughtExceptionHandler { caughtThread, caughtError ->
                assertSame(thread, caughtThread)
                assertSame(error, caughtError)
                val report = StartupCrashGuard(app).reportText()
                assertTrue(report.startsWith("Native crash at "))
                assertTrue(report.contains("versionCode: ${BuildConfig.VERSION_CODE}"))
                assertTrue(report.contains("IllegalStateException: test startup crash"))
                assertTrue(report.contains("at com.husarp.ota.StartupCrashGuardTest"))
                assertTrue(StartupCrashGuard(app).safeMode)
                chained = true
            }
            guard.installExceptionHandler()
            requireNotNull(Thread.getDefaultUncaughtExceptionHandler()).uncaughtException(thread, error)
            assertTrue(chained)
            val recovery = StartupCrashGuard(app)
            assertFalse(recovery.beginLaunch())
            assertTrue(recovery.beginLaunch(retry = true))
            assertTrue(recovery.reportText().contains("test startup crash"))
            assertFalse(StartupCrashGuard(app).safeMode)
        } finally {
            Thread.setDefaultUncaughtExceptionHandler(original)
        }
    }

    @Test fun crashAfterReadyDoesNotCountTowardSafeMode() {
        val original = Thread.getDefaultUncaughtExceptionHandler()
        try {
            Thread.setDefaultUncaughtExceptionHandler { _, _ -> }
            val guard = StartupCrashGuard(app)
            guard.installExceptionHandler()
            assertTrue(guard.beginLaunch())
            guard.ready()
            requireNotNull(Thread.getDefaultUncaughtExceptionHandler())
                .uncaughtException(Thread.currentThread(), IllegalStateException("test crash after ready"))

            val next = StartupCrashGuard(app)
            assertTrue(next.reportText().contains("test crash after ready"))
            assertTrue(next.beginLaunch())
            assertFalse(StartupCrashGuard(app).safeMode)
        } finally {
            Thread.setDefaultUncaughtExceptionHandler(original)
        }
    }
}
