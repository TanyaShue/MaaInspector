// MaaInspector - Rust backend using maa-framework-rs

mod commands;
mod config;
mod events;
mod logging;
mod maafw;
mod resources;
mod response;

use commands::{
    agent_connect, debug_get_reco_details, debug_ocr_text, debug_run_node, debug_status,
    debug_stop, device_connect_adb, device_connect_win32, device_screenshot, devtools_open,
    log_frontend_batch, log_get_dir, resource_check_unused_images, resource_create_file,
    resource_get_file_nodes, resource_get_templates, resource_load, resource_process_images,
    resource_save_file_nodes, resource_search_nodes, system_init, system_pick_folder,
    system_save_config, system_search_devices,
};
use events::DebugEventBroker;
use maafw::MaaFrameworkWrapper;
use resources::ResourcesManagerState;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use tauri::Manager;
use tokio::sync::Mutex;

const MAA_FRAMEWORK_DIR: &str = "maa-framework";

fn append_maa_dll_candidate(candidates: &mut Vec<PathBuf>, path: impl AsRef<Path>) {
    let path = path.as_ref();
    candidates.push(
        path.join(MAA_FRAMEWORK_DIR)
            .join("bin")
            .join("MaaFramework.dll"),
    );
    candidates.push(path.join("bin").join("MaaFramework.dll"));
    candidates.push(path.join("MaaFramework.dll"));
}

fn resolve_app_data_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| {
        format!(
            "Failed to create app data directory {}: {}",
            dir.display(),
            e
        )
    })?;
    Ok(dir)
}

/// Load MaaFramework from a stable SDK directory in dev and bundled resources in production.
fn load_maa_library<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        append_maa_dll_candidate(&mut candidates, resource_dir);
    }

    if let Ok(sdk_path) = std::env::var("MAA_SDK_PATH") {
        append_maa_dll_candidate(&mut candidates, PathBuf::from(sdk_path));
    }

    if let Ok(current_dir) = std::env::current_dir() {
        append_maa_dll_candidate(&mut candidates, current_dir.join(MAA_FRAMEWORK_DIR));
        append_maa_dll_candidate(
            &mut candidates,
            current_dir.join("src-tauri").join(MAA_FRAMEWORK_DIR),
        );
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            append_maa_dll_candidate(&mut candidates, exe_dir);
        }
    }

    let dll_path = candidates.iter().find(|p| p.exists()).cloned();

    match dll_path {
        Some(path) => {
            maa_framework::load_library(&path).map_err(|e| {
                format!(
                    "Failed to load MaaFramework.dll from {}: {}",
                    path.display(),
                    e
                )
            })?;
            crate::backend_log_info!("lib", "Loaded MaaFramework.dll from: {}", path.display());
            Ok(())
        }
        None => {
            let tried_paths = candidates
                .iter()
                .map(|p| format!("  - {}", p.display()))
                .collect::<Vec<_>>()
                .join("\n");
            Err(format!(
                "MaaFramework.dll not found. Tried:\n{}",
                tried_paths
            ))
        }
    }
}

/// Tauri library entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let maafw: Mutex<Option<MaaFrameworkWrapper>> = Mutex::new(None);
    let resources_manager: ResourcesManagerState = Arc::new(RwLock::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = resolve_app_data_dir(app.handle()).map_err(|e| {
                Box::<dyn std::error::Error>::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    e,
                ))
            })?;
            logging::init(&app_data_dir).map_err(|e| {
                Box::<dyn std::error::Error>::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    e,
                ))
            })?;
            load_maa_library(app.handle()).map_err(|e| {
                Box::<dyn std::error::Error>::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    e,
                ))
            })?;

            let broker = DebugEventBroker::new_with_handle(app.handle().clone());
            let broker_arc = Arc::new(broker);
            let mut maafw = MaaFrameworkWrapper::new(&app_data_dir);
            maafw.set_event_broker(broker_arc);

            let maafw_state = app.state::<Mutex<Option<MaaFrameworkWrapper>>>();
            *maafw_state.blocking_lock() = Some(maafw);
            app.manage(app_data_dir.to_string_lossy().to_string());

            Ok(())
        })
        .manage(maafw)
        .manage(resources_manager)
        .invoke_handler(tauri::generate_handler![
            // System commands
            system_init,
            system_pick_folder,
            system_save_config,
            system_search_devices,
            // Device commands
            device_connect_adb,
            device_connect_win32,
            device_screenshot,
            // Resource commands
            resource_load,
            resource_get_file_nodes,
            resource_save_file_nodes,
            resource_create_file,
            resource_search_nodes,
            resource_get_templates,
            resource_check_unused_images,
            resource_process_images,
            // Agent commands
            agent_connect,
            // Debug commands
            debug_run_node,
            debug_stop,
            debug_status,
            debug_ocr_text,
            debug_get_reco_details,
            devtools_open,
            log_frontend_batch,
            log_get_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
