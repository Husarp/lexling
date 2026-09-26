# Builds build\LexlingSetup.exe (and the program folder build\dist\Lexling).
#   1. read the version from app\js\version.js (the one place it is written) and sanity-check app\
#   2. Lexling.exe (PyInstaller, installer\lexling.spec)
#   3. self-test: the built exe starts HIDDEN and checks the app boots with that version, the bundled
#      fonts work, localStorage is writable and both languages' word data loads (skip: -NoSelfTest)
#   4. LexlingSetup.exe = the setup program with the program folder zipped inside it
# No admin needed, at build time or install time. Run from any folder:
#   & "<project folder>\scripts\build.ps1"
#
# Python: needs pywebview + pyinstaller. Uses this project's .venv when there is one, otherwise the
# Reckless Driving ("Car Crash") project's, which has both. To give Lexling its own:
#   python -m venv .venv ; .venv\Scripts\pip install pywebview pyinstaller pillow
param([switch]$NoSelfTest)
$ErrorActionPreference = "Continue"   # (PyInstaller writes progress to stderr; failures checked below)
$Root = Split-Path -Parent $PSScriptRoot
$Build = "$Root\build"
Set-Location $Root

$Py = @("$Root\.venv\Scripts\python.exe", "$(Split-Path -Parent $Root)\Car Crash\.venv\Scripts\python.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Py) { throw "No Python with pywebview + pyinstaller found - see the note at the top of this script" }
Write-Output "Python: $Py"

# 1. version + sanity
$version = (Select-String -Path "$Root\app\js\version.js" -Pattern "VERSION\s*=\s*'([^']+)'").Matches[0].Groups[1].Value
if (-not $version) { throw "Could not read VERSION from app\js\version.js" }
Write-Output "Building $version"
New-Item -ItemType Directory -Force "$Build\gen" | Out-Null
Set-Content -Path "$Build\gen\version.py" -Value "VERSION = `"$version`"" -Encoding ascii   # for the installer

foreach ($f in "data\index.json", "data\pl\vectors.bin", "data\en\vectors.bin", "data\pl\ac.txt", "data\en\ac.txt") {
    if (-not (Test-Path "$Root\app\$f")) { throw "app\$f is missing - build the word data first: node tools\build-data.mjs" }
}
# The game must not need the network for anything it shows (an inline SVG's xmlns name, www.w3.org/2000/svg,
# is a label that is never fetched).
if (Select-String -Path "$Root\app\index.html", "$Root\app\css\app.css" -Pattern "https?://(?!www\.w3\.org/2000/svg)" -Quiet) {
    throw "app\index.html or app\css\app.css references something on the network"
}

# 2. the game
# PyInstaller's rebuild check ignores the icon file, so when only assets\lexling.ico changes it
# re-uses the cached exe and ships the PREVIOUS icon - which happened once, and was only visible after
# installing. Dropping the cached exe re-runs the (fast) linking step; the analysis cache is kept.
Remove-Item "$Build\work\Lexling\Lexling.exe", "$Build\work\Lexling\EXE-00.toc" -ErrorAction SilentlyContinue
& $Py -m PyInstaller --noconfirm --log-level WARN --distpath "$Build\dist" --workpath "$Build\work" installer\lexling.spec
if ($LASTEXITCODE) { throw "Building the game failed" }

# 3. self-test
if (-not $NoSelfTest) {
    $report = "$Build\selftest.txt"
    Remove-Item $report -ErrorAction SilentlyContinue
    Start-Process "$Build\dist\Lexling\Lexling.exe" -ArgumentList "--selftest", "`"$report`"" -Wait
    $result = (Get-Content $report -Raw -ErrorAction SilentlyContinue)
    if (-not $result -or -not $result.StartsWith("OK")) { throw "Self-test failed:`n$result" }
    Write-Output "Self-test: $($result.Trim())"
}

# 4. the installer, with the program folder zipped inside it
$zip = "$Build\payload.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive -Path "$Build\dist\Lexling\*" -DestinationPath $zip -CompressionLevel Optimal -ErrorAction Stop

& $Py -m PyInstaller --noconfirm --log-level WARN --onefile --noconsole --name LexlingSetup `
    --icon "$Root\assets\lexling.ico" --paths "$Build\gen" `
    --add-data "$zip;." --add-data "$Root\assets\lexling.ico;." `
    --distpath $Build --workpath "$Build\work-setup" --specpath "$Build\work-setup" installer\setup.py
if ($LASTEXITCODE) { throw "Building the installer failed" }

$size = "{0:N0}" -f ((Get-Item "$Build\LexlingSetup.exe").Length / 1MB)
Write-Output "Built $Build\LexlingSetup.exe ($size MB)"

# 5. a note saying WHICH version these files came from. A build folder can say when it was made but
#    never what it is, and that is the one thing the dev-status dashboard cannot work out on its own.
#    Written last, so it only ever exists after a build that actually finished.
$artifacts = @()
foreach ($a in @(@("LexlingSetup.exe", "Windows"), @("Lexling-debug.apk", "Android"))) {
    $path = "$Build\$($a[0])"
    if (Test-Path $path) { $artifacts += @{ name = $a[0]; kind = $a[1] } }
}
@{ version = $version; builtAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss"); artifacts = $artifacts } |
    ConvertTo-Json -Depth 4 | Set-Content "$Build\BUILT.json" -Encoding UTF8
