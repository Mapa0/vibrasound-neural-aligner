import { NeuroAudioEngine, validateConfig } from './audio-engine.js';
import { CosmicVisualizer } from './visualizer.js';
import { octaveColorForFrequency } from './octave-color.js';

const $ = id => document.getElementById(id);
const engine = new NeuroAudioEngine();
let session = null;
let ending = false;
let starting = false;
let hideTimer;
let toastTimer;
let wakeLock;
let muted = false;
let binauralModulation = false;
let mappedColor = octaveColorForFrequency(528);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const presets = { theta: { target: 6, carrier: 528 }, alpha: { target: 10, carrier: 432 }, delta: { target: 2, carrier: 396 } };
const bandFor = f => f < 4 ? 'Delta' : f < 8 ? 'Theta' : f < 13 ? 'Alpha' : f < 30 ? 'Beta' : 'Gamma';
const format = n => Number.isFinite(n) ? String(Number(n.toFixed(1))) : '—';
const clock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function currentConfig() {
  const carrier = Number($('carrier').value === 'custom' ? $('custom-carrier').value : $('carrier').value);
  if (Number.isFinite(carrier) && carrier > 0 && mappedColor.frequency !== carrier) mappedColor = octaveColorForFrequency(carrier);
  return {
    target: Number($('target').value), carrier,
    audioMode: $('audio-mode').value, binauralModulation,
    soundTexture: $('sound-texture').value,
    ambience: $('sound-texture').value === 'ethereal' ? Number($('ambience').value) / 100 : 0,
    color: mappedColor.hex, effect: $('effect').value,
    volume: Number($('volume').value) / 100,
    intensity: Number($('intensity').value) / 100,
    motionSpeed: Number($('flow-speed').value) / 100,
    rippleSpread: Number($('ripple-spread').value) / 100,
    pulseEnabled: $('pulse-enabled').checked,
    duration: Number($('duration').value) * 60,
    reducedMotion,
  };
}
const visualizer = new CosmicVisualizer($('cosmos'), {
  getTime: () => session ? engine.elapsed : performance.now() / 1000,
  getConfig: () => session ?? currentConfig(), getActive: () => !!session,
});
visualizer.start();

function saveSettings() {
  const { pulseEnabled, ...saved } = currentConfig();
  // Visual stimulation always requires a new opt-in after reloading.
  saved.uiVersion = 2;
  saved.ambience = Number($('ambience').value) / 100;
  try { localStorage.setItem('vibrasound-settings-v1', JSON.stringify(saved)); } catch { /* Optional storage. */ }
}
function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('vibrasound-settings-v1'));
    if (!saved) return;
    validateConfig(saved);
    if (saved.target >= .5 && saved.target <= 40) $('target').value = saved.target;
    if (saved.carrier >= 100 && saved.carrier <= 1500) {
      $('carrier').value = [...$('carrier').options].some(o => Number(o.value) === saved.carrier) ? String(saved.carrier) : 'custom';
      $('custom-carrier').value = saved.carrier;
    }
    if (['binaural', 'isochronic'].includes(saved.audioMode)) $('audio-mode').value = saved.audioMode;
    if (typeof saved.binauralModulation === 'boolean') binauralModulation = saved.binauralModulation;
    if (['pure', 'ethereal'].includes(saved.soundTexture)) $('sound-texture').value = saved.soundTexture;
    if (saved.uiVersion >= 2 && ['liquid', 'particles', 'orbits', 'strobe'].includes(saved.effect)) $('effect').value = saved.effect;
    if ([0, 600, 1200, 1800, 3600].includes(saved.duration)) $('duration').value = saved.duration / 60;
    for (const [key, id, minimum, maximum] of [
      ['volume', 'volume', 0, 100], ['intensity', 'intensity', 5, 60],
      ['motionSpeed', 'flow-speed', 25, 200], ['rippleSpread', 'ripple-spread', 0, 100],
      ['ambience', 'ambience', 0, 100],
    ]) if (Number.isFinite(saved[key])) $(id).value = Math.min(maximum, Math.max(minimum, saved[key] * 100));
  } catch { /* Invalid preferences fall back to defaults. */ }
}
function updateColor() {
  $('color-chip').style.background = mappedColor.hex;
  $('color-wavelength').textContent = `${mappedColor.wavelength.toFixed(1)} nm`;
  $('color-wavelength').setAttribute('aria-label', `Octave-derived color: ${mappedColor.wavelength.toFixed(1)} nanometers`);
  $('octave-detail').textContent = `${format(mappedColor.frequency)} Hz × 2^${mappedColor.octaves} → ${mappedColor.wavelength.toFixed(1)} nm`;
  const accent = mappedColor.rgb.map(channel => Math.round(channel * .32 + 225 * .68));
  document.documentElement.style.setProperty('--accent', `rgb(${accent.join(',')})`);
  document.documentElement.style.setProperty('--accent-rgb', accent.join(','));
  document.documentElement.style.setProperty('--frequency-color', mappedColor.hex);
}
function updateVisualStatus() {
  const target = Number($('target').value);
  const frameRate = visualizer.frameRate || 60;
  const unsupported = target >= frameRate / 2;
  $('pulse-enabled').disabled = reducedMotion || unsupported;
  if (reducedMotion || unsupported) $('pulse-enabled').checked = false;
  $('pulse-rate').textContent = reducedMotion ? 'Reduced motion is enabled on your device' : unsupported ? `${format(target)} Hz needs over ${format(target * 2)} FPS · continuous flow` : `${format(target)} cycles per second · audio clock`;
}
function update() {
  updateVisualStatus();
  const config = currentConfig();
  updateColor();
  $('band-name').textContent = bandFor(config.target).toUpperCase();
  $('binaural-modulation').disabled = config.audioMode !== 'binaural';
  $('binaural-modulation').checked = config.audioMode === 'isochronic' || binauralModulation;
  $('modulation-rate').textContent = config.audioMode === 'isochronic' ? `${format(config.target)} Hz · always on in Isochronic` : `${format(config.target)} Hz pulses · optional`;
  $('custom-carrier').hidden = $('carrier').value !== 'custom';
  $('audio-help').textContent = config.audioMode === 'binaural' ? 'Stereo headphones' : 'Headphones or speakers';
  $('effect-help').textContent = config.effect === 'strobe' ? (config.pulseEnabled ? 'Rhythmic light enabled' : 'Enable visual sync in Fine tuning') : config.effect === 'orbits' ? 'Flowing harmonic paths' : config.effect === 'liquid' ? 'Flowing ripples and interference' : 'A field of flowing light';
  $('strobe-warning').hidden = config.effect !== 'strobe' || config.pulseEnabled;
  $('volume-value').textContent = `${$('volume').value}%`;
  $('intensity-value').textContent = `${$('intensity').value}%`;
  $('flow-value').textContent = `${config.motionSpeed.toFixed(2)}×`;
  $('spread-value').textContent = `${$('ripple-spread').value}%`;
  $('ambience-value').textContent = `${$('ambience').value}%`;
  $('ambience-control').hidden = config.soundTexture !== 'ethereal';
  $('target-help').textContent = `${format(config.target)} cycles per second`;
  document.querySelectorAll('input[type="range"]').forEach(input => {
    const progress = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.setProperty('--range-progress', `${progress}%`);
  });
  document.querySelectorAll('[data-preset]').forEach(button => {
    const preset = presets[button.dataset.preset];
    const active = preset.target === config.target && preset.carrier === config.carrier;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('form-error').hidden = true;
  saveSettings();
}
function showToast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}
function showError(message) { $('form-error').textContent = message; $('form-error').hidden = false; }
function setFineSettings(open) { $('fine-panel').hidden = !open; document.querySelector('.fine-settings').setAttribute('aria-expanded', String(open)); }
function revealControls() {
  if (!session) return;
  document.body.classList.remove('controls-hidden'); clearTimeout(hideTimer);
  if (engine.state === 'running') hideTimer = setTimeout(() => {
    if (!document.querySelector('.session-ui :focus-visible')) document.body.classList.add('controls-hidden');
  }, 3800);
}
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* Optional. */ }
}
async function releaseWakeLock() {
  try { await wakeLock?.release(); } catch { /* The browser may already have released it. */ }
  wakeLock = null;
}
async function startSession() {
  if (starting || session) return;
  updateVisualStatus();
  const config = currentConfig();
  if (!$('target').checkValidity() || !$('target').value) return showError('Choose a rhythm between 0.5 and 40 Hz.');
  if (config.carrier < 100 || config.carrier > 1500 || !Number.isFinite(config.carrier)) return showError('Choose a base frequency between 100 and 1,500 Hz.');
  if (config.effect === 'strobe' && !config.pulseEnabled) { setFineSettings(true); return showError('Soft strobe needs visual sync. Read the light warning before enabling it, or choose a flowing visualizer.'); }
  starting = true; $('start').disabled = true;
  try {
    await engine.start(config); session = { ...config }; muted = false;
    $('session-mute').style.opacity = '1'; $('session-mute').setAttribute('aria-label', 'Mute');
    $('session-frequency').innerHTML = `${format(config.carrier)} Hz <i>·</i> ${format(config.target)} Hz`;
    $('session-mode').textContent = `${config.audioMode === 'binaural' ? 'BINAURAL' + (config.binauralModulation ? ' + MODULATION' : '') : 'ISOCHRONIC'} · ${config.soundTexture === 'ethereal' ? 'ETHEREAL' : bandFor(config.target).toUpperCase()}`;
    $('session-duration').textContent = config.duration ? `OF ${clock(config.duration)}` : 'UNLIMITED';
    $('session-clock').textContent = '00:00'; $('session-ui').hidden = false; $('reveal-controls').hidden = false;
    document.body.classList.add('immersive'); updatePlaybackUI(); visualizer.resize?.(); revealControls();
    await requestWakeLock();
    try {
      if ('mediaSession' in navigator) {
        if (typeof MediaMetadata === 'function') navigator.mediaSession.metadata = new MediaMetadata({ title: 'Design your frequency', artist: 'Vibrasound', album: `${config.carrier} Hz · ${config.target} Hz` });
        navigator.mediaSession.setActionHandler('pause', () => togglePause());
        navigator.mediaSession.setActionHandler('play', () => { if (engine.state !== 'running') togglePause(); });
        navigator.mediaSession.setActionHandler('stop', () => endSession());
      }
    } catch { /* System media controls are optional. */ }
  } catch (error) {
    if (session) await endSession();
    else { try { await engine.stop(); } catch { /* Preserve the original error. */ } }
    showError('Audio could not start. Check your sound output and try again.'); console.error('Audio startup failed', error);
  } finally { starting = false; $('start').disabled = false; }
}
function updatePlaybackUI() {
  const paused = engine.state !== 'running';
  $('pause').setAttribute('aria-label', paused ? 'Resume session' : 'Pause session');
  $('pause').innerHTML = paused ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
  $('session-state').innerHTML = `<span class="footer-dot"></span> ${paused ? 'PLAYBACK PAUSED' : 'FREQUENCY IN MOTION'}`;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = paused ? 'paused' : 'playing';
}
async function togglePause() {
  if (!session || ending || $('pause').disabled) return;
  $('pause').disabled = true;
  try {
    if (engine.state === 'running') { await engine.pause(); await releaseWakeLock(); }
    else { await engine.resume(); await requestWakeLock(); }
    updatePlaybackUI(); revealControls();
  } catch { showToast('Select resume to continue the audio.'); }
  finally { $('pause').disabled = false; }
}
async function endSession(completed = false) {
  if (!session || ending) return;
  ending = true; clearTimeout(hideTimer);
  try { await engine.stop(); } catch { /* Always restore the controls. */ }
  session = null; document.body.classList.remove('immersive', 'controls-hidden');
  $('session-ui').hidden = true; $('reveal-controls').hidden = true; await releaseWakeLock();
  if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* Already exited. */ } }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  visualizer.resize?.(); $('start').focus({ preventScroll: true }); ending = false;
  if (completed) showToast('Your frequency session is complete.');
}

document.querySelectorAll('.about-trigger').forEach(button => button.addEventListener('click', () => $('about-dialog').showModal()));
$('close-about').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', event => {
  if (event.target !== $('about-dialog')) return;
  const r = event.target.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close();
});
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
  const preset = presets[button.dataset.preset]; $('target').value = preset.target; $('carrier').value = preset.carrier; update();
}));
document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
  const current = Number($('target').value) || 6;
  $('target').value = Math.min(40, Math.max(.5, Math.round((current + Number(button.dataset.step) * .5) * 10) / 10)); update();
}));
$('binaural-modulation').addEventListener('input', () => { binauralModulation = $('binaural-modulation').checked; update(); });
for (const id of ['target','carrier','custom-carrier','audio-mode','effect','duration','volume','intensity','pulse-enabled','sound-texture','ambience','flow-speed','ripple-spread']) $(id).addEventListener('input', update);
document.querySelector('.fine-settings').addEventListener('click', () => setFineSettings($('fine-panel').hidden));
$('start').addEventListener('click', startSession); $('pause').addEventListener('click', togglePause);
$('exit-session').addEventListener('click', () => endSession()); $('reveal-controls').addEventListener('click', revealControls);
$('session-mute').addEventListener('click', () => {
  if (!session) return;
  muted = !muted; engine.setVolume(muted ? 0 : session.volume);
  $('session-mute').setAttribute('aria-label', muted ? 'Unmute' : 'Mute'); $('session-mute').style.opacity = muted ? '.4' : '1'; revealControls();
});
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else showToast('Use the fullscreen option in your browser.');
  } catch { showToast('Fullscreen is unavailable in this browser.'); }
  revealControls();
});
document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));
document.addEventListener('pointermove', revealControls, { passive: true }); document.addEventListener('focusin', revealControls);
document.addEventListener('keydown', event => {
  if (!session || event.target.matches('input, select, textarea')) return;
  if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  if (event.code === 'Escape') { event.preventDefault(); endSession(); }
  revealControls();
});
document.addEventListener('visibilitychange', async () => {
  if (!session) return;
  if (document.hidden && engine.state === 'running') await togglePause();
  else if (!document.hidden) { updatePlaybackUI(); revealControls(); }
});
window.addEventListener('pagehide', () => { engine.stop().catch(() => {}); releaseWakeLock(); });
setInterval(() => {
  if (!session) { updateVisualStatus(); return; }
  if (ending) return;
  const elapsed = engine.elapsed; $('session-clock').textContent = clock(elapsed);
  if (session.duration && elapsed >= session.duration) endSession(true);
}, 200);
restoreSettings(); update();
