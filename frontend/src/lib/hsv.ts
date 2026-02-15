/**
 * Convert QMK-style HSV (0-255 each) to CSS rgb() string.
 */
export function hsvToRgb(h: number, s: number, v: number): string {
  const hNorm = (h / 255) * 360;
  const sNorm = s / 255;
  const vNorm = v / 255;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0,
    g = 0,
    b = 0;
  if (hNorm < 60) {
    r = c; g = x; b = 0;
  } else if (hNorm < 120) {
    r = x; g = c; b = 0;
  } else if (hNorm < 180) {
    r = 0; g = c; b = x;
  } else if (hNorm < 240) {
    r = 0; g = x; b = c;
  } else if (hNorm < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);

  return `rgb(${R}, ${G}, ${B})`;
}

/**
 * Build a CSS linear-gradient for the saturation slider given a hue (0-255).
 */
export function satGradient(h: number): string {
  return `linear-gradient(to right, ${hsvToRgb(h, 0, 200)}, ${hsvToRgb(h, 255, 200)})`;
}

/**
 * Build a CSS linear-gradient for the value/brightness slider given h and s (0-255).
 */
export function valGradient(h: number, s: number): string {
  return `linear-gradient(to right, ${hsvToRgb(h, s, 0)}, ${hsvToRgb(h, s, 255)})`;
}
