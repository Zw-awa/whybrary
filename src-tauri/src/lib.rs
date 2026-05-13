use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const INIT_SQL: &str = r#"
PRAGMA foreign_keys = ON;

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
    theme: String,
    spaces: Vec<Space>,
    active_space_id: Option<String>,
    last_opened_at: String,
}

fn initialize_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(INIT_SQL)
        .map_err(|error| format!("Unable to initialize SQLite schema: {error}"))
}

fn app_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut db_path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;

    fs::create_dir_all(&db_path)
        .map_err(|error| format!("Unable to create app data directory: {error}"))?;

    db_path.push("whybrary.sqlite3");
    Ok(db_path)
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let db_path = app_db_path(app)?;
    let connection = Connection::open(db_path).map_err(|error| format!("Unable to open SQLite: {error}"))?;

    initialize_schema(&connection)?;

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
        theme,
        spaces,
        active_space_id,
        last_opened_at,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn open_test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("in-memory sqlite");
        initialize_schema(&connection).expect("initialize schema");
        connection
    }

    fn make_snapshot() -> AppSnapshot {
        AppSnapshot {
            theme: "light".to_string(),
            active_space_id: Some("space-1".to_string()),
            last_opened_at: "2026-01-01T00:00:00.000Z".to_string(),
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
            theme: "dark".to_string(),
            active_space_id: None,
            last_opened_at: "2026-02-01T00:00:00.000Z".to_string(),
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
                theme: "dark".to_string(),
                spaces: vec![],
                active_space_id: None,
                last_opened_at: String::new(),
            }
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
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_snapshot, save_snapshot])
        .run(tauri::generate_context!())
        .expect("error while running Whybrary");
}
