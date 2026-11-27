// The fit chain and menu scaling, using synthetic layout heights.
import assert from 'node:assert/strict';
import { fitAll } from '../app/js/fit.js';

const values = new Map();
const style = {
  setProperty: (key, value) => values.set(key, Number(value)),
  removeProperty: key => values.delete(key),
};
const viewport = { clientWidth: 360, clientHeight: 800 };
let menu = true, noticeHeight = 0;
const screen = {
  style, clientWidth: 360, scrollWidth: 360,
  matches: selector => selector === '.app' || (menu && selector === '[data-screen=menu]'),
  querySelectorAll: () => [],
  querySelector: () => null,
  get scrollHeight() {
    return Math.ceil(noticeHeight + 100 * (values.get('--spacing') ?? 1)
      + 100 * (values.get('--text-scale') ?? 1.15)
      + 300 * (values.get('--button-scale') ?? 1.3) * (values.get('--menu-scale') ?? 1));
  },
};
viewport.firstElementChild = screen;
globalThis.getComputedStyle = () => ({
  getPropertyValue: key => values.get(key) ?? { '--button-scale': 1.3, '--text-scale': 1.15 }[key],
});

let passed = 0;
function check(height, expected, message) {
  viewport.clientHeight = height;
  fitAll(viewport);
  assert.deepEqual(Object.fromEntries(values), expected, message);
  assert.ok(screen.scrollHeight <= height, message);
  passed++;
}

check(800, { '--menu-scale': 1.5 }, 'Growth is capped on a roomy screen');
check(650, { '--menu-scale': 1.11 }, 'Use the tallest scale that fits without scrolling');
noticeHeight = 180;
check(620, { '--spacing': .6, '--menu-scale': .93, '--button-scale': 1, '--text-scale': 1 },
  'A notice uses room and the normal fit chain runs before reducing the menu further');
noticeHeight = 0;
check(615, { '--menu-scale': 1.02 }, 'Removing the notice restores the preferred sizes');
check(565, { '--spacing': .6, '--menu-scale': 1 }, 'Tighten spacing before lowering button size');
check(530, { '--spacing': .6, '--button-scale': 1.15, '--menu-scale': 1.02 },
  'Lower button size before text size');
check(460, { '--spacing': .6, '--button-scale': 1, '--text-scale': 1, '--menu-scale': 1 },
  'Lower text only after reaching the smallest button setting');
menu = false;
values.clear();
check(800, {}, 'Other screens do not grow menu cards');

console.log(`all ${passed} menu fit tests passed`);
