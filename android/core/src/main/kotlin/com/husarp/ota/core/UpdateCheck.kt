package com.husarp.ota.core

import java.net.SocketTimeoutException
import javax.net.ssl.SSLException

enum class CheckFailure(val message: String) {
    OFFLINE("Can't check for updates — no internet"),
    UNREACHABLE("Can't reach the update server"),
    TIMEOUT("The update server took too long to respond"),
    TLS("Couldn't make a secure connection to the update server"),
    NOT_FOUND("The update file wasn't found"),
    DENIED("The update server refused the request"),
    RATE_LIMITED("Too many update requests — try again later"),
    SERVER("The update server returned an error — try again later"),
    MANIFEST("Can't check for updates — signature or manifest problem")
}

class CheckException(val failure: CheckFailure, cause: Exception? = null) : Exception(failure.message, cause)

fun <Source, Manifest> verifyUpdateCheck(
    connected: () -> Boolean, fetch: () -> Source, verify: (Source) -> Manifest
): Pair<Source, Manifest> {
    if (!connected()) throw CheckException(CheckFailure.OFFLINE)
    val source = try { fetch() } catch (error: Exception) {
        val failure = when (error) {
            is IntegrityException -> CheckFailure.MANIFEST
            is HttpStatusException -> when (error.status) {
                401, 403 -> CheckFailure.DENIED
                404 -> CheckFailure.NOT_FOUND
                429 -> CheckFailure.RATE_LIMITED
                else -> CheckFailure.SERVER
            }
            else -> when {
                !connected() -> CheckFailure.OFFLINE
                error is SocketTimeoutException -> CheckFailure.TIMEOUT
                error is SSLException -> CheckFailure.TLS
                else -> CheckFailure.UNREACHABLE
            }
        }
        throw CheckException(failure, error)
    }
    return source to try { verify(source) } catch (error: Exception) {
        throw CheckException(CheckFailure.MANIFEST, error)
    }
}

enum class CheckChannel { WEB, SHELL }
data class CheckNotice(val channel: CheckChannel, val failure: CheckFailure)

class CheckNoticeGate {
    private val pending = linkedMapOf<CheckChannel, CheckFailure>()
    @Synchronized fun failed(channel: CheckChannel, failure: CheckFailure, manual: Boolean) {
        if (manual) pending[channel] = failure
    }

    @Synchronized fun succeeded(channel: CheckChannel) { pending.remove(channel) }

    @Synchronized fun hasPending() = pending.isNotEmpty()

    @Synchronized fun claim(): CheckNotice? {
        val entry = pending.entries.firstOrNull() ?: return null
        val notice = CheckNotice(entry.key, entry.value)
        pending.clear()
        return notice
    }
}
