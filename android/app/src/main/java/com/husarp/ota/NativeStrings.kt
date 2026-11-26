package com.husarp.ota

import android.content.Context
import android.content.res.Configuration
import android.os.LocaleList
import java.util.Locale

internal object NativeStrings {
    const val PREFS = "native-appearance"
    const val LANG = "lang"

    fun supported(language: String?) = language?.takeIf { it == "en" || it == "pl" }

    fun language(preferred: String?, system: Locale): String =
        supported(preferred) ?: if (system.language == "pl") "pl" else "en"

    fun language(context: Context): String = language(
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(LANG, null),
        LocaleList.getDefault()[0]
    )

    fun context(context: Context, language: String = language(context)): Context {
        val locales = LocaleList(Locale.forLanguageTag(language))
        if (context.resources.configuration.locales == locales) return context
        // Keep Android's other configuration values and resolve copy in Lexling's language.
        return context.createConfigurationContext(Configuration().apply { setLocales(locales) })
    }
}
