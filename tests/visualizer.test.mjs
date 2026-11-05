import test from 'node:test';
import assert from 'node:assert/strict';
import { CosmicVisualizer, opacityAt, waveAt } from '../dist/visualizer.js';

const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

test('6 Hz visual phase completes six cycles per second, with a 20–80% envelope', () => {
  close(opacityAt(6, 0), 0.8);
  close(opacityAt(6, 1 / 12), 0.2);
  close(opacityAt(6, 1 / 6), 0.8);
  close(waveAt(6, 1 / 24), 0);
  let crossings = 0;
  let previous = waveAt(6, 0);
  for (let sample = 1; sample <= 6000; sample++) {
    const current = waveAt(6, sample / 6000);
    if (previous > 0 && current <= 0) crossings++;
    previous = current;
  }
  assert.equal(crossings, 6);
});

test('water waves propagate by distance/speed without changing source frequency', () => {
  const frequency = 6;
  const speed = 2.6;
  const distance = 0.71;
  for (const t of [0, 0.037, 0.41, 3.13]) {
    close(waveAt(frequency, t + distance / speed, distance, speed), waveAt(frequency, t));
    close(waveAt(frequency, t + 1 / frequency, distance, speed), waveAt(frequency, t, distance, speed));
  }
  // Two surface locations have different phases at the same audio time.
  close(waveAt(frequency, 0, speed / frequency / 2, speed), -1);
});

test('cached interference geometry equals the sum of its physical traveling waves', () => {
  const renderer = Object.create(CosmicVisualizer.prototype);
  renderer.mobile = false;
  const surface = renderer.makeWater(6, 2.6, 0.5);
  for (const p of [55, 1234, 3500, surface.xs.length - 100]) {
    for (const t of [0, 0.021, 0.25]) {
      const exact = surface.sources.reduce((sum, source) => {
        const d = Math.hypot(surface.xs[p] - source[0], surface.zs[p] - source[1]);
        const gain = Math.exp(-d * (0.9 - 0.5 * 0.55)) * source[3] / Math.sqrt(1 + d * 2);
        return sum + gain * waveAt(6, t, d, 2.6, source[2]);
      }, 0);
      const cached = surface.cos[p] * Math.cos(2 * Math.PI * 6 * t) + surface.sin[p] * Math.sin(2 * Math.PI * 6 * t);
      close(cached, exact, 2e-6);
    }
  }
});

test('spread changes damping while keeping each emitter and its phase intact', () => {
  const renderer = Object.create(CosmicVisualizer.prototype);
  renderer.mobile = true;
  const narrow = renderer.makeWater(6, 2.6, 0);
  const wide = renderer.makeWater(6, 2.6, 1);
  assert.equal(narrow.frequency, wide.frequency);
  assert.equal(narrow.speed, wide.speed);
  assert.equal(narrow.sources.length, 3);
  for (let i = 0; i < 3; i++) close(narrow.sources[i][2], wide.sources[i][2]);
  assert.notDeepEqual(narrow.cos, wide.cos);
});
