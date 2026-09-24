import { settings, getSave } from './store.js';
import { setLang } from './i18n.js';
import { applyTheme, applyAccent } from './ui.js';
import { fitAll, watchResize } from './fit.js';
import { menu, games, newGameScreen, lettersNewScreen, statsScreen, settingsScreen } from './screens.js';
import { gameScreen } from './game.js';
import { lettersGameScreen } from './letters-game.js';
import { VERSION } from './version.js';

// Routes name the mode where it matters: #/new is Guess, #/new/letters is Letters, and #/game/<id>
// takes the mode from the save itself.
const ROUTES = { '': menu, games, stats: statsScreen, settings: settingsScreen,
  new: (root, mode, refresh) => (mode === 'letters' ? lettersNewScreen : newGameScreen)(root, mode, refresh),
  game: (root, id, refresh) => (getSave(id)?.mode === 'letters' ? lettersGameScreen : gameScreen)(root, id, refresh) };
const root = document.getElementById('root');
let cleanup, shown, latest = 0;

// Hash routes (#/games, #/game/<id>) so the Android back button and Alt+← walk the screens.
async function render(navigated = true) {
  const [name, param] = location.hash.replace(/^#\/?/, '').split('/');
  const mine = ++latest;
  if (navigated) { cleanup?.(); cleanup = null; }
  const refresh = () => render(false);   // same screen again (language / theme / list changed): no fade, no scroll jump
  const done = await (ROUTES[name] || menu)(root, param, refresh);
  // A screen may await its word data (~1.3 s for Polish). If the player navigated on meanwhile, this
  // render lost the race: undo it rather than leaving its timer running over somebody else's screen.
  if (mine !== latest) return done?.();
  if (navigated) cleanup = done;
  fitAll(root);
  if (navigated && shown !== location.hash) {
    window.scrollTo(0, 0);
    root.firstElementChild?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
  }
  shown = location.hash;
}

setLang(settings.lang);
applyTheme();
applyAccent();

// A phone keyboard eats about half the screen, and that is the state the game is played in. When the
// viewport is short AND something is focused, the document is marked so the game screen can compact
// itself (css: [data-kb]). Both Android keyboard modes are covered: if the WebView resizes, innerHeight
// shrinks; if it pans, visualViewport.height shrinks. Either way the visible box is what is measured.
const KEYBOARD_BELOW = 560;
function keyboardCheck() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  const typing = document.activeElement?.matches?.('input, textarea') ?? false;
  document.documentElement.toggleAttribute('data-kb', typing && height < KEYBOARD_BELOW);
  // the visible height, for the Letters screen: with the keyboard open it becomes exactly this tall
  document.documentElement.style.setProperty('--vvh', height + 'px');
}
for (const event of ['focusin', 'focusout', 'resize', 'orientationchange']) window.addEventListener(event, keyboardCheck);
window.visualViewport?.addEventListener('resize', keyboardCheck);

// Esc goes one screen up, like the back button in the top bar. It listens on the document, so anything
// that consumes Esc first (the autocomplete, renaming a game) stops it with stopPropagation().
const PARENT = { games: '#/', new: '#/games', game: '#/games', stats: '#/', settings: '#/' };
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const up = PARENT[location.hash.replace(/^#\/?/, '').split('/')[0]];
  if (up) location.hash = up;
});
// First paint happens only when the bundled fonts are ready: no fallback-font frame, no layout shift.
await Promise.all(['800 1em "Barlow Condensed"', '700 1em "Barlow Condensed"', '400 1em Inter', '500 1em Inter', '600 1em Inter']
  .map(font => document.fonts.load(font)));
await render();
// The desktop wrapper keeps its window hidden until this appears (no half-drawn first frame), and the
// build's self-test compares it with the version it packaged.
document.documentElement.dataset.ready = VERSION;
watchResize(root);
window.addEventListener('hashchange', () => render());
