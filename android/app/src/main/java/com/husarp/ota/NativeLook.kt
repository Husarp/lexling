package com.husarp.ota

import android.app.AlertDialog
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.InsetDrawable
import android.graphics.drawable.RippleDrawable
import android.view.ContextThemeWrapper
import android.widget.Button
import android.widget.TextView
import androidx.core.view.ViewCompat
import com.husarp.lexling.R
import kotlin.math.roundToInt

internal object NativeLook {
    private const val LIGHT = "light"
    val accent = Color.rgb(219, 81, 38)
    val danger = Color.rgb(192, 57, 43)

    data class Palette(val bg: Int, val surface: Int, val surface2: Int, val line: Int, val text: Int, val muted: Int)

    private val dark = Palette(Color.BLACK, 0xFF1A1A1A.toInt(), 0xFF262626.toInt(), 0xFF4A4A4A.toInt(), Color.WHITE, 0xFF9E9E9E.toInt())
    private val light = Palette(0xFFF5F5F5.toInt(), Color.WHITE, 0xFFEEEEEE.toInt(), 0xFFE0E0E0.toInt(), Color.BLACK, 0xFF4A4A4A.toInt())

    private fun prefs(context: Context) = context.getSharedPreferences(NativeStrings.PREFS, Context.MODE_PRIVATE)

    fun light(context: Context) = prefs(context).getBoolean(LIGHT, false)

    fun saveAppearance(context: Context, light: Boolean, language: String?) {
        prefs(context).edit().putBoolean(LIGHT, light).apply {
            NativeStrings.supported(language)?.let { putString(NativeStrings.LANG, it) }
        }.apply()
    }

    fun palette(lightMode: Boolean) = if (lightMode) light else dark

    private fun palette(context: Context) = palette(light(context))

    private fun theme(context: Context) = if (light(context)) R.style.OtaDialog_Light else R.style.OtaDialog_Dark

    fun context(localized: Context) = ContextThemeWrapper(localized, theme(localized))

    fun heading(context: Context) = context.resources.getFont(R.font.lexling_display)

    fun dialog(context: Context, title: CharSequence? = null): AlertDialog.Builder =
        AlertDialog.Builder(context, theme(context)).apply {
            if (title != null) setCustomTitle(title(context, title).apply {
                setPadding(context.dp(20), context.dp(16), context.dp(20), context.dp(8))
            })
        }

    fun show(dialog: AlertDialog, primaryButton: Int? = AlertDialog.BUTTON_POSITIVE, destructiveButton: Int? = null) {
        dialog.show()
        val context = dialog.context
        dialog.window?.setBackgroundDrawable(InsetDrawable(surface(context, palette(context).surface), context.dp(16)))
        for (which in listOf(AlertDialog.BUTTON_POSITIVE, AlertDialog.BUTTON_NEGATIVE, AlertDialog.BUTTON_NEUTRAL)) {
            dialog.getButton(which)?.let { styleButton(it, which == primaryButton, which == destructiveButton) }
        }
    }

    fun title(context: Context, text: CharSequence) = TextView(context).apply {
        this.text = text
        textSize = 24f
        typeface = heading(context)
        setTextColor(palette(context).text)
        setPadding(context.dp(20), 0, context.dp(20), 0)
        ViewCompat.setAccessibilityHeading(this, true)
    }

    fun surface(context: Context, color: Int, outline: Int? = null) = GradientDrawable().apply {
        cornerRadius = context.dp(12).toFloat()
        setColor(color)
        outline?.let { setStroke(context.dp(1), it) }
    }

    fun button(context: Context, primary: Boolean = false) = Button(context).apply { styleButton(this, primary) }

    private fun styleButton(button: Button, primary: Boolean, destructive: Boolean = false) = with(button) {
        val palette = palette(context)
        val enabled = if (primary) accent else palette.surface2
        val disabled = intArrayOf(-android.R.attr.state_enabled)
        val fill = surface(context, enabled, if (primary) null else palette.line).apply {
            color = ColorStateList(arrayOf(disabled, intArrayOf()), intArrayOf(palette.surface2, enabled))
        }
        backgroundTintList = null
        val ripple = RippleDrawable(ColorStateList.valueOf(0x22888888), fill, null)
        background = InsetDrawable(ripple, context.dp(2))
        stateListAnimator = null
        setTextColor(ColorStateList(
            arrayOf(disabled, intArrayOf()),
            intArrayOf(palette.muted, if (primary) Color.WHITE else if (destructive) danger else palette.text)
        ))
        if (destructive) fill.setStroke(context.dp(1), danger)
        typeface = Typeface.DEFAULT
        isAllCaps = false
        minimumHeight = context.dp(48)
        setPadding(context.dp(12), context.dp(4), context.dp(12), context.dp(4))
    }

    private fun Context.dp(value: Int) = (value * resources.displayMetrics.density).roundToInt()
}
