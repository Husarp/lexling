import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appVersion, assetName, config, readConfig, root } from '../scripts/ota-config.mjs';
import { deltaFiles, inventory, writeSignedManifest } from '../scripts/ota-bundle.mjs';
import { assertMatchingWeb, readSignedManifest } from '../scripts/ota-consistency.mjs';
import { executePublish, publishPlan } from '../scripts/ota-publish.mjs';

let passed = 0;
let failed = 0;
function check(label, run) {
  try {
    run();
    passed++;
  } catch (error) {
    failed++;
    console.error(label, error);
  }
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lexling-ota-test-'));
const fixture = path.join(temp, 'repo');
const versionFile = path.join(fixture, 'app/js/version.js');
const configFile = path.join(fixture, 'ota.config.json');
const privateFile = path.join(temp, 'key.pem');
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const publicBase64 = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function runScript(script, ...args) {
  const run = spawnSync(process.execPath, ['scripts/' + script + '.mjs', ...args], {
    cwd: fixture, env: { ...process.env, OTA_CONFIG: configFile, LEXLING_SHELL_RELEASED_AT: '12345678' },
    encoding: 'utf8',
  });
  if (run.error) throw run.error;
  return run;
}
function succeeds(run) {
  assert.equal(run.status, 0, run.stdout + run.stderr);
}
function rejects(run, error) {
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, error);
}

try {
  const fixtureConfig = JSON.parse(fs.readFileSync(path.join(root, 'ota.config.json')));
  fixtureConfig.signing.privateKey = privateFile;
  fixtureConfig.bundle.baselineVersion = '0.73.0';
  fixtureConfig.bundle.baselineDir = '.local/ota-baseline/0.73.0';
  write(configFile, JSON.stringify(fixtureConfig));
  write(versionFile, "export const VERSION = '0.73.1';\n");
  write(privateFile, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  fs.chmodSync(privateFile, 0o600);
  write(path.join(fixture, fixtureConfig.signing.publicKey), publicBase64);

  const version = appVersion(versionFile);
  const c = readConfig(configFile, version);
  check('valid OTA config and derived build versions', () => {
    assert.equal(c.appId, 'com.husarp.lexling');
    assert.equal(c.build.versionName, '0.73.1');
    assert.equal(c.build.webVersion, '0.73.1');
    assert.equal(c.build.versionCode, 7301);
    assert.equal(c.urls.bundle, 'https://github.com/Husarp/lexling/releases/download/channel/manifest.json');
  });
  const configCases = [
    ['rejects latest channel', { channels: { ...c.channels, bundle: 'latest' } }, /Invalid repository\/channel/],
    ['rejects latest URL', { updateUrls: { bundle: 'https://github.com/Husarp/lexling/releases/latest/download/manifest.json' } }, /never use GitHub latest/],
    ['rejects equal channels', { channels: { bundle: 'channel', shell: 'channel' } }, /separate/],
    ['rejects mismatching explicit versionCode', { build: { ...fixtureConfig.build, versionCode: 7302 } }, /build.versionCode comes from/],
  ];
  for (const [label, fields, error] of configCases) {
    check(label, () => {
      const file = path.join(temp, 'invalid.json');
      write(file, JSON.stringify({ ...fixtureConfig, ...fields }));
      assert.throws(() => readConfig(file, version), error);
    });
  }

  const sample = path.join(temp, 'sample');
  write(path.join(sample, 'z.js'), 'end');
  write(path.join(sample, 'a', 'z.js'), '');
  write(path.join(sample, 'a.js'), 'start');
  const record = (name, bytes) => ({ path: name, size: Buffer.byteLength(bytes), sha256: sha256(bytes), asset: assetName(sha256(bytes)) });
  const files = [record('a.js', 'start'), record('a/z.js', ''), record('z.js', 'end')];
  check('inventory is sorted with hashes, sizes and asset names', () => assert.deepEqual(inventory(sample), files));
  check('inventory rejects invalid path segments', () => {
    write(path.join(sample, 'bad name.js'), '');
    assert.throws(() => inventory(sample), /Invalid OTA path: bad name.js/);
  });
  check('delta includes files different from either APK baseline', () => {
    const [same, reverted, added] = files;
    const first = [same, reverted];
    const second = [same, record(reverted.path, 'intermediate')];
    assert.deepEqual(deltaFiles(files, [first, second]), [reverted, added]);
  });

  const manifest = { version, files };
  const signed = path.join(temp, 'signed.json');
  writeSignedManifest(signed, manifest, privateKey);
  check('reads signed manifest', () => assert.deepEqual(readSignedManifest(signed, c, fixture), manifest));
  check('rejects a bad signature', () => {
    const envelope = JSON.parse(fs.readFileSync(signed));
    const signature = Buffer.from(envelope.signature, 'base64');
    signature[0] ^= 1;
    write(signed, JSON.stringify({ ...envelope, signature: signature.toString('base64') }));
    assert.throws(() => readSignedManifest(signed, c, fixture), /signature invalid/);
  });
  check('matching APK and OTA inventories can have a different order', () => {
    assert.doesNotThrow(() => assertMatchingWeb({ version, files: [...files].reverse() }, manifest, 'APK'));
  });
  check('APK with a different embedded version is independent', () => {
    assert.doesNotThrow(() => assertMatchingWeb({ version: '0.73.0', files: [] }, manifest, 'APK'));
  });
  check('changed embedded file fails consistency check', () => {
    assert.throws(() => assertMatchingWeb({ version, files: [record('a.js', 'changed'), ...files.slice(1)] }, manifest, 'APK'), /differs.*a\.js/);
  });
  check('missing embedded file fails consistency check', () => {
    assert.throws(() => assertMatchingWeb({ version, files: files.slice(1) }, manifest, 'APK'), /missing a\.js/);
  });

  const notes = 'First English bullet\nSecond English bullet';
  write(path.join(fixture, 'package.json'), '{"type":"module"}');
  write(path.join(fixture, 'app/js/whatsnew.js'), `export const whatsnew = [
    { version: '${version}', en: ['First English bullet', 'Second English bullet'], pl: ['Polish'] },
  ];`);
  const scripts = ['ota-config', 'ota-bundle', 'ota-consistency', 'ota-release', 'ota-prepare-android'];
  fs.mkdirSync(path.join(fixture, 'scripts'), { recursive: true });
  for (const name of scripts) {
    fs.copyFileSync(path.join(root, 'scripts', name + '.mjs'), path.join(fixture, 'scripts', name + '.mjs'));
  }
  write(path.join(fixture, 'scripts/build-web.mjs'), `
    import fs from 'node:fs';
    import path from 'node:path';
    const out = process.argv[2];
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(path.join(out, 'js'), { recursive: true });
    fs.writeFileSync(path.join(out, 'index.html'), '<script src="js/main.js"></script>');
    fs.copyFileSync('app/js/version.js', path.join(out, 'js/main.js'));
  `);
  write(path.join(fixture, 'scripts/build-probe.mjs'), `
    import { buildWeb } from './ota-bundle.mjs';
    buildWeb('build-probe', process.argv[2]);
  `);
  write(path.join(fixture, 'node_modules/@capacitor/cli/bin/capacitor'), `
    const fs = require('node:fs');
    if (process.argv.slice(2).join(' ') !== 'sync android') throw new Error('Unexpected Capacitor command');
    const { webDir } = JSON.parse(fs.readFileSync('capacitor.config.json'));
    fs.cpSync(webDir, 'android/app/src/main/assets/public', { recursive: true });
  `);
  check('buildWeb refuses a version different from version.js', () => {
    rejects(runScript('build-probe', '0.73.2'), /must match app\/js\/version\.js/);
    assert.equal(fs.existsSync(path.join(fixture, 'build-probe')), false);
  });
  check('freezes baseline once and keeps empty Cordova files', () => {
    rejects(runScript('ota-prepare-android', '--freeze-baseline'), /Freeze only the configured/);
    write(versionFile, "export const VERSION = '0.73.0';\n");
    try {
      succeeds(runScript('ota-prepare-android', '--freeze-baseline'));
      const baseline = path.join(fixture, c.bundle.baselineDir);
      for (const name of ['cordova.js', 'cordova_plugins.js']) assert.equal(fs.statSync(path.join(baseline, name)).size, 0);
      assert.equal(fs.existsSync(path.join(baseline, 'version.js')), false);
      rejects(runScript('ota-prepare-android', '--freeze-baseline'), /as-yet-unfrozen/);
    } finally {
      write(versionFile, `export const VERSION = '${version}';\n`);
    }
  });
  check('seeds the channel with the signed frozen inventory and no unchanged payloads', () => {
    const baselineVersion = c.bundle.baselineVersion;
    const args = [baselineVersion, '--kind', 'fix', '--message', 'Baseline'];
    rejects(runScript('ota-release', version, '--kind', 'fix', '--baseline'), /configured baseline version/);
    write(versionFile, `export const VERSION = '${baselineVersion}';\n// Changed source since the APK was frozen\n`);
    try {
      rejects(runScript('ota-release', ...args), /Release must exceed embedded version/);
      rejects(runScript('ota-release', ...args, '--baseline', '--min-shell', '2'), /configured baseline version and shell API/);
      const baseline = path.join(fixture, c.bundle.baselineDir);
      const frozenFiles = inventory(baseline);
      succeeds(runScript('ota-release', ...args, '--baseline'));
      const plan = publishPlan('bundle', baselineVersion, c, fixture);
      const manifest = readSignedManifest(plan.manifest, c, fixture);
      assert.equal(plan.tag, c.channels.bundle);
      assert.equal(manifest.minShellApi, c.bundle.baselineMinShellApi);
      assert.deepEqual(manifest.files, frozenFiles);
      assert.deepEqual(plan.payloads, []);
    } finally {
      write(versionFile, `export const VERSION = '${version}';\n`);
    }
  });
  const preparedAssets = path.join(fixture, 'android/app/src/main/assets');
  check('prepare preserves Capacitor identity and HTTPS origin', () => {
    succeeds(runScript('ota-prepare-android'));
    const generated = JSON.parse(fs.readFileSync(path.join(fixture, 'capacitor.config.json')));
    assert.deepEqual(generated, {
      appId: c.appId, appName: 'Lexling', webDir: '.local/android-web',
      android: { backgroundColor: '#000000' }, server: { androidScheme: 'https' },
    });
  });
  check('prepare embeds English notes and Lexling release timestamp', () => {
    const baked = JSON.parse(fs.readFileSync(path.join(preparedAssets, 'embedded-manifest.json')));
    assert.equal(baked.version, version);
    assert.equal(baked.message, notes);
    assert.equal(baked.releasedAt, 12345678);
    assert.equal(fs.readFileSync(path.join(preparedAssets, 'public-key.b64'), 'utf8'), publicBase64);
  });
  const bundlePath = path.join(fixture, 'dist', version);
  const bundleManifest = path.join(bundlePath, c.artifacts.manifest);
  const bundleArgs = [version, '--kind', 'fix'];
  check('refuses a private key inside the worktree', () => {
    const localKey = path.join(fixture, 'key.pem');
    fs.copyFileSync(privateFile, localKey);
    write(configFile, JSON.stringify({ ...fixtureConfig, signing: { ...fixtureConfig.signing, privateKey: localKey } }));
    try {
      rejects(runScript('ota-release', ...bundleArgs), /private key outside the worktree/);
    } finally {
      write(configFile, JSON.stringify(fixtureConfig));
      fs.rmSync(localKey);
    }
  });
  if (process.platform !== 'win32') {
    check('refuses a private key readable by others', () => {
      fs.chmodSync(privateFile, 0o644);
      try {
        rejects(runScript('ota-release', ...bundleArgs), /owner-only/);
      } finally {
        fs.chmodSync(privateFile, 0o600);
      }
    });
  }
  check('refuses an OTA key pair mismatch', () => {
    const publicFile = path.join(fixture, c.signing.publicKey);
    write(publicFile, Buffer.alloc(32).toString('base64'));
    try {
      rejects(runScript('ota-release', ...bundleArgs), /public\/private key mismatch/);
    } finally {
      write(publicFile, publicBase64);
    }
  });
  check('bundle signs English release notes and only changed payloads', () => {
    succeeds(runScript('ota-release', ...bundleArgs, '--min-shell', '2', '--block', '0.72.9'));
    const bundle = readSignedManifest(bundleManifest, c, fixture);
    assert.equal(bundle.message, notes);
    assert.equal(bundle.kind, 'fix');
    assert.equal(bundle.minShellApi, 2);
    assert.deepEqual(bundle.blocked, ['0.72.9']);
    const main = bundle.files.find(file => file.path === 'js/main.js');
    assert.deepEqual(fs.readdirSync(bundlePath).sort(), [c.artifacts.manifest, main.asset].sort());
  });
  check('bundle never overwrites an existing output', () => {
    const before = fs.readFileSync(bundleManifest);
    rejects(runScript('ota-release', ...bundleArgs, '--message', 'Override'), /Release already exists/);
    assert.deepEqual(fs.readFileSync(bundleManifest), before);
  });
  check('prepare uses empty notes when no release notes exist', () => {
    write(versionFile, "export const VERSION = '0.73.2';\n");
    succeeds(runScript('ota-prepare-android'));
    const baked = JSON.parse(fs.readFileSync(path.join(preparedAssets, 'embedded-manifest.json')));
    assert.equal(baked.version, '0.73.2');
    assert.equal(baked.message, '');
  });
  check('bundle without notes requires an explicit message', () => {
    rejects(runScript('ota-release', '0.73.2', '--kind', 'fix'), /No release notes/);
    succeeds(runScript('ota-release', '0.73.2', '--kind', 'fix', '--message', 'Override'));
    const metadata = readSignedManifest(path.join(fixture, 'dist/0.73.2', c.artifacts.manifest), c, fixture);
    assert.equal(metadata.message, 'Override');
  });

  const code = String(c.build.versionCode);
  const apkDir = path.join(fixture, 'dist', 'shell-' + code);
  const apkName = config.artifacts.apk.replaceAll('{code}', code);
  const apk = path.join(apkDir, apkName);
  const apkBytes = Buffer.from('fake APK payload');
  const shellNotes = 'Shell notes';
  write(apk, apkBytes);
  writeSignedManifest(path.join(apkDir, c.artifacts.shellManifest), {
    versionName: version, versionCode: Number(code), embeddedWebVersion: version,
    apk: apkName, size: apkBytes.length, sha256: sha256(apkBytes), notes: shellNotes,
  }, privateKey);
  const bundle = readSignedManifest(bundleManifest, c, fixture);
  const mainAsset = bundle.files.find(file => file.path === 'js/main.js').asset;
  const readFakeApk = file => {
    assert.equal(file, apk);
    return bundle;
  };

  for (const [kind, id, title, expectedNotes] of [
    ['bundle', version, 'Live update 0.73.1 · Lexling', notes],
    ['shell', code, 'Android app 0.73.1 · Lexling', shellNotes],
  ]) {
    const plan = publishPlan(kind, id, c, fixture, readFakeApk);
    check(`${kind} publish plan reads signed metadata and only stages payload files`, () => {
      assert.equal(plan.title, title);
      assert.equal(plan.notes, expectedNotes);
      assert.equal(plan.tag, c.channels[kind]);
      assert.deepEqual(plan.payloads, [kind === 'shell' ? apk : path.join(bundlePath, mainAsset)]);
    });
    for (const exists of [false, true]) {
      check(`${kind} fake gh ${exists ? 'edits' : 'creates'} the fixed prerelease and uploads metadata last`, () => {
        const calls = [];
        executePublish(plan, args => {
          calls.push(args);
          return { status: 0, stdout: JSON.stringify(exists ? [{ tagName: plan.tag }] : []) };
        });
        assert.deepEqual(calls[0], ['release', 'list', ...plan.repo, '--limit', '1000', '--json', 'tagName']);
        assert.deepEqual(calls.slice(1).map(args => args[1]), exists ? ['upload', 'upload', 'edit'] : ['create', 'upload', 'upload']);
        assert.deepEqual(calls.find(args => args[1] === (exists ? 'edit' : 'create')), [
          'release', exists ? 'edit' : 'create', plan.tag, ...plan.repo,
          '--prerelease', '--latest=false', '--title', title, `--notes=${expectedNotes}`,
        ]);
        assert.deepEqual(calls.filter(args => args[1] === 'upload').map(args => args[3]), [...plan.payloads, plan.manifest]);
      });
    }
  }
  check('publish aborts immediately on a failing gh release list', () => {
    const plan = publishPlan('bundle', version, c, fixture, readFakeApk);
    const commands = [];
    assert.throws(() => executePublish(plan, args => {
      commands.push(args[1]);
      return { status: 1, stderr: 'list unavailable' };
    }), /list unavailable/);
    assert.deepEqual(commands, ['list']);
  });
  check('publish plan rejects a tampered payload', () => {
    fs.appendFileSync(apk, 'tampered');
    assert.throws(() => publishPlan('shell', code, c, fixture), /Prepared asset changed/);
  });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
