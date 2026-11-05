/** Pitch-locked vocal resynthesis: all time values below are seconds. */
class VibrasoundChant extends AudioWorkletProcessor {
  constructor({ processorOptions }) {
    super();
    this.options = processorOptions;
    this.stopped = false;
    this.seeds = [1234567, processorOptions.naturalPitch ? 1234567 : 7654321];
    this.previousNoise = [0, 0];
    this.phases = [0, 0];
    this.naturalStarted = [false, false];
    this.port.onmessage = event => { if (event.data === 'stop') this.stopped = true; };
  }

  process(_inputs, outputs) {
    if (this.stopped) return false;
    const { frequencies, tables, startTime, framePeriodSeconds, phraseDurationSeconds = 0, attackSeconds = .12, releaseSeconds = .25, levels, noise, naturalPitch = false, pitches } = this.options;
    for (let channel = 0; channel < 2; channel++) {
      const output = outputs[channel][0];
      const frames = tables[channel];
      const size = frames[0].length;
      for (let sample = 0; sample < output.length; sample++) {
        const elapsed = (currentFrame + sample) / sampleRate - startTime;
        if (elapsed < 0) { output[sample] = 0; continue; }
        const phraseTime = elapsed % framePeriodSeconds;
        const silentGap = phraseDurationSeconds && phraseTime >= phraseDurationSeconds;
        const morph = phraseDurationSeconds
          ? Math.min(frames.length - 1, phraseTime / phraseDurationSeconds * (frames.length - 1))
          : (elapsed / framePeriodSeconds % 1) * frames.length;
        const firstFrame = Math.floor(morph);
        const frameMix = morph - firstFrame;
        const first = frames[firstFrame];
        const nextFrame = phraseDurationSeconds ? Math.min(firstFrame + 1, frames.length - 1) : (firstFrame + 1) % frames.length;
        const second = frames[nextFrame];
        let phase;
        if (naturalPitch) {
          const pitch = pitches[firstFrame] * (1 - frameMix) + pitches[nextFrame] * frameMix;
          if (!this.naturalStarted[channel]) {
            this.phases[channel] = elapsed * pitch % 1;
            this.naturalStarted[channel] = true;
          }
          phase = this.phases[channel];
          // Natural voice follows the measured pitch contour. Integrating Hz
          // per native audio sample keeps phase continuous as that pitch moves.
          this.phases[channel] = (phase + pitch / sampleRate) % 1;
        } else {
          phase = elapsed * frequencies[channel] % 1;
        }
        if (silentGap) { output[sample] = 0; continue; }
        // Derive phase from the native sample clock rather than an accumulating
        // timer; changing the vowel envelope cannot change its fundamental.
        const position = phase * size;
        const index = Math.floor(position);
        const mix = position - index;
        const next = (index + 1) % size;
        const a = first[index] * (1 - mix) + first[next] * mix;
        const b = second[index] * (1 - mix) + second[next] * mix;
        let value = a * (1 - frameMix) + b * frameMix;
        if (phraseDurationSeconds) {
          const level = levels[firstFrame] * (1 - frameMix) + levels[nextFrame] * frameMix;
          const noiseLevel = noise[firstFrame] * (1 - frameMix) + noise[nextFrame] * frameMix;
          if (noiseLevel > 0) {
            this.seeds[channel] = (1664525 * this.seeds[channel] + 1013904223) >>> 0;
            const white = this.seeds[channel] / 2147483648 - 1;
            const highpass = (white - this.previousNoise[channel]) * .5;
            this.previousNoise[channel] = white;
            value += highpass * noiseLevel * .3;
          }
          const attack = Math.sin(Math.PI / 2 * Math.min(1, phraseTime / attackSeconds)) ** 2;
          const release = Math.sin(Math.PI / 2 * Math.min(1, (phraseDurationSeconds - phraseTime) / releaseSeconds)) ** 2;
          value *= level * attack * release;
        }
        output[sample] = value;
      }
    }
    return true;
  }
}
registerProcessor('vibrasound-chant', VibrasoundChant);
