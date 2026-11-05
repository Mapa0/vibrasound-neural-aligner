import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

const page = await browser.newPage();
const browserErrors = [];
page.on('pageerror', error => browserErrors.push(error.message));

try {
  await page.goto(process.env.SITE_URL || 'http://localhost:8788', { waitUntil: 'networkidle' });
  const result = await page.evaluate(async () => {
    const { NeuroAudioEngine } = await import('/audio-engine.js');
    const sampleRate = 48000;
    const duration = 4;
    const reference = 0.025;
    const startSample = Math.round((reference + 1) * sampleRate);
    const endSample = startSample + 2 * sampleRate;

    const amplitudeAt = (data, frequency) => {
      let real = 0;
      let imaginary = 0;
      const count = endSample - startSample;
      for (let sample = startSample; sample < endSample; sample++) {
        const phase = 2 * Math.PI * frequency * (sample / sampleRate - reference);
        real += data[sample] * Math.cos(phase);
        imaginary += data[sample] * Math.sin(phase);
      }
      return 2 * Math.hypot(real, imaginary) / count;
    };

    const zeroCrossingFrequency = data => {
      const crossings = [];
      for (let sample = startSample + 1; sample < endSample; sample++) {
        if (data[sample - 1] < 0 && data[sample] >= 0) {
          const fraction = -data[sample - 1] / (data[sample] - data[sample - 1]);
          crossings.push(sample - 1 + fraction);
        }
      }
      return (crossings.length - 1) * sampleRate / (crossings.at(-1) - crossings[0]);
    };

    const relativeWaveformError = (data, frequency, isochronic = false) => {
      let squaredError = 0;
      let squaredSignal = 0;
      for (let sample = 0; sample < data.length; sample++) {
        const elapsed = sample / sampleRate - reference;
        const envelope = Math.max(0, Math.min(1, elapsed));
        const modulation = isochronic ? 0.5 + 0.5 * Math.cos(2 * Math.PI * 6 * elapsed) : 1;
        const expected = 0.04 * envelope * modulation * Math.sin(2 * Math.PI * frequency * elapsed);
        squaredError += (data[sample] - expected) ** 2;
        squaredSignal += expected ** 2;
      }
      return Math.sqrt(squaredError / squaredSignal);
    };

    const measure = async (audioMode, binauralModulation = false, soundTexture = 'pure', ambience = 0) => {
      let offline;
      // Only adapt lifecycle methods: every node, connection, oscillator,
      // automation event and rendered sample comes from the production engine
      // and Chromium's native Web Audio implementation.
      function OfflineContextAdapter() {
        offline = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
        let reportedState = 'running';
        Object.defineProperty(offline, 'state', { get: () => reportedState });
        Object.defineProperty(offline, 'resume', { value: async () => { reportedState = 'running'; } });
        Object.defineProperty(offline, 'close', { value: async () => { reportedState = 'closed'; } });
        return offline;
      }
      const engine = new NeuroAudioEngine({ AudioContext: OfflineContextAdapter });
      await engine.start({ carrier: 528, target: 6, volume: 0.25, audioMode, binauralModulation, soundTexture, ambience });
      const rendered = await offline.startRendering();
      const left = rendered.getChannelData(0);
      const right = rendered.getChannelData(1);
      let peak = 0;
      let stereoDelta = 0;
      for (let sample = 0; sample < left.length; sample++) {
        peak = Math.max(peak, Math.abs(left[sample]), Math.abs(right[sample]));
        stereoDelta = Math.max(stereoDelta, Math.abs(left[sample] - right[sample]));
      }
      const measured = {
        samplesPerChannel: left.length,
        sampleRate: rendered.sampleRate,
        peak,
        stereoDelta,
        leftWaveformRelativeError: relativeWaveformError(left, audioMode === 'binaural' ? 525 : 528, audioMode === 'isochronic' || binauralModulation),
        rightWaveformRelativeError: relativeWaveformError(right, audioMode === 'binaural' ? 531 : 528, audioMode === 'isochronic' || binauralModulation),
        left525Amplitude: amplitudeAt(left, 525),
        left531Amplitude: amplitudeAt(left, 531),
        right525Amplitude: amplitudeAt(right, 525),
        right531Amplitude: amplitudeAt(right, 531),
        carrier528Amplitude: amplitudeAt(left, 528),
        lowerSideband522Amplitude: amplitudeAt(left, 522),
        upperSideband534Amplitude: amplitudeAt(left, 534),
        accidental6000HzAmplitude: amplitudeAt(left, 6000),
        left1050Amplitude: amplitudeAt(left, 1050),
        left1575Amplitude: amplitudeAt(left, 1575),
        right1062Amplitude: amplitudeAt(right, 1062),
        right1593Amplitude: amplitudeAt(right, 1593),
        wrongChannelLeft1062Amplitude: amplitudeAt(left, 1062),
        wrongChannelRight1050Amplitude: amplitudeAt(right, 1050),
      };
      if (audioMode === 'binaural' && !binauralModulation && soundTexture === 'pure') {
        measured.leftFrequencyHz = zeroCrossingFrequency(left);
        measured.rightFrequencyHz = zeroCrossingFrequency(right);
      }
      await engine.stop();
      return measured;
    };

    const binaural = await measure('binaural');
    const isochronic = await measure('isochronic');
    const modulatedBinaural = await measure('binaural', true);
    const etherealBinaural = await measure('binaural', false, 'ethereal', 0.35);
    const etherealModulatedBinaural = await measure('binaural', true, 'ethereal', 0.35);
    const etherealIsochronic = await measure('isochronic', false, 'ethereal', 0.35);

    // Exercise real browser AudioContext suspension, not the offline adapter.
    const liveEngine = new NeuroAudioEngine();
    await liveEngine.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    const runningClock = liveEngine.elapsed;
    await liveEngine.pause();
    const pausedClock = liveEngine.elapsed;
    await new Promise(resolve => setTimeout(resolve, 150));
    const stillPausedClock = liveEngine.elapsed;
    const pausedState = liveEngine.state;
    await liveEngine.resume();
    await new Promise(resolve => setTimeout(resolve, 150));
    const resumedClock = liveEngine.elapsed;
    await liveEngine.stop();
    return {
      binaural,
      isochronic,
      modulatedBinaural,
      etherealBinaural,
      etherealModulatedBinaural,
      etherealIsochronic,
      lifecycle: { runningClock, pausedClock, stillPausedClock, pausedState, resumedClock, finalState: liveEngine.state },
    };
  });

  assert.ok(Math.abs(result.binaural.leftFrequencyHz - 525) < 0.001);
  assert.ok(Math.abs(result.binaural.rightFrequencyHz - 531) < 0.001);
  assert.ok(result.binaural.left525Amplitude > 0.0399);
  assert.ok(result.binaural.right531Amplitude > 0.0399);
  assert.ok(result.binaural.left531Amplitude < 1e-6);
  assert.ok(result.binaural.right525Amplitude < 1e-6);
  // Allow the native oscillator's tiny floating-point phase accumulation error.
  assert.ok(result.binaural.leftWaveformRelativeError < 0.0003);
  assert.ok(result.binaural.rightWaveformRelativeError < 0.0003);
  assert.ok(result.isochronic.leftWaveformRelativeError < 0.0003);
  assert.ok(result.isochronic.rightWaveformRelativeError < 0.0003);
  assert.ok(result.modulatedBinaural.leftWaveformRelativeError < 0.0003);
  assert.ok(result.modulatedBinaural.rightWaveformRelativeError < 0.0003);
  assert.ok(Math.abs(result.modulatedBinaural.left525Amplitude - 0.02) < 1e-5);
  assert.ok(Math.abs(result.modulatedBinaural.right531Amplitude - 0.02) < 1e-5);
  assert.ok(Math.abs(result.modulatedBinaural.left531Amplitude - 0.01) < 1e-5);
  assert.ok(Math.abs(result.modulatedBinaural.right525Amplitude - 0.01) < 1e-5);
  assert.equal(result.isochronic.stereoDelta, 0);
  assert.ok(Math.abs(result.isochronic.carrier528Amplitude - 0.02) < 1e-5);
  assert.ok(Math.abs(result.isochronic.lowerSideband522Amplitude - 0.01) < 1e-5);
  assert.ok(Math.abs(result.isochronic.upperSideband534Amplitude - 0.01) < 1e-5);
  assert.ok(result.isochronic.accidental6000HzAmplitude < 1e-6);
  // Added atmosphere must preserve the original core level and channel routing.
  assert.ok(Math.abs(result.etherealBinaural.left525Amplitude - result.binaural.left525Amplitude) < 1e-6);
  assert.ok(Math.abs(result.etherealBinaural.right531Amplitude - result.binaural.right531Amplitude) < 1e-6);
  assert.ok(result.etherealBinaural.left1050Amplitude > 0.0005);
  assert.ok(result.etherealBinaural.left1575Amplitude > 0.0003);
  assert.ok(result.etherealBinaural.right1062Amplitude > 0.0005);
  assert.ok(result.etherealBinaural.right1593Amplitude > 0.0003);
  assert.ok(result.etherealBinaural.wrongChannelLeft1062Amplitude < 1e-6);
  assert.ok(result.etherealBinaural.wrongChannelRight1050Amplitude < 1e-6);
  assert.ok(result.binaural.left1050Amplitude < 1e-6);
  assert.ok(result.binaural.right1062Amplitude < 1e-6);
  assert.ok(Math.abs(result.etherealModulatedBinaural.left525Amplitude - result.modulatedBinaural.left525Amplitude) < 1e-6);
  assert.ok(Math.abs(result.etherealModulatedBinaural.right531Amplitude - result.modulatedBinaural.right531Amplitude) < 1e-6);
  assert.ok(Math.abs(result.etherealIsochronic.carrier528Amplitude - result.isochronic.carrier528Amplitude) < 1e-6);
  assert.ok(Math.abs(result.etherealIsochronic.lowerSideband522Amplitude - result.isochronic.lowerSideband522Amplitude) < 1e-6);
  assert.ok(Math.abs(result.etherealIsochronic.upperSideband534Amplitude - result.isochronic.upperSideband534Amplitude) < 1e-6);
  assert.ok(result.etherealIsochronic.stereoDelta < 1e-7);
  assert.ok(result.etherealBinaural.peak < 0.05);
  assert.equal(result.lifecycle.pausedState, 'paused');
  assert.equal(result.lifecycle.pausedClock, result.lifecycle.stillPausedClock);
  assert.ok(result.lifecycle.resumedClock > result.lifecycle.pausedClock);
  assert.equal(result.lifecycle.finalState, 'stopped');
  assert.deepEqual(browserErrors, []);
  const report = { passed: true, browserErrors, ...result };
  await writeFile(new URL('./audio-signal.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
