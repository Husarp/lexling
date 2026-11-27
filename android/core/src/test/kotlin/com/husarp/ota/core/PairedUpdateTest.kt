package com.husarp.ota.core

import org.junit.Assert.*
import org.junit.Test

class PairedUpdateTest {
    private val apk = ShellManifest(versionCode = 2, versionName = "2.0.0", shellApi = 2,
        apk = "new.apk", size = 1, sha256 = "0".repeat(64), embeddedWebVersion = "1.0.0",
        notes = "", releasedAt = NOW - 1000, expiresAt = NOW + 10000)

    @Test fun usesTheEmbeddedReleaseWhenItCoversLexling() {
        assertEquals(PairedWebUpdate.EMBEDDED, pairedWebUpdate("1.0.0", 1, apk))
        assertEquals(PairedWebUpdate.EMBEDDED, pairedWebUpdate("1.0.1", 2, apk.copy(embeddedWebVersion = "1.1.0")))
        assertEquals(PairedWebUpdate.OVERLAY, pairedWebUpdate("1.0.1", 2, apk))
        assertEquals(PairedWebUpdate.UNSUPPORTED, pairedWebUpdate("1.0.1", 3, apk))
    }

    @Test fun stagedLexlingWaitsForTheNewApkAcrossProcessRestarts() {
        val h = Harness()
        val next = bundle("1.0.1").copy(minShellApi = 2)
        h.engine.commit(next, h.stage(next), targetShell = apk)
        assertEquals("1.0.0", Harness(h.root).engine.coldStart().version)
        val replacement = Engine(h.root, h.embedded, 2, h.log, shellCode = 2)
        val launch = replacement.coldStart()
        assertEquals(next.version, launch.version)
        assertNull(replacement.snapshot().pendingShellCode)
        assertTrue(replacement.ready(launch.version, launch.token))
        assertEquals(next.version, replacement.takeUpdatedNotice(launch.version, launch.token)?.to)
    }

    @Test fun sameApiAndEmbeddedVersionStillWaitForApkVersionCode() {
        val h = Harness()
        val next = bundle("1.0.1")
        h.engine.commit(next, h.stage(next), targetShell = apk.copy(shellApi = 1))
        assertEquals("1.0.0", Harness(h.root).engine.coldStart().version)
        assertEquals(next.version, Engine(h.root, h.embedded, 1, h.log, shellCode = 2).coldStart().version)
    }

    @Test fun apiTwoApkStartsFromLegacyOtaStateWithoutPairedFields() {
        val old = Harness(embedded = bundle("0.73.0"))
        old.good("0.73.2")
        assertFalse(old.engine.stateJson().contains("pendingShellCode"))

        val new = Harness(old.root, embedded = bundle("0.74.0").copy(minShellApi = 2), shell = 2)
        val launch = new.engine.coldStart()

        assertEquals("0.74.0", launch.version)
        assertFalse(new.engine.snapshot().trial)
        assertNull(new.engine.snapshot().pending)
        assertTrue(new.engine.ready(launch.version, launch.token))
    }
}
