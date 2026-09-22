# WordGuess — Development Plan

Forward-looking backlog only — full history lives in `CHANGELOG.md`.
Game/engine design decisions live in `DESIGN.md`.

## Status legend
- [ ] Not started
- [~] In progress
- [x] Done

---

## M7 — Feedback from playing the installed build (2026-09-22)
- [x] **Spelling-tolerant suggestions**: typing `rz` for `ż`, `u` for `ó`, `om` for `ą`, `en` for `ę`,
      `h` for `ch` should still find the word. Setting "better suggestions", on by default.
- [x] Game picker: show the **closest word** in each game box, not just its rank.
- [x] Sharpshooter: drop "no win yet", label reads "win in less than X moves"; tier squares show bare
      numbers (no ≤).
- [x] Badge descriptions: Wordsmith = "number of unique words you have typed", Typist = "letters typed
      across all games".
- [x] Replace the **win-streak** stat with **average words per won game** (one decimal).
- [x] Drop the "unique" sub-line from the *words guessed* stat — the Wordsmith badge already shows it.
- [x] Remove the badge legend line ("filled square = unlocked tier …").
- [x] Top bar: brand centred, back button on the left (only when there is one); **Esc = back**.
- [x] **Theme colour**: a setting that replaces the orange accent with another colour.
- [x] **Categories** reworked to 20 (objects/places dropped; household, clothing, tools, tech,
      vehicles, buildings, weather, body, jobs, school, science, sport, music, feelings, verbs added).
- [x] Badges rebuilt to design 1b "Tier ladder" + the design's key states; freshly unlocked tier
      wears the accent until seen.
- [x] "Hardest word beaten" statistic: difficulty = rarity + isolation, baked into the word data.
- [x] The interface language follows the game language until one is chosen by hand.
- [ ] Category accuracy is good but not perfect (a few strays: *night* in food, *wearing* in clothing).
      Worth another seed pass after playing.

## M8 — Badges vs categories — DONE 2026-09-22
Measured first: by the difficulty score, category secrets are **rarer** than uncategorised ones
(PL animals 69 vs all 46), because categories reach to rank 30 000 while "All" stops at 12 000. But
that score does not know the player was *told the category*, and that hint shrinks the search from
6 207 words to ~150 — which is what makes a category game quick to win.
- [x] Speed/difficulty badges and the hardest-word stat count only category-free, non-friend games.
      Wordsmith and Typist keep counting everything: they measure typing, not winning.
- [x] Marathon counts **active** play only (typing within the last minute, window visible) - and the
      time-in-game stat now uses the same clock.
- [x] Five new badges: Giant Slayer (hardest word beaten), Deep Cut (wins on a word of difficulty 70+),
      Explorer (categories won in, top tier = all 21), Marathon (active hours), Polyglot (wins in both
      languages, counted in the weaker one).
- [x] Giant Slayer tiers set from the data (45/55/65/72/79): uncategorised secrets top out at 82 PL /
      85 EN, so the 85 and 95 tiers I first proposed were unreachable.
- [ ] Old saves: a Sharpshooter best or hardest word earned in a category game before this rule stays
      on record. Offer a one-off reset of those two counters if it bothers the owner.

## M9 — Making it playable — DONE 2026-09-22
Owner's report: too hard even on easy inside a category. Measured first (DESIGN.md §2).
- [x] Difficulty became an **absolute band** on the word's difficulty score, not a slice of the
      category, with a 20-word floor for sparse categories.
- [x] New **Relaxed** level: words everybody knows.
- [x] **Hints** — half the rank of your best guess, different part of speech, common words only, never
      the secret's own family; unlimited; excluded from speed and difficulty badges.
- [x] The new-game readout reflects the real pool for the chosen category + difficulty.
- [x] Text-fitter drops letter-spacing before shrinking (four difficulty buttons now fit at 320 px).
- [ ] Not built: opening-word suggestions (owner: you can already type any word).
- [ ] Worth watching while playing: whether Relaxed is now too easy, and whether the first hint
      (rank ~500 when nothing has landed) is the right starting distance.
- [x] **Hints walked backwards** (reported from a real game, fixed 2026-09-22 in 0.13.4). A hint must
      now be strictly closer than the best guess so far; without that ceiling the ladder reversed
      once the words near the target were used up.
- [ ] Open, now that the ladder is monotonic: the step is a straight halving, so from rank 12 you
      get roughly two more hints before they stop. Smaller steps late on would give more of them —
      worth deciding after playing a few games.

## M10 — Reported from the phone — DONE 2026-09-22
- [x] The game's reply ("already guessed", "not a word") was printed under the field, where the
      suggestion list drops over it — so Zgadnij looked broken. Moved above the field.
- [x] The suggestion list ranked a corrected spelling above the one typed (`płazy` → `plaży` first,
      because both fold to *plazy*). The written spelling now always leads.
- [x] An ambiguous form was offered once per meaning (`płazy` → *płaz* AND → *płaza*). One row per
      spelling now, chosen by: own dictionary word → can be the secret → shorter base (unless 10×
      rarer) → frequency. `resolve()` uses the same choice, so Enter always plays the top row.
- [ ] Follow-up for the next data rebuild: junk dictionary entries that win the shorter-base test —
      *okular* beating *okulary*, *czerp* beating *czerpać*, *głup*, *strzel*, *zerwa*. Add them to
      `NEVER_SECRET` / drop them from the vocabulary in `tools/seeds.mjs`.

## M11 — Categories that mean what they say — DONE 2026-09-22
Owner, playing Polish: the answer in Animals was `zwierzak` ("animal"), and the category was full of
diminutives and things that are not animals.
- [x] `NOT_IN` blocklist per category for words about a category rather than in it.
- [x] Diminutives dropped automatically, with the ending stripped first so Polish stem changes are
      caught (ryba→rybka). Restricted to real diminutive endings after a loose version deleted the
      English compounds `rainbow`, `sunshine`, `snowfall`.
- [x] Word data rebuilt for both languages. Polish Animals 150 → 94, all of them animals.
- [x] A one-line description per category on the new-game screen, in both languages.
- [x] Seed pass for Food and Nature (0.14.2). The gap was not missing vocabulary but missing tags:
      common words sit near several categories and so win none, and the categoriser drops them. Naming
      them as seeds fixed it — Nature 71 → 147, Food 228 → 296, Animals 94 → 110 (the fish).
- [ ] Still open: the same pass for Body (-32) and School (-31), and `kiwi` really is absent from the
      Polish vocabulary — that one needs the word list widened, not a seed.
- [ ] Still open: whether group words (`ptak`, `ryba`, `owad`) should be answers in Animals. Kept for
      now — the owner said kinds of animals are fair.

## OPEN QUESTIONS (waiting on owner)
- [ ] Polish badge names — current picks: Wordsmith → **Mistrz słów**, Typist → **Skryba**,
      Sharpshooter → **Snajper**. Change if you prefer others.
- [ ] After a give-up / win: also show the true top-10 closest words ("what was rank 1?")?
      Contexto does; not in the design, so not built.
- [ ] Badge tier thresholds (placeholder numbers in DESIGN.md §6) — tune later.
- [ ] Final game name (working title: WordGuess).

## ANSWERED (2026-09-21)
- [x] Guess boxes: **top 5**; newest guess always visible; **full history** included
      (expander below the boxes).
- [x] Top badge tier: **Amethyst**.
- [x] Achievements & statistics share one screen; stats: words guessed, letters typed,
      games played/won/given up, time in game, best win, streaks — DESIGN.md §6.
- [x] Design handoff: design agent delivers self-contained HTML+CSS per screen with dummy
      data; ported ~1:1 into the app — DESIGN.md §7. Current: `design/v2/handoff/`.
- [x] Score = **absolute rank** (1 = closest, can go into the thousands), not 1–6 buckets.
- [x] Inflected forms collapse to base word; derived words (parking/park) stay separate —
      DESIGN.md §2a.
- [x] Fully offline; **both PL and EN bundled in the app**; size budget ≤ 100 MB (actual: ~40 MB app,
      ≈ 50 MB installer / ≈ 35 MB APK estimated).
- [x] Download of the fastText vectors approved (2026-09-21); real word data built.
- [x] Android built from the **terminal** (Capacitor CLI + Gradle), tools already on this PC.
- [x] Badges: unique words typed, letters typed, win in ≤ X guesses; tiers
      Bronze/Silver/Gold/Diamond/Amethyst — DESIGN.md §6.
- [x] Rendering quality is a hard requirement (Lockdown's load glitches = anti-goal);
      responsive from day one incl. Android split-screen — DESIGN.md §4a.

## M1 — Data pipeline (Node, `tools/build-data.mjs`) — DONE 2026-09-21
Real data is in `app/data/` (40 MB): 60 000 PL + 41 189 EN words, 383k + 32k inflected forms.
Details and the measurements behind every choice: DESIGN.md §2.
- [x] Output format defined and consumed by the app (DESIGN.md §2 "Data files").
- [x] Download + verify fastText `cc.en.300` and `cc.pl.300` (owner approved; sizes byte-exact).
- [x] Pipeline in Node, zero dependencies (no `python` on PATH on this PC).
- [x] Vocab curation from the Hunspell dictionaries shipped with LibreOffice (sjp.pl / SCOWL):
      lower-case base words with a vector, frequency-ordered; parts of speech; secret pool.
- [x] int8 quantization. PCA → 128 dims **dropped**: 40 MB total fits the budget, full vectors rank better.
- [x] OP words: measured (650 PL / 218 EN unfairly advantaged words) and fixed with a per-word
      z-score against the secret pool (→ 0 / 0). The originally planned λ-penalty did nothing.
- [x] Category tagging (seed lists + second round with confident members).
- [x] Inflection→base-word lookup from the dictionaries' affix rules + English irregular table;
      listed forms folded into their base; noun-first priority for ambiguous spellings.
      Inflection only — derivation (parking/park, teach/teacher) is NOT collapsed.
- [x] Autocomplete list shipped pre-sorted in a compact format (`ac.txt` + `ac.bin`).
- [x] Sanity checks printed by every build (pies↔kot close, pies↔śruba far, …).
- [ ] British spellings (`colour`, `centre`) are unknown words — add `en_GB` base words if wanted.
- [ ] Polish comparatives/superlatives are separate words (`najszybszy` ≠ `szybki`): the
      dictionary does not link them. Would need a real morphological resource (PoliMorf).
- [ ] Review category precision and the secret pool by playing; grow `NEVER_SECRET` in
      `tools/seeds.mjs` whenever a bad secret shows up.

## M2 — Scoring engine (JS, `app/js/engine.js`)
- [x] Load vectors/vocab; cosine similarity with hubness correction.
- [x] Per-game full-vocab ranking; guess score = absolute rank (1-based, secret excluded).
- [x] Rank → progress percent (logarithmic) + continuous cold→warm→mid→hot color mapping.
- [x] Form→lemma mapping on input; "typed X → scored Y" info carried with each guess.
- [x] Win detection incl. inflected forms.
- [x] Verified with real data in both languages (DESIGN.md §2); hubness is a z-score now, no λ.
- [ ] Game start costs ~0.3 s of ranking on a PC — measure on a real phone in M6; move to a Web
      Worker if it is noticeable there.

## M3 — Game UI shell
- [x] Implement the owner's handoff design **exactly as delivered** (markup + CSS ported 1:1;
      per-screen CSS only prefixed with a screen scope; one design omission fixed — the
      `<ol>` guess list kept the browser's 40 px indent, so boxes didn't align with the input).
- [x] Main menu (Play / Achievements / Settings), PL/EN UI strings; PL · EN switch in top bar.
- [x] Full UI localisation: **every** label, button, heading, badge name and stat name
      switches with the language (Play → Zagraj, etc.), incl. Polish plural forms.
- [x] Text-fit guarantee (`js/fit.js`): shrink font → drop letter-spacing → wrap; never eats
      into button padding. Verified: every screen × EN/PL × 320×480, 360×400 (split-screen),
      360×800, 768×1024, 1280×720, 1920×1080 → zero overflow/clipping.
- [x] Game picker: list saves, new game, rename (inline), delete (confirm), resume.
- [x] New-game settings sheet: language, category, length band + histogram, difficulty, friend mode.
- [x] Game screen: input + autocomplete dropdown; top-5 guess boxes with animated
      progress-bar fills; newest-guess box; full-history expander; give up / save & exit.
- [x] Autocomplete: prefix search over vocab + forms, diacritic-insensitive for Polish.
- [x] Autosave after every guess; saves survive reload. (Storage = WebView localStorage;
      pinning it outside the install dir is part of M5/M6 wrappers.)
- [x] No white flash / layout shift on load: page colour set before CSS, theme applied before
      first paint, fonts bundled + preloaded, first render waits for fonts.
- [ ] Live drag-resize check in the real desktop window (needs the M5 wrapper; the browser
      preview here was hidden, so only fixed sizes could be measured).
- [ ] Android safe-area insets (notch / gesture bar) — check on device in M6.

## M4 — Achievements & stats
- [x] Lifetime stats record; time-in-game tracking (only while the game screen is visible).
- [x] Combined screen: statistics block + badge grid, per the design.
- [x] Badge engine: Wordsmith (unique words), Typist (letters), Sharpshooter (win in ≤ X
      guesses); tiers Bronze→Amethyst. Friend-mode games don't count toward best win/streak.
- [ ] "Badge unlocked" notification in-game (not in the design — ask owner / design agent).

## M5 — Desktop packaging + updates (Windows first)
- [x] pywebview wrapper `desktop/main.py` (pattern from Reckless Driving: fixed port 42027,
      private_mode=False, saves in `%LOCALAPPDATA%\WordGuess` outside the install dir, single
      instance); own local server with `Cache-Control: no-cache` so updates are never served stale;
      window hidden on black until the first screen is drawn (~3.9 s cold start on this PC).
- [x] PyInstaller spec + `scripts/build.ps1` + `WordGuessSetup.exe` (install / update / uninstall,
      per-user, no admin), ported from the Reckless Driving installer. Build self-test: version,
      fonts, localStorage, both languages' word data. Result: 52 MB installer, 65 MB installed.
- [x] App icon: concept **2b "Caret", black** from `WordGuess Icon Ideas.dc.html`
      (`tools/make-icon.py` → `assets/wordguess.ico` + `wordguess-1024.png`), verified against the
      design's own CSS rendering.
- [ ] **Owner: run `build\WordGuessSetup.exe` once** — the install/update/uninstall clicks and the
      shortcuts were not exercised by me (only the payload extraction + the extracted app's
      self-test were). Also check live drag-resizing of the window (M3 leftover).
- [ ] Own `.venv` for WordGuess (the build currently borrows the Car Crash project's, which has
      pywebview + pyinstaller; creating one needs a pip download).
- [~] GitHub Releases update check — UI + check logic done in Settings; set `REPO` in
      `app/js/version.js` once the GitHub repository exists (button is disabled until then).
- [~] Git — repository initialised 2026-09-22, branch `main`, first commit `1314ad9` (152 files,
      41.5 MB; `tools/raw`, `build/`, `node_modules/` and the Gradle output stay out). `.gitattributes`
      forces LF and marks `app/data/**` binary — a CRLF checkout would put a stray `\r` on every word
      in `ac.txt` and no guess would ever match. **Owner chose: private repository.**
      Waiting on: an empty private repo on GitHub (its URL), then `git remote add` + push.
- [ ] "Open saves folder →" link in About (design has it; needs the wrapper's API).
- [ ] **Credits in About before distributing**: the word data derives from fastText (CC BY-SA 3.0:
      attribution + share-alike), the sjp.pl and SCOWL dictionaries and WordNet — table in README.
      Owner to check the terms if the game is ever sold.
- [ ] Linux + macOS builds (pywebview; packaging pass per-OS — later, after Windows works).

## M6 — Android — DONE 2026-09-22 (first build)
- [x] Capacitor project wrapping `app/`; `scripts\build-android.ps1` builds
      `build\WordGuess-debug.apk` (34.5 MB, target SDK 35) from the terminal, using the SDK in
      %LOCALAPPDATA% and the JDK inside Android Studio.
- [x] Word data verified inside the package (pl 17.2 MB + en 11.8 MB vectors, fonts, scripts).
- [x] Launcher icons + splash screens for every density, dark variants included.
- [x] Keyboard-open layout: `[data-kb]` compacts the game screen (top bar and status row out,
      tighter spacing, sticky input). At 360×370 the field, the suggestions and 5 of 6 boxes fit.
- [x] Safe-area insets (notch / gesture bar) — CSS in place, verified with simulated insets.
- [x] Status and navigation bars hidden while playing; the app draws into the display cutout so the
      page (not the system) decides what sits under the camera.
- [ ] **Confirm on the phone after the next build**: that the cutout really is reported to the page as
      `env(safe-area-inset-top)` — if it is not, the centred brand goes back under the camera and the
      fix is the @capacitor-community/safe-area plugin.
- [ ] **Still to measure on the phone**: how long 27 MB of Polish data takes to load, and whether the
      rank pass (~0.3 s on a PC) is noticeable.
- [ ] Release build: signing key + `assembleRelease` (the script already takes `-Release`).
- [ ] Decide whether the APK should carry both languages or fetch the second on demand.
