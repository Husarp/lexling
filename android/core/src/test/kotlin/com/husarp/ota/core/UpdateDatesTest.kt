package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*
import java.io.File

class UpdateDatesTest {
    private val seenAt = 1_800_000_000_000L
    private val twoHours = 7_200_000L

    @Test fun publicationControlsAgeWhenItPredatesFirstSight() {
        val published = seenAt - 60_000
        assertFalse(updateAgeAllows(true, published, seenAt, published + twoHours - 1))
        assertTrue(updateAgeAllows(true, published, seenAt, published + twoHours))
    }

    @Test fun legacyAndFuturePublicationUsePersistedFirstSight() {
        val file = File(temp(), "dates.json")
        UpdateDateStore(file) { seenAt }.record("web", "1.2.4", available = true)
        val reopened = UpdateDateStore(file) { seenAt + twoHours }
        val firstSeen = reopened.record("web", "1.2.4", available = true).availableAt
        assertEquals(seenAt, firstSeen)
        for (published in listOf(null, seenAt + 60_000)) {
            assertFalse(updateAgeAllows(true, published, firstSeen, seenAt))
            assertFalse(updateAgeAllows(true, published, firstSeen, seenAt + twoHours - 1))
            assertTrue(updateAgeAllows(true, published, firstSeen, seenAt + twoHours))
        }
    }

    @Test fun manualRecoveryAndDisabledSettingBypassAge() {
        assertTrue(UpdateSettings().waitForUpdates)
        assertFalse(updateAgeAllows(true, null, null, seenAt))
        assertTrue(updateAgeAllows(true, null, null, seenAt, manual = true))
        assertTrue(updateAgeAllows(true, null, null, seenAt, recovery = true))
        assertTrue(updateAgeAllows(false, null, null, seenAt))
    }

    @Test fun signedBundleAndShellAcceptPublicationAheadOfTheDeviceClock() {
        val signing = Signing()
        val released = seenAt + 60_000
        val web = bundle("1.2.4").copy(releasedAt = released, publishedAt = released, expiresAt = released + twoHours)
        val shell = ShellManifest(versionCode = 2, versionName = "1.2.4", shellApi = 1, apk = "Lexling.apk",
            size = 1, sha256 = "a".repeat(64), embeddedWebVersion = web.version, notes = "",
            releasedAt = released, expiresAt = released + twoHours, publishedAt = released)
        assertEquals(web, signing.verifier.verify(signing.sign(web), seenAt))
        assertEquals(shell, signing.verifier.verifyShell(signing.signBytes(json.toJson(shell).toByteArray()), seenAt, 1))
    }

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
