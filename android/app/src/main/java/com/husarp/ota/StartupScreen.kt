package com.husarp.ota

import android.content.Context
import android.content.res.ColorStateList
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import java.util.Locale
import kotlin.math.roundToInt

internal class StartupScreen(context: Context, appName: String) : FrameLayout(context) {
    private val Int.dp get() = (this * resources.displayMetrics.density).roundToInt()
    private val card = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        setPadding(24.dp, 24.dp, 24.dp, 24.dp)
    }
    private val name = TextView(context).apply {
        text = appName.uppercase(Locale.ROOT)
        textSize = 40f
        typeface = NativeLook.heading(context)
        gravity = Gravity.CENTER
    }
    private val versionLabel = TextView(context).apply { textSize = 16f; gravity = Gravity.CENTER }
    private val status = TextView(context).apply {
        textSize = 14f; gravity = Gravity.CENTER; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    private val spinner = ProgressBar(context).apply { importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO }
    private var lightPalette: Boolean? = null

    init {
        isClickable = true
        elevation = 8.dp.toFloat()
        visibility = GONE
        addView(card, LayoutParams(1, WRAP_CONTENT, Gravity.CENTER))
        card.addView(name, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        card.addView(versionLabel, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        card.addView(status, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = 8.dp })
        card.addView(spinner, LinearLayout.LayoutParams(24.dp, 24.dp).apply { topMargin = 20.dp })
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        card.layoutParams.width = minOf(384.dp, (width - 32.dp).coerceAtLeast(1))
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }

    fun show(version: String, step: String, light: Boolean) {
        if (lightPalette != light) {
            lightPalette = light
            val palette = NativeLook.palette(light)
            setBackgroundColor(palette.bg)
            card.background = NativeLook.surface(context, palette.surface, palette.line)
            name.setTextColor(palette.text)
            versionLabel.setTextColor(palette.muted)
            status.setTextColor(palette.muted)
            spinner.indeterminateTintList = ColorStateList.valueOf(NativeLook.accent)
        }
        if (versionLabel.text != version) versionLabel.text = version
        if (status.text != step) status.text = step
        visibility = VISIBLE
    }
}
