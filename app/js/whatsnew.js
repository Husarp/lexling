// Recent releases in player language (owner, 2026-11-14). Keep the last three at release.
export const whatsnew = [
  { version: '0.74.0', date: '2026-11-27', en: [
    'Tiles: tap a tile you just placed to return it to the rack. Valid words show in green and invalid words in red.',
    'Screens fit around camera cutouts and shrink to fit when needed. You can change text size in Settings.',
    'Saved games are all in one list, where you can delete them.',
    'Android has new artwork on the start screen and a new notification icon.',
    'Android checks for updates every time you open Lexling. App and game updates can download together, with clearer notices.',
  ], pl: [
    'Kafelki: dotknij właśnie położonej płytki, by wróciła na ławkę. Poprawne słowa są zielone, a błędne czerwone.',
    'Ekrany omijają wycięcie na aparat i w razie potrzeby zmniejszają się, by wszystko się zmieściło. Rozmiar tekstu zmienisz w Ustawieniach.',
    'Zapisane gry są na jednej liście, z której możesz je usuwać.',
    'Na Androidzie pojawiły się nowa grafika na ekranie startowym i nowa ikona powiadomień.',
    'Android sprawdza aktualizacje przy każdym otwarciu gry. Aktualizacje aplikacji i gry można pobrać razem, a komunikaty są czytelniejsze.',
  ] },
  { version: '0.73.2', date: '2026-11-27', en: [
    'A new What\'s new page, a choice of language when you first open the app, and the language switch now lives only in Settings.',
    'Statistics in clearer panels, bigger tier icons in Achievements and new icons for Bonus hunter, Rare find, Hard board and Photo finish.',
    'The menu pictures fit their cards again, Saved games is a bigger button, and the coloured side lines are gone.',
  ], pl: [
    'Nowa strona Co nowego, wybór języka przy pierwszym uruchomieniu, a przełącznik języka jest już tylko w Ustawieniach.',
    'Statystyki w czytelniejszych panelach, większe ikony poziomów w Osiągnięciach i nowe ikony osiągnięć: Łowca bonusów, Rzadkie znalezisko, Trudna plansza i Rzutem na taśmę.',
    'Grafiki w menu znów mieszczą się w kartach, Zapisane gry to większy przycisk, a kolorowe paski z boku zniknęły.',
  ] },
  { version: '0.73.1', date: '2026-11-26', en: [
    'Redesigned in-app update banners and Settings → Updates, with clearer download progress.',
    'Last games is now Saved games, right under the four games in the menu. Empty game lists are simpler.',
    'Outline icons are back in the menu, and game tabs show just icons. Collection can show both languages together.',
    'How to play is easier to browse, and the word-length chart stays correct when you change settings quickly.',
  ], pl: [
    'Odświeżone komunikaty o aktualizacjach w aplikacji i sekcja Ustawienia → Aktualizacje, z czytelniejszym postępem pobierania.',
    'Ostatnie gry to teraz Zapisane gry, tuż pod czterema grami w menu. Puste listy gier są prostsze.',
    'Do menu wróciły konturowe ikony, a zakładki gier pokazują same ikony. Kolekcja może pokazać oba języki naraz.',
    'Łatwiej przeglądać poradnik „Jak grać”, a wykres długości słów działa poprawnie przy szybkiej zmianie ustawień.',
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
