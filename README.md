# Lexling

*Called WordGuess until 0.18.0 — see "The rename" below.*

A "guess the secret word" game based on **meaning**, not letters. The engine picks a secret
word (randomly, or a friend types one in for you). You type guesses; every guess gets a
**rank score** telling you how close in *meaning* it is to the secret word — 1 means it's the
closest word there is, 6547 means there are 6546 closer ones. Your top guesses are shown as
boxes with color-fill progress bars (red = cold, green = hot), so you can steer toward the
answer. Win by typing the exact word (any inflected form counts).

A second game, **Letters**, sits next to it in the same app: find a hidden word letter by letter,
with green / yellow / grey feedback — like Wordle, but a new random word every game, as many games
as you like, with the word length (3–13, or any), the number of tries (or unlimited), category,
difficulty and Polish letters chosen by the player. Each game has its own card on the menu and its
own list of games in progress. A third mode (a Scrabble-like game) is planned.

Playable in **Polish and English** (both the UI and the word libraries).

## How it works (short version)

- Word closeness is computed from **word embeddings** (precomputed word vectors, fastText),
  shipped with the game as a compact binary file — the game is **fully offline**.
- The whole game is one **HTML/JS web app** (like Reckless Driving). On desktop it runs inside
  a native window via **pywebview / WebView2**; on Android the same app is packaged with
  **Capacitor** into an APK.
- Windows gets the same **Setup.exe install/update system** as Lockdown and Reckless Driving:
  run the setup, it installs/updates in place, saves live outside the program folder and are
  never touched by an update. Update check asks GitHub for the latest release.

## Features

- Random secret word, or "friend mode" (a friend secretly types the word).
- **20 categories** (animals, food, household, tools, nature, jobs, science, verbs, ...), a secret-length band (short / medium /
  long / any, shown against a histogram of the real word lengths) and a difficulty setting.
- **Autocomplete / suggestions** while typing, restricted to words the game knows
  (with diacritic-insensitive matching for Polish — typing `zolw` finds `żółw`).
- Multiple games at once: save, resume, rename, give up (reveals the word).
- Statistics for each game (no achievements, since 0.23.0).
- Polish + English, switchable.
- **Letters mode**: one box per letter, its own on-screen keyboard (keys coloured by what the guesses
  showed; tap a tile to edit it; the phone's keyboard as an option), a strip of what you already know
  (letters in place, yellow letters still to place), free hints (one letter in its place, at most half
  the word), and its own statistics.
- **Connect mode** (Połącz): drag across a circle of 4–10 letters to fill a small crossword; other real
  words are bonus words; free hints, a random letter at a time, at most half of any word. Its own statistics.
- **No scores anywhere** (since 0.29.0): the games are for fun; statistics show how you are doing,
  hints used included.
- **Tiles** (Kafelki), a Scrabble-like game against the computer, is planned: the menu shows it as "soon".

## Run it (development)

Needs only Node.js. From the project folder:

```bash
node tools/serve.mjs
```

then open http://127.0.0.1:5173. (A server is required — ES modules and `fetch()` don't work
from `file://`.)

> **Current state (v0.17.0):** both games — Guess and Letters — fully playable in English and Polish
> on the real word data (60 000 Polish + 41 158 English words), with a **Windows installer** and an
> **Android APK**. What is still open is in [PLAN.md](PLAN.md).

The Letters and Connect rules have tests against the real data: `node tools/test-letters.mjs` and
`node tools/test-connect.mjs`.

**Size:** Windows installer 52 MB, 65 MB installed; Android APK 34.5 MB (40 MB of it is the
game, 39 MB word data).

## The rename (0.18.0)

The app was called **WordGuess** until 0.18.0. On Windows, installing Lexling over WordGuess is an
ordinary update: the setup recognises the old install, removes the old program and shortcuts, and
moves the saves folder `%LOCALAPPDATA%\WordGuess` to `%LOCALAPPDATA%\Lexling` whole (the game does
the same on its first start, whichever comes first). On Android the app ID changed to
`com.husarp.lexling`, so Android sees a new app: it installs next
to the old one, and games saved in the old app do not carry over. The GitHub repository moved to
`Husarp/lexling`; GitHub forwards the old address, so older versions' update check still works.

## Install on Windows / ship an update

```powershell
& ".\scripts\build.ps1"
```

produces `build\LexlingSetup.exe` (~3 minutes). Run it: it installs for your account only (no
admin prompt) into `%LOCALAPPDATA%\Programs\Lexling`, adds Start-menu and desktop shortcuts and an
"Apps & features" entry. **The same exe is the updater**: run a newer one and it offers *Update*
and replaces the program in place. Saved games and statistics live in
`%LOCALAPPDATA%\Lexling` — outside the program folder — so updates never touch them; uninstalling
keeps them unless you tick the box.

During every build the script starts the freshly built game hidden and refuses to package it
unless it boots with the right version, its fonts work, saves are writable and both languages'
word data loads. To bump the version, change it in `app/js/version.js` only.

The build needs Python with `pywebview` and `pyinstaller`: it uses `.venv` in this folder if there
is one, otherwise the Car Crash project's.

## Build the Android APK

```powershell
& ".\scripts\build-android.ps1"             # build\Lexling-release.apk, signed with Lexling's key
& ".\scripts\build-android.ps1" -Install    # …and push it to a connected phone
& ".\scripts\build-android.ps1" -DebugBuild # build\Lexling-debug.apk, signed with the debug key
```

**The release key.** The APK is signed with Lexling's own key (since 0.22.5; releases carry it),
which lives outside the repository; `android/keystore.properties` (git-ignored, never commit it) says
where it is and holds its password. **Back up both the key file and the password.** Android installs an update only over an app
signed with the same key: without them no update can ever be signed again, and every player would
have to uninstall — losing their saves — to move to a newly signed Lexling. Without the file the script
stops (an unsigned APK cannot be installed); `-DebugBuild` still works.

Needs the Android SDK (`%LOCALAPPDATA%\Android\Sdk`) and Android Studio's bundled JDK 21 — the script
points at both, so neither has to be on PATH — plus `npm install` once for the Capacitor CLI. The APK
wraps the very same `app/` folder as the desktop build; `cap sync` copies it into `android/`.

## Rebuilding the word data

`app/data/` is generated — never edit it by hand. It only needs rebuilding after changing
something in `tools/` (most likely the never-secret list or the category examples in
`tools/seeds.mjs`):

```bash
node tools/build-data.mjs
```

Takes ~2 minutes and prints a report (category samples, weakest category members, most generic
words, sanity checks such as *pies → kot close, śruba far*). It needs:

- `tools/raw/cc.pl.300.vec.gz` and `tools/raw/cc.en.300.vec.gz` (2.6 GB, git-ignored) from
  https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/ ;
- LibreOffice installed with the Polish and English dictionaries (default location
  `C:/Program Files/LibreOffice/share/extensions/`, override with the `WG_DICTS` variable).

## Data sources & licences

The shipped word data is *derived from* these sources — keep this list in the game's credits
when it is distributed (to-do in PLAN.md M5). Not legal advice; check the terms before selling.

| Source | Used for | Licence |
|---|---|---|
| fastText `cc.pl.300` / `cc.en.300` (Facebook AI Research) | word vectors | CC BY-SA 3.0 — attribution + share-alike |
| sjp.pl Polish Hunspell dictionary (M. Futrega) | Polish words + inflection | GPL / LGPL / MPL / Apache 2.0 / CC SA (your choice) |
| SCOWL `en_US` Hunspell dictionary | English words + inflection | permissive (BSD-like), attribution |
| WordNet-based LibreOffice thesaurus | English parts of speech | WordNet licence (permissive, attribution) |
| Barlow Condensed, Inter | fonts | SIL OFL (licence files in `app/fonts/`) |

## Licence

**All rights reserved** — © 2026 Husarp. The code is public to read, and the releases are free to
download and play, but the game may not be copied, changed, shared, sold or built upon without
written permission. The exceptions are the third-party parts above, which keep their own licences:
the word data derived from fastText stays under CC BY-SA 3.0, and the fonts under the SIL OFL. Full
terms in [LICENSE](LICENSE).

## Project layout

```
app/                the game itself — single-page app, no build step, no dependencies
  index.html        shell: no-flash boot (page colour + theme before first paint, fonts preloaded)
  css/app.css       design tokens + shared styles (verbatim from the design) + per-screen styles
  js/main.js        boot + hash router (#/games, #/game/<id> … so Back works on Android)
  js/screens.js     menu, game picker, new game (both modes), statistics, settings
  js/game.js        the Guess game screen (input, autocomplete, guess boxes, history, win / give-up)
  js/letters-game.js  the Letters game screen (letter boxes, hidden input, reveal, win / loss, copy result)
  js/letters.js     Letters rules: feedback, the keyboard and hints, which words can be hidden and how hard
  js/engine.js      word data loading, rank scoring, form→lemma, autocomplete, secret picking
  js/store.js       settings, saved games, lifetime stats (localStorage)
  js/i18n.js        every UI string in EN + PL, plural rules, number/time formatting
  js/fit.js         text-fit guarantee (long labels shrink / wrap, never overflow)
  js/sound.js  js/ui.js  js/version.js
  fonts/            Barlow Condensed + Inter (bundled, OFL licences alongside)
  data/             generated word data (build output, not hand-edited)
design/v2/handoff/  the design agent's six screens — the visual source of truth (v1 kept in design/v1/)
design/letters/     the Letters mode handoff (six more screens, NOTES.md, strings.json). design/ is git-ignored
tools/              serve.mjs (dev server) and the word-data pipeline:
  build-data.mjs    the pipeline itself — every tuning number lives at its top
  lexicon.mjs       base words, parts of speech, inflected forms (Polish + English rules)
  hunspell.mjs      Hunspell .aff/.dic reader · fasttext.mjs  streaming .vec.gz reader + caches
  vecmath.mjs       normalise / centre · seeds.mjs  category examples + never-secret stoplist
  raw/              downloaded fastText vectors + caches (2.6 GB, git-ignored, build-time only)
desktop/main.py     the Windows app: WebView2 window + local server around app/ (saves, caching, self-test)
installer/          setup.py (LexlingSetup.exe: install / update / uninstall), lexling.spec (PyInstaller)
scripts/            build.ps1 (Windows installer) · build-android.ps1 (APK) — both output to build/
android/            Capacitor project: manifest, launcher icons; app/ is copied in by `cap sync`
assets/             lexling.ico / .png / -1024.png — the app icon, drawn by tools/make-icon.py
                    (concept 2b "Caret" black from "WordGuess Icon Ideas.dc.html")
PLAN.md             forward-looking backlog (what's next)
CHANGELOG.md        full history of every change
DESIGN.md           game & engine design — scoring, data format, OP-word handling, screens
```
