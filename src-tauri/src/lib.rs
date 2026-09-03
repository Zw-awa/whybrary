use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[cfg(desktop)]
use tauri::{LogicalSize, Size};

const LATEST_SCHEMA_VERSION: i32 = 4;
const SMOKE_MODE_ENV: &str = "WHYBRARY_TAURI_SMOKE";
const APP_DATA_DIR_OVERRIDE_ENV: &str = "WHYBRARY_APP_DATA_DIR";

const PLUGIN_MANIFEST_FILE: &str = "whybrary-plugin.json";
const PLUGIN_MANIFEST_SCHEMA_VERSION: u64 = 1;
const PLUGIN_DIRECTORY_SETTING_KEY: &str = "pluginDirectory";
const DEFAULT_PLUGIN_DIRECTORY_NAME: &str = "plugins";
const SUPPORTED_PLUGIN_PERMISSIONS: [&str; 5] = [
    "workspace:read",
    "ui:panel",
    "commands:register",
    "settings:read",
    "settings:write",
];

/// Built-in plugin ids shipped with the app. Local installs must not shadow them.
const RESERVED_BUILT_IN_PLUGIN_IDS: [&str; 1] = ["why-review"];

const MIGRATION_1_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  viewport_x REAL NOT NULL,
  viewport_y REAL NOT NULL,
  viewport_zoom REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  label TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  FOREIGN KEY(space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  FOREIGN KEY(space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  text TEXT NOT NULL,
  completed INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(space_id) REFERENCES spaces(id) ON DELETE CASCADE
);
"#;

const MIGRATION_2_SQL: &str = r#"
INSERT INTO settings (key, value)
VALUES ('storageRevision', '0')
ON CONFLICT(key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_nodes_space_order
ON nodes(space_id, order_index);

CREATE INDEX IF NOT EXISTS idx_edges_space_order
ON edges(space_id, order_index);

CREATE INDEX IF NOT EXISTS idx_todos_space_order
ON todos(space_id, order_index);
"#;

const MIGRATION_3_SQL: &str = r#"
ALTER TABLE nodes ADD COLUMN category TEXT;
ALTER TABLE nodes ADD COLUMN color TEXT;
ALTER TABLE todos ADD COLUMN priority TEXT;
ALTER TABLE todos ADD COLUMN due_date TEXT;
"#;

const MIGRATION_4_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS plugin_install_state (
  plugin_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  directory TEXT NOT NULL,
  source TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  approved_permissions_json TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_plugin_install_state_directory
ON plugin_install_state(directory);
"#;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ViewportState {
    x: f64,
    y: f64,
    zoom: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct BrainNodePosition {
    x: f64,
    y: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct BrainNodeData {
    label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct BrainNode {
    id: String,
    position: BrainNodePosition,
    data: BrainNodeData,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct BrainEdge {
    id: String,
    source: String,
    target: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct TodoItem {
    id: String,
    text: String,
    completed: bool,
    created_at: String,
    updated_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    priority: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    due_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct Space {
    id: String,
    name: String,
    nodes: Vec<BrainNode>,
    edges: Vec<BrainEdge>,
    todos: Vec<TodoItem>,
    viewport: ViewportState,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct AppSnapshot {
    locale: String,
    theme: String,
    spaces: Vec<Space>,
    active_space_id: Option<String>,
    last_opened_at: String,
    has_seen_tutorial: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PersistedSettings {
    locale: String,
    theme: String,
    active_space_id: Option<String>,
    last_opened_at: String,
    has_seen_tutorial: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SpaceRecord {
    id: String,
    name: String,
    viewport: ViewportState,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(tag = "kind")]
enum WorkspaceMutation {
    #[serde(rename = "settings.patch")]
    SettingsPatch { settings: PersistedSettings },
    #[serde(rename = "space.upsert")]
    SpaceUpsert {
        space: SpaceRecord,
        #[serde(rename = "orderIndex")]
        order_index: i64,
    },
    #[serde(rename = "space.delete")]
    SpaceDelete {
        #[serde(rename = "spaceId")]
        space_id: String,
    },
    #[serde(rename = "node.upsert")]
    NodeUpsert {
        #[serde(rename = "spaceId")]
        space_id: String,
        node: BrainNode,
        #[serde(rename = "orderIndex")]
        order_index: i64,
    },
    #[serde(rename = "node.delete")]
    NodeDelete {
        #[serde(rename = "nodeId")]
        node_id: String,
    },
    #[serde(rename = "edge.upsert")]
    EdgeUpsert {
        #[serde(rename = "spaceId")]
        space_id: String,
        edge: BrainEdge,
        #[serde(rename = "orderIndex")]
        order_index: i64,
    },
    #[serde(rename = "edge.delete")]
    EdgeDelete {
        #[serde(rename = "edgeId")]
        edge_id: String,
    },
    #[serde(rename = "todo.upsert")]
    TodoUpsert {
        #[serde(rename = "spaceId")]
        space_id: String,
        todo: TodoItem,
        #[serde(rename = "orderIndex")]
        order_index: i64,
    },
    #[serde(rename = "todo.delete")]
    TodoDelete {
        #[serde(rename = "todoId")]
        todo_id: String,
    },
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct MutationBatch {
    expected_revision: i64,
    next_revision: i64,
    mutations: Vec<WorkspaceMutation>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct LoadedWorkspace {
    snapshot: AppSnapshot,
    revision: i64,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
struct SaveResult {
    revision: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SmokeReport {
    success: bool,
    db_path: String,
    schema_version: i32,
    error: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PluginDirectoryPath {
    path: String,
    is_default: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PluginManifestInfo {
    schema_version: u64,
    id: String,
    name: String,
    version: String,
    engine: String,
    entry: String,
    permissions: Vec<String>,
    directory: String,
    entry_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    state: Option<PluginInstallState>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PluginInstallState {
    plugin_id: String,
    version: String,
    directory: String,
    source: String,
    enabled: bool,
    approved_permissions: Vec<String>,
    installed_at: String,
    updated_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_error: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct InstallPluginResponse {
    plugin: PluginManifestInfo,
    state: PluginInstallState,
    replaced: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct UninstallPluginResponse {
    plugin_id: String,
    directory: String,
    removed: bool,
    state_removed: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PluginDiscoveryDiagnostic {
    path: String,
    code: String,
    message: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct DiscoverPluginsResponse {
    plugins: Vec<PluginManifestInfo>,
    diagnostics: Vec<PluginDiscoveryDiagnostic>,
}

#[derive(Debug, Clone, PartialEq)]
struct ValidatedManifest {
    schema_version: u64,
    id: String,
    name: String,
    version: String,
    engine: String,
    entry: String,
    permissions: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
struct ManifestIssue {
    code: &'static str,
    message: String,
}

fn manifest_issue(code: &'static str, message: impl Into<String>) -> ManifestIssue {
    ManifestIssue { code, message: message.into() }
}

/// Mirrors the frontend rule /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/ from src/plugins/manifest.ts.
fn is_valid_plugin_id(id: &str) -> bool {
    let mut expecting_alnum = true;
    for ch in id.chars() {
        match ch {
            'a'..='z' | '0'..='9' => expecting_alnum = false,
            '.' | '_' | '-' if !expecting_alnum => expecting_alnum = true,
            _ => return false,
        }
    }
    !expecting_alnum
}

/// Mirrors the frontend rule from src/plugins/manifest.ts: no leading slash
/// and no path segment equal to ".." when split on '/' or '\'.
fn is_safe_relative_entry(entry: &str) -> bool {
    if entry.starts_with('/') || entry.starts_with('\\') {
        return false;
    }
    !entry
        .split(|part| part == '/' || part == '\\')
        .any(|part| part == "..")
}

fn validate_plugin_manifest(value: &serde_json::Value) -> Result<ValidatedManifest, ManifestIssue> {
    let object = value
        .as_object()
        .ok_or_else(|| manifest_issue("manifest.invalid", "Plugin manifest must be a JSON object."))?;

    let schema_version = object.get("schemaVersion").and_then(|version| version.as_u64());
    if schema_version != Some(PLUGIN_MANIFEST_SCHEMA_VERSION) {
        return Err(manifest_issue(
            "manifest.schema-version",
            format!("Plugin manifest schemaVersion must be {PLUGIN_MANIFEST_SCHEMA_VERSION}."),
        ));
    }

    let id = object
        .get("id")
        .and_then(|raw| raw.as_str())
        .ok_or_else(|| manifest_issue("manifest.id", "Plugin manifest id must be a non-empty string."))?;
    if id.trim().is_empty() {
        return Err(manifest_issue("manifest.id", "Plugin manifest id must be a non-empty string."));
    }
    if !is_valid_plugin_id(id) {
        return Err(manifest_issue(
            "manifest.id",
            "Plugin manifest id must use lowercase letters, numbers, dots, dashes, or underscores.",
        ));
    }

    let name = object
        .get("name")
        .and_then(|raw| raw.as_str())
        .ok_or_else(|| manifest_issue("manifest.name", "Plugin manifest name must be a non-empty string."))?;
    if name.trim().is_empty() {
        return Err(manifest_issue("manifest.name", "Plugin manifest name must be a non-empty string."));
    }

    let version = object
        .get("version")
        .and_then(|raw| raw.as_str())
        .ok_or_else(|| manifest_issue("manifest.version", "Plugin manifest version must be a non-empty string."))?;
    if version.trim().is_empty() {
        return Err(manifest_issue("manifest.version", "Plugin manifest version must be a non-empty string."));
    }

    let engine = object
        .get("engine")
        .and_then(|raw| raw.as_str())
        .ok_or_else(|| manifest_issue("manifest.engine", "Plugin manifest engine must be a non-empty string."))?;
    if engine.trim().is_empty() {
        return Err(manifest_issue("manifest.engine", "Plugin manifest engine must be a non-empty string."));
    }

    let entry = object
        .get("entry")
        .and_then(|raw| raw.as_str())
        .ok_or_else(|| manifest_issue("manifest.entry", "Plugin manifest entry must be a non-empty string."))?;
    if entry.trim().is_empty() {
        return Err(manifest_issue("manifest.entry", "Plugin manifest entry must be a non-empty string."));
    }
    if !is_safe_relative_entry(entry) {
        return Err(manifest_issue("manifest.entry", "Plugin entry must remain inside the plugin directory."));
    }

    let permissions_value = object
        .get("permissions")
        .ok_or_else(|| manifest_issue("manifest.permissions", "Plugin manifest permissions must be an array."))?;
    let permissions = permissions_value
        .as_array()
        .ok_or_else(|| manifest_issue("manifest.permissions", "Plugin manifest permissions must be an array."))?;

    let mut validated_permissions = Vec::with_capacity(permissions.len());
    for permission in permissions {
        let permission = permission.as_str().ok_or_else(|| {
            manifest_issue("manifest.permissions", "Plugin manifest permissions must contain only strings.")
        })?;
        if !SUPPORTED_PLUGIN_PERMISSIONS.contains(&permission) {
            return Err(manifest_issue("manifest.permissions", "Plugin manifest requests an unsupported permission."));
        }
        if validated_permissions.contains(&permission.to_string()) {
            return Err(manifest_issue("manifest.permissions", "Plugin manifest permissions must not repeat values."));
        }
        validated_permissions.push(permission.to_string());
    }

    Ok(ValidatedManifest {
        schema_version: PLUGIN_MANIFEST_SCHEMA_VERSION,
        id: id.to_string(),
        name: name.to_string(),
        version: version.to_string(),
        engine: engine.to_string(),
        entry: entry.to_string(),
        permissions: validated_permissions,
    })
}

fn default_plugin_directory_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut directory = app_data_dir(app)?;
    directory.push(DEFAULT_PLUGIN_DIRECTORY_NAME);
    Ok(directory)
}

fn resolve_plugin_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let connection = open_connection(app)?;
    if let Some(configured) = load_setting(&connection, PLUGIN_DIRECTORY_SETTING_KEY)? {
        return Ok(PathBuf::from(configured));
    }
    default_plugin_directory_path(app)
}

fn load_and_validate_manifest(
    manifest_path: &Path,
    directory: &Path,
) -> Result<PluginManifestInfo, ManifestIssue> {
    let raw = fs::read_to_string(manifest_path).map_err(|error| {
        manifest_issue(
            "manifest.read",
            format!("Unable to read manifest '{}': {error}", manifest_path.display()),
        )
    })?;
    let value: serde_json::Value = serde_json::from_str(&raw).map_err(|error| {
        manifest_issue(
            "manifest.parse",
            format!("Manifest '{}' is not valid JSON: {error}", manifest_path.display()),
        )
    })?;
    let manifest = validate_plugin_manifest(&value)?;

    let entry_path = directory.join(&manifest.entry);
    let metadata = fs::metadata(&entry_path).map_err(|error| {
        manifest_issue(
            "manifest.entry",
            format!("Plugin entry '{}' is not readable: {error}", manifest.entry),
        )
    })?;
    if !metadata.is_file() {
        return Err(manifest_issue(
            "manifest.entry",
            format!("Plugin entry '{}' is not a regular file.", manifest.entry),
        ));
    }

    Ok(PluginManifestInfo {
        schema_version: manifest.schema_version,
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        engine: manifest.engine,
        entry: manifest.entry,
        permissions: manifest.permissions,
        directory: directory.display().to_string(),
        entry_path: entry_path.display().to_string(),
        state: None,
    })
}

fn discover_plugins_in_directory(directory: &Path) -> DiscoverPluginsResponse {
    let mut plugins = Vec::new();
    let mut diagnostics = Vec::new();

    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) => {
            diagnostics.push(PluginDiscoveryDiagnostic {
                path: directory.display().to_string(),
                code: "discovery.unreadable".to_string(),
                message: format!("Unable to read plugin directory '{}': {error}", directory.display()),
            });
            return DiscoverPluginsResponse { plugins, diagnostics };
        }
    };

    let mut candidates: Vec<PathBuf> = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                diagnostics.push(PluginDiscoveryDiagnostic {
                    path: directory.display().to_string(),
                    code: "discovery.entry".to_string(),
                    message: format!("Unable to inspect plugin directory entry: {error}"),
                });
                continue;
            }
        };
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(error) => {
                diagnostics.push(PluginDiscoveryDiagnostic {
                    path: entry.path().display().to_string(),
                    code: "discovery.entry".to_string(),
                    message: format!("Unable to inspect entry type: {error}"),
                });
                continue;
            }
        };
        if !file_type.is_dir() {
            continue;
        }
        candidates.push(entry.path());
    }

    candidates.sort();

    for candidate in candidates {
        let manifest_path = candidate.join(PLUGIN_MANIFEST_FILE);
        if !manifest_path.is_file() {
            continue;
        }
        match load_and_validate_manifest(&manifest_path, &candidate) {
            Ok(plugin) => plugins.push(plugin),
            Err(issue) => diagnostics.push(PluginDiscoveryDiagnostic {
                path: manifest_path.display().to_string(),
                code: issue.code.to_string(),
                message: issue.message,
            }),
        }
    }

    plugins.sort_by(|a, b| a.id.cmp(&b.id));
    diagnostics.sort_by(|a, b| a.path.cmp(&b.path).then_with(|| a.code.cmp(&b.code)));

    DiscoverPluginsResponse { plugins, diagnostics }
}

/// Attaches persisted install state to each discovered plugin, keyed by plugin id.
fn merge_installed_state(
    mut response: DiscoverPluginsResponse,
    states: Vec<PluginInstallState>,
) -> DiscoverPluginsResponse {
    let mut by_id = std::collections::HashMap::new();
    for state in states {
        by_id.insert(state.plugin_id.clone(), state);
    }
    for plugin in &mut response.plugins {
        plugin.state = by_id.remove(&plugin.id);
    }
    response
}

fn load_installed_plugin(
    connection: &Connection,
    plugin_id: &str,
) -> Result<Option<PluginInstallState>, String> {
    let row = connection
        .query_row(
            "SELECT plugin_id, version, directory, source, enabled, approved_permissions_json,
                    installed_at, updated_at, last_error
             FROM plugin_install_state
             WHERE plugin_id = ?1",
            [plugin_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)? != 0,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, Option<String>>(8)?,
                ))
            },
        )
        .optional()
        .map_err(|error| format!("Unable to load installed plugin '{plugin_id}': {error}"))?;

    let Some((
        plugin_id,
        version,
        directory,
        source,
        enabled,
        approved_permissions_json,
        installed_at,
        updated_at,
        last_error,
    )) = row
    else {
        return Ok(None);
    };

    let approved_permissions: Vec<String> = serde_json::from_str(&approved_permissions_json)
        .map_err(|error| {
            format!(
                "Unable to parse approved permissions for installed plugin '{plugin_id}': {error}"
            )
        })?;

    Ok(Some(PluginInstallState {
        plugin_id,
        version,
        directory,
        source,
        enabled,
        approved_permissions,
        installed_at,
        updated_at,
        last_error,
    }))
}

fn load_all_installed_plugins(connection: &Connection) -> Result<Vec<PluginInstallState>, String> {
    let mut statement = connection
        .prepare(
            "SELECT plugin_id, version, directory, source, enabled, approved_permissions_json,
                    installed_at, updated_at, last_error
             FROM plugin_install_state
             ORDER BY plugin_id ASC",
        )
        .map_err(|error| format!("Unable to prepare installed plugin query: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)? != 0,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, Option<String>>(8)?,
            ))
        })
        .map_err(|error| format!("Unable to query installed plugins: {error}"))?;

    let mut states = Vec::new();
    for row in rows {
        let (
            plugin_id,
            version,
            directory,
            source,
            enabled,
            approved_permissions_json,
            installed_at,
            updated_at,
            last_error,
        ) = row.map_err(|error| format!("Unable to read installed plugin row: {error}"))?;

        let approved_permissions: Vec<String> = serde_json::from_str(&approved_permissions_json)
            .map_err(|error| {
                format!(
                    "Unable to parse approved permissions for installed plugin '{plugin_id}': {error}"
                )
            })?;

        states.push(PluginInstallState {
            plugin_id,
            version,
            directory,
            source,
            enabled,
            approved_permissions,
            installed_at,
            updated_at,
            last_error,
        });
    }

    Ok(states)
}

fn upsert_installed_plugin(
    connection: &Connection,
    state: &PluginInstallState,
) -> Result<(), String> {
    let approved_permissions_json = serde_json::to_string(&state.approved_permissions)
        .map_err(|error| format!("Unable to serialize approved permissions: {error}"))?;

    connection
        .execute(
            "INSERT INTO plugin_install_state (
               plugin_id, version, directory, source, enabled, approved_permissions_json,
               installed_at, updated_at, last_error
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(plugin_id) DO UPDATE SET
               version = excluded.version,
               directory = excluded.directory,
               source = excluded.source,
               enabled = excluded.enabled,
               approved_permissions_json = excluded.approved_permissions_json,
               installed_at = excluded.installed_at,
               updated_at = excluded.updated_at,
               last_error = excluded.last_error",
            params![
                state.plugin_id,
                state.version,
                state.directory,
                state.source,
                if state.enabled { 1 } else { 0 },
                approved_permissions_json,
                state.installed_at,
                state.updated_at,
                state.last_error,
            ],
        )
        .map_err(|error| {
            format!(
                "Unable to upsert installed plugin '{}': {error}",
                state.plugin_id
            )
        })?;

    Ok(())
}

fn delete_installed_plugin(connection: &Connection, plugin_id: &str) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM plugin_install_state WHERE plugin_id = ?1",
            [plugin_id],
        )
        .map_err(|error| format!("Unable to delete installed plugin '{plugin_id}': {error}"))?;
    Ok(())
}

/// Format the current time as a UTC ISO-8601 timestamp with milliseconds, e.g.
/// "2026-01-01T00:00:00.000Z", matching the timestamps used elsewhere in the app.
fn iso_timestamp_now() -> String {
    let duration = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let total_seconds = duration.as_secs() as i64;
    let millis = duration.subsec_millis();
    let days = total_seconds.div_euclid(86_400);
    let seconds_of_day = total_seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);

    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        seconds_of_day / 3600,
        (seconds_of_day % 3600) / 60,
        seconds_of_day % 60,
    )
}

/// Convert days since the Unix epoch into a (year, month, day) civil date.
/// Public-domain algorithm by Howard Hinnant.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * month_prime + 2) / 5 + 1) as u32;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    } as u32;
    (if month <= 2 { year + 1 } else { year }, month, day)
}

/// Recursively copies `source` into `destination`, rejecting symbolic links so a
/// plugin cannot smuggle a link that points outside its own directory.
fn copy_dir_recursively(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|error| {
        format!(
            "Unable to create staging directory '{}': {error}",
            destination.display()
        )
    })?;

    let entries = fs::read_dir(source).map_err(|error| {
        format!(
            "Unable to read plugin source '{}': {error}",
            source.display()
        )
    })?;

    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Unable to inspect plugin source entry: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Unable to inspect plugin source entry type: {error}"))?;
        let target = destination.join(entry.file_name());

        if file_type.is_symlink() {
            return Err(format!(
                "Plugin source '{}' contains a symbolic link '{}', which is not allowed.",
                source.display(),
                entry.path().display()
            ));
        }
        if file_type.is_dir() {
            copy_dir_recursively(&entry.path(), &target)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), &target).map_err(|error| {
                format!(
                    "Unable to copy '{}' into staging: {error}",
                    entry.path().display()
                )
            })?;
        }
    }

    Ok(())
}

/// Guards against installing a plugin anywhere outside `plugin_directory`.
fn ensure_plugin_target_within(
    plugin_directory: &Path,
    target: &Path,
    plugin_id: &str,
) -> Result<(), String> {
    let Some(parent) = target.parent() else {
        return Err("Plugin target has no parent directory.".to_string());
    };
    if parent != plugin_directory {
        return Err(format!(
            "Refusing to touch plugin outside the configured plugin directory: '{}'.",
            target.display()
        ));
    }
    if target.file_name().and_then(|name| name.to_str()) != Some(plugin_id) {
        return Err(format!(
            "Refusing to touch plugin with mismatched target name: '{}'.",
            target.display()
        ));
    }
    Ok(())
}

fn remove_existing_path(target: &Path) -> Result<(), String> {
    if target.is_dir() {
        fs::remove_dir_all(target)
            .map_err(|error| format!("Unable to remove directory '{}': {error}", target.display()))
    } else if target.exists() {
        fs::remove_file(target)
            .map_err(|error| format!("Unable to remove file '{}': {error}", target.display()))
    } else {
        Ok(())
    }
}

fn install_plugin_core(
    source_path: &Path,
    plugin_directory: &Path,
    connection: &Connection,
) -> Result<InstallPluginResponse, String> {
    let source_metadata = fs::metadata(source_path).map_err(|error| {
        format!(
            "Unable to read plugin source '{}': {error}",
            source_path.display()
        )
    })?;
    if !source_metadata.is_dir() {
        return Err(format!(
            "Plugin source '{}' must be a directory.",
            source_path.display()
        ));
    }

    let source_manifest_path = source_path.join(PLUGIN_MANIFEST_FILE);
    let validated = load_and_validate_manifest(&source_manifest_path, source_path)
        .map_err(|issue| format!("{}: {}", issue.code, issue.message))?;

    if RESERVED_BUILT_IN_PLUGIN_IDS.contains(&validated.id.as_str()) {
        return Err(format!(
            "Plugin id '{}' is reserved for a built-in plugin and cannot be installed.",
            validated.id
        ));
    }

    fs::create_dir_all(plugin_directory).map_err(|error| {
        format!(
            "Unable to create plugin directory '{}': {error}",
            plugin_directory.display()
        )
    })?;

    let target = plugin_directory.join(&validated.id);
    ensure_plugin_target_within(plugin_directory, &target, &validated.id)?;

    let staging_root = plugin_directory.join(".staging");
    let staging = staging_root.join(format!(
        "{}-{}-{}",
        validated.id,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0)
    ));

    let cleanup_staging = || -> Result<(), String> {
        match fs::remove_dir_all(&staging) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!(
                "Unable to clean up staging directory '{}': {error}",
                staging.display()
            )),
        }
    };

    copy_dir_recursively(source_path, &staging).map_err(|error| {
        let _ = cleanup_staging();
        error
    })?;

    let staged = match load_and_validate_manifest(&staging.join(PLUGIN_MANIFEST_FILE), &staging) {
        Ok(staged) => staged,
        Err(error) => {
            let _ = cleanup_staging();
            return Err(format!(
                "Installed copy failed validation ({}): {}",
                error.code, error.message
            ));
        }
    };
    if staged.id != validated.id {
        let _ = cleanup_staging();
        return Err(format!(
            "Installed copy manifest id '{}' does not match source id '{}'.",
            staged.id, validated.id
        ));
    }

    let replaced = target.exists();
    if replaced {
        remove_existing_path(&target).map_err(|error| {
            let _ = cleanup_staging();
            format!(
                "Unable to replace existing plugin '{}': {error}",
                target.display()
            )
        })?;
    }

    fs::rename(&staging, &target).map_err(|error| {
        let _ = cleanup_staging();
        format!(
            "Unable to move staged plugin into '{}': {error}",
            target.display()
        )
    })?;

    let now = iso_timestamp_now();
    let state = PluginInstallState {
        plugin_id: staged.id.clone(),
        version: staged.version.clone(),
        directory: target.display().to_string(),
        source: "local".to_string(),
        enabled: true,
        approved_permissions: staged.permissions.clone(),
        installed_at: now.clone(),
        updated_at: now,
        last_error: None,
    };
    upsert_installed_plugin(connection, &state)?;

    let directory = target.display().to_string();
    let entry_path = target.join(&staged.entry).display().to_string();
    let plugin = PluginManifestInfo {
        schema_version: staged.schema_version,
        id: staged.id,
        name: staged.name,
        version: staged.version,
        engine: staged.engine,
        entry: staged.entry,
        permissions: staged.permissions,
        directory,
        entry_path,
        state: None,
    };

    Ok(InstallPluginResponse {
        plugin,
        state,
        replaced,
    })
}

fn uninstall_plugin_core(
    plugin_id: &str,
    plugin_directory: &Path,
    connection: &Connection,
) -> Result<UninstallPluginResponse, String> {
    if !is_valid_plugin_id(plugin_id) {
        return Err(format!("Invalid plugin id '{plugin_id}'."));
    }

    let state = load_installed_plugin(connection, plugin_id)?;
    let target = match &state {
        Some(state) => PathBuf::from(&state.directory),
        None => plugin_directory.join(plugin_id),
    };

    ensure_plugin_target_within(plugin_directory, &target, plugin_id)?;
    if target == plugin_directory {
        return Err("Refusing to remove the plugin directory itself.".to_string());
    }

    let existed = target.exists();
    let removed = match remove_existing_path(&target) {
        Ok(()) => existed,
        Err(error) => {
            return Err(format!(
                "Unable to remove plugin directory '{}': {error}",
                target.display()
            ))
        }
    };

    let state_removed = state.is_some();
    if state_removed {
        delete_installed_plugin(connection, plugin_id)?;
    }

    Ok(UninstallPluginResponse {
        plugin_id: plugin_id.to_string(),
        directory: target.display().to_string(),
        removed,
        state_removed,
    })
}

fn configure_connection(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|error| format!("Unable to configure SQLite connection: {error}"))
}

fn load_schema_version(connection: &Connection) -> Result<i32, String> {
    connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|error| format!("Unable to read SQLite schema version: {error}"))
}

fn set_schema_version(connection: &Connection, version: i32) -> Result<(), String> {
    connection
        .pragma_update(None, "user_version", version)
        .map_err(|error| format!("Unable to update SQLite schema version to {version}: {error}"))
}

fn migrate_to_v1(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(MIGRATION_1_SQL)
        .map_err(|error| format!("Unable to apply SQLite migration 0 -> 1: {error}"))?;
    set_schema_version(connection, 1)
}

fn migrate_to_v2(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(MIGRATION_2_SQL)
        .map_err(|error| format!("Unable to apply SQLite migration 1 -> 2: {error}"))?;
    set_schema_version(connection, 2)
}

fn migrate_to_v3(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(MIGRATION_3_SQL)
        .map_err(|error| format!("Unable to apply SQLite migration 2 -> 3: {error}"))?;
    set_schema_version(connection, 3)
}

fn migrate_to_v4(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(MIGRATION_4_SQL)
        .map_err(|error| format!("Unable to apply SQLite migration 3 -> 4: {error}"))?;
    set_schema_version(connection, 4)
}

fn run_migrations(connection: &Connection) -> Result<(), String> {
    let mut version = load_schema_version(connection)?;
    if version > LATEST_SCHEMA_VERSION {
        return Err(format!(
            "SQLite schema version {version} is newer than this build supports ({LATEST_SCHEMA_VERSION})."
        ));
    }

    while version < LATEST_SCHEMA_VERSION {
        match version {
            0 => migrate_to_v1(connection)?,
            1 => migrate_to_v2(connection)?,
            2 => migrate_to_v3(connection)?,
            3 => migrate_to_v4(connection)?,
            _ => {
                return Err(format!(
                    "No SQLite migration path from version {version} to {LATEST_SCHEMA_VERSION}."
                ))
            }
        }

        version = load_schema_version(connection)?;
    }

    Ok(())
}

fn prepare_connection(connection: &Connection) -> Result<(), String> {
    configure_connection(connection)?;
    run_migrations(connection)
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(override_dir) = std::env::var_os(APP_DATA_DIR_OVERRIDE_ENV) {
        let app_data_dir = PathBuf::from(override_dir);
        fs::create_dir_all(&app_data_dir)
            .map_err(|error| format!("Unable to create overridden app data directory: {error}"))?;
        return Ok(app_data_dir);
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("Unable to create app data directory: {error}"))?;

    Ok(app_data_dir)
}

fn app_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut db_path = app_data_dir(app)?;

    db_path.push("whybrary.sqlite3");
    Ok(db_path)
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let db_path = app_db_path(app)?;
    let connection = Connection::open(db_path).map_err(|error| format!("Unable to open SQLite: {error}"))?;

    prepare_connection(&connection)?;

    Ok(connection)
}

fn load_setting(connection: &Connection, key: &str) -> Result<Option<String>, String> {
    connection
        .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| row.get(0))
        .optional()
        .map_err(|error| format!("Unable to load setting '{key}': {error}"))
}

fn load_storage_revision(connection: &Connection) -> Result<i64, String> {
    let raw = load_setting(connection, "storageRevision")?.unwrap_or_else(|| "0".to_string());
    raw.parse::<i64>()
        .map_err(|error| format!("Invalid SQLite storage revision '{raw}': {error}"))
}

fn upsert_setting(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|error| format!("Unable to save setting '{key}': {error}"))?;
    Ok(())
}

fn load_nodes(connection: &Connection, space_id: &str) -> Result<Vec<BrainNode>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, label, position_x, position_y, category, color
             FROM nodes
             WHERE space_id = ?1
             ORDER BY order_index ASC",
        )
        .map_err(|error| format!("Unable to prepare node query: {error}"))?;

    let rows = statement
        .query_map([space_id], |row| {
            Ok(BrainNode {
                id: row.get(0)?,
                position: BrainNodePosition {
                    x: row.get(2)?,
                    y: row.get(3)?,
                },
                data: BrainNodeData { label: row.get(1)?, category: row.get(4)?, color: row.get(5)? },
            })
        })
        .map_err(|error| format!("Unable to query nodes: {error}"))?;

    let mut nodes = Vec::new();
    for row in rows {
        nodes.push(row.map_err(|error| format!("Unable to read node row: {error}"))?);
    }

    Ok(nodes)
}

fn load_edges(connection: &Connection, space_id: &str) -> Result<Vec<BrainEdge>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, source, target
             FROM edges
             WHERE space_id = ?1
             ORDER BY order_index ASC",
        )
        .map_err(|error| format!("Unable to prepare edge query: {error}"))?;

    let rows = statement
        .query_map([space_id], |row| {
            Ok(BrainEdge {
                id: row.get(0)?,
                source: row.get(1)?,
                target: row.get(2)?,
            })
        })
        .map_err(|error| format!("Unable to query edges: {error}"))?;

    let mut edges = Vec::new();
    for row in rows {
        edges.push(row.map_err(|error| format!("Unable to read edge row: {error}"))?);
    }

    Ok(edges)
}

fn load_todos(connection: &Connection, space_id: &str) -> Result<Vec<TodoItem>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, text, completed, created_at, updated_at, priority, due_date
             FROM todos
             WHERE space_id = ?1
             ORDER BY order_index ASC",
        )
        .map_err(|error| format!("Unable to prepare todo query: {error}"))?;

    let rows = statement
        .query_map([space_id], |row| {
            Ok(TodoItem {
                id: row.get(0)?,
                text: row.get(1)?,
                completed: row.get::<_, i64>(2)? != 0,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                priority: row.get(5)?,
                due_date: row.get(6)?,
            })
        })
        .map_err(|error| format!("Unable to query todos: {error}"))?;

    let mut todos = Vec::new();
    for row in rows {
        todos.push(row.map_err(|error| format!("Unable to read todo row: {error}"))?);
    }

    Ok(todos)
}

fn load_snapshot_from_connection(connection: &Connection) -> Result<AppSnapshot, String> {
    let locale = load_setting(&connection, "locale")?.unwrap_or_else(|| "en".to_string());
    let theme = load_setting(&connection, "theme")?.unwrap_or_else(|| "dark".to_string());
    let active_space_id = load_setting(&connection, "activeSpaceId")?;
    let last_opened_at = load_setting(&connection, "lastOpenedAt")?.unwrap_or_default();

    let space_rows = {
        let mut statement = connection
            .prepare(
                "SELECT id, name, viewport_x, viewport_y, viewport_zoom, created_at, updated_at
                 FROM spaces
                 ORDER BY order_index ASC",
            )
            .map_err(|error| format!("Unable to prepare space query: {error}"))?;

        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            })
            .map_err(|error| format!("Unable to query spaces: {error}"))?;

        let mut collected = Vec::new();
        for row in rows {
            collected.push(row.map_err(|error| format!("Unable to read space row: {error}"))?);
        }
        collected
    };

    let mut spaces = Vec::new();
    for (space_id, name, viewport_x, viewport_y, viewport_zoom, created_at, updated_at) in space_rows {
        spaces.push(Space {
            id: space_id.clone(),
            name,
            nodes: load_nodes(&connection, &space_id)?,
            edges: load_edges(&connection, &space_id)?,
            todos: load_todos(&connection, &space_id)?,
            viewport: ViewportState {
                x: viewport_x,
                y: viewport_y,
                zoom: viewport_zoom,
            },
            created_at,
            updated_at,
        });
    }

    Ok(AppSnapshot {
        locale,
        theme,
        spaces,
        active_space_id,
        last_opened_at,
        has_seen_tutorial: load_setting(&connection, "hasSeenTutorial")?
            .map(|value| value == "true")
            .unwrap_or(true),
    })
}

fn replace_snapshot_to_connection(
    connection: &mut Connection,
    snapshot: &AppSnapshot,
    revision: i64,
) -> Result<(), String> {
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Unable to open SQLite transaction: {error}"))?;

    transaction
        .execute("DELETE FROM edges", [])
        .map_err(|error| format!("Unable to clear edges: {error}"))?;
    transaction
        .execute("DELETE FROM nodes", [])
        .map_err(|error| format!("Unable to clear nodes: {error}"))?;
    transaction
        .execute("DELETE FROM todos", [])
        .map_err(|error| format!("Unable to clear todos: {error}"))?;
    transaction
        .execute("DELETE FROM spaces", [])
        .map_err(|error| format!("Unable to clear spaces: {error}"))?;
    transaction
        .execute("DELETE FROM settings", [])
        .map_err(|error| format!("Unable to clear settings: {error}"))?;

    transaction
        .execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params!["locale", &snapshot.locale],
        )
        .map_err(|error| format!("Unable to save locale setting: {error}"))?;

    transaction
        .execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params!["theme", &snapshot.theme],
        )
        .map_err(|error| format!("Unable to save theme setting: {error}"))?;

    if let Some(active_space_id) = &snapshot.active_space_id {
        transaction
            .execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                params!["activeSpaceId", active_space_id],
            )
            .map_err(|error| format!("Unable to save active space setting: {error}"))?;
    }

    transaction
        .execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params!["lastOpenedAt", &snapshot.last_opened_at],
        )
        .map_err(|error| format!("Unable to save last opened setting: {error}"))?;

    transaction
        .execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params![
                "hasSeenTutorial",
                if snapshot.has_seen_tutorial { "true" } else { "false" }
            ],
        )
        .map_err(|error| format!("Unable to save tutorial setting: {error}"))?;

    transaction
        .execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params!["storageRevision", revision.to_string()],
        )
        .map_err(|error| format!("Unable to save storage revision: {error}"))?;

    for (space_index, space) in snapshot.spaces.iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO spaces (
                  id, name, order_index, viewport_x, viewport_y, viewport_zoom, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    space.id,
                    space.name,
                    space_index as i64,
                    space.viewport.x,
                    space.viewport.y,
                    space.viewport.zoom,
                    space.created_at,
                    space.updated_at
                ],
            )
            .map_err(|error| format!("Unable to save space '{}': {error}", space.name))?;

        for (node_index, node) in space.nodes.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO nodes (
                      id, space_id, label, order_index, position_x, position_y, category, color
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        node.id,
                        space.id,
                        node.data.label,
                        node_index as i64,
                        node.position.x,
                        node.position.y,
                        node.data.category,
                        node.data.color
                    ],
                )
                .map_err(|error| format!("Unable to save node '{}': {error}", node.id))?;
        }

        for (edge_index, edge) in space.edges.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO edges (
                      id, space_id, source, target, order_index
                     ) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        edge.id,
                        space.id,
                        edge.source,
                        edge.target,
                        edge_index as i64
                    ],
                )
                .map_err(|error| format!("Unable to save edge '{}': {error}", edge.id))?;
        }

        for (todo_index, todo) in space.todos.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO todos (
                      id, space_id, text, completed, order_index, created_at, updated_at, priority, due_date
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        todo.id,
                        space.id,
                        todo.text,
                        if todo.completed { 1 } else { 0 },
                        todo_index as i64,
                        todo.created_at,
                        todo.updated_at,
                        todo.priority,
                        todo.due_date
                    ],
                )
                .map_err(|error| format!("Unable to save todo '{}': {error}", todo.id))?;
        }
    }

    transaction
        .commit()
        .map_err(|error| format!("Unable to commit SQLite transaction: {error}"))?;

    Ok(())
}

fn save_snapshot_to_connection(connection: &mut Connection, snapshot: &AppSnapshot) -> Result<(), String> {
    let revision = load_storage_revision(connection)?;
    replace_snapshot_to_connection(connection, snapshot, revision)
}

fn load_workspace_from_connection(connection: &Connection) -> Result<LoadedWorkspace, String> {
    Ok(LoadedWorkspace {
        snapshot: load_snapshot_from_connection(connection)?,
        revision: load_storage_revision(connection)?,
    })
}

fn apply_mutations_to_connection(
    connection: &mut Connection,
    batch: &MutationBatch,
) -> Result<SaveResult, String> {
    let current_revision = load_storage_revision(connection)?;
    if current_revision != batch.expected_revision {
        return Err(format!(
            "SQLite revision conflict: expected {}, found {current_revision}.",
            batch.expected_revision
        ));
    }
    if batch.next_revision != batch.expected_revision + 1 {
        return Err(format!(
            "Invalid next SQLite revision {} for expected revision {}.",
            batch.next_revision, batch.expected_revision
        ));
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Unable to open SQLite mutation transaction: {error}"))?;

    for mutation in &batch.mutations {
        match mutation {
            WorkspaceMutation::SettingsPatch { settings } => {
                upsert_setting(&transaction, "locale", &settings.locale)?;
                upsert_setting(&transaction, "theme", &settings.theme)?;
                upsert_setting(&transaction, "lastOpenedAt", &settings.last_opened_at)?;
                upsert_setting(
                    &transaction,
                    "hasSeenTutorial",
                    if settings.has_seen_tutorial { "true" } else { "false" },
                )?;
                if let Some(active_space_id) = &settings.active_space_id {
                    upsert_setting(&transaction, "activeSpaceId", active_space_id)?;
                } else {
                    transaction
                        .execute("DELETE FROM settings WHERE key = 'activeSpaceId'", [])
                        .map_err(|error| format!("Unable to clear active space setting: {error}"))?;
                }
            }
            WorkspaceMutation::SpaceUpsert { space, order_index } => {
                transaction
                    .execute(
                        "INSERT INTO spaces (
                          id, name, order_index, viewport_x, viewport_y, viewport_zoom, created_at, updated_at
                         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                         ON CONFLICT(id) DO UPDATE SET
                           name = excluded.name,
                           order_index = excluded.order_index,
                           viewport_x = excluded.viewport_x,
                           viewport_y = excluded.viewport_y,
                           viewport_zoom = excluded.viewport_zoom,
                           created_at = excluded.created_at,
                           updated_at = excluded.updated_at",
                        params![
                            space.id,
                            space.name,
                            order_index,
                            space.viewport.x,
                            space.viewport.y,
                            space.viewport.zoom,
                            space.created_at,
                            space.updated_at
                        ],
                    )
                    .map_err(|error| format!("Unable to upsert space '{}': {error}", space.id))?;
            }
            WorkspaceMutation::SpaceDelete { space_id } => {
                transaction
                    .execute("DELETE FROM spaces WHERE id = ?1", [space_id])
                    .map_err(|error| format!("Unable to delete space '{space_id}': {error}"))?;
            }
            WorkspaceMutation::NodeUpsert { space_id, node, order_index } => {
                transaction
                    .execute(
                        "INSERT INTO nodes (id, space_id, label, order_index, position_x, position_y, category, color)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                         ON CONFLICT(id) DO UPDATE SET
                           space_id = excluded.space_id,
                           label = excluded.label,
                           order_index = excluded.order_index,
                           position_x = excluded.position_x,
                           position_y = excluded.position_y,
                           category = excluded.category,
                           color = excluded.color",
                        params![
                            node.id,
                            space_id,
                            node.data.label,
                            order_index,
                            node.position.x,
                            node.position.y,
                            node.data.category,
                            node.data.color
                        ],
                    )
                    .map_err(|error| format!("Unable to upsert node '{}': {error}", node.id))?;
            }
            WorkspaceMutation::NodeDelete { node_id } => {
                transaction
                    .execute("DELETE FROM edges WHERE source = ?1 OR target = ?1", [node_id])
                    .map_err(|error| format!("Unable to delete links for node '{node_id}': {error}"))?;
                transaction
                    .execute("DELETE FROM nodes WHERE id = ?1", [node_id])
                    .map_err(|error| format!("Unable to delete node '{node_id}': {error}"))?;
            }
            WorkspaceMutation::EdgeUpsert { space_id, edge, order_index } => {
                transaction
                    .execute(
                        "INSERT INTO edges (id, space_id, source, target, order_index)
                         VALUES (?1, ?2, ?3, ?4, ?5)
                         ON CONFLICT(id) DO UPDATE SET
                           space_id = excluded.space_id,
                           source = excluded.source,
                           target = excluded.target,
                           order_index = excluded.order_index",
                        params![edge.id, space_id, edge.source, edge.target, order_index],
                    )
                    .map_err(|error| format!("Unable to upsert edge '{}': {error}", edge.id))?;
            }
            WorkspaceMutation::EdgeDelete { edge_id } => {
                transaction
                    .execute("DELETE FROM edges WHERE id = ?1", [edge_id])
                    .map_err(|error| format!("Unable to delete edge '{edge_id}': {error}"))?;
            }
            WorkspaceMutation::TodoUpsert { space_id, todo, order_index } => {
                transaction
                    .execute(
                        "INSERT INTO todos (
                          id, space_id, text, completed, order_index, created_at, updated_at, priority, due_date
                         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                         ON CONFLICT(id) DO UPDATE SET
                           space_id = excluded.space_id,
                           text = excluded.text,
                           completed = excluded.completed,
                           order_index = excluded.order_index,
                           created_at = excluded.created_at,
                           updated_at = excluded.updated_at,
                           priority = excluded.priority,
                           due_date = excluded.due_date",
                        params![
                            todo.id,
                            space_id,
                            todo.text,
                            if todo.completed { 1 } else { 0 },
                            order_index,
                            todo.created_at,
                            todo.updated_at,
                            todo.priority,
                            todo.due_date
                        ],
                    )
                    .map_err(|error| format!("Unable to upsert todo '{}': {error}", todo.id))?;
            }
            WorkspaceMutation::TodoDelete { todo_id } => {
                transaction
                    .execute("DELETE FROM todos WHERE id = ?1", [todo_id])
                    .map_err(|error| format!("Unable to delete todo '{todo_id}': {error}"))?;
            }
        }
    }

    let dangling_edges: i64 = transaction
        .query_row(
            "SELECT COUNT(*)
             FROM edges e
             LEFT JOIN nodes source ON source.id = e.source AND source.space_id = e.space_id
             LEFT JOIN nodes target ON target.id = e.target AND target.space_id = e.space_id
             WHERE source.id IS NULL OR target.id IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("Unable to validate edge endpoints: {error}"))?;
    if dangling_edges > 0 {
        return Err(format!("Mutation batch would leave {dangling_edges} dangling edge(s)."));
    }

    if let Some(active_space_id) = load_setting(&transaction, "activeSpaceId")? {
        let active_exists: i64 = transaction
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM spaces WHERE id = ?1)",
                [active_space_id],
                |row| row.get(0),
            )
            .map_err(|error| format!("Unable to validate active space: {error}"))?;
        if active_exists == 0 {
            return Err("Mutation batch references an active space that does not exist.".to_string());
        }
    }

    upsert_setting(&transaction, "storageRevision", &batch.next_revision.to_string())?;
    transaction
        .commit()
        .map_err(|error| format!("Unable to commit SQLite mutation transaction: {error}"))?;

    Ok(SaveResult { revision: batch.next_revision })
}

#[tauri::command]
fn load_snapshot(app: AppHandle) -> Result<AppSnapshot, String> {
    let connection = open_connection(&app)?;
    load_snapshot_from_connection(&connection)
}

#[tauri::command]
fn save_snapshot(app: AppHandle, snapshot: AppSnapshot) -> Result<(), String> {
    let mut connection = open_connection(&app)?;
    save_snapshot_to_connection(&mut connection, &snapshot)
}

#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<LoadedWorkspace, String> {
    let connection = open_connection(&app)?;
    load_workspace_from_connection(&connection)
}

#[tauri::command]
fn apply_mutations(app: AppHandle, batch: MutationBatch) -> Result<SaveResult, String> {
    let mut connection = open_connection(&app)?;
    apply_mutations_to_connection(&mut connection, &batch)
}

#[tauri::command]
fn replace_workspace(app: AppHandle, snapshot: AppSnapshot, revision: i64) -> Result<SaveResult, String> {
    let mut connection = open_connection(&app)?;
    let current_revision = load_storage_revision(&connection)?;
    if revision != current_revision + 1 {
        return Err(format!(
            "SQLite revision conflict while replacing workspace: expected {}, received {revision}.",
            current_revision + 1
        ));
    }
    replace_snapshot_to_connection(&mut connection, &snapshot, revision)?;
    Ok(SaveResult { revision })
}

#[tauri::command]
fn default_plugin_directory(app: AppHandle) -> Result<PluginDirectoryPath, String> {
    Ok(PluginDirectoryPath {
      path: default_plugin_directory_path(&app)?.display().to_string(),
      is_default: true,
    })
}

#[tauri::command]
fn get_plugin_directory(app: AppHandle) -> Result<PluginDirectoryPath, String> {
    let connection = open_connection(&app)?;
    if let Some(configured) = load_setting(&connection, PLUGIN_DIRECTORY_SETTING_KEY)? {
        return Ok(PluginDirectoryPath {
            path: configured,
            is_default: false,
        });
    }
    Ok(PluginDirectoryPath {
        path: default_plugin_directory_path(&app)?.display().to_string(),
        is_default: true,
    })
}

#[tauri::command]
fn set_plugin_directory(app: AppHandle, path: Option<String>) -> Result<PluginDirectoryPath, String> {
    let Some(path) = path else {
        let connection = open_connection(&app)?;
        connection
            .execute("DELETE FROM settings WHERE key = ?1", [PLUGIN_DIRECTORY_SETTING_KEY])
            .map_err(|error| format!("Unable to reset plugin directory: {error}"))?;
        return Ok(PluginDirectoryPath {
            path: default_plugin_directory_path(&app)?.display().to_string(),
            is_default: true,
        });
    };
    if path.trim().is_empty() {
        return Err("Plugin directory must not be empty.".to_string());
    }
    let candidate = PathBuf::from(path.trim());
    let absolute = if candidate.is_absolute() {
        candidate
    } else {
        std::env::current_dir()
            .map_err(|error| format!("Unable to resolve current directory: {error}"))?
            .join(candidate)
    };
    fs::create_dir_all(&absolute)
        .map_err(|error| format!("Unable to create plugin directory '{}': {error}", absolute.display()))?;

    let stored = absolute.to_string_lossy().into_owned();
    let connection = open_connection(&app)?;
    upsert_setting(&connection, PLUGIN_DIRECTORY_SETTING_KEY, &stored)?;
    Ok(PluginDirectoryPath {
        path: stored,
        is_default: false,
    })
}

#[tauri::command]
fn discover_plugins(app: AppHandle) -> Result<DiscoverPluginsResponse, String> {
    let directory = resolve_plugin_directory(&app)?;
    let response = discover_plugins_in_directory(&directory);

    let connection = open_connection(&app)?;
    Ok(merge_installed_state(response, load_all_installed_plugins(&connection)?))
}

#[tauri::command]
fn install_plugin(app: AppHandle, source_path: String) -> Result<InstallPluginResponse, String> {
    if source_path.trim().is_empty() {
        return Err("Plugin source path must not be empty.".to_string());
    }
    let plugin_directory = resolve_plugin_directory(&app)?;
    let connection = open_connection(&app)?;
    install_plugin_core(Path::new(&source_path), &plugin_directory, &connection)
}

#[tauri::command]
fn uninstall_plugin(app: AppHandle, plugin_id: String) -> Result<UninstallPluginResponse, String> {
    let plugin_directory = resolve_plugin_directory(&app)?;
    let connection = open_connection(&app)?;
    uninstall_plugin_core(&plugin_id, &plugin_directory, &connection)
}

#[tauri::command]
fn list_installed_plugins(app: AppHandle) -> Result<Vec<PluginInstallState>, String> {
    let connection = open_connection(&app)?;
    load_all_installed_plugins(&connection)
}

fn smoke_report_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut report_path = app_data_dir(app)?;
    report_path.push("smoke-report.json");
    Ok(report_path)
}

fn smoke_snapshot() -> AppSnapshot {
    AppSnapshot {
        locale: "en".to_string(),
        theme: "light".to_string(),
        active_space_id: Some("smoke-space".to_string()),
        last_opened_at: "2026-01-01T00:00:00.000Z".to_string(),
        has_seen_tutorial: true,
        spaces: vec![Space {
            id: "smoke-space".to_string(),
            name: "Smoke Space".to_string(),
            nodes: vec![BrainNode {
                id: "smoke-node".to_string(),
                position: BrainNodePosition { x: 120.0, y: 180.0 },
                data: BrainNodeData {
                    label: "Smoke".to_string(),
                    category: None,
                    color: None,
                },
            }],
            edges: vec![],
            todos: vec![TodoItem {
                id: "smoke-todo".to_string(),
                text: "Verify SQLite persistence".to_string(),
                completed: false,
                created_at: "2026-01-01T00:00:00.000Z".to_string(),
                updated_at: "2026-01-01T00:00:00.000Z".to_string(),
                priority: None,
                due_date: None,
            }],
            viewport: ViewportState {
                x: 0.0,
                y: 0.0,
                zoom: 1.0,
            },
            created_at: "2026-01-01T00:00:00.000Z".to_string(),
            updated_at: "2026-01-01T00:00:00.000Z".to_string(),
        }],
    }
}

fn run_tauri_smoke(app: AppHandle) -> Result<(), String> {
    let expected = smoke_snapshot();
    save_snapshot(app.clone(), expected.clone())?;
    let actual = load_snapshot(app.clone())?;

    if actual != expected {
        return Err("Smoke snapshot round-trip mismatch.".to_string());
    }

    let connection = open_connection(&app)?;
    let schema_version = load_schema_version(&connection)?;
    if schema_version != LATEST_SCHEMA_VERSION {
        return Err(format!(
            "Smoke schema version mismatch: expected {LATEST_SCHEMA_VERSION}, got {schema_version}."
        ));
    }

    Ok(())
}

fn write_smoke_report(app: &AppHandle, report: &SmokeReport) -> Result<(), String> {
    let report_path = smoke_report_path(app)?;
    let serialized =
        serde_json::to_string_pretty(report).map_err(|error| format!("Unable to serialize smoke report: {error}"))?;

    fs::write(&report_path, serialized)
        .map_err(|error| format!("Unable to write smoke report '{}': {error}", report_path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("in-memory sqlite");
        prepare_connection(&connection).expect("prepare connection");
        connection
    }

    fn make_snapshot() -> AppSnapshot {
        AppSnapshot {
            locale: "en".to_string(),
            theme: "light".to_string(),
            active_space_id: Some("space-1".to_string()),
            last_opened_at: "2026-01-01T00:00:00.000Z".to_string(),
            has_seen_tutorial: true,
            spaces: vec![Space {
                id: "space-1".to_string(),
                name: "Space One".to_string(),
                nodes: vec![
                    BrainNode {
                        id: "node-a".to_string(),
                        position: BrainNodePosition { x: 120.0, y: 180.0 },
                        data: BrainNodeData {
                            label: "Why".to_string(),
                            category: Some("reason".to_string()),
                            color: Some("blue".to_string()),
                        },
                    },
                    BrainNode {
                        id: "node-b".to_string(),
                        position: BrainNodePosition { x: 340.0, y: 240.0 },
                        data: BrainNodeData {
                            label: "Because".to_string(),
                            category: None,
                            color: None,
                        },
                    },
                ],
                edges: vec![BrainEdge {
                    id: "edge-1".to_string(),
                    source: "node-a".to_string(),
                    target: "node-b".to_string(),
                }],
                todos: vec![
                    TodoItem {
                        id: "todo-1".to_string(),
                        text: "Write the reason".to_string(),
                        completed: false,
                        created_at: "2026-01-01T00:00:00.000Z".to_string(),
                        updated_at: "2026-01-01T00:00:00.000Z".to_string(),
                        priority: Some("high".to_string()),
                        due_date: Some("2026-01-05".to_string()),
                    },
                    TodoItem {
                        id: "todo-2".to_string(),
                        text: "Connect the idea".to_string(),
                        completed: true,
                        created_at: "2026-01-02T00:00:00.000Z".to_string(),
                        updated_at: "2026-01-02T00:00:00.000Z".to_string(),
                        priority: None,
                        due_date: None,
                    },
                ],
                viewport: ViewportState {
                    x: 12.5,
                    y: -4.0,
                    zoom: 0.95,
                },
                created_at: "2026-01-01T00:00:00.000Z".to_string(),
                updated_at: "2026-01-03T00:00:00.000Z".to_string(),
            }],
        }
    }

    fn make_replacement_snapshot() -> AppSnapshot {
        AppSnapshot {
            locale: "zh".to_string(),
            theme: "dark".to_string(),
            active_space_id: None,
            last_opened_at: "2026-02-01T00:00:00.000Z".to_string(),
            has_seen_tutorial: false,
            spaces: vec![Space {
                id: "space-2".to_string(),
                name: "Space Two".to_string(),
                nodes: vec![BrainNode {
                    id: "node-c".to_string(),
                    position: BrainNodePosition { x: 40.0, y: 80.0 },
                    data: BrainNodeData {
                        label: "Focus".to_string(),
                        category: None,
                        color: None,
                    },
                }],
                edges: vec![],
                todos: vec![TodoItem {
                    id: "todo-3".to_string(),
                    text: "Keep it simple".to_string(),
                    completed: false,
                    created_at: "2026-02-01T00:00:00.000Z".to_string(),
                    updated_at: "2026-02-01T00:00:00.000Z".to_string(),
                    priority: None,
                    due_date: None,
                }],
                viewport: ViewportState {
                    x: -20.0,
                    y: 30.0,
                    zoom: 1.1,
                },
                created_at: "2026-02-01T00:00:00.000Z".to_string(),
                updated_at: "2026-02-02T00:00:00.000Z".to_string(),
            }],
        }
    }

    #[test]
    fn loads_empty_snapshot_from_fresh_db() {
        let connection = open_test_connection();
        let snapshot = load_snapshot_from_connection(&connection).expect("load snapshot");

        assert_eq!(
            snapshot,
            AppSnapshot {
                locale: "en".to_string(),
                theme: "dark".to_string(),
                spaces: vec![],
                active_space_id: None,
                last_opened_at: String::new(),
                has_seen_tutorial: true,
            }
        );
    }

    #[test]
    fn fresh_db_sets_latest_schema_version() {
        let connection = open_test_connection();

        assert_eq!(
            load_schema_version(&connection).expect("load schema version"),
            LATEST_SCHEMA_VERSION
        );
    }

    #[test]
    fn prepare_connection_is_idempotent_for_current_schema() {
        let connection = open_test_connection();

        prepare_connection(&connection).expect("prepare connection again");

        assert_eq!(
            load_schema_version(&connection).expect("load schema version"),
            LATEST_SCHEMA_VERSION
        );
    }

    #[test]
    fn round_trips_snapshot_through_sqlite() {
        let mut connection = open_test_connection();
        let snapshot = make_snapshot();

        save_snapshot_to_connection(&mut connection, &snapshot).expect("save snapshot");
        let loaded = load_snapshot_from_connection(&connection).expect("load snapshot");

        assert_eq!(loaded, snapshot);
    }

    #[test]
    fn replacing_snapshot_clears_stale_rows_and_settings() {
        let mut connection = open_test_connection();
        let original = make_snapshot();
        let replacement = make_replacement_snapshot();

        save_snapshot_to_connection(&mut connection, &original).expect("save original snapshot");
        save_snapshot_to_connection(&mut connection, &replacement).expect("save replacement snapshot");
        let loaded = load_snapshot_from_connection(&connection).expect("load replacement snapshot");

        assert_eq!(loaded, replacement);
        assert_eq!(loaded.spaces.len(), 1);
        assert_eq!(loaded.spaces[0].nodes.len(), 1);
        assert_eq!(loaded.spaces[0].edges.len(), 0);
        assert_eq!(loaded.spaces[0].todos.len(), 1);
        assert_eq!(loaded.active_space_id, None);
    }

    #[test]
    fn save_without_active_space_removes_active_space_setting() {
        let mut connection = open_test_connection();
        let mut snapshot = make_snapshot();
        snapshot.active_space_id = None;

        save_snapshot_to_connection(&mut connection, &snapshot).expect("save snapshot");

        let active_space = load_setting(&connection, "activeSpaceId").expect("load active space setting");
        assert_eq!(active_space, None);
        assert_eq!(
            load_schema_version(&connection).expect("load schema version"),
            LATEST_SCHEMA_VERSION
        );
    }

    #[test]
    fn save_persists_tutorial_seen_setting() {
        let mut connection = open_test_connection();
        let mut snapshot = make_snapshot();
        snapshot.has_seen_tutorial = false;

        save_snapshot_to_connection(&mut connection, &snapshot).expect("save snapshot");

        let value = load_setting(&connection, "hasSeenTutorial").expect("load tutorial setting");
        assert_eq!(value.as_deref(), Some("false"));
    }

    #[test]
    fn migrates_legacy_unversioned_schema_without_losing_data() {
        let mut connection = Connection::open_in_memory().expect("in-memory sqlite");
        configure_connection(&connection).expect("configure connection");
        connection
            .execute_batch(MIGRATION_1_SQL)
            .expect("initialize legacy schema");

        assert_eq!(load_schema_version(&connection).expect("schema version before migration"), 0);
        run_migrations(&connection).expect("migrate legacy schema");

        let snapshot = make_snapshot();
        save_snapshot_to_connection(&mut connection, &snapshot).expect("save legacy snapshot");
        let loaded = load_snapshot_from_connection(&connection).expect("load migrated snapshot");

        assert_eq!(
            load_schema_version(&connection).expect("schema version after migration"),
            LATEST_SCHEMA_VERSION
        );
        assert_eq!(loaded, snapshot);
    }

    #[test]
    fn rejects_future_schema_versions() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite");
        configure_connection(&connection).expect("configure connection");
        set_schema_version(&connection, LATEST_SCHEMA_VERSION + 1).expect("set future schema version");

        let error = run_migrations(&connection).expect_err("reject future schema version");
        assert!(
            error.contains("newer than this build supports"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn migrates_v1_schema_to_latest_with_revision_indexes_and_advanced_fields() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite");
        configure_connection(&connection).expect("configure connection");
        connection.execute_batch(MIGRATION_1_SQL).expect("initialize v1 schema");

        assert_eq!(load_schema_version(&connection).expect("schema version"), 0);
        run_migrations(&connection).expect("migrate schema");

        assert_eq!(load_schema_version(&connection).expect("schema version"), LATEST_SCHEMA_VERSION);
        assert_eq!(load_storage_revision(&connection).expect("storage revision"), 0);
        for index in ["idx_nodes_space_order", "idx_edges_space_order", "idx_todos_space_order"] {
            let count: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
                    [index],
                    |row| row.get(0),
                )
                .expect("index lookup");
            assert_eq!(count, 1, "missing index {index}");
        }
        for (table, column) in [
            ("nodes", "category"),
            ("nodes", "color"),
            ("todos", "priority"),
            ("todos", "due_date"),
        ] {
            let count: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2",
                    params![table, column],
                    |row| row.get(0),
                )
                .expect("column lookup");
            assert_eq!(count, 1, "missing column {table}.{column}");
        }
    }

    #[test]
    fn applies_incremental_mutations_and_rejects_stale_revision() {
        let mut connection = open_test_connection();
        let original = make_snapshot();
        save_snapshot_to_connection(&mut connection, &original).expect("save original");

        let batch = MutationBatch {
            expected_revision: 0,
            next_revision: 1,
            mutations: vec![
                WorkspaceMutation::NodeUpsert {
                    space_id: "space-1".to_string(),
                    node: BrainNode {
                        id: "node-a".to_string(),
                        position: BrainNodePosition { x: 999.0, y: 888.0 },
                        data: BrainNodeData { label: "Updated".to_string(), category: Some("action".to_string()), color: Some("green".to_string()) },
                    },
                    order_index: 0,
                },
                WorkspaceMutation::SettingsPatch {
                    settings: PersistedSettings {
                        locale: "en".to_string(),
                        theme: "dark".to_string(),
                        active_space_id: Some("space-1".to_string()),
                        last_opened_at: "later".to_string(),
                        has_seen_tutorial: true,
                    },
                },
            ],
        };

        let result = apply_mutations_to_connection(&mut connection, &batch).expect("apply mutations");
        assert_eq!(result.revision, 1);
        let loaded = load_workspace_from_connection(&connection).expect("load workspace");
        assert_eq!(loaded.revision, 1);
        assert_eq!(loaded.snapshot.spaces[0].nodes[0].data.label, "Updated");
        assert_eq!(loaded.snapshot.theme, "dark");

        let stale = MutationBatch { expected_revision: 0, next_revision: 1, mutations: vec![] };
        let error = apply_mutations_to_connection(&mut connection, &stale).expect_err("stale revision");
        assert!(error.contains("revision conflict"));
    }

    use std::sync::atomic::{AtomicU64, Ordering};

    static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn unique_temp_dir(label: &str) -> PathBuf {
        let name = format!(
            "whybrary-test-{label}-{}-{}",
            std::process::id(),
            TEMP_COUNTER.fetch_add(1, Ordering::SeqCst)
        );
        let path = std::env::temp_dir().join(name);
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    fn valid_manifest_value() -> serde_json::Value {
        serde_json::json!({
            "schemaVersion": 1,
            "id": "my-plugin",
            "name": "My Plugin",
            "version": "1.0.0",
            "engine": "whybrary",
            "entry": "index.js",
            "permissions": ["workspace:read", "ui:panel"]
        })
    }

    #[test]
    fn validates_well_formed_manifest() {
        let manifest = validate_plugin_manifest(&valid_manifest_value()).expect("valid manifest");
        assert_eq!(manifest.id, "my-plugin");
        assert_eq!(manifest.name, "My Plugin");
        assert_eq!(manifest.version, "1.0.0");
        assert_eq!(manifest.engine, "whybrary");
        assert_eq!(manifest.entry, "index.js");
        assert_eq!(manifest.permissions, vec!["workspace:read", "ui:panel"]);
    }

    #[test]
    fn rejects_non_object_manifest() {
        let issue =
            validate_plugin_manifest(&serde_json::json!(["not", "an", "object"])).expect_err("reject");
        assert_eq!(issue.code, "manifest.invalid");
    }

    #[test]
    fn rejects_unsupported_schema_version() {
        for version in [serde_json::json!(0), serde_json::json!(2), serde_json::json!("1")] {
            let mut value = valid_manifest_value();
            value["schemaVersion"] = version;
            let issue = validate_plugin_manifest(&value).expect_err("reject schema version");
            assert_eq!(issue.code, "manifest.schema-version");
        }
    }

    #[test]
    fn rejects_invalid_plugin_ids() {
        for id in ["Bad", "with space", "-leading", "trailing-", "a..b", "a/b", "UPPER", "", "a b"] {
            let mut value = valid_manifest_value();
            value["id"] = serde_json::json!(id);
            let issue = validate_plugin_manifest(&value).expect_err("reject id");
            assert_eq!(issue.code, "manifest.id", "id {id:?} should be rejected");
        }
    }

    #[test]
    fn accepts_valid_plugin_ids() {
        for id in ["a", "my-plugin", "org.example.plugin", "a_b.c-d", "my0plugin"] {
            let mut value = valid_manifest_value();
            value["id"] = serde_json::json!(id);
            assert!(validate_plugin_manifest(&value).is_ok(), "id {id:?} should be accepted");
        }
    }

    #[test]
    fn rejects_empty_required_fields() {
        for key in ["name", "version", "engine", "entry"] {
            for bad in [serde_json::json!(""), serde_json::json!("   "), serde_json::json!(42)] {
                let mut value = valid_manifest_value();
                value[key] = bad;
                let issue = validate_plugin_manifest(&value).expect_err("reject field");
                assert_eq!(
                    issue.code,
                    format!("manifest.{key}").as_str(),
                    "field {key} should be rejected"
                );
            }
        }
    }

    #[test]
    fn rejects_unsafe_relative_entries() {
        for entry in [
            "../escape.js",
            "..\\escape.js",
            "/abs.js",
            "\\abs.js",
            "a/../../b.js",
            "sub/../x.js",
        ] {
            let mut value = valid_manifest_value();
            value["entry"] = serde_json::json!(entry);
            let issue = validate_plugin_manifest(&value).expect_err("reject entry");
            assert_eq!(issue.code, "manifest.entry", "entry {entry:?} should be rejected");
        }
    }

    #[test]
    fn accepts_safe_relative_entries() {
        for entry in ["index.js", "dist/app.js", "sub/folder/main.js", "./rel.js", "a\\b.js", "foo..bar/baz.js"] {
            let mut value = valid_manifest_value();
            value["entry"] = serde_json::json!(entry);
            assert!(validate_plugin_manifest(&value).is_ok(), "entry {entry:?} should be accepted");
        }
    }

    #[test]
    fn rejects_unsupported_and_duplicate_permissions() {
        let mut unsupported = valid_manifest_value();
        unsupported["permissions"] = serde_json::json!(["workspace:read", "fs:write"]);
        let issue = validate_plugin_manifest(&unsupported).expect_err("reject unsupported");
        assert_eq!(issue.code, "manifest.permissions");

        let mut duplicate = valid_manifest_value();
        duplicate["permissions"] = serde_json::json!(["workspace:read", "workspace:read"]);
        let issue = validate_plugin_manifest(&duplicate).expect_err("reject duplicate");
        assert_eq!(issue.code, "manifest.permissions");

        let mut not_array = valid_manifest_value();
        not_array["permissions"] = serde_json::json!("workspace:read");
        let issue = validate_plugin_manifest(&not_array).expect_err("reject non-array");
        assert_eq!(issue.code, "manifest.permissions");

        let mut missing = valid_manifest_value();
        missing.as_object_mut().expect("object").remove("permissions");
        let issue = validate_plugin_manifest(&missing).expect_err("reject missing");
        assert_eq!(issue.code, "manifest.permissions");
    }

    #[test]
    fn plugin_directory_setting_round_trips_through_sqlite() {
        let connection = open_test_connection();
        assert_eq!(
            load_setting(&connection, PLUGIN_DIRECTORY_SETTING_KEY).expect("unset plugin directory"),
            None
        );
        upsert_setting(&connection, PLUGIN_DIRECTORY_SETTING_KEY, "C:\\whybrary-plugins")
            .expect("set plugin directory");
        assert_eq!(
            load_setting(&connection, PLUGIN_DIRECTORY_SETTING_KEY).expect("read plugin directory"),
            Some("C:\\whybrary-plugins".to_string())
        );
    }

    #[test]
    fn discovery_isolates_failed_plugins() {
        let root = unique_temp_dir("discovery");
        let write_file = |relative: &str, contents: &str| {
            let path = root.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).expect("create parent dir");
            }
            fs::write(&path, contents).expect("write file");
        };

        write_file(
            "good-plugin/whybrary-plugin.json",
            r#"{
                "schemaVersion": 1,
                "id": "good-plugin",
                "name": "Good Plugin",
                "version": "1.0.0",
                "engine": "whybrary",
                "entry": "index.js",
                "permissions": ["workspace:read", "ui:panel"]
            }"#,
        );
        write_file("good-plugin/index.js", "export default {};");

        write_file("bad-json/whybrary-plugin.json", "{ not valid json");
        write_file("bad-json/index.js", "export default {};");

        write_file(
            "unsafe-entry/whybrary-plugin.json",
            r#"{
                "schemaVersion": 1,
                "id": "unsafe-entry",
                "name": "Unsafe",
                "version": "1.0.0",
                "engine": "whybrary",
                "entry": "../escape.js",
                "permissions": []
            }"#,
        );

        write_file(
            "missing-entry/whybrary-plugin.json",
            r#"{
                "schemaVersion": 1,
                "id": "missing-entry",
                "name": "Missing",
                "version": "1.0.0",
                "engine": "whybrary",
                "entry": "nope.js",
                "permissions": []
            }"#,
        );

        write_file("no-manifest/keep.txt", "not a plugin");

        let result = discover_plugins_in_directory(&root);

        let _ = fs::remove_dir_all(&root);

        assert_eq!(result.plugins.len(), 1, "only the well-formed plugin should be discovered");
        assert_eq!(result.plugins[0].id, "good-plugin");
        assert_eq!(
            result.plugins[0].entry_path,
            root.join("good-plugin").join("index.js").display().to_string()
        );
        assert_eq!(result.plugins[0].permissions, vec!["workspace:read", "ui:panel"]);

        let codes: Vec<&str> = result.diagnostics.iter().map(|d| d.code.as_str()).collect();
        assert!(codes.contains(&"manifest.parse"), "bad JSON should produce a parse diagnostic: {codes:?}");
        assert!(
            codes.contains(&"manifest.entry"),
            "unsafe and missing entries should produce entry diagnostics: {codes:?}"
        );
        assert_eq!(result.diagnostics.len(), 3, "one diagnostic per failing plugin: {codes:?}");
        assert!(
            result.diagnostics.iter().all(|d| !d.path.contains("no-manifest")),
            "directories without a manifest should be skipped silently"
        );
    }

    fn write_plugin_source(
        root: &Path,
        name: &str,
        id: &str,
        version: &str,
        entry: &str,
    ) -> PathBuf {
        let source = root.join(name);
        fs::create_dir_all(&source).expect("create plugin source dir");
        fs::write(
            source.join("whybrary-plugin.json"),
            format!(
                r#"{{
                    "schemaVersion": 1,
                    "id": "{id}",
                    "name": "{id}",
                    "version": "{version}",
                    "engine": "whybrary",
                    "entry": "{entry}",
                    "permissions": ["workspace:read", "ui:panel"]
                }}"#
            ),
        )
        .expect("write plugin manifest");
        fs::write(source.join(entry), "export default {};").expect("write plugin entry");
        source
    }

    #[test]
    fn fresh_db_creates_plugin_install_state_table() {
        let connection = open_test_connection();

        assert_eq!(
            load_schema_version(&connection).expect("schema version"),
            LATEST_SCHEMA_VERSION
        );

        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'plugin_install_state'",
                [],
                |row| row.get(0),
            )
            .expect("table lookup");
        assert_eq!(count, 1, "plugin_install_state table missing");

        for column in [
            "plugin_id",
            "version",
            "directory",
            "source",
            "enabled",
            "approved_permissions_json",
            "installed_at",
            "updated_at",
            "last_error",
        ] {
            let count: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('plugin_install_state') WHERE name = ?1",
                    [column],
                    |row| row.get(0),
                )
                .expect("column lookup");
            assert_eq!(count, 1, "missing column {column}");
        }
    }

    #[test]
    fn migrates_v3_schema_to_v4_creating_install_state_table() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite");
        configure_connection(&connection).expect("configure connection");
        connection
            .execute_batch(MIGRATION_1_SQL)
            .expect("v1 schema");
        connection
            .execute_batch(MIGRATION_2_SQL)
            .expect("v2 schema");
        connection
            .execute_batch(MIGRATION_3_SQL)
            .expect("v3 schema");
        set_schema_version(&connection, 3).expect("set v3 schema version");

        run_migrations(&connection).expect("migrate to latest");

        assert_eq!(
            load_schema_version(&connection).expect("schema version"),
            LATEST_SCHEMA_VERSION
        );
        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'plugin_install_state'",
                [],
                |row| row.get(0),
            )
            .expect("table lookup");
        assert_eq!(
            count, 1,
            "plugin_install_state table missing after v3 -> v4"
        );
    }

    #[test]
    fn installed_plugin_state_round_trips_through_sqlite() {
        let connection = open_test_connection();
        assert_eq!(
            load_installed_plugin(&connection, "my-plugin").expect("missing state"),
            None
        );

        let state = PluginInstallState {
            plugin_id: "my-plugin".to_string(),
            version: "1.0.0".to_string(),
            directory: "C:\\plugins\\my-plugin".to_string(),
            source: "local".to_string(),
            enabled: true,
            approved_permissions: vec!["workspace:read".to_string(), "ui:panel".to_string()],
            installed_at: "2026-01-01T00:00:00.000Z".to_string(),
            updated_at: "2026-01-01T00:00:00.000Z".to_string(),
            last_error: None,
        };
        upsert_installed_plugin(&connection, &state).expect("upsert state");
        assert_eq!(
            load_installed_plugin(&connection, "my-plugin").expect("load state"),
            Some(state.clone())
        );

        let mut updated = state.clone();
        updated.version = "2.0.0".to_string();
        updated.enabled = false;
        updated.last_error = Some("activation failed".to_string());
        upsert_installed_plugin(&connection, &updated).expect("re-upsert state");
        assert_eq!(
            load_installed_plugin(&connection, "my-plugin").expect("reload state"),
            Some(updated)
        );

        delete_installed_plugin(&connection, "my-plugin").expect("delete state");
        assert_eq!(
            load_installed_plugin(&connection, "my-plugin").expect("missing after delete"),
            None
        );
    }

    #[test]
    fn iso_timestamp_now_is_utc_iso8601() {
        let stamp = iso_timestamp_now();
        assert_eq!(
            stamp.len(),
            24,
            "expected 2026-01-01T00:00:00.000Z shape, got {stamp}"
        );
        assert!(stamp.ends_with('Z'), "expected UTC marker, got {stamp}");
        assert_eq!(&stamp[4..5], "-");
        assert_eq!(&stamp[7..8], "-");
        assert_eq!(&stamp[10..11], "T");
        assert_eq!(&stamp[19..20], ".");
    }

    #[test]
    fn installs_plugin_into_configured_directory_and_upserts_state() {
        let root = unique_temp_dir("install");
        let plugin_dir = root.join("plugins");
        let source = write_plugin_source(&root, "source", "installed-plugin", "1.0.0", "index.js");

        let connection = open_test_connection();
        let response = install_plugin_core(&source, &plugin_dir, &connection).expect("install");

        assert!(!response.replaced);
        assert_eq!(response.plugin.id, "installed-plugin");
        assert_eq!(
            response.state.directory,
            plugin_dir.join("installed-plugin").display().to_string()
        );
        assert!(response.state.enabled);
        assert!(plugin_dir
            .join("installed-plugin")
            .join("index.js")
            .is_file());

        let state = load_installed_plugin(&connection, "installed-plugin")
            .expect("load state")
            .expect("state exists");
        assert_eq!(state.version, "1.0.0");
        assert_eq!(state.source, "local");
        assert_eq!(
            state.approved_permissions,
            vec!["workspace:read", "ui:panel"]
        );
        assert_eq!(state.last_error, None);

        let listed = load_all_installed_plugins(&connection).expect("list states");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].plugin_id, "installed-plugin");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn reinstall_replaces_existing_target_after_validation() {
        let root = unique_temp_dir("reinstall");
        let plugin_dir = root.join("plugins");
        let source =
            write_plugin_source(&root, "source", "reinstalled-plugin", "1.0.0", "index.js");
        fs::write(source.join("legacy.txt"), "old").expect("write legacy file");

        let connection = open_test_connection();
        let first = install_plugin_core(&source, &plugin_dir, &connection).expect("first install");
        assert!(!first.replaced);
        assert!(plugin_dir
            .join("reinstalled-plugin")
            .join("legacy.txt")
            .is_file());

        fs::remove_file(source.join("legacy.txt")).expect("drop legacy file");
        fs::write(source.join("new.txt"), "new").expect("write new file");
        let manifest_path = source.join("whybrary-plugin.json");
        let manifest_text = fs::read_to_string(&manifest_path).expect("read manifest");
        fs::write(
            &manifest_path,
            manifest_text.replace("\"1.0.0\"", "\"2.0.0\""),
        )
        .expect("rewrite manifest");

        let second =
            install_plugin_core(&source, &plugin_dir, &connection).expect("second install");
        assert!(second.replaced);
        assert_eq!(second.plugin.version, "2.0.0");
        assert!(!plugin_dir
            .join("reinstalled-plugin")
            .join("legacy.txt")
            .exists());
        assert!(plugin_dir
            .join("reinstalled-plugin")
            .join("new.txt")
            .is_file());

        let state = load_installed_plugin(&connection, "reinstalled-plugin")
            .expect("load state")
            .expect("state exists");
        assert_eq!(state.version, "2.0.0");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn install_rejects_non_directory_source() {
        let root = unique_temp_dir("install-file");
        let plugin_dir = root.join("plugins");
        let source = root.join("not-a-dir.txt");
        fs::write(&source, "nope").expect("write file");

        let connection = open_test_connection();
        let error =
            install_plugin_core(&source, &plugin_dir, &connection).expect_err("reject file");
        assert!(
            error.contains("must be a directory"),
            "unexpected error: {error}"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn install_rejects_unsafe_entry_without_staging_leftovers() {
        let root = unique_temp_dir("install-unsafe");
        let plugin_dir = root.join("plugins");
        let source = root.join("unsafe-source");
        fs::create_dir_all(&source).expect("create source");
        fs::write(
            source.join("whybrary-plugin.json"),
            r#"{
                "schemaVersion": 1,
                "id": "unsafe-plugin",
                "name": "Unsafe",
                "version": "1.0.0",
                "engine": "whybrary",
                "entry": "../escape.js",
                "permissions": []
            }"#,
        )
        .expect("write manifest");
        fs::write(source.join("escape.js"), "x").expect("write entry");

        let connection = open_test_connection();
        let error = install_plugin_core(&source, &plugin_dir, &connection)
            .expect_err("reject unsafe entry");
        assert!(
            error.contains("must remain inside"),
            "unexpected error: {error}"
        );
        assert!(
            !plugin_dir.exists(),
            "no plugin directory should be created before validation"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn install_rejects_reserved_builtin_id() {
        let root = unique_temp_dir("install-reserved");
        let plugin_dir = root.join("plugins");
        let source = write_plugin_source(&root, "why-review", "why-review", "9.9.9", "index.js");

        let connection = open_test_connection();
        let error =
            install_plugin_core(&source, &plugin_dir, &connection).expect_err("reject reserved");
        assert!(
            error.contains("reserved for a built-in plugin"),
            "unexpected error: {error}"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn uninstall_removes_directory_and_state() {
        let root = unique_temp_dir("uninstall");
        let plugin_dir = root.join("plugins");
        let source = write_plugin_source(&root, "source", "victim-plugin", "1.0.0", "index.js");

        let connection = open_test_connection();
        install_plugin_core(&source, &plugin_dir, &connection).expect("install");

        let response =
            uninstall_plugin_core("victim-plugin", &plugin_dir, &connection).expect("uninstall");
        assert!(response.removed);
        assert!(response.state_removed);
        assert!(!plugin_dir.join("victim-plugin").exists());
        assert_eq!(
            load_installed_plugin(&connection, "victim-plugin").expect("load"),
            None
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn uninstall_rejects_invalid_plugin_id() {
        let root = unique_temp_dir("uninstall-invalid");
        let plugin_dir = root.join("plugins");
        let connection = open_test_connection();

        let error =
            uninstall_plugin_core("../escape", &plugin_dir, &connection).expect_err("reject id");
        assert!(
            error.contains("Invalid plugin id"),
            "unexpected error: {error}"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn uninstall_refuses_directory_outside_configured_directory() {
        let root = unique_temp_dir("uninstall-outside");
        let plugin_dir = root.join("plugins");
        let outside = root.join("elsewhere").join("victim-plugin");
        fs::create_dir_all(&outside).expect("create outside dir");

        let connection = open_test_connection();
        upsert_installed_plugin(
            &connection,
            &PluginInstallState {
                plugin_id: "victim-plugin".to_string(),
                version: "1.0.0".to_string(),
                directory: outside.display().to_string(),
                source: "local".to_string(),
                enabled: true,
                approved_permissions: vec![],
                installed_at: "2026-01-01T00:00:00.000Z".to_string(),
                updated_at: "2026-01-01T00:00:00.000Z".to_string(),
                last_error: None,
            },
        )
        .expect("seed state");

        let error = uninstall_plugin_core("victim-plugin", &plugin_dir, &connection)
            .expect_err("refuse outside");
        assert!(
            error.contains("outside the configured plugin directory"),
            "unexpected error: {error}"
        );
        assert!(
            outside.exists(),
            "directory outside the configured plugin dir must survive"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn discovery_merges_installed_state_by_plugin_id() {
        let root = unique_temp_dir("merge-state");
        write_plugin_source(&root, "good-plugin", "good-plugin", "1.0.0", "index.js");

        let response = discover_plugins_in_directory(&root);
        assert_eq!(response.plugins.len(), 1);
        assert_eq!(response.plugins[0].state, None);

        let state = PluginInstallState {
            plugin_id: "good-plugin".to_string(),
            version: "1.0.0".to_string(),
            directory: root.join("good-plugin").display().to_string(),
            source: "local".to_string(),
            enabled: false,
            approved_permissions: vec!["workspace:read".to_string()],
            installed_at: "2026-01-01T00:00:00.000Z".to_string(),
            updated_at: "2026-01-01T00:00:00.000Z".to_string(),
            last_error: Some("boom".to_string()),
        };
        let merged = merge_installed_state(response, vec![state.clone()]);
        assert_eq!(merged.plugins[0].state, Some(state));

        let _ = fs::remove_dir_all(&root);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();
    if std::env::var_os(SMOKE_MODE_ENV).is_some() {
        context.config_mut().app.windows.clear();
    }

    tauri::Builder::default()
        .setup(|app| {
            if std::env::var_os(SMOKE_MODE_ENV).is_none() {
                #[cfg(desktop)]
                if let Some(window) = app.get_webview_window("main") {
                    if let Some(monitor) = window.current_monitor()? {
                        let work_area = monitor.work_area();
                        let scale_factor = monitor.scale_factor();
                        let max_width = ((work_area.size.width as f64) / scale_factor).floor();
                        let max_height = ((work_area.size.height as f64) / scale_factor).floor();
                        let target_width = max_width.min(1360.0).max(900.0);
                        let target_height = max_height.min(860.0).max(640.0);

                        window.set_min_size(Some(LogicalSize::new(900.0, 640.0)))?;
                        window.set_size(Size::Logical(LogicalSize::new(
                            target_width,
                            target_height,
                        )))?;
                        let _ = window.center();
                    }
                }

                return Ok(());
            }

            let app_handle = app.handle().clone();
            let db_path_result = app_db_path(&app_handle);

            let report = match db_path_result {
                Ok(db_path) => match run_tauri_smoke(app_handle.clone()) {
                    Ok(()) => SmokeReport {
                        success: true,
                        db_path: db_path.display().to_string(),
                        schema_version: LATEST_SCHEMA_VERSION,
                        error: None,
                    },
                    Err(error) => SmokeReport {
                        success: false,
                        db_path: db_path.display().to_string(),
                        schema_version: 0,
                        error: Some(error),
                    },
                },
                Err(error) => SmokeReport {
                    success: false,
                    db_path: String::new(),
                    schema_version: 0,
                    error: Some(error),
                },
            };

            let exit_code = if report.success { 0 } else { 1 };

            if let Err(error) = write_smoke_report(&app_handle, &report) {
                eprintln!("{error}");
            }

            app_handle.exit(exit_code);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_snapshot,
            save_snapshot,
            load_workspace,
            apply_mutations,
            replace_workspace,
            default_plugin_directory,
            get_plugin_directory,
            set_plugin_directory,
            discover_plugins,
            install_plugin,
            uninstall_plugin,
            list_installed_plugins
        ])
        .run(context)
        .expect("error while running Whybrary");
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
