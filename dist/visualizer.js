const TAU = Math.PI * 2;

/** t is always expressed in seconds, using the same clock as the audio engine. */
export function opacityAt(frequency, t) {
  return 0.5 + 0.3 * Math.cos(TAU * frequency * t);
}

/** A nondispersive traveling wave: distance/speed is a delay in seconds. */
export function waveAt(frequency, timeSeconds, distance = 0, speed = 1, phase = 0) {
  return Math.cos(TAU * frequency * (timeSeconds - distance / speed) + phase);
}

/** Event count is derived from audio seconds, never accumulated by timers. */
export function meteorEventIndex(frequency, elapsedSeconds) {
  return Math.floor(Math.max(0, elapsedSeconds) * frequency);
}

export function meteorBirthTime(frequency, eventIndex) {
  return eventIndex / frequency;
}

/** Full-strength strobe reaches the chosen intensity at each cosine crest. */
export function strobeOpacityAt(frequency, timeSeconds, intensity = 1) {
  return Math.max(0, Math.min(1, intensity)) * (0.5 + 0.5 * Math.cos(TAU * frequency * timeSeconds));
}

function meteorRandom(index, salt) {
  let n = Math.imul(index, 1664525) + Math.imul(salt, 1013904223);
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** Copy an actual PCM window with a rising-zero trigger and no normalization.
 * Both channels use the same duration; display spacing therefore retains
 * their different frequencies. The output buffer is owned and reused by UI.
 */
export function writeWaveform(samples, sampleRate, frequency, output, windowSeconds = 0.016) {
  if (!samples || samples.length < 2 || !output.length) {
    output.fill(0);
    return 0;
  }
  const span = Math.min(sampleRate * windowSeconds, samples.length - 2);
  const maximumStart = Math.max(0, Math.min(samples.length - span - 2, sampleRate / Math.max(1, frequency) * 2));
  let start = 0;
  for (let i = 0; i < maximumStart; i++) {
    if (samples[i] < 0 && samples[i + 1] >= 0) {
      start = i - samples[i] / (samples[i + 1] - samples[i]);
      break;
    }
  }
  for (let i = 0; i < output.length; i++) {
    const position = start + span * i / Math.max(1, output.length - 1);
    const index = Math.min(samples.length - 2, Math.floor(position));
    const fraction = position - index;
    output[i] = samples[index] * (1 - fraction) + samples[index + 1] * fraction;
  }
  return start;
}

/** Fixed-reference signal features; this never normalizes either channel. */
export function channelSignalFeatures(samples, sampleRate, frequency, output = {}) {
  let squares = 0, differences = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    squares += value * value;
    peak = Math.max(peak, Math.abs(value));
    if (i) differences += (value - samples[i - 1]) ** 2;
  }
  const rms = samples.length ? Math.sqrt(squares / samples.length) : 0;
  const roughness = rms > 1e-8 ? Math.sqrt(differences / Math.max(1, samples.length - 1)) / rms : 0;
  const sineRoughness = 2 * Math.sin(Math.PI * frequency / sampleRate);
  const spectralShape = rms > 1e-8 && sineRoughness > 0 ? Math.max(0, roughness / sineRoughness - 1) : 0;
  const crestShape = rms > 1e-8 ? Math.max(0, peak / (rms * Math.SQRT2) - 1) : 0;
  output.rms = rms;
  output.texture = Math.min(0.65, spectralShape * 0.5 + crestShape * 0.2);
  return output;
}

/** Audio-clock low-pass filter. A held clock holds the visual state, and a
 * new session resets it. Exact PCM silence can bypass the filter for mute.
 */
export function updateWaveLevel(state, input, elapsedSeconds, tau = 0.75, hardZero = true) {
  if (state.elapsed == null || elapsedSeconds < state.elapsed || (hardZero && input === 0)) {
    state.value = input;
    state.elapsed = elapsedSeconds;
    return input;
  }
  const dt = Math.max(0, elapsedSeconds - state.elapsed);
  if (dt > 0) {
    const alpha = -Math.expm1(-dt / Math.max(0.001, tau));
    state.value += (input - state.value) * alpha;
    state.elapsed = elapsedSeconds;
  }
  return state.value;
}

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export class CosmicVisualizer {
  constructor(canvas, { getTime, getConfig, getActive, getAudioData = () => null }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.getTime = getTime;
    this.getConfig = getConfig;
    this.getActive = getActive;
    this.getAudioData = getAudioData;
    this.leftWave = new Float32Array(640);
    this.rightWave = new Float32Array(640);
    this.leftSignal = {};
    this.rightSignal = {};
    this.leftLevelFilter = { value: 0, elapsed: null };
    this.rightLevelFilter = { value: 0, elapsed: null };
    this.leftTextureFilter = { value: 0, elapsed: null };
    this.rightTextureFilter = { value: 0, elapsed: null };
    this.frame = 0;
    this.running = false;
    this.frameAverage = 16.67;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.lastColor = '';
    this.startedAt = performance.now() / 1000;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
    this.makeParticles();
    window.addEventListener('resize', this.resize, { passive: true });
    this.resize();
  }

  makeParticles() {
    let seed = 80719;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    this.count = 3300;
    this.particles = new Float32Array(this.count * 7);
    for (let i = 0; i < this.count; i++) {
      const p = i * 7;
      const theta = random() * TAU;
      const phi = random() * TAU;
      const tube = Math.sqrt(random()) * (0.14 + 0.045 * Math.sin(theta * 3));
      this.particles[p] = theta;
      this.particles[p + 1] = phi;
      this.particles[p + 2] = tube;
      this.particles[p + 3] = random();
      this.particles[p + 4] = random();
      this.particles[p + 5] = random();
      this.particles[p + 6] = random();
    }
    this.stars = new Float32Array(220 * 5);
    for (let i = 0; i < this.stars.length; i++) this.stars[i] = random();
  }

  setColor(hex) {
    if (hex === this.lastColor) return;
    this.lastColor = hex;
    const match = /^#([0-9a-f]{6})$/i.exec(hex || '');
    const value = parseInt(match ? match[1] : '20ff50', 16);
    const r = value >> 16, g = (value >> 8) & 255, b = value & 255;
    this.rgb = `${r},${g},${b}`;
    this.pale = `${Math.round(r * 0.45 + 255 * 0.55)},${Math.round(g * 0.45 + 255 * 0.55)},${Math.round(b * 0.45 + 255 * 0.55)}`;
    this.palette = Array.from({ length: 24 }, (_, i) => `rgba(${this.rgb},${(i + 1) / 24})`);
    this.palePalette = Array.from({ length: 24 }, (_, i) => `rgba(${this.pale},${(i + 1) / 24})`);
    this.sprite = document.createElement('canvas');
    this.sprite.width = this.sprite.height = 64;
    const c = this.sprite.getContext('2d');
    const g1 = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g1.addColorStop(0, `rgba(${this.pale},1)`);
    g1.addColorStop(0.09, `rgba(${this.pale},.85)`);
    g1.addColorStop(0.24, `rgba(${this.rgb},.28)`);
    g1.addColorStop(0.55, `rgba(${this.rgb},.07)`);
    g1.addColorStop(1, `rgba(${this.rgb},0)`);
    c.fillStyle = g1;
    c.fillRect(0, 0, 64, 64);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.mobile = this.width < 760;
    this.limit = this.mobile ? 2100 : this.count;
    this.bgGradient = null;
    this.water = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.frame = requestAnimationFrame(this.render);
  }

  get frameRate() {
    return 1000 / this.frameAverage;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize);
  }

  glow(x, y, radius, alpha, color = this.rgb) {
    const c = this.ctx;
    const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${color},${alpha})`);
    gradient.addColorStop(0.38, `rgba(${color},${alpha * 0.35})`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = gradient;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  drawBackground(t, cx, cy, radius, effect) {
    const c = this.ctx, w = this.width, h = this.height;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    const backgroundKey = `${w}:${h}:${this.lastColor}:${cx}:${cy}:${radius}:${effect}`;
    if (this.backgroundKey !== backgroundKey) {
      const background = document.createElement('canvas');
      background.width = this.canvas.width;
      background.height = this.canvas.height;
      const b = background.getContext('2d', { alpha: false });
      b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      b.fillStyle = effect === 'stars' ? '#000000' : '#07090d';
      b.fillRect(0, 0, w, h);
      this.ctx = b;
      if (effect !== 'stars') {
        this.glow(cx + radius * 0.5, cy - radius * 0.12, radius * 2.4, 0.037);
        this.glow(cx - radius * 0.64, cy + radius * 0.64, radius * 1.65, 0.026, '71,112,137');
      }
      b.globalCompositeOperation = 'screen';
      if (effect === 'liquid') {
        this.glow(cx, cy, radius * 1.65, 0.048);
        this.glow(cx - radius * 0.52, cy - radius * 0.08, radius * 0.8, 0.045);
        this.glow(cx + radius * 0.62, cy + radius * 0.16, radius * 0.9, 0.032);
      } else if (effect === 'stereo') {
        this.glow(cx - radius * 1.08, cy, radius * 0.95, 0.115);
        this.glow(cx + radius * 1.08, cy, radius * 0.95, 0.115);
        this.glow(cx, cy, radius * 1.7, 0.025);
      } else if (effect !== 'stars') {
        this.glow(cx, cy, radius * 1.1, 0.096);
        this.glow(cx - radius * 0.5, cy - radius * 0.44, radius * 0.7, 0.111);
        this.glow(cx + radius * 0.48, cy + radius * 0.36, radius * 0.7, 0.093);
      }
      this.ctx = c;
      this.background = background;
      this.backgroundKey = backgroundKey;
    }
    c.drawImage(this.background, 0, 0, w, h);
    c.globalCompositeOperation = 'screen';
    const drift = this.reduceMotion || effect === 'stars' ? 0 : t;
    for (let i = 0; i < 220; i++) {
      const p = i * 5;
      const x = (this.stars[p] * w + drift * (0.12 + this.stars[p + 2] * 0.5)) % w;
      const y = (this.stars[p + 1] * h + Math.sin(drift * 0.024 + i) * 6) % h;
      const alpha = 0.045 + this.stars[p + 3] * 0.22;
      c.fillStyle = this.palePalette[Math.floor(alpha * 23)];
      const size = this.stars[p + 4] > 0.96 ? 1.3 : 0.65;
      c.fillRect(x, y, size, size);
    }
  }

  drawOrbits(t, cx, cy, radius, effect, phase = 0, waveGain = 0) {
    const c = this.ctx;
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.48);
    for (let k = 0; k < 3; k++) {
      const size = radius * (1.22 + k * 0.16);
      c.beginPath();
      c.ellipse(0, 0, size, radius * (0.34 + k * 0.045), 0.14 * k, 0, TAU);
      c.strokeStyle = `rgba(${this.rgb},${k === 0 ? 0.22 : 0.09})`;
      c.lineWidth = k === 0 ? 0.65 : 0.45;
      c.stroke();
      const angle = t * (0.16 + k * 0.048) + k * 2.1 + Math.sin(phase - k * 2.1) * waveGain * 0.12;
      const x = Math.cos(angle) * size, y = Math.sin(angle) * radius * (0.34 + k * 0.045);
      c.globalAlpha = 0.6;
      c.drawImage(this.sprite, x - 6, y - 6, 12, 12);
      c.globalAlpha = 1;
    }
    c.restore();
    if (effect !== 'orbits') return;
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.2);
    for (let layer = 0; layer < 3; layer++) {
      c.beginPath();
      for (let i = 0; i <= 520; i++) {
        const a = (i / 520) * TAU;
        const travelingWave = Math.cos(phase - a * 3 - layer * 0.7) * waveGain * 0.14;
        const x = Math.sin(a * 3 + t * 0.13 + layer * 0.18 + travelingWave) * radius * 0.84;
        const y = Math.sin(a * 2 + Math.sin(t * 0.11) * 0.22 + layer * 0.18 - travelingWave) * radius * 0.82;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = `rgba(${this.pale},${0.19 / (layer + 1)})`;
      c.lineWidth = 0.6;
      c.stroke();
    }
    c.restore();
  }

  makeWater(frequency, speed, spread, { leftRatio = 1, rightRatio = 1, separation = 0.5 } = {}) {
    const quality = this.waterQuality ?? 1;
    const columns = Math.round((this.mobile ? 92 : 128) * quality);
    const rows = Math.round((this.mobile ? 42 : 56) * quality);
    const count = columns * rows;
    const sourceDistance = 0.35 + separation * 0.6;
    const sources = [
      [-sourceDistance, -0.12, 0, 1, leftRatio],
      [sourceDistance, 0.16, 0.43 * TAU, 1, rightRatio],
    ];
    const water = {
      columns, rows, sources, frequency, speed, spread, leftRatio, rightRatio, separation,
      xs: new Float32Array(count), zs: new Float32Array(count),
      cos: new Float32Array(count), sin: new Float32Array(count),
      leftCos: new Float32Array(count), leftSin: new Float32Array(count),
      rightCos: new Float32Array(count), rightSin: new Float32Array(count),
      fade: new Float32Array(count), px: new Float32Array(count),
      py: new Float32Array(count), heights: new Float32Array(count),
      flowCos: new Float32Array(count), flowSin: new Float32Array(count),
    };
    const damping = 0.9 - spread * 0.55;
    for (let row = 0; row < rows; row++) {
      const z = -1.1 + (row / (rows - 1)) * 2.2;
      for (let col = 0; col < columns; col++) {
        const p = row * columns + col;
        const x = -1.7 + (col / (columns - 1)) * 3.4;
        water.xs[p] = x;
        water.zs[p] = z;
        const edge = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / 1.72, 6)), 0.5)
          * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) / 1.12, 6)), 0.6);
        water.fade[p] = edge;
        for (let channel = 0; channel < sources.length; channel++) {
          const source = sources[channel];
          const d = Math.hypot(x - source[0], z - source[1]);
          const a = Math.exp(-d * damping) * source[3] / Math.sqrt(1 + d * 2);
          // Audible carrier ratios change spatial wavelength, never the
          // display's temporal refresh or its shared visual rhythm.
          const phase = TAU * frequency * d * source[4] / speed - source[2];
          const cosine = Math.cos(phase) * a, sine = Math.sin(phase) * a;
          water.cos[p] += cosine;
          water.sin[p] += sine;
          if (channel === 0) { water.leftCos[p] = cosine; water.leftSin[p] = sine; }
          else { water.rightCos[p] = cosine; water.rightSin[p] = sine; }
        }
        water.flowCos[p] = Math.cos(x * 2.4 + z * 3.6);
        water.flowSin[p] = Math.sin(x * 2.4 + z * 3.6);
      }
    }
    this.water = water;
    return water;
  }

  drawLiquid(t, cx, cy, radius, target, pulsing, intensity, motionSpeed, spread, config = {}) {
    // Only the propagation speed changes with motionSpeed. The source keeps
    // emitting exactly target cycles per audio second after explicit opt-in.
    const frequency = pulsing ? target : 0.34;
    const speed = pulsing ? (1.4 + frequency * 0.2) * motionSpeed : 0.135 * motionSpeed;
    const snapshot = this.getAudioData();
    const measured = !!(snapshot?.left?.length && snapshot?.right?.length && snapshot.sampleRate > 0);
    const carrier = Number(config.carrier) || 528;
    const binaural = config.audioMode === 'binaural';
    const leftHz = measured ? snapshot.leftHz : binaural ? carrier - target / 2 : carrier;
    const rightHz = measured ? snapshot.rightHz : binaural ? carrier + target / 2 : carrier;
    const referenceHz = (leftHz + rightHz) / 2;
    const leftRatio = leftHz / referenceHz, rightRatio = rightHz / referenceHz;
    const separation = clamp(Number(config.liquidSeparation ?? 0.5), 0, 1);
    const leftGain = clamp(Number(config.liquidLeftGain ?? 1), 0, 1.5);
    const rightGain = clamp(Number(config.liquidRightGain ?? 1), 0, 1.5);
    let leftLevel, rightLevel, leftTexture = 0, rightTexture = 0;
    if (measured) {
      channelSignalFeatures(snapshot.left, snapshot.sampleRate, leftHz, this.leftSignal);
      channelSignalFeatures(snapshot.right, snapshot.sampleRate, rightHz, this.rightSignal);
      // .0282843 is the RMS of the app's .04-peak pure sine at 25% volume.
      const referenceRms = Math.SQRT1_2 * 0.04;
      const signalTime = Number.isFinite(snapshot.elapsed) ? snapshot.elapsed : t;
      // Continuous mode deliberately averages rapid AM envelopes rather than
      // carrying an audio-rate pulse into the surface without visual opt-in.
      const tau = pulsing ? 0.05 : 0.75;
      const leftRms = updateWaveLevel(this.leftLevelFilter, this.leftSignal.rms, signalTime, tau);
      const rightRms = updateWaveLevel(this.rightLevelFilter, this.rightSignal.rms, signalTime, tau);
      leftLevel = Math.min(3, leftRms / referenceRms) * leftGain;
      rightLevel = Math.min(3, rightRms / referenceRms) * rightGain;
      leftTexture = updateWaveLevel(this.leftTextureFilter, this.leftSignal.texture, signalTime, tau, false);
      rightTexture = updateWaveLevel(this.rightTextureFilter, this.rightSignal.texture, signalTime, tau, false);
    } else {
      const previewLevel = clamp(Number(config.volume ?? 0.25), 0, 1) / 0.25;
      leftLevel = Math.min(3, previewLevel) * leftGain;
      rightLevel = Math.min(3, previewLevel) * rightGain;
    }
    let water = this.water;
    if (!water || water.frequency !== frequency || water.speed !== speed || water.spread !== spread
      || water.leftRatio !== leftRatio || water.rightRatio !== rightRatio || water.separation !== separation) {
      water = this.makeWater(frequency, speed, spread, { leftRatio, rightRatio, separation });
    }
    const c = this.ctx;
    const phase = this.reduceMotion ? 0 : TAU * frequency * t;
    const cosT = Math.cos(phase), sinT = Math.sin(phase);
    const flow = this.reduceMotion ? 0 : t * 0.18 * motionSpeed;
    const flowCos = Math.cos(flow), flowSin = Math.sin(flow);
    const amplitude = 0.11 + intensity * 0.1;
    const { columns, rows, xs, zs, px, py, heights, fade } = water;
    for (let p = 0; p < xs.length; p++) {
      const leftWave = water.leftCos[p] * cosT + water.leftSin[p] * sinT;
      const rightWave = water.rightCos[p] * cosT + water.rightSin[p] * sinT;
      const wave = leftWave * (1 + leftTexture * Math.abs(leftWave) * 0.35) * leftLevel
        + rightWave * (1 + rightTexture * Math.abs(rightWave) * 0.35) * rightLevel;
      const flowHeight = (water.flowCos[p] * flowCos + water.flowSin[p] * flowSin) * 0.024;
      const h = clamp(wave * amplitude, -0.55, 0.55) + flowHeight;
      const perspective = 1 + zs[p] * 0.19;
      px[p] = cx + (xs[p] + flowHeight * 0.24) * radius * perspective;
      py[p] = cy + zs[p] * radius * 0.60 * perspective - h * radius;
      heights[p] = wave;
    }
    c.globalCompositeOperation = 'source-over';
    // Thin illuminated surface contours. Height moves across this geometry;
    // there is no global image scaling or whole-surface brightness pulse.
    for (let row = 0; row < rows; row++) {
      const rowFade = Math.sin((row / (rows - 1)) * Math.PI);
      c.beginPath();
      for (let col = 0; col < columns; col++) {
        const p = row * columns + col;
        if (!col) c.moveTo(px[p], py[p]); else c.lineTo(px[p], py[p]);
      }
      c.lineWidth = row % 4 === 0 ? 0.75 : 0.48;
      c.strokeStyle = `rgba(${this.rgb},${rowFade * (row % 4 === 0 ? 0.21 : 0.105)})`;
      c.stroke();
      c.beginPath();
      let drawing = false;
      for (let col = 0; col < columns; col++) {
        const p = row * columns + col;
        if (heights[p] > 0.32 && fade[p] > 0.3) {
          if (drawing) c.lineTo(px[p], py[p]); else c.moveTo(px[p], py[p]);
          drawing = true;
        } else drawing = false;
      }
      c.lineWidth = 0.8;
      c.strokeStyle = `rgba(${this.pale},${rowFade * 0.21})`;
      c.stroke();
    }
    // Sparse cross-contours reveal the depth without making a solid grid.
    c.lineWidth = 0.4;
    c.strokeStyle = `rgba(${this.rgb},.045)`;
    c.beginPath();
    for (let col = 3; col < columns - 3; col += 7) {
      for (let row = 1; row < rows - 1; row++) {
        const p = row * columns + col;
        if (row === 1) c.moveTo(px[p], py[p]); else c.lineTo(px[p], py[p]);
      }
    }
    c.stroke();

    // Outward-traveling crest rings show each emitter's wave propagation.
    const maxDistance = 1.25 + spread * 0.75;
    for (let sourceIndex = 0; sourceIndex < water.sources.length; sourceIndex++) {
      const source = water.sources[sourceIndex];
      const level = sourceIndex === 0 ? leftLevel : rightLevel;
      if (level < 0.001) continue;
      const wavelength = speed / (frequency * source[4]);
      const progress = ((phase + source[2]) / TAU % 1 + 1) % 1;
      const ringCount = Math.min(22, Math.ceil(maxDistance / wavelength));
      for (let ring = 0; ring < ringCount; ring++) {
        const distance = (ring + progress) * wavelength;
        if (distance < 0.04 || distance > maxDistance) continue;
        const ringFade = Math.pow(1 - distance / maxDistance, 1.8) * source[3] * Math.min(1.5, level);
        c.beginPath();
        let drawing = false;
        for (let step = 0; step <= 96; step++) {
          const angle = step / 96 * TAU;
          const x = source[0] + Math.cos(angle) * distance;
          const z = source[1] + Math.sin(angle) * distance;
          if (Math.abs(x) > 1.62 || Math.abs(z) > 1.03) { drawing = false; continue; }
          const perspective = 1 + z * 0.19;
          const sx = cx + x * radius * perspective;
          const sy = cy + z * radius * 0.6 * perspective - amplitude * source[3] * Math.exp(-distance * 0.8) * radius * 0.55 * Math.min(2, level);
          if (drawing) c.lineTo(sx, sy); else c.moveTo(sx, sy);
          drawing = true;
        }
        c.strokeStyle = `rgba(${this.pale},${ringFade * 0.22})`;
        c.lineWidth = 0.85;
        c.stroke();
      }
    }
    // Small moving glints are reflections on local crests, not a flashing layer.
    for (let p = 3; p < xs.length; p += 17) {
      const brightness = clamp((heights[p] - 0.12) * 0.6 * fade[p], 0, 0.65);
      if (brightness < 0.025) continue;
      c.globalAlpha = brightness;
      c.drawImage(this.sprite, px[p] - 3, py[p] - 3, 6, 6);
    }
    c.globalAlpha = 1;
  }

  drawShootingStars(t, target, active, intensity, motionSpeed) {
    if (this.reduceMotion) return;
    const c = this.ctx;
    // This is an arrival rate, not a flashing brightness wave. During a
    // session it follows target even when pulsing light is disabled or the
    // arrival rate exceeds half the display refresh rate.
    const frequency = active ? target : 0.7;
    const lifetime = 2.15;
    const last = meteorEventIndex(frequency, t);
    const first = Math.max(1, meteorEventIndex(frequency, Math.max(0, t - lifetime)) + 1);
    const dimension = Math.min(this.width, this.height);
    c.globalCompositeOperation = 'source-over';
    c.lineCap = 'round';
    for (let index = first; index <= last; index++) {
      const age = t - meteorBirthTime(frequency, index);
      if (age < 0 || age >= lifetime) continue;
      const angle = 0.63 + meteorRandom(index, 1) * 0.3;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const velocity = dimension * (0.26 + meteorRandom(index, 2) * 0.15) * motionSpeed;
      const x = this.width * (0.04 + meteorRandom(index, 3) * 0.74) + cos * velocity * age;
      const y = this.height * (0.04 + meteorRandom(index, 4) * 0.58) + sin * velocity * age;
      const tailLength = Math.min(velocity * age, dimension * (0.08 + meteorRandom(index, 5) * 0.10));
      const tailX = x - cos * tailLength, tailY = y - sin * tailLength;
      const envelope = Math.pow(Math.sin(Math.PI * age / lifetime), 0.7);
      const brightness = envelope * (0.2 + intensity * 0.8);
      const gradient = c.createLinearGradient(tailX, tailY, x, y);
      gradient.addColorStop(0, `rgba(${this.rgb},0)`);
      gradient.addColorStop(0.6, `rgba(${this.rgb},.34)`);
      gradient.addColorStop(1, `rgba(${this.pale},.96)`);
      c.globalAlpha = brightness;
      c.strokeStyle = gradient;
      c.lineWidth = 0.65 + meteorRandom(index, 6) * 0.8;
      c.beginPath();
      c.moveTo(tailX, tailY);
      c.lineTo(x, y);
      c.stroke();
      const glowSize = 9 + meteorRandom(index, 7) * 7;
      c.drawImage(this.sprite, x - glowSize / 2, y - glowSize / 2, glowSize, glowSize);
      c.fillStyle = '#f5fff8';
      c.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
    }
    c.lineCap = 'butt';
    c.globalAlpha = 1;
  }

  drawStereo(t, cx, cy, radius, config, motionSpeed) {
    const snapshot = this.getAudioData();
    const measured = !!(snapshot?.left?.length && snapshot?.right?.length && snapshot.sampleRate > 0);
    const carrier = Number(config.carrier) || 528;
    const target = Number(config.target) || 6;
    const binaural = config.audioMode === 'binaural';
    const leftHz = measured ? snapshot.leftHz : binaural ? carrier - target / 2 : carrier;
    const rightHz = measured ? snapshot.rightHz : binaural ? carrier + target / 2 : carrier;
    const windowSeconds = clamp(8 / ((leftHz + rightHz) / 2), 0.008, 0.02);
    if (measured) {
      writeWaveform(snapshot.left, snapshot.sampleRate, leftHz, this.leftWave, windowSeconds);
      writeWaveform(snapshot.right, snapshot.sampleRate, rightHz, this.rightWave, windowSeconds);
    } else {
      // Idle preview is mathematical, never presented as measured output.
      const amplitude = clamp(Number(config.volume ?? 0.25), 0, 1) * 0.16;
      for (let i = 0; i < this.leftWave.length; i++) {
        const seconds = i / (this.leftWave.length - 1) * windowSeconds;
        this.leftWave[i] = Math.sin(TAU * leftHz * seconds) * amplitude;
        this.rightWave[i] = Math.sin(TAU * rightHz * seconds) * amplitude;
      }
    }
    const halfSeparation = Math.min(this.width * 0.22, radius * 1.08);
    const ribbonWidth = Math.min(this.width * 0.39, radius * 1.75);
    this.drawChannelRibbon(this.leftWave, cx - halfSeparation, cy, ribbonWidth, radius, t, motionSpeed, 0);
    this.drawChannelRibbon(this.rightWave, cx + halfSeparation, cy, ribbonWidth, radius, t, motionSpeed, 1);
    const c = this.ctx;
    const labelY = cy + radius * 0.38;
    c.globalCompositeOperation = 'source-over';
    c.textAlign = 'center';
    c.font = `${this.mobile ? 9 : 10}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    c.fillStyle = `rgba(${this.pale},.54)`;
    const formatHz = f => Number(f.toFixed(2));
    c.fillText(`LEFT  ·  ${formatHz(leftHz)} Hz`, cx - halfSeparation, labelY);
    c.fillText(`RIGHT  ·  ${formatHz(rightHz)} Hz`, cx + halfSeparation, labelY);
    if (!measured) {
      c.font = '8px ui-monospace, SFMono-Regular, Consolas, monospace';
      c.fillStyle = `rgba(${this.pale},.28)`;
      c.fillText('PREVIEW', cx, labelY + 33);
    }
  }

  drawChannelRibbon(data, centerX, centerY, width, radius, t, motionSpeed, channel) {
    const c = this.ctx;
    const startX = centerX - width / 2;
    // Fixed visual gain: quieter output and AM troughs really are smaller.
    // No per-frame peak normalization can conceal silence or modulation.
    const sampleScale = radius * 4.2;
    let energy = 0;
    for (let i = 0; i < data.length; i++) energy += data[i] * data[i];
    const echoGain = Math.min(1, Math.sqrt(energy / data.length) * 20);
    c.globalCompositeOperation = 'source-over';
    c.beginPath();
    c.moveTo(startX, centerY);
    c.lineTo(startX + width, centerY);
    c.lineWidth = 0.45;
    c.strokeStyle = `rgba(${this.rgb},.08)`;
    c.stroke();

    // Translucent neighboring ribbons all retain the sampled channel shape.
    for (let echo = -3; echo <= 3; echo++) {
      if (echo === 0) continue;
      const echoScale = 1 - Math.abs(echo) * 0.12;
      c.beginPath();
      for (let i = 0; i < data.length; i++) {
        const u = i / (data.length - 1);
        const taper = Math.pow(Math.sin(Math.PI * u), 0.45);
        const x = startX + u * width;
        const y = centerY - data[i] * sampleScale * taper * echoScale + echo * radius * 0.019 * taper * echoGain;
        if (!i) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = `rgba(${this.rgb},${0.075 / Math.abs(echo)})`;
      c.lineWidth = 0.65;
      c.stroke();
    }
    c.beginPath();
    for (let i = 0; i < data.length; i++) {
      const u = i / (data.length - 1);
      const taper = Math.pow(Math.sin(Math.PI * u), 0.45);
      const x = startX + u * width;
      const y = centerY - data[i] * sampleScale * taper;
      if (!i) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.lineWidth = 11;
    c.strokeStyle = `rgba(${this.rgb},.035)`;
    c.stroke();
    c.lineWidth = 4;
    c.strokeStyle = `rgba(${this.rgb},.12)`;
    c.stroke();
    c.lineWidth = 1.1;
    c.strokeStyle = `rgba(${this.rgb},.78)`;
    c.stroke();
    c.lineWidth = 0.5;
    c.strokeStyle = `rgba(${this.pale},.88)`;
    c.stroke();
    // Fill the actual waveform back to its baseline, like light in water.
    c.lineTo(startX + width, centerY);
    c.lineTo(startX, centerY);
    c.closePath();
    c.fillStyle = `rgba(${this.rgb},.028)`;
    c.fill();

    for (let point = 0; point < 9; point++) {
      const u = (point / 9 + t * motionSpeed * 0.036 + channel * 0.045) % 1;
      const sample = data[Math.floor(u * (data.length - 1))];
      const taper = Math.pow(Math.sin(Math.PI * u), 0.45);
      const x = startX + u * width;
      const y = centerY - sample * sampleScale * taper;
      c.globalAlpha = taper * clamp(Math.abs(sample) * 10, 0, 0.8);
      c.drawImage(this.sprite, x - 4, y - 4, 8, 8);
    }
    c.globalAlpha = 1;
  }

  render(now) {
    if (!this.running) return;
    // performance.now() is converted once to seconds. Audio time is already seconds.
    const elapsed = now / 1000 - this.startedAt;
    const config = this.getConfig() || {};
    this.setColor(config.color || '#20ff50');
    const active = this.getActive();
    const immersive = document.body.classList.contains('immersive');
    const t = active ? this.getTime() : elapsed;
    const motion = this.reduceMotion ? 0 : t;
    const frequency = Number(config.target) || 6;
    const intensity = clamp(Number(config.intensity ?? 0.18), 0, 1);
    const motionSpeed = clamp(Number(config.motionSpeed ?? 1), 0.25, 2);
    const spread = clamp(Number(config.rippleSpread ?? 0.5), 0, 1);
    // A display cannot represent a rhythm at or above half its frame rate.
    const pulsing = active && config.pulseEnabled === true && frequency < this.frameRate / 2 && !this.reduceMotion;
    const phase = pulsing ? TAU * frequency * t : 0;
    const cx = this.width * 0.5;
    const cy = immersive ? this.height * 0.49 : this.mobile ? this.height * 0.28 : Math.min(this.height * 0.33, 330);
    const radius = immersive
      ? Math.min(this.width * 0.275, this.height * 0.335, 340)
      : this.mobile ? Math.min(this.width * 0.29, this.height * 0.18, 130) : Math.min(this.width * 0.22, this.height * 0.25, 270);
    const c = this.ctx;
    this.drawBackground(motion, cx, cy, radius, config.effect);

    c.globalCompositeOperation = 'screen';
    if (config.effect === 'stereo') {
      this.drawStereo(motion, cx, cy, radius, config, motionSpeed);
      this.finishFrame(now);
      return;
    }
    if (config.effect === 'stars') {
      this.drawShootingStars(t, frequency, active, intensity, motionSpeed);
      this.finishFrame(now);
      return;
    }
    if (config.effect === 'liquid') {
      this.drawLiquid(t, cx, cy, radius, frequency, pulsing, intensity, motionSpeed, spread, config);
      this.finishFrame(now);
      return;
    }
    this.drawOrbits(motion * motionSpeed, cx, cy, radius, config.effect, phase, pulsing ? intensity : 0);

    const flowingTime = motion * motionSpeed;
    const rotate = -0.38 + Math.sin(flowingTime * 0.08) * 0.08;
    const rzCos = Math.cos(rotate), rzSin = Math.sin(rotate);
    const tilt = 0.48 + Math.sin(flowingTime * 0.06) * 0.14;
    const rxCos = Math.cos(tilt), rxSin = Math.sin(tilt);
    const spin = flowingTime * 0.16;
    const data = this.particles;
    const particleScale = config.effect === 'orbits' ? 0.59 : 1;
    for (let i = 0; i < this.limit; i++) {
      const p = i * 7;
      const theta = data[p] + spin * (0.6 + data[p + 6] * 0.4);
      const phi = data[p + 1] + flowingTime * 0.32;
      const localWave = pulsing ? Math.cos(phase - data[p] * 3 - data[p + 2] * 8) * intensity : 0;
      const tube = data[p + 2] + localWave * 0.055;
      let x, y, z;
      if (data[p + 3] < 0.76) {
        // A toroidal cloud, broken into softly interwoven ribbons.
        const ring = 0.89 + tube * Math.cos(phi) + Math.sin(theta * 5 + flowingTime * 0.35) * 0.055 + localWave * 0.035;
        x = Math.cos(theta) * ring;
        y = Math.sin(theta) * ring;
        z = Math.sin(phi) * tube + Math.sin(theta * 3 + phi) * 0.025;
      } else if (data[p + 3] < 0.95) {
        // Fine internal filaments make the center feel like a weightless pearl.
        const r = Math.sqrt(data[p + 4]) * 0.74;
        x = Math.cos(theta) * r;
        y = Math.sin(theta) * r;
        z = Math.sin(phi + theta * 2) * (0.32 - r * 0.2);
      } else {
        // A sparse atmospheric fringe, never a hard edge.
        const r = 1.03 + data[p + 4] * 0.27;
        x = Math.cos(theta) * r;
        y = Math.sin(theta) * r;
        z = Math.sin(phi) * 0.19;
      }
      const yy = y * rxCos - z * rxSin;
      const zz = y * rxSin + z * rxCos;
      const xx = x * rzCos - yy * rzSin;
      const rotatedY = x * rzSin + yy * rzCos;
      const perspective = 3.5 / (3.5 - zz);
      const sx = cx + xx * radius * perspective;
      const sy = cy + rotatedY * radius * perspective;
      const depth = clamp((zz + 0.8) / 1.6, 0, 1);
      const shimmer = 0.86 + Math.sin(flowingTime * 0.4 + data[p + 5] * TAU) * 0.14;
      const density = data[p + 3] >= 0.76 && data[p + 3] < 0.95 ? 0.42 : data[p + 3] >= 0.95 ? 0.28 : 1;
      const brightness = clamp((0.09 + data[p + 5] * 0.64) * (0.35 + depth * 0.75) * shimmer * density * (1 + localWave * 0.8) * particleScale * 2, 0.02, 0.98);
      const paletteIndex = Math.floor(brightness * 23);
      const size = (0.55 + Math.pow(data[p + 4], 4) * 1.2) * perspective * (1 + localWave * 0.3);
      c.fillStyle = data[p + 5] > 0.58 ? this.palePalette[paletteIndex] : this.palette[paletteIndex];
      c.fillRect(sx, sy, size, size);
      if (data[p + 5] > 0.945 && depth > 0.46) {
        const glowSize = (5.0 + data[p + 4] * 5) * perspective;
        c.globalAlpha = brightness * 0.46;
        c.drawImage(this.sprite, sx - glowSize / 2, sy - glowSize / 2, glowSize, glowSize);
        c.globalAlpha = 1;
      }
    }

    if (config.effect === 'strobe' && pulsing) {
      // Explicit full-strength mode: 100% intensity can cover the whole
      // viewport with the selected color. Audio seconds define its phase.
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = strobeOpacityAt(frequency, t, intensity);
      c.fillStyle = `rgb(${this.rgb})`;
      c.fillRect(0, 0, this.width, this.height);
      c.globalAlpha = 1;
    }
    this.finishFrame(now);
  }

  finishFrame(now) {
    this.ctx.globalCompositeOperation = 'source-over';
    if (this.lastFrameTime && now - this.lastFrameTime < 100) {
      this.frameAverage = this.frameAverage * 0.97 + (now - this.lastFrameTime) * 0.03;
    }
    this.lastFrameTime = now;
    this.frameCount++;
    // Adapt only after warming up, excluding tab suspensions from the average.
    if (this.frameCount > 180 && this.frameCount % 120 === 0 && this.frameAverage > 25 && this.limit > 1200) {
      this.limit = Math.max(1200, Math.floor(this.limit * 0.84));
      this.waterQuality = Math.max(0.58, (this.waterQuality ?? 1) * 0.84);
      this.water = null;
    }
    this.frame = requestAnimationFrame(this.render);
  }
}
