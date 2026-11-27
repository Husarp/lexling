// Recent releases in player language (owner, 2026-11-14). Keep the last three at release.
import { t } from './i18n.js';

export const whatsnew = [
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
  { version: '0.73.0', date: '2026-11-26', en: [
    'Android: updates now download only what changed, so most updates take seconds - see Settings → Updates. Lexling now needs Android 8 or newer.',
    t('wn.073.savedGames', undefined, 'en'),
    'Tiles: fairer move ratings when only rare words score more, a word checker, tap two of your new tiles to swap them, Cancel gives your word back, and computer levels have their own colours and faces.',
    'Sounds and vibration for your turn, moves, wins and losses, with a volume slider; tap letters in Connect; a High contrast option for Letters.',
    'How to play is rewritten and opens from every game; clearer statistics times, labels in Achievements, coloured section icons, and online clocks that run live.',
  ], pl: [
    'Android: aktualizacje pobierają tylko to, co się zmieniło, więc zwykle trwają kilka sekund - zobacz Ustawienia → Aktualizacje. Lexling wymaga teraz Androida 8 lub nowszego.',
    t('wn.073.savedGames', undefined, 'pl'),
    'Kafelki: uczciwsza ocena ruchów, gdy więcej punktów dają tylko rzadkie słowa, sprawdzanie słów, zamiana dwóch nowych płytek dotknięciem, Anuluj oddaje ułożone słowo, a poziomy komputera mają własne kolory i miny.',
    'Dźwięki i wibracje przy twojej turze, ruchach, wygranej i przegranej, z suwakiem głośności; dotykanie liter w Połącz; opcja Wysoki kontrast w Literach.',
    'Jak grać napisane od nowa i dostępne z każdej gry; czytelniejsze czasy w statystykach, podpisy w Osiągnięciach, kolorowe ikony sekcji i zegary online na żywo.',
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
