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

export interface StateSnapshot {
  connected: boolean;
  keys: KeyConfig[];
  active_slot: ActiveSlot;
  current_profile_name: string | null;
  keymaps: number[];
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
