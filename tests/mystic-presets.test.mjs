import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAKRA_PRESETS, SOLFEGGIO_PRESETS, MUSICAL_TUNINGS, getMusicalPresets } from '../dist/mystic-presets.js';
import { octaveColorForFrequency } from '../dist/octave-color.js';

test('seven chakra presets keep the symbolic palette separate from octave colors', () => {
  assert.equal(CHAKRA_PRESETS.length, 7);
  assert.equal(new Set(CHAKRA_PRESETS.map(preset => preset.id)).size, 7);
  assert.equal(CHAKRA_PRESETS[0].label, 'Muladhara');
  assert.equal(CHAKRA_PRESETS[6].label, 'Sahasrara');
  assert.ok(CHAKRA_PRESETS.every(preset => preset.audioMode === 'binaural' && preset.target > 0 && preset.target <= 40));
  assert.ok(CHAKRA_PRESETS.some(preset => preset.color !== octaveColorForFrequency(preset.carrier).hex));
});

test('the six contemporary Solfeggio presets request exact unmodulated tones', () => {
  assert.deepEqual(SOLFEGGIO_PRESETS.map(preset => preset.carrier), [396, 417, 528, 639, 741, 852]);
  assert.deepEqual(SOLFEGGIO_PRESETS.map(preset => preset.label), ['UT', 'RE', 'MI', 'FA', 'SOL', 'LA']);
  for (const preset of SOLFEGGIO_PRESETS) {
    assert.equal(preset.audioMode, 'tone');
    assert.equal(preset.color, octaveColorForFrequency(preset.carrier).hex);
  }
});

test('just intonation retains fractional frequencies and distinguishes C256 from A432', () => {
  const c256 = getMusicalPresets();
  const a432 = getMusicalPresets('a432');
  const ratios = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  assert.deepEqual(c256.map(preset => preset.label), ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  for (let index = 0; index < ratios.length; index++) {
    assert.ok(Math.abs(c256[index].carrier / 256 - ratios[index]) < 1e-12);
    assert.ok(Math.abs(a432[index].carrier / MUSICAL_TUNINGS.a432.root - ratios[index]) < 1e-12);
    assert.equal(c256[index].audioMode, 'tone');
    assert.equal(c256[index].id, a432[index].id);
    assert.equal(c256[index].color, octaveColorForFrequency(c256[index].carrier).hex);
  }
  assert.equal(c256[0].carrier, 256);
  assert.equal(c256[3].carrier, 1024 / 3);
  assert.ok(Math.abs(c256[5].carrier - 426.6666666666667) < 1e-10);
  assert.ok(Math.abs(a432[0].carrier - 259.2) < 1e-10);
  assert.equal(a432[5].carrier, 432);
  assert.notEqual(c256[5].carrier, 432);
  assert.throws(() => getMusicalPresets('unknown'), RangeError);
  assert.throws(() => getMusicalPresets('toString'), RangeError);
});
