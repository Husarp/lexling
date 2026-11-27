package com.husarp.ota

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.husarp.ota.core.UpdateBannerStep
import com.husarp.ota.core.UpdateBannerPhase
import com.husarp.lexling.R

internal data class UpdateBannerItem(
    val key: String, val title: String, val text: String, val actionLabel: String? = null,
    val action: (() -> Unit)? = null, val percent: Int? = null, val downloading: Boolean = false,
    val keepOnAction: Boolean = false, val installing: Boolean = false,
    val step: UpdateBannerStep? = null, val speed: Long = 0,
    val received: Long = 0, val total: Long = 0, val symbol: String? = null, val spacedAction: Boolean = false
)

internal class NativeUpdateBanner(private val host: FrameLayout, private val dismiss: (String) -> Unit) {
    private var panel: View? = null
    private var progress: ProgressBar? = null
    private var progressLabel: TextView? = null
    private var key: String? = null
    private var light = false
    private var language: String? = null
    private val Int.dp get() = (this * host.resources.displayMetrics.density + .5f).toInt()

    fun clear() {
        panel?.let(host::removeView)
        panel = null; progress = null; progressLabel = null; key = null
    }

    private fun progressText(context: Context, item: UpdateBannerItem): String {
        val speed = when {
            item.speed >= 1_000_000 -> context.getString(R.string.ota_speed_mb, item.speed / 1_000_000.0)
            item.speed >= 1_000 -> context.getString(R.string.ota_speed_kb, item.speed / 1_000.0)
            item.speed > 0 -> context.getString(R.string.ota_speed_bytes, item.speed)
            else -> null
        }
        val amount = when {
            item.total > 0 -> context.getString(R.string.ota_download_amount, item.received / 1_000_000.0, item.total / 1_000_000.0)
            item.received > 0 -> context.getString(R.string.ota_amount_mb, item.received / 1_000_000.0)
            else -> null
        }
        return listOfNotNull(item.percent?.let { context.getString(R.string.ota_progress_percent, it) }, amount, speed).joinToString(" · ")
    }

    fun render(item: UpdateBannerItem?, top: Int, left: Int, right: Int) {
        if (item == null) { clear(); return }
        val currentLight = NativeLook.light(host.context)
        val currentLanguage = NativeStrings.language(host.context)
        val startMargin = maxOf(left, 12.dp)
        val endMargin = maxOf(right, 12.dp)
        val layout = FrameLayout.LayoutParams(
            minOf(448.dp, host.width.takeIf { it > 0 }?.minus(startMargin + endMargin) ?: 320.dp).coerceAtLeast(1),
            FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.CENTER_HORIZONTAL
        ).apply { setMargins(startMargin, top, endMargin, 0) }
        if (key == item.key && light == currentLight && language == currentLanguage) {
            val previous = panel?.layoutParams as? FrameLayout.LayoutParams
            if (previous == null || previous.topMargin != layout.topMargin || previous.leftMargin != layout.leftMargin ||
                previous.rightMargin != layout.rightMargin || previous.width != layout.width) panel?.layoutParams = layout
            progress?.apply { isIndeterminate = item.percent == null; item.percent?.let { setProgress(it) } }
            progressLabel?.apply { text = progressText(context, item); visibility = if (text.isEmpty()) View.GONE else View.VISIBLE }
            return
        }
        val alreadyVisible = panel != null
        clear()
        key = item.key
        light = currentLight
        language = currentLanguage
        val context = NativeLook.context(NativeStrings.context(host.context, currentLanguage))
        val palette = NativeLook.palette(light)
        // The B notice layout uses an even outline and an accent download icon (owner, 2026-11-26).
        val card = NativeLook.surface(context, palette.surface, NativeLook.noticeOutline(context))
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            if (item.installing) gravity = Gravity.CENTER_VERTICAL
            elevation = 2.dp.toFloat()
            background = card
            setPadding(12.dp, 12.dp, 8.dp, 12.dp)
        }
        fun dismissItem() { dismiss(item.key) }
        var down = 0f
        row.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> { down = event.rawY; true }
                MotionEvent.ACTION_UP -> { if (!item.installing && down - event.rawY > 36.dp) dismissItem(); true }
                else -> true
            }
        }
        val symbol = item.symbol ?: when (item.step?.phase) {
            UpdateBannerPhase.AVAILABLE, UpdateBannerPhase.DOWNLOADING -> "↓"
            UpdateBannerPhase.READY -> "✓"
            UpdateBannerPhase.INSTALLING -> "↻"
            null -> "!"
        }
        val icon = if (symbol == "↓") ImageView(context).apply {
            setImageResource(R.drawable.ic_ota_download)
            setColorFilter(NativeLook.accent)
            setPadding(5.dp, 5.dp, 5.dp, 5.dp)
            background = NativeLook.surface(context, palette.surface2)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        } else NativeLook.noticeMark(context, symbol)
        row.addView(icon, LinearLayout.LayoutParams(30.dp, 30.dp).apply { marginEnd = 10.dp })
        val copy = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        row.addView(copy, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        copy.addView(TextView(context).apply {
            text = item.title; textSize = 15f; typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(palette.text); accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        })
        if (item.downloading || item.installing) {
            val bar = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
                max = 100; isIndeterminate = item.percent == null; progress = item.percent ?: 0
                contentDescription = if (item.installing) context.getString(R.string.ota_installing_update) else context.getString(R.string.ota_download_progress)
                val tint = ColorStateList.valueOf(if (item.downloading) NativeLook.accent else NativeLook.noticeColor(context))
                progressTintList = tint
                indeterminateTintList = tint
                progressBackgroundTintList = ColorStateList.valueOf(palette.surface2)
            }
            progress = bar
            copy.addView(bar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 4.dp).apply { topMargin = 7.dp })
            if (item.downloading) progressLabel = TextView(context).apply {
                text = progressText(context, item); textSize = 12f; setTextColor(palette.muted)
                fontFeatureSettings = "tnum"
                visibility = if (text.isEmpty()) View.GONE else View.VISIBLE
                copy.addView(this, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = 4.dp })
            }
        }
        if (item.text.isNotEmpty()) copy.addView(TextView(context).apply {
            text = item.text; textSize = 13f; setTextColor(if (light) palette.muted else 0xFFBCBCBC.toInt())
            setPadding(0, 5.dp, 0, 0)
        })
        if (item.actionLabel != null) copy.addView(NativeLook.button(context, primary = true).apply {
            text = item.actionLabel
            minHeight = 44.dp; minimumHeight = 44.dp
            setOnClickListener { if (!item.keepOnAction) dismissItem(); item.action?.invoke() }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = if (item.spacedAction) 12.dp else 5.dp
            if (item.spacedAction) gravity = Gravity.END
        })
        if (!item.installing) row.addView(NativeLook.button(context, ghost = true).apply {
            text = "✕"; contentDescription = context.getString(R.string.ota_dismiss_notice)
            setPadding(0, 0, 0, 0)
            setOnClickListener { dismissItem() }
        }, LinearLayout.LayoutParams(44.dp, 44.dp))
        host.addView(row, layout)
        panel = row
        if (!alreadyVisible) row.post {
            if (panel === row && !item.installing && ValueAnimator.areAnimatorsEnabled()) {
                row.translationY = -row.height.toFloat()
                row.alpha = 0f
                row.animate().translationY(0f).alpha(1f).setDuration(220).start()
            }
        }
    }
}
