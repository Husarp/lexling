package com.husarp.ota.core

import org.junit.Assert.*
import org.junit.Test

class UpdateBannerFlowTest {
    @Test fun `offer titles show metadata bytes and omit missing sizes`() {
        assertEquals("Update 1.4.2 · 7.6 MB", updateOfferTitle("Update", "1.4.2", 7_600_000))
        assertEquals("App update 1.4.2 · 2.0 kB", updateOfferTitle("App update", "1.4.2", 2_048))
        assertEquals("Update 1.4.2 · 0 B", updateOfferTitle("Update", "1.4.2", 0))
        assertEquals("Update 1.4.2", updateOfferTitle("Update", "1.4.2", -1))
    }

    @Test fun `late and duplicate snapshots do not regress a bundle or APK banner`() {
        for (channel in listOf("web", "shell")) {
            val target = "$channel:1.4.1"
            val flow = UpdateBannerFlow<UpdateBannerStep> { it }
            val available = UpdateBannerStep(target, UpdateBannerPhase.AVAILABLE)
            val downloading = available.copy(phase = UpdateBannerPhase.DOWNLOADING)
            val ready = available.copy(phase = UpdateBannerPhase.READY)
            val installing = available.copy(phase = UpdateBannerPhase.INSTALLING)

            assertEquals(available, flow.select(listOf(available)))
            assertEquals(downloading, flow.select(listOf(available, downloading)))
            assertEquals(downloading, flow.select(emptyList(), failed = { it.target != target }))
            assertEquals(downloading, flow.select(listOf(available)))
            assertEquals(ready, flow.select(listOf(downloading, ready)))
            assertEquals(ready, flow.select(listOf(downloading, available)))
            assertEquals(installing, flow.select(listOf(ready, available, installing)))
            assertEquals(installing, flow.select(listOf(available, downloading)))
            assertEquals(installing, flow.select(emptyList()))
            assertEquals(ready, flow.select(listOf(ready), failed = { it.target == target }))
            flow.clear()
            assertNull(flow.select(emptyList()))
        }
    }

    @Test fun `the native banner is a fallback even in maintenance`() {
        assertFalse(UpdateBannerFlow.nativeOwns(true, false))
        assertFalse(UpdateBannerFlow.nativeOwns(true, true))
        assertFalse(UpdateBannerFlow.nativeOwns(null, false))
        assertTrue(UpdateBannerFlow.nativeOwns(null, true))
        assertTrue(UpdateBannerFlow.nativeOwns(false, false))
        assertTrue(UpdateBannerFlow.nativeOwns(false, true))
    }
}
