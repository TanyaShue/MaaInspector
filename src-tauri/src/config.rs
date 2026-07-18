use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const CONFIG_FILE: &str = "config.json";
const CONFIG_BACKUP_FILE: &str = "config.json.bak";
static TEMP_FILE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn create_sibling_temp_file(target: &Path) -> io::Result<(PathBuf, File)> {
    let parent = target.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "target path has no parent directory",
        )
    })?;
    let target_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target filename is invalid"))?;
    for _ in 0..100 {
        let sequence = TEMP_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let filename = format!(".{target_name}.{}.{}.tmp", std::process::id(), sequence);
        let path = parent.join(filename);

        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }

    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "failed to allocate a unique temporary config file",
    ))
}

fn remove_temp_file(path: &Path) {
    if let Err(error) = fs::remove_file(path)
        && error.kind() != io::ErrorKind::NotFound
    {
        crate::backend_log_error!(
            "config",
            "Failed to remove temporary config file {}: {}",
            path.display(),
            error
        );
    }
}

pub(crate) fn write_file_atomically(target_path: &Path, content: &[u8]) -> io::Result<()> {
    let parent = target_path.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "config path has no parent directory",
        )
    })?;
    fs::create_dir_all(parent)?;

    let (temp_path, mut temp_file) = create_sibling_temp_file(target_path)?;
    let write_result = (|| -> io::Result<()> {
        temp_file.write_all(content)?;
        temp_file.flush()?;
        temp_file.sync_all()
    })();
    drop(temp_file);

    if let Err(error) = write_result {
        remove_temp_file(&temp_path);
        return Err(error);
    }

    let target_name = target_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target filename is invalid"))?;
    let backup_path = parent.join(format!("{target_name}.bak"));
    let target_exists = match fs::symlink_metadata(target_path) {
        Ok(_) => true,
        Err(error) if error.kind() == io::ErrorKind::NotFound => false,
        Err(error) => {
            remove_temp_file(&temp_path);
            return Err(error);
        }
    };

    if !target_exists {
        let replace_result = fs::rename(&temp_path, target_path);
        if replace_result.is_err() {
            remove_temp_file(&temp_path);
        }
        return replace_result;
    }

    // Windows cannot rename a file over an existing destination. Rotate the
    // current config to a sibling backup first; until that succeeds the target
    // is untouched. Keep the backup after a successful save for recovery.
    match fs::remove_file(&backup_path) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => {
            remove_temp_file(&temp_path);
            return Err(error);
        }
    }

    if let Err(error) = fs::rename(target_path, &backup_path) {
        remove_temp_file(&temp_path);
        return Err(error);
    }

    if let Err(replace_error) = fs::rename(&temp_path, target_path) {
        remove_temp_file(&temp_path);
        return match fs::rename(&backup_path, target_path) {
            Ok(()) => Err(replace_error),
            Err(restore_error) => Err(io::Error::new(
                restore_error.kind(),
                format!(
                    "failed to replace config ({replace_error}); failed to restore backup ({restore_error})"
                ),
            )),
        };
    }

    Ok(())
}

/// Atomically replace a file while keeping its previous contents in a caller-selected
/// backup location. The sibling rollback file only exists during the replacement and
/// is removed after a successful write.
pub(crate) fn write_file_atomically_with_backup(
    target_path: &Path,
    content: &[u8],
    backup_path: Option<&Path>,
) -> io::Result<()> {
    let parent = target_path.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "target path has no parent directory",
        )
    })?;
    fs::create_dir_all(parent)?;

    let (temp_path, mut temp_file) = create_sibling_temp_file(target_path)?;
    let write_result = (|| -> io::Result<()> {
        temp_file.write_all(content)?;
        temp_file.flush()?;
        temp_file.sync_all()
    })();
    drop(temp_file);

    if let Err(error) = write_result {
        remove_temp_file(&temp_path);
        return Err(error);
    }

    if !target_path.exists() {
        let replace_result = fs::rename(&temp_path, target_path);
        if replace_result.is_err() {
            remove_temp_file(&temp_path);
        }
        return replace_result;
    }

    if let Some(backup_path) = backup_path {
        let backup_parent = backup_path.parent().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "backup path has no parent directory",
            )
        })?;
        if let Err(error) = fs::create_dir_all(backup_parent) {
            remove_temp_file(&temp_path);
            return Err(error);
        }
        if let Err(error) = fs::copy(target_path, backup_path) {
            remove_temp_file(&temp_path);
            return Err(error);
        }
    }

    let target_name = target_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target filename is invalid"))?;
    let rollback_path = parent.join(format!(
        ".{target_name}.{}.{}.rollback",
        std::process::id(),
        TEMP_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    ));

    if let Err(error) = fs::rename(target_path, &rollback_path) {
        remove_temp_file(&temp_path);
        return Err(error);
    }

    if let Err(replace_error) = fs::rename(&temp_path, target_path) {
        remove_temp_file(&temp_path);
        return match fs::rename(&rollback_path, target_path) {
            Ok(()) => Err(replace_error),
            Err(restore_error) => Err(io::Error::new(
                restore_error.kind(),
                format!(
                    "failed to replace file ({replace_error}); failed to restore original ({restore_error})"
                ),
            )),
        };
    }

    fs::remove_file(&rollback_path)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeviceInfo {
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub device_type: Option<String>,
    pub address: Option<String>,
    pub config: Option<serde_json::Value>,
    pub hwnd: Option<i64>,
    pub class_name: Option<String>,
    pub window_name: Option<String>,
    pub adb_path: Option<String>,
    pub screencap_method: Option<i32>,
    pub mouse_method: Option<i32>,
    pub keyboard_method: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResourceProfile {
    pub name: Option<String>,
    pub paths: Option<Vec<String>>,
    #[serde(default)]
    pub schema_path: Option<String>,
    #[serde(default)]
    pub interface_path: Option<String>,
    #[serde(default)]
    pub agent: Option<AgentProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentProfile {
    #[serde(default)]
    pub child_exec: String,
    #[serde(default)]
    pub child_args: Vec<String>,
    #[serde(default)]
    pub working_directory: String,
    #[serde(default)]
    pub socket_id: String,
    #[serde(default = "default_agent_auto_start")]
    pub auto_start: bool,
    #[serde(default)]
    pub environment: std::collections::HashMap<String, String>,
}

fn default_agent_auto_start() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CanvasSettings {
    pub edge_type: Option<String>,
    pub spacing: Option<String>,
    pub layout_algorithm: Option<String>,
    pub layout_direction: Option<String>,
    pub pipeline_version: Option<String>,
    pub node_name_prefix_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TabResourceInfo {
    pub id: Option<String>,
    pub title: Option<String>,
    pub resource_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LastTabsState {
    pub resource_index: i32,
    pub tabs: Vec<TabResourceInfo>,
    pub active_tab_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceState {
    pub resource_index: Option<i32>,
    pub resource_signature: Option<String>,
    pub tabs: Vec<TabResourceInfo>,
    pub active_tab_id: Option<String>,
    pub restore_workspace_on_start: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub resource_profiles: Vec<ResourceProfile>,
    #[serde(default)]
    pub current_resource_index: Option<i32>,
    #[serde(default)]
    pub agent_socket_id: Option<String>,
    #[serde(default)]
    pub last_device: Option<serde_json::Value>,
    #[serde(default)]
    pub canvas_settings: CanvasSettings,
    #[serde(default)]
    pub restore_workspace_on_start: Option<bool>,
    #[serde(default)]
    pub workspace_state: Option<WorkspaceState>,
    #[serde(default)]
    pub last_tabs: Option<LastTabsState>,
}

impl AppConfig {
    pub fn load(config_dir: &str) -> Self {
        let config_path = Path::new(config_dir).join(CONFIG_FILE);
        let backup_path = Path::new(config_dir).join(CONFIG_BACKUP_FILE);
        for candidate in [&config_path, &backup_path] {
            match fs::read_to_string(candidate) {
                Ok(content) => match serde_json::from_str(&content) {
                    Ok(config) => return config,
                    Err(e) => crate::backend_log_error!(
                        "config",
                        "Failed to parse {}: {}",
                        candidate.display(),
                        e
                    ),
                },
                Err(e) if e.kind() == io::ErrorKind::NotFound => {}
                Err(e) => crate::backend_log_error!(
                    "config",
                    "Failed to read {}: {}",
                    candidate.display(),
                    e
                ),
            }
        }
        Self::default()
    }

    pub fn save(&self, config_dir: &str) -> bool {
        let config_path = Path::new(config_dir).join(CONFIG_FILE);
        match serde_json::to_string_pretty(&self) {
            Ok(content) => match write_file_atomically(&config_path, content.as_bytes()) {
                Ok(_) => true,
                Err(e) => {
                    crate::backend_log_error!("config", "Failed to save config.json: {}", e);
                    false
                }
            },
            Err(e) => {
                crate::backend_log_error!("config", "Failed to serialize config: {}", e);
                false
            }
        }
    }

    pub fn merge(&mut self, other: &serde_json::Value) {
        if let Some(obj) = other.as_object() {
            for (key, value) in obj {
                match key.as_str() {
                    "resource_profiles" => {
                        if let Ok(v) = serde_json::from_value::<Vec<ResourceProfile>>(value.clone())
                        {
                            self.resource_profiles = v;
                        }
                    }
                    "current_resource_index" => {
                        self.current_resource_index = value.as_i64().map(|v| v as i32);
                    }
                    "agent_socket_id" => {
                        self.agent_socket_id = value.as_str().map(|s| s.to_string());
                    }
                    "last_device" => {
                        self.last_device = if value.is_null() {
                            None
                        } else {
                            Some(value.clone())
                        };
                    }
                    "canvas_settings" => {
                        if let Ok(v) = serde_json::from_value::<CanvasSettings>(value.clone()) {
                            self.canvas_settings = v;
                        }
                    }
                    "restore_workspace_on_start" => {
                        self.restore_workspace_on_start = value.as_bool();
                    }
                    "workspace_state" => {
                        if let Ok(v) = serde_json::from_value::<WorkspaceState>(value.clone()) {
                            self.workspace_state = Some(v);
                        }
                    }
                    "last_tabs" => {
                        if let Ok(v) = serde_json::from_value::<LastTabsState>(value.clone()) {
                            self.last_tabs = Some(v);
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn config_with_socket_id(socket_id: &str) -> AppConfig {
        AppConfig {
            agent_socket_id: Some(socket_id.to_owned()),
            ..AppConfig::default()
        }
    }

    #[test]
    fn save_replaces_config_and_keeps_previous_version_as_backup() {
        let dir = tempdir().expect("create temp config directory");
        let config_dir = dir.path().to_str().expect("UTF-8 temp path");
        let first = config_with_socket_id("first");
        let second = config_with_socket_id("second");

        assert!(first.save(config_dir));
        assert_eq!(
            AppConfig::load(config_dir).agent_socket_id.as_deref(),
            Some("first")
        );
        assert!(!dir.path().join(CONFIG_BACKUP_FILE).exists());

        assert!(second.save(config_dir));
        assert_eq!(
            AppConfig::load(config_dir).agent_socket_id.as_deref(),
            Some("second")
        );

        let backup = fs::read_to_string(dir.path().join(CONFIG_BACKUP_FILE))
            .expect("read previous config backup");
        let backup: AppConfig =
            serde_json::from_str(&backup).expect("parse previous config backup");
        assert_eq!(backup.agent_socket_id.as_deref(), Some("first"));
        assert!(
            fs::read_dir(dir.path())
                .expect("list temp config directory")
                .all(|entry| !entry
                    .expect("read directory entry")
                    .file_name()
                    .to_string_lossy()
                    .ends_with(".tmp"))
        );
    }

    #[test]
    fn failed_backup_rotation_leaves_original_config_unchanged() {
        let dir = tempdir().expect("create temp config directory");
        let config_dir = dir.path().to_str().expect("UTF-8 temp path");
        let original = config_with_socket_id("original");
        let replacement = config_with_socket_id("replacement");

        assert!(original.save(config_dir));
        let config_path = dir.path().join(CONFIG_FILE);
        let original_bytes = fs::read(&config_path).expect("read original config");
        fs::create_dir(dir.path().join(CONFIG_BACKUP_FILE)).expect("create backup-path obstacle");

        assert!(!replacement.save(config_dir));
        assert_eq!(
            fs::read(&config_path).expect("read preserved config"),
            original_bytes
        );
        assert_eq!(
            AppConfig::load(config_dir).agent_socket_id.as_deref(),
            Some("original")
        );
        assert!(
            fs::read_dir(dir.path())
                .expect("list temp config directory")
                .all(|entry| !entry
                    .expect("read directory entry")
                    .file_name()
                    .to_string_lossy()
                    .ends_with(".tmp"))
        );
    }

    #[test]
    fn load_recovers_from_backup_when_primary_is_corrupted() {
        let dir = tempdir().expect("create temp config directory");
        let config_dir = dir.path().to_str().expect("UTF-8 temp path");
        assert!(config_with_socket_id("recoverable").save(config_dir));
        assert!(config_with_socket_id("current").save(config_dir));

        fs::write(dir.path().join(CONFIG_FILE), b"{broken").expect("corrupt primary config");

        assert_eq!(
            AppConfig::load(config_dir).agent_socket_id.as_deref(),
            Some("recoverable")
        );
    }
}
