pub mod commands;
pub mod models;
pub mod vault;

use std::collections::HashMap;
use std::sync::Mutex;

use tauri::Manager;

use vault::Vault;

/// Vaults that are currently open, keyed by vault id.
#[derive(Default)]
pub struct KeePassState {
    pub vaults: Mutex<HashMap<String, Vault>>,
}

pub fn setup(app: &tauri::AppHandle) -> anyhow::Result<()> {
    app.manage(KeePassState::default());
    Ok(())
}
