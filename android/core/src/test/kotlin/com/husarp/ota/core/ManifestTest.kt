package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*
import java.util.Base64

class ManifestTest {
    private val signing = Signing()
    @Test fun validEd25519Manifest() { assertEquals("1.0.0", signing.verifier.verify(signing.sign(bundle()),NOW).version) }
    @Test fun wrongKeyRejected() { expectFailure { Signing().verifier.verify(signing.sign(bundle()),NOW) } }
    @Test fun modifiedPayloadRejected() {
        val envelope = com.google.gson.JsonParser.parseString(signing.sign(bundle()).toString(Charsets.UTF_8)).asJsonObject
        envelope.addProperty("payload",Base64.getEncoder().encodeToString(json.toJson(bundle("9.0.0")).toByteArray()))
        expectFailure { signing.verifier.verify(envelope.toString().toByteArray(),NOW) }
    }
    @Test fun invalidSignatureRejected() { expectFailure { signing.verifier.verify("{\"payload\":\"e30=\",\"signature\":\"AAAA\"}".toByteArray(),NOW) } }
    @Test fun malformedEnvelopeRejected() { expectFailure { signing.verifier.verify("{}".toByteArray(),NOW) } }
    @Test fun expiredManifestRejected() { expectFailure { signing.verifier.verify(signing.sign(bundle().copy(expiresAt=NOW-1)),NOW) } }
    @Test fun expiryBoundaryRejected() { expectFailure { signing.verifier.verify(signing.sign(bundle().copy(expiresAt=NOW)),NOW) } }
    @Test fun expiryBeforeReleaseRejected() { expectFailure { signing.verifier.verify(signing.sign(bundle().copy(expiresAt=NOW-2000)),NOW) } }
    @Test fun clockBehindReleaseSkips() { expectFailure { signing.verifier.verify(signing.sign(bundle()),NOW-2000) } }
    @Test fun clockFarAheadSkips() { expectFailure { signing.verifier.verify(signing.sign(bundle()),NOW+10000000) } }
    @Test fun numericSemverComparison() { assertTrue(compareVersions("1.0.10","1.0.9")>0); assertTrue(compareVersions("2.0.0","1.99.99")>0); assertEquals(0,compareVersions("1.0.0","1.0.0")) }
    @Test fun malformedVersionsRejected() { listOf("1.0", "v1.0.0","01.0.0","1.0.0-beta","../x","9999999999.1.0").forEach { expectFailure { versionParts(it) } } }
    @Test fun traversalRejected() { listOf("../evil","/index.html","a/../b","a\\b","a//b",".hidden","a/./b","a/%2e%2e/b").forEach { p -> expectFailure { validateManifest(bundle().copy(files=listOf(entry("index.html","x"),entry(p,"x")))) } } }
    @Test fun duplicatePathsRejected() { expectFailure { validateManifest(bundle().copy(files=listOf(entry("index.html","a"),entry("index.html","b")))) } }
    @Test fun missingEntrypointRejected() { expectFailure { validateManifest(bundle().copy(files=listOf(entry("app.js","x")))) } }
    @Test fun retinaAssetPathsAreAllowed() {
        validateManifest(bundle().copy(files=listOf(entry("index.html","x"),entry("assets/ui/logo-title@2x.png","y"))))
    }
    @Test fun assetUrlInjectionRejected() { expectFailure { validateManifest(bundle().copy(files=listOf(entry("index.html","x").copy(asset="https://evil/x")))) } }
    @Test fun invalidKindOrSchemaRejected() { expectFailure { validateManifest(bundle().copy(kind="mandatory")) }; expectFailure { validateManifest(bundle().copy(schema=2)) } }
    @Test fun invalidSizeHashAndShellRejected() {
        expectFailure { validateManifest(bundle().copy(files=listOf(entry("index.html","a").copy(size=-1)))) }
        expectFailure { validateManifest(bundle().copy(files=listOf(entry("index.html","a").copy(sha256="00")))) }
        expectFailure { validateManifest(bundle().copy(minShellApi=0)) }
    }
    @Test fun configuredAssetNamesStaySingleSafeFileNames() {
        for (name in listOf("chunk-abc.dat", "app_asset-123.bin"))
            validateManifest(bundle().copy(files=listOf(entry("index.html","x").copy(asset=name))))
        for (name in listOf("../x.bin", "/x.bin", "x/y.bin", "x?query", ".hidden", "x#fragment"))
            expectFailure { validateManifest(bundle().copy(files=listOf(entry("index.html","x").copy(asset=name)))) }
    }
}
