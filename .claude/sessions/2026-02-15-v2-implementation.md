# Session Report — Deck-8 Hub v2.0 Implementation

**Date:** 2026-02-15
**Project:** churrosoft/deck8-hub
**Repo:** https://github.com/fedevgonzalez/deck8-hub (private)

---

## Objective

Implement feature parity with the original Churrosoft Hub v1.3.0 for the Deck-8 macropad:
- Key assignment editing (read/write keycodes via VIA protocol)
- Per-key color override toggle ("none" mode with diagonal stripes)
- Restore defaults
- Tab-based UI with Key Assignment and Color views

---

## What Was Done

### Phase 1: Backend (Rust) — 5 files modified

| File | Changes |
|------|---------|
| `src-tauri/src/protocol.rs` | Added `VIA_DYNAMIC_KEYMAP_GET` (0x04), `VIA_DYNAMIC_KEYMAP_SET` (0x05), `key_index_to_matrix()`, `build_get_keycode()`, `build_set_keycode()` |
| `src-tauri/src/hid.rs` | Added HID read: `read_response()`, `send_and_receive()`, `get_keycode()`, `set_keycode()`, `read_all_keycodes()` |
| `src-tauri/src/state.rs` | Added `override_enabled: bool` to `KeyConfig`, `keymaps: [u16; 8]` to `AppState`, `keymaps: Vec<u16>` to `StateSnapshot`. Removed unused `active_color()` |
| `src-tauri/src/profile.rs` | Added `keymaps: Option<Vec<u16>>` to `Profile`. Updated `save_profile()` to accept keymaps |
| `src-tauri/src/lib.rs` | Added helpers `apply_key_to_device()` / `apply_all_to_device()` respecting override. New commands: `get_keymap`, `set_keycode`, `set_key_override`, `restore_defaults`. Updated `connect_device` to read keymaps. All color paths respect per-key override |

### Phase 2: Frontend Data Layer — 3 files (1 new, 2 modified)

| File | Changes |
|------|---------|
| `frontend/src/lib/keycodes.ts` | **NEW** — ~360 lines. QMK keycode database (letters, numbers, F-keys, modifiers, nav, numpad, multimedia, mouse, RGB lighting). Functions: `keycodeToLabel()`, `composeKeycode()`, `decomposeKeycode()`, `keyEventToKeycode()`, `getKeycodesByCategory()` |
| `frontend/src/lib/tauri.ts` | Added `override_enabled` to `KeyConfig`, `keymaps` to `StateSnapshot`. New IPC wrappers: `getKeymap()`, `setKeycode()`, `setKeyOverride()`, `restoreDefaults()` |
| `frontend/src/hooks/use-deck8.ts` | Updated default state. New actions: `updateKeycode()`, `toggleKeyOverride()`, `doRestoreDefaults()` |

### Phase 3: Frontend UI — 8 files (3 new, 5 modified)

| File | Changes |
|------|---------|
| `frontend/src/App.tsx` | **Rewritten** — Two-tab layout (Key Assignment / Color) using shadcn Tabs. Wires all new actions |
| `frontend/src/components/color-view.tsx` | **NEW** — Extracted color tab: key grid (color mode) + picker + override toggle |
| `frontend/src/components/key-assignment-view.tsx` | **NEW** — Key assignment tab: grid in keycode mode, opens editor dialog on click |
| `frontend/src/components/key-editor-dialog.tsx` | **NEW** — ~220 lines. Full keycode picker: physical keyboard capture, Ctrl/Shift/Alt/Win toggles, 5 category tabs, virtual keyboard grid, current→new display |
| `frontend/src/components/key-cell.tsx` | Added `mode` and `keycodeLabel` props. Color mode: diagonal stripes when override disabled. Keycode mode: label text on dark background |
| `frontend/src/components/key-grid.tsx` | Added `mode` and `keycodeLabels` props, passes to KeyCell |
| `frontend/src/components/profile-bar.tsx` | Added "Defaults" button with restore confirmation dialog |
| `frontend/src/index.css` | Added `.key-stripes` diagonal gradient pattern |

### Misc

| File | Changes |
|------|---------|
| `.gitignore` | Added `frontend/node_modules/` and `frontend/dist/` |

---

## Build Verification

| Check | Result |
|-------|--------|
| `cargo check` | Zero warnings |
| `tsc --noEmit` | Zero errors |
| `vite build` | Clean (396 KB JS, 47 KB CSS) |

## Visual Testing (browser at localhost:5173)

| Test | Result |
|------|--------|
| Two tabs visible | "Key Assignment" + "Color" tabs |
| Key Assignment tab | 4x2 grid showing "NO" on all keys |
| Click key → editor dialog | Opens with categories, modifiers, virtual keyboard |
| Set Ctrl+Alt+R on K1 | Modifier toggles highlighted, "NO → Ctrl+Alt+R" shown, saved correctly |
| Color tab | Grid with colored keys, HSV picker on selection |
| Disable override on K1 | Diagonal stripes on key, picker replaced with "Enable override" button |
| Profile bar | Load/Save/Save As/Defaults/Delete all present |

---

## Git

- Initialized repo at `G:\GitHub\churrosoft\deck8-hub`
- Initial commit: 50 files, 8,837 lines
- Pushed to **https://github.com/fedevgonzalez/deck8-hub** (private)

---

## Total Changes

- **16 files** touched (3 new frontend components, 1 new lib, 12 modified)
- **~3,770 lines** added
- **50 files** in final commit (includes lock files, configs, fonts, icons)
