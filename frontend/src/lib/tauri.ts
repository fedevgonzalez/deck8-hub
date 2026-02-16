// ── Types matching Rust backend ─────────────────────────────────────

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

export interface KeyConfig {
  slot_a: HsvColor;
  slot_b: HsvColor;
  override_enabled: boolean;
}

export type ActiveSlot = "A" | "B";

export interface DeviceInfo {
  protocol_version: number;
  firmware_version: number;
  uptime: number;
  layer_count: number;
  macro_count: number;
  macro_buffer_size: number;
}

export interface RgbMatrixState {
  brightness: number;
  effect: number;
  speed: number;
  color_h: number;
  color_s: number;
}

export interface StateSnapshot {
  connected: boolean;
  keys: KeyConfig[];
  active_slot: ActiveSlot;
  current_profile_name: string | null;
  keymaps: number[];
  device_info: DeviceInfo | null;
  rgb_matrix: RgbMatrixState | null;
}

// ── Runtime detection ───────────────────────────────────────────────

const isTauri = "__TAURI_INTERNALS__" in window;

// Lazy-load Tauri APIs only when inside Tauri runtime
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ── IPC Commands ────────────────────────────────────────────────────

export function connectDevice(): Promise<boolean> {
  if (!isTauri) return Promise.resolve(false);
  return tauriInvoke<boolean>("connect_device");
}

export function getState(): Promise<StateSnapshot> {
  if (!isTauri) return Promise.reject("Not in Tauri");
  return tauriInvoke<StateSnapshot>("get_state");
}

export function setKeyColor(
  keyIndex: number,
  slot: ActiveSlot,
  h: number,
  s: number,
  v: number,
): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_key_color", { keyIndex, slot, h, s, v });
}

export function toggleSlot(): Promise<string> {
  if (!isTauri) return Promise.resolve("B");
  return tauriInvoke<string>("toggle_slot");
}

export function applyColors(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("apply_colors");
}

export function disableAllOverrides(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("disable_all_overrides");
}

export function listProfiles(): Promise<string[]> {
  if (!isTauri) return Promise.resolve(["demo-profile"]);
  return tauriInvoke<string[]>("list_profiles");
}

export function saveProfile(name: string): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("save_profile", { name });
}

export function loadProfile(name: string): Promise<StateSnapshot> {
  if (!isTauri) return Promise.reject(`Cannot load "${name}" outside Tauri`);
  return tauriInvoke<StateSnapshot>("load_profile", { name });
}

export function deleteProfile(name: string): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("delete_profile", { name });
}

export function getKeymap(): Promise<number[]> {
  if (!isTauri) return Promise.resolve([0, 0, 0, 0, 0, 0, 0, 0]);
  return tauriInvoke<number[]>("get_keymap");
}

export function setKeycode(keyIndex: number, keycode: number): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_keycode", { keyIndex, keycode });
}

export function setKeyOverride(keyIndex: number, enabled: boolean): Promise<StateSnapshot> {
  if (!isTauri) return Promise.reject("Not in Tauri");
  return tauriInvoke<StateSnapshot>("set_key_override", { keyIndex, enabled });
}

export function restoreDefaults(): Promise<StateSnapshot> {
  if (!isTauri) return Promise.reject("Not in Tauri");
  return tauriInvoke<StateSnapshot>("restore_defaults");
}

// ── Device info & control ───────────────────────────────────────────

export function getDeviceInfo(): Promise<DeviceInfo> {
  if (!isTauri) return Promise.reject("Not in Tauri");
  return tauriInvoke<DeviceInfo>("get_device_info");
}

export function deviceIndication(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("device_indication");
}

export function bootloaderJump(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("bootloader_jump");
}

export function eepromReset(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("eeprom_reset");
}

export function dynamicKeymapReset(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("dynamic_keymap_reset");
}

export function macroReset(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("macro_reset");
}

// ── Per-key EEPROM persistence ──────────────────────────────────────

export function saveCustom(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("save_custom");
}

// ── RGB Matrix ─────────────────────────────────────────────────────

export function getRgbMatrix(): Promise<RgbMatrixState> {
  if (!isTauri) return Promise.reject("Not in Tauri");
  return tauriInvoke<RgbMatrixState>("get_rgb_matrix");
}

export function setRgbBrightness(value: number): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_rgb_brightness", { value });
}

export function setRgbEffect(value: number): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_rgb_effect", { value });
}

export function setRgbSpeed(value: number): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_rgb_speed", { value });
}

export function setRgbColor(h: number, s: number): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_rgb_color", { h, s });
}

export function saveRgbMatrix(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("save_rgb_matrix");
}

// ── Events ──────────────────────────────────────────────────────────

type UnlistenFn = () => void;

export function onSlotToggled(
  callback: (newSlot: string) => void,
): Promise<UnlistenFn> {
  if (!isTauri) {
    void callback; // unused in browser
    return Promise.resolve(() => {});
  }
  return import("@tauri-apps/api/event").then(({ listen }) =>
    listen<string>("slot-toggled", (event) => {
      callback(event.payload);
    }),
  );
}
