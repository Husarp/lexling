package com.husarp.ota.core

class UpdateNotificationGate {
    private var foreground = false

    @Synchronized fun enter(cancel: () -> Unit) {
        foreground = true
        cancel()
    }

    @Synchronized fun leave() { foreground = false }

    @Synchronized fun postInBackground(post: () -> Unit): Boolean {
        if (foreground) return false
        post()
        return true
    }
}
