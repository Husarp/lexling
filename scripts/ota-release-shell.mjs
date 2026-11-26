import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { root, config, apkName, apkMetadataName } from './ota-config.mjs';
import { ensureKeys, stageRelease, writeSignedManifest } from './ota-bundle.mjs';
import { assertMatchingWeb, preparedBundle, readApkWeb } from './ota-consistency.mjs';

try {
  const [code, ...extra] = process.argv.slice(2);
  if (!/^[1-9][0-9]{0,9}$/.test(code || '') || Number(code) > 2100000000 || extra.length) throw new Error('Usage: npm run android:ota:shell -- <versionCode>');
  const out = path.join(root, `dist/shell-${code}`);
  if (fs.existsSync(out)) throw new Error('Shell release exists; remove unpublished output explicitly to replace');
  const m = JSON.parse(fs.readFileSync(path.join(root, 'dist/apk', apkMetadataName(code))));
  const apk = path.join(root, 'dist/apk', apkName(code));
  const bytes = fs.readFileSync(apk);
  if (m.versionCode !== Number(code) || m.apk !== path.basename(apk) || m.size !== bytes.length || m.sha256 !== crypto.createHash('sha256').update(bytes).digest('hex')) {
    throw new Error('Build metadata/APK mismatch; rebuild');
  }
  const baked = readApkWeb(apk);
  if (baked.version !== m.embeddedWebVersion) throw new Error('Build metadata/embedded web version mismatch; rebuild');
  const bundle = preparedBundle(baked.version);
  if (bundle) assertMatchingWeb(baked, bundle, apk);
  const signingKey = ensureKeys();
  const releasedAt = m.releasedAt || Date.now();
  const manifest = { schema: 1, ...m, notes: `${config.appName} app update ${m.versionName}.`,
    releasedAt, expiresAt: releasedAt + 365 * 86400000 };
  stageRelease(out, staging => {
    fs.writeFileSync(path.join(staging, m.apk), bytes);
    writeSignedManifest(path.join(staging, config.artifacts.shellManifest), manifest, signingKey);
  });
  console.log(`Prepared dist/shell-${code}: signed ${config.artifacts.shellManifest} + ${m.apk}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
