// Every piece of UI text. Strings may contain markup (they are ours); anything a player typed goes through esc().
// Arrays are plural forms: en [one, other] · pl [one, few, many]  (1 próba · 2 próby · 5 prób).
const STR = {
  en: {
    'back.menu': '← Menu', 'back.games': '← Games', 'menu': 'Menu', 'sure': 'Sure?', 'save': 'Save',
    'menu.eyebrow': 'Word games', 'menu.offline': 'offline',
    'menu.h1': 'Guess the<br>hidden <span style="color:var(--accent)">word</span>',
    'menu.tagline': 'Two ways to find it: by what it means, or letter by letter. A new word every game, as many games as you like.',
    'menu.modesAria': 'Choose a game',
    'menu.stats': 'Achievements &amp; stats', 'menu.settings': 'Settings', 'menu.nav': 'Main menu',
    'mode.guess': 'Guess', 'mode.letters': 'Letters',
    'mode.guess.d': 'Find the word by meaning. Every guess gets a rank — 1 is the nearest neighbour.',
    'mode.letters.d': 'Find the word letter by letter. Green, yellow and grey tell you what stays.',
    'mode.inProgress': '{n} in progress',
    'foot.vocab': 'Polish + English vocab bundled', 'foot.offline': 'No account, no network', 'foot.rights': 'All rights reserved',

    'games.title': 'Your games', 'games.new': 'New game', 'games.resume': 'Resume', 'games.rename': 'Rename', 'games.delete': 'Delete',
    'games.emptyTitle': 'No saved games',
    'games.emptyText': 'Start a game and it saves itself after every guess. Come back to it any time — or run several at once.',
    'games.best': 'best word:', 'games.defaultName': 'Game {n}', 'games.nameLabel': 'Game name',
    'n.guesses': ['guess', 'guesses'], 'n.unique': ['unique', 'unique'],
    'ago.now': 'just now', 'ago.min': '{n} min ago', 'ago.h': '{n} h ago', 'ago.yesterday': 'yesterday', 'ago.days': '{n} days ago',

    'cat.all': 'All', 'cat.allLong': 'All categories', 'cat.animals': 'Animals', 'cat.food': 'Food &amp; drink',
    'cat.household': 'Household', 'cat.clothing': 'Clothing', 'cat.tools': 'Tools', 'cat.tech': 'Technology',
    'cat.vehicles': 'Vehicles', 'cat.buildings': 'Buildings', 'cat.nature': 'Nature', 'cat.weather': 'Weather',
    'cat.body': 'Body', 'cat.people': 'People', 'cat.jobs': 'Jobs', 'cat.school': 'School', 'cat.science': 'Science',
    'cat.sport': 'Sport', 'cat.music': 'Music &amp; art', 'cat.feelings': 'Feelings', 'cat.abstract': 'Abstract',
    'cat.verbs': 'Verbs',
    // What each category can hide. The point is to say where the edges are: a player who knows the
    // answer is an animal, not a word about animals, stops wasting guesses on "pet" and "wildlife".
    'about.all': 'Any word at all. Everything below only narrows what the answer can be — you can always guess anything you like.',
    'about.animals': 'Real animals, from pets to wild ones and insects. Never words meaning "animal", and never made-up creatures.',
    'about.food': 'Food and drink: ingredients, dishes, fruit, meals. Not the plates or the cooking.',
    'about.household': 'Things around the home: furniture, kitchen things, bedding, cleaning.',
    'about.clothing': 'Clothes, shoes and accessories, plus the fabrics they are made of.',
    'about.tools': 'Tools and the small hardware that goes with them — screws, rope, wire, tape.',
    'about.tech': 'Computers, phones, parts and the words around them.',
    'about.vehicles': 'Things that carry you: cars, trains, boats, planes, and their parts.',
    'about.buildings': 'Buildings and the parts of them — rooms, roofs, doors, stairs.',
    'about.nature': 'Landscape and growing things: mountains, rivers, trees, stone, soil.',
    'about.weather': 'Weather and what the sky does, mild or violent.',
    'about.body': 'Parts of the body, inside and out.',
    'about.people': 'Family and the people around you, by relation rather than by job.',
    'about.jobs': 'What people do for a living.',
    'about.school': 'School and studying: the things, the places and the paperwork.',
    'about.science': 'Science words: matter, energy, life and the laboratory.',
    'about.sport': 'Sports, the people who play them, and where they are played.',
    'about.music': 'Music and art: instruments, forms and the works themselves.',
    'about.feelings': 'What people feel, good and bad.',
    'about.abstract': 'Ideas you cannot touch: time, truth, freedom, luck.',
    'about.verbs': 'Actions — the answer is something you do, not a thing.',
    'diff.relaxed': 'Relaxed', 'diff.easy': 'Easy', 'diff.normal': 'Normal', 'diff.hard': 'Hard',
    'game.hint': 'Hint', 'game.hintsUsed': '{n} used', 'game.hintMark': 'hint',
    'game.hintNone': 'You are one word away — no hint left to give.',
    'game.hintFail': 'No hint to give here.',

    'new.title': 'New game', 'new.lang': 'Language', 'new.cat': 'Category', 'new.catHint': 'limits the secret word only',
    'new.len': 'Secret length', 'new.lenAria': 'Secret length band', 'new.diff': 'Difficulty',
    'band.short': 'Short', 'band.medium': 'Medium', 'band.long': 'Long', 'band.any': 'Any',
    'new.lenCount': 'letters <span class="dot">·</span> {n} {words} this game can hide',
    'new.lenEmpty': 'no word of this length here — pick another band',
    'new.lenHelp': '<strong style="font-weight:600;color:var(--text)">{any}</strong> draws from the whole dictionary — long words stay rare on their own, no extra rule needed.',
    'n.words': ['word', 'words'],
    'new.diffHelp': 'How hard the hidden word itself is — the same everywhere, so Easy in Animals is as easy as Easy in Jobs. Relaxed keeps to words everybody knows.',
    'new.friend': 'Friend mode', 'new.friendDesc': 'A friend types the secret word instead of the engine.', 'new.friendShort': 'Friend',
    'new.secret': 'Secret word', 'new.secretHint': 'hidden while typing', 'new.secretAria': 'Secret word typed by a friend',
    'new.formsHelp': 'Any form works — {forms} — it\'s collapsed to the base word.',
    'new.start': 'Start game', 'new.errNoWords': 'No secret word matches these settings — loosen them a little.',
    'new.errUnknown': 'The game doesn\'t know this word — try another one.',

    'game.guesses': 'Guesses', 'game.category': 'Category', 'game.language': 'Language', 'game.time': 'Time',
    'game.saveExit': 'Save &amp; exit', 'game.giveUp': 'Give up', 'game.placeholder': 'Type a word…', 'game.inputAria': 'Your guess',
    'game.submit': 'Guess', 'game.emptyTitle': 'Any word you know is a guess',
    'game.emptyText': 'The number you get back is a <strong style="color:var(--text)">rank</strong> — how many words are closer in meaning to the secret. <strong style="color:var(--text)">1</strong> means nothing is closer. Thousands means change direction.',
    'game.far': 'far', 'game.close': 'close', 'game.formsHint': 'Typed <em>{a}</em>? It counts as <em>{b}</em> — forms collapse to the base word.',
    'game.latest': 'latest', 'game.secret': 'secret', 'game.all': 'All guesses', 'game.topAria': 'Top 5 closest guesses', 'game.latestAria': 'Latest guess',
    'game.inGame': 'in game', 'game.endCat': 'category', 'game.bestWin': 'best win',
    'game.unknown': 'I don\'t know the word “{w}”.', 'game.already': '“{w}” was already guessed — rank {r}.',
    'pos.noun': 'noun', 'pos.adj': 'adjective', 'pos.verb': 'verb', 'pos.adv': 'adverb', 'pos.other': '',

    'stats.title': 'Statistics', 'stats.played': 'Games played', 'stats.won': 'Won', 'stats.givenUp': 'Given up', 'stats.words': 'Words guessed',
    'stats.letters': 'Letters typed', 'stats.time': 'Time in game', 'stats.bestWin': 'Best win', 'stats.avgWin': 'Average win', 'stats.perWon': 'guesses per won game',
    'stats.hardest': 'Hardest word beaten', 'stats.hardestSub': 'difficulty {n} / 100',
    'stats.timeSub': 'active play',
    'badges.title': 'Badges', 'badge.wordsmith': 'Wordsmith', 'badge.wordsmith.d': 'number of unique words you have typed',
    'badge.typist': 'Typist', 'badge.typist.d': 'letters typed across all games',
    'badge.sharpshooter': 'Sharpshooter', 'badge.sharpshooter.d': 'fewest guesses in a won game, no category',
    'badge.slayer': 'Giant Slayer', 'badge.slayer.d': 'the hardest word you have beaten, no category',
    'badge.deepcut': 'Deep Cut', 'badge.deepcut.d': 'wins on a word of difficulty 70 or more',
    'badge.explorer': 'Explorer', 'badge.explorer.d': 'categories you have won in at least once',
    'badge.marathon': 'Marathon', 'badge.marathon.d': 'time spent actually playing',
    'badge.polyglot': 'Polyglot', 'badge.polyglot.d': 'wins in both languages, counted in the weaker one',
    'badges.noCat': 'Speed and difficulty count games without a category — a hint narrows 6 000 words down to a few hundred.',
    'tier.bronze': 'Bronze', 'tier.silver': 'Silver', 'tier.gold': 'Gold', 'tier.diamond': 'Diamond', 'tier.amethyst': 'Amethyst',
    'badges.winIn': 'win in less than {n} moves for {tier}', 'badges.done': 'All tiers unlocked',
    'badges.of': 'of {n}', 'badges.toGo': '{n} to {tier}',

    'set.title': 'Settings', 'set.lang': 'App language', 'set.langDesc': 'Interface only — game vocab is chosen per game.',
    'set.theme': 'Theme', 'set.themeDesc': 'Dark matches the window colour; no flash on launch.', 'theme.dark': 'Dark', 'theme.light': 'Light', 'theme.system': 'System',
    'set.sound': 'Sound', 'set.soundDesc': 'Short click on guess, chime on win.',
    'set.accent': 'Theme colour', 'set.accentDesc': 'Recolours everything the orange touches.',
    'set.fuzzy': 'Better suggestions', 'set.fuzzyDesc': 'Also suggests words when the spelling is close — rz for ż, u for ó, om for ą.',
    'set.updates': 'Updates', 'set.version': 'Version {v}', 'set.upToDate': 'Up to date', 'set.checked': 'checked {d}', 'set.never': 'Not checked yet',
    'set.available': 'Version {v} is available', 'set.failed': 'Couldn\'t check — no connection?', 'set.noRepo': 'Update source is not set up yet',
    'set.check': 'Check for updates', 'set.checking': 'Checking…', 'set.get': 'Get it',
    'set.about': 'About', 'set.aboutText': '<strong>Lexling</strong> — word games. Find a hidden word by its meaning, where every guess is ranked by how close it is, or letter by letter.',
    'set.vocab': 'Vocab', 'set.vocabText': 'Polish {pl} words <span class="dot">·</span> English {en} words <span class="dot">·</span> bundled, offline',
    'set.vectors': 'Vectors', 'set.vectorsReal': 'fastText cc.pl.300 / cc.en.300, {d} dimensions, int8',
    'set.saves': 'Saves', 'set.savesText': 'Stored outside the program folder — updates never touch them.',

    // Letters mode
    'lt.len': 'Word length', 'lt.letters': ['letter', 'letters'], 'lt.shorter': 'Shorter', 'lt.longer': 'Longer',
    'lt.anyLen': 'Any', 'lt.anyLenLong': 'any length',
    'lt.canHide': 'words this game can hide', 'lt.none': 'no word fits these settings',
    'lt.tries': 'Tries', 'lt.triesHint': 'the score only counts the ones you use', 'lt.triesUnit': ['try', 'tries'],
    'lt.unlimited': 'Unlimited', 'lt.fewer': 'Fewer', 'lt.more': 'More', 'lt.noLimit': 'unlimited tries',
    'lt.polish': 'Polish letters',
    'lt.polishOn': 'The word may contain them, and each one counts <strong style="color:var(--text)">double</strong> in the score. <em>ż</em> is its own letter — <em>z</em> does not match it.',
    'lt.polishOff': 'The word is guaranteed to have none of them. Turn on for harder words and a bigger score.',
    'lt.marksShort': 'ą–ż ×2',
    'lt.catNouns': 'Categories hold nouns only — with a category the word is always a noun.',
    'lt.diffHelp': 'How well-known the word is and how unusual its letters are — rare and repeated letters make it harder. The score is multiplied by 0.75, 1, 1.25 or 1.5.',
    'lt.errNoWords': 'No word matches these settings — change the length, the category or the difficulty.',
    'lt.length': 'Length', 'lt.typed': '{a} / {n} {letters}', 'lt.tap': 'Tap the boxes to type', 'lt.submit': 'Guess',
    'lt.unknown': 'I don\'t know the word “{w}”.', 'lt.needN': 'Needs {n} {letters} — you typed {k}.',
    'lt.already': 'You already tried “{w}”.',
    'lt.howTitle': 'Find the word letter by letter',
    'lt.hit': 'Right letter, right place', 'lt.near': 'In the word, somewhere else', 'lt.miss': 'Not in the word',
    'lt.howNote': 'Nothing is sent until you press Enter or Guess. Every guess stays on screen, so the dead letters can be read straight off it.',
    // how a game ended (both modes): the banner, then the card's label for the word
    'end.won': 'Guessed correctly', 'end.lost': 'Out of tries', 'end.gaveUp': 'You gave up',
    'end.wordWon': 'The word', 'end.wordLost': 'The word was', 'end.guessWordWon': 'Secret word', 'end.closest': 'closest: {w}, rank',
    'lt.score': 'score', 'lt.best': 'best', 'lt.again': 'Play again',
    'lt.calc': '{p} letters{double} ÷ {g} {guesses} × 100 × {m} {diff}', 'lt.double': ['({l} counts ×2)', '({l} count ×2)'],
    'games.triesOf': '{g} / {t} tries', 'games.notStarted': 'no guesses yet',
    'stats.streak': 'Win streak', 'stats.streakBest': 'best {n}', 'stats.bestScore': 'Best score', 'stats.perWonLt': 'tries per won game',
    'stats.shared': 'Across all games', 'stats.lettersTyped': 'letters typed',
    'badges.letters': 'Letters badges',
    'badge.champion': 'Champion', 'badge.champion.d': 'Letters games won',
    'badge.highscore': 'High score', 'badge.highscore.d': 'your best single-game score',
    'badge.streak': 'On a roll', 'badge.streak.d': 'longest run of wins in a row',
    'badge.range': 'Full range', 'badge.range.d': 'word lengths you have won at, 3 to 13', 'badge.range.strip': 'wins at each length',
  },
  pl: {
    'back.menu': '← Menu', 'back.games': '← Gry', 'menu': 'Menu', 'sure': 'Na pewno?', 'save': 'Zapisz',
    'menu.eyebrow': 'Gry słowne', 'menu.offline': 'offline',
    'menu.h1': 'Odgadnij<br>ukryte <span style="color:var(--accent)">słowo</span>',
    'menu.tagline': 'Dwa sposoby, żeby je znaleźć: po znaczeniu albo litera po literze. Nowe słowo w każdej grze, gier ile chcesz.',
    'menu.modesAria': 'Wybierz grę',
    'menu.stats': 'Osiągnięcia i statystyki', 'menu.settings': 'Ustawienia', 'menu.nav': 'Menu główne',
    'mode.guess': 'Znaczenie', 'mode.letters': 'Litery',
    'mode.guess.d': 'Szukaj słowa po znaczeniu. Każda próba dostaje pozycję — 1 to najbliższy sąsiad.',
    'mode.letters.d': 'Szukaj słowa litera po literze. Zielone, żółte i szare mówią, co zostaje.',
    'mode.inProgress': 'w toku: {n}',
    'foot.vocab': 'Słowniki polski + angielski w zestawie', 'foot.offline': 'Bez konta, bez sieci', 'foot.rights': 'Wszelkie prawa zastrzeżone',

    'games.title': 'Twoje gry', 'games.new': 'Nowa gra', 'games.resume': 'Wznów', 'games.rename': 'Zmień nazwę', 'games.delete': 'Usuń',
    'games.emptyTitle': 'Brak zapisanych gier',
    'games.emptyText': 'Rozpocznij grę, a zapisze się sama po każdej próbie. Wróć do niej w dowolnej chwili — albo prowadź kilka naraz.',
    'games.best': 'najlepsze słowo:', 'games.defaultName': 'Gra {n}', 'games.nameLabel': 'Nazwa gry',
    'n.guesses': ['próba', 'próby', 'prób'], 'n.unique': ['unikalne', 'unikalne', 'unikalnych'],
    'ago.now': 'przed chwilą', 'ago.min': '{n} min temu', 'ago.h': '{n} godz. temu', 'ago.yesterday': 'wczoraj', 'ago.days': '{n} dni temu',

    'cat.all': 'Wszystkie', 'cat.allLong': 'Wszystkie kategorie', 'cat.animals': 'Zwierzęta', 'cat.food': 'Jedzenie',
    'cat.household': 'Dom', 'cat.clothing': 'Ubrania', 'cat.tools': 'Narzędzia', 'cat.tech': 'Technika',
    'cat.vehicles': 'Pojazdy', 'cat.buildings': 'Budynki', 'cat.nature': 'Natura', 'cat.weather': 'Pogoda',
    'cat.body': 'Ciało', 'cat.people': 'Ludzie', 'cat.jobs': 'Zawody', 'cat.school': 'Szkoła', 'cat.science': 'Nauka',
    'cat.sport': 'Sport', 'cat.music': 'Muzyka i sztuka', 'cat.feelings': 'Uczucia', 'cat.abstract': 'Abstrakcyjne',
    'cat.verbs': 'Czasowniki',
    'about.all': 'Dowolne słowo. Wszystko poniżej tylko zawęża to, czym może być hasło — zgadywać zawsze możesz cokolwiek.',
    'about.animals': 'Prawdziwe zwierzęta: domowe, dzikie i owady. Nigdy słowa znaczące „zwierzę", nigdy stworzenia z bajek.',
    'about.food': 'Jedzenie i picie: składniki, dania, owoce, posiłki. Nie naczynia i nie gotowanie.',
    'about.household': 'Rzeczy z domu: meble, kuchnia, pościel, sprzątanie.',
    'about.clothing': 'Ubrania, buty i dodatki, a także materiały, z których są uszyte.',
    'about.tools': 'Narzędzia i drobnica, która do nich należy — śruby, lina, drut, taśma.',
    'about.tech': 'Komputery, telefony, podzespoły i słowa wokół nich.',
    'about.vehicles': 'To, czym się jeździ i lata: samochody, pociągi, statki, samoloty i ich części.',
    'about.buildings': 'Budynki i ich części — pokoje, dachy, drzwi, schody.',
    'about.nature': 'Krajobraz i to, co rośnie: góry, rzeki, drzewa, kamień, gleba.',
    'about.weather': 'Pogoda i to, co robi niebo — od mżawki po huragan.',
    'about.body': 'Części ciała, z zewnątrz i od środka.',
    'about.people': 'Rodzina i ludzie wokół ciebie — po pokrewieństwie, nie po zawodzie.',
    'about.jobs': 'To, czym ludzie się zajmują zawodowo.',
    'about.school': 'Szkoła i nauka: przedmioty, miejsca i papiery.',
    'about.science': 'Słowa z nauki: materia, energia, życie i laboratorium.',
    'about.sport': 'Sporty, ci, którzy je uprawiają, i miejsca, gdzie się to dzieje.',
    'about.music': 'Muzyka i sztuka: instrumenty, formy i same dzieła.',
    'about.feelings': 'To, co ludzie czują — dobrego i złego.',
    'about.abstract': 'Pojęcia, których nie da się dotknąć: czas, prawda, wolność, los.',
    'about.verbs': 'Czynności — hasłem jest coś, co się robi, a nie rzecz.',
    'diff.relaxed': 'Luźny', 'diff.easy': 'Łatwy', 'diff.normal': 'Normalny', 'diff.hard': 'Trudny',
    'game.hint': 'Podpowiedź', 'game.hintsUsed': 'użyte: {n}', 'game.hintMark': 'podpowiedź',
    'game.hintNone': 'Jesteś o jedno słowo od celu — nie ma już czego podpowiadać.',
    'game.hintFail': 'Brak podpowiedzi w tym miejscu.',

    'new.title': 'Nowa gra', 'new.lang': 'Język', 'new.cat': 'Kategoria', 'new.catHint': 'ogranicza tylko sekretne słowo',
    'new.len': 'Długość słowa', 'new.lenAria': 'Zakres długości sekretnego słowa', 'new.diff': 'Poziom trudności',
    'band.short': 'Krótkie', 'band.medium': 'Średnie', 'band.long': 'Długie', 'band.any': 'Dowolne',
    'new.lenCount': 'liter <span class="dot">·</span> {n} {words} do ukrycia w tej grze',
    'new.lenEmpty': 'brak słów o tej długości — wybierz inny zakres',
    'new.lenHelp': '<strong style="font-weight:600;color:var(--text)">{any}</strong> losuje z całego słownika — długie słowa i tak są rzadkie, więc nie trzeba dodatkowej reguły.',
    'n.words': ['słowo', 'słowa', 'słów'],
    'new.diffHelp': 'Jak trudne jest samo ukryte słowo — tak samo w każdej kategorii, więc Łatwy w Zwierzętach jest równie łatwy jak w Zawodach. Luźny trzyma się słów, które zna każdy.',
    'new.friend': 'Tryb znajomego', 'new.friendDesc': 'Sekretne słowo wpisuje znajomy, a nie silnik gry.', 'new.friendShort': 'Znajomy',
    'new.secret': 'Sekretne słowo', 'new.secretHint': 'ukryte podczas pisania', 'new.secretAria': 'Sekretne słowo wpisywane przez znajomego',
    'new.formsHelp': 'Każda forma zadziała — {forms} — zostanie sprowadzona do słowa podstawowego.',
    'new.start': 'Rozpocznij grę', 'new.errNoWords': 'Żadne sekretne słowo nie pasuje do tych ustawień — poluzuj je trochę.',
    'new.errUnknown': 'Gra nie zna tego słowa — spróbuj innego.',

    'game.guesses': 'Próby', 'game.category': 'Kategoria', 'game.language': 'Język', 'game.time': 'Czas',
    'game.saveExit': 'Zapisz i wyjdź', 'game.giveUp': 'Poddaję się', 'game.placeholder': 'Wpisz słowo…', 'game.inputAria': 'Twoja próba',
    'game.submit': 'Zgadnij', 'game.emptyTitle': 'Każde znane ci słowo to próba',
    'game.emptyText': 'Liczba, którą dostajesz, to <strong style="color:var(--text)">pozycja</strong> — ile słów jest bliżej znaczeniowo sekretu. <strong style="color:var(--text)">1</strong> oznacza, że nic nie jest bliżej. Tysiące — zmień kierunek.',
    'game.far': 'daleko', 'game.close': 'blisko', 'game.formsHint': 'Wpisujesz <em>{a}</em>? Liczy się jako <em>{b}</em> — formy sprowadzamy do słowa podstawowego.',
    'game.latest': 'ostatnia', 'game.secret': 'sekret', 'game.all': 'Wszystkie próby', 'game.topAria': '5 najbliższych prób', 'game.latestAria': 'Ostatnia próba',
    'game.inGame': 'w grze', 'game.endCat': 'kategoria', 'game.bestWin': 'najlepsza wygrana',
    'game.unknown': 'Nie znam słowa „{w}”.', 'game.already': 'Słowo „{w}” już było — pozycja {r}.',
    'pos.noun': 'rzeczownik', 'pos.adj': 'przymiotnik', 'pos.verb': 'czasownik', 'pos.adv': 'przysłówek', 'pos.other': '',

    'stats.title': 'Statystyki', 'stats.played': 'Rozegrane gry', 'stats.won': 'Wygrane', 'stats.givenUp': 'Poddane', 'stats.words': 'Wpisane słowa',
    'stats.letters': 'Wpisane litery', 'stats.time': 'Czas w grze', 'stats.bestWin': 'Najlepsza wygrana', 'stats.avgWin': 'Średnia wygrana', 'stats.perWon': 'prób na wygraną grę',
    'stats.hardest': 'Najtrudniejsze słowo', 'stats.hardestSub': 'trudność {n} / 100',
    'stats.timeSub': 'aktywna gra',
    'badges.title': 'Odznaki', 'badge.wordsmith': 'Mistrz słów', 'badge.wordsmith.d': 'liczba unikalnych słów, które wpisałeś',
    'badge.typist': 'Skryba', 'badge.typist.d': 'litery wpisane we wszystkich grach',
    'badge.sharpshooter': 'Snajper', 'badge.sharpshooter.d': 'najmniej prób w wygranej grze, bez kategorii',
    'badge.slayer': 'Pogromca', 'badge.slayer.d': 'najtrudniejsze pokonane słowo, bez kategorii',
    'badge.deepcut': 'Twardy orzech', 'badge.deepcut.d': 'wygrane na słowie o trudności 70 lub więcej',
    'badge.explorer': 'Odkrywca', 'badge.explorer.d': 'kategorie, w których wygrałeś choć raz',
    'badge.marathon': 'Maraton', 'badge.marathon.d': 'czas spędzony na aktywnej grze',
    'badge.polyglot': 'Poliglota', 'badge.polyglot.d': 'wygrane w obu językach, liczone w słabszym',
    'badges.noCat': 'Szybkość i trudność liczą się w grach bez kategorii — podpowiedź zawęża 6 000 słów do kilkuset.',
    'tier.bronze': 'Brąz', 'tier.silver': 'Srebro', 'tier.gold': 'Złoto', 'tier.diamond': 'Diament', 'tier.amethyst': 'Ametyst',
    'badges.winIn': 'wygraj w mniej niż {n} próbach, by zdobyć: {tier}', 'badges.done': 'Wszystkie poziomy odblokowane',
    'badges.of': 'z {n}', 'badges.toGo': 'jeszcze {n} do: {tier}',

    'set.title': 'Ustawienia', 'set.lang': 'Język aplikacji', 'set.langDesc': 'Tylko interfejs — język słów wybierasz przy każdej grze.',
    'set.theme': 'Motyw', 'set.themeDesc': 'Ciemny pasuje do koloru okna; bez błysku przy starcie.', 'theme.dark': 'Ciemny', 'theme.light': 'Jasny', 'theme.system': 'Systemowy',
    'set.sound': 'Dźwięk', 'set.soundDesc': 'Krótkie kliknięcie przy próbie, dzwonek przy wygranej.',
    'set.accent': 'Kolor motywu', 'set.accentDesc': 'Zmienia wszystko, co jest teraz pomarańczowe.',
    'set.fuzzy': 'Lepsze podpowiedzi', 'set.fuzzyDesc': 'Podpowiada też przy bliskiej pisowni — rz zamiast ż, u zamiast ó, om zamiast ą.',
    'set.updates': 'Aktualizacje', 'set.version': 'Wersja {v}', 'set.upToDate': 'Aktualna', 'set.checked': 'sprawdzono {d}', 'set.never': 'Jeszcze nie sprawdzano',
    'set.available': 'Dostępna jest wersja {v}', 'set.failed': 'Nie udało się sprawdzić — brak połączenia?', 'set.noRepo': 'Źródło aktualizacji nie jest jeszcze ustawione',
    'set.check': 'Sprawdź aktualizacje', 'set.checking': 'Sprawdzam…', 'set.get': 'Pobierz',
    'set.about': 'O grze', 'set.aboutText': '<strong>Lexling</strong> — gry słowne. Odgadnij ukryte słowo po znaczeniu, gdzie każda próba dostaje pozycję według bliskości, albo litera po literze.',
    'set.vocab': 'Słownik', 'set.vocabText': 'polski: {pl} słów <span class="dot">·</span> angielski: {en} słów <span class="dot">·</span> w zestawie, offline',
    'set.vectors': 'Wektory', 'set.vectorsReal': 'fastText cc.pl.300 / cc.en.300, {d} wymiarów, int8',
    'set.saves': 'Zapisy', 'set.savesText': 'Przechowywane poza folderem programu — aktualizacje ich nie ruszają.',

    // Letters mode
    'lt.len': 'Długość słowa', 'lt.letters': ['litera', 'litery', 'liter'], 'lt.shorter': 'Krótsze', 'lt.longer': 'Dłuższe',
    'lt.anyLen': 'Dowolna', 'lt.anyLenLong': 'dowolna długość',
    'lt.canHide': 'słów do ukrycia w tej grze', 'lt.none': 'żadne słowo nie pasuje do tych ustawień',
    'lt.tries': 'Próby', 'lt.triesHint': 'wynik liczy tylko te, których użyjesz', 'lt.triesUnit': ['próba', 'próby', 'prób'],
    'lt.unlimited': 'Bez limitu', 'lt.fewer': 'Mniej', 'lt.more': 'Więcej', 'lt.noLimit': 'bez limitu prób',
    'lt.polish': 'Polskie litery',
    'lt.polishOn': 'Słowo może je zawierać, a każda liczy się w wyniku <strong style="color:var(--text)">podwójnie</strong>. <em>ż</em> to osobna litera — <em>z</em> jej nie trafia.',
    'lt.polishOff': 'Słowo na pewno nie ma żadnej z nich. Włącz, jeśli chcesz trudniejszych słów i wyższego wyniku.',
    'lt.marksShort': 'ą–ż ×2',
    'lt.catNouns': 'Kategorie to same rzeczowniki — z kategorią hasło zawsze jest rzeczownikiem.',
    'lt.diffHelp': 'Jak znane jest słowo i jak nietypowe ma litery — rzadkie i powtórzone litery je utrudniają. Wynik mnoży się przez 0,75, 1, 1,25 albo 1,5.',
    'lt.errNoWords': 'Żadne słowo nie pasuje do tych ustawień — zmień długość, kategorię albo poziom.',
    'lt.length': 'Długość', 'lt.typed': '{a} / {n} {letters}', 'lt.tap': 'Stuknij pola, żeby pisać', 'lt.submit': 'Zgadnij',
    'lt.unknown': 'Nie znam słowa „{w}”.', 'lt.needN': 'Słowo ma {n} {letters} — wpisano {k}.',
    'lt.already': 'Słowo „{w}” już było.',
    'lt.howTitle': 'Znajdź słowo litera po literze',
    'lt.hit': 'Dobra litera, dobre miejsce', 'lt.near': 'Jest w słowie, ale gdzie indziej', 'lt.miss': 'Nie ma jej w słowie',
    'lt.howNote': 'Nic nie idzie, dopóki nie naciśniesz Enter albo Zgadnij. Każda próba zostaje na ekranie — martwe litery odczytasz od razu.',
    'end.won': 'Zgadłeś', 'end.lost': 'Koniec prób', 'end.gaveUp': 'Poddałeś się',
    'end.wordWon': 'Słowo', 'end.wordLost': 'Szukane słowo to', 'end.guessWordWon': 'Sekretne słowo', 'end.closest': 'najbliżej: {w}, pozycja',
    'lt.score': 'wynik', 'lt.best': 'najlepszy', 'lt.again': 'Zagraj jeszcze',
    'lt.calc': '{p} pkt za litery{double} ÷ {g} {guesses} × 100 × {m} {diff}',
    'lt.double': ['({l} liczy się ×2)', '({l} liczą się ×2)', '({l} liczą się ×2)'],
    'games.triesOf': '{g} / {t} prób', 'games.notStarted': 'jeszcze bez prób',
    'stats.streak': 'Seria wygranych', 'stats.streakBest': 'najlepsza {n}', 'stats.bestScore': 'Najlepszy wynik', 'stats.perWonLt': 'prób na wygraną grę',
    'stats.shared': 'We wszystkich grach', 'stats.lettersTyped': 'wpisanych liter',
    'badges.letters': 'Odznaki · Litery',
    'badge.champion': 'Mistrz', 'badge.champion.d': 'wygrane gry w Litery',
    'badge.highscore': 'Rekordzista', 'badge.highscore.d': 'najlepszy wynik w jednej grze',
    'badge.streak': 'Passa', 'badge.streak.d': 'najdłuższa seria wygranych z rzędu',
    'badge.range': 'Pełna skala', 'badge.range.d': 'długości słów, na których wygrałeś, od 3 do 13', 'badge.range.strip': 'wygrane przy każdej długości',
  },
};

export const LANG_NAMES = { pl: 'Polski', en: 'English' };   // always in their own language
let lang = 'en';

export function setLang(l) { lang = l; document.documentElement.lang = l; }
export const getLang = () => lang;

export function t(key, vars) {
  let s = STR[lang][key] ?? STR.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  return s;
}

export function plural(n, key) {
  const forms = STR[lang][key];
  if (lang === 'pl') return forms[n === 1 ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 1 : 2];
  return forms[n === 1 ? 0 : 1];
}

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const decimal = x => lang === 'pl' ? String(x).replace('.', ',') : String(x);   // 1,25 in Polish

// 6:12 for a game, 11:42 for lifetime hours
export function clock(ms, hours = false) {
  const s = Math.floor(ms / 1000), pad = n => String(n).padStart(2, '0');
  if (hours) return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}`;
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

export function ago(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return t('ago.now');
  if (min < 60) return t('ago.min', { n: min });
  if (min < 24 * 60) return t('ago.h', { n: Math.floor(min / 60) });
  if (min < 48 * 60) return t('ago.yesterday');
  return t('ago.days', { n: Math.floor(min / 1440) });
}

export const dateTime = ts => new Date(ts).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB',
  { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
