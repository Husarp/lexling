package com.husarp.ota

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.husarp.lexling.R

internal class StartupSafeModeScreen(
    activity: Activity, app: OtaApplication, retry: (builtIn: Boolean) -> Unit
) : ScrollView(activity) {
    init {
        val strings = NativeStrings.context(activity)
        val margin = (24 * resources.displayMetrics.density).toInt()
        setFillViewport(true)
        ViewCompat.setOnApplyWindowInsetsListener(this) { view, insets ->
            val safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            insets
        }
        val actions = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(margin, margin, margin, margin)
            addView(TextView(activity).apply {
                text = strings.getString(R.string.ota_safe_mode_title)
                textSize = 24f
                ViewCompat.setAccessibilityHeading(this, true)
                setPadding(0, 0, 0, margin)
            })
        }
        fun button(label: Int) = Button(activity).apply {
            text = strings.getString(label)
            isAllCaps = false
            actions.addView(this)
        }
        fun notice(message: Int) = Toast.makeText(activity, strings.getString(message), Toast.LENGTH_SHORT).show()

        val tryAgain = button(R.string.ota_safe_mode_try_again)
        val reset = button(R.string.ota_reset_builtin)
        tryAgain.setOnClickListener {
            tryAgain.isEnabled = false
            reset.isEnabled = false
            retry(false)
        }
        reset.setOnClickListener {
            tryAgain.isEnabled = false
            reset.isEnabled = false
            Thread({
                val success = try {
                    app.resetToBuiltin(strings.getString(R.string.ota_reset_builtin))
                    true
                } catch (error: Exception) {
                    Log.w("LexlingStartup", "Could not restore the built-in bundle", error)
                    false
                }
                activity.runOnUiThread {
                    if (!activity.isFinishing && !activity.isDestroyed) {
                        if (success) retry(true)
                        else {
                            tryAgain.isEnabled = true
                            reset.isEnabled = true
                            notice(R.string.ota_safe_mode_reset_failed)
                        }
                    }
                }
            }, "lexling-reset").start()
        }
        button(R.string.ota_safe_mode_download).setOnClickListener {
            try {
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/Husarp/lexling/releases/latest")))
            } catch (_: ActivityNotFoundException) {
                notice(R.string.ota_browser_unavailable)
            }
        }
        button(R.string.ota_safe_mode_copy).setOnClickListener {
            val report = app.startupCrashGuard.reportText()
            if (report.isEmpty()) notice(R.string.ota_safe_mode_no_report)
            else {
                val clipboard = activity.getSystemService(ClipboardManager::class.java)
                clipboard.setPrimaryClip(ClipData.newPlainText(strings.getString(R.string.ota_safe_mode_copy), report))
            }
        }
        addView(actions)
    }
}
