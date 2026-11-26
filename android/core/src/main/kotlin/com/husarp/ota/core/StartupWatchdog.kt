package com.husarp.ota.core

const val STARTUP_TIMEOUT_MS = 10_000L

class StartupWatchdog {
    private var token: String? = null
    private var last: Long = 0
    private var active = false
    private var elapsed = 0L
    private var waited = false
    private var ready = false
    private var simulated = false
    private var failure: String? = null

    @get:Synchronized val reason: String? get() =
        if (!ready && elapsed >= STARTUP_TIMEOUT_MS) failure ?: "ready-timeout" else null
    @get:Synchronized val showLoading: Boolean get() = !ready && !waited && reason == null

    @Synchronized fun launch(value: String, now: Long, simulate: Boolean) {
        if (token == value) return
        token = value; last = now; active = false; elapsed = 0; waited = false
        ready = false; simulated = simulate; failure = null
    }
    @Synchronized fun update(now: Long, eligible: Boolean): Long? {
        if (active) elapsed += (now - last).coerceAtLeast(0)
        last = now; active = eligible && !ready
        return if (active && reason == null) STARTUP_TIMEOUT_MS - elapsed else null
    }
    @Synchronized fun failed(value: String, cause: String) {
        if (token == value && !ready && failure == null) failure = cause
    }
    @Synchronized fun acceptsReady(value: String) = token == value && !simulated
    @Synchronized fun markReady(value: String) {
        if (acceptsReady(value)) { ready = true; active = false }
    }
    @Synchronized fun waitLonger(now: Long) {
        waited = true; elapsed = 0; last = now
    }
}
