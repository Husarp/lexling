# Builds build\Lexling-release.apk - signed with Lexling's own key - from the same app\ folder the
# desktop build uses. The key is found through android\keystore.properties (git-ignored; README).
#   & "<project folder>\scripts\build-android.ps1"             signed APK, installable by sideload
#   & "<project folder>\scripts\build-android.ps1" -DebugBuild  build\Lexling-debug.apk (debug key)
#   & "<project folder>\scripts\build-android.ps1" -Install  …and push it to a connected phone
#
# Everything comes from this PC: the Android SDK under %LOCALAPPDATA%\Android\Sdk and the JDK that
# ships inside Android Studio. Neither has to be on PATH - they are pointed at here - and no part of
# the toolchain is needed to PLAY the game, only to package it.
param([switch]$Install, [switch]$DebugBuild)
$Release = -not $DebugBuild   # since 0.22.5 the signed APK is the normal build (owner)
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Sdk = "$env:LOCALAPPDATA\Android\Sdk"
$Jdk = "C:\Program Files\Android\Android Studio\jbr"
Push-Location $Root                      # …and Pop-Location at the end: don't leave the caller in android\
try {

if (-not (Test-Path $Sdk)) { throw "No Android SDK at $Sdk - install it from Android Studio" }
if (-not (Test-Path "$Jdk\bin\java.exe")) { throw "No JDK at $Jdk - Capacitor 7 needs Java 21" }
if (-not (Test-Path "$Root\node_modules\@capacitor\cli")) { throw "Run: npm install" }
foreach ($f in "data\index.json", "data\pl\vectors.bin", "data\en\vectors.bin") {
    if (-not (Test-Path "$Root\app\$f")) { throw "app\$f is missing - build the word data first: node tools\build-data.mjs" }
}
$env:JAVA_HOME = $Jdk
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$version = (Select-String -Path "$Root\app\js\version.js" -Pattern "VERSION\s*=\s*'([^']+)'").Matches[0].Groups[1].Value
Write-Output "Building Lexling $version for Android"

# 1. copy app\ into the native project (android\app\src\main\assets\public)
& npx cap sync android
if ($LASTEXITCODE) { throw "cap sync failed" }

# 2. the APK itself
# an unsigned APK cannot be installed at all - stop here rather than build one
if ($Release -and -not (Test-Path "$Root\android\keystore.properties")) {
    throw "android\keystore.properties is missing, so the APK cannot be signed - see README (Android). -DebugBuild makes a debug APK."
}
$task = if ($Release) { "assembleRelease" } else { "assembleDebug" }
Set-Location "$Root\android"
& .\gradlew.bat $task --no-daemon
if ($LASTEXITCODE) { throw "Gradle $task failed" }

$built = Get-ChildItem "$Root\android\app\build\outputs\apk\*\*.apk" | Sort-Object LastWriteTime | Select-Object -Last 1
$out = "$Root\build\Lexling-$(if ($Release) { 'release' } else { 'debug' }).apk"
Copy-Item $built.FullName $out -Force
Write-Output ("Built $out ({0:N1} MB)" -f ($built.Length / 1MB))

# Record which version this came from, the same note scripts\build.ps1 writes, so the dev-status
# dashboard stays right whether the APK or the installer was built last.
$artifacts = @()
foreach ($a in @(@("LexlingSetup.exe", "Windows"), @("Lexling-debug.apk", "Android"), @("Lexling-release.apk", "Android"))) {
    if (Test-Path "$Root\build\$($a[0])") { $artifacts += @{ name = $a[0]; kind = $a[1] } }
}
@{ version = $version; builtAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss"); artifacts = $artifacts } |
    ConvertTo-Json -Depth 4 | Set-Content "$Root\build\BUILT.json" -Encoding UTF8

if ($Install) {
    $adb = "$Sdk\platform-tools\adb.exe"
    $devices = (& $adb devices | Select-String "\tdevice$")
    if (-not $devices) { Write-Output "No phone connected (USB debugging on?) - APK left in build\" }
    else { & $adb install -r $out; Write-Output "Installed on the connected phone" }
}
} finally { Pop-Location }
