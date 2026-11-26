package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*
import java.io.File

class StateTest {
    @Test fun initialStartupUsesEmbedded() { val h=Harness(); assertEquals("1.0.0",h.engine.coldStart().version) }
    @Test fun stagingDoesNotSwitchUntilNextStart() { val h=Harness(); h.engine.coldStart(); h.pending("1.0.1"); assertEquals("1.0.0",h.engine.snapshot().current); assertEquals("1.0.1",h.engine.snapshot().pending) }
    @Test fun firstStartTrialCountOne() { val h=Harness(); h.pending("1.0.1"); assertEquals("1.0.1",h.engine.coldStart().version); assertEquals(1,h.engine.snapshot().trialStarts); assertTrue(h.engine.snapshot().trial) }
    @Test fun crashAndWhiteScreenRollbackAfterExactlyTwoStarts() {
        // Both failure modes are identical to native code: no matching ready signal.
        for (mode in listOf("crash","white")) {
            val h=Harness(); h.pending("1.0.1")
            assertEquals(mode,"1.0.1",h.engine.coldStart().version)
            assertEquals("1.0.1",h.engine.coldStart().version)
            val back=h.engine.coldStart(); assertEquals("1.0.0",back.version)
            assertTrue(back.notice!!.contains("didn't start")); assertTrue(h.engine.snapshot().failed.contains("1.0.1"))
            assertFalse(File(h.engine.bundles,"1.0.1").exists()); assertEquals("1.0.0",h.engine.coldStart().version)
        }
    }
    @Test fun offlineRollbackKeepsPreviousGood() {
        val h=Harness(); h.good("1.0.1"); h.pending("1.0.2")
        h.engine.coldStart(); h.engine.coldStart()
        assertTrue(File(h.engine.bundles,"1.0.1").exists())
        assertEquals("1.0.1",h.engine.coldStart().version)
        assertTrue(File(h.engine.bundles,"1.0.1").exists())
    }
    @Test fun readyCommitsTrialAndNoLaterRollback() {
        val h=Harness(); h.pending("1.0.1"); val l=h.engine.coldStart(); assertTrue(h.engine.ready(l.version,l.token))
        repeat(4) { assertEquals("1.0.1",h.engine.coldStart().version) }; assertFalse(h.engine.snapshot().trial)
    }
    @Test fun lateReadyFromOldVersionIgnored() { val h=Harness(); val old=h.engine.coldStart(); h.pending("1.0.1"); h.engine.coldStart(); assertFalse(h.engine.ready(old.version,old.token)); assertTrue(h.engine.snapshot().trial) }
    @Test fun lateReadyFromOldLaunchOfSameVersionIgnored() { val h=Harness(); h.pending("1.0.1"); val old=h.engine.coldStart(); h.engine.coldStart(); assertFalse(h.engine.ready(old.version,old.token)) }
    @Test fun backgroundOrTimePassingDoesNotRollback() {
        val h=Harness(); h.pending("1.0.1"); val l=h.engine.coldStart()
        repeat(10) { h.engine.snapshot(); h.engine.stateJson() }
        assertEquals(1,h.engine.snapshot().trialStarts); assertTrue(h.engine.ready(l.version,l.token))
    }
    @Test fun onlyOnePreviousKeptAfterReady() {
        val h=Harness(); h.good("1.0.1"); h.good("1.0.2"); h.pending("1.0.3"); val l=h.engine.coldStart()
        assertTrue(File(h.engine.bundles,"1.0.2").exists()); h.engine.ready(l.version,l.token)
        assertEquals("1.0.2",h.engine.snapshot().previous)
        assertEquals(setOf("1.0.2","1.0.3"),h.engine.bundles.listFiles()!!.map { it.name }.toSet())
    }
    @Test fun killSwitchLeavesCurrentAtNextStart() {
        val h=Harness(); h.good("1.0.1"); h.good("1.0.2"); h.engine.blocked(listOf("1.0.2"))
        assertEquals("1.0.2",h.engine.snapshot().current); assertEquals("1.0.1",h.engine.coldStart().version)
    }
    @Test fun blockedPreviousFallsBackToEmbedded() {
        val h=Harness(); h.good("1.0.1"); h.good("1.0.2"); h.engine.blocked(listOf("1.0.1","1.0.2")); assertEquals("1.0.0",h.engine.coldStart().version)
    }
    @Test fun blockedPendingNeverStarts() { val h=Harness(); h.pending("1.0.1"); h.engine.blocked(listOf("1.0.1")); assertEquals("1.0.0",h.engine.coldStart().version) }
    @Test fun blockCurrentAndStageFixSwitchesToFixNextStart() {
        val h=Harness(); h.good("1.0.1"); h.engine.blocked(listOf("1.0.1")); h.pending("1.0.2"); assertEquals("1.0.2",h.engine.coldStart().version)
        assertEquals("1.0.0",h.engine.snapshot().previous)
    }
    @Test fun embeddedBlockedIsStillLastSafetyNet() { val h=Harness(); h.engine.blocked(listOf("1.0.0")); assertEquals("1.0.0",h.engine.coldStart().version) }
    @Test fun powerLossBeforePendingPointerKeepsOldState() {
        val h=Harness(); h.engine.coldStart(); val m=bundle("1.0.1"); val stage=h.stage(m); stage.renameTo(File(h.engine.bundles,m.version))
        val reboot=Harness(h.root); assertEquals("1.0.0",reboot.engine.coldStart().version)
    }
    @Test fun pendingPointerSurvivesProcessDeath() { val h=Harness(); h.pending("1.0.1"); val reboot=Harness(h.root); assertEquals("1.0.1",reboot.engine.coldStart().version) }
    @Test fun rollbackCounterSurvivesProcessDeath() {
        val h=Harness(); h.pending("1.0.1"); h.engine.coldStart()
        Harness(h.root).engine.coldStart(); assertEquals("1.0.0",Harness(h.root).engine.coldStart().version)
    }
    @Test fun newerEmbeddedApkWipesDownload() {
        val h=Harness(); h.good("1.0.1"); val new=Harness(h.root,bundle("1.0.2")); assertEquals("1.0.2",new.engine.coldStart().version); assertEquals(0,new.engine.bundles.listFiles()!!.size)
    }
    @Test fun newerEmbeddedApkStartsDespiteBlockedBundleAndUnansweredTrial() {
        val old = Harness(embedded = bundle("1.0.0"))
        old.pending("1.0.1")
        assertEquals("1.0.1", old.engine.coldStart().version)
        old.engine.blocked(listOf("1.0.1"))
        val upgraded = Harness(old.root, embedded = bundle("1.0.3"))
        val launch = upgraded.engine.coldStart()
        assertEquals("1.0.3", launch.version)
        assertFalse(upgraded.engine.snapshot().trial)
        assertNull(upgraded.engine.snapshot().pending)
        assertTrue(upgraded.engine.ready(launch.version, launch.token))
    }
    @Test fun shellApiChangeKeepsCompatibleDownloadEvenSameEmbedded() {
        val h=Harness(); h.good("1.0.1"); val new=Harness(h.root,shell=2); assertEquals("1.0.1",new.engine.coldStart().version); assertEquals(1,new.engine.bundles.listFiles()!!.size)
    }
    @Test fun resetWipesBundlesAndFailures() {
        val h=Harness(); h.good("1.0.1"); h.engine.reset(); assertEquals("1.0.0",h.engine.coldStart().version); assertEquals(0,h.engine.bundles.listFiles()!!.size); assertTrue(h.engine.snapshot().failed.isEmpty())
    }
    @Test fun corruptStateFailsSafe() {
        val h=Harness(); File(h.root,"state.json").writeText("{broken"); assertEquals("1.0.0",Harness(h.root).engine.coldStart().version)
    }
    @Test fun interruptedTempStateDoesNotReplaceDurablePointer() {
        val h=Harness(); h.engine.coldStart(); File(h.root,"state.json.tmp").writeText("broken"); assertEquals("1.0.0",Harness(h.root).engine.coldStart().version)
    }
    @Test fun missingCurrentOverlayRecoversToGood() {
        val h=Harness(); h.good("1.0.1"); h.good("1.0.2"); File(h.engine.bundles,"1.0.2").deleteRecursively(); assertEquals("1.0.1",h.engine.coldStart().version)
    }
    @Test fun logRetainsLastFiveHundredNewestFirst() {
        val h=Harness(); repeat(505) { h.log.add("entry $it",it.toLong()) }
        val lines=h.log.read().lines(); assertEquals(500,lines.size); assertTrue(lines.first().contains("entry 504")); assertTrue(lines.first().contains("504 ms")); assertTrue(lines.last().contains("entry 5")); h.log.clear(); assertEquals("",h.log.read())
    }
    @Test fun unwritableLogCannotBreakUpdaterAndKeepsMemoryDiagnostics() {
        val root=temp(); val notDirectory=File(root,"not-directory"); notDirectory.writeText("x")
        val log=EventLog(File(notDirectory,"updater.log")); log.add("storage full example")
        assertTrue(log.read().contains("storage full example")); log.clear(); assertEquals("",log.read())
    }
    @Test fun inabilityToPersistTrialStartsUsesEmbeddedWithoutDeletingGoodBundles() {
        val h=Harness(); h.engine.coldStart(); h.pending("1.0.1")
        val file=File(h.root,"state.json"); file.delete(); file.mkdirs(); File(file,"prevent-replace").writeText("x")
        assertEquals("1.0.0",h.engine.coldStart().version)
        assertTrue(File(h.engine.bundles,"1.0.1").exists()); assertFalse(h.engine.snapshot().trial)
    }
}
