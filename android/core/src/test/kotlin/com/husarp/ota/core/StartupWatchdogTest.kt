package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*

class StartupWatchdogTest {
    @Test fun countsOnlyForegroundUnlockedTime() {
        val watchdog = StartupWatchdog()
        watchdog.launch("launch", 0, false)
        assertEquals(10_000L, watchdog.update(0, true))
        assertEquals(8_000L, watchdog.update(2_000, true))
        assertNull(watchdog.update(3_000, false))
        assertNull(watchdog.update(100_000, false))
        assertNull(watchdog.reason)
        assertEquals(7_000L, watchdog.update(100_000, true))
        assertEquals(1L, watchdog.update(106_999, true))
        assertNull(watchdog.update(107_000, true))
        assertEquals("ready-timeout", watchdog.reason)
    }

    @Test fun builtinAcceptedAndTrialAllNeedAndAcceptReadiness() {
        for (type in listOf("built-in", "accepted", "trial")) {
            val harness = Harness()
            if (type == "accepted") harness.good("1.1.0")
            if (type == "trial") harness.pending("1.1.0")
            val launch = harness.engine.coldStart()
            val watchdog = StartupWatchdog()
            watchdog.launch(launch.token, 0, false)
            watchdog.update(0, true)
            watchdog.failed(launch.token, "load-error")
            assertNull(watchdog.reason)
            watchdog.markReady("stale")
            watchdog.update(10_000, true)
            assertEquals("load-error", watchdog.reason)
            assertTrue(watchdog.acceptsReady(launch.token))
            assertTrue(harness.engine.ready(launch.version, launch.token))
            watchdog.markReady(launch.token)
            assertNull(watchdog.update(90_000, true))
            assertNull(watchdog.reason)
            assertFalse(watchdog.showLoading)
        }
    }

    @Test fun waitRestartsTimerAndSurvivesRecreatingTheSameLaunch() {
        val watchdog = StartupWatchdog()
        watchdog.launch("launch", 0, false)
        watchdog.update(0, true)
        watchdog.update(10_000, true)
        watchdog.waitLonger(10_000)
        assertFalse(watchdog.showLoading)
        assertNull(watchdog.reason)
        watchdog.update(12_000, false)
        watchdog.launch("launch", 90_000, false)
        assertEquals(8_000L, watchdog.update(90_000, true))
        watchdog.markReady("launch")
        assertNull(watchdog.update(98_000, true))
        assertNull(watchdog.reason)
    }

    @Test fun simulationIgnoresReadyForOneLaunchOnly() {
        val watchdog = StartupWatchdog()
        watchdog.launch("simulated", 0, true)
        watchdog.update(0, true)
        watchdog.launch("simulated", 0, false)
        assertFalse(watchdog.acceptsReady("simulated"))
        watchdog.markReady("simulated")
        watchdog.update(10_000, true)
        assertEquals("ready-timeout", watchdog.reason)
        watchdog.launch("normal", 10_000, false)
        assertFalse(watchdog.acceptsReady("simulated"))
        assertTrue(watchdog.acceptsReady("normal"))
        watchdog.markReady("normal")
        assertNull(watchdog.update(30_000, true))
        assertNull(watchdog.reason)
    }
}
