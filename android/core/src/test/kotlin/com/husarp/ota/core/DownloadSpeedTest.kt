package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.assertEquals

class DownloadSpeedTest {
    @Test fun samplesRecentNetworkBytes() {
        val speed = DownloadSpeed(0)
        assertEquals(0L, speed.sample(50, 100))
        assertEquals(2_400_000L, speed.sample(1_200_000, 500))
        assertEquals(100_000L, speed.sample(1_250_000, 1000))
        assertEquals(0L, speed.sample(1_250_000, 1500))
    }
}
