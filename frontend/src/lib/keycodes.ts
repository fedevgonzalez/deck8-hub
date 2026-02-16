// ── QMK Keycode Database ────────────────────────────────────────────────

export type KeycodeCategory = "basic" | "multimedia" | "mouse" | "special" | "lighting";

export interface KeycodeDef {
  code: number;
  label: string;
  category: KeycodeCategory;
  wide?: boolean;
}

// ── Modifier constants (QK_MODS range) ──────────────────────────────────

export const MOD_LCTL = 0x0100;
export const MOD_LSFT = 0x0200;
export const MOD_LALT = 0x0400;
export const MOD_LGUI = 0x0800;

// ── Basic keycodes ──────────────────────────────────────────────────────

const KC_NO = 0x0000;
const KC_TRANSPARENT = 0x0001;
const KC_A = 0x0004;

// Build letter keycodes A-Z (0x04-0x1D)
function letters(): KeycodeDef[] {
  const result: KeycodeDef[] = [];
  for (let i = 0; i < 26; i++) {
    result.push({
      code: KC_A + i,
      label: String.fromCharCode(65 + i),
      category: "basic",
    });
  }
  return result;
}

// Build number keycodes 1-0 (0x1E-0x27)
function numbers(): KeycodeDef[] {
  const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  return labels.map((label, i) => ({
    code: 0x1e + i,
    label,
    category: "basic" as const,
  }));
}

export const KEYCODES: KeycodeDef[] = [
  // Special
  { code: KC_NO, label: "—", category: "special" },
  { code: KC_TRANSPARENT, label: "TRNS", category: "special" },

  // Letters
  ...letters(),

  // Numbers
  ...numbers(),

  // Punctuation & symbols (0x28-0x38)
  { code: 0x28, label: "Enter", category: "basic", wide: true },
  { code: 0x29, label: "Esc", category: "basic" },
  { code: 0x2a, label: "Bksp", category: "basic" },
  { code: 0x2b, label: "Tab", category: "basic" },
  { code: 0x2c, label: "Space", category: "basic", wide: true },
  { code: 0x2d, label: "-", category: "basic" },
  { code: 0x2e, label: "=", category: "basic" },
  { code: 0x2f, label: "[", category: "basic" },
  { code: 0x30, label: "]", category: "basic" },
  { code: 0x31, label: "\\", category: "basic" },
  { code: 0x33, label: ";", category: "basic" },
  { code: 0x34, label: "'", category: "basic" },
  { code: 0x35, label: "`", category: "basic" },
  { code: 0x36, label: ",", category: "basic" },
  { code: 0x37, label: ".", category: "basic" },
  { code: 0x38, label: "/", category: "basic" },

  // Modifiers (0x39-0x44)
  { code: 0x39, label: "Caps", category: "basic" },

  // F-keys (0x3A-0x45 = F1-F12)
  { code: 0x3a, label: "F1", category: "basic" },
  { code: 0x3b, label: "F2", category: "basic" },
  { code: 0x3c, label: "F3", category: "basic" },
  { code: 0x3d, label: "F4", category: "basic" },
  { code: 0x3e, label: "F5", category: "basic" },
  { code: 0x3f, label: "F6", category: "basic" },
  { code: 0x40, label: "F7", category: "basic" },
  { code: 0x41, label: "F8", category: "basic" },
  { code: 0x42, label: "F9", category: "basic" },
  { code: 0x43, label: "F10", category: "basic" },
  { code: 0x44, label: "F11", category: "basic" },
  { code: 0x45, label: "F12", category: "basic" },

  // Navigation (0x46-0x52)
  { code: 0x46, label: "PrtSc", category: "basic" },
  { code: 0x47, label: "ScrLk", category: "basic" },
  { code: 0x48, label: "Pause", category: "basic" },
  { code: 0x49, label: "Ins", category: "basic" },
  { code: 0x4a, label: "Home", category: "basic" },
  { code: 0x4b, label: "PgUp", category: "basic" },
  { code: 0x4c, label: "Del", category: "basic" },
  { code: 0x4d, label: "End", category: "basic" },
  { code: 0x4e, label: "PgDn", category: "basic" },
  { code: 0x4f, label: "Right", category: "basic" },
  { code: 0x50, label: "Left", category: "basic" },
  { code: 0x51, label: "Down", category: "basic" },
  { code: 0x52, label: "Up", category: "basic" },

  // Numpad (0x53-0x63)
  { code: 0x53, label: "Num", category: "basic" },
  { code: 0x54, label: "NP/", category: "basic" },
  { code: 0x55, label: "NP*", category: "basic" },
  { code: 0x56, label: "NP-", category: "basic" },
  { code: 0x57, label: "NP+", category: "basic" },
  { code: 0x58, label: "NPEnt", category: "basic" },
  { code: 0x59, label: "NP1", category: "basic" },
  { code: 0x5a, label: "NP2", category: "basic" },
  { code: 0x5b, label: "NP3", category: "basic" },
  { code: 0x5c, label: "NP4", category: "basic" },
  { code: 0x5d, label: "NP5", category: "basic" },
  { code: 0x5e, label: "NP6", category: "basic" },
  { code: 0x5f, label: "NP7", category: "basic" },
  { code: 0x60, label: "NP8", category: "basic" },
  { code: 0x61, label: "NP9", category: "basic" },
  { code: 0x62, label: "NP0", category: "basic" },
  { code: 0x63, label: "NP.", category: "basic" },

  // F13-F24 (0x68-0x73)
  { code: 0x68, label: "F13", category: "basic" },
  { code: 0x69, label: "F14", category: "basic" },
  { code: 0x6a, label: "F15", category: "basic" },
  { code: 0x6b, label: "F16", category: "basic" },
  { code: 0x6c, label: "F17", category: "basic" },
  { code: 0x6d, label: "F18", category: "basic" },
  { code: 0x6e, label: "F19", category: "basic" },
  { code: 0x6f, label: "F20", category: "basic" },
  { code: 0x70, label: "F21", category: "basic" },
  { code: 0x71, label: "F22", category: "basic" },
  { code: 0x72, label: "F23", category: "basic" },
  { code: 0x73, label: "F24", category: "basic" },

  // Modifier keys
  { code: 0xe0, label: "LCtrl", category: "basic" },
  { code: 0xe1, label: "LShift", category: "basic" },
  { code: 0xe2, label: "LAlt", category: "basic" },
  { code: 0xe3, label: "LWin", category: "basic" },
  { code: 0xe4, label: "RCtrl", category: "basic" },
  { code: 0xe5, label: "RShift", category: "basic" },
  { code: 0xe6, label: "RAlt", category: "basic" },
  { code: 0xe7, label: "RWin", category: "basic" },

  // ── Multimedia ──────────────────────────────────────────────────────
  { code: 0x00a5, label: "Mute", category: "multimedia" },
  { code: 0x00a6, label: "Vol+", category: "multimedia" },
  { code: 0x00a7, label: "Vol-", category: "multimedia" },
  { code: 0x00a8, label: "Next", category: "multimedia" },
  { code: 0x00a9, label: "Prev", category: "multimedia" },
  { code: 0x00aa, label: "Stop", category: "multimedia" },
  { code: 0x00ab, label: "Play", category: "multimedia" },
  { code: 0x00b5, label: "Calc", category: "multimedia" },
  { code: 0x00b6, label: "Mail", category: "multimedia" },
  { code: 0x00b7, label: "Search", category: "multimedia" },
  { code: 0x00b8, label: "Home", category: "multimedia" },
  { code: 0x00b9, label: "Back", category: "multimedia" },
  { code: 0x00ba, label: "Fwd", category: "multimedia" },
  { code: 0x00bb, label: "Refresh", category: "multimedia" },
  { code: 0x00bc, label: "BriDn", category: "multimedia" },
  { code: 0x00bd, label: "BriUp", category: "multimedia" },

  // ── Mouse ──────────────────────────────────────────────────────────
  { code: 0x00cd, label: "M-Btn1", category: "mouse" },
  { code: 0x00ce, label: "M-Btn2", category: "mouse" },
  { code: 0x00cf, label: "M-Btn3", category: "mouse" },
  { code: 0x00d0, label: "M-Btn4", category: "mouse" },
  { code: 0x00d1, label: "M-Btn5", category: "mouse" },
  { code: 0x00d5, label: "M-Up", category: "mouse" },
  { code: 0x00d6, label: "M-Down", category: "mouse" },
  { code: 0x00d7, label: "M-Left", category: "mouse" },
  { code: 0x00d8, label: "M-Right", category: "mouse" },
  { code: 0x00d9, label: "WH-Up", category: "mouse" },
  { code: 0x00da, label: "WH-Down", category: "mouse" },
  { code: 0x00db, label: "WH-Left", category: "mouse" },
  { code: 0x00dc, label: "WH-Right", category: "mouse" },
  { code: 0x00dd, label: "M-Acl0", category: "mouse" },
  { code: 0x00de, label: "M-Acl1", category: "mouse" },
  { code: 0x00df, label: "M-Acl2", category: "mouse" },

  // ── RGB Lighting ──────────────────────────────────────────────────
  { code: 0x5cc0, label: "RGB Tog", category: "lighting" },
  { code: 0x5cc1, label: "RGB Mode+", category: "lighting", wide: true },
  { code: 0x5cc2, label: "RGB Mode-", category: "lighting", wide: true },
  { code: 0x5cc3, label: "RGB Hue+", category: "lighting" },
  { code: 0x5cc4, label: "RGB Hue-", category: "lighting" },
  { code: 0x5cc5, label: "RGB Sat+", category: "lighting" },
  { code: 0x5cc6, label: "RGB Sat-", category: "lighting" },
  { code: 0x5cc7, label: "RGB Val+", category: "lighting" },
  { code: 0x5cc8, label: "RGB Val-", category: "lighting" },
  { code: 0x5cc9, label: "RGB Spd+", category: "lighting" },
  { code: 0x5cca, label: "RGB Spd-", category: "lighting" },

  // ── Special ────────────────────────────────────────────────────────
  { code: 0x5c00, label: "RESET", category: "special" },
  { code: 0x5c01, label: "DEBUG", category: "special" },
  { code: 0x5c10, label: "EE_CLR", category: "special" },
];

// ── Lookup map for fast code→label ──────────────────────────────────────

const codeToDefMap = new Map<number, KeycodeDef>();
for (const kc of KEYCODES) {
  codeToDefMap.set(kc.code, kc);
}

// ── Modifier names for display ──────────────────────────────────────────

const MOD_NAMES: [number, string][] = [
  [MOD_LCTL, "Ctrl"],
  [MOD_LSFT, "Shift"],
  [MOD_LALT, "Alt"],
  [MOD_LGUI, "Win"],
];

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Convert a keycode (including QK_MODS composites) to a human-readable label.
 */
export function keycodeToLabel(code: number): string {
  // Direct match
  const direct = codeToDefMap.get(code);
  if (direct) return direct.label;

  // QK_MODS range: 0x0100-0x1FFF — modifier + base keycode
  if (code >= 0x0100 && code <= 0x1fff) {
    const mods = code & 0x1f00;
    const base = code & 0x00ff;
    const parts: string[] = [];
    for (const [flag, name] of MOD_NAMES) {
      if (mods & flag) parts.push(name);
    }
    const baseDef = codeToDefMap.get(base);
    parts.push(baseDef ? baseDef.label : `0x${base.toString(16)}`);
    return parts.join("+");
  }

  return `0x${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Get all keycodes in a given category.
 */
export function getKeycodesByCategory(category: KeycodeCategory): KeycodeDef[] {
  return KEYCODES.filter((kc) => kc.category === category);
}

/**
 * Compose a keycode from a base code + modifier flags.
 */
export function composeKeycode(
  base: number,
  ctrl: boolean,
  shift: boolean,
  alt: boolean,
  gui: boolean,
): number {
  let mods = 0;
  if (ctrl) mods |= MOD_LCTL;
  if (shift) mods |= MOD_LSFT;
  if (alt) mods |= MOD_LALT;
  if (gui) mods |= MOD_LGUI;
  if (mods === 0) return base;
  return mods | (base & 0xff);
}

/**
 * Decompose a QK_MODS keycode into its parts.
 */
export function decomposeKeycode(code: number): {
  base: number;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  gui: boolean;
} {
  if (code < 0x0100 || code > 0x1fff) {
    return { base: code, ctrl: false, shift: false, alt: false, gui: false };
  }
  return {
    base: code & 0x00ff,
    ctrl: !!(code & MOD_LCTL),
    shift: !!(code & MOD_LSFT),
    alt: !!(code & MOD_LALT),
    gui: !!(code & MOD_LGUI),
  };
}

// ── DOM KeyboardEvent → QMK keycode mapping ─────────────────────────────

const DOM_CODE_TO_QMK: Record<string, number> = {
  KeyA: 0x04, KeyB: 0x05, KeyC: 0x06, KeyD: 0x07,
  KeyE: 0x08, KeyF: 0x09, KeyG: 0x0a, KeyH: 0x0b,
  KeyI: 0x0c, KeyJ: 0x0d, KeyK: 0x0e, KeyL: 0x0f,
  KeyM: 0x10, KeyN: 0x11, KeyO: 0x12, KeyP: 0x13,
  KeyQ: 0x14, KeyR: 0x15, KeyS: 0x16, KeyT: 0x17,
  KeyU: 0x18, KeyV: 0x19, KeyW: 0x1a, KeyX: 0x1b,
  KeyY: 0x1c, KeyZ: 0x1d,
  Digit1: 0x1e, Digit2: 0x1f, Digit3: 0x20, Digit4: 0x21,
  Digit5: 0x22, Digit6: 0x23, Digit7: 0x24, Digit8: 0x25,
  Digit9: 0x26, Digit0: 0x27,
  Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b,
  Space: 0x2c, Minus: 0x2d, Equal: 0x2e,
  BracketLeft: 0x2f, BracketRight: 0x30, Backslash: 0x31,
  Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
  Comma: 0x36, Period: 0x37, Slash: 0x38,
  CapsLock: 0x39,
  F1: 0x3a, F2: 0x3b, F3: 0x3c, F4: 0x3d,
  F5: 0x3e, F6: 0x3f, F7: 0x40, F8: 0x41,
  F9: 0x42, F10: 0x43, F11: 0x44, F12: 0x45,
  PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48,
  Insert: 0x49, Home: 0x4a, PageUp: 0x4b,
  Delete: 0x4c, End: 0x4d, PageDown: 0x4e,
  ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
  NumLock: 0x53,
  NumpadDivide: 0x54, NumpadMultiply: 0x55, NumpadSubtract: 0x56,
  NumpadAdd: 0x57, NumpadEnter: 0x58,
  Numpad1: 0x59, Numpad2: 0x5a, Numpad3: 0x5b, Numpad4: 0x5c,
  Numpad5: 0x5d, Numpad6: 0x5e, Numpad7: 0x5f, Numpad8: 0x60,
  Numpad9: 0x61, Numpad0: 0x62, NumpadDecimal: 0x63,
  F13: 0x68, F14: 0x69, F15: 0x6a, F16: 0x6b,
  F17: 0x6c, F18: 0x6d, F19: 0x6e, F20: 0x6f,
  F21: 0x70, F22: 0x71, F23: 0x72, F24: 0x73,
};

/**
 * Map a DOM KeyboardEvent to a QMK keycode (with modifiers).
 * Returns null if the key is a pure modifier or unmapped.
 */
export function keyEventToKeycode(e: KeyboardEvent): number | null {
  // Ignore pure modifier key presses
  if (
    e.code === "ControlLeft" || e.code === "ControlRight" ||
    e.code === "ShiftLeft" || e.code === "ShiftRight" ||
    e.code === "AltLeft" || e.code === "AltRight" ||
    e.code === "MetaLeft" || e.code === "MetaRight"
  ) {
    return null;
  }

  const base = DOM_CODE_TO_QMK[e.code];
  if (base === undefined) return null;

  return composeKeycode(base, e.ctrlKey, e.shiftKey, e.altKey, e.metaKey);
}

export const CATEGORIES: { id: KeycodeCategory; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "multimedia", label: "Media" },
  { id: "mouse", label: "Mouse" },
  { id: "special", label: "Special" },
  { id: "lighting", label: "Lighting" },
];
