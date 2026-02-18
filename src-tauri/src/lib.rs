mod audio;
mod hid;
mod profile;
mod protocol;
mod state;

use log::{error, info, warn};
use protocol::{DeviceInfo, RgbMatrixState};
use state::{
    ActiveSlot, AppState, AudioConfig, KeyConfig, ManagedAudioPipeline, SharedState,
    SoundEntry, StateSnapshot,
};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State,
};

// ── QMK keycode → Tauri shortcut string ─────────────────────────────────

/// Convert a QMK keycode (modifier+basic) to a Tauri global shortcut string.
/// Returns None if the keycode can't be represented as a shortcut.
/// Uses the Tauri/global_hotkey Display format: "Ctrl+Alt+M" for registration.
fn qmk_keycode_to_shortcut(keycode: u16) -> Option<String> {
    let mods = (keycode >> 8) as u8;
    let basic = (keycode & 0xFF) as u8;

    // Only handle keycodes with modifiers
    if mods == 0 || basic == 0 {
        return None;
    }

    let mut parts = Vec::new();
    // Left or right Ctrl
    if mods & 0x11 != 0 { parts.push("Ctrl"); }
    // Left or right Shift
    if mods & 0x22 != 0 { parts.push("Shift"); }
    // Left or right Alt
    if mods & 0x44 != 0 { parts.push("Alt"); }
    // Left or right GUI
    if mods & 0x88 != 0 { parts.push("Super"); }

    let key_name = match basic {
        0x04..=0x1D => String::from((b'A' + (basic - 0x04)) as char),
        0x1E..=0x26 => String::from((b'1' + (basic - 0x1E)) as char),
        0x27 => "0".into(),
        0x28 => "Enter".into(),
        0x29 => "Escape".into(),
        0x2C => "Space".into(),
        0x3A..=0x45 => format!("F{}", basic - 0x3A + 1),
        _ => return None,
    };

    parts.push(&key_name);
    Some(parts.join("+"))
}

/// Convert a QMK keycode to the Display format used by Tauri's Shortcut type.
/// This is the format returned by `format!("{}", shortcut)` in the handler.
/// Example: "control+alt+KeyM" (lowercase modifiers, "Key" prefix for letters)
fn qmk_keycode_to_display(keycode: u16) -> Option<String> {
    let mods = (keycode >> 8) as u8;
    let basic = (keycode & 0xFF) as u8;

    if mods == 0 || basic == 0 {
        return None;
    }

    // Order must match Tauri's global_hotkey Display format:
    // shift (bit 0), control (bit 1), alt (bit 2), super (bit 3)
    let mut parts = Vec::new();
    if mods & 0x22 != 0 { parts.push("shift".to_string()); }
    if mods & 0x11 != 0 { parts.push("control".to_string()); }
    if mods & 0x44 != 0 { parts.push("alt".to_string()); }
    if mods & 0x88 != 0 { parts.push("super".to_string()); }

    let key_name = match basic {
        0x04..=0x1D => format!("Key{}", (b'A' + (basic - 0x04)) as char),
        0x1E..=0x26 => format!("Digit{}", (b'1' + (basic - 0x1E)) as char),
        0x27 => "Digit0".into(),
        0x28 => "Enter".into(),
        0x29 => "Escape".into(),
        0x2C => "Space".into(),
        0x3A..=0x45 => format!("F{}", basic - 0x3A + 1),
        _ => return None,
    };

    parts.push(key_name);
    Some(parts.join("+"))
}

/// Simulate a QMK keycode as a real keystroke via enigo.
/// This replays the shortcut to the OS so the focused application receives it.
fn simulate_qmk_keystroke(keycode: u16) {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};

    let mods = (keycode >> 8) as u8;
    let basic = (keycode & 0xFF) as u8;

    let mut enigo = match Enigo::new(&Settings::default()) {
        Ok(e) => e,
        Err(e) => {
            error!("[replay] Failed to create Enigo: {}", e);
            return;
        }
    };

    // Press modifiers
    if mods & 0x11 != 0 { let _ = enigo.key(Key::Control, Direction::Press); }
    if mods & 0x22 != 0 { let _ = enigo.key(Key::Shift, Direction::Press); }
    if mods & 0x44 != 0 { let _ = enigo.key(Key::Alt, Direction::Press); }
    if mods & 0x88 != 0 { let _ = enigo.key(Key::Meta, Direction::Press); }

    // Press+release the base key
    let key = match basic {
        0x04..=0x1D => Some(Key::Unicode((b'a' + (basic - 0x04)) as char)),
        0x1E..=0x26 => Some(Key::Unicode((b'1' + (basic - 0x1E)) as char)),
        0x27 => Some(Key::Unicode('0')),
        0x28 => Some(Key::Return),
        0x29 => Some(Key::Escape),
        0x2C => Some(Key::Space),
        0x3A => Some(Key::F1),
        0x3B => Some(Key::F2),
        0x3C => Some(Key::F3),
        0x3D => Some(Key::F4),
        0x3E => Some(Key::F5),
        0x3F => Some(Key::F6),
        0x40 => Some(Key::F7),
        0x41 => Some(Key::F8),
        0x42 => Some(Key::F9),
        0x43 => Some(Key::F10),
        0x44 => Some(Key::F11),
        0x45 => Some(Key::F12),
        _ => None,
    };
    if let Some(k) = key {
        let _ = enigo.key(k, Direction::Click);
    }

    // Release modifiers (reverse order)
    if mods & 0x88 != 0 { let _ = enigo.key(Key::Meta, Direction::Release); }
    if mods & 0x44 != 0 { let _ = enigo.key(Key::Alt, Direction::Release); }
    if mods & 0x22 != 0 { let _ = enigo.key(Key::Shift, Direction::Release); }
    if mods & 0x11 != 0 { let _ = enigo.key(Key::Control, Direction::Release); }
}

/// Convert keymap index (matrix-order) to LED index (snake-wired).
/// Top row: key 0-3 → LED 0-3 (direct)
/// Bottom row: key 4-7 → LED 7,6,5,4 (reversed due to snake wiring)
fn keymap_to_led_index(keymap_idx: usize) -> usize {
    if keymap_idx < 4 {
        keymap_idx
    } else {
        11 - keymap_idx // 4→7, 5→6, 6→5, 7→4
    }
}

/// Register per-key global shortcuts based on actual device keymaps.
fn register_key_shortcuts(app: &AppHandle, keymaps: &[u16; 8]) {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;

    // Unregister any previous shortcuts
    if let Err(e) = app.global_shortcut().unregister_all() {
        warn!("[shortcuts] Failed to unregister old shortcuts: {}", e);
    }

    let state = app.state::<SharedState>();
    let mut st = state.lock().unwrap();
    st.shortcut_map.clear();

    for (i, &keycode) in keymaps.iter().enumerate() {
        if let Some(shortcut_str) = qmk_keycode_to_shortcut(keycode) {
            let display_str = qmk_keycode_to_display(keycode).unwrap_or_default();
            // Map keymap index → LED index (accounts for snake wiring on bottom row)
            let led_idx = keymap_to_led_index(i);
            info!("[shortcuts] keymap={} → led={} keycode=0x{:04X} → \"{}\"",
                  i, led_idx, keycode, shortcut_str);
            match app.global_shortcut().register(shortcut_str.as_str()) {
                Ok(_) => {
                    st.shortcut_map.insert(
                        display_str,
                        (led_idx, keycode, shortcut_str.clone()),
                    );
                }
                Err(e) => {
                    error!("[shortcuts] keymap={} register failed: {}", i, e);
                }
            }
        } else {
            info!("[shortcuts] keymap={} keycode=0x{:04X} → not mappable", i, keycode);
        }
    }
    info!("[shortcuts] Registered {} per-key shortcuts", st.shortcut_map.len());
}

// ── Internal keycodes for sound-only keys ───────────────────────────────

/// Internal keycodes: Ctrl+Alt+Shift + {1..8} (0x071E..0x0725).
/// Auto-assigned when a key has a sound but no user-set keycode.
/// The shortcut handler skips keystroke replay for these.
const INTERNAL_KEYCODE_BASE: u16 = 0x071E; // Ctrl+Alt+Shift+1

fn internal_keycode_for_key(led_index: usize) -> u16 {
    INTERNAL_KEYCODE_BASE + led_index as u16
}

fn is_internal_keycode(keycode: u16) -> bool {
    keycode >= INTERNAL_KEYCODE_BASE && keycode < INTERNAL_KEYCODE_BASE + 8
}

/// Convert LED index to keymap/matrix index (inverse of keymap_to_led_index).
/// The mapping is symmetric: top row direct, bottom row reversed.
fn led_to_keymap_index(led_idx: usize) -> usize {
    if led_idx < 4 { led_idx } else { 11 - led_idx }
}

// ── Helpers ─────────────────────────────────────────────────────────────

/// Apply color for a single key to the device, using the key's own active_slot.
fn apply_key_to_device(dev: &hid::Deck8Device, key_index: u8, key: &KeyConfig) {
    if key.override_enabled {
        let color = match key.active_slot {
            ActiveSlot::A => &key.slot_a,
            ActiveSlot::B => &key.slot_b,
        };
        info!("[apply] key={} slot={:?} override=ON h={} s={} v={}",
              key_index, key.active_slot, color.h, color.s, color.v);
        if let Err(e) = dev.set_key_color(key_index, color) {
            error!("[apply] key={} set_key_color FAILED: {:#}", key_index, e);
        }
    } else {
        info!("[apply] key={} override=OFF → disable", key_index);
        if let Err(e) = dev.disable_override(key_index) {
            error!("[apply] key={} disable_override FAILED: {:#}", key_index, e);
        }
    }
}

/// Persist key + audio state to disk (fire-and-forget).
fn persist_state(keys: &[KeyConfig; 8], audio_config: &AudioConfig) {
    if let Err(e) = profile::save_state(keys, audio_config) {
        error!("Failed to persist state: {e:#}");
    }
}

/// Apply all 8 keys to device, using each key's own active_slot.
fn apply_all_to_device(dev: &hid::Deck8Device, keys: &[KeyConfig; 8]) {
    for i in 0..8 {
        apply_key_to_device(dev, i as u8, &keys[i]);
    }
}

// ── Tauri Commands ──────────────────────────────────────────────────────

#[tauri::command]
fn connect_device(app: AppHandle, state: State<SharedState>) -> bool {
    let mut s = state.lock().unwrap();
    match hid::Deck8Device::open() {
        Ok(dev) => {
            let mut keymaps_copy = [0u16; 8];
            match dev.read_all_keycodes() {
                Ok(keymaps) => {
                    s.keymaps = keymaps;
                    keymaps_copy = keymaps;
                    info!("[connect] Keymaps: {:?}",
                          keymaps.iter().map(|k| format!("0x{:04X}", k)).collect::<Vec<_>>());
                }
                Err(e) => error!("Failed to read keymaps: {e:#}"),
            }
            match dev.get_device_info() {
                Ok(info) => s.device_info = Some(info),
                Err(e) => error!("Failed to read device info: {e:#}"),
            }
            match dev.rgb_get_state() {
                Ok(rgb) => s.rgb_matrix = Some(rgb),
                Err(e) => error!("Failed to read RGB state: {e:#}"),
            }
            s.device = Some(dev);
            // Sync ALL 8 keys on connect: enable overrides we want, disable the rest.
            if let Some(ref dev) = s.device {
                info!("[connect] Syncing all 8 keys to device...");
                for (i, k) in s.keys.iter().enumerate() {
                    info!("[connect]   key={} override={} slot={:?}", i, k.override_enabled, k.active_slot);
                }
                apply_all_to_device(dev, &s.keys);
                info!("[connect] Saving clean state to EEPROM...");
                if let Err(e) = dev.custom_save() {
                    error!("[connect] custom_save FAILED: {:#}", e);
                }
            }
            // Auto-assign internal keycodes for keys with sounds but no keycode
            for led_idx in 0..8 {
                if s.audio_config.key_sounds[led_idx].is_some() {
                    let km_idx = led_to_keymap_index(led_idx);
                    if s.keymaps[km_idx] == 0x0000 {
                        let internal_kc = internal_keycode_for_key(led_idx);
                        if let Some(ref dev) = s.device {
                            let (row, col) = protocol::key_index_to_matrix(km_idx as u8);
                            if let Err(e) = dev.set_keycode(0, row, col, internal_kc) {
                                error!("[sound] Failed to auto-assign keycode on connect: {}", e);
                            }
                        }
                        s.keymaps[km_idx] = internal_kc;
                        info!("[sound] Auto-assigned internal keycode 0x{:04X} to LED {} on connect", internal_kc, led_idx);
                    }
                }
            }
            keymaps_copy = s.keymaps;

            // Release lock before registering shortcuts (which also locks state)
            drop(s);
            // Register per-key shortcuts based on actual device keymaps
            register_key_shortcuts(&app, &keymaps_copy);
            true
        }
        Err(e) => {
            error!("Failed to connect: {e:#}");
            s.device = None;
            s.device_info = None;
            s.rgb_matrix = None;
            false
        }
    }
}

#[tauri::command]
fn get_state(state: State<SharedState>) -> StateSnapshot {
    state.lock().unwrap().snapshot()
}

#[tauri::command]
fn set_key_color(
    state: State<SharedState>,
    key_index: usize,
    slot: String,
    h: u8,
    s: u8,
    v: u8,
) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if key_index >= 8 {
        return Err("key_index out of range".into());
    }
    let color = protocol::HsvColor { h, s, v };
    let parsed_slot = match slot.as_str() {
        "A" => { st.keys[key_index].slot_a = color; ActiveSlot::A },
        "B" => { st.keys[key_index].slot_b = color; ActiveSlot::B },
        _ => return Err("slot must be A or B".into()),
    };
    // Update the key's active slot to match whichever slot was just edited
    st.keys[key_index].active_slot = parsed_slot;
    // Always send to device when override is enabled
    if st.keys[key_index].override_enabled {
        if let Some(ref dev) = st.device {
            dev.set_key_color(key_index as u8, &color)
                .map_err(|e| e.to_string())?;
        }
    }
    persist_state(&st.keys, &st.audio_config);
    Ok(())
}

#[tauri::command]
fn toggle_slot(state: State<SharedState>) -> Result<String, String> {
    info!("⚠️ [GLOBAL IPC] toggle_slot command called!");
    let mut st = state.lock().unwrap();
    // Toggle global indicator
    st.active_slot = match st.active_slot {
        ActiveSlot::A => ActiveSlot::B,
        ActiveSlot::B => ActiveSlot::A,
    };
    let new_slot = st.active_slot;
    // Toggle each key's individual slot
    for key in st.keys.iter_mut() {
        key.active_slot = match key.active_slot {
            ActiveSlot::A => ActiveSlot::B,
            ActiveSlot::B => ActiveSlot::A,
        };
    }
    if let Some(ref dev) = st.device {
        apply_all_to_device(dev, &st.keys);
    }
    persist_state(&st.keys, &st.audio_config);
    Ok(new_slot.to_string())
}

#[tauri::command]
fn toggle_key_slot(
    state: State<SharedState>,
    key_index: usize,
) -> Result<StateSnapshot, String> {
    let mut st = state.lock().unwrap();
    if key_index >= 8 {
        return Err("key_index out of range".into());
    }
    let old = st.keys[key_index].active_slot;
    st.keys[key_index].active_slot = match old {
        ActiveSlot::A => ActiveSlot::B,
        ActiveSlot::B => ActiveSlot::A,
    };
    let new = st.keys[key_index].active_slot;
    info!("[PER-KEY TOGGLE] key={} {:?}→{:?} override={}",
          key_index, old, new, st.keys[key_index].override_enabled);
    if let Some(ref dev) = st.device {
        apply_key_to_device(dev, key_index as u8, &st.keys[key_index]);
    }
    persist_state(&st.keys, &st.audio_config);
    Ok(st.snapshot())
}

#[tauri::command]
fn apply_colors(state: State<SharedState>) -> Result<(), String> {
    let st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        apply_all_to_device(dev, &st.keys);
    }
    Ok(())
}

#[tauri::command]
fn disable_all_overrides(state: State<SharedState>) -> Result<(), String> {
    let st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        for i in 0..8u8 {
            dev.disable_override(i).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn get_keymap(state: State<SharedState>) -> Result<Vec<u16>, String> {
    let mut st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        match dev.read_all_keycodes() {
            Ok(keymaps) => {
                st.keymaps = keymaps;
                Ok(keymaps.to_vec())
            }
            Err(e) => Err(e.to_string()),
        }
    } else {
        Ok(st.keymaps.to_vec())
    }
}

#[tauri::command]
fn set_keycode(
    app: AppHandle,
    state: State<SharedState>,
    key_index: usize,
    keycode: u16,
) -> Result<(), String> {
    let keymaps_copy;
    {
        let mut st = state.lock().unwrap();
        if key_index >= 8 {
            return Err("key_index out of range".into());
        }
        let (row, col) = protocol::key_index_to_matrix(key_index as u8);
        if let Some(ref dev) = st.device {
            dev.set_keycode(0, row, col, keycode)
                .map_err(|e| e.to_string())?;
        }
        st.keymaps[key_index] = keycode;
        keymaps_copy = st.keymaps;
    }
    // Re-register shortcuts with updated keymaps
    register_key_shortcuts(&app, &keymaps_copy);
    Ok(())
}

#[tauri::command]
fn set_key_override(
    state: State<SharedState>,
    key_index: usize,
    enabled: bool,
) -> Result<StateSnapshot, String> {
    let mut st = state.lock().unwrap();
    if key_index >= 8 {
        return Err("key_index out of range".into());
    }
    st.keys[key_index].override_enabled = enabled;
    if let Some(ref dev) = st.device {
        apply_key_to_device(dev, key_index as u8, &st.keys[key_index]);
        // Persist per-key overrides to device EEPROM
        let _ = dev.custom_save();
    }
    persist_state(&st.keys, &st.audio_config);
    Ok(st.snapshot())
}

#[tauri::command]
fn restore_defaults(state: State<SharedState>) -> Result<StateSnapshot, String> {
    let mut st = state.lock().unwrap();
    st.keys = std::array::from_fn(|_| KeyConfig::default());
    if let Some(ref dev) = st.device {
        apply_all_to_device(dev, &st.keys);
        let _ = dev.custom_save();
    }
    persist_state(&st.keys, &st.audio_config);
    Ok(st.snapshot())
}

// ── Device info & control commands ───────────────────────────────────────

#[tauri::command]
fn get_device_info(state: State<SharedState>) -> Result<DeviceInfo, String> {
    let mut st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        let info = dev.get_device_info().map_err(|e| e.to_string())?;
        st.device_info = Some(info.clone());
        Ok(info)
    } else {
        st.device_info.clone().ok_or_else(|| "Not connected".into())
    }
}

#[tauri::command]
fn device_indication(state: State<SharedState>) -> Result<(), String> {
    let st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.device_indication().map_err(|e| e.to_string())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
fn bootloader_jump(state: State<SharedState>) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        let _ = dev.bootloader_jump();
    }
    st.device = None;
    st.device_info = None;
    st.rgb_matrix = None;
    Ok(())
}

#[tauri::command]
fn eeprom_reset(state: State<SharedState>) -> Result<(), String> {
    let st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.eeprom_reset().map_err(|e| e.to_string())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
fn dynamic_keymap_reset(state: State<SharedState>) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.dynamic_keymap_reset().map_err(|e| e.to_string())?;
        match dev.read_all_keycodes() {
            Ok(keymaps) => st.keymaps = keymaps,
            Err(e) => error!("Failed to re-read keymaps after reset: {e:#}"),
        }
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
fn macro_reset(state: State<SharedState>) -> Result<(), String> {
    let st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.macro_reset().map_err(|e| e.to_string())
    } else {
        Err("Not connected".into())
    }
}

// ── RGB Matrix commands ─────────────────────────────────────────────────

#[tauri::command]
fn get_rgb_matrix(state: State<SharedState>) -> Result<RgbMatrixState, String> {
    let mut st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        let rgb = dev.rgb_get_state().map_err(|e| e.to_string())?;
        st.rgb_matrix = Some(rgb);
        Ok(rgb)
    } else {
        st.rgb_matrix.ok_or_else(|| "Not connected".into())
    }
}

#[tauri::command]
fn set_rgb_brightness(state: State<SharedState>, value: u8) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.rgb_set_brightness(value).map_err(|e| e.to_string())?;
        if let Some(ref mut rgb) = st.rgb_matrix {
            rgb.brightness = value;
        }
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
fn set_rgb_effect(state: State<SharedState>, value: u8) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.rgb_set_effect(value).map_err(|e| e.to_string())?;
        if let Some(ref mut rgb) = st.rgb_matrix {
            rgb.effect = value;
        }
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
fn set_rgb_speed(state: State<SharedState>, value: u8) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.rgb_set_speed(value).map_err(|e| e.to_string())?;
        if let Some(ref mut rgb) = st.rgb_matrix {
            rgb.speed = value;
        }
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
fn set_rgb_color(state: State<SharedState>, h: u8, s: u8) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.rgb_set_color(h, s).map_err(|e| e.to_string())?;
        if let Some(ref mut rgb) = st.rgb_matrix {
            rgb.color_h = h;
            rgb.color_s = s;
        }
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
fn save_custom(state: State<SharedState>) -> Result<(), String> {
    let st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.custom_save().map_err(|e| e.to_string())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
fn save_rgb_matrix(state: State<SharedState>) -> Result<(), String> {
    let st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.rgb_save().map_err(|e| e.to_string())
    } else {
        Err("Not connected".into())
    }
}

// ── Soundboard commands ──────────────────────────────────────────────────

#[tauri::command]
fn list_audio_devices() -> audio::AudioDeviceList {
    audio::list_devices()
}

/// Check if a device name looks like a virtual audio cable.
fn is_virtual_cable(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("cable") || lower.contains("blackhole") || lower.contains("virtual")
}

/// Try to (re)start the audio pipeline if both input and output devices are configured.
/// Only starts if the output device looks like a virtual cable (to avoid echo).
/// Stops any existing pipeline first. Silently does nothing if devices aren't set.
fn try_auto_start_pipeline(
    state: &State<SharedState>,
    pipeline_state: &State<ManagedAudioPipeline>,
) {
    // Stop existing pipeline
    {
        let mut pl = pipeline_state.0.lock().unwrap();
        if pl.is_some() {
            *pl = None;
            info!("[audio] Pipeline stopped (restart)");
        }
    }

    let st = state.lock().unwrap();
    let input = match st.audio_config.audio_input_device.as_deref() {
        Some(s) => s.to_string(),
        None => return,
    };
    let output = match st.audio_config.audio_output_device.as_deref() {
        Some(s) => s.to_string(),
        None => return,
    };

    // Only start pipeline if output is a virtual cable — otherwise mic audio
    // would loop back to the user's own speakers/headphones causing echo.
    if !is_virtual_cable(&output) {
        info!("[audio] Skipping pipeline auto-start: output \"{}\" is not a virtual cable", output);
        return;
    }

    let mic_vol = st.audio_config.mic_volume;
    let sound_vol = st.audio_config.sound_volume;
    drop(st);

    match audio::AudioPipeline::start(&input, &output, mic_vol, sound_vol) {
        Ok(pipeline) => {
            let mut pl = pipeline_state.0.lock().unwrap();
            *pl = Some(pipeline);
            let mut st = state.lock().unwrap();
            st.audio_config.soundboard_enabled = true;
            persist_state(&st.keys, &st.audio_config);
        }
        Err(e) => {
            warn!("[audio] Auto-start pipeline failed: {}", e);
        }
    }
}

#[tauri::command]
fn set_audio_input_device(
    state: State<SharedState>,
    pipeline_state: State<ManagedAudioPipeline>,
    name: String,
) -> Result<(), String> {
    {
        let mut st = state.lock().unwrap();
        st.audio_config.audio_input_device = Some(name);
        persist_state(&st.keys, &st.audio_config);
    }
    try_auto_start_pipeline(&state, &pipeline_state);
    Ok(())
}

#[tauri::command]
fn set_audio_output_device(
    state: State<SharedState>,
    pipeline_state: State<ManagedAudioPipeline>,
    name: String,
) -> Result<(), String> {
    {
        let mut st = state.lock().unwrap();
        st.audio_config.audio_output_device = Some(name);
        persist_state(&st.keys, &st.audio_config);
    }
    try_auto_start_pipeline(&state, &pipeline_state);
    Ok(())
}

#[tauri::command]
fn add_to_sound_library(
    state: State<SharedState>,
    file_path: String,
    display_name: String,
) -> Result<SoundEntry, String> {
    let entry = audio::import_to_library(&file_path, &display_name)
        .map_err(|e| e.to_string())?;
    let mut st = state.lock().unwrap();
    st.audio_config.sound_library.push(entry.clone());
    persist_state(&st.keys, &st.audio_config);
    Ok(entry)
}

#[tauri::command]
fn add_to_sound_library_trimmed(
    state: State<SharedState>,
    file_path: String,
    display_name: String,
    start_ms: u64,
    end_ms: u64,
) -> Result<SoundEntry, String> {
    let entry = audio::import_to_library_trimmed(&file_path, &display_name, start_ms, end_ms)
        .map_err(|e| e.to_string())?;
    let mut st = state.lock().unwrap();
    st.audio_config.sound_library.push(entry.clone());
    persist_state(&st.keys, &st.audio_config);
    Ok(entry)
}

#[tauri::command]
fn remove_from_sound_library(
    state: State<SharedState>,
    sound_id: String,
) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    // Find and remove the entry
    if let Some(pos) = st.audio_config.sound_library.iter().position(|e| e.id == sound_id) {
        let entry = st.audio_config.sound_library.remove(pos);
        let _ = audio::delete_sound(&entry.filename);
    }
    // Clear any key_sounds referencing this id
    for slot in st.audio_config.key_sounds.iter_mut() {
        if slot.as_deref() == Some(sound_id.as_str()) {
            *slot = None;
        }
    }
    persist_state(&st.keys, &st.audio_config);
    Ok(())
}

#[tauri::command]
fn rename_sound(
    state: State<SharedState>,
    sound_id: String,
    new_name: String,
) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(entry) = st.audio_config.sound_library.iter_mut().find(|e| e.id == sound_id) {
        entry.display_name = new_name;
    }
    persist_state(&st.keys, &st.audio_config);
    Ok(())
}

#[tauri::command]
fn set_key_sound(
    app: AppHandle,
    state: State<SharedState>,
    key_index: usize,
    sound_id: Option<String>,
) -> Result<(), String> {
    if key_index >= 8 {
        return Err("key_index out of range".into());
    }
    let keymaps_copy;
    {
        let mut st = state.lock().unwrap();
        st.audio_config.key_sounds[key_index] = sound_id.clone();

        let keymap_idx = led_to_keymap_index(key_index);
        let current_keycode = st.keymaps[keymap_idx];

        if sound_id.is_some() && current_keycode == 0x0000 {
            // Auto-assign internal keycode so the shortcut handler can detect key presses
            let internal_kc = internal_keycode_for_key(key_index);
            if let Some(ref dev) = st.device {
                let (row, col) = protocol::key_index_to_matrix(keymap_idx as u8);
                if let Err(e) = dev.set_keycode(0, row, col, internal_kc) {
                    error!("[sound] Failed to auto-assign keycode: {}", e);
                }
            }
            st.keymaps[keymap_idx] = internal_kc;
            info!("[sound] Auto-assigned internal keycode 0x{:04X} to LED {} (keymap {})",
                  internal_kc, key_index, keymap_idx);
        } else if sound_id.is_none() && is_internal_keycode(current_keycode) {
            // Clear internal keycode when sound is removed
            if let Some(ref dev) = st.device {
                let (row, col) = protocol::key_index_to_matrix(keymap_idx as u8);
                if let Err(e) = dev.set_keycode(0, row, col, 0x0000) {
                    error!("[sound] Failed to clear internal keycode: {}", e);
                }
            }
            st.keymaps[keymap_idx] = 0x0000;
            info!("[sound] Cleared internal keycode from LED {} (keymap {})", key_index, keymap_idx);
        }

        keymaps_copy = st.keymaps;
        persist_state(&st.keys, &st.audio_config);
    }
    // Re-register shortcuts with updated keymaps
    register_key_shortcuts(&app, &keymaps_copy);
    Ok(())
}

#[tauri::command]
fn preview_library_sound(
    state: State<SharedState>,
    pipeline_state: State<ManagedAudioPipeline>,
    sound_id: String,
) -> Result<(), String> {
    let st = state.lock().unwrap();
    let entry = st.audio_config.sound_library.iter()
        .find(|e| e.id == sound_id)
        .ok_or("Sound not found in library")?;
    let filename = entry.filename.clone();
    drop(st);

    let path = audio::resolve_sound_path(&filename).map_err(|e| e.to_string())?;
    let pl = pipeline_state.0.lock().unwrap();
    if let Some(ref pipeline) = *pl {
        pipeline.play_sound(&path).map_err(|e| e.to_string())
    } else {
        // Fallback: play through default output when soundboard is not running
        audio::preview_trim(
            path.to_str().unwrap_or(""),
            0,
            audio::get_audio_duration(path.to_str().unwrap_or(""))
                .unwrap_or(60000),
        ).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn set_sound_volume(
    state: State<SharedState>,
    pipeline_state: State<ManagedAudioPipeline>,
    volume: f32,
) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    st.audio_config.sound_volume = volume;
    persist_state(&st.keys, &st.audio_config);
    drop(st);

    let pl = pipeline_state.0.lock().unwrap();
    if let Some(ref pipeline) = *pl {
        pipeline.set_sound_volume(volume);
    }
    Ok(())
}

#[tauri::command]
fn set_mic_volume(
    state: State<SharedState>,
    pipeline_state: State<ManagedAudioPipeline>,
    volume: f32,
) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    st.audio_config.mic_volume = volume;
    persist_state(&st.keys, &st.audio_config);
    drop(st);

    let pl = pipeline_state.0.lock().unwrap();
    if let Some(ref pipeline) = *pl {
        pipeline.set_mic_volume(volume);
    }
    Ok(())
}

// ── Audio trim commands ──────────────────────────────────────────────────

#[tauri::command]
fn get_audio_duration(file_path: String) -> Result<u64, String> {
    audio::get_audio_duration(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn preview_trim(source_path: String, start_ms: u64, end_ms: u64) -> Result<(), String> {
    audio::preview_trim(&source_path, start_ms, end_ms).map_err(|e| e.to_string())
}

// ── Per-key toggle (triggered by physical keypress via global shortcut) ──

fn do_toggle_key(app: &AppHandle, key_index: usize) {
    let state = app.state::<SharedState>();
    let (snapshot, sound_filename) = {
        let mut st = state.lock().unwrap();
        if key_index >= 8 { return; }

        let old = st.keys[key_index].active_slot;
        st.keys[key_index].active_slot = match old {
            ActiveSlot::A => ActiveSlot::B,
            ActiveSlot::B => ActiveSlot::A,
        };
        let new_slot = st.keys[key_index].active_slot;

        info!("[KEY-SHORTCUT] key={} {:?}→{:?} override={}",
              key_index, old, new_slot, st.keys[key_index].override_enabled);

        if let Some(ref dev) = st.device {
            apply_key_to_device(dev, key_index as u8, &st.keys[key_index]);
        }
        persist_state(&st.keys, &st.audio_config);
        // Resolve sound filename from key_sounds → sound_library lookup
        let filename = st.audio_config.key_sounds[key_index]
            .as_ref()
            .and_then(|sound_id| {
                st.audio_config.sound_library.iter()
                    .find(|e| &e.id == sound_id)
                    .map(|e| e.filename.clone())
            });
        (st.snapshot(), filename)
    };

    // Play sound if assigned
    if let Some(ref filename) = sound_filename {
        info!("[KEY-SHORTCUT] key={} sound={}", key_index, filename);
        if let Ok(path) = audio::resolve_sound_path(filename) {
            let pipeline_state = app.state::<ManagedAudioPipeline>();
            let pl = pipeline_state.0.lock().unwrap();
            if let Some(ref pipeline) = *pl {
                if let Err(e) = pipeline.play_sound(&path) {
                    warn!("[audio] Failed to play sound for key {}: {}", key_index, e);
                }
            } else {
                // Fallback: play through default output when soundboard is not running
                drop(pl);
                let path_str = path.to_str().unwrap_or("");
                let dur = audio::get_audio_duration(path_str).unwrap_or(60000);
                if let Err(e) = audio::preview_trim(path_str, 0, dur) {
                    warn!("[audio] Fallback play failed for key {}: {}", key_index, e);
                }
            }
        }
    }

    // Emit event so frontend updates its state
    let _ = app.emit("state-updated", &snapshot);
}

// ── Global toggle helper (used by tray menu) ────────────────────────────

fn do_toggle(app: &AppHandle) -> Result<String, String> {
    info!("⚠️ [GLOBAL TOGGLE] do_toggle() called — this toggles ALL keys!");
    let state = app.state::<SharedState>();
    let result = {
        let mut st = state.lock().unwrap();
        st.active_slot = match st.active_slot {
            ActiveSlot::A => ActiveSlot::B,
            ActiveSlot::B => ActiveSlot::A,
        };
        let new_slot = st.active_slot;
        // Toggle each key's individual slot
        for key in st.keys.iter_mut() {
            key.active_slot = match key.active_slot {
                ActiveSlot::A => ActiveSlot::B,
                ActiveSlot::B => ActiveSlot::A,
            };
        }
        if let Some(ref dev) = st.device {
            apply_all_to_device(dev, &st.keys);
        }
        persist_state(&st.keys, &st.audio_config);
        new_slot.to_string()
    };
    info!("⚠️ [GLOBAL TOGGLE] emitting slot-toggled={}", result);
    let _ = app.emit("slot-toggled", &result);
    Ok(result)
}

// ── App Entry ───────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(std::sync::Mutex::new({
            let mut state = AppState::default();
            // Restore key colors + audio config from last session
            if let Some((keys, audio_cfg)) = profile::load_state() {
                state.keys = keys;
                if let Some(cfg) = audio_cfg {
                    state.audio_config = cfg;
                }
            }
            // Migrate legacy sound_files → sound_library + key_sounds
            if state.audio_config.sound_library.is_empty() {
                let mut migrated = false;
                for i in 0..8 {
                    if let Some(ref filename) = state.audio_config.sound_files[i] {
                        let id = filename
                            .rsplit('.')
                            .last()
                            .unwrap_or(filename)
                            .to_string();
                        // Use the part after "keyN_" as display name, or the whole filename
                        let display_name = filename
                            .split('_')
                            .skip(1)
                            .collect::<Vec<_>>()
                            .join("_")
                            .rsplit('.')
                            .last()
                            .unwrap_or(filename)
                            .to_string();
                        let display_name = if display_name.is_empty() {
                            format!("Key {} sound", i + 1)
                        } else {
                            display_name
                        };
                        state.audio_config.sound_library.push(
                            state::SoundEntry {
                                id: id.clone(),
                                filename: filename.clone(),
                                display_name,
                            }
                        );
                        state.audio_config.key_sounds[i] = Some(id);
                        migrated = true;
                    }
                }
                if migrated {
                    info!("[migration] Migrated {} legacy sound_files to sound_library",
                          state.audio_config.sound_library.len());
                }
            }
            state
        }))
        .manage(ManagedAudioPipeline(std::sync::Mutex::new(None)))
        .setup(|app| {
            // Persist initial state to disk (ensures state.json exists)
            {
                let state = app.state::<SharedState>();
                let st = state.lock().unwrap();
                persist_state(&st.keys, &st.audio_config);
            }

            // Auto-start audio pipeline if both devices are configured
            {
                let state = app.state::<SharedState>();
                let pipeline_state = app.state::<ManagedAudioPipeline>();
                try_auto_start_pipeline(&state, &pipeline_state);
            }

            // Register plugins
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::ShortcutState;

                // Autostart plugin
                app.handle().plugin(
                    tauri_plugin_autostart::Builder::new()
                        .args(["--minimized"])
                        .build(),
                )?;

                // Per-key global shortcut plugin — each physical key toggles
                // its own LED slot A↔B, then replays the keystroke to the OS
                // so the focused application still receives the bind.
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            if event.state() != ShortcutState::Pressed { return; }
                            let shortcut_str = format!("{}", shortcut);
                            let state = app.state::<SharedState>();
                            let entry = {
                                let st = state.lock().unwrap();
                                st.shortcut_map.get(&shortcut_str).cloned()
                            };
                            if let Some((led_idx, keycode, register_str)) = entry {
                                info!("[SHORTCUT] \"{}\" → led={} replay=0x{:04X}",
                                      shortcut_str, led_idx, keycode);
                                do_toggle_key(app, led_idx);

                                // Skip keystroke replay for internal (sound-only) keycodes
                                if is_internal_keycode(keycode) {
                                    return;
                                }

                                // Replay: unregister → simulate keystroke → re-register
                                // Done on a thread to avoid blocking the UI.
                                let app_clone = app.clone();
                                std::thread::spawn(move || {
                                    use tauri_plugin_global_shortcut::GlobalShortcutExt;
                                    let _ = app_clone.global_shortcut()
                                        .unregister(register_str.as_str());
                                    std::thread::sleep(std::time::Duration::from_millis(5));
                                    simulate_qmk_keystroke(keycode);
                                    std::thread::sleep(std::time::Duration::from_millis(30));
                                    let _ = app_clone.global_shortcut()
                                        .register(register_str.as_str());
                                });
                            } else {
                                warn!("[SHORTCUT] Unmatched: \"{}\"", shortcut_str);
                            }
                        })
                        .build(),
                )?;
                // Shortcuts are registered dynamically in connect_device
                // after reading the actual keymaps from the device.
            }

            // System tray
            let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let toggle_leds = MenuItemBuilder::with_id("toggle", "Toggle LEDs").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&toggle_leds)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(Image::from_bytes(include_bytes!("../icons/icon.png"))?)
                .tooltip("Deck-8 Hub")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "toggle" => {
                        let _ = do_toggle(app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            let app = tray.app_handle();
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide to tray instead of closing
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            connect_device,
            get_state,
            set_key_color,
            toggle_slot,
            toggle_key_slot,
            apply_colors,
            disable_all_overrides,
            get_keymap,
            set_keycode,
            set_key_override,
            restore_defaults,
            get_device_info,
            device_indication,
            bootloader_jump,
            eeprom_reset,
            dynamic_keymap_reset,
            macro_reset,
            save_custom,
            get_rgb_matrix,
            set_rgb_brightness,
            set_rgb_effect,
            set_rgb_speed,
            set_rgb_color,
            save_rgb_matrix,
            // Soundboard
            list_audio_devices,
            set_audio_input_device,
            set_audio_output_device,
            set_sound_volume,
            set_mic_volume,
            // Sound library
            add_to_sound_library,
            add_to_sound_library_trimmed,
            remove_from_sound_library,
            rename_sound,
            set_key_sound,
            preview_library_sound,
            // Audio trim
            get_audio_duration,
            preview_trim,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
