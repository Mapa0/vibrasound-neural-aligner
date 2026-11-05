import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({
  headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.SITE_URL || 'http://localhost:8788', { waitUntil: 'networkidle' });
  const report = await page.evaluate(async () => {
    const { NeuroAudioEngine } = await import('/audio-engine.js');
    const { CHANTS, loadChantModel, loadNaturalChantBuffer, getReferenceChantPitch, getNaturalChantPitchAt } = await import('/chant-engine.js');
    const rate = 48000;
    const project = (data, frequency, start, length) => {
      let cosine = 0, sine = 0;
      for (let sample = start; sample < start + length; sample++) {
        const angle = 2 * Math.PI * frequency * (sample / rate - 0.025);
        cosine += data[sample] * Math.cos(angle);
        sine += data[sample] * Math.sin(angle);
      }
      return { amplitude: 2 * Math.hypot(cosine, sine) / length, phase: Math.atan2(cosine, sine) };
    };
    const render = async (chant, config = {}, seconds = 4) => {
      let offline;
      function Context() {
        offline = new OfflineAudioContext(2, rate * seconds, rate);
        let state = 'running';
        Object.defineProperty(offline, 'state', { get: () => state });
        Object.defineProperty(offline, 'resume', { value: async () => { state = 'running'; } });
        Object.defineProperty(offline, 'close', { value: async () => { state = 'closed'; } });
        return offline;
      }
      const engine = new NeuroAudioEngine({ AudioContext: Context });
      await engine.start({ soundTexture: 'chants', chant, audioMode: 'binaural', carrier: 528, target: 6, ...config });
      const buffer = await offline.startRendering();
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      const metadata = { frequencies: engine.frequencies, audioMode: engine._config.audioMode };
      await engine.stop();
      return { left, right, metadata };
    };
    const measurements = [];
    for (const chant of CHANTS) {
      const { left, right } = await render(chant);
      const start = Math.round(1.025 * rate);
      const a = project(left, 525, start, rate), b = project(left, 525, start + rate, rate);
      const c = project(right, 531, start, rate), d = project(right, 531, start + rate, rate);
      let peak = 0, energy = 0, derivative = 0;
      for (let sample = start; sample < start + rate * 2; sample++) {
        peak = Math.max(peak, Math.abs(left[sample]), Math.abs(right[sample]));
        energy += (left[sample] ** 2 + right[sample] ** 2) / 2;
        derivative = Math.max(derivative, Math.abs(left[sample] - left[sample - 1]));
      }
      measurements.push({
        chant, measuredLeftHz: 525 + (b.phase - a.phase) / (2 * Math.PI), measuredRightHz: 531 + (d.phase - c.phase) / (2 * Math.PI),
        leftFundamentalAmplitude: a.amplitude, rightFundamentalAmplitude: c.amplitude,
        leftSecondHarmonicAmplitude: project(left, 1050, start, rate * 2).amplitude,
        rightSecondHarmonicAmplitude: project(right, 1062, start, rate * 2).amplitude,
        crossChannel531InLeft: project(left, 531, start, rate * 2).amplitude,
        crossChannel525InRight: project(right, 525, start, rate * 2).amplitude,
        peak, rms: Math.sqrt(energy / (rate * 2)), maximumAdjacentSampleDelta: derivative,
      });
    }
    const amBuffer = await render('MMM', { binauralModulation: true });
    const reference = measurements.find(item => item.chant === 'MMM').leftFundamentalAmplitude;
    const start = Math.round(1.025 * rate);
    const carrier = project(amBuffer.left, 525, start, rate);
    const lower = project(amBuffer.left, 519, start, rate);
    const upper = project(amBuffer.left, 531, start, rate);
    const modulation = {
      carrierToUnmodulatedRatio: carrier.amplitude / reference,
      lowerSidebandToUnmodulatedRatio: lower.amplitude / reference,
      upperSidebandToUnmodulatedRatio: upper.amplitude / reference,
      lowerSidebandPhaseDifference: lower.phase - carrier.phase,
      upperSidebandPhaseDifference: upper.phase - carrier.phase,
    };
    const vamModel = await loadChantModel('VAM');
    const phraseBuffer = await render('VAM', { audioMode: 'tone' }, 17);
    const spectrumAt = second => Array.from({ length: 8 }, (_, harmonic) => project(phraseBuffer.left, 528 * (harmonic + 1), Math.round((second + .025) * rate), rate).amplitude);
    const aSpectrum = spectrumAt(2), mSpectrum = spectrumAt(9);
    const norm = vector => Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    const spectrumCorrelation = aSpectrum.reduce((sum, value, index) => sum + value * mSpectrum[index], 0) / (norm(aSpectrum) * norm(mSpectrum));
    let gapPeak = 0;
    for (let sample = Math.ceil((vamModel.phraseDurationSeconds + .025 + .03) * rate); sample < Math.floor((vamModel.framePeriodSeconds + .025 - .03) * rate); sample++) {
      gapPeak = Math.max(gapPeak, Math.abs(phraseBuffer.left[sample]), Math.abs(phraseBuffer.right[sample]));
    }
    const restart = Math.round((vamModel.framePeriodSeconds + .025) * rate);
    const phrase = {
      durationSeconds: vamModel.phraseDurationSeconds, gapSeconds: vamModel.gapSeconds,
      aSpectrum, mSpectrum, spectrumCorrelation, gapPeak,
      restartSampleMagnitude: Math.abs(phraseBuffer.left[restart]),
      outputAfterRestart: norm(phraseBuffer.left.slice(restart + 5000, restart + 6000)),
    };
    const naturalBuffer = await render('MMM', { chantUseBaseFrequency: false, audioMode: 'binaural', binauralModulation: false });
    const naturalModel = await loadChantModel('MMM');
    const decoded = await loadNaturalChantBuffer(new OfflineAudioContext(1, 1, rate), naturalModel);
    const recorded = decoded.getChannelData(0);
    let error = 0, signalEnergy = 0, stereoDelta = 0;
    let pitchMinimum = Infinity, pitchMaximum = -Infinity;
    for (let sample = 0; sample < naturalBuffer.left.length; sample++) {
      const elapsed = sample / rate - .025;
      let expected = 0;
      if (elapsed >= 0) {
        const pitch = getNaturalChantPitchAt(naturalModel, elapsed);
        pitchMinimum = Math.min(pitchMinimum, pitch); pitchMaximum = Math.max(pitchMaximum, pitch);
        const voice = recorded[(sample - 1200) % recorded.length];
        expected = .04 * Math.min(1, elapsed) * (.5 + .5 * Math.cos(2 * Math.PI * 6 * elapsed)) * voice;
      }
      error += (naturalBuffer.left[sample] - expected) ** 2;
      signalEnergy += expected ** 2;
      stereoDelta = Math.max(stereoDelta, Math.abs(naturalBuffer.left[sample] - naturalBuffer.right[sample]));
    }
    const natural = {
      chant: 'MMM', playbackMethod: 'processed-recording-PCM', pitchShiftRatio: 1,
      referencePitchHz: getReferenceChantPitch('MMM'), estimatedPitchMinimumHz: pitchMinimum, estimatedPitchMaximumHz: pitchMaximum,
      forcedAudioMode: naturalBuffer.metadata.audioMode, finalLeftHz: naturalBuffer.metadata.frequencies.left, finalRightHz: naturalBuffer.metadata.frequencies.right,
      expectedFinalHz: getNaturalChantPitchAt(naturalModel, 4 - .025), stereoDelta,
      relativeErrorAgainstRecordingWithSixHzCosineAM: Math.sqrt(error / signalEnergy),
    };
    // Verify the actual final-signal analyser path, reuse, pause and cleanup.
    const live = new NeuroAudioEngine();
    await live.start({ soundTexture: 'chants', chant: 'AAA', binauralModulation: true });
    await new Promise(resolve => setTimeout(resolve, 1200));
    const first = live.getStereoSnapshot();
    const firstLeft = first.left;
    const nonzero = first.left.some(value => Math.abs(value) > 1e-5);
    await new Promise(resolve => setTimeout(resolve, 40));
    const second = live.getStereoSnapshot();
    const snapshot = { nonzero, sameObject: first === second, sameArray: firstLeft === second.left, length: second.left.length, leftHz: second.leftHz, rightHz: second.rightHz, active: second.active };
    await live.pause();
    snapshot.activeWhenPaused = live.getStereoSnapshot().active;
    await live.stop();
    snapshot.nullAfterStop = live.getStereoSnapshot() === null;
    await live.start({ soundTexture: 'chants', chant: 'MMM', chantUseBaseFrequency: false, audioMode: 'binaural' });
    await new Promise(resolve => setTimeout(resolve, 150));
    natural.liveFirstPitchHz = live.getStereoSnapshot().leftHz;
    await new Promise(resolve => setTimeout(resolve, 350));
    natural.liveSecondPitchHz = live.getStereoSnapshot().leftHz;
    natural.liveChannelsMatch = live.getStereoSnapshot().leftHz === live.getStereoSnapshot().rightHz;
    await live.stop();
    return { measurements, modulation, phrase, natural, snapshot };
  });
  for (const measurement of report.measurements) {
    assert.ok(Math.abs(measurement.measuredLeftHz - 525) < 0.003, `${measurement.chant} left pitch`);
    assert.ok(Math.abs(measurement.measuredRightHz - 531) < 0.003, `${measurement.chant} right pitch`);
    assert.ok(measurement.leftFundamentalAmplitude > 0.001);
    assert.ok(measurement.rightFundamentalAmplitude > 0.001);
    assert.ok(measurement.leftSecondHarmonicAmplitude > 0.00001);
    assert.ok(measurement.peak <= 0.02801);
    assert.ok(measurement.rms > 0.006 && measurement.rms <= 0.01201);
    assert.ok(measurement.crossChannel531InLeft < 0.0001);
    assert.ok(measurement.crossChannel525InRight < 0.0001);
  }
  assert.equal(report.snapshot.nonzero, true);
  assert.equal(report.snapshot.sameObject, true);
  assert.equal(report.snapshot.sameArray, true);
  assert.equal(report.snapshot.length, 2048);
  assert.equal(report.snapshot.leftHz, 525);
  assert.equal(report.snapshot.rightHz, 531);
  assert.equal(report.snapshot.active, true);
  assert.equal(report.snapshot.activeWhenPaused, false);
  assert.equal(report.snapshot.nullAfterStop, true);
  assert.ok(Math.abs(report.modulation.carrierToUnmodulatedRatio - .5) < .01);
  assert.ok(Math.abs(report.modulation.lowerSidebandToUnmodulatedRatio - .25) < .01);
  assert.ok(Math.abs(report.modulation.upperSidebandToUnmodulatedRatio - .25) < .01);
  assert.ok(Math.abs(report.modulation.lowerSidebandPhaseDifference) < .02);
  assert.ok(Math.abs(report.modulation.upperSidebandPhaseDifference) < .02);
  assert.ok(report.phrase.spectrumCorrelation < .99);
  assert.equal(report.phrase.gapPeak, 0);
  assert.ok(report.phrase.restartSampleMagnitude < 1e-6);
  assert.ok(report.phrase.outputAfterRestart > .001);
  assert.equal(report.natural.forcedAudioMode, 'isochronic');
  assert.equal(report.natural.stereoDelta, 0);
  assert.equal(report.natural.finalLeftHz, report.natural.finalRightHz);
  assert.ok(Math.abs(report.natural.finalLeftHz - report.natural.expectedFinalHz) < 1e-9);
  assert.ok(report.natural.estimatedPitchMinimumHz > 80 && report.natural.estimatedPitchMaximumHz < 100);
  assert.ok(report.natural.estimatedPitchMaximumHz - report.natural.estimatedPitchMinimumHz > .1);
  assert.ok(report.natural.relativeErrorAgainstRecordingWithSixHzCosineAM < .0003);
  assert.equal(report.natural.liveChannelsMatch, true);
  assert.ok(report.natural.liveFirstPitchHz > 80 && report.natural.liveFirstPitchHz < 100);
  assert.ok(Math.abs(report.natural.liveSecondPitchHz - report.natural.liveFirstPitchHz) > .001);
  assert.deepEqual(errors, []);
  const output = { passed: true, browserErrors: errors, ...report };
  await writeFile(new URL('./chant-signal.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser.close();
}
