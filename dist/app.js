import { NeuroAudioEngine, validateConfig } from './audio-engine.js';
import { CosmicVisualizer } from './visualizer.js';
import { octaveColorForFrequency } from './octave-color.js';
import { getReferenceChantPitch } from './chant-engine.js';
import { CHAKRA_PRESETS, SOLFEGGIO_PRESETS, getMusicalPresets, MYSTIC_CONTEXT, MUSICAL_TUNINGS } from './mystic-presets.js';

const $ = id => document.getElementById(id);
const engine = new NeuroAudioEngine();
let session = null;
let ending = false;
let starting = false;
let hideTimer;
let toastTimer;
let wakeLock;
let muted = false;
let experienceMode = 'science';
let mysticFamily = 'chakras';
let mysticPresetId = 'muladhara';
let selectedChant = 'MMM';
let modeBeforeNatural = 'binaural';
let naturalWasActive = false;
let scienceSnapshot = null;
let mysticRenderKey = '';
const musicalCache = { c256: getMusicalPresets('c256'), a432: getMusicalPresets('a432') };
let binauralModulation = false;
let mappedColor = octaveColorForFrequency(528);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const presets = { theta: { target: 6, carrier: 528 }, alpha: { target: 10, carrier: 432 }, delta: { target: 2, carrier: 396 }, gamma: { target: 40, carrier: 528 } };
const bandFor = f => f < 4 ? 'Delta' : f < 8 ? 'Theta' : f < 13 ? 'Alpha' : f < 30 ? 'Beta' : 'Gamma';
const format = n => Number.isFinite(n) ? String(Number(n.toFixed(3))) : '—';
const clock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function currentConfig() {
  const baseFrequency = Number($('carrier').value === 'custom' ? $('custom-carrier').value : $('carrier').value);
  const chantUseBaseFrequency = $('chant-use-base').checked;
  const natural = $('sound-texture').value === 'chants' && !chantUseBaseFrequency;
  const carrier = natural ? getReferenceChantPitch(selectedChant) : baseFrequency;
  if (Number.isFinite(carrier) && carrier > 0 && mappedColor.frequency !== carrier) mappedColor = octaveColorForFrequency(carrier);
  return {
    target: Number($('target').value), carrier, baseFrequency,
    audioMode: natural ? 'isochronic' : $('audio-mode').value,
    binauralModulation: !natural && $('audio-mode').value === 'binaural' && binauralModulation,
    chantUseBaseFrequency, tunedAudioMode: natural ? modeBeforeNatural : $('audio-mode').value,
    tunedBinauralModulation: binauralModulation,
    soundTexture: $('sound-texture').value,
    chant: selectedChant, experienceMode,
    ambience: $('sound-texture').value === 'ethereal' ? Number($('ambience').value) / 100 : 0,
    color: experienceMode === 'mystic' && mysticFamily === 'chakras' ? activeMysticPreset().color : mappedColor.hex, effect: $('effect').value,
    volume: Number($('volume').value) / 100,
    intensity: Number($('intensity').value) / 100,
    motionSpeed: Number($('flow-speed').value) / 100,
    rippleSpread: Number($('ripple-spread').value) / 100,
    liquidLeftGain: Number($('liquid-left-gain').value) / 100,
    liquidRightGain: Number($('liquid-right-gain').value) / 100,
    liquidSeparation: Number($('liquid-separation').value) / 100,
    pulseEnabled: $('pulse-enabled').checked,
    duration: Number($('duration').value) * 60,
    reducedMotion,
  };
}
const visualizer = new CosmicVisualizer($('cosmos'), {
  getTime: () => session ? engine.elapsed : performance.now() / 1000,
  getConfig: () => session ?? currentConfig(), getActive: () => !!session,
  getAudioData: () => engine.getStereoSnapshot?.(),
});
visualizer.start();

function saveSettings() {
  if (experienceMode === 'science') scienceSnapshot = currentConfig();
  const { pulseEnabled, ...saved } = scienceSnapshot ?? currentConfig();
  // Visual stimulation always requires a new opt-in after reloading.
  saved.uiVersion = 4;
  saved.ambience = Number($('ambience').value) / 100;
  saved.chant = selectedChant;
  saved.mysticFamily = mysticFamily;
  saved.mysticPresetId = mysticPresetId;
  saved.musicalTuning = $('musical-tuning').value;
  try { localStorage.setItem('vibrasound-settings-v1', JSON.stringify(saved)); } catch { /* Optional storage. */ }
}
function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('vibrasound-settings-v1'));
    if (!saved) return;
    validateConfig(saved);
    if (saved.target >= .5 && saved.target <= 40) $('target').value = saved.target;
    const baseFrequency = saved.baseFrequency ?? saved.carrier;
    if (baseFrequency >= 100 && baseFrequency <= 1500) {
      setCarrier(baseFrequency);
    }
    const tunedAudioMode = saved.tunedAudioMode ?? saved.audioMode;
    if (['binaural', 'isochronic', 'tone'].includes(tunedAudioMode)) $('audio-mode').value = tunedAudioMode;
    if (typeof saved.binauralModulation === 'boolean') binauralModulation = saved.tunedBinauralModulation ?? saved.binauralModulation;
    if (typeof saved.chantUseBaseFrequency === 'boolean') $('chant-use-base').checked = saved.chantUseBaseFrequency;
    if (['pure', 'ethereal', 'chants'].includes(saved.soundTexture)) $('sound-texture').value = saved.soundTexture;
    if (['MMM','VAM','III','EEE','OOO','UUU','AAA'].includes(saved.chant)) selectedChant = saved.chant;
    if (saved.uiVersion >= 4 && ['liquid', 'particles', 'orbits', 'stars','strobe'].includes(saved.effect)) $('effect').value = saved.effect;
    if (['chakras','solfeggio','notes'].includes(saved.mysticFamily)) mysticFamily = saved.mysticFamily;
    if (typeof saved.mysticPresetId === 'string') mysticPresetId = saved.mysticPresetId;
    if (['c256','a432'].includes(saved.musicalTuning)) $('musical-tuning').value = saved.musicalTuning;
    if ([0, 600, 1200, 1800, 3600].includes(saved.duration)) $('duration').value = saved.duration / 60;
    for (const [key, id, minimum, maximum] of [
      ['volume', 'volume', 0, 100], ['intensity', 'intensity', 5, 100],
      ['motionSpeed', 'flow-speed', 25, 200], ['rippleSpread', 'ripple-spread', 0, 100],
      ['ambience', 'ambience', 0, 100],
      ['liquidLeftGain', 'liquid-left-gain', 0, 150], ['liquidRightGain', 'liquid-right-gain', 0, 150], ['liquidSeparation', 'liquid-separation', 0, 100],
    ]) if (Number.isFinite(saved[key])) $(id).value = Math.min(maximum, Math.max(minimum, saved[key] * 100));
  } catch { /* Invalid preferences fall back to defaults. */ }
}
function mysticPresets() {
  return mysticFamily === 'chakras' ? CHAKRA_PRESETS : mysticFamily === 'solfeggio' ? SOLFEGGIO_PRESETS : musicalCache[$('musical-tuning').value];
}
function activeMysticPreset() {
  const list = mysticPresets();
  return list.find(preset => preset.id === mysticPresetId) ?? list[0];
}
function setCarrier(value) {
  $('carrier').value = [...$('carrier').options].some(option => Math.abs(Number(option.value) - value) < 1e-9) ? String(value) : 'custom';
  $('custom-carrier').value = String(value);
}
function applyFormConfig(config) {
  naturalWasActive = false;
  setCarrier(config.baseFrequency ?? config.carrier);
  $('target').value = config.target;
  $('audio-mode').value = config.tunedAudioMode ?? config.audioMode;
  $('sound-texture').value = config.soundTexture;
  $('chant-use-base').checked = config.chantUseBaseFrequency ?? true;
  binauralModulation = !!(config.tunedBinauralModulation ?? config.binauralModulation);
  selectedChant = config.chant ?? selectedChant;
  if (config.effect) $('effect').value = config.effect;
  for (const [key, id] of [['volume','volume'],['intensity','intensity'],['motionSpeed','flow-speed'],['rippleSpread','ripple-spread'],['liquidLeftGain','liquid-left-gain'],['liquidRightGain','liquid-right-gain'],['liquidSeparation','liquid-separation']]) {
    if (Number.isFinite(config[key])) $(id).value = config[key] * 100;
  }
  $('duration').value = config.duration / 60;
  $('pulse-enabled').checked = !!config.pulseEnabled;
}
function applyMysticPreset(preset) {
  naturalWasActive = false;
  mysticPresetId = preset.id;
  setCarrier(preset.carrier);
  $('target').value = preset.target;
  $('audio-mode').value = preset.audioMode;
  if (preset.audioMode === 'tone') {
    $('sound-texture').value = 'pure';
    binauralModulation = false;
  }
  update();
}
function setExperienceMode(mode) {
  if (mode === experienceMode) return;
  if (mode === 'mystic') {
    scienceSnapshot = currentConfig();
    experienceMode = mode;
    applyMysticPreset(activeMysticPreset());
  } else {
    experienceMode = 'science';
    if (scienceSnapshot) applyFormConfig(scienceSnapshot);
    update();
  }
}
function updateMysticPanel(config) {
  const mystic = experienceMode === 'mystic';
  $('mystic-panel').hidden = !mystic;
  document.querySelector('.presets').hidden = mystic;
  $('mode-caption').textContent = mystic ? 'Symbol, sound and tradition' : 'Sound, measured and shaped';
  document.querySelectorAll('[data-experience]').forEach(button => {
    const selected = button.dataset.experience === experienceMode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (!mystic) return;
  document.querySelectorAll('[data-family]').forEach(button => {
    const selected = button.dataset.family === mysticFamily;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('musical-tuning').hidden = mysticFamily !== 'notes';
  const key = `${mysticFamily}:${$('musical-tuning').value}`;
  if (key !== mysticRenderKey) {
    mysticRenderKey = key;
    $('mystic-presets').replaceChildren(...mysticPresets().map(preset => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.mysticPreset = preset.id;
      button.style.setProperty('--preset-color', preset.color);
      button.title = preset.description;
      const dot = document.createElement('i'); dot.setAttribute('aria-hidden','true');
      const label = document.createElement('span'); label.textContent = preset.label;
      const subtitle = document.createElement('small'); subtitle.textContent = preset.subtitle;
      button.append(dot,label,subtitle);
      return button;
    }));
  }
  const selectedPreset = activeMysticPreset();
  document.querySelectorAll('[data-mystic-preset]').forEach(button => {
    const selected = button.dataset.mysticPreset === selectedPreset.id && Math.abs(config.carrier - selectedPreset.carrier) < 1e-8 && config.target === selectedPreset.target;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('mystic-context').textContent = MYSTIC_CONTEXT[mysticFamily];
  $('mystic-selection').textContent = mysticFamily === 'notes' ? `${selectedPreset.label} · ${format(config.carrier)} Hz · ${MUSICAL_TUNINGS[$('musical-tuning').value].description}` : selectedPreset.description;
}
function updateColor(config) {
  const symbolic = experienceMode === 'mystic' && mysticFamily === 'chakras';
  const preset = symbolic ? activeMysticPreset() : null;
  const color = preset?.color ?? mappedColor.hex;
  $('color-chip').style.background = color;
  $('color-label').textContent = symbolic ? 'CHAKRA COLOR' : 'OCTAVE COLOR';
  $('color-kind').textContent = symbolic ? 'SYMBOLIC' : 'AUTO';
  $('color-wavelength').textContent = symbolic ? preset.subtitle : `${mappedColor.wavelength.toFixed(1)} nm`;
  $('color-wavelength').setAttribute('aria-label', symbolic ? `${preset.label} symbolic color` : `Octave-derived color: ${mappedColor.wavelength.toFixed(1)} nanometers`);
  $('octave-detail').textContent = symbolic ? `${preset.label} · ${preset.color}` : `${format(mappedColor.frequency)} Hz × 2^${mappedColor.octaves} → ${mappedColor.wavelength.toFixed(1)} nm`;
  const natural = config.soundTexture === 'chants' && !config.chantUseBaseFrequency;
  $('color-explanation').textContent = symbolic ? 'A symbolic chakra palette for Mystic Mode.' : natural ? 'Octave mapping of the recording’s estimated pitch.' : 'A visible-spectrum mapping of your base tone.';
  document.querySelector('.frequency-color').title = natural ? 'The recording’s estimated pitch, shifted into the visible spectrum by octaves' : 'The base frequency, shifted into the visible spectrum by octaves';
  const rgb = symbolic ? [1,3,5].map(offset => parseInt(color.slice(offset,offset+2),16)) : mappedColor.rgb;
  const accent = rgb.map(channel => Math.round(channel * .32 + 225 * .68));
  document.documentElement.style.setProperty('--accent', `rgb(${accent.join(',')})`);
  document.documentElement.style.setProperty('--accent-rgb', accent.join(','));
  document.documentElement.style.setProperty('--frequency-color', color);
}
function updateVisualStatus() {
  const target = Number($('target').value);
  const effect = $('effect').value;
  $('pulse-enabled').closest('.pulse-control').hidden = effect === 'stars';
  if (effect === 'stars') {
    $('pulse-enabled').disabled = true;
    $('pulse-enabled').checked = false;
    $('pulse-rate').textContent = reducedMotion ? 'Reduced motion · static sky' : `${format(target)} stars per second · audio clock`;
    return;
  }
  const frameRate = visualizer.frameRate || 60;
  const unsupported = target >= frameRate / 2;
  $('pulse-enabled').disabled = reducedMotion || unsupported;
  if (reducedMotion || unsupported) $('pulse-enabled').checked = false;
  $('pulse-rate').textContent = reducedMotion ? 'Reduced motion is enabled on your device' : unsupported ? `${format(target)} Hz needs over ${format(target * 2)} FPS · continuous flow` : `${format(target)} cycles per second · audio clock`;
}
function syncNaturalControls() {
  const natural = $('sound-texture').value === 'chants' && !$('chant-use-base').checked;
  if (natural && !naturalWasActive) modeBeforeNatural = $('audio-mode').value;
  if (natural) $('audio-mode').value = 'isochronic';
  else if (naturalWasActive) $('audio-mode').value = modeBeforeNatural;
  naturalWasActive = natural;
  for (const id of ['carrier','custom-carrier','audio-mode']) $(id).disabled = natural;
}
function update() {
  syncNaturalControls();
  updateVisualStatus();
  const config = currentConfig();
  const natural = config.soundTexture === 'chants' && !config.chantUseBaseFrequency;
  updateColor(config);
  updateMysticPanel(config);
  $('band-name').textContent = bandFor(config.target).toUpperCase();
  $('binaural-modulation').disabled = config.audioMode !== 'binaural';
  $('binaural-modulation').checked = config.audioMode === 'isochronic' || (config.audioMode === 'binaural' && binauralModulation);
  $('modulation-rate').textContent = natural ? `${format(config.target)} Hz · natural voice volume pulses` : config.audioMode === 'isochronic' ? `${format(config.target)} Hz · always on in Isochronic` : config.audioMode === 'tone' ? 'Continuous carrier · no volume pulses' : `${format(config.target)} Hz pulses · optional`;
  $('custom-carrier').hidden = $('carrier').value !== 'custom';
  $('audio-help').textContent = natural ? 'Original pitch · same voice in both ears' : config.audioMode === 'binaural' ? 'Stereo headphones' : config.audioMode === 'tone' ? 'The same base tone in both channels' : 'Headphones or speakers';
  $('base-help').textContent = natural ? `Bypassed · voice ≈ ${format(config.carrier)} Hz` : 'The tone and its octave color';
  const visualHelp = { liquid: 'Left and right sources · liquid surface', stars: `${format(config.target)} new stars per second`, particles: 'A field of flowing light', orbits: 'Flowing harmonic paths', strobe: config.pulseEnabled ? 'Rhythmic light enabled · up to 100%' : 'Enable visual sync in Fine tuning' };
  $('effect-help').textContent = visualHelp[config.effect];
  $('strobe-warning').hidden = config.effect !== 'strobe' || config.pulseEnabled;
  $('volume-value').textContent = `${$('volume').value}%`;
  $('intensity-value').textContent = `${$('intensity').value}%`;
  $('flow-value').textContent = `${config.motionSpeed.toFixed(2)}×`;
  $('spread-value').textContent = `${$('ripple-spread').value}%`;
  const leftHz = config.audioMode === 'binaural' ? config.carrier - config.target / 2 : config.carrier;
  const rightHz = config.audioMode === 'binaural' ? config.carrier + config.target / 2 : config.carrier;
  $('liquid-left-frequency').textContent = `${natural ? '≈ ' : ''}${format(leftHz)} Hz`;
  $('liquid-right-frequency').textContent = `${natural ? '≈ ' : ''}${format(rightHz)} Hz`;
  $('liquid-left-value').textContent = `${$('liquid-left-gain').value}%`;
  $('liquid-right-value').textContent = `${$('liquid-right-gain').value}%`;
  $('liquid-spacing-value').textContent = `${$('liquid-separation').value}%`;
  for (const id of ['liquid-left-control','liquid-right-control','liquid-spacing-control']) $(id).hidden = config.effect !== 'liquid';
  $('ambience-value').textContent = `${$('ambience').value}%`;
  $('ambience-control').hidden = config.soundTexture !== 'ethereal';
  $('chant-controls').hidden = config.soundTexture !== 'chants';
  document.querySelector('.chant-note').textContent = natural ? `Original recording · natural pitch · ${format(config.target)} Hz modulation${selectedChant === 'VAM' ? ' · articulated V → A → M' : ''}` : selectedChant === 'VAM' ? 'Your recorded V → A → M · articulated phrase' : 'Your recorded voice, tuned and sustained';
  document.querySelectorAll('[data-chant]').forEach(button => {
    const selected = button.dataset.chant === selectedChant;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('target-help').textContent = config.audioMode === 'tone' ? `${format(config.target)} Hz · visual rhythm` : `${format(config.target)} cycles per second`;
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
  const natural = config.soundTexture === 'chants' && !config.chantUseBaseFrequency;
  if (!natural && (config.carrier < 100 || config.carrier > 1500 || !Number.isFinite(config.carrier))) return showError('Choose a base frequency between 100 and 1,500 Hz.');
  if (config.effect === 'strobe' && !config.pulseEnabled) { setFineSettings(true); return showError('Soft strobe needs visual sync. Read the light warning before enabling it, or choose a flowing visualizer.'); }
  starting = true; $('start').disabled = true;
  const startLabel = $('start').querySelector('span');
  startLabel.textContent = config.soundTexture === 'chants' ? 'Preparing your voice…' : 'Starting…';
  try {
    await engine.start(config); session = { ...config }; muted = false;
    $('session-mute').style.opacity = '1'; $('session-mute').setAttribute('aria-label', 'Mute');
    $('session-frequency').innerHTML = `${natural ? selectedChant + ' · natural pitch' : format(config.carrier) + ' Hz'} <i>·</i> ${format(config.target)} Hz`;
    $('session-mode').textContent = `${natural ? 'NATURAL VOICE + MODULATION' : config.audioMode === 'binaural' ? 'BINAURAL' + (config.binauralModulation ? ' + MODULATION' : '') : config.audioMode === 'tone' ? 'SINGLE TONE' : 'ISOCHRONIC'} · ${config.soundTexture === 'chants' ? selectedChant + ' CHANT' : config.soundTexture === 'ethereal' ? 'ETHEREAL' : bandFor(config.target).toUpperCase()}`;
    $('session-duration').textContent = config.duration ? `OF ${clock(config.duration)}` : 'UNLIMITED';
    $('session-clock').textContent = '00:00'; $('session-ui').hidden = false; $('reveal-controls').hidden = false;
    document.body.classList.add('immersive'); updatePlaybackUI(); visualizer.resize?.(); revealControls();
    await requestWakeLock();
    try {
      if ('mediaSession' in navigator) {
        if (typeof MediaMetadata === 'function') navigator.mediaSession.metadata = new MediaMetadata({ title: 'Design your frequency', artist: 'Vibrasound', album: `${natural ? selectedChant + ' · natural pitch' : config.carrier + ' Hz'} · ${config.target} Hz` });
        navigator.mediaSession.setActionHandler('pause', () => togglePause());
        navigator.mediaSession.setActionHandler('play', () => { if (engine.state !== 'running') togglePause(); });
        navigator.mediaSession.setActionHandler('stop', () => endSession());
      }
    } catch { /* System media controls are optional. */ }
  } catch (error) {
    if (session) await endSession();
    else { try { await engine.stop(); } catch { /* Preserve the original error. */ } }
    showError(config.soundTexture === 'chants' ? 'The recorded voice could not be prepared. Please try again.' : 'Audio could not start. Check your sound output and try again.'); console.error('Audio startup failed', error);
  } finally { starting = false; $('start').disabled = false; startLabel.textContent = 'Start listening'; }
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
document.querySelectorAll('[data-experience]').forEach(button => button.addEventListener('click', () => setExperienceMode(button.dataset.experience)));
document.querySelectorAll('[data-family]').forEach(button => button.addEventListener('click', () => {
  mysticFamily = button.dataset.family;
  applyMysticPreset(mysticPresets()[0]);
}));
$('mystic-presets').addEventListener('click', event => {
  const button = event.target.closest('[data-mystic-preset]');
  if (!button) return;
  const preset = mysticPresets().find(item => item.id === button.dataset.mysticPreset);
  if (preset) applyMysticPreset(preset);
});
$('musical-tuning').addEventListener('input', () => applyMysticPreset(activeMysticPreset()));
document.querySelectorAll('[data-chant]').forEach(button => button.addEventListener('click', () => { selectedChant = button.dataset.chant; update(); }));
document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
  const current = Number($('target').value) || 6;
  $('target').value = Math.min(40, Math.max(.5, Math.round((current + Number(button.dataset.step) * .5) * 10) / 10)); update();
}));
$('binaural-modulation').addEventListener('input', () => { binauralModulation = $('binaural-modulation').checked; update(); });
for (const id of ['target','carrier','custom-carrier','audio-mode','effect','duration','volume','intensity','pulse-enabled','sound-texture','ambience','chant-use-base','flow-speed','ripple-spread','liquid-left-gain','liquid-right-gain','liquid-separation']) $(id).addEventListener('input', update);
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
  // Hiding a tab never pauses the audio. It continues on the native audio clock.
  if (document.hidden) { clearTimeout(hideTimer); await releaseWakeLock(); return; }
  if (engine.state === 'running') await requestWakeLock();
  updatePlaybackUI(); revealControls();
});
window.addEventListener('pagehide', () => { engine.stop().catch(() => {}); releaseWakeLock(); });
setInterval(() => {
  if (!session) { updateVisualStatus(); return; }
  if (ending) return;
  const elapsed = engine.elapsed; $('session-clock').textContent = clock(elapsed);
  if (session.duration && elapsed >= session.duration) endSession(true);
}, 200);
restoreSettings(); update();
