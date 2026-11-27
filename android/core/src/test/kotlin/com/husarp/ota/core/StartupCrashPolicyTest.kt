package com.husarp.ota.core

import org.junit.Assert.*
import org.junit.Test

class StartupCrashPolicyTest {
    @Test fun interruptedStartsTriggerSafeModeAfterTwoAttempts() {
        assertFalse(shouldStartInSafeMode(0, startupCrashRecorded = false))
        assertFalse(shouldStartInSafeMode(1, startupCrashRecorded = false))
        assertTrue(shouldStartInSafeMode(2, startupCrashRecorded = false))
    }

    @Test fun aRecordedStartupCrashTriggersSafeModeAfterOneAttempt() {
        assertTrue(shouldStartInSafeMode(1, startupCrashRecorded = true))
    }
}
