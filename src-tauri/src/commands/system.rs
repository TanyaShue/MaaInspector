use crate::config::AppConfig;
use crate::maafw::MaaFrameworkWrapper;
use crate::response::ApiResponse;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

/// Get initial system state
#[tauri::command]
pub fn system_init(config_dir: State<'_, String>) -> serde_json::Value {
    let config = AppConfig::load(&config_dir);
    serde_json::to_value(&config).unwrap_or(serde_json::json!({}))
}

/// Pick a local folder and return its absolute path
#[tauri::command]
pub fn system_pick_folder() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

/// Return the centralized resource backup directory, creating it on demand.
#[tauri::command]
pub fn system_get_backup_dir(backup_dir: State<'_, PathBuf>) -> Result<String, String> {
    fs::create_dir_all(backup_dir.inner()).map_err(|error| {
        format!(
            "Failed to create backup directory {}: {}",
            backup_dir.display(),
            error
        )
    })?;
    Ok(backup_dir.to_string_lossy().into_owned())
}

fn open_folder(app: &AppHandle, path: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Failed to create directory {}: {error}", path.display()))?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|error| format!("Failed to open directory {}: {error}", path.display()))
}

/// Open the application log directory from the backend so the path is not
/// rejected by the frontend opener scope.
#[tauri::command]
pub fn system_open_log_dir(app: AppHandle, config_dir: State<'_, String>) -> Result<(), String> {
    open_folder(&app, &PathBuf::from(config_dir.inner()).join("logs"))
}

/// Open the centralized resource backup directory.
#[tauri::command]
pub fn system_open_backup_dir(
    app: AppHandle,
    backup_dir: State<'_, PathBuf>,
) -> Result<(), String> {
    open_folder(&app, backup_dir.inner())
}

/// Save configuration
#[tauri::command]
pub fn system_save_config(
    config_dir: State<'_, String>,
    config_data: serde_json::Value,
) -> ApiResponse {
    let mut config = AppConfig::load(&config_dir);
    config.merge(&config_data);

    if config.save(&config_dir) {
        ApiResponse::ok("Saved")
    } else {
        ApiResponse::error_with_status("Save failed", 500)
    }
}

/// Search for devices (ADB and/or Win32)
#[tauri::command]
pub fn system_search_devices(device_type: Option<String>) -> serde_json::Value {
    let req_type = device_type.map(|s| s.to_lowercase()).unwrap_or_default();
    let want_adb = req_type.is_empty() || req_type == "adb";
    let want_win32 = req_type.is_empty() || req_type == "win32control";

    let mut devices = Vec::new();

    if want_adb {
        let adb_devices = MaaFrameworkWrapper::find_adb_devices();
        devices.extend(adb_devices);
    }
    if want_win32 {
        let win32_devices = MaaFrameworkWrapper::find_desktop_windows();
        devices.extend(win32_devices);
    }

    serde_json::json!({
        "message": "OK",
        "devices": devices
    })
}
