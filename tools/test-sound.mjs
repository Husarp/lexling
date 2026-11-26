// Event tones, turn precedence, and independent audio and vibration settings (owner, 2026-11-26).
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';

const saved = new Map([['wg.settings', JSON.stringify({ sound: false })]]);
globalThis.localStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
const haptics = [], native = [], oscillators = [], gains = [];
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en', vibrate: pattern => haptics.push(pattern) } });
globalThis.document = { hidden: false };
globalThis.window = {};
const { settings } = await import('../app/js/store.js');
const { playCue, queueTap, soundVolume, syncSound, tilesMoveCue } = await import('../app/js/sound.js');
const { newGame, apply } = await import('../app/js/tiles.js');

assert.equal(settings.sound, false);
assert.equal(settings.vibration, true);
assert.equal(soundVolume(), 70);
playCue('turn');
assert.deepEqual(haptics.splice(0), [[40, 80, 40]]);

class Audio {
  state = 'running';
  currentTime = 0;
  destination = {};
  createGain() {
    const ramp = [];
    const node = {
      ramp, gain: { value: 1, setValueAtTime: (...args) => ramp.push(args), exponentialRampToValueAtTime: (...args) => ramp.push(args) },
      connect(target) { this.target = target; return target; },
    };
    gains.push(node);
    return node;
  }
  createOscillator() {
    const node = {
      frequency: {}, start(time) { this.started = time; }, stop(time) { this.stopped = time; },
      connect(envelope) { this.envelope = envelope; return envelope; },
    };
    oscillators.push(node);
    return node;
  }
}
window.AudioContext = Audio;
settings.sound = true;

for (const [event, wave, notes, length, step, peak, partials] of [
  ['tap', 'triangle', [520], .06, .09, .06, []],
  ['tile', 'triangle', [360], .035, .072, .052, []],
  ['turn', 'sine', [659, 988], .23, .11, .085, [[4, .42, .35], [6.3, .15, .48]]],
  ['move', 'sine', [587, 494], .23, .11, .085, [[4, .42, .35], [6.3, .15, .48]]],
  ['accepted', 'sine', [523, 659, 784], .23, .11, .085, [[4, .42, .35], [6.3, .15, .48]]],
  ['rejected', 'sine', [311, 294], .23, .11, .085, [[4, .42, .35], [6.3, .15, .48]]],
  ['achievement', 'sine', [430, 580, 720], .085, .10, .11, [[2.7, .25, .24], [4.2, .12, .15]]],
  ['win', 'triangle', [523, 659, 784, 1047], .35, .09, .06, []],
  ['loss', 'triangle', [784, 622, 523], .28, .09, .06, []],
]) {
  playCue(event);
  const voices = oscillators.splice(0);
  assert.equal(voices.length, notes.length * (partials.length + 1), event);
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, event);
  notes.forEach((note, i) => {
    const start = .012 + i * step;
    [[1, 1, 1], ...partials].forEach(([ratio, level, decay], j) => {
      const voice = voices[i * (partials.length + 1) + j];
      const attack = !['tap', 'win', 'loss'].includes(event);
      assert.equal(voice.type, j ? 'sine' : wave);
      assert.equal(voice.frequency.value, note * ratio);
      near(voice.started, start);
      near(voice.stopped, start + length * decay);
      assert.deepEqual(voice.envelope.ramp[0], [attack ? .0001 : peak * level, start]);
      if (attack) assert.deepEqual(voice.envelope.ramp[1], [peak * level, start + .002]);
      assert.deepEqual(voice.envelope.ramp.at(-1), [.0001, voice.stopped]);
      assert.equal(voice.envelope.target, gains[0], 'every voice uses the same master gain');
    });
  });
}
assert.deepEqual(haptics.splice(0), [[40, 80, 40], [180], [60]]);
assert.equal(gains[0].gain.value, .7);
settings.volume = 24;
syncSound();
assert.equal(gains[0].gain.value, .24);

queueTap();
playCue('accepted', 'win');
await wait(10);
assert.equal(oscillators.length, 13, 'the word and result play without the control tap');
assert.ok(oscillators[9].started > oscillators[6].stopped, 'the result follows the accepted word');
oscillators.length = 0;
assert.deepEqual(haptics.splice(0), [[180]]);
queueTap();
await wait(10);
assert.deepEqual(oscillators.splice(0).map(x => x.frequency.value), [520]);

settings.vibration = false;
playCue('loss');
assert.equal(oscillators.splice(0).length, 3);
assert.deepEqual(haptics, []);
settings.vibration = true;
settings.volume = 0;
playCue('win');
assert.equal(oscillators.length, 0);
assert.deepEqual(haptics.splice(0), [[180]]);
settings.volume = 70;
settings.sound = false;
syncSound();
assert.equal(gains[0].gain.value, 0);
window.Capacitor = {
  getPlatform: () => 'android', isPluginAvailable: name => name === 'GameVibration',
  Plugins: { GameVibration: { vibrate: async ({ pattern }) => native.push(pattern) } },
};
playCue('loss');
assert.deepEqual(native, [[60]]);
assert.deepEqual(haptics, []);
assert.equal(oscillators.length, 0);
settings.vibration = false;
playCue('turn');
assert.deepEqual(native, [[60]]);

const start = newGame({ lang: 'en', players: [{}, { cpu: 'normal' }, { cpu: 'normal' }], first: 0, seed: 42 });
const pass = state => apply(state, { type: 'pass' }, () => true);
const first = pass(start), second = pass(first), third = pass(second);
assert.equal(tilesMoveCue(start, first, 0), null, 'my own completed move is quiet');
assert.equal(tilesMoveCue(first, second, 0), 'move', 'one bot hands off to another');
assert.equal(tilesMoveCue(second, third, 0), 'turn', 'a bot hands off to me');
assert.equal(tilesMoveCue(start, first, 1), 'turn', 'a peer can hand off directly to me');
assert.equal(tilesMoveCue(start, first, 2), 'move', 'a peer can hand off to another peer');
assert.equal(tilesMoveCue(start, { ...first, over: {} }, 1), 'move', 'a final move does not start my turn');
assert.equal(tilesMoveCue(start, { ...start, vote: {} }, 1), null, 'an open vote is not a completed move');
assert.equal(tilesMoveCue(start, { ...start, moves: [{ kind: 'resign', p: 1 }] }, 0), null, 'a resignation out of turn is not a move');
console.log('sound presets, volume, vibration routes, and Tiles turn cues passed');
