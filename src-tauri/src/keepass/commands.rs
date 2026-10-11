use std::fs;
use std::path::{Path, PathBuf};

use tauri::State;
use uuid::Uuid;

use crate::keepass::models::*;
use crate::keepass::vault::Vault;
use crate::keepass::KeePassState;

const VAULT_DIR_NAME: &str = "KeePassContainers";

/// Vaults created from the UI are stored in `~/KeePassContainers`.
fn vault_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(VAULT_DIR_NAME))
        .ok_or_else(|| "Cannot find the home directory".to_string())
}

fn read_keyfile(path: Option<String>) -> Result<Option<Vec<u8>>, String> {
    match path {
        Some(path) if !path.is_empty() => fs::read(&path)
            .map(Some)
            .map_err(|e| format!("Cannot read key file: {e}")),
        _ => Ok(None),
    }
}

/// Runs `f` on the open vault with the given id. Errors are turned into strings for the frontend.
fn with_vault<T>(
    state: &KeePassState,
    vault_id: &str,
    f: impl FnOnce(&mut Vault) -> anyhow::Result<T>,
) -> Result<T, String> {
    let mut vaults = state
        .vaults
        .lock()
        .map_err(|_| "KeePass state is unavailable".to_string())?;
    let vault = vaults
        .get_mut(vault_id)
        .ok_or_else(|| "The vault is not open".to_string())?;
    f(vault).map_err(|e| format!("{e:#}"))
}

/// Lists the `.kdbx` files in `~/KeePassContainers`.
#[tauri::command]
pub async fn keepass_list_files() -> Result<Vec<String>, String> {
    let dir = vault_dir()?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut files: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| format!("Cannot read {}: {e}", dir.display()))?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| is_kdbx(path))
        .map(|path| path.to_string_lossy().into_owned())
        .collect();
    files.sort();
    Ok(files)
}

/// Creates `~/KeePassContainers/<name>.kdbx` and opens it.
#[tauri::command]
pub async fn keepass_create(
    state: State<'_, KeePassState>,
    name: String,
    password: String,
    keyfile_path: Option<String>,
) -> Result<VaultInfo, String> {
    let name = name.trim();
    if !is_valid_name(name) {
        return Err("The name can contain letters, digits, spaces, '-', '_' and '.' only".to_string());
    }

    let dir = vault_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
    let path = dir.join(format!("{name}.kdbx"));

    let keyfile = read_keyfile(keyfile_path)?;
    let vault = Vault::create(&path, &password, keyfile.as_deref())
        .map_err(|e| format!("{e:#}"))?;
    Ok(register(&state, vault)?)
}

/// Opens an existing `.kdbx` file. If the file is already open, its existing session is returned.
#[tauri::command]
pub async fn keepass_open(
    state: State<'_, KeePassState>,
    path: String,
    password: String,
    keyfile_path: Option<String>,
) -> Result<VaultInfo, String> {
    let path = PathBuf::from(&path);
    if !is_kdbx(&path) {
        return Err("The file must have a .kdbx extension".to_string());
    }

    {
        let vaults = state
            .vaults
            .lock()
            .map_err(|_| "KeePass state is unavailable".to_string())?;
        if let Some((id, vault)) = vaults.iter().find(|(_, v)| v.path() == path) {
            return Ok(vault.info(id));
        }
    }

    let keyfile = read_keyfile(keyfile_path)?;
    let vault = Vault::open(&path, &password, keyfile.as_deref())
        .map_err(|e| format!("{e:#}"))?;
    Ok(register(&state, vault)?)
}

fn register(state: &KeePassState, vault: Vault) -> Result<VaultInfo, String> {
    let id = Uuid::new_v4().to_string();
    let info = vault.info(&id);
    state
        .vaults
        .lock()
        .map_err(|_| "KeePass state is unavailable".to_string())?
        .insert(id, vault);
    Ok(info)
}

/// Closes a vault. The file on disk is already up to date, so nothing is written here.
#[tauri::command]
pub async fn keepass_close(state: State<'_, KeePassState>, vault_id: String) -> Result<(), String> {
    state
        .vaults
        .lock()
        .map_err(|_| "KeePass state is unavailable".to_string())?
        .remove(&vault_id);
    Ok(())
}

#[tauri::command]
pub async fn keepass_list_groups(
    state: State<'_, KeePassState>,
    vault_id: String,
) -> Result<Vec<VaultGroup>, String> {
    with_vault(&state, &vault_id, |v| Ok(v.groups()))
}

#[tauri::command]
pub async fn keepass_list_entries(
    state: State<'_, KeePassState>,
    vault_id: String,
) -> Result<Vec<VaultEntrySummary>, String> {
    with_vault(&state, &vault_id, |v| Ok(v.entries()))
}

/// Returns a single entry including its password.
#[tauri::command]
pub async fn keepass_get_entry(
    state: State<'_, KeePassState>,
    vault_id: String,
    entry_id: String,
) -> Result<VaultEntry, String> {
    with_vault(&state, &vault_id, |v| v.entry(&entry_id))
}

/// Creates or updates an entry and writes the file.
#[tauri::command]
pub async fn keepass_save_entry(
    state: State<'_, KeePassState>,
    vault_id: String,
    entry: EntryInput,
) -> Result<String, String> {
    with_vault(&state, &vault_id, |v| v.save_entry(&entry))
}

#[tauri::command]
pub async fn keepass_delete_entry(
    state: State<'_, KeePassState>,
    vault_id: String,
    entry_id: String,
) -> Result<(), String> {
    with_vault(&state, &vault_id, |v| v.delete_entry(&entry_id))
}

#[tauri::command]
pub async fn keepass_create_group(
    state: State<'_, KeePassState>,
    vault_id: String,
    parent_id: Option<String>,
    name: String,
) -> Result<String, String> {
    with_vault(&state, &vault_id, |v| {
        v.create_group(parent_id.as_deref(), &name)
    })
}

#[tauri::command]
pub async fn keepass_delete_group(
    state: State<'_, KeePassState>,
    vault_id: String,
    group_id: String,
) -> Result<(), String> {
    with_vault(&state, &vault_id, |v| v.delete_group(&group_id))
}

#[tauri::command]
pub async fn keepass_change_password(
    state: State<'_, KeePassState>,
    vault_id: String,
    new_password: String,
    keyfile_path: Option<String>,
) -> Result<(), String> {
    let keyfile = read_keyfile(keyfile_path)?;
    with_vault(&state, &vault_id, |v| {
        v.change_password(&new_password, keyfile.as_deref())
    })
}

fn is_kdbx(path: &Path) -> bool {
    path.extension()
        .map(|ext| ext.eq_ignore_ascii_case("kdbx"))
        .unwrap_or(false)
}

fn is_valid_name(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('.')
        && name
            .chars()
            .all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '.'))
}
