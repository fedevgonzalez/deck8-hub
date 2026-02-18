// Windows keyboard shortcut interception using two mechanisms running in parallel:
//
// 1. **Raw Input API** (RIDEV_INPUTSINK): Works immediately — no activation
//    delay. Detects shortcuts from the Deck-8 as soon as the app starts.
//    Runs on a dedicated thread with its own message pump.
//
// 2. **WH_KEYBOARD_LL hook** (low-level): Installed on the main/UI thread.
//    Has a Windows limitation: doesn't receive events until the user
//    physically interacts with the desktop. Can BLOCK keystrokes (return 1)
//    for internal shortcuts. Coexists with other apps using hooks (e.g. Wispr Flow).
//
// Both mechanisms always run. A per-key timestamp dedup (DEDUP_MS) prevents
// double-firing when both detect the same keystroke.

#[cfg(target_os = "windows")]
mod windows_impl {
    use log::{error, info};
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::sync::{Mutex, OnceLock};

    // Tracked modifier state for the LL hook (main thread).
    // Updated from hook_proc on every modifier key event.
    // Avoids GetAsyncKeyState race conditions when modifiers and keys arrive
    // in the same HID report (e.g. Deck-8 sending Ctrl+Alt+R).
    static MOD_CTRL: AtomicBool = AtomicBool::new(false);
    static MOD_SHIFT: AtomicBool = AtomicBool::new(false);
    static MOD_ALT: AtomicBool = AtomicBool::new(false);
    static MOD_GUI: AtomicBool = AtomicBool::new(false);

    // Dedup: per-key timestamp of the last toggle, to avoid double-firing
    // when both LL hook and Raw Input detect the same keystroke.
    // Value is GetTickCount64() in milliseconds.
    const DEDUP_MS: u64 = 150;
    static LAST_TOGGLE: [AtomicU64; 8] = [
        AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0),
        AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0),
    ];

    // Raw Input modifier tracking — separate from LL hook atomics because
    // raw input arrives on a different thread.
    static RAW_MOD_CTRL: AtomicBool = AtomicBool::new(false);
    static RAW_MOD_SHIFT: AtomicBool = AtomicBool::new(false);
    static RAW_MOD_ALT: AtomicBool = AtomicBool::new(false);
    static RAW_MOD_GUI: AtomicBool = AtomicBool::new(false);

    // ── Win32 constants ──────────────────────────────────────────────
    const WH_KEYBOARD_LL: i32 = 13;
    const WM_KEYDOWN: u32 = 0x0100;
    const WM_KEYUP: u32 = 0x0101;
    const WM_SYSKEYDOWN: u32 = 0x0104;
    const WM_SYSKEYUP: u32 = 0x0105;
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

    // Raw Input constants
    const WM_INPUT: u32 = 0x00FF;
    const RID_INPUT: u32 = 0x10000003;
    const RIM_TYPEKEYBOARD: u32 = 1;
    const RIDEV_INPUTSINK: u32 = 0x00000100;
    const RI_KEY_BREAK: u16 = 1;
    const HWND_MESSAGE_PARENT: isize = -3;

    // ── Win32 types ────────────────────────────────────────────────
    #[repr(C)]
    struct KBDLLHOOKSTRUCT {
        vk_code: u32,
        _scan_code: u32,
        _flags: u32,
        _time: u32,
        _dw_extra_info: usize,
    }

    #[repr(C)]
    struct RAWINPUTDEVICE {
        usage_page: u16,
        usage: u16,
        flags: u32,
        hwnd_target: isize,
    }

    #[repr(C)]
    struct RAWINPUTHEADER {
        type_: u32,
        size: u32,
        device: isize,
        wparam: usize,
    }

    #[repr(C)]
    struct RAWKEYBOARD {
        make_code: u16,
        flags: u16,
        reserved: u16,
        vkey: u16,
        message: u32,
        extra_info: usize,
    }

    #[repr(C)]
    struct RAWINPUT_KB {
        header: RAWINPUTHEADER,
        keyboard: RAWKEYBOARD,
    }

    #[repr(C)]
    struct MSG {
        hwnd: isize,
        message: u32,
        wparam: usize,
        lparam: isize,
        time: u32,
        pt_x: i32,
        pt_y: i32,
    }

    // ── Win32 FFI ──────────────────────────────────────────────────
    extern "system" {
        fn SetWindowsHookExW(
            id_hook: i32,
            lpfn: unsafe extern "system" fn(i32, usize, isize) -> isize,
            hmod: isize,
            thread_id: u32,
        ) -> isize;
        fn CallNextHookEx(hhk: isize, code: i32, wparam: usize, lparam: isize) -> isize;
        fn GetModuleHandleW(module_name: *const u16) -> isize;
        fn RegisterRawInputDevices(
            devices: *const RAWINPUTDEVICE,
            num: u32,
            size: u32,
        ) -> i32;
        fn GetRawInputData(
            raw_input: isize,
            command: u32,
            data: *mut u8,
            size: *mut u32,
            header_size: u32,
        ) -> u32;
        fn CreateWindowExW(
            ex_style: u32,
            class: *const u16,
            name: *const u16,
            style: u32,
            x: i32,
            y: i32,
            w: i32,
            h: i32,
            parent: isize,
            menu: isize,
            instance: isize,
            param: isize,
        ) -> isize;
        fn GetMessageW(
            msg: *mut MSG,
            hwnd: isize,
            filter_min: u32,
            filter_max: u32,
        ) -> i32;
        fn DispatchMessageW(msg: *const MSG) -> isize;
        fn GetTickCount64() -> u64;
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

    // ── Helpers ────────────────────────────────────────────────────
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

    /// Returns true if this key should be toggled (not a duplicate within DEDUP_MS).
    fn should_toggle(led_idx: usize) -> bool {
        if led_idx >= 8 {
            return false;
        }
        let now = unsafe { GetTickCount64() };
        let prev = LAST_TOGGLE[led_idx].swap(now, Ordering::Relaxed);
        now.wrapping_sub(prev) > DEDUP_MS
    }

    // ── LL Hook callback ───────────────────────────────────────────
    /// CRITICAL: This callback MUST return as fast as possible.
    /// Windows silently removes the hook if it takes longer than
    /// LowLevelHooksTimeout (~300ms). NO logging, NO mutex waits.
    unsafe extern "system" fn hook_proc(code: i32, wparam: usize, lparam: isize) -> isize {
        if code == HC_ACTION {
            let msg_type = wparam as u32;
            let is_down = msg_type == WM_KEYDOWN || msg_type == WM_SYSKEYDOWN;
            let is_up = msg_type == WM_KEYUP || msg_type == WM_SYSKEYUP;

            if is_down || is_up {
                let kb = &*(lparam as *const KBDLLHOOKSTRUCT);
                let vk = kb.vk_code as i32;

                // Track modifier state from the hook itself
                match vk {
                    VK_CONTROL | VK_LCONTROL | VK_RCONTROL => { MOD_CTRL.store(is_down, Ordering::Relaxed); }
                    VK_SHIFT | VK_LSHIFT | VK_RSHIFT => { MOD_SHIFT.store(is_down, Ordering::Relaxed); }
                    VK_MENU | VK_LMENU | VK_RMENU => { MOD_ALT.store(is_down, Ordering::Relaxed); }
                    VK_LWIN | VK_RWIN => { MOD_GUI.store(is_down, Ordering::Relaxed); }
                    _ => {}
                }

                // For non-modifier keydowns, check if a shortcut matches
                if is_down && !is_modifier_vk(kb.vk_code) {
                    let ctrl = MOD_CTRL.load(Ordering::Relaxed);
                    let shift = MOD_SHIFT.load(Ordering::Relaxed);
                    let alt = MOD_ALT.load(Ordering::Relaxed);
                    let gui = MOD_GUI.load(Ordering::Relaxed);

                    if ctrl || shift || alt || gui {
                        match state().try_lock() {
                            Ok(st) => {
                                for entry in &st.shortcuts {
                                    if entry.vk_code == kb.vk_code
                                        && entry.need_ctrl == ctrl
                                        && entry.need_shift == shift
                                        && entry.need_alt == alt
                                        && entry.need_gui == gui
                                    {
                                        let led_idx = entry.led_idx;
                                        let is_internal = entry.is_internal;
                                        if should_toggle(led_idx) {
                                            if let Some(ref app) = st.app_handle {
                                                let app_clone = app.clone();
                                                std::thread::spawn(move || {
                                                    crate::do_toggle_key(&app_clone, led_idx);
                                                });
                                            }
                                        }
                                        if is_internal {
                                            return 1;
                                        }
                                        break;
                                    }
                                }
                            }
                            Err(_) => {}
                        }
                    }
                }
            }
        }
        CallNextHookEx(0, code, wparam, lparam)
    }

    // ── Raw Input API (immediate shortcut detection) ──────────────────
    // The LL keyboard hook has an activation delay: Windows doesn't dispatch
    // events to it until the user physically interacts with the desktop.
    // Raw Input with RIDEV_INPUTSINK works immediately. Both mechanisms
    // always run in parallel; per-key timestamp dedup prevents double-firing.

    fn start_raw_input_thread() {
        std::thread::spawn(|| {
            unsafe {
                let hmod = GetModuleHandleW(std::ptr::null());

                // Create a message-only window to receive WM_INPUT
                let class: Vec<u16> = "Static\0".encode_utf16().collect();
                let hwnd = CreateWindowExW(
                    0,
                    class.as_ptr(),
                    std::ptr::null(),
                    0,
                    0, 0, 0, 0,
                    HWND_MESSAGE_PARENT,
                    0,
                    hmod,
                    0,
                );
                if hwnd == 0 {
                    error!("[raw-input] Failed to create window");
                    return;
                }

                // Register for keyboard raw input with INPUTSINK (receives even when not focused)
                let rid = RAWINPUTDEVICE {
                    usage_page: 0x01, // Generic Desktop Controls
                    usage: 0x06,      // Keyboard
                    flags: RIDEV_INPUTSINK,
                    hwnd_target: hwnd,
                };
                let ret = RegisterRawInputDevices(
                    &rid,
                    1,
                    std::mem::size_of::<RAWINPUTDEVICE>() as u32,
                );
                if ret == 0 {
                    error!("[raw-input] RegisterRawInputDevices failed");
                    return;
                }

                info!("[raw-input] Listening for keyboard input");

                let mut msg: MSG = std::mem::zeroed();
                loop {
                    let ret = GetMessageW(&mut msg, 0, 0, 0);
                    if ret <= 0 {
                        break;
                    }
                    if msg.message == WM_INPUT {
                        handle_raw_input_event(msg.lparam);
                    }
                    DispatchMessageW(&msg);
                }
            }
        });
    }

    unsafe fn handle_raw_input_event(lparam: isize) {
        let header_size = std::mem::size_of::<RAWINPUTHEADER>() as u32;
        let mut size: u32 = 0;
        GetRawInputData(lparam, RID_INPUT, std::ptr::null_mut(), &mut size, header_size);

        if size == 0 || size as usize > std::mem::size_of::<RAWINPUT_KB>() * 2 {
            return;
        }

        let mut buf = [0u8; 256];
        let copied = GetRawInputData(
            lparam,
            RID_INPUT,
            buf.as_mut_ptr(),
            &mut size,
            header_size,
        );
        if copied == u32::MAX {
            return;
        }

        let raw = &*(buf.as_ptr() as *const RAWINPUT_KB);
        if raw.header.type_ != RIM_TYPEKEYBOARD {
            return;
        }

        let vk = raw.keyboard.vkey as u32;
        let is_up = raw.keyboard.flags & RI_KEY_BREAK != 0;
        let is_down = !is_up;

        // Track modifier state
        match vk as i32 {
            VK_CONTROL | VK_LCONTROL | VK_RCONTROL => {
                RAW_MOD_CTRL.store(is_down, Ordering::Relaxed);
            }
            VK_SHIFT | VK_LSHIFT | VK_RSHIFT => {
                RAW_MOD_SHIFT.store(is_down, Ordering::Relaxed);
            }
            VK_MENU | VK_LMENU | VK_RMENU => {
                RAW_MOD_ALT.store(is_down, Ordering::Relaxed);
            }
            VK_LWIN | VK_RWIN => {
                RAW_MOD_GUI.store(is_down, Ordering::Relaxed);
            }
            _ => {}
        }

        // For non-modifier keydowns, check if a shortcut matches
        if is_down && !is_modifier_vk(vk) {
            let ctrl = RAW_MOD_CTRL.load(Ordering::Relaxed);
            let shift = RAW_MOD_SHIFT.load(Ordering::Relaxed);
            let alt = RAW_MOD_ALT.load(Ordering::Relaxed);
            let gui = RAW_MOD_GUI.load(Ordering::Relaxed);

            if ctrl || shift || alt || gui {
                match state().try_lock() {
                    Ok(st) => {
                        for entry in &st.shortcuts {
                            if entry.vk_code == vk
                                && entry.need_ctrl == ctrl
                                && entry.need_shift == shift
                                && entry.need_alt == alt
                                && entry.need_gui == gui
                            {
                                let led_idx = entry.led_idx;
                                if should_toggle(led_idx) {
                                    if let Some(ref app) = st.app_handle {
                                        let app_clone = app.clone();
                                        std::thread::spawn(move || {
                                            crate::do_toggle_key(&app_clone, led_idx);
                                        });
                                    }
                                }
                                break;
                            }
                        }
                    }
                    Err(_) => {}
                }
            }
        }
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

    /// Install the LL keyboard hook on the main thread and start the
    /// Raw Input listener thread. The LL hook needs Tauri's event loop
    /// as its message pump; Raw Input has its own dedicated pump.
    pub fn init() {
        static HOOK_INSTALLED: OnceLock<()> = OnceLock::new();
        HOOK_INSTALLED.get_or_init(|| {
            unsafe {
                let hmod = GetModuleHandleW(std::ptr::null());
                let hook = SetWindowsHookExW(WH_KEYBOARD_LL, hook_proc, hmod, 0);
                if hook == 0 {
                    error!("[hook] Failed to install keyboard hook");
                } else {
                    info!("[hook] Keyboard LL hook installed (main thread)");
                }
            }

            // Start Raw Input thread — works immediately, no activation delay
            start_raw_input_thread();
        });
    }

    /// Update the shortcut entries (called when device connects or keymaps change).
    pub fn register_shortcuts(app: &tauri::AppHandle, keymaps: &[u16; 8]) {
        let mut entries = Vec::new();

        for (i, &keycode) in keymaps.iter().enumerate() {
            let mods = (keycode >> 8) as u8;
            let basic = (keycode & 0xFF) as u8;
            if mods == 0 || basic == 0 {
                continue;
            }

            if let Some(vk) = qmk_basic_to_vk(basic) {
                let led_idx = crate::keymap_to_led_index(i);
                let is_internal = crate::is_internal_keycode(keycode);
                entries.push(ShortcutEntry {
                    vk_code: vk,
                    need_ctrl: mods & 0x11 != 0,
                    need_shift: mods & 0x22 != 0,
                    need_alt: mods & 0x44 != 0,
                    need_gui: mods & 0x88 != 0,
                    led_idx,
                    is_internal,
                });
            }
        }

        let count = entries.len();
        let mut st = state().lock().unwrap();
        st.shortcuts = entries;
        st.app_handle = Some(app.clone());
        drop(st);

        info!("[hook] {} shortcuts registered", count);
    }
}

#[cfg(target_os = "windows")]
pub use windows_impl::{init, register_shortcuts};

// Non-Windows stubs — shortcuts handled by tauri_plugin_global_shortcut in lib.rs
#[cfg(not(target_os = "windows"))]
pub fn init() {}

#[cfg(not(target_os = "windows"))]
pub fn register_shortcuts(_app: &tauri::AppHandle, _keymaps: &[u16; 8]) {}
