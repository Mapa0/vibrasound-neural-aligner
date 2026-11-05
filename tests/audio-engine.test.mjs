import test from 'node:test';
import assert from 'node:assert/strict';
import { NeuroAudioEngine, getFrequencies, validateConfig, pulseAt } from '../dist/audio-engine.js';

class Parameter {
  constructor() { this.value = 1; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
  setTargetAtTime(value, time, constant) { this.value = value; this.events.push(['target', value, time, constant]); }
  cancelAndHoldAtTime(time) { this.events.push(['hold', time]); }
}

class Node {
  constructor(kind) { this.kind = kind; this.connections = []; this.gain = new Parameter(); }
  connect(destination, output, input) { this.connections.push({ destination, output, input }); return destination; }
  disconnect() { this.disconnected = true; }
}

class Oscillator extends Node {
  constructor() { super('oscillator'); this.frequency = new Parameter(); }
  start(time) { this.startTime = time; }
  stop() { this.stopped = true; }
  setPeriodicWave(wave) { this.wave = wave; }
}

class AudioContextMock {
  constructor() {
    this.currentTime = 10;
    this.sampleRate = 48000;
    this.state = 'suspended';
    this.destination = new Node('destination');
    this.nodes = [];
    AudioContextMock.latest = this;
  }
  createOscillator() { const n = new Oscillator(); this.nodes.push(n); return n; }
  createGain() { const n = new Node('gain'); this.nodes.push(n); return n; }
  createChannelMerger(channels) { const n = new Node('merger'); n.channels = channels; this.nodes.push(n); return n; }
  createPeriodicWave(real, imaginary, options) { return { real, imaginary, options }; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}

test('default stereo frequencies differ by exactly 6 Hz around 528 Hz', () => {
  assert.deepEqual(getFrequencies(), { left: 525, right: 531, carrier: 528, target: 6 });
  assert.deepEqual(getFrequencies({ audioMode: 'isochronic' }), { left: 528, right: 528, carrier: 528, target: 6 });
  const fractional = getFrequencies({ carrier: 432, target: 4.5 });
  assert.equal(fractional.right - fractional.left, 4.5);
});

test('phase is measured in seconds and makes exactly six cycles per second', () => {
  assert.equal(pulseAt(6, 0), 1);
  assert.ok(Math.abs(pulseAt(6, 1 / 24)) < 1e-12);
  assert.equal(pulseAt(6, 1 / 12), -1);
  assert.equal(pulseAt(6, 1 / 6), 1);
  for (let cycle = 0; cycle <= 6; cycle++) {
    assert.ok(Math.abs(pulseAt(6, cycle / 6) - 1) < 1e-12);
  }
  // The prescribed visual range remains 20–80%, the audio gain 0–100%.
  assert.ok(Math.abs((0.5 + 0.3 * pulseAt(6, 1 / 12)) - 0.2) < 1e-12);
  assert.equal(0.5 + 0.5 * pulseAt(6, 1 / 12), 0);
});

test('invalid and nonfinite audio settings cannot reach the audio graph', () => {
  for (const config of [
    { target: 0 }, { target: NaN }, { carrier: Infinity },
    { carrier: 20, target: 6 }, { volume: -0.1 }, { volume: 1.1 },
    { audioMode: 'unknown' }, { ambience: '0' }, { binauralModulation: 1 }, null,
  ]) assert.throws(() => validateConfig(config));
  assert.throws(() => pulseAt(6, -1));
  assert.throws(() => pulseAt(6, 1000 / 0));
});

test('binaural engine routes isolated sine oscillators to the two stereo inputs', async () => {
  const engine = new NeuroAudioEngine({ AudioContext: AudioContextMock });
  await engine.start();
  const context = AudioContextMock.latest;
  const oscillators = context.nodes.filter(n => n.kind === 'oscillator');
  assert.equal(oscillators.length, 2);
  assert.deepEqual(oscillators.map(n => n.frequency.value), [525, 531]);
  assert.deepEqual(oscillators.map(n => n.connections[0].input), [0, 1]);
  assert.ok(oscillators.every(n => n.type === 'sine' && n.startTime === 10.025));
  assert.ok(oscillators.every(n => n.frequency.events[0][2] === 10));
  assert.ok(oscillators.every(n => n.connections.length === 1));
  context.currentTime = 11.025;
  assert.ok(Math.abs(engine.elapsed - 1) < 1e-12);
  await engine.pause();
  assert.equal(engine.state, 'paused');
  const frozen = engine.elapsed;
  assert.equal(engine.elapsed, frozen);
  await engine.resume();
  assert.equal(engine.state, 'running');
  context.currentTime += 1;
  assert.ok(Math.abs(engine.elapsed - 2) < 1e-12);
  engine.setVolume(0.5);
  assert.ok(context.nodes.some(n => n.gain.events.some(e => e[0] === 'target' && e[1] === 0.08)));
  await engine.stop();
  assert.equal(context.state, 'closed');
  assert.equal(engine.state, 'stopped');
  assert.ok(context.nodes.every(n => n.disconnected));
  assert.ok(oscillators.every(n => n.stopped));
});

test('isochronic engine uses a sample-accurate cosine LFO with 0.5 bias and depth', async () => {
  const engine = new NeuroAudioEngine({ AudioContext: AudioContextMock });
  await engine.start({ audioMode: 'isochronic' });
  const context = AudioContextMock.latest;
  const oscillators = context.nodes.filter(n => n.kind === 'oscillator');
  const carrier = oscillators.find(n => n.frequency.value === 528);
  const lfo = oscillators.find(n => n.frequency.value === 6);
  assert.deepEqual([...lfo.wave.real], [0, 1]);
  assert.deepEqual([...lfo.wave.imaginary], [0, 0]);
  assert.equal(lfo.wave.options.disableNormalization, true);
  assert.equal(lfo.startTime, carrier.startTime);
  const depth = lfo.connections[0].destination;
  const merger = carrier.connections[0].destination;
  const pulseGain = merger.connections[0].destination;
  assert.equal(depth.gain.value, 0.5);
  assert.equal(pulseGain.gain.value, 0.5);
  assert.equal(depth.connections[0].destination, pulseGain.gain);
  assert.deepEqual(carrier.connections.map(n => n.input), [0, 1]);
  assert.equal(pulseGain.channelCount, 2);
  assert.equal(pulseGain.channelCountMode, 'explicit');
  assert.equal(pulseGain.channelInterpretation, 'discrete');
  await engine.pause();
  await engine.stop();
  await engine.start({ carrier: 432, target: 8 });
  assert.equal(engine.frequencies.left, 428);
  assert.equal(engine.frequencies.right, 436);
  assert.equal(engine.elapsed, 0);
  await engine.pause();
  await engine.stop();
});

test('optional binaural modulation shares a phase-aligned envelope without mixing stereo carriers', async () => {
  const engine = new NeuroAudioEngine({ AudioContext: AudioContextMock });
  await engine.start({ binauralModulation: true });
  const context = AudioContextMock.latest;
  const oscillators = context.nodes.filter(n => n.kind === 'oscillator');
  const left = oscillators.find(n => n.frequency.value === 525);
  const right = oscillators.find(n => n.frequency.value === 531);
  const lfo = oscillators.find(n => n.frequency.value === 6);
  assert.equal(oscillators.length, 3);
  assert.equal(left.connections[0].input, 0);
  assert.equal(right.connections[0].input, 1);
  assert.equal(left.connections[0].destination, right.connections[0].destination);
  const pulse = left.connections[0].destination.connections[0].destination;
  const depth = lfo.connections[0].destination;
  assert.equal(depth.connections[0].destination, pulse.gain);
  assert.equal(depth.gain.value, 0.5);
  assert.equal(pulse.gain.value, 0.5);
  assert.equal(pulse.channelInterpretation, 'discrete');
  assert.equal(pulse.channelCount, 2);
  assert.equal(left.startTime, lfo.startTime);
  assert.equal(right.startTime, lfo.startTime);
  assert.ok(oscillators.every(n => n.frequency.events[0][2] === 10));
  assert.deepEqual([...lfo.wave.real], [0, 1]);
  await engine.pause();
  await engine.stop();
});

test('audio initialization errors propagate and leave a restartable engine', async () => {
  class BlockedContext extends AudioContextMock {
    async resume() { throw new Error('blocked'); }
  }
  const engine = new NeuroAudioEngine({ AudioContext: BlockedContext });
  await assert.rejects(engine.start(), /blocked/);
  assert.equal(engine.state, 'stopped');
  assert.equal(AudioContextMock.latest.state, 'closed');
  engine._AudioContext = AudioContextMock;
  await engine.start();
  assert.equal(engine.state, 'running');
  await engine.pause();
  await engine.stop();
});
