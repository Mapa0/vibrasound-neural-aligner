import { octaveColorForFrequency } from './octave-color.js';

/**
 * Mystic presets are listening and symbolic conventions, not clinical protocols.
 * Chakra colors use a familiar contemporary palette. Other families retain the
 * app's mathematical octave palette. Target rhythms below are creative defaults.
 */
export const MYSTIC_CONTEXT = Object.freeze({
  chakras: 'Seven symbolic centers from chakra traditions, paired with a contemporary sound palette. The rhythms are creative starting points.',
  solfeggio: 'Six pure tones from the contemporary Solfeggio system popularized by Joseph Puleo and Leonard Horowitz. Medieval Ut–La taught relative pitch rather than these fixed frequencies.',
  notes: 'Pure notes in just intonation: simple whole-number ratios. Choose C = 256 Hz or A = 432 Hz; each is a separate tuning reference.',
});

const chakraRows = [
  ['muladhara', 'Muladhara', 'Root', 396, 4, '#ef5261', 'Grounding'],
  ['svadhisthana', 'Svadhisthana', 'Sacral', 417, 6, '#f39b52', 'Flow'],
  ['manipura', 'Manipura', 'Solar plexus', 528, 10, '#f1cc62', 'Intention'],
  ['anahata', 'Anahata', 'Heart', 639, 10, '#77c59b', 'Connection'],
  ['vishuddha', 'Vishuddha', 'Throat', 741, 12, '#78b8ef', 'Expression'],
  ['ajna', 'Ajna', 'Third eye', 852, 14, '#8d87e3', 'Reflection'],
  ['sahasrara', 'Sahasrara', 'Crown', 963, 40, '#c4a3ef', 'Openness'],
];

export const CHAKRA_PRESETS = Object.freeze(chakraRows.map(([id, label, subtitle, carrier, target, color, intention]) => Object.freeze({
  id, label, subtitle, carrier, target, color,
  description: `${intention} · ${carrier} Hz base · ${target} Hz rhythm. A symbolic listening preset.`,
  audioMode: 'binaural',
})));

const syllables = ['UT', 'RE', 'MI', 'FA', 'SOL', 'LA'];
export const SOLFEGGIO_PRESETS = Object.freeze([396, 417, 528, 639, 741, 852].map((carrier, index) => Object.freeze({
  id: `solfeggio-${carrier}`,
  label: syllables[index],
  subtitle: `${carrier} Hz`,
  carrier,
  target: 6,
  color: octaveColorForFrequency(carrier).hex,
  description: `${carrier} Hz pure tone · ${syllables[index]} in the contemporary Solfeggio system. The rhythm remains available for visuals.`,
  audioMode: 'tone',
})));

const noteRows = [
  ['c', 'C', 1, 1],
  ['d', 'D', 9, 8],
  ['e', 'E', 5, 4],
  ['f', 'F', 4, 3],
  ['g', 'G', 3, 2],
  ['a', 'A', 5, 3],
  ['b', 'B', 15, 8],
];

export const MUSICAL_TUNINGS = Object.freeze({
  c256: Object.freeze({
    label: 'C = 256 Hz',
    root: 256,
    description: 'C = 256 Hz gives A = 426.667 Hz in this just scale.',
  }),
  a432: Object.freeze({
    label: 'A = 432 Hz',
    root: 432 * 3 / 5,
    description: 'A = 432 Hz gives C = 259.2 Hz in this just scale.',
  }),
});

export function getMusicalPresets(tuning = 'c256') {
  if (!Object.hasOwn(MUSICAL_TUNINGS, tuning)) throw new RangeError('Choose c256 or a432 tuning.');
  const { root, description } = MUSICAL_TUNINGS[tuning];
  return Object.freeze(noteRows.map(([id, label, numerator, denominator]) => {
    const carrier = root * numerator / denominator;
    const frequencyLabel = Number(carrier.toFixed(3)).toString();
    return Object.freeze({
      id: `note-${id}`,
      label,
      subtitle: `${frequencyLabel} Hz`,
      carrier,
      target: 6,
      color: octaveColorForFrequency(carrier).hex,
      description: `${label} · ${numerator}:${denominator} from C. ${description}`,
      audioMode: 'tone',
    });
  }));
}
