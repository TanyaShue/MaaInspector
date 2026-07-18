use super::{MaaFrameworkState, maafw_mut, maafw_ref};
use crate::maafw::resource as maafw_resource;
use crate::resources::{ResourcesManager, ResourcesManagerState};
use crate::response::{
    ApiResponse, CustomCompletionOption, CustomCompletionRules, FileNodesResponse,
    ResourceLoadResponse,
};
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

async fn with_manager<R, F>(state: ResourcesManagerState, operation: F) -> Result<R, String>
where
    R: Send + 'static,
    F: FnOnce(&ResourcesManager) -> Result<R, String> + Send + 'static,
{
    tokio::task::spawn_blocking(move || {
        let guard = state
            .read()
            .map_err(|_| "ResourcesManager lock is poisoned".to_string())?;
        let manager = guard
            .as_ref()
            .ok_or_else(|| "ResourcesManager not initialized".to_string())?;
        operation(manager)
    })
    .await
    .map_err(|error| format!("Resource task failed: {error}"))?
}

async fn with_manager_mut<R, F>(state: ResourcesManagerState, operation: F) -> Result<R, String>
where
    R: Send + 'static,
    F: FnOnce(&mut ResourcesManager) -> Result<R, String> + Send + 'static,
{
    tokio::task::spawn_blocking(move || {
        let mut guard = state
            .write()
            .map_err(|_| "ResourcesManager lock is poisoned".to_string())?;
        let manager = guard
            .as_mut()
            .ok_or_else(|| "ResourcesManager not initialized".to_string())?;
        operation(manager)
    })
    .await
    .map_err(|error| format!("Resource task failed: {error}"))?
}

/// Load resource paths
#[tauri::command]
pub async fn resource_load(
    maafw: State<'_, MaaFrameworkState>,
    resources_manager: State<'_, ResourcesManagerState>,
    backup_dir: State<'_, PathBuf>,
    paths: Vec<String>,
    schema_path: Option<String>,
) -> Result<ResourceLoadResponse, String> {
    // Manage file resources (always succeeds, returns file list)
    let state = resources_manager.inner().clone();
    let resource_paths = paths.clone();
    let backup_dir = backup_dir.inner().clone();
    let results = tokio::task::spawn_blocking(move || {
        let manager = ResourcesManager::new(resource_paths, backup_dir);
        let results = manager.list_all_files();
        let mut guard = state
            .write()
            .map_err(|_| "ResourcesManager lock is poisoned".to_string())?;
        *guard = Some(manager);
        Ok::<_, String>(results)
    })
    .await
    .map_err(|error| format!("Resource load task failed: {error}"))??;

    // Only lock long enough to clone the current resource from shared state.
    // The expensive bundle loading then runs concurrently with device restore.
    let existing_resource = {
        let fw = maafw.lock().await;
        maafw_ref(&fw)?.cloned_resource()
    };
    let (maafw_ok, maafw_msg, loaded_resource) =
        maafw_resource::load_resource_async(existing_resource, &paths).await;
    {
        let mut fw = maafw.lock().await;
        maafw_mut(&mut fw)?.set_resource(loaded_resource);
    };

    let custom_completions = load_custom_completion_rules(schema_path.as_deref());

    Ok(ResourceLoadResponse {
        r: true,
        success: true,
        message: maafw_msg.clone().unwrap_or_else(|| "Loaded".to_string()),
        list: Some(results),
        maafw_loaded: maafw_ok,
        maafw_message: maafw_msg,
        custom_completions,
    })
}

fn load_custom_completion_rules(schema_path: Option<&str>) -> CustomCompletionRules {
    let Some(schema_path) = schema_path.filter(|path| !path.trim().is_empty()) else {
        return CustomCompletionRules::default();
    };
    let directory = Path::new(schema_path);
    CustomCompletionRules {
        action: parse_custom_schema(
            &directory.join("custom.action.schema.json"),
            "custom_action",
            "custom_action_param",
        ),
        recognition: parse_custom_schema(
            &directory.join("custom.recognition.schema.json"),
            "custom_recognition",
            "custom_recognition_param",
        ),
    }
}

fn parse_custom_schema(
    path: &Path,
    name_key: &str,
    param_key: &str,
) -> Vec<CustomCompletionOption> {
    let Ok(content) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(root) = serde_json::from_str::<Value>(&content) else {
        crate::backend_log_error!("resource", "Invalid custom schema: {}", path.display());
        return Vec::new();
    };

    let definitions = root.get("$defs").and_then(Value::as_object);
    let names = root
        .pointer(&format!("/properties/{name_key}/enum"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    names
        .iter()
        .filter_map(Value::as_str)
        .map(|name| {
            let definition = definitions.and_then(|defs| defs.get(name));
            let param_schema = definition
                .and_then(|item| item.get("properties"))
                .and_then(Value::as_object)
                .and_then(|properties| properties.get(param_key))
                .map(|schema| resolve_local_refs(schema, &root, &mut HashSet::new()));
            CustomCompletionOption {
                value: name.to_string(),
                title: definition
                    .and_then(|item| item.get("title"))
                    .and_then(Value::as_str)
                    .map(str::to_string),
                description: definition
                    .and_then(|item| item.get("description"))
                    .and_then(Value::as_str)
                    .map(str::to_string),
                param_schema,
            }
        })
        .collect()
}

fn resolve_local_refs(value: &Value, root: &Value, visiting: &mut HashSet<String>) -> Value {
    match value {
        Value::Object(object) => {
            if let Some(reference) = object.get("$ref").and_then(Value::as_str)
                && reference.starts_with("#/")
                && visiting.insert(reference.to_string())
            {
                let pointer = reference
                    .trim_start_matches('#')
                    .replace("~1", "/")
                    .replace("~0", "~");
                if let Some(target) = root.pointer(&pointer) {
                    let mut resolved = resolve_local_refs(target, root, visiting);
                    visiting.remove(reference);
                    if let Some(resolved_object) = resolved.as_object_mut() {
                        for (key, item) in object.iter().filter(|(key, _)| key.as_str() != "$ref") {
                            resolved_object
                                .insert(key.clone(), resolve_local_refs(item, root, visiting));
                        }
                    }
                    return resolved;
                }
                visiting.remove(reference);
            }
            Value::Object(
                object
                    .iter()
                    .map(|(key, item)| (key.clone(), resolve_local_refs(item, root, visiting)))
                    .collect::<Map<_, _>>(),
            )
        }
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| resolve_local_refs(item, root, visiting))
                .collect(),
        ),
        _ => value.clone(),
    }
}

#[cfg(test)]
mod custom_schema_tests {
    use super::*;

    #[test]
    fn parses_options_and_resolves_parameter_refs() {
        let directory = tempfile::tempdir().unwrap();
        fs::write(
            directory.path().join("custom.action.schema.json"),
            r##"{
                "properties": { "custom_action": { "enum": ["Demo"] } },
                "$defs": {
                    "Text": { "type": "string", "minLength": 1 },
                    "Demo": {
                        "title": "Demo title",
                        "description": "Demo description",
                        "properties": {
                            "custom_action_param": {
                                "type": "object",
                                "properties": { "name": { "$ref": "#/$defs/Text", "description": "Name" } },
                                "required": ["name"]
                            }
                        }
                    }
                }
            }"##,
        )
        .unwrap();

        let rules = load_custom_completion_rules(directory.path().to_str());

        assert_eq!(rules.action.len(), 1);
        assert_eq!(rules.action[0].value, "Demo");
        assert_eq!(rules.action[0].title.as_deref(), Some("Demo title"));
        let name_schema = rules.action[0]
            .param_schema
            .as_ref()
            .unwrap()
            .pointer("/properties/name")
            .unwrap();
        assert_eq!(
            name_schema.get("type").and_then(Value::as_str),
            Some("string")
        );
        assert_eq!(
            name_schema.get("description").and_then(Value::as_str),
            Some("Name")
        );
    }

    #[test]
    fn missing_schema_directory_returns_empty_rules() {
        let rules = load_custom_completion_rules(Some("Z:/missing/schema/directory"));
        assert!(rules.action.is_empty());
        assert!(rules.recognition.is_empty());
    }
}

/// Get nodes from a file
#[tauri::command]
pub async fn resource_get_file_nodes(
    resources_manager: State<'_, ResourcesManagerState>,
    source: String,
    filename: String,
) -> Result<FileNodesResponse, String> {
    with_manager(resources_manager.inner().clone(), move |manager| {
        let nodes = manager
            .get_nodes_by_file(&source, &filename)
            .map_err(|error| error.to_string())?;
        if let Some(nodes) = nodes {
            return Ok(FileNodesResponse {
                nodes: Some(serde_json::to_value(nodes).unwrap_or(serde_json::Value::Null)),
                list: None,
            });
        }
        Ok(FileNodesResponse {
            nodes: None,
            list: None,
        })
    })
    .await
}

/// Save nodes to a file
#[tauri::command]
pub async fn resource_save_file_nodes(
    resources_manager: State<'_, ResourcesManagerState>,
    source: String,
    filename: String,
    nodes: serde_json::Value,
) -> Result<ApiResponse, String> {
    with_manager_mut(
        resources_manager.inner().clone(),
        move |manager| match manager.save_nodes(&source, &filename, nodes) {
            Ok(count) => Ok(ApiResponse::ok_with_data(
                format!("Saved {} nodes", count),
                serde_json::json!({ "saved_count": count }),
            )),
            Err(error) => Ok(ApiResponse::error_with_status(
                error.to_string(),
                error.status_code(),
            )),
        },
    )
    .await
}

/// Create a new file
#[tauri::command]
pub async fn resource_create_file(
    resources_manager: State<'_, ResourcesManagerState>,
    path: String,
    filename: String,
) -> Result<ApiResponse, String> {
    with_manager_mut(
        resources_manager.inner().clone(),
        move |manager| match manager.create_file(&path, &filename) {
            Ok(final_filename) => Ok(ApiResponse::ok_with_data(
                "Created",
                serde_json::json!({
                    "filename": final_filename,
                    "source": path
                }),
            )),
            Err(error) => Ok(ApiResponse::error_with_status(
                error.to_string(),
                error.status_code(),
            )),
        },
    )
    .await
}

/// Search nodes globally
#[tauri::command]
pub async fn resource_search_nodes(
    resources_manager: State<'_, ResourcesManagerState>,
    query: String,
    use_regex: Option<bool>,
    current_filename: Option<String>,
    current_source: Option<String>,
) -> Result<serde_json::Value, String> {
    with_manager(resources_manager.inner().clone(), move |manager| {
        let results = manager.search_nodes(
            &query,
            use_regex.unwrap_or(false),
            &current_filename.unwrap_or_default(),
            &current_source.unwrap_or_default(),
            50,
        );
        Ok(serde_json::json!({ "results": results }))
    })
    .await
}

/// Get template images for nodes
#[tauri::command]
pub async fn resource_get_templates(
    resources_manager: State<'_, ResourcesManagerState>,
    source: String,
    filename: String,
) -> Result<ApiResponse, String> {
    with_manager(resources_manager.inner().clone(), move |manager| {
        let nodes = match manager.get_nodes_by_file(&source, &filename) {
            Ok(nodes) => nodes,
            Err(error) => {
                return Ok(ApiResponse::error_with_status(
                    error.to_string(),
                    error.status_code(),
                ));
            }
        };
        let image_base = match manager.get_image_base_path(&source) {
            Ok(path) => path,
            Err(error) => {
                return Ok(ApiResponse::error_with_status(
                    error.to_string(),
                    error.status_code(),
                ));
            }
        };

        let mut results: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();

        if let Some(nodes_map) = nodes {
            for (node_id, node_data) in nodes_map {
                if let Some(obj) = node_data.as_object() {
                    let templates = obj.get("template");
                    if templates.is_none() {
                        continue;
                    }

                    let templates_arr: Vec<String> = if let Some(tpl) = templates {
                        if let Some(s) = tpl.as_str() {
                            vec![s.to_string()]
                        } else if let Some(arr) = tpl.as_array() {
                            arr.iter()
                                .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                .collect()
                        } else {
                            Vec::new()
                        }
                    } else {
                        Vec::new()
                    };

                    let mut node_images: Vec<serde_json::Value> = Vec::new();

                    for tpl in templates_arr {
                        let full_img = match manager.get_image_full_path(&source, &tpl) {
                            Ok(path) => path,
                            Err(error) => {
                                node_images.push(serde_json::json!({
                                    "path": tpl,
                                    "found": false,
                                    "error": error.to_string()
                                }));
                                continue;
                            }
                        };
                        let found = full_img.exists();
                        let full_path_str = full_img
                            .to_string_lossy()
                            .replace("\\", "/")
                            .replace("//?/", "");

                        node_images.push(serde_json::json!({
                            "path": tpl,
                            "found": found,
                            "fullPath": full_path_str
                        }));
                    }

                    if !node_images.is_empty() {
                        results.insert(node_id, serde_json::Value::Array(node_images));
                    }
                }
            }
        }

        Ok(ApiResponse::ok_with_data(
            "Loaded",
            serde_json::json!({
                "base_image_path": image_base.to_string_lossy().replace("\\", "/"),
                "results": results
            }),
        ))
    })
    .await
}

/// Check unused images
#[tauri::command]
pub async fn resource_check_unused_images(
    resources_manager: State<'_, ResourcesManagerState>,
    source: String,
    current_filename: Option<String>,
    del_images: Vec<serde_json::Value>,
) -> Result<ApiResponse, String> {
    with_manager(resources_manager.inner().clone(), move |manager| {
        let paths_to_check: Vec<String> = del_images
            .iter()
            .filter_map(|img| {
                img.get("path")
                    .and_then(|p| p.as_str())
                    .map(|s| s.to_string())
            })
            .collect();

        if paths_to_check.is_empty() {
            return Ok(ApiResponse::ok_with_data(
                "No images to check",
                serde_json::json!({
                    "unused_images": [],
                    "used_images": []
                }),
            ));
        }

        let used_map = match manager.check_image_references(
            &source,
            &paths_to_check,
            &current_filename.unwrap_or_default(),
        ) {
            Ok(result) => result,
            Err(error) => {
                return Ok(ApiResponse::error_with_status(
                    error.to_string(),
                    error.status_code(),
                ));
            }
        };

        let unused_images: Vec<String> = paths_to_check
            .iter()
            .filter(|p| !used_map.contains_key(*p))
            .cloned()
            .collect();

        let used_images: Vec<serde_json::Value> = used_map
            .iter()
            .map(|(p, nodes)| {
                serde_json::json!({
                    "path": p,
                    "used_by": nodes
                })
            })
            .collect();

        Ok(ApiResponse::ok_with_data(
            "Checked",
            serde_json::json!({
                "unused_images": unused_images,
                "used_images": used_images
            }),
        ))
    })
    .await
}

/// Process images (delete and save)
#[tauri::command]
pub async fn resource_process_images(
    resources_manager: State<'_, ResourcesManagerState>,
    source: String,
    delete_paths: Vec<String>,
    save_images: Vec<serde_json::Value>,
) -> Result<ApiResponse, String> {
    with_manager_mut(resources_manager.inner().clone(), move |manager| {
        let mut results = serde_json::json!({
            "deleted": [],
            "delete_failed": [],
            "saved": [],
            "save_failed": []
        });

        // Delete images
        for path in delete_paths {
            if path.is_empty() {
                continue;
            }
            match manager.delete_image(&source, &path) {
                Ok(true) => {
                    if let Some(arr) = results.get_mut("deleted").and_then(|v| v.as_array_mut()) {
                        arr.push(serde_json::Value::String(path));
                    }
                }
                Ok(false) => {
                    if let Some(arr) = results
                        .get_mut("delete_failed")
                        .and_then(|v| v.as_array_mut())
                    {
                        arr.push(serde_json::json!({ "path": path, "reason": "File not found" }));
                    }
                }
                Err(error) => {
                    if let Some(arr) = results
                        .get_mut("delete_failed")
                        .and_then(|v| v.as_array_mut())
                    {
                        arr.push(serde_json::json!({ "path": path, "reason": error.to_string() }));
                    }
                }
            }
        }

        // Save images
        for img in save_images {
            let path = img.get("path").and_then(|p| p.as_str());
            let base64_data = img.get("base64").and_then(|b| b.as_str());

            match (path, base64_data) {
                (Some(p), Some(b64)) => match manager.save_image(&source, p, b64) {
                    Ok(()) => {
                        if let Some(arr) = results.get_mut("saved").and_then(|v| v.as_array_mut()) {
                            arr.push(serde_json::Value::String(p.to_string()));
                        }
                    }
                    Err(error) => {
                        if let Some(arr) = results
                            .get_mut("save_failed")
                            .and_then(|v| v.as_array_mut())
                        {
                            arr.push(serde_json::json!({ "path": p, "reason": error.to_string() }));
                        }
                    }
                },
                _ => {
                    if let Some(arr) = results
                        .get_mut("save_failed")
                        .and_then(|v| v.as_array_mut())
                    {
                        arr.push(serde_json::json!({
                            "path": path.unwrap_or_default(),
                            "reason": "Image payload must include path and base64"
                        }));
                    }
                }
            }
        }

        Ok(ApiResponse::ok_with_data("Processed", results))
    })
    .await
}
