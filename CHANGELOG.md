# CHANGELOG — WordGuess

All notable changes to this project are listed here. Newest on top.
Format: `X.Y.Z — YYYY-MM-DD HH:MM: <description>`
- X = major overhaul, Y = new feature/update, Z = minor fix or tweak

---

## 0.16.0 — 2026-09-24 23:56: Letters mode is playable — the second game in the app
*(not packaged yet)*

Built from the design agent's handoff (`design/letters/handoff/`, six screens), ported 1:1 like the
rest of the app, in both languages.

- **Main menu** — the Play button is now **one card per mode**, Guess and Letters, each with a small
  picture of its feedback and how many of its games are in progress. The grid takes a third mode
  without a redesign. "Your games" shows how many saves there are.
- **New game · Letters** — word length 3–13 (a stepper, plus a bar per length you can tap, showing
  how many words each length can hide right now), tries 1–20 or **unlimited**, category, difficulty,
  and for Polish the **Polish letters** switch. Settings that leave no word say so and disable Start.
  A category tells you it means a noun.
- **The game** — one box per letter; the phone's own keyboard types into a hidden field, so ż ó ł
  work by long press as usual. Nothing is sent until **Enter / Go / Guess**. A short row is refused
  ("Needs 5 letters — you typed 3") and outlined red; a non-word and a repeat are refused too. Boxes
  colour in one after another. With the keyboard open the screen shrinks to what is visible: message
  on top, the grid scrolling in the middle, Guess right above the keyboard. 13 letters fit a 320 px
  phone at 19.9 px a box.
- **Win / loss** — the word, tries used, the score with its sum written out (*7 letters (ż ó ł count
  ×2) ÷ 3 guesses × 100 × 1.25 Normal = 292*), your best if it is higher, and **Copy result**: plain
  text with 🟩🟨⬛ rows, never the word.
- **Your games** — one list for both modes, each card tagged with its mode; Letters cards show tries
  used and the last guess as bare squares. A filter (All / Guess / Letters), and **New game asks
  which game**.
- **Statistics** — Guess / Letters tabs. Letters has its own played, won, win streak, best score and
  average win, and **four badges**: Champion, High score, On a roll, Full range (with a strip of the
  lengths you have won at). Letters typed and time in game stay shared. Badge thresholds are the
  design's proposals.
- **Under the hood** — saves carry a `mode` (old saves read as Guess); Letters loads only the words,
  not the meaning vectors — 9 MB for Polish instead of 27; Guess's play-time clock is shared rather
  than copied.

Found while testing, fixed:
- **The design's hidden field was 1×1 px, and at that size the text cursor has no room** — Chrome
  kept it at the start, so Backspace deleted nothing and new letters went in front. Measured with a
  plain field: broken at 1 px, fine at 4em. It is 4em now, still invisible.
- **"LETTERS" in the top bar ran into the logo** on phones narrower than ~375 px (96 px of text in an
  84 px slot). It now tightens to fit, like every other label.
- A tap anywhere on the game (not only on the boxes) brings the keyboard back.

## 0.15.3 — 2026-09-24 23:40: Letters mode — which words can be hidden, and how hard they are
*(not packaged — nothing a player can see yet; the word data was rebuilt)*

**Difficulty means something different here.** The main mode's score is rarity + *meaning
isolation*, and meaning plays no part in this game. So Letters rates a word by **how well-known it
is** plus **how unusual its letters are** — rare letters, and repeated ones, make it harder. It is
worked out in the app from data already shipped, so the main mode's tuned difficulty is untouched.
It reads right: Hard 5-letter words come out as *khaki, quell, snuff, kiosk, glyph* and *dzicz,
brnąć, fiord*; Relaxed as *knife, habit, fruit* and *hotel, deser, cisza*.

**The pool** (`pool()`, `pick()`): any noun, adjective, verb or adverb among the 20 000 commonest,
in base form, never on the stoplist, with the Polish-letters switch, categories, and the same 20-word
floor as the main mode. Every length 3–13 at every difficulty has at least 20 words in both
languages. The first build per language takes 75 ms — it took a full second until the letter score
stopped being recalculated inside the sort.

**Two things had to be added to the word data**, found by looking before building:
- **The stoplist did not cover adjectives.** Nothing needed it to until now — then `shitty`, `horny`,
  `goddamn` and Polish `zajebisty` turned out to be valid hidden words. They are on it now, and the
  whole list ships in `vocab.json` as `blocked`.
- **Inflected forms posing as words.** `ptaki`, `stara`, `kota`, `nowe`, `loved` sit in the list as
  if they were base words. The app cannot tell — once a form is a word, the autocomplete list stops
  recording whose form it is — so the pipeline marks them as `formOf` while it still knows every
  word's forms: 2 396 Polish, 1 141 English. Each guard in that rule came from a word it first got
  wrong: participles and gerunds are kept (the first version threw out `życie`, *life*);
  dictionary-shaped adjectives are kept (`stary` is also a plural of the noun *star*); a base more
  than 10× rarer does not count (`głupi` is technically a form of the junk noun *głup*).

A few common verb forms still get through — `staje`, `dzieje`, `emocje` — roughly one game in 300.
Written up in PLAN.md with why the obvious fixes do more harm.

207 tests, all passing: the 16 rules tests, and every length × difficulty × language checked for
length, stoplist, forms, category membership and the Polish-letters switch. The main mode's word
counts are unchanged (6 214 Polish, 6 370 English secrets).

## 0.15.2 — 2026-09-24 22:11: Letters mode — the rules, before the screens
*(not packaged — nothing a player can see yet)*

The second game mode, a Wordle (PLAN.md M12), is fully specified and waiting on its screens from the
design agent. What does not depend on the design is built now, in `app/js/letters.js`:

- **`feedback(guess, answer)`** — green / yellow / grey per letter, with Wordle's exact
  repeated-letter rule: greens are settled first and use up their letter, and each leftover letter
  can turn one guessed letter yellow. Against `crane`, `eerie` gets its last `e` green and the other
  two grey. Polish letters with marks are separate letters: `zolw` is simply wrong for `żółw`.
- **`score(answer, guessesUsed, won, difficulty)`** — letters ÷ guesses used × 100 × difficulty,
  a marked Polish letter counting as two, a loss scoring 0.

`tools/test-letters.mjs` holds 16 tests, including the worked example from the plan (`żółw` on the
third guess at Normal = 292). Checked that the repeated-letter tests really discriminate: three of
the four fail the naive "yellow if the letter is anywhere in the word" version most clones start with.

Also measured for the plan: word lengths **3–13** hold in both languages — at 13 letters Polish still
has 247 words among its 12 000 commonest and English 198; English falls to 69 at 14.

## 0.15.1 — 2026-09-24 05:52: All rights reserved
*(not packaged yet)*

- **A licence, finally: all rights reserved.** The repository is public, and without a licence the
  rules were only implied. `LICENSE` now says it plainly: anyone may look at the code and download and
  play the releases, but copying, changing, sharing, selling or building on the game needs written
  permission.
- **What it cannot cover is named as such.** The word data derived from fastText stays under CC
  BY-SA 3.0 — share-alike, so it cannot be made "all rights reserved" — and the fonts under the SIL
  OFL. The LICENSE lists them, and README gained a *Licence* section.
- **In the game:** the Settings footer reads *WordGuess v0.15.1 · © 2026 Husarp · All rights
  reserved* (*Wszelkie prawa zastrzeżone* in Polish).

## 0.15.0 — 2026-09-22 17:05: A way to actually get the update, Body and School, and `kiwi`
*(not packaged yet)*

**The update check said an update existed and then stopped.** No button, no link, nothing to press —
you were told and then left to find it yourself. When one is waiting, the *Check for updates* button
now becomes **Get it →** and opens the release page, where the installer and the APK are.

Leaving the app has to be asked for differently in each of the three places this runs, so the button
tries them in turn. Android and a browser use the ordinary `window.open`, which Capacitor hands to
the system browser. The desktop app cannot: its window *is* the browser, so following a link would
replace the game with a web page and leave no way back. It now has a small bridge
(`window.pywebview.api.open_url`) that hands the link to the real browser instead, and it accepts
nothing but a `https://github.com/…` address.

**Seed pass for Body and School**, the same fix as Food and Nature: the words were all in the
dictionary and simply untagged.
- **Body 80 → 94** — `włos wąs brew podbródek pierś jelito śledziona pęcherz migdałek przepona`.
- **School 52 → 136**, which puts Polish *ahead* of English's 107: the school day itself
  (`szkoła klasa przerwa dzwonek`), its rooms (`korytarz szatnia boisko`), its equipment
  (`gąbka pióro cyrkiel ekierka tornister plecak`) and its paperwork
  (`dziennik ocena klasówka dyktando legitymacja ferie`).

**`kiwi` is in the game.** It was not missing from the dictionary at all — the lexicon was throwing
it away. Nouns that never change their ending are listed with no inflection flags, and flagless
entries are dropped unless they are very common, because most of them are stray inflected forms.
`kiwi` sits at rank 29 090 and so went in the bin, and even the ones that survived were marked
"other", which can never be the answer. Indeclinable loanwords are now named by hand and kept as
proper nouns: `kiwi mango awokado spaghetti sushi espresso whisky curry zoo jury bikini tabu menu`.
`kiwi` is now #7040, a noun, can be the secret, and lives in Food.

## 0.14.2 — 2026-09-22 16:10: A seed pass for Polish Food and Nature
*(not packaged yet)*

Polish was far behind English in these two — Food by 66 words, Nature by 38. The cause turned out not
to be missing vocabulary but missing *tags*: `las`, `dąb`, `sosna`, `mąka`, `orzech`, `bułka` and
fifty more were all in the dictionary with **no category at all**. A common word sits near several
categories at once, so it never wins one clearly and the categoriser leaves it out on purpose. A seed
word is a member by definition, so the fix is to name them.

- **Nature 71 → 147.** Trees (`dąb sosna brzoza świerk buk klon wierzba jodła modrzew topola`),
  flowers (`róża stokrotka tulipan mak słonecznik mniszek fiołek konwalia`), plants
  (`roślina krzew paproć porost kora pąk`), terrain (`źródło stok zbocze step tundra gaj bór
  puszcza`) and ground (`glina torf granit bazalt`).
- **Food 228 → 296.** Staples (`mąka bułka śmietana drożdże orzech`), baked goods (`naleśnik pączek
  rogalik piernik makowiec wafel beza`), meat (`stek kotlet schab boczek klops`), condiments
  (`musztarda majonez keczup chrzan szafran`) and the rest.
- **Animals 94 → 110**, because the fish had nowhere to live: `łosoś karp pstrąg dorsz makrela
  szczupak okoń sandacz tuńczyk halibut flądra`.

Three things came along that had to be sent away again, all of them sitting next to the seeds in the
vector space rather than belonging to the category:

- **cosmetics in Food** — `krem`, `peeling`, `balsam`, `puder`, `pasta`. Things you put on your skin,
  not in your mouth.
- **building materials in Nature** — `beton`, `cement`, `klinkier`, `tłuczeń`, `kruszywo`. The stone
  seeds pull in what stone is turned into.
- **brands and leftovers** — `nutella`, `milka`, plus `konie` (a plural kept as a word of its own)
  and diminutives whose stem shifts too far for the automatic rule (`masełko`, `jajeczko`, `bułeczka`).

## 0.14.1 — 2026-09-22 15:35: Guessing the same word again clears the box
*(not packaged yet)*

Typing a word that has already been guessed left it sitting in the field, so the player had to
delete it by hand before trying anything else. The word is not wrong, it is spent — so the field
clears itself and the suggestion list closes, while the message still says which word it was and
what rank it got. The cursor stays in the box, so the next guess can be typed straight away.

A word the game does not know is left alone on purpose: that one is usually a typo worth correcting
rather than starting over.

## 0.14.0 — 2026-09-22 15:20: Categories hide members of the category, and say what they cover
*(not packaged yet)*

Reported from a Polish game: the answer in **Animals** was `zwierzak` — a word meaning "animal".
Looking at the whole category explained why. Of its 150 words, about half were not animals:

| | |
|---|---|
| words meaning "animal" | zwierzę, zwierz, zwierzak, zwierzątko, pupil, czworonóg, drapieżnik, gryzoń |
| not animals at all | **pluszak** (a plush toy), **aniołek** (an angel), smok, wilkołak, pyszczek |
| pet names | sunia, kiciuś, piesio, misio, słodziak |
| the same animal again | kotek, kociak, koteczka, kocur, kocurek beside `kot`; piesek, psiak, suczka beside `pies` |

Nine of the twenty words a Relaxed game could pick were a dog or a cat. English had the same
disease in its own accent — `pet`, `zoo`, `leash`, `manure`, `mermaid`, `werewolf`, `veterinary`.

Two things now clean every category, and the word data was rebuilt with both:

- **A per-category blocklist** (`NOT_IN` in `tools/seeds.mjs`) for words *about* a category rather
  than *in* it. Four kinds keep appearing, so they are called out there: the category's own name,
  non-members, myths, and the people and places around the members.
- **Diminutives are dropped automatically.** A member is removed when the category already holds the
  shorter, commoner word it is built from. Polish reshapes the stem, so the ending is stripped first
  and the rest has to agree within two characters: ryba→rybka, świnia→świnka, ptak→ptaszek.

Polish Animals: 150 → 94, and all 94 are animals. Relaxed now offers *lis, pies, kot, ptak, królik,
ryba, wilk, koń, kaczka, tygrys, lew, krowa, niedźwiedź, wąż, motyl, orzeł*.

**English keeps its compounds.** A plain prefix rule deleted `rainbow`, `sunshine`, `snowfall` and
`raindrop`, because English builds new words from the same parts instead of shrinking them. The
ending now has to be a real diminutive, so those came back; English Animals loses 40 words to the
blocklist and only 4 to the diminutive rule.

**Every category now says what it covers**, under the chips on the new-game screen — 21 descriptions
in both languages. Animals reads *"Real animals, from pets to wild ones and insects. Never words
meaning 'animal', and never made-up creatures."* The point is to show where the edges are, so no one
spends guesses on a word the category will never hide.

## 0.13.4 — 2026-09-22 14:35: Hints could walk backwards
*(not packaged yet)*

Reported from a real game: with a best guess at rank 12, five hints in a row came back in the
12–14 range — no better than the guess already on the board — and only then one at rank 2.

Reproduced exactly. A hint aimed at **half** the best rank and then picked whichever candidate had
the lowest `|rank − target|`. Nothing said the answer had to be *closer* than what the player
already had. Once the good words near the target were used up, the cheapest one left was simply
further away, so the ladder walked backwards. Simulated from a best of 12:

```
żółw     5 → 9 → 11 → 12 → 15 → 16 → 19 → 24     every hint worse than the last
rower   17 → 7 → 38 → 15 → 19 → 34 → 36 → 41     and the first one worse than the player's 12
kot      7 → 2 → 10 → 11 → 19 → 26 → 28 → 36
```

A hint now has a hard ceiling: it must be **strictly closer than the best guess so far**. When there
is no progress left to give, none is offered — better than a worse word dressed up as help. The
`±40` window around the target is gone, since the ceiling does that job properly.

The ladder over a whole game now halves cleanly, 8–10 hints from a standing start:

```
kot      473 → 230 → 97 → 49 → 26 → 11 → 7 → 2
doctor   511 → 253 → 128 → 69 → 37 → 29 → 16 → 8 → 4 → 2
```

Checked across 13 secrets in both languages: **not one backwards step**.

## 0.13.3 — 2026-09-22 12:31: Put the project under Git
*(no code change, repository housekeeping)*

- `git init`, branch `main`, first commit `1314ad9`: 152 files, 41.5 MB. The 2.6 GB of raw fastText
  vectors, `build/`, `node_modules/` and everything Gradle regenerates stay out, as `.gitignore`
  already said. Largest committed file is `app/data/pl/vectors.bin` at 17 MB, well under GitHub's
  100 MB ceiling.
- Added `.gitattributes`. Without it Git would have "helpfully" converted `app/data/*/ac.txt` to CRLF
  on checkout, and since `engine.js` splits that file on `\n`, every word would carry a trailing `\r`
  and **no guess would ever match** on a fresh clone. The data files are now marked binary and the
  whole tree is pinned to LF.
- The project then moved accounts: it lives at **github.com/Husarp/wordguess**, public, and every
  commit was rewritten onto a GitHub noreply address so no personal email is in the history.
  `REPO` in `app/js/version.js` points there, which is what the Settings update check reads.
- **First packaged release.** `WordGuessSetup.exe` (52 MB) and `WordGuess-debug.apk` (35 MB) carry
  0.13.3, so everything in 0.13.0 through 0.13.2 — hints, the Relaxed level, absolute difficulty
  bands, the message above the field and the spelling fixes — ships for the first time here.

## 0.13.2 — 2026-09-22 12:04: One row per spelling — an ambiguous word is offered once
*(first shipped in 0.13.3)*

Reported: typing `płazy` offered it **twice**, once pointing at *płaz* and once at *płaza*. Both are
correct — `płazy` is a legal plural of *płaz* (the animal) and of *płaza* (the flat of a blade) — but
two rows spelled identically, told apart only by an arrow to two words differing by one letter, read
as a bug. **19 928 Polish forms (4.5 %) are ambiguous like this**; English has 12.

An ambiguous spelling now gets **one** row, and `resolve()` plays the same word the list shows, so
Enter and the top suggestion can never disagree. Four tests decide which reading wins:

1. **A spelling that is itself a dictionary word means that word.** Verified exhaustively: all 60 000
   Polish and 41 158 English words typed in full still resolve to themselves.
2. **A word the engine can hide beats one it never will** — `leaves` → *leaf*, not the verb *leave*;
   `anteny` → *antena*. Frequency gets 1 763 Polish cases like this wrong on its own.
3. **Where one base word starts the other, the shorter one wins** — `płazy` → *płaz*, `koty` → *kot*,
   `maje` → *maj*, `halves` → *half*. In Polish the longer one is nearly always the artefact.
4. **Otherwise the more common word** — `byli` → *być*.

Test 3 carries a guard: the shorter word must not be more than **10×** rarer than the one it displaces.
Without it `has` became *ha* (235× rarer) and `głupie` became *głup*. Measured across all 19 928
ambiguous forms, test 3 overrules frequency 952 times and the widest gap among the good ones is 5×
(*maj* under *maja*), so the cutoff has room on both sides.

Checked: 8 205 sampled suggestion lists contain **no** duplicate spelling, every case above resolves
as listed, and a keystroke costs ~1 ms (0.6 ms before), which no one will feel.

Known and left alone: a handful of junk dictionary entries still win test 3 — `okularach` → *okular*
(the eyepiece) rather than *okulary* (glasses), `czerpie` → *czerp*. Those are bad words in the source
dictionary, not a bad rule; the fix is the pipeline stoplist at the next data rebuild.

## 0.13.1 — 2026-09-22 11:18: The game's reply moved above the field; your own spelling wins
*(first shipped in 0.13.3)*

Two things reported from the phone, both real.

- **"Guess does nothing."** It did work — the reply ("that word was already guessed", "not a word I
  know") was printed *below* the field, which is exactly where the suggestion list drops. The list
  covered it every time, so pressing Zgadnij looked like it did nothing at all. The message now sits
  **above** the field, inside the sticky block, so it is on screen with the keyboard open too.
- **The suggestion list put a corrected spelling ahead of the word actually typed.** Typing `płazy`
  offered `plaży → plaża` first, because both spellings fold to the same letters (ż→z, ó→o) and the
  order was whatever the sorted list happened to give. The spelling written now always comes first:
  `płazy → płaz`, `płazy → płaza`, then `plaży → plaża`. Fuzzy matching still corrects you — it just
  never does so ahead of the word you wrote.

## 0.13.0 — 2026-09-22 10:42: Hints, a Relaxed level, and difficulty that means the same everywhere
*(first shipped in 0.13.3)*

The game was too hard, and measuring it showed why: **difficulty was a frequency slice inside the
category, so it meant something different in every one**. Easy Animals averaged difficulty 49 while
easy Jobs averaged 14 — because only five of the 150 Polish animals are genuinely easy and 109 of them
are above 60. Tools had no easy words at all. That is why "easy, with a category" still felt brutal.

- **Difficulty is now an absolute band** on the word's own difficulty score: Relaxed ≤ 25, Easy ≤ 40,
  Normal ≤ 60, Hard above. Easy in Animals is now as easy as Easy in Jobs. Where a category has too few
  words in a band (Tools, Nature), it falls back to the easiest ones it has rather than refusing, and
  the readout shows the real number: *"3–9 letters · 23 words this game can hide"*.
- **New Relaxed level** — the words everybody knows (1 032 PL / 1 326 EN in All: *czas, rok, dzień,
  miasto, film*). Jobs Relaxed gives *lekarz, aktor, pisarz* rather than *kontroler* and *żeglarz*.
- **Hints**, on Contexto's rule: a hint is a word at **half the rank of your best guess**, so early
  hints only point a direction and they close in as you do. Unlimited, and they stop when your best
  guess is already rank 2. Two additions of our own, both found by testing against the real data:
  · prefer a **different part of speech** than the secret — for *kot* that gives *perski, śpi, pieski*
    rather than *pies*;
  · only offer **words people know**, because without that filter *żółw* was hinted with
    *sumatrzański* and *jukatański* — species-name geography, perfectly well ranked and useless;
  · and never a word from the secret's own family, after the first version answered *żółw* with
    *żółwi* and *wiatr* with *wiatru*.
  A full ladder now reads: *turtle* → serpent · marsh · mermaid · duck · crab · lizard · snail.
- Hints appear in the list as outlined boxes marked **hint**, with their rank, and the button sits
  under the field so it is still reachable with the keyboard open. They do not count as guesses, and a
  win reached with hints does not count toward Sharpshooter, Giant Slayer, Deep Cut or the average —
  it still counts as a win, and for Explorer and Polyglot.
- The text-fitter now drops letter-spacing **before** shrinking a label: nobody notices lost tracking,
  everybody notices small text. With four difficulty buttons, Polish labels stay full size at 320 px
  where they used to fall to 9 px.
- Opening-word suggestions were considered and dropped — you can already type any word you like.

## 0.12.0 — 2026-09-22 05:07: Full screen on Android, and every game starts from the same settings

- **The desktop shortcut kept the old icon** while the taskbar showed the new one — Explorer caches a
  shortcut's icon against its path, so rewriting the file changed nothing. The installer now deletes
  the shortcut before writing it and calls `SHChangeNotify`, which tells the shell to re-read icons.

- **The phone's status and navigation bars are gone while playing.** `MainActivity` hides both and sets
  them to slide back in on an edge swipe and then hide again, which is worth roughly two more guess
  boxes on a phone. The app also draws into the **display cutout** on purpose: the system would
  otherwise black that strip out, and now the page owns the whole screen while keeping its own content
  clear of the camera — Android reports the cutout as `env(safe-area-inset-top)`, which the CSS from
  0.11.2 already pads by. The bars are re-hidden when the window regains focus, because Android brings
  them back after the keyboard and after a swipe.
- **A new game always starts from the same settings**: category *All*, length *Any*, difficulty
  *Normal*, friend mode off. Only the **language** carries over, since that is a preference rather than
  a per-game choice. Half-made choices still survive the re-render that switching language causes.

## 0.11.2 — 2026-09-22 04:59: Safe-area insets for Android, and the picker label again

- **Safe areas.** Targeting SDK 35 means Android 15 draws the app edge-to-edge, under the status bar,
  the camera notch and the gesture bar. The shell now reserves that space — top bar, main column,
  footer and the menu hero all add `env(safe-area-inset-*)`, sides included so a landscape notch is
  handled too. With the keyboard open the top bar is hidden, so the main column takes over the top
  inset and the field still clears the notch. Checked with a simulated 48 px status bar and 24 px
  gesture bar: the field starts at 64 px, the bottom padding grows to 40 px, and with no insets
  (desktop) the numbers are exactly what they were before.
- The picker label reads **"najlepsze słowo: wydalanie · 344"** / "best word:" — *najlepsza próba*
  repeated the word *próba* already on the left of the same line ("3 próby … najlepsza próba").

## 0.11.1 — 2026-09-22 04:48: Polish wording and the game name, from playing the APK

- **Game names follow the interface language.** They used to be written into the save at creation
  ("Game 2" forever, even in Polish). An unnamed game now keeps only its number and is spelled by
  whichever language is on; a name you type yourself is still yours and is never touched. Old saves
  called "Game 4" / "Gra 4" are converted on load.
- **"Poddaj się" → "Poddaję się"**, and the picker's `najlepsza` (which disagreed with whatever word
  followed it: *najlepsza wydalanie*) is now **"najlepsza próba:"** / **"best guess:"**.
- Badge descriptions start with a capital letter (`::first-letter`, so the translations stay as they
  are and every language gets it).
- The win card no longer repeats "best win" — it says nothing the screen doesn't already show.

## 0.11.0 — 2026-09-22 04:42: First Android build — `WordGuess-debug.apk`, and a layout for the half screen

M6. The same `app/` folder now ships as an APK as well as the Windows installer, built from the terminal.

- **`build\WordGuess-debug.apk`, 34.5 MB**, package `com.trivioflow.wordguess`, target SDK 35.
  `scripts\build-android.ps1` does the whole thing (`-Install` also pushes it to a connected phone);
  it points at the Android SDK in `%LOCALAPPDATA%` and the JDK 21 inside Android Studio, so neither
  needs to be on PATH. Verified the word data really is inside the package: `data/pl/vectors.bin`
  17.2 MB and `data/en/vectors.bin` 11.8 MB are there, along with the fonts and every script.
- **Built for the keyboard-open half screen**, which is where the game is actually played. When the
  viewport goes short while something is focused, the document gets `[data-kb]` and the game screen
  compacts: the brand bar and the status row step aside, spacing tightens, the guess boxes shrink from
  60 px to 52 px, and the input sticks to the top with the list scrolling under it. Measured in a
  360×370 window (a 360×800 phone with the keyboard up): the field, the four suggestions and **five of
  six guess boxes** are fully visible, with no page scrolling sideways.
- A guess that lands outside the top five sits at the bottom of the list, which can be under the fold
  on a phone, so after each guess the newest box is scrolled just into view (`block: 'nearest'`, so it
  does nothing when the box is already visible).
- Keyboard detection covers both Android modes — the WebView resizing (`adjustResize`, set in the
  manifest) and panning — by measuring `visualViewport` rather than trusting either.
- Launcher icons and splash screens generated from the caret mark for every density, dark variants
  included.
- Not done yet: the APK has not been run on a real phone (none connected), so the safe-area insets
  (notch, gesture bar) and the load time of 27 MB of Polish data on a phone are still unmeasured.

## 0.10.0 — 2026-09-22 04:25: Five new badges, and a category no longer makes a win "fast"

The owner spotted that winning inside a category is much easier than an open game, so the speed badge
was cheap to earn. Measuring it first turned up the opposite of the obvious: by the difficulty score,
category secrets are **rarer** than uncategorised ones (PL animals 69 vs all 46), because categories
reach to rank 30 000 while "All" stops at 12 000. But that score does not know the player was *told the
category* — and that hint cuts the search from 6 207 words to ~150, which is what makes those games
quick. So the rule is about the hint, not the word.

- **Speed and difficulty count only category-free, non-friend games**: Sharpshooter, Giant Slayer,
  Deep Cut, the average-win stat and *hardest word beaten*. Wordsmith and Typist keep counting
  everything, because they measure typing, not winning. The badges screen says so in one line.
- **Five new badges**, all shown as the same tier ladder:
  · **Giant Slayer** — the hardest word you have beaten. Tiers **45 / 55 / 65 / 72 / 79** taken from the
    data: an uncategorised secret tops out at difficulty 82 (PL) / 85 (EN) and 79 is the 99th
    percentile in both, so the 85 and 95 tiers originally proposed were simply unreachable.
  · **Deep Cut** — wins on a word of difficulty 70 or more (the top ~10 % of the open pool): 1/3/10/25/50.
  · **Explorer** — categories won in at least once, all 21 including "All" at the top: 3/6/10/15/21.
  · **Marathon** — **active** play only: the clock now counts a second solely when the game screen is
    open, the window visible and something was typed within the last minute. The *time in game* stat
    uses the same clock and says "active play". Tiers 1 h / 5 h / 20 h / 50 h / 100 h.
  · **Polyglot** — wins in both languages, counted in the weaker one: 1/3/10/25/50.
- **Four bugs fixed**, three of them found by a review agent run over the change before building:
  · Polyglot counted friend-mode wins, so it could be farmed with somebody handing you the word — it
    now follows the same rule as Explorer.
  · The activity listeners were added to the app root on every visit to the game screen and never
    removed (found while writing the timer, fixed before the review).
  · **A router race**: a screen that awaits its word data could lose the race to a newer navigation and
    still install itself, leaving its 1-second timer running over somebody else's screen — double
    counting play time and re-saving an abandoned game. `render()` now discards a render that has been
    overtaken, and the game timer also stops as soon as its own DOM is gone.
  · Marathon's ladder read "1.0 h" and "5.0 h" next to "20 h"; the trailing `.0` is gone.
- Removed `short()` from `badges.js`, orphaned by the tier-ladder rewrite.
- Verified: each rule checked against a simulated category win, open win and friend win (only the open
  one moved Sharpshooter, Giant Slayer and Deep Cut; the category win still fed Explorer); the active
  clock proven to run while typing, stop after a minute idle and resume; badges render correctly from a
  save that predates all the new fields; every badge string present in both languages; layout clean at
  320×480 and 1280×720 with eight badges.

## 0.9.0 — 2026-09-22 04:09: 20 categories, badge tier ladder (design 1b), hardest-word stat, UI follows the game language

- **Categories reworked**, 7 → **20**: *Objects* and *Places* are gone (too vague to be a hint), and the
  set is now Animals, Food, Household, Clothing, Tools, Technology, Vehicles, Buildings, Nature,
  Weather, Body, People, Jobs, School, Science, Sport, Music & art, Feelings, Abstract and **Verbs**.
  Verbs is a part-of-speech category — it cannot be described with example words, so the pipeline fills
  it directly (4 659 PL / 2 904 EN). Sizes for the rest run from ~50 to ~550 words per language.
  Two tuning passes were needed: the first let *school* drift from stationery into office and abstract
  words, so the second round now only promotes very confident members (0.50 → 0.56) and the ambiguous
  seeds were replaced.
- **Badges rebuilt to design 1b "Tier ladder"** with the key states from the design's *"States,
  whichever direction wins"* block: five keys I–V, earned ones tinted in their tier colour, the next
  one outlined, thresholds always under them, and a track showing *620 of 2 000 · 1 380 to Gold* with
  a bar that fades from the current tier's colour to the next one's. A tier unlocked since you last
  opened the screen wears the brand accent with a glow — the only place the accent appears, exactly as
  the design asks.
- **New statistic: hardest word beaten.** Difficulty is baked into the word data per possible secret,
  0–100, from **rarity** (its place in the frequency list) and **isolation** (the average similarity of
  its ten nearest neighbours — a word in a crowd like *kot* is easy to close in on, a lonely one is
  not). Length is deliberately not used. Hardest Polish words came out as *ukłuć, ciec, leźć, szadź,
  gołoledź*; easiest as *sprawdzić, ojciec, lekarz, piątek*. Friend-mode wins don't count.
- **The interface follows the game language** — picking a Polish game switches the UI to Polish — until
  you choose an interface language by hand in Settings or the menu, after which your choice is kept.
- Verified: every screen × EN/PL × 320×480, 360×400 and 1280×720 with the 21 category chips → no
  overflow or clipping; the fresh-unlock state clears after one visit; no console errors.

## 0.8.0 — 2026-09-22 03:38: Spelling-tolerant suggestions, theme colour, Esc = back, badge/stats rework

Everything from the second round of feedback except the category rework, which needs a decision first.

- **Better suggestions** (new setting, on): typing a word the way it sounds still finds it —
  `rzaba → żaba`, `gura → góra`, `domb → dąb`, `wengiel → węgiel`, `halas → hałas`. Done by trying the
  confusable spellings of what you typed (rz/ż, u/ó, om-on/ą, em-en/ę, ch/h; English gets ph/f, ck/k,
  ie/ei, -ance/-ence, -able/-ible, our/or) as extra prefix searches — no extra index, ~24 binary
  searches per keystroke. The correct spelling always ranks first: `morze` still finds *morze* before
  *może*.
- **Theme colour**: eight accents in Settings (orange stays the default). One pick recolours everything
  — `--accent-hover` is the colour at 78 %, `--accent-soft` the same at 16 %.
- **Esc = back**, one screen up (game → games → menu). It listens on the document, so the autocomplete
  and the rename field consume their own Esc first.
- **Top bar**: brand centred (a 1fr / auto / 1fr grid), back button moved to the left, screen note on
  the right.
- **Game picker** shows the closest word, not just its rank: *best · water · 28 107*.
- **Badges**: Sharpshooter now reads "win in less than 12 moves for Gold" and the tier squares show
  bare numbers. To keep that label exactly true, the rule is now strictly fewer than the number
  (winning in 12 no longer earns the "12" tier — 11 does). Descriptions rewritten; the "filled square =
  unlocked tier" legend is gone.
- **Statistics**: *win streak* replaced by **average win** (guesses per won game, one decimal, friend
  games excluded); the "unique" sub-line dropped from *words guessed* since the Wordsmith badge is
  exactly that number.
- Verified: every screen × EN/PL × 320×480, 360×400, 430×900, 1280×720 → no overflow or clipping; Esc
  checked from every screen including "closes the suggestion list first"; no console errors.

## 0.7.0 — 2026-09-22 03:27: Polish suggestions are Polish, latest guess always shown, livelier colours, icon fixed

Four things from playing the installed build.

- **Suggestions stay in the language.** The Polish dictionary genuinely lists English words, and pure
  English tokens had slipped in too, so typing "ga" in a Polish game offered *game* and "cra" offered
  *crawl*. A word now counts as the other language's when it has **no inflected form of its own here
  and the other language uses it ≥ 4× more** (by frequency rank): **723 words dropped from Polish**
  (the, game, love, crawl, you, my…), 31 from English (km, mm, cos, mgr, filmy…). Borrowings Polish
  really inflects stay (link, team, weekend, crack → cracka), and so do Polish words English also has
  (do, jest, ale, pod) because Polish uses them at least as much. `KEEP` in `tools/seeds.mjs` holds the
  one deliberate exception, English "ten" (Polish *ten* is 25× more common on the web).
  The freed slots refill from the frequency list, so the vocabulary is still 60 000 / 41 158.
- **The newest guess always gets its own box at the bottom**, next to the input, even when it is also
  standing in the top five — that is where the eye goes after pressing Guess.
- **Livelier colours.** The fill ramp is brighter and more saturated (`#FF3B30 → #FF7A18 → #FFC531 →
  #2BD96B`) at .78 opacity instead of .55, with a small text shadow so white stays readable on the
  amber end. The colour stops also moved down (25/47/70/85 → 15/38/58/75): with 60 000 words, rank 25
  is an excellent guess but only 71 % "close", so green now starts where good guesses actually land.
  Compared four candidate ramps side by side before choosing.
- **The app icon was stale.** PyInstaller's rebuild check ignores the icon file, so every build after
  the icon change re-used the cached exe and shipped the old "W/" mark — the setup exe had the new one,
  the installed app did not. `scripts/build.ps1` now drops the cached exe before building (the
  expensive analysis cache is kept). Verified by extracting the icon back out of the built exe.

## 0.6.0 — 2026-09-22 00:47: Design v2 — rounded UI, and secret length is a band with a real histogram

`WordGuessv2.zip` → `design/v2/handoff/` (v1 kept in `design/v1/`). Five screens changed only in the
shared CSS; `new-game.html` changed for real.

- **Rounded everywhere**: radius tokens 2/4/8 px → **10/12/16 px** (+ a pill token), cards now use the
  large radius. **Segmented controls** are no longer one bordered block: a padded surface holding
  separate 10 px-radius buttons.
- **Secret length** is now a **band** — Short (3–5) / Medium (6–8) / Long (9+) / **Any** — instead of a
  "max letters" slider, with a **histogram of the real word lengths** for the chosen language and
  category, the band's bars highlighted, and a live readout: *"6–8 liter · 2 658 słów · 43% słownika"*.
  The numbers are computed from the actual secret pool (`lengthStats()` in `engine.js`), so picking
  Animals or switching language redraws it; an empty band says so instead of failing at Start.
  Saves store `band`; the game picker shows it; older saves without it simply omit the chip.
- **Two fixes the design could not show**, both found by the responsive sweep:
  - v2's segmented control does not wrap, so the min-content width of four Polish labels pushed the
    whole form to 315 px inside a 294 px column — the page scrolled sideways on a phone. `.field`
    and `.seg` may now shrink, which is also what lets `fit.js` see the labels and shrink them.
  - With the design's fixed 12 px side padding, "DOWOLNE" / "KRÓTKIE" still shrank to 9 px even at
    412 px wide. Padding is now `clamp(4px, 2vw, 12px)`: full labels from 360 px up, the design's
    own spacing from ~600 px up.
- **Verified**: every screen × EN/PL × 320×480, 360×400 (split-screen), 360×800, 768×1024, 1280×720 →
  no overflow, clipping or spills; counts cross-checked against the word data (PL animals
  74/79/31 short/medium/long, EN all 1 711/2 737/1 918); a game played through in both languages;
  no console errors.

## 0.5.1 — 2026-09-22 00:22: App icon — concept 2b "Caret", black (from the owner's icon sheet)

`WordGuess Icon Ideas.dc.html` arrived; the owner picked **2b Caret, black variant**. `tools/make-icon.py`
now reproduces that tile instead of the earlier W/ placeholder: black squircle, "gu" in Barlow
Condensed ExtraBold white, orange text caret after it.

- The script follows the design tile's own CSS rather than eyeballing it — `font-size` 106/144 of the
  tile, `border-radius` 36/144, `letter-spacing` −.03em after every character, the span centred with
  its .15em right margin, nudged up .15em, the caret at .05em/.14em/.1em/.92em off the span's box.
- Verified against the browser: the span box (x 136.6, y 22.0 at 1024 px) and the caret
  (812 / 127 / 76 × 694) match Chromium's layout to within a pixel, PIL's font metrics equal
  Chromium's (ascent 754, descent 151), and an overlay of the two in `mix-blend-mode: difference`
  is black apart from antialiasing hairlines.
- Each ICO frame (16 / 24 / 32 / 48 / 64 / 128 / 256) is drawn at 4× its own size and reduced,
  rather than shrinking one 1024 px master — noticeably crisper at taskbar sizes. Also writes
  `assets/wordguess-1024.png` for the Android icon and stores later.
- Rebuilt: `build\WordGuessSetup.exe` 52 MB, self-test OK, and the new icon is embedded in both
  `WordGuessSetup.exe` and `WordGuess.exe` (checked by extracting it back out of each exe).

## 0.5.0 — 2026-09-21 23:30: Windows installer — `WordGuessSetup.exe` (M5, install/update/uninstall)

Same system as Reckless Driving ("Car Crash") and Lockdown: build with `scripts\build.ps1`, run the
one Setup exe to install or update in place; saves are outside the program folder and survive updates.

- **`desktop/main.py`** — pywebview/WebView2 wrapper. Fixed port 42027 (the origin the saves belong
  to), `private_mode=False`, profile in `%LOCALAPPDATA%\WordGuess`, single instance (a second launch
  focuses the first). Differences from Reckless Driving, both because this app is a folder of files:
  it serves `app/` from its **own local server with `Cache-Control: no-cache`** (the kept WebView2
  profile also keeps the HTTP cache; `?v=` on one file cannot reach modules and `fetch()`ed data, so
  an update would run last version's scripts) and with explicit MIME types (Windows' registry can map
  `.js` to text/plain, which browsers refuse as a module). Window is created **hidden on black and
  shown when the first screen is drawn** (`data-ready` set by `app/js/main.js`).
- **Bug caught by the self-test before shipping**: loading both languages at once = 8 parallel
  requests, Python's default listen backlog is 5, Windows reset the rest → "Failed to fetch".
  Server backlog raised to 64; the self-test keeps loading both languages in parallel on purpose.
- **`installer/setup.py`** — tkinter Setup ported from Reckless Driving: per-user install to
  `%LOCALAPPDATA%\Programs\WordGuess`, no admin/UAC, Install / Update / Re-install wording from the
  registry's DisplayVersion, Start-menu + desktop shortcuts, "Apps & features" entry, uninstaller
  (saves kept unless ticked). **`installer/wordguess.spec`** — one-folder PyInstaller build bundling
  all of `app/`.
- **`scripts/build.ps1`** — reads the version from `app/js/version.js` (single source; generates
  `build\gen\version.py` for the installer), checks the word data exists and nothing references the
  network, builds the exe, runs the hidden **self-test** (version match, fonts, localStorage
  writable, 60k + 41k words load), zips the payload, builds the Setup exe. Uses the project's `.venv`
  if present, else the Car Crash project's (nothing had to be downloaded).
- **Icon**: `tools/make-icon.py` draws the brand mark (white W, orange slash, Barlow Condensed) →
  `assets/wordguess.ico`.
- **Result**: `build\WordGuessSetup.exe` **52 MB**, 65 MB installed (171 files). Verified: packaged
  exe self-test OK; payload extracted with the installer's own `copy_files()` into a scratch folder
  and that copy's self-test OK; normal launch shows the window after ~3.9 s; second launch exits.
  Not exercised by me: the Setup window's buttons, shortcuts and registry entry (left for the owner
  to run once).

## 0.4.0 — 2026-09-21 23:18: Real word data — 60 000 Polish + 41 189 English words (M1 done)

Owner approved the download of the fastText vectors (`cc.pl.300.vec.gz` 1.27 GB, `cc.en.300.vec.gz`
1.33 GB → `tools/raw/`, build-time only). The synthetic 250-word placeholder is gone.

- **Pipeline** (`node tools/build-data.mjs`, ~2 min, zero dependencies): `fasttext.mjs` (streaming
  reader + caches), `hunspell.mjs` (affix-rule expander), `lexicon.mjs` (base words, parts of speech,
  inflected forms for PL and EN), `vecmath.mjs`, `seeds.mjs` (category examples + never-secret list).
  Word knowledge comes from the Hunspell dictionaries already on this PC with LibreOffice
  (sjp.pl `pl_PL`, SCOWL `en_US`, WordNet thesaurus for English parts of speech) — no extra download.
- **Output** (40 MB): per language `vocab.json`, `vectors.bin` (int8, 300 dims), and the pre-sorted
  autocomplete list `ac.txt` + `ac.bin` (replaces `forms.json`): 383k Polish + 32k English
  inflected forms, limited to forms that actually occur among fastText's 2M web tokens.
- **OP-word fix, measured**: with plain cosine 650 Polish / 218 English words landed in the top
  1000 for over 5× their fair share of secrets (`historia` for 20 % of them). The planned λ-penalty
  against the whole vocabulary changed nothing (that average is ≈ 0). Scoring is now a per-word
  **z-score against the pool of possible secrets** → 0 / 0 such words; `well` and `humanity` rank
  ~28 000 for `crab`. Engine: `(cos − hub[i]) / spread[i]`. PCA to 128 dims was dropped (not needed
  for size, full vectors rank better); removing principal components was tried, no gain.
- **Forms**: `psami → pies`, `robiłem → robić`, `czasu → czas`, `went → go`, `stopped → stop`,
  `teachers → teacher`; derivation stays separate (`teacher` ≠ `teach`). Ambiguous spellings read
  noun-first (`żółwie` → `żółw`, not the adjective `żółwi`). Dictionary-listed forms are folded into
  their base with rules that keep mutual pairs (`kot`/`kota`, `polityk`/`polityka`) apart — an
  earlier frequency-only rule had deleted `kot`, caught by the build's own sanity check.
- **Secret pool**: nouns ≥ 3 letters in the top 12k words, not readable as another word's
  inflection, minus a hand-kept stoplist (function-word homonyms, abbreviations, numerals, vulgar
  and grim words): 6 145 PL / 6 366 EN. **Categories** by nearest hand-picked examples, two rounds:
  94–946 words each.
- **App**: engine reads the new format; suggestions = exact spellings, then most common base words,
  then forms; data starts loading when the New Game / picker screen opens (Start → game in ~0.1 s);
  part-of-speech labels for adverbs; About text no longer mentions test data or PCA.
- **Verified** in the real UI: Polish category game and English game played through (autocomplete,
  forms, ranks, fills, win); zero console errors. Timings on this PC: Polish data load ~1.3 s
  (hidden behind the preload), ranking per game ~0.3 s.
- Removed `tools/make-dev-data.mjs` (its word lists live on as category examples). Added `.gitignore`
  for `tools/raw/`.

## 0.3.0 — 2026-09-21 22:17: First playable build — full UI from the design handoff, EN + PL

The design arrived (`WordGuess_design.zip` → `design/handoff/`, six screens) and is implemented
as a single-page app in `app/`.

- **UI**: all six screens ported 1:1 from the handoff (shared token/CSS block verbatim;
  per-screen CSS only prefixed with a screen scope because the files reuse `.empty`, `.bar`,
  `.form` with different rules). Fonts (Barlow Condensed 700/800, Inter 400/500/600) bundled
  locally — copied from Lockdown's assets, no download. One design omission fixed: the guess
  `<ol>` kept the browser's 40 px indent, so boxes didn't line up with the input.
- **Game**: rank scoring engine (int8 vectors, hubness-corrected cosine, full-vocab ranking per
  game, logarithmic fill %, continuous colour ramp), form→lemma collapsing with the
  "psami → pies" note, diacritic-insensitive autocomplete (`zol` → żółw) incl. inflected forms,
  top-5 boxes with slide-in / glide (FLIP) / fill-grow animations, latest-guess row, full
  history, win and give-up states, friend mode, multiple autosaved games with rename/delete.
- **Localisation**: every string in English and Polish (Play → Zagraj), Polish plural forms
  (1 próba / 2 próby / 5 prób), PL · EN switch on the menu + in Settings.
- **Text-fit guarantee** (`js/fit.js`): labels shrink → lose letter-spacing → wrap, and may not
  even eat into a button's padding; the guess field reserves room for its button per language.
- **Stats & badges**: lifetime stats, time in game, Wordsmith / Typist / Sharpshooter with
  Bronze→Amethyst tiers; friend-mode games excluded from best win / streak.
- **Load quality**: page colour before CSS, theme before first paint, fonts preloaded, first
  render waits for fonts → no white flash, no font swap, no layout shift.
- **Settings**: app language, dark/light/system theme, sound (WebAudio click + chime), update
  check against GitHub Releases (disabled until `REPO` is set in `js/version.js`).
- **Dev tooling**: `tools/make-dev-data.mjs` (250 words/language, synthetic vectors, final data
  format — placeholder until the fastText pipeline, M1) and `tools/serve.mjs` (static server).
- **Verified**: full play-through (guess, forms, unknown/duplicate words, reload mid-game, win,
  stats); automated overflow scan of every screen × EN/PL × 320×480, 360×400, 360×800,
  768×1024, 1280×720, 1920×1080 → zero overflow / clipping / off-screen; zero console errors.

## 0.2.2 — 2026-09-21 22:05: Localisation + text-fit requirements; design handoff incomplete

PLAN.md: added full-UI Polish localisation (every label switches, Play → Zagraj) and a
text-fit guarantee (longer Polish strings must fit buttons in every window size) to M3.
Recorded a BLOCKED item: the delivered `WordGuess Handoff.dc.html` is only an index page —
the six `handoff/*.html` screens, `support.js` and the design-system fonts it references
were not included, so no UI was implemented yet.

## 0.2.1 — 2026-09-21 21:45: Remaining design decisions settled

Guess ranking = top-5 boxes + full-history expander (confirmed); top badge tier = Amethyst;
achievements and lifetime statistics (words guessed, letters typed, games played/won,
time in game, streaks) share one screen. Added DESIGN.md §7: design handoff format — the
design agent delivers one self-contained HTML+CSS file per screen with dummy data and CSS
variables, ported ~1:1 into the app instead of being rebuilt from images.

## 0.2.0 — 2026-09-21 21:20: Design corrected & extended after owner feedback

Score is the guess's absolute rank (1 = closest, thousands = cold), not 1–6 buckets — the
earlier bucket table was a misreading. Added: inflection→lemma collapsing design (odmiana
collapses, derivation like parking/park does not; researched — Contexto/Semantle don't do
this and it causes known absurdities), top-5 guess boxes UI with animated red→green
logarithmic progress fills, hard rendering-quality/responsiveness requirements (§4a —
no load glitches, Android split-screen, live resize test matrix), badge list (Wordsmith /
Typist / Sharpshooter, Bronze→Amethyst tiers), both languages bundled offline (≤100 MB
budget), Android builds from terminal. PLAN.md milestones updated to match.

## 0.1.0 — 2026-09-21 20:57: Project created — planning documents

Initial planning pass, no code yet. Created README.md (project overview), DESIGN.md (core
loop, embedding-based 1–6 scoring, hub/OP-word countermeasures, screens, tech choices) and
PLAN.md (milestones M1–M6 + open questions). Tech direction: HTML/JS game core (like
Reckless Driving), pywebview + Setup.exe/GitHub-release updates on desktop, Capacitor on
Android, offline fastText embeddings (PL + EN) compressed to ~6–8 MB per language.
