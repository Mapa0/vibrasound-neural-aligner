# Vibrasound · Neural Aligner

An evidence-informed frequency generator for quiet focus and relaxation, built on established acoustics and transparent mathematical models.

Precise stereo tones, musical atmospheres, recorded voice, and flowing visuals create a minimal space to design your frequency. The controls disappear during a session and return when you move, touch, or use the keyboard.

**Open the app:** [vibrasound.mapazero.com](https://vibrasound.mapazero.com)

## Make it yours

Choose a rhythm, a base tone, an audio mode, and a visual. The starting preset is **528 Hz with a 6 Hz rhythm**. Color is automatically derived from the base tone through an octave mapping.

- **Binaural:** 525 Hz in the left ear and 531 Hz in the right ear at the default preset. Use stereo headphones.
- **Isochronic:** the base tone rises and falls in volume at the selected rhythm. Works with headphones or speakers.
- **Pure frequency:** the exact selected base tone in both channels, with no beat offset or volume modulation. Solfeggio and Musical notes presets start here.
- **Sound texture:** Pure tone keeps the reference signal clear; Ethereal adds musical layers and reverberation; Chants resynthesizes the timbre of seven voice recordings contributed by the project's creator. Adjust Atmosphere level to taste.
- **Visuals:** Cosmic dust, Harmonic orbits, Liquid waves, Shooting stars, and optional Soft strobe. Liquid waves is a three-dimensional surface with one source per audio channel. The actual channel levels drive wave height, while the carrier frequencies shape relative wavelengths. Adjust the two source gains, their spacing, Flow speed, and Wave spread.
- **Session controls:** optional binaural volume modulation, volume, and session duration are directly available in the main panel.
- **Advanced controls:** visual synchronization, intensity, Flow speed, Wave spread, and Atmosphere level.
- **Rhythm presets:** Delta, Theta, Alpha, and Gamma. These name the chosen stimulus rate, not a measured brain state.
- **Playback:** pause, resume, mute, fullscreen, and free or timed sessions. Space pauses or resumes; Esc ends the session. Switching tabs keeps the audio playing. Visual animation can be suspended by the browser while the tab is hidden.

Preferences stay in your browser. Visual rhythm synchronization starts off each time the page opens, so the wave sources begin with slow continuous motion and heights follow averaged audio levels. Shooting stars follows the selected arrival rate. Pulsing light or moving patterns can trigger seizures in photosensitive people. Listen at a comfortable volume and stop if uncomfortable.

## How it works

The sound engine generates the selected tones directly in the browser. Binaural mode sends a slightly different tone to each ear; isochronic mode changes a tone's volume rhythmically. Optional binaural modulation combines both approaches. These are defined acoustic signals, with every phase calculation expressed in **seconds**: 6 Hz means six cycles per second.

Research has measured brain responses to rhythmic sound and visual motion. The studies provide a useful basis for the design; effects depend on the stimulus and the listener. Delta, Theta, Alpha, and Gamma name conventional frequency ranges, and describe the selected rhythm here. The app generates a stimulus and provides a place to relax; it does not measure your brain state. The supporting research and equations are explained in [SCIENCE.md](SCIENCE.md).

Pure tone is the clearest choice for hearing the reference signal. Ethereal is a comfort option for a fuller sound. Neither setting is presented as more effective at changing brain activity. The selected carrier frequencies and their timing remain the foundation of both textures.

## Science Mode and Mystic Mode

**Science Mode** is the starting point: choose the acoustic signal directly, with transparent frequency and timing controls. **Mystic Mode** adds three preset collections, with their meanings and tuning references stated on screen:

- **Chakras:** seven symbolic listening presets from Muladhara to Sahasrara, using a contemporary Solfeggio association and a familiar chakra color palette. Their rhythm values are creative defaults rather than biological measurements or treatment settings.
- **Solfeggio:** six pure tones, **396, 417, 528, 639, 741, and 852 Hz**, from the contemporary system popularized by Joseph Puleo and Leonard Horowitz. Its use of Ut, Re, Mi, Fa, Sol, and La is distinct from the medieval relative-pitch teaching system.
- **Musical notes:** seven pure notes in a just major scale, with ratios **1, 9/8, 5/4, 4/3, 3/2, 5/3, and 15/8** from C. Choose **C = 256 Hz** or **A = 432 Hz** as a separate tuning reference. In this scale, C = 256 produces A = 426.667 Hz; A = 432 produces C = 259.2 Hz.

The preset collections select sounds and colors for exploration. Symbolic associations and historical context are kept separate from the measured acoustic behavior. [History and tuning sources](SCIENCE.md#science-and-mystic-presets).

## A voice at your chosen frequency

Chants offers **MMM, VAM, III, EEE, OOO, UUU, and AAA**. With **Tune to base frequency** enabled by default, the browser recreates the recorded harmonic character at the requested fundamental. Six textures use stable sustained sections, with slow changes in timbre for a more living sound. VAM follows the full 15.46-second recorded phrase, including its changing V–A–M character, then rests for 0.35 seconds before repeating. The voice is resynthesized from measured spectral frames rather than played back unchanged.

Turn off **Tune to base frequency** to hear the actual recorded voice at its original pitch, with volume modulation at your chosen rhythm: at 6 Hz, six cycles per second. Both channels carry the same recording. Base-frequency and audio-mode controls are temporarily disabled while this option uses Isochronic modulation. Six sustained chants use smoothly crossfaded recorded sections; VAM plays the complete recorded phrase with a short rest. This preserves the voice and its pitch variation rather than keeping it at a fixed 528 Hz.

A voice contains harmonics, so its fundamental is the selected base frequency or natural recorded pitch rather than its only spectral component. Very large pitch changes can make the tuned vowel less recognizable. [Recording analysis](validation/chant-analysis.json) documents all seven source files and the derived assets. Original WAVs are read unchanged; the site includes spectral models for tuned playback and prepared audio files for natural playback, with level balancing, DC removal, and smooth loop boundaries.

## Color from frequency

Automatic color shifts the **base tone** upward by whole octaves into a visible wavelength range:

```text
light_frequency = base_tone × 2^n
wavelength_nm = 299792458 × 10^9 / light_frequency
choose whole octaves to place wavelength between 380 and 760 nm
```

This produces **528 Hz → 516.4 nm, green**, and **432 Hz → 631.2 nm, red**. The resulting wavelength is represented as an approximate screen color. The mapping is a reproducible visual interpretation of the tone; it has no demonstrated brain-state effect. The chosen octave window is a design convention inside the approximate visible range.

Chakra presets deliberately use their symbolic palette instead. Solfeggio, Musical notes, and Science Mode retain the octave palette.

For natural-pitch Chants, automatic color uses the recording's pitch reference instead of the disabled base-frequency setting.

## Timing and verification

Audio and synchronized visuals use the same audio clock. Slow visual flow and wave spread shape the scene independently of the selected rhythm. Screen refresh rate, device latency, and Bluetooth affect the physical timing you experience. The renderer aims for fluid motion and adapts its quality to the device.

Visual pulse synchronization requires a measured frame rate greater than twice the requested rhythm. A 60 Hz display cannot faithfully present a 40 Hz visual pulse. When the measured frame rate is insufficient, the wave sources keep their slow continuous cadence and averaged level response; the audio frequency remains unchanged. Shooting stars uses the rhythm as an arrival rate instead: six new stars per audio second at 6 Hz, with overlapping trajectories rather than six whole-screen flashes.

The stored [signal reports and reproduction guide](validation/README.md) cover Pure tone, Ethereal, all seven tuned Chants, and natural MMM playback at 48 kHz. All seven natural-playback assets are analyzed separately. Checks include stereo separation, reference-waveform accuracy, preserved carrier components, added musical layers, VAM's changing phrase and silent gap, and pause/resume behavior. This verifies the digital signal; a person's physiological response is outside that measurement.

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
dist/chants/           Timbre models and prepared natural chant recordings
dist/visualizer.js     Cosmic, orbital, liquid, and pulsing visuals
dist/octave-color.js   Base-tone to wavelength and screen-color mapping
dist/mystic-presets.js Symbolic presets, Solfeggio, and exact musical tunings
tests/                 Audio, color, and mathematical checks
validation/            Reproducible digital-signal report
SCIENCE.md             Research, equations, and practical limits
deploy/                Nginx deployment configuration
```

`dist/` is the complete static site. It can be served by any HTTPS static host. `.openai/hosting.json` also supports Sites publication.

## License

MIT. DM Sans and Instrument Serif use the SIL Open Font License; the license texts are included in `dist/fonts/`.
