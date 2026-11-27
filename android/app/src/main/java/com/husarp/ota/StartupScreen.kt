package com.husarp.ota

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.husarp.lexling.R
import com.husarp.ota.core.UpdateActivation
import kotlin.math.roundToInt
import kotlin.random.Random

internal class StartupScreen(context: Context) : FrameLayout(context) {
    private val Int.dp get() = (this * resources.displayMetrics.density).roundToInt()
    private val scattered = Random.nextBoolean()
    private val art by lazy {
        BitmapFactory.decodeResource(resources, if (scattered) R.drawable.startup_scattered else R.drawable.startup_single)
    }
    private val artBounds = RectF()
    private val artPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val fade = Paint()
    private var bottomInset = 0

    private val brand = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
    }
    private val status = TextView(context).apply {
        textSize = 14f
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        visibility = GONE
    }
    private val name = TextView(context).apply {
        text = SpannableString("LEX/LING").apply {
            setSpan(ForegroundColorSpan(NativeLook.accent), 3, 4, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        setTextColor(Color.WHITE)
        typeface = resources.getFont(R.font.lexling_wordmark)
        letterSpacing = -.025f
        includeFontPadding = false
        gravity = Gravity.CENTER
    }
    private val bar = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
        layoutDirection = View.LAYOUT_DIRECTION_LTR
        setPadding(0, 0, 0, 0)
        progressTintList = null
        progressBackgroundTintList = null
        indeterminateTintList = ColorStateList.valueOf(NativeLook.accent)
        progressDrawable = context.getDrawable(R.drawable.startup_progress)
    }

    init {
        isClickable = true
        elevation = 8.dp.toFloat()
        visibility = GONE
        setBackgroundColor(Color.BLACK)
        addView(brand, LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL))
        brand.addView(status, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { bottomMargin = 12.dp })
        brand.addView(name)
        brand.addView(bar, LinearLayout.LayoutParams(1, 4.dp).apply { topMargin = 24.dp })

        ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
            val safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            if (bottomInset != safe.bottom) {
                bottomInset = safe.bottom
                requestLayout()
            }
            setPadding(safe.left, safe.top, safe.right, 0)
            insets
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val height = MeasureSpec.getSize(heightMeasureSpec)
        val safeWidth = (width - paddingLeft - paddingRight).coerceAtLeast(1)
        val brandWidth = minOf(safeWidth, height).coerceAtLeast(1)
        val titleSize = (brandWidth * .16f).coerceIn(46.dp.toFloat(), 74.dp.toFloat())
        if (name.textSize != titleSize) name.setTextSize(TypedValue.COMPLEX_UNIT_PX, titleSize)
        (brand.layoutParams as LayoutParams).apply {
            this.width = brandWidth
            bottomMargin = maxOf((height * .08f).roundToInt(), bottomInset + 8.dp)
        }
        bar.layoutParams.width = (brandWidth * .36f).roundToInt().coerceAtLeast(1)
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w == 0 || h == 0) return
        // Scattered spans the portrait screen from the top. L Tile uses a centered cover crop.
        val scale = if (scattered) minOf(w.toFloat(), h * .65f) / art.width
            else maxOf(w.toFloat() / art.width, h.toFloat() / art.height)
        val artWidth = art.width * scale
        val artHeight = art.height * scale
        val left = (w - artWidth) / 2
        val top = if (scattered) 0f else (h - artHeight) / 2
        artBounds.set(left, top, left + artWidth, top + artHeight)
        fade.shader = if (scattered) {
            LinearGradient(0f, h * .55f, 0f, h * .82f, Color.TRANSPARENT, Color.BLACK, Shader.TileMode.CLAMP)
        } else {
            LinearGradient(0f, 0f, 0f, h.toFloat(),
                intArrayOf(Color.TRANSPARENT, 0x5C000000, 0xDB000000.toInt()),
                floatArrayOf(.55f, .78f, 1f), Shader.TileMode.CLAMP)
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawBitmap(art, null, artBounds, artPaint)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), fade)
    }

    fun show(version: String, step: String, work: UpdateActivation.Progress? = null) {
        val appName = context.getString(R.string.app_name)
        name.contentDescription = if (work == null) "$appName. $step" else appName
        status.visibility = if (work == null) GONE else VISIBLE
        if (work != null && status.text != step) status.text = step
        bar.contentDescription = version
        bar.importantForAccessibility = if (work == null) IMPORTANT_FOR_ACCESSIBILITY_NO else IMPORTANT_FOR_ACCESSIBILITY_AUTO
        val total = work?.total ?: 0
        bar.isIndeterminate = work != null && total == 0
        if (!bar.isIndeterminate) {
            bar.max = if (total > 0) total else 100
            bar.progress = work?.done ?: 58
        }
        visibility = VISIBLE
    }
}
