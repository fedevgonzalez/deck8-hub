use serde::{Deserialize, Serialize};

/// VID/PID for Churrosoft Deck-8
pub const VID: u16 = 0xCBBC;
pub const PID: u16 = 0xC101;

/// HID Usage Page and Usage ID for VIA raw HID
pub const USAGE_PAGE: u16 = 0xFF60;
pub const USAGE_ID: u16 = 0x61;

/// VIA custom channel command prefix
const CUSTOM_CHANNEL: u8 = 0x07;

/// Sub-command IDs within the custom channel
const CMD_ENABLE_OVERRIDE: u8 = 0x01;
const CMD_SET_BRIGHTNESS: u8 = 0x02;
const CMD_SET_COLOR: u8 = 0x03;

/// VIA top-level keymap commands (NOT custom channel)
pub const VIA_DYNAMIC_KEYMAP_GET: u8 = 0x04;
pub const VIA_DYNAMIC_KEYMAP_SET: u8 = 0x05;

/// Layer 0
const LAYER: u8 = 0x00;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct HsvColor {
    pub h: u8,
    pub s: u8,
    pub v: u8,
}

impl Default for HsvColor {
    fn default() -> Self {
        Self { h: 0, s: 0, v: 120 }
    }
}

/// Build a 32-byte report to set H and S for a key.
pub fn build_set_color(key_id: u8, color: &HsvColor) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = CUSTOM_CHANNEL;
    buf[1] = 0x00;
    buf[2] = CMD_SET_COLOR;
    buf[3] = LAYER;
    buf[4] = key_id;
    buf[5] = color.h;
    buf[6] = color.s;
    buf
}

/// Build a 32-byte report to set brightness (V) for a key.
pub fn build_set_brightness(key_id: u8, brightness: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = CUSTOM_CHANNEL;
    buf[1] = 0x00;
    buf[2] = CMD_SET_BRIGHTNESS;
    buf[3] = LAYER;
    buf[4] = key_id;
    buf[5] = brightness;
    buf
}

/// Build a 32-byte report to enable per-key override for a key.
pub fn build_enable_override(key_id: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = CUSTOM_CHANNEL;
    buf[1] = 0x00;
    buf[2] = CMD_ENABLE_OVERRIDE;
    buf[3] = LAYER;
    buf[4] = key_id;
    buf[5] = 0x01;
    buf
}

/// Build a 32-byte report to disable per-key override (restore original).
pub fn build_disable_override(key_id: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = CUSTOM_CHANNEL;
    buf[1] = 0x00;
    buf[2] = CMD_ENABLE_OVERRIDE;
    buf[3] = LAYER;
    buf[4] = key_id;
    buf[5] = 0x00;
    buf
}

/// Convert key index (0-7) to matrix position (row, col).
/// Row 0 = K1-K4 (cols 0-3), Row 1 = K5-K8 (cols 0-3).
pub fn key_index_to_matrix(key_index: u8) -> (u8, u8) {
    (key_index / 4, key_index % 4)
}

/// Build a 32-byte VIA top-level command to read a keycode.
/// Byte 0 = 0x04, byte 1 = layer, byte 2 = row, byte 3 = col.
pub fn build_get_keycode(layer: u8, row: u8, col: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_DYNAMIC_KEYMAP_GET;
    buf[1] = layer;
    buf[2] = row;
    buf[3] = col;
    buf
}

/// Build a 32-byte VIA top-level command to write a keycode.
/// Byte 0 = 0x05, byte 1 = layer, byte 2 = row, byte 3 = col, bytes 4-5 = keycode hi/lo.
pub fn build_set_keycode(layer: u8, row: u8, col: u8, keycode: u16) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_DYNAMIC_KEYMAP_SET;
    buf[1] = layer;
    buf[2] = row;
    buf[3] = col;
    buf[4] = (keycode >> 8) as u8;
    buf[5] = (keycode & 0xFF) as u8;
    buf
}

