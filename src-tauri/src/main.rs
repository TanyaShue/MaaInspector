#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::ffi::OsString;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::{Manager, WindowEvent};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::ptr;
#[cfg(target_os = "windows")]
use std::mem;
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Console::AllocConsole;
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, SetInformationJobObject,
};

// --- 日志辅助函数 ---

fn get_timestamp() -> u128 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn append_log(log_path: &Path, msg: &str) {
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "[{}] [INFO] {}", get_timestamp(), msg);
    }
}

fn append_log_error(log_path: &Path, msg: &str) {
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "[{}] [ERROR] {}", get_timestamp(), msg);
    }
}

fn append_stream_log(log_path: &Path, stream_name: &str, line: &str) {
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "[{}][{}] {}", get_timestamp(), stream_name, line);
    }
}

// --- Windows Job Object 管理 ---

#[cfg(target_os = "windows")]
struct WindowsJob {
    handle: HANDLE,
}

// 关键修复：显式告诉编译器 Windows Job Handle 在线程间传递是安全的
#[cfg(target_os = "windows")]
unsafe impl Send for WindowsJob {}
#[cfg(target_os = "windows")]
unsafe impl Sync for WindowsJob {}

#[cfg(target_os = "windows")]
impl WindowsJob {
    fn new() -> Result<Self, String> {
        unsafe {
            let handle = CreateJobObjectW(ptr::null(), ptr::null());
            // 关键修复：HANDLE 是指针，不能直接和 0 比较，需用 null_mut()
            if handle == std::ptr::null_mut() {
                return Err("Failed to create Job Object".to_string());
            }

            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let result = SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                &info as *const _ as _,
                mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as _,
            );

            if result == 0 {
                CloseHandle(handle);
                return Err("Failed to set Job Object information".to_string());
            }

            Ok(WindowsJob { handle })
        }
    }

    fn assign_process(&self, process_handle: HANDLE) -> Result<(), String> {
        unsafe {
            if AssignProcessToJobObject(self.handle, process_handle) == 0 {
                return Err("Failed to assign process to Job Object".to_string());
            }
            Ok(())
        }
    }
}

#[cfg(target_os = "windows")]
impl Drop for WindowsJob {
    fn drop(&mut self) {
        unsafe {
            // 关键修复：空指针检查
            if self.handle != std::ptr::null_mut() {
                CloseHandle(self.handle);
            }
        }
    }
}

// --- AppState ---

struct AppState {
    // 使用 pub 确保在 main 中可以访问
    pub child: Mutex<Option<Child>>,
    #[cfg(target_os = "windows")]
    pub job: Mutex<Option<WindowsJob>>,
}

// --- 路径解析逻辑 ---

fn resolve_paths(exe_dir: &Path) -> (PathBuf, PathBuf, PathBuf) {
    let python_exe = exe_dir.join("python-runtime").join("python.exe");
    let script = exe_dir.join("backend").join("main.py");
    let workdir = exe_dir.join("backend");
    (python_exe, script, workdir)
}

fn parse_port_arg(args: &[String], flag: &str, default_port: u16) -> u16 {
    let prefix = format!("{flag}=");
    for i in 0..args.len() {
        if args[i] == flag && i + 1 < args.len() {
            if let Ok(p) = args[i + 1].parse::<u16>() {
                return p;
            }
        } else if let Some(rest) = args[i].strip_prefix(&prefix) {
            if let Ok(p) = rest.parse::<u16>() {
                return p;
            }
        }
    }
    default_port
}

fn main() {
    #[cfg(target_os = "windows")]
    let app_state = AppState {
        child: Mutex::new(None),
        job: Mutex::new(None),
    };

    #[cfg(not(target_os = "windows"))]
    let app_state = AppState {
        child: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            let app_handle = app.app_handle();
            let args: Vec<String> = std::env::args().collect();

            let backend_port = parse_port_arg(&args, "--backend-port", 38081);
            let frontend_port = parse_port_arg(&args, "--frontend-port", 38080);
            let api_base = format!("http://127.0.0.1:{}", backend_port);

            let current_exe = std::env::current_exe().expect("Failed to get current exe path");
            let exec_dir = current_exe.parent().expect("Failed to get exec dir");

            let log_path = exec_dir.join("maa_backend_start.log");

            if let Ok(mut file) = std::fs::File::create(&log_path) {
                let _ = writeln!(file, "=== New Session Started at {} ===", get_timestamp());
            }

            append_log(&log_path, &format!("Executable: {:?}", current_exe));
            append_log(&log_path, &format!("Exec Dir: {:?}", exec_dir));

            let (python_exe, script, workdir) = resolve_paths(exec_dir);

            append_log(&log_path, "Checking paths...");
            append_log(&log_path, &format!("Python Exe: {:?} (Exists: {})", python_exe, python_exe.exists()));
            append_log(&log_path, &format!("Script: {:?} (Exists: {})", script, script.exists()));
            append_log(&log_path, &format!("Workdir: {:?} (Exists: {})", workdir, workdir.exists()));

            if !python_exe.exists() || !script.exists() {
                let err_msg = "Critical Error: Python runtime or Script not found!";
                append_log_error(&log_path, err_msg);
                panic!("{}", err_msg);
            }

            if let Some(window) = app_handle.get_webview_window("main") {
                let eval_script = format!(
                    "window.__MAA_API_BASE = '{}'; window.__MAA_FRONTEND_PORT = {}; window.__MAA_BACKEND_PORT = {};",
                    api_base, frontend_port, backend_port
                );
                if let Err(e) = window.eval(&eval_script) {
                    append_log_error(&log_path, &format!("Frontend eval failed: {}", e));
                }
            }

            #[cfg(all(target_os = "windows", not(debug_assertions)))]
            let show_console = std::env::var("MAAINSPECTOR_CONSOLE").map(|v| v == "1").unwrap_or(false);
            #[cfg(not(all(target_os = "windows", not(debug_assertions))))]
            let show_console = true;

            if show_console {
                #[cfg(target_os = "windows")]
                unsafe { AllocConsole(); }
            }

            let backend_port_str = backend_port.to_string();
            let mut command = Command::new(&python_exe);

            let python_path_root = exec_dir;

            let mut env_pythonpath = OsString::new();
            if let Some(existing) = std::env::var_os("PYTHONPATH") {
                env_pythonpath.push(existing);
                #[cfg(target_os = "windows")]
                env_pythonpath.push(";");
                #[cfg(not(target_os = "windows"))]
                env_pythonpath.push(":");
            }
            env_pythonpath.push(python_path_root);

            command
                .arg(&script)
                .arg("--port")
                .arg(&backend_port_str)
                .current_dir(&workdir)
                .env("PYTHONPATH", &env_pythonpath)
                .env("MAA_BACKEND_PORT", &backend_port_str)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            #[cfg(target_os = "windows")]
            {
                if !show_console {
                    command.creation_flags(0x08000000);
                }
            }

            append_log(&log_path, &format!("Spawning command: {:?} {:?}", python_exe, command.get_args()));
            append_log(&log_path, &format!("ENV PYTHONPATH: {:?}", env_pythonpath));

            match command.spawn() {
                Ok(mut child) => {
                    append_log(&log_path, "Process spawned successfully.");

                    #[cfg(target_os = "windows")]
                    {
                        use std::os::windows::io::AsRawHandle;
                        match WindowsJob::new() {
                            Ok(job) => {
                                if let Err(e) = job.assign_process(child.as_raw_handle() as _) {
                                    append_log_error(&log_path, &format!("Failed to assign process to Job Object: {}", e));
                                } else {
                                    append_log(&log_path, "Process successfully assigned to Job Object (Zombie protection active).");
                                    // 修正：通过 AppState 获取 Job 锁
                                    if let Ok(mut job_guard) = app.state::<AppState>().job.lock() {
                                        *job_guard = Some(job);
                                    }
                                }
                            }
                            Err(e) => {
                                append_log_error(&log_path, &format!("Failed to create Job Object: {}", e));
                            }
                        }
                    }

                    let stdout = child.stdout.take();
                    let stderr = child.stderr.take();
                    let log_path_out = log_path.clone();
                    let log_path_err = log_path.clone();

                    std::thread::spawn(move || {
                        if let Some(out) = stdout {
                            let reader = BufReader::new(out);
                            for line in reader.lines().flatten() {
                                append_stream_log(&log_path_out, "STDOUT", &line);
                                if show_console { println!("backend> {}", line); }
                            }
                        }
                    });

                    std::thread::spawn(move || {
                        if let Some(err) = stderr {
                            let reader = BufReader::new(err);
                            for line in reader.lines().flatten() {
                                append_stream_log(&log_path_err, "STDERR", &line);
                                if show_console { eprintln!("backend err> {}", line); }
                            }
                        }
                    });

                    // 修正：通过 AppState 获取 Child 锁
                    if let Ok(mut child_guard) = app.state::<AppState>().child.lock() {
                        *child_guard = Some(child);
                    }
                }
                Err(e) => {
                    append_log_error(&log_path, &format!("FATAL: Failed to spawn command: {}", e));
                    panic!("Failed to launch backend: {}", e);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                let state = window.state::<AppState>();
                if let Ok(mut guard) = state.child.lock() {
                     if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                     }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}