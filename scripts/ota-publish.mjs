// Android only. Invoked explicitly; build/test never contact GitHub.
// Payloads first, signed metadata last. Retain old payloads for in-flight downloads.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {config, root} from './ota-config.mjs';
import {assertMatchingWeb, preparedBundle, readApkWeb, readSignedManifest, stagedApkWeb} from './ota-consistency.mjs';
export function publishPlan(kind, version, c = config, base = root, readApk = readApkWeb) {
  const web = kind === 'bundle';
  if (!['bundle','shell'].includes(kind) || !(web ? /^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/ : /^[1-9][0-9]{0,9}$/).test(version || '') || (!web && Number(version) > 2100000000)) throw new Error('Specify a prepared bundle version or shell versionCode');
  const tag = c.channels[kind];
  const dir = path.join(base, 'dist', web ? version : `shell-${version}`);
  const manifest = path.join(dir, web ? c.artifacts.manifest : c.artifacts.shellManifest);
  const m = readSignedManifest(manifest, c, base);
  if (web ? m.version !== version : m.versionCode !== Number(version)) throw new Error('Prepared metadata version mismatch');
  if (!web && m.apk !== c.artifacts.apk.replaceAll('{code}', version)) throw new Error('APK name/config mismatch');
  const entries = web ? new Map(m.files.filter(file => file.size > 0).map(file => [file.asset, file])) : new Map([[m.apk, m]]);
  const payloads = [];
  for (const [name, entry] of entries) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error('Unsafe prepared asset name');
    const file = path.join(dir, name);
    if (web && !fs.existsSync(file)) continue;
    const bytes = fs.readFileSync(file);
    if (bytes.length !== entry.size || crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Prepared asset changed: ${name}`);
    payloads.push(file);
  }
  if (web) {
    for (const { apk, manifest: baked } of stagedApkWeb(c, base, readApk)) assertMatchingWeb(baked, m, apk);
  } else {
    const apk = path.join(dir, m.apk);
    const baked = readApk(apk);
    if (baked.version !== m.embeddedWebVersion) throw new Error('Shell metadata/embedded web version mismatch');
    const bundle = preparedBundle(baked.version, c, base);
    if (bundle) assertMatchingWeb(baked, bundle, apk);
  }
  const repo = ['--repo', `${c.github.owner}/${c.github.repo}`];
  const title = web ? `Live update ${m.version} · ${c.appName}` : `Android app ${m.versionName} · ${c.appName}`;
  return { tag, repo, title, notes: web ? m.message : m.notes, payloads, manifest };
}
export function executePublish(plan, gh = args => {
  const result = spawnSync('gh',args,{encoding:'utf8'});
  if (result.error) throw result.error;
  return result;
}) {
  const run = args => { const r = gh(args); if (r.status !== 0) throw new Error(r.stderr || 'gh command failed'); return r; };
  // Listing must succeed: an auth/network failure must never be treated as a missing release.
  const releases = JSON.parse(run(['release','list',...plan.repo,'--limit','1000','--json','tagName']).stdout);
  const exists = releases.some(r=>r.tagName===plan.tag);
  const metadata = [...plan.repo,'--prerelease','--latest=false','--title',plan.title,`--notes=${plan.notes}`];
  if (!exists) run(['release','create',plan.tag,...metadata]);
  // Hash-addressed payloads and versioned APKs stay available across channel changes.
  // Only the small metadata asset changes meaning. Do not delete/recreate the release.
  // Batch below GitHub/OS argument limits for applications with many files.
  for (let i=0;i<plan.payloads.length;i+=50) run(['release','upload',plan.tag,...plan.payloads.slice(i,i+50),...plan.repo,'--clobber']);
  run(['release','upload',plan.tag,plan.manifest,...plan.repo,'--clobber']);
  if (exists) run(['release','edit',plan.tag,...metadata]);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: publish.mjs bundle|shell <prepared-version>');
    executePublish(publishPlan(process.argv[2],process.argv[3]));
    console.log('Updated fixed Android OTA channel; normal releases retain Latest.');
  } catch (e) { console.error(e.message); process.exitCode=1; }
}
