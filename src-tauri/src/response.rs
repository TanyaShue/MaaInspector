use serde::{Deserialize, Serialize};

/// Standard API response structure matching Python backend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(flatten)]
    pub data: Option<serde_json::Value>,
}

impl ApiResponse {
    pub fn ok(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: Some(message.into()),
            data: None,
        }
    }

    pub fn ok_with_data(message: impl Into<String>, data: serde_json::Value) -> Self {
        Self {
            success: true,
            message: Some(message.into()),
            data: Some(data),
        }
    }

    pub fn error_with_status(message: impl Into<String>, _status: u16) -> Self {
        Self {
            success: false,
            message: Some(message.into()),
            data: None,
        }
    }
}

/// Resource file info for list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceFileInfo {
    pub label: String,
    pub value: Option<String>,
    pub source: String,
    pub filename: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomCompletionOption {
    pub value: String,
    pub title: Option<String>,
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub param_schema: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CustomCompletionRules {
    #[serde(default)]
    pub action: Vec<CustomCompletionOption>,
    #[serde(default)]
    pub recognition: Vec<CustomCompletionOption>,
}

/// Resource load response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLoadResponse {
    pub r: bool,
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list: Option<Vec<ResourceFileInfo>>,
    /// Whether MaaFramework successfully loaded the resource
    #[serde(default)]
    pub maafw_loaded: bool,
    /// MaaFramework load message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maafw_message: Option<String>,
    #[serde(default)]
    pub custom_completions: CustomCompletionRules,
}

/// File nodes response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNodesResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nodes: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list: Option<Vec<ResourceFileInfo>>,
}

/// Screenshot response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<Vec<i32>>,
}

/// OCR candidate item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrRecognitionCandidate {
    #[serde(skip_serializing_if = "Option::is_none", rename = "box")]
    pub bbox: Option<Vec<i32>>,
    pub score: f64,
    pub text: String,
}

/// OCR recognition response payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrRecognitionResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best: Option<OcrRecognitionCandidate>,
    #[serde(default)]
    pub all: Vec<OcrRecognitionCandidate>,
    #[serde(default)]
    pub filtered: Vec<OcrRecognitionCandidate>,
}

/// Debug stream event payload
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DebugStreamPayload {
    #[serde(rename = "type")]
    pub event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempt_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_list: Option<Vec<NextListNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focus: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reco_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NextListNode {
    pub name: String,
    pub jump_back: bool,
    pub anchor: bool,
}

/// Recognition detail response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoDetailResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<RecognitionDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecognitionDetail {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reco_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub algorithm: Option<String>,
    pub hit: bool,
    #[serde(skip_serializing_if = "Option::is_none", rename = "box")]
    pub bbox: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub all_results: Option<Vec<BoxScore>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filtered_results: Option<Vec<BoxScore>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best_result: Option<BoxScore>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_detail: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub draw_images: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoxScore {
    #[serde(skip_serializing_if = "Option::is_none", rename = "box")]
    pub bbox: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_response_ok() {
        let response = ApiResponse::ok("Test message");
        assert!(response.success);
        assert_eq!(response.message, Some("Test message".to_string()));
        assert!(response.data.is_none());
    }

    #[test]
    fn test_api_response_ok_with_data() {
        let data = serde_json::json!({ "key": "value" });
        let response = ApiResponse::ok_with_data("Success", data.clone());
        assert!(response.success);
        assert_eq!(response.message, Some("Success".to_string()));
        assert_eq!(response.data, Some(data));
    }

    #[test]
    fn test_api_response_error() {
        let response = ApiResponse::error_with_status("Error occurred", 400);
        assert!(!response.success);
        assert_eq!(response.message, Some("Error occurred".to_string()));
        assert!(response.data.is_none());
    }

    #[test]
    fn test_api_response_serialization() {
        let response = ApiResponse::ok_with_data("Test", serde_json::json!({ "id": 123 }));
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"message\":\"Test\""));
        assert!(json.contains("\"id\":123"));
    }

    #[test]
    fn test_resource_file_info() {
        let info = ResourceFileInfo {
            label: "test.json".to_string(),
            value: Some("test".to_string()),
            source: "/path/to/resource".to_string(),
            filename: Some("test.json".to_string()),
        };
        assert_eq!(info.label, "test.json");
        assert!(info.value.is_some());
    }
}
