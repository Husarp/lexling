// Recent releases in player language (owner, 2026-11-14). Keep the last three at release.
export const whatsnew = [
  { version: '0.73.0', date: '2026-11-26', en: [
    'Android: updates now download only what changed, so most updates take seconds - see Settings → Updates. Lexling now needs Android 8 or newer.',
    'Tiles: replay any finished game move by move, keep games forever, share a picture of the result, and see match highlights with a points chart. Last games keeps your five newest results from all four games.',
    'Tiles: fairer move ratings when only rare words score more, a word checker, tap two of your new tiles to swap them, Cancel gives your word back, and computer levels have their own colours and faces.',
    'Sounds and vibration for your turn, moves, wins and losses, with a volume slider; tap letters in Connect; a High contrast option for Letters.',
    'How to play is rewritten and opens from every game; clearer statistics times, labels in Achievements, coloured section icons, and online clocks that run live.',
  ], pl: [
    'Android: aktualizacje pobierają tylko to, co się zmieniło, więc zwykle trwają kilka sekund - zobacz Ustawienia → Aktualizacje. Lexling wymaga teraz Androida 8 lub nowszego.',
    'Kafelki: odtwarzanie skończonej gry ruch po ruchu, zachowywanie gier na zawsze, udostępnianie obrazka z wynikiem oraz najważniejsze momenty z wykresem punktów. Ostatnie gry pamiętają pięć najnowszych wyników ze wszystkich czterech gier.',
    'Kafelki: uczciwsza ocena ruchów, gdy więcej punktów dają tylko rzadkie słowa, sprawdzanie słów, zamiana dwóch nowych płytek dotknięciem, Anuluj oddaje ułożone słowo, a poziomy komputera mają własne kolory i miny.',
    'Dźwięki i wibracje przy twojej turze, ruchach, wygranej i przegranej, z suwakiem głośności; dotykanie liter w Połącz; opcja Wysoki kontrast w Literach.',
    'Jak grać napisane od nowa i dostępne z każdej gry; czytelniejsze czasy w statystykach, podpisy w Osiągnięciach, kolorowe ikony sekcji i zegary online na żywo.',
  ] },
  { version: '0.72.1', date: '2026-11-21', en: [
    'Tiles: drag a tile onto another of your unplayed tiles to swap them - or drop a rack tile on one to replace it.',
    'Bigger game buttons by default (130 %), now from 100 to 175 % in Settings.',
    'Tiles: the board is bigger on phones, the move note never covers your tiles, and How to play is a proper button next to Give up.',
  ], pl: [
    'Kafelki: przeciągnij płytkę na inną swoją niezagraną płytkę, by je zamienić - albo upuść płytkę z ławki, by ją podmienić.',
    'Większe przyciski gry domyślnie (130 %), teraz od 100 do 175 % w Ustawieniach.',
    'Kafelki: większa plansza na telefonach, komunikat o ruchu nie zasłania płytek, a Jak grać to zwykły przycisk obok Poddaj się.',
  ] },
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
];

export const changesFor = (release, lang) => release[lang]?.length ? release[lang] : release.en;

export function newer(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

// No previous version means a fresh install, which quietly remembers this version.
export const whatsnewShown = (seenVersion, version) => !!seenVersion && newer(version, seenVersion);
