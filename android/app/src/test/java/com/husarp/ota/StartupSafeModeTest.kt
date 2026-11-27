package com.husarp.ota

import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import com.husarp.lexling.BuildConfig
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = OtaApplication::class)
class StartupSafeModeTest {
    @Test fun oneCrashOpensThePlainPolishRecoveryScreen() {
        val app = RuntimeEnvironment.getApplication()
        app.getSharedPreferences("startup-crash", Context.MODE_PRIVATE).edit()
            .putInt("versionCode", BuildConfig.VERSION_CODE).putInt("unfinishedStarts", 1)
            .putBoolean("startupCrashRecorded", true).commit()
        app.getSharedPreferences(NativeStrings.PREFS, Context.MODE_PRIVATE).edit()
            .putString(NativeStrings.LANG, "pl").commit()
        val report = "IllegalStateException: test startup crash\n\tat com.husarp.ota.MainActivity.onCreate"
        app.noBackupFilesDir.resolve("startup-crash.txt").writeText(report)

        Robolectric.buildActivity(MainActivity::class.java).setup().use { controller ->
            val activity = controller.get()
            assertNull(activity.bridge)
            assertFalse(app.filesDir.resolve("ota").exists())
            val content = activity.findViewById<ViewGroup>(android.R.id.content)
            val screen = content.getChildAt(0) as StartupSafeModeScreen
            val actions = screen.getChildAt(0) as ViewGroup
            assertEquals("Lexling miał problem z uruchomieniem", (actions.getChildAt(0) as TextView).text)
            assertEquals(listOf("Spróbuj ponownie", "Wróć do stabilnej wersji", "Pobierz poprawioną wersję", "Kopiuj raport o awarii"),
                (1 until actions.childCount).map { (actions.getChildAt(it) as Button).text.toString() })

            actions.getChildAt(3).performClick()
            val download = shadowOf(activity).nextStartedActivity
            assertEquals(Intent.ACTION_VIEW, download.action)
            assertEquals("https://github.com/Husarp/lexling/releases/latest", download.dataString)
            actions.getChildAt(4).performClick()
            val clipboard = activity.getSystemService(ClipboardManager::class.java)
            assertEquals(report, clipboard.primaryClip?.getItemAt(0)?.text)
        }
    }

    @Test fun resetRestoresTheEmbeddedBundleAndReopensUpdateSetup() {
        val app = RuntimeEnvironment.getApplication() as OtaApplication
        val root = app.filesDir.resolve("ota")
        val downloaded = root.resolve("bundles/9.9.9").apply { mkdirs() }
        val staging = root.resolve("staging").apply { mkdirs() }
        val paired = root.resolve("paired-web.json").apply { writeText("{}") }
        val settings = app.getSharedPreferences(UPDATE_SETTINGS_PREFERENCES, Context.MODE_PRIVATE)
        settings.edit().putBoolean("setupAnswered", true).putBoolean("smallFixes", false).commit()

        app.resetToBuiltin("Go back to stable version")

        val embedded = app.assets.open("embedded-manifest.json").bufferedReader().use { JSONObject(it.readText()) }
        val state = JSONObject(root.resolve("state.json").readText())
        assertEquals(embedded.getString("version"), state.getString("current"))
        assertFalse(downloaded.exists())
        assertFalse(staging.exists())
        assertFalse(paired.exists())
        assertFalse(settings.getBoolean("setupAnswered", true))
        assertFalse(settings.getBoolean("smallFixes", true))
    }
}
