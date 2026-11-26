(function (root) {
  'use strict';

  function define(object, key, value) {
    if (!(key in object)) Object.defineProperty(object, key, { configurable: true, writable: true, value });
  }

  define(root, 'globalThis', root);
  define(Object, 'hasOwn', (object, key) => Object.prototype.hasOwnProperty.call(object, key));
  define(Object, 'fromEntries', function (entries) {
    const object = {};
    for (const [key, value] of entries) {
      Object.defineProperty(object, key, { configurable: true, enumerable: true, writable: true, value });
    }
    return object;
  });

  function flatten(items, depth, output) {
    Array.prototype.forEach.call(items, item => {
      if (depth > 0 && Array.isArray(item)) flatten(item, depth - 1, output);
      else output.push(item);
    });
    return output;
  }
  define(Array.prototype, 'flat', function (depth = 1) { return flatten(this, Math.floor(depth), []); });
  define(Array.prototype, 'flatMap', function (callback, receiver) {
    return flatten(Array.prototype.map.call(this, callback, receiver), 1, []);
  });
  define(Array.prototype, 'at', function (index) {
    const offset = Math.trunc(index) || 0;
    const position = offset < 0 ? this.length + offset : offset;
    return position >= 0 && position < this.length ? this[position] : undefined;
  });
  function findLastIndex(callback, receiver) {
    for (let index = this.length - 1; index >= 0; index--) {
      if (callback.call(receiver, this[index], index, this)) return index;
    }
    return -1;
  }
  define(Array.prototype, 'findLastIndex', findLastIndex);
  define(Array.prototype, 'findLast', function (callback, receiver) {
    const index = findLastIndex.call(this, callback, receiver);
    return index < 0 ? undefined : this[index];
  });

  define(String.prototype, 'matchAll', function (pattern) {
    if (pattern instanceof RegExp && !pattern.global) throw new TypeError('matchAll requires a global RegExp');
    const rx = pattern instanceof RegExp ? new RegExp(pattern.source, pattern.flags) : new RegExp(pattern, 'g');
    if (pattern instanceof RegExp) rx.lastIndex = Math.max(0, Math.trunc(pattern.lastIndex) || 0);
    const text = String(this);
    return (function* () {
      for (let match; (match = rx.exec(text)) !== null;) {
        if (!match[0]) rx.lastIndex += rx.unicode && text.codePointAt(rx.lastIndex) > 0xffff ? 2 : 1;
        yield match;
      }
    })();
  });
  define(Promise.prototype, 'finally', function (action) {
    if (typeof action !== 'function') return this.then(action, action);
    return this.then(value => Promise.resolve(action()).then(() => value),
      error => Promise.resolve(action()).then(() => { throw error; }));
  });

  define(Element.prototype, 'replaceChildren', function (...children) {
    // Move reused children out before replacing the original contents.
    const fragment = this.ownerDocument.createDocumentFragment();
    fragment.append(...children);
    this.textContent = '';
    this.appendChild(fragment);
  });
  define(Element.prototype, 'toggleAttribute', function (name, force = !this.hasAttribute(name)) {
    if (force) { if (!this.hasAttribute(name)) this.setAttribute(name, ''); }
    else this.removeAttribute(name);
    return Boolean(force);
  });
  // Element scrolling arrived in Chrome 61 (Tiles scrolls the player row with it on first paint).
  define(Element.prototype, 'scrollTo', function (x, y) {
    const options = x !== null && typeof x === 'object' ? x : { left: x, top: y };
    if (options.left !== undefined) this.scrollLeft = Number(options.left) || 0;
    if (options.top !== undefined) this.scrollTop = Number(options.top) || 0;
  });
  // Chrome 66: fetch() there ignores the signal, so a deadline only stops waiting for the answer - but creating one
  // must not throw (word meanings).
  define(root, 'AbortController', class {
    constructor() {
      const listeners = [];
      this.signal = { aborted: false, onabort: null,
        addEventListener(type, listener) { if (type === 'abort') listeners.push(listener); },
        removeEventListener(type, listener) { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); } };
      this.listeners = listeners;
    }

    abort() {
      if (this.signal.aborted) return;
      this.signal.aborted = true;
      const event = { type: 'abort', target: this.signal };
      if (typeof this.signal.onabort === 'function') this.signal.onabort(event);
      this.listeners.slice().forEach(listener => listener.call(this.signal, event));
    }
  });

  // The old MediaQueryList exposes addListener for the change event.
  if (root.MediaQueryList) {
    define(root.MediaQueryList.prototype, 'addEventListener', function (type, listener) {
      if (type === 'change') this.addListener(listener);
    });
  }

  // Old WebViews can still refit on viewport changes and after a screen starts watching an element.
  define(root, 'ResizeObserver', class {
    constructor(callback) {
      this.targets = new Set();
      this.frame = 0;
      this.schedule = () => {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
          this.frame = 0;
          const entries = Array.from(this.targets, target => ({ target, contentRect: target.getBoundingClientRect() }));
          if (entries.length) callback(entries, this);
        });
      };
    }

    observe(target) {
      if (this.targets.has(target)) return;
      if (!this.targets.size) {
        root.addEventListener('resize', this.schedule);
        root.addEventListener('orientationchange', this.schedule);
      }
      this.targets.add(target);
      this.schedule();
    }

    unobserve(target) {
      this.targets.delete(target);
      if (!this.targets.size) this.disconnect();
    }

    disconnect() {
      this.targets.clear();
      root.removeEventListener('resize', this.schedule);
      root.removeEventListener('orientationchange', this.schedule);
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  });
})(window);
