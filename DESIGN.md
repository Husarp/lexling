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

### Words no game hides - Letters, Connect and, since 0.33.3, Guess (0.33.1, owner: "SZER on Normal?")
Guess's secrets (its own list, every category) go through the same pool.json: its brands (reebok, toshiba), and the
English slurs and vulgar words its data still held (bullshit, prick). The word-game list stops at 15 letters, so only
words up to 15 letters are checked against it - odpowiedzialność is not missing, just long.
`app/data/<lang>/pool.json` (tools/build-pool-fix.mjs) lists words kept out on top of the rules below. Polish:
every word sjp.pl's word-game list does not know (119: English words, brands, abbreviations, fragments - video,
nokia, ppłk, owy), and by hand 184 it knows but nobody would guess: plain English riding on English web text
(download, street, business - loanwords Polish uses stay: menu, sushi, kebab, show, camping), words whose count in the
web text belongs to something else (szer = szer., the abbreviation of szerokość; rej; bryg), and inflected forms the
data took for base words (staje, września, żarty). English: only junk (asap, pct, vii, kinda); ENABLE is too old to
judge (no email, no website). The frequency list the levels rest on is web text, so an abbreviation or a foreign word
can look common: that is how SZER sat among the 3 000 commonest words, on Relaxed.
Hard only (0.34.0, owner: "SEDAN on Normal - I don't know it"): 105 Polish words that are also English words -
their web-text count includes English sentences, so they look commoner than they are to a Polish player. Measured by
their Polish-only forms (sedana, sedanem - past the 50 000 commonest), then picked by hand, the everyday ones kept
(beton, notes, kefir, zebra): sedan, patio, omega, sigma, tenor, cabernet, judoka, dramaturg, roadster, token...
Litery counts them as Hard (difficulty 100); Połącz lets them on a board only on Hard.
Back in (0.33.2): 172 words the data kept out as "an inflected form of another word" that are words in their
own right - gra (also "on gra"), muzyka (also the genitive of muzyk), droga, polityka, walka, wino, złoto. The test,
with sjp.pl's inflection list (`odm.txt`, each line a base form and its forms): the word heads a line of its own with
forms no other line has, and one of them is among the 60 000 commonest in the web text. Plain forms fail (every form of
"ptaki" is in the line of ptak; "kota"'s own forms - kotę - are never used). Kept out by hand: cech (mostly cecha).

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
   ├─ Statistics (one tab per game; no achievements since 0.23.0)
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
- **No score** (since 0.29.0 - the owner: "play for fun, not sweat for score"). Letters had one from 0.16.0
  (letters ÷ guesses × 100 × difficulty, later × 6 ÷ tries, points for running out of tries); it needed
  rebalancing each time the game changed and free hints bent it again, so it went. The end card shows the
  category, the guesses and the hints used.
- **Allow Polish letters** (0.29.1): off = the word has none AND guesses cannot use them - the Polish keyboard
  row is hidden and typing them is refused (owner: no using them to your advantage). The design had them always
  typeable.
- **What you know + hints** (0.28.2): a strip above the grid - a box per letter, green where a guess had the
  right letter there, dashed where a hint showed it, then the yellow letters still to place. A hint shows one
  letter in its place, costs no try, at most half the word. The strip went in 0.31.1 (owner: not needed).
- **Under the keyboard (0.31.1, owner)**: one row - a long Space on the left (leaves a tile empty and moves on:
  the selected one, or the first gap), ← → (the selection one tile along, as the arrow keys), then Hint. Space
  and the arrows also work from a computer's keyboard.
- **No hints any more (0.34.0, owner: "they don't fit - the game isn't endless, you can lose")**: the Hint key, the
  hinted letters and the hint counts are gone from Litery; the row under the keyboard is Space, ←, →. What follows about
  hints is how it was from 0.28.2 to 0.33.3.
- **The hint cap counts green letters (0.32.1, owner)**: no hint once half the word (rounded down) shows, green from
  the guesses or hinted - as in Połącz, where crossing words count.
- **Hinted letters in the row being typed (0.31.2, owner)**: with the strip gone, a hinted letter stands greyed
  out in its place in every row you type. Typing puts a letter over it (it is an empty tile to the keys, so
  letters fill it in order); a tile left with only its hint is sent as that letter (Space skips it), and
  Enter lights up when the row is full counting hints.
- ~~**Random difficulty** (0.21.0): the game draws one of the four levels at the start and plays it,
  but never shows which — only "Random".~~ Gone in 0.37.0 (owner), here and in Connect; saves from before still
  say "Random".
- **The screen fits the window while playing** (0.19.0): status on top, Guess right under the grid, and
  only the grid scrolls, kept at the newest row — however many tries were chosen.
- **Any length** (0.17.0) draws the word from all lengths 3–13 in one pool, so each length comes up
  as often as words of it exist — not every length equally (owner's choice).
- **No "Copy result"** — the design had a button that copied a 🟩🟨⬛ summary for sharing; built in
  0.16.0, removed in 0.17.2 at the owner's request (it looked bad and was not wanted).

### Connect screens (design: `design/v4/`, "Lexling Connect")
- **The puzzle** (`app/js/connect.js`): the circle is one common word's letters, shuffled (4–10 since 0.28.0; 8–10
  aim for 7–12, 8–13, 9–14 words on boards up to 12 × 10); the board is a
  crossword of the common words they make - 3–5 words for 4 letters, 4–7, 5–8, 6–10 for 7 - always with the word
  that uses every letter. Board words come from the Letters pool (base forms, no stoplist, no inflected forms
  posing as words); any other real word, every Polish form included, is a **bonus word**: counted, never needed.
- **The crossword**: every word crosses one already there; no word touches another side by side or end to end,
  so no accidental words form; most crossings and the smallest board win; at most 10 across and 8 down, kept
  wider than tall because a phone runs out of height first.
- **Levels go by frequency rank**, not by Letters' difficulty (which also weighs how rare the letters are - no
  help to anyone when the circle hands the letters over): Relaxed 5 000 most common words, Easy 8 000, Normal
  12 000, Hard 20 000.
- **Hints are free** (owner: nobody should stay stuck), but a hint stays a hint (0.27.4): each press shows a
  random letter not showing yet - anywhere, or in the word tapped first - and a word takes no more hints once half
  its letters show - rounded up since 0.34.0 (owner: 3 of 5, 2 of 3), counting letters from found crossing words too
  (0.32.0); a crossing letter counts for both words. A word whose letters all show (hints plus crossings) counts as
  found. **A hinted letter stays marked (0.34.0, owner: "it doesn't show where you used a hint")**: dashed and grey
  while its word is open, then green with a dark dashed edge once the word is complete - in the game and on the end
  screen, whose legend explains it.
- **No points and no achievements** (owner, 2026-09-25): the result is solved or given up, words, bonus words,
  hints. Statistics: played, solved, words found, bonus words, the longest word found.
- Screen: the status row, the board (tiles sized by width and height), one slot for the word being dragged
  and the game's answer, the circle with Shuffle, Hint and the bonus counter. Motion times are the design's.

### Tiles (Kafelki) - the rules (0.30.0-0.32.0; PLAN.md M13)
- **2-5 players on one device** (0.31.0, owner): each seat a person or the computer at its own level, in any mix.
  People pass the device; a hand-over screen hides the rack between them (design). Giving up ends the game.
- **An engine of actions with a seed** (0.31.0, from the owner's own plan): `apply(state, action)` for place /
  exchange / pass / resign; the bag is shuffled from a seed kept in the state, so a first state plus its actions
  replay the same game (the tests do) - ready for replays, and one day for games between devices. A save also
  records the tag (a hash) of the word list that checked its moves.
- **Rule options** (0.32.0, the owner's plan; the standard by default): bonus squares every time; challenges - a
  move goes down unchecked, the next player may challenge (not allowed: it goes back, a turn that scored nothing;
  allowed: the challenger loses the turn; the last tiles are always checked at once); exchanges always (while
  there are tiles to draw); the seven-tile bonus off; a clock per move (running out = a pass) or per game (10
  points per started minute over, at the end). Every action goes into `log`, so `replay` rebuilds a game.
- **The computer, stronger** (0.32.0): Hard weighs what it keeps (`leaveValue`: blanks gold, a vowel/consonant
  balance, no doubles or heavy letters) and swaps a hopeless rack; **Expert** also plays its best six moves
  against ten racks the next player could hold and takes the best answer off - ~0.1 s a turn on a PC. Every
  level challenges a word that is not allowed. **Look-back**: each person's turn next to the best move there was.
- **Statistics** (0.32.0): `results` - every game counts, several people too, never the computer's own moves;
  stored per language and level (`store.js recordTilesEnd`).
- **Hints** (0.31.0): the best move for the rack; counted per player. The screen shows it in two steps (owner,
  0.31.2): first the squares where it goes, then the word as a preview - each press a hint.
- **Check a word** (0.31.2, owner: any time): `checkWord` - allowed, or why not (too short / too long / a
  letter with no tile / not a word). **Who put each tile**: every square remembers its player (`by`), for the
  tiles in each player's colour that the owner can switch on and off during a game.
  **Letters not yet seen** (0.31.0): the full set minus the board and your own rack.
- **The classic crossword-tile game**, never called by the trademarked name. Official
  rules: a rack of 7, the first word across the centre, one line, joined to what is down, every word made must
  be real, bonus squares only under new tiles, 50 for all seven tiles, exchanges only while 7+ tiles are in the
  bag, the game ends when a player goes out with the bag empty or everyone passes twice in a row (exchanges
  count, so it cannot run for ever); leftovers are taken off, and whoever went out gets them. No challenges:
  a move is checked before it goes down, as in the apps.
- **The official letter sets**, 100 tiles each with two blanks (Polish: 32 letters, A ×9 … Ź ×1 worth 9).
- **Four boards**, each symmetrical both ways and across the diagonals: **Classic** - the original 15 × 15;
  **Bonus** - 15 × 15 with the bonuses pulled in from the edges and 16 triple letters, the idea of the Words With
  Friends board, our own layout; **Romb / Diamond** (0.37.0) - 15 × 15, the bonuses on diamond rings round the
  centre, the triple words at the middle of each edge; **Quick** - 11 × 11 (0.30.0-0.31.2, dropped in 0.32.0, back in
  0.37.0: the owner had not understood what it was), with **its own letters**: about half of each common letter, the
  full set's share of vowels (~40 %), one blank, and the letters hard to place left out (Polish ć ń ź ó f, English
  q z v) - 53 tiles in Polish, 50 in English; a game takes about half the turns. Copying a commercial board square
  for square was not an option, and their layouts are not published anyway.
- **Words** (0.31.0, owner's choice): word-game lists, every form, no abbreviations or proper nouns - SJP.PL's
  "słownik do gier" (CC BY 4.0) and ENABLE (public domain), 2-15 letters, only the set's letters, minus every
  form of a slur or vulgar word (the Hunspell dictionaries give the forms). 3 235 733 Polish words in a 2.8 MB
  word graph, 168 341 English in 0.8 MB: `app/data/<lang>/tiles.bin`, built ahead of time by
  `tools/build-tiles-words.mjs` (building takes 15 s - far too slow for a phone), loaded in milliseconds.
  Letter names (es, zet / ess, zed) are in both lists already - the owner's plan asked to check.
  (0.30.0 used the app's own lists: abbreviations got in - hr, pp - and most Polish forms were missing.)
- **Finding moves**: Appel & Jacobson (1988) - anchors, cross-checks, the left part then the right, along
  the rows of the board and of the board turned over its diagonal. 1-4 ms a turn on a PC, 97 ms for the
  worst rack there is (two blanks, Polish). The tests check it against a search through every placement.
- **The computer's levels** = how many words it knows (base word among the 5 000 / 8 000 / 20 000 most
  common, Hard all) and how hard it tries (the move nearest 50 / 70 / 85 / 100 % of the best it can see).
  With nothing it can play, it swaps its whole rack while it may, else passes. First values, for tuning.

### Tiles screens (0.35.0; design: `design/v5/lexling-tiles/`, "Lexling Tiles")
The design's markup and CSS as given (the handoff-only `.tl-finger` left out); what it did not draw is built in
its style (the second block in app.css). `app/js/tiles-game.js`; New game, the games list and the statistics tab
are in `screens.js`.
- **One grid, two layouts**: a phone - status, board, message line, rack, tools; from 900 px the board on the
  left and a 360 px column with a panel always open (History, until another is opened) and the keys line.
- **One panel each, no tabs** (0.37.1, owner): the scores open History (with the colours switch), the bag Letters
  left, and a small magnifier at the end of the Save & exit / Give up row opens Check a word, its field ready to
  type in. Each has its title and ×; tapping its button again, or outside it, closes it on a phone. On the
  narrowest phones that row stays one line - the labels give up their letter-spacing first.
- **Placing**: drag a rack tile onto a square (it rides above the finger, the square under it outlined), or tap
  a tile then a square; a tile of this move can be dragged elsewhere, or tapped back (a blank reopens its letter
  picker). A computer: click a square (again, or an arrow key: across / down), type from the rack, the cursor
  skips tiles already down; Backspace, Enter, Esc. The rack reorders by dragging along it.
- **Zoom** (phone): the first tile down zooms the board 2× when its squares are under 32 px and follows the word;
  pinch 1-2.5×, one finger pans, no double-tap zoom; out on Play, Recall or the − in the corner.
- **The move as it is built**: its words and points on the message line, a bubble at its last tile, Play with the
  points - or red tiles and the reason. With challenges on, the words are not checked (that is the rule) - except
  a move that uses the last tiles.
- **Hints in three levels** (0.37.0, owner; the two steps of 0.35.0 went - "the squares alone are too hard, the word
  alone too easy"): Hint turns the tool row into Mała / Duża / Mistrzowska (Small / Big / Master) and Cancel.
  Small = an easy move - everyday words (the ones the Easy computer knows), four tiles at most, about half the best
  there is (0.42.2, owner: "how is a seven-tile 84 a small hint?" - it had been the best common-word move, often the
  best move of all; now ~47 % of Big on average, never the same move), Big = the most points,
  Master = the best looking ahead (Expert's way: the tiles kept, the next player's answers). The move goes straight
  onto the board as dashed tiles in its place, with its points - Play plays it, Recall takes it back; one hint
  counted. A level that would show the same move as a smaller one is faded; tapped, it says so ("Master would show
  the same move as Big"). Small is faded when no move is made of common words only.
- **"+points" beside each score** (0.37.0, owner): what that player's last turn brought - +23, or +0 for a pass,
  an exchange or a challenge - until their next turn. ("This round" was the other idea; it would clear the other
  player's points exactly when your turn comes round.)
- **Everyone's tiles** (0.37.0, owner: "so my friend can think while I move"): a rule on New game, two people or
  more. The other people's racks sit under the scores, one row each, always in view; no hand-over card then. The
  computer's tiles are never shown. **Exchange** turns the rack into a picker; off below 7 in the bag, but still says why when tapped.
  **Pass** asks first. **Challenge** appears among the tools while a move waits for one.
- **Between people** (0.35.0): when the turn passes from one person to another, a card - "Ala - your turn" -
  hides the rack until its player taps "Show my tiles". One person against computers never sees it.
- **Names**: typed on New game, or "You" / "Computer" when there is one of the kind, "Player 2" / "Computer 2"
  when there are several - in the interface's language.
- **Each player's colour on their tiles** (0.36.0, owner: "no frames for players - use colours"): a player's
  tiles are tinted - green, purple, pink, grey, the usual yellow, in seat order - with the letter in the same dark
  ink. None is a bonus square's hue (light blue, blue, orange, red); green and purple, the first two, stay apart for
  colour-blind eyes too. The dot beside a name is the same hue, darker. No ring round the last move any more, and
  no points bubble on the board after a move (owner) - the message line says what was played. The switch: New
  game, the game's History panel, Settings (one setting).
- **Fewer colours, when wanted** (0.38.0, owner: "with the player colours on the board, the bonus squares' colours
  get too much"): a second switch, "Kolorowe premie / Coloured bonus squares" - off, every bonus square is one quiet
  grey with only its label (2L, 3L, 2S, 3S). Both switches are in Settings, on New game and in the game (History);
  the player colours also have a one-tap palette button beside the magnifier, lit while they are on.
- **The message line adds up** (0.38.0, owner): one word "KOT 5"; several words (or the seven-tile bonus) "KOT 5 +
  TOK 6 = 11", not dots between them.
- **Who starts** (0.36.0, owner): chosen on New game, or drawn at random ("Drawn at random" shows only then); the
  players list is the order of play, ↑ ↓ move a player.
- **Hints off** (0.36.0): a rule - no Hint tool in that game.
- **Undo** (0.36.0, owner): a rule, one person against the computer only - "Wstecz / Undo" beside Give up goes
  back to the person's previous turn (their move and the computer's reply come off), as far as their first turn,
  also while the computer thinks. The bag is then shuffled again, so the tiles drawn next are not the ones that
  came before (tiles.js `undo`: a { type: 'shuffle', seed } action, so the game still replays).
- **A phone's tap is also a click**: the tap that puts a blank down arrives a moment later as a click - right on
  the letter picker that has just opened (its backdrop = Cancel). Clicks on the picker are ignored for 600 ms.
- **The message line keeps a note** of a challenge's outcome or a turn lost to the clock while the next player
  moves, so it is not lost under the computer's reply.
- **Give up** ends the game for everyone (the rules): the person to move gives up. A game of computers only is
  allowed - it plays itself.
- **The clock**: counts only while it is a person's turn on screen, the hand-over card down.
- **The end**: won / lost / draw (grey "=") / gave up - or "X wins" with several people; the final scores (a
  places list from three players), what the leftover tiles did, the best word in tiles, seven-tile moves and
  hints, the final board, and the look-back (each of the people's turns next to the best move there was).

### Settings inside a game (0.39.0, owner: "a settings button, the usual icon only")
A gear at the right of every game's top bar (ui.js `gearButton` / `wireGear`) opens a small window over the game
(a native modal dialog, centred) with the settings that matter while playing - Sound; in Kafelki also its two
colour switches (0.40.0). While it is open the
keys belong to it alone (a game would otherwise type into itself, and Esc would leave the screen): Esc, ✕ or a tap
outside closes it. Kafelki's gear sits in its button row instead, right of the magnifier (0.40.1, owner) - that row
stays one line up to 470 px, the labels giving up their letter-spacing first. On a phone under 375 px the game's
name gives way in the top bar (to the gear, or Kafelki's "?") - it is on the saved-games list anyway.

### Kafelki: the scores and the player colours (0.42.0, design "Lexling Tiles Scores", owner, 2026-09-26)
- **The scores, on top** (the owner's pick, option 1a, "similar to now but they scroll and look better"): a box per
  player - a small tile badge with the initial (two letters when two names start alike; with several computers each
  its number), the name, the score and the "+points" of the last turn - the player to move ringed in the theme colour;
  the bag a dashed box of its own, always in view. Two players share the row; from three the boxes are half the row
  each and **scroll sideways**, and the row **follows the turn**: the player to move slides to the front. A tap on a
  box opens History, on the bag Letters left.
- **Player colours, a choice of three** ("Kolory graczy"): **Płytki** - each player's tiles tinted (as 0.36.0);
  **Litery** - yellow tiles, the letter in the player's colour (the design's way: dark inks, ≥ 4.5:1 on the yellow -
  green, purple, crimson, slate, teal); **Wyłączone**. The badges keep the colours in every case, so seats still read.
  In the gear, New game and Settings; the 🎨 button and History's switches are gone (owner).

### Kafelki: ratings and looks (0.41.0, owner, 2026-09-26)
- **The rating has a line of its own, directly under the board** (0.42.2, owner), until that person's next move; the
  move's message is the line below it. Since 0.42.3 the rating sits inside the board's own space, right under the board,
  its room kept while ratings are on - and the board stays at the top, in place (owner: "the board moves when the text
  below it changes"): the message line always keeps room for two lines of its big type.
- **Hints, a section of their own on New game** (0.42.3, owner): on / off, and how many of each level every player may
  take - 0, 1, 3, 5, 10 or ∞ (rules.hintMax). The hint menu shows what is left ("Mała · 1"); a level used up or off is
  faded and says so; "the same move as a smaller level" only fades a level when that smaller one can still be taken.
- **Hints can cost points** (0.43.0, owner: "a better hint should cost more - Small does not help much, Master is a
  game-changer, sometimes 70+ points"): rules.hintCost No / A little / A lot. Taking a hint takes a share of the points
  of the move it shows off the player's score at once - A little: Small 10 %, Big 20 %, Master 30 %; A lot: 25 %, 40 %,
  60 % (rounded up) - and a level never costs less than a smaller one (Master's move can score fewer points than Big's,
  as it weighs the rack too). The hint menu shows each level's price. A hint is an action in the log ({ type: 'hint' }),
  so it replays, and undo takes back the move but not the hint it cost.
- **A move played from a hint is marked** (0.43.0, owner: "the whole hinted word should have a different tile design,
  but in the player's colour"): its tiles keep a dashed edge on the board for the rest of the game, in the player's
  colour; History tags it "Z podpowiedzi" and lists the hint taken with its cost; the rating under the board says
  "Z podpowiedzi" instead of a percentage; the end review marks it and leaves it out of that player's rating.
- **Raised tiles in the top row** (0.42.3): the grid leaves a sixth of a square at the top of the board, so their faces
  are not cut off by its edge; a tap is measured on the grid as drawn.
- **How good a move was**: its points against the best move there was on that board with that rack (the move finder)
  - the best, excellent (85 %+), good (65 %+), fair (40 %+), weak. "Oceniaj moje ruchy / Rate my moves" (on at first;
  the gear, Settings) shows it after each of your moves on the message line, where it stays while the computer answers,
  and a percentage beside every move in History. A pass or exchange names the best move there was. Each move's best is
  kept with the save (`game.evals`, lined up with the moves; an undo drops the ones taken back).
- **How the game went**, on the end screen for every player, the computer too: each one's points against the best
  there was over all their turns, then every turn - who, what, its rating, the best move (`lookBack(state, dict, true)`).
- **Bonus squares, three looks** ("Pola premiowe"): colour; labels only (a plain square, the label in its colour -
  brighter on dark, deeper on light); grey. In the gear, History, New game and Settings.
- **Raised tiles** ("Wypukłe płytki", off at first): true 3D since 0.42.1 (owner: "over the tiles above, the letter
  centred") - the face lifted a sixth of a square, over the square above; below it the tile's thickness in its own
  colour, darker, down to its square; its shadow on the board; the letter centred on the face. Lower rows are drawn
  over upper ones, as real tiles seen from the front.
- **What is under a tile**: a tap on a tile on the board fades it for 1.5 s and shows its square.
- **No points on the board at all**: not after a move, not while one is built - the message line and Play show them.
- **The message line is much bigger** (18 px text, words 22 px, points 30 px; a little less on a phone).
- **A hinted word looks like a hint in every letter**, the tiles already down that it runs through too.
- **Zoom**: no zoom-out button (pinch, and Play / Recall zoom out); the zoom is one transform set on the board itself
  (its custom properties restyled every square on each step), a layer of its own while it moves, a pinch step at most
  once a frame.
- **The end screen's board** lets a finger scroll the page (in the game the board keeps every touch).
- The panel over the board has the board's own corners (8 px), so no square shows past its top corners.

### What a word means (0.40.0, owner: "don't download - too much; open the browser")
The app holds no definitions (a Polish dictionary would be 126 MB to fetch and tens of MB in the app). A word opens
its meaning in the phone's own browser instead (ui.js `meaningUrl`, `openExternal`): **sjp.pl** for Polish - it
knows every form and names the word it comes from - and **Wiktionary** for English. Where: Kafelki - under the
answer of Check a word ("Co znaczy? ↗"), and every word in History; Znaczenie - every guessed word (a dotted underline;
a tap keeps the typing field) and the secret on the end card; Litery - the secret on the end card, and each row once
the game is over (during the game a tap belongs to typing); Połącz - every word of the board on the end card.

### How to play (0.33.0, owner)
Every New game screen has a card under the title: "Jak grać / How to play", 4-5 short lines, opened and closed
with a tap (a native details element - works with a finger, a mouse, the keyboard and a screen reader). Closed every
time the screen opens (owner: "collapsed every time" - Kafelki in 0.36.0, all games in 0.37.0; before that it was
open until the first finished game, and remembered). Kafelki's holds topics that open one at a time, and opens from
a "?" in the game too.

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

## 6. Statistics (one screen, a tab per game)

**No achievements (since 0.23.0).** The owner, 2026-09-25: the games are for fun, and all four games
have achievements or none — so none. Eight Guess badges and four Letters badges were removed; what
only a badge showed stays as a plain statistic. (What they were: CHANGELOG 0.12.x–0.16.0.)

**Guess**: games played, won, given up, words guessed, unique words, letters typed, time in game
(active play only), best win (fewest guesses), average win, hardest word beaten, hard words won
(difficulty ≥ 70), categories won (of 21, "All" included), wins in Polish / English.

**What a win counts toward.** A category is a hint: being told the secret is an animal cuts the search
from 6 207 words to ~150, so those games are quick to win and cannot be compared with open ones.
Best win, average win, hardest word and hard words therefore count only **category-free, non-friend**
games; categories count toward "categories won". Unique words and letters typed count everything,
because they measure typing, not winning. (Measured the other way round too: category secrets are
*rarer* words than open ones — PL animals 69 vs all 46 — because categories reach to rank 30 000 while
"All" stops at 12 000. Rarity is not the same as hard to corner.)

**Letters**: games played, won, win streak (current, best under it), average tries per win, hints used
(and per game), the tries-per-win chart, and a strip of wins at each word length, 3–13. Every game's tab
has "Hints used" since 0.29.0 (Connect's counted from the start, Guess's and Letters' from 0.29.0).

Letters typed and time in game are shared by both games and shown under the Letters tab.

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
