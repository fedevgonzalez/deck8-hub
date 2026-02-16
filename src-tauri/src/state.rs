use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

use crate::hid::Deck8Device;
use crate::protocol::{DeviceInfo, HsvColor, RgbMatrixState};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub enum ActiveSlot {
    #[default]
    A,
    B,
}

impl std::fmt::Display for ActiveSlot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ActiveSlot::A => write!(f, "A"),
            ActiveSlot::B => write!(f, "B"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyConfig {
    pub slot_a: HsvColor,
    pub slot_b: HsvColor,
    #[serde(default)]
    pub override_enabled: bool,
    #[serde(default)]
    pub active_slot: ActiveSlot,
}

impl Default for KeyConfig {
    fn default() -> Self {
        Self {
            slot_a: HsvColor { h: 0x55, s: 0xFF, v: 0x78 }, // green
            slot_b: HsvColor { h: 0x00, s: 0xFF, v: 0x78 }, // red
            override_enabled: false,
            active_slot: ActiveSlot::A,
        }
    }
}

pub struct AppState {
    pub device: Option<Deck8Device>,
    pub keys: [KeyConfig; 8],
    pub active_slot: ActiveSlot,
    pub current_profile_name: Option<String>,
    pub keymaps: [u16; 8],
    pub device_info: Option<DeviceInfo>,
    pub rgb_matrix: Option<RgbMatrixState>,
    /// Maps registered shortcut string → key index (0..7)
    pub shortcut_map: HashMap<String, usize>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            device: None,
            keys: std::array::from_fn(|_| KeyConfig::default()),
            active_slot: ActiveSlot::A,
            current_profile_name: None,
            keymaps: [0u16; 8],
            device_info: None,
            rgb_matrix: None,
            shortcut_map: HashMap::new(),
        }
    }
}

/// Snapshot of state sent to the frontend (no device handle).
#[derive(Debug, Clone, Serialize)]
pub struct StateSnapshot {
    pub connected: bool,
    pub keys: Vec<KeyConfig>,
    pub active_slot: ActiveSlot,
    pub current_profile_name: Option<String>,
    pub keymaps: Vec<u16>,
    pub device_info: Option<DeviceInfo>,
    pub rgb_matrix: Option<RgbMatrixState>,
}

impl AppState {
    pub fn snapshot(&self) -> StateSnapshot {
        StateSnapshot {
            connected: self.device.is_some(),
            keys: self.keys.to_vec(),
            active_slot: self.active_slot,
            current_profile_name: self.current_profile_name.clone(),
            keymaps: self.keymaps.to_vec(),
            device_info: self.device_info.clone(),
            rgb_matrix: self.rgb_matrix,
        }
    }

}

pub type SharedState = Mutex<AppState>;
