import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { CHANTS, CHANT_REFERENCE_PITCHES, getReferenceChantPitch, getChantPitchAt, getNaturalChantPitchAt, buildChantTables, buildNaturalChantTables } from '../dist/chant-engine.js';

const models = Object.fromEntries(await Promise.all(CHANTS.map(async chant => [
  chant, JSON.parse(await readFile(new URL(`../dist/chants/${chant}.json`, import.meta.url), 'utf8')),
])));

const rms = data => Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
const peak = data => data.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
const correlate = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0) / (a.length * rms(a) * rms(b));

test('all seven voice models contain measured, distinct spectral frames', () => {
  assert.deepEqual(CHANTS, ['MMM', 'VAM', 'III', 'EEE', 'OOO', 'UUU', 'AAA']);
  const signatures = new Set();
  for (const chant of CHANTS) {
    const model = models[chant];
    assert.equal(model.chant, chant);
    assert.equal(model.frames.length, chant === 'VAM' ? 64 : 16);
    if (chant !== 'VAM') assert.equal(model.framePeriodSeconds, 8);
    else {
      assert.equal(model.kind, 'articulated-phrase');
      assert.ok(model.phraseDurationSeconds > 15 && model.phraseDurationSeconds < 16);
      assert.equal(model.gapSeconds, .35);
      assert.ok(model.frames.every(frame => frame.level >= 0 && frame.level <= 1));
    }
    assert.ok(model.frames.every(frame => frame.f0 > 65 && frame.f0 < 450 && frame.amplitudes.length > 16));
    assert.ok(model.frames.every(frame => frame.amplitudes.every(value => Number.isFinite(value) && value >= 0)));
    signatures.add(JSON.stringify(model.frames));
  }
  assert.equal(signatures.size, 7);
});

test('natural voice retains source-pitch contours and normalized source-formant tables', () => {
  for (const chant of CHANTS) {
    const model = models[chant];
    assert.equal(getReferenceChantPitch(chant), CHANT_REFERENCE_PITCHES[chant]);
    assert.equal(getChantPitchAt(model, 0), model.frames[0].f0);
    assert.equal(getChantPitchAt(model, model.framePeriodSeconds), model.frames[0].f0);
    const tables = buildNaturalChantTables(model);
    assert.equal(tables.length, model.frames.length);
    for (const table of tables) {
      assert.ok(peak(table) <= .700001);
      assert.ok(rms(table) > .18 && rms(table) <= .300001);
    }
    if (chant === 'VAM') assert.equal(getChantPitchAt(model, model.phraseDurationSeconds + .1), model.frames.at(-1).f0);
  }
  assert.throws(() => getReferenceChantPitch('unknown'));
});

test('natural playback assets are actual normalized PCM recordings with source-pitch metadata and clean loops', async () => {
  for (const chant of CHANTS) {
    const model = models[chant];
    const bytes = await readFile(new URL(`../dist/chants/${model.natural.asset}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt16LE(20), 1);
    assert.equal(bytes.readUInt16LE(22), 1);
    assert.equal(bytes.readUInt32LE(24), 48000);
    assert.equal(bytes.readUInt16LE(34), 16);
    assert.equal(bytes.toString('ascii', 36, 40), 'data');
    const samples = Float32Array.from({ length: (bytes.length - 44) / 2 }, (_, index) => bytes.readInt16LE(44 + index * 2) / 32768);
    assert.ok(rms(samples) > (chant === 'VAM' ? .20 : .24) && rms(samples) < .282);
    assert.ok(peak(samples) <= .7001);
    assert.ok(Math.abs(samples.reduce((sum, value) => sum + value, 0) / samples.length) < 1e-5);
    assert.ok(Math.abs(samples.length / 48000 - model.natural.framePeriodSeconds) < 1e-9);
    assert.ok(Math.abs(samples[0] - samples.at(-1)) < .04);
    assert.equal(getNaturalChantPitchAt(model, 0), model.natural.frames[0].f0);
    assert.equal(getNaturalChantPitchAt(model, model.natural.framePeriodSeconds), model.natural.frames[0].f0);
    if (chant === 'VAM') {
      assert.equal(samples[0], 0);
      assert.ok(samples.slice(-16800).every(value => value === 0));
    } else assert.equal(model.natural.loopCrossfadeSeconds, .08);
  }
});

test('voice tables have comparable loudness, no DC, peak headroom and distinct timbres over the requested range', () => {
  for (const frequency of [100, 525, 1500]) {
    const tables = CHANTS.map(chant => buildChantTables(models[chant], frequency));
    for (const frames of tables) for (const table of frames) {
      assert.ok(peak(table) <= 0.700001);
      assert.ok(rms(table) > 0.18 && rms(table) <= 0.300001);
      assert.ok(Math.abs(table.reduce((sum, value) => sum + value, 0) / table.length) < 1e-7);
      assert.ok(Math.abs(table[0]) < 1e-7);
    }
    // At the default region no two recordings collapse into the same sine.
    if (frequency === 525) {
      for (let a = 0; a < tables.length; a++) for (let b = a + 1; b < tables.length; b++) {
        assert.ok(correlate(tables[a][0], tables[b][0]) < 0.9999, `${CHANTS[a]} and ${CHANTS[b]} must remain distinct`);
      }
    }
  }
});

test('production worklet derives frequency from seconds and morphs continuously across its loop boundary', async () => {
  let Processor;
  const sandbox = {
    AudioWorkletProcessor: class { constructor() { this.port = {}; } },
    registerProcessor: (_name, processor) => { Processor = processor; },
    currentFrame: 0, sampleRate: 48000,
  };
  vm.runInNewContext(await readFile(new URL('../dist/chant-worklet.js', import.meta.url), 'utf8'), sandbox);
  // A known sine table isolates the sample clock from vocal envelope changes.
  const sine = Float32Array.from({ length: 2048 }, (_, index) => 0.3 * Math.sin(2 * Math.PI * index / 2048));
  const frames = Array.from({ length: 16 }, () => sine);
  const processor = new Processor({ processorOptions: { frequencies: [525, 531], tables: [frames, frames], startTime: 0.025, framePeriodSeconds: 8 } });
  sandbox.currentFrame = 1200;
  const outputs = [[new Float32Array(48000)], [new Float32Array(48000)]];
  assert.equal(processor.process([], outputs), true);
  for (const [channel, frequency] of [525, 531].entries()) {
    let error = 0;
    for (let sample = 0; sample < 48000; sample++) {
      error = Math.max(error, Math.abs(outputs[channel][0][sample] - 0.3 * Math.sin(2 * Math.PI * frequency * sample / 48000)));
    }
    assert.ok(error < 1e-6);
  }
  for (const chant of CHANTS) {
    const tables = buildChantTables(models[chant], 525);
    const voice = new Processor({ processorOptions: { frequencies: [525, 525], tables: [tables, tables], startTime: 0, framePeriodSeconds: 8 } });
    sandbox.currentFrame = 8 * 48000 - 128;
    const boundary = [[new Float32Array(256)], [new Float32Array(256)]];
    voice.process([], boundary);
    const signal = boundary[0][0];
    // Loop transition is an ordinary neighbouring sample, with no envelope jump.
    const enteringStep = signal[128] - signal[127];
    const leavingStep = signal[129] - signal[128];
    assert.ok(Math.abs(signal[128]) < 1e-6);
    assert.ok(Math.abs(enteringStep - leavingStep) < 0.001);
  }
  const model = models.VAM;
  const tables = buildChantTables(model, 525);
  assert.ok(correlate(tables[8], tables[40]) < 0.99, 'VAM must evolve from open A into M');
  const phrase = new Processor({ processorOptions: {
    frequencies: [525, 531], tables: [tables, tables], startTime: 0,
    framePeriodSeconds: model.framePeriodSeconds, phraseDurationSeconds: model.phraseDurationSeconds,
    attackSeconds: model.attackSeconds, releaseSeconds: model.releaseSeconds,
    levels: model.frames.map(frame => frame.level), noise: model.frames.map(frame => frame.noise),
  } });
  sandbox.currentFrame = Math.round((model.phraseDurationSeconds + 0.1) * 48000);
  const gap = [[new Float32Array(128)], [new Float32Array(128)]];
  phrase.process([], gap);
  assert.ok(gap.every(channel => channel[0].every(value => value === 0)));
  sandbox.currentFrame = 0;
  const onset = [[new Float32Array(128)], [new Float32Array(128)]];
  phrase.process([], onset);
  assert.equal(onset[0][0][0], 0);

  const natural = new Processor({ processorOptions: {
    frequencies: [528, 534], tables: [[sine, sine], [sine, sine]], startTime: 0,
    framePeriodSeconds: 2, naturalPitch: true, pitches: [80, 120],
  } });
  const naturalSignal = new Float32Array(48000);
  for (let frame = 0; frame < 48000; frame += 128) {
    sandbox.currentFrame = frame;
    const output = [[new Float32Array(128)], [new Float32Array(128)]];
    natural.process([], output);
    assert.deepEqual(output[0][0], output[1][0]);
    naturalSignal.set(output[0][0].slice(0, Math.min(128, 48000 - frame)), frame);
  }
  // Integral of f(t)=80+40*t: phase(t)=80*t+20*t², independently of 528 Hz input.
  assert.ok(Math.abs(naturalSignal[12000] - .3) < .001);
  assert.ok(Math.abs(naturalSignal[24000]) < .001);
  assert.ok(Math.abs(naturalSignal[36000] - .3) < .001);
});
