import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { config, root, resolvePath, assetName, appVersion } from './ota-config.mjs';
import { whatsnew } from '../app/js/whatsnew.js';

export { root };
export const versionPattern = /^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/;

export function releaseNotes(version) {
  return whatsnew.find(release => release.version === version)?.en.join('\n') ?? '';
}

export function buildWeb(out, version = config.build.webVersion) {
  const current = appVersion();
  if (version !== current) throw new Error(`Bundle version must match app/js/version.js (${current})`);
  const target = path.resolve(root, out);
  execFileSync(process.execPath, ['scripts/build-web.mjs', target], { cwd: root, stdio: 'inherit' });
  for (const file of ['cordova.js', 'cordova_plugins.js']) fs.writeFileSync(path.join(target, file), '');
  for (const file of ['index.html', 'js/main.js']) {
    if (!fs.statSync(path.join(target, file), { throwIfNoEntry: false })?.isFile()) throw new Error(`Built bundle is missing ${file}`);
  }
}

export function inventory(dir) {
  const files = [];
  function walk(relativeDir = '') {
    for (const entry of fs.readdirSync(path.join(dir, relativeDir), { withFileTypes: true })) {
      const relative = path.posix.join(relativeDir, entry.name);
      if (relative.length > 200 || !/^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/.test(entry.name)) throw new Error(`Invalid OTA path: ${relative}`);
      if (entry.isDirectory()) walk(relative);
      else if (entry.isFile()) {
        const data = fs.readFileSync(path.join(dir, relative));
        const sha256 = crypto.createHash('sha256').update(data).digest('hex');
        files.push({ path: relative, size: data.length, sha256, asset: assetName(sha256) });
      } else throw new Error(`Unsupported bundle file: ${relative}`);
    }
  }
  walk();
  return files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

export function deltaFiles(files, baselines) {
  const hashes = baselines.map(entries => new Map(entries.map(file => [file.path, file.sha256])));
  return files.filter(file => hashes.some(baseline => baseline.get(file.path) !== file.sha256));
}

export function ensureKeys() {
  const privatePath = fs.realpathSync(resolvePath(config.signing.privateKey));
  if (privatePath.startsWith(fs.realpathSync(root) + path.sep)) throw new Error('Keep the OTA private key outside the worktree');
  if (process.platform !== 'win32' && (fs.statSync(privatePath).mode & 0o077) !== 0) throw new Error('Private key must be owner-only');
  const key = crypto.createPrivateKey(fs.readFileSync(privatePath));
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Expected an Ed25519 key');
  const raw = Buffer.from(crypto.createPublicKey(key).export({ format: 'jwk' }).x, 'base64url').toString('base64');
  if (fs.readFileSync(resolvePath(config.signing.publicKey), 'utf8').trim() !== raw) throw new Error('OTA public/private key mismatch');
  return key;
}

export function embedded(dir = resolvePath(config.bundle.baselineDir), version = config.bundle.baselineVersion,
  minShellApi = config.bundle.baselineMinShellApi, releasedAt = 0, message = '') {
  return { schema: 1, version, minShellApi, releasedAt, expiresAt: 4102444800000, kind: 'fix', message, blocked: [], files: inventory(dir) };
}

export function writeSignedManifest(file, manifest, key) {
  const payload = Buffer.from(JSON.stringify({ ...manifest, publishedAt: Date.now() }));
  const signature = crypto.sign(null, payload, key);
  fs.writeFileSync(file, JSON.stringify({ payload: payload.toString('base64'), signature: signature.toString('base64') }, null, 2) + '\n');
}

export function stageRelease(output, prepare) {
  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.prepare-'));
  try {
    prepare(staging);
    if (fs.existsSync(output)) throw new Error(`Output already exists: ${output}`);
    fs.renameSync(staging, output);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
