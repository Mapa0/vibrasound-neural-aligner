const TAU = Math.PI * 2;

/** t is always expressed in seconds, using the same clock as the audio engine. */
export function opacityAt(frequency, t) {
  return 0.5 + 0.3 * Math.cos(TAU * frequency * t);
}

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export class CosmicVisualizer {
  constructor(canvas, { getTime, getConfig, getActive }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.getTime = getTime;
    this.getConfig = getConfig;
    this.getActive = getActive;
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
    const value = parseInt(match ? match[1] : 'b5a0ed', 16);
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

  drawBackground(t, cx, cy, radius) {
    const c = this.ctx, w = this.width, h = this.height;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#07090d';
    c.fillRect(0, 0, w, h);
    this.glow(cx + radius * 0.5, cy - radius * 0.12, radius * 2.4, 0.037);
    this.glow(cx - radius * 0.64, cy + radius * 0.64, radius * 1.65, 0.026, '71,112,137');
    c.globalCompositeOperation = 'screen';
    const drift = this.reduceMotion ? 0 : t;
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

  drawOrbits(t, cx, cy, radius, pulse, effect, phaseShift = 0) {
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
      const angle = t * (0.035 + k * 0.008) + k * 2.1 + phaseShift * 0.12;
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
        const x = Math.sin(a * 3 + t * 0.025 + layer * 0.18 + phaseShift * 0.09) * radius * 0.84;
        const y = Math.sin(a * 2 + layer * 0.18 - phaseShift * 0.09) * radius * 0.82;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = `rgba(${this.pale},${(0.12 + pulse * 0.1) / (layer + 1)})`;
      c.lineWidth = 0.6;
      c.stroke();
    }
    c.restore();
  }

  render(now) {
    if (!this.running) return;
    // performance.now() is converted once to seconds. Audio time is already seconds.
    const elapsed = now / 1000 - this.startedAt;
    const config = this.getConfig() || {};
    this.setColor(config.color || '#b5a0ed');
    const active = this.getActive();
    const immersive = document.body.classList.contains('immersive');
    const t = active ? this.getTime() : elapsed;
    const motion = this.reduceMotion ? 0 : t;
    const frequency = Number(config.target) || 6;
    const intensity = clamp(Number(config.intensity ?? 0.18), 0, 1);
    // A display cannot represent a rhythm at or above half its frame rate.
    const pulsing = active && config.pulseEnabled === true && frequency < this.frameRate / 2 && !this.reduceMotion;
    const envelope = pulsing ? opacityAt(frequency, t) : 0.5;
    const modulation = (envelope - 0.5) * intensity;
    const coherentPhase = pulsing ? Math.cos(TAU * frequency * t) * intensity : 0;
    const quadraturePhase = pulsing ? Math.sin(TAU * frequency * t) * intensity : 0;
    const cx = this.width * 0.5;
    const cy = immersive ? this.height * 0.49 : this.mobile ? this.height * 0.28 : Math.min(this.height * 0.33, 330);
    const radius = immersive
      ? Math.min(this.width * 0.275, this.height * 0.335, 340)
      : this.mobile ? Math.min(this.width * 0.29, this.height * 0.18, 130) : Math.min(this.width * 0.22, this.height * 0.25, 270);
    const animatedRadius = radius * (1 + 0.12 * coherentPhase);
    const c = this.ctx;
    this.drawBackground(motion, cx, cy, radius);

    c.globalCompositeOperation = 'screen';
    this.glow(cx, cy, radius * 1.1, 0.096 + modulation * 0.025);
    this.glow(cx - radius * 0.5, cy - radius * 0.44, radius * 0.7, 0.111);
    this.glow(cx + radius * 0.48, cy + radius * 0.36, radius * 0.7, 0.093);
    this.drawOrbits(motion, cx, cy, animatedRadius, envelope, config.effect, quadraturePhase);

    const rotate = -0.38 + Math.sin(motion * 0.018) * 0.05;
    const rzCos = Math.cos(rotate), rzSin = Math.sin(rotate);
    const tilt = 0.48 + Math.sin(motion * 0.022) * 0.095;
    const rxCos = Math.cos(tilt), rxSin = Math.sin(tilt);
    const spin = motion * 0.038;
    const data = this.particles;
    const globalBrightness = 1 + modulation * 0.75;
    const particleScale = config.effect === 'orbits' ? 0.59 : 1;
    for (let i = 0; i < this.limit; i++) {
      const p = i * 7;
      const theta = data[p] + spin * (0.6 + data[p + 6] * 0.4);
      const phi = data[p + 1] + motion * 0.065;
      const tube = data[p + 2];
      let x, y, z;
      if (data[p + 3] < 0.76) {
        // A toroidal cloud, broken into softly interwoven ribbons.
        const ring = 0.89 + tube * Math.cos(phi) + Math.sin(theta * 5 + motion * 0.04) * 0.025;
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
      const sx = cx + xx * animatedRadius * perspective;
      const sy = cy + rotatedY * animatedRadius * perspective;
      const depth = clamp((zz + 0.8) / 1.6, 0, 1);
      const shimmer = 0.86 + Math.sin(motion * 0.16 + data[p + 5] * TAU) * 0.14;
      const density = data[p + 3] >= 0.76 && data[p + 3] < 0.95 ? 0.42 : data[p + 3] >= 0.95 ? 0.28 : 1;
      const brightness = clamp((0.09 + data[p + 5] * 0.64) * (0.35 + depth * 0.75) * shimmer * density * globalBrightness * particleScale * 2, 0.02, 0.98);
      const paletteIndex = Math.floor(brightness * 23);
      const size = (0.55 + Math.pow(data[p + 4], 4) * 1.2) * perspective * (1 + modulation * 0.4);
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
      // A soft-edged local color layer uses the exact 20–80% envelope.
      // The independently selected intensity limits its luminous amplitude.
      const mask = c.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.75);
      mask.addColorStop(0, `rgba(${this.rgb},.28)`);
      mask.addColorStop(0.5, `rgba(${this.rgb},.11)`);
      mask.addColorStop(1, `rgba(${this.rgb},0)`);
      c.globalAlpha = envelope * intensity;
      c.fillStyle = mask;
      c.fillRect(cx - radius * 1.75, cy - radius * 1.75, radius * 3.5, radius * 3.5);
      c.globalAlpha = 1;
    }
    c.globalCompositeOperation = 'source-over';
    if (this.lastFrameTime && now - this.lastFrameTime < 100) {
      this.frameAverage = this.frameAverage * 0.97 + (now - this.lastFrameTime) * 0.03;
    }
    this.lastFrameTime = now;
    this.frameCount++;
    // Adapt only after warming up, excluding tab suspensions from the average.
    if (this.frameCount > 180 && this.frameCount % 120 === 0 && this.frameAverage > 25 && this.limit > 1200) {
      this.limit = Math.max(1200, Math.floor(this.limit * 0.84));
    }
    this.frame = requestAnimationFrame(this.render);
  }
}
