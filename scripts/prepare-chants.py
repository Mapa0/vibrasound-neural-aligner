"""Build deterministic pitch-locked vocal spectral models; never edit sources."""
from pathlib import Path
import hashlib
import json
import wave
import argparse
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input-dir', type=Path, required=True, help='Directory containing the seven original WAV recordings (read only).')
args = parser.parse_args()
SOURCE = args.input_dir
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'chants'
OUT.mkdir(parents=True, exist_ok=True)

def pitch(frame, rate):
    frame = frame - frame.mean()
    size = len(frame)
    spectrum = np.fft.rfft(frame, 2 ** int(np.ceil(np.log2(2 * size))))
    correlation = np.fft.irfft(np.abs(spectrum) ** 2)[:size]
    energy = np.r_[0, np.cumsum(frame * frame)]
    lo, hi = int(rate / 450), int(rate / 65)
    lags = np.arange(lo, hi)
    normalized = correlation[lags] / np.sqrt(np.maximum(1e-20, energy[size - lags] * (energy[size] - energy[lags])))
    peaks = np.where((normalized[1:-1] > normalized[:-2]) & (normalized[1:-1] >= normalized[2:]))[0] + 1
    if not len(peaks):
        return 0., 0.
    best = normalized[peaks].max()
    candidates = peaks[normalized[peaks] >= max(0.65, best * 0.94)]
    if not len(candidates):
        return 0., float(best)
    p = int(candidates[0])
    a, b, c = normalized[p-1:p+2]
    offset = 0.5 * (a-c) / (a-2*b+c) if a-2*b+c else 0
    return float(rate / (lags[p] + offset)), float(normalized[p])

analysis = {
    'method': 'DC removal and autocorrelation F0 on 128 ms frames. Six sustained voices select a stable voiced region, discard silence/unvoiced material, and measure 16 harmonic envelopes for an 8-second circular morph. VAM preserves the complete 15.46-second phrase through 64 spectral/level frames, weak measured onset frication, tapered ends and a 350 ms gap. Runtime hybrid absolute-Hz formant envelope (72%) and relative recorded harmonic profile (28%), with a fundamental floor, are resynthesized at the exact requested fundamental in an AudioWorklet. Each output table targets RMS 0.30 with a 0.70 peak cap before the phrase envelope and app volume/fade.',
    'sourcePolicy': 'Original WAV recordings are read only. Published JSON models contain derived spectral data. Separate processed natural-pitch PCM assets contain trimmed/normalized recordings; originals are not published.',
    'naturalMethod': 'Actual recorded PCM, with no pitch shifting: DC removal, gentle soft peak limiting and RMS normalization. Six sustained excerpts use an 80 ms circular crossfade. VAM keeps the entire recorded phrase, with tapered ends and a 350 ms silent gap. AudioBufferSource playback duplicates the same voice into both channels and applies native target-rate cosine amplitude modulation.',
    'precision': 'Source pitch quantiles describe estimated recording pitch. Tuned playback resynthesizes a selected fundamental, retaining a hybrid formant/harmonic envelope. Natural playback does not shift pitch: it plays actual processed recordings, and its displayed pitch contour is an estimate rather than an exact oscillator frequency.',
    'caveats': ['Tuned resynthesis approximates vocal timbre rather than reproducing the unchanged recording.', 'Tuned VAM preserves the V-to-A-to-M spectral time course with approximated weak onset noise; natural VAM plays the actual recorded consonant and phrase after level/edge processing.', 'At high tuned fundamentals (especially near 1500 Hz), sparse harmonics make vowels and articulation less recognizable.', 'A harmonic voice has multiple spectral components; in tuned mode the requested frequency is its voiced fundamental, not its only frequency.'],
    'recordings': [],
}

for name in ['MMM', 'VAM', 'III', 'EEE', 'OOO', 'UUU', 'AAA']:
    path = SOURCE / f'{name}.wav'
    with wave.open(str(path)) as source:
        rate = source.getframerate()
        raw = np.frombuffer(source.readframes(source.getnframes()), dtype='<i2').astype(float) / 32768
    # Keep pitch analysis cheap; the source has ample low-frequency information.
    down = raw[::8]
    analysis_rate = rate / 8
    length = int(0.128 * analysis_rate)
    hop = int(0.025 * analysis_rate)
    rows = []
    for start in range(0, len(down) - length, hop):
        frame = down[start:start+length]
        rms = float(np.sqrt(np.mean(frame ** 2)))
        f0, confidence = pitch(frame, analysis_rate)
        rows.append((start / analysis_rate + 0.064, f0, confidence, rms))
    rows = np.asarray(rows)
    usable = rows[(rows[:, 1] > 65) & (rows[:, 2] > 0.75) & (rows[:, 3] > rows[:, 3].max() * 0.15)]
    if len(usable) < 20:
        raise RuntimeError(f'Insufficient stable voiced data in {name}')
    median = float(np.median(usable[:, 1]))
    stable = usable[np.abs(usable[:, 1] / median - 1) < 0.15]
    # Pick a quiet-motion sustained span, while retaining measured timbre motion.
    choices = []
    for center in stable[:, 0][::4]:
        selection = stable[np.abs(stable[:, 0] - center) <= 1.4]
        if len(selection) >= 45:
            score = np.std(selection[:, 1]) / np.mean(selection[:, 1]) + 0.002 / np.mean(selection[:, 3])
            choices.append((score, selection))
    selected = min(choices, key=lambda item: item[0])[1] if choices else stable
    phrase = name == 'VAM'
    phrase_duration = len(raw) / rate
    if phrase:
        indexes = [int(np.argmin(np.abs(rows[:, 0] - time))) for time in np.linspace(0, phrase_duration, 64)]
        spectral_rows = rows
    else:
        indexes = np.linspace(0, len(selected)-1, 16).astype(int)
        spectral_rows = selected
    normal_rms = float(np.quantile(usable[:, 3], .95))
    frames = []
    harmonic_ratios = []
    for index in indexes:
        center, f0, confidence, rms = spectral_rows[index]
        if f0 <= 0 or confidence < .65:
            f0 = median
        count = int(round(rate * 10 / f0))
        start = min(len(raw) - count, max(0, int(center * rate) - count // 2))
        x = raw[start:start+count]
        x = x - x.mean()
        window = np.hanning(len(x))
        time = np.arange(len(x)) / rate
        amplitudes = []
        for harmonic in range(1, min(64, int(8000 / f0)) + 1):
            coefficient = 2 * np.sum(x * window * np.exp(-2j * np.pi * f0 * harmonic * time)) / window.sum()
            amplitudes.append(float(abs(coefficient)))
        maximum = max(amplitudes)
        amplitudes = [round(value / maximum, 6) for value in amplitudes]
        item = {'f0': round(float(f0), 5), 'amplitudes': amplitudes}
        if phrase:
            power = np.abs(np.fft.rfft(x * window)) ** 2
            bins = np.fft.rfftfreq(len(x), 1 / rate)
            high_fraction = float(power[bins > 2000].sum() / max(1e-20, power.sum()))
            item['level'] = round(min(1., float(rms) / max(1e-9, normal_rms)), 6)
            item['noise'] = round(min(.12, high_fraction * .8) if center < .6 else 0., 6)
        frames.append(item)
        harmonic_ratios.append(float(sum(value * value for value in amplitudes[1:]) / max(1e-12, amplitudes[0] ** 2)))
    model = {'version': 1, 'chant': name, 'kind': 'articulated-phrase' if phrase else 'sustained', 'framePeriodSeconds': phrase_duration + .35 if phrase else 8, 'frames': frames, 'maxModelFrequency': 8000}
    if phrase:
        model.update({'phraseDurationSeconds': phrase_duration, 'gapSeconds': .35, 'attackSeconds': .12, 'releaseSeconds': .25})
    natural_start = 0. if phrase else float(selected[0, 0] - .064)
    natural_end = phrase_duration if phrase else float(selected[-1, 0] + .064)
    natural = raw[int(natural_start * rate):int(natural_end * rate)].copy()
    natural -= natural.mean()
    source_rms = float(np.sqrt(np.mean(natural ** 2)))
    natural = .70 * np.tanh(natural * (.32 / max(1e-9, source_rms)) / .70)
    # Nonlinear limiting can create a small DC bias in asymmetric vocal cycles.
    # A gentle 20 Hz high-pass removes it without transposing the real voice.
    alpha = float(np.exp(-2 * np.pi * 20 / rate))
    previous_input = 0.
    previous_output = 0.
    for sample in range(len(natural)):
        value = float(natural[sample])
        previous_output = alpha * (previous_output + value - previous_input)
        previous_input = value
        natural[sample] = previous_output
    natural -= natural.mean()
    natural *= min(.28 / np.sqrt(np.mean(natural ** 2)), .70 / max(1e-9, np.abs(natural).max()))
    if phrase:
        attack = int(.12 * rate)
        release = int(.25 * rate)
        natural[:attack] *= np.sin(np.linspace(0, np.pi / 2, attack)) ** 2
        natural[-release:] *= np.cos(np.linspace(0, np.pi / 2, release)) ** 2
        natural = np.r_[natural, np.zeros(int(.35 * rate))]
    else:
        overlap = int(.08 * rate)
        blend = np.sin(np.linspace(0, np.pi / 2, overlap)) ** 2
        loop = natural[:-overlap].copy()
        loop[:overlap] = natural[-overlap:] * (1 - blend) + natural[:overlap] * blend
        natural = loop - loop.mean()
    # Quantize once, deterministically. No resampling or pitch alteration.
    pcm = np.round(np.clip(natural, -.7, .7) * 32767).astype('<i2')
    with wave.open(str(OUT / f'{name}-natural.wav'), 'wb') as destination:
        destination.setnchannels(1); destination.setsampwidth(2); destination.setframerate(rate)
        destination.writeframes(pcm.tobytes())
    natural_duration = len(pcm) / rate
    contour_times = np.linspace(0, phrase_duration if phrase else natural_duration, 64)
    contour = np.interp(natural_start + contour_times, usable[:, 0], usable[:, 1])
    model['natural'] = {
        'asset': f'{name}-natural.wav', 'framePeriodSeconds': natural_duration,
        'phraseDurationSeconds': phrase_duration if phrase else 0,
        'frames': [{'f0': round(float(value), 5)} for value in contour],
        'sourceStartSeconds': natural_start, 'sourceEndSeconds': natural_end,
        'loopCrossfadeSeconds': 0 if phrase else .08,
    }
    (OUT / f'{name}.json').write_text(json.dumps(model, separators=(',', ':')) + '\n')
    entry = {
        'chant': name, 'sourceFile': path.name, 'sourceSHA256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'sampleRate': rate, 'durationSeconds': round(len(raw)/rate, 4),
        'voicedF0Hz': dict(zip(['p05', 'median', 'p95'], [round(float(value), 4) for value in np.quantile(usable[:, 1], [.05,.5,.95])])),
        'selectedF0Hz': dict(zip(['p05', 'median', 'p95'], [round(float(value), 4) for value in np.quantile(selected[:, 1], [.05,.5,.95])])),
        'sourcePitchVariationPercent': round(float(np.std(selected[:, 1]) / np.mean(selected[:, 1]) * 100), 3),
        'sourceTrimSeconds': [round(float(selected[0, 0] - .064), 4), round(float(selected[-1, 0] + .064), 4)],
        'medianHarmonicToFundamentalEnergy': round(float(np.median(harmonic_ratios)), 4),
        'sourcePeak': round(float(np.abs(raw).max()), 5), 'model': f'chants/{name}.json', 'spectralFrames': len(frames),
        'processing': ['DC removed before analysis', 'Silence and low-periodicity frames excluded', 'Stable voiced segment selected', 'Spectral-only model discards background/unvoiced noise', 'Runtime output RMS-normalized with peak cap', 'Continuous circular crossfade, no raw recording loop'],
    }
    entry['kind'] = model['kind']
    normalized_pcm = pcm.astype(float) / 32768
    entry['naturalRecording'] = {
        'asset': f'chants/{name}-natural.wav', 'durationSeconds': natural_duration,
        'sourceTrimSeconds': [round(natural_start, 4), round(natural_end, 4)],
        'rms': round(float(np.sqrt(np.mean(normalized_pcm ** 2))), 6),
        'peak': round(float(np.abs(normalized_pcm).max()), 6),
        'dcMean': round(float(normalized_pcm.mean()), 8),
        'loopBoundaryAdjacentSampleDelta': round(float(abs(normalized_pcm[0] - normalized_pcm[-1])), 6),
        'loopCrossfadeSeconds': 0 if phrase else .08,
        'processing': 'Actual recorded PCM, no pitch shift; DC removal, gentle soft limiting, 20 Hz rumble/DC high-pass, RMS normalization, and loop/phrase edge treatment.',
        'noiseCaveat': 'No reference noise-only recording exists, so no objective SNR improvement is claimed.',
    }
    if phrase:
        entry['sourceTrimSeconds'] = [0, round(phrase_duration, 4)]
        entry['spectralFrames'] = len(frames)
        entry['phraseDurationSeconds'] = phrase_duration
        entry['loopGapSeconds'] = .35
        entry['selectedF0Hz'] = entry['voicedF0Hz']
        entry['sourcePitchVariationPercent'] = round(float(np.std(usable[:, 1]) / np.mean(usable[:, 1]) * 100), 3)
        entry['articulation'] = 'Preserves the full recorded time course: soft V onset, open A through roughly 5.4 seconds, then M closure to the end. Measured level envelope and spectral shape evolve across 64 frames. Weak onset frication is resynthesized as shaped noise; this is not raw speech playback.'
        entry['processing'] += ['Full VAM phrase time course preserved', 'Measured amplitude envelope retained after global normalization', '120 ms onset and 250 ms release with 350 ms gap']
        entry['processing'] = [step for step in entry['processing'] if step not in ['Stable voiced segment selected', 'Silence and low-periodicity frames excluded', 'Spectral-only model discards background/unvoiced noise']]
    segment = raw[int(selected[0, 0] * rate):int(selected[-1, 0] * rate)]
    spectrum = np.abs(np.fft.rfft((segment - segment.mean()) * np.hanning(len(segment)))) ** 2
    frequencies = np.fft.rfftfreq(len(segment), 1 / rate)
    chosen_f0 = float(np.median(selected[:, 1]))
    band_power = lambda frequency: float(spectrum[np.abs(frequencies - frequency) < max(3, frequency * 0.025)].sum())
    true_power = sum(band_power(chosen_f0 * harmonic) for harmonic in [1, 2, 3])
    odd_half_power = sum(band_power(chosen_f0 * harmonic / 2) for harmonic in [1, 3, 5])
    entry['octaveAudit'] = {'selectedF0Hz': round(chosen_f0, 4), 'oddHalfFrequencyBandsToSelectedHarmonicsPowerRatio': round(odd_half_power / max(1e-12, true_power), 8), 'interpretation': 'Small odd-half-frequency energy supports the selected fundamental rather than an octave-lower fundamental; this remains an estimate, not a ground-truth laryngeal measurement.'}
    analysis['recordings'].append(entry)
    print(name, entry['voicedF0Hz'], 'selected', entry['sourceTrimSeconds'], 'variation%', entry['sourcePitchVariationPercent'], 'H/F', entry['medianHarmonicToFundamentalEnergy'])

(ROOT / 'validation' / 'chant-analysis.json').write_text(json.dumps(analysis, indent=2) + '\n')
