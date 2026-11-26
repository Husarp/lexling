import fs from 'node:fs';
import path from 'node:path';
import { config, root, resolvePath, appVersion } from './ota-config.mjs';
import {
  versionPattern, buildWeb, inventory, ensureKeys, deltaFiles, releaseNotes, stageRelease, writeSignedManifest,
} from './ota-bundle.mjs';
import { assertMatchingWeb, stagedApkWeb } from './ota-consistency.mjs';

const args = process.argv.slice(2);
const version = args.shift();
const usage = 'Usage: npm run android:ota:bundle -- <version> --kind fix|feature [--message "text"] [--min-shell N] [--block 1.0.1,...]';
try {
  if (!versionPattern.test(version || '')) throw new Error(usage);
  const opts = {};
  const known = ['--kind', '--message', '--min-shell', '--block'];
  while (args.length) {
    const name = args.shift();
    if (!known.includes(name) || !args.length || known.includes(args[0]) || name in opts) throw new Error(usage);
    opts[name] = args.shift();
  }
  const kind = opts['--kind'];
  if (!['fix', 'feature'].includes(kind)) throw new Error(usage);
  const message = opts['--message'] ?? releaseNotes(version);
  if (!message.trim()) throw new Error(`No release notes for ${version}. Add them to app/js/whatsnew.js or supply --message.`);
  if (message.length > 10000) throw new Error('Message too long');
  const minShellApi = Number(opts['--min-shell'] ?? config.build.minShellApi);
  if (!Number.isInteger(minShellApi) || minShellApi < 1 || minShellApi > 2147483647) throw new Error('Invalid --min-shell');
  const blocked = opts['--block'] ? opts['--block'].split(',') : [];
  if (blocked.length > 1000 || blocked.some(value => !versionPattern.test(value))) throw new Error('Invalid blocked version');
  if (blocked.includes(version)) throw new Error('A release cannot block itself');

  const current = appVersion();
  if (version !== current) throw new Error(`Bundle version must match app/js/version.js (${current})`);
  const output = path.join(root, 'dist', version);
  if (fs.existsSync(output)) throw new Error('Release already exists; remove it explicitly or choose a fresh version');
  const { baselineVersion } = config.bundle;
  const baselineParts = baselineVersion.split('.').map(Number);
  const comparison = version.split('.').map(Number).reduce(
    (order, part, index) => order || Math.sign(part - baselineParts[index]), 0);
  if (comparison <= 0) throw new Error('Release must exceed embedded version');
  const baseline = resolvePath(config.bundle.baselineDir);
  if (!fs.existsSync(baseline)) throw new Error('Freeze and archive the first APK baseline before preparing an OTA release');

  const signingKey = ensureKeys();
  const apks = stagedApkWeb().filter(entry => entry.manifest.version === version);
  const releasedAt = apks[0]?.manifest.releasedAt || Date.now();
  const workRoot = path.join(root, '.local', 'release-web');
  fs.mkdirSync(workRoot, { recursive: true });
  const work = fs.mkdtempSync(path.join(workRoot, `${version}-`));
  try {
    buildWeb(work, version);
    const files = inventory(work);
    const manifest = { schema: 1, version, minShellApi, releasedAt, expiresAt: releasedAt + 365 * 86400000,
      kind, message, blocked, files };
    for (const { apk, manifest: baked } of apks) assertMatchingWeb(baked, manifest, apk);

    // Every supported APK must have access to any files that differ from its own built-in version.
    const baselineRoot = path.dirname(baseline);
    const baselines = [inventory(baseline)];
    for (const entry of fs.readdirSync(baselineRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === path.basename(baseline) || !versionPattern.test(entry.name)) continue;
      baselines.push(inventory(path.join(baselineRoot, entry.name)));
    }
    const assets = new Map(deltaFiles(files, baselines).filter(file => file.size > 0).map(file => [file.asset, file]));
    stageRelease(output, staging => {
      for (const [asset, file] of assets) fs.copyFileSync(path.join(work, file.path), path.join(staging, asset));
      writeSignedManifest(path.join(staging, config.artifacts.manifest), manifest, signingKey);
    });
    const size = [...assets.values()].reduce((total, file) => total + file.size, 0);
    console.log(`Prepared dist/${version}: ${files.length} inventory entries, ${size} upload bytes, signed Ed25519.`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
