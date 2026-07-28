use super::{MaaFrameworkState, maafw_mut, maafw_ref};
use crate::maafw::resource as maafw_resource;
use crate::resources::ResourcesManagerState;
use crate::response::{ActionDetailResponse, ApiResponse, RecoDetailResponse};
use tauri::Manager;
use tauri::State;

const ACTION_PARAM_KEYS: &[&str] = &[
    "target",
    "target_offset",
    "contact",
    "pressure",
    "duration",
    "begin",
    "begin_offset",
    "end",
    "end_offset",
    "end_hold",
    "only_hover",
    "swipes",
    "starting",
    "dx",
    "dy",
    "key",
    "input_text",
    "package",
    "exec",
    "args",
    "detach",
    "cmd",
    "custom_action",
    "custom_action_param",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum DebugMode {
    Direct,
    RecognitionOnly,
    SingleNode,
}

impl DebugMode {
    fn parse(value: Option<&str>) -> Result<Self, String> {
        match value.unwrap_or("direct") {
            "direct" | "standard" => Ok(Self::Direct),
            "recognition_only" => Ok(Self::RecognitionOnly),
            "single_node" => Ok(Self::SingleNode),
            value => Err(format!("Unsupported debug mode: {value}")),
        }
    }
}

fn build_pipeline_override(
    node: &serde_json::Value,
    mode: DebugMode,
) -> Result<serde_json::Value, String> {
    if mode == DebugMode::Direct {
        return Ok(serde_json::json!({}));
    }

    let node_id = node
        .get("id")
        .and_then(|value| value.as_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Missing node id".to_string())?;
    let mut node_data = node
        .as_object()
        .cloned()
        .ok_or_else(|| "Invalid node data".to_string())?;
    node_data.remove("id");
    node_data.remove("next");
    node_data.remove("on_error");

    if mode == DebugMode::RecognitionOnly {
        node_data.remove("action");
        for key in ACTION_PARAM_KEYS {
            node_data.remove(*key);
        }
    }

    let mut pipeline_override = serde_json::Map::new();
    pipeline_override.insert(node_id.to_string(), serde_json::Value::Object(node_data));
    Ok(serde_json::Value::Object(pipeline_override))
}

/// Run debug node
#[tauri::command]
pub async fn debug_run_node(
    maafw: State<'_, MaaFrameworkState>,
    resources_manager: State<'_, ResourcesManagerState>,
    node: serde_json::Value,
    debug_mode: Option<String>,
) -> Result<ApiResponse, String> {
    let node_id = node.get("id").and_then(|v| v.as_str()).unwrap_or("");
    if node_id.is_empty() {
        return Ok(ApiResponse::error_with_status("Missing node id", 400));
    }
    let mode = match DebugMode::parse(debug_mode.as_deref()) {
        Ok(mode) => mode,
        Err(error) => return Ok(ApiResponse::error_with_status(error, 400)),
    };
    let pipeline_override = match build_pipeline_override(&node, mode) {
        Ok(value) => value,
        Err(error) => return Ok(ApiResponse::error_with_status(error, 400)),
    };

    let resource_paths = {
        let guard = resources_manager
            .read()
            .map_err(|_| "ResourcesManager lock is poisoned".to_string())?;
        guard
            .as_ref()
            .ok_or_else(|| "ResourcesManager not initialized".to_string())?
            .resource_paths()
    };
    let (resource_loaded, resource_message, loaded_resource) =
        maafw_resource::load_resource_async(None, &resource_paths).await;
    if !resource_loaded {
        return Ok(ApiResponse::error_with_status(
            resource_message.unwrap_or_else(|| "Failed to reload resources".to_string()),
            500,
        ));
    }

    let mut fw = maafw.lock().await;
    let fw = maafw_mut(&mut fw)?;
    fw.set_resource(loaded_resource);

    // Run task
    let error = fw.run_task(node_id, pipeline_override);

    if let Some(e) = error {
        Ok(ApiResponse::error_with_status(e, 500))
    } else {
        Ok(ApiResponse::ok("debug_return"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_node() -> serde_json::Value {
        serde_json::json!({
            "id": "Start",
            "recognition": "OCR",
            "expected": "hello",
            "action": "Click",
            "target": [100, 200],
            "duration": 500,
            "next": ["Next"],
            "on_error": ["Error"],
            "timeout_next": ["Timeout"]
        })
    }

    #[test]
    fn direct_mode_runs_the_saved_resource_without_an_override() {
        assert_eq!(
            build_pipeline_override(&sample_node(), DebugMode::Direct).unwrap(),
            serde_json::json!({})
        );
    }

    #[test]
    fn single_node_mode_only_removes_outgoing_links() {
        let result = build_pipeline_override(&sample_node(), DebugMode::SingleNode).unwrap();
        let node = result
            .get("Start")
            .and_then(|value| value.as_object())
            .unwrap();

        assert!(!node.contains_key("next"));
        assert!(!node.contains_key("on_error"));
        assert_eq!(node.get("action"), Some(&serde_json::json!("Click")));
        assert_eq!(node.get("target"), Some(&serde_json::json!([100, 200])));
        assert!(node.contains_key("timeout_next"));
    }

    #[test]
    fn recognition_only_mode_removes_action_and_its_parameters() {
        let result = build_pipeline_override(&sample_node(), DebugMode::RecognitionOnly).unwrap();
        let node = result
            .get("Start")
            .and_then(|value| value.as_object())
            .unwrap();

        assert!(!node.contains_key("next"));
        assert!(!node.contains_key("on_error"));
        assert!(!node.contains_key("action"));
        assert!(!node.contains_key("target"));
        assert!(!node.contains_key("duration"));
        assert_eq!(node.get("recognition"), Some(&serde_json::json!("OCR")));
        assert_eq!(node.get("expected"), Some(&serde_json::json!("hello")));
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

/// Get action details
#[tauri::command]
pub async fn debug_get_action_details(
    maafw: State<'_, MaaFrameworkState>,
    action_id: i32,
) -> Result<ActionDetailResponse, String> {
    let fw = maafw.lock().await;
    let fw = maafw_ref(&fw)?;

    match fw.get_action_detail(action_id) {
        Some(detail) => Ok(ActionDetailResponse {
            success: true,
            message: "detail".to_string(),
            detail: Some(detail),
        }),
        None => Ok(ActionDetailResponse {
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
