export const CHANTS = Object.freeze(['MMM', 'VAM', 'III', 'EEE', 'OOO', 'UUU', 'AAA']);
export const CHANT_REFERENCE_PITCHES = Object.freeze({
  MMM: 89.2428, VAM: 87.9065, III: 166.6663, EEE: 150.1,
  OOO: 112.3349, UUU: 119.0884, AAA: 119.669,
});

export function getReferenceChantPitch(chant) {
  if (!CHANTS.includes(chant)) throw new TypeError('Unknown chant recording.');
  return CHANT_REFERENCE_PITCHES[chant];
}

export function getChantPitchAt(model, elapsed) {
  const period = model.framePeriodSeconds || 8;
  const time = Math.max(0, elapsed) % period;
  const position = model.phraseDurationSeconds
    ? Math.min(model.frames.length - 1, time / model.phraseDurationSeconds * (model.frames.length - 1))
    : time / period * model.frames.length;
  const first = Math.floor(position);
  const next = model.phraseDurationSeconds ? Math.min(first + 1, model.frames.length - 1) : (first + 1) % model.frames.length;
  return model.frames[first].f0 * (1 - (position - first)) + model.frames[next].f0 * (position - first);
}

export function getNaturalChantPitchAt(model, elapsed) {
  return getChantPitchAt(model.natural || model, elapsed);
}

export async function loadNaturalChantBuffer(context, model) {
  if (!model.natural?.asset) throw new Error('The natural voice recording is unavailable.');
  const response = await fetch(new URL(`./chants/${model.natural.asset}`, import.meta.url));
  if (!response.ok) throw new Error('The natural voice recording could not load.');
  return context.decodeAudioData(await response.arrayBuffer());
}
const models = new Map();

export async function loadChantModel(chant) {
  if (!CHANTS.includes(chant)) throw new TypeError('Unknown chant recording.');
  if (!models.has(chant)) {
    const loading = fetch(new URL(`./chants/${chant}.json`, import.meta.url))
      .then(response => {
        if (!response.ok) throw new Error(`The ${chant} voice model could not load.`);
        return response.json();
      })
      .then(model => {
        if (model.version !== 1 || model.chant !== chant || !Array.isArray(model.frames) || !model.frames.length) {
          throw new Error('The voice model is invalid.');
        }
        return model;
      });
    models.set(chant, loading);
    loading.catch(() => models.delete(chant));
  }
  return models.get(chant);
}

function envelopeAt(frame, frequency) {
  const position = frequency / frame.f0 - 1;
  const amplitudes = frame.amplitudes;
  if (position <= 0) return amplitudes[0];
  if (position >= amplitudes.length - 1) return 0;
  const index = Math.floor(position);
  const mix = position - index;
  // Log interpolation keeps weak measured resonances from disappearing.
  return Math.exp(Math.log(Math.max(1e-6, amplitudes[index])) * (1 - mix)
    + Math.log(Math.max(1e-6, amplitudes[index + 1])) * mix);
}

/** Measured vocal envelopes; exact output pitch is independent of source F0. */
export function buildChantTables(model, frequency, sampleRate = 48000, tableSize = 2048) {
  if (!Number.isFinite(frequency) || frequency <= 0 || frequency >= sampleRate / 2) {
    throw new RangeError('The chant fundamental must be positive and below Nyquist.');
  }
  const count = Math.min(64, Math.floor(Math.min(8000, sampleRate * 0.45) / frequency));
  return model.frames.map(frame => {
    const table = new Float32Array(tableSize);
    for (let harmonic = 1; harmonic <= Math.max(1, count); harmonic++) {
      const formant = envelopeAt(frame, frequency * harmonic);
      const profile = frame.amplitudes[harmonic - 1] || 0;
      // Absolute-Hz formants and the recorded harmonic profile both contribute.
      // A small fundamental floor avoids an accidental perceived octave jump.
      let amplitude = 0.72 * formant + 0.28 * profile;
      if (harmonic === 1) amplitude = Math.max(0.35, amplitude);
      for (let sample = 0; sample < tableSize; sample++) {
        table[sample] += amplitude * Math.sin(2 * Math.PI * harmonic * sample / tableSize);
      }
    }
    let peak = 0;
    let energy = 0;
    for (const sample of table) {
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    // Comparable sustained loudness, with headroom for complex vowel peaks.
    const rms = Math.sqrt(energy / tableSize);
    const scale = Math.min(0.30 / Math.max(rms, 1e-6), 0.7 / Math.max(peak, 1e-6));
    for (let sample = 0; sample < tableSize; sample++) table[sample] *= scale;
    return table;
  });
}

export function buildNaturalChantTables(model, sampleRate = 48000, tableSize = 2048) {
  // At its own measured F0, each harmonic samples the recording's own formant
  // envelope. No pitch transposition to the unrelated base carrier occurs.
  return model.frames.map(frame => buildChantTables({ frames: [frame] }, frame.f0, sampleRate, tableSize)[0]);
}

export function createChantNode(context, model, left, right, startTime, preparedTables, naturalPitch = false) {
  return new AudioWorkletNode(context, 'vibrasound-chant', {
    numberOfInputs: 0,
    numberOfOutputs: 2,
    outputChannelCount: [1, 1],
    processorOptions: {
      frequencies: [left, right],
      naturalPitch,
      pitches: model.frames.map(frame => frame.f0),
      tables: preparedTables || [buildChantTables(model, left, context.sampleRate), buildChantTables(model, right, context.sampleRate)],
      startTime,
      framePeriodSeconds: model.framePeriodSeconds || 8,
      phraseDurationSeconds: model.phraseDurationSeconds || 0,
      attackSeconds: model.attackSeconds || 0.12,
      releaseSeconds: model.releaseSeconds || 0.25,
      levels: model.frames.map(frame => frame.level ?? 1),
      noise: model.frames.map(frame => frame.noise || 0),
    },
  });
}
