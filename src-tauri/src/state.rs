use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

use crate::audio::AudioPipeline;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundEntry {
    pub id: String,
    pub filename: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    /// Legacy field kept for backward-compat deserialization only.
    #[serde(default)]
    pub sound_files: [Option<String>; 8],
    /// Sound library: unlimited collection of sound entries.
    #[serde(default)]
    pub sound_library: Vec<SoundEntry>,
    /// Per-key sound assignment: each key references a SoundEntry.id (or None).
    #[serde(default = "default_key_sounds")]
    pub key_sounds: [Option<String>; 8],
    #[serde(default)]
    pub audio_input_device: Option<String>,
    #[serde(default)]
    pub audio_output_device: Option<String>,
    #[serde(default = "default_volume")]
    pub sound_volume: f32,
    #[serde(default = "default_volume")]
    pub mic_volume: f32,
    #[serde(default)]
    pub soundboard_enabled: bool,
}

fn default_volume() -> f32 {
    1.0
}

fn default_key_sounds() -> [Option<String>; 8] {
    Default::default()
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sound_files: Default::default(),
            sound_library: Vec::new(),
            key_sounds: Default::default(),
            audio_input_device: None,
            audio_output_device: None,
            sound_volume: 1.0,
            mic_volume: 1.0,
            soundboard_enabled: false,
        }
    }
}

pub struct ManagedAudioPipeline(pub Mutex<Option<AudioPipeline>>);

pub struct AppState {
    pub device: Option<Deck8Device>,
    pub keys: [KeyConfig; 8],
    pub active_slot: ActiveSlot,
    pub keymaps: [u16; 8],
    pub device_info: Option<DeviceInfo>,
    pub rgb_matrix: Option<RgbMatrixState>,
    /// Maps shortcut display string → (LED index, QMK keycode, register string)
    pub shortcut_map: HashMap<String, (usize, u16, String)>,
    pub audio_config: AudioConfig,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            device: None,
            keys: std::array::from_fn(|_| KeyConfig::default()),
            active_slot: ActiveSlot::A,
            keymaps: [0u16; 8],
            device_info: None,
            rgb_matrix: None,
            shortcut_map: HashMap::new(),
            audio_config: AudioConfig::default(),
        }
    }
}

/// Snapshot of state sent to the frontend (no device handle).
#[derive(Debug, Clone, Serialize)]
pub struct StateSnapshot {
    pub connected: bool,
    pub keys: Vec<KeyConfig>,
    pub active_slot: ActiveSlot,
    pub keymaps: Vec<u16>,
    pub device_info: Option<DeviceInfo>,
    pub rgb_matrix: Option<RgbMatrixState>,
    pub audio_config: AudioConfig,
}

impl AppState {
    pub fn snapshot(&self) -> StateSnapshot {
        StateSnapshot {
            connected: self.device.is_some(),
            keys: self.keys.to_vec(),
            active_slot: self.active_slot,
            keymaps: self.keymaps.to_vec(),
            device_info: self.device_info.clone(),
            rgb_matrix: self.rgb_matrix,
            audio_config: self.audio_config.clone(),
        }
    }
}

pub type SharedState = Mutex<AppState>;
