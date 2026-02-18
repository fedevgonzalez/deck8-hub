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
  active_slot: ActiveSlot;
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

export interface SoundEntry {
  id: string;
  filename: string;
  display_name: string;
}

export interface AudioConfig {
  sound_files: (string | null)[];
  sound_library: SoundEntry[];
  key_sounds: (string | null)[];
  audio_input_device: string | null;
  audio_output_device: string | null;
  sound_volume: number;
  mic_volume: number;
  soundboard_enabled: boolean;
}

export interface AudioDeviceInfo {
  name: string;
}

export interface AudioDeviceList {
  input_devices: AudioDeviceInfo[];
  output_devices: AudioDeviceInfo[];
}

export interface StateSnapshot {
  connected: boolean;
  keys: KeyConfig[];
  active_slot: ActiveSlot;
  keymaps: number[];
  device_info: DeviceInfo | null;
  rgb_matrix: RgbMatrixState | null;
  audio_config: AudioConfig;
}

// ── Internal keycode detection ──────────────────────────────────────
// Internal keycodes (Ctrl+Alt+Shift+1..8 = 0x071E..0x0725) are auto-assigned
// to keys that have a sound but no user-set shortcut. They should be hidden
// from the UI since the user didn't set them.
const INTERNAL_KEYCODE_BASE = 0x071e;
export function isInternalKeycode(keycode: number): boolean {
  return keycode >= INTERNAL_KEYCODE_BASE && keycode < INTERNAL_KEYCODE_BASE + 8;
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

export function toggleKeySlot(keyIndex: number): Promise<StateSnapshot> {
  if (!isTauri) return Promise.reject("Not in Tauri");
  return tauriInvoke<StateSnapshot>("toggle_key_slot", { keyIndex });
}

export function applyColors(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("apply_colors");
}

export function disableAllOverrides(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("disable_all_overrides");
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

// ── Soundboard ──────────────────────────────────────────────────────

export function listAudioDevices(): Promise<AudioDeviceList> {
  if (!isTauri) return Promise.resolve({ input_devices: [], output_devices: [] });
  return tauriInvoke<AudioDeviceList>("list_audio_devices");
}

export function setAudioInputDevice(name: string): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_audio_input_device", { name });
}

export function setAudioOutputDevice(name: string): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_audio_output_device", { name });
}

export function setSoundVolume(volume: number): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_sound_volume", { volume });
}

export function setMicVolume(volume: number): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_mic_volume", { volume });
}

// ── Sound Library ───────────────────────────────────────────────────

export function addToSoundLibrary(filePath: string, displayName: string): Promise<SoundEntry> {
  if (!isTauri) return Promise.reject("Not in Tauri");
  return tauriInvoke<SoundEntry>("add_to_sound_library", { filePath, displayName });
}

export function addToSoundLibraryTrimmed(
  filePath: string,
  displayName: string,
  startMs: number,
  endMs: number,
): Promise<SoundEntry> {
  if (!isTauri) return Promise.reject("Not in Tauri");
  return tauriInvoke<SoundEntry>("add_to_sound_library_trimmed", {
    filePath, displayName, startMs, endMs,
  });
}

export function removeFromSoundLibrary(soundId: string): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("remove_from_sound_library", { soundId });
}

export function renameSound(soundId: string, newName: string): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("rename_sound", { soundId, newName });
}

export function setKeySound(keyIndex: number, soundId: string | null): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("set_key_sound", { keyIndex, soundId });
}

export function previewLibrarySound(soundId: string): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("preview_library_sound", { soundId });
}

// ── Audio trim ──────────────────────────────────────────────────────

export function getAudioDuration(filePath: string): Promise<number> {
  if (!isTauri) return Promise.resolve(0);
  return tauriInvoke<number>("get_audio_duration", { filePath });
}

export function previewTrim(sourcePath: string, startMs: number, endMs: number): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return tauriInvoke("preview_trim", { sourcePath, startMs, endMs });
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

export function onStateUpdated(
  callback: (snapshot: StateSnapshot) => void,
): Promise<UnlistenFn> {
  if (!isTauri) {
    void callback;
    return Promise.resolve(() => {});
  }
  return import("@tauri-apps/api/event").then(({ listen }) =>
    listen<StateSnapshot>("state-updated", (event) => {
      callback(event.payload);
    }),
  );
}
