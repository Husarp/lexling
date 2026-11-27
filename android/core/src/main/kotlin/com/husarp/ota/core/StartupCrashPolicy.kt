package com.husarp.ota.core

fun shouldStartInSafeMode(unfinishedStarts: Int, startupCrashRecorded: Boolean): Boolean =
    startupCrashRecorded || unfinishedStarts >= 2
