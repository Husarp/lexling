package com.husarp.ota

import android.content.Context
import android.content.res.ColorStateList
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.husarp.lexling.R
import com.husarp.ota.core.UpdateActivation
import kotlin.math.roundToInt

internal class StartupScreen(context: Context) : FrameLayout(context) {
    private val Int.dp get() = (this * resources.displayMetrics.density).roundToInt()
    private val card = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        setPadding(22.dp, 24.dp, 22.dp, 24.dp)
    }
    // Quiet startup uses the web top bar wordmark (owner, 2026-11-26).
    private val name = TextView(context).apply {
        text = SpannableString("LEX/LING").apply {
            setSpan(ForegroundColorSpan(NativeLook.accent), 3, 4, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        contentDescription = context.getString(R.string.app_name)
        textSize = 40f
        typeface = resources.getFont(R.font.lexling_wordmark)
        letterSpacing = -.02f
        includeFontPadding = false
        gravity = Gravity.CENTER
    }
    private val versionLabel = TextView(context).apply { textSize = 16f; gravity = Gravity.CENTER }
    private val status = TextView(context).apply {
        textSize = 14f; gravity = Gravity.CENTER; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    private val bar = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal)
    private var lightPalette: Boolean? = null

    init {
        isClickable = true
        elevation = 8.dp.toFloat()
        visibility = GONE
        addView(card, LayoutParams(1, WRAP_CONTENT, Gravity.CENTER))
        card.addView(name, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        card.addView(versionLabel, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        card.addView(status, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = 16.dp })
        card.addView(bar, LinearLayout.LayoutParams(124.dp, 4.dp).apply { topMargin = 13.dp })
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        card.layoutParams.width = minOf(308.dp, (width - 32.dp).coerceAtLeast(1))
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }

    fun show(version: String, step: String, light: Boolean, work: UpdateActivation.Progress? = null) {
        if (lightPalette != light) {
            lightPalette = light
            val palette = NativeLook.palette(light)
            setBackgroundColor(palette.bg)
            card.background = NativeLook.surface(
                context, if (light) palette.surface else 0xFF121212.toInt(),
                if (light) palette.line else 0xFF303030.toInt()
            )
            name.setTextColor(palette.text)
            versionLabel.setTextColor(palette.muted)
            status.setTextColor(if (light) palette.text else 0xFFDDDDDD.toInt())
            val tint = ColorStateList.valueOf(NativeLook.noticeColor(context))
            bar.indeterminateTintList = tint
            bar.progressTintList = tint
            bar.progressBackgroundTintList = ColorStateList.valueOf(palette.surface2)
        }
        if (versionLabel.text != version) versionLabel.text = version
        if (status.text != step) status.text = step
        bar.isIndeterminate = work == null || work.total == 0
        if (!bar.isIndeterminate && work != null) {
            bar.max = work.total
            bar.progress = work.done
        }
        visibility = VISIBLE
    }
}
