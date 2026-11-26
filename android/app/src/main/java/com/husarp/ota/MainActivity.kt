package com.husarp.ota

import android.app.AlertDialog
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Rect
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.view.Gravity
import android.view.ViewGroup
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.*
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebChromeClient
import com.getcapacitor.BridgeWebViewClient
import com.getcapacitor.ProcessedRoute
import com.husarp.lexling.AppUpdatePlugin
import com.husarp.lexling.BluetoothLinkPlugin
import com.husarp.lexling.BuildConfig
import com.husarp.lexling.GameVibrationPlugin
import com.husarp.lexling.LanLinkPlugin
import com.husarp.lexling.NearbyLinkPlugin
import com.husarp.lexling.R
import com.husarp.ota.core.*
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : BridgeActivity() {
    private val updater get() = (application as OtaApplication).updater
    private val handler = Handler(Looper.getMainLooper())
    private var resumed = false
    private var localizedContext: Context? = null
    private val strings: Context get() = localizedContext ?: NativeStrings.context(this).also { localizedContext = it }
    private val theme get() = NativeLook.context(strings)
    private var recoveryDialog: AlertDialog? = null
    private var refreshRecoveryCheck: (() -> Unit)? = null
    private var updateBanner: NativeUpdateBanner? = null
    private var maintenanceBanner: NativeUpdateBanner? = null
    private var activeBannerKey: String? = null
    private val bannerFlow = UpdateBannerFlow(UpdateBannerItem::step)
    private val transientBanners = linkedMapOf<String, (String) -> UpdateBannerItem>()
    private var applyingStartupFix = false
    private lateinit var activityLaunchToken: String
    private var loadingOverlay: StartupScreen? = null
    private var webCommitted = false
    private var safeArea = Insets.NONE
    private var systemTop = 0
    private var cutoutRects = emptyList<Rect>()
    private val recoveryTick = Runnable { refreshRecovery() }
    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) { refreshRecovery() }
    }
    private fun refreshRecovery() {
        handler.removeCallbacks(recoveryTick)
        if (updater.launching && updater.activation.current != null && updater.watchdog.reason == null) {
            renderStartup()
            return
        }
        if (activityLaunchToken != updater.launch.token) return
        val trial = updater.engine.snapshot().trial
        val awake = (getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive &&
            !(getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
        val delay = updater.watchdog.update(SystemClock.elapsedRealtime(), resumed && awake)
        val reason = updater.watchdog.reason
        renderStartup(trial)
        if (reason == null && !applyingStartupFix) recoveryDialog?.dismiss()
        if (resumed && awake && reason != null && recoveryDialog == null && debugDialog == null &&
            logDialog == null && !isFinishing && !isDestroyed) showStartupRecovery(reason)
        if (resumed && awake) {
            refreshRecoveryCheck?.invoke()
        }
        if (delay != null) handler.postDelayed(recoveryTick, delay.coerceAtLeast(1))
    }
    private fun renderStartup(trial: Boolean = false) {
        val phase = updater.activation.current
        val light = NativeLook.light(this)
        when {
            !updater.watchdog.showLoading && !updater.launching -> loadingOverlay?.visibility = View.GONE
            updater.launching && phase != null -> {
                val step = if (phase.step == UpdateActivation.Step.CHECKING_FILES) strings.getString(R.string.ota_checking_files)
                    else strings.getString(R.string.ota_installing_version, phase.version)
                loadingOverlay?.show(phase.version, step, light)
            }
            trial -> {
                val step = strings.getString(if (webCommitted) R.string.ota_starting else R.string.ota_loading_app)
                loadingOverlay?.show(updater.launch.version, step, light)
            }
            else -> loadingOverlay?.visibility = View.GONE
        }
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = light
    }
    private fun showStartupRecovery(reason: String) {
        updater.engine.log.add("Startup watchdog: ${updater.launch.version} ($reason)")
        val theme = this.theme
        val box = LinearLayout(theme).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp,12.dp,20.dp,12.dp) }
        val palette = NativeLook.palette(NativeLook.light(this))
        val dialog = NativeLook.dialog(theme, strings.getString(R.string.ota_start_failed, strings.getString(R.string.app_name)))
            .setView(ScrollView(theme).apply { addView(box) }).setCancelable(false).create()
        val status = TextView(theme).apply {
            setText(R.string.ota_recovery_help)
            setTextColor(palette.text)
            setPadding(0, 0, 0, 12.dp)
        }
        val check = NativeLook.button(theme, primary = true).apply { text = strings.getString(R.string.ota_check_fix) }
        val reset = NativeLook.button(theme).apply { text = strings.getString(R.string.ota_reset_builtin) }
        val wait = NativeLook.button(theme).apply { text = strings.getString(R.string.ota_wait_longer) }
        val shell = NativeLook.button(theme).apply { setText(R.string.ota_open_maintenance) }
        val copy = NativeLook.button(theme).apply { text = strings.getString(R.string.ota_copy_logs); setOnClickListener { copyLogs() } }
        val alternatives = listOf(reset, wait, shell)
        var fix: Updater.StartupFix? = null
        var retryShell = false
        refreshRecoveryCheck = {
            if (check.isEnabled && fix == null && !applyingStartupFix) updater.checks.claim()?.let {
                status.text = strings.checkFailureText(it.failure)
                check.text = strings.getString(R.string.ota_retry)
                retryShell = it.channel == CheckChannel.SHELL
            }
        }
        check.setOnClickListener {
            val selected = fix
            check.isEnabled = false
            if (selected == null) {
                if (retryShell) { updater.retryCheck(CheckChannel.SHELL); retryShell = false }
                status.text = strings.getString(R.string.ota_checking_fix)
                updater.checkForStartupFix { candidate, message, failedCheck ->
                    if (recoveryDialog === dialog && !isDestroyed) {
                        if (failedCheck) updater.checks.claim()
                        fix = candidate
                        status.text = message
                        check.text = when {
                            failedCheck -> strings.getString(R.string.ota_retry)
                            candidate == null -> strings.getString(R.string.ota_check_fix)
                            candidate.staged -> strings.getString(R.string.ota_apply_fix_restart)
                            else -> strings.getString(R.string.ota_download_fix_restart)
                        }
                        check.isEnabled = true
                    }
                }
            } else {
                applyingStartupFix = true
                alternatives.forEach { it.isEnabled = false }
                status.text = strings.getString(R.string.ota_applying_fix)
                updater.applyStartupFix(selected) { error ->
                    if (!isDestroyed && !isFinishing) {
                        if (error == null) recreateBundle()
                        else if (recoveryDialog === dialog) {
                            applyingStartupFix = false; fix = null
                            status.text = error; check.text = strings.getString(R.string.ota_check_fix); check.isEnabled = true
                            alternatives.forEach { it.isEnabled = true }
                            refreshRecovery()
                        }
                    }
                }
            }
        }
        reset.setOnClickListener { confirmReset(startupRecovery = true) }
        wait.setOnClickListener {
            updater.watchdog.waitLonger(SystemClock.elapsedRealtime()); dialog.dismiss(); refreshRecovery()
        }
        shell.setOnClickListener { showSettings(); dialog.dismiss() }
        box.addView(status); box.addView(check)
        if (updater.launch.version != updater.engine.embedded.version) box.addView(reset)
        box.addView(wait); box.addView(shell)
        box.addView(copy)
        updateBanner?.clear()
        dialog.setOnDismissListener {
            if (recoveryDialog === dialog) { recoveryDialog = null; refreshRecoveryCheck = null }
        }
        recoveryDialog = dialog; NativeLook.show(dialog)
    }
    private fun startupFailed(reason: String) {
        updater.watchdog.failed(activityLaunchToken, reason)
        refreshRecovery()
    }
    private var logDialog: AlertDialog? = null
    private var logText: TextView? = null
    private val refreshLogs = object : Runnable {
        override fun run() {
            if (logDialog?.isShowing == true) { renderLogs(); handler.postDelayed(this, 1000) }
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        ShellUpdatedNotification.enterForeground(this)
        updater.prepareLaunch()
        activityLaunchToken = updater.launch.token
        registerPlugin(OtaPlugin::class.java)
        // Capacitor's own shouldInterceptRequest still injects its bridge into HTML.
        // Route every signed web path independently to the overlay or the APK asset.
        bridgeBuilder.setRouteProcessor { _, route ->
            val path = route.trimStart('/').ifEmpty { "index.html" }
            val overlay = updater.engine.overlayFile(path)
            ProcessedRoute().apply {
                setPath(if (!updater.engine.hasPath(path)) "public/__missing__" else overlay?.absolutePath ?: "public/$path")
                setAsset(overlay == null); setIgnoreAssetPath(true)
            }
        }
        registerPlugin(BluetoothLinkPlugin::class.java)
        registerPlugin(LanLinkPlugin::class.java)
        registerPlugin(NearbyLinkPlugin::class.java)
        registerPlugin(AppUpdatePlugin::class.java)
        registerPlugin(GameVibrationPlugin::class.java)
        super.onCreate(savedInstanceState)
        val web = bridge.webView
        // Local text notices have no response charset in Capacitor.
        web.settings.defaultTextEncodingName = "UTF-8"
        if (resources.configuration.smallestScreenWidthDp >= 600) {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_USER
            web.settings.useWideViewPort = true
            web.settings.loadWithOverviewMode = true
        }
        setupEdgeToEdge(web)
        configureSystemBars()
        // Keep Capacitor routing and browser features while catching failures independently of bundle JS.
        web.webChromeClient = object : BridgeWebChromeClient(bridge) {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                val source = Uri.parse(message.sourceId().orEmpty()).lastPathSegment.orEmpty().take(120)
                logWebDiagnostic("console/${message.messageLevel()}", "[$source:${message.lineNumber()}] ${message.message()}")
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR && message.message().startsWith("Uncaught"))
                    startupFailed("javascript-error")
                return super.onConsoleMessage(message)
            }
        }
        bridge.setWebViewClient(object : BridgeWebViewClient(bridge) {
            override fun onPageCommitVisible(view: WebView, url: String) {
                super.onPageCommitVisible(view, url)
                webCommitted = true
                refreshRecovery()
                injectSafeArea(view)
            }
            private fun required(request: WebResourceRequest) = request.isForMainFrame ||
                (request.url.host == "localhost" && updater.engine.hasPath(request.url.path.orEmpty().trimStart('/')))
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (required(request)) startupFailed("load-error")
                super.onReceivedError(view,request,error)
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (required(request)) startupFailed("load-error")
                super.onReceivedHttpError(view,request,response)
            }
        })
        registerReceiver(screenReceiver, IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_SCREEN_ON); addAction(Intent.ACTION_USER_PRESENT)
        })
        val webFrame = findViewById<FrameLayout>(android.R.id.content)
        updateBanner = NativeUpdateBanner(webFrame, ::dismissUpdateBanner)
        loadingOverlay = StartupScreen(this, strings.getString(R.string.app_name)).also {
            webFrame.addView(it, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        renderStartup(updater.engine.snapshot().trial)
        updater.onChange = { if (!isFinishing) { refreshRecovery(); refreshDebugSettings?.invoke(); if (resumed) updater.shell.presentRequestedAndroidUi(this); showNativeMessages() } }
        updater.onToast = { message ->
            if (!isFinishing) {
                transientBanners["message:$message"] = { key ->
                    UpdateBannerItem(key, strings.getString(R.string.ota_please_wait), strings.getString(message))
                }
                showNativeMessages()
            }
        }
    }
    private fun setupEdgeToEdge(web: WebView) {
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS or WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                else WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
        val webHost = web.parent as View
        findViewById<View>(android.R.id.content).fitsSystemWindows = false
        webHost.fitsSystemWindows = false
        web.fitsSystemWindows = false
        // Capacitor 7 can reserve space for bars and consume insets on the WebView itself.
        ViewCompat.setOnApplyWindowInsetsListener(web, null)
        ViewCompat.setOnApplyWindowInsetsListener(webHost) { _, insets ->
            safeArea = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            systemTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            cutoutRects = insets.displayCutout?.boundingRects.orEmpty()
            showNativeMessages()
            injectSafeArea(web)
            // Keep adjustResize and let the WebView handle keyboard insets itself.
            insets
        }
        ViewCompat.requestApplyInsets(webHost)
    }
    private fun injectSafeArea(web: WebView) {
        val density = resources.displayMetrics.density
        val origin = IntArray(2).also(web::getLocationInWindow)
        val rules = listOf("top" to safeArea.top, "right" to safeArea.right, "bottom" to safeArea.bottom, "left" to safeArea.left)
            .joinToString("") { (edge, px) -> "style.setProperty('--safe-area-inset-$edge','${px / density}px');" }
        val detail = JSONObject().put("top", safeArea.top / density).put("left", safeArea.left / density)
            .put("right", safeArea.right / density).put("bottom", safeArea.bottom / density)
            .put("rects", JSONArray().apply {
                cutoutRects.forEach { rect -> put(JSONObject()
                    .put("left", (rect.left - origin[0]) / density).put("top", (rect.top - origin[1]) / density)
                    .put("right", (rect.right - origin[0]) / density).put("bottom", (rect.bottom - origin[1]) / density)) }
            })
        web.evaluateJavascript("(function(){var style=document.documentElement && document.documentElement.style;if(style){$rules" +
            "window.__otaWindowInsets=$detail;" +
            "window.dispatchEvent(new CustomEvent('ota-window-insets',{detail:window.__otaWindowInsets}));}})()", null)
    }
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        localizedContext = null
        renderStartup(updater.engine.snapshot().trial)
        showNativeMessages()
        ViewCompat.requestApplyInsets(window.decorView)
    }
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) configureSystemBars()
    }
    private fun configureSystemBars() {
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.isAppearanceLightStatusBars = NativeLook.light(this)
        controller.isAppearanceLightNavigationBars = false
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }
    override fun onStart() {
        super.onStart()
        ShellUpdatedNotification.enterForeground(this)
        updater.setForeground(true)

    }
    override fun onResume() {
        super.onResume()
        resumed = true; refreshRecovery(); showNativeMessages()
        UpdateWorker.once(this,"start")
        updater.shell.returnedFromInstallSettings()
        updater.shell.maybeInstall() // recheck permission on return from unknown-app settings
        updater.shell.presentRequestedAndroidUi(this)
    }
    override fun onPause() {
        resumed = false; refreshRecovery()
        super.onPause()
    }
    override fun onStop() {
        updater.setForeground(false)
        ShellUpdatedNotification.leaveForeground()

        super.onStop()
    }
    private var afterNotificationPermission: (() -> Unit)? = null
    fun installWithNotificationPermission(action: () -> Unit) {
        if (ShellUpdatedNotification.enabled(this) && Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED &&
            !getPreferences(Context.MODE_PRIVATE).getBoolean("notificationAsked",false)) {
            getPreferences(Context.MODE_PRIVATE).edit().putBoolean("notificationAsked",true).apply()
            afterNotificationPermission = action
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),701)
        } else action()
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode,permissions,grantResults)
        if(requestCode == 701) { val action=afterNotificationPermission; afterNotificationPermission=null; action?.invoke() }
    }
    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
    private fun recreateBundle() {
        var restarted = false
        val restart = Runnable {
            if (!restarted && !isDestroyed && !isFinishing) {
                restarted = true
                recreate()
            }
        }
        handler.postDelayed(restart, 250)
        bridge?.webView?.evaluateJavascript("window.dispatchEvent(new Event('ota:bundle-restart'))") {
            handler.removeCallbacks(restart)
            restart.run()
        }
    }
    fun restartBundle(reset: Boolean = false, startupRecovery: Boolean = false) = updater.restart(reset, startupRecovery, ::recreateBundle)
    fun openReleases(): Boolean {
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Updater.RELEASES_URL))); return true }
        catch (e: android.content.ActivityNotFoundException) {
            updater.engine.log.add("Could not open releases: ${e.message}")
            if (updater.webCheckNotices() != true) {
                transientBanners["releases"] = { key ->
                    UpdateBannerItem(key, strings.getString(R.string.ota_cannot_open_github), strings.getString(R.string.ota_browser_unavailable))
                }
                showNativeMessages()
            }
            return false
        }
    }
    fun confirmReset(startupRecovery: Boolean = false) {
        val dialog = NativeLook.dialog(theme, strings.getString(R.string.ota_confirm_reset))
            .setMessage(strings.getString(R.string.ota_reset_explanation))
            .setPositiveButton(strings.getString(R.string.ota_reset)) { _, _ ->
                restartBundle(reset = true, startupRecovery = startupRecovery && updater.watchdog.reason != null)
            }.setNegativeButton(strings.getString(R.string.ota_cancel), null).create()
        NativeLook.show(dialog, primaryButton = AlertDialog.BUTTON_NEGATIVE, destructiveButton = AlertDialog.BUTTON_POSITIVE)
    }
    private var debugDialog: AlertDialog? = null
    private var refreshDebugSettings: (() -> Unit)? = null
    fun showSettings() {
        if (debugDialog?.isShowing == true) return
        val box = LinearLayout(theme).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp,8.dp,20.dp,8.dp) }
        val versions = TextView(theme).apply { text = strings.getString(R.string.ota_versions, updater.launch.version, BuildConfig.VERSION_NAME) }
        val initial = updater.settingsJson()
        val switches = linkedMapOf<String, Switch>()
        val choices = linkedMapOf<String, Pair<Spinner, List<String>>>()
        box.addView(versions)
        val checkStatus = TextView(theme).apply { text = if (updater.checks.hasError()) strings.getString(R.string.ota_check_failed) else "" }
        val checkHelp = NativeLook.button(theme).apply {
            text = "ⓘ"
            contentDescription = strings.getString(R.string.ota_connection_help)
            visibility = if (updater.checks.hasError()) View.VISIBLE else View.GONE
            setOnClickListener {
                val dialog = NativeLook.dialog(theme, strings.getString(R.string.ota_connection_help))
                    .setMessage(strings.getString(R.string.ota_connection_advice))
                    .setPositiveButton(strings.getString(R.string.ota_close), null).create()
                NativeLook.show(dialog)
            }
        }
        box.addView(LinearLayout(theme).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(checkStatus, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(checkHelp, LinearLayout.LayoutParams(48.dp, 48.dp))
        })
        listOf("smallFixes" to R.string.ota_small_fixes_auto,
            "majorUpdates" to R.string.ota_major_updates_auto,
            "shellUpdates" to R.string.ota_app_updates_auto,
            "updateNotifications" to R.string.ota_background_notices).forEach { (key,label) ->
            val control = Switch(theme).apply { setText(label); isChecked = initial.getBoolean(key) }
            switches[key] = control; box.addView(control)
        }
        fun choice(key: String, label: String, values: List<String>, labels: List<String>) {
            box.addView(TextView(theme).apply { text = label })
            val control = Spinner(theme).apply {
                adapter = ArrayAdapter(theme, android.R.layout.simple_spinner_dropdown_item, labels)
                setSelection(values.indexOf(initial.get(key).toString()))
            }
            choices[key] = control to values; box.addView(control)
        }
        choice("wifiLimitMb", strings.getString(R.string.ota_wifi_limit), listOf("5","20","50","100","-1"), listOf(strings.getString(R.string.ota_megabytes, 5),strings.getString(R.string.ota_megabytes, 20),strings.getString(R.string.ota_megabytes, 50),strings.getString(R.string.ota_megabytes, 100),strings.getString(R.string.ota_no_limit)))
        choice("mobileLimitMb", strings.getString(R.string.ota_mobile_limit), listOf("0","5","20","50","-1"), listOf(strings.getString(R.string.ota_never),strings.getString(R.string.ota_megabytes, 5),strings.getString(R.string.ota_megabytes, 20),strings.getString(R.string.ota_megabytes, 50),strings.getString(R.string.ota_no_limit)))
        choice("checkFrequency", strings.getString(R.string.ota_check_updates), listOf("open","1h","6h","24h","manual"),
            listOf(strings.getString(R.string.ota_check_on_open),strings.getString(R.string.ota_check_hourly),strings.getString(R.string.ota_check_six_hours),strings.getString(R.string.ota_check_daily),strings.getString(R.string.ota_check_manual)))
        box.addView(TextView(theme).apply { text = strings.getString(R.string.ota_check_settings_help) })
        val checkButton = NativeLook.button(theme).apply {
            text = strings.getString(R.string.ota_check_updates)
            setOnClickListener { updater.retryChecks() }
        }
        box.addView(checkButton)
        val shellUpdate = NativeLook.button(theme, primary = true).apply {
            setOnClickListener {
                if (!updater.safeToInterrupt) return@setOnClickListener
                if (updater.shell.isReady()) installWithNotificationPermission { updater.shell.installFromWeb(this@MainActivity) }
                else updater.shell.downloadOffered()
            }
        }
        fun refreshShellOffer() {
            val ready = updater.shell.manifest()?.takeIf { updater.shell.isReady() }?.versionName
            val available = updater.shell.availableState()?.optString("version")
            shellUpdate.text = if (ready != null) strings.getString(R.string.ota_install_update, ready) else strings.getString(R.string.ota_get_update, available)
            shellUpdate.visibility = if (ready != null || !available.isNullOrEmpty()) View.VISIBLE else View.GONE
            shellUpdate.isEnabled = updater.safeToInterrupt && !updater.shell.downloading
        }
        refreshShellOffer()
        box.addView(shellUpdate)
        box.addView(NativeLook.button(theme).apply { text = strings.getString(R.string.ota_restart); setOnClickListener { restartBundle(startupRecovery = updater.watchdog.reason != null) } })
        box.addView(NativeLook.button(theme).apply { text = strings.getString(R.string.ota_logs); setOnClickListener { showLogs() } })
        box.addView(NativeLook.button(theme).apply {
            text = strings.getString(R.string.ota_simulate_start)
            setOnClickListener {
                val message = if (updater.simulateBrokenStart()) strings.getString(R.string.ota_simulation_armed)
                    else strings.getString(R.string.ota_simulation_failed)
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show()
            }
        })
        val reset = NativeLook.button(theme).apply {
            text = strings.getString(R.string.ota_reset_builtin)
            setOnClickListener { confirmReset(startupRecovery = updater.watchdog.reason != null) }
        }
        box.addView(reset)
        val closeShell = NativeLook.button(theme).apply { text = strings.getString(R.string.ota_close); contentDescription = strings.getString(R.string.ota_close_maintenance) }
        val shellHeader = LinearLayout(theme).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 8.dp, 20.dp, 0)
            addView(NativeLook.title(theme, strings.getString(R.string.ota_maintenance)),
                LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(closeShell)
        }
        val maintenance = FrameLayout(theme).apply { addView(ScrollView(theme).apply { addView(box) }) }
        maintenanceBanner = NativeUpdateBanner(maintenance, ::dismissUpdateBanner)
        val dialog = NativeLook.dialog(theme).setCustomTitle(shellHeader).setView(maintenance)
            .setCancelable(true).setPositiveButton(strings.getString(R.string.ota_save),null).create()
        dialog.setCanceledOnTouchOutside(false)
        closeShell.setOnClickListener { dialog.cancel() }
        debugDialog = dialog
        refreshDebugSettings = {
            refreshShellOffer()
            checkStatus.text = if (updater.checks.hasError()) strings.getString(R.string.ota_check_failed) else ""
            checkHelp.visibility = if (updater.checks.hasError()) View.VISIBLE else View.GONE
            val latest = updater.settingsJson()
            switches.forEach { (key,control) ->
                if (control.isChecked == initial.getBoolean(key)) {
                    control.isChecked = latest.getBoolean(key); initial.put(key,latest.getBoolean(key))
                }
            }
            choices.forEach { (key,pair) ->
                if (pair.second[pair.first.selectedItemPosition] == initial.get(key).toString()) {
                    pair.first.setSelection(pair.second.indexOf(latest.get(key).toString())); initial.put(key,latest.get(key))
                }
            }
        }
        dialog.setOnDismissListener {
            maintenanceBanner?.clear(); maintenanceBanner = null
            debugDialog = null; refreshDebugSettings = null; refreshRecovery(); showNativeMessages()
        }
        dialog.setOnShowListener { dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            try {
                val patch = com.getcapacitor.JSObject().put("setupAnswered",true)
                switches.forEach { (key,control) -> if (control.isChecked != initial.getBoolean(key)) patch.put(key,control.isChecked) }
                choices.forEach { (key,pair) ->
                    val value = pair.second[pair.first.selectedItemPosition]
                    if (value != initial.get(key).toString()) patch.put(key,if (key == "checkFrequency") value else value.toInt())
                }
                updater.setUpdateSettings(patch)
                dialog.dismiss(); showNativeMessages()
            }
            catch (e: Exception) { updater.engine.log.add("Could not save update settings: ${e.message}"); checkStatus.text = strings.getString(R.string.ota_settings_failed) }
        } }; NativeLook.show(dialog)
        maintenance.post { showNativeMessages() }
    }
    private val nativeSeen = mutableSetOf<String>()
    internal fun setUiTheme(light: Boolean, language: String?) {
        val previousLight = NativeLook.light(this)
        val previousLanguage = NativeStrings.language(this)
        NativeLook.saveAppearance(this, light, language)
        if (previousLight == light && previousLanguage == NativeStrings.language(this)) return
        localizedContext = null
        refreshRecovery()
        showNativeMessages()
    }

    private fun dismissUpdateBanner(key: String) {
        nativeSeen.add(key)
        if (key == activeBannerKey) bannerFlow.clear()
        if (key.startsWith("app-installed:")) getSharedPreferences("native-update-messages", Context.MODE_PRIVATE)
            .edit().putBoolean(key, true).apply()
        transientBanners.remove(key)
        showNativeMessages()
    }
    private fun showNativeMessages() {
        val maintenance = maintenanceBanner
        val banner = maintenance ?: updateBanner ?: return
        if (loadingOverlay?.visibility == View.VISIBLE && maintenance == null) return
        if (maintenance != null) updateBanner?.clear()
        val webNotices = updater.webCheckNotices()
        if (!UpdateBannerFlow.nativeOwns(webNotices, maintenance != null)) {
            banner.clear(); activeBannerKey = null; bannerFlow.clear(); return
        }
        if (!resumed || isFinishing || isDestroyed || logDialog != null || (maintenance == null && recoveryDialog != null)) {
            banner.clear(); return
        }
        updater.checks.claim()?.let { notice ->
            transientBanners["check:${SystemClock.elapsedRealtime()}"] = { key ->
                UpdateBannerItem(key, strings.getString(R.string.ota_check_failed),
                    strings.checkFailureText(notice.failure), strings.getString(R.string.ota_retry), { updater.retryCheck(notice.channel) })
            }
        }
        val state = updater.info()
        val items = transientBanners.map { (key, item) -> item(key) }.toMutableList()
        state.optJSONObject("rolledBack")?.let {
            items.add(UpdateBannerItem("rollback:${it.optString("from")}:${it.optString("to")}", strings.getString(R.string.ota_rollback_title),
                strings.getString(R.string.ota_rollback_text, it.optString("from"), it.optString("to")), strings.getString(R.string.ota_details), ::showLogs))
        }
        val installedKey = "app-installed:${BuildConfig.VERSION_CODE}"
        val appUpdated = updater.shell.installedNotes() != null
        val webUpdated = state.optJSONObject("updated")?.optString("to")
        if (webNotices == false && (if (appUpdated) !getSharedPreferences("native-update-messages", Context.MODE_PRIVATE).getBoolean(installedKey, false) else webUpdated != null)) {
            val version = webUpdated ?: BuildConfig.VERSION_NAME
            items.add(UpdateBannerItem(if (appUpdated) installedKey else "updated:$version", strings.getString(R.string.ota_updated_to, version), "", brief = true))
        }
        for ((channel, version, transfer) in listOf(
            Triple("web", state.optString("webDownloadVersion"), state.optJSONObject("webTransfer")),
            Triple("shell", state.optString("shellDownloadVersion"), state.optJSONObject("shellTransfer"))
        )) {
            if (version.isBlank()) continue
            val total = transfer?.optLong("total") ?: 0
            val progress = if (total > 0) (100.0 * transfer!!.optLong("done") / total).toInt().coerceIn(0, 100) else null
            items.add(UpdateBannerItem("download:$channel:$version",
                strings.getString(R.string.ota_downloading), strings.getString(R.string.ota_keep_using_app), percent = progress, downloading = true,
                speed = transfer?.optLong("speed") ?: 0,
                step = UpdateBannerStep("$channel:$version", UpdateBannerPhase.DOWNLOADING)))
        }
        val appReady = state.optJSONObject("shellReady")
        (appReady ?: state.optJSONObject("shellAvailable"))?.let {
            val version = it.optString("version")
            items.add(if (appReady != null) UpdateBannerItem("app-ready:$version", strings.getString(R.string.ota_app_update_ready), strings.getString(R.string.ota_version_ready, version),
                strings.getString(R.string.ota_install_update, version), { installWithNotificationPermission { updater.shell.installFromWeb(this) } }, keepOnAction = true,
                step = UpdateBannerStep("shell:$version", UpdateBannerPhase.READY))
            else UpdateBannerItem("app-offer:$version", updateOfferTitle(strings.getString(R.string.ota_app_update), version, it.optLong("size", -1)), "",
                strings.getString(R.string.ota_get_update, version), { updater.shell.downloadOffered() }, keepOnAction = true,
                step = UpdateBannerStep("shell:$version", UpdateBannerPhase.AVAILABLE)))
        }
        val staged = state.optJSONObject("staged")
        (staged ?: state.optJSONObject("available"))?.let {
            val version = it.optString("version")
            items.add(when {
                staged != null -> UpdateBannerItem("ready:$version", strings.getString(R.string.ota_update_ready), strings.getString(R.string.ota_restart_to_update, strings.getString(R.string.app_name)), strings.getString(R.string.ota_install_update, version), { restartBundle(startupRecovery = updater.watchdog.reason != null) }, keepOnAction = true,
                    step = UpdateBannerStep("web:$version", UpdateBannerPhase.READY))
                it.optBoolean("needsShell") -> UpdateBannerItem("app-first:$version", strings.getString(R.string.ota_update_version, version), strings.getString(R.string.ota_app_update_first))
                else -> UpdateBannerItem("offer:$version", updateOfferTitle(strings.getString(R.string.ota_update), version, it.optLong("size", -1)), "", strings.getString(R.string.ota_get_update, version), { updater.download(installAfterDownload = false) }, keepOnAction = true,
                    step = UpdateBannerStep("web:$version", UpdateBannerPhase.AVAILABLE))
            })
        }
        val error = updateFailure(updater.status, updater.shell.status)
        if (error != null) items.add(UpdateBannerItem("error:$error", strings.getString(R.string.ota_update_failed), strings.getString(R.string.ota_try_connection_again), strings.getString(R.string.ota_details), ::showLogs))
        val installing = state.optString("installingVersion").takeIf { it.isNotBlank() }
        if (installing != null) {
            val target = "${state.optString("installingChannel")}:$installing"
            items.add(UpdateBannerItem("installing:$target", strings.getString(R.string.ota_installing), strings.getString(R.string.ota_update_version, installing), installing = true,
                step = UpdateBannerStep(target, UpdateBannerPhase.INSTALLING)))
        }
        val queue = items.filter { it.key !in nativeSeen }
        val rolledBackVersion = state.optJSONObject("rolledBack")?.optString("from")
        val next = bannerFlow.select(queue, failed = { step ->
            if (step.target.startsWith("shell:")) updateFailure(updater.shell.status) != null
            else step.target == "web:$rolledBackVersion" || updateFailure(updater.status) != null
        }, preferred = queue.firstOrNull { it.brief } ?: queue.firstOrNull { it.key == activeBannerKey })
        activeBannerKey = next?.key
        val bandInset = maxOf(safeArea.top, systemTop)
        val bandHeight = if (bandInset > 0) bandInset + 14.dp else 0
        if (maintenance == null) banner.render(next, bandHeight + 8.dp, safeArea.left, safeArea.right)
        else banner.render(next, 0, 0, 0)
    }
    private fun updateFailure(vararg states: String) = states.firstOrNull {
        it.startsWith("Download failed") || it.startsWith("Install failed") || it.startsWith("App install failed") ||
            it.startsWith("Shell update processing failed") || it.startsWith("Update processing failed") || it.startsWith("Restart failed") ||
            it.contains("Not enough storage")
    }
    internal fun logWebDiagnostic(level: String, message: String) {
        updater.engine.log.add("WebView ${level.take(24)}: ${message.take(1200).replace('\r', ' ')}")
    }
    internal fun logEnvironment(): String {
        val webView = runCatching { WebView.getCurrentWebViewPackage() }.getOrNull()
        val version = webView?.let { "${it.packageName} ${it.versionName}" } ?: "unknown"
        return "WebView: $version\nAndroid: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})\nDevice: ${Build.MANUFACTURER} ${Build.MODEL}"
    }
    private fun logsText() = "${logEnvironment()}\nUpdate address: ${updater.url}\nApp ${BuildConfig.VERSION_NAME} / API ${BuildConfig.SHELL_API}\n${updater.status} · ${updater.shell.status}\n\n${updater.checks.summary()}\n${updater.checks.snapshot()}\n\nstate.json\n${updater.engine.stateJson()}\n\nNewest first (last 500 lines)\n${updater.engine.log.read()}"
    private fun renderLogs() { logText?.text = logsText() }
    private fun copyLogs() {
        (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText(strings.getString(R.string.ota_log_clipboard_label), logsText()))
        Toast.makeText(this, strings.getString(R.string.ota_logs_copied), Toast.LENGTH_SHORT).show()
    }
    fun showLogs() {
        if (logDialog?.isShowing == true) return
        logText = TextView(theme).apply { textSize = 12f; typeface = android.graphics.Typeface.MONOSPACE; setTextIsSelectable(true); setPadding(20.dp,8.dp,20.dp,8.dp) }
        val scroll = ScrollView(theme).apply { addView(logText) }
        logDialog = NativeLook.dialog(theme, strings.getString(R.string.ota_live_logs)).setView(scroll)
            .setPositiveButton(strings.getString(R.string.ota_close), null).setNeutralButton(strings.getString(R.string.ota_copy),null).setNegativeButton(strings.getString(R.string.ota_clear),null).create()
        logDialog!!.setOnShowListener {
            logDialog!!.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener { copyLogs() }
            logDialog!!.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener { updater.engine.log.clear(); renderLogs() }
            renderLogs(); handler.postDelayed(refreshLogs,1000)
        }
        logDialog!!.setOnDismissListener { handler.removeCallbacks(refreshLogs); logDialog = null; logText = null; if (!isDestroyed) refreshRecovery() }
        NativeLook.show(logDialog!!)
    }
    override fun onDestroy() {
        handler.removeCallbacks(recoveryTick); recoveryDialog?.dismiss(); updateBanner?.clear()
        debugDialog?.setOnDismissListener(null); debugDialog?.dismiss(); refreshDebugSettings = null
        unregisterReceiver(screenReceiver)
        handler.removeCallbacks(refreshLogs); logDialog?.setOnDismissListener(null); logDialog?.dismiss()
        updater.onChange = null; updater.onToast = null
        super.onDestroy()
    }
}
