# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the game itself -> build\\dist\\Lexling\\Lexling.exe.

One-folder (not one-file): a one-file build would unpack ~75 MB (runtime + 40 MB of word data) to a
temp folder on every launch. The folder is zipped into the installer afterwards, so the player
never sees it either way.

pywebview's WebView2 interop DLLs and pythonnet are pulled in by the bundled hooks (hook-webview /
hook-clr / hook-clr_loader), so nothing needs listing by hand here.
"""
from pathlib import Path

ROOT = Path(SPECPATH).parent

a = Analysis(
    [str(ROOT / 'desktop' / 'main.py')],
    pathex=[str(ROOT / 'desktop')],
    binaries=[],
    datas=[(str(ROOT / 'app'), 'app')],       # the whole web app: pages, scripts, fonts, word data
    hiddenimports=[],
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'pytest', 'PIL'],    # used by the installer/tools, never by the game
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Lexling',
    debug=False,
    strip=False,
    upx=False,
    console=False,                            # no console window behind the game
    icon=str(ROOT / 'assets' / 'lexling.ico'),
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='Lexling',
)
