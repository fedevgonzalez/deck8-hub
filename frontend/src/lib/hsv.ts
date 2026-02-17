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
 * Convert QMK-style HSV (0-255 each) to hex string (e.g. "#FF00AA").
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  const match = rgb.match(/\d+/g)!;
  return `#${match.map((c) => Number(c).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * Convert hex color string (e.g. "#FF00AA") to QMK-style HSV (0-255 each).
 * Returns null if the hex string is invalid.
 */
export function hexToHsv(hex: string): { h: number; s: number; v: number } | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let hDeg = 0;
  if (d !== 0) {
    if (max === r) hDeg = 60 * (((g - b) / d) % 6);
    else if (max === g) hDeg = 60 * ((b - r) / d + 2);
    else hDeg = 60 * ((r - g) / d + 4);
  }
  if (hDeg < 0) hDeg += 360;

  const sNorm = max === 0 ? 0 : d / max;

  return {
    h: Math.round((hDeg / 360) * 255),
    s: Math.round(sNorm * 255),
    v: Math.round(max * 255),
  };
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
