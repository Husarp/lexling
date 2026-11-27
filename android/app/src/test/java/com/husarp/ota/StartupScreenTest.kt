package com.husarp.ota

import android.app.Application
import android.content.Context
import android.content.ContextWrapper
import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
import com.husarp.lexling.R
import com.husarp.ota.core.UpdateActivation
import java.io.ByteArrayInputStream
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class StartupScreenTest {
    private val app: Context get() = RuntimeEnvironment.getApplication()

    @Test fun packagedArtworkFontAndDrawablesLoad() {
        for (id in listOf(R.drawable.startup_scattered, R.drawable.startup_single)) {
            val bitmap = requireNotNull(BitmapFactory.decodeResource(app.resources, id))
            assertEquals(608, bitmap.width)
            assertEquals(1080, bitmap.height)
        }
        assertNotNull(app.resources.getFont(R.font.lexling_wordmark))
        assertNotNull(app.getDrawable(R.drawable.startup_progress))
        val icon = requireNotNull(app.getDrawable(R.drawable.ic_stat_update))
        val pixels = Bitmap.createBitmap(24, 24, Bitmap.Config.ARGB_8888)
        icon.setBounds(0, 0, 24, 24)
        icon.draw(Canvas(pixels))
        assertTrue(Color.alpha(pixels.getPixel(4, 12)) > 0)
        assertNotEquals(Color.BLACK, draw(StartupScreen(app)).getPixel(180, 120))
    }

    @Test fun undecodableArtworkKeepsThePlainScreenAndProgress() {
        val screen = StartupScreen(withResources(object : DelegatingResources(app.resources) {
            override fun openRawResource(id: Int, value: android.util.TypedValue) =
                ByteArrayInputStream(byteArrayOf())
        }))
        assertEquals(Color.BLACK, draw(screen).getPixel(180, 120))
        assertEquals(View.VISIBLE, screen.visibility)
        val brand = screen.getChildAt(0) as ViewGroup
        assertEquals(3, (brand.getChildAt(2) as ProgressBar).progress)
    }

    @Test fun wordmarkFontLoadFailureKeepsThePlainScreen() {
        val screen = StartupScreen(withResources(object : DelegatingResources(app.resources) {
            override fun getFont(id: Int): android.graphics.Typeface =
                throw NotFoundException("Wordmark font unavailable")
        }))
        assertEquals(Color.BLACK, draw(screen).getPixel(180, 120))
        assertEquals(View.VISIBLE, screen.visibility)
    }

    private fun draw(screen: StartupScreen): Bitmap {
        screen.show("0.74.0", "Ładowanie", UpdateActivation.Progress("0.74.0", UpdateActivation.Step.CHECKING_FILES, 3, 5))
        val width = View.MeasureSpec.makeMeasureSpec(360, View.MeasureSpec.EXACTLY)
        val height = View.MeasureSpec.makeMeasureSpec(640, View.MeasureSpec.EXACTLY)
        screen.measure(width, height)
        screen.layout(0, 0, 360, 640)
        return Bitmap.createBitmap(360, 640, Bitmap.Config.ARGB_8888).also { screen.draw(Canvas(it)) }
    }

    private fun withResources(resources: Resources): Context = object : ContextWrapper(app) {
        override fun getResources() = resources
    }

    @Suppress("DEPRECATION")
    private open class DelegatingResources(base: Resources) :
        Resources(base.assets, base.displayMetrics, base.configuration)
}
