# Deck-8 Hub — Project Context

## What is this?

Desktop configurator for the **Churrosoft Deck-8**, an 8-key macro pad with per-key RGB LEDs and QMK firmware. Built with Tauri v2 (Rust backend) + React + Tailwind CSS + shadcn/ui.

## Tech Stack

- **Backend:** Rust, Tauri v2, hidapi (cross-platform), enigo (keystroke simulation on macOS), rodio/cpal (audio pipeline)
- **Frontend:** React 19, Vite 7, Tailwind CSS 4, shadcn/ui, Geist Mono + Geist Pixel Grid fonts
- **Protocol:** QMK VIA raw HID (custom channel `0x07`/`0x00`)
- **Hardware:** VID `0xCBBC` / PID `0xC101`

## Project Structure

```
frontend/src/
  components/   — UI components (toolbar, color-view, key-grid, sound-view, etc.)
  hooks/        — useDeck8 (main state management hook)
  lib/          — tauri.ts (IPC wrappers), keycodes.ts, utils

src-tauri/src/
  lib.rs            — Tauri commands, per-key shortcuts, shortcut registration
  hid.rs            — HID communication with Deck-8 device
  protocol.rs       — VIA/QMK protocol constants and data types
  profile.rs        — Session state persistence (save_state/load_state)
  state.rs          — AppState, KeyConfig, AudioConfig, StateSnapshot types
  audio.rs          — Audio pipeline (mic passthrough + sound injection via ring buffer)
  keyboard_hook.rs  — Windows low-level keyboard hook (WH_KEYBOARD_LL)
```

## Key Concepts

- **LED snake wiring:** Top row direct (key 0-3 = LED 0-3), bottom row reversed (key 4-7 = LED 7,6,5,4). Use `keymap_to_led_index()`.
- **QMK keycodes:** High byte = modifiers (Ctrl/Shift/Alt/GUI), low byte = HID usage ID.
- **Per-key shortcuts (Windows):** Uses a low-level keyboard hook (`WH_KEYBOARD_LL` in `keyboard_hook.rs`) that coexists with other apps' hooks (e.g. Wispr Flow). Keystrokes propagate naturally — no replay needed. Internal keycodes (sound-only) are consumed by the hook.
- **Per-key shortcuts (macOS):** Uses `tauri_plugin_global_shortcut` (RegisterHotKey). Consumes the keystroke, toggles LED slot A/B, then replays via enigo.
- **Internal keycodes:** `Ctrl+Shift+Alt+GUI+F13..F20` (0x0F68..0x0F6F) auto-assigned to keys with sounds but no user shortcut. Must NOT overlap with user-assignable ranges.
- **HID send_and_receive:** All HID commands MUST read the firmware response to prevent USB buffer overflow.
- **DISPLAY_ORDER** in `key-grid.tsx`: `[0,1,2,3,7,6,5,4]` maps visual grid position to hardware LED index.

## Build Commands

```bash
cd frontend && npm install    # first time only
cargo tauri dev               # dev mode (Vite hot-reload + Rust)
cargo tauri build             # production build (frontend + Rust)
```

## Conventions

- Language: Spanish for user-facing communication, English for code/comments
- Dark theme: `#09090b` bg, `#111113` surfaces, emerald green accents
- Fonts: `font-pixel` (Geist Pixel Grid) for uppercase headers/branding only, `font-clean` (Geist Mono) for all body/descriptive text. Body default is Geist Mono.
- State persistence: `%APPDATA%/deck8-hub/state.json` (Windows), `~/Library/Application Support/deck8-hub/state.json` (macOS)
- No profiles system (removed intentionally)
- Cross-platform: Windows + macOS. New features must work on both platforms.
