// Recent releases in player language (owner, 2026-11-14). Keep the last three at release.
export const whatsnew = [
  { version: '0.67.1', date: '2026-11-14', en: [
    'Veto: a vote can no longer take extra time off the clock of the player who made the word.',
  ], pl: [
    'Weto: głosowanie nie może już zabrać dodatkowego czasu z zegara gracza, który ułożył słowo.',
  ] },
  { version: '0.67.0', date: '2026-11-14', en: [
    'Achievements are back - levels in every game and one-time challenges in Tiles, with their own icons.',
    'Tiles: the last move is outlined, a word can show how rare it is, and tapping a played word shows its meaning.',
    'Tiles with friends: a Veto option lets the others reject a word; you choose how many vetoes it takes.',
    'Playing online: set your name once in Settings; the host lets you in and picks your seat.',
    'Colour palettes, light or dark inside the games, board styles and colour-blind bonus squares.',
  ], pl: [
    'Wracają osiągnięcia - poziomy w każdej grze i jednorazowe wyzwania w Kafelkach, z własnymi ikonami.',
    'Kafelki: ostatni ruch jest obrysowany, przy słowie widać, jak jest rzadkie, a dotknięcie słowa pokazuje jego znaczenie.',
    'Kafelki ze znajomymi: opcja Weto pozwala innym odrzucić słowo; sam wybierasz, ile wet trzeba.',
    'Gra online: ustaw swoje imię raz w Ustawieniach; gospodarz wpuszcza Cię i wybiera miejsce.',
    'Palety kolorów, jasny lub ciemny tryb w grach, style planszy i premie przyjazne daltonistom.',
  ] },
  { version: '0.66.0', date: '2026-10-12', en: [
    'Larger letters, tiles and buttons make better use of tablet screens.',
    'Play sideways on Android tablets; Connect shows the crossword beside the letter circle.',
    'Tiles hints, undo and move ratings are together under Assists on New game.',
    'Tap Change in the statistics warning to go straight to Assists.',
  ], pl: [
    'Większe litery, płytki i przyciski lepiej wykorzystują ekran tabletu.',
    'Na tabletach z Androidem można grać poziomo; w Połącz krzyżówka jest obok koła liter.',
    'Podpowiedzi, cofanie i oceny ruchów w Kafelkach są razem w Ułatwieniach na ekranie nowej gry.',
    'Przycisk Zmień w ostrzeżeniu o statystykach prowadzi prosto do Ułatwień.',
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
