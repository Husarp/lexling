// Recent releases in player language (owner, 2026-11-14). Keep the last three at release.
export const whatsnew = [
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
  { version: '0.67.2', date: '2026-11-14', en: [
    'Online games: only the host can end the game for everyone or take a player out, and giving up out of turn no longer costs the player on turn any time.',
  ], pl: [
    'Gra online: tylko gospodarz może zakończyć grę dla wszystkich lub usunąć gracza, a poddanie się poza swoją kolejką nie zabiera czasu graczowi, który ma ruch.',
  ] },
  { version: '0.67.1', date: '2026-11-14', en: [
    'Veto: a vote can no longer take extra time off the clock of the player who made the word.',
  ], pl: [
    'Weto: głosowanie nie może już zabrać dodatkowego czasu z zegara gracza, który ułożył słowo.',
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
