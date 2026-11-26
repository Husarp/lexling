package com.husarp.ota

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.text.TextUtils
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.husarp.ota.core.UpdateBannerStep
import com.husarp.lexling.R

internal data class UpdateBannerItem(
    val key: String, val title: String, val text: String, val actionLabel: String? = null,
    val action: (() -> Unit)? = null, val percent: Int? = null, val downloading: Boolean = false,
    val keepOnAction: Boolean = false, val installing: Boolean = false, val brief: Boolean = false,
    val step: UpdateBannerStep? = null, val speed: Long = 0
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
        return listOfNotNull(item.percent?.let { context.getString(R.string.ota_progress_percent, it) }, speed).joinToString("  ")
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
        val card = NativeLook.surface(context, palette.surface, NativeLook.accent)
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            elevation = 2.dp.toFloat()
            background = card
            setPadding(13.dp, 12.dp, 8.dp, 12.dp)
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
        row.addView(ImageView(context).apply {
            setImageResource(R.drawable.ic_stat_update); setColorFilter(NativeLook.accent)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(22.dp, 22.dp).apply { setMargins(0, 6.dp, 10.dp, 0) })
        val copy = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        row.addView(copy, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        copy.addView(TextView(context).apply {
            text = item.title; textSize = 20f; typeface = NativeLook.heading(context); setTextColor(palette.text)
            maxLines = 2; ellipsize = TextUtils.TruncateAt.END; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        })
        if (item.text.isNotEmpty()) copy.addView(TextView(context).apply { text = item.text; textSize = 14f; setTextColor(palette.text) })
        if (item.downloading || item.installing) {
            if (item.downloading) progressLabel = TextView(context).apply {
                text = progressText(context, item); textSize = 12f; setTextColor(palette.muted)
                fontFeatureSettings = "tnum"
                visibility = if (text.isEmpty()) View.GONE else View.VISIBLE
                copy.addView(this)
            }
            val bar = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
                max = 100; isIndeterminate = item.percent == null; progress = item.percent ?: 0
                contentDescription = if (item.installing) context.getString(R.string.ota_installing_update) else context.getString(R.string.ota_download_progress)
                progressTintList = ColorStateList.valueOf(NativeLook.accent)
                indeterminateTintList = ColorStateList.valueOf(NativeLook.accent)
                progressBackgroundTintList = ColorStateList.valueOf(palette.line)
            }
            progress = bar
            copy.addView(bar)
        }
        if (item.actionLabel != null) copy.addView(NativeLook.button(context, primary = item.keepOnAction).apply {
            text = item.actionLabel
            setOnClickListener { if (!item.keepOnAction) dismissItem(); item.action?.invoke() }
        })
        if (!item.installing) row.addView(Button(context).apply {
            text = "✕"; contentDescription = context.getString(R.string.ota_dismiss_notice); setTextColor(palette.text)
            backgroundTintList = ColorStateList.valueOf(Color.TRANSPARENT)
            stateListAnimator = null
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
        if (item.brief) row.postDelayed({ if (panel === row) dismissItem() }, 5000)
    }
}
