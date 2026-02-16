mod hid;
mod profile;
mod protocol;
mod state;

use log::{error, info, warn};
use protocol::{DeviceInfo, RgbMatrixState};
use state::{ActiveSlot, AppState, KeyConfig, SharedState, StateSnapshot};
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

    let mut parts = Vec::new();
    if mods & 0x11 != 0 { parts.push("control".to_string()); }
    if mods & 0x22 != 0 { parts.push("shift".to_string()); }
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

/// Persist key state to disk (fire-and-forget).
fn persist_keys(keys: &[KeyConfig; 8]) {
    if let Err(e) = profile::save_state(keys) {
        error!("Failed to persist key state: {e:#}");
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
    persist_keys(&st.keys);
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
    persist_keys(&st.keys);
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
    persist_keys(&st.keys);
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
    state: State<SharedState>,
    key_index: usize,
    keycode: u16,
) -> Result<(), String> {
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
    persist_keys(&st.keys);
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
    persist_keys(&st.keys);
    Ok(st.snapshot())
}

#[tauri::command]
fn list_profiles() -> Result<Vec<String>, String> {
    profile::list_profiles().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_profile(state: State<SharedState>, name: String) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    profile::save_profile(&name, &st.keys, &st.keymaps).map_err(|e| e.to_string())?;
    st.current_profile_name = Some(name);
    Ok(())
}

#[tauri::command]
fn load_profile(state: State<SharedState>, name: String) -> Result<StateSnapshot, String> {
    let mut st = state.lock().unwrap();
    let prof = profile::load_profile(&name).map_err(|e| e.to_string())?;
    // Apply profile keys (handle profiles with fewer/more than 8 keys)
    for (i, kc) in prof.keys.iter().enumerate() {
        if i < 8 {
            st.keys[i] = kc.clone();
        }
    }
    // Restore keymaps if present in profile
    if let Some(ref keymaps) = prof.keymaps {
        for (i, &kc) in keymaps.iter().enumerate() {
            if i < 8 {
                st.keymaps[i] = kc;
            }
        }
        // Write keymaps to device
        if let Some(ref dev) = st.device {
            for i in 0..8u8 {
                let (row, col) = protocol::key_index_to_matrix(i);
                let _ = dev.set_keycode(0, row, col, st.keymaps[i as usize]);
            }
        }
    }
    st.current_profile_name = Some(name);
    // Apply colors to device
    if let Some(ref dev) = st.device {
        apply_all_to_device(dev, &st.keys);
        let _ = dev.custom_save();
    }
    persist_keys(&st.keys);
    Ok(st.snapshot())
}

#[tauri::command]
fn delete_profile(state: State<SharedState>, name: String) -> Result<(), String> {
    profile::delete_profile(&name).map_err(|e| e.to_string())?;
    let mut st = state.lock().unwrap();
    if st.current_profile_name.as_deref() == Some(&name) {
        st.current_profile_name = None;
    }
    Ok(())
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

// ── Per-key toggle (triggered by physical keypress via global shortcut) ──

fn do_toggle_key(app: &AppHandle, key_index: usize) {
    let state = app.state::<SharedState>();
    let snapshot = {
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
        persist_keys(&st.keys);
        st.snapshot()
    };

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
        persist_keys(&st.keys);
        new_slot.to_string()
    };
    info!("⚠️ [GLOBAL TOGGLE] emitting slot-toggled={}", result);
    let _ = app.emit("slot-toggled", &result);
    Ok(result)
}

// ── App Entry ───────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .manage(std::sync::Mutex::new({
            let mut state = AppState::default();
            // Restore key colors from last session
            if let Some(keys) = profile::load_state() {
                state.keys = keys;
            }
            state
        }))
        .setup(|app| {
            // Persist initial state to disk (ensures state.json exists)
            {
                let state = app.state::<SharedState>();
                let st = state.lock().unwrap();
                persist_keys(&st.keys);
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
            list_profiles,
            save_profile,
            load_profile,
            delete_profile,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
