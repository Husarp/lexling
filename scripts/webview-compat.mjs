import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import { transformSync } from 'esbuild';
import { JSDOM } from 'jsdom';

export const webViewTarget = 'chrome60';
const localOrigin = 'https://lexling.invalid';

export function compileScript(source, filename) {
  // Match esbuild's string quoting across targets. Chrome 60 parses template literals.
  const options = { sourcefile: filename, legalComments: 'inline', supported: { 'template-literal': true } };
  const { code, warnings } = transformSync(source, { ...options, target: webViewTarget });
  const modern = transformSync(source, { ...options, target: 'esnext' }).code;
  if (warnings.length) throw new Error(`${filename}: ${warnings.map(warning => warning.text).join('\n')}`);
  const regexConstructors = output => (output.match(/\bnew RegExp\(/g) || []).length;
  if (regexConstructors(code) > regexConstructors(modern)) {
    throw new Error(`${filename}: regular expression syntax is unavailable on ${webViewTarget}`);
  }
  return code === modern ? source : code;
}

export async function checkWebView(root, { compile = false } = {}) {
  const entry = path.join(root, 'index.html');
  let html = await readFile(entry, 'utf8');
  const dom = new JSDOM(html, { includeNodeLocations: true, url: localOrigin });
  const changes = [];
  const check = (source, name, canCompile = false) => {
    const output = compileScript(source, name);
    if (output !== source && !canCompile) throw new Error(`${name} must run as written on ${webViewTarget}`);
    new Script(output, { filename: name });
    return output;
  };
  try {
    for (const script of dom.window.document.querySelectorAll('script')) {
      const { startTag, endTag, startLine } = dom.nodeLocation(script);
      const type = (script.getAttribute('type') || '').trim().toLowerCase();
      if (type === 'module') throw new Error(`index.html:${startLine}: module scripts are unavailable on ${webViewTarget}`);
      if (type && !/^(?:(?:text|application)\/(?:x-)?(?:java|ecma)script|text\/(?:javascript1\.[0-5]|jscript|livescript))$/.test(type)) continue;
      const src = script.getAttribute('src') ?? script.getAttribute('href') ?? script.getAttribute('xlink:href');
      if (src !== null) {
        const url = new URL(src, dom.window.document.baseURI);
        if (url.origin !== localOrigin || !src.trim()) throw new Error(`Startup script must be local: ${src}`);
        const name = decodeURIComponent(url.pathname.slice(1));
        if (!name.split('/').every(segment => /^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/.test(segment))) {
          throw new Error(`Invalid startup script path: ${src}`);
        }
        const file = path.join(root, name);
        const source = await readFile(file, 'utf8');
        const asWritten = ['boot.js', 'compat.js'].includes(path.basename(name));
        const output = check(source, name, compile && !asWritten);
        if (output !== source) await writeFile(file, output);
      } else {
        const output = check(script.textContent, `index.html:${startLine}`, compile && Boolean(endTag));
        if (output !== script.textContent) changes.push([startTag.endOffset, endTag.startOffset, output]);
      }
    }
    for (const element of dom.window.document.querySelectorAll('*')) {
      for (const attr of element.attributes) {
        if (!attr.name.startsWith('on')) continue;
        const { startLine } = dom.nodeLocation(element).attrs[attr.name];
        check(`function handler(event) {\n${attr.value}\n}`, `index.html:${startLine} ${attr.name}`);
      }
    }
  } finally {
    dom.window.close();
  }
  if (changes.length) {
    for (const [start, end, output] of changes.reverse()) {
      html = html.slice(0, start) + output.replace(/<\/script/gi, '<\\/script') + html.slice(end);
    }
    await writeFile(entry, html);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkWebView(process.argv[2] ?? 'dist-web');
}
