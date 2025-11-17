// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::{Manager, WindowEvent};

// 使用Tauri的State管理功能来保存子进程的句柄
struct AppState(Mutex<Option<Child>>);

fn main() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(None)))
        .setup(|app| {
            let app_handle = app.app_handle();
            let state = app.state::<AppState>();

            let resource_dir = app_handle.path()
                .resource_dir()
                .expect("failed to resolve resource directory");

            let python_exe = resource_dir.join("python-runtime\\python.exe");
            let script = resource_dir.join("python-runtime\\app.py");

            #[cfg(not(debug_assertions))]
            let mut command = Command::new(python_exe);
            #[cfg(not(debug_assertions))]
            command.arg(script).creation_flags(0x08000000);

            #[cfg(debug_assertions)]
            let mut command = Command::new(python_exe);
            #[cfg(debug_assertions)]
            command.arg(script);

            let child = command.spawn().expect("Failed to spawn backend");

            *state.0.lock().unwrap() = Some(child);
            
            Ok(())
        })
        .on_window_event(|window, event| {
            // 监听窗口销毁事件
            if let WindowEvent::Destroyed = event {
                // 从State中获取子进程句柄并终止它
                if let Some(mut child) = window.state::<AppState>().0.lock().unwrap().take() {
                    child.kill().expect("Failed to kill backend process");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
