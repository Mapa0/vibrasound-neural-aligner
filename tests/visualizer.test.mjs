import test from 'node:test';
import assert from 'node:assert/strict';
import { CosmicVisualizer, channelSignalFeatures, meteorEventIndex, meteorBirthTime, opacityAt, strobeOpacityAt, updateWaveLevel, waveAt, writeWaveform } from '../dist/visualizer.js';

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
  const surface = renderer.makeWater(6, 2.6, 0.5, {leftRatio:525 / 528, rightRatio:531 / 528});
  for (const p of [55, 1234, 3500, surface.xs.length - 100]) {
    for (const t of [0, 0.021, 0.25]) {
      const exact = surface.sources.reduce((sum, source) => {
        const d = Math.hypot(surface.xs[p] - source[0], surface.zs[p] - source[1]);
        const gain = Math.exp(-d * (0.9 - 0.5 * 0.55)) * source[3] / Math.sqrt(1 + d * 2);
        return sum + gain * waveAt(6, t, d * source[4], 2.6, source[2]);
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
  assert.equal(narrow.sources.length, 2);
  for (let i = 0; i < 2; i++) close(narrow.sources[i][2], wide.sources[i][2]);
  assert.notDeepEqual(narrow.cos, wide.cos);
});

test('liquid has separate left/right source bases with carrier-scaled wavelength and adjustable spacing', () => {
  const renderer = Object.create(CosmicVisualizer.prototype);
  renderer.mobile = false;
  const leftRatio = 525 / 528, rightRatio = 531 / 528;
  const narrow = renderer.makeWater(6, 2.6, 0.5, {leftRatio,rightRatio,separation:0});
  const wide = renderer.makeWater(6, 2.6, 0.5, {leftRatio,rightRatio,separation:1});
  assert.equal(wide.sources.length, 2);
  assert.ok(wide.sources[0][0] < narrow.sources[0][0]);
  assert.ok(wide.sources[1][0] > narrow.sources[1][0]);
  close(wide.sources[0][4], leftRatio);
  close(wide.sources[1][4], rightRatio);
  assert.ok(2.6 / (6 * rightRatio) < 2.6 / (6 * leftRatio));
  for (const p of [0, 400, 1234]) {
    close(wide.leftCos[p] + wide.rightCos[p], wide.cos[p], 1e-7);
    close(wide.leftSin[p] + wide.rightSin[p], wide.sin[p], 1e-7);
  }
});

test('liquid channel energy preserves real amplitude, silence, and harmonic texture', () => {
  const sampleRate = 48000, frequency = 500;
  const sine = Float32Array.from({length:4800}, (_, i) => Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.04);
  const quiet = sine.map(value => value * 0.5);
  const textured = sine.map((value, i) => value + Math.sin(4 * Math.PI * frequency * i / sampleRate) * 0.015);
  const features = channelSignalFeatures(sine, sampleRate, frequency);
  const quietFeatures = channelSignalFeatures(quiet, sampleRate, frequency);
  const texturedFeatures = channelSignalFeatures(textured, sampleRate, frequency);
  close(features.rms, Math.SQRT1_2 * 0.04, 1e-8);
  close(quietFeatures.rms, features.rms * 0.5, 1e-8);
  assert.ok(texturedFeatures.texture > features.texture);
  const silent = channelSignalFeatures(new Float32Array(2048), sampleRate, frequency);
  assert.equal(silent.rms, 0);
  assert.equal(silent.texture, 0);
});

test('continuous liquid mode averages 6 Hz AM while opt-in retains a more responsive envelope', () => {
  const off = {value:1,elapsed:0}, on = {value:1,elapsed:0};
  let offCos=0,offSin=0,onCos=0,onSin=0,count=0;
  for (let frame=1;frame<=1200;frame++) {
    const t=frame/120;
    const phase=2*Math.PI*6*t;
    const level=1+0.8*Math.cos(phase);
    const averaged=updateWaveLevel(off,level,t,0.75);
    const responsive=updateWaveLevel(on,level,t,0.05);
    if(t>5) {
      offCos+=(averaged-1)*Math.cos(phase);offSin+=(averaged-1)*Math.sin(phase);
      onCos+=(responsive-1)*Math.cos(phase);onSin+=(responsive-1)*Math.sin(phase);
      count++;
    }
  }
  const offAmplitude=2*Math.hypot(offCos,offSin)/count;
  const onAmplitude=2*Math.hypot(onCos,onSin)/count;
  assert.ok(offAmplitude/0.8<0.04);
  assert.ok(onAmplitude/0.8>0.45);
});

test('liquid filtering freezes with audio time, resets for a new session, and hard-mutes real silence', () => {
  const state={value:0,elapsed:null};
  close(updateWaveLevel(state,1,2),1);
  const held=updateWaveLevel(state,0.5,2.1);
  close(updateWaveLevel(state,4,2.1),held);
  close(updateWaveLevel(state,0.25,0.01),0.25);
  close(updateWaveLevel(state,0,0.02),0);
  const texture={value:1,elapsed:0};
  assert.ok(updateWaveLevel(texture,0,0.1,0.75,false)>0);
});

test('shooting stars create exactly target events per audio second', () => {
  for (const frequency of [0.5, 2, 6, 10, 40]) {
    close(meteorEventIndex(frequency, 10), frequency * 10);
    assert.equal(meteorEventIndex(frequency, 0), 0);
    for (const event of [1, 6, 60]) close(meteorBirthTime(frequency, event), event / frequency);
  }
  assert.equal(meteorEventIndex(6, 0.999), 5);
  assert.equal(meteorEventIndex(6, 1), 6);
  assert.equal(meteorEventIndex(6, 1.001), 6);
});

test('missed animation frames, pauses, and reopening never change event timing', () => {
  const frequency = 6;
  const audioTime = 3.75;
  const pausedIndex = meteorEventIndex(frequency, audioTime);
  const pausedAge = audioTime - meteorBirthTime(frequency, pausedIndex);
  // Re-rendering at the same paused audio time leaves every meteor unchanged.
  for (let frame = 0; frame < 100; frame++) {
    assert.equal(meteorEventIndex(frequency, audioTime), pausedIndex);
    close(audioTime - meteorBirthTime(frequency, pausedIndex), pausedAge);
  }
  // A backgrounded renderer can reconstruct the current window directly.
  const reopenedTime = 103.75;
  assert.equal(meteorEventIndex(frequency, reopenedTime), 622);
  const latest = meteorEventIndex(frequency, reopenedTime);
  assert.ok(reopenedTime - meteorBirthTime(frequency, latest) < 1 / frequency);
});

test('100% full-screen strobe reaches 100% opacity and preserves exact target period', () => {
  close(strobeOpacityAt(6, 0, 1), 1);
  close(strobeOpacityAt(6, 1 / 12, 1), 0);
  close(strobeOpacityAt(6, 1 / 6, 1), 1);
  close(strobeOpacityAt(6, 0, 0.25), 0.25);
  close(strobeOpacityAt(6, 1 / 24, 1), 0.5);
});

test('sampled stereo ribbons retain each real channel frequency in a shared time window', () => {
  const sampleRate = 48000;
  const duration = 0.016;
  for (const frequency of [525, 531]) {
    const pcm = Float32Array.from({length:2048}, (_, i) => Math.sin(2 * Math.PI * frequency * i / sampleRate + 0.73) * 0.04);
    const output = new Float32Array(640);
    const trigger = writeWaveform(pcm, sampleRate, frequency, output, duration);
    assert.ok(trigger > 0);
    close(output[0], 0, 1e-7);
    const crossings = [];
    for (let i = 1; i < output.length; i++) {
      if (output[i - 1] < 0 && output[i] >= 0) crossings.push(i - 1 - output[i - 1] / (output[i] - output[i - 1]));
    }
    const period = (crossings.at(-1) - crossings[0]) / (crossings.length - 1) / (output.length - 1) * duration;
    close(1 / period, frequency, 0.1);
    assert.ok(Math.max(...output) <= 0.040001);
  }
});

test('waveform display preserves output gain and real silence without peak normalization', () => {
  const sampleRate = 48000;
  const loud = Float32Array.from({length:2048}, (_, i) => Math.sin(2 * Math.PI * 528 * i / sampleRate + 0.2) * 0.08);
  const quiet = loud.map(value => value * 0.25);
  const loudDisplay = new Float32Array(640);
  const quietDisplay = new Float32Array(640);
  writeWaveform(loud, sampleRate, 528, loudDisplay);
  writeWaveform(quiet, sampleRate, 528, quietDisplay);
  for (let i = 0; i < loudDisplay.length; i++) close(quietDisplay[i], loudDisplay[i] * 0.25, 1e-8);
  writeWaveform(new Float32Array(2048), sampleRate, 528, loudDisplay);
  assert.ok(loudDisplay.every(value => value === 0));
});
