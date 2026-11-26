(function () {
  'use strict';

  let phase;
  let finished = false;
  let panel;
  let observer;

  function ota() {
    const capacitor = window.Capacitor;
    return capacitor && capacitor.Plugins && capacitor.Plugins.Ota;
  }

  function nativeRecovery() {
    const capacitor = window.Capacitor;
    return ota() && (typeof capacitor.getPlatform !== 'function' || capacitor.getPlatform() === 'android');
  }

  function bounded(label, action, ms = 3000) {
    let deadline;
    const timeout = new Promise((resolve, reject) => {
      deadline = setTimeout(() => reject(new Error(label + ' timed out')), ms);
    });
    return Promise.race([Promise.resolve().then(action), timeout]).finally(() => clearTimeout(deadline));
  }

  function diagnostic(level, message) {
    const text = ('LXStartup: ' + message).slice(0, 1200);
    const fallback = () => {
      try { console[level](text); } catch (error) { /* diagnostics must never block startup */ }
    };
    try {
      const plugin = ota();
      if (plugin && typeof plugin.logWebDiagnostic === 'function') {
        bounded('Startup diagnostic', () => plugin.logWebDiagnostic({ level, message: text }), 1000).catch(fallback);
        return;
      }
    } catch (error) { /* fall back to the console */ }
    fallback();
  }

  function show() {
    if (finished || panel) return;
    if (nativeRecovery()) {
      if (observer) observer.disconnect();
      return;
    }
    if (!document.body) {
      if (!observer) {
        observer = new MutationObserver(show);
        observer.observe(document.documentElement, { childList: true });
      }
      return;
    }
    if (observer) observer.disconnect();

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('wg.settings')) || {}; } catch (error) { /* storage off */ }
    const pl = saved.lang === 'pl' || /^pl/i.test(navigator.language);
    const light = saved.theme === 'light' || (saved.theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
    const surface = light ? '#fff' : '#1a1a1a';
    const text = light ? '#000' : '#fff';
    const line = light ? '#e0e0e0' : '#4a4a4a';

    panel = document.createElement('section');
    panel.id = 'lx-startup-failure';
    panel.lang = pl ? 'pl' : 'en';
    panel.style.cssText = 'position:fixed;z-index:9999;top:24px;left:16px;right:16px;max-width:360px;margin:auto;' +
      'padding:20px;border-radius:12px;box-shadow:var(--shadow-md,0 4px 12px rgba(0,0,0,.35));' +
      'font:600 16px/1.4 var(--font-body,sans-serif);background:var(--surface,' + surface + ');' +
      'color:var(--text,' + text + ');border:1px solid var(--line,' + line + ')';
    const status = document.createElement('p');
    status.setAttribute('role', 'alert');
    status.textContent = pl ? 'Lexling nie uruchomił się poprawnie' : "Lexling didn't start properly";
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'btn btn-primary';
    restart.style.cssText = 'margin-top:12px;min-height:44px;padding:0 16px;border-radius:10px;' +
      'background:var(--accent,#db5126);color:var(--on-accent,#fff);border:0;cursor:pointer';
    restart.textContent = pl ? 'Uruchom ponownie' : 'Restart';
    restart.onclick = () => location.reload();
    panel.append(status, restart);
    document.body.appendChild(panel);
  }

  function report(message) {
    if (finished) return;
    diagnostic('error', message + ' (' + phase + ')');
    show();
  }

  function detail(error) {
    return String(error && error.message || error);
  }

  const timer = setTimeout(() => report('Startup is taking too long'), 10000);
  function onError(event) {
    const target = event.target;
    if (target !== window && (!target || target.tagName !== 'SCRIPT')) return;
    const src = target.tagName === 'SCRIPT' && (target.getAttribute('src') || '').split(/[?#]/)[0];
    window.LXStartup.fail(event.error || event.message || ('Could not load ' + src));
  }

  function onRejection(event) {
    window.LXStartup.fail('Unhandled rejection: ' + detail(event.reason));
  }

  window.LXStartup = {
    step(label) {
      if (finished) return;
      phase = label;
      diagnostic('info', label);
    },
    fail(error) { report('Startup failed: ' + detail(error)); },
    finish() {
      finished = true;
      clearTimeout(timer);
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection);
      if (observer) observer.disconnect();
      if (panel) panel.remove();
    },
    bounded,
  };
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  window.LXStartup.step('Loading app scripts');
})();
