package com.husarp.ota

import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "Ota")
class OtaPlugin : Plugin() {
    private val updater get() = (context.applicationContext as OtaApplication).updater
    private val eventSink: (String, JSObject) -> Unit = { name,data -> notifyListeners(name,data,name != "updateStateChanged") }
    override fun load() { updater.subscribe(eventSink) }
    override fun handleOnDestroy() { updater.eventListeners.remove(eventSink) }
    @PluginMethod fun setUiTheme(call: PluginCall) {
        activity.runOnUiThread {
            (activity as MainActivity).setUiTheme(call.getString("theme") == "light", call.getString("lang"))
            call.resolve()
        }
    }
    // Keep the original bridge methods for older signed web bundles.
    @PluginMethod fun getUpdateSettings(call: PluginCall) { call.resolve(updater.settingsJson()) }
    @PluginMethod fun setUpdateSettings(call: PluginCall) {
        try { call.resolve(updater.setUpdateSettings(call.data)) }
        catch(e: Exception) { call.reject(e.message ?: "Invalid settings") }
    }
    @PluginMethod fun downloadShell(call: PluginCall) {
        if (call.getBoolean("downloadOnly") == true) {
            if (updater.shell.downloadOffered()) call.resolve() else call.reject("App download is not available")
        } else {
            activity.runOnUiThread { (activity as MainActivity).installWithNotificationPermission { updater.shell.check(true) } }
            call.resolve()
        }
    }
    @PluginMethod fun info(call: PluginCall) { call.resolve(updater.info()) }
    @PluginMethod fun getState(call: PluginCall) { call.resolve(updater.info()) }
    @PluginMethod fun installShell(call: PluginCall) {
        activity.runOnUiThread {
            val screen = activity as MainActivity
            screen.installWithNotificationPermission {
                if (updater.shell.installFromWeb(screen)) call.resolve() else call.reject("App install is not available")
            }
        }
    }
    @PluginMethod fun setSafeToInterrupt(call: PluginCall) {
        val safe=call.getBoolean("safe")
        if(safe==null) { call.reject("safe must be a boolean"); return }
        updater.setSafeToInterrupt(safe); call.resolve()
    }
    @PluginMethod fun appReady(call: PluginCall) {
        val accepted=updater.ready(call.getString("version") ?: "",call.getString("token") ?: "", call.getBoolean("checkNotices") == true)
        call.resolve(JSObject().put("accepted",accepted))
    }
    @PluginMethod fun claimCheckNotice(call: PluginCall) {
        val notice = if (updater.foreground && updater.webCheckNotices() == true && call.getString("token") == updater.launch.token)
            updater.checks.claim() else null
        call.resolve(JSObject().put("message", notice?.failure?.message).put("code", notice?.failure?.name))
    }
    @PluginMethod fun check(call: PluginCall) { updater.retryChecks(); call.resolve() }
    @PluginMethod fun download(call: PluginCall) {
        if (updater.download(installAfterDownload = call.getBoolean("downloadOnly") != true)) call.resolve()
        else call.reject("Download is not available")
    }
    @PluginMethod fun restart(call: PluginCall) { activity.runOnUiThread {
        if ((activity as MainActivity).restartBundle()) call.resolve() else call.reject("Restart is not available")
    } }
    @PluginMethod fun settings(call: PluginCall) { activity.runOnUiThread { (activity as MainActivity).showSettings() }; call.resolve() }
    @PluginMethod fun logs(call: PluginCall) { activity.runOnUiThread { (activity as MainActivity).showLogs() }; call.resolve() }
    @PluginMethod fun logWebDiagnostic(call: PluginCall) {
        val level = call.getString("level")?.takeIf { it in setOf("info", "warn", "error") } ?: "info"
        call.getString("message")?.let { (activity as MainActivity).logWebDiagnostic(level, it) }
        call.resolve()
    }
    @PluginMethod fun getUpdateLog(call: PluginCall) {
        call.resolve(JSObject().put("text", "${(activity as MainActivity).logEnvironment()}\n\n${updater.engine.log.read()}"))
    }
    @PluginMethod fun clearUpdateLog(call: PluginCall) { updater.engine.log.clear(); call.resolve() }
    @PluginMethod fun confirmReset(call: PluginCall) { activity.runOnUiThread { (activity as MainActivity).confirmReset() }; call.resolve() }
    @PluginMethod fun openReleases(call: PluginCall) { activity.runOnUiThread {
        if ((activity as MainActivity).openReleases()) call.resolve() else call.reject("No browser available")
    } }
}
