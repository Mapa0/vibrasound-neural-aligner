import test from 'node:test';
import assert from 'node:assert/strict';
import { octaveColorForFrequency, wavelengthToRgb } from '../dist/octave-color.js';

test('528 Hz maps to green light at 516.4 nm after forty octaves', () => {
  const color = octaveColorForFrequency(528);
  assert.equal(color.octaves, 40);
  assert.equal(color.lightHz, 528 * 2 ** 40);
  assert.ok(Math.abs(color.wavelength - 516.400874) < .001);
  assert.ok(color.rgb[1] > color.rgb[0] && color.rgb[1] > color.rgb[2]);
});

test('432 Hz maps to red while octave-equivalent tones share a color', () => {
  const color = octaveColorForFrequency(432);
  assert.ok(Math.abs(color.wavelength - 631.156624) < .001);
  assert.ok(color.rgb[0] > color.rgb[1] && color.rgb[0] > color.rgb[2]);
  for (const frequency of [100, 396, 432, 440, 528, 639, 741, 852, 963, 1500]) {
    const base = octaveColorForFrequency(frequency);
    const higher = octaveColorForFrequency(frequency * 2);
    assert.ok(Math.abs(base.wavelength - higher.wavelength) < 1e-8);
    assert.equal(base.hex, higher.hex);
    assert.equal(base.octaves, higher.octaves + 1);
  }
});

test('all supported tones fold into one visible octave with finite RGB values', () => {
  for (let frequency = 100; frequency <= 1500; frequency += .7) {
    const color = octaveColorForFrequency(frequency);
    assert.ok(color.wavelength >= 380 && color.wavelength <= 760);
    assert.match(color.hex, /^#[a-f0-9]{6}$/);
    assert.ok(color.rgb.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255));
  }
  for (const frequency of [0, -1, NaN, Infinity]) assert.throws(() => octaveColorForFrequency(frequency));
  assert.throws(() => wavelengthToRgb(1000));
});
