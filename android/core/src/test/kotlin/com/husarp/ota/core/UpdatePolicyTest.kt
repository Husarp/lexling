package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*
import java.io.File

class UpdatePolicyTest {
    private fun shell() = ShellManifest(versionCode=4,versionName="1.2.0",shellApi=2,apk="example-v4.apk",size=100,sha256="a".repeat(64),embeddedWebVersion="1.0.0",notes="test",releasedAt=NOW-1000,expiresAt=NOW+1000)
    @Test fun signedShellEnvelopeUsesSameVerifier() { val s=Signing(); val m=shell(); assertEquals(m,s.verifier.verifyShell(s.signBytes(json.toJson(m).toByteArray()),NOW,3)) }
    @Test fun tamperedShellRejected() { val s=Signing(); val e=s.signBytes(json.toJson(shell()).toByteArray()).toString(Charsets.UTF_8).replace("signature\":\"","signature\":\"AAAA"); expectFailure { s.verifier.verifyShell(e.toByteArray(),NOW,3) } }
    @Test fun wrongShellSignerRejected() { val a=Signing(); expectFailure { Signing().verifier.verifyShell(a.signBytes(json.toJson(shell()).toByteArray()),NOW,3) } }
    @Test fun shellDowngradeAndEqualRejected() { for(code in listOf(4L,5L)) expectFailure { validateShell(shell(),NOW,code) } }
    @Test fun shellHigherCodeAcceptedIndependentOfWebVersion() { validateShell(shell(),NOW,3) }
    @Test fun shellCodeOutsideAndroidRangeRejected() { for(code in listOf(0L,2147483648L)) expectFailure { validateShell(shell().copy(versionCode=code),NOW,-1) } }
    @Test fun shellExpiryAndFutureReleaseRejected() { for(m in listOf(shell().copy(expiresAt=NOW),shell().copy(releasedAt=NOW+1),shell().copy(expiresAt=NOW-2000))) expectFailure { validateShell(m,NOW,3) } }
    @Test fun shellUnsafeAssetRejected() { for(apk in listOf("../test.apk","https://example.com/x.apk","a/b.apk","a.apk?x",".apk")) expectFailure { validateShell(shell().copy(apk=apk),NOW,3) } }
    @Test fun shellBadHashSizeAndApiRejected() { for(m in listOf(shell().copy(sha256="bad"),shell().copy(size=0),shell().copy(size=MAX_FILE+1),shell().copy(shellApi=0),shell().copy(schema=2))) expectFailure { validateShell(m,NOW,3) } }
    @Test fun shellInvalidVersionsRejected() { for(m in listOf(shell().copy(versionName="1.2"),shell().copy(embeddedWebVersion="bad"))) expectFailure { validateShell(m,NOW,3) } }
    @Test fun webWaitsThenBecomesAutomaticAfterShellUpdate() {
        val m=bundle("1.0.1").copy(minShellApi=2)
        assertTrue(webWaitsForShell(m,1)); assertFalse(webWaitsForShell(m,2))
        assertEquals(Action.FULL_APP,decide(m,bundle(),bundle(),1,UpdateSettings(setupAnswered=true),true,emptyList(),emptyList(),false,null).action)
        assertEquals(Action.AUTO,decide(m,bundle(),bundle(),2,UpdateSettings(setupAnswered=true),true,emptyList(),emptyList(),false,null).action)
    }
    @Test fun quickApplyExactDeadlineNeverWaitsAgain() { assertEquals(0L,quickApplyRemaining(2000,false)); assertEquals(0L,quickApplyRemaining(9000,false)) }
    @Test fun quickApplyUsesRemainingBudget() { assertEquals(2000L,quickApplyRemaining(0,false)); assertEquals(1L,quickApplyRemaining(1999,false)) }
    @Test fun stagedBundleNeverWaitsForNetwork() { assertEquals(0L,quickApplyRemaining(0,true)) }
    @Test fun shellUpgradeRetainsNewerCompatibleDownloadedWeb() {
        val h=Harness(); h.good("1.0.1")
        val next=Harness(h.root,shell=2)
        assertEquals("1.0.1",next.engine.coldStart().version); assertFalse(next.engine.snapshot().trial)
    }
    @Test fun shellUpgradePreservesPendingTrialAndFailureLists() {
        val h=Harness(); h.engine.blocked(listOf("1.0.3")); h.pending("1.0.2")
        val next=Harness(h.root,shell=2); assertEquals("1.0.2",next.engine.coldStart().version)
        assertEquals(1,next.engine.snapshot().trialStarts); assertTrue("1.0.3" in next.engine.snapshot().blocked)
    }
    @Test fun shellUpgradeDoesNotConsumeTrialInWorker() {
        val h=Harness(); h.pending("1.0.1"); h.engine.coldStart()
        val next=Harness(h.root,shell=2); next.engine.reconcileShell()
        assertEquals(1,next.engine.snapshot().trialStarts); assertEquals("1.0.1",next.engine.snapshot().current)
    }
    @Test fun newerEmbeddedBeatsCurrentButNewerPendingWins() {
        val h=Harness(); h.good("1.0.1"); h.pending("1.0.3")
        val next=Harness(h.root,embedded=bundle("1.0.2"),shell=2)
        assertEquals("1.0.3",next.engine.coldStart().version); assertEquals("1.0.2",next.engine.snapshot().previous)
    }
    @Test fun changedApkBaselineRejectsIncompleteOverlay() {
        val h=Harness(); h.good("1.0.1")
        val newBase=bundle().copy(files=listOf(entry("index.html","changed")))
        val next=Harness(h.root,embedded=newBase,shell=2)
        assertEquals("1.0.0",next.engine.coldStart().version)
    }
    @Test fun compatibilityRequiresEveryFileFromNewApkOrOverlay() {
        val m=bundle("1.0.1")
        assertTrue(bundleCompatible(m,bundle(),2) { false })
        assertFalse(bundleCompatible(m.copy(minShellApi=3),bundle(),2) { true })
        val changed=m.copy(files=listOf(entry("index.html","new")))
        assertFalse(bundleCompatible(changed,bundle(),2) { false }); assertTrue(bundleCompatible(changed,bundle(),2) { true })
    }
    @Test fun shellManifestRedirectPinsFixedReleaseBeforeCdn() {
        assertEquals("https://github.com/example/app/releases/download/shell-channel/shell.json",assetManifestUrl(listOf("https://github.com/example/app/releases/download/shell-channel/shell.json","https://release-assets.githubusercontent.com/one/shell")))
    }
    @Test fun workerReconciliationNeverActivatesPendingOrStartsTrial() {
        val h=Harness(); h.pending("1.0.1"); val worker=Harness(h.root)
        worker.engine.reconcileShell(); assertEquals("1.0.0",worker.engine.snapshot().current)
        assertEquals("1.0.1",worker.engine.snapshot().pending); assertEquals(0,worker.engine.snapshot().trialStarts)
    }
    @Test fun timedOutQuickDownloadContinuesAndCanStageForNextStart() {
        val download=java.util.concurrent.CompletableFuture<Unit>()
        assertEquals(QuickApplyResult.TIMED_OUT,awaitQuickApply(download,1999,false))
        assertFalse(download.isCancelled); assertFalse(download.isDone)
        val h=Harness(); val first=h.engine.coldStart(); h.pending("1.0.1"); download.complete(Unit)
        assertEquals("1.0.0",first.version); assertEquals("1.0.1",Harness(h.root).engine.coldStart().version)
    }
    @Test fun quickDownloadReadyBeforeDeadlineLoadsNewTrialImmediately() {
        val h=Harness(); h.pending("1.0.1")
        assertEquals(QuickApplyResult.READY,awaitQuickApply(java.util.concurrent.CompletableFuture.completedFuture(Unit),100,false))
        assertEquals("1.0.1",h.engine.coldStart().version)
    }
    @Test fun quickErrorStartsCurrentWithoutCancellingFuture() {
        val broken=java.util.concurrent.CompletableFuture<Unit>(); broken.completeExceptionally(IllegalStateException("offline"))
        assertEquals(QuickApplyResult.FAILED,awaitQuickApply(broken,0,false))
        assertEquals(QuickApplyResult.READY,awaitQuickApply(broken,0,true))
        assertEquals(QuickApplyResult.CURRENT,awaitQuickApply(null,0,false))
    }
    @Test fun backgroundWorkerCanReuseCurrentOverlayBeforeAnyActivityLaunch() {
        val h=Harness(); val m=bundle("1.0.1",listOf(entry("index.html","changed")))
        val stage=h.stage(m); val files=File(stage,"files").apply { mkdirs() }; File(files,"index.html").writeText("changed")
        h.engine.commit(m,stage); val launch=h.engine.coldStart(); h.engine.ready(launch.version,launch.token)
        val background=Harness(h.root)
        assertEquals("changed",background.engine.currentOverlayFile("index.html")!!.readText())
        assertEquals(0,background.engine.snapshot().trialStarts)
    }

}
