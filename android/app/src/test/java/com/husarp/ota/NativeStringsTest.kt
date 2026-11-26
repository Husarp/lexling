package com.husarp.ota

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import java.io.File
import java.util.Locale
import javax.xml.parsers.DocumentBuilderFactory

class NativeStringsTest {
    @Test fun appLanguageOverridesSystem() {
        assertEquals("en", NativeStrings.language("en", Locale.forLanguageTag("pl-PL")))
        assertEquals("pl", NativeStrings.language("pl", Locale.US))
    }

    @Test fun fallsBackToPolishOrEnglish() {
        assertEquals("pl", NativeStrings.language(null, Locale.forLanguageTag("pl-PL")))
        assertEquals("en", NativeStrings.language(null, Locale.GERMANY))
        assertEquals("pl", NativeStrings.language("de", Locale.forLanguageTag("pl-PL")))
    }

    @Test fun polishResourcesMatchEnglishKeysAndFormatArguments() {
        val english = strings("values")
        val polish = strings("values-pl")
        assertFalse(english.isEmpty())
        assertEquals(english.keys, polish.keys)

        val formatArgument = Regex("%\\d+\\$[.0-9]*[a-z]")
        for ((key, text) in english) {
            val translation = polish.getValue(key)
            assertFalse(key, translation.isBlank())
            assertEquals(key, formatArgument.findAll(text).map { it.value }.sorted().toList(),
                formatArgument.findAll(translation).map { it.value }.sorted().toList())
        }
    }

    private fun strings(directory: String): Map<String, String> {
        val file = File("src/main/res/$directory/ota_strings.xml")
        val nodes = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(file).getElementsByTagName("string")
        return (0 until nodes.length).associate { index ->
            val node = nodes.item(index)
            node.attributes.getNamedItem("name").nodeValue to node.textContent
        }
    }
}
