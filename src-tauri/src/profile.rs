use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::state::{AudioConfig, KeyConfig};

// ── Auto-persisted state ────────────────────────────────────────────────

/// Persisted key state that survives app restarts.
#[derive(Debug, Serialize, Deserialize)]
struct PersistedState {
    pub keys: Vec<KeyConfig>,
    #[serde(default)]
    pub audio_config: Option<AudioConfig>,
}

/// Path: %APPDATA%/deck8-hub/state.json
fn state_file() -> Result<PathBuf> {
    let base = dirs::config_dir().context("Cannot determine config directory")?;
    let dir = base.join("deck8-hub");
    if !dir.exists() {
        fs::create_dir_all(&dir).context("Failed to create config directory")?;
    }
    Ok(dir.join("state.json"))
}

/// Save current key state and audio config to disk.
pub fn save_state(keys: &[KeyConfig; 8], audio_config: &AudioConfig) -> Result<()> {
    let persisted = PersistedState {
        keys: keys.to_vec(),
        audio_config: Some(audio_config.clone()),
    };
    let json = serde_json::to_string(&persisted).context("Failed to serialize state")?;
    fs::write(state_file()?, json).context("Failed to write state file")?;
    Ok(())
}

/// Load key state and audio config from disk.
pub fn load_state() -> Option<([KeyConfig; 8], Option<AudioConfig>)> {
    let path = state_file().ok()?;
    let json = fs::read_to_string(path).ok()?;
    let persisted: PersistedState = serde_json::from_str(&json).ok()?;
    let keys: [KeyConfig; 8] = persisted.keys.try_into().ok()?;
    Some((keys, persisted.audio_config))
}
