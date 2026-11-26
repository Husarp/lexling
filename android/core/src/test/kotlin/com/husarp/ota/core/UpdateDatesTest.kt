package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*
import java.io.File

class UpdateDatesTest {
    @Test fun firstFactsSurviveRecreationAndVersionsAreIndependent() {
        val file = File(temp(), "dates.json")
        var clock = 100L
        val store = UpdateDateStore(file) { clock }
        store.record("web", "1.2.4", 50, available = true)
        clock = 200
        store.record("web", "1.2.4", 50, available = true, downloaded = true)
        store.record("web", "1.2.4", installedAt = 300)
        store.record("web", "1.2.4", available = true, downloaded = true, installedAt = 400)
        store.record("shell", "6", 60, installedAt = 250)
        val reboot = UpdateDateStore(file)
        assertEquals(UpdateDates(50,100,200,300),reboot.get("web","1.2.4"))
        assertEquals(UpdateDates(60,null,null,250),reboot.get("shell","6"))
        assertEquals(UpdateDates(),reboot.get("shell","5"))
    }
    @Test fun stagingHasDownloadDateButActivationWaitsForColdStartAndSurvivesRollback() {
        val h = Harness()
        h.engine.dates.record("web","1.0.1",50,available=true)
        h.pending("1.0.1")
        assertNotNull(h.engine.dates.get("web","1.0.1").downloadedAt)
        assertNull(h.engine.dates.get("web","1.0.1").installedAt)
        val reboot = Harness(h.root)
        reboot.engine.coldStart()
        val installed = reboot.engine.dates.get("web","1.0.1").installedAt
        assertNotNull(installed)
        reboot.engine.coldStart(); reboot.engine.coldStart()
        assertEquals("1.0.0",reboot.engine.snapshot().current)
        assertEquals(installed,Harness(h.root).engine.dates.get("web","1.0.1").installedAt)
    }
    @Test fun packageManagerTimeTracksSameCodeReinstallationAndUnknownHistoryStaysMissing() {
        val file=File(temp(),"dates.json")
        val store=UpdateDateStore(file)
        store.record("shell","6",installedAt=100)
        store.record("shell","6",installedAt=200)
        assertEquals(UpdateDates(installedAt=200),UpdateDateStore(file).get("shell","6"))
        assertEquals(UpdateDates(),store.get("web","1.2.3"))
    }

}
