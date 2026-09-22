"""WordGuess - the Windows app.

Shows the web app in app/ inside a native window using the Edge WebView2 runtime that is already part
of Windows 11. Same pattern as Reckless Driving's wrapper, with two differences that come from this
game being a folder of files (modules, stylesheets, 40 MB of word data) rather than one HTML file:

  * It serves app/ from its OWN tiny local server instead of pywebview's built-in one, so that every
    response carries "Cache-Control: no-cache". The WebView2 profile is kept on purpose (it holds the
    saves), and it also holds the HTTP cache - after an update every file has the same URL as before,
    and without that header the browser serves last version's scripts from cache and the update seems
    not to have happened. (Reckless Driving solved this with ?v= on its single file; that cannot
    reach files loaded by `import` and fetch().) no-cache still lets the 27 MB of word data be
    answered with "304 Not Modified" - it only forbids using a copy without asking.
    It also fixes the MIME types itself: Python takes them from the Windows registry, where ".js" is
    sometimes text/plain, and a browser refuses to run a module served as text/plain.
  * The window is created hidden on a black background and shown only when the first screen has been
    drawn, so there is no white flash and no half-loaded frame.

SAVES. Everything - settings, saved games, statistics, badges - is in localStorage. What makes that
survive a restart AND an app update:
  * private_mode=False (pywebview's default True never writes localStorage to disk and deletes the
    profile on exit);
  * storage_path pinned to %LOCALAPPDATA%\\WordGuess - OUTSIDE the program folder an update replaces;
  * a FIXED port: localStorage is keyed to the origin, so a port that changed per launch would
    silently lose every save.

--selftest <file> starts the app hidden, checks the real page booted with the version that was
packaged, the bundled fonts work, localStorage is writable and both languages' word data loads, then
writes a one-line report. The build runs it and refuses to package a build that fails.
"""
import argparse
import ctypes
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time
import urllib.request
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import webview

APP = "WordGuess"
HTTP_PORT = 42027       # own port: the origin the saves belong to (Reckless Driving has 42017)
SELFTEST_PORT = 42028   # a build must never collide with, or read, a copy the player has open
WINDOW = dict(width=1100, height=800, min_size=(360, 480), background_color="#000000")


def app_root() -> Path:
    """The web app's folder: inside PyInstaller's bundle when frozen, else the project's app/."""
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent)) / "app"


def app_version() -> str:
    """Read from app/js/version.js - the one place the version is written."""
    return re.search(r"VERSION\s*=\s*'([^']+)'", (app_root() / "js" / "version.js").read_text("utf-8")).group(1)


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
                      ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8",
                      ".bin": "application/octet-stream", ".ttf": "font/ttf", ".otf": "font/otf"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):   # a windowed exe has no stderr to log to
        pass


class Server(ThreadingHTTPServer):
    # The default backlog is 5. Loading both languages at once is 8 parallel requests, and Windows
    # resets the ones that do not fit - which the page sees as "Failed to fetch".
    request_queue_size = 64


def serve(port: int) -> None:
    server = Server(("127.0.0.1", port), partial(Handler, directory=str(app_root())))
    threading.Thread(target=server.serve_forever, daemon=True).start()


def already_running() -> bool:
    """Is another copy of WordGuess (not just anything) answering on our port?"""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{HTTP_PORT}/js/version.js", timeout=1) as r:
            return b"VERSION" in r.read()
    except OSError:
        return False


def focus_existing_window() -> None:
    """A second copy could not bind the port; bring the first one forward instead."""
    try:
        user32 = ctypes.windll.user32
        handle = user32.FindWindowW(None, APP)
        if handle:
            if user32.IsIconic(handle):
                user32.ShowWindow(handle, 9)   # SW_RESTORE
            user32.SetForegroundWindow(handle)
    except Exception:
        pass                                    # a nicety; never fail the launch over it


def storage_path() -> Path:
    """Where WebView2 keeps the profile that holds localStorage. Never inside the program folder."""
    path = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local") / APP
    path.mkdir(parents=True, exist_ok=True)
    return path


def wait_ready(window, seconds: float) -> str | None:
    """The version the page reports once its first screen is drawn (app/js/main.js), or None."""
    for _ in range(int(seconds * 10)):
        try:
            ready = window.evaluate_js("document.documentElement.dataset.ready || null")
        except Exception:
            ready = None
        if ready:
            return ready
        time.sleep(0.1)
    return None


class Bridge:
    """What the page may ask the desktop app to do, reachable as window.pywebview.api.

    Only one thing so far: open a link in the real browser. A link cannot simply be followed here,
    because this window IS the browser - following it would replace the game with a web page and
    leave no way back. Android and a plain browser need none of this; they use window.open.
    """

    def open_url(self, url: str) -> bool:
        # never hand an arbitrary string to the shell: only ordinary web links, and only ours
        if not re.fullmatch(r"https://github\.com/[\w.\-/]+", url or ""):
            return False
        webbrowser.open(url)
        return True


def show_when_ready(window) -> None:
    wait_ready(window, 8)
    window.show()   # after 8 s show it regardless: a visible problem beats an invisible app


def run_selftest(window, report: Path) -> None:
    problems = []
    try:
        expected, version = app_version(), wait_ready(window, 20)
        if not version:
            problems.append("the app never finished loading (no ready signal)")
        elif version != expected:
            problems.append(f"page reports {version}, build is {expected} (loaded {window.evaluate_js('location.href')})")
        if version:
            fonts = ['800 16px "Barlow Condensed"', '700 16px "Barlow Condensed"', "400 16px Inter", "600 16px Inter"]
            missing = json.loads(window.evaluate_js(
                f"JSON.stringify({json.dumps(fonts)}.filter(f => !document.fonts.check(f)))") or "[]")
            if missing:
                problems.append("fonts not available: " + ", ".join(missing))

            probe = window.evaluate_js(
                "(() => { try { localStorage.setItem('__selftest','ok'); const v = localStorage.getItem('__selftest');"
                " localStorage.removeItem('__selftest'); return v; } catch (e) { return 'ERR:' + e.name; } })()")
            if probe != "ok":
                problems.append(f"localStorage is not writable ({probe}) - saves would not persist")

            # the word data: proves the 40 MB made it into the package and is served with usable types
            window.evaluate_js(
                "import('/js/engine.js').then(e => Promise.all([e.load('pl'), e.load('en')]))"
                ".then(([pl, en]) => { document.documentElement.dataset.words = pl.count + ',' + en.count; })"
                ".catch(e => { document.documentElement.dataset.words = 'ERR:' + e; }); 1")
            words = None
            for _ in range(300):                      # up to ~30 s
                words = window.evaluate_js("document.documentElement.dataset.words || null")
                if words:
                    break
                time.sleep(0.1)
            counts = [int(n) for n in words.split(",")] if words and not words.startswith("ERR") else []
            if len(counts) != 2 or min(counts) < 10000:
                problems.append(f"word data did not load ({words})")
    except Exception as e:                            # report it rather than vanish
        problems.append(f"self-test crashed: {e}")
    report.write_text("OK" if not problems else "FAILED: " + "; ".join(problems), encoding="utf-8")
    window.destroy()


def main() -> None:
    parser = argparse.ArgumentParser(prog=APP)
    parser.add_argument("--selftest", metavar="REPORT", help="run hidden, write a report, exit")
    args = parser.parse_args()

    if not args.selftest and already_running():
        focus_existing_window()
        return

    port = SELFTEST_PORT if args.selftest else HTTP_PORT
    try:
        serve(port)
    except OSError as e:
        ctypes.windll.user32.MessageBoxW(None, f"{APP} cannot start: port {port} is used by another program.\n\n{e}", APP, 0x10)
        return
    window = webview.create_window(APP, f"http://127.0.0.1:{port}/index.html", hidden=True,
                                   js_api=Bridge(), **WINDOW)

    if args.selftest:
        # Isolated on every axis: its own port, and a throwaway profile so a build can never read or
        # damage the player's real saves. Old throwaways are swept first: WebView2 keeps handles open
        # for a moment after the window is gone, so the delete below can lose that race.
        for old in Path(tempfile.gettempdir()).glob("wordguess-selftest-*"):
            shutil.rmtree(old, ignore_errors=True)
        tmp = tempfile.mkdtemp(prefix="wordguess-selftest-")
        try:
            webview.start(run_selftest, (window, Path(args.selftest)), private_mode=False, storage_path=tmp)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        webview.start(show_when_ready, (window,), private_mode=False, storage_path=str(storage_path()))


if __name__ == "__main__":
    main()
