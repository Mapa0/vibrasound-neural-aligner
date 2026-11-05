# Science and mathematical models

Sources reviewed: November 5, 2026.

Vibrasound brings established acoustic methods and carefully timed visuals into an approachable listening experience. Its foundation is practical: define the sound, keep the timing inspectable, and let the listener choose a comfortable experience.

## What the research supports

The auditory system can produce measurable responses to repeating sounds. A controlled human study found responses to both binaural and monaural beats, with stronger responses to the monaural stimulus under its test conditions. Neither condition changed the mood measures in that experiment. A 2025 experiment also found binaural responses that depended on the selected frequencies and background noise, alongside some changes in attention performance. These are useful findings about sensory responses; an EEG response alone does not establish a particular feeling or whole-brain state. [Orozco Perez et al., 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7082494/), [Melnichuk et al., 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC11799511/).

Results differ across protocols. For example, a 2021 study did not confirm its predicted 40 Hz binaural response. This is why the app describes the signal it produces and lets the experience remain personal. “Theta,” “Alpha,” and “Delta” identify conventional rhythm ranges; they are not readings of the listener's brain. [Engelbregt et al., 2021](https://pubmed.ncbi.nlm.nih.gov/34245340/).

The default **528 Hz / 6 Hz** preset is an audible tone choice paired with six rhythm cycles per second. An exploratory 2018 study involving nine people reported changes in several stress measures after piano music tuned to include 528 Hz. It tested music, not an isolated 528 Hz sine wave, and does not establish a special therapeutic property of the app's carrier tone. [Akimoto et al., 2018](https://www.scirp.org/journal/paperinformation?paperid=87146).

The app provides a relaxation experience. It does not record EEG, confirm a brain state, or provide medical treatment.

## Sound: the tone and the rhythm

Let `f₀` be the base tone in hertz, `f` the selected rhythm in hertz, and `t` elapsed time in **seconds**. The reference signals before listening volume and fade-in/out are:

```text
Binaural left:  L(t) = sin(2π × (f₀ − f/2) × t)
Binaural right: R(t) = sin(2π × (f₀ + f/2) × t)

Volume cycle:  g(t) = 0.5 + 0.5 × cos(2π × f × t)
Isochronic:    I(t) = g(t) × sin(2π × f₀ × t)
```

At 528/6, binaural mode sends **525 Hz left / 531 Hz right**. Their frequency difference is 6 Hz. Stereo headphones preserve the intended separate signals; mono playback mixes them. In isochronic mode, both channels carry a 528 Hz tone whose volume follows the 6 Hz cycle. For 6 Hz, each cycle lasts `1/6` second.

The optional binaural modulation applies `g(t)` to both binaural channels. It combines the separate-tone difference with an actual volume rhythm. This is a different acoustic stimulus from the unmodulated binaural reference.

Volume modulation creates additional frequency components around a carrier. With the default cosine modulation, an isochronic tone includes components at **522, 528, and 534 Hz**. These are an expected result of modulation. The underlying carrier is a sine wave; the complete modulated signal contains more than one frequency.

## Pure tone and Ethereal

**Pure tone** is the simplest reference: easy to inspect, with the chosen tones clearly audible. **Ethereal** adds a quiet harmonic layer for listeners who prefer a fuller texture. Its harmonics follow each channel's actual carrier: at the binaural preset, these include 1,050/1,575 Hz on the left and 1,062/1,593 Hz on the right. The core stereo tones retain their direct path, while the harmonic layers receive independent damped reverberation. This is a listening preference; neither option is claimed to produce a stronger neural effect.

Pleasantness is a useful design consideration in its own right. A 2024 study rated pentatonic musical sequences as more pleasant and relaxing than monaural beats; a second experiment found EEG changes during very slow, 0.2 Hz listening conditions. This supports taking comfort seriously while choosing a sound, without treating that different protocol as a test of Vibrasound's preset. [Costa et al., 2024](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1369485/full).

Research does not require every useful rhythmic stimulus to sound like an isolated laboratory tone. A human MEG study recorded steady responses to tones, speech, and music modulated at 41.1 Hz. That supports the broader possibility of measurable responses to pleasant complex sounds, while its findings do not validate this app's 6 Hz preset or its particular atmosphere. [Lamminmäki et al., 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4072443/).

Preserving the separate carriers is an engineering choice. Crossfeed mixes the left and right tones into both ears, changing the intended binaural stimulus. Some stereo reverberators also mix channels: the Web Audio specification includes a four-channel convolution mode that does this explicitly. Independent linear filtering within each channel preserves a sinusoid's frequency but can alter its level and phase. Keeping the reference tone path clear and adding atmosphere separately makes the resulting signal easier to understand. These are acoustic consequences of the processing, not findings that one texture is clinically superior. [Web Audio channel configuration](https://www.w3.org/TR/webaudio/#ConvolverNode).

## Liquid motion and rhythmic visuals

Repeating visual motion has a research basis beyond flashing light. In a human experiment, smoothly expanding and contracting concentric rings produced measurable visual responses. The study used a controlled pattern, display, viewing setup, and EEG; its results do not automatically transfer to decorative animation. [Xie et al., 2012](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0039707).

Liquid waves draws on the idea of repeated radial motion. In continuous mode it is a flowing scene. When visual synchronization is enabled, a cyclic motion or brightness component follows the selected audio rhythm. Flow speed controls the surrounding movement; Wave spread controls the geometry. Neither is a hidden change to the requested rhythm.

A complete expansion/contraction cycle and a direction reversal are different events. A sinusoidal motion cycle has two reversals, and visual responses may contain the cycle rate, the reversal rate, and other multiples. The app therefore reports complete stimulus cycles per second and does not label a ripple as a measured EEG frequency.

The shared normalized visual cycle is:

```text
visual_cycle(t) = 0.5 + 0.3 × cos(2π × f × t)
```

It ranges from 0.2 to 0.8. Selected intensity and the spatial mask limit its contribution to the final scene. It is not a promise that the entire screen changes opacity from 20% to 80%. Cosmic dust, Harmonic orbits, and Liquid waves are visual representations; none has been clinically validated as a relaxation treatment.

## Automatic color through octaves

An octave doubles frequency. Vibrasound applies that ratio repeatedly to the **base tone**, placing the result in a chosen optical-frequency window, then calculates the corresponding wavelength:

```text
f_light = f₀ × 2^n
wavelength_nm = (299792458 / f_light) × 10^9
choose integer n so 380 < wavelength_nm ≤ 760
```

The calculation uses the defined vacuum speed of light, **299,792,458 m/s**. The 380–760 nm interval is one exact octave in frequency; using it gives every positive base tone one representative wavelength. Human visibility has gradual boundaries, and ICNIRP uses approximately 380–780 nm for visible radiation. The narrower exact-octave interval is this app's mapping convention. [NIST: speed of light](https://physics.nist.gov/cgi-bin/cuu/Value?c), [ICNIRP: visible radiation](https://www.icnirp.org/en/frequencies/visible-light/index.html).

Examples, calculated from that equation:

| Base tone | Octave shift | Wavelength | Approximate hue |
| --- | --- | --- | --- |
| 396 Hz | 40 | 688.5 nm | Deep red |
| 432 Hz | 40 | 631.2 nm | Red |
| 528 Hz | 40 | 516.4 nm | Green |
| 639 Hz | 40 | 426.7 nm | Violet |
| 741 Hz | 39 | 735.9 nm | Deep red |
| 852 Hz | 39 | 640.0 nm | Red |
| 963 Hz | 39 | 566.3 nm | Yellow-green |

The wavelength is represented using Wyman, Sloan, and Shirley's analytic approximation to the CIE 1931 color-matching functions, followed by the XYZ-to-sRGB matrix and transfer function published by W3C/ICC. The implementation uses the analytic fit, not the official CIE table itself. Negative RGB components are clipped and the resulting color is normalized for display. Spectral colors can exceed a screen's range; rendering, brightness, and the display itself influence the result. The screen emits its own mixture of light, not a pure spectral line at the calculated wavelength. [Wyman, Sloan, and Shirley: Equation 4](https://research.nvidia.com/labs/rtr/publication/wyman2013simple/), [W3C/ICC sRGB specification](https://www.w3.org/Graphics/Color/srgb), [CIE official reference data](https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer).

This mapping gives the automatic palette a clear, reproducible connection to the selected tone. It is a mathematical visualization, with no established therapeutic correspondence between a sound frequency, a color, and a brain state. It also does not make pressure waves and electromagnetic waves the same physical phenomenon.

## Comfortable use and display limits

Continuous visual flow is the default. Rhythmic light and patterns are optional because they can trigger seizures in photosensitive people. The Epilepsy Foundation identifies 5–30 flashes per second as a particularly relevant range; **6 Hz falls within it**. Brightness, contrast, pattern, viewing conditions, and individual sensitivity also matter. Motion-based animation should not be assumed to eliminate this risk. Use the continuous setting if you are photosensitive, stop if uncomfortable, and keep audio volume comfortable. [Epilepsy Foundation](https://www.epilepsy.com/what-is-epilepsy/seizure-triggers/photosensitivity).

The audio clock already measures seconds. Animation timestamps are in milliseconds and are converted before any frequency calculation. Audio generation uses native audio processing, not animation frames or interface timers. A common clock prevents accumulated mathematical drift, while audio-device latency and screen updates still affect physical sound/light alignment. [W3C: audio time](https://www.w3.org/TR/webaudio/#dom-baseaudiocontext-currenttime).

A 6 Hz cycle has roughly ten frames on a 60 Hz screen. Rates approaching half the measured frame rate become poorly represented; rates at or above that limit cannot be faithfully reproduced as a sampled sinusoid and can alias. The app gates synchronization using measured performance and keeps the visual continuous when the requested rhythm cannot be represented. The audio rhythm is unchanged. Animation scheduling follows the display and can pause in hidden tabs. [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

## What the implementation verifies

The stored [digital-signal report](validation/audio-signal.json) checks 192,000 rendered samples per channel at 48 kHz for both Pure tone and Ethereal in binaural, modulated binaural, and isochronic modes. It covers 525/531 Hz separation, expected modulation components, reference-waveform accuracy, Ethereal harmonics, preservation of carrier components, the absence of an accidental 6,000 Hz tone, and pause/resume behavior. The recorded Ethereal renders retain the carrier amplitudes within numerical precision and keep the channel-specific binaural harmonics separate. [Reproduction instructions](validation/README.md) explain the method, measured values, and scope.

These checks verify the browser-generated signals in the recorded test conditions. They do not measure a headphone's acoustic output, a display's emitted spectrum, or a person's physiological response.
