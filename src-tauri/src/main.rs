#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::ffi::OsString;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::{Manager, WindowEvent};

#[cfg(all(target_os = "windows", not(debug_assertions)))]
use windows_sys::Win32::System::Console::AllocConsole;
struct AppState(Mutex<Option<Child>>);

fn kill_child(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

impl Drop for AppState {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                kill_child(&mut child);
            }
        }
    }
}

fn parse_port_arg(args: &[String], flag: &str, default_port: u16) -> u16 {
    let mut port = default_port;
    let prefix = format!("{flag}=");
    let mut iter = args.iter().peekable();
    while let Some(arg) = iter.next() {
        if arg == flag {
            if let Some(val) = iter.next() {
                if let Ok(p) = val.parse::<u16>() {
                    port = p;
                }
            }
        } else if let Some(rest) = arg.strip_prefix(&prefix) {
            if let Ok(p) = rest.parse::<u16>() {
                port = p;
            }
        }
    }
    port
}

fn resolve_backend_paths(resource_dir: &PathBuf, exec_dir: Option<&Path>) -> (PathBuf, PathBuf, PathBuf) {
    let fallback_cwd = std::env::current_dir().unwrap_or_else(|_| resource_dir.clone());

    let find_in_ancestors = |start: &Path, relative: &Path| {
        start
            .ancestors()
            .map(|ancestor| ancestor.join(relative))
            .find(|candidate| candidate.exists())
    };

    let runtime_relative = Path::new("src-tauri")
        .join("python-runtime")
        .join("python.exe");
    let mut runtime_candidates = Vec::new();
    if let Some(exec) = exec_dir {
        runtime_candidates.push(exec.join("python-runtime").join("python.exe"));
    }
    runtime_candidates.push(resource_dir.join("python-runtime").join("python.exe"));
    runtime_candidates.push(resource_dir.join("..").join("python-runtime").join("python.exe"));
    runtime_candidates.push(fallback_cwd.join("python-runtime").join("python.exe"));
    runtime_candidates.push(fallback_cwd.join("src-tauri").join("python-runtime").join("python.exe"));

    let script_relative = Path::new("backend").join("main.py");
    let mut script_candidates = Vec::new();
    if let Some(exec) = exec_dir {
        script_candidates.push(exec.join("backend").join("main.py"));
    }
    script_candidates.push(resource_dir.join("backend").join("main.py"));
    script_candidates.push(resource_dir.join("..").join("backend").join("main.py"));
    script_candidates.push(fallback_cwd.join("backend").join("main.py"));
    script_candidates.push(fallback_cwd.join("..").join("backend").join("main.py"));

    let python_exe = runtime_candidates
        .iter()
        .find(|p| p.exists())
        .cloned()
        .or_else(|| find_in_ancestors(&fallback_cwd, &runtime_relative))
        .expect("python runtime not found");

    let script = script_candidates
        .iter()
        .find(|p| p.exists())
        .cloned()
        .or_else(|| find_in_ancestors(&fallback_cwd, &script_relative))
        .expect("backend main.py not found");

    let workdir = script
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| resource_dir.clone());

    (python_exe, script, workdir)
}

#[cfg(all(target_os = "windows", not(debug_assertions)))]
fn should_show_console() -> bool {
    std::env::args().any(|a| a == "--with-console")
        || std::env::var("MAAINSPECTOR_CONSOLE").map(|v| v == "1").unwrap_or(false)
}

#[cfg(all(target_os = "windows", not(debug_assertions)))]
fn ensure_console(show_console: bool) {
    if show_console {
        unsafe {
            AllocConsole();
        }
    }
}

#[cfg(not(all(target_os = "windows", not(debug_assertions))))]
fn should_show_console() -> bool {
    false
}

#[cfg(not(all(target_os = "windows", not(debug_assertions))))]
fn ensure_console(_show_console: bool) {}

fn append_log(log_path: &Path, msg: &str) {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "[{}] {}", now, msg);
    }
}

fn append_log_line(log_path: &Path, stream: &str, line: &str) {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "[{}][{}] {}", now, stream, line);
    }
}

fn main() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(None)))
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let backend_port = parse_port_arg(&args, "--backend-port", 5000);
            let frontend_port = parse_port_arg(&args, "--frontend-port", 1420);
            let api_base = format!("http://127.0.0.1:{}", backend_port);
            let backend_port_str = backend_port.to_string();

            let app_handle = app.app_handle();
            let state = app.state::<AppState>();

            let exec_dir = app_handle.path().executable_dir().ok();
            let resource_dir = app_handle
                .path()
                .resource_dir()
                .expect("failed to resolve resource directory");

            let log_dir = exec_dir
                .clone()
                .unwrap_or_else(|| resource_dir.clone());
            let log_path = log_dir.join("maa_backend_start.log");

            let (python_exe, script, workdir) = resolve_backend_paths(&resource_dir, exec_dir.as_deref());

            // 将动态端口注入前端（若窗口已存在）。
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.eval(&format!(
                    "window.__MAA_API_BASE = '{}'; window.__MAA_FRONTEND_PORT = {}; window.__MAA_BACKEND_PORT = {};",
                    api_base, frontend_port, backend_port
                ));
            }

            let show_console = should_show_console();
            ensure_console(show_console);

            // 仅允许：显式指定的 PYTHON_EXE 或打包的 runtime，不再回退到系统 PATH。
            let mut python_candidates: Vec<OsString> = Vec::new();
            if let Some(env_python) = std::env::var_os("PYTHON_EXE") {
                python_candidates.push(env_python);
            }
            python_candidates.push(python_exe.into_os_string());

            append_log(
                &log_path,
                &format!(
                    "Startup begin. exec_dir: {:?}, resource_dir: {:?}, script: {:?}, workdir: {:?}, backend_port: {}, frontend_port: {}, candidates: {:?}",
                    exec_dir, resource_dir, script, workdir, backend_port, frontend_port, python_candidates
                ),
            );

            // 确保 Python 能找到 backend 包：将 backend 上级目录加入 PYTHONPATH。
            let mut pythonpath = OsString::new();
            let sep = if cfg!(windows) { ";" } else { ":" };
            if let Some(existing) = std::env::var_os("PYTHONPATH") {
                pythonpath.push(existing);
                pythonpath.push(sep);
            }
            let import_root = workdir
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| workdir.clone());
            pythonpath.push(import_root);

            let mut errors = Vec::new();
            let (used_python, child) = python_candidates
                .into_iter()
                .find_map(|candidate| {
                    let mut command = Command::new(&candidate);
                    command
                        .arg(&script)
                        .arg("--port")
                        .arg(&backend_port_str)
                        .current_dir(&workdir)
                        .env("PYTHONPATH", &pythonpath)
                        .env("MAA_BACKEND_PORT", &backend_port_str)
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped());

                    #[cfg(all(target_os = "windows", not(debug_assertions)))]
                    {
                        use std::os::windows::process::CommandExt;
                        // CREATE_NO_WINDOW 避免弹出控制台；若需要 console 则不设置
                        if !show_console {
                            command.creation_flags(0x08000000);
                        }
                    }

                    match command.spawn() {
                        Ok(mut child) => {
                            append_log(
                                &log_path,
                                &format!("Spawn success with python: {:?}", candidate),
                            );

                            let stdout = child.stdout.take();
                            let stderr = child.stderr.take();
                            let log_path_out = log_path.clone();
                            let log_path_err = log_path.clone();

                            std::thread::spawn(move || {
                                if let Some(out) = stdout {
                                    let reader = BufReader::new(out);
                                    for line in reader.lines().flatten() {
                                        append_log_line(&log_path_out, "STDOUT", &line);
                                        println!("backend> {}", line);
                                    }
                                }
                            });

                            std::thread::spawn(move || {
                                if let Some(err) = stderr {
                                    let reader = BufReader::new(err);
                                    for line in reader.lines().flatten() {
                                        append_log_line(&log_path_err, "STDERR", &line);
                                        eprintln!("backend err> {}", line);
                                    }
                                }
                            });

                            Some((candidate, child))
                        }
                        Err(err) => {
                            errors.push((candidate, err));
                            append_log(
                                &log_path,
                                &format!("Spawn failed: {:?}", errors.last()),
                            );
                            None
                        }
                    }
                })
                .unwrap_or_else(|| {
                    let attempts = errors
                        .iter()
                        .map(|(c, e)| format!("{:?}: {}", c, e))
                        .collect::<Vec<_>>()
                        .join(" | ");
                    panic!(
                        "Failed to spawn backend. script: {:?}, workdir: {:?}, attempts: {}",
                        script, workdir, attempts
                    );
                });

            println!(
                "Backend started with python: {:?}, script: {:?}, workdir: {:?}",
                used_python, script, workdir
            );

            *state.0.lock().unwrap() = Some(child);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                if let Some(mut child) = window.state::<AppState>().0.lock().unwrap().take() {
                    kill_child(&mut child);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
