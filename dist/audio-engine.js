import { CHANTS, getReferenceChantPitch, getNaturalChantPitchAt, loadChantModel, loadNaturalChantBuffer, buildChantTables, createChantNode } from './chant-engine.js';

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
  soundTexture: 'pure',
  chant: 'MMM',
  chantUseBaseFrequency: true,
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
  if (!['tone', 'binaural', 'isochronic'].includes(result.audioMode)) {
    throw new TypeError('audioMode must be tone, binaural or isochronic.');
  }
  if (typeof result.binauralModulation !== 'boolean') {
    throw new TypeError('binauralModulation must be a boolean.');
  }
  if (!['pure', 'ethereal', 'chants'].includes(result.soundTexture)) {
    throw new TypeError('soundTexture must be pure, ethereal or chants.');
  }
  if (!CHANTS.includes(result.chant)) throw new TypeError('Unknown chant recording.');
  if (typeof result.chantUseBaseFrequency !== 'boolean') throw new TypeError('chantUseBaseFrequency must be a boolean.');
  if (result.soundTexture === 'chants' && !result.chantUseBaseFrequency) result.audioMode = 'isochronic';
  if (result.audioMode !== 'binaural') result.binauralModulation = false;
  // A stale ambience slider must never add sound to the pure reference mode.
  if (result.soundTexture === 'pure') result.ambience = 0;
  if (result.audioMode === 'binaural'
    && (result.carrier - result.target / 2 < 20 || result.carrier + result.target / 2 > 20000)) {
    throw new RangeError('Both binaural carriers must be between 20 and 20000 Hz.');
  }
  return Object.freeze(result);
}

export function getFrequencies(config = {}) {
  const normalized = validateConfig(config);
  const { target, audioMode } = normalized;
  const carrier = normalized.soundTexture === 'chants' && !normalized.chantUseBaseFrequency
    ? getReferenceChantPitch(normalized.chant) : normalized.carrier;
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
    this._stereoSnapshot = null;
    this._analysers = null;
    this._chantNode = null;
    this._chantModel = null;
    this._naturalSource = null;
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
    if (this._chantModel && this._config.soundTexture === 'chants' && !this._config.chantUseBaseFrequency) {
      const pitch = getNaturalChantPitchAt(this._chantModel, this.elapsed);
      return Object.freeze({ left: pitch, right: pitch, carrier: pitch, target: this._config.target });
    }
    return getFrequencies(this._config);
  }

  getStereoSnapshot() {
    if (!this._stereoSnapshot || !this._analysers || !this._context) return null;
    const snapshot = this._stereoSnapshot;
    this._analysers[0].getFloatTimeDomainData(snapshot.left);
    this._analysers[1].getFloatTimeDomainData(snapshot.right);
    snapshot.elapsed = this.elapsed;
    if (this._chantModel && !this._config.chantUseBaseFrequency) {
      const pitch = getNaturalChantPitchAt(this._chantModel, snapshot.elapsed);
      snapshot.leftHz = pitch;
      snapshot.rightHz = pitch;
    }
    snapshot.active = this.state === 'running';
    return snapshot;
  }

  _analyseStereo(envelope) {
    const context = this._context;
    if (!context.createAnalyser || !context.createChannelSplitter) return;
    const splitter = this._track(context.createChannelSplitter(2));
    const left = this._track(context.createAnalyser());
    const right = this._track(context.createAnalyser());
    for (const analyser of [left, right]) {
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
    }
    envelope.connect(splitter);
    splitter.connect(left, 0);
    splitter.connect(right, 1);
    this._analysers = [left, right];
    this._stereoSnapshot = {
      left: new Float32Array(2048), right: new Float32Array(2048),
      sampleRate: context.sampleRate, leftHz: this.frequencies.left, rightHz: this.frequencies.right,
      elapsed: 0, active: true,
    };
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

  _etherealPad(merger) {
    const context = this._context;
    const now = context.currentTime;
    const { left, right } = this.frequencies;
    const breath = this._oscillator(0.065);
    breath.setPeriodicWave(context.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]), { disableNormalization: true }));
    const breathDepth = this._track(context.createGain());
    breathDepth.gain.setValueAtTime(0.35, now);
    breath.connect(breathDepth);
    for (const [channel, fundamental] of [left, right].entries()) {
      const padBus = this._track(context.createGain());
      padBus.gain.setValueAtTime(0.65, now);
      breathDepth.connect(padBus.gain);
      let harmonics = 0;
      // Consonant octaves and fifths make a sustained musical bed. They are
      // optional sound design, separate from the unchanged reference carriers.
      for (const [ratio, level] of [[0.5, 0.22], [0.75, 0.20], [1.5, 0.24], [2, 0.16], [3, 0.10]]) {
        const frequency = fundamental * ratio;
        if (frequency >= Math.min(20000, context.sampleRate / 2)) continue;
        const oscillator = this._oscillator(frequency);
        const harmonicGain = this._track(context.createGain());
        harmonicGain.gain.setValueAtTime(this._config.ambience * level * 1.6, now);
        oscillator.connect(harmonicGain);
        harmonicGain.connect(padBus);
        harmonics++;
      }
      if (!harmonics) continue;
      // Only this musical branch enters the long, damped parallel combs.
      // The fundamental stays dry, and every return stays in its own channel.
      padBus.connect(merger, 0, channel);
      for (const [index, seconds] of [0.149, 0.211, 0.293, 0.379].entries()) {
        const delay = this._track(context.createDelay(0.5));
        const damping = this._track(context.createBiquadFilter());
        const feedback = this._track(context.createGain());
        const wet = this._track(context.createGain());
        delay.delayTime.setValueAtTime(seconds, now);
        damping.type = 'lowpass';
        damping.frequency.setValueAtTime(Math.min(3500, context.sampleRate * 0.45), now);
        damping.Q.setValueAtTime(0.45, now);
        feedback.gain.setValueAtTime(0.68 - index * 0.035, now);
        wet.gain.setValueAtTime(0.075, now);
        padBus.connect(delay);
        delay.connect(damping);
        damping.connect(feedback);
        feedback.connect(delay);
        damping.connect(wet);
        wet.connect(merger, 0, channel);
      }
    }
  }

  async start(config = {}) {
    const normalized = validateConfig(config);
    return this._enqueue(async () => {
      await this._stop();
      if (typeof this._AudioContext !== 'function') {
        throw new Error('This browser does not support the required audio features.');
      }
      this._config = normalized;
      this._storedElapsed = 0;
      this._state = 'starting';
      try {
        const context = new this._AudioContext({ latencyHint: 'interactive' });
        this._context = context;
        await context.resume();
        if (context.state !== 'running') {
          throw new Error('The browser did not allow audio playback. Press start again.');
        }
        if (Math.max(this.frequencies.left, this.frequencies.right) >= context.sampleRate / 2) {
          throw new RangeError('The selected frequency exceeds this device’s audio capability.');
        }
        let chantModel = null;
        let chantTables = null;
        let naturalBuffer = null;
        if (normalized.soundTexture === 'chants') {
          if (normalized.chantUseBaseFrequency && (!context.audioWorklet || typeof globalThis.AudioWorkletNode !== 'function')) {
            throw new Error('Voice resynthesis requires a browser with AudioWorklet support.');
          }
          // Resume within the user's gesture before fetching. Set the shared
          // session reference only after all voice assets are ready.
          if (normalized.chantUseBaseFrequency) {
            [chantModel] = await Promise.all([
              loadChantModel(normalized.chant),
              context.audioWorklet.addModule(new URL('./chant-worklet.js', import.meta.url)),
            ]);
          } else {
            chantModel = await loadChantModel(normalized.chant);
            naturalBuffer = await loadNaturalChantBuffer(context, chantModel);
          }
          this._chantModel = chantModel;
          if (normalized.chantUseBaseFrequency) {
            chantTables = [
              buildChantTables(chantModel, this.frequencies.left, context.sampleRate),
              buildChantTables(chantModel, this.frequencies.right, context.sampleRate),
            ];
          }
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
        if (normalized.audioMode === 'isochronic' || (normalized.audioMode === 'binaural' && normalized.binauralModulation)) {
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
        this._analyseStereo(envelope);

        if (naturalBuffer) {
          this._naturalSource = this._track(context.createBufferSource());
          this._naturalSource.buffer = naturalBuffer;
          this._naturalSource.loop = true;
          this._naturalSource.playbackRate.setValueAtTime(1, context.currentTime);
          this._naturalSource.connect(merger, 0, 0);
          this._naturalSource.connect(merger, 0, 1);
        } else if (chantModel) {
          this._chantNode = this._track(createChantNode(context, chantModel, this.frequencies.left, this.frequencies.right, this._referenceTime, chantTables, !normalized.chantUseBaseFrequency));
          this._chantNode.connect(merger, 0, 0);
          this._chantNode.connect(merger, 1, 1);
        } else if (normalized.audioMode === 'binaural') {
          // Merger input 0 is left, input 1 is right: no panner or crossfeed.
          this._oscillator(this.frequencies.left).connect(merger, 0, 0);
          this._oscillator(this.frequencies.right).connect(merger, 0, 1);
        } else {
          const carrier = this._oscillator(normalized.carrier);
          carrier.connect(merger, 0, 0);
          carrier.connect(merger, 0, 1);
        }

        if (normalized.soundTexture === 'ethereal' && normalized.ambience > 0) this._etherealPad(merger);
        for (const oscillator of this._oscillators) oscillator.start(this._referenceTime);
        this._naturalSource?.start(this._referenceTime);
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
        throw new Error('Start a session before resuming audio.');
      }
      if (this.state === 'running') return;
      await this._context.resume();
      if (this._context.state !== 'running') throw new Error('Audio playback could not resume.');
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
    if (this._naturalSource) {
      try { this._naturalSource.stop(); } catch { /* An unstarted source needs no stop. */ }
      this._naturalSource = null;
    }
    if (this._chantNode) {
      this._chantNode.port.postMessage('stop');
      this._chantNode.port.close();
      this._chantNode = null;
    }
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
    this._analysers = null;
    this._stereoSnapshot = null;
    this._chantModel = null;
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
