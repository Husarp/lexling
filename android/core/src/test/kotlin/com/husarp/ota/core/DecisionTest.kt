package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*

class DecisionTest {
    private val embedded = bundle()
    private fun decision(m: Manifest = bundle("1.0.1"), current: Manifest = embedded, auto: Boolean = true,
                         shell: Int = 1, failed: List<String> = emptyList(), blocked: List<String> = emptyList(), trial: Boolean = false, pending: String? = null) =
        decide(m,current,embedded,shell,UpdateSettings(smallFixes=auto,setupAnswered=true),true,failed,blocked,trial,pending)
    @Test fun smallFixAutomatic() { assertEquals(Action.AUTO,decision().action) }
    @Test fun equalVersionRejected() { assertEquals(Action.REJECT,decision(bundle()).action) }
    @Test fun lowerVersionRejected() { assertEquals(Action.REJECT,decision(bundle("0.9.0")).action) }
    @Test fun minShellNeedsApk() { assertEquals(Action.FULL_APP,decision(bundle("1.0.1").copy(minShellApi=2)).action) }
    @Test fun upgradedShellAccepts() { assertEquals(Action.AUTO,decision(bundle("1.0.1").copy(minShellApi=2),shell=2).action) }
    @Test fun featureAlwaysPrompts() { assertEquals(Action.PROMPT,decision(bundle("1.1.0").copy(kind="feature")).action) }
    @Test fun automaticOffPromptsForFix() { assertEquals(Action.PROMPT,decision(auto=false).action) }
    @Test fun exactFiveMiBAutomatic() {
        val file = entry("padding.bin","x").copy(size=SMALL_FIX_LIMIT)
        assertEquals(Action.AUTO,decision(bundle("1.0.1",embedded.files+file)).action)
    }
    @Test fun overFiveMiBPrompts() {
        val file = entry("padding.bin","x").copy(size=SMALL_FIX_LIMIT+1)
        assertEquals(Action.PROMPT,decision(bundle("1.0.1",embedded.files+file)).action)
    }
    @Test fun ruleUsesNetworkDeltaNotTotalBundle() {
        val big = entry("big.bin","x").copy(size=8*1024*1024)
        val current = embedded.copy(files=embedded.files+big)
        assertEquals(0,decision(current.copy(version="1.0.2"),current=current).delta)
        assertEquals(Action.AUTO,decision(current.copy(version="1.0.2"),current=current).action)
    }
    @Test fun revertingFileToEmbeddedCostsZero() {
        val current = bundle("1.0.1",listOf(entry("index.html","changed"),entry("stable.css","style")))
        assertEquals(0,decision(bundle("1.0.2"),current=current).delta)
    }
    @Test fun failedBundleNeverReoffered() { assertEquals(Action.REJECT,decision(failed=listOf("1.0.1")).action) }
    @Test fun blockedTargetRejected() { assertEquals(Action.REJECT,decision(blocked=listOf("1.0.1")).action) }
    @Test fun selfBlockedTargetRejected() { assertEquals(Action.REJECT,decision(bundle("1.0.1").copy(blocked=listOf("1.0.1"))).action) }
    @Test fun killSwitchOverridesSizeFeatureAndAutomaticOff() {
        val m = bundle("1.1.0",embedded.files+entry("big.bin","x").copy(size=SMALL_FIX_LIMIT*2)).copy(kind="feature",blocked=listOf("1.0.0"))
        assertEquals(Action.AUTO,decision(m,auto=false).action)
    }
    @Test fun killSwitchCannotOverrideShellCompatibility() {
        assertEquals(Action.FULL_APP,decision(bundle("1.0.1").copy(minShellApi=2,blocked=listOf("1.0.0"))).action)
    }
    @Test fun trialMustBecomeReadyBeforeAnotherUpdate() { assertEquals(Action.WAIT,decision(trial=true).action) }
    @Test fun alreadyStagedNotDownloadedAgain() { assertEquals(Action.WAIT,decision(pending="1.0.1").action) }
    @Test fun startupRepairAlwaysAsksAndOnlyOffersCompatibleNewFixes() {
        val fix = bundle("1.0.2", embedded.files + entry("large.bin", "x").copy(size = 25 * MIB))
        fun repair(manifest: Manifest, failed: List<String> = emptyList(), blocked: List<String> = emptyList(), pending: String? = null) =
            decide(manifest, embedded, embedded, 1, UpdateSettings(smallFixes = false, mobileLimitMb = 0),
                false, failed, blocked, true, pending, startupRecovery = true)
        assertEquals(Decision(Action.PROMPT, "Startup repair needs consent", 25 * MIB), repair(fix))
        assertEquals(Action.PROMPT, repair(fix, pending = fix.version).action)
        assertEquals(Action.WAIT, repair(fix, pending = "1.0.3").action)
        assertEquals(Action.REJECT, repair(fix.copy(kind = "feature")).action)
        assertEquals(Action.REJECT, repair(embedded).action)
        assertEquals(Action.REJECT, repair(fix, failed = listOf(fix.version)).action)
        assertEquals(Action.REJECT, repair(fix, blocked = listOf(fix.version)).action)
        assertEquals(Action.FULL_APP, repair(fix.copy(minShellApi = 2)).action)
    }
}
