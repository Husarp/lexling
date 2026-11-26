package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*

class TrialRecoveryTest {
    @Test fun consentedRepairReplacesAFailedTrialButRejectsStaleConsent() {
        val harness = Harness()
        harness.good("1.1.0")
        harness.pending("1.2.0")
        val trial = harness.engine.coldStart()
        val fix = bundle("1.3.0")
        val staging = harness.stage(fix)
        expectFailure { harness.engine.commit(fix, staging) }
        expectFailure { harness.engine.commit(fix, staging, "stale") }
        assertEquals(trial.version, harness.engine.snapshot().current)
        harness.engine.commit(fix, staging, trial.token)
        assertEquals("1.1.0", harness.engine.snapshot().current)
        assertTrue(trial.version in harness.engine.snapshot().failed)
        val repaired = Harness(harness.root).engine
        val next = repaired.coldStart()
        assertEquals(fix.version, next.version)
        assertTrue(repaired.ready(next.version, next.token))
        assertNull(repaired.takeRollbackNotice(next.version, next.token))
        assertEquals(fix.message, repaired.takeUpdatedNotice(next.version, next.token)?.notes)
    }
    @Test fun goBackIsImmediateDurableAndNeverOffersFailedVersionAgain() {
        val h=Harness();h.good("1.1.0");h.pending("1.2.0");val l=h.engine.coldStart()
        assertEquals("1.1.0",h.engine.recoveryTarget())
        assertFalse(h.engine.recover(l.version,"stale","ready-timeout"))
        assertTrue(h.engine.recover(l.version,l.token,"ready-timeout"))
        assertFalse(h.engine.recover(l.version,l.token,"ready-timeout"))
        val next=Harness(h.root);val recovered=next.engine.coldStart()
        assertEquals("1.1.0",recovered.version);assertTrue("1.2.0" in next.engine.snapshot().failed)
        expectFailure { next.pending("1.2.0") }
        val m=bundle("1.2.0")
        assertEquals(Action.REJECT,decide(m,next.engine.currentManifest(),next.embedded,1,UpdateSettings(),true,next.engine.snapshot().failed,emptyList(),false,null).action)
    }
    @Test fun noPreviousGoodBundleUsesEmbedded() {
        val h=Harness();h.pending("1.1.0");val l=h.engine.coldStart()
        assertEquals("1.0.0",h.engine.recoveryTarget())
        h.engine.recover(l.version,l.token,"javascript-error")
        assertEquals("1.0.0",h.engine.coldStart().version)
    }
    @Test fun automaticRollbackNoticeSurvivesProcessAndIsClaimedOnceAfterReady() {
        val h=Harness();h.pending("1.1.0");h.engine.coldStart();h.engine.coldStart()
        h.engine.coldStart() // two failed starts retained as safety net
        val next=Harness(h.root);val l=next.engine.coldStart()
        assertNull(next.engine.takeRollbackNotice(l.version,"stale"))
        next.engine.ready(l.version,l.token)
        val n=next.engine.takeRollbackNotice(l.version,l.token)!!
        assertEquals(RollbackNotice("1.1.0","1.0.0","failed-starts"),n)
        assertNull(next.engine.takeRollbackNotice(l.version,l.token))
        assertNull(next.engine.takeUpdatedNotice(l.version,l.token))
        val again=Harness(h.root);val a=again.engine.coldStart();again.engine.ready(a.version,a.token)
        assertNull(again.engine.takeRollbackNotice(a.version,a.token))
    }
    @Test fun manualRollbackNoticePreservesCauseAndCannotBeClaimedByFailedPage() {
        val h=Harness();h.pending("1.1.0");val l=h.engine.coldStart()
        assertNull(h.engine.takeRollbackNotice(l.version,l.token))
        h.engine.recover(l.version,l.token,"load-error")
        assertNull(h.engine.takeRollbackNotice(l.version,l.token))
        val a=h.engine.coldStart();h.engine.ready(a.version,a.token)
        assertEquals("load-error",h.engine.takeRollbackNotice(a.version,a.token)!!.reason)
    }
}
