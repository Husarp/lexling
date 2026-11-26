package com.husarp.ota.core

/** A completion notice belongs only to the exact APK requested by an Install tap. */
fun shellUpdatedNoticeRequested(targetCode: Int, runningCode: Int) = targetCode > 0 && targetCode == runningCode
