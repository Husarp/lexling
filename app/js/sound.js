import { settings } from './store.js';

let ctx;
function tone(freq, start, length, gain = 0.06) {
  ctx ??= new AudioContext();
  const osc = ctx.createOscillator(), amp = ctx.createGain(), t0 = ctx.currentTime + start;
  osc.frequency.value = freq;
  osc.type = 'triangle';
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + length);
}

export function click() { if (settings.sound) tone(520, 0, 0.06); }
export function chime() { if (settings.sound) [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35)); }
