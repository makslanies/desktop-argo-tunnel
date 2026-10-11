use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// An opened vault, as shown to the frontend. The id is used for every later call.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct VaultInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub entry_count: usize,
    pub group_count: usize,
    pub uses_keyfile: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct VaultGroup {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
}

/// Entry as listed in the table. The password is not included; fetch it with `get_entry`.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct VaultEntrySummary {
    pub id: String,
    pub group_id: String,
    pub title: String,
    pub username: String,
    pub url: String,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct VaultEntry {
    pub id: String,
    pub group_id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: String,
    pub notes: String,
    pub modified_at: String,
}

/// Payload for creating or updating an entry. `id` is `None` for a new entry.
#[derive(Debug, Clone, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct EntryInput {
    pub id: Option<String>,
    pub group_id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: String,
    pub notes: String,
}
