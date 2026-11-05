/**
 * An explicit octave mapping, not a physiological equivalence of sound and light.
 * Fold the base tone into [c/760nm, c/380nm), exactly one optical octave.
 * XYZ approximation: Wyman, Sloan & Shirley (2013), Eq. 4 / Table 1.
 * https://jcgt.org/published/0002/02/01/paper.pdf
 * XYZ -> sRGB: IEC 61966-2-1, matrix/transfer published by W3C/ICC.
 * https://www.w3.org/Graphics/Color/srgb
 */
const C = 299792458;
const MIN_LIGHT_HZ = C / (760e-9);

function gaussian(wavelength, center, left, right) {
  const x = (wavelength - center) * (wavelength < center ? left : right);
  return Math.exp(-0.5 * x * x);
}

export function wavelengthToRgb(wavelength) {
  if (!Number.isFinite(wavelength) || wavelength < 380 || wavelength > 760) {
    throw new RangeError('Wavelength must be between 380 and 760 nanometers.');
  }
  const x = .362 * gaussian(wavelength, 442, .0624, .0374)
    + 1.056 * gaussian(wavelength, 599.8, .0264, .0323)
    - .065 * gaussian(wavelength, 501.1, .0490, .0382);
  const y = .821 * gaussian(wavelength, 568.8, .0213, .0247)
    + .286 * gaussian(wavelength, 530.9, .0613, .0322);
  const z = 1.217 * gaussian(wavelength, 437, .0845, .0278)
    + .681 * gaussian(wavelength, 459, .0385, .0725);
  const linear = [
    Math.max(0, 3.2406255 * x - 1.537208 * y - .4986286 * z),
    Math.max(0, -.9689307 * x + 1.8757561 * y + .0415175 * z),
    Math.max(0, .0557101 * x - .2040211 * y + 1.0569959 * z),
  ];
  // Constant display brightness keeps spectral endpoints visible. Out-of-gamut
  // monochromatic colors are clipped: this RGB is a display approximation.
  const peak = Math.max(...linear, 1e-12);
  return linear.map(channel => {
    const v = Math.min(1, channel / peak);
    return Math.round(255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055));
  });
}

export function octaveColorForFrequency(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new RangeError('Frequency must be a positive, finite number.');
  }
  let octaves = Math.ceil(Math.log2(MIN_LIGHT_HZ) - Math.log2(frequency));
  let lightHz = frequency * 2 ** octaves;
  if (!Number.isFinite(lightHz) || lightHz === 0) lightHz = 2 ** (Math.log2(frequency) + octaves);
  // Guard floating-point rounding at the octave boundary.
  if (lightHz < MIN_LIGHT_HZ) { lightHz *= 2; octaves++; }
  if (lightHz >= MIN_LIGHT_HZ * 2) { lightHz /= 2; octaves--; }
  const wavelength = Math.max(380, Math.min(760, C / lightHz * 1e9));
  const rgb = wavelengthToRgb(wavelength);
  const hex = '#' + rgb.map(channel => channel.toString(16).padStart(2, '0')).join('');
  return Object.freeze({ frequency, lightHz, octaves, wavelength, rgb, hex });
}
