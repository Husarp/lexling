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
- [x] Seed pass for Body (80 → 94) and School (52 → 136, now ahead of English) — 0.15.0.
- [x] `kiwi` added (0.15.0). It was never absent from the dictionary: the lexicon drops flagless
      entries below rank 20 000 as stray inflected forms, and indeclinable loanwords look exactly
      like those. They are now listed by hand in `INDECLINABLE` and kept as nouns.
- [ ] `salami` is still missing — flagless like `kiwi` and listed, but it does not reach the
      vocabulary, so something else drops it. Worth a look if another loanword turns up missing.
- [ ] Still open: whether group words (`ptak`, `ryba`, `owad`) should be answers in Animals. Kept for
      now — the owner said kinds of animals are fair.

## Licence — DONE 2026-09-24

- [x] All rights reserved (asked 2026-09-24): `LICENSE`, a README section, and "© 2026 Husarp · All
      rights reserved" in the Settings footer, both languages — 0.15.1. Third-party data and fonts
      keep their own licences, listed in the LICENSE.

## M12 — Letters mode (a Wordle inside WordGuess) — PLAYABLE 2026-09-24 (0.16.0), debug APK on the owner's phone, not released
Asked for 2026-09-23, settled the same day. Guess a hidden word letter by letter with the usual
green / yellow / grey feedback. What makes it ours rather than a Wordle clone: **not one word a day**
— a random word from the dictionary the game already ships, played as often as you like, offline,
with no clock and no sync, and with the shape of the game chosen by the player.

Design handoff requested 2026-09-24 (prompt in `notes/letters-design-prompt.md`) and delivered the
same night: six screens, `NOTES.md`, `strings.json`, kept in `design/letters/handoff/` (git-ignored).
Ported 1:1 in 0.16.0.

### From playing 0.16.0 on the phone — 2026-09-25
- [x] **A games list per mode**: the menu card opens that mode's games in progress (with its New
      game), not New game directly; no mixed list, no All / Znaczenie / Litery tabs, and the separate
      "Twoje gry" menu button removed (owner's choice). 0.17.0.
- [x] **Any word length**: a switch next to the length; the word is drawn from all lengths together,
      like real words (owner's choice over "every length equally"). 0.17.0.
- [x] **Show the category on the end screen**, win or loss, both games — the category the game was
      played in (owner's choice over the word's own category). 0.17.0.
- [x] **Frames on every text-only button**, app-wide. 0.17.0.
- [x] **Repeated letters**: confirmed right (right places settled first), 4 tests on `ananas`. 0.17.0.
- [x] **Polish word forms as guesses.** Guesses already accepted inflected forms (444 327 Polish
      forms: *byłem, zrobiłem, kotem*), but two kinds were missing:
      - [x] **~50 000 irregular forms** the dictionary lists on their own, with no link to their base
        word — *pasę, pasą, poszedłem, szedłem, poszliśmy*. The pipeline dropped them because Guess
        needs the base word to score a guess; Letters does not. Now shipped as guess-only words in
        `extra.txt` (owner said yes, 2026-09-25). 0.17.1.
      - [ ] **Forms the dictionary does not have at all** — *pasłem*: it knows *paść* mostly as "to
        fall" (*padłem*) and only a few "to graze" forms. Needs a bigger word list — sjp.pl's list for
        word games, the one Polish Scrabble uses — which M13 will need anyway. Bigger download,
        licence to check first. Planned together with M13.
- [x] **Status bar, both games**: the numbers spread across the whole first row, Save & exit and
      Give up on their own row underneath, aligned left, further apart. 0.17.1.

### Left to do after 0.16.0
- [ ] **Play it on a real phone.** Tested here in a browser at 320 px, with the keyboard simulated;
      what only a phone can show: that the phone keyboard opens on a tap, that long-press ż ó ł go
      into the boxes, that the keyboard's Go key sends the guess, and that the keyboard-open layout
      keeps Guess above the keyboard.
- [ ] **Badge thresholds** are the design's proposals (Champion 10/50/150/500/1500, High score
      150/250/400/600/1000, On a roll 3/5/10/20/50, Full range 3/5/7/9/11) — tune against real scores.
- [ ] **Not built from the design, on purpose:** the "what Copy result puts on the clipboard" card
      under the end screen. It reads as the designer's explanation (none of its text is in
      `strings.json`), so it was left out. Say if it should be in the game.
- [ ] Polish text written for things the design left blank: the difficulty help on the new-game
      screen (it showed "undefined"), "best {n}" under the streak, "(ż ó ł count ×2)" in the score
      line, and "already tried" for a repeated guess. Worth a read.

### Settled
- **The player chooses**: word length, number of tries, category, difficulty, and whether Polish
  letters with marks may appear.
- **Polish letters are separate letters**, and they are a switch:
  - **off** — the hidden word is guaranteed to contain none of `ąćęłńóśźż`;
  - **on** — the word is drawn from everything, so it may contain them, and each one counts as
    **two letters** in the score. Harder word, bigger score.
- **Any common word may be hidden**, whatever its part of speech, but always in its **base form** —
  never an inflected one.
- **A guess must be a real word** of the right length. `resolve()` already answers that.
- **Difficulty** is chosen as in the main mode and multiplies the score.
- **Score** = letters ÷ guesses **actually used** × 100 × difficulty. A Polish letter counts as two;
  tries you did not need simply never enter the sum, which is the bonus for finishing early.
  Worked example: `żółw` with Polish letters on is ż+ó+ł+w = 2+2+2+1 = **7**; solved on the third
  guess → 7 ÷ 3 × 100 = **233**, then × difficulty.
- **Repeated letters** follow Wordle's exact rule: two `a`s guessed against one `a` in the answer
  colours the first and greys the second. Fiddly; worth its own tests.
- **No colour-blind mode** — not wanted.
- **Categories are used.** **Badges are used**, with a separate section per mode on the badges
  screen rather than one mixed list.
- **The menu splits the Play button in two**, one per mode, each with its own arrow direction.
- **The phone's own keyboard is used** — no custom on-screen keyboard. Polish marks sit under their
  plain counterparts on a long press, which is how Android's Polish layout already behaves.

### The look — asked 2026-09-24: like WordGuess
Not a new style: the same design system the main mode already uses — the colours, the two fonts,
the boxes, the top bar with the brand in the middle, dark/light and the theme-colour setting. A
player should feel they changed game, not app.
- [x] The three feedback colours come from WordGuess's own guess-box ramp rather than Wordle's —
      **green** = `--fill-hot`, **yellow** = `--fill-mid`, **grey** = `--line`. The design made them
      solid, and grey is `#4A4A4A` in both themes (light `--line` is the empty-box border).
- [x] Each letter tile is drawn like a WordGuess guess box, square and in a row; the theme colour
      only ever outlines (the caret box), so it can never be mistaken for a result.

### Settled 2026-09-24
- **Word length 3–13**, in both languages. Measured over base-form words among the 12 000 commonest
  (the ones people actually use): Polish has 247 at 13 letters, English 198, and English falls to 69
  at 14 — so 13 is where the owner's "at least ~100 real words" rule stops for both. Even the rarest
  kept at that length are ordinary: *teraźniejszy, patriotyczny, podyskutować; uncomplicated,
  intelligently*.

  | length | 3 | 5 | 8 | 10 | 12 | 13 | 14 |
  |---|---|---|---|---|---|---|---|
  | Polish, top 12 000 | 271 | 1158 | 1621 | 1057 | 429 | 247 | 114 |
  | English, top 12 000 | 384 | 1394 | 1558 | 968 | 334 | 198 | 69 |

- **Tries: default 6** (the normal Wordle), freely changeable by the player — **including unlimited**.
  The score still works with unlimited tries, because it divides by guesses actually used.
- **A loss scores 0.**
- **Difficulty multiplier as proposed**: Relaxed ×0.75, Easy ×1, Normal ×1.25, Hard ×1.5.
- **No letter strip.** Every earlier guess stays on screen, coloured, so which letters are dead can be
  read straight off it.
- **Badges**: games won, best score, win streak, and wins at each word length.
- **Screens come from the design agent**, the same way the rest of WordGuess was made. The prompt for
  it is in `notes/letters-design-prompt.md` (ignored by git — a working document).

### Typing a guess — settled 2026-09-24
- One **box per letter**. Typing fills the boxes left to right, one letter each; Backspace empties the
  last filled box.
- **A guess is never sent automatically**, not even when every box is full. It goes only when the
  player confirms: **Enter** on a computer keyboard, the **Enter / Next / Go** key on a phone keyboard,
  or a **Submit** button on screen.
- The phone's own keyboard is used. Under the boxes sits a hidden text field that actually holds the
  focus, so the system keyboard opens and Polish letters work by long press exactly as usual; the
  boxes only draw what that field contains.

### Still open
- [x] **What "difficulty" means in this mode** — decided 2026-09-24: **how well-known the word is**
      (its place in the frequency list) + **how unusual its letters are** (rare letters, and repeated
      letters, are harder). The main mode's measure is about *meaning*, which this game never uses.
      Worked out in the app from what is shipped; the main mode's difficulty is untouched.
- [x] **"Zero tries"** was mentioned; the smallest meaningful number is 1. Built as 1–20 or
      unlimited (0.16.0).

### Consequences worth knowing before building
- [x] **The word pool is not the one the main mode uses.** `m.secret` is vetted **nouns**; this mode
      wants any part of speech. Decided: a runtime filter over `words` (0.15.3).
- [x] **Categories are built from nouns only.** Said on the new-game screen under the category
      (except Verbs, which holds verbs) — 0.16.0.
- [x] **The choices can combine into an empty pool** — a 13-letter Relaxed animal does not exist. The
      new-game screen shows the count per length, says "no word fits" and disables Start (0.16.0).
- [x] **Adjectives and adverbs have no difficulty score.** Moot: Letters has its own (0.15.3). Measured 2026-09-24 over the 20 000
      commonest words: verbs are all rated, nouns about 60 %, adjectives and adverbs **0 %** — the
      score was only ever computed for words the main mode can hide. **Moot if the Letters-specific
      difficulty above is accepted**, since that one is computed in the app for every word. If not,
      it needs `difficulty()` in `tools/build-data.mjs` widened and a rebuild — and widening it
      shifts the main mode's percentiles, so its bands would need re-checking.
- [x] **A few inflected forms sit in the word list as if they were base words** — `uroczystości`
      (a plural) turned up among the 12-letter words, the same leak as `kota`. Handled by `formOf`
      (0.15.3); the few that still slip through are the known leak below.
- [x] **The stoplist has to reach this mode.** `NEVER_SECRET` (the vulgar and grim words) is applied
      to nouns and verbs only. With adjectives in the pool it must cover them too, or a crude
      adjective could be the hidden word.

### To build
- [x] **The rules** — `feedback()` (with the repeated-letter rule) and `score()` in
      `app/js/letters.js`, 16 tests in `tools/test-letters.mjs`. Done 2026-09-24, 0.15.2.
- [x] **The word pool** — `pool()`, `pick()`, `difficulty()` in `app/js/letters.js`. Any noun,
      adjective, verb or adverb among the 20 000 commonest, base forms only, stoplist applied. Every
      length 3–13 × every difficulty has at least 20 words in both languages. Done 2026-09-24, 0.15.3.
- [x] **The stoplist reaches this mode** — crude adjectives added (`shitty`, `horny`, `goddamn`,
      `zajebisty`…), and `NEVER_SECRET` shipped in `vocab.json` as `blocked`.
- [x] **Inflected forms posing as words are marked by the pipeline** — `formOf` in `vocab.json`
      (2 396 Polish, 1 141 English): `ptaki`, `stara`, `kota`, `nowe`, `polskie`, `loved`. Participles
      and gerunds stay (`życie`, `spotkanie`, `znany`), and so do dictionary-shaped adjectives that
      coincide with a form (`stary` is also a plural of *star*, `długi` of *dług*).
- [ ] **Known leak, roughly one game in 300:** a few common verb forms and plurals still get through —
      `staje`, `dzieje`, `emocje`, `dziękuję`. They escape because their base is over 10× rarer than
      they are, and the 10× guard that lets them through also protects 111 real base words (`cel`,
      `las`, `kraj`, `klucz`, `obraz`, `morze`) that happen to spell a form of some rare word. A
      proper fix compares how alive each word's own paradigm is, like `ambiguousSpellings()` does —
      but that function also excludes `las`, so it cannot simply be reused.
- [x] Reuse the vocabulary and the validator: `resolve()` for "is this a word?" — any form in
      `ac.txt` of the right length is a valid guess (`parki`, `bunty`). 0.16.0.
- [ ] **Hard mode** — a revealed letter must be reused. Standard, cheap, and wanted by the people who
      want it at all. Not in the design; not built.
- [x] **A result grid to copy** — the coloured squares as 🟩🟨⬛ text, never the word. 0.16.0.
- [x] **Save and resume**, like the main mode. 0.16.0.
- [x] **The screens** — menu mode cards, new game, game, win / loss, one games list for both modes,
      stats with a tab per mode and four Letters badges. 0.16.0.

### Build it as the second of three modes, not a bolt-on
Decided 2026-09-24 that the app will hold all three games (see M13). That changes how Letters should
be built: every place that today assumes "there is one game" gets made to hold several *now*, so the
third mode slots in instead of forcing a second rework.
- [x] **Saves carry a mode.** Every saved game gets a `mode` field; old saves read as `guess`, so
      nothing already saved is lost. 0.16.0.
- [x] **Statistics and badges are kept per mode** (`stats.lt` for Letters), and the stats screen has
      a tab per mode. Letters typed and time in game stay shared. 0.16.0.
- [x] **The menu offers a choice of modes** — one card per mode on an `auto-fit` grid, which the
      design showed taking a third card unchanged. 0.16.0.
- [x] **Routes name the mode** — `#/new/letters`, `#/game/<id>` reads the mode from the save. 0.16.0.
- [x] **Only Guess loads the vectors.** `loadWords()` is the words alone (9 MB for Polish);
      `load()` adds the vectors on top for Guess. 0.16.0.

## M13 — The third mode: Scrabble — DECIDED 2026-09-24: all three games in one app
The owner wants WordGuess to end up holding all three word games — Guess, Letters, Scrabble. The
order stays: Letters first, shipped, then Scrabble. Built that way it works; the reasoning below is
why the order matters. The owner's own plan for this game is `letterex-plan(scrabble).md` in the
project folder (ignored by git, not read).
**Size is not the obstacle,** which is the surprising part. Scrabble needs a list of every legal
word, and that is `ac.txt` — already in the app, 4.8 MB Polish and 0.7 MB English, already shipped.
Adding Scrabble to WordGuess would cost almost nothing to download, because the expensive part of
this app (30 MB of vectors) is already paid for and Scrabble never opens it. The waste runs the other
way: a standalone Scrabble carrying vectors it does not use.

**What genuinely overlaps is bigger than the word list**: both languages and every string, the
installer, the update check, saves, badges, statistics, the whole look. Two apps means maintaining
two of each of those forever. That is the real argument for merging.

**The real cost is focus.** A Scrabble worth playing needs an opponent, and a computer opponent means
move generation across a 15×15 board — a DAWG or GADDAG over the whole dictionary. That is the
largest single piece of work discussed for this project, larger than the semantic engine was.
Starting it before the letters mode exists is how a project ends up with three half-games.

- [~] Finish the letters mode — built as the second of three modes (M12) — and ship it first.
      Playable in 0.16.0; not packaged or released yet.
- [ ] WordGuess stops being one game and becomes the name of a collection of three. Decide whether
      the app keeps that name or gets one that fits all three.
- [ ] **Polish Scrabble accepts every inflected form**, and `ac.txt` already holds 384 000 of them —
      so the word list is solved, not just started.
- [ ] Worth knowing early: **"Scrabble" is a trademark.** A shipped game needs its own name.

## OPEN QUESTIONS (waiting on owner)
- [ ] Polish badge names — current picks: Wordsmith → **Mistrz słów**, Typist → **Skryba**,
      Sharpshooter → **Snajper**. Change if you prefer others.
- [ ] After a give-up / win: also show the true top-10 closest words ("what was rank 1?")?
      Contexto does; not in the design, so not built.
- [ ] Badge tier thresholds (placeholder numbers in DESIGN.md §6) — tune later.
- [ ] Final game name (working title: WordGuess). It should fit all three games (M13).
      Considered 2026-09-25: **Wordly** — advised against: 8+ "Wordly" games on Google Play (mostly
      Wordle clones), Wordly (wordly.ai) is an established company, and it is one letter from Wordle.
      English-only shortlist searched the same day (web + app stores, NOT trademark registers or
      domains): taken — Wordhoard, Wordtrove, Wordloom, Wordnest, Wordvault, Triword, Wordbound,
      Lexiloom, Verbarium, Lexorium, Wordspire, Letterfall, Lexicorn, Vocabulon, Wordwright. No app
      found — **Lexling** (recommended), **Wordlark** (but it starts "Wordl…"), **Guessary** (fits
      only the guessing games). Next: trademark registers (EUIPO, USPTO) and domains for the pick.
      A rename is also the moment to change the Android app ID away from `com.trivioflow.*`
      (the owner's employer) — both make phones see a new app, so do them together once.
- [ ] **Before a public store release: Letters' colours.** The New York Times has sent takedown
      notices (2024) citing the Wordle name AND its green / yellow / grey tiles. Ours come from our
      own guess-box ramp, but they are still green / yellow / grey. Decide before publishing widely.

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
