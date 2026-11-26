package com.husarp.lexling

import android.os.VibrationEffect
import android.os.Vibrator
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "GameVibration")
class GameVibrationPlugin : Plugin() {
    // Match the web pattern, with a zero delay before the first pulse (owner, 2026-11-26).
    @PluginMethod
    fun vibrate(call: PluginCall) {
        val pattern = call.getArray("pattern")
        if (pattern == null || pattern.length() !in listOf(1, 3)) {
            call.reject("Invalid vibration pattern")
            return
        }
        val timings = LongArray(pattern.length() + 1) { i -> if (i == 0) 0L else pattern.optLong(i - 1, -1L) }
        if (timings.drop(1).any { it !in 1L..180L }) {
            call.reject("Invalid vibration duration")
            return
        }
        val vibrator = context.getSystemService(Vibrator::class.java)
        if (vibrator?.hasVibrator() == true) vibrator.vibrate(VibrationEffect.createWaveform(timings, -1))
        call.resolve()
    }
}
