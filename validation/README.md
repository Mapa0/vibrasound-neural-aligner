# Audio signal verification

The [audio-signal.json](./audio-signal.json) report records a passing Chromium run. The verifier renders the production audio engine through native `OfflineAudioContext` and inspects the channel samples. It also checks pause, resume, and stop using a live `AudioContext`.

The 528/6 preset is checked in both Pure tone and Ethereal across binaural with 525 Hz left and 531 Hz right; isochronic with a 528 Hz carrier and 6 Hz volume modulation; and binaural with optional additional volume modulation. Checks cover stereo separation, reference-waveform accuracy, expected modulation components, Ethereal harmonics, preservation of carrier components, and the absence of the unit-conversion error that would produce a 6,000 Hz tone. The Ethereal renders use an Atmosphere level setting of 35%.

This report verifies the digital Pure tone and Ethereal signals and engine behavior in a browser. It does not measure acoustic headphone output, visual physiology, brain activity, or therapeutic outcomes.

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
```

A passing run prints `passed: true` and updates `validation/audio-signal.json`. A failed assertion exits with an error. Small numerical differences between Chromium versions are expected within the declared tolerances.

The default address is `http://localhost:8788`. Set `SITE_URL` to use another server. Set `BROWSER_EXECUTABLE` to use an existing Chromium executable; otherwise, Playwright uses its installed browser.

## Method and scope

Each offline render contains four seconds of stereo audio at 48 kHz. Frequency and component measurements use a two-second window after the initial fade-in. The verifier compares samples against the intended waveform and estimates the pure binaural frequencies from positive zero crossings. The lifecycle adapter changes only offline context startup and shutdown behavior; the nodes, oscillators, connections, automation, and rendered samples come from the production engine and Chromium.

For Ethereal, the verifier confirms that the carrier and modulation components match the corresponding Pure tone render while the additional harmonics are present. In the stored run, the largest measured change in a carrier amplitude was below `6 × 10⁻¹¹`; the sampled opposite-channel harmonic amplitudes in the Ethereal binaural renders stayed below `3 × 10⁻⁹`. These are normalized digital amplitudes from this measurement window. The reported waveform-error fields compare against the pure reference: Ethereal intentionally differs because it contains added harmonics. The isochronic channels share the same carriers and harmonics, so those components are not interpreted as unwanted channel leakage.

The live lifecycle check confirms that audio time stops advancing while suspended and continues after resume. Its recorded clock values depend on the machine and are not clinical measurements.
