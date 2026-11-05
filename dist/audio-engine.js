/**
 * All frequencies are Hz; all clock values and scheduling offsets are seconds.
 * The audio context is also the renderer's clock through `engine.elapsed`.
 */
const TWO_PI = Math.PI * 2;
const OUTPUT_GAIN = 0.16;
const FADE_SECONDS = 1;
const SCHEDULE_LEAD_SECONDS = 0.025;

const DEFAULTS = Object.freeze({
  carrier: 528,
  target: 6,
  audioMode: 'binaural',
  binauralModulation: false,
  volume: 0.25,
  ambience: 0,
});

function range(value, name, minimum, maximum, minimumInclusive = true) {
  if (typeof value !== 'number' || !Number.isFinite(value)
    || (minimumInclusive ? value < minimum : value <= minimum) || value > maximum) {
    throw new RangeError(`${name} must be a finite number ${minimumInclusive ? 'from' : 'greater than'} ${minimum} to ${maximum}.`);
  }
  return value;
}

export function validateConfig(config = {}) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('Audio configuration must be an object.');
  }
  const result = { ...DEFAULTS, ...config };
  range(result.carrier, 'carrier', 20, 20000);
  range(result.target, 'target', 0, 100, false);
  range(result.volume, 'volume', 0, 1);
  range(result.ambience, 'ambience', 0, 1);
  if (!['binaural', 'isochronic'].includes(result.audioMode)) {
    throw new TypeError('audioMode must be binaural or isochronic.');
  }
  if (typeof result.binauralModulation !== 'boolean') {
    throw new TypeError('binauralModulation must be a boolean.');
  }
  if (result.audioMode === 'binaural'
    && (result.carrier - result.target / 2 < 20 || result.carrier + result.target / 2 > 20000)) {
    throw new RangeError('Both binaural carriers must be between 20 and 20000 Hz.');
  }
  return Object.freeze(result);
}

export function getFrequencies(config = {}) {
  const { carrier, target, audioMode } = validateConfig(config);
  return Object.freeze({
    left: audioMode === 'binaural' ? carrier - target / 2 : carrier,
    right: audioMode === 'binaural' ? carrier + target / 2 : carrier,
    carrier,
    target,
  });
}

/** Cosine phase shared with the isochronic gain and the visual renderer. */
export function pulseAt(target, elapsed) {
  range(target, 'target', 0, 100, false);
  if (typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < 0) {
    throw new RangeError('elapsed must be a finite, nonnegative number of seconds.');
  }
  return Math.cos(TWO_PI * target * elapsed);
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function holdParameter(parameter, time) {
  if (typeof parameter.cancelAndHoldAtTime === 'function') {
    parameter.cancelAndHoldAtTime(time);
  } else {
    const value = parameter.value;
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(value, time);
  }
}

export class NeuroAudioEngine {
  /** An AudioContext constructor can be injected for deterministic tests. */
  constructor({ AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
    this._AudioContext = AudioContext;
    this._context = null;
    this._nodes = [];
    this._oscillators = [];
    this._config = validateConfig();
    this._state = 'idle';
    this._referenceTime = 0;
    this._storedElapsed = 0;
    this._volume = null;
    this._envelope = null;
    this._operation = Promise.resolve();
  }

  get state() {
    if (this._state === 'running' && this._context?.state !== 'running') {
      return this._context?.state === 'closed' ? 'stopped' : 'paused';
    }
    return this._state;
  }

  get elapsed() {
    if (!this._context || this._context.state === 'closed') return this._storedElapsed;
    return Math.max(0, this._context.currentTime - this._referenceTime);
  }

  get frequencies() {
    return getFrequencies(this._config);
  }

  _enqueue(operation) {
    const result = this._operation.then(operation);
    // Keep later operations usable after a rejection; return the original error.
    this._operation = result.catch(() => {});
    return result;
  }

  _track(node) {
    this._nodes.push(node);
    return node;
  }

  _oscillator(frequency) {
    const oscillator = this._track(this._context.createOscillator());
    oscillator.type = 'sine';
    // Set before the future start, so a partial first render block never uses
    // OscillatorNode's default 440 Hz and shifts the intended starting phase.
    oscillator.frequency.setValueAtTime(frequency, this._context.currentTime);
    this._oscillators.push(oscillator);
    return oscillator;
  }

  _pulseGain(target) {
    const context = this._context;
    const pulse = this._track(context.createGain());
    const depth = this._track(context.createGain());
    const lfo = this._oscillator(target);
    // Preserve the two independent channels through a shared gain envelope.
    pulse.channelCount = 2;
    pulse.channelCountMode = 'explicit';
    pulse.channelInterpretation = 'discrete';
    const cosine = context.createPeriodicWave(
      new Float32Array([0, 1]), new Float32Array([0, 0]),
      { disableNormalization: true },
    );
    lfo.setPeriodicWave(cosine);
    pulse.gain.setValueAtTime(0.5, context.currentTime);
    depth.gain.setValueAtTime(0.5, context.currentTime);
    lfo.connect(depth);
    depth.connect(pulse.gain);
    return pulse;
  }

  async start(config = {}) {
    const normalized = validateConfig(config);
    return this._enqueue(async () => {
      await this._stop();
      if (typeof this._AudioContext !== 'function') {
        throw new Error('Este navegador não oferece suporte ao áudio necessário.');
      }
      this._config = normalized;
      this._storedElapsed = 0;
      this._state = 'starting';
      try {
        const context = new this._AudioContext({ latencyHint: 'interactive' });
        this._context = context;
        await context.resume();
        if (context.state !== 'running') {
          throw new Error('O áudio não foi liberado pelo navegador. Toque em iniciar novamente.');
        }
        if (Math.max(this.frequencies.left, this.frequencies.right) >= context.sampleRate / 2) {
          throw new RangeError('A frequência escolhida supera a capacidade de áudio deste dispositivo.');
        }
        this._referenceTime = context.currentTime + SCHEDULE_LEAD_SECONDS;
        const merger = this._track(context.createChannelMerger(2));
        const volume = this._track(context.createGain());
        const envelope = this._track(context.createGain());
        this._volume = volume;
        this._envelope = envelope;
        volume.channelCount = 2;
        volume.channelCountMode = 'explicit';
        volume.channelInterpretation = 'discrete';
        envelope.channelCount = 2;
        envelope.channelCountMode = 'explicit';
        envelope.channelInterpretation = 'discrete';
        volume.gain.setValueAtTime(normalized.volume * OUTPUT_GAIN, context.currentTime);
        envelope.gain.setValueAtTime(0, context.currentTime);
        envelope.gain.setValueAtTime(0, this._referenceTime);
        envelope.gain.linearRampToValueAtTime(1, this._referenceTime + FADE_SECONDS);
        if (normalized.audioMode === 'isochronic' || normalized.binauralModulation) {
          // Audio-rate gain(t) = .5 + .5*cos(2π*target*t), with the same
          // reference start and seconds-based phase as the visual renderer.
          const pulse = this._pulseGain(normalized.target);
          merger.connect(pulse);
          pulse.connect(volume);
        } else {
          merger.connect(volume);
        }
        volume.connect(envelope);
        envelope.connect(context.destination);

        if (normalized.audioMode === 'binaural') {
          // Merger input 0 is left, input 1 is right: no panner or crossfeed.
          this._oscillator(this.frequencies.left).connect(merger, 0, 0);
          this._oscillator(this.frequencies.right).connect(merger, 0, 1);
        } else {
          const carrier = this._oscillator(normalized.carrier);
          carrier.connect(merger, 0, 0);
          carrier.connect(merger, 0, 1);
        }

        // Explicitly optional: the default keeps the requested pure carriers.
        if (normalized.ambience > 0) {
          for (const harmonic of [2, 3]) {
            const frequency = normalized.carrier * harmonic;
            if (frequency >= Math.min(20000, context.sampleRate / 2)) continue;
            const pad = this._oscillator(frequency);
            const padGain = this._track(context.createGain());
            padGain.gain.setValueAtTime(normalized.ambience * 0.035 / harmonic, this._referenceTime);
            pad.connect(padGain);
            padGain.connect(merger, 0, 0);
            padGain.connect(merger, 0, 1);
          }
        }
        for (const oscillator of this._oscillators) oscillator.start(this._referenceTime);
        this._state = 'running';
      } catch (error) {
        await this._dispose();
        this._state = 'stopped';
        throw error;
      }
      return this;
    });
  }

  setVolume(volume) {
    range(volume, 'volume', 0, 1);
    this._config = Object.freeze({ ...this._config, volume });
    if (this._context && this._context.state !== 'closed' && this._volume) {
      const now = this._context.currentTime;
      holdParameter(this._volume.gain, now);
      this._volume.gain.setTargetAtTime(volume * OUTPUT_GAIN, now, 0.06);
    }
  }

  async pause() {
    return this._enqueue(async () => {
      if (!this._context || this._context.state === 'closed') return;
      if (this._context.state === 'running') {
        const now = this._context.currentTime;
        holdParameter(this._envelope.gain, now);
        this._envelope.gain.linearRampToValueAtTime(0, now + 0.08);
        await wait(90);
        await this._context.suspend();
      }
      this._state = 'paused';
    });
  }

  async resume() {
    return this._enqueue(async () => {
      if (!this._context || this._context.state === 'closed') {
        throw new Error('Inicie uma sessão antes de continuar.');
      }
      if (this.state === 'running') return;
      await this._context.resume();
      if (this._context.state !== 'running') throw new Error('Não foi possível retomar o áudio.');
      const now = this._context.currentTime;
      holdParameter(this._envelope.gain, now);
      this._envelope.gain.setValueAtTime(0, now);
      this._envelope.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
      this._state = 'running';
    });
  }

  async _dispose() {
    const context = this._context;
    if (context) this._storedElapsed = this.elapsed;
    this._context = null;
    for (const oscillator of this._oscillators) {
      try { oscillator.stop(); } catch { /* An unstarted node needs no stop. */ }
    }
    for (const node of this._nodes) {
      try { node.disconnect(); } catch { /* Already disconnected. */ }
    }
    this._nodes = [];
    this._oscillators = [];
    this._volume = null;
    this._envelope = null;
    if (context && context.state !== 'closed') await context.close();
  }

  async _stop() {
    try {
      if (this._context?.state === 'running' && this._envelope) {
        this._state = 'stopping';
        const now = this._context.currentTime;
        holdParameter(this._envelope.gain, now);
        this._envelope.gain.linearRampToValueAtTime(0, now + 0.15);
        await wait(170);
      }
    } finally {
      await this._dispose();
      if (this._state !== 'idle') this._state = 'stopped';
    }
  }

  async stop() {
    return this._enqueue(() => this._stop());
  }
}
