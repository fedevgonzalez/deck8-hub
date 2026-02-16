mod hid;
mod profile;
mod protocol;
mod state;

use log::error;
use protocol::{DeviceInfo, RgbMatrixState};
use state::{ActiveSlot, AppState, KeyConfig, SharedState, StateSnapshot};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State,
};

// ── Helpers ─────────────────────────────────────────────────────────────

/// Apply color for a single key to the device, respecting override_enabled.
fn apply_key_to_device(dev: &hid::Deck8Device, key_index: u8, key: &KeyConfig, slot: ActiveSlot) {
    if key.override_enabled {
        let color = match slot {
            ActiveSlot::A => &key.slot_a,
            ActiveSlot::B => &key.slot_b,
        };
        let _ = dev.set_key_color(key_index, color);
    } else {
        let _ = dev.disable_override(key_index);
    }
}

/// Persist key state to disk (fire-and-forget).
fn persist_keys(keys: &[KeyConfig; 8]) {
    if let Err(e) = profile::save_state(keys) {
        error!("Failed to persist key state: {e:#}");
    }
}

/// Apply all 8 keys to device, respecting override_enabled.
fn apply_all_to_device(dev: &hid::Deck8Device, keys: &[KeyConfig; 8], slot: ActiveSlot) {
    for i in 0..8 {
        apply_key_to_device(dev, i as u8, &keys[i], slot);
    }
}

// ── Tauri Commands ──────────────────────────────────────────────────────

#[tauri::command]
fn connect_device(state: State<SharedState>) -> bool {
    let mut s = state.lock().unwrap();
    match hid::Deck8Device::open() {
        Ok(dev) => {
            match dev.read_all_keycodes() {
                Ok(keymaps) => s.keymaps = keymaps,
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
            // Re-apply only keys that have override enabled (persisted from last session)
            if let Some(ref dev) = s.device {
                for i in 0..8 {
                    if s.keys[i].override_enabled {
                        apply_key_to_device(dev, i as u8, &s.keys[i], s.active_slot);
                    }
                }
            }
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
    match slot.as_str() {
        "A" => st.keys[key_index].slot_a = color,
        "B" => st.keys[key_index].slot_b = color,
        _ => return Err("slot must be A or B".into()),
    };
    // If this is the active slot and override is enabled, send to device immediately
    let is_active = (slot == "A" && st.active_slot == ActiveSlot::A)
        || (slot == "B" && st.active_slot == ActiveSlot::B);
    if is_active && st.keys[key_index].override_enabled {
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
    let mut st = state.lock().unwrap();
    st.active_slot = match st.active_slot {
        ActiveSlot::A => ActiveSlot::B,
        ActiveSlot::B => ActiveSlot::A,
    };
    let new_slot = st.active_slot;
    if let Some(ref dev) = st.device {
        apply_all_to_device(dev, &st.keys, new_slot);
    }
    Ok(new_slot.to_string())
}

#[tauri::command]
fn apply_colors(state: State<SharedState>) -> Result<(), String> {
    let st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        apply_all_to_device(dev, &st.keys, st.active_slot);
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
        apply_key_to_device(dev, key_index as u8, &st.keys[key_index], st.active_slot);
    }
    persist_keys(&st.keys);
    Ok(st.snapshot())
}

#[tauri::command]
fn restore_defaults(state: State<SharedState>) -> Result<StateSnapshot, String> {
    let mut st = state.lock().unwrap();
    st.keys = std::array::from_fn(|_| KeyConfig::default());
    if let Some(ref dev) = st.device {
        apply_all_to_device(dev, &st.keys, st.active_slot);
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
        apply_all_to_device(dev, &st.keys, st.active_slot);
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
fn save_rgb_matrix(state: State<SharedState>) -> Result<(), String> {
    let st = state.lock().unwrap();
    if let Some(ref dev) = st.device {
        dev.rgb_save().map_err(|e| e.to_string())
    } else {
        Err("Not connected".into())
    }
}

// ── Toggle helper (used by both command and hotkey) ─────────────────────

fn do_toggle(app: &AppHandle) -> Result<String, String> {
    let state = app.state::<SharedState>();
    let result = {
        let mut st = state.lock().unwrap();
        st.active_slot = match st.active_slot {
            ActiveSlot::A => ActiveSlot::B,
            ActiveSlot::B => ActiveSlot::A,
        };
        let new_slot = st.active_slot;
        if let Some(ref dev) = st.device {
            apply_all_to_device(dev, &st.keys, new_slot);
        }
        new_slot.to_string()
    };
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
                use tauri_plugin_global_shortcut::{
                    GlobalShortcutExt, ShortcutState,
                };

                // Autostart plugin
                app.handle().plugin(
                    tauri_plugin_autostart::Builder::new()
                        .args(["--minimized"])
                        .build(),
                )?;

                // Global shortcut plugin
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, _shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                let _ = do_toggle(app);
                            }
                        })
                        .build(),
                )?;

                let _ = app.global_shortcut().register("CmdOrCtrl+Alt+M");
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
