import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config, root, resolvePath } from './ota-config.mjs';
import { buildWeb, embedded, ensureKeys, releaseNotes, stageRelease } from './ota-bundle.mjs';
import { assertMatchingWeb, preparedBundle } from './ota-consistency.mjs';

const mode = process.argv[2];
if (![undefined, '--freeze-baseline', '--release'].includes(mode) || process.argv.length > 3) throw new Error('Use --freeze-baseline or --release');
const { webVersion, minShellApi, shellApi, message } = config.build;
const baseline = resolvePath(config.bundle.baselineDir);
const isBaseline = webVersion === config.bundle.baselineVersion;
const releasedAt = Number(process.env.LEXLING_SHELL_RELEASED_AT || 0);
const prepared = mode === '--release' ? preparedBundle(webVersion) : null;
const webReleasedAt = prepared?.releasedAt ?? releasedAt;
const webMessage = prepared?.message ?? (message || releaseNotes(webVersion));
const work = path.join(root, '.local', 'android-web');
if (minShellApi > shellApi || (isBaseline && minShellApi !== config.bundle.baselineMinShellApi)) throw new Error('Inconsistent embedded API requirements');
if (mode === '--release') ensureKeys();
if (mode === '--freeze-baseline') {
  if (!isBaseline || fs.existsSync(baseline)) throw new Error('Freeze only the configured, as-yet-unfrozen baseline');
  stageRelease(baseline, staging => buildWeb(staging, webVersion));
} else if (mode === '--release' && !fs.existsSync(baseline)) {
  throw new Error('Freeze and archive the first APK baseline before a signed build');
}

let source = baseline;
if (!isBaseline || !fs.existsSync(baseline)) {
  if (mode === '--release') {
    const archive = path.join(path.dirname(baseline), webVersion);
    if (!fs.existsSync(archive)) {
      stageRelease(archive, staging => {
        buildWeb(staging, webVersion);
        if (prepared) assertMatchingWeb(embedded(staging, webVersion), prepared, 'APK web build');
      });
    }
    source = archive;
  } else {
    buildWeb(work, webVersion);
    source = work;
  }
}

const sourceManifest = embedded(source, webVersion, minShellApi, isBaseline ? 0 : webReleasedAt, webMessage);
const paths = new Set(sourceManifest.files.map(file => file.path));
if (!paths.has('index.html') || !paths.has('js/main.js')) throw new Error('Embedded bundle is missing index.html or js/main.js');
if (prepared) assertMatchingWeb(sourceManifest, prepared, 'APK web build');

const webDir = path.relative(root, source).split(path.sep).join('/');
fs.writeFileSync(path.join(root, 'capacitor.config.json'), JSON.stringify({
  appId: config.appId, appName: config.appName, webDir,
  android: { backgroundColor: '#000000' },
  server: { androidScheme: 'https', appStartPath: '/ota-startup.html' },
}, null, 2) + '\n');
const cap = spawnSync(process.execPath, [path.join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android'], { cwd: root, stdio: 'inherit' });
if (cap.error || cap.status !== 0) throw cap.error || new Error('Capacitor sync failed');
const assets = path.join(root, 'android/app/src/main/assets');
assertMatchingWeb(embedded(path.join(assets, 'public'), webVersion), sourceManifest, 'APK web assets');
fs.writeFileSync(path.join(assets, 'embedded-manifest.json'), JSON.stringify(sourceManifest));
fs.copyFileSync(resolvePath(config.signing.publicKey), path.join(assets, 'public-key.b64'));
