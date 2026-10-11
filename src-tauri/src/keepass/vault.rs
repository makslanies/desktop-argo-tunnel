//! KeePass (.kdbx) vault on top of the `keepass` crate.
//!
//! A `Vault` keeps the decrypted database and its key in memory while it is open.
//! Every change is written back to disk straight away, so there is no separate save step.

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, bail, Context, Result};
use chrono::NaiveDateTime;
use keepass::config::{DatabaseConfig, KdfConfig};
use keepass::db::{Database, Entry, EntryId, GroupId, Times};
use keepass::DatabaseKey;
use uuid::Uuid;

use crate::keepass::models::{EntryInput, VaultEntry, VaultEntrySummary, VaultGroup, VaultInfo};

pub const MIN_PASSWORD_LEN: usize = 8;

pub struct Vault {
    path: PathBuf,
    db: Database,
    key: DatabaseKey,
    uses_keyfile: bool,
}

impl Vault {
    /// Creates a new empty database at `path` and writes it to disk.
    pub fn create(path: &Path, password: &str, keyfile: Option<&[u8]>) -> Result<Self> {
        validate_password(password)?;
        if path.exists() {
            bail!("A file already exists at {}", path.display());
        }

        let mut db = Database::with_config(new_database_config());
        db.meta.database_name = path.file_stem().map(|s| s.to_string_lossy().into_owned());

        let vault = Self {
            path: path.to_path_buf(),
            db,
            key: build_key(password, keyfile)?,
            uses_keyfile: keyfile.is_some(),
        };
        vault.save()?;
        Ok(vault)
    }

    /// Opens an existing database. A wrong password, a wrong key file and a damaged file
    /// all come back as the same error, because the crate cannot tell them apart.
    pub fn open(path: &Path, password: &str, keyfile: Option<&[u8]>) -> Result<Self> {
        let mut file = fs::File::open(path)
            .with_context(|| format!("Cannot open {}", path.display()))?;
        let key = build_key(password, keyfile)?;
        let db = Database::open(&mut file, key.clone()).with_context(|| {
            "Cannot decrypt the database: wrong password or key file, or the file is damaged"
        })?;

        Ok(Self {
            path: path.to_path_buf(),
            db,
            key,
            uses_keyfile: keyfile.is_some(),
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Writes the database to a temporary file and renames it over the target.
    /// The previous version is kept next to it as `.kdbx.bak`.
    fn save(&self) -> Result<()> {
        let mut buf = Vec::new();
        self.db
            .save(&mut buf, self.key.clone())
            .context("Cannot encrypt the database")?;

        let tmp = self.path.with_extension("kdbx.tmp");
        fs::write(&tmp, &buf).with_context(|| format!("Cannot write {}", tmp.display()))?;

        if self.path.exists() {
            fs::copy(&self.path, self.path.with_extension("kdbx.bak"))
                .context("Cannot create the backup copy")?;
        }
        fs::rename(&tmp, &self.path)
            .with_context(|| format!("Cannot replace {}", self.path.display()))?;
        Ok(())
    }

    pub fn info(&self, id: &str) -> VaultInfo {
        VaultInfo {
            id: id.to_string(),
            name: self.name(),
            path: self.path.to_string_lossy().into_owned(),
            entry_count: self.db.num_entries(),
            group_count: self.db.num_groups(),
            uses_keyfile: self.uses_keyfile,
        }
    }

    fn name(&self) -> String {
        self.db
            .meta
            .database_name
            .clone()
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| {
                self.path
                    .file_stem()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_default()
            })
    }

    pub fn groups(&self) -> Vec<VaultGroup> {
        self.db
            .iter_all_groups()
            .map(|g| VaultGroup {
                id: g.id().uuid().to_string(),
                name: g.name.clone(),
                parent_id: g.parent().map(|p| p.id().uuid().to_string()),
            })
            .collect()
    }

    pub fn entries(&self) -> Vec<VaultEntrySummary> {
        self.db
            .iter_all_entries()
            .map(|e| VaultEntrySummary {
                id: e.id().uuid().to_string(),
                group_id: e.parent().id().uuid().to_string(),
                title: field(&e, "Title"),
                username: field(&e, "UserName"),
                url: field(&e, "URL"),
                modified_at: timestamp(e.times.last_modification),
            })
            .collect()
    }

    pub fn entry(&self, id: &str) -> Result<VaultEntry> {
        let entry = self
            .db
            .entry(parse_entry_id(id)?)
            .ok_or_else(|| anyhow!("Entry not found"))?;

        Ok(VaultEntry {
            id: id.to_string(),
            group_id: entry.parent().id().uuid().to_string(),
            title: field(&entry, "Title"),
            username: field(&entry, "UserName"),
            password: field(&entry, "Password"),
            url: field(&entry, "URL"),
            notes: field(&entry, "Notes"),
            modified_at: timestamp(entry.times.last_modification),
        })
    }

    /// Creates an entry when `input.id` is `None`, otherwise updates the existing one.
    /// Returns the id of the entry that was written.
    pub fn save_entry(&mut self, input: &EntryInput) -> Result<String> {
        let group_id = parse_group_id(&input.group_id)?;

        let id = match input.id.as_deref() {
            None => {
                let mut group = self
                    .db
                    .group_mut(group_id)
                    .ok_or_else(|| anyhow!("Group not found"))?;
                let mut entry = group.add_entry();
                entry.edit(|e| {
                    e.times = Times::new();
                    apply_fields(e, input);
                });
                entry.id().uuid().to_string()
            }
            Some(id) => {
                let mut entry = self
                    .db
                    .entry_mut(parse_entry_id(id)?)
                    .ok_or_else(|| anyhow!("Entry not found"))?;
                entry.edit_tracking(|e| apply_fields(e, input));
                if entry.parent_mut().id() != group_id {
                    entry.move_to(group_id).context("Target group not found")?;
                }
                id.to_string()
            }
        };

        self.save()?;
        Ok(id)
    }

    pub fn delete_entry(&mut self, id: &str) -> Result<()> {
        let entry = self
            .db
            .entry_mut(parse_entry_id(id)?)
            .ok_or_else(|| anyhow!("Entry not found"))?;
        entry.remove();
        self.save()
    }

    /// Adds a group under `parent_id`, or under the root group when `parent_id` is `None`.
    pub fn create_group(&mut self, parent_id: Option<&str>, name: &str) -> Result<String> {
        let name = name.trim();
        if name.is_empty() {
            bail!("Group name cannot be empty");
        }

        let id = {
            let mut parent = match parent_id {
                Some(id) => self
                    .db
                    .group_mut(parse_group_id(id)?)
                    .ok_or_else(|| anyhow!("Parent group not found"))?,
                None => self.db.root_mut(),
            };
            let mut group = parent.add_group();
            group.edit(|g| {
                g.times = Times::new();
                g.name = name.to_string();
            });
            group.id().uuid().to_string()
        };

        self.save()?;
        Ok(id)
    }

    /// Deletes a group together with everything inside it. The root group cannot be deleted.
    pub fn delete_group(&mut self, id: &str) -> Result<()> {
        let group_id = parse_group_id(id)?;
        if self.db.root().id() == group_id {
            bail!("The root group cannot be deleted");
        }

        self.db
            .group_mut(group_id)
            .ok_or_else(|| anyhow!("Group not found"))?
            .remove();
        self.save()
    }

    /// Re-encrypts the database with a new password (and optionally a new key file).
    /// The old key is restored if the write fails.
    pub fn change_password(&mut self, new_password: &str, keyfile: Option<&[u8]>) -> Result<()> {
        validate_password(new_password)?;
        let new_key = build_key(new_password, keyfile)?;

        let old_key = std::mem::replace(&mut self.key, new_key);
        let old_uses_keyfile = std::mem::replace(&mut self.uses_keyfile, keyfile.is_some());
        if let Err(err) = self.save() {
            self.key = old_key;
            self.uses_keyfile = old_uses_keyfile;
            return Err(err);
        }
        Ok(())
    }
}

fn validate_password(password: &str) -> Result<()> {
    if password.chars().count() < MIN_PASSWORD_LEN {
        bail!("Password must be at least {MIN_PASSWORD_LEN} characters long");
    }
    Ok(())
}

fn build_key(password: &str, keyfile: Option<&[u8]>) -> Result<DatabaseKey> {
    let mut key = DatabaseKey::new().with_password(password);
    if let Some(data) = keyfile {
        key = key.with_keyfile(&mut Cursor::new(data))?;
    }
    Ok(key)
}

/// The crate's default KDF uses a lot of memory. This sets a lighter Argon2 profile
/// (64 MiB, 2 iterations), which is in line with what KeePass itself uses by default.
fn new_database_config() -> DatabaseConfig {
    let mut config = DatabaseConfig::default();
    if let KdfConfig::Argon2 {
        iterations,
        memory,
        parallelism,
        ..
    } = &mut config.kdf_config
    {
        *iterations = 2;
        *memory = 64 * 1024 * 1024;
        *parallelism = 2;
    }
    config
}

fn apply_fields(entry: &mut Entry, input: &EntryInput) {
    entry.set_unprotected("Title", input.title.as_str());
    entry.set_unprotected("UserName", input.username.as_str());
    entry.set_protected("Password", input.password.as_str());
    entry.set_unprotected("URL", input.url.as_str());
    entry.set_unprotected("Notes", input.notes.as_str());
}

fn field(entry: &Entry, key: &str) -> String {
    entry.get(key).unwrap_or_default().to_string()
}

fn timestamp(time: Option<NaiveDateTime>) -> String {
    time.map(|t| t.and_utc().to_rfc3339()).unwrap_or_default()
}

fn parse_entry_id(id: &str) -> Result<EntryId> {
    let uuid = Uuid::parse_str(id).map_err(|_| anyhow!("Invalid entry id"))?;
    Ok(EntryId::from_uuid(uuid))
}

fn parse_group_id(id: &str) -> Result<GroupId> {
    let uuid = Uuid::parse_str(id).map_err(|_| anyhow!("Invalid group id"))?;
    Ok(GroupId::from_uuid(uuid))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("kp-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir.join(format!("{name}.kdbx"))
    }

    fn input(group_id: &str, id: Option<&str>, title: &str, password: &str) -> EntryInput {
        EntryInput {
            id: id.map(str::to_string),
            group_id: group_id.to_string(),
            title: title.to_string(),
            username: "admin".to_string(),
            password: password.to_string(),
            url: "https://example.com".to_string(),
            notes: "note".to_string(),
        }
    }

    fn root_id(vault: &Vault) -> String {
        vault.db.root().id().uuid().to_string()
    }

    #[test]
    fn create_then_open_keeps_entries_on_disk() {
        let path = temp_path("roundtrip");
        let mut vault = Vault::create(&path, "correct horse", None).unwrap();
        let root = root_id(&vault);
        vault
            .save_entry(&input(&root, None, "Server", "s3cret-pass"))
            .unwrap();

        let reopened = Vault::open(&path, "correct horse", None).unwrap();
        let entries = reopened.entries();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Server");

        let full = reopened.entry(&entries[0].id).unwrap();
        assert_eq!(full.password, "s3cret-pass");
        assert_eq!(full.url, "https://example.com");
    }

    #[test]
    fn wrong_password_is_rejected() {
        let path = temp_path("wrong-pass");
        Vault::create(&path, "correct horse", None).unwrap();
        assert!(Vault::open(&path, "wrong horse!", None).is_err());
    }

    #[test]
    fn keyfile_is_required_when_it_was_used() {
        let path = temp_path("keyfile");
        let keyfile = b"some random key file contents".to_vec();
        Vault::create(&path, "correct horse", Some(&keyfile)).unwrap();

        assert!(Vault::open(&path, "correct horse", None).is_err());
        assert!(Vault::open(&path, "correct horse", Some(&keyfile)).is_ok());
    }

    #[test]
    fn short_password_is_rejected() {
        let path = temp_path("short");
        assert!(Vault::create(&path, "short", None).is_err());
        assert!(!path.exists());
    }

    #[test]
    fn update_moves_and_renames_entry() {
        let path = temp_path("update");
        let mut vault = Vault::create(&path, "correct horse", None).unwrap();
        let root = root_id(&vault);
        let group = vault.create_group(None, "Work").unwrap();
        let id = vault
            .save_entry(&input(&root, None, "Old", "first-password"))
            .unwrap();

        vault
            .save_entry(&input(&group, Some(&id), "New", "second-password"))
            .unwrap();

        let reopened = Vault::open(&path, "correct horse", None).unwrap();
        let entry = reopened.entry(&id).unwrap();
        assert_eq!(entry.title, "New");
        assert_eq!(entry.password, "second-password");
        assert_eq!(entry.group_id, group);
    }

    #[test]
    fn delete_entry_is_persisted() {
        let path = temp_path("delete");
        let mut vault = Vault::create(&path, "correct horse", None).unwrap();
        let root = root_id(&vault);
        let id = vault
            .save_entry(&input(&root, None, "Gone", "some-password"))
            .unwrap();

        vault.delete_entry(&id).unwrap();

        let reopened = Vault::open(&path, "correct horse", None).unwrap();
        assert!(reopened.entries().is_empty());
    }

    #[test]
    fn groups_can_be_created_and_deleted_but_not_root() {
        let path = temp_path("groups");
        let mut vault = Vault::create(&path, "correct horse", None).unwrap();
        let root = root_id(&vault);

        let child = vault.create_group(Some(&root), "Child").unwrap();
        let groups = vault.groups();
        let created = groups.iter().find(|g| g.id == child).unwrap();
        assert_eq!(created.parent_id.as_deref(), Some(root.as_str()));

        assert!(vault.delete_group(&root).is_err());
        vault.delete_group(&child).unwrap();
        assert!(Vault::open(&path, "correct horse", None)
            .unwrap()
            .groups()
            .iter()
            .all(|g| g.id != child));
    }

    #[test]
    fn change_password_replaces_the_key() {
        let path = temp_path("change");
        let mut vault = Vault::create(&path, "old password", None).unwrap();
        vault.change_password("new password", None).unwrap();

        assert!(Vault::open(&path, "old password", None).is_err());
        assert!(Vault::open(&path, "new password", None).is_ok());
    }

    #[test]
    fn save_keeps_previous_version_as_backup() {
        let path = temp_path("backup");
        let mut vault = Vault::create(&path, "correct horse", None).unwrap();
        let root = root_id(&vault);
        vault
            .save_entry(&input(&root, None, "Entry", "some-password"))
            .unwrap();
        assert!(path.with_extension("kdbx.bak").exists());
    }
}
