# Lexling — Design

*Called WordGuess until 0.18.0.*

The reference experience: games like *Semantle* / *Contexto* — you guess a hidden word and get
feedback on how close in **meaning** each guess is. The score is the guess's **absolute rank**
(1 = the closest word in the whole vocabulary, 6547 = there are 6546 closer words). Our
additions over Contexto: inflection-aware input (typed forms collapse to their base word),
categories, two bundled languages (PL + EN), friend mode, and multiple saved games.

---

## 1. Core loop

1. Engine picks a secret word (from the chosen language + category + settings),
   or in **friend mode** a friend types it in (input masked).
2. Player types a guess. Autocomplete suggests known words while typing; only words the game
   knows can be submitted (prevents typos poisoning the guess list). An inflected form is
   collapsed to its base word (see §2a).
3. The guess gets a **rank score**: its position when every word in the vocabulary is sorted
   by similarity to the secret. Whole numbers only, 1 = the single closest word; a far guess
   can score in the thousands (secret `crab`, guess `happy` → e.g. 6547).
4. The **top 5 closest guesses so far** are shown as wide boxes under the input — each with
   the word, its rank, and a color progress-bar fill (see §4). The newest guess is always
   shown with its result too, even if it didn't make the top 5.
5. Player keeps guessing. Typing the exact secret word (or any of its inflected forms) wins.
6. At any point: give up (reveals word), save & exit, or abandon.

## 2. Scoring engine

### Embeddings and the build pipeline (`node tools/build-data.mjs`, ~2 min)
- Source vectors: **fastText** `cc.pl.300` / `cc.en.300` (2M tokens × 300 dims each, most frequent
  first). Chosen over GloVe/word2vec because of the strong official Polish vectors. The 2.6 GB of
  downloads live in `tools/raw/` and are **build-time only**.
- Which tokens are *words*: the **Hunspell dictionaries that ship with LibreOffice** — `pl_PL`
  (sjp.pl, 308k base words + inflection rules) and `en_US` (SCOWL) — plus LibreOffice's
  WordNet-based thesaurus for English parts of speech. `tools/hunspell.mjs` expands the affix
  rules; `tools/lexicon.mjs` turns them into base words, parts of speech and inflected forms.
- Vocabulary = dictionary base words that have a fastText vector, most frequent first:
  **60 000 Polish, 41 158 English** (all there are). Lower-case only, so no proper names.
- **Cross-language filter**: `sjp.pl` lists English words, and English tokens common in Polish web
  text slip in as well, so a Polish game offered *game*, *love*, *crawl*. A word is treated as the
  other language's when it has no inflected form of its own here **and** the other language uses it
  ≥ 4× more (frequency rank): 723 out of Polish, 31 out of English. Borrowings Polish inflects
  (link, team, crack → cracka) stay, as do Polish words English shares (do, jest, ale, pod) because
  Polish uses them at least as much. Exceptions live in `KEEP` in `tools/seeds.mjs` — so far only
  English "ten", since Polish *ten* is 25× more common.
- Vectors: unit length → mean-centred → unit length → **int8** (300 dims kept; PCA to 128 dims
  was planned but dropped — 40 MB total is well inside the 100 MB budget, and full vectors rank
  better). Shipped size: PL 27 MB, EN 14 MB.
- Inflected forms shipped = forms the rules generate **and** that occur among fastText's 2M web
  tokens (383k Polish, 32k English). A form rarer than that is practically never typed; all 973k
  possible Polish forms would double the download for nothing.
- At runtime (JS): one game start = 60k × 300 int8 dot products + a sort ≈ 0.2–0.3 s on a PC.
  Data loading (~1.3 s for Polish) starts when the New Game / picker screen opens, so pressing
  Start feels instant (measured: 99 ms).

### From similarity to the rank score
Raw cosine values are unintuitive, so the score IS the **rank**: when a game starts, the engine
sorts the entire vocabulary by closeness to the secret (see "OP words" for what closeness is). A
guess's score is its 1-based position in that list (the secret itself is excluded — typing it
wins), so scores run from 1 to ~60 000. The ranking is computed when the game screen opens and is
**not** stored in the save — 60k numbers per save would blow the storage quota. Each guess stores
the rank and percent the player saw, so the picker and history need no word data.

### Data files (contract between `tools/build-data.mjs` and `app/js/engine.js`)
```
app/data/index.json          { dims, source, counts: { en, pl } }
app/data/<lang>/vocab.json   { lang, dims, posNames[], words[], pos (digit string), secret[], cats{}, hub[], spread[], hard{idx,score} }
app/data/<lang>/vectors.bin  Int8, words.length × dims, row i = words[i]
app/data/<lang>/ac.txt       every base word + inflected form, one per line, sorted by fold(spelling)
app/data/<lang>/ac.bin       Uint32 per ac.txt line: index of the base word it belongs to
app/data/<lang>/extra.txt    Letters-only guesses, 3–13 letters: dictionary words with no base word to
                             place them under (pasę, poszedłem). Guess never reads it. Empty for English.
```
- `words` is ordered most-frequent-first (index = frequency rank: difficulty slices and
  autocomplete ordering rely on it). `secret` = indices the engine may pick in "All"; `cats` maps a
  category key to indices (reaches rarer words than `secret` — a category is a hint).
- `fold()` (ż→z, ł→l…) lives in `engine.js` and is imported by the pipeline, so both sides sort
  identically. A spelling with several readings appears once per reading, **best first**: the
  word itself, then direct inflections (noun before adjective before verb), then
  participle/gerund readings. `resolve()` takes the first exact spelling.

### Rank → progress-bar percentage (for the guess boxes)
A linear mapping would make everything past rank ~2000 look identical, so the fill percent is
**logarithmic**: `percent = 100 · (1 − log(rank) / log(vocabSize))` — rank 1 = 100 %, 10 = 79 %,
100 = 58 %, 1000 = 37 %, 10 000 = 16 %. Colour follows the same percent along the cold → warm → mid →
hot ramp, whose stops are **15 / 38 / 58 / 75 %**: they sit below the percentages they colour because
rank 25 out of 60 000 is an excellent guess yet only 71 % "close", so green must start before the top
of the scale. The ramp is brighter and more opaque than the design's tokens (owner's request,
CHANGELOG 0.7.0); the opacity is capped by white text staying readable on the amber end.

### The OP-word problem (words like "well", "humanity") — measured, then fixed
Some words are vaguely close to everything and score well against almost any secret. Measured
on the real data (200 random secrets; share of secrets for which a word lands in the top 1000;
fair share = 1.7 %):

| scoring | words with > 5× the fair share | worst word |
|---|---|---|
| plain cosine | PL **650**, EN **218** | `historia` 20 %, `announcement` 15 % |
| cosine − average similarity to the *whole vocabulary* (the original plan, any λ) | unchanged | unchanged — that average is ≈ 0 for every word |
| cosine − average similarity to the **possible secrets** | PL 104, EN 10 | 12 %, 10 % |
| **z-score: (cosine − that average) ÷ its spread** | **PL 0, EN 0** | 8 %, 9 % |

So the engine scores `(cos(guess, secret) − hub[guess]) / spread[guess]`, where `hub` / `spread`
are the mean and standard deviation of the guess word's cosine to all possible secrets (computed
exactly at build time from the secret pool's covariance matrix). Every word gets the same chance
of being "close"; neighbours stay sensible (`crab → lobster, crustacean, clam…`,
`kot → kotek, kocur, pies…`), and `well` / `humanity` rank ~28 000 for `crab`. Removing dominant
principal components ("all-but-the-top") was also tried: no gain on top of the z-score.

### The secret pool (what the engine may pick)
A bad secret ruins a whole game, so this is stricter than the guessable vocabulary:
- a **noun**, ≥ 3 letters, among the 12 000 most common words (≈ 6 100 PL / 6 400 EN);
- not readable as a plain inflection of another word (`wody`, `nowe`, `bez`) — unless its own
  paradigm is clearly alive on the web (`kot` stays although it spells a form of the rarity `kota`);
- not on the hand-kept stoplist in `tools/seeds.mjs` (`NEVER_SECRET`): function words with an
  obscure noun homonym (`jak` = yak, `can` = tin), abbreviations, numerals, vulgar or grim words.
  **Found a bad secret while playing? Add it there and rebuild.**

### Difficulty is absolute, not relative
Relaxed ≤ 25, Easy ≤ 40, Normal ≤ 60, Hard above — bands on the word's own difficulty score, so Easy
means the same thing in every category.

It used to be a *frequency slice inside the category*, and that was the single biggest reason the game
felt too hard. Measured on the Polish data: easy Animals averaged difficulty **49** while easy Jobs
averaged **14**, because only 5 of 150 animals score ≤ 25 and 109 of them are above 60. Tools has **no**
word under 40 at all. "Easy, with a category" was therefore harder than Hard elsewhere.

A category with too few words in a band falls back to the **20 easiest it has** rather than refusing —
Tools Relaxed is *butelka, szczotka, łańcuch* — and the new-game readout always shows the real count,
so the choice is informed: *"3–9 letters · 23 words this game can hide"*.

### Letters mode: a different difficulty, and base forms only
The second mode (a Wordle, PLAN.md M12) cannot reuse the difficulty above. That one is rarity +
*meaning isolation*, and this game never uses meaning. A Letters word is rated by **how well-known it
is** (its place in the frequency list) and **how unusual its letters are** (the average rarity of
its letters, plus a step for each repeated letter). Each becomes a percentile among the words this
mode can hide, and the two are averaged — the same shape as the main score, so the four bands mean
something alike. It is computed in the app (`app/js/letters.js`), so the main mode's numbers do not
move.

The mode promises base forms, but the list holds inflected forms that live as words of their own
(`ptaki`, `stara`, `kota`). The pipeline marks them as `formOf` in `vocab.json`, since only it still
knows each word's forms. What counts: a direct inflection (not a participle or gerund — `życie`
stays), of a base no more than 10× rarer, where the word is not itself in dictionary shape (a Polish
adjective in -y/-i or verb in -ć: `stary` stays although it also spells a plural of *star*). In a
mutual pair (`kot`/`kota`) the shorter word is the base.

### Hints
Contexto's rule, which is a good one: a hint is a word at **half the rank of your best guess**. Early
on that is still far away and only points a direction; as you close in, hints close in with you. No
limit, and none left once the best guess is rank 2. Three rules of our own, each one added after
testing the result on the real data:
- prefer a **different part of speech** than the secret — for `kot`: *perski, śpi, pieski, owczarek*,
  which read as clues rather than near-answers like *pies*;
- only **words people know** (inside the 12 000 most common). Without this, `żółw` was hinted with
  *sumatrzański* and *jukatański*: species-name geography, well ranked and useless;
- never the secret's **own word family**, after the first version answered `żółw` with *żółwi* and
  `wiatr` with *wiatru*;
- and, above all, **closer than the best guess so far**. Halving the target is not enough on its
  own: once the words near it are used up, the cheapest candidate left is one further away, and the
  ladder walks backwards. From a best of rank 12, `żółw` gave 5, 9, 11, 12, 15, 16, 19, 24 — four
  of them worse than the guess the player already had. A hint now carries a hard ceiling, and when
  there is no progress left to give, none is offered.

A hint lands in the list like a guess, outlined and marked, and carries its rank — so it moves the game
on exactly as a good guess would. Hints are not counted as guesses, and a win that used one is not a
speed or difficulty record (it still counts as a win, and for Explorer and Polyglot).

### One spelling, one word
`płazy` is a correct plural of both `płaz` (the animal) and `płaza` (the flat of a blade); `koty` of
both `kot` and `kota`. **19 928 Polish forms — 4.5 % of the list — are ambiguous**, against 12 in
English. Offering a row for each reading looks like a bug, because the two rows are spelled the same
and the arrow points at two words a letter apart. So one spelling gets one reading, picked by:

1. a spelling that **is** a dictionary word means that word (checked over all 101 158 words);
2. a word the engine **can hide** beats one it never will — `leaves` → *leaf*, not *leave*;
3. where one base **starts** the other, the shorter — `płazy` → *płaz*, `maje` → *maj* — unless it is
   more than **10×** rarer, which is what stops `has` becoming *ha* (235×) and `głupie` → *głup*;
4. otherwise the commoner word.

`resolve()` uses the same choice as the suggestion list, so Enter always plays the row on top. Nothing
becomes unguessable: every affected word is still typable through another form, always through its own
base spelling. The cost is that the rarer reading needs its full base word — if the secret is *płaza*,
`płazy` scores *płaz* and you have to type `płaza`. The guess box shows `płazy → płaz`, so the word
actually scored is never hidden from the player.

### A category hides members of itself
Tagging by vector similarity puts everything *near* a category into it, and near is not the same as
in. Polish Animals came out as 150 words of which roughly half were not animals: words meaning
"animal" (`zwierzę`, `zwierzak`, `czworonóg`), things that merely live nearby (`pluszak` — a plush
toy, `aniołek` — an angel), myths (`smok`, `wilkołak`), pet names (`sunia`, `kiciuś`), and the same
animal five times over (`kot`, `kotek`, `kociak`, `koteczka`, `kocur`). English had it too: `pet`,
`zoo`, `leash`, `manure`, `mermaid`, `veterinary`.

Two filters run after tagging:
- **`NOT_IN` in `tools/seeds.mjs`** — a hand list per category, for words *about* it rather than *in*
  it. The same four kinds keep appearing: the category's own name and group words, non-members,
  myths, and the people and places around the members.
- **Diminutives** — a member is dropped when the category already holds the shorter, commoner word it
  is built from. A plain prefix test is not enough, because Polish reshapes the stem (ryba→rybka,
  świnia→świnka, ptak→ptaszek), so the ending is stripped first and the rest must agree within two
  characters. The ending must be a real diminutive: English builds *compounds* from the same parts,
  and a loose rule deleted `rainbow`, `sunshine` and `snowfall`.

Each category also carries a one-line description shown under the chips on the new-game screen,
saying where its edges are — what it hides and what it never will.

### Categories
**20 of them**: animals, food, household, clothing, tools, tech, vehicles, buildings, nature, weather,
body, people, jobs, school, science, sport, music, feelings, abstract, verbs. *Objects* and *Places*
were dropped — a category is a hint, and those two could mean anything.

Each has ~25–40 hand-picked example nouns per language (`tools/seeds.mjs`). A noun among the 30 000
most common words joins the category whose 3 closest examples average a cosine ≥ 0.42 and beat the
runner-up by ≥ 0.04; a second round promotes members scoring ≥ 0.56 to examples, which reaches the
corners a short list cannot describe. Unsure words stay in "All" only. **Verbs** is the exception: a
part-of-speech category that example words cannot describe, so the pipeline fills it with every verb in
that window. Sizes run ~50–550 words per language (verbs: 4 659 PL / 2 904 EN). Accuracy is good, not
perfect — the build log prints each category's weakest members for review.

### How hard a word is (the "hardest word beaten" statistic)
Per possible secret, 0–100, from two things a player actually feels:
- **rarity** — its place in the frequency list;
- **isolation** — the average similarity of its **ten nearest neighbours**, searched among the 12 000
  most common words (the ones anybody would type). A word in a crowd (*kot*: kotek, kocur, pies…) can
  be closed in on; a lonely one leaves guesses hovering.

Both halves are converted to percentiles and averaged, so the two scales combine fairly. Length is
deliberately not part of it: long words are often easier, not harder. Sanity check on the real data —
hardest Polish: *ukłuć, ciec, leźć, szadź, gołoledź*; easiest: *sprawdzić, ojciec, lekarz, piątek*.
The pass costs ~3 min per language and ships as `hard: { idx, score }` in `vocab.json`.

### 2a. Inflection & word-form collapsing (Polish!)
Research note: Contexto/Semantle do **not** do this — every form is its own vector, which
produces famous absurdities (a puzzle where the plural of the answer ranked ~998 while the
singular was the secret). We collapse forms instead, which is strictly friendlier — but the
line must be drawn carefully:

- **Collapse inflection (odmiana)** — grammatical forms of the *same* word: Polish cases,
  plural/singular, verb conjugation (`psami`, `psów` → `pies`; EN `dogs` → `dog`,
  `running` → `run` as verb form). Vocab stores **lemmas only**; input is mapped
  form → lemma via a lookup list generated at build time from the Hunspell dictionaries'
  inflection rules (Polish: sjp.pl; English: SCOWL + a hand-kept table of irregular forms —
  `went → go`, `mice → mouse` — that deliberately leaves out forms which are common words in
  their own right: `left`, `saw`, `rose`, `found`, `people`, `data`).
- What the dictionaries list as separate words although they are forms (`czasu`, `miastem`,
  `samochody`) is folded back into the base word — rules and their reasons are in
  `foldListedForms()` in `tools/build-data.mjs`. Mutual pairs (`kot`/`kota`, `polityk`/
  `polityka`, `wino`/`wina`) are different words and both stay.
- **Do NOT collapse derivation (słowotwórstwo)** — words *derived from* another word that
  name a different concept: `parking` is not `park`, `teacher` is not `teach`,
  `piesek` ≠ `pies` (diminutive — borderline, decide per-class). These stay separate vocab
  entries with their own vectors; collapsing them would delete real concepts from the game.
- **Ambiguity**: some forms belong to several lemmas (PL `mam` → `mama` or `mieć`; EN
  `left` → `leave` or `left`). Resolution: prefer a lemma the player selects from the
  autocomplete dropdown (which always shows lemmas); on bare submit, prefer the
  noun/most-frequent lemma and show which one was taken — the guess box displays the lemma,
  with the typed form in small print (`psami → pies`), so it's never a mystery.
- **UI honesty rule**: whenever the submitted text ≠ scored word, show the mapping.
- Guessing **any inflected form of the secret** counts as the win.
- Known risks, accepted: a wrong form→lemma mapping scores the wrong word (mitigated by the
  dictionary + showing the mapping); homonyms (`zamek` castle/zipper) share one vector by
  nature of word embeddings — that's inherent to the genre and part of the fun/frustration.

## 3. Words, categories, settings

- **Categories**: tags on vocab entries (animals, food & drink, objects, places, nature,
  people & body, abstract, ...). "All" is default. Category limits only the *secret* pool —
  guesses can always be any known word.
- **Game settings** (chosen on the pre-game screen): language, category, **secret length band**,
  **difficulty** (an absolute band on the word’s difficulty score — see §2), friend mode toggle. Only
  the language carries over to the next game; the rest start from All / Any / Normal / friend off.
- **Length band** (design v2): Short 3–5 / Medium 6–8 / Long 9+ / Any, not a "max letters" number.
  The screen draws a histogram of the real word lengths available for that language and category
  (`lengthStats()` in `engine.js`) with the chosen band highlighted, plus a readout of how many
  words it holds and what share of that dictionary they are — so the choice is made against the
  actual data, and an empty band is visible before pressing Start. "Any" needs no upper limit:
  long words are rare on their own (PL 9+ letters = 33 % of the pool, EN 30 %).
- Category tagging is part of the data pipeline (seed lists + embedding-neighborhood
  expansion, then manual review of the secret pool).

## 4. Screens / UI

Simple, flat navigation — no tabs inside gameplay:

```
Main Menu ─── Play ── (game picker: list of saved games — resume / rename / delete / New Game)
   │                       └─ New Game → settings sheet (language, category, length band, difficulty,
   │                                                     friend mode) → Game screen
   ├─ Achievements & Stats (badges + lifetime statistics on one screen)
   └─ Settings (app language PL/EN, theme, sound, update check / About)

Game screen: secret-word status bar (guess count, category, give-up / save-exit buttons),
big text input with autocomplete dropdown at the top; below it the guess boxes.
```

**Guess boxes**: the **top 5 closest guesses so far**, each a wide box showing the word, its
rank number, and a **progress-bar fill** — the box's background fills left-to-right by the
closeness percent (§2), tinted along a red (far) → yellow → green (close) gradient. Fills and
re-ordering **animate smoothly** when a new guess lands. The newest guess is always visible
with its result even when it's not top-5. **Full guess history** is accessible below the top
boxes (collapsed "all guesses" expander).

**Since 0.16.0 the app holds two games**, and every place that assumed one now holds several (so a
third mode slots in): the menu has **one card per mode** instead of Play; since 0.17.0 each card opens
**that mode's own list of games in progress** (owner: never one mixed list), with its own New game;
the stats screen has a **tab per mode**. Routes: `#/games/guess`, `#/games/letters`, `#/new` Guess,
`#/new/letters` Letters, `#/game/<id>` takes the mode from the save. The end screen of both games
names the category the game was played in. Since 0.20.0 both games end the same way (design v2): a
full-width outcome banner — ✓ on green for a win, ✕ on red for out of tries or giving up, the guess count on
the right — and under it a plain card edged in the same colour with the word, the numbers and the buttons. **Every button has a frame** — the design's text-only
"ghost" buttons read as plain text, so they got one (0.17.0).

### Letters screens (design: `design/letters/handoff/`)
- **Feedback is filled, the theme colour only outlines.** Green = `--fill-hot`, yellow =
  `--fill-mid`, grey `#4A4A4A` in both themes, all solid. The accent marks only the caret box, so a
  green or amber theme colour can never be read as a result.
- **Box size comes from the column**: `min(60px, (100cqi − gaps) / n)` — 13 letters are 19.9 px on a
  320 px phone, 3–5 letters cap at 60 px and centre.
- **Typing goes into one hidden text field**; the boxes only draw it. That is what lets the phone's
  own keyboard (and its long-press ż ó ł) work. It must have a real size — at the design's 1×1 px the
  browser has no room for a cursor, keeps it at the start, and Backspace stops working. A tap
  anywhere on the game focuses it. Nothing is sent until Enter / Go / Guess.
- **Keyboard open**: the screen becomes exactly the visible height (`--vvh`), top bar and status
  step aside, the grid scrolls in the middle, Guess sits right above the keyboard, empty rows hide.
- **No empty rows ahead** (since 0.19.0, for every number of tries — the design drew them for a limit):
  only the row being typed, and one more per guess, growing in tile by tile from the left.
- **The screen fits the window while playing** (0.19.0): status on top, Guess right under the grid, and
  only the grid scrolls, kept at the newest row — however many tries were chosen.
- **Any length** (0.17.0) draws the word from all lengths 3–13 in one pool, so each length comes up
  as often as words of it exist — not every length equally (owner's choice).
- **No "Copy result"** — the design had a button that copied a 🟩🟨⬛ summary for sharing; built in
  0.16.0, removed in 0.17.2 at the owner's request (it looked bad and was not wanted).

## 4a. Rendering quality & responsiveness (hard requirements)

Lockdown's loading glitches are the anti-goal. Rules from day one:

- **No flash of broken UI**: the native window stays hidden (or shows a solid brand-color
  splash) until the web app signals first-paint-ready; window background color matches the
  app background so there is never a white flash. All fonts/assets bundled locally and
  preloaded — no layout shift after load.
- **One CSS layout, fluid by design**: the app is built mobile-first with fluid/responsive
  CSS (flex/grid, `clamp()` sizing), so the *same* layout works at phone portrait,
  phone landscape, Android **split-screen** (very small heights!), and any desktop window
  shape. Defined minimum supported size (~320 × 480); below it, scroll rather than break.
- **Resize is a first-class event**: dragging the desktop window wider/taller/narrower must
  never clip, overlap, or misalign anything — tested continuously, not at the end.
- **Test matrix** (checked before each release): 320×480, 360×800 (phone), split-screen
  ~360×400, 768×1024, 1280×720, 1920×1080, plus live drag-resize on Windows.
- Animations are CSS-transform/opacity based (GPU-friendly), no jank on mid-range phones.

- Multiple concurrent games, saved automatically after every guess; save = game settings +
  secret + guess history (and the cached rank list). Renameable.
- Saves live **outside the program folder** (`%LOCALAPPDATA%\Lexling` on Windows — `\WordGuess` until 0.18.0, moved over automatically, platform
  equivalent elsewhere) so updates never touch them — same rule as Reckless Driving.

## 5. Tech & platforms

| Piece | Choice | Why |
|---|---|---|
| Game core | Single-page **HTML/JS** app | Same skillset & design-agent workflow as Reckless Driving; runs everywhere |
| Windows / Linux / macOS | **pywebview** (WebView2 on Win) + PyInstaller | Proven in Reckless Driving; reuses the whole installer/update system |
| Android | **Capacitor** wrapping the same web app | Standard way to ship a web game as APK; no second codebase |
| Data pipeline | Node.js in `tools/` (no dependencies) | One-off build step, not shipped; Python isn't on this PC's PATH, Node is |
| Installer / updates | Custom **Setup.exe** (tkinter) + GitHub Releases version check | Copied from the Lockdown / Reckless Driving pattern |

Fully **offline** at runtime — no API, no server, no accounts. Update check only on request.
**Both Polish and English data ship inside the app** (no downloads); total app size budget
≤ 100 MB, so the vocab/dimension choices in §2 have comfortable headroom.

Android builds are done **from the terminal** (Capacitor CLI + Gradle) — no manual
Android Studio steps in the workflow.

## 6. Achievements & statistics (one screen)

Badges and lifetime stats share one screen (there aren't many badges).

**Statistics** (lifetime, across all games): words guessed (total + unique), letters typed,
games played, games won, games given up, time spent in game, best win (fewest guesses),
current/best win streak. Same counters feed the badge engine.

**What a win counts toward.** A category is a hint: being told the secret is an animal cuts the search
from 6 207 words to ~150, so those games are quick to win and cannot be compared with open ones.
Speed and difficulty badges — and the *hardest word beaten* stat — therefore count only **category-free,
non-friend** games; categories have their own badge (Explorer). Wordsmith and Typist count everything,
because they measure typing, not winning. (Measured the other way round too: category secrets are
*rarer* words than open ones — PL animals 69 vs all 46 — because categories reach to rank 30 000 while
"All" stops at 12 000. Rarity is not the same as hard to corner.)

**Badges** — tiered; tier ladder: **Bronze → Silver → Gold → Diamond → Amethyst** (confirmed), drawn as
the design's "1b Tier ladder" card. Eight of them:

| Badge | Counts | Tiers |
|---|---|---|
| Wordsmith | unique words typed (all games) | 100 / 500 / 2 000 / 10 000 / 30 000 |
| Typist | letters typed (all games) | 1k / 5k / 25k / 100k / 500k |
| Sharpshooter | fewest guesses in a won open game | under 50 / 25 / 12 / 6 / 3 |
| Giant Slayer | hardest word beaten, open games | 45 / 55 / 65 / 72 / 79 |
| Deep Cut | wins on a word of difficulty ≥ 70 | 1 / 3 / 10 / 25 / 50 |
| Explorer | categories won in at least once (21 incl. "All") | 3 / 6 / 10 / 15 / 21 |
| Marathon | **active** play time (typing within the last minute) | 1 h / 5 h / 20 h / 50 h / 100 h |
| Polyglot | wins in both languages, counted in the weaker one | 1 / 3 / 10 / 25 / 50 |

Giant Slayer's tiers come from the data: an uncategorised secret tops out at difficulty 82 (PL) / 85
(EN) and 79 is the 99th percentile in both, so 79 is a real summit rather than an impossible one.
The rest are placeholders to tune once there is real play data.

**Letters (0.16.0) has its own tab**: games played, won, win streak (current, best under it), best
score, average tries per win — and four badges of its own, thresholds from the design, to tune:

| Badge | Counts | Tiers |
|---|---|---|
| Champion | Letters games won | 10 / 50 / 150 / 500 / 1 500 |
| High score | best single-game score | 150 / 250 / 400 / 600 / 1 000 |
| On a roll | longest run of wins in a row | 3 / 5 / 10 / 20 / 50 |
| Full range | word lengths won at (of the 11, 3–13), with a per-length strip | 3 / 5 / 7 / 9 / 11 |

Letters typed and time in game are shared by both modes; everything else on the Guess tab is Guess's.

More badge ideas may come later. Engine keeps a lifetime stats record + per-game event log
(guesses, scores, wins, give-ups) so new badges can be added without losing history.

## 7. Design handoff (owner's design agent → this codebase)

The app is plain HTML/CSS/JS, so the design agent should deliver **working HTML+CSS, not
pictures** — its markup and stylesheet get ported into the app nearly 1:1, which prevents the
"rebuilt from a screenshot and looks wrong" problem. Rules for each handoff file:

- **One self-contained `.html` file per screen** (main menu, game screen, game picker,
  new-game settings, achievements & stats, settings). All CSS inline in a `<style>` block;
  no CDN links; system fonts or an embedded font.
- **Static dummy data** in the markup (fake guesses with ranks/fills, fake badges/stats) —
  logic is wired here afterwards, the design agent shouldn't write game JS.
- **Colors and spacing as CSS variables** (`--bg`, `--accent`, `--fill-hot`, `--fill-cold`,
  ...) so screens stay consistent and theming stays possible.
- **Fluid layout**, designed to survive 360 px phone width AND a wide desktop window
  (the §4a test matrix); no fixed pixel page widths.
- Show **states** where relevant: game screen with 0 guesses / mid-game / won; a locked vs
  unlocked badge; an empty vs full game picker.
