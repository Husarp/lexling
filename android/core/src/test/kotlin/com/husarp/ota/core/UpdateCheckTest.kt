package com.husarp.ota.core

import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLHandshakeException
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class UpdateCheckTest {
    @get:Rule val temporaryFolder = TemporaryFolder()
    @Test fun noActiveNetworkSkipsFetch() {
        val error = assertThrows(CheckException::class.java) {
            verifyUpdateCheck({ false }, { throw AssertionError("should not fetch") }, { it })
        }
        assertEquals(CheckFailure.OFFLINE, error.failure)
    }

    @Test fun lostActiveNetworkDuringFetchIsOffline() {
        var connected = true
        val error = assertThrows(CheckException::class.java) {
            verifyUpdateCheck({ connected }, { connected = false; throw SocketTimeoutException() }, { it })
        }
        assertEquals(CheckFailure.OFFLINE, error.failure)
    }

    @Test fun distinguishesTransportAndHttpFailuresOnAnActiveNetwork() {
        mapOf(UnknownHostException() to CheckFailure.UNREACHABLE, SSLHandshakeException("TLS") to CheckFailure.TLS,
            SocketTimeoutException() to CheckFailure.TIMEOUT, HttpStatusException(404) to CheckFailure.NOT_FOUND,
            HttpStatusException(403) to CheckFailure.DENIED, HttpStatusException(429) to CheckFailure.RATE_LIMITED,
            HttpStatusException(503) to CheckFailure.SERVER).forEach { (cause, failure) ->
            val error = assertThrows(CheckException::class.java) {
                verifyUpdateCheck({ true }, { throw cause }, { it })
            }
            assertEquals(failure, error.failure)
            assertSame(cause, error.cause)
        }
    }

    @Test fun unpublishedOptionalChannelDoesNotFailOrVerify() {
        val transport = Transport { _, _ -> throw HttpStatusException(404) }
        val log = EventLog(temporaryFolder.newFile())
        val result = verifyUpdateCheck({ true }, { fetchManifest("https://example.com/shell.json", transport, log) }) {
            it?.let { throw AssertionError("No manifest should be verified") }
        }
        assertNull(result.first)
        assertNull(result.second)
        assertEquals(CheckFailure.NOT_FOUND, assertThrows(CheckException::class.java) {
            verifyUpdateCheck({ true }, { fetchManifest("https://example.com/manifest.json", transport, log, allowMissing = false) }, { it })
        }.failure)
    }

    @Test fun badManifestIsDistinctFromTransportFailure() {
        assertEquals(CheckFailure.MANIFEST, assertThrows(CheckException::class.java) {
            verifyUpdateCheck({ true }, { "unsigned" }, { error("invalid signature") })
        }.failure)
        assertEquals(CheckFailure.MANIFEST, assertThrows(CheckException::class.java) {
            verifyUpdateCheck({ true }, { throw IntegrityException("Response too large") }, { it })
        }.failure)
        assertEquals("signed" to 42, verifyUpdateCheck({ true }, { "signed" }, { 42 }))
    }

    @Test fun gameAndNativeShareManualNoticesButNeverShowBackgroundFailures() {
        val gate = CheckNoticeGate()
        assertNull(gate.claim())
        gate.failed(CheckChannel.WEB, CheckFailure.OFFLINE, manual = false)
        assertFalse(gate.hasPending())
        gate.failed(CheckChannel.WEB, CheckFailure.OFFLINE, manual = true)
        gate.failed(CheckChannel.SHELL, CheckFailure.UNREACHABLE, manual = true)
        assertTrue(gate.hasPending())
        assertEquals(CheckNotice(CheckChannel.WEB, CheckFailure.OFFLINE), gate.claim())
        gate.succeeded(CheckChannel.WEB)
        gate.failed(CheckChannel.WEB, CheckFailure.MANIFEST, manual = false)
        assertFalse(gate.hasPending())
        assertNull(gate.claim())
        gate.failed(CheckChannel.WEB, CheckFailure.MANIFEST, manual = true)
        assertNotNull(gate.claim())
    }

    @Test fun successOnlyClearsItsOwnPendingFailureWithoutSpendingTheNotice() {
        val gate = CheckNoticeGate()
        gate.failed(CheckChannel.WEB, CheckFailure.OFFLINE, manual = true)
        gate.failed(CheckChannel.SHELL, CheckFailure.OFFLINE, manual = true)
        gate.succeeded(CheckChannel.WEB)
        gate.succeeded(CheckChannel.SHELL)
        assertNull(gate.claim())
        gate.failed(CheckChannel.SHELL, CheckFailure.MANIFEST, manual = true)
        gate.succeeded(CheckChannel.WEB)
        assertEquals(CheckNotice(CheckChannel.SHELL, CheckFailure.MANIFEST), gate.claim())
    }
}
