package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*

class UpdatedNoticeTest {
    @Test fun baselineReadinessHasNoUpdateNotice() {
        val h=Harness(); val launch=h.engine.coldStart()
        assertTrue(h.engine.ready(launch.version,launch.token))
        assertNull(h.engine.takeUpdatedNotice(launch.version,launch.token))
    }
    @Test fun newVersionNoticeRequiresReadinessAndIsClaimedOnceAcrossProcesses() {
        val h=Harness(); h.pending("1.1.0"); val launch=h.engine.coldStart()
        assertNull(h.engine.takeUpdatedNotice(launch.version,launch.token))
        h.engine.ready(launch.version,launch.token)
        val notice=h.engine.takeUpdatedNotice(launch.version,launch.token)!!
        assertEquals("1.0.0",notice.from); assertEquals("1.1.0",notice.to)
        assertEquals(h.engine.manifest("1.1.0").message,notice.notes)
        assertNull(h.engine.takeUpdatedNotice(launch.version,launch.token))
        val next=Harness(h.root); val again=next.engine.coldStart();next.engine.ready(again.version,again.token)
        assertNull(next.engine.takeUpdatedNotice(again.version,again.token))
    }
    @Test fun staleReadinessCannotConsumeNotice() {
        val h=Harness();h.pending("1.1.0");val launch=h.engine.coldStart()
        h.engine.ready(launch.version,launch.token)
        assertNull(h.engine.takeUpdatedNotice("1.0.0",launch.token))
        assertNull(h.engine.takeUpdatedNotice(launch.version,"stale"))
        assertNotNull(h.engine.takeUpdatedNotice(launch.version,launch.token))
    }
    @Test fun crashBeforeReadyDefersNoticeUntilSuccessfulStart() {
        val h=Harness();h.pending("1.1.0");h.engine.coldStart()
        val next=Harness(h.root);val launch=next.engine.coldStart();next.engine.ready(launch.version,launch.token)
        assertEquals("1.1.0",next.engine.takeUpdatedNotice(launch.version,launch.token)!!.to)
    }
    @Test fun subsequentUpdateUsesLastNotifiedVersion() {
        val h=Harness();h.pending("1.1.0");var launch=h.engine.coldStart();h.engine.ready(launch.version,launch.token)
        h.engine.takeUpdatedNotice(launch.version,launch.token)
        h.pending("1.1.1");launch=h.engine.coldStart();h.engine.ready(launch.version,launch.token)
        assertEquals("1.1.0",h.engine.takeUpdatedNotice(launch.version,launch.token)!!.from)
    }
}
