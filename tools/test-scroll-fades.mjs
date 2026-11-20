// Exercise continuation cues without a browser: overflow, dialog layer, updates and cleanup.
import assert from 'node:assert/strict';
import { hasMoreBelow, watchScrollFades } from '../app/js/scroll-fades.js';
let pass = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); pass++; };
class Element {
  constructor({ height = 100, total = 100, top = 0, left = 0, width = 300, overflow = 'auto', background = 'rgb(20, 20, 20)' } = {}) {
    Object.assign(this, { clientHeight: height, scrollHeight: total, scrollTop: 0, top, left, width, overflow, background,
      isConnected: true, children: [], nodeType: 1, className: '', style: { setProperty() {} } });
    this.classList = { contains: name => this.className.split(' ').includes(name) };
  }
  get firstElementChild() { return this.children[0]; }
  getBoundingClientRect() { return { top: this.top, bottom: this.top + this.clientHeight, left: this.left, right: this.left + this.width, height: this.clientHeight }; }
  setAttribute() {}
  closest() { return this.dialog ?? null; }
  append(el) { this.children.push(el); el.parentElement = this; }
  remove() { this.isConnected = false; this.parentElement.children = this.parentElement.children.filter(el => el !== this); }
}
for (const [height, total, scroll, expected] of [[100,100,0,false],[100,300,0,true],[100,300,150,true],[100,300,199,false],[100,300,200,false],[100,300,210,false]])
  check(hasMoreBelow({ clientHeight:height, scrollHeight:total, scrollTop:scroll }), expected);
const body = new Element(), page = new Element({ height: 640, total: 1000 }), list = new Element({ total: 300, top: 150 });
const dialog = new Element(), options = new Element({ total: 500, top: 100 }); options.dialog = dialog;
const topbar = new Element({ height: 80 });
let candidates = [list, options], scheduled, mutation, resized;
const events = new Map(), windowEvents = new Map(), observed = new Set();
globalThis.innerWidth = 360; globalThis.innerHeight = 640;
globalThis.document = { body, scrollingElement: page, documentElement: { style: { setProperty: (_, value) => { topbar.measured = value; } } },
  createElement: () => new Element(), querySelectorAll: () => candidates, querySelector: () => topbar,
  addEventListener: (type, fn) => events.set(type, fn), removeEventListener: type => events.delete(type) };
globalThis.window = { addEventListener: (type, fn) => windowEvents.set(type, fn), removeEventListener: type => windowEvents.delete(type) };
globalThis.getComputedStyle = el => ({ position: 'sticky', overflowY: el.overflow, backgroundColor: el.background });
globalThis.requestAnimationFrame = fn => { scheduled = fn; return 1; };
globalThis.cancelAnimationFrame = () => { scheduled = null; };
globalThis.ResizeObserver = class { constructor(fn) { resized = fn; } observe(el) { observed.add(el); } unobserve(el) { observed.delete(el); } disconnect() { observed.clear(); } };
globalThis.MutationObserver = class { constructor(fn) { mutation = fn; } observe() {} disconnect() {} };
const flush = () => { const fn = scheduled; scheduled = null; fn?.(); };
const stop = watchScrollFades(); flush();
check(topbar.measured, '80px');
check(body.children.length, 2); // page and saved-list fades
check(dialog.children.length, 1); // options fade is in the modal's layer
const fade = dialog.children[0];
check(fade.style.cssText.includes('top:172px'), true);
check(fade.hidden, false);
options.scrollTop = 400; events.get('scroll')(); flush(); check(fade.hidden, true);
options.scrollHeight = 800; resized(); flush(); check(fade.hidden, false);
mutation([{ type: 'attributes', target: fade }]); check(scheduled, null);
mutation([{ type: 'childList', target: dialog, addedNodes: [fade], removedNodes: [] }]); check(scheduled, null);
mutation([{ type: 'attributes', target: options }]); check(typeof scheduled, 'function'); flush();
options.overflow = 'hidden'; resized(); flush(); check(fade.hidden, true);
options.overflow = 'auto'; options.clientHeight = 0; resized(); flush(); check(fade.hidden, true);
options.clientHeight = 100; candidates = [list]; mutation([{ type: 'childList', target: dialog, addedNodes: [], removedNodes: [options] }]); flush();
check(dialog.children.length, 0); check(observed.has(options), false);
stop(); check([body.children.length, events.size, windowEvents.size, observed.size], [0,0,0,0]);
console.log(`all ${pass} scroll-fade tests passed`);
