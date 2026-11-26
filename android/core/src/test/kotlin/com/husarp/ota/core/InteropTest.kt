package com.husarp.ota.core
import org.junit.Test
import org.junit.Assert.*
import java.util.Base64
class InteropTest {
    @Test fun nodeSignatureVerifiesWithAndroidBouncyCastleVerifier() {
        val loader=javaClass.classLoader!!
        val key=loader.getResourceAsStream("node-public-key.b64")!!.bufferedReader().use { Base64.getDecoder().decode(it.readText().trim()) }
        val envelope=loader.getResourceAsStream("node-envelope.json")!!.use { it.readBytes() }
        val tree=com.google.gson.JsonParser.parseString(envelope.toString(Charsets.UTF_8)).asJsonObject
        val payload=com.google.gson.JsonParser.parseString(Base64.getDecoder().decode(tree["payload"].asString).toString(Charsets.UTF_8)).asJsonObject
        val m=ManifestVerifier(key).verify(envelope,payload["releasedAt"].asLong+1)
        assertEquals("99.0.1",m.version); assertTrue(m.files.any { it.path=="index.html" })
    }
}
