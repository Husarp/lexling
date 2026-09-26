# Lexling — Development Plan

*Called WordGuess until 0.18.0 — the history below keeps the old name where it was the name.*

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
        licence to check first. Planned together with M13. (Licence checked 2026-09-25: GPL 2 or CC BY 4.0,
        our choice - see M13 "The word list".)
- [x] **Status bar, both games**: the numbers spread across the whole first row, Save & exit and
      Give up on their own row underneath, aligned left, further apart. 0.17.1.
- [x] **Many tries ran off the screen** (reported with 20): the screen now fits the window while
      playing — status on top, Guess under the grid, only the grid scrolls. No empty rows are drawn
      for the tries to come; a new row is added per guess and grows in, left to right, quickly. 0.19.0.
- [x] **A guess colours in as fast as a new row appears** (0.3 s for 5 letters). 0.19.1.
- [x] **Giving up shows the word as a green row** in the grid, growing in like a new row. 0.19.2.
- [x] Running out of tries shows that row too (owner: yes). 0.20.0.
- [x] **End screens v2, both games** (owner's second design handoff): a green ✓ / red ✕ outcome banner,
      then a card with the word; wording Zgadłeś / Guessed correctly, Koniec prób, Poddałeś się. 0.20.0.
- [x] **Random difficulty** in Letters: draws one of the four levels, scores with it, shows only
      "Random". A switch beside the levels (five buttons did not fit 320 px). 0.21.0.
- [x] **Never X/6 on the end banner** — the tries used, however it ended (6/6, 2/6, 0/6). 0.21.0.
- [x] **✓ / ✕ centred** in the banner's circle (drawn, not typed). 0.21.0.
- [x] ~~Open: should Znaczenie get Random difficulty too?~~ - no: Random left Letters and Connect as well (owner,
      2026-09-25). 0.37.0
- [x] **Scoring question from the owner (2026-09-25)**: the score divides by the tries USED, so
      unlimited tries can never lose and always pays — "you will always choose unlimited". The owner
      suggested counting all tries, even unused. Options put to the owner: (a) divide by the tries
      ALLOWED (unlimited counted as 20) — rewards risk, not speed; (b) keep dividing by tries used and
      multiply by 6 ÷ tries allowed (6 → ×1, 3 → ×2, 12 → ×0.5, unlimited as 20 → ×0.3) — rewards both.
      **Done in 0.22.0**: the owner chose (b), with unlimited counting every guess as two (×0.5).
- [x] With (b), unlimited (×0.5) paid MORE than 13–20 tries (×0.46 … ×0.3). The owner chose: unlimited
      counts as 20 tries (×0.3), keep 20 as the most. 0.22.1.
- [x] **Tries stepper: + at 20 switches to Unlimited** (owner's idea, 2026-09-25); − from ∞ gives 20;
      the Unlimited button stays. 0.22.2.
- [x] **Points for a loss?** (owner's question) — e.g. out of tries scores from the best row: greens
      and half the yellows, as a share of the word, of a quarter of a last-try win; giving up scores 0.
      **Done in 0.22.0** — the owner chose exactly this.
- [x] **On-screen keyboard** (owner's idea, 2026-09-25) — built in 0.25.0 from design v4: the phone keyboard hides the tiles. Own
      keyboard on phone and PC, keys coloured by what is known, a small "2" on a key when the letter
      is known to repeat, a press animation, Backspace; tap a tile to select and overwrite it (the
      selection then moves on); a Settings switch to use the phone's keyboard instead. Design prompt
      written: `notes/letters-keyboard-design-prompt.md` — waiting for the design.
      **The owner's rules for the phone-keyboard switch (2026-09-25) — they win over the brief, which
      said the on-screen keyboard hides when the switch is on:** the switch is **OFF by default**. When
      it is ON, the on-screen keyboard stays; tapping a square also opens the phone's keyboard to type
      with; tapping anywhere else closes it, as Android does; and pressing a key on the on-screen
      keyboard while the phone's keyboard is open closes the phone's keyboard.
- [ ] The owner asked whether the other end texts should change as well — the design's versions are in
      (Koniec prób / Out of tries, Poddałeś się / You gave up); waiting to hear if they want others.

### Left to do after 0.16.0
- [ ] **Play it on a real phone.** Tested here in a browser at 320 px, with the keyboard simulated;
      what only a phone can show: that the phone keyboard opens on a tap, that long-press ż ó ł go
      into the boxes, that the keyboard's Go key sends the guess, and that the keyboard-open layout
      keeps Guess above the keyboard.
- [ ] **Badge thresholds** are the design's proposals (Champion 10/50/150/500/1500, High score
      150/250/400/600/1000, On a roll 3/5/10/20/50, Full range 3/5/7/9/11) — tune against real scores.
- [x] ~~The "what Copy result puts on the clipboard" card~~ — moot: Copy result itself was removed
      on 2026-09-25 (0.17.2), the owner did not want it.
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
- **No score since 0.29.0** (owner, 2026-09-25: the games are for fun; "not sweat for score"). What follows
  about the score is how it was until then.
- **Score** = letters ÷ guesses **actually used** × 100 × difficulty × **6 ÷ tries allowed** (0.22.0;
  unlimited counts as 20 tries, ×0.3 — 0.22.1). A Polish letter counts as two; tries you did not need
  never enter the sum, which is the bonus for finishing early.
  **Out of tries** (0.22.0): the best row (greens + ½ yellows) ÷ the word's letters × ¼ of a
  last-try win. Giving up: 0.
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
      **Removed 2026-09-25 (0.17.2)** — asked what it was for, the owner said it looked bad: remove it.
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
- [x] WordGuess stops being one game and becomes the name of a collection of three. Decided
      2026-09-25: the app is renamed **Lexling** (0.18.0) — see "Rename to Lexling" below.
- [x] ~~**Polish Scrabble accepts every inflected form**, and `ac.txt` already holds 384 000 of them —
      so the word list is solved, not just started.~~ Not so, measured 2026-09-25 (0.30.0): see "The word list" below.
- [ ] Worth knowing early: **"Scrabble" is a trademark.** A shipped game needs its own name.
- [x] **Its name: Kafelki / Tiles** — chosen by the owner 2026-09-25 (also offered: Pojedynek / Duel,
      Mistrz słów / Wordsmith, Letterex; not "Literaki", a well-known Polish online game of this kind).

### Started 2026-09-25 (owner: "the Scrabble pass like the last game": mechanics for phone and PC, the
official board plus two more, symmetrical, found by looking around; a core system; a design prompt)
- [x] **The rules, no screens (0.30.0)**: `tiles.js`, `tiles-moves.js`, `dawg.js`, `tools/test-tiles.mjs` -
      what they do is in DESIGN.md "Tiles". The official rules and letter sets (checked on pl.wikipedia.org and a
      Polish rules page); a game is plain data, so a save is the state itself.
- [x] **Boards: Classic** (the original), ~~**Quick** (11 × 11, half the tiles)~~ - dropped 2026-09-25 (owner: "the
      full game from start to finish with all the letters"), 0.32.0 - and **Bonus** (bonuses nearer the
      middle) - all symmetrical. Looked at: the Words With Friends board (bonuses pulled in, more triple
      letters, 35 for all seven tiles), its 11 × 11 Fast Play board, Wordfeud's random boards (not symmetrical),
      Super Scrabble (21 × 21 - too big for a phone), Wordscraper (players draw their own). Quick and Bonus take
      the two ideas that suit a phone; the layouts are ours. **Owner to confirm.**
- [x] **The computer player**: finds every legal move (1-2 ms a turn on a PC); four levels, as in the other
      games - how many words it knows and how hard it tries. Values to tune by playing.
- [x] **Design prompt**: `notes/tiles-design-prompt.md` (new game, the game screen on phone and PC, placing
      tiles, blanks, exchange, the computer's turn, the end, saved-game card, statistics).

### The word list — DECIDED 2026-09-25: sjp.pl + ENABLE, built in 0.31.0
Measured on the lists the app has (`ac.txt` + `extra.txt`): 458 306 Polish words, 72 354 English. Two problems:
- **Abbreviations count as words**: *hr, pp, bp, cm, dr* / *cc, cf, bk* - and the computer plays them (seen in
  the test games: HR, PP, OPOWI, MAH). The lists come from spell-checkers, which want them.
- **Most legal Polish words are missing**: the official Polish list (OSPS) has 2.9 million forms, ours
  0.46 million. A player will have good words refused.
- The fix: **sjp.pl's "słownik do gier"** (the word-game list Polish players and Literaki use; licence GPL 2
  or CC BY 4.0, our choice - CC BY needs a credit line in the app) and, for English, **ENABLE** (public domain,
  ~173 000 words, what Words With Friends started with). Both would go into the word graph file, built ahead of
  time; download size to measure. The computer's levels would still use our frequency list to decide which
  words it "knows".
- [x] **Design, round 1** arrived 2026-09-25 (`design/v5/`, `LexlingTilesDesing.zip`) - made from the first brief: one person vs
      the computer, three boards, a one-step hint. Kept: the classic bonus hues (owner), yellow tiles with dark ink,
      labelled buttons, auto-zoom + pinch, the merged history / letters-left panel.
- [x] ~~**Design, round 2**~~ - not needed (owner, 2026-09-25: "I gave you the whole design - build it"): what
      round 1 did not draw (2-5 players and the hand-over, the two-step hint, check a word, rule options, Expert,
      the "?" guide, look-back, statistics, credits, the colours switch) was built in its style. 0.35.0
- [x] Owner: download and use them? - **yes**. 0.31.0: 3.2 million Polish words (2.8 MB), 168 000 English
      (0.8 MB), every form of a slur or vulgar word left out; the README credits them. The credit line in the
      app comes with the Tiles screens (design prompt; see also M5 "Credits in About").
- [ ] Now possible, not asked: Letters could accept the forms only sjp.pl has (pasłem - see M11 above).

### How it plays — mechanics, phone and PC (proposed 2026-09-25, in the design prompt; answers the same day)
- **2–5 players** (owner: "add more users, up to 5"): people passing the device and/or the computer, each
  seat its own level; a hand-over screen hides the rack between people. Core: 0.31.0. Who starts is drawn at
  random. No timer. Save & exit and Give up, as everywhere.
- **Placing**: drag a tile from the rack to a square (finger or mouse); or tap a tile, then a square; a tile
  put down this turn can be dragged elsewhere or tapped back to the rack; **Recall** takes them all back;
  **Shuffle** mixes the rack; the rack can be reordered by dragging.
- **Typing on a PC**: click a square (click again, or an arrow key: across or down), type letters from the
  rack, Backspace takes the last one back, Enter plays, Esc recalls. A blank always asks which letter it is.
- **A phone has little room**: 15 squares across 320-360 px are ~22 px each - the design must make placing
  easy there (zoom in on the board while placing, a magnifier under the finger, or both).
- **Before playing**: the score of the move shows as it is built, and what is wrong with it if anything
  (not in a line, a gap, not joined, unknown word X). **Play** puts it down.
- **Blanks**: on landing, pick the letter; a blank shows its letter but no points, and looks different.
- **Exchange**: pick the tiles to swap - only while 7+ tiles are in the bag (say why when not). **Pass**.
- **The computer's turn**: a short "thinking" pause (it really takes milliseconds), its tiles land, its
  points show; the last move of each side stays marked.
- **Always visible**: every player's score, whose turn, tiles left in the bag. On demand: the move history; the
  letters not yet seen (the bag plus everyone else's racks) - **owner: yes**, core 0.31.0.
- **Hints** - **owner: yes**: a hint lays the best move for your rack on the board as a preview (play it or
  take it back); free, counted, as in the other games. Core 0.31.0.
- **New game**: language, board, the computer's level (Relaxed / Easy / Normal / Hard + Random). No
  Polish-letters switch - the Polish set has them - and no categories.
- **End**: won / lost / draw / gave up; the final scores with the leftovers taken off and given; the best
  word; Play again, Menu. **Statistics**: played, won, best game score, best move (word + points), average
  score, seven-tile moves, hints used.

### From the owner's own plan (letterex-plan(scrabble).md, read 2026-09-25 at the owner's wish)
It agrees with what was built: DAWG + Appel–Jacobson, sjp.pl + ENABLE (CC BY rather than GPL), four levels,
hot-seat. Taken into the core at once, as the plan asks for them "from day one" (0.31.0):
- [x] The engine as actions, `apply(state, action) → state`, with a seed (replays, saves, later network games).
- [x] A tag (hash) of the word list in every save - a new list never breaks an old game.
- [x] Letter names (es, ef, zet / ess, aitch, zed) - checked: in both lists already, no extra list needed.
- [x] Proper nouns and abbreviations out - the word-game lists have none.
Its other ideas - the owner (2026-09-25): "arrange them as is best, but make sure they are there when
everything is built" - except quick start, the daily puzzle, the anagram trainer and replays (dropped).
Order: the game itself first, then these; all of them are in the design prompt, so one design covers them.
- [x] **Hints, the owner's way**: the first press marks where the best word goes, the second shows the word.
      (In place of the plan's four hint types.) Core: hint() 0.31.0; the two steps are the screen's.
- [x] **"Check a word" - any time** (owner: not as a hint - "you just want to check if they are possible"),
      in the game (the magnifier beside Give up, since 0.37.1). Core: checkWord 0.31.2. The card on the games list went in 0.36.0 (owner: "it
      does not make sense there - it should be inside the game").
- [x] Rule options: bonus squares once (standard) / always; automatic checking / challenges with a penalty (the
      challenger loses the turn); exchanges only with 7+ in the bag / always; the seven-tile bonus on / off; a time
      limit per move (a pass) / per game (10 points per started minute over). Core 0.32.0; screens with the design.
- [x] A stronger computer: Hard weighing the tiles it keeps, and swapping a hopeless rack; an Expert level that
      tries its best moves against possible answers. 0.32.0
- [x] Statistics per level and language, points per move, passes (`results`, `recordTilesEnd`); a look-back
      after the game - the best move of each turn (`lookBack`). 0.32.0 ~~Replays~~ - dropped (owner: "too much
      hassle"); the game log that rebuilds a game is only what the look-back needs.
- ~~New game on the last settings in one tap; a daily puzzle; an anagram trainer~~ - dropped (owner).
- [ ] Bigger text - maybe (owner: "could be it").
- [x] **The owner's own new idea (2026-09-25): who put which tile** - a switch in the game, on and off at any
      moment. 0.35.0 the design's way (letters in each player's colour, a ring round the last move); 0.36.0 the
      owner's: no frames - each player's tiles tinted in their colour. The switch: New game, the game's History
      panel, Settings.
- [x] **Statistics with several people** - yes (owner: "it's the phone's statistics"): every game counts;
      the computer's own moves never do. In the design prompt.
- [ ] Later: games over the local network (PC ↔ Android), then Bluetooth (Android ↔ Android).

### To build — after the owner's answers and the design
- [x] The word graph file per language (a tool that builds it from the chosen list) and its loading. 0.31.0
- [x] The screens, from the design (0.35.0). The computer still thinks on the main thread - under the 900 ms
      "thinking" pause even at Expert on a PC; to watch on a phone.
- [x] Saves, the games list, statistics; the menu row stops saying "soon". 0.35.0

### The owner's first round on the playable game (2026-09-25, after 0.35.0)
- [x] No "check a word" card on the games list - it is in the game. 0.36.0
- [x] How to play on Kafelki's New game: closed every time (its topics are long). 0.36.0
- [x] No "Random" level in Kafelki. 0.36.0
- [x] **Who starts**: a player chosen on New game, or drawn at random; the list is the order of play (↑ ↓). 0.36.0
- [x] **Bug: the blank's letters closed at once on a phone** (the tap that put the blank down also landed on the
      letters' backdrop, which means Cancel). Fixed; checked with real touch taps. 0.36.0
- [x] **No frames for players - coloured tiles**: each player's tiles tinted (green, purple, pink, grey, yellow),
      none of them the bonus squares' hues; the colours switch also on New game. 0.36.0
- [x] No points bubble on the board after a move - the message line says it. 0.36.0
- [x] **Hints on / off** - a rule on New game. 0.36.0
- [x] **Undo** - a rule on New game, one person against the computer only: back a turn at a time, the computer's
      replies too, as far as the start; the bag is shuffled again each time, so the next tiles are new. 0.36.0
- [x] **Boards: Romb (Diamond)**, full size, the bonuses on diamond rings; **Quick back** (owner: "I didn't understand
      what Quick meant - bring it back"), 11 × 11 with its own letters: about half, the hard ones left out (PL ć ń ź
      ó f, EN q z v), one blank - PL 53 tiles, EN 50. A game takes about half the turns. 0.37.0
- [x] **"+points" beside each score**: what that player's last turn brought, +0 for a pass or exchange (owner chose
      this over "this round", which would clear the other player's points just when your turn comes). 0.37.0
- [x] **Hints in three levels**: Small (the best move of common words), Big (the most points), Master (the best,
      looking ahead); straight onto the board, no two steps (owner: "the squares alone are too hard, the word alone
      too easy"); a level that would show the same move as a smaller one is faded and says so. 0.37.0
- [x] **Everyone's tiles** - a rule, two people or more: the other people's racks under the scores, always in view,
      so a friend can think while you move; no hand-over card then; the computer's tiles stay hidden. 0.37.0
- [x] **How to play closed every time**, in all four games; **no Random level** in Litery and Połącz either. 0.37.0
- [x] **No tabs** (owner): the scores open History, the bag Letters left, a small magnifier beside Save & exit /
      Give up opens Check a word. 0.37.1
- [x] **Too many colours** (owner): "Kolorowe premie" - bonus squares one quiet grey with their labels - in Settings,
      New game and the game; a palette button beside the magnifier turns the player colours on and off. 0.38.0
- [x] **The message line adds up**: "KOT 5 + TOK 6 = 11" instead of dots (owner). 0.38.0
- [x] **A settings gear in every game** (owner: "the usual icon only"): Sound. 0.39.0
- [x] Kafelki's gear also holds its two colour switches (owner). 0.40.0
- [x] Kafelki's gear moved to the button row, right of the magnifier (owner). 0.40.1
- [x] **Move ratings** (owner, 2026-09-26): after each of your moves (a setting), and at the end every player's rating
      and every turn with its rating and the best move. 0.41.0
- [x] Bonus squares: colour / labels only / grey; raised tiles (a setting); tap a tile to see the square under it;
      the whole hinted word in the hint look; no points oval on the board; a bigger message line; no zoom-out button;
      a lighter zoom; the end board scrolls; the check panel's corners. 0.41.0 (owner)
- [x] **The new scores row** (design "Lexling Tiles Scores", owner's pick: on top): badges, the player to move ringed,
      the bag dashed; from three players the row scrolls sideways and follows the turn. 0.42.0
- [x] **Player colours: tiles / letters / off** - in the gear, New game and Settings; no 🎨 button any more. 0.42.0
- [x] Raised tiles in true 3D: over the tiles above, the thickness below, the letter centred (owner). 0.42.1
- [x] The rating on its own line under the board; Settings' choices full width on a phone, shorter texts; a placed blank
      can be taken back alone ("Zdejmij" beside Cancel); the Small hint really small (owner). 0.42.2
- [x] Raised tiles not cut at the top of the board; the board fixed in place at the top, the rating right under it;
      **a Hints section on New game**: on / off, how many of each level per player (owner). 0.42.3
- [x] **Hints cost points** (No / A little / A lot - a better hint costs more) and **hinted moves marked**: dashed tiles
      in the player's colour, History, the rating, left out of the end review's rating (owner). 0.43.0
- [ ] Other hint options still asked about: one hint per turn; hide the best move in the rating line.
- [x] **Word meanings** (owner, 2026-09-26) - not downloaded ("too much"): a word opens its meaning in the browser,
      sjp.pl for Polish, Wiktionary for English - Check a word and History in Kafelki, the guesses in Znaczenie, the
      end cards of every game. 0.40.0
- [ ] Tune the levels by playing.

## Litery: hints and the "what you know" strip — DONE 2026-09-25 (0.28.2)
- [x] Hint = one letter in its right place, free (counted only), at most half the word; the strip above the grid
      shows the letters in place and the yellow ones still to place. Owner's idea.
- [x] Should a hint lower the score? - moot: there is no score since 0.29.0.

## From playing 0.29.6 on the phone — 2026-09-25 (afternoon)
- [x] **Litery: the row of letters in place under the keyboard goes** (owner: not needed); in its place one row:
      Space (leaves a tile empty and moves on), ← → (along the tiles), Hint. 0.31.1
- [x] **"Doesn't exist or isn't allowed"** instead of "I don't know the word" - Guess, Letters, Connect. 0.31.1
- [x] **Połącz: the half-word cap counts every letter showing** - crossings of found words too (owner: "a word of
      six letters with two filled by crossed words gets one hint"). Clearer "no more hints allowed". 0.32.0
- [x] **Labels that did not fit in Polish** (owner: "Podpowiedź" in Połącz; "check other buttons") - checked on
      every screen in headless Edge, both languages, 320-1100 px: Połącz's Hint button was squeezed below its
      label at 480 px (the owner's phone is 480 px wide), "Normalny" in the level buttons at 412 px, "Znaczenie"
      in the statistics tabs at 320 px. All fixed. 0.32.0
- [x] Litery's hint cap counts letters already green too (owner: yes) - no hint once half the word shows. 0.32.1
- [x] Połącz "16 hints, all S or I": the owner - "might have been just luck". Closed.
- [x] **Weird words hidden in Litery / Połącz** (owner: "SZER on Normal - I'm Polish and don't know it"; "rule out weird
      words, and check whether good ones are ruled out"). Measured against sjp.pl's word-game list and the web-text
      counts: 303 Polish words and 20 English now never hidden (DESIGN.md "Words Letters and Connect never hide"). 0.33.1
- [x] **Good words wrongly kept out** - fixed in 0.33.2 (172 back in; the owner allowed the download): 1 319 of the 20 000 commonest Polish words are kept out as "an inflected form of
      another word" (formOf) - rightly for ptaki, nowe, treści, but wrongly for gra, muzyka, droga, polityka, walka, wino,
      kino, złoto, przyjaźń, szachy, spodnie... (each is also a form of something else: gra of grać, muzyka of muzyk). The
      Hunspell dictionary cannot tell them apart; sjp.pl's inflection list (sjp-odm-*.zip, 12.7 MB, same licence) can - it
      starts every line with the base form. Asked the owner to allow the download.
- [x] **Litery: no hints** (owner, 2026-09-25: "they don't fit - the game is not endless, you can lose"). 0.34.0
- [x] **Połącz: the hint cap rounds up** (3 of 5, 2 of 3), and **a hinted letter stays marked** once its word is done:
      green with a dashed edge, in the game and on the end screen (owner: "it doesn't show where you used a hint"). 0.34.0
- [x] **SEDAN on Normal** (owner: "I don't know it"): specialist words that are also English words look commoner
      than they are - 105 now Hard only, in Litery and Połącz. 0.34.0
- [x] Znaczenie (Guess) hides from its own list - the same cleanup now applies there too (owner: yes), 0.33.3. It also
      caught English slurs and vulgar words Znaczenie could still pick (bullshit, prick, bollocks...).
- [x] **How to play, on every New game screen** (owner, 2026-09-25: "a card that says how to play - which
      letters are used and things like that"; for Kafelki, long, "maybe an expandable section"). Owner: yes, and
      yes to the "?" in Kafelki's game screen. Built for Znaczenie, Litery, Połącz in 0.33.0: one collapsible card under the title (open until the first game of that kind is
      finished, then closed; the player's open / closed remembered per game); 3-5 short lines for Znaczenie,
      Litery and Połącz; for Kafelki the same card holding topics that open one at a time (goal, a turn, points
      and bonus squares, blanks, exchange and pass, the end, challenges and the clock when switched on), and the
      same guide behind a "?" in the game. Kafelki's is in its design prompt.
- [x] **The orange line at the top of every screen** (the top bar's 3 px accent edge) - gone, phone and PC. 0.31.1
- [x] Litery: where hinted letters show now that the row is gone - owner: greyed out in its place in every
      row being typed, to type over. 0.31.2
- [ ] Połącz: "hints mostly pick first letters" - measured, not so: over 1 200 hints 26.0 % landed on a first
      letter, and 26.7 % of the squares are first letters; every letter of the circle equally often. Asked the
      owner what they saw. Owner: 16 hints on 10 letters, all S or I. Not reproduced either: 580 simulated
      10-letter games (some words already found), never fewer than 4 different letters in 8-16 hints; the
      hint code is unchanged since 0.27.4. Asked for a screenshot when it happens again.

## M14 — The third game: Połącz / Connect — PLANNED 2026-09-25, designs requested
The owner's description: you get a few letters **arranged in a circle**. You draw a word by dragging
through the letters with a finger (or the mouse held down) — a line follows the path — and **letting
go checks the word**: a real word is accepted, a wrong one makes the letters **shake**. A **Shuffle**
button rearranges the same letters in the circle, so the player stops seeing the same few words and
spots new ones. **Settings** as in the other modes: how many letters you get, and more; a **score**
for how many words you find.

The mechanic is a common one (Wordscapes, Word Connect, Words of Wonders) — the mechanic is free to
use, their names are not, and ours needs its own name like the rest of the app.

**Measured the same day, with the word lists the app already ships** (letter sets taken from real
5–7 letter words, Easy):

| letters | Polish, common base words | Polish, every form | English, common base words | English, every form |
|---|---|---|---|---|
| 5 | 5 (min 2) | 16 | 8 (min 1) | 11 |
| 6 | 11 (min 2) | 35 | 14 (min 6) | 23 |
| 7 | 18 (min 4) | 69 | 30 (min 13) | 39 |

- Finding every word for a set of letters takes ~23 ms in Polish and ~4 ms in English, in the app —
  no new data and no pipeline change needed.
- Counting every Polish form triples the words (18 → 69 at seven letters), so which words count is
  the biggest design choice here.
- The raw list needs the same filtering as Letters' pool: common words include junk such as *itp*
  (an abbreviation). Letters already keeps to nouns, adjectives, verbs and adverbs, minus the
  stoplist — reuse that.
- Fewer letters leave very few words (5 Polish letters: median 5, some sets only 2): the letter set
  should be chosen for having enough words, not just drawn at random.

### How the genre plays — looked up 2026-09-25
Wordscapes, Word Cookies and Words of Wonders all work the same way: the letter wheel at the bottom,
a small crossword of blank slots above; swipe across the letters, let go to check; words of 3+
letters. A real word that is not on the board is a **bonus word** — it fills a jar that pays coins.
**Shuffle** is free; **hints** (reveal one square, or a whole word) cost coins. Progress is levels in
themed packs, and **none of them has a points score** — finishing the board is the goal.

### Proposal — written 2026-09-25, waiting for the owner
- **Goal: a small crossword (4–10 words)** made from the circle's letters, always including one word
  that uses every letter. Solved = every board word found. (Answers "what is the goal" below.)
- **Letters: 4–7** (a setting), taken from a common base word of that length; only letter sets with at
  least 4 board words (5 Polish letters can have as few as 2 — measured above).
- **Board words**: common base words, the same rules as Letters' pool (noun / adj / verb / adv, the
  stoplist, base forms), 3+ letters; difficulty picks how common they are, as in Letters.
- **Bonus words: any other real word, every Polish form included** (`ac`) — counted, never required.
  So "which words count" becomes: base forms on the board, every form as a bonus.
- **Hints (changed 0.27.4, owner): a random letter anywhere (or in the tapped word), at most half a word's
  letters from hints.** The earlier rule below - one word at a time from its start - is replaced.
- **Hints — free and unlimited** (owner 2026-09-25: the game is about fun; a player who is stuck
  should not be kept stuck). The owner's idea: a hint puts a letter into an unfinished word, e.g. its
  first. Each press shows **one more letter of one word, from
  its start** — so the player takes as much help as they want. Tap a word on the board to choose it;
  otherwise the hint goes on with the word showing the most letters (shortest on a tie), so repeated
  presses finish one word. A word completed by hints counts, but looks hinted. **Agreed by the owner
  2026-09-25.** (Weighed and not
  proposed: a fixed first + last letter, or first two — they give too much for short words and too
  little for long ones.) Shuffle is free.
- A wrong word shakes the circle; an already-found word flashes on the board; a bonus word flies into
  the bonus counter. On a PC the letters can also be typed.
- **No losing, no time limit.** Give up shows the missing words (like Letters' answer row).
- New game: language, letters, difficulty (+ Random), Polish letters. **No category** — a letter set
  cannot keep to one.
- Its own saved games, games-list section and statistics tab, like the other two games.
- **Name: Połącz / Connect** — confirmed by the owner 2026-09-25.
- **Order: this game third, Scrabble (M13) fourth** — it needs no computer opponent, so it is far smaller.

### Scoring across four games — the owner's question (2026-09-25), ACCEPTED the same day
The owner asked: badges for every game? one score summed up, or a ranking per game? or no score at all?
The recommendation below was accepted:
- **No combined score.** The games measure different things — Guess counts guesses (fewer is
  better), Letters gives points, Connect finds words, Scrabble scores against the computer. A sum means
  nothing, and whichever game hands out the biggest numbers would swamp the rest.
- **Connect has no points**, like the genre: its result is solved / bonus words / hints used.
- **Each game keeps its own statistics tab**.
- Later, if wanted: a **personal best list per game** (your top 10 results for that game).
- [x] **Achievements: none, in any game** — the owner, 2026-09-25. Removed from Guess and Letters in
      0.23.0; what only a badge showed stays as a plain statistic.

### Designs — prompts written 2026-09-25
- [x] **Main menu for four games** — four big cards do not fit a phone: `notes/menu-four-games-design-prompt.md`.
      Design v4 arrived 2026-09-25 (`design/v4/`); built in 0.24.0.
- [x] **Connect's screens** (new game, game, end, saved-game card, statistics): `notes/connect-design-prompt.md`.
      Design v4; built in 0.27.0.

### To build — after the owner agrees and the designs arrive
- [x] Letter-set chooser + word finder (reuse Letters' pool) — 0.26.0, 1–9 ms a puzzle.
- [x] **Crossword layout generator** — 0.26.0; `tools/test-connect.mjs` checks every board cell by cell.
- [x] The circle: drag with a path line, shake, shuffle; typing on a PC. 0.27.0
- [x] Board, bonus words, hints, give up, the end card. 0.27.0
- [x] New-game screen, saves, the games-list section, the statistics tab, Polish and English strings. 0.27.0
- [x] The four-game menu. 0.24.0

### Found while building it (2026-09-25)
- [x] **Offensive words** - Connect: never on the board, never a bonus (0.27.3); Letters: never hidden, never
      taken as a guess (0.27.5). `app/js/offensive.js`. Guess (Znaczenie) still accepts them as guesses - not asked.
- [ ] **The stoplist misses a vulgar word**: a Hard Polish board used *mineta*. Letters can hide it on
      Hard too - it is one pool. Add it (and a pass for others) to `NEVER_SECRET` in `tools/seeds.mjs`,
      then rebuild the word data (`node tools/build-data.mjs`, ~8 min).
- [ ] **Obscure dictionary words** reach the pool from a web corpus - *screen* (Polish rank 8 220), *nec*,
      *ren*. Connect's levels now go by frequency rank, which keeps the rarest off Normal; a curation pass
      with the stoplist would catch the rest.
- [x] **Decided (owner, 2026-09-25): C - leave it.** All-letter words that are inflected forms (STALI from LISTA, HATED from DEATH)
      are bonus words - the board takes base forms only. Options put to the owner: (a) allow them on the board,
      (b) avoid circles that have one, (c) leave as is. Base all-letter words are always on the board since 0.27.2.
- [ ] **Guess: leaving a game while its word data loads** can put it back on screen over the newer one (found by
      the 0.27.1 review; Letters and Connect guard against it now, `game.js` does not yet).
- [ ] **Not checked in a real browser yet**: the preview pane stayed tied to the old folder name for the
      rest of the session in which these were built. Rules are tested; screens were rendered in Node.
      A first look on the phone / in a new session is the check still owed.

## Rename to Lexling — DONE 2026-09-25 (0.18.0)
Asked 2026-09-25: rename the app "in GitHub and everywhere (folder name)", with the Android ID
built from the owner's GitHub name rather than the employer's.
- [x] Name everywhere the player sees it: logo LEX/LING (the slash stays orange, as in WORD/GUESS),
      the menu's big letters L/, window and page title, About text, footers.
- [x] Android ID → **`com.husarp.lexling`** (the old one named the owner's employer). First `io.github.husarp.lexling`;
      the owner chose `com.husarp.<name>` for all apps the same day, before that ID was ever built (the same form as Browser
      Switch's). Android sees a new app: the old one stays until uninstalled, its saves do not carry over.
- [x] Windows: program, setup, folders and shortcuts are Lexling. The setup recognises a WordGuess
      install and updates it: old program, shortcuts and uninstall entry removed, saves folder moved
      `%LOCALAPPDATA%\WordGuess` → `\Lexling` whole (the game does it too, on first start). Tested
      with throwaway folders and a fake registry (10 checks); the real install is exercised on the
      next build.
- [x] GitHub repository `Husarp/wordguess` → `Husarp/lexling`, the project folder `WordGuess` →
      `Lexling`. localStorage keys stay `wg.*` on purpose — renaming them would lose every save.
- [x] **The icon says "le"** now (was "gu", from Word**Gu**ess) — owner chose the letters, 2026-09-25, 0.18.1.
- [x] The other apps checked for the employer's name (Car Crash, Browser Switch, Lockdown): none has
      it. **Rule since 2026-09-25: every app is `com.husarp.<name>`** — no domain needs buying (nothing checks it).
      Car Crash already was; Browser Switch moved from `io.github.husarp.*`; whether Car Crash's
      `com.husarp.recklessdriving` should switch too is the owner's call (it would cost phone saves).

## OPEN QUESTIONS (waiting on owner)
- [ ] Polish badge names — current picks: Wordsmith → **Mistrz słów**, Typist → **Skryba**,
      Sharpshooter → **Snajper**. Change if you prefer others.
- [ ] After a give-up / win: also show the true top-10 closest words ("what was rank 1?")?
      Contexto does; not in the design, so not built.
- [ ] Badge tier thresholds (placeholder numbers in DESIGN.md §6) — tune later.
- [x] Final game name: **Lexling** (owner, 2026-09-25) — renamed in 0.18.0. It should fit all the games — three planned in M13, four since M14.
      Considered 2026-09-25: **Wordly** — advised against: 8+ "Wordly" games on Google Play (mostly
      Wordle clones), Wordly (wordly.ai) is an established company, and it is one letter from Wordle.
      English-only shortlist searched the same day (web + app stores, NOT trademark registers or
      domains): taken — Wordhoard, Wordtrove, Wordloom, Wordnest, Wordvault, Triword, Wordbound,
      Lexiloom, Verbarium, Lexorium, Wordspire, Letterfall, Lexicorn, Vocabulon, Wordwright. No app
      found — **Lexling** (recommended), **Wordlark** (but it starts "Wordl…"), **Guessary** (fits
      only the guessing games).
      **Lexling checked deeper, 2026-09-25:** no app of that name on Google Play or the App Store; in
      TMview (EU office plus national offices incl. France, Poland, UK, US) the only mark is an
      EXPIRED French one (LEXLING SASU, 2015, advertising / telecoms / software). Domains: .com taken
      (a French translation agency, lexling.com), .app .net .org .game .games free, .io probably.
      But two translation businesses use the name — that French one and **LexLing, a translation and
      language-school office in Wrocław since 2011** (lexling.pl). No legal block found; the catch
      is that in Poland the name already means "a translation office". Owner to decide.
      A rename is also the moment to change the Android app ID away from the old one
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
