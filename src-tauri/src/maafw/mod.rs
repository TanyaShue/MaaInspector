mod controller;
mod image;
mod resource;
mod tasker;

use crate::config::DeviceInfo;
use crate::events::DebugEventBroker;
use crate::response::{OcrRecognitionCandidate, OcrRecognitionResponse, RecognitionDetail};
use controller::wait_with_timeout;
use maa_framework::controller::Controller;
use maa_framework::resource::Resource;
use maa_framework::sys;
use maa_framework::tasker::Tasker;
use maa_framework::{set_debug_mode, toolkit::Toolkit};
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Debug, Clone, serde::Deserialize)]
struct OcrDetailBundle {
    all: Vec<OcrRecognitionCandidate>,
    best: Option<OcrRecognitionCandidate>,
    filtered: Vec<OcrRecognitionCandidate>,
}

fn ocr_bundle_to_response(bundle: OcrDetailBundle) -> OcrRecognitionResponse {
    let text = bundle.best.as_ref().map(|item| item.text.clone());
    OcrRecognitionResponse {
        text,
        best: bundle.best,
        all: bundle.all,
        filtered: bundle.filtered,
    }
}

fn ocr_result_to_response(
    text: String,
    candidate: OcrRecognitionCandidate,
) -> OcrRecognitionResponse {
    OcrRecognitionResponse {
        text: Some(text),
        best: Some(candidate.clone()),
        all: vec![candidate.clone()],
        filtered: vec![candidate],
    }
}

/// Timeout for controller operations (screencap, etc.)
const CONTROLLER_TIMEOUT_MS: u64 = 30000;

/// Async wait for controller operation with timeout using spawn_blocking
async fn wait_with_timeout_async(controller: &Controller, id: sys::MaaId, timeout_ms: u64) -> bool {
    let ctrl_clone = controller.clone();
    tokio::task::spawn_blocking(move || wait_with_timeout(&ctrl_clone, id, timeout_ms))
        .await
        .unwrap_or(false)
}

/// Async wait with default timeout
async fn wait_with_default_timeout_async(controller: &Controller, id: sys::MaaId) -> bool {
    wait_with_timeout_async(controller, id, CONTROLLER_TIMEOUT_MS).await
}

/// MaaFramework wrapper - equivalent to Python MaaFW class
pub struct MaaFrameworkWrapper {
    resource: Option<Resource>,
    controller: Option<Controller>,
    tasker: Option<Tasker>,
    event_broker: Option<Arc<DebugEventBroker>>,
    controller_operation_lock: Arc<tokio::sync::Mutex<()>>,
}

impl MaaFrameworkWrapper {
    pub fn new(work_dir: impl AsRef<Path>) -> Self {
        let target_dir: PathBuf = work_dir.as_ref().join("maa-framework");
        let _ = std::fs::create_dir_all(&target_dir);
        let _ = Toolkit::init_option(&target_dir.to_string_lossy(), "{}");

        let _ = set_debug_mode(true);

        Self {
            resource: None,
            controller: None,
            tasker: None,
            event_broker: None,
            controller_operation_lock: Arc::new(tokio::sync::Mutex::new(())),
        }
    }

    /// Create an independent worker for read-oriented controller operations.
    /// The worker deliberately does not share the active debug tasker so a
    /// screenshot or OCR request cannot keep the global state lock occupied or
    /// interfere with stop/status commands.
    pub fn detached_worker(&self) -> Self {
        Self {
            resource: self.resource.clone(),
            controller: self.controller.clone(),
            tasker: None,
            event_broker: None,
            controller_operation_lock: self.controller_operation_lock.clone(),
        }
    }

    /// Find ADB devices using Toolkit
    pub fn find_adb_devices() -> Vec<DeviceInfo> {
        controller::find_adb_devices()
    }

    /// Find desktop windows (Win32) using Toolkit
    pub fn find_desktop_windows() -> Vec<DeviceInfo> {
        controller::find_desktop_windows()
    }

    /// Connect to ADB device (async version)
    pub async fn connect_adb_async(
        &mut self,
        adb_path: &str,
        address: &str,
        config: serde_json::Value,
    ) -> (bool, Option<String>) {
        let (success, error, ctrl) = controller::connect_adb_async(adb_path, address, config).await;
        if success {
            self.controller = ctrl;
        }
        (success, error)
    }

    /// Connect to Win32 window (async version)
    pub async fn connect_win32_async(
        &mut self,
        hwnd: i64,
        screencap_method: Option<i32>,
        mouse_method: Option<i32>,
        keyboard_method: Option<i32>,
    ) -> (bool, Option<String>) {
        let (success, error, ctrl) =
            controller::connect_win32_async(hwnd, screencap_method, mouse_method, keyboard_method)
                .await;
        if success {
            self.controller = ctrl;
        }
        (success, error)
    }

    /// Run task with pipeline override
    pub fn run_task(
        &mut self,
        entry: &str,
        pipeline_override: serde_json::Value,
    ) -> Option<String> {
        tasker::run_task(
            &mut self.tasker,
            &self.resource,
            &self.controller,
            &self.event_broker,
            entry,
            pipeline_override,
        )
    }

    /// Stop task
    pub fn stop_task(&mut self) {
        tasker::stop_task(&self.tasker);
    }

    /// Check if tasker is running
    pub fn is_running(&self) -> bool {
        tasker::is_running(&self.tasker)
    }

    /// Take screenshot and return as base64 with image size (async version)
    pub async fn screencap_async(&mut self) -> Option<(String, Vec<i32>)> {
        let _operation_guard = self.controller_operation_lock.lock().await;
        let controller = self.controller.as_ref()?;
        let ctrl_clone = controller.clone();

        let id = ctrl_clone.post_screencap().ok()?;

        let success = wait_with_default_timeout_async(&ctrl_clone, id).await;
        if !success {
            crate::backend_log_debug!("stderr", "Screencap timeout or failed");
            return None;
        }

        match ctrl_clone.cached_image() {
            Ok(img_buffer) => match img_buffer.to_vec() {
                Some(raw_data) => image::encode_image_as_base64(&raw_data).map(|image| {
                    let size = image::detect_image_size(&raw_data).unwrap_or(vec![1280, 720]);
                    (image, size)
                }),
                None => None,
            },
            Err(e) => {
                crate::backend_log_debug!("stderr", "Failed to get cached image: {}", e);
                None
            }
        }
    }

    /// Get recognition detail by reco_id
    pub fn get_reco_detail(&self, reco_id: i32) -> Option<RecognitionDetail> {
        use crate::response::BoxScore;

        let tasker = self.tasker.as_ref()?;

        match tasker.get_recognition_detail(reco_id as sys::MaaId) {
            Ok(Some(detail)) => Some(RecognitionDetail {
                reco_id: Some(reco_id),
                name: Some(detail.node_name.clone()),
                algorithm: Some(format!("{:?}", detail.algorithm)),
                hit: detail.hit,
                bbox: Some(vec![
                    detail.box_rect.x,
                    detail.box_rect.y,
                    detail.box_rect.width,
                    detail.box_rect.height,
                ]),
                all_results: Some(
                    detail
                        .sub_details
                        .iter()
                        .map(|sub| BoxScore {
                            bbox: Some(vec![
                                sub.box_rect.x,
                                sub.box_rect.y,
                                sub.box_rect.width,
                                sub.box_rect.height,
                            ]),
                            score: None,
                        })
                        .collect(),
                ),
                filtered_results: None,
                best_result: if detail.hit {
                    Some(BoxScore {
                        bbox: Some(vec![
                            detail.box_rect.x,
                            detail.box_rect.y,
                            detail.box_rect.width,
                            detail.box_rect.height,
                        ]),
                        score: None,
                    })
                } else {
                    None
                },
                raw_detail: Some(detail.detail.clone()),
                raw_image: detail
                    .raw_image
                    .as_ref()
                    .and_then(|v| image::encode_raw_image(v)),
                draw_images: Some(
                    detail
                        .draw_images
                        .iter()
                        .filter_map(|img| image::encode_raw_image(img))
                        .collect(),
                ),
            }),
            _ => None,
        }
    }

    /// Set event broker for debug events
    #[allow(dead_code)]
    pub fn set_event_broker(&mut self, broker: Arc<DebugEventBroker>) {
        self.event_broker = Some(broker);
    }

    /// Load resource from paths (async version)
    pub async fn load_resource_async(&mut self, paths: &[String]) -> (bool, Option<String>) {
        let (success, message, new_resource) =
            resource::load_resource_async(self.resource.take(), paths).await;

        self.resource = new_resource;
        (success, message)
    }

    /// OCR text recognition with roi (async)
    pub async fn ocr_text_async(
        &mut self,
        roi: [i32; 4],
    ) -> Result<OcrRecognitionResponse, String> {
        let _operation_guard = self.controller_operation_lock.lock().await;
        crate::backend_log_debug!(
            "stderr",
            "[OCR] start roi={:?}, resource_bound={}, tasker_ready={}",
            roi,
            self.resource.is_some(),
            self.tasker.as_ref().map(|t| t.inited()).unwrap_or(false)
        );

        let controller = self
            .controller
            .as_ref()
            .ok_or("Controller not initialized. Please connect a device first.")?;

        let ctrl_clone = controller.clone();
        let id = ctrl_clone
            .post_screencap()
            .map_err(|e| format!("Failed to post screencap: {}", e))?;

        let success = wait_with_default_timeout_async(&ctrl_clone, id).await;
        if !success {
            return Err("Screencap timeout or failed".to_string());
        }

        let img_buffer = ctrl_clone
            .cached_image()
            .map_err(|e| format!("Failed to get cached image: {}", e))?;

        let tasker = match self.tasker.as_ref() {
            Some(t) => t.clone(),
            None => {
                let new_tasker =
                    Tasker::new().map_err(|e| format!("Failed to create tasker for OCR: {}", e))?;
                new_tasker
                    .bind(
                        self.resource.as_ref().ok_or("Resource not initialized")?,
                        controller,
                    )
                    .map_err(|e| format!("Failed to bind tasker: {}", e))?;
                if !new_tasker.inited() {
                    return Err("Tasker initialization failed".to_string());
                }
                self.tasker = Some(new_tasker.clone());
                new_tasker
            }
        };

        // Prefer a task-based OCR path so we can inspect TaskDetail/NodeDetail.
        let ocr_pipeline = serde_json::json!({
            "__OCRDebug": {
                "recognition": "OCR",
                "roi": roi,
                "action": "DoNothing",
                "next": [],
                "on_error": []
            }
        });

        match tasker.post_task_json("__OCRDebug", &ocr_pipeline) {
            Ok(job) => {
                let (wait_status, job) = tokio::task::spawn_blocking(move || {
                    let wait_status = job.wait();
                    (wait_status, job)
                })
                .await
                .map_err(|error| format!("OCR task wait failed: {error}"))?;
                crate::backend_log_debug!("stderr", "[OCR] task wait status: {}", wait_status);

                match job.get(false) {
                    Ok(Some(task_detail)) => {
                        crate::backend_log_debug!(
                            "stderr",
                            "[OCR] task detail: entry={}, status={}, node_id_list={:?}, nodes={}",
                            task_detail.entry,
                            task_detail.status,
                            task_detail.node_id_list,
                            task_detail.nodes.len()
                        );

                        for (idx, node_opt) in task_detail.nodes.iter().enumerate() {
                            let Some(node_detail) = node_opt.as_ref() else {
                                crate::backend_log_debug!("stderr", "[OCR] node[{}]: None", idx);
                                continue;
                            };

                            crate::backend_log_debug!(
                                "stderr",
                                "[OCR] node[{}]: name={}, reco_id={}, act_id={}, completed={}",
                                idx,
                                node_detail.node_name,
                                node_detail.reco_id,
                                node_detail.act_id,
                                node_detail.completed
                            );

                            if let Some(recognition) = &node_detail.recognition {
                                crate::backend_log_debug!(
                                    "stderr",
                                    "[OCR] node[{}].recognition: node={}, algo={:?}, hit={}, box={:?}, sub_details={}, raw_image_bytes={}, draw_images={}",
                                    idx,
                                    recognition.node_name,
                                    recognition.algorithm,
                                    recognition.hit,
                                    recognition.box_rect,
                                    recognition.sub_details.len(),
                                    recognition.raw_image.as_ref().map(|v| v.len()).unwrap_or(0),
                                    recognition.draw_images.len()
                                );
                                crate::backend_log_debug!(
                                    "stderr",
                                    "[OCR] node[{}].recognition raw detail: {}",
                                    idx,
                                    serde_json::to_string_pretty(&recognition.detail)
                                        .unwrap_or_else(|_| recognition.detail.to_string())
                                );

                                if let Ok(ocr_bundle) = serde_json::from_value::<OcrDetailBundle>(
                                    recognition.detail.clone(),
                                ) {
                                    crate::backend_log_debug!(
                                        "stderr",
                                        "[OCR] node[{}].ocr_bundle: all={}, filtered={}, best={}",
                                        idx,
                                        ocr_bundle.all.len(),
                                        ocr_bundle.filtered.len(),
                                        ocr_bundle.best.is_some()
                                    );
                                    for (res_idx, item) in ocr_bundle.all.iter().enumerate() {
                                        crate::backend_log_debug!(
                                            "stderr",
                                            "[OCR] node[{}].all[{}]: box={:?}, score={:.4}, text={:?}",
                                            idx,
                                            res_idx,
                                            item.bbox,
                                            item.score,
                                            item.text
                                        );
                                    }
                                    for (res_idx, item) in ocr_bundle.filtered.iter().enumerate() {
                                        crate::backend_log_debug!(
                                            "stderr",
                                            "[OCR] node[{}].filtered[{}]: box={:?}, score={:.4}, text={:?}",
                                            idx,
                                            res_idx,
                                            item.bbox,
                                            item.score,
                                            item.text
                                        );
                                    }
                                    if let Some(best) = ocr_bundle.best.as_ref() {
                                        crate::backend_log_debug!(
                                            "stderr",
                                            "[OCR] node[{}].best: box={:?}, score={:.4}, text_len={}, text={:?}",
                                            idx,
                                            best.bbox,
                                            best.score,
                                            best.text.chars().count(),
                                            best.text
                                        );
                                    }
                                    return Ok(ocr_bundle_to_response(ocr_bundle));
                                } else if let Some(ocr_result) = recognition.as_ocr_result() {
                                    crate::backend_log_debug!(
                                        "stderr",
                                        "[OCR] node[{}].ocr_result: box={:?}, score={:.4}, text_len={}, text={:?}",
                                        idx,
                                        ocr_result.base.box_rect,
                                        ocr_result.base.score,
                                        ocr_result.text.chars().count(),
                                        ocr_result.text
                                    );
                                    let candidate = OcrRecognitionCandidate {
                                        bbox: Some(vec![
                                            ocr_result.base.box_rect.0,
                                            ocr_result.base.box_rect.1,
                                            ocr_result.base.box_rect.2,
                                            ocr_result.base.box_rect.3,
                                        ]),
                                        score: ocr_result.base.score,
                                        text: ocr_result.text.clone(),
                                    };
                                    return Ok(ocr_result_to_response(
                                        ocr_result.text.clone(),
                                        candidate,
                                    ));
                                } else {
                                    crate::backend_log_debug!(
                                        "stderr",
                                        "[OCR] node[{}].recognition is not OCR detail",
                                        idx
                                    );
                                }
                            } else {
                                crate::backend_log_debug!(
                                    "stderr",
                                    "[OCR] node[{}].recognition: None",
                                    idx
                                );
                            }
                        }

                        crate::backend_log_debug!(
                            "stderr",
                            "[OCR] task route produced OCR detail bundle"
                        );
                    }
                    Ok(None) => {
                        crate::backend_log_debug!("stderr", "[OCR] task.get returned None");
                    }
                    Err(e) => {
                        crate::backend_log_debug!(
                            "stderr",
                            "[OCR] task.get failed: {:?} | {}",
                            e,
                            e
                        );
                    }
                }
            }
            Err(e) => {
                crate::backend_log_debug!("stderr", "[OCR] task post failed: {}", e);
            }
        }

        // Fallback: direct recognition call for plain text output.
        let ocr_params = serde_json::json!({
            "roi": roi
        });

        let job = tasker
            .post_recognition("OCR", &ocr_params.to_string(), &img_buffer)
            .map_err(|e| format!("OCR recognition failed: {}", e))?;

        let (wait_status, job) = tokio::task::spawn_blocking(move || {
            let wait_status = job.wait();
            (wait_status, job)
        })
        .await
        .map_err(|error| format!("OCR recognition wait failed: {error}"))?;
        crate::backend_log_debug!("stderr", "[OCR] direct wait status: {}", wait_status);

        match job.get(false) {
            Ok(Some(detail)) => {
                crate::backend_log_debug!(
                    "stderr",
                    "[OCR] direct recognition detail: {:#?}",
                    detail
                );
                crate::backend_log_debug!(
                    "stderr",
                    "[OCR] direct raw detail json: {}",
                    serde_json::to_string_pretty(&detail.detail)
                        .unwrap_or_else(|_| detail.detail.to_string())
                );

                if let Some(ocr_result) = detail.as_ocr_result() {
                    crate::backend_log_debug!(
                        "stderr",
                        "[OCR] direct parsed result: box={:?}, score={:.4}, text_len={}, text={:?}",
                        ocr_result.base.box_rect,
                        ocr_result.base.score,
                        ocr_result.text.chars().count(),
                        ocr_result.text
                    );
                    let candidate = OcrRecognitionCandidate {
                        bbox: Some(vec![
                            ocr_result.base.box_rect.0,
                            ocr_result.base.box_rect.1,
                            ocr_result.base.box_rect.2,
                            ocr_result.base.box_rect.3,
                        ]),
                        score: ocr_result.base.score,
                        text: ocr_result.text.clone(),
                    };
                    return Ok(ocr_result_to_response(ocr_result.text.clone(), candidate));
                }

                if let Ok(ocr_bundle) =
                    serde_json::from_value::<OcrDetailBundle>(detail.detail.clone())
                    && let Some(best) = ocr_bundle.best.as_ref()
                {
                    crate::backend_log_debug!(
                        "stderr",
                        "[OCR] direct best: box={:?}, score={:.4}, text_len={}, text={:?}",
                        best.bbox,
                        best.score,
                        best.text.chars().count(),
                        best.text
                    );
                    return Ok(ocr_bundle_to_response(ocr_bundle));
                }

                crate::backend_log_debug!(
                    "stderr",
                    "[OCR] direct detail could not be parsed as OCRResult or OcrDetailBundle"
                );
            }
            Ok(None) => {
                crate::backend_log_debug!("stderr", "[OCR] direct job.get returned None");
            }
            Err(e) => {
                crate::backend_log_debug!("stderr", "[OCR] direct job.get failed: {:?} | {}", e, e);
            }
        }

        crate::backend_log_debug!("stderr", "[OCR] no recognition result");

        Ok(OcrRecognitionResponse {
            text: None,
            best: None,
            all: vec![],
            filtered: vec![],
        })
    }
}

impl Default for MaaFrameworkWrapper {
    fn default() -> Self {
        let work_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        Self::new(work_dir)
    }
}
