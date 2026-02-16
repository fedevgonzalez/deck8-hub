use anyhow::{Context, Result};
use hidapi::{HidApi, HidDevice};
use log::info;

use crate::protocol::{
    self, DeviceInfo, HsvColor, RgbMatrixState, PID, USAGE_ID, USAGE_PAGE, VID,
    KB_VALUE_UPTIME, KB_VALUE_FIRMWARE_VERSION, KB_VALUE_DEVICE_INDICATION,
    RGB_VAL_BRIGHTNESS, RGB_VAL_EFFECT, RGB_VAL_EFFECT_SPEED, RGB_VAL_COLOR,
};

pub struct Deck8Device {
    device: HidDevice,
}

impl Deck8Device {
    /// Enumerate USB HID devices and open the Deck-8 raw HID interface.
    pub fn open() -> Result<Self> {
        let api = HidApi::new().context("Failed to initialize HID API")?;
        let dev_info = api
            .device_list()
            .find(|d| {
                d.vendor_id() == VID
                    && d.product_id() == PID
                    && d.usage_page() == USAGE_PAGE
                    && d.usage() == USAGE_ID
            })
            .context("Deck-8 not found (VID/PID/Usage mismatch)")?;

        info!(
            "Found Deck-8 at path: {:?}",
            dev_info.path().to_str().unwrap_or("?")
        );

        let device = dev_info
            .open_device(&api)
            .context("Failed to open Deck-8 HID device")?;
        Ok(Self { device })
    }

    // ── Per-key LED commands ────────────────────────────────────────────

    /// Set a key's LED color by sending the 3-message sequence:
    /// enable override, set color (H+S), set brightness (V).
    pub fn set_key_color(&self, key_id: u8, color: &HsvColor) -> Result<()> {
        self.send_report(&protocol::build_enable_override(key_id))?;
        self.send_report(&protocol::build_set_color(key_id, color))?;
        self.send_report(&protocol::build_set_brightness(key_id, color.v))?;
        Ok(())
    }

    /// Disable per-key override, restoring the original color/animation.
    pub fn disable_override(&self, key_id: u8) -> Result<()> {
        self.send_report(&protocol::build_disable_override(key_id))?;
        Ok(())
    }

    // ── Keymap commands ─────────────────────────────────────────────────

    /// Read the keycode for a specific key position from the device.
    pub fn get_keycode(&self, layer: u8, row: u8, col: u8) -> Result<u16> {
        let cmd = protocol::build_get_keycode(layer, row, col);
        let resp = self.send_and_receive(&cmd, 500)?;
        let keycode = ((resp[4] as u16) << 8) | (resp[5] as u16);
        Ok(keycode)
    }

    /// Write a keycode to a specific key position on the device.
    pub fn set_keycode(&self, layer: u8, row: u8, col: u8, keycode: u16) -> Result<()> {
        let cmd = protocol::build_set_keycode(layer, row, col, keycode);
        let _resp = self.send_and_receive(&cmd, 500)?;
        Ok(())
    }

    /// Read all 8 keycodes from layer 0.
    pub fn read_all_keycodes(&self) -> Result<[u16; 8]> {
        let mut keymaps = [0u16; 8];
        for i in 0..8u8 {
            let (row, col) = protocol::key_index_to_matrix(i);
            keymaps[i as usize] = self.get_keycode(0, row, col)?;
        }
        Ok(keymaps)
    }

    /// Reset dynamic keymap to firmware defaults.
    pub fn dynamic_keymap_reset(&self) -> Result<()> {
        let cmd = protocol::build_dynamic_keymap_reset();
        let _resp = self.send_and_receive(&cmd, 500)?;
        Ok(())
    }

    /// Get the number of layers supported by the keyboard.
    pub fn get_layer_count(&self) -> Result<u8> {
        let cmd = protocol::build_get_layer_count();
        let resp = self.send_and_receive(&cmd, 500)?;
        Ok(resp[1])
    }

    // ── General device info commands ────────────────────────────────────

    /// Get the VIA protocol version (e.g. 12 = 0x000C).
    pub fn get_protocol_version(&self) -> Result<u16> {
        let cmd = protocol::build_get_protocol_version();
        let resp = self.send_and_receive(&cmd, 500)?;
        let version = ((resp[1] as u16) << 8) | (resp[2] as u16);
        Ok(version)
    }

    /// Get the device uptime in seconds.
    pub fn get_uptime(&self) -> Result<u32> {
        let cmd = protocol::build_get_keyboard_value(KB_VALUE_UPTIME);
        let resp = self.send_and_receive(&cmd, 500)?;
        let uptime = ((resp[2] as u32) << 24)
            | ((resp[3] as u32) << 16)
            | ((resp[4] as u32) << 8)
            | (resp[5] as u32);
        Ok(uptime)
    }

    /// Get the firmware version as a packed u32.
    pub fn get_firmware_version(&self) -> Result<u32> {
        let cmd = protocol::build_get_keyboard_value(KB_VALUE_FIRMWARE_VERSION);
        let resp = self.send_and_receive(&cmd, 500)?;
        let version = ((resp[2] as u32) << 24)
            | ((resp[3] as u32) << 16)
            | ((resp[4] as u32) << 8)
            | (resp[5] as u32);
        Ok(version)
    }

    /// Trigger the device indication LED pattern (identify device).
    pub fn device_indication(&self) -> Result<()> {
        let cmd = protocol::build_set_keyboard_value(KB_VALUE_DEVICE_INDICATION, 1);
        self.send_report(&cmd)?;
        Ok(())
    }

    /// Jump to bootloader (device will disconnect and enter DFU mode).
    pub fn bootloader_jump(&self) -> Result<()> {
        self.send_report(&protocol::build_bootloader_jump())?;
        Ok(())
    }

    /// Reset EEPROM to factory defaults.
    pub fn eeprom_reset(&self) -> Result<()> {
        let cmd = protocol::build_eeprom_reset();
        let _resp = self.send_and_receive(&cmd, 500)?;
        Ok(())
    }

    /// Get aggregate device info.
    pub fn get_device_info(&self) -> Result<DeviceInfo> {
        let protocol_version = self.get_protocol_version()?;
        let firmware_version = self.get_firmware_version()?;
        let uptime = self.get_uptime()?;
        let layer_count = self.get_layer_count()?;
        let macro_count = self.get_macro_count()?;
        let macro_buffer_size = self.get_macro_buffer_size()?;
        Ok(DeviceInfo {
            protocol_version,
            firmware_version,
            uptime,
            layer_count,
            macro_count,
            macro_buffer_size,
        })
    }

    // ── Macro commands ──────────────────────────────────────────────────

    /// Get the number of macros supported by the keyboard.
    pub fn get_macro_count(&self) -> Result<u8> {
        let cmd = protocol::build_macro_get_count();
        let resp = self.send_and_receive(&cmd, 500)?;
        Ok(resp[1])
    }

    /// Get the macro buffer size in bytes.
    pub fn get_macro_buffer_size(&self) -> Result<u16> {
        let cmd = protocol::build_macro_get_buffer_size();
        let resp = self.send_and_receive(&cmd, 500)?;
        let size = ((resp[1] as u16) << 8) | (resp[2] as u16);
        Ok(size)
    }

    /// Reset all macros to empty.
    pub fn macro_reset(&self) -> Result<()> {
        let cmd = protocol::build_macro_reset();
        let _resp = self.send_and_receive(&cmd, 500)?;
        Ok(())
    }

    // ── RGB Matrix commands ─────────────────────────────────────────────

    pub fn rgb_get_brightness(&self) -> Result<u8> {
        let cmd = protocol::build_rgb_get_value(RGB_VAL_BRIGHTNESS);
        let resp = self.send_and_receive(&cmd, 500)?;
        Ok(resp[3])
    }

    pub fn rgb_set_brightness(&self, val: u8) -> Result<()> {
        let cmd = protocol::build_rgb_set_value_u8(RGB_VAL_BRIGHTNESS, val);
        self.send_report(&cmd)?;
        Ok(())
    }

    pub fn rgb_get_effect(&self) -> Result<u8> {
        let cmd = protocol::build_rgb_get_value(RGB_VAL_EFFECT);
        let resp = self.send_and_receive(&cmd, 500)?;
        Ok(resp[3])
    }

    pub fn rgb_set_effect(&self, val: u8) -> Result<()> {
        let cmd = protocol::build_rgb_set_value_u8(RGB_VAL_EFFECT, val);
        self.send_report(&cmd)?;
        Ok(())
    }

    pub fn rgb_get_speed(&self) -> Result<u8> {
        let cmd = protocol::build_rgb_get_value(RGB_VAL_EFFECT_SPEED);
        let resp = self.send_and_receive(&cmd, 500)?;
        Ok(resp[3])
    }

    pub fn rgb_set_speed(&self, val: u8) -> Result<()> {
        let cmd = protocol::build_rgb_set_value_u8(RGB_VAL_EFFECT_SPEED, val);
        self.send_report(&cmd)?;
        Ok(())
    }

    pub fn rgb_get_color(&self) -> Result<(u8, u8)> {
        let cmd = protocol::build_rgb_get_value(RGB_VAL_COLOR);
        let resp = self.send_and_receive(&cmd, 500)?;
        Ok((resp[3], resp[4]))
    }

    pub fn rgb_set_color(&self, h: u8, s: u8) -> Result<()> {
        let cmd = protocol::build_rgb_set_color(h, s);
        self.send_report(&cmd)?;
        Ok(())
    }

    /// Save current RGB Matrix settings to EEPROM.
    pub fn rgb_save(&self) -> Result<()> {
        let cmd = protocol::build_rgb_save();
        self.send_report(&cmd)?;
        Ok(())
    }

    /// Get aggregate RGB Matrix state.
    pub fn rgb_get_state(&self) -> Result<RgbMatrixState> {
        let brightness = self.rgb_get_brightness()?;
        let effect = self.rgb_get_effect()?;
        let speed = self.rgb_get_speed()?;
        let (color_h, color_s) = self.rgb_get_color()?;
        Ok(RgbMatrixState {
            brightness,
            effect,
            speed,
            color_h,
            color_s,
        })
    }

    // ── Low-level HID I/O ───────────────────────────────────────────────

    /// Read a 32-byte response from the device with timeout.
    fn read_response(&self, timeout_ms: i32) -> Result<[u8; 32]> {
        let mut buf = [0u8; 32];
        let n = self
            .device
            .read_timeout(&mut buf, timeout_ms)
            .context("Failed to read HID response")?;
        if n == 0 {
            anyhow::bail!("HID read timed out");
        }
        Ok(buf)
    }

    /// Send a report and read back the response.
    fn send_and_receive(&self, report: &[u8; 32], timeout_ms: i32) -> Result<[u8; 32]> {
        self.send_report(report)?;
        self.read_response(timeout_ms)
    }

    /// Send a 32-byte report prepended with Report ID 0x00 (33 bytes total).
    fn send_report(&self, report: &[u8; 32]) -> Result<()> {
        let mut buf = [0u8; 33];
        buf[0] = 0x00; // Report ID
        buf[1..].copy_from_slice(report);
        self.device
            .write(&buf)
            .context("Failed to write HID report")?;
        Ok(())
    }
}
