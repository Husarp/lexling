// What's new: fresh installs stay quiet, updates can be acknowledged permanently.
// Run: node tools/test-whatsnew.mjs
import { whatsnew, whatsnewShown, changesFor } from '../app/js/whatsnew.js';

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log('✗', name, '\n   got ', got, '\n   want', want); }
};
check('fresh install', whatsnewShown(null, '0.66.0'), false);
check('missing setting', whatsnewShown(undefined, '0.66.0'), false);
check('same version', whatsnewShown('0.66.0', '0.66.0'), false);
check('newer version', whatsnewShown('0.65.0', '0.66.0'), true);
check('patch update', whatsnewShown('0.66.0', '0.66.1'), true);
check('numeric version order', whatsnewShown('0.9.0', '0.10.0'), true);
check('older version stays quiet', whatsnewShown('0.66.0', '0.65.0'), false);
check('last three versions', whatsnew.length, 3);
check('newest first is this version', whatsnew[0].version, (await import('../app/js/version.js')).VERSION);
for (const release of whatsnew) {
  check(release.version + ' date', /^\d{4}-\d{2}-\d{2}$/.test(release.date), true);
  for (const lang of ['en', 'pl']) check(release.version + ' ' + lang + ' bullets', changesFor(release, lang).length >= 3 && changesFor(release, lang).length <= 5, true);
}
check('English fallback', changesFor({ en: ['English'] }, 'pl'), ['English']);
check('empty Polish fallback', changesFor({ en: ['English'], pl: [] }, 'pl'), ['English']);
check('Polish selected', changesFor({ en: ['English'], pl: ['Polski'] }, 'pl'), ['Polski']);

// Exercise the real storage and dismissal code, including a new app start.
const saved = new Map();
globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
globalThis.document = { addEventListener() {} };
const { VERSION } = await import('../app/js/version.js');
const { settings, saveSettings } = await import('../app/js/store.js');
let updates = await import('../app/js/update.js');
check('first start stores version', JSON.parse(saved.get('wg.settings')).seenVersion, VERSION);
check('first start has no notice', updates.recentUpdateShown(), false);
settings.seenVersion = '0.65.0';
saveSettings();
updates = await import('../app/js/update.js?upgrade');
check('upgrade shows notice', updates.recentUpdateShown(), true);
updates.closeRecentUpdate();
check('closed notice hidden', updates.recentUpdateShown(), false);
check('closed version persisted', JSON.parse(saved.get('wg.settings')).seenVersion, VERSION);
updates = await import('../app/js/update.js?restart');
check('closed notice stays hidden on restart', updates.recentUpdateShown(), false);
console.log(`What's new: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
