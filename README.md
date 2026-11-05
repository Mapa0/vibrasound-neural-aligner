# Vibrasound · Neural Aligner

An evidence-informed frequency generator for quiet focus and relaxation, built on established acoustics and transparent mathematical models.

Precise stereo tones, a choice of pure or atmospheric sound, and gentle visuals create a minimal space to shape your listening experience. The controls disappear during a session and return when you move, touch, or use the keyboard.

**Open the app:** [vibrasound.mapazero.com](https://vibrasound.mapazero.com)

## Make it yours

Choose a rhythm, a base tone, an audio mode, and a visual. The starting preset is **528 Hz with a 6 Hz rhythm**. Color is automatically derived from the base tone through an octave mapping.

- **Binaural:** 525 Hz in the left ear and 531 Hz in the right ear at the default preset. Use stereo headphones.
- **Isochronic:** the base tone rises and falls in volume at the selected rhythm. Works with headphones or speakers.
- **Sound texture:** Pure tone keeps the reference signal clear; Ethereal adds a quiet harmonic atmosphere. Adjust Atmosphere level to taste.
- **Visuals:** Cosmic dust, Harmonic orbits, Liquid waves, and optional Soft strobe. Flow speed and Wave spread shape the liquid scene.
- **Session controls:** optional binaural volume modulation, volume, and session duration are directly available in the main panel.
- **Advanced controls:** visual synchronization, intensity, Flow speed, Wave spread, and Atmosphere level.
- **Playback:** pause, resume, mute, fullscreen, and free or timed sessions. Space pauses or resumes; Esc ends the session. Switching tabs pauses playback.

Preferences stay in your browser. Rhythmic visual synchronization starts off each time the page opens. Continuous visual flow is the default; synchronized light and patterns are an explicit choice. Pulsing light or patterns can trigger seizures in photosensitive people. Keep the continuous setting if this applies to you, and listen at a comfortable volume.

## How it works

The sound engine generates the selected tones directly in the browser. Binaural mode sends a slightly different tone to each ear; isochronic mode changes a tone's volume rhythmically. Optional binaural modulation combines both approaches. These are defined acoustic signals, with every phase calculation expressed in **seconds**: 6 Hz means six cycles per second.

Research has measured brain responses to rhythmic sound and visual motion. The studies provide a useful basis for the design; effects depend on the stimulus and the listener. Theta, Alpha, and Delta name conventional frequency ranges, and describe the selected rhythm here. The app generates a stimulus and provides a place to relax; it does not measure your brain state. The supporting research and equations are explained in [SCIENCE.md](SCIENCE.md).

Pure tone is the clearest choice for hearing the reference signal. Ethereal is a comfort option for a fuller sound. Neither setting is presented as more effective at changing brain activity. The selected carrier frequencies and their timing remain the foundation of both textures.

## Color from frequency

Automatic color shifts the **base tone** upward by whole octaves into a visible wavelength range:

```text
light_frequency = base_tone × 2^n
wavelength_nm = 299792458 × 10^9 / light_frequency
choose whole octaves to place wavelength between 380 and 760 nm
```

This produces **528 Hz → 516.4 nm, green**, and **432 Hz → 631.2 nm, red**. The resulting wavelength is represented as an approximate screen color. The mapping is a reproducible visual interpretation of the tone; it has no demonstrated brain-state effect. The chosen octave window is a design convention inside the approximate visible range.

## Timing and verification

Audio and synchronized visuals use the same audio clock. Slow visual flow and wave spread shape the scene independently of the selected rhythm. Screen refresh rate, device latency, and Bluetooth affect the physical timing you experience. The renderer aims for fluid motion and adapts its quality to the device.

Visual synchronization requires a measured frame rate greater than twice the requested rhythm. A 60 Hz display cannot faithfully present a 40 Hz visual pulse. When the measured frame rate is insufficient, the visual stays continuous and the audio frequency remains unchanged.

The stored [signal report and reproduction guide](validation/README.md) cover Pure tone and Ethereal across binaural, modulated binaural, and isochronic modes at 48 kHz. Checks include stereo separation, reference-waveform accuracy, preserved carrier components, added harmonics, and pause/resume behavior. This verifies the digital signal; a person's physiological response is outside that measurement.

## Run locally

Use Node.js 22+ and Python 3. There are no production dependencies or build step.

```sh
npm run dev
# Open http://localhost:8788
```

Run the checks:

```sh
npm test
npm run check
```

Audio starts after a user interaction. Use HTTPS or localhost and a current browser with Web Audio and Canvas 2D. No account is needed. Audio is generated locally; the app does not upload it or collect session data. Fonts are hosted with the app.

## Project files

```text
dist/index.html        Interface and experience information
dist/styles.css        Responsive layout and immersive mode
dist/app.js            Controls and session lifecycle
dist/audio-engine.js   Stereo tones, modulation, and audio clock
dist/visualizer.js     Cosmic, orbital, liquid, and pulsing visuals
dist/octave-color.js   Base-tone to wavelength and screen-color mapping
tests/                 Audio, color, and mathematical checks
validation/            Reproducible digital-signal report
SCIENCE.md             Research, equations, and practical limits
deploy/                Nginx deployment configuration
```

`dist/` is the complete static site. It can be served by any HTTPS static host. `.openai/hosting.json` also supports Sites publication.

## License

MIT. DM Sans and Instrument Serif use the SIL Open Font License; the license texts are included in `dist/fonts/`.
