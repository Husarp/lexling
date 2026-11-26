import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config, root, apkName, apkMetadataName } from './ota-config.mjs';
import { javaHome } from './ota-consistency.mjs';

const mode = process.argv[2];
if (!['--audit', '--build', '--debug'].includes(mode) || process.argv.length !== 3) {
  throw new Error('Use npm run android:release:audit, npm run android:release, or npm run android:debug.');
}

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0');
const forbidden = tracked.filter(file => /\.(?:apk|aab|exe|zip|7z|log|jks|keystore|p12|pfx|pem|dc\.html)$/i.test(file)
  || /^(?:dist-web|dist|\.local|design|notes|\.loki|\.claude|_build|build|android\/app\/build)\//.test(file)
  || /(?:^|\/)(?:keystore|signing)\.properties$/i.test(file));
if (forbidden.length) throw new Error(`Remove private or generated files from Git before release:\n${forbidden.join('\n')}`);
console.log('Android release artifact audit passed.');

if (mode !== '--audit') {
  const release = mode === '--build';
  const windows = process.platform === 'win32';
  const android = path.join(root, 'android');
  const { versionName, versionCode, shellApi, webVersion } = config.build;
  const releasedAt = Date.now();
  const stage = path.join(root, 'dist', 'apk');
  const name = apkName(versionCode);
  const shellApk = path.join(stage, name);
  const metadata = path.join(stage, apkMetadataName(versionCode));
  if (release && (fs.existsSync(shellApk) || fs.existsSync(metadata))) throw new Error('APK versionCode already staged');

  const jdk = javaHome();
  const sdk = process.env.ANDROID_HOME || '/home/coder/tools/android-sdk';
  const env = { ...process.env, ANDROID_HOME: sdk };
  if (jdk) env.JAVA_HOME = jdk;
  if (release) env.LEXLING_SHELL_RELEASED_AT = String(releasedAt);
  else delete env.LEXLING_SHELL_RELEASED_AT;
  const localProperties = path.join(android, 'local.properties');
  if (!fs.existsSync(localProperties)) {
    const sdkProperty = sdk.replace(/[\\:]/g, '\\$&');
    fs.writeFileSync(localProperties, `sdk.dir=${sdkProperty}\n`, { flag: 'wx' });
  }
  if (release) {
    execFileSync(windows ? 'npm.cmd' : 'npm', ['test'], { cwd: root, stdio: 'inherit', shell: windows });
  }
  const prepare = ['scripts/ota-prepare-android.mjs'];
  if (release) prepare.push('--release');
  execFileSync(process.execPath, prepare, { cwd: root, env, stdio: 'inherit' });
  const gradle = release ? [':app:assembleRelease', `-PshellReleasedAt=${releasedAt}`] : [':app:assembleDebug'];
  execFileSync(windows ? 'gradlew.bat' : './gradlew', ['--no-daemon', ...gradle], {
    cwd: android, env, stdio: 'inherit', shell: windows,
  });

  const variant = release ? 'release' : 'debug';
  const build = path.join(root, 'build');
  const apk = path.join(build, `Lexling-${versionName}${release ? '' : '-debug'}.apk`);
  fs.mkdirSync(build, { recursive: true });
  fs.copyFileSync(path.join(android, 'app', 'build', 'outputs', 'apk', variant, `app-${variant}.apk`), apk);

  if (release) {
    const bytes = fs.readFileSync(apk);
    const record = { versionName, versionCode, shellApi, embeddedWebVersion: webVersion, releasedAt,
      apk: name, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    fs.mkdirSync(stage, { recursive: true });
    fs.copyFileSync(apk, shellApk, fs.constants.COPYFILE_EXCL);
    try {
      fs.writeFileSync(metadata, JSON.stringify(record) + '\n', { flag: 'wx' });
    } catch (error) {
      fs.rmSync(shellApk, { force: true });
      throw error;
    }
  }
  console.log(`Android ${variant} APK: ${apk}`);
}
