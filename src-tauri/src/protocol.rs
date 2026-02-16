use serde::{Deserialize, Serialize};

/// VID/PID for Churrosoft Deck-8
pub const VID: u16 = 0xCBBC;
pub const PID: u16 = 0xC101;

/// HID Usage Page and Usage ID for VIA raw HID
pub const USAGE_PAGE: u16 = 0xFF60;
pub const USAGE_ID: u16 = 0x61;

// ── VIA top-level command IDs ───────────────────────────────────────────

pub const VIA_GET_PROTOCOL_VERSION: u8 = 0x01;
pub const VIA_GET_KEYBOARD_VALUE: u8 = 0x02;
pub const VIA_SET_KEYBOARD_VALUE: u8 = 0x03;
pub const VIA_DYNAMIC_KEYMAP_GET: u8 = 0x04;
pub const VIA_DYNAMIC_KEYMAP_SET: u8 = 0x05;
pub const VIA_DYNAMIC_KEYMAP_RESET: u8 = 0x06;
pub const VIA_CUSTOM_GET_VALUE: u8 = 0x08;
pub const VIA_CUSTOM_SAVE: u8 = 0x09;
pub const VIA_EEPROM_RESET: u8 = 0x0A;
pub const VIA_BOOTLOADER_JUMP: u8 = 0x0B;
pub const VIA_MACRO_GET_COUNT: u8 = 0x0C;
pub const VIA_MACRO_GET_BUFFER_SIZE: u8 = 0x0D;
pub const VIA_MACRO_RESET: u8 = 0x10;
pub const VIA_GET_LAYER_COUNT: u8 = 0x11;

// ── Keyboard value sub-IDs (for 0x02/0x03) ─────────────────────────────

pub const KB_VALUE_UPTIME: u8 = 0x01;
pub const KB_VALUE_LAYOUT_OPTIONS: u8 = 0x02;
pub const KB_VALUE_FIRMWARE_VERSION: u8 = 0x04;
pub const KB_VALUE_DEVICE_INDICATION: u8 = 0x05;

// ── Custom channel (0x07) ───────────────────────────────────────────────

const CUSTOM_CHANNEL: u8 = 0x07;

/// Per-key custom channel sub-command IDs
const CMD_ENABLE_OVERRIDE: u8 = 0x01;
const CMD_SET_BRIGHTNESS: u8 = 0x02;
const CMD_SET_COLOR: u8 = 0x03;

/// RGB Matrix custom channel ID (used with VIA_CUSTOM_GET_VALUE / VIA_CUSTOM_SAVE)
pub const RGB_MATRIX_CHANNEL: u8 = 0x03;

/// RGB Matrix value IDs within the RGB Matrix channel
pub const RGB_VAL_BRIGHTNESS: u8 = 0x01;
pub const RGB_VAL_EFFECT: u8 = 0x02;
pub const RGB_VAL_EFFECT_SPEED: u8 = 0x03;
pub const RGB_VAL_COLOR: u8 = 0x04;

/// Layer 0
const LAYER: u8 = 0x00;

// ── Data structs ────────────────────────────────────────────────────────

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub protocol_version: u16,
    pub firmware_version: u32,
    pub uptime: u32,
    pub layer_count: u8,
    pub macro_count: u8,
    pub macro_buffer_size: u16,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct RgbMatrixState {
    pub brightness: u8,
    pub effect: u8,
    pub speed: u8,
    pub color_h: u8,
    pub color_s: u8,
}

// ── Per-key custom channel builders ─────────────────────────────────────

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

// ── Keymap builders ─────────────────────────────────────────────────────

/// Convert key index (0-7) to matrix position (row, col).
/// Row 0 = K1-K4 (cols 0-3), Row 1 = K5-K8 (cols 0-3).
pub fn key_index_to_matrix(key_index: u8) -> (u8, u8) {
    (key_index / 4, key_index % 4)
}

/// Build a 32-byte VIA top-level command to read a keycode.
pub fn build_get_keycode(layer: u8, row: u8, col: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_DYNAMIC_KEYMAP_GET;
    buf[1] = layer;
    buf[2] = row;
    buf[3] = col;
    buf
}

/// Build a 32-byte VIA top-level command to write a keycode.
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

// ── General VIA command builders ────────────────────────────────────────

pub fn build_get_protocol_version() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_GET_PROTOCOL_VERSION;
    buf
}

pub fn build_get_keyboard_value(sub_id: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_GET_KEYBOARD_VALUE;
    buf[1] = sub_id;
    buf
}

pub fn build_set_keyboard_value(sub_id: u8, value: u32) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_SET_KEYBOARD_VALUE;
    buf[1] = sub_id;
    buf[2] = (value >> 24) as u8;
    buf[3] = (value >> 16) as u8;
    buf[4] = (value >> 8) as u8;
    buf[5] = (value & 0xFF) as u8;
    buf
}

pub fn build_dynamic_keymap_reset() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_DYNAMIC_KEYMAP_RESET;
    buf
}

pub fn build_eeprom_reset() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_EEPROM_RESET;
    buf
}

pub fn build_bootloader_jump() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_BOOTLOADER_JUMP;
    buf
}

pub fn build_macro_get_count() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_MACRO_GET_COUNT;
    buf
}

pub fn build_macro_get_buffer_size() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_MACRO_GET_BUFFER_SIZE;
    buf
}

pub fn build_macro_reset() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_MACRO_RESET;
    buf
}

pub fn build_get_layer_count() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_GET_LAYER_COUNT;
    buf
}

// ── RGB Matrix custom channel builders ──────────────────────────────────

pub fn build_rgb_get_value(value_id: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_CUSTOM_GET_VALUE;
    buf[1] = RGB_MATRIX_CHANNEL;
    buf[2] = value_id;
    buf
}

pub fn build_rgb_set_value_u8(value_id: u8, val: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = CUSTOM_CHANNEL;
    buf[1] = RGB_MATRIX_CHANNEL;
    buf[2] = value_id;
    buf[3] = val;
    buf
}

pub fn build_rgb_set_color(h: u8, s: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = CUSTOM_CHANNEL;
    buf[1] = RGB_MATRIX_CHANNEL;
    buf[2] = RGB_VAL_COLOR;
    buf[3] = h;
    buf[4] = s;
    buf
}

pub fn build_rgb_save() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_CUSTOM_SAVE;
    buf[1] = RGB_MATRIX_CHANNEL;
    buf
}

/// Save per-key LED overrides to EEPROM.
/// Channel 0x00 = id_custom_channel in QMK VIA (not CUSTOM_CHANNEL which is the command byte).
pub fn build_custom_save() -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[0] = VIA_CUSTOM_SAVE;
    buf[1] = 0x00; // id_custom_channel
    buf
}
