# Deck-8 Hub

Desktop configurator for the **Churrosoft Deck-8**, an 8-key macro pad with per-key RGB and [QMK](https://github.com/qmk/qmk_firmware) firmware.

Built with [Tauri v2](https://tauri.app) (Rust backend) + React + Tailwind CSS + shadcn/ui.

## Features

- **Key assignment** — remap any of the 8 keys to keyboard shortcuts (modifier + key combos)
- **Per-key color control** — set individual HSV colors with slot A/B toggle via global shortcuts
- **RGB matrix settings** — adjust brightness, effect, speed, and base color
- **Keystroke passthrough** — global shortcuts toggle LED colors and replay the keystroke to the focused app
- **System tray** — minimizes to tray, auto-connects on launch
- **Session persistence** — key colors survive app restarts

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Rust** | stable | [rustup.rs](https://rustup.rs) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Tauri CLI** | 2.x | `cargo install tauri-cli` |

### Windows

No additional requirements. HID access works out of the box.

### macOS

- **Accessibility permission** — required for keystroke simulation (enigo) and global shortcuts. Grant in **System Preferences > Privacy & Security > Accessibility**.
- **HID access** — works without extra entitlements for non-sandboxed apps (Tauri default).

## Setup

```bash
# Clone
git clone https://github.com/fedevgonzalez/deck8-hub.git
cd deck8-hub

# Install frontend dependencies
cd frontend && npm install && cd ..
```

## Development

```bash
# Run in dev mode (Vite hot-reload + Rust backend)
cargo tauri dev
```

## Production Build

```bash
# Build standalone executable with frontend embedded
cargo tauri build
```

Output:
- **Windows:** `src-tauri/target/release/deck8-hub.exe`
- **macOS:** `src-tauri/target/release/bundle/macos/Deck-8 Hub.app`

## Project Structure

```
deck8-hub/
├── frontend/                 # React + Vite + Tailwind
│   └── src/
│       ├── components/       # UI components (toolbar, color view, key grid, etc.)
│       ├── hooks/            # useDeck8 — main state hook
│       └── lib/              # tauri.ts (IPC), keycodes, utils
└── src-tauri/                # Rust backend
    └── src/
        ├── lib.rs            # Tauri commands, shortcuts, keystroke replay
        ├── hid.rs            # HID communication with Deck-8
        ├── protocol.rs       # VIA/QMK protocol constants and types
        ├── profile.rs        # Session state persistence
        └── state.rs          # App state types (KeyConfig, StateSnapshot)
```

## Hardware

- **VID/PID:** `0xCBBC` / `0xC101`
- **Protocol:** QMK VIA raw HID (custom channel `0x07`)
- **Layout:** 4x2 grid, bottom row LEDs are snake-wired (reversed: key 4-7 maps to LED 7-4)
- **Firmware:** [QMK Firmware](https://github.com/qmk/qmk_firmware)

## License

Proprietary — Churrosoft
