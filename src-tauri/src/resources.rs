use regex::Regex;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use walkdir::WalkDir;

use crate::config::write_file_atomically_with_backup;
use crate::response::ResourceFileInfo;
use chrono::Local;

static BACKUP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub enum ResourceError {
    UnknownSource(String),
    InvalidRelativePath(String),
    PathEscapesBase(PathBuf),
    AlreadyExists(PathBuf),
    InvalidData(String),
    Io {
        operation: &'static str,
        path: PathBuf,
        source: std::io::Error,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn manager_for(root: &Path) -> ResourcesManager {
        ResourcesManager::new(
            vec![root.to_string_lossy().to_string()],
            root.join("test-backup"),
        )
    }

    #[test]
    fn rejects_unknown_sources_and_parent_traversal() {
        let dir = tempdir().expect("create resource directory");
        fs::create_dir_all(dir.path().join("pipeline")).expect("create pipeline directory");
        fs::create_dir_all(dir.path().join("image")).expect("create image directory");
        let mut manager = manager_for(dir.path());

        assert!(matches!(
            manager.get_nodes_by_file("D:/not-loaded", "pipeline.json"),
            Err(ResourceError::UnknownSource(_))
        ));
        assert!(matches!(
            manager.save_nodes(
                &dir.path().to_string_lossy(),
                "../outside.json",
                serde_json::json!({})
            ),
            Err(ResourceError::InvalidRelativePath(_))
        ));
        assert!(matches!(
            manager.save_image(&dir.path().to_string_lossy(), "../outside.png", "aGVsbG8="),
            Err(ResourceError::InvalidRelativePath(_))
        ));
    }

    #[test]
    fn creates_a_file_for_a_loaded_source_without_an_existing_cache_entry() {
        let dir = tempdir().expect("create resource directory");
        let mut manager = manager_for(dir.path());

        let filename = manager
            .create_file(&dir.path().to_string_lossy(), "nested/new")
            .expect("create pipeline file");

        assert_eq!(filename, "nested/new.json");
        assert!(dir.path().join("pipeline/nested/new.json").is_file());
        assert_eq!(
            manager
                .get_nodes_by_file(&dir.path().to_string_lossy(), &filename)
                .expect("read created file")
                .expect("created file exists")
                .len(),
            0
        );
    }

    #[test]
    fn backup_failure_leaves_the_original_pipeline_unchanged() {
        let dir = tempdir().expect("create resource directory");
        let resource_dir = dir.path().join("resource");
        let backup_dir = dir.path().join("blocked-backup");
        fs::create_dir_all(resource_dir.join("pipeline")).expect("create pipeline directory");
        fs::write(&backup_dir, b"not a directory").expect("create backup-path obstacle");
        let mut manager =
            ResourcesManager::new(vec![resource_dir.to_string_lossy().to_string()], backup_dir);
        let source = resource_dir.to_string_lossy();

        assert_eq!(
            manager
                .save_nodes(&source, "empty.json", serde_json::json!({}))
                .expect("save empty pipeline"),
            0
        );
        let saved = fs::read_to_string(resource_dir.join("pipeline/empty.json"))
            .expect("read saved pipeline");
        assert_eq!(
            serde_json::from_str::<JsonValue>(&saved).unwrap(),
            serde_json::json!({})
        );

        let original = fs::read(resource_dir.join("pipeline/empty.json")).unwrap();
        assert!(
            manager
                .save_nodes(&source, "empty.json", serde_json::json!({ "node": {} }))
                .is_err()
        );
        assert_eq!(
            fs::read(resource_dir.join("pipeline/empty.json")).unwrap(),
            original
        );
        assert!(!resource_dir.join("pipeline/empty.json.bak").exists());
    }

    #[test]
    fn saves_timestamped_pipeline_backups_outside_the_resource_directory() {
        let dir = tempdir().expect("create workspace");
        let resource_dir = dir.path().join("resource-one");
        let backup_dir = dir.path().join("backup");
        fs::create_dir_all(resource_dir.join("pipeline")).expect("create pipeline directory");
        let mut manager = ResourcesManager::new(
            vec![resource_dir.to_string_lossy().to_string()],
            backup_dir.clone(),
        );
        let source = resource_dir.to_string_lossy();

        manager
            .save_nodes(
                &source,
                "nested/demo.json",
                serde_json::json!({ "old": {} }),
            )
            .expect("save initial pipeline");
        manager
            .save_nodes(
                &source,
                "nested/demo.json",
                serde_json::json!({ "new": {} }),
            )
            .expect("replace pipeline");

        assert!(!resource_dir.join("pipeline/nested/demo.json.bak").exists());
        let backups = WalkDir::new(&backup_dir)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file())
            .collect::<Vec<_>>();
        assert_eq!(backups.len(), 1);
        let backup_path = backups[0].path();
        assert!(backup_path.to_string_lossy().contains("resource-one"));
        assert!(backup_path.to_string_lossy().contains("pipeline"));
        assert!(
            Regex::new(r"demo_\d{8}_\d{6}_\d{3}_\d{6}\.json\.bak$")
                .unwrap()
                .is_match(&backup_path.to_string_lossy())
        );
        assert_eq!(
            serde_json::from_str::<JsonValue>(&fs::read_to_string(backup_path).unwrap()).unwrap(),
            serde_json::json!({ "old": {} })
        );
    }

    #[test]
    fn rejects_absolute_pipeline_and_image_paths() {
        let dir = tempdir().expect("create resource directory");
        fs::create_dir_all(dir.path().join("pipeline")).expect("create pipeline directory");
        fs::create_dir_all(dir.path().join("image")).expect("create image directory");
        let manager = manager_for(dir.path());
        let absolute = dir
            .path()
            .join("outside.json")
            .to_string_lossy()
            .to_string();
        let source = dir.path().to_string_lossy();

        assert!(matches!(
            manager.get_nodes_by_file(&source, &absolute),
            Err(ResourceError::InvalidRelativePath(_))
        ));
        assert!(matches!(
            manager.get_image_full_path(&source, &absolute),
            Err(ResourceError::InvalidRelativePath(_))
        ));
    }

    #[test]
    fn saving_nodes_replaces_the_search_index_for_that_file() {
        let dir = tempdir().expect("create resource directory");
        fs::create_dir_all(dir.path().join("pipeline")).expect("create pipeline directory");
        let mut manager = manager_for(dir.path());
        let source = dir.path().to_string_lossy();

        manager
            .save_nodes(
                &source,
                "search.json",
                serde_json::json!({ "old_node": { "recognition": "OCR" } }),
            )
            .expect("save initial nodes");
        assert_eq!(manager.search_nodes("old_node", false, "", "", 10).len(), 1);

        manager
            .save_nodes(
                &source,
                "search.json",
                serde_json::json!({ "new_node": { "recognition": "OCR" } }),
            )
            .expect("replace nodes");

        assert!(
            manager
                .search_nodes("old_node", false, "", "", 10)
                .is_empty()
        );
        assert_eq!(manager.search_nodes("new_node", false, "", "", 10).len(), 1);
    }

    #[test]
    fn exposes_all_normalized_resource_paths_for_framework_reload() {
        let first = tempdir().expect("create first resource");
        let second = tempdir().expect("create second resource");
        let manager = ResourcesManager::new(
            vec![
                first.path().to_string_lossy().to_string(),
                second.path().to_string_lossy().to_string(),
            ],
            first.path().join("backup"),
        );

        assert_eq!(
            manager.resource_paths(),
            vec![
                first
                    .path()
                    .canonicalize()
                    .unwrap()
                    .to_string_lossy()
                    .to_string(),
                second
                    .path()
                    .canonicalize()
                    .unwrap()
                    .to_string_lossy()
                    .to_string(),
            ]
        );
    }

    #[test]
    fn rejects_escaping_directory_links_before_creating_outside_directories() {
        let dir = tempdir().expect("create resource directory");
        let outside = tempdir().expect("create outside directory");
        let image_dir = dir.path().join("image");
        fs::create_dir_all(&image_dir).expect("create image directory");
        let link = image_dir.join("escape");

        #[cfg(windows)]
        let link_result = std::os::windows::fs::symlink_dir(outside.path(), &link);
        #[cfg(unix)]
        let link_result = std::os::unix::fs::symlink(outside.path(), &link);
        if link_result.is_err() {
            // Creating symlinks may require Developer Mode or elevated rights on Windows.
            return;
        }

        let manager = manager_for(dir.path());
        let result = manager.save_image(
            &dir.path().to_string_lossy(),
            "escape/nested/image.png",
            "aGVsbG8=",
        );

        assert!(matches!(result, Err(ResourceError::PathEscapesBase(_))));
        assert!(!outside.path().join("nested").exists());
    }
}

impl ResourceError {
    pub fn status_code(&self) -> u16 {
        match self {
            Self::UnknownSource(_)
            | Self::InvalidRelativePath(_)
            | Self::PathEscapesBase(_)
            | Self::InvalidData(_) => 400,
            Self::AlreadyExists(_) => 409,
            Self::Io { .. } => 500,
        }
    }

    fn io(operation: &'static str, path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Self::Io {
            operation,
            path: path.into(),
            source,
        }
    }
}

impl fmt::Display for ResourceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownSource(path) => write!(f, "Resource source is not loaded: {path}"),
            Self::InvalidRelativePath(path) => write!(f, "Invalid relative resource path: {path}"),
            Self::PathEscapesBase(path) => {
                write!(
                    f,
                    "Resolved resource path escapes its allowed base: {}",
                    path.display()
                )
            }
            Self::AlreadyExists(path) => {
                write!(f, "Resource path already exists: {}", path.display())
            }
            Self::InvalidData(message) => write!(f, "Invalid resource data: {message}"),
            Self::Io {
                operation,
                path,
                source,
            } => write!(f, "Failed to {operation} {}: {source}", path.display()),
        }
    }
}

impl std::error::Error for ResourceError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}

fn validate_relative_path(path: &str) -> Result<&Path, ResourceError> {
    let relative = Path::new(path);
    if path.trim().is_empty()
        || relative.is_absolute()
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(ResourceError::InvalidRelativePath(path.to_string()));
    }
    Ok(relative)
}

/// ResourcesManager - manages pipeline JSON files and images
#[derive(Clone)]
pub struct ResourcesManager {
    resource_paths: Vec<PathBuf>,
    backup_dir: PathBuf,
    files_cache: HashMap<PathBuf, HashMap<String, HashMap<String, JsonValue>>>,
    node_index: Vec<NodeIndexEntry>,
}

pub type ResourcesManagerState = Arc<RwLock<Option<ResourcesManager>>>;

#[derive(Debug, Clone)]
struct NodeIndexEntry {
    resource_path: PathBuf,
    filename: String,
    node_id: String,
    data: JsonValue,
}

impl ResourcesManager {
    pub fn new(paths: Vec<String>, backup_dir: PathBuf) -> Self {
        let normalized_paths: Vec<PathBuf> = paths
            .iter()
            .filter(|p| !p.is_empty())
            .map(|p| {
                PathBuf::from(p)
                    .canonicalize()
                    .unwrap_or_else(|_| PathBuf::from(p))
            })
            .collect();

        let mut manager = Self {
            resource_paths: normalized_paths,
            backup_dir,
            files_cache: HashMap::new(),
            node_index: Vec::new(),
        };
        manager.load_all();
        manager
    }

    pub fn resource_paths(&self) -> Vec<String> {
        self.resource_paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect()
    }

    fn get_pipeline_dir(&self, resource_path: &Path) -> PathBuf {
        resource_path.join("pipeline")
    }

    fn get_image_dir(&self, resource_path: &Path) -> PathBuf {
        resource_path.join("image")
    }

    fn backup_path(&self, resource_path: &Path, category: &str, filename: &str) -> PathBuf {
        let now = Local::now();
        let date_dir = now.format("%Y-%m-%d").to_string();
        let timestamp = now.format("%Y%m%d_%H%M%S_%3f").to_string();
        let sequence = BACKUP_SEQUENCE.fetch_add(1, Ordering::Relaxed) % 1_000_000;
        let resource_name = resource_path
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| !name.is_empty())
            .unwrap_or("resource");
        let relative = Path::new(filename);
        let parent = relative.parent().unwrap_or_else(|| Path::new(""));
        let stem = relative
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("pipeline");
        let extension = relative
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| format!(".{value}"))
            .unwrap_or_default();

        self.backup_dir
            .join(date_dir)
            .join(resource_name)
            .join(category)
            .join(parent)
            .join(format!("{stem}_{timestamp}_{sequence:06}{extension}.bak"))
    }

    fn resolve_source(&self, resource_path: &str) -> Result<PathBuf, ResourceError> {
        let requested = PathBuf::from(resource_path);
        let normalized = requested
            .canonicalize()
            .unwrap_or_else(|_| requested.clone());
        self.resource_paths
            .iter()
            .find(|known| **known == normalized || **known == requested)
            .cloned()
            .ok_or_else(|| ResourceError::UnknownSource(resource_path.to_string()))
    }

    fn resolve_contained_path(
        &self,
        base: &Path,
        relative_path: &str,
        create_parent: bool,
    ) -> Result<PathBuf, ResourceError> {
        let relative = validate_relative_path(relative_path)?;
        if create_parent {
            fs::create_dir_all(base)
                .map_err(|error| ResourceError::io("create directory", base, error))?;
        }
        let canonical_base = base
            .canonicalize()
            .map_err(|error| ResourceError::io("resolve base directory", base, error))?;
        let target = base.join(relative);

        let parent = target
            .parent()
            .ok_or_else(|| ResourceError::InvalidRelativePath(relative_path.to_string()))?;
        let mut existing_ancestor = Some(parent);
        while existing_ancestor.is_some_and(|path| !path.exists()) {
            existing_ancestor = existing_ancestor.and_then(Path::parent);
        }
        let ancestor =
            existing_ancestor.ok_or_else(|| ResourceError::PathEscapesBase(target.clone()))?;
        let canonical_ancestor = ancestor
            .canonicalize()
            .map_err(|error| ResourceError::io("resolve parent directory", ancestor, error))?;
        if !canonical_ancestor.starts_with(&canonical_base) {
            return Err(ResourceError::PathEscapesBase(target));
        }

        // Validate the nearest existing ancestor before creating directories.
        // Otherwise create_dir_all could follow an escaping symlink and mutate
        // a location outside the resource root before we reject the path.
        if create_parent {
            fs::create_dir_all(parent)
                .map_err(|error| ResourceError::io("create parent directory", parent, error))?;
            let canonical_parent = parent
                .canonicalize()
                .map_err(|error| ResourceError::io("resolve parent directory", parent, error))?;
            if !canonical_parent.starts_with(&canonical_base) {
                return Err(ResourceError::PathEscapesBase(target));
            }
        }

        if target.exists() {
            let canonical_target = target
                .canonicalize()
                .map_err(|error| ResourceError::io("resolve resource path", &target, error))?;
            if !canonical_target.starts_with(&canonical_base) {
                return Err(ResourceError::PathEscapesBase(target));
            }
        }
        Ok(target)
    }

    fn resolve_pipeline_path(
        &self,
        resource_path: &str,
        filename: &str,
        create_parent: bool,
    ) -> Result<(PathBuf, PathBuf), ResourceError> {
        let source = self.resolve_source(resource_path)?;
        let full_path =
            self.resolve_contained_path(&self.get_pipeline_dir(&source), filename, create_parent)?;
        Ok((source, full_path))
    }

    fn resolve_image_path(
        &self,
        resource_path: &str,
        relative_path: &str,
        create_parent: bool,
    ) -> Result<(PathBuf, PathBuf), ResourceError> {
        let source = self.resolve_source(resource_path)?;
        let full_path = self.resolve_contained_path(
            &self.get_image_dir(&source),
            relative_path,
            create_parent,
        )?;
        Ok((source, full_path))
    }

    fn load_all(&mut self) {
        self.files_cache.clear();
        self.node_index.clear();

        for resource_path in &self.resource_paths {
            let pipeline_path = self.get_pipeline_dir(resource_path);
            if !pipeline_path.is_dir() {
                continue;
            }

            self.files_cache
                .insert(resource_path.clone(), HashMap::new());

            for entry in WalkDir::new(&pipeline_path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
            {
                let relative_path = entry
                    .path()
                    .strip_prefix(&pipeline_path)
                    .unwrap_or(entry.path())
                    .to_string_lossy()
                    .to_string();
                if !relative_path.to_lowercase().ends_with(".json") {
                    continue;
                }

                let full_path = entry.path();
                if let Ok(content) = fs::read_to_string(full_path)
                    && let Ok(json) = serde_json::from_str::<JsonValue>(&content)
                {
                    let normalized = self.normalize_data(json);
                    self.files_cache
                        .get_mut(resource_path)
                        .unwrap()
                        .insert(relative_path.clone(), normalized.clone());

                    // Build index
                    for (node_id, node_data) in normalized.iter() {
                        self.node_index.push(NodeIndexEntry {
                            resource_path: resource_path.clone(),
                            filename: relative_path.clone(),
                            node_id: node_id.clone(),
                            data: node_data.clone(),
                        });
                    }
                }
            }
        }
    }

    fn normalize_data(&self, data: JsonValue) -> HashMap<String, JsonValue> {
        let mut result = HashMap::new();

        if let Some(obj) = data.as_object() {
            for (k, v) in obj {
                result.insert(k.clone(), v.clone());
            }
        } else if let Some(arr) = data.as_array() {
            for item in arr {
                if let Some(item_obj) = item.as_object()
                    && let Some(nid) = item_obj.get("id").and_then(|v| v.as_str())
                {
                    let ndata = item_obj.get("data").cloned().unwrap_or(JsonValue::Null);
                    result.insert(nid.to_string(), ndata);
                }
            }
        }

        result
    }

    fn normalize_template_paths(&self, data: &mut HashMap<String, JsonValue>) {
        for (_, node_data) in data.iter_mut() {
            if let Some(obj) = node_data.as_object_mut()
                && let Some(template) = obj.get("template")
            {
                if let Some(tpl_str) = template.as_str() {
                    let normalized = tpl_str.replace("\\", "/");
                    obj.insert("template".to_string(), JsonValue::String(normalized));
                } else if let Some(tpl_arr) = template.as_array() {
                    let normalized: Vec<JsonValue> = tpl_arr
                        .iter()
                        .map(|t| {
                            if let Some(s) = t.as_str() {
                                JsonValue::String(s.replace("\\", "/"))
                            } else {
                                t.clone()
                            }
                        })
                        .collect();
                    obj.insert("template".to_string(), JsonValue::Array(normalized));
                }
            }
        }
    }

    fn replace_file_index(
        &mut self,
        resource_path: &Path,
        filename: &str,
        nodes: &HashMap<String, JsonValue>,
    ) {
        self.node_index
            .retain(|entry| entry.resource_path != resource_path || entry.filename != filename);
        self.node_index
            .extend(nodes.iter().map(|(node_id, data)| NodeIndexEntry {
                resource_path: resource_path.to_path_buf(),
                filename: filename.to_string(),
                node_id: node_id.clone(),
                data: data.clone(),
            }));
    }

    pub fn list_all_files(&self) -> Vec<ResourceFileInfo> {
        let mut results = Vec::new();

        for resource_path in &self.resource_paths {
            let pipeline_path = self.get_pipeline_dir(resource_path);
            let source_label = resource_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| resource_path.to_string_lossy().to_string());

            if !pipeline_path.is_dir() {
                results.push(ResourceFileInfo {
                    label: format!("[No pipeline] ({})", source_label),
                    value: None,
                    source: resource_path.to_string_lossy().to_string(),
                    filename: None,
                });
                continue;
            }

            let files: Vec<String> = WalkDir::new(&pipeline_path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .map(|e| {
                    e.path()
                        .strip_prefix(&pipeline_path)
                        .unwrap_or(e.path())
                        .to_string_lossy()
                        .to_string()
                })
                .filter(|f| f.to_lowercase().ends_with(".json"))
                .collect();

            if files.is_empty() {
                results.push(ResourceFileInfo {
                    label: format!("[Empty] ({})", source_label),
                    value: None,
                    source: resource_path.to_string_lossy().to_string(),
                    filename: None,
                });
            } else {
                for f in files {
                    results.push(ResourceFileInfo {
                        label: format!("{} ({})", f, source_label),
                        value: Some(f.clone()),
                        source: resource_path.to_string_lossy().to_string(),
                        filename: Some(f),
                    });
                }
            }
        }

        results
    }

    pub fn get_nodes_by_file(
        &self,
        resource_path: &str,
        filename: &str,
    ) -> Result<Option<HashMap<String, JsonValue>>, ResourceError> {
        let (path, full_path) = self.resolve_pipeline_path(resource_path, filename, false)?;

        // Try cache first
        if let Some(files) = self.files_cache.get(&path)
            && let Some(nodes) = files.get(filename)
        {
            return Ok(Some(nodes.clone()));
        }

        // Read from file
        if !full_path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&full_path)
            .map_err(|error| ResourceError::io("read pipeline file", &full_path, error))?;
        let json = serde_json::from_str::<JsonValue>(&content)
            .map_err(|error| ResourceError::InvalidData(error.to_string()))?;
        Ok(Some(self.normalize_data(json)))
    }

    pub fn save_nodes(
        &mut self,
        resource_path: &str,
        filename: &str,
        content: JsonValue,
    ) -> Result<usize, ResourceError> {
        let (path, full_path) = self.resolve_pipeline_path(resource_path, filename, true)?;
        let mut normalized = self.normalize_data(content);
        self.normalize_template_paths(&mut normalized);

        // Convert HashMap to JsonValue for saving
        let json_value: JsonValue = normalized
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect::<serde_json::Map<String, JsonValue>>()
            .into();

        let json_str = serde_json::to_string_pretty(&json_value)
            .map_err(|error| ResourceError::InvalidData(error.to_string()))?;
        let backup_path = full_path
            .exists()
            .then(|| self.backup_path(&path, "pipeline", filename));
        write_file_atomically_with_backup(&full_path, json_str.as_bytes(), backup_path.as_deref())
            .map_err(|error| ResourceError::io("write pipeline file", &full_path, error))?;

        // Update cache
        self.files_cache
            .entry(path.clone())
            .or_default()
            .insert(filename.to_string(), normalized.clone());
        self.replace_file_index(&path, filename, &normalized);

        Ok(normalized.len())
    }

    pub fn create_file(
        &mut self,
        resource_path: &str,
        filename: &str,
    ) -> Result<String, ResourceError> {
        let fname = if filename.to_lowercase().ends_with(".json") {
            filename.to_string()
        } else {
            format!("{}.json", filename)
        };
        let (path, full_path) = self.resolve_pipeline_path(resource_path, &fname, true)?;

        if full_path.exists() {
            return Err(ResourceError::AlreadyExists(full_path));
        }

        // Write empty JSON object
        write_file_atomically_with_backup(&full_path, b"{}", None)
            .map_err(|error| ResourceError::io("create pipeline file", &full_path, error))?;

        // Update cache
        self.files_cache
            .entry(path.clone())
            .or_default()
            .insert(fname.clone(), HashMap::new());
        self.replace_file_index(&path, &fname, &HashMap::new());

        Ok(fname)
    }

    pub fn search_nodes(
        &self,
        query: &str,
        use_regex: bool,
        exclude_file: &str,
        exclude_source: &str,
        max_results: usize,
    ) -> Vec<serde_json::Value> {
        if query.is_empty() {
            return Vec::new();
        }

        let mut results = Vec::new();
        let pattern = if use_regex {
            Regex::new(query).ok()
        } else {
            None
        };
        let query_lower = query.to_lowercase();
        let exclude_source_norm = PathBuf::from(exclude_source)
            .canonicalize()
            .unwrap_or_else(|_| PathBuf::from(exclude_source));

        for entry in &self.node_index {
            // Exclude current file
            if !exclude_file.is_empty()
                && entry.filename == exclude_file
                && (exclude_source_norm.to_string_lossy().is_empty()
                    || entry.resource_path == exclude_source_norm)
            {
                continue;
            }

            let node_data = &entry.data;
            let display_id = if let Some(obj) = node_data.as_object() {
                obj.get("id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| entry.node_id.clone())
            } else {
                entry.node_id.clone()
            };

            let targets = [entry.node_id.as_str(), display_id.as_str()];
            let matched = if let Some(ref p) = pattern {
                targets.iter().any(|t| p.is_match(t))
            } else {
                targets
                    .iter()
                    .any(|t| t.to_lowercase().contains(&query_lower))
            };

            if matched {
                let reco_type = if let Some(obj) = node_data.as_object() {
                    obj.get("recognition")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown")
                } else {
                    "Unknown"
                };

                results.push(serde_json::json!({
                    "filename": entry.filename,
                    "source": entry.resource_path.to_string_lossy().to_string(),
                    "node_id": entry.node_id,
                    "display_id": display_id,
                    "type": reco_type
                }));
            }
        }

        // Sort by display_id
        results.sort_by(|a, b| {
            let a_id = a.get("display_id").and_then(|v| v.as_str()).unwrap_or("");
            let b_id = b.get("display_id").and_then(|v| v.as_str()).unwrap_or("");
            a_id.to_lowercase().cmp(&b_id.to_lowercase())
        });

        results.truncate(max_results);
        results
    }

    pub fn get_image_full_path(
        &self,
        resource_path: &str,
        relative_path: &str,
    ) -> Result<PathBuf, ResourceError> {
        self.resolve_image_path(resource_path, relative_path, false)
            .map(|(_, full_path)| full_path)
    }

    pub fn get_image_base_path(&self, resource_path: &str) -> Result<PathBuf, ResourceError> {
        let path = self.resolve_source(resource_path)?;
        Ok(self.get_image_dir(&path))
    }

    pub fn save_image(
        &self,
        resource_path: &str,
        relative_path: &str,
        base64_data: &str,
    ) -> Result<(), ResourceError> {
        let (path, full_path) = self.resolve_image_path(resource_path, relative_path, true)?;

        // Decode base64
        let data = if base64_data.contains(";base64,") {
            let parts: Vec<&str> = base64_data.split(";base64,").collect();
            if parts.len() > 1 {
                parts[1]
            } else {
                base64_data
            }
        } else {
            base64_data
        };

        let decoded = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, data)
            .map_err(|error| ResourceError::InvalidData(error.to_string()))?;
        let backup_path = full_path
            .exists()
            .then(|| self.backup_path(&path, "image", relative_path));
        write_file_atomically_with_backup(&full_path, &decoded, backup_path.as_deref())
            .map_err(|error| ResourceError::io("write image", &full_path, error))?;
        Ok(())
    }

    pub fn delete_image(
        &self,
        resource_path: &str,
        relative_path: &str,
    ) -> Result<bool, ResourceError> {
        let (path, full_path) = self.resolve_image_path(resource_path, relative_path, false)?;

        if !full_path.exists() {
            return Ok(false);
        }

        fs::remove_file(&full_path)
            .map_err(|error| ResourceError::io("delete image", &full_path, error))?;

        // Try to remove empty parent directories
        let parent = full_path.parent();
        let image_base = self.get_image_dir(&path);
        if let Some(p) = parent
            && p != image_base
            && p.is_dir()
        {
            let contents: Vec<_> = WalkDir::new(p)
                .min_depth(1)
                .max_depth(1)
                .into_iter()
                .collect();
            if contents.is_empty() {
                let _ = fs::remove_dir(p);
            }
        }

        Ok(true)
    }

    pub fn check_image_references(
        &self,
        resource_path: &str,
        image_paths: &[String],
        exclude_file: &str,
    ) -> Result<HashMap<String, Vec<String>>, ResourceError> {
        let path = self.resolve_source(resource_path)?;
        let mut used_map: HashMap<String, Vec<String>> = HashMap::new();

        let empty_map = HashMap::new();
        let files = self.files_cache.get(&path).unwrap_or(&empty_map);

        for (filename, nodes) in files {
            if filename == exclude_file {
                continue;
            }

            for (node_id, node_data) in nodes {
                if let Some(obj) = node_data.as_object() {
                    let template = obj.get("template");
                    if template.is_none() {
                        continue;
                    }

                    let templates: Vec<String> = if let Some(tpl) = template {
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

                    for img_path in image_paths {
                        if templates.contains(img_path) {
                            used_map
                                .entry(img_path.clone())
                                .or_default()
                                .push(format!("{}:{}", filename, node_id));
                        }
                    }
                }
            }
        }

        Ok(used_map)
    }
}
