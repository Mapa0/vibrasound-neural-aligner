import { NeuroAudioEngine, validateConfig } from './audio-engine.js';
import { CosmicVisualizer } from './visualizer.js';

const $ = (id) => document.getElementById(id);
const engine = new NeuroAudioEngine();
let session = null;
let ending = false;
let starting = false;
let hideTimer;
let toastTimer;
let wakeLock;
let muted = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const presets = { theta: { target: 6, carrier: 528 }, alpha: { target: 10, carrier: 432 }, delta: { target: 2, carrier: 396 } };
const bandFor = (f) => f < 4 ? 'Delta' : f < 8 ? 'Theta' : f < 13 ? 'Alpha' : f < 30 ? 'Beta' : 'Gamma';
const format = (n) => Number.isFinite(n) ? String(Number(n.toFixed(1))) : '—';
const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function currentConfig() {
  return {
    target: Number($('target').value),
    carrier: Number($('carrier').value === 'custom' ? $('custom-carrier').value : $('carrier').value),
    audioMode: $('audio-mode').value,
    binauralModulation: $('binaural-modulation').checked,
    color: $('color').value,
    effect: $('effect').value,
    volume: Number($('volume').value) / 100,
    intensity: Number($('intensity').value) / 100,
    pulseEnabled: $('pulse-enabled').checked,
    duration: Number($('duration').value) * 60,
    reducedMotion,
  };
}

const visualizer = new CosmicVisualizer($('cosmos'), {
  getTime: () => session ? engine.elapsed : performance.now() / 1000,
  getConfig: () => session ?? currentConfig(),
  getActive: () => !!session,
});
visualizer.start();

function saveSettings() {
  const config = currentConfig();
  // Pulsing light always starts disabled, even after a previous opt-in.
  const { pulseEnabled, ...saved } = config;
  try { localStorage.setItem('vibrasound-settings-v1', JSON.stringify(saved)); } catch { /* Storage is optional. */ }
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
    if (typeof saved.binauralModulation === 'boolean') $('binaural-modulation').checked = saved.binauralModulation;
    if (['particles', 'orbits', 'strobe'].includes(saved.effect)) $('effect').value = saved.effect;
    if (/^#[0-9a-f]{6}$/i.test(saved.color)) setColor(saved.color);
    if ([0, 600, 1200, 1800, 3600].includes(saved.duration)) $('duration').value = saved.duration / 60;
    if (Number.isFinite(saved.volume)) $('volume').value = Math.min(100, Math.max(0, saved.volume * 100));
    if (Number.isFinite(saved.intensity)) $('intensity').value = Math.min(60, Math.max(5, saved.intensity * 100));
  } catch { /* Malformed or old preferences fall back to defaults. */ }
}
function setColor(color) {
  $('color').value = color;
  document.documentElement.style.setProperty('--accent', color);
  document.querySelectorAll('.swatch').forEach(button => {
    const selected = button.dataset.color.toLowerCase() === color.toLowerCase();
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function update() {
  const config = currentConfig();
  const band = bandFor(config.target);
  $('band-name').textContent = band.toUpperCase();
  updateVisualStatus();
  $('modulation-rate').textContent = `Pulsos de volume a ${format(config.target)} Hz`;
  $('modulation-control').hidden = config.audioMode !== 'binaural';
  $('custom-carrier').hidden = $('carrier').value !== 'custom';
  $('audio-help').innerHTML = config.audioMode === 'binaural' ? '<svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Z"/></svg> Para ouvir com fones' : 'Para fones ou caixas de som';
  $('effect-help').textContent = config.effect === 'strobe' ? (config.pulseEnabled ? 'Luz pulsante ativada' : 'Ative a luz nos ajustes finos') : config.effect === 'orbits' ? 'Curvas de Lissajous em movimento' : 'Deixe o olhar flutuar';
  $('strobe-warning').hidden = config.effect !== 'strobe' || config.pulseEnabled;
  $('volume-value').textContent = `${$('volume').value}%`;
  $('intensity-value').textContent = `${$('intensity').value}%`;
  $('target-help').textContent = config.target < 4 ? 'Um ritmo lento para a sua pausa' : config.target < 8 ? 'Um ritmo para desacelerar' : config.target < 13 ? 'Um ritmo para estar presente' : 'Explore o seu próprio ritmo';
  document.querySelectorAll('[data-preset]').forEach(button => {
    const preset = presets[button.dataset.preset];
    const active = preset.target === config.target && preset.carrier === config.carrier;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('form-error').hidden = true;
  saveSettings();
}
function updateVisualStatus() {
  const target = Number($('target').value);
  const frameRate = 1000 / (visualizer.frameAverage || (1000 / 60));
  const unsupported = target >= frameRate / 2;
  $('pulse-enabled').disabled = reducedMotion || unsupported;
  if (reducedMotion || unsupported) $('pulse-enabled').checked = false;
  $('pulse-rate').textContent = reducedMotion ? 'Movimento reduzido ativado no dispositivo' : unsupported ? `${format(target)} Hz exige tela acima de ${format(target * 2)} Hz · fluxo contínuo` : `${format(target)} ciclos por segundo · relógio do áudio`;
}
function showToast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}
function showError(message) {
  $('form-error').textContent = message;
  $('form-error').hidden = false;
}
function setFineSettings(open) {
  $('fine-panel').hidden = !open;
  document.querySelector('.fine-settings').setAttribute('aria-expanded', String(open));
}
function revealControls() {
  if (!session) return;
  document.body.classList.remove('controls-hidden');
  clearTimeout(hideTimer);
  if (engine.state === 'running') hideTimer = setTimeout(() => {
    if (!document.querySelector('.session-ui :focus-visible')) document.body.classList.add('controls-hidden');
  }, 3800);
}
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* Optional browser feature. */ }
}
async function releaseWakeLock() {
  try { await wakeLock?.release(); } catch { /* May already be released by the browser. */ }
  wakeLock = null;
}
async function startSession() {
  if (starting || session) return;
  const config = currentConfig();
  if (!$('target').checkValidity() || !$('target').value) return showError('Escolha um ritmo entre 0,5 e 40 Hz.');
  if (config.carrier < 100 || config.carrier > 1500 || !Number.isFinite(config.carrier)) return showError('Escolha uma frequência base entre 100 e 1.500 Hz.');
  const estimatedFrameRate = 1000 / (visualizer.frameAverage || (1000 / 60));
  if (config.pulseEnabled && config.target >= estimatedFrameRate / 2) return showError('A tela não consegue representar esse ritmo visual com fidelidade. Use o fluxo contínuo para manter esse ritmo no áudio.');
  if (config.effect === 'strobe' && !config.pulseEnabled) { setFineSettings(true); return showError('Para o estrobo, leia o aviso e ative a sincronização visual. Você também pode escolher Poeira cósmica ou Órbitas harmônicas para um fluxo contínuo.'); }
  starting = true;
  $('start').disabled = true;
  try {
    await engine.start(config);
    session = { ...config };
    muted = false;
    $('session-mute').style.opacity = '1';
    $('session-mute').setAttribute('aria-label', 'Silenciar');
    $('session-frequency').innerHTML = `${format(config.carrier)} Hz <i>·</i> ${format(config.target)} Hz`;
    $('session-mode').textContent = `${config.audioMode === 'binaural' ? 'BINAURAL' + (config.binauralModulation ? ' MODULADO' : '') : 'ISOCRÔNICO'} · ${bandFor(config.target).toUpperCase()}`;
    $('session-duration').textContent = config.duration ? `DE ${clock(config.duration)}` : 'TEMPO LIVRE';
    $('session-clock').textContent = '00:00';
    $('session-ui').hidden = false;
    $('reveal-controls').hidden = false;
    document.body.classList.add('immersive');
    updatePlaybackUI();
    visualizer.resize?.();
    revealControls();
    await requestWakeLock();
    try {
      if ('mediaSession' in navigator) {
        if (typeof MediaMetadata === 'function') navigator.mediaSession.metadata = new MediaMetadata({ title: 'Minha pausa', artist: 'Vibrasound', album: `${config.carrier} Hz · ${config.target} Hz` });
        navigator.mediaSession.setActionHandler('pause', () => togglePause());
        navigator.mediaSession.setActionHandler('play', () => { if (engine.state !== 'running') togglePause(); });
        navigator.mediaSession.setActionHandler('stop', () => endSession());
      }
    } catch { /* System media controls are optional on older browsers. */ }
  } catch (error) {
    if (session) await endSession();
    else { try { await engine.stop(); } catch { /* Keep the original error. */ } }
    showError('Não foi possível iniciar o áudio. Confira a saída de som e tente novamente.');
    console.error('Audio startup failed', error);
  } finally { starting = false; $('start').disabled = false; }
}
function updatePlaybackUI() {
  const paused = engine.state !== 'running';
  $('pause').setAttribute('aria-label', paused ? 'Retomar sessão' : 'Pausar sessão');
  $('pause').innerHTML = paused ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
  $('session-state').innerHTML = `<span class="footer-dot"></span> ${paused ? 'O TEMPO TAMBÉM PODE PARAR' : 'SUA PAUSA ESTÁ ACONTECENDO'}`;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = paused ? 'paused' : 'playing';
}
async function togglePause() {
  if (!session || ending || $('pause').disabled) return;
  $('pause').disabled = true;
  try {
    if (engine.state === 'running') { await engine.pause(); await releaseWakeLock(); }
    else { await engine.resume(); await requestWakeLock(); }
    updatePlaybackUI();
    revealControls();
  } catch { showToast('Toque em retomar para continuar o áudio.'); }
  finally { $('pause').disabled = false; }
}
async function endSession(completed = false) {
  if (!session || ending) return;
  ending = true;
  clearTimeout(hideTimer);
  try { await engine.stop(); } catch { /* Always restore the controls even if the device disappeared. */ }
  session = null;
  document.body.classList.remove('immersive', 'controls-hidden');
  $('session-ui').hidden = true;
  $('reveal-controls').hidden = true;
  await releaseWakeLock();
  if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* The browser can leave fullscreen on its own. */ } }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  visualizer.resize?.();
  $('start').focus({ preventScroll: true });
  ending = false;
  if (completed) showToast('Sua pausa terminou. Leve essa calma com você.');
}

document.querySelectorAll('.about-trigger').forEach(button => button.addEventListener('click', () => $('about-dialog').showModal()));
$('close-about').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', event => { if (event.target === $('about-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => { const preset = presets[button.dataset.preset]; $('target').value = preset.target; $('carrier').value = preset.carrier; update(); }));
document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => { const current = Number($('target').value) || 6; $('target').value = Math.min(40, Math.max(.5, Math.round((current + Number(button.dataset.step) * .5) * 10) / 10)); update(); }));
document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => { setColor(button.dataset.color); update(); }));
$('color').addEventListener('input', () => { setColor($('color').value); update(); });
for (const id of ['target','carrier','custom-carrier','audio-mode','binaural-modulation','effect','duration','volume','intensity','pulse-enabled']) $(id).addEventListener('input', update);
document.querySelector('.fine-settings').addEventListener('click', () => setFineSettings($('fine-panel').hidden));
$('start').addEventListener('click', startSession);
$('pause').addEventListener('click', togglePause);
$('exit-session').addEventListener('click', () => endSession());
$('reveal-controls').addEventListener('click', revealControls);
$('session-mute').addEventListener('click', () => { muted = !muted; engine.setVolume(muted ? 0 : session.volume); $('session-mute').setAttribute('aria-label', muted ? 'Ativar som' : 'Silenciar'); $('session-mute').style.opacity = muted ? '.4' : '1'; revealControls(); });
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else showToast('Use a opção de tela cheia do seu navegador.');
  } catch { showToast('A tela cheia não está disponível neste navegador.'); }
  revealControls();
});
document.addEventListener('fullscreenchange', () => { $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Sair da tela cheia' : 'Entrar em tela cheia'); });
document.addEventListener('pointermove', revealControls, { passive: true });
document.addEventListener('focusin', revealControls);
document.addEventListener('keydown', event => {
  if (!session || event.target.matches('input, select, textarea')) return;
  if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  if (event.code === 'Escape') { event.preventDefault(); endSession(); }
  revealControls();
});
document.addEventListener('visibilitychange', async () => {
  if (!session) return;
  if (document.hidden && engine.state === 'running') { await togglePause(); }
  else if (!document.hidden) { updatePlaybackUI(); revealControls(); }
});
window.addEventListener('pagehide', () => { engine.stop().catch(() => {}); releaseWakeLock(); });
setInterval(() => {
  if (!session) { updateVisualStatus(); return; }
  if (ending) return;
  const elapsed = engine.elapsed;
  $('session-clock').textContent = clock(elapsed);
  if (session.duration && elapsed >= session.duration) endSession(true);
}, 200);
restoreSettings();
update();
