use super::{MaaFrameworkState, maafw_mut, maafw_ref};
use crate::response::{ApiResponse, RecoDetailResponse};
use tauri::Manager;
use tauri::State;

/// Run debug node
#[tauri::command]
pub async fn debug_run_node(
    maafw: State<'_, MaaFrameworkState>,
    node: serde_json::Value,
    debug_mode: Option<String>,
) -> Result<ApiResponse, String> {
    let mut fw = maafw.lock().await;
    let fw = maafw_mut(&mut fw)?;

    // Extract node id
    let node_id = node.get("id").and_then(|v| v.as_str()).unwrap_or("");

    if node_id.is_empty() {
        return Ok(ApiResponse::error_with_status("Missing node id", 400));
    }

    // Convert node to pipeline override format
    let mut pipeline_override = serde_json::Map::new();
    let mut node_data = node.clone();

    if let Some(obj) = node_data.as_object_mut() {
        // Remove id field
        obj.remove("id");

        // If recognition_only mode, modify the node
        if debug_mode.as_deref() == Some("recognition_only") {
            obj.insert("next".to_string(), serde_json::Value::Array(vec![]));
            obj.insert("on_error".to_string(), serde_json::Value::Array(vec![]));
            obj.insert(
                "action".to_string(),
                serde_json::Value::String("DoNothing".to_string()),
            );
        }
    }

    pipeline_override.insert(node_id.to_string(), node_data);

    // Run task
    let override_json = serde_json::Value::Object(pipeline_override);
    let error = fw.run_task(node_id, override_json);

    if let Some(e) = error {
        Ok(ApiResponse::error_with_status(e, 500))
    } else {
        Ok(ApiResponse::ok("debug_return"))
    }
}

/// Stop debug task
#[tauri::command]
pub async fn debug_stop(maafw: State<'_, MaaFrameworkState>) -> Result<ApiResponse, String> {
    let mut fw = maafw.lock().await;
    let fw = maafw_mut(&mut fw)?;
    fw.stop_task();
    Ok(ApiResponse::ok("debug_return"))
}

/// Get debug status
#[tauri::command]
pub async fn debug_status(maafw: State<'_, MaaFrameworkState>) -> Result<ApiResponse, String> {
    let fw = maafw.lock().await;
    let fw = maafw_ref(&fw)?;
    let running = fw.is_running();
    Ok(ApiResponse::ok_with_data(
        "debug_return_running",
        serde_json::json!({ "running": running }),
    ))
}

/// OCR text recognition
#[tauri::command]
pub async fn debug_ocr_text(
    maafw: State<'_, MaaFrameworkState>,
    roi: Vec<i32>,
) -> Result<ApiResponse, String> {
    if roi.len() != 4 {
        return Ok(ApiResponse::error_with_status(
            "Missing or invalid roi",
            400,
        ));
    }

    let mut worker = {
        let fw = maafw.lock().await;
        maafw_ref(&fw)?.detached_worker()
    };
    let roi_array = [roi[0], roi[1], roi[2], roi[3]];

    match worker.ocr_text_async(roi_array).await {
        Ok(result) => Ok(ApiResponse::ok_with_data(
            "OK",
            serde_json::to_value(result).unwrap_or(serde_json::Value::Null),
        )),
        Err(e) => Ok(ApiResponse::error_with_status(&e, 500)),
    }
}

/// Get recognition details
#[tauri::command]
pub async fn debug_get_reco_details(
    maafw: State<'_, MaaFrameworkState>,
    reco_id: i32,
) -> Result<RecoDetailResponse, String> {
    let fw = maafw.lock().await;
    let fw = maafw_ref(&fw)?;

    match fw.get_reco_detail(reco_id) {
        Some(detail) => Ok(RecoDetailResponse {
            success: true,
            message: "detail".to_string(),
            detail: Some(detail),
        }),
        None => Ok(RecoDetailResponse {
            success: false,
            message: "No detail".to_string(),
            detail: None,
        }),
    }
}

/// Open DevTools (works in production)
#[tauri::command]
pub async fn devtools_open(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
    }
    Ok(())
}
