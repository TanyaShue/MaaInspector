// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::async_runtime;

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            // 在后台启动Python Flask服务器
            // 我们假设 'python' 在系统的PATH中
            // '..\\backend\\app.py' 是相对于 'src-tauri' 目录的路径
            async_runtime::spawn(async {
                Command::new("python")
                    .args(["..\\backend\\app.py"])
                    .spawn()
                    .expect("Failed to spawn backend server");
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
