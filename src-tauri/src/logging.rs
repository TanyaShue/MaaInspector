use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use zip::write::SimpleFileOptions;

const LOG_SIZE_LIMIT_BYTES: u64 = 10 * 1024 * 1024;
const FRONTEND_DIR: &str = "frontend";
const BACKEND_DIR: &str = "backend";
const ARCHIVE_DIR: &str = "archive";

static LOGGER: OnceLock<Mutex<FileLogger>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendLogEntry {
    pub ts: String,
    pub level: String,
    pub target: String,
    pub message: String,
    #[serde(default)]
    pub fields: Value,
}

struct FileLogger {
    logs_dir: PathBuf,
    frontend_file: File,
    backend_file: File,
}

pub fn init(app_data_dir: &Path) -> io::Result<PathBuf> {
    let logs_dir = app_data_dir.join("logs");
    prepare_logs_dir(&logs_dir, LOG_SIZE_LIMIT_BYTES)?;

    let frontend_file = open_log_file(&logs_dir.join(FRONTEND_DIR), "frontend")?;
    let backend_file = open_log_file(&logs_dir.join(BACKEND_DIR), "backend")?;
    let logger = FileLogger {
        logs_dir: logs_dir.clone(),
        frontend_file,
        backend_file,
    };

    let _ = LOGGER.set(Mutex::new(logger));
    install_panic_hook();
    backend_info(
        "logging",
        "Logger initialized",
        json!({ "logs_dir": logs_dir }),
    );
    Ok(logs_dir)
}

pub fn logs_dir() -> Option<PathBuf> {
    LOGGER
        .get()
        .and_then(|logger| logger.lock().ok().map(|guard| guard.logs_dir.clone()))
}

pub fn write_frontend_batch(entries: &[FrontendLogEntry]) -> io::Result<()> {
    with_logger(|logger| {
        for entry in entries {
            let line = json!({
                "ts": entry.ts,
                "level": entry.level,
                "target": entry.target,
                "message": entry.message,
                "fields": entry.fields,
            });
            write_json_line(&mut logger.frontend_file, &line)?;
        }
        logger.frontend_file.flush()
    })
}

pub fn backend_log(level: &str, target: &str, message: String, fields: Value) {
    let _ = with_logger(|logger| {
        let line = json!({
            "ts": now_string(),
            "level": level,
            "target": target,
            "message": message,
            "fields": fields,
        });
        write_json_line(&mut logger.backend_file, &line)?;
        logger.backend_file.flush()
    });
}

pub fn backend_debug(target: &str, message: impl Into<String>, fields: Value) {
    backend_log("debug", target, message.into(), fields);
}

pub fn backend_info(target: &str, message: impl Into<String>, fields: Value) {
    backend_log("info", target, message.into(), fields);
}

#[allow(dead_code)]
pub fn backend_warn(target: &str, message: impl Into<String>, fields: Value) {
    backend_log("warn", target, message.into(), fields);
}

pub fn backend_error(target: &str, message: impl Into<String>, fields: Value) {
    backend_log("error", target, message.into(), fields);
}

fn with_logger<T>(f: impl FnOnce(&mut FileLogger) -> io::Result<T>) -> io::Result<T> {
    let logger = LOGGER
        .get()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "logger is not initialized"))?;
    let mut guard = logger
        .lock()
        .map_err(|_| io::Error::other("logger lock is poisoned"))?;
    f(&mut guard)
}

fn prepare_logs_dir(logs_dir: &Path, size_limit: u64) -> io::Result<()> {
    fs::create_dir_all(logs_dir.join(FRONTEND_DIR))?;
    fs::create_dir_all(logs_dir.join(BACKEND_DIR))?;
    fs::create_dir_all(logs_dir.join(ARCHIVE_DIR))?;

    let log_files = collect_log_files(logs_dir)?;
    let total_size = log_files.iter().try_fold(0_u64, |total, path| {
        Ok::<u64, io::Error>(total + fs::metadata(path)?.len())
    })?;

    if total_size > size_limit && !log_files.is_empty() {
        archive_log_files(logs_dir, &log_files)?;
        for path in log_files {
            let _ = fs::remove_file(path);
        }
    }

    Ok(())
}

fn collect_log_files(logs_dir: &Path) -> io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for dir_name in [FRONTEND_DIR, BACKEND_DIR] {
        let dir = logs_dir.join(dir_name);
        if !dir.exists() {
            continue;
        }
        for entry in fs::read_dir(dir)? {
            let path = entry?.path();
            if path.extension().and_then(|ext| ext.to_str()) == Some("log") {
                files.push(path);
            }
        }
    }
    Ok(files)
}

fn archive_log_files(logs_dir: &Path, files: &[PathBuf]) -> io::Result<PathBuf> {
    let archive_dir = logs_dir.join(ARCHIVE_DIR);
    fs::create_dir_all(&archive_dir)?;
    let archive_path =
        archive_dir.join(format!("logs-{}.zip", Local::now().format("%Y%m%d-%H%M%S")));
    let archive_file = File::create(&archive_path)?;
    let mut zip = zip::ZipWriter::new(archive_file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for path in files {
        let parent_name = path
            .parent()
            .and_then(|parent| parent.file_name())
            .and_then(|name| name.to_str())
            .unwrap_or("logs");
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("log.log");
        zip.start_file(format!("{}/{}", parent_name, file_name), options)?;
        let mut source = File::open(path)?;
        io::copy(&mut source, &mut zip)?;
    }

    zip.finish()?;
    Ok(archive_path)
}

fn open_log_file(dir: &Path, prefix: &str) -> io::Result<File> {
    fs::create_dir_all(dir)?;
    let path = dir.join(format!(
        "{}-{}.log",
        prefix,
        Local::now().format("%Y%m%d-%H%M%S")
    ));
    OpenOptions::new().create(true).append(true).open(path)
}

fn write_json_line(file: &mut File, value: &Value) -> io::Result<()> {
    serde_json::to_writer(&mut *file, value)?;
    file.write_all(b"\n")
}

fn now_string() -> String {
    Local::now().to_rfc3339()
}

fn install_panic_hook() {
    static PANIC_HOOK_INSTALLED: OnceLock<()> = OnceLock::new();
    PANIC_HOOK_INSTALLED.get_or_init(|| {
        let previous_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |panic_info| {
            backend_error("panic", panic_info.to_string(), Value::Null);
            previous_hook(panic_info);
        }));
    });
}

#[macro_export]
macro_rules! backend_log_info {
    ($target:expr, $($arg:tt)*) => {
        $crate::logging::backend_info($target, format!($($arg)*), serde_json::Value::Null)
    };
}

#[macro_export]
macro_rules! backend_log_debug {
    ($target:expr, $($arg:tt)*) => {
        $crate::logging::backend_debug($target, format!($($arg)*), serde_json::Value::Null)
    };
}

#[macro_export]
macro_rules! backend_log_warn {
    ($target:expr, $($arg:tt)*) => {
        $crate::logging::backend_warn($target, format!($($arg)*), serde_json::Value::Null)
    };
}

#[macro_export]
macro_rules! backend_log_error {
    ($target:expr, $($arg:tt)*) => {
        $crate::logging::backend_error($target, format!($($arg)*), serde_json::Value::Null)
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn prepare_logs_dir_creates_expected_directories() {
        let temp = tempdir().unwrap();
        let logs_dir = temp.path().join("logs");

        prepare_logs_dir(&logs_dir, LOG_SIZE_LIMIT_BYTES).unwrap();

        assert!(logs_dir.join(FRONTEND_DIR).is_dir());
        assert!(logs_dir.join(BACKEND_DIR).is_dir());
        assert!(logs_dir.join(ARCHIVE_DIR).is_dir());
    }

    #[test]
    fn prepare_logs_dir_archives_when_total_size_exceeds_limit() {
        let temp = tempdir().unwrap();
        let logs_dir = temp.path().join("logs");
        fs::create_dir_all(logs_dir.join(FRONTEND_DIR)).unwrap();
        fs::create_dir_all(logs_dir.join(BACKEND_DIR)).unwrap();
        fs::create_dir_all(logs_dir.join(ARCHIVE_DIR)).unwrap();
        fs::write(logs_dir.join(FRONTEND_DIR).join("old.log"), vec![b'a'; 64]).unwrap();
        fs::write(logs_dir.join(BACKEND_DIR).join("old.log"), vec![b'b'; 64]).unwrap();

        prepare_logs_dir(&logs_dir, 100).unwrap();

        assert!(!logs_dir.join(FRONTEND_DIR).join("old.log").exists());
        assert!(!logs_dir.join(BACKEND_DIR).join("old.log").exists());
        let archive_count = fs::read_dir(logs_dir.join(ARCHIVE_DIR)).unwrap().count();
        assert_eq!(archive_count, 1);
    }

    #[test]
    fn prepare_logs_dir_keeps_small_logs() {
        let temp = tempdir().unwrap();
        let logs_dir = temp.path().join("logs");
        fs::create_dir_all(logs_dir.join(FRONTEND_DIR)).unwrap();
        fs::write(logs_dir.join(FRONTEND_DIR).join("small.log"), b"small").unwrap();

        prepare_logs_dir(&logs_dir, 100).unwrap();

        assert!(logs_dir.join(FRONTEND_DIR).join("small.log").exists());
        assert_eq!(fs::read_dir(logs_dir.join(ARCHIVE_DIR)).unwrap().count(), 0);
    }

    #[test]
    fn open_log_files_separates_frontend_and_backend() {
        let temp = tempdir().unwrap();
        let logs_dir = temp.path().join("logs");
        prepare_logs_dir(&logs_dir, LOG_SIZE_LIMIT_BYTES).unwrap();

        let frontend = open_log_file(&logs_dir.join(FRONTEND_DIR), "frontend").unwrap();
        let backend = open_log_file(&logs_dir.join(BACKEND_DIR), "backend").unwrap();
        drop(frontend);
        drop(backend);

        assert_eq!(
            fs::read_dir(logs_dir.join(FRONTEND_DIR)).unwrap().count(),
            1
        );
        assert_eq!(fs::read_dir(logs_dir.join(BACKEND_DIR)).unwrap().count(), 1);
    }
}
