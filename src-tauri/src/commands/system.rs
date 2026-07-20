use crate::app_paths::AppPaths;
use crate::config::{AgentProfile, AppConfig, ResourceProfile};
use crate::maafw::MaaFrameworkWrapper;
use crate::response::ApiResponse;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

/// Get initial system state
#[tauri::command]
pub fn system_init(paths: State<'_, AppPaths>) -> serde_json::Value {
    let config = AppConfig::load_path(&paths.config_dir);
    let mut value = serde_json::to_value(&config).unwrap_or(serde_json::json!({}));
    if let Some(object) = value.as_object_mut() {
        object.insert(
            "storage_paths".to_string(),
            serde_json::json!({
                "log_dir": paths.log_dir,
                "config_dir": paths.config_dir,
                "default_config_dir": paths.default_config_dir,
            }),
        );
    }
    value
}

/// Pick a local folder and return its absolute path
#[tauri::command]
pub fn system_pick_folder() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

/// Import resource profiles and Agent launch settings from a MaaFramework
/// Project Interface V2 file.
#[tauri::command]
pub fn system_import_interface() -> Result<serde_json::Value, String> {
    let path = rfd::FileDialog::new()
        .add_filter("MaaFramework interface", &["json"])
        .set_file_name("interface.json")
        .pick_file()
        .ok_or_else(|| "已取消导入".to_string())?;
    import_interface_file(&path)
}

fn import_interface_file(path: &std::path::Path) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(path)
        .map_err(|error| format!("无法读取 {}: {error}", path.display()))?;
    let interface: serde_json::Value = serde_json::from_str(&content)
        .map_err(|error| format!("interface.json 格式错误: {error}"))?;
    if interface
        .get("interface_version")
        .and_then(|value| value.as_i64())
        != Some(2)
    {
        return Err("仅支持 interface_version 为 2 的配置".to_string());
    }

    let root = path
        .parent()
        .ok_or_else(|| "interface.json 没有有效的父目录".to_string())?;
    let project_name = interface
        .get("label")
        .or_else(|| interface.get("name"))
        .and_then(|value| value.as_str())
        .unwrap_or("Imported");
    let project_id = interface
        .get("name")
        .and_then(|value| value.as_str())
        .unwrap_or("imported");
    let project_version = interface
        .get("version")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    let agent_value = match interface.get("agent") {
        Some(serde_json::Value::Array(items)) => items.first(),
        value => value,
    };

    let resources = interface
        .get("resource")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "interface.json 中没有 resource 数组".to_string())?;
    let import_stamp = chrono::Utc::now().timestamp_millis();
    let mut profiles = Vec::new();

    for resource in resources {
        let resource_name = resource
            .get("label")
            .or_else(|| resource.get("name"))
            .and_then(|value| value.as_str())
            .unwrap_or("Resource");
        let paths = resource
            .get("path")
            .and_then(|value| value.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str())
                    .map(|item| {
                        let candidate = PathBuf::from(item);
                        if candidate.is_absolute() {
                            candidate
                        } else {
                            root.join(candidate)
                        }
                        .to_string_lossy()
                        .into_owned()
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let agent = agent_value.and_then(|value| {
            let child_exec = value.get("child_exec")?.as_str()?.to_string();
            let child_args = value
                .get("child_args")
                .and_then(|args| args.as_array())
                .map(|args| {
                    args.iter()
                        .filter_map(|arg| arg.as_str().map(ToOwned::to_owned))
                        .collect()
                })
                .unwrap_or_default();
            let socket_id = value
                .get("identifier")
                .and_then(|identifier| identifier.as_str())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| {
                    let slug = format!("{project_id}-{resource_name}")
                        .chars()
                        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
                        .collect::<String>();
                    format!("maa-inspector-{slug}-{import_stamp}")
                });
            let mut environment = std::collections::HashMap::new();
            environment.insert("PI_INTERFACE_VERSION".to_string(), "v2.5.0".to_string());
            environment.insert("PI_CLIENT_NAME".to_string(), "MaaInspector".to_string());
            environment.insert("PI_CLIENT_LANGUAGE".to_string(), "zh_cn".to_string());
            environment.insert("PI_VERSION".to_string(), project_version.to_string());
            environment.insert("PI_RESOURCE".to_string(), resource.to_string());
            Some(AgentProfile {
                child_exec,
                child_args,
                working_directory: root.to_string_lossy().into_owned(),
                socket_id,
                auto_start: true,
                environment,
            })
        });

        profiles.push(ResourceProfile {
            name: Some(format!("{project_name} · {resource_name}")),
            paths: Some(paths),
            schema_path: None,
            interface_path: Some(path.to_string_lossy().into_owned()),
            agent,
        });
    }

    if profiles.is_empty() {
        return Err("interface.json 中没有可导入的资源配置".to_string());
    }
    Ok(serde_json::json!({
        "profiles": profiles,
        "interface_path": path.to_string_lossy(),
        "project_name": project_name
    }))
}

#[cfg(test)]
mod interface_tests {
    use super::*;

    #[test]
    fn imports_resource_paths_and_agent_settings() {
        let dir = tempfile::tempdir().unwrap();
        let interface_path = dir.path().join("interface.json");
        fs::write(
            &interface_path,
            r#"{
                "interface_version": 2,
                "name": "Demo",
                "label": "演示",
                "version": "1.2.3",
                "resource": [
                    { "name": "Official", "label": "官服", "path": ["./base", "./official"] }
                ],
                "agent": {
                    "child_exec": ".\\agent\\agent.exe",
                    "child_args": ["--mode", "debug"]
                }
            }"#,
        )
        .unwrap();

        let imported = import_interface_file(&interface_path).unwrap();
        let profile = &imported["profiles"][0];
        assert_eq!(profile["name"], "演示 · 官服");
        assert_eq!(
            profile["paths"][0],
            dir.path().join("./base").to_string_lossy().as_ref()
        );
        assert_eq!(profile["agent"]["child_exec"], ".\\agent\\agent.exe");
        assert_eq!(
            profile["agent"]["working_directory"],
            dir.path().to_string_lossy().as_ref()
        );
        assert_eq!(profile["agent"]["child_args"][1], "debug");
        assert_eq!(profile["agent"]["environment"]["PI_VERSION"], "1.2.3");
    }
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
pub fn system_open_log_dir(app: AppHandle, paths: State<'_, AppPaths>) -> Result<(), String> {
    open_folder(&app, &paths.log_dir)
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
    paths: State<'_, AppPaths>,
    config_data: serde_json::Value,
) -> ApiResponse {
    let mut config = AppConfig::load_path(&paths.config_dir);
    config.merge(&config_data);

    if config.save(&paths.config_dir.to_string_lossy()) {
        ApiResponse::ok("Saved")
    } else {
        ApiResponse::error_with_status("Save failed", 500)
    }
}

#[tauri::command]
pub fn system_set_storage(
    paths: State<'_, AppPaths>,
    log_dir: String,
    config_dir: String,
) -> Result<ApiResponse, String> {
    let log_dir = PathBuf::from(log_dir.trim());
    if log_dir.as_os_str().is_empty() {
        return Err("日志目录不能为空".to_string());
    }
    fs::create_dir_all(&log_dir)
        .map_err(|error| format!("无法创建日志目录 {}: {error}", log_dir.display()))?;

    let config_dir = PathBuf::from(config_dir.trim());
    if config_dir.as_os_str().is_empty() {
        return Err("config.json 目录不能为空".to_string());
    }
    let config_path = config_dir.join("config.json");
    let mut config = if config_path.is_file() {
        AppConfig::validate_file(&config_path)?
    } else if config_dir == paths.config_dir || config_dir == paths.default_config_dir {
        AppConfig::load_path(&paths.config_dir)
    } else {
        return Err(format!("未找到配置文件: {}", config_path.display()));
    };
    config.storage_settings.log_dir = Some(log_dir.to_string_lossy().into_owned());
    if !config.save(&config_dir.to_string_lossy()) {
        return Err("无法保存所选 config.json".to_string());
    }
    paths.save_config_location(&config_dir)?;

    Ok(ApiResponse::ok_with_data(
        "存储设置已保存，重启后生效",
        serde_json::json!({ "restart_required": true }),
    ))
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
