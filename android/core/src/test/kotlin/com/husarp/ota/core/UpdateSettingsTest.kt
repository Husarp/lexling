package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*

class UpdateSettingsTest {
    private val defaults = UpdateSettings(setupAnswered=true)
    @Test fun defaultsAndMigration() {
        assertEquals(UpdateSettings(),migrateUpdateSettings(null))
        assertTrue(migrateUpdateSettings(true).smallFixes)
        assertFalse(migrateUpdateSettings(false).smallFixes)
        assertFalse(migrateUpdateSettings(false).majorUpdates)
        assertFalse(migrateUpdateSettings(false).setupAnswered)
        assertTrue(defaults.shellUpdates)
        assertEquals(20,defaults.wifiLimitMb); assertEquals(5,defaults.mobileLimitMb)
    }
    @Test fun everyWifiLimitBoundary() {
        for(limit in listOf(5,20,50,100)) {
            val s=defaults.copy(majorUpdates=true,wifiLimitMb=limit)
            assertTrue(automaticDownload(s,"feature",limit*MIB,true))
            assertFalse(automaticDownload(s,"feature",limit*MIB+1,true))
        }
        assertTrue(automaticDownload(defaults.copy(majorUpdates=true,wifiLimitMb=-1),"feature",1000*MIB,true))
    }
    @Test fun everyMobileLimitBoundary() {
        for(limit in listOf(5,20,50)) {
            val s=defaults.copy(majorUpdates=true,mobileLimitMb=limit)
            assertTrue(automaticDownload(s,"feature",limit*MIB,false))
            assertFalse(automaticDownload(s,"feature",limit*MIB+1,false))
        }
        assertFalse(automaticDownload(defaults.copy(mobileLimitMb=0),"fix",0,false))
        assertTrue(automaticDownload(defaults.copy(majorUpdates=true,mobileLimitMb=-1),"feature",1000*MIB,false))
    }
    @Test fun networksAreIndependent() {
        val s=defaults.copy(majorUpdates=true)
        assertTrue(automaticDownload(s,"feature",10*MIB,true))
        assertFalse(automaticDownload(s,"feature",10*MIB,false))
    }
    @Test fun switchesAreIndependent() {
        assertTrue(automaticDownload(defaults,"fix",5*MIB,true))
        assertFalse(automaticDownload(defaults,"fix",5*MIB+1,true))
        assertFalse(automaticDownload(defaults,"feature",1,true))
        val s=defaults.copy(smallFixes=false,majorUpdates=true)
        assertFalse(automaticDownload(s,"fix",5*MIB,true))
        assertTrue(automaticDownload(s,"fix",5*MIB+1,true))
        assertTrue(automaticDownload(s,"feature",1,true))
    }
    @Test fun unansweredSetupAllowsSmallFixesAndShellUpdatesWithinDefaults() {
        val unanswered = UpdateSettings()
        for (wifi in listOf(true, false)) {
            assertTrue(automaticDownload(unanswered,"fix",SMALL_FIX_LIMIT,wifi))
            assertFalse(automaticDownload(unanswered,"fix",SMALL_FIX_LIMIT+1,wifi,true))
            assertFalse(automaticDownload(unanswered,"feature",1,wifi,true))
            assertTrue(automaticDownload(unanswered,"shell",1,wifi))
            assertFalse(automaticDownload(unanswered,"shell",21*MIB,wifi))
        }
        assertTrue(automaticShellInstall(unanswered))
        assertFalse(automaticShellInstall(unanswered.copy(shellUpdates=false)))
        assertFalse(automaticDownload(unanswered.copy(shellUpdates=false),"shell",1,true))
    }
    @Test fun unansweredSetupPreservesOptOuts() {
        assertFalse(automaticDownload(migrateUpdateSettings(false),"fix",1,true))
        assertFalse(automaticDownload(UpdateSettings(smallFixes=false),"fix",1,true,true))
        assertFalse(automaticDownload(UpdateSettings(mobileLimitMb=0),"fix",1,false))
    }
    @Test fun criticalOverridesBothSwitchesAndAllNetworkLimitsAfterSetup() {
        val s=defaults.copy(smallFixes=false,majorUpdates=false,mobileLimitMb=0,wifiLimitMb=5)
        for(network in listOf(true,false)) assertTrue(automaticDownload(s,"feature",1000*MIB,network,true))
    }
    @Test fun shellInstallationSwitchAndDownloadLimit() {
        assertTrue(automaticShellInstall(defaults))
        assertFalse(automaticShellInstall(defaults.copy(shellUpdates=false)))
        assertFalse(automaticDownload(defaults,"shell",10*MIB,false))
        assertFalse(automaticDownload(defaults.copy(shellUpdates=false),"shell",10*MIB,true)); assertTrue(automaticDownload(defaults,"shell",10*MIB,true))
    }
    @Test fun invalidLimitsRejected() {
        for(v in listOf(-2,0,1,10)) assertThrows(IllegalArgumentException::class.java) { defaults.copy(wifiLimitMb=v).validate() }
        for(v in listOf(-2,1,100)) assertThrows(IllegalArgumentException::class.java) { defaults.copy(mobileLimitMb=v).validate() }
    }
    @Test fun checkFrequencyDefaultsMigrationAndRouting() {
        assertEquals("6h",UpdateSettings().checkFrequency)
        assertEquals("6h",migrateUpdateSettings(false).checkFrequency)
        for ((frequency,hours) in listOf("1h" to 1L,"6h" to 6L,"24h" to 24L)) {
            val s=defaults.copy(checkFrequency=frequency).validate()
            assertTrue(s.automaticChecks); assertFalse(s.checksOnOpen); assertEquals(hours,s.periodicHours)
        }
        val open=defaults.copy(checkFrequency="open").validate()
        assertTrue(open.automaticChecks); assertTrue(open.checksOnOpen); assertNull(open.periodicHours)
        val manual=defaults.copy(checkFrequency="manual").validate()
        assertFalse(manual.automaticChecks); assertFalse(manual.checksOnOpen); assertNull(manual.periodicHours)
        for(value in listOf("", "15m", "0", "6H"))
            assertThrows(IllegalArgumentException::class.java) { defaults.copy(checkFrequency=value).validate() }
    }
    @Test fun completionNoticeRequiresExactUserRequestedReplacement() {
        assertFalse(shellUpdatedNoticeRequested(-1,7)) // silent/background update
        assertFalse(shellUpdatedNoticeRequested(0,7))
        assertFalse(shellUpdatedNoticeRequested(8,7)) // no replacement yet
        assertFalse(shellUpdatedNoticeRequested(6,7)) // stale target
        assertTrue(shellUpdatedNoticeRequested(7,7))
    }
    private val embedded = bundle()
    private fun decision(s: UpdateSettings, bytes: Long, kind: String="fix", network: Boolean=true, critical: Boolean=false): Decision {
        val m=bundle("1.2.0",embedded.files+entry("padding.bin","x").copy(size=bytes)).copy(kind=kind,blocked=if(critical)listOf(embedded.version)else emptyList())
        return decide(m,embedded,embedded,2,s,network,emptyList(),emptyList(),false,null)
    }
    @Test fun overLimitIsSizedOfferRatherThanSkip() {
        val d=decision(defaults.copy(majorUpdates=true),21*MIB)
        assertEquals(Action.PROMPT,d.action); assertEquals(21*MIB,d.delta)
    }
    @Test fun settingsAppliedToRealDecision() {
        assertEquals(Action.AUTO,decision(UpdateSettings(),1).action)
        assertEquals(Action.PROMPT,decision(UpdateSettings(),SMALL_FIX_LIMIT+1).action)
        assertEquals(Action.AUTO,decision(defaults,1).action)
        assertEquals(Action.PROMPT,decision(defaults.copy(smallFixes=false),1).action)
        assertEquals(Action.AUTO,decision(defaults.copy(majorUpdates=true),10*MIB,"feature").action)
        assertEquals(Action.PROMPT,decision(defaults.copy(majorUpdates=true),10*MIB,"feature",false).action)
        assertEquals(Action.AUTO,decision(defaults,100*MIB,"feature",false,true).action)
    }
}
