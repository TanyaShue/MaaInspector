use super::{MaaFrameworkState, maafw_mut, maafw_ref};
use crate::response::{ApiResponse, ScreenshotResponse};
use tauri::State;

/// Connect to ADB device
#[tauri::command]
pub async fn device_connect_adb(
    maafw: State<'_, MaaFrameworkState>,
    adb_path: String,
    address: String,
    config: serde_json::Value,
    _name: Option<String>,
) -> Result<ApiResponse, String> {
    let mut fw = maafw.lock().await;
    let fw = maafw_mut(&mut fw)?;
    let (success, msg) = fw.connect_adb_async(&adb_path, &address, config).await;

    if success {
        Ok(ApiResponse::ok_with_data(
            "ADB Device Connected",
            serde_json::json!({
                "info": {
                    "detail": msg.unwrap_or_default()
                }
            }),
        ))
    } else {
        Ok(ApiResponse::error_with_status(
            msg.unwrap_or_else(|| "Connect failed".to_string()),
            400,
        ))
    }
}

/// Connect to Win32 window
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn device_connect_win32(
    maafw: State<'_, MaaFrameworkState>,
    hwnd: i64,
    _name: Option<String>,
    _window_name: Option<String>,
    _class_name: Option<String>,
    screencap_method: Option<i32>,
    mouse_method: Option<i32>,
    keyboard_method: Option<i32>,
) -> Result<ApiResponse, String> {
    let mut fw = maafw.lock().await;
    let fw = maafw_mut(&mut fw)?;
    let (success, msg) = fw
        .connect_win32_async(hwnd, screencap_method, mouse_method, keyboard_method)
        .await;

    if success {
        Ok(ApiResponse::ok_with_data(
            "Win32 Device Connected",
            serde_json::json!({
                "info": {
                    "detail": msg.unwrap_or_default()
                }
            }),
        ))
    } else {
        Ok(ApiResponse::error_with_status(
            msg.unwrap_or_else(|| "Connect failed".to_string()),
            400,
        ))
    }
}

/// Get screenshot
#[tauri::command]
pub async fn device_screenshot(
    maafw: State<'_, MaaFrameworkState>,
) -> Result<ScreenshotResponse, String> {
    let mut worker = {
        let fw = maafw.lock().await;
        maafw_ref(&fw)?.detached_worker()
    };

    if let Some((image_base64, size)) = worker.screencap_async().await {
        Ok(ScreenshotResponse {
            success: true,
            message: Some("OK".to_string()),
            image: Some(image_base64),
            size: Some(size),
        })
    } else {
        Ok(ScreenshotResponse {
            success: false,
            message: Some("No image".to_string()),
            image: None,
            size: None,
        })
    }
}
