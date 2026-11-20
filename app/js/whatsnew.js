// Recent releases in player language (owner, 2026-11-14). Keep the last three at release.
export const whatsnew = [
  { version: '0.72.0', date: '2026-11-20', en: [
    'Statistics: time per game in every mode, letters typed (green and yellow) in Letters, bonus words per game in Connect, and best word, longest word, points per word and bonus squares in Tiles. Games with help count for time and games, not for word records.',
    'Tiles: person, computer and dice icons instead of dots, your unplayed tiles keep their colour, and a wrong word shows a short note above your tiles instead of a red bar.',
    'A Button size setting for the game tools, new icons across the app, bolder fold-out arrows, and room kept for the camera cutout on every screen.',
    'Game lists keep New game at the bottom and hold up to 20 saved games per game; new Tiles achievement: Photo finish.',
  ], pl: [
    'Statystyki: czas gry w każdym trybie, wpisane litery (zielone i żółte) w Literach, słowa bonusowe na grę w Połącz oraz najlepsze i najdłuższe słowo, punkty na słowo i pola premiowe w Kafelkach. Gry z pomocą liczą się do czasu i liczby gier, ale nie do rekordów słów.',
    'Kafelki: ikony osoby, komputera i kostki zamiast kropek, niezagrane płytki zachowują kolor, a złe słowo pokazuje krótki napis nad płytkami zamiast czerwonej ramki.',
    'Ustawienie Rozmiar przycisków dla narzędzi gry, nowe ikony w całej aplikacji, wyraźniejsze strzałki rozwijania i miejsce na wycięcie aparatu na każdym ekranie.',
    'Listy gier trzymają Nową grę na dole i mieszczą do 20 zapisanych gier na tryb; nowe osiągnięcie w Kafelkach: Rzutem na taśmę.',
  ] },
  { version: '0.71.0', date: '2026-11-20', en: [
    'A fresh look: new menu cards with artwork, a wallpaper, new game icons, and Settings in sections that fold open.',
    'Tiles: a cleaner game screen - the last move highlighted, a choice of board frames, a new Options window, and the time limit on the player cards (computers are never timed).',
    'Fair statistics: totals only, and a game where you used help becomes Practice and adds nothing from then on.',
    'How to play opens one chapter at a time, and online games say clearly who lost the connection.',
  ], pl: [
    'Nowy wygląd: karty gier z grafikami, tapeta, nowe ikony gier i Ustawienia w rozwijanych sekcjach.',
    'Kafelki: czystszy ekran gry - podświetlony ostatni ruch, wybór ramki planszy, nowe okno Opcji i limit czasu na kartach graczy (komputer nigdy nie ma limitu).',
    'Uczciwe statystyki: tylko sumy, a gra, w której użyto pomocy, staje się Treningiem i od tej chwili nic nie dodaje.',
    'Jak grać pokazuje jeden rozdział naraz, a gry online jasno mówią, kto stracił połączenie.',
  ] },
  { version: '0.70.0', date: '2026-11-16', en: [
    'Achievements look closer to a game: Common, Rare, Epic, Legendary and Mythical levels, rounded cards and tabs per game.',
    'New achievements for Guess, Letters and Connect - ones every player can reach, no win streaks.',
    'Guess: with a category chosen, its words come first in the suggestions.',
    'Word boxes show a single green border while typing.',
  ], pl: [
    'Osiągnięcia wyglądają bardziej jak w grze: poziomy Zwykły, Rzadki, Epicki, Legendarny i Mityczny, zaokrąglone karty i zakładki dla każdej gry.',
    'Nowe osiągnięcia w Znaczeniu, Literach i Połącz - takie, które każdy może zdobyć, bez serii zwycięstw.',
    'Znaczenie: przy wybranej kategorii jej słowa są pierwsze w podpowiedziach.',
    'Pola na słowa mają podczas pisania jedno zielone obramowanie.',
  ] },
];

export const changesFor = (release, lang) => release[lang]?.length ? release[lang] : release.en;

export function newer(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

// No previous version means a fresh install, which quietly remembers this version.
export const whatsnewShown = (seenVersion, version) => !!seenVersion && newer(version, seenVersion);
