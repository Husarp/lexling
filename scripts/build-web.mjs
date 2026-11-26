import { copyFile, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { checkWebView, webViewTarget } from './webview-compat.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = path.join(root, 'app');
const moduleScript = '<script type="module" src="js/main.js"></script>';

async function copyAssets(output, relative = '') {
  for (const entry of await readdir(path.join(source, relative), { withFileTypes: true })) {
    if (!relative && entry.name === 'js') continue;
    const name = path.posix.join(relative, entry.name);
    if (name.length > 200 || !/^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/.test(entry.name)) {
      throw new Error(`Invalid OTA path: ${name}`);
    }
    const destination = path.join(output, name);
    if (entry.isDirectory()) {
      await mkdir(destination);
      await copyAssets(output, name);
    } else if (entry.isFile()) {
      await copyFile(path.join(source, name), destination);
    } else {
      throw new Error(`Unsupported OTA file: ${name}`);
    }
  }
}

async function outputPath(directory) {
  // Resolve symlinked parents before checking where recursive removal would run.
  const parent = path.dirname(directory);
  const realParent = await realpath(parent).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return outputPath(parent);
  });
  return path.join(realParent, path.basename(directory));
}

export async function buildWeb(outDir = 'dist-web') {
  const output = await outputPath(path.resolve(root, outDir));
  const app = await realpath(source);
  const contains = (parent, file) => parent === file || file.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);
  if (contains(output, app) || contains(app, output)) throw new Error(`Web build output overlaps app/: ${output}`);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await copyAssets(output);

  const index = path.join(output, 'index.html');
  const html = await readFile(index, 'utf8');
  const parts = html.split(moduleScript);
  if (parts.length !== 2) throw new Error('Expected one js/main.js module script in app/index.html');
  await writeFile(index, parts.join('<script src="js/main.js"></script>'));

  await mkdir(path.join(output, 'js'));
  for (const name of ['compat.js', 'boot.js']) {
    await copyFile(path.join(source, 'js', name), path.join(output, 'js', name));
  }
  const { warnings } = await build({
    absWorkingDir: root,
    entryPoints: ['app/js/main.js'],
    outfile: path.join(output, 'js', 'main.js'),
    bundle: true,
    format: 'iife',
    target: webViewTarget,
    banner: { js: '"use strict";' },
    minifyWhitespace: true,
    minifySyntax: true,
    // Keep regex literals for the verifier. Moving new syntax into RegExp() doesn't make it work.
    supported: {
      'regexp-dot-all-flag': true,
      'regexp-lookbehind-assertions': true,
      'regexp-match-indices': true,
      'regexp-named-capture-groups': true,
      'regexp-set-notation': true,
      'regexp-unicode-property-escapes': true,
    },
  });
  if (warnings.length) throw new Error(warnings.map(warning => warning.text).join('\n'));
  await checkWebView(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildWeb(process.argv[2]);
}
