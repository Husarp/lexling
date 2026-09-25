# CHANGELOG — Lexling (called WordGuess until 0.18.0)

All notable changes to this project are listed here. Newest on top.
Format: `X.Y.Z — YYYY-MM-DD HH:MM: <description>`
- X = major overhaul, Y = new feature/update, Z = minor fix or tweak

---

## 0.37.0 — 2026-09-25 23:19: Kafelki: two more boards, hints in three levels, +points, everyone's tiles
*(not packaged)*

- **Two more boards** - four now:
  - **Romb / Diamond**: full size (15 × 15, 100 tiles), the bonus squares on diamond rings round the centre, triple
    words at the middle of each edge.
  - **Szybka / Quick** is back: 11 × 11 with its own letters - about half, one blank, the hard ones left out
    (Polish ć ń ź ó f, English q z v): 53 tiles in Polish, 50 in English. A game takes about half as long.
- **Hints in three levels**: tap Podpowiedź, then **Mała** (a good move of common words - easy to see),
  **Duża** (the most points) or **Mistrzowska** (the best, looking ahead). The move goes straight onto the board, in
  its place, with its points - no more "squares first". A level that would give the same move as a smaller one is
  faded, and tapping it says so. Each counts as one hint.
- **"+points" beside each score**: what that player's last turn brought (+23, or +0 for a pass or exchange).
- **Everyone's tiles** (a rule on New game, two people or more): the other people's tiles are always shown under
  the scores, so a friend can think while you move; no "pass the device" card then. The computer's stay hidden.
- **How to play** is closed every time, in all four games.
- **No "Losowy / Random" level** in Litery and Połącz either (games saved with it still show it).
- Tile counts in Polish with the right form: "100 płytek", "53 płytki".
- Checked in headless Edge at 320 and 480 px: the four boards, a Quick game with all three hint levels (and a
  faded one explaining itself), +points after each turn, two people with everyone's tiles; computer games on Romb
  and Quick to the end in both languages. 258 Tiles tests (20 new), 264 Letters, 286 Connect.

## 0.36.0 — 2026-09-25 22:16: Kafelki: who starts, hints off, undo, coloured tiles; the blank fixed
*(not packaged)*

- **Fixed: a blank's letters closed at once on a phone** - the tap that put the blank down also counted as a tap
  on the letters' dark backdrop, which means Cancel. Now the letters stay until you pick one.
- **Coloured tiles instead of frames** (owner: "no frames for players - use colours"): each player's tiles on the
  board are tinted - green, purple, pink, grey, yellow - never the bonus squares' blue / orange / red; the letters
  stay dark. The ring round each player's last move is gone.
- **No points bubble on the board after a move** (owner) - the message line under the board says what was played.
- **New game**:
  - **Who starts**: "Losowo / Random" or any player; the players list is the order of play, with ↑ ↓ to move a player.
  - **"Koloruj płytki według gracza" / "Colour tiles by player"** - the same switch as in Settings and in the game
    (tap the scores → History).
  - Rules: **Hints on / off**, and **Undo** (one person against the computer only): "Wstecz / Undo" beside Give
    up takes your move and the computer's answer back, as far as the start; the bag is shuffled again each time, so
    the next tiles are new.
  - No "Random" level any more; "How to play" is closed every time.
- **Games list**: the "Check a word" card is gone - it is in the game (tap the scores → Check).
- Checked in headless Edge with real touch taps (the blank bug came back with the fix switched off, and went with
  it on), undo twice back to the start and playing on, hints off, who starts and the order, at 320 and 480 px.
  238 Tiles tests (7 new, for undo).

## 0.35.0 — 2026-09-25 21:42: Kafelki / Tiles is playable
*(not packaged)*

- **Tiles (Kafelki) opens from the menu** - no more "soon". Built from the design (design v5) plus everything
  agreed since, in the same style (owner: "I gave you the whole design - build it"):
  - **New game**: language, board (Classic / Bonus, with a small map of the bonus squares), **2-5 players** - each
    a person or the computer at its level (Relaxed, Easy, Normal, Hard, Expert or Random), names optional - and
    the **rules**, folded away: bonus squares once / every time, words checked at once / challenges, exchanges
    with 7+ in the bag / always, +50 for all seven tiles or not, no clock / per move / per game. How to play with
    its topics.
  - **The game**: scores for every player and the bag (tap: history / letters left), Save & exit, Give up; the
    board with its bonus squares; drag a tile, or tap it and then a square, or on a PC click a square and type;
    the board zooms in on a phone while you place (pinch too); the move's words and points as you build it, or
    why it cannot be played; Shuffle / Recall, Exchange, Pass, a **two-step Hint** (where, then the word), Play.
  - Blanks ask for their letter; the computer "thinks" for a moment, then its tiles land and show their points;
    between people a card hides the rack until its player taps; who starts is drawn and shown.
  - A panel with **History**, **Letters left** and **Check** (is a word allowed - any time); each player's letters
    in their colour, switchable in the panel and in Settings; challenges and the clock when the rules have them;
    a "?" with the rules, topic by topic.
  - **The end**: won / lost / draw / gave up (or "X wins"), the final scores, what the leftover tiles did, the best
    word, the final board, and a **look-back**: each of your moves next to the best move there was.
- **Games list**: Tiles saves (scores, bag, whose turn) and a "Check a word" card, Polish or English.
- **Statistics**: a Tiles tab - played, won against the computer, best and average score, points per move,
  seven-tile moves, hints, passes, the best move in tiles - for both languages or one, any level or one.
- **Settings**: Tiles - "Colour letters by player"; About credits the word lists (SJP.PL, CC BY 4.0; ENABLE).
- Checked in headless Edge at 320-480 px and 1280 px, dark and light, Polish and English: a whole game to the end,
  placing by tap and by drag, hints, exchange, pass, a blank, four players with the hand-over, challenges, the
  clock running out, the end and the statistics - every label fits, no console errors. 231 Tiles tests,
  264 Letters, 286 Connect.

## 0.34.1 — 2026-09-25 20:57: "Check manually" beside "Check for updates"
*(not packaged)*

- **Settings → Updates**: next to "Sprawdź aktualizacje" / "Check for updates" a second button, **"Sprawdź ręcznie" /
  "Check manually"**, opens the releases page on GitHub - for when the check itself fails (owner).

## 0.34.0 — 2026-09-25 20:54: No hints in Litery; Połącz shows where hints went; specialist words only on Hard
*(not packaged)*

- **Litery has no hints any more** (owner: "they don't fit - the game isn't endless, you can lose it"): the Hint key
  is gone (the row under the keyboard is Space, ←, →), and so are the grey hinted letters, the hints line on the end
  card and "Hints used" in Litery's statistics. "Jak grać" says so. Games saved with hints still open.
- **Połącz: a hinted letter stays marked once its word is done** (owner: "it doesn't show where you used a hint") -
  green like a found letter, with a dark dashed edge - during the game and on the end screen, whose legend has a new
  entry: "Znalezione z podpowiedzią" / "Found, with a hint".
- **Połącz: the hint limit rounds up** (owner): half a word, rounded up - 3 letters of 5, 2 of 3, 3 of 6.
- **SEDAN on Normal** (owner: "I don't know it - it shouldn't be on Normal"): it is a real word (a car body type), but
  it is also an English word, and the web text the levels are measured on has English sentences in it - so it looked
  like one of the 14 000 commonest words. 105 such specialist words now count as Hard only, in Litery and Połącz:
  sedan, patio, omega, sigma, tenor, cabernet, judoka, dramaturg, roadster, gradient, token... Found by how rarely
  their Polish forms are used (sedana, sedanem), then picked by hand; everyday ones keep their level (beton, notes,
  kefir, zebra).
- Checked in headless Edge: the green hinted letter in a found word, in the game and on the end screen; Litery's
  keyboard row. 264 Letters tests, 286 Connect, 231 Tiles.

## 0.33.3 — 2026-09-25 19:01: Znaczenie gets the same word cleanup
*(packaged for the owner's phone)*

- **Znaczenie never picks the words the other games never hide** (owner: yes): no English words, abbreviations or
  brands as the secret - and its own list had a few more brands and a fragment (reebok, toshiba, acer, boeing, torx,
  "ować"), now out as well.
- **English Znaczenie could still pick a vulgar word or a slur as the secret** (bullshit, prick, bollocks and two
  slurs) - the slur filter covered only Litery and Połącz. Now it covers all three.
- Long real words stay: the word-game list stops at 15 letters, so longer ones (odpowiedzialność) are not checked
  against it.
- 270 Letters tests (3 new: Znaczenie never hides those, keeps long words, never hides a slur).

## 0.33.2 — 2026-09-25 18:36: Good words back in Litery and Połącz (gra, muzyka, droga...)
*(not packaged)*

- **172 Polish words can be hidden again** (owner: yes to downloading sjp.pl's inflection list, 12.7 MB): words the
  data kept out because they are also a form of another word - gra (also "on gra"), muzyka (also the genitive of
  muzyk), droga, polityka, walka, wino, złoto, technika, gość, zwierzę, ból, rada, kara, dym, klej, piekło...
- How they were told apart from real forms (ptaki, nowe, stara, była, wody - still never hidden): in the inflection list
  the word heads a line of its own with forms no other line has (grę, gry, grze), and people use them (one among the
  60 000 commonest in the web text). "kota" stays out: its own forms (kotę) are never used - it is really the
  genitive of kot. "cech" stays out by hand (mostly "cech" of cecha).
- 267 Letters tests (2 new: those words can be hidden, the plain forms never).

## 0.33.1 — 2026-09-25 18:04: Weird words no longer hidden in Litery and Połącz
*(not packaged)*

The owner: "I got SZER - I'm Polish and don't know what that is - and on Normal". Litery and Połącz pick their words
from the same list, so both change.
- **Why SZER happened**: how common a word is comes from web text, where "szer." (szerokość) is everywhere - so a rare
  word looked like one of the 3 000 commonest and landed on Relaxed. The same happens with English words in Polish
  web text (download, street) and with inflected forms the data took for base words (staje, września).
- **303 Polish words are never hidden now**: 119 that sjp.pl's word-game list does not know at all (video, nokia,
  ppłk, owy, samsung...), and 184 by hand - plain English (loanwords Polish uses stay: menu, sushi, kebab, show),
  abbreviations riding on a real word (szer, rej, bryg), inflected forms (staje, września, żarty, tam). The list:
  `app/data/pl/pool.json`, built by `tools/build-pool-fix.mjs`.
- **English: 20** - abbreviations and numerals (asap, pct, vii, kinda); "clit" joins the vulgar words. Newer everyday
  words stay (email, website, blog).
- **Good words wrongly kept out - found, not fixed yet**: 1 319 of the 20 000 commonest Polish words are kept out as
  "a form of another word", among them gra, muzyka, droga, polityka, walka, wino, kino, złoto, szachy. Telling them
  from real forms (ptaki, nowe) needs sjp.pl's inflection list - the owner is asked about downloading it.
- 265 Letters tests (4 new: those words never hidden, loanwords kept, every Polish word in the word-game list).

## 0.33.0 — 2026-09-25 17:53: How to play on every New game screen
*(not packaged)*

- **"Jak grać / How to play"** (owner: "each game has a card that says how to play"): a card under the New game title
  of Znaczenie, Litery and Połącz - 4-5 short lines: what the game is, what the colours / numbers mean, the keys,
  Polish letters, hints. A tap opens or closes it. It is open until you have finished a game of that kind, closed
  after that - and once you open or close it yourself, it stays as you left it, per game.
- Kafelki's will be the long one, with topics that open one at a time, and a "?" in the game (owner: yes) - in its
  design prompt.
- Checked in headless Edge: open at first, a tap remembered after a reload, every screen still fits at 320-480 px
  in both languages.

## 0.32.1 — 2026-09-25 17:36: Litery's hint limit counts green letters too
*(not packaged)*

- **Litery: no hint once half the word shows** - green letters from your guesses count now, not only hinted ones
  (owner: yes - the same rule as Połącz, where letters from crossing words count). Five letters with two green:
  no hint. The message: "No more hints allowed: half the word already shows" / "Więcej podpowiedzi nie ma: widać
  już połowę słowa".
- How to play on every New game screen: proposed to the owner (a collapsible card; Kafelki's with topics that open
  one at a time) - in PLAN.md and in Kafelki's design prompt, waiting for a yes.
- 261 Letters tests (2 new).

## 0.32.0 — 2026-09-25 17:28: Tiles' rules finished (options, challenges, clocks, Expert, look-back); Połącz hints; labels that did not fit
*(not packaged)*

The owner: "anything left other than the design? Do it."
- **Tiles: the Quick board is gone** (owner: "the full game, from start to finish, with all the letters"). Two
  boards, Classic and Bonus, both with all 100 tiles.
- **Tiles: rule options** (the owner's plan; the standard ones by default): bonus squares every time; **challenges**
  - a move goes down unchecked and the next player may challenge it: a word that is not allowed goes back (tiles,
  bag and points as they were) and the challenger plays; challenging a good word costs the challenger the turn;
  exchanges always; the seven-tile bonus off; **a clock** per move (running out is a pass) or per game (10 points
  for every started minute over, the tournament rule).
- **Tiles: a stronger computer.** Hard now weighs the tiles it keeps (a blank is gold, a vowel/consonant balance,
  no doubles or heavy letters) and swaps a hopeless rack; **Expert**, a fifth level for this game, also plays its
  best moves against racks the next player could hold (~0.1 s a turn on a PC). Every level challenges a word
  that is not allowed - and never a good one.
- **Tiles: after the game** - every action is logged, so a game can be rebuilt from its start; the **look-back**
  shows each person's turn next to the best move there was. **Statistics**: every game counts, several people
  too, never the computer's own moves - played, won against the computer, best game, best move, average score,
  points per move, seven-tile moves, passes, hints - kept per language and level.
- **Połącz hints: a word takes no more hints once half its letters show - counting letters from found crossing
  words too** (owner: "a six-letter word with two letters from crossings gets one hint"). The message says so:
  "No more hints allowed: every word left already shows at least half its letters" / "Więcej podpowiedzi nie ma:
  w każdym pozostałym słowie widać już co najmniej połowę liter".
- **Labels that did not fit** (owner: "Podpowiedź" in Połącz; "check the other buttons in Polish"): every screen
  measured in both languages at 320-1100 px. Three found and fixed: Połącz's Hint button was squeezed narrower
  than "PODPOWIEDŹ" at 480 px - the owner's phone is 480 px wide to the app (display size set larger); the level
  buttons ("Normalny") at 412 px - Random now drops under them sooner; the statistics tabs ("Znaczenie") at 320 px.
- 231 Tiles tests (rules options, challenges, clocks, replay, look-back, statistics, Expert games), 286 Connect,
  259 Letters.

## 0.31.2 — 2026-09-25 16:45: Litery's hinted letters in the row you type; Tiles: who put each tile, check a word
*(not packaged)*

The owner's answers, 2026-09-25:
- **Litery: a hinted letter now stands greyed out in its place in every row you type** (the strip that showed it
  is gone since 0.31.1). Type over it like any empty tile - letters fill it in order - or leave it: Space skips it,
  and Enter sends it as that letter. Enter lights up once the row is full, hints counting.
- **Tiles, the rules**: every square remembers who put its tile there, for the frames in each player's colour that
  can be switched on and off during a game (the owner's idea); **check a word** at any time - allowed, or why not
  (too short, too long, a letter with no tile, not a word).
- **The design prompt**: hints in two steps (first where the best word goes, then the word), check a word any time,
  the player-colour frames, statistics from every game (several people too), and - to be built after the game itself
  - rule options (challenges, a time limit...), an Expert computer, statistics per level and language, a look-back
  after the game. Dropped at the owner's word: quick start, the daily puzzle, the anagram trainer, replays.
- Połącz hints looked at again (16 hints, all S or I): not reproduced in 580 simulated games with 10 letters - never
  fewer than 4 different letters. No change; the owner will send a screenshot if it happens again.
- 165 Tiles tests (6 new), 259 Letters, 284 Connect.

## 0.31.1 — 2026-09-25 16:32: Litery - Space and arrows under the keyboard; clearer "not a word"; no orange line
*(not packaged)*

From the owner, playing 0.29.6 on the phone:
- **Litery: the row of letters in place under the keyboard is gone** (owner: not needed). In its place one row of
  keys: a long **Space** on the left - it leaves a tile empty and moves on (the selected tile, or the first gap,
  so you can put in only the letters you know: Space Space A Space E) - then **← →**, which move the selected tile
  along the row, then **Hint**. On a computer, Space and the arrow keys do the same.
- **A word the game does not take** now reads "“XYZ” doesn't exist or isn't allowed" / "Słowo „XYZ” nie istnieje
  lub jest niedozwolone" - in Guess, Letters and Connect (was "I don't know the word" / "Nie znam słowa").
- **No orange line at the top of every screen**: the top bar had a 3 px line in the theme colour along its top
  edge. Gone on the phone and on the PC.
- Połącz hints checked, not changed: they already pick a random empty square (1 200 simulated: first letters 26.0 %
  of hints, 26.7 % of squares; the circle's letters equally often).
- 259 Letters tests (5 new, for Space).

## 0.31.0 — 2026-09-25 16:32: Tiles - the real word lists, 2-5 players, hints, the tiles not yet seen
*(not packaged)*

The owner's answers (2026-09-25): download the word lists, keep the boards, hints yes, the unseen-tiles list yes,
up to 5 players, and read their own plan for the game (`letterex-plan(scrabble).md`) and use its ideas.
- **Word lists for word games**: SJP.PL's "słownik do gier" (Polish, 3 235 733 words and forms, CC BY 4.0) and
  ENABLE (English, 168 341, public domain) - no abbreviations (HR and PP are gone), every legal form (PASŁEM is
  in). Every form of a slur or a vulgar word is left out (the spell-checker dictionaries give the forms - MINETĄ
  slipped through at first). Built ahead of time by `tools/build-tiles-words.mjs` into `app/data/<lang>/tiles.bin`
  (2.8 MB + 0.8 MB), loaded in milliseconds. The raw lists stay in `tools/raw/tiles/`, out of git.
- **2 to 5 players**: each a person or the computer at its own level, in any mix. Five players leave 65 tiles in
  the bag. Everyone passing twice ends the game; giving up ends it for all.
- **From the owner's plan**: the engine is now actions - `apply(state, action)`: place, exchange, pass, resign - and
  shuffles from a seed kept in the game, so a game replays exactly from its start and its actions; every game
  records the tag of the word list that checked it. Letter names (es, zet / ess, zed) checked: in both lists.
- **Hints**: the best move for your rack (to show as a preview), counted per player. **Tiles not yet seen**: the
  set minus the board and your own rack, in alphabetical order.
- The words the computer now plays are real game words: EPENTEZA, PŁYWNICA, SALMONID. Still 1-4 ms a turn.
- 159 Tiles tests: the word files, abbreviations and slurs out, forms in; five players; replays; the engine
  refusing what is not allowed; hints and unseen tiles; seven whole games including five and three players.
- The design prompt now has the players, the hand-over screen between people, and the credit line.

## 0.30.0 — 2026-09-25 15:47: Tiles' rules and computer player (no screen yet)
*(not packaged)*

The fourth game, Kafelki / Tiles - the classic crossword game with letter tiles, against the computer (PLAN.md
M13) - without its screens: `app/js/tiles.js`, `app/js/tiles-moves.js`, `app/js/dawg.js`. The owner: "the normal
board from the official game, plus two more, symmetrical; a core system; a prompt for the designer".
- **The official rules and letter sets**: a rack of 7; 100 tiles with two blanks, the Polish and the English
  distribution and points; the first word across the centre; one line, joined to the tiles down; every word
  made must be real; bonus squares count under new tiles only; +50 for all seven tiles; exchanges only while 7+
  tiles are in the bag; the end when a player goes out with the bag empty, or when everyone passes (or exchanges)
  twice in a row; leftovers taken off, and given to whoever went out. Give up ends it too.
- **Three boards, all symmetrical**: **Classic**, the original 15 × 15; **Quick**, 11 × 11 with half the tiles
  for a short game and bigger squares on a phone; **Bonus**, 15 × 15 with the bonuses nearer the middle and more
  triple letters, for bigger scores. Quick and Bonus borrow the ideas of the Words With Friends boards; the
  layouts are our own.
- **Every legal move for a rack** (the Appel-Jacobson method on a word graph): 1-2 ms a turn on a PC, 86 ms
  with two blanks in Polish. Used by the computer, and by hints if the owner wants them.
- **The computer**: four levels, as in the other games - how many words it knows (the 5 000, 8 000 or 20 000
  most common base words and their forms; Hard all of them) and how close to its best move it plays.
- **Words**: every word and form the app knows, 2-15 letters, never a slur or a vulgar word - 458 306 Polish,
  72 354 English, in a word graph of 1.7 MB / 0.4 MB that can be saved as a data file and loaded back.
  Stopgap: these lists let in abbreviations and miss most legal Polish forms (the owner decides on a better
  list - PLAN.md M13).
- **Tests**: `tools/test-tiles.mjs`, 106 - the boards (counts, symmetry), the letter sets, the word graph, every
  placement error, scoring by hand-worked examples, exchanges, passes, going out, giving up; the move finder
  against a search through every possible placement (5 positions, 44-478 moves each, all agree); five whole
  games computer against computer - every move legal, no tile lost, scores add up.
- **Design prompt** for its screens: `notes/tiles-design-prompt.md`.

## 0.29.6 — 2026-09-25 15:20: Each game remembers its own Polish-letters choice again
*(released 2026-09-25 as v0.29.6 — Windows installer + signed Android APK, carrying 0.22.6–0.29.5 too; installed on the owner's phone and PC)*

- "Allow Polish letters" is remembered **per game** again (the owner: each game separately) - Letters and Connect each
  start from their own last choice, on at first. 0.29.5 had made it one choice for both.

## 0.29.5 — 2026-09-25 15:18: Hinted letters in green; one Polish-letters choice for every game
*(not packaged)*

- **Letters: a letter from a hint shows in green** in the row under the keyboard - still dashed and unfilled, only the
  grey became green (owner). Connect's hinted letters stay grey: there green means found.
- **"Allow Polish letters" is one choice for every game** (owner: "for all games"): switched off in Letters, a new Connect
  game starts with it off too, and the other way round. On at first.

## 0.29.4 — 2026-09-25 15:17: A big row of the letters in place; Polish letters on by default; bigger short words; a snappier key
*(not packaged)*

All from the owner, playing on the phone:
- **The strip under the keyboard is now a row of tiles the size of the grid's** (about 50 px at 5 letters) and shows
  **only the letters in their place** - green, and dashed where a hint showed one. The yellow letters are gone from
  it: the keyboard shows those. It shrinks with long words the way the grid does.
- **"Allow Polish letters" is on by default** - and **remembered**: turn it off and the next new game starts with it
  off. Letters and Connect each remember their own. (Until now every new game started with it off.)
- **Short words get slightly bigger tiles**: at most 60 px for 3 letters, 56 for 4, 52 for 5; 6 and more stay 48.
- **A key's pressed look and its letter above the finger go the moment the finger lifts** (they stayed 90 ms more,
  and on phones the :active state can linger longer still, which looked like lag). Only the key's own "held" state
  shows it now.

## 0.29.3 — 2026-09-25 15:05: Letters' keyboard sits higher, with bigger letters
*(not packaged)*

The owner, from the phone: the keys are small and too close to the bottom edge to tap easily.
- **The "what you know" strip and the Hint bulb moved under the keyboard** (the owner's idea), so the keyboard sits
  that much higher - away from the bottom edge of the screen. Order now: status, grid, keyboard, strip.
- **Bigger letters on the keys**: 22 px (was 19), and 18 px on narrow phones (was 16). The keys cannot get wider -
  ten have to fit across - so the letters grow inside them; on a 412 px phone a key is about 32 px wide.

## 0.29.2 — 2026-09-25 15:03: No "in progress" count on the menu
*(not packaged)*

- The menu rows no longer say "2 w toku" / "2 in progress" (owner). Each game's own list still shows its saved
  games; Tiles keeps "wkrótce" / "soon".

## 0.29.1 — 2026-09-25 14:57: "Allow Polish letters" - clearer, and in Letters off means off
*(not packaged)*

Polish games only, both at the owner's request:
- **The setting is "Dopuść polskie litery" / "Allow Polish letters"** in Letters and in Connect (was "Polskie litery"
  / "Polskie litery w kole"), and its line says they *may* come up, not that they will: Letters "Słowo może je
  mieć — ale nie musi", Connect "Mogą trafić do koła — ale nie muszą".
- **Letters with it off: no Polish letters at all** - not in the word (as before), and now not in guesses either:
  the ą ć ę ł ń ó ś ź ż row is gone from the keyboard, and a computer's or the phone's keyboard cannot type them
  ("W tej grze polskie litery są wyłączone"). "If you don't play with them, you can't use them to your
  advantage either." The off line says so: "...a ty też ich nie użyjesz — znikają z klawiatury".

## 0.29.0 — 2026-09-25 14:51: No more scores; hints used in the statistics
*(not packaged)*

The owner: "this game is to play for fun, to try yourself - not to sweat for score". Only Letters had a score.
- **Gone from Letters**: the score on the end card and the sum written under it, "best" beside it, and **Best
  score** in the statistics. The rules behind it too - difficulty multipliers, the tries factor, points for running
  out of tries (`letters.js`) - and their 16 tests.
- **Texts that promised points** now say what the setting does: the tries hint ("how many guesses you get" / "ile
  prób masz"), the Polish-letters card (no more "counts double in the score"), the difficulty help (no more
  multipliers), and the saved-game line "ą–ż" (was "ą–ż ×2").
- **Stays**: difficulty, tries and Unlimited still change how a game plays; every statistic stays; Guess keeps its
  rank numbers - they are how that game is played, not a score.
- **New in every game's statistics tab: "Hints used"**, and how many per game. Connect has counted its hints from
  the start; Guess and Letters count from this version (older games are not in the "per game" figure).
- 256 Letters tests, 284 Connect tests.

## 0.28.2 — 2026-09-25 14:45: Litery gets hints, and a strip of what you already know
*(not packaged)*

The owner's idea, the owner's rules:
- **A strip above the grid: what you know.** One box per letter of the word - green with its letter where a guess
  had the right letter in that place (any guess, not only the last), dashed where a hint showed it - and then, in
  yellow, the letters known to be in the word that no box holds yet (as many times as they are still missing). So
  the whole game so far reads in one line: "this and this letter here, and I still have to place that one". It
  learns from a guess once the row has coloured in, like the keys.
- **Hint** - the bulb at the end of that strip: shows **one letter in its right place**, a random one not known
  yet. **It costs no try** (owner: it is a fun game) - it is only counted, and the end card says how many hints were
  used. At most half the word (rounded down) can come from hints, as in Connect; then the game says so, and also
  when every letter's place is already known. The status row keeps just Save & exit and Give up.
- The score is not changed by hints (asked of the owner).
- Rules in `letters.js` (`known`, `hintAt`); 8 new tests, 272 in all.

## 0.28.1 — 2026-09-25 14:39: Letters' keys colour in with their tiles, letter by letter
*(not packaged)*

- **The keyboard follows the row** (owner): as the tiles of a guess turn green / yellow / grey one after another, each
  letter's key takes its colour at the same moment as its tile - no longer all together once the row has finished.
  Never before its tile, so the keys still give nothing away.
- **A key that changes gives a small bounce** (owner's choice, option B): up to 1.12× and back in 0.18 s, as the
  tiles do. Only keys that learnt something bounce. "Reduce motion" in the system settings turns it off, as all motion.
- `keyStates` (letters.js) can now stop part-way through the newest guess; 4 new tests, 264 in all.
- Decided the same day: all-letter words that are inflected forms (STALI from LISTA) stay bonus words in Connect
  (the owner: option C, leave it).

## 0.28.0 — 2026-09-25 14:32: Connect circles of up to 10 letters
*(not packaged)*

- **Letters in the circle: 4 to 10** (was 7) - the owner: "a lot of words, but maybe that's the fun of it; nobody
  has to pick it". Boards aim for 7–12 words at 8 letters, 8–13 at 9, 9–14 at 10 (the new-game readout says so).
  Measured, 25 puzzles for every size, level and Polish-letters setting: 8 letters ~8–12 words on boards up to
  11 × 9; 9–10 letters ~10–14 words, up to 12 × 10 (a 10-letter word alone is 10 across). 2–6 ms a puzzle.
- **The circle holds them**: 8–10 letters sit on the same ring, a little smaller (20 %, 18.5 %, 17 % of the circle
  across), always at least 4 % of the circle apart so a finger lands on one letter at a time.
- 284 Connect tests (the new sizes included).

## 0.27.5 — 2026-09-25 14:30: Letters never hides or accepts a slur; "13,3" in Polish
*(not packaged)*

- **Letters uses the offensive-word list too** (owner: yes): no slur or vulgar word can be the hidden word -
  *mineta*, which the data's stoplist missed, included - and one typed as a guess gets the same answer as a
  word the game does not know. Inflected forms are caught through their base word; innocent look-alikes
  (CYGARO, SUKNIA, KUREK, RUCH) are not. 5 new tests, 260 in all.
- **The Guess tab's average win** is written the Polish way in Polish: 13,3, not 13.3 (the Letters tab already was).

## 0.27.4 — 2026-09-25 14:29: Connect hints are random letters, never more than half a word; a cleaner icon
*(not packaged)*

- **A hint is a random letter anywhere on the board** (owner: filling words one by one "is very wrong") - or,
  when a word was tapped first, a random letter of that word.
- **At most half of a word's letters can come from hints**, rounded down - 3 of 6, 2 of 5, 1 of 3 - "it should
  be a hint, not complete it for me". Letters showing through a word the player found do not count; a letter
  where two words cross counts for both. When every word left is at its limit, Hint says there are no more
  hints; a tapped word at its limit says so too. A word can still fill up through hints plus crossing words -
  then it counts, and the message says it is complete.
- Tests: the limit, random spread, the chosen word, crossings, running out; and 80 real boards hinted until
  Hint had nothing left - no word ever went over half. 176 Connect tests.
- **The Connect icon on the menu**: its grey ring ran between the joined letters too, under the green line.
  The grey is now only where no word joins the letters - from the last green letter round to the first.

## 0.27.3 — 2026-09-25 14:07: No slurs in Connect; no square on a tapped button; no text selection
*(not packaged)*

- **Slurs and vulgar words never go on a Connect board and are never accepted as bonus words** (owner:
  "slurs shouldn't be in crosswords - in bonus too"). A list of its own, `app/js/offensive.js` - Polish and
  English base words, their inflected forms caught through the base word (KURWY → KURWA, BITCHES → BITCH), and
  the roots Polish vulgar words are built from (WKURWIONY, ZAJEBISTY). Not the data's stoplist: that one also
  holds everyday words that must not be *hidden* (THEN, JAK), which are fine bonus words. A word with an
  innocent meaning too is on the list anyway: a missed bonus costs nothing. 8 new tests; no generated board
  has one.
- **A tapped button no longer shows a square** (the owner saw it on Hint): Android's grey tap box is gone, and
  on a touch screen a button left on screen after a tap no longer keeps its hover colour - that was the tinted
  square behind the icon (Hint, Shuffle, Give up, the steppers and chips).
- **Nothing on screen selects as text on a long press** - buttons, labels, tiles; text boxes still do.

## 0.27.2 — 2026-09-25 14:03: A bigger letter circle; every base word that uses all the letters is on the board
*(not packaged)*

From the owner's first games on the phone:
- **The circle is bigger**: up to 276 px across (was 240), and on a narrow phone it keeps 52 px each side for
  the tools instead of 56. The letters grow with it.
- **A word that uses every letter is always on the board** if it is a base word, whatever the level - the
  owner found such words ending up as bonus words. Measured over 360 games a language: 20 Polish and 16
  English ones were left off only for being rarer than the level (TORBA's circle also spells TABOR, SPORT
  STROP, RESET STEER, PANEL PENAL); now none are. A test checks it for every generated puzzle.
- Still bonus words: all-letter words that are **inflected forms** - LISTA → STALI, ZAWÓR → RAZÓW, DEATH →
  HATED, DENSE → NEEDS (284 Polish, 91 English in those games), because the board only takes base forms.
  Put to the owner.

## 0.27.1 — 2026-09-25 13:59: Fixes from a review of the new game screens
*(not packaged)*

A second pair of eyes (a reviewer agent) read the Connect and Letters game screens line by line, since they
could not be run in a browser in this session. No crash on the normal path; these were fixed:
- **Enter / Space pressed a button clicked earlier** instead of playing: a mouse click left the focus on
  Hint, Shuffle, the bonus counter or Give up, so Enter spent a hint (or gave the game up) rather than check
  the word. Those buttons no longer take the focus from the pointer (Tab still reaches them).
- **A word chosen for a hint stayed outlined** after a crossing word finished it - it now lets go once done.
- **Shuffle left the typed word showing** under the board.
- **Giving up during the 240 ms "not a word" shake** threw an error when the shake ended.
- **Letters: a key could stay pressed-looking** when the mouse slid off it before letting go; and each press
  left a listener behind on the key.
- **A second finger on the circle** restarted the word; the word is now the first finger's only. And nothing
  is judged once the game is over.
- **Leaving a game while its word data loaded** could put that game back on screen over the newer one (Letters
  and Connect; Guess has the same old race - noted in PLAN.md).

## 0.27.0 — 2026-09-25 13:51: Connect is playable
*(release APK built and installed on the owner's phone 2026-09-25 — before the review fixes in 0.27.1)*

The third game, Połącz / Connect, with the screens from the owner's design handoff v4 ("Lexling Connect").
- **The menu row opens it** (it said "soon" since 0.24.0) — its own list of games in progress, New game.
- **New game**: language, letters in the circle (4–7, with the usual number of words: 3–5 … 6–10), the
  level (Relaxed / Easy / Normal / Hard, or Random — drawn at the start, shown only as "Random"), and for
  Polish the Polish-letters card. If no puzzle comes out of the settings, it says so instead of starting.
- **The game**: the status row (words done / on the board, letters, level, language, Save & exit, Give up);
  the crossword, its tiles sized to the space left; one slot that shows the word being dragged and then the
  answer; the circle — drag across the letters (a line follows the finger; back onto the previous letter
  takes the last one off), let go to check. A board word fills in, tile by tile; one already there flashes;
  another real word flies into the **bonus** counter (tap it for the list); anything else goes red and the
  letters shake. **Shuffle** moves the letters round the circle. **Hint** shows one more letter of one word —
  tap a word on the board to choose which. On a computer the letters can be typed: Enter checks, Backspace
  takes one off, Space shuffles, Esc lets go.
- **The end**: the banner (✓ Ułożone / Solved, ✕ Poddałeś się / You gave up, words done / on the board), the
  card with the word that uses every letter — or, after giving up, the words that were left, in red — and
  the words, bonus words and hints; then the full board with a key: found (green), shown by a hint (dashed),
  left (red outline).
- **The saved-game card**: settings, "4 / 7 words · 2 bonus words", one square per board word.
- **Statistics**: a Connect tab — played, solved, words found, bonus words, and the longest word found drawn
  in green tiles; "All games" now counts Connect too.
- Checked: the rules by `tools/test-connect.mjs` (162) and `tools/test-letters.mjs` (255); the menu, the list,
  the new-game screen and the statistics rendered in Node in Polish and English; the game screen reviewed line
  by line (it could not be run in a browser in this session - see PLAN.md).

## 0.26.0 — 2026-09-25 13:43: Connect's rules (no screen yet)
*(not packaged)*

The third game, Połącz / Connect (PLAN.md M14, design v4), without its screens: `app/js/connect.js`.
- **A puzzle**: the circle is a common word's letters, shuffled (4–7, the player's choice); the board is a
  small crossword of the common words those letters make — 3–5 words for 4 letters up to 6–10 for 7 (the
  design's ranges) — always including the word that uses every letter. Board words are Letters' hidden
  words (base forms, no stoplist words, no inflected forms posing as words); any other real word, every Polish
  form included, is a **bonus word**.
- **The crossword**: each word crosses one already placed, never touches another side by side or end to end,
  so no accidental words form; the most crossings and the smallest board win; at most 10 across and 8 down,
  kept wider than tall, because on a phone the height runs out first.
- **Levels = how common the words are**, by their place in the frequency list: Relaxed the 5 000 most common,
  Easy 8 000, Normal 12 000, Hard 20 000. Not Letters' difficulty, which also weighs how rare a word's letters
  are - that matters for guessing letters, not when the circle hands them over. (Relaxed started at 3 000: four
  Polish letters then failed to make a board in 1 game of 15.)
- **Hints, as agreed**: each press shows the next letter that is not showing yet of one unfinished word - the
  chosen one, or the one showing the most letters (the shortest on a tie); a word whose letters all show counts.
- **Tests**: `tools/test-connect.mjs`, 162 of them - 25 puzzles for every language, circle size, level and
  Polish-letters setting, each checked cell by cell (crossings agree, nothing accidental, one piece, every word
  from the circle); the hint and judging rules. A puzzle takes 1–9 ms.

## 0.25.0 — 2026-09-25 13:38: Letters has its own keyboard
*(not packaged)*

From the owner's design handoff v4 ("Lexling Letters Keyboard"), with the owner's rules for the phone keyboard.
- **An on-screen keyboard** at the bottom of the Letters game, on phones and computers: QWERTY, **Enter**
  (it replaces the Guess button: grey until the row is full, then the theme colour) and **Backspace**. Polish
  games get **an extra row** above, ą ć ę ł ń ó ś ź ż. The grid scrolls between the status row and the keys.
- **The keys take the tile colours** — green, yellow, blue-grey for what the guesses have shown — and a small
  **"2"** (or 3…) when a letter is known to be in the word more than once. They change 150 ms after the row
  has coloured in, never before. A key acts the moment it is touched, darkens, and shows a preview above the
  finger.
- **Tap a tile to edit it**: a ring in the theme colour; the next letter replaces it and the selection moves on.
  Backspace empties the selected tile (on an empty one it steps back). Tap it again, tap elsewhere, press
  Enter or Esc to let go; the arrow keys move it on a computer.
- **Settings → Letters → Phone keyboard**, off by default. On: tapping the tiles also opens the phone's own
  keyboard; the keys on screen stay, and pressing one closes the phone's keyboard; tapping anywhere else
  closes it too (the owner's rules — the design had the on-screen keyboard disappear instead).
- **A computer's keyboard always types**, including Polish letters with AltGr.
- Gone with the keyboard: the Guess button, the "tap the boxes to type" line, and the how-to-play card at
  the start of a game (the design's start screen has no room for it at 320 × 640).
- The rules behind it are in `letters.js` (typing into the row, Backspace, the keys' colours and counts),
  with 15 new tests - the design's own examples among them (SHEET → STEEL gives E a "2"). 255 tests pass.

## 0.24.0 — 2026-09-25 13:30: A main menu for four games; the new Statistics screen
*(not packaged)*

From the owner's design handoff v4 (`design/v4/`, "Lexling Menu Four Games").
- **The menu has one compact row per game** — Guess, Letters, Connect, Tiles — all the same size, each with
  its own icon (two ranked strips; two rows of tiles; a ring of letters with SOWA / WORD joined in green;
  a small board). Four of the old big cards would have pushed Statistics and Settings off a phone's first
  screen. From a 600 px column the rows pair up 2 × 2. New headline and tagline: **"Play with words"** /
  **"Graj słowami"** — "Four word games. A new puzzle every time — offline, for as long as you like."
- **Connect and Tiles show "soon" / "wkrótce"** and do not open yet (the design's option until a game ships).
- **Glyphs** for Connect (five dots on a ring, three green) and Tiles (a 3 × 3 board), for the top-bar tags.
- **Statistics**: a tab per game that exists; each shows its numbers, then a chart — **guesses per win** for
  Guess (1–10 / 11–25 / 26–50 / 51+), **tries per win** for Letters (1–6, 7+, ✕ = out of tries), the
  commonest bar in the game's colour — then one line for all games: "All games 20 · 1:30 h played". A game
  not played yet says so ("No Guess games yet") and its numbers go dim. The charts count from this version:
  older wins were only ever stored as totals.
- **Kept, although the design dropped them**: Letters' **best score** (the design assumed points were going
  app-wide; only Connect has none), and every Guess statistic — the design showed four numbers per tab.
- Checked by rendering the menu and both tabs in Node, Polish and English, with and without data; every
  text key the code names exists in both languages.

## 0.23.0 — 2026-09-25 12:14: No more achievements
*(not packaged)*

- **Achievements (badges) are gone from both games** — the owner's choice: Lexling's games are for
  fun, and all four games will either have achievements or none. The statistics screen shows each
  game's numbers only, and the menu button says **Statistics** / **Statystyki** (was "Achievements &
  stats" / "Osiągnięcia i statystyki").
- **What only a badge showed stays, as a plain statistic**: in Guess — unique words (was Wordsmith),
  hard words won, difficulty 70+ (Deep Cut), categories won, of 21 with "All" (Explorer), wins
  Polish / English (Polyglot); in Letters — the wins-by-word-length strip (Full range). The rest
  already had their own statistic (games won, best score, best streak, best win, hardest word,
  letters typed, time).
- Removed: `badges.js`, the tier colours and badge-card styles, and every badge, tier and "badges."
  string in both languages. The saved "tiers seen" record is no longer written.
- Checked by rendering both statistics tabs and the menu in Polish and English: every number in place,
  no badge text left anywhere, all 240 Letters tests pass.

## 0.22.6 — 2026-09-25 11:53: The start screen's bottom bar shows only the version
*(not packaged)*

- The bar at the bottom of the start screen read `v0.22.5 · Polish + English vocab bundled · No account,
  no network`. It now shows only the version, and the thin line above it is gone (owner). Windows and
  Android alike - both run the same app. The Settings screen's bar (© 2026 Husarp · All rights reserved)
  is unchanged. The two texts nothing shows any more were removed from the strings.


## 0.22.5 — 2026-09-25 04:36: The Android APK is signed with Lexling's own key
*(released 2026-09-25 as v0.22.5 — Windows installer + the signed Android APK, Lexling-release.apk)*

- **`build-android.ps1` now makes the signed APK** (`build\Lexling-release.apk`) by default, and
  releases carry it instead of `Lexling-debug.apk` (the owner's choice, knowing the cost below). The
  debug build is still there: `-DebugBuild`. Without `android\keystore.properties` the script stops
  rather than make an APK that cannot be installed.
- **One uninstall per phone:** Android updates an app only with an APK signed by the same key, so a
  phone with the debug-signed Lexling (0.22.2 / 0.22.4) has to uninstall it first — which deletes its
  Lexling saves and statistics. From this version on, updates install over it normally.

## 0.22.4 — 2026-09-25 04:29: An Android signing key of Lexling's own
*(released 2026-09-25 as v0.22.4 — Windows installer + Android debug APK, carrying 0.22.3 too)*

- **Release builds are now signed with Lexling's own key** (`build-android.ps1 -Release` →
  `build\Lexling-release.apk`, installable). Until now every APK was signed with the debug key
  Android Studio makes on this PC by itself: Android installs an update only over an app signed with
  the same key, so losing that one (a new PC, a reinstall) would have forced everyone to uninstall
  Lexling — and lose their saves — to update. Debug builds are also not meant for handing out.
- The key (holder "Husarp", 27 years) lives **outside the repository**; `android/keystore.properties`
  says where it is and holds its password. Both are git-ignored (so are any `*.jks` / `*.keystore`).
  Without that file a release build is left unsigned, as before.
- Checked without packaging: Gradle picks the key up and its own signing check opens it with the
  stored password.
- Not changed yet: the debug APK is still what the build makes by default and what releases carry.
  Moving to the release APK means one uninstall on every phone that has the debug one.

## 0.22.3 — 2026-09-25 04:19: Android shows the real version number
*(not packaged)*

- **Android's App info said version 1.0** for every build: the Android project had its own number, set
  once and never changed. It now reads the version from `app/js/version.js` — the one place it is
  written, as the Windows build already does — so App info shows e.g. 0.22.3. The build number Android
  uses to tell a newer APK from an older one follows it: X × 10000 + Y × 100 + Z (0.22.3 → 2203), so
  it grows with every version. Checked without packaging: Gradle computes 0.22.2 / 2202 from 0.22.2.


## 0.22.2 — 2026-09-25 04:10: + at 20 tries goes on to unlimited
*(released 2026-09-25 as v0.22.2 — Windows installer + Android APK, the first release as Lexling, so it carries 0.18.0–0.22.1 too; the APK is also on the phone)*

- **The tries stepper runs 1 … 20 → ∞**: + at 20 switches Unlimited on, and − from ∞ goes back to 20.
  The Unlimited button stays, for getting there (and back to your number) in one tap. The ∞ is no
  longer greyed out — it is a value of the stepper now, not a stepper switched off.

## 0.22.1 — 2026-09-25 04:05: Unlimited tries score like 20 tries
*(not packaged)*

- **Unlimited tries now count as 20 tries (×0.3)**, the most you can choose, instead of ×0.5. At ×0.5
  unlimited paid more than choosing 13–20 tries, although it can never lose — so nobody had a
  reason to pick those. Now unlimited never pays more than any limit.
- The new-game tries hint says so: "fewer tries, more points — unlimited counts as 20".

## 0.22.0 — 2026-09-25 03:56: Letters scoring - fewer tries pay more; running out of tries pays a little
*(not packaged)*

- **The tries you allow yourself count**: the score is now also × 6 ÷ tries allowed — 6 (the classic
  Wordle) ×1, 3 tries ×2, 12 tries ×0.5. With **unlimited** tries every guess counts as two (×0.5).
  Before, unlimited could never lose and still paid in full, so it was always the best choice.
  The end card's sum shows it: `5 letters ÷ 2 guesses × 100 × 1 Easy × 2 (3 tries)`.
- **Out of tries is no longer 0**: the best row — its greens, and its yellows at half — as a share of
  the word, of a quarter of what a win on the very last try would have paid. The end card writes the
  sum out. Giving up still pays 0. Only wins count towards the best score in the statistics.
- **New-game screen**: the tries hint said "the score only counts the ones you use" — now
  "fewer tries, more points — unlimited counts every guess twice".

## 0.21.0 — 2026-09-25 03:45: Random difficulty; real numbers on the end banner
*(not packaged)*

- **Random difficulty in Letters**: a switch beside the four levels (the same row as Tries + Unlimited
  and Length + Any). The game draws one of the four when it starts and scores with that level's
  multiplier, but shows only "Random" / "Losowy" — on the new-game summary, the saved-games card and
  the end card, whose sum reads "× the random level's multiplier". While Random is on the four levels
  step back; tapping one switches Random off. It first went in as a fifth button, but at 320 px all
  five labels overflowed even at their smallest size — measured, so it became a switch.
- **Never X on the end banner**: the tries actually used, however the game ended — out of tries
  `6/6`, given up `2/6` (and `0/6`), won `3/6`, unlimited `3/∞`.
- **The ✓ / ✕ are centred in their circle**: they were typed characters the display font does not
  have, so a fallback font drew them off-centre; now they are drawn (SVG) — 0.01 px from centre.

## 0.20.1 — 2026-09-25 03:27: Giving up before a guess says 0/6
*(not packaged)*

- The banner said **X/6** however the game ended without the word. Given up before the first guess it
  now says **0/6** — nothing was tried, so an X read wrong (owner). After a guess, and out of tries, it
  stays X as in the design.

## 0.20.0 — 2026-09-25 03:22: A new ending for every game — clear at a glance how it went
*(debug APK built and installed on the phone 2026-09-25 03:25 — not released)*

From the owner's second design handoff (`design/letters/handoff-v2/`), in both games:
- **An outcome banner comes first**, full width: **✓ on green** for a win, **✕ on red** for out of tries
  or giving up, with the guess count on the right (`3/6`, `X/6`, `11/∞`; in Znaczenie the number of
  guesses). Under it a plain card edged in the same colour holds the word, the numbers and the
  buttons. It replaces the orange panel (a win) and the grey card (a loss), which looked alike.
- **New wording**, the owner's for a win and the design's for the rest: **Zgadłeś / Guessed correctly**
  (was Udało się / You got it), **Koniec prób / Out of tries**, **Poddałeś się / You gave up**; the card
  labels the word **Słowo / The word**, **Szukane słowo to / The word was**, and in Znaczenie
  **Sekretne słowo / Secret word**.
- **Znaczenie** keeps its status row above the banner. Giving up there now names the closest guess
  ("najbliżej: pies, pozycja 46 857"); a win shows the best win so far.
- **Out of tries shows the word in the grid too**, as a green row growing in — like giving up (0.19.2).
- Left out of the design on purpose: its **Copy result** button and clipboard card (removed in 0.17.2 at
  the owner's request). Kept although the design has not got it: the **category** on the numbers line
  (asked for in 0.17.0).

Checked in the browser: every ending of both games, in Polish and English, at 412 and 320 px — "GUESSED
CORRECTLY" wraps to two lines inside the banner at 320, nothing scrolls sideways, no console errors.

## 0.19.2 — 2026-09-25 03:07: Giving up shows the word in the grid
*(debug APK built and installed on the phone — not released)*

- After **Give up**, the word appears as one more row under your guesses, all green, growing in tile by
  tile like a new row does. (Out of tries still shows the word only on the card — say if that should
  get the row too.)

## 0.19.1 — 2026-09-25 03:04: A guess colours in as fast as a new row appears
*(debug APK built and installed on the phone — not released)*

- The colour reveal of a guessed row took 360 ms a tile, 120 ms apart (0.84 s for 5 letters, ~1.4 s for
  13). It now matches the new row growing in: 180 ms a tile, 30 ms apart — 0.3 s for 5 letters, under
  half a second for 13. The pause before the win / loss card follows it (it waits for the last tile).

## 0.19.0 — 2026-09-25 02:55: Letters fits the screen, however many tries
*(debug APK built and installed on the phone 2026-09-25 03:01 — not released)*

From playing on the phone: with many tries (20) the grid ran off the screen and took the status row or
the Guess button with it.
- **The screen fits the window while you play.** The status row (tries, length, category, language)
  stays at the top, Guess stays right under the grid, and only the grid scrolls once it outgrows the
  room — always kept at the row being typed. Measured at 412 × 780 with 14 guesses of 20: the page no
  longer scrolls, status and Guess both in view, the current row visible. On a wide window with two
  guesses, Guess sits 12 px under the grid, not at the bottom of the window. The end screen is an
  ordinary scrolling page again; with the phone keyboard open the design's layout still applies.
- **No empty rows for the tries to come.** Only the row being typed is drawn; one more appears after
  each guess (the status row already shows how many tries are left). Limited and unlimited games now
  look the same.
- **A new row grows in**, tile by tile from the left, from small to full size: 180 ms a tile, 30 ms
  apart — a 5-letter row is done in 0.3 s, a 13-letter one in under half a second.

## 0.18.3 — 2026-09-25 02:38: Android ID com.husarp.lexling
*(debug APK built and installed on the phone 2026-09-25 02:41 — as a new app next to the old WordGuess; not released)*

- The owner chose `com.husarp.<name>` as the form for every app's ID, shorter than
  `io.github.husarp.<name>`. Lexling's ID from 0.18.0 had never been built or installed anywhere, so it
  changed for free: `io.github.husarp.lexling` → **`com.husarp.lexling`**. Nothing checks that the
  owner has the web address husarp.com — the ID is only a name, unique is all it has to be.

## 0.18.2 — 2026-09-25 02:37: "le" moved down, centred in the icon
*(not packaged)*

- The mark sat high: the design lifted it by .15em to make room for the tail of the g in "gu", and
  "le" has no tail — 128 px of space above it and 203 below, on the 1024 icon. Lifted by .10em
  instead, it is centred (166 above, 165 below). Windows icon, Android launcher icons and splash
  regenerated.

## 0.18.1 — 2026-09-25 02:36: The icon says "le"
*(not packaged)*

- **The icon now reads "le"** (Lexling) instead of "gu" (from Word**Gu**ess): same design — a black
  squircle, white Barlow Condensed ExtraBold, the orange caret — only the letters changed. It reaches the
  Windows icon, the PNGs, and the Android launcher icons and splash screens (regenerated with
  @capacitor/assets on the same black background: the same 44 files as before, nothing added).
- `tools/make-icon.py` now also writes the two Android masters, `assets/icon.png` and the splash, which
  had been made by hand in 0.13.2 — measured first: the old splash was exactly the icon at a quarter of a
  2732 px black square, and the script reproduces it pixel for pixel.

## 0.18.0 — 2026-09-25 02:24: WordGuess is now Lexling; Letters in the owner's colours
*(not packaged)*

**The new name, everywhere.** Logo LEX/LING (the orange slash kept from WORD/GUESS), the menu's big
L/, the page and window title, the About text (which also stopped calling it "a semantic word game" —
there are two games now), the footers, the licence, the build files and their outputs
(`LexlingSetup.exe`, `Lexling-debug.apk`), the GitHub repository (`Husarp/lexling`) and the project
folder.

- **Windows: an update, not a new install.** The Lexling setup recognises a WordGuess install, closes
  it, removes its program folder, shortcuts and uninstall entry, and **moves the saves folder**
  `%LOCALAPPDATA%\WordGuess` → `%LOCALAPPDATA%\Lexling` whole. The game makes the same move on its
  first start, whichever comes first; when both folders exist it never touches the old one. The local
  port — the origin the saves belong to — is unchanged, so every save reads as before. Tested with
  throwaway folders and a fake registry (10 checks, the real saves and registry never opened).
- **Android: a new ID, `io.github.husarp.lexling`** (the old one carried the name of the owner's
  employer, public on GitHub). Android treats it as a new app: it installs next to the old one, and
  games saved in the old app stay there.
- The game's own storage keys stay `wg.*` on purpose — renaming them would lose every save.
- Still to do: the icon draws "gu", from Word**Gu**ess.
- The other apps were checked for the employer's name: Car Crash, Browser Switch and Lockdown have
  none.

**Letters in the colours and style of the owner's reference picture**: green #79B851, yellow #F3C237,
blue-grey #A4AEC4, white letters on all three, solid tiles with only slightly rounded corners, the
plain bold sans instead of the condensed display face, and — in the light theme — near-white empty
tiles with a 2 px #DEE1E9 edge, exactly as in the picture. The same colours reach the mini squares
(menu, saved games, how-to legend), the Letters icon and the Full range strip. The theme colour still
only outlines the caret box.

## 0.17.2 — 2026-09-25 01:04: Copy result removed
*(released 2026-09-25 as v0.17.2 — Windows installer + Android APK; the first release since v0.15.0, so it carries 0.15.1–0.17.1 too)*

- **The Letters end screen no longer has "Copy result".** It copied a 🟩🟨⬛ summary of the game for
  sharing in a chat, Wordle-style; the owner asked what it was for, found it looked bad, and asked
  for it to go. The end card now has Play again and Menu. Its code, its three strings and its
  styles are gone with it.

## 0.17.1 — 2026-09-25 00:53: More Polish words count as guesses in Letters; status bar rearranged
*(debug APK built and installed on the phone 2026-09-25 00:54 — not released)*

- **50 162 more Polish words are valid Letters guesses** — *pasę, pasą, poszedłem, szedłem,
  poszliśmy*. The dictionary lists these on their own, with nothing linking them to a base word, and
  the data build dropped them because Guess needs the base word to score a guess. Letters only needs
  to know it is a word, so they now ship as a guess-only list, `extra.txt` (0.5 MB, Polish; the English
  one is empty). Guess never reads it, and every other data file came out of the rebuild byte for
  byte unchanged.
  Honest about what is in it: not only irregular forms — also rare regular forms and a few oddities
  (*aaa*, *abc*). Filtering by "used on the web" was measured and rejected: it keeps *aaa* and drops
  38 480 real rare forms. Still missing: forms the dictionary itself lacks, like *pasłem* (PLAN.md).
- **Status bar, both games:** the numbers (guesses, length, category, language) spread across the
  whole first row; Save & exit and Give up moved to their own row underneath, on the left, 12 px
  apart instead of 4.

231 tests pass (3 new: the irregular forms, the lengths, no repeats of the main list).

## 0.17.0 — 2026-09-25 00:34: A games list per mode, any word length, framed buttons
*(debug APK built and installed on the phone 2026-09-25 00:39 — not released)*

From playing 0.16.0 on the phone:
- **Each game has its own list of games in progress.** The menu cards used to jump straight into New
  game; now Znaczenie opens Znaczenie's games and Litery opens Letters' games, each with its own New
  game button. The shared list, its All / Znaczenie / Litery tabs, the "which game?" menu and the
  separate "Twoje gry" button on the menu are gone. Back buttons, Save & exit and Esc all return to
  the list of the game you came from.
- **Any word length in Letters.** A "Dowolna / Any" switch next to the length: the game picks a
  random word of any length from 3 to 13, drawn like real words, so lengths come up as often as
  words of them exist — at Normal, 5–9 letters are about three words in four; 3 and 13 are rare.
- **The end screen names the category** the game was played in, win or loss, in both games
  ("kategoria **Zwierzęta** · 2 / 6 prób · wynik 313"). Friend-mode Guess games have none, so none
  is shown.
- **Every text-only button has a frame now**, app-wide: Save & exit, Give up, Rename, Delete, Hint,
  the back buttons in the top bar, Menu on the end cards.
- **Repeated letters checked, not changed.** Asked whether a letter in its right place could be
  shown yellow because the word has the same letter elsewhere (`ananas`): it cannot — right places
  are settled first. Four tests on `ananas` now prove it (`granat` → the three in place green).

228 tests pass (20 new).

## 0.16.0 — 2026-09-24 23:56: Letters mode is playable — the second game in the app
*(debug APK built 2026-09-25 00:14 for testing on a phone — not released)*

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

- **`build\WordGuess-debug.apk`, 34.5 MB**, package ID later replaced (0.18.0), target SDK 35.
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
