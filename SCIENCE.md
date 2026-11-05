# Science and mathematical models

Sources reviewed: November 5, 2026.

Vibrasound brings established acoustic methods and carefully timed visuals into an approachable listening experience. Its foundation is practical: define the sound, keep the timing inspectable, and let the listener choose a comfortable experience.

## What the research supports

The auditory system can produce measurable responses to repeating sounds. A controlled human study found responses to both binaural and monaural beats, with stronger responses to the monaural stimulus under its test conditions. Neither condition changed the mood measures in that experiment. A 2025 experiment also found binaural responses that depended on the selected frequencies and background noise, alongside some changes in attention performance. These are useful findings about sensory responses; an EEG response alone does not establish a particular feeling or whole-brain state. [Orozco Perez et al., 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7082494/), [Melnichuk et al., 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC11799511/).

Results differ across protocols. For example, a 2021 study did not confirm its predicted 40 Hz binaural response. This is why the app describes the signal it produces and lets the experience remain personal. “Delta,” “Theta,” “Alpha,” and “Gamma” identify conventional rhythm ranges; they are not readings of the listener's brain. A Gamma preset selects a 40 Hz stimulus rather than confirming a 40 Hz brain state. [Engelbregt et al., 2021](https://pubmed.ncbi.nlm.nih.gov/34245340/).

The default **528 Hz / 6 Hz** preset is an audible tone choice paired with six rhythm cycles per second. An exploratory 2018 study involving nine people reported changes in several stress measures after piano music tuned to include 528 Hz. It tested music, not an isolated 528 Hz sine wave, and does not establish a special therapeutic property of the app's carrier tone. [Akimoto et al., 2018](https://www.scirp.org/journal/paperinformation?paperid=87146).

The app provides a relaxation experience. It does not record EEG, confirm a brain state, or provide medical treatment.

## Sound: the tone and the rhythm

Let `f₀` be the base tone in hertz, `f` the selected rhythm in hertz, and `t` elapsed time in **seconds**. The reference signals before listening volume and fade-in/out are:

```text
Binaural left:  L(t) = sin(2π × (f₀ − f/2) × t)
Binaural right: R(t) = sin(2π × (f₀ + f/2) × t)

Volume cycle:  g(t) = 0.5 + 0.5 × cos(2π × f × t)
Isochronic:    I(t) = g(t) × sin(2π × f₀ × t)
Pure frequency: L(t) = R(t) = sin(2π × f₀ × t)
```

At 528/6, binaural mode sends **525 Hz left / 531 Hz right**. Their frequency difference is 6 Hz. Stereo headphones preserve the intended separate signals; mono playback mixes them. In isochronic mode, both channels carry a 528 Hz tone whose volume follows the 6 Hz cycle. For 6 Hz, each cycle lasts `1/6` second.

The optional binaural modulation applies `g(t)` to both binaural channels. It combines the separate-tone difference with an actual volume rhythm. This is a different acoustic stimulus from the unmodulated binaural reference.

Pure frequency keeps both channels at `f₀` and applies no rhythmic modulation. Its selected rhythm remains available to the visual engine. Choosing a Solfeggio or Musical notes preset uses this mode so the stated note is the generated tone rather than the midpoint of a binaural pair.

Volume modulation creates additional frequency components around a carrier. With the default cosine modulation, an isochronic tone includes components at **522, 528, and 534 Hz**. These are an expected result of modulation. The underlying carrier is a sine wave; the complete modulated signal contains more than one frequency.

## Pure tone, Ethereal, and Chants

**Pure tone** is the simplest reference: easy to inspect, with the chosen tones clearly audible. **Ethereal** adds a musical atmosphere for listeners who prefer a fuller texture. Its sustained octaves and fifths use frequency ratios of 1/2, 3/4, 3/2, 2, and 3 relative to each channel's reference carrier, with a slow 0.065 Hz volume movement and damped reverberation. These additional notes are aesthetic choices; the base stereo tones keep their separate direct paths. Musical notes introduce their own frequency differences and the resulting complex stimulus is distinct from the pure-tone reference. This is a listening preference; neither option is claimed to produce a stronger neural effect.

Pleasantness is a useful design consideration in its own right. A 2024 study rated pentatonic musical sequences as more pleasant and relaxing than monaural beats; a second experiment found EEG changes during very slow, 0.2 Hz listening conditions. This supports taking comfort seriously while choosing a sound, without treating that different protocol as a test of Vibrasound's preset. [Costa et al., 2024](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1369485/full).

Research does not require every useful rhythmic stimulus to sound like an isolated laboratory tone. A human MEG study recorded steady responses to tones, speech, and music modulated at 41.1 Hz. That supports the broader possibility of measurable responses to pleasant complex sounds, while its findings do not validate this app's 6 Hz preset or its particular atmosphere. [Lamminmäki et al., 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4072443/).

Preserving the separate carriers is an engineering choice. Crossfeed mixes the left and right tones into both ears, changing the intended binaural stimulus. Some stereo reverberators also mix channels: the Web Audio specification includes a four-channel convolution mode that does this explicitly. Independent linear filtering within each channel preserves a sinusoid's frequency but can alter its level and phase. Keeping the reference tone path clear and adding atmosphere separately makes the resulting signal easier to understand. These are acoustic consequences of the processing, not findings that one texture is clinically superior. [Web Audio channel configuration](https://www.w3.org/TR/webaudio/#ConvolverNode).

**Chants** uses the creator's own recordings of **MMM, VAM, III, EEE, OOO, UUU, and AAA** as timbre references. The source recordings contain changing pitch, harmonics, breath, and vowel resonances. A vowel or hum is not a pure sine wave, and its strongest spectral peak does not always identify the fundamental.

For MMM, III, EEE, OOO, UUU, and AAA, the preparation process finds stable voiced regions, estimates their fundamental pitches, and measures how their harmonic spectra change. It stores 16 spectral frames per sustained chant. The browser then resynthesizes a continuous voice-like signal, slowly moving through those recorded frames over an eight-second loop. **Tune to base frequency** is enabled by default: the fundamental follows the selected audio frequency using the audio sample clock. A hybrid of the measured relative harmonic profile and a spectral envelope at fixed acoustic frequencies helps retain vowel character when changing pitch. In this tuned mode, the recording's original pitch drift does not change the selected fundamental.

VAM preserves the full 15.46-second phrase through 64 spectral and level frames, including the progression from V into A and then M. Its onset includes a soft noise approximation to the recorded V sound. A 120 ms attack, 250 ms release, and 350 ms silent gap separate repeated phrases. The underlying harmonic phase clock continues across repetitions. This recreates the phrase's measured changing character rather than playing the original recording unchanged.

With tuning enabled, binaural mode gives each resynthesized voice its own fundamental, `f₀ − f/2` or `f₀ + f/2`. In isochronic mode the voice fundamental is `f₀` and its amplitude follows `g(t)`. In Pure frequency mode its fundamental is `f₀` in both channels. A chant contains harmonics at integer multiples of its fundamental: selecting 528 Hz does not mean every component of the voice is 528 Hz. Changing a low-pitched recording to a much higher fundamental necessarily changes its perceived identity; spectral modeling does not make arbitrary shifts perfectly natural.

With **Tune to base frequency** disabled, the engine plays prepared copies of the actual recordings through native audio-buffer playback at their original rate. Both channels receive the same voice, including its recorded pitch variation, and amplitude modulation always follows the selected rhythm, irrespective of a previously chosen binaural setting. The independent volume envelope uses `g(t) = 0.5 + 0.5 × cos(2π × f × t)` at the exact selected rhythm. A natural voice near 89 Hz modulated at 6 Hz is a changing approximately 89 Hz voice with six volume cycles per second; it is not a 528 Hz carrier or a binaural 6 Hz pair.

Natural playback uses the actual waveform rather than spectral resynthesis. The six sustained chants use approximately 2.8-second prepared loops with 80 ms crossfades; VAM retains the full 15.46-second recorded phrase, including its consonant, with a 350 ms gap. Preparation removes DC, balances level, limits peaks softly, and tapers boundaries. Original supplied files remain unchanged. Pitch labels and automatic octave color use the estimated recording contour or reference, rather than a claim of a fixed generated tone; symbolic chakra colors retain their separate meaning.

The [chant analysis report](validation/chant-analysis.json) records source file hashes, measured pitch distributions, selected regions, and model details for all seven original WAVs. These measurements characterize the recordings and the synthesis method; they do not establish biological effects.

Producing a hum and listening to a recorded hum are different activities. A study of ten healthy participants found increased nasal nitric oxide during **active humming**, attributed to oscillating airflow and sinus ventilation. It did not test listening to a recording, this application, or instant vagus-nerve effects. Vibrasound therefore describes Chants as a listening texture rather than transferring effects of vocal production to playback. [Weitzberg and Lundberg, 2002](https://pubmed.ncbi.nlm.nih.gov/12119224/).

## Science and Mystic presets

**Science Mode** starts with the specified acoustic and timing controls. **Mystic Mode** offers symbolic and musical collections while using the same audio engine. Its labels describe the origin of a preset rather than an additional physiological mechanism.

The **Chakras** collection pairs seven named centers with a familiar contemporary color palette and the app's chosen tone/rhythm defaults:

| Center | Symbolic label | Base tone | Rhythm |
| --- | --- | --- | --- |
| Muladhara | Root | 396 Hz | 4 Hz |
| Svadhisthana | Sacral | 417 Hz | 6 Hz |
| Manipura | Solar plexus | 528 Hz | 10 Hz |
| Anahata | Heart | 639 Hz | 10 Hz |
| Vishuddha | Throat | 741 Hz | 12 Hz |
| Ajna | Third eye | 852 Hz | 14 Hz |
| Sahasrara | Crown | 963 Hz | 40 Hz |

These exact sound–color–rhythm combinations are creative listening presets. They are not measurements of bodily centers, a historical standard shared by all chakra traditions, or validated treatment settings. Their colors deliberately override the octave palette; other preset families retain the mathematical color mapping.

The **Solfeggio** collection contains **UT 396, RE 417, MI 528, FA 639, SOL 741, and LA 852 Hz**. This is the contemporary system popularized by Joseph Puleo and Leonard Horowitz. Horowitz's own account attributes its derivation to Puleo's interpretation of the Book of Numbers; that source establishes the author's account of provenance, not evidence of the proposed healing properties. The medieval syllables Ut–La belong to a relative-pitch hexachord teaching system associated with Guido d'Arezzo. Their historical use does not establish these six fixed hertz values. [Horowitz: primary account](https://medicalveritas.org/opening-the-matrix/), [The Metropolitan Museum of Art: Guidonian hand](https://www.metmuseum.org/perspectives/musical-bodies-guidonian-hand).

The **Musical notes** collection uses one common just major scale. Its notes follow simple frequency ratios from C: **C 1:1, D 9:8, E 5:4, F 4:3, G 3:2, A 5:3, B 15:8**. Just intonation describes these ratios; it is not a single universal concert-pitch reference. [Simon Fraser University: just intonation](https://www.sfu.ca/sonic-studio-webdav/handbook/Just_Tuning.html).

With **C = 256 Hz**, the scale has **A = 426.666… Hz**. With **A = 432 Hz**, the app derives **C = 432 × 3/5 = 259.2 Hz** and scales the same ratios from there. C = 256 and A = 432 therefore cannot both be exact references in this particular just scale. The interface displays a rounded frequency; the sound engine receives the full numerical value, including fractional-hertz notes such as F = 341.333… Hz in the C256 scale.

## Liquid motion and rhythmic visuals

Repeating visual motion has a research basis beyond flashing light. In a human experiment, smoothly expanding and contracting concentric rings produced measurable visual responses. The study used a controlled pattern, display, viewing setup, and EEG; its results do not automatically transfer to decorative animation. [Xie et al., 2012](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0039707).

Liquid waves draws on the idea of repeated radial motion on a three-dimensional surface. Its two sources correspond to the left and right audio channels. The measured channel levels after volume, modulation, and fades influence their heights. The ratio of each channel's configured fundamental to the mean fundamental controls relative wavelength: at the default binaural preset these are 525 and 531 Hz. The displayed frequency labels are the configured fundamentals, rather than an independent frequency measurement.

The screen visualizes these audible carriers spatially. It does not flash at 525 or 531 Hz. In continuous mode the wave sources move at a decorative 0.34 cycles per second. Their level and timbre features are averaged with a 0.75-second low-pass time constant, strongly attenuating fast isochronic amplitude changes. When visual synchronization is enabled and the display can represent it, both sources share the selected rhythm and audio clock, with a faster 0.05-second response to channel level. Channel-specific wavelength, level, and timbre information shape the surface. The model is:

```text
f_reference = (f_left + f_right) / 2
f_visual = selected_rhythm if synchronization is available; otherwise 0.34
averaged_RMS_i = low_pass(measured_RMS_i, time_constant)
level_i = user_gain_i × min(3, averaged_RMS_i / 0.0282843)
height_i(r,t) = level_i × attenuation(r)
                × cos(2π × f_visual × (t − r × (f_i / f_reference) / travel_speed) + phase_i)
```

Time and propagation delay are in seconds. Relative wavelength follows `f_reference / f_i`; a higher carrier creates a relatively shorter visual wavelength. This describes the base waves; the renderer also adds a small shape adjustment from the averaged channel texture and a slow background flow, with height limits for display. Exact digital silence immediately zeros the audio-driven heights, while the small background flow can continue. The channel gain controls are visual, from 0 to 150%, and Source spacing moves their centers. Flow speed controls propagation and Wave spread changes the surface geometry. These controls do not alter the requested audio frequencies. The result is a sound-driven visualization rather than a physical fluid simulation or a direct picture of brain activity.

A complete expansion/contraction cycle and a direction reversal are different events. A sinusoidal motion cycle has two reversals, and visual responses may contain the cycle rate, the reversal rate, and other multiples. The app therefore reports complete stimulus cycles per second and does not label a ripple as a measured EEG frequency.

The shared normalized visual cycle is:

```text
visual_cycle(t) = 0.5 + 0.3 × cos(2π × f × t)
```

It ranges from 0.2 to 0.8. Selected intensity and the spatial mask limit its contribution to the flowing scenes. Soft strobe instead permits a full-range pulse, `intensity × (0.5 + 0.5 × cos(2π × f × t))`, reaching 100% peak opacity when intensity is 100%. Rhythmic strobe remains optional and subject to display timing limits.

**Shooting stars** maps the selected rhythm to arrivals rather than whole-screen flashes: at 6 Hz, six new meteors appear per audio second. Each birth is scheduled mathematically at `event_index / f`; its visible path continues afterward, so several meteors can coexist. This is an exact event-rate mapping rather than proof of a 6 Hz neural response. Frame timing can combine arrivals into one displayed frame. After returning to a hidden tab, the renderer reconstructs only currently visible trajectories instead of replaying every missed event.

Cosmic dust, Harmonic orbits, Liquid waves, and Shooting stars are visual representations; none has been clinically validated as a relaxation treatment.

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

Slow continuous source motion and averaged sound-driven heights are the default; the explicit rhythm-sync control starts off. Averaging reduces fast amplitude changes, rather than establishing that an animation is suitable for every viewer. Shooting stars follows the selected event rate. The Epilepsy Foundation identifies 5–30 flashes per second as a particularly relevant range for photosensitive seizures; **6 Hz falls within it**. Brightness, contrast, pattern, viewing conditions, and individual sensitivity also matter. Motion-based animation should not be assumed to eliminate this risk. Avoid rhythmic visual stimulation if you are photosensitive, stop if uncomfortable, and keep audio volume comfortable. [Epilepsy Foundation](https://www.epilepsy.com/what-is-epilepsy/seizure-triggers/photosensitivity).

The audio clock already measures seconds. Animation timestamps are in milliseconds and are converted before any frequency calculation. Audio generation uses native audio processing, not animation frames or interface timers. A common clock prevents accumulated mathematical drift, while audio-device latency and screen updates still affect physical sound/light alignment. [W3C: audio time](https://www.w3.org/TR/webaudio/#dom-baseaudiocontext-currenttime).

A 6 Hz cycle has roughly ten frames on a 60 Hz screen. Rates approaching half the measured frame rate become poorly represented; rates at or above that limit cannot be faithfully reproduced as a sampled sinusoid and can alias. The app gates the wave source's cyclic synchronization using measured performance and keeps its slower cadence and averaged level response when the requested rhythm cannot be represented. The audio rhythm is unchanged. Meteor arrivals are event counts rather than a sampled full-screen sinusoid, so their count continues at the requested rate while the display determines when events become visible. Animation scheduling follows the display and can pause in hidden tabs. Audio keeps running when the tab is hidden; a browser or operating system may still interrupt media for device or power-management reasons. [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

## What the implementation verifies

The stored [digital-signal report](validation/audio-signal.json) renders the production browser audio engine and inspects its samples. Its core checks cover 525/531 Hz separation, expected modulation components, reference-waveform accuracy, preservation of carrier components, musical atmosphere, the absence of an accidental 6,000 Hz tone, and pause/resume behavior. The separate [chant analysis](validation/chant-analysis.json) records all seven source recordings, timbre models, and prepared natural audio files. The [chant signal report](validation/chant-signal.json) verifies rendered fundamentals for all seven tuned models, rhythmic modulation, VAM's changing phrase and silent gap, natural playback against the decoded recording waveform, and the stereo analysis data used by the visual engine. [Reproduction instructions](validation/README.md) explain the methods, measured values, and scope.

These checks verify the browser-generated signals in the recorded test conditions. They do not measure a headphone's acoustic output, a display's emitted spectrum, or a person's physiological response.
