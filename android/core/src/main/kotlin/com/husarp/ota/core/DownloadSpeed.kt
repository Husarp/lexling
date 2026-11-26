package com.husarp.ota.core

class DownloadSpeed(startedAt: Long) {
    private var time = startedAt
    private var bytes = 0L
    private var speed = 0L

    fun sample(received: Long, now: Long): Long {
        if (now - time < 250) return speed
        speed = ((received - bytes).coerceAtLeast(0) * 1000.0 / (now - time)).toLong()
        bytes = received
        time = now
        return speed
    }
}
