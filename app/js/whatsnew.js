// Recent releases in player language (owner, 2026-11-14). Keep the last three at release.
export const whatsnew = [
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
  { version: '0.68.0', date: '2026-11-16', en: [
    'Tiles: a new "Familiar words" dictionary (New game, Rules) - everyday words in all their forms, without the strange ones.',
    'With friends: words outside the dictionary can be allowed by a vote, and a card shows who agreed, who refused and who is still choosing.',
    'A move with several wrong words marks them all at once.',
    'A bigger board on phones, zoom buttons, a points breakdown when you tap a move, and clearer hints and warnings.',
  ], pl: [
    'Kafelki: nowy słownik "Znane słowa" (Nowa gra, Zasady) - codzienne słowa we wszystkich odmianach, bez tych dziwnych.',
    'Ze znajomymi: słowa spoza słownika mogą przejść głosowaniem, a karta pokazuje, kto się zgodził, kto nie, a kto jeszcze wybiera.',
    'Ruch z kilkoma błędnymi słowami zaznacza je wszystkie naraz.',
    'Większa plansza na telefonach, przyciski powiększenia, rozpisanie punktów po dotknięciu ruchu oraz jaśniejsze wskazówki i ostrzeżenia.',
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
