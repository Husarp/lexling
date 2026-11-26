// Every test script in tools/ (test-*.mjs), one after another; fails when any of them does.   npm test
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const scripts = readdirSync(new URL('.', import.meta.url)).filter(name => /^test-.*\.mjs$/.test(name)).sort();
const failed = [];
for (const name of scripts) {
  const run = spawnSync(process.execPath, ['tools/' + name], { cwd: root, encoding: 'utf8' });
  const last = run.stdout.trim().split('\n').at(-1) ?? '';
  if (run.status === 0) console.log(`ok    ${name}  ${last}`);
  else { failed.push(name); console.log(`FAIL  ${name}\n${run.stdout}${run.stderr}`); }
}
console.log(failed.length ? `${failed.length} of ${scripts.length} test scripts FAILED: ${failed.join(', ')}` : `all ${scripts.length} test scripts passed`);
process.exit(failed.length ? 1 : 0);
