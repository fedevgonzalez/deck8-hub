// Windows low-level keyboard hook for intercepting shortcuts.
// Unlike RegisterHotKey (used by tauri_plugin_global_shortcut), a low-level hook
// coexists with other apps that also use hooks (e.g. Wispr Flow).
// The keystroke propagates naturally — no replay needed.

#[cfg(target_os = "windows")]
mod windows_impl {
    use log::{error, info};
    use std::sync::{Mutex, OnceLock};

    // ── Win32 constants ──────────────────────────────────────────────
    const WH_KEYBOARD_LL: i32 = 13;
    const WM_KEYDOWN: u32 = 0x0100;
    const WM_SYSKEYDOWN: u32 = 0x0104;
    const HC_ACTION: i32 = 0;

    const VK_SHIFT: i32 = 0x10;
    const VK_CONTROL: i32 = 0x11;
    const VK_MENU: i32 = 0x12; // Alt
    const VK_LWIN: i32 = 0x5B;
    const VK_RWIN: i32 = 0x5C;
    const VK_LSHIFT: i32 = 0xA0;
    const VK_RSHIFT: i32 = 0xA1;
    const VK_LCONTROL: i32 = 0xA2;
    const VK_RCONTROL: i32 = 0xA3;
    const VK_LMENU: i32 = 0xA4;
    const VK_RMENU: i32 = 0xA5;

    // ── Win32 types & FFI ────────────────────────────────────────────
    #[repr(C)]
    struct KBDLLHOOKSTRUCT {
        vk_code: u32,
        _scan_code: u32,
        _flags: u32,
        _time: u32,
        _dw_extra_info: usize,
    }

    extern "system" {
        fn SetWindowsHookExW(
            id_hook: i32,
            lpfn: unsafe extern "system" fn(i32, usize, isize) -> isize,
            hmod: isize,
            thread_id: u32,
        ) -> isize;
        fn CallNextHookEx(hhk: isize, code: i32, wparam: usize, lparam: isize) -> isize;
        fn UnhookWindowsHookEx(hhk: isize) -> i32;
        fn GetAsyncKeyState(vkey: i32) -> i16;
        fn GetMessageW(msg: *mut u8, hwnd: isize, filter_min: u32, filter_max: u32) -> i32;
        fn GetModuleHandleW(module_name: *const u16) -> isize;
    }

    // ── Shortcut matching data ───────────────────────────────────────
    struct ShortcutEntry {
        vk_code: u32,
        need_ctrl: bool,
        need_shift: bool,
        need_alt: bool,
        need_gui: bool,
        led_idx: usize,
        is_internal: bool,
    }

    struct HookState {
        shortcuts: Vec<ShortcutEntry>,
        app_handle: Option<tauri::AppHandle>,
    }

    static HOOK_STATE: OnceLock<Mutex<HookState>> = OnceLock::new();

    fn state() -> &'static Mutex<HookState> {
        HOOK_STATE.get_or_init(|| {
            Mutex::new(HookState {
                shortcuts: Vec::new(),
                app_handle: None,
            })
        })
    }

    // ── Hook callback ────────────────────────────────────────────────
    fn is_modifier_vk(vk: u32) -> bool {
        matches!(
            vk as i32,
            VK_SHIFT
                | VK_CONTROL
                | VK_MENU
                | VK_LWIN
                | VK_RWIN
                | VK_LSHIFT
                | VK_RSHIFT
                | VK_LCONTROL
                | VK_RCONTROL
                | VK_LMENU
                | VK_RMENU
        )
    }

    fn is_key_down(vk: i32) -> bool {
        unsafe { GetAsyncKeyState(vk) as u16 & 0x8000 != 0 }
    }

    unsafe extern "system" fn hook_proc(code: i32, wparam: usize, lparam: isize) -> isize {
        if code == HC_ACTION {
            let msg_type = wparam as u32;
            if msg_type == WM_KEYDOWN || msg_type == WM_SYSKEYDOWN {
                let kb = &*(lparam as *const KBDLLHOOKSTRUCT);
                let vk = kb.vk_code;

                if !is_modifier_vk(vk) {
                    let ctrl = is_key_down(VK_CONTROL);
                    let shift = is_key_down(VK_SHIFT);
                    let alt = is_key_down(VK_MENU);
                    let gui = is_key_down(VK_LWIN) || is_key_down(VK_RWIN);

                    // Only check if at least one modifier is held (all our shortcuts use mods)
                    if ctrl || shift || alt || gui {
                        if let Ok(st) = state().try_lock() {
                            for entry in &st.shortcuts {
                                if entry.vk_code == vk
                                    && entry.need_ctrl == ctrl
                                    && entry.need_shift == shift
                                    && entry.need_alt == alt
                                    && entry.need_gui == gui
                                {
                                    info!(
                                        "[hook] Matched vk=0x{:02X} → led={} internal={}",
                                        vk, entry.led_idx, entry.is_internal
                                    );

                                    if let Some(ref app) = st.app_handle {
                                        let app_clone = app.clone();
                                        let led_idx = entry.led_idx;
                                        // Toggle on a separate thread to avoid blocking the hook
                                        std::thread::spawn(move || {
                                            crate::do_toggle_key(&app_clone, led_idx);
                                        });
                                    }

                                    if entry.is_internal {
                                        // Consume internal keycodes — don't let the OS process them
                                        return 1;
                                    }
                                    // User shortcuts: let the keystroke propagate naturally
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        CallNextHookEx(0, code, wparam, lparam)
    }

    // ── QMK → Windows VK mapping ────────────────────────────────────
    fn qmk_basic_to_vk(basic: u8) -> Option<u32> {
        match basic {
            0x04..=0x1D => Some(0x41 + (basic - 0x04) as u32), // A-Z
            0x1E..=0x26 => Some(0x31 + (basic - 0x1E) as u32), // 1-9
            0x27 => Some(0x30),                                  // 0
            0x28 => Some(0x0D),                                  // Enter
            0x29 => Some(0x1B),                                  // Escape
            0x2C => Some(0x20),                                  // Space
            0x3A..=0x45 => Some(0x70 + (basic - 0x3A) as u32),  // F1-F12
            0x68..=0x6F => Some(0x7C + (basic - 0x68) as u32),  // F13-F20
            _ => None,
        }
    }

    // ── Public API ──────────────────────────────────────────────────
    pub fn register_shortcuts(app: &tauri::AppHandle, keymaps: &[u16; 8]) {
        let mut entries = Vec::new();

        for (i, &keycode) in keymaps.iter().enumerate() {
            let mods = (keycode >> 8) as u8;
            let basic = (keycode & 0xFF) as u8;
            if mods == 0 || basic == 0 {
                info!("[hook] keymap={} keycode=0x{:04X} → not mappable", i, keycode);
                continue;
            }

            if let Some(vk) = qmk_basic_to_vk(basic) {
                let led_idx = crate::keymap_to_led_index(i);
                let is_internal = crate::is_internal_keycode(keycode);

                info!(
                    "[hook] keymap={} → led={} vk=0x{:02X} ctrl={} shift={} alt={} gui={} internal={}",
                    i, led_idx, vk,
                    mods & 0x11 != 0, mods & 0x22 != 0,
                    mods & 0x44 != 0, mods & 0x88 != 0,
                    is_internal,
                );

                entries.push(ShortcutEntry {
                    vk_code: vk,
                    need_ctrl: mods & 0x11 != 0,
                    need_shift: mods & 0x22 != 0,
                    need_alt: mods & 0x44 != 0,
                    need_gui: mods & 0x88 != 0,
                    led_idx,
                    is_internal,
                });
            } else {
                info!("[hook] keymap={} keycode=0x{:04X} → VK not mappable", i, keycode);
            }
        }

        let count = entries.len();
        let mut st = state().lock().unwrap();
        st.shortcuts = entries;
        st.app_handle = Some(app.clone());
        drop(st);

        // Install the hook on a dedicated thread with its own message pump (only once)
        static HOOK_STARTED: OnceLock<()> = OnceLock::new();
        HOOK_STARTED.get_or_init(|| {
            std::thread::spawn(|| unsafe {
                // GetModuleHandleW(null) = handle to the current exe — required for global hooks
                let hmod = GetModuleHandleW(std::ptr::null());
                let hook = SetWindowsHookExW(WH_KEYBOARD_LL, hook_proc, hmod, 0);
                if hook == 0 {
                    error!("[hook] Failed to install keyboard hook (hmod=0x{:X})", hmod);
                    return;
                }
                info!("[hook] Low-level keyboard hook installed (hmod=0x{:X})", hmod);

                // Message pump — required for WH_KEYBOARD_LL to receive events
                let mut msg_buf = [0u8; 64];
                while GetMessageW(msg_buf.as_mut_ptr(), 0, 0, 0) > 0 {}

                UnhookWindowsHookEx(hook);
            });
        });

        info!("[hook] {} shortcuts registered via keyboard hook", count);
    }
}

#[cfg(target_os = "windows")]
pub use windows_impl::register_shortcuts;

// Non-Windows stub — shortcuts handled by tauri_plugin_global_shortcut in lib.rs
#[cfg(not(target_os = "windows"))]
pub fn register_shortcuts(_app: &tauri::AppHandle, _keymaps: &[u16; 8]) {}
