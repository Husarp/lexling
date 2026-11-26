package com.husarp.ota.core

import org.junit.Assert.*
import org.junit.Test

class UpdateNotificationGateTest {
    @Test fun cancelsPendingAndSilencesWorkersUntilTheAppLeavesForeground() {
        val gate = UpdateNotificationGate()
        val pending = mutableListOf("reminder")
        assertTrue(gate.postInBackground { pending.add("update") })
        gate.enter { pending.remove("update") }
        assertEquals(listOf("reminder"), pending)
        assertFalse(gate.postInBackground { fail("Must not post in the foreground") })
        gate.leave()
        assertTrue(gate.postInBackground { pending.add("update") })
        assertEquals(listOf("reminder", "update"), pending)
    }
}
