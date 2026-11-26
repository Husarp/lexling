package com.husarp.ota.core

import org.junit.Assert.*
import org.junit.Test

class UpdateActivationTest {
    @Test fun installIgnoresDuplicateAndOutOfOrderTransitions() {
        val flow = UpdateActivation()
        flow.begin("1.4.0")
        assertFalse(flow.advance("1.3.0"))
        assertEquals(UpdateActivation.Step.CHECKING_FILES, flow.current?.step)
        assertTrue(flow.advance("1.4.0"))
        flow.begin("1.4.0")
        flow.finish("1.3.0")
        assertFalse(flow.advance("1.4.0"))
        assertEquals(UpdateActivation.Step.APPLYING, flow.current?.step)
        flow.finish("1.4.0")
        assertNull(flow.current)
        assertFalse(flow.advance("1.4.0"))
    }

    @Test fun applyStartsOnlyAfterPendingFilesAreAcceptedAndNoticeIsDurable() {
        val app = Harness()
        app.engine.coldStart()
        app.pending("1.0.1")
        val flow = UpdateActivation()
        flow.begin("1.0.1")
        val launch = app.engine.coldStart { assertTrue(flow.advance(it)) }
        assertEquals(UpdateActivation.Progress(launch.version, UpdateActivation.Step.APPLYING), flow.current)
        assertNull(app.engine.takeUpdatedNotice(launch.version, launch.token))
        assertTrue(app.engine.ready(launch.version, launch.token))
        flow.finish(launch.version)
        assertEquals(launch.version, app.engine.takeUpdatedNotice(launch.version, launch.token)?.to)
        val rebooted = Harness(app.root).engine
        val restarted = rebooted.coldStart { fail("Already applied") }
        assertNull(rebooted.takeUpdatedNotice(restarted.version, restarted.token))
    }

    @Test fun staleApkOfferCannotReturnWhileReadyInstallingOrAfterRestart() {
        assertTrue(isUpdateOffer(1400, 1300, null, null))
        assertFalse(isUpdateOffer(1400, 1300, 1400, null))
        assertFalse(isUpdateOffer(1400, 1300, null, 1400))
        assertFalse(isUpdateOffer(1400, 1400, null, null))
        assertTrue(isUpdateOffer(1401, 1400, null, null))
    }
}
