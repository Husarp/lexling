// Recent releases in player language (owner, 2026-11-14). Keep the last three at release.
export const whatsnew = [
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
  { version: '0.69.0', date: '2026-11-16', en: [
    'A new look for the main menu: four equal buttons with coloured icons.',
    'Tiles: a clearer last-move highlight in dark mode, thinner outlines, and the move cards centred right under the board.',
    'Folding sections in Settings and New game open and close smoothly.',
    'Your games shows a person or a computer icon by each score.',
  ], pl: [
    'Nowy wygląd menu głównego: cztery równe przyciski z kolorowymi ikonami.',
    'Kafelki: wyraźniejsze podświetlenie ostatniego ruchu w trybie ciemnym, cieńsze obramowania, a karty ruchów wyśrodkowane tuż pod planszą.',
    'Zwijane sekcje w Ustawieniach i Nowej grze otwierają się i zamykają płynnie.',
    'Twoje gry pokazują ikonę osoby lub komputera przy każdym wyniku.',
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
