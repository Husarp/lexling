import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { checkWebView, compileScript } from '../scripts/webview-compat.mjs';

const temp = new URL('../.local/', import.meta.url);
await mkdir(temp, { recursive: true });
const root = await mkdtemp(join(fileURLToPath(temp), 'webview-'));
const index = html => writeFile(join(root, 'index.html'), html);
const boot = await readFile(new URL('../app/js/boot.js', import.meta.url), 'utf8');
let passed = 0;
async function test(name, run) {
  try { await run(); passed++; }
  catch (error) { throw new Error(name, { cause: error }); }
}

function withBoot(run, options = {}) {
  const { window } = new JSDOM('', { url: 'https://localhost/', runScripts: 'outside-only', ...options.dom });
  try {
    const timers = new Map();
    let next = 0;
    window.setTimeout = (fn, delay) => { timers.set(++next, { fn, delay }); return next; };
    window.clearTimeout = id => timers.delete(id);
    window.console.info = () => {};
    window.console.error = options.logError || (() => {});
    if (options.capacitor) window.Capacitor = options.capacitor;
    if (options.lang) Object.defineProperty(window.navigator, 'language', { value: options.lang });
    window.eval(boot);
    return Promise.resolve(run(window, timers)).finally(() => window.close());
  } catch (error) {
    window.close();
    throw error;
  }
}

try {
  await test('modern syntax is lowered', () => {
    const source = 'window.x ??= window.obj?.value;';
    const compiled = compileScript(source, 'modern.js');
    assert.notEqual(compiled, source);
    assert.equal(compileScript(compiled, 'lowered.js'), compiled);
    assert.throws(() => compileScript('await run();', 'main.js'), /Top-level await/);
  });
  await test('external scripts must pass as written in verify mode', async () => {
    await index('<script src="game.js"></script><script>window.x ??= 1;</script>');
    await writeFile(join(root, 'game.js'), 'window.result = window.value?.key;');
    await assert.rejects(checkWebView(root), /game.js must run as written/);
    await checkWebView(root, { compile: true });
    await checkWebView(root);
  });
  await test('inline scripts are checked', async () => {
    await index('<script type="application/json">{"modern":"?. ??="}</script>\n<script>window.x ??= 1;</script>');
    await assert.rejects(checkWebView(root), /index.html:2 must run as written/);
  });
  await test('inline handlers are checked even in compile mode', async () => {
    await index('<button onclick="window.value?.run()">Go</button>');
    await assert.rejects(checkWebView(root, { compile: true }), /onclick must run as written/);
    await index('<button onclick="if (event) return false">Go</button>');
    await checkWebView(root);
  });
  await test('unsupported literals are rejected rather than moved into RegExp()', async () => {
    for (const regex of ['/(?<=a)b/', '/x/s', '/\\p{L}/u', '/x/d']) {
      await index(`<script>window.regex = ${regex};</script>`);
      await assert.rejects(checkWebView(root, { compile: true }), /regular expression syntax is unavailable/);
    }
  });
  await test('module scripts are rejected, including in compile mode', async () => {
    await index('<script type=" MODULE " src="game.js"></script>');
    await assert.rejects(checkWebView(root, { compile: true }), /module scripts are unavailable/);
    await index('<script>export const entry = 1;</script>');
    await assert.rejects(checkWebView(root), /Unexpected token 'export'/);
  });
  await test('scripts must be local after resolving the document base', async () => {
    await index('<base href="https://example.com"><script src="local.js"></script>');
    await assert.rejects(checkWebView(root), /Startup script must be local/);
  });
  await test('boot and compat pass as written and cannot be compiled', async () => {
    await mkdir(join(root, 'js'));
    await index('<script src="js/compat.js"></script><script src="js/boot.js"></script>');
    for (const name of ['compat.js', 'boot.js']) {
      await copyFile(new URL('../app/js/' + name, import.meta.url), join(root, 'js', name));
    }
    await checkWebView(root);
    for (const name of ['compat.js', 'boot.js']) {
      const path = join(root, 'js', name);
      await writeFile(path, 'window.value?.run();');
      await assert.rejects(checkWebView(root, { compile: true }), new RegExp(name + ' must run as written'));
      await copyFile(new URL('../app/js/' + name, import.meta.url), path);
    }
  });
  await test('startup failure before the body gives one localized restart panel', () => withBoot(async window => {
    window.localStorage.setItem('wg.settings', JSON.stringify({ theme: 'light', lang: 'pl' }));
    const { document, LXStartup } = window;
    document.body.remove();
    LXStartup.fail(Error('script parse failed'));
    document.documentElement.appendChild(document.createElement('body'));
    await Promise.resolve();
    LXStartup.fail(Error('another failure'));
    const panel = document.querySelectorAll('#lx-startup-failure');
    assert.equal(panel.length, 1);
    assert.equal(panel[0].querySelector('p').textContent, 'Lexling nie uruchomił się poprawnie');
    assert.equal(panel[0].querySelector('button').textContent, 'Uruchom ponownie');
    assert.equal(typeof panel[0].querySelector('button').onclick, 'function');
    LXStartup.finish();
    assert.equal(document.querySelector('#lx-startup-failure'), null);
  }));
  await test('startup timeout uses navigator language and stops after finish', async () => {
    await withBoot((window, timers) => {
      [...timers.values()].find(timer => timer.delay === 10000).fn();
      assert.equal(window.document.querySelector('#lx-startup-failure').lang, 'pl');
    }, { lang: 'pl-PL' });
    await withBoot((window, timers) => {
      window.LXStartup.finish();
      assert.equal(timers.size, 0);
      window.dispatchEvent(new window.ErrorEvent('error', { message: 'after-ready error' }));
      assert.equal(window.document.querySelector('#lx-startup-failure'), null);
    });
  });
  await test('failed script loads and rejections are forwarded to the Android watchdog', () => {
    const diagnostics = [];
    return withBoot(async (window, timers) => {
      const script = window.document.createElement('script');
      script.src = 'js/main.js';
      window.document.head.appendChild(script);
      script.dispatchEvent(new window.Event('error'));
      const rejection = new window.Event('unhandledrejection');
      rejection.reason = Error('rejected startup');
      window.dispatchEvent(rejection);
      [...timers.values()].find(timer => timer.delay === 10000).fn();
      await Promise.resolve();
      assert.deepEqual(diagnostics.map(entry => entry.level), ['info', 'error', 'error', 'error']);
      assert.match(diagnostics[1].message, /Could not load js\/main.js/);
      assert.match(diagnostics[2].message, /rejected startup/);
      assert.match(diagnostics[3].message, /taking too long/);
      assert.equal(window.document.querySelector('#lx-startup-failure'), null);
    }, {
      capacitor: { getPlatform: () => 'android', Plugins: { Ota: {
        logWebDiagnostic: async entry => { diagnostics.push(entry); },
      } } },
    });
  });
  await test('diagnostics time out and fall back to console', () => {
    const fallback = [];
    return withBoot(async (window, timers) => {
      window.LXStartup.fail(Error('bridge stalled'));
      await Promise.resolve();
      for (const timer of timers.values()) if (timer.delay === 1000) timer.fn();
      await new Promise(resolve => setImmediate(resolve));
      assert.match(fallback[0], /bridge stalled/);
      assert.equal(await window.LXStartup.bounded('value', () => 42, 50), 42);
      await assert.rejects(window.LXStartup.bounded('action', () => { throw Error('broken'); }, 50), /broken/);
    }, {
      logError: message => fallback.push(message),
      capacitor: { Plugins: { Ota: { logWebDiagnostic: () => new Promise(() => {}) } } },
    });
  });
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log(`${passed} tests passed`);
