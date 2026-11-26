import { settings } from './store.js';

// Event presets from the sound mockup (owner, 2026-11-26).
const marimba = { wave: 'sine', length: .23, step: .11, attack: true, gain: .085, partials: [[4, .42, .35], [6.3, .15, .48]] };
const ticks = { wave: 'triangle', length: .035, step: .072, attack: true, gain: .052, partials: [] };
const wood = { wave: 'sine', length: .085, step: .10, attack: true, gain: .11, partials: [[2.7, .25, .24], [4.2, .12, .15]] };
const current = { wave: 'triangle', length: .06, step: .09, gain: .06, partials: [] };
const cues = {
  turn: [marimba, [659, 988]],
  move: [marimba, [587, 494]],
  tile: [ticks, [360]],
  tap: [current, [520]],
  accepted: [marimba, [523, 659, 784]],
  rejected: [marimba, [311, 294]],
  win: [{ ...current, length: .35 }, [523, 659, 784, 1047]],
  loss: [{ ...current, length: .28 }, [784, 622, 523]],
  achievement: [wood, [430, 580, 720]],
};
const vibrations = { turn: [40, 80, 40], win: [180], loss: [60] };

let ctx, master, tapTimer;
export const soundVolume = () => Number.isFinite(settings.volume) ? Math.max(0, Math.min(100, settings.volume)) : 70;

export function syncSound() {
  if (master) master.gain.value = settings.sound ? soundVolume() / 100 : 0;
}

function vibrate(pattern) {
  try {
    const cap = window.Capacitor;
    if (cap?.getPlatform?.() === 'android' && cap.isPluginAvailable?.('GameVibration')) {
      const native = cap.Plugins?.GameVibration ?? cap.registerPlugin('GameVibration');
      native.vibrate({ pattern }).catch(() => {});
    } else navigator.vibrate?.(pattern);
  } catch { /* vibration may be unavailable */ }
}

function synthesize(event, now) {
  const [style, notes] = cues[event];
  const { length, step, gain, wave, partials } = style;

  function tone(frequency, start, duration, peak, type) {
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    if (style.attack) {
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(peak, start + .002);
    } else envelope.gain.setValueAtTime(peak, start);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope).connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  notes.forEach((frequency, i) => {
    const start = now + i * step;
    tone(frequency, start, length, gain, wave);
    partials.forEach(([ratio, level, decay]) => tone(frequency * ratio, start, length * decay, gain * level, 'sine'));
  });
  return (notes.length - 1) * step + length;
}

export function playCue(event, then) {
  clearTimeout(tapTimer);
  const pattern = vibrations[then ?? event];
  if (settings.vibration && pattern) vibrate(pattern);
  if (!settings.sound || !soundVolume()) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    if (!ctx) {
      ctx = new Audio();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    syncSound();
    const play = () => {
      if (!settings.sound || document.hidden) return;
      const now = ctx.currentTime + .012, length = synthesize(event, now);
      if (then) synthesize(then, now + length + .02);
    };
    if (ctx.state === 'running') play();
    else {
      const requested = Date.now();
      ctx.resume().then(() => { if (Date.now() - requested < 500) play(); }).catch(() => {});
    }
  } catch { /* audio may be unavailable */ }
}

// A semantic cue from a click takes precedence over the ordinary control tap (owner, 2026-11-26).
export function queueTap() {
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => playCue('tap'), 0);
}

export function tilesMoveCue(before, after, seat) {
  const mine = p => seat < 0 ? !after.players[p].cpu : p === seat;
  const move = after.moves.slice(before.moves.length).findLast(m => m.kind !== 'resign' || m.p === before.turn);
  if (!after.over && !after.vote && before.turn !== after.turn && mine(after.turn)) return 'turn';
  if (move && !mine(move.p)) return 'move';
  return null;
}
