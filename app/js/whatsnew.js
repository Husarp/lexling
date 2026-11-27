// Recent releases in player language (owner, 2026-11-14). Keep the last three at release.
export const whatsnew = [
  { version: '0.75.0', date: '2026-11-27', en: [
    'Tiles: points fly from your letters into your score, new tiles come out of the bag one by one, and the opponent\'s last move lands tile by tile with its score.',
    'Tiles online: send quick reactions to the other players. You can turn them off in Settings.',
    'Saved games has Saved and Recent tabs, and a clear Save game button with a star that turns gold.',
    'Tiles: coloured player icons, a clearer points breakdown, and the message names the word that is not allowed.',
    'Play time counts only while you are playing, and the menu buttons grow on bigger screens. New updates wait two hours before they are offered, unless you check yourself. You can turn this off in Settings.',
  ], pl: [
    'Kafelki: punkty lecą z liter do Twojego wyniku, nowe płytki wychodzą z worka po kolei, a ostatni ruch przeciwnika ląduje płytka po płytce razem z wynikiem.',
    'Kafelki online: wysyłaj innym graczom szybkie reakcje. Możesz je wyłączyć w Ustawieniach.',
    'Zapisane gry mają zakładki Zapisane i Ostatnie oraz wyraźny przycisk Zapisz grę z gwiazdką, która robi się złota.',
    'Kafelki: kolorowe ikony graczy, czytelniejsze wyliczenie punktów, a komunikat podaje, którego słowa nie ma.',
    'Czas gry liczy się tylko podczas gry, a przyciski w menu są większe na większych ekranach. Nowe aktualizacje czekają dwie godziny, zanim się pojawią, chyba że sam je sprawdzisz. Możesz to wyłączyć w Ustawieniach.',
  ] },
  { version: '0.74.2', date: '2026-11-27', en: [
    'Fixes a crash on the Android start screen. If Lexling ever has trouble starting, it now opens a safe screen with ways to recover.',
  ], pl: [
    'Naprawia zamykanie się aplikacji na ekranie startowym Androida. Gdy Lexling ma problem z uruchomieniem, otwiera bezpieczny ekran z opcjami naprawy.',
  ] },
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
];

export const changesFor = (release, lang) => release[lang]?.length ? release[lang] : release.en;

export function newer(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

// No previous version means a fresh install, which quietly remembers this version.
export const whatsnewShown = (seenVersion, version) => !!seenVersion && newer(version, seenVersion);
