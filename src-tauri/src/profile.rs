use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::state::KeyConfig;

#[derive(Debug, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub keys: Vec<KeyConfig>,
    #[serde(default)]
    pub keymaps: Option<Vec<u16>>,
}

/// Get the profiles directory: %APPDATA%\deck8-hub\profiles
fn profiles_dir() -> Result<PathBuf> {
    let base = dirs::config_dir().context("Cannot determine config directory")?;
    let dir = base.join("deck8-hub").join("profiles");
    if !dir.exists() {
        fs::create_dir_all(&dir).context("Failed to create profiles directory")?;
    }
    Ok(dir)
}

/// List all saved profile names (without .json extension).
pub fn list_profiles() -> Result<Vec<String>> {
    let dir = profiles_dir()?;
    let mut names = Vec::new();
    if dir.exists() {
        for entry in fs::read_dir(&dir).context("Failed to read profiles directory")? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "json") {
                if let Some(stem) = path.file_stem() {
                    names.push(stem.to_string_lossy().into_owned());
                }
            }
        }
    }
    names.sort();
    Ok(names)
}

/// Save a profile to disk.
pub fn save_profile(name: &str, keys: &[KeyConfig; 8], keymaps: &[u16; 8]) -> Result<()> {
    let dir = profiles_dir()?;
    let profile = Profile {
        name: name.to_string(),
        keys: keys.to_vec(),
        keymaps: Some(keymaps.to_vec()),
    };
    let json = serde_json::to_string_pretty(&profile).context("Failed to serialize profile")?;
    let path = dir.join(format!("{}.json", name));
    fs::write(&path, json).context("Failed to write profile file")?;
    Ok(())
}

/// Load a profile from disk.
pub fn load_profile(name: &str) -> Result<Profile> {
    let dir = profiles_dir()?;
    let path = dir.join(format!("{}.json", name));
    let json = fs::read_to_string(&path).context("Failed to read profile file")?;
    let profile: Profile = serde_json::from_str(&json).context("Failed to parse profile")?;
    Ok(profile)
}

/// Delete a profile from disk.
pub fn delete_profile(name: &str) -> Result<()> {
    let dir = profiles_dir()?;
    let path = dir.join(format!("{}.json", name));
    if path.exists() {
        fs::remove_file(&path).context("Failed to delete profile")?;
    }
    Ok(())
}

// ── Auto-persisted state ────────────────────────────────────────────────

/// Persisted key state that survives app restarts.
#[derive(Debug, Serialize, Deserialize)]
struct PersistedState {
    pub keys: Vec<KeyConfig>,
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

/// Save current key state to disk.
pub fn save_state(keys: &[KeyConfig; 8]) -> Result<()> {
    let persisted = PersistedState {
        keys: keys.to_vec(),
    };
    let json = serde_json::to_string(&persisted).context("Failed to serialize state")?;
    fs::write(state_file()?, json).context("Failed to write state file")?;
    Ok(())
}

/// Load key state from disk (returns None if no saved state).
pub fn load_state() -> Option<[KeyConfig; 8]> {
    let path = state_file().ok()?;
    let json = fs::read_to_string(path).ok()?;
    let persisted: PersistedState = serde_json::from_str(&json).ok()?;
    let keys: [KeyConfig; 8] = persisted.keys.try_into().ok()?;
    Some(keys)
}
