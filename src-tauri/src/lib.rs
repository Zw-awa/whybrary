use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[cfg(desktop)]
use tauri::{LogicalSize, Size};

const LATEST_SCHEMA_VERSION: i32 = 1;
const SMOKE_MODE_ENV: &str = "WHYBRARY_TAURI_SMOKE";
const APP_DATA_DIR_OVERRIDE_ENV: &str = "WHYBRARY_APP_DATA_DIR";

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SmokeReport {
    success: bool,
    db_path: String,
    schema_version: i32,
    error: Option<String>,
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

fn load_nodes(connection: &Connection, space_id: &str) -> Result<Vec<BrainNode>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, label, position_x, position_y
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
                data: BrainNodeData { label: row.get(1)? },
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
            "SELECT id, text, completed, created_at, updated_at
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

fn save_snapshot_to_connection(connection: &mut Connection, snapshot: &AppSnapshot) -> Result<(), String> {
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
                      id, space_id, label, order_index, position_x, position_y
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        node.id,
                        space.id,
                        node.data.label,
                        node_index as i64,
                        node.position.x,
                        node.position.y
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
                      id, space_id, text, completed, order_index, created_at, updated_at
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        todo.id,
                        space.id,
                        todo.text,
                        if todo.completed { 1 } else { 0 },
                        todo_index as i64,
                        todo.created_at,
                        todo.updated_at
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
                },
            }],
            edges: vec![],
            todos: vec![TodoItem {
                id: "smoke-todo".to_string(),
                text: "Verify SQLite persistence".to_string(),
                completed: false,
                created_at: "2026-01-01T00:00:00.000Z".to_string(),
                updated_at: "2026-01-01T00:00:00.000Z".to_string(),
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
                        },
                    },
                    BrainNode {
                        id: "node-b".to_string(),
                        position: BrainNodePosition { x: 340.0, y: 240.0 },
                        data: BrainNodeData {
                            label: "Because".to_string(),
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
                    },
                    TodoItem {
                        id: "todo-2".to_string(),
                        text: "Connect the idea".to_string(),
                        completed: true,
                        created_at: "2026-01-02T00:00:00.000Z".to_string(),
                        updated_at: "2026-01-02T00:00:00.000Z".to_string(),
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
                    },
                }],
                edges: vec![],
                todos: vec![TodoItem {
                    id: "todo-3".to_string(),
                    text: "Keep it simple".to_string(),
                    completed: false,
                    created_at: "2026-02-01T00:00:00.000Z".to_string(),
                    updated_at: "2026-02-01T00:00:00.000Z".to_string(),
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

        let snapshot = make_snapshot();
        save_snapshot_to_connection(&mut connection, &snapshot).expect("save legacy snapshot");

        assert_eq!(load_schema_version(&connection).expect("schema version before migration"), 0);

        run_migrations(&connection).expect("migrate legacy schema");
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
        .invoke_handler(tauri::generate_handler![load_snapshot, save_snapshot])
        .run(context)
        .expect("error while running Whybrary");
}
