// Hand-picked example nouns per category. The pipeline tags every possible secret word with the
// category whose examples it is closest to (tools/build-data.mjs), so these lists only need to show
// what a category MEANS - they are not the category's contents. Keep them concrete and unambiguous:
// a word that fits two categories weakens both, because tagging needs a clear winner.
// `verbs` has no list - it is a part-of-speech category, filled by the pipeline.
export const CATEGORIES = ['animals', 'food', 'household', 'clothing', 'tools', 'tech', 'vehicles',
  'buildings', 'nature', 'weather', 'body', 'people', 'jobs', 'school', 'science', 'sport', 'music',
  'feelings', 'abstract', 'verbs'];

export const SEEDS = {
  en: {
    animals: 'cat dog horse cow pig sheep goat chicken duck rabbit rat lion tiger bear wolf fox deer elephant giraffe monkey zebra whale dolphin shark octopus frog turtle snake lizard spider ant bee butterfly eagle owl parrot squirrel hamster kitten puppy',
    food: 'bread butter cheese egg milk meat sausage soup pizza pasta rice potato carrot onion tomato cucumber cabbage garlic pepper sugar honey apple banana orange lemon grape cherry strawberry pear plum cake chocolate cookie coffee tea juice wine beer breakfast dinner',
    household: 'chair table bed sofa shelf lamp mirror carpet curtain pillow blanket towel spoon fork plate cup bowl kettle fridge oven stove sink bucket broom soap furniture drawer wardrobe cushion vase',
    clothing: 'shirt trousers jeans dress skirt jacket coat sweater sock shoe boot hat cap glove scarf belt tie uniform underwear sandal sneaker blouse hoodie shorts suit pyjamas raincoat slipper trainer waistcoat',
    tools: 'hammer screwdriver saw drill nail screw wrench pliers axe shovel rake ladder rope chain wire chisel clamp bolt toolbox workbench sandpaper scissors needle crowbar mallet spanner grinder blade hinge nut washer',
    tech: 'computer laptop keyboard screen monitor printer camera battery charger cable speaker headphone microphone router server software internet website email password robot drone satellite processor smartphone',
    vehicles: 'car bus train tram airplane bicycle motorcycle truck van taxi boat ship ferry helicopter tractor scooter engine wheel fuel ticket journey passenger cockpit trailer',
    buildings: 'house apartment castle church tower hotel restaurant shop museum library theatre hospital factory prison station airport bridge wall roof door window stairs kitchen bedroom bathroom garage cellar balcony',
    nature: 'mountain hill valley forest tree flower grass leaf root seed river lake sea ocean beach island desert cave rock stone sand field meadow swamp waterfall soil moss mushroom bush stream pond bay cliff branch trunk glade marsh dune peak',
    weather: 'rain snow wind storm cloud fog frost thunder lightning hail rainbow drought flood sunshine breeze humidity blizzard downpour drizzle gale sleet overcast forecast thaw hurricane tornado',
    body: 'head hand arm leg foot eye ear nose mouth tooth tongue hair skin bone blood heart lung liver stomach knee elbow shoulder finger thumb neck chest brain muscle nerve forehead chin cheek lip eyelid nail heel hip rib kidney artery wrist ankle',
    people: 'mother father sister brother son daughter baby child friend neighbour family wife husband uncle aunt cousin grandmother grandfather guest stranger couple girl boy woman teenager adult',
    jobs: 'doctor nurse teacher farmer soldier cook baker butcher lawyer judge engineer scientist writer singer actor pilot sailor waiter barber tailor carpenter plumber electrician accountant manager mechanic',
    school: 'pencil notebook eraser ruler blackboard chalk lesson exam classroom pupil student university diploma textbook schoolbag crayon satchel homework tuition semester lecture teacher headmaster pencilcase',
    science: 'atom molecule element hydrogen oxygen carbon nitrogen acid gas liquid energy gravity mass volume density experiment laboratory microscope chemistry physics biology reaction formula cell bacteria virus theory',
    sport: 'football basketball volleyball tennis hockey golf boxing swimming cycling goal match player coach referee stadium medal championship tournament race marathon gym chess athlete',
    music: 'music song guitar piano violin drum flute trumpet band concert orchestra melody rhythm album painting drawing sculpture dance poem novel film theatre',
    feelings: 'love fear joy anger hope sadness happiness sorrow pride shame guilt envy jealousy excitement boredom loneliness anxiety surprise disgust affection passion relief despair',
    abstract: 'time idea thought truth reason freedom peace war power justice future past memory dream chance luck history culture society knowledge wisdom meaning purpose',
  },
  pl: {
    animals: 'kot pies koń krowa świnia owca koza kura kaczka królik szczur lew tygrys niedźwiedź wilk lis jeleń słoń żyrafa małpa zebra wieloryb delfin rekin ośmiornica żaba żółw wąż jaszczurka pająk mrówka pszczoła motyl orzeł sowa papuga wiewiórka chomik kotek szczeniak '
      + 'łosoś śledź makrela dorsz karp pstrąg bydło',
    food: 'chleb masło ser jajko mleko mięso kiełbasa zupa pizza makaron ryż ziemniak marchew cebula pomidor ogórek kapusta czosnek pieprz cukier miód jabłko banan pomarańcza cytryna winogrono wiśnia truskawka gruszka śliwka ciasto czekolada ciastko kawa herbata sok wino piwo śniadanie obiad '
      // added after comparing with English, which had 66 more: these were all in the vocabulary but
      // the categoriser left them uncategorised, because a common word sits near several categories
      // at once and so never wins one clearly. A seed is a member by definition.
      + 'mąka bułka tost naleśnik pączek rogalik herbatnik keks wafel piernik makowiec strucla beza '
      + 'stek kotlet schab boczek klops pulpet szynka '
      + 'orzech migdał rodzynka daktyl figa sezam '
      + 'musztarda majonez keczup chrzan ocet szafran '
      + 'drożdże śmietana maślanka serek twaróg '
      + 'frytka chipsy kluski knedle lody sorbet',
    household: 'krzesło stół łóżko kanapa półka lampa lustro dywan zasłona poduszka koc ręcznik łyżka widelec talerz kubek miska czajnik lodówka piekarnik kuchenka zlew wiadro miotła mydło meble szuflada szafa wazon',
    clothing: 'koszula spodnie dżinsy sukienka spódnica kurtka płaszcz sweter skarpeta but czapka kapelusz rękawiczka szalik pasek krawat mundur bielizna sandał bluzka bluza marynarka garnitur koszulka szorty klapki spodenki podkoszulek trampki kamizelka',
    tools: 'młotek śrubokręt piła wiertarka gwóźdź śruba szczypce siekiera łopata grabie drabina lina łańcuch drut dłuto imadło warsztat nożyczki igła wkrętak obcęgi kielnia poziomica wiertło pilnik szlifierka gwint młot nakrętka podkładka',
    tech: 'komputer laptop klawiatura ekran monitor drukarka aparat bateria ładowarka kabel głośnik słuchawki mikrofon router serwer oprogramowanie internet strona hasło robot dron satelita procesor smartfon',
    vehicles: 'samochód autobus pociąg tramwaj samolot rower motocykl ciężarówka furgonetka taksówka łódź statek prom helikopter traktor hulajnoga silnik koło paliwo bilet podróż pasażer przyczepa',
    buildings: 'dom mieszkanie zamek kościół wieża hotel restauracja sklep muzeum biblioteka teatr szpital fabryka więzienie dworzec lotnisko most ściana dach drzwi okno schody kuchnia sypialnia łazienka garaż piwnica balkon',
    nature: 'góra wzgórze dolina las drzewo kwiat trawa liść korzeń nasiono rzeka jezioro morze ocean plaża wyspa pustynia jaskinia skała kamień piasek pole łąka bagno wodospad gleba mech grzyb krzak strumień staw zatoka klif gałąź pień polana wydma szczyt przełęcz wąwóz '
      // English had 38 more, and the difference was almost entirely trees, flowers and ground:
      // all present in the vocabulary, none of them tagged
      + 'sosna dąb brzoza świerk wierzba buk klon jodła modrzew topola '
      + 'roślina krzew paproć porost kora pąk pyłek '
      + 'róża stokrotka tulipan mniszek fiołek konwalia mak słonecznik '
      + 'źródło stok zbocze step tundra gaj bór puszcza '
      + 'glina torf granit bazalt żwir',
    weather: 'deszcz śnieg wiatr burza chmura mgła mróz grzmot błyskawica grad tęcza susza powódź upał wilgotność zamieć ulewa mżawka wichura szron gołoledź skwar przymrozek zachmurzenie opad odwilż huragan tornado',
    body: 'głowa ręka ramię noga stopa oko ucho nos usta ząb język włosy skóra kość krew serce płuco wątroba żołądek kolano łokieć bark palec kciuk szyja mózg mięsień nerw czoło broda policzek warga powieka rzęsa paznokieć pięta biodro żebro nerka tętnica nadgarstek kostka',
    people: 'matka ojciec siostra brat syn córka niemowlę dziecko przyjaciel sąsiad rodzina żona mąż wujek ciocia kuzyn babcia dziadek gość nieznajomy para dziewczyna chłopak kobieta nastolatek dorosły',
    jobs: 'lekarz pielęgniarka nauczyciel rolnik żołnierz kucharz piekarz rzeźnik prawnik sędzia inżynier naukowiec pisarz piosenkarz aktor pilot marynarz kelner fryzjer krawiec stolarz hydraulik elektryk księgowy kierownik mechanik',
    school: 'ołówek zeszyt gumka linijka tablica kreda lekcja egzamin uczeń student uniwersytet dyplom podręcznik piórnik kredka wykład semestr matura świadectwo ławka korepetycje przedszkole nauczycielka wypracowanie',
    science: 'atom cząsteczka pierwiastek wodór tlen węgiel azot kwas gaz ciecz energia grawitacja masa objętość gęstość doświadczenie laboratorium mikroskop chemia fizyka biologia reakcja wzór komórka bakteria wirus teoria',
    sport: 'piłka koszykówka siatkówka tenis hokej golf boks pływanie kolarstwo bramka mecz zawodnik trener sędzia stadion medal mistrzostwo turniej wyścig maraton siłownia szachy sportowiec',
    music: 'muzyka piosenka gitara pianino skrzypce bęben flet trąbka zespół koncert orkiestra melodia rytm album obraz rysunek rzeźba taniec wiersz powieść film teatr',
    feelings: 'miłość strach radość gniew nadzieja smutek szczęście żal duma wstyd wina zazdrość podniecenie nuda samotność lęk zaskoczenie wstręt czułość namiętność ulga rozpacz',
    abstract: 'czas pomysł myśl prawda rozum wolność pokój wojna władza sprawiedliwość przyszłość przeszłość pamięć sen szansa los historia kultura społeczeństwo wiedza mądrość znaczenie cel',
  },
};

// Words that are perfectly good words but wrong as the ANSWER inside a given category. Playing
// "Animals" and being asked for `zwierzę` ("animal"), `pluszak` (a plush toy) or `wilkołak` (a
// werewolf) is the same frustration in three flavours: you are hunting animals, not words about
// animals. They stay guessable - they are simply never what the game is hiding.
//
// Four kinds keep showing up, so look for these when adding a category:
//   · the category's own name and its group words   zwierzę, ssak, drapieżnik / pet, wildlife, mammal
//   · things that are not members at all            pluszak, aniołek / zoo, leash, manure
//   · myths                                          smok, wilkołak / dragon, mermaid, werewolf
//   · people and places around the members           weterynarz / hunter, breeder, veterinary
// Diminutives (kotek, piesek, rybka) are removed automatically - see DIMINUTIVE in build-data.mjs.
export const NOT_IN = {
  pl: {
    // the last group are diminutives whose stem changes too much for the automatic rule:
    // owca→owieczka, kot→kociak, pies→psiak, kura→kokoszka, and `kota`, which is a case form of
    // `kot` that the dictionary kept as a word of its own
    animals: 'zwierzę zwierz zwierzak zwierzątko pupil ssak gryzoń drapieżnik czworonóg stworek słodziak pluszak aniołek smok wilkołak pyszczek rudzielec zwinka sunia kiciuś piesio szczenię miś '
      + 'kota kociak psiak suczka owieczka kokoszka jelonek ptaszek konie trzoda śledzik '
      // `miś` is a teddy bear, so it is blocked above - which leaves its diminutives with no base
      // for the automatic rule to find. The animal is `niedźwiedź`.
      + 'misiek misio misiaczek niedźwiadek',
    // brand names are not words to guess, and these diminutives change their stem too much for the
    // automatic rule (masło→masełko, jajko→jajeczko, bułka→bułeczka)
    food: 'jedzenie żywność posiłek produkt danie potrawa składnik kuchnia smak dieta porcja przepis spód '
      + 'nutella milka cola grapefruit '
      // things you put on your skin, not in your mouth - they sit right next to food in the vectors
      + 'krem peeling balsam puder pasta soda '
      // equipment rather than food
      + 'tortownica kawiarka '
      + 'masełko jajeczko jabłuszko ciacho mięcho jedzonko twarożek papryczka bułeczka polędwiczka kiełbaska serduszko '
      + 'soczek barszczyk ślimaczek buła udko żelek murzynek truskawkowo',
    household: 'dom gospodarstwo sprzęt wyposażenie urządzenie przedmiot',
    clothing: 'ubranie odzież strój ubiór garderoba moda rozmiar materiał',
    tools: 'narzędzie sprzęt urządzenie przyrząd',
    tech: 'technologia urządzenie sprzęt elektronika',
    vehicles: 'pojazd transport komunikacja',
    buildings: 'budynek budowla konstrukcja obiekt architektura',
    // the stone seeds pull in what stone is turned into, which is a building material, not nature
    nature: 'przyroda natura środowisko krajobraz teren '
      + 'beton cement klinkier fornir tłuczeń kruszywo grys mahoń teak molo promenada rabata',
    weather: 'pogoda klimat temperatura prognoza',
    body: 'ciało organizm narząd organ',
    people: 'człowiek ludzie osoba osobnik jednostka',
    jobs: 'zawód praca posada stanowisko zatrudnienie',
    school: 'szkoła nauka edukacja nauczanie',
    science: 'nauka badanie',
    sport: 'sport dyscyplina',
    music: 'muzyka sztuka dzieło',
    feelings: 'uczucie emocja nastrój',
    abstract: 'pojęcie idea',
  },
  en: {
    animals: 'pet wildlife breed zoo hunter litter veterinary slaughter aquarium leash crate safari manure swarm hive breeder predator shepherd pest poultry livestock mammal mammalian canine feline rodent venom paw fin mermaid werewolf dragon doggy kitty bunny critter creature beast',
    food: 'food meal dish recipe ingredient cuisine diet flavour flavor portion serving nutrition',
    household: 'household furniture appliance item object equipment',
    clothing: 'clothing clothes garment outfit apparel wardrobe fashion size fabric',
    tools: 'tool equipment device instrument hardware',
    tech: 'technology device gadget electronics hardware',
    vehicles: 'vehicle transport transportation',
    buildings: 'building structure construction architecture premises',
    nature: 'nature environment landscape terrain scenery',
    weather: 'weather climate temperature forecast',
    body: 'body organism organ anatomy',
    people: 'person people human individual folk',
    jobs: 'job work occupation profession career employment',
    school: 'school education learning teaching',
    science: 'science research study',
    sport: 'sport sports discipline',
    music: 'music art artwork',
    feelings: 'feeling emotion mood',
    abstract: 'concept notion idea',
  },
};

// Words the cross-language filter in build-data.mjs must keep even though the other language uses them
// far more (see FOREIGN_RATIO there). English "ten" is the only real case so far: Polish "ten" (= this)
// is 25x more common on the web, but the number word obviously belongs in an English game.
export const KEEP = { en: 'ten', pl: '' };

// Never picked as the secret word (still fine as a guess). Two groups per language:
//  1. words the dictionary calls nouns but nobody would accept as the answer: function words with an obscure
//     noun homonym (jak = yak, can = tin), abbreviations, numerals, loanwords listed for Scrabble;
//  2. vulgar, sexual, slurs, and grim topics nobody wants to discover after twenty guesses.
// Found a bad secret while playing? Add it here and re-run tools/build-data.mjs.
export const NEVER_SECRET = {
  en: 'can who two may use don few lot top why bit six ten min pro sec pic tho max sub cum wow con duo mph cur par ref mod alt doc cam xxx tee rep sue iii mac gal rev tad pee eve var bye yea sup inc mag lat psi mil fps dab bob dis chi sis tit biz nil boo col git esp din rad tor mar ado hob amp tab rpm tom '
    + 'then here being need going while something three must might second today left enough least getting public someone anything four past million nothing taking major young five reading couple white third longer worth giving extra haven multiple potential favorite percent current high seven eight nine hundred thousand billion dozen making coming having doing saying '
    + 'fuck shit bitch cunt dick cock pussy asshole ass bastard slut whore nigger nigga faggot fag retard penis vagina anus porn sex rape rapist suicide murder genocide holocaust nazi incest pedophile abortion masturbation orgasm semen sperm feces urine piss crap tits boob boobs nipple dildo condom prostitute hooker vomit corpse cancer tumor',
  pl: 'jak bez niż art sam pkt for paź gen mgr van fax por par płk kat mjr top web out alt rad has dna dal woj abp car end set ras sum var lit lok mod off bit ref don men bis man way bot mus fit war bon hop tab kur net hip lin cza dok dan run hat sem pin tok pon len tur luk dog bad cap syf son kit ban bag jet wet cha pad pic cal mir bat won git ter zad sil tan dej gal mer gif wid lux gej ara eta boy rem san bum gay ort mig bug sex pop tag hit rap fan '
    + 'kilka dzięki ktoś poza lepiej taka zbyt brutto netto center plus jaka wiec rano kart maja '
    + 'kurwa chuj pizda cipa kutas fiut dupa gówno dziwka suka skurwysyn ciota pedał murzyn czarnuch szmata jebać pierdolić penis pochwa odbyt porno seks gwałt gwałciciel samobójstwo morderstwo ludobójstwo holokaust nazista kazirodztwo pedofil aborcja masturbacja orgazm sperma nasienie kał mocz cycki sutek prezerwatywa prostytutka wymiociny trup zwłoki rak nowotwór',
};
