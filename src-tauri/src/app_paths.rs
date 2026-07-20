use crate::config::AppConfig;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const LOCATION_FILE: &str = "config-location.json";

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub default_config_dir: PathBuf,
    pub config_dir: PathBuf,
    pub log_dir: PathBuf,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ConfigLocation {
    #[serde(default)]
    config_dir: String,
}

fn executable_root() -> Result<PathBuf, String> {
    std::env::current_exe()
        .map_err(|error| format!("无法获取软件路径: {error}"))?
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "软件可执行文件没有父目录".to_string())
}

impl AppPaths {
    pub fn load(default_config_dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&default_config_dir).map_err(|error| {
            format!(
                "无法创建默认配置目录 {}: {error}",
                default_config_dir.display()
            )
        })?;

        let location_path = default_config_dir.join(LOCATION_FILE);
        let configured_dir = fs::read_to_string(&location_path)
            .ok()
            .and_then(|content| serde_json::from_str::<ConfigLocation>(&content).ok())
            .map(|location| location.config_dir)
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from);
        let config_dir = configured_dir
            .filter(|dir| AppConfig::validate_file(&dir.join("config.json")).is_ok())
            .unwrap_or_else(|| default_config_dir.clone());
        let config = AppConfig::load_path(&config_dir);
        let log_dir = config
            .storage_settings
            .log_dir
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
            .unwrap_or(executable_root()?.join("log"));

        Ok(Self {
            default_config_dir,
            config_dir,
            log_dir,
        })
    }

    pub fn save_config_location(&self, config_dir: &Path) -> Result<(), String> {
        let location = ConfigLocation {
            config_dir: config_dir.to_string_lossy().into_owned(),
        };
        let content = serde_json::to_vec_pretty(&location)
            .map_err(|error| format!("无法序列化配置位置: {error}"))?;
        crate::config::write_file_atomically(&self.default_config_dir.join(LOCATION_FILE), &content)
            .map_err(|error| format!("无法保存配置位置: {error}"))
    }
}
