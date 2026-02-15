mod hid;
mod profile;
mod protocol;
mod state;

use log::error;
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
            // Read keymaps from device
            match dev.read_all_keycodes() {
                Ok(keymaps) => s.keymaps = keymaps,
                Err(e) => error!("Failed to read keymaps: {e:#}"),
            }
            s.device = Some(dev);
            // Apply current slot colors to device
            if let Some(ref dev) = s.device {
                apply_all_to_device(dev, &s.keys, s.active_slot);
            }
            true
        }
        Err(e) => {
            error!("Failed to connect: {e:#}");
            s.device = None;
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
    Ok(st.snapshot())
}

#[tauri::command]
fn restore_defaults(state: State<SharedState>) -> Result<StateSnapshot, String> {
    let mut st = state.lock().unwrap();
    st.keys = std::array::from_fn(|_| KeyConfig::default());
    if let Some(ref dev) = st.device {
        apply_all_to_device(dev, &st.keys, st.active_slot);
    }
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
        .manage(std::sync::Mutex::new(AppState::default()))
        .setup(|app| {
            // Register global shortcut plugin and CTRL+ALT+M
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    GlobalShortcutExt, ShortcutState,
                };

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, _shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                let _ = do_toggle(app);
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut()
                    .register("CmdOrCtrl+Alt+M")
                    .expect("Failed to register global shortcut");
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
