use crate::response::{DebugStreamPayload, NextListNode};
use tauri::{AppHandle, Emitter};

/// Event names for debug streaming
pub const EVENT_NODE_NEXT_LIST: &str = "debug:node_next_list";
pub const EVENT_NODE_RECOGNITION: &str = "debug:node_recognition";
pub const EVENT_NODE_ACTION: &str = "debug:node_action";

/// Debug event broker - manages event emission to frontend
pub struct DebugEventBroker {
    app_handle: Option<AppHandle>,
}

impl DebugEventBroker {
    pub fn new() -> Self {
        Self { app_handle: None }
    }

    pub fn new_with_handle(app_handle: AppHandle) -> Self {
        Self {
            app_handle: Some(app_handle),
        }
    }

    pub fn emit_node_next_list(
        &self,
        attempt_id: String,
        task_id: i32,
        name: String,
        next_list: Vec<(String, bool, bool)>,
        status: String,
        focus: Option<serde_json::Value>,
    ) {
        if let Some(ref handle) = self.app_handle {
            let next_list_nodes: Vec<NextListNode> = next_list
                .iter()
                .map(|(n, jb, a)| NextListNode {
                    name: n.clone(),
                    jump_back: *jb,
                    anchor: *a,
                })
                .collect();

            let payload = DebugStreamPayload {
                event_type: "node_next_list".to_string(),
                attempt_id: Some(attempt_id),
                task_id: Some(task_id),
                name: Some(name),
                next_list: Some(next_list_nodes),
                status: Some(status),
                focus,
                timestamp: Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0),
                ),
                ..Default::default()
            };

            crate::backend_log_debug!(
                "stderr",
                "[ContextSink] Emitting frontend event \"{}\" with payload: {}",
                EVENT_NODE_NEXT_LIST,
                serde_json::to_string_pretty(&payload).unwrap_or_else(|_| format!("{:?}", payload))
            );
            if let Err(e) = handle.emit(EVENT_NODE_NEXT_LIST, payload) {
                crate::backend_log_debug!(
                    "stderr",
                    "[ContextSink] Failed to emit frontend event \"{}\": {}",
                    EVENT_NODE_NEXT_LIST,
                    e
                );
            } else {
                crate::backend_log_debug!(
                    "stderr",
                    "[ContextSink] Frontend event \"{}\" emitted successfully",
                    EVENT_NODE_NEXT_LIST
                );
            }
        } else {
            crate::backend_log_debug!(
                "stderr",
                "[ContextSink] Skipped frontend event \"{}\" because AppHandle is not available",
                EVENT_NODE_NEXT_LIST
            );
        }
    }

    pub fn emit_node_recognition(
        &self,
        attempt_id: Option<String>,
        task_id: i32,
        reco_id: i32,
        name: String,
        status: String,
        focus: Option<serde_json::Value>,
    ) {
        if let Some(ref handle) = self.app_handle {
            let payload = DebugStreamPayload {
                event_type: "node_recognition".to_string(),
                attempt_id,
                task_id: Some(task_id),
                reco_id: Some(reco_id),
                name: Some(name),
                status: Some(status),
                focus,
                timestamp: Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0),
                ),
                ..Default::default()
            };

            crate::backend_log_debug!(
                "stderr",
                "[ContextSink] Emitting frontend event \"{}\" with payload: {}",
                EVENT_NODE_RECOGNITION,
                serde_json::to_string_pretty(&payload).unwrap_or_else(|_| format!("{:?}", payload))
            );
            if let Err(e) = handle.emit(EVENT_NODE_RECOGNITION, payload) {
                crate::backend_log_debug!(
                    "stderr",
                    "[ContextSink] Failed to emit frontend event \"{}\": {}",
                    EVENT_NODE_RECOGNITION,
                    e
                );
            } else {
                crate::backend_log_debug!(
                    "stderr",
                    "[ContextSink] Frontend event \"{}\" emitted successfully",
                    EVENT_NODE_RECOGNITION
                );
            }
        } else {
            crate::backend_log_debug!(
                "stderr",
                "[ContextSink] Skipped frontend event \"{}\" because AppHandle is not available",
                EVENT_NODE_RECOGNITION
            );
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn emit_node_action(
        &self,
        attempt_id: Option<String>,
        task_id: i32,
        action_id: i32,
        node_id: i32,
        name: String,
        status: String,
        focus: Option<serde_json::Value>,
    ) {
        if let Some(ref handle) = self.app_handle {
            let payload = DebugStreamPayload {
                event_type: "node_action".to_string(),
                attempt_id,
                task_id: Some(task_id),
                action_id: Some(action_id),
                node_id: Some(node_id),
                name: Some(name),
                status: Some(status),
                focus,
                timestamp: Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0),
                ),
                ..Default::default()
            };

            crate::backend_log_debug!(
                "stderr",
                "[ContextSink] Emitting frontend event \"{}\" with payload: {}",
                EVENT_NODE_ACTION,
                serde_json::to_string_pretty(&payload).unwrap_or_else(|_| format!("{:?}", payload))
            );
            if let Err(e) = handle.emit(EVENT_NODE_ACTION, payload) {
                crate::backend_log_debug!(
                    "stderr",
                    "[ContextSink] Failed to emit frontend event \"{}\": {}",
                    EVENT_NODE_ACTION,
                    e
                );
            } else {
                crate::backend_log_debug!(
                    "stderr",
                    "[ContextSink] Frontend event \"{}\" emitted successfully",
                    EVENT_NODE_ACTION
                );
            }
        } else {
            crate::backend_log_debug!(
                "stderr",
                "[ContextSink] Skipped frontend event \"{}\" because AppHandle is not available",
                EVENT_NODE_ACTION
            );
        }
    }
}

impl Default for DebugEventBroker {
    fn default() -> Self {
        Self::new()
    }
}
