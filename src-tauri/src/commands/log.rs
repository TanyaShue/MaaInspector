use crate::logging::{self, FrontendLogEntry};
use crate::response::ApiResponse;

#[tauri::command]
pub fn log_frontend_batch(entries: Vec<FrontendLogEntry>) -> ApiResponse {
    match logging::write_frontend_batch(&entries) {
        Ok(_) => ApiResponse::ok("Logged"),
        Err(e) => {
            ApiResponse::error_with_status(format!("Failed to write frontend logs: {}", e), 500)
        }
    }
}

#[tauri::command]
pub fn log_get_dir() -> Result<String, String> {
    logging::logs_dir()
        .map(|path| path.to_string_lossy().into_owned())
        .ok_or_else(|| "Logger is not initialized".to_string())
}

#[tauri::command]
pub fn log_read_tail(kind: String, max_lines: Option<usize>) -> Result<Vec<String>, String> {
    logging::read_tail(&kind, max_lines.unwrap_or(100))
}
