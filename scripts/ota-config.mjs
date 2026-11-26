import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const configPath = process.env.OTA_CONFIG || path.join(root, 'ota.config.json');
export function resolvePath(value) {
  return value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : path.resolve(root, value);
}
// Lexling writes its version in one place, app/js/version.js (the Windows build and the old Gradle file read it too).
// The web bundle carries that version, an APK built from it shows it, and its versionCode follows the old scheme
// (0.72.1 → 7201, 1.0.0 → 10000), so every newer APK has a strictly higher code than the ones already installed.
export const versionFile = path.join(root, 'app', 'js', 'version.js');
export function appVersion(file = versionFile) {
  const version = fs.readFileSync(file, 'utf8').match(/VERSION\s*=\s*'([^']+)'/)?.[1];
  if (!/^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]?)\.(0|[1-9][0-9]?)$/.test(version || '')) throw new Error(`Expected VERSION = 'X.Y.Z' (minor and patch below 100) in ${file}`);
  return version;
}
export const versionCodeOf = version => {
  const [major, minor, patch] = version.split('.').map(Number);
  return major * 10000 + minor * 100 + patch;
};

export function readConfig(file = configPath, version = appVersion()) {
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  const derived = { versionName: version, webVersion: version, versionCode: versionCodeOf(version) };
  for (const [key, value] of Object.entries(derived)) {
    if (c.build?.[key] !== undefined && c.build[key] !== value) throw new Error(`build.${key} comes from app/js/version.js (${value}); remove it from ${path.basename(file)}`);
  }
  c.build = { message: '', ...c.build, ...derived };
  if (!/^[a-zA-Z]\w*(\.[a-zA-Z]\w*)+$/.test(c.appId) || typeof c.appName !== 'string' || !c.appName.trim()) throw new Error('Invalid app identity');
  for (const value of [c.github.owner, c.github.repo, c.channels.bundle, c.channels.shell])
    if (!/^[\w.-]+$/.test(value) || ['.', '..', 'latest'].includes(value)) throw new Error('Invalid repository/channel');
  if (c.channels.bundle === c.channels.shell) throw new Error('Bundle and shell channels must be separate');
  for (const [key, value] of Object.entries(c.artifacts)) {
    const expanded = value.replaceAll('{code}', '1').replaceAll('{sha256}', 'a'.repeat(64));
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(expanded)) throw new Error(`Unsafe artifact: ${key}`);
  }
  if (!c.artifacts.apk.endsWith('.apk') || !c.artifacts.apk.includes('{code}') || !c.artifacts.asset.includes('{sha256}')) throw new Error('Versioned APK and content-addressed asset patterns required');
  if (c.artifacts.manifest === c.artifacts.shellManifest) throw new Error('Distinct metadata names required');
  const releases = `https://github.com/${c.github.owner}/${c.github.repo}/releases`;
  c.urls = {
    bundle: c.updateUrls?.bundle || `${releases}/download/${c.channels.bundle}/${c.artifacts.manifest}`,
    shell: c.updateUrls?.shell || `${releases}/download/${c.channels.shell}/${c.artifacts.shellManifest}`,
    releases: c.updateUrls?.releases || releases
  };
  for (const value of Object.values(c.urls)) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Update URLs must use HTTPS without credentials/fragments');
    if (url.pathname.includes('/releases/latest')) throw new Error('OTA must never use GitHub latest');
  }
  // Publishing these scripts must produce exactly the URLs the APK uses.
  for (const [kind, name] of [['bundle','manifest'], ['shell','shellManifest']]) {
    if (c.urls[kind] !== `${releases}/download/${c.channels[kind]}/${c.artifacts[name]}`)
      throw new Error('Custom hosting requires a matching publisher; these scripts publish only configured GitHub channel URLs');
  }
  for (const key of ['shellApi','versionCode','minShellApi']) if (!Number.isInteger(c.build[key]) || c.build[key] < 1) throw new Error(`Invalid build.${key}`);
  if (c.build.versionCode > 2100000000 || c.build.minShellApi > c.build.shellApi) throw new Error('Invalid Android build code or embedded API requirement');
  for (const key of ['versionName','webVersion']) if (!/^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/.test(c.build[key])) throw new Error(`Invalid build.${key}`);
  if (!c.bundle || !c.bundle.sourceDir || !c.bundle.baselineDir || !Number.isInteger(c.bundle.baselineMinShellApi) || c.bundle.baselineMinShellApi < 1 || !/^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/.test(c.bundle.baselineVersion)) throw new Error('Invalid bundle baseline/source config');
  for (const key of ['privateKey','publicKey','keystore','properties','keyAlias','storePasswordEnv','keyPasswordEnv']) if (typeof c.signing?.[key] !== 'string' || !c.signing[key]) throw new Error(`Missing signing.${key}`);
  return c;
}
export const config = readConfig();
export const apkName = code => config.artifacts.apk.replaceAll('{code}', String(code));
export const apkMetadataName = code => apkName(code).replace(/\.apk$/, '.json');
export const assetName = sha256 => config.artifacts.asset.replaceAll('{sha256}', sha256);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'android') {
    console.log(JSON.stringify({...config, signing: {...config.signing, keystore:resolvePath(config.signing.keystore), properties:resolvePath(config.signing.properties)}}));
  } else if (process.argv[2] === 'apk') console.log(apkName(process.argv[3]));
  else {
    const value = process.argv[2]?.split('.').reduce((value, key) => value?.[key], config);
    if (value === undefined || typeof value === 'object') throw new Error('Specify a scalar config field');
    console.log(value);
  }
}
