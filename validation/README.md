# Audio signal verification

The [audio-signal.json](./audio-signal.json) report records a passing Chromium run. The verifier renders the production audio engine through native `OfflineAudioContext` and inspects the channel samples. It also checks pause, resume, and stop using a live `AudioContext`.

The 528/6 preset is checked in both Pure tone and Ethereal across binaural with 525 Hz left and 531 Hz right; isochronic with a 528 Hz carrier and 6 Hz volume modulation; and binaural with optional additional volume modulation. Checks cover stereo separation, reference-waveform accuracy, expected modulation components, Ethereal harmonics, preservation of carrier components, and the absence of the unit-conversion error that would produce a 6,000 Hz tone. The Ethereal renders use an Atmosphere level setting of 35%.

These checks verify digital signals and engine behavior in a browser. They do not measure acoustic headphone output, visual physiology, brain activity, or therapeutic outcomes. The measured tolerances and exact scenarios are recorded in the report rather than inferred from how a texture sounds.

## Reproduce

Use Node.js 22 or later. Run these commands from the project root.

Install the optional tool and its browser:

```sh
npm install --no-save playwright
npx playwright install chromium
```

Start the app and leave this terminal open:

```sh
npm run dev
```

In another terminal, run:

```sh
node validation/render-audio.mjs
node validation/render-chants.mjs
```

A passing run prints `passed: true` and updates its matching `validation/audio-signal.json` or `validation/chant-signal.json` report. A failed assertion exits with an error. Small numerical differences between Chromium versions are expected within the declared tolerances.

The default address is `http://localhost:8788`. Set `SITE_URL` to use another server. Set `BROWSER_EXECUTABLE` to use an existing Chromium executable; otherwise, Playwright uses its installed browser.

## Method and scope

Each offline render contains four seconds of stereo audio at 48 kHz. Frequency and component measurements use a two-second window after the initial fade-in. The verifier compares samples against the intended waveform and estimates the pure binaural frequencies from positive zero crossings. The lifecycle adapter changes only offline context startup and shutdown behavior; the nodes, oscillators, connections, automation, and rendered samples come from the production engine and Chromium.

For Ethereal, the verifier checks the preserved reference components and additional musical layers. The reported waveform-error fields compare against the pure reference: Ethereal intentionally differs because it contains added components. Channel checks distinguish the separate binaural reference tones from intentional additional musical content. The isochronic channels share the same signal, so those shared components are not interpreted as unwanted channel leakage.

The live lifecycle check confirms that audio time stops advancing while suspended and continues after resume. Its recorded clock values depend on the machine and are not clinical measurements.

## Recorded chant analysis

The separate [chant-analysis.json](./chant-analysis.json) report describes preparation of **MMM, VAM, III, EEE, OOO, UUU, and AAA** from the seven creator-supplied WAV recordings. Each recording is mono, 16-bit, 48 kHz, about 15–17 seconds long. Original files are read unchanged. The public site contains derived spectral models and prepared natural-playback WAVs in `dist/chants/`.

For every recording the report stores its SHA-256 hash, duration, sample rate, estimated voiced fundamental distribution, selected analysis time range, pitch variation, and harmonic-to-fundamental energy measure. Fundamental estimation uses autocorrelation on 128 ms analysis frames; source pitch estimates are measurements rather than exact ground truth. In particular, strong harmonics and changes in voicing can complicate fundamental estimation. A separate spectral check of III's selected region supports its approximately 166.67 Hz fundamental despite lower estimates elsewhere in that recording.

Six sustained chants use approximately 2.9-second stable regions and provide 16 spectral frames each. Their playback timbre moves through the frames on an eight-second loop. VAM instead uses its full 15.46-second phrase and 64 spectral and level frames, retaining its V–A–M progression with a soft noise approximation at the onset. Its 120 ms attack, 250 ms release, and 350 ms silent gap separate repeated phrases.

The playback engine uses these frames as changing timbre models and generates the fundamental directly from audio sample time. It combines the relative harmonic profile with an envelope in absolute acoustic frequencies to retain vowel character over pitch changes. This is spectral resynthesis rather than unmodified playback or a claim of transparent pitch shifting. Very high fundamentals reduce the number of harmonics available to reproduce vocal identity.

The default **Tune to base frequency** option uses the selected fixed fundamental or binaural pair through spectral resynthesis. Turning it off instead plays the actual prepared recording at its original rate, sends the same voice to both channels, and always applies the selected Isochronic volume rhythm. Natural playback deliberately preserves recorded pitch changes rather than matching the disabled base-frequency setting. Its six approximately 2.8-second sustained loops use 80 ms crossfades; VAM retains its complete recorded phrase and a 350 ms gap. Preparation removes DC, balances RMS level, softly limits peaks, and tapers boundaries. Fixed-frequency tolerances below apply to tuned renders.

The [chant-signal.json](./chant-signal.json) report renders all seven models using the production AudioWorklet in Chromium. In the recorded 525/531 Hz run, all measured fundamentals differ from their configured frequencies by less than **0.00003 Hz**. The measured 6 Hz amplitude-modulation ratios match the expected 0.5 carrier and 0.25 sidebands, with sideband phase errors below **0.001 radian**. The full-phrase VAM check distinguishes its A and M spectral shapes, measures exactly zero samples in the silent gap, and confirms sound returns after the next attack. These are numerical checks of generated audio, not measurements of speech intelligibility or biological response.

The same report separately verifies **natural MMM PCM playback**, with a pitch-shift ratio of **1**, identical left/right output, and forced Isochronic mode. Comparing that render against its decoded prepared waveform multiplied by the intended 6 Hz cosine envelope and session fade gives a relative sample error of approximately **0.00000351**. Its reference pitch contour varies from approximately **87.24 to 92.09 Hz** in the tested window, and live labels follow that contour. All seven natural assets are analyzed in `chant-analysis.json`, with peak sample magnitudes no greater than **0.70** before app volume and modulation; the native PCM sample comparison is limited to MMM. This checks faithful original-rate playback and the applied rhythm rather than claiming a fixed natural-voice frequency.

To regenerate the models from the original recordings, use Python 3 with NumPy:

```sh
python3 scripts/prepare-chants.py --input-dir /path/to/original-wavs
```

The source report answers which recordings and analysis regions were used. Rendered signal checks answer what the browser produces. Neither implies that a chant is a pure sine wave or demonstrates a physiological benefit from listening.

## Preset and visual timing checks

`npm test` also checks the six fixed Solfeggio tones, the seven symbolic chakra defaults, and the exact just-intonation ratios under C256 and A432 references. Fractional-hertz note values remain unrounded in the engine configuration.

Visual tests inspect clock-based wave phase, meteor event times and counts, and the full 0–100% strobe envelope. The liquid scene has separate left/right sources whose relative wavelengths follow the configured channel frequencies and whose heights follow averaged actual channel levels. Continuous mode averages level and timbre features with a 0.75-second time constant; the tests verify that less than 4% of a 6 Hz level variation reaches this averaged response. Synchronized mode uses a faster 0.05-second response and the selected rhythm for the source cycle. Exact silence immediately removes audio-driven height. These checks do not measure a display's light output or prove a neural response.
