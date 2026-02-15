use anyhow::{Context, Result};
use hidapi::{HidApi, HidDevice};
use log::info;

use crate::protocol::{self, HsvColor, PID, USAGE_ID, USAGE_PAGE, VID};

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

    /// Read the keycode for a specific key position from the device.
    pub fn get_keycode(&self, layer: u8, row: u8, col: u8) -> Result<u16> {
        let cmd = protocol::build_get_keycode(layer, row, col);
        let resp = self.send_and_receive(&cmd, 500)?;
        // Response bytes 4-5 contain the keycode (big-endian)
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
