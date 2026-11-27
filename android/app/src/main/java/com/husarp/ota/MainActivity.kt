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
import android.graphics.Typeface
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
import com.getcapacitor.Bridge
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebChromeClient
import com.getcapacitor.BridgeWebViewClient
import com.getcapacitor.ProcessedRoute
import com.getcapacitor.ServerPath
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
    private val app get() = application as OtaApplication
    private val updater get() = app.updater
    private val handler = Handler(Looper.getMainLooper())
    private var safeMode = false
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
    @Volatile private var activityLaunchToken: String? = null
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
        if (activityLaunchToken == null || (updater.launching && updater.activation.current != null)) {
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
        when {
            updater.launching && phase != null -> {
                val step = if (phase.step == UpdateActivation.Step.CHECKING_FILES) strings.getString(R.string.ota_checking_files)
                    else strings.getString(R.string.ota_installing_version, versionLabel("web", phase.version))
                loadingOverlay?.show(phase.version, step, phase)
            }
            activityLaunchToken == null -> loadingOverlay?.show(updater.launch.version, strings.getString(R.string.ota_loading_app))
            !updater.watchdog.showLoading && !updater.launching -> loadingOverlay?.visibility = View.GONE
            trial || !webCommitted -> {
                val step = strings.getString(if (webCommitted) R.string.ota_starting else R.string.ota_loading_app)
                loadingOverlay?.show(updater.launch.version, step)
            }
            else -> loadingOverlay?.visibility = View.GONE
        }
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = lightStatusBars()
    }
    private fun showStartupRecovery(reason: String) {
        updater.engine.log.add("Startup watchdog: ${updater.launch.version} ($reason)")
        val theme = this.theme
        val box = LinearLayout(theme).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp,8.dp,20.dp,18.dp) }
        val palette = NativeLook.palette(NativeLook.light(this))
        val heading = LinearLayout(theme).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(20.dp, 18.dp, 20.dp, 0)
            addView(NativeLook.noticeMark(theme, "!"), LinearLayout.LayoutParams(32.dp, 32.dp))
            addView(NativeLook.title(theme, strings.getString(R.string.ota_start_failed, strings.getString(R.string.app_name))).apply {
                textSize = 28f
                setPaddingRelative(10.dp, 0, 0, 0)
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }
        val dialog = NativeLook.dialog(theme).setCustomTitle(heading)
            .setView(ScrollView(theme).apply { addView(box) }).setCancelable(false).create()
        val status = TextView(theme).apply {
            setText(R.string.ota_recovery_help)
            setTextColor(palette.text)
            setPadding(0, 0, 0, 12.dp)
        }
        val check = NativeLook.button(theme, primary = true).apply { text = strings.getString(R.string.ota_check_fix) }
        val reset = NativeLook.button(theme).apply { text = strings.getString(R.string.ota_reset_builtin) }
        val wait = NativeLook.button(theme).apply { text = strings.getString(R.string.ota_wait_longer) }
        val shell = NativeLook.button(theme, ghost = true).apply { setText(R.string.ota_open_maintenance) }
        val copy = NativeLook.button(theme, ghost = true).apply { text = strings.getString(R.string.ota_copy_logs); setOnClickListener { copyLogs() } }
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
        // Keep recovery actions ahead of the support tools (owner, 2026-11-26).
        box.addView(status); box.addView(check); box.addView(wait)
        if (updater.launch.version != updater.engine.embedded.version) box.addView(reset)
        box.addView(actionRow(theme, shell, copy))
        updateBanner?.clear()
        dialog.setOnDismissListener {
            if (recoveryDialog === dialog) { recoveryDialog = null; refreshRecoveryCheck = null }
        }
        recoveryDialog = dialog; NativeLook.show(dialog, outlined = true)
    }
    private fun startupFailed(reason: String) {
        val token = activityLaunchToken ?: return
        updater.watchdog.failed(token, reason)
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
        safeMode = !app.startupCrashGuard.beginLaunch()
        if (safeMode) {
            super.onCreate(savedInstanceState)
            return
        }
        ShellUpdatedNotification.enterForeground(this)
        registerPlugin(OtaPlugin::class.java)
        // Capacitor's own shouldInterceptRequest still injects its bridge into HTML.
        // Route every signed web path independently to the overlay or the APK asset.
        bridgeBuilder.setRouteProcessor { _, route ->
            val path = route.trimStart('/').ifEmpty { "index.html" }
            val bundlePath = activityLaunchToken != null && path != STARTUP_PAGE && updater.engine.hasPath(path)
            val overlay = if (bundlePath) updater.engine.overlayFile(path) else null
            ProcessedRoute().apply {
                setPath(when {
                    path == STARTUP_PAGE -> STARTUP_PAGE
                    bundlePath -> overlay?.absolutePath ?: "public/$path"
                    else -> "public/__missing__"
                })
                setAsset(overlay == null); setIgnoreAssetPath(true)
            }
        }
        registerPlugin(BluetoothLinkPlugin::class.java)
        registerPlugin(LanLinkPlugin::class.java)
        registerPlugin(NearbyLinkPlugin::class.java)
        registerPlugin(AppUpdatePlugin::class.java)
        registerPlugin(GameVibrationPlugin::class.java)
        super.onCreate(savedInstanceState)
    }

    override fun setContentView(layoutResID: Int) {
        if (safeMode) {
            // BridgeActivity sets its WebView layout before calling load().
            super.setContentView(StartupSafeModeScreen(this, app, ::retryStartup))
        } else {
            super.setContentView(layoutResID)
        }
    }

    private fun retryStartup(builtIn: Boolean) {
        if (isFinishing || isDestroyed) return
        app.startingBuiltIn = builtIn
        app.retryingStartup = true
        app.startupCrashGuard.beginLaunch(retry = true)
        recreate()
    }

    override fun load() {
        if (safeMode) return
        // Bridge and Chrome client register Activity Result launchers during onCreate.
        // Queue the initial navigation so Capacitor has installed the route processor first.
        bridgeBuilder.setServerPath(ServerPath(ServerPath.PathType.ASSET_PATH, Bridge.DEFAULT_WEB_ASSET_DIR))
        super.load()
        configureWebView()
        val webFrame = findViewById<FrameLayout>(android.R.id.content)
        updateBanner = NativeUpdateBanner(webFrame, ::dismissUpdateBanner)
        loadingOverlay = StartupScreen(this).also {
            webFrame.addView(it, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        configureSystemBars()
        renderStartup()
        updater.onChange = {
            if (!isFinishing && !isDestroyed) {
                refreshRecovery()
                refreshDebugSettings?.invoke()
                if (resumed && activityLaunchToken != null) updater.shell.presentRequestedAndroidUi(this)
                showNativeMessages()
            }
        }
        updater.onToast = { message ->
            if (!isFinishing) {
                transientBanners["message:$message"] = { key ->
                    UpdateBannerItem(key, strings.getString(message), "")
                }
                showNativeMessages()
            }
        }
        updater.prepareLaunch(app.startingBuiltIn, recovery = app.retryingStartup) {
            if (!isFinishing && !isDestroyed) loadPreparedBundle()
        }
    }

    private fun configureWebView() {
        val web = bridge.webView
        // Local text notices have no response charset in Capacitor.
        web.settings.defaultTextEncodingName = "UTF-8"
        if (resources.configuration.smallestScreenWidthDp >= 600) {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_USER
            web.settings.useWideViewPort = true
            web.settings.loadWithOverviewMode = true
        }
        setupEdgeToEdge(web)
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
                if (activityLaunchToken == null || url == bridge.appUrl) return
                if (!webCommitted) view.clearHistory()
                webCommitted = true
                refreshRecovery()
                injectSafeArea(view)
            }
            private fun required(request: WebResourceRequest): Boolean {
                if (activityLaunchToken == null || request.url.toString() == bridge.appUrl) return false
                return request.isForMainFrame ||
                    (request.url.host == "localhost" && updater.engine.hasPath(request.url.path.orEmpty().trimStart('/')))
            }
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
    }
    private fun loadPreparedBundle() {
        val web = bridge.webView
        web.post {
            if (isFinishing || isDestroyed) return@post
            activityLaunchToken = updater.launch.token
            app.bundleSelected()
            web.loadUrl("${bridge.localUrl}/")
            if (resumed) resumeUpdateUi() else refreshRecovery()
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
        if (safeMode) return
        localizedContext = null
        refreshRecovery()
        showNativeMessages()
        ViewCompat.requestApplyInsets(window.decorView)
    }
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && !safeMode) configureSystemBars()
    }
    private fun lightStatusBars() = loadingOverlay?.visibility != View.VISIBLE && NativeLook.light(this)

    private fun configureSystemBars() {
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.isAppearanceLightStatusBars = lightStatusBars()
        controller.isAppearanceLightNavigationBars = false
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }
    override fun onStart() {
        super.onStart()
        if (safeMode) return
        ShellUpdatedNotification.enterForeground(this)
        updater.setForeground(true)
    }
    override fun onResume() {
        super.onResume()
        if (safeMode) return
        resumed = true
        if (activityLaunchToken != null) resumeUpdateUi() else renderStartup()
    }
    private fun resumeUpdateUi() {
        refreshRecovery(); showNativeMessages()
        updater.shell.returnedFromInstallSettings()
        updater.shell.maybeInstall() // recheck permission on return from unknown-app settings
        updater.shell.presentRequestedAndroidUi(this)
    }
    override fun onPause() {
        if (!safeMode) {
            resumed = false; refreshRecovery()
        }
        super.onPause()
    }
    override fun onStop() {
        if (safeMode) {
            super.onStop()
            return
        }
        if (bridge == null) activityDepth = 0
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
            if (updater.webCheckNotices() != true || maintenanceBanner != null) {
                transientBanners["releases"] = { key ->
                    UpdateBannerItem(key, strings.getString(R.string.ota_browser_unavailable), "")
                }
                showNativeMessages()
            }
            return false
        }
    }
    fun confirmReset(startupRecovery: Boolean = false) {
        val box = LinearLayout(theme).apply {
            orientation = LinearLayout.VERTICAL; setPadding(20.dp, 6.dp, 20.dp, 18.dp)
            addView(TextView(theme).apply { setText(R.string.ota_reset_explanation) })
            addView(TextView(theme).apply {
                setText(R.string.ota_reset_saves)
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, 12.dp, 0, 12.dp)
            })
        }
        // Give Cancel the primary action and keep the save assurance separate (owner, 2026-11-26).
        val dialog = NativeLook.dialog(theme, strings.getString(R.string.ota_confirm_reset))
            .setView(box).create()
        box.addView(NativeLook.button(theme, primary = true).apply {
            setText(R.string.ota_cancel); setOnClickListener { dialog.cancel() }
        })
        box.addView(NativeLook.button(theme).apply {
            setText(R.string.ota_reset_builtin)
            setOnClickListener {
                dialog.dismiss()
                restartBundle(reset = true, startupRecovery = startupRecovery && updater.watchdog.reason != null)
            }
        })
        NativeLook.show(dialog, outlined = true)
    }
    private fun actionRow(context: Context, vararg buttons: Button) = LinearLayout(context).apply {
        gravity = Gravity.CENTER_VERTICAL
        for (button in buttons) addView(button, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    }
    private var debugDialog: AlertDialog? = null
    private var refreshDebugSettings: (() -> Unit)? = null
    fun showSettings() {
        if (debugDialog?.isShowing == true) return
        val theme = this.theme
        val palette = NativeLook.palette(NativeLook.light(this))
        val box = LinearLayout(theme).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp,8.dp,20.dp,8.dp) }
        val versions = TextView(theme).apply { text = strings.getString(R.string.ota_versions, updater.launch.version, BuildConfig.VERSION_NAME) }
        val initial = updater.settingsJson()
        val switches = linkedMapOf<String, Switch>()
        val choices = linkedMapOf<String, Pair<Spinner, List<String>>>()
        box.addView(versions)
        val checkStatus = TextView(theme).apply { text = updater.checks.displayStatus(strings) }
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
        val checkStatusRow = LinearLayout(theme).apply {
            gravity = Gravity.CENTER_VERTICAL
            visibility = View.VISIBLE
            addView(checkStatus, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(checkHelp, LinearLayout.LayoutParams(48.dp, 48.dp))
        }
        box.addView(checkStatusRow)
        // Group the controls by purpose in maintenance (owner, 2026-11-26).
        fun heading(label: Int) {
            box.addView(NativeLook.title(theme, strings.getString(label)).apply {
                textSize = 20f; setPadding(0, 12.dp, 0, 5.dp)
            })
        }
        fun group(label: Int) = LinearLayout(theme).apply {
            heading(label)
            orientation = LinearLayout.VERTICAL
            background = NativeLook.surface(theme, palette.surface, palette.line)
            setPadding(12.dp, 4.dp, 12.dp, 4.dp)
            box.addView(this)
        }
        fun divider(group: LinearLayout) {
            if (group.childCount != 0) group.addView(View(theme).apply {
                setBackgroundColor(if (NativeLook.light(this@MainActivity)) palette.line else 0xFF2A2A2A.toInt())
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1.dp))
        }
        val automatic = group(R.string.ota_automatic_updates)
        listOf("smallFixes" to R.string.ota_small_fixes_auto,
            "majorUpdates" to R.string.ota_major_updates_auto,
            "shellUpdates" to R.string.ota_app_updates_auto,
            "updateNotifications" to R.string.ota_background_notices).forEach { (key,label) ->
            val control = Switch(theme).apply {
                setText(label); isChecked = initial.getBoolean(key); minHeight = 48.dp
                setPadding(0, 6.dp, 0, 6.dp)
            }
            divider(automatic)
            switches[key] = control; automatic.addView(control)
        }
        val downloads = group(R.string.ota_downloads_and_checks)
        fun choice(key: String, label: String, values: List<String>, labels: List<String>) {
            divider(downloads)
            downloads.addView(TextView(theme).apply { text = label; setPadding(0, 8.dp, 0, 0) })
            val control = Spinner(theme).apply {
                adapter = ArrayAdapter(theme, android.R.layout.simple_spinner_dropdown_item, labels)
                setSelection(values.indexOf(initial.get(key).toString()))
            }
            choices[key] = control to values
            downloads.addView(control, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 48.dp))
        }
        choice("wifiLimitMb", strings.getString(R.string.ota_wifi_limit), listOf("5","20","50","100","-1"), listOf(strings.getString(R.string.ota_megabytes, 5),strings.getString(R.string.ota_megabytes, 20),strings.getString(R.string.ota_megabytes, 50),strings.getString(R.string.ota_megabytes, 100),strings.getString(R.string.ota_no_limit)))
        choice("mobileLimitMb", strings.getString(R.string.ota_mobile_limit), listOf("0","5","20","50","-1"), listOf(strings.getString(R.string.ota_never),strings.getString(R.string.ota_megabytes, 5),strings.getString(R.string.ota_megabytes, 20),strings.getString(R.string.ota_megabytes, 50),strings.getString(R.string.ota_no_limit)))
        choice("checkFrequency", strings.getString(R.string.ota_check_frequency), listOf("1h","6h","24h"),
            listOf(strings.getString(R.string.ota_check_hourly),strings.getString(R.string.ota_check_six_hours),strings.getString(R.string.ota_check_daily)))
        box.addView(TextView(theme).apply {
            setText(R.string.ota_check_settings_help); setTextColor(palette.muted); textSize = 13f
            setPadding(0, 8.dp, 0, 8.dp)
        })
        val checkButton = NativeLook.button(theme).apply {
            text = strings.getString(R.string.ota_check_updates)
            setOnClickListener { updater.retryChecks() }
        }
        val shellUpdate = NativeLook.button(theme, primary = true)
        fun refreshShellOffer() {
            val state = updater.info()
            val combined = state.optJSONObject("combined")
            val ready = state.optJSONObject("shellReady")
            val available = state.optJSONObject("shellAvailable")
            val phase = combined?.optString("phase")
            val versions = combined?.let(::combinedVersions)
                ?: (ready ?: available)?.optString("version")?.let { strings.getString(R.string.ota_android_version, it) }
            val canInstall = phase == "ready" || ready != null
            shellUpdate.text = versions?.let { strings.getString(if (canInstall) R.string.ota_install_update else R.string.ota_get_update, it) }
            shellUpdate.visibility = if (versions == null) View.GONE else View.VISIBLE
            shellUpdate.isEnabled = updater.safeToInterrupt && (phase == null || phase in listOf("available", "ready")) &&
                !updater.shell.downloading
            shellUpdate.setOnClickListener {
                when {
                    combined != null -> actOnCombined(combined, canInstall)
                    canInstall -> installWithNotificationPermission { updater.shell.installFromWeb(this) }
                    else -> updater.shell.downloadOffered()
                }
            }
        }
        refreshShellOffer()
        box.addView(actionRow(theme, checkButton, shellUpdate))
        val restart = NativeLook.button(theme).apply { text = strings.getString(R.string.ota_restart); setOnClickListener { restartBundle(startupRecovery = updater.watchdog.reason != null) } }
        val logs = NativeLook.button(theme).apply { text = strings.getString(R.string.ota_logs); setOnClickListener { showLogs() } }
        box.addView(actionRow(theme, restart, logs))
        heading(R.string.ota_troubleshooting)
        box.addView(NativeLook.button(theme).apply {
            text = strings.getString(R.string.ota_simulate_start)
            setOnClickListener {
                val message = if (updater.simulateBrokenStart()) R.string.ota_simulation_armed else R.string.ota_simulation_failed
                showLogoToast(message, Toast.LENGTH_LONG)
            }
        })
        val reset = NativeLook.button(theme).apply {
            text = strings.getString(R.string.ota_reset_builtin)
            setOnClickListener { confirmReset(startupRecovery = updater.watchdog.reason != null) }
        }
        box.addView(reset)
        val save = NativeLook.button(theme, primary = true).apply { setText(R.string.ota_save) }
        box.addView(save, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = 6.dp
        })
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
            .setCancelable(true).create()
        dialog.setCanceledOnTouchOutside(false)
        closeShell.setOnClickListener { dialog.cancel() }
        debugDialog = dialog
        refreshDebugSettings = {
            refreshShellOffer()
            checkStatus.text = updater.checks.displayStatus(strings)
            checkHelp.visibility = if (updater.checks.hasError()) View.VISIBLE else View.GONE
            checkStatusRow.visibility = if (checkStatus.text.isNotEmpty()) View.VISIBLE else View.GONE
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
        save.setOnClickListener {
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
            catch (e: Exception) {
                updater.engine.log.add("Could not save update settings: ${e.message}")
                showLogoToast(R.string.ota_settings_failed, Toast.LENGTH_LONG)
            }
        }
        NativeLook.show(dialog, outlined = true)
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
        if (transientBanners.remove(key) == null) nativeSeen.add(key)
        if (key == activeBannerKey) bannerFlow.clear()
        showNativeMessages()
    }
    private fun showNativeMessages() {
        val maintenance = maintenanceBanner
        val banner = maintenance ?: updateBanner ?: return
        if (loadingOverlay?.visibility == View.VISIBLE && maintenance == null) return
        try {
            renderNativeMessages(banner, maintenance != null)
        } catch (e: Exception) {
            banner.clear()
            activeBannerKey = null
            bannerFlow.clear()
            updater.engine.log.add("Could not show native update notice: ${e.javaClass.simpleName}: ${e.message}")
        }
    }
    private fun renderNativeMessages(banner: NativeUpdateBanner, maintenance: Boolean) {
        if (maintenance) updateBanner?.clear()
        val webNotices = updater.webCheckNotices()
        if (!UpdateBannerFlow.nativeOwns(webNotices, maintenance)) {
            banner.clear(); activeBannerKey = null; bannerFlow.clear(); return
        }
        if (!resumed || isFinishing || isDestroyed || logDialog != null || (!maintenance && recoveryDialog != null)) {
            banner.clear(); return
        }
        updater.checks.claim()?.let { notice ->
            transientBanners["check:${SystemClock.elapsedRealtime()}"] = { key ->
                val advice = if (notice.failure == CheckFailure.UNREACHABLE) strings.getString(R.string.ota_reach_server_advice) else ""
                UpdateBannerItem(key, strings.checkFailureText(notice.failure), advice,
                    strings.getString(R.string.ota_retry), updater::retryChecks, spacedAction = true)
            }
        }
        // Use the same notice headings and actions in the native fallback (owner, 2026-11-26).
        val locale = strings.resources.configuration.locales[0]
        val state = updater.info()
        val items = transientBanners.map { (key, item) -> item(key) }.toMutableList()
        state.optJSONObject("rolledBack")?.let {
            val from = it.optString("from")
            val reason = if (it.optString("reason") == "blocked") R.string.ota_rollback_blocked else R.string.ota_rollback_text
            items.add(UpdateBannerItem("rollback:$from:${it.optString("to")}", strings.getString(R.string.ota_rollback_title, it.optString("to")),
                strings.getString(reason, from), strings.getString(R.string.ota_details), ::showLogs, symbol = "↶"))
        }
        val combined = state.optJSONObject("combined")
        combined?.let { combinedBanner(it, locale) }?.let(items::add)
        if (combined == null) {
            for ((channel, version, transfer) in listOf(
                Triple("web", state.optString("webDownloadVersion"), state.optJSONObject("webTransfer")),
                Triple("shell", state.optString("shellDownloadVersion"), state.optJSONObject("shellTransfer"))
            )) {
                if (version.isBlank()) continue
                val total = transfer?.optLong("total") ?: 0
                val done = transfer?.optLong("done") ?: 0
                val progress = if (total > 0) (100.0 * done / total).toInt().coerceIn(0, 100) else null
                items.add(UpdateBannerItem("download:$channel:$version",
                    strings.getString(R.string.ota_downloading, versionLabel(channel, version)), strings.getString(R.string.ota_keep_using_app), percent = progress, downloading = true,
                    speed = transfer?.optLong("speed") ?: 0, received = done, total = total,
                    step = UpdateBannerStep("$channel:$version", UpdateBannerPhase.DOWNLOADING)))
            }
            val appReady = state.optJSONObject("shellReady")
            (appReady ?: state.optJSONObject("shellAvailable"))?.let {
                val version = it.optString("version")
                items.add(if (appReady != null) UpdateBannerItem("app-ready:$version", strings.getString(R.string.ota_app_ready_version, version), "",
                    strings.getString(R.string.ota_banner_install_restart), { installWithNotificationPermission { updater.shell.installFromWeb(this) } }, keepOnAction = true,
                    step = UpdateBannerStep("shell:$version", UpdateBannerPhase.READY))
                else UpdateBannerItem("app-offer:$version", updateOfferTitle(strings.getString(R.string.ota_app_update), version, it.optLong("size", -1), locale), "",
                    strings.getString(R.string.ota_banner_download), { updater.shell.downloadOffered() }, keepOnAction = true,
                    step = UpdateBannerStep("shell:$version", UpdateBannerPhase.AVAILABLE)))
            }
            val staged = state.optJSONObject("staged")
            (staged ?: state.optJSONObject("available"))?.let {
                val version = it.optString("version")
                items.add(when {
                    staged != null -> UpdateBannerItem("ready:$version", strings.getString(R.string.ota_ready_version, version), "",
                        strings.getString(R.string.ota_banner_install_restart), { restartBundle(startupRecovery = updater.watchdog.reason != null) }, keepOnAction = true,
                        step = UpdateBannerStep("web:$version", UpdateBannerPhase.READY))
                    it.optBoolean("needsShell") -> UpdateBannerItem("app-first:$version", strings.getString(R.string.ota_app_required),
                        strings.getString(R.string.ota_app_required_text, version), strings.getString(R.string.ota_updates), ::showSettings, symbol = "↓")
                    else -> UpdateBannerItem("offer:$version", updateOfferTitle(strings.getString(R.string.ota_banner_new_update), versionLabel("web", version), it.optLong("size", -1), locale), "", strings.getString(R.string.ota_banner_download), { updater.download(installAfterDownload = false) }, keepOnAction = true,
                        step = UpdateBannerStep("web:$version", UpdateBannerPhase.AVAILABLE))
                })
            }
            val installing = state.optString("installingVersion").takeIf { it.isNotBlank() }
            if (installing != null) {
                val target = "${state.optString("installingChannel")}:$installing"
                val work = updater.activation.current?.takeIf { target == "web:${it.version}" && it.total > 0 }
                items.add(UpdateBannerItem("installing:$target", strings.getString(R.string.ota_installing_version, versionLabel(state.optString("installingChannel"), installing)), "",
                    percent = work?.let { it.done * 100 / it.total }, installing = true,
                    step = UpdateBannerStep(target, UpdateBannerPhase.INSTALLING)))
            }
        }
        val error = updateFailure(updater.status, updater.shell.status)
        if (error != null) items.add(UpdateBannerItem("error:$error", strings.getString(R.string.ota_update_failed),
            strings.getString(R.string.ota_retry_from_updates), strings.getString(R.string.ota_updates), ::showSettings))
        val queue = items.filter { it.key !in nativeSeen }
        val rolledBackVersion = state.optJSONObject("rolledBack")?.optString("from")
        val transient = queue.firstOrNull { it.key in transientBanners }
        val next = if (transient != null && queue.none { it.installing || it.downloading }) transient
            else bannerFlow.select(queue, failed = { step ->
                if (step.target.startsWith("combined:")) error != null
                else if (step.target.startsWith("shell:")) updateFailure(updater.shell.status) != null
                else step.target == "web:$rolledBackVersion" || updateFailure(updater.status) != null
            }, preferred = queue.firstOrNull { it.key == activeBannerKey })
        activeBannerKey = next?.key
        val bandInset = maxOf(safeArea.top, systemTop)
        val bandHeight = if (bandInset > 0) bandInset + 14.dp else 0
        if (!maintenance) banner.render(next, bandHeight + 8.dp, safeArea.left, safeArea.right)
        else banner.render(next, 0, 0, 0)
    }
    private fun versionLabel(channel: String, version: String) =
        strings.getString(if (channel == "shell") R.string.ota_android_version else R.string.ota_lexling_version, version)

    private fun combinedVersions(update: org.json.JSONObject) =
        strings.getString(R.string.ota_combined_versions, update.optString("version"), update.optString("webVersion"))

    private fun actOnCombined(update: org.json.JSONObject, install: Boolean) {
        if (install) installWithNotificationPermission {
            if (updater.combinedReady(update.optLong("versionCode"), update.optString("webVersion")))
                updater.shell.installFromWeb(this)
        }
        else updater.downloadCombined(update.optLong("versionCode"), update.optString("webVersion"))
    }

    private fun combinedBanner(update: org.json.JSONObject, locale: java.util.Locale): UpdateBannerItem? {
        val target = "combined:${update.optLong("versionCode")}:${update.optString("webVersion")}"
        val versions = combinedVersions(update)
        val phase = UpdateBannerPhase.entries.firstOrNull { it.name.equals(update.optString("phase"), ignoreCase = true) }
            ?: return null
        val progress = update.optJSONObject("transfer")
        val done = progress?.optLong("done") ?: 0
        val total = progress?.optLong("total") ?: 0
        val downloading = phase == UpdateBannerPhase.DOWNLOADING
        val installing = phase == UpdateBannerPhase.INSTALLING
        val ready = phase == UpdateBannerPhase.READY
        val available = phase == UpdateBannerPhase.AVAILABLE
        val title = when (phase) {
            UpdateBannerPhase.AVAILABLE -> {
                val size = update.optLong("size", -1).takeUnless { update.optBoolean("estimatedSize") }
                updateOfferTitle(strings.getString(R.string.ota_banner_new_update), versions, size, locale)
            }
            UpdateBannerPhase.DOWNLOADING -> strings.getString(R.string.ota_downloading, versions)
            UpdateBannerPhase.READY -> strings.getString(R.string.ota_ready_combined, versions)
            UpdateBannerPhase.INSTALLING -> strings.getString(R.string.ota_installing_version, versions)
        }
        return UpdateBannerItem("$target:$phase:$title", title, if (downloading) strings.getString(R.string.ota_keep_using_app) else "",
            actionLabel = when {
                available -> strings.getString(R.string.ota_banner_download)
                ready -> strings.getString(R.string.ota_banner_install_restart)
                else -> null
            }, action = { actOnCombined(update, ready) }, keepOnAction = true,
            percent = if (total > 0) (100.0 * done / total).toInt().coerceIn(0, 100) else null,
            downloading = downloading, installing = installing, step = UpdateBannerStep(target, phase),
            speed = progress?.optLong("speed") ?: 0, received = done, total = total)
    }
    private fun updateFailure(vararg states: String) = states.firstOrNull {
        it.startsWith("Download failed") || it.startsWith("Install failed") || it.startsWith("Android app install failed") ||
            it.startsWith("Android app update processing failed") || it.startsWith("Update processing failed") || it.startsWith("Restart failed") ||
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
    internal fun withNativeCrashReport(log: String): String {
        val report = app.startupCrashGuard.reportText()
        return if (report.isEmpty()) log else "$report\n\n$log"
    }
    private fun logsText() = withNativeCrashReport("${logEnvironment()}\nUpdate address: ${Updater.DEFAULT_URL}\n${strings.getString(R.string.ota_versions, updater.launch.version, BuildConfig.VERSION_NAME)} / API ${BuildConfig.SHELL_API}\n${updater.status} · ${updater.shell.status}\n\n${updater.checks.summary()}\n${updater.checks.snapshot()}\n\nstate.json\n${updater.engine.stateJson()}\n\nNewest first (last 500 lines)\n${updater.engine.log.read()}")
    private fun renderLogs() { logText?.text = logsText() }
    @Suppress("DEPRECATION")
    private fun showLogoToast(message: Int, duration: Int) {
        val theme = this.theme
        val palette = NativeLook.palette(NativeLook.light(this))
        val row = LinearLayout(theme).apply {
            gravity = Gravity.CENTER_VERTICAL
            background = NativeLook.surface(theme, palette.surface, palette.line)
            setPadding(12.dp, 8.dp, 14.dp, 8.dp)
            addView(ImageView(theme).apply {
                setBackgroundResource(R.drawable.ic_ota_logo)
                clipToOutline = true
                setImageResource(R.mipmap.ic_launcher_foreground)
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(28.dp, 28.dp))
            addView(TextView(theme).apply {
                text = strings.getString(message)
                setTextColor(palette.text)
                maxWidth = 220.dp
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                marginStart = 8.dp
            })
        }
        Toast(this).apply {
            view = row
            this.duration = duration
            show()
        }
    }
    private fun copyLogs() {
        (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText(strings.getString(R.string.ota_log_clipboard_label), logsText()))
        showLogoToast(R.string.ota_logs_copied, Toast.LENGTH_SHORT)
    }
    fun showLogs() {
        if (logDialog?.isShowing == true) return
        val theme = this.theme
        val light = NativeLook.light(this)
        val palette = NativeLook.palette(light)
        logText = TextView(theme).apply {
            textSize = 12f; typeface = Typeface.MONOSPACE; setTextIsSelectable(true)
            setLineSpacing(2.dp.toFloat(), 1f); setPadding(12.dp, 12.dp, 12.dp, 12.dp)
        }
        val scroll = ScrollView(theme).apply {
            addView(logText)
            background = NativeLook.surface(theme, if (light) palette.surface2 else 0xFF111111.toInt(), palette.line)
        }
        val box = LinearLayout(theme).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp, 4.dp, 20.dp, 12.dp) }
        box.addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        val dialog = NativeLook.dialog(theme, strings.getString(R.string.ota_live_logs)).setView(box).create()
        // Copy is the first and primary action in the live log viewer (owner, 2026-11-26).
        val copy = NativeLook.button(theme, primary = true).apply { setText(R.string.ota_copy); setOnClickListener { copyLogs() } }
        val clear = NativeLook.button(theme, ghost = true).apply {
            setText(R.string.ota_clear); setOnClickListener { updater.engine.log.clear(); renderLogs() }
        }
        val close = NativeLook.button(theme).apply { setText(R.string.ota_close); setOnClickListener { dialog.dismiss() } }
        box.addView(actionRow(theme, copy, clear, close), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = 8.dp
        })
        logDialog = dialog
        dialog.setOnShowListener {
            renderLogs(); handler.postDelayed(refreshLogs,1000)
        }
        dialog.setOnDismissListener { handler.removeCallbacks(refreshLogs); logDialog = null; logText = null; if (!isDestroyed) refreshRecovery() }
        NativeLook.show(dialog, outlined = true)
    }
    override fun onDestroy() {
        if (safeMode) {
            super.onDestroy()
            return
        }
        handler.removeCallbacks(recoveryTick); recoveryDialog?.dismiss(); updateBanner?.clear()
        debugDialog?.setOnDismissListener(null); debugDialog?.dismiss(); refreshDebugSettings = null
        if (bridge != null) unregisterReceiver(screenReceiver)
        handler.removeCallbacks(refreshLogs); logDialog?.setOnDismissListener(null); logDialog?.dismiss()
        updater.onChange = null; updater.onToast = null
        super.onDestroy()
    }

    private companion object {
        const val STARTUP_PAGE = "ota-startup.html"
    }
}
