use super::MaaFrameworkState;
use crate::config::AgentProfile;
use crate::logging;
use crate::response::ApiResponse;
use maa_framework::agent_client::AgentClient;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::State;

struct ManagedChild {
    child: Child,
    #[cfg(windows)]
    job_handle: isize,
}

impl ManagedChild {
    fn stop(&mut self) {
        #[cfg(windows)]
        if self.job_handle != 0 {
            unsafe {
                windows_sys::Win32::Foundation::CloseHandle(self.job_handle as _);
            }
            self.job_handle = 0;
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Drop for ManagedChild {
    fn drop(&mut self) {
        self.stop();
    }
}

#[derive(Clone, Default)]
pub struct AgentProcessState(Arc<Mutex<Option<ManagedChild>>>);

impl AgentProcessState {
    fn lock(&self) -> std::sync::LockResult<std::sync::MutexGuard<'_, Option<ManagedChild>>> {
        self.0.lock()
    }

    pub fn stop(&self) {
        if let Ok(mut process) = self.0.lock()
            && let Some(mut child) = process.take()
        {
            child.stop();
        }
    }
}

#[derive(Clone, Default)]
pub struct AgentClientState(Arc<Mutex<Option<AgentClient>>>);

impl AgentClientState {
    fn lock(&self) -> std::sync::LockResult<std::sync::MutexGuard<'_, Option<AgentClient>>> {
        self.0.lock()
    }

    fn shared(&self) -> Arc<Mutex<Option<AgentClient>>> {
        self.0.clone()
    }
}

fn resolve_executable(executable: &str, working_directory: &Path) -> PathBuf {
    let path = PathBuf::from(executable);
    if path.is_absolute() {
        path
    } else if executable.contains('/') || executable.contains('\\') {
        working_directory.join(path)
    } else {
        path
    }
}

fn pipe_agent_output<R: Read + Send + 'static>(reader: R, stream: &'static str) {
    std::thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut bytes = Vec::new();
        loop {
            bytes.clear();
            match reader.read_until(b'\n', &mut bytes) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    while bytes
                        .last()
                        .is_some_and(|byte| *byte == b'\n' || *byte == b'\r')
                    {
                        bytes.pop();
                    }
                    logging::agent_output(stream, &String::from_utf8_lossy(&bytes));
                }
            }
        }
    });
}

#[cfg(windows)]
fn attach_kill_on_close_job(child: &Child) -> Result<isize, String> {
    use std::mem::{size_of, zeroed};
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
        SetInformationJobObject,
    };

    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return Err("无法创建 Agent 进程作业对象".to_string());
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as _,
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        ) == 0
        {
            CloseHandle(job);
            return Err("无法配置 Agent 进程作业对象".to_string());
        }
        if AssignProcessToJobObject(job, child.as_raw_handle() as _) == 0 {
            CloseHandle(job);
            return Err("无法将 Agent 加入进程作业对象".to_string());
        }
        Ok(job as isize)
    }
}

/// Start the configured Agent subprocess. MaaFramework AgentServer samples
/// expect the socket identifier as the final command-line argument.
#[tauri::command]
pub async fn agent_start(
    maafw: State<'_, MaaFrameworkState>,
    process_state: State<'_, AgentProcessState>,
    client_state: State<'_, AgentClientState>,
    config: AgentProfile,
) -> Result<ApiResponse, String> {
    if config.auto_start && config.child_exec.trim().is_empty() {
        return Err("Agent 可执行文件不能为空".to_string());
    }
    if config.socket_id.trim().is_empty() {
        return Err("Agent Socket ID 不能为空".to_string());
    }

    let working_directory = if config.working_directory.trim().is_empty() {
        std::env::current_dir().map_err(|error| format!("无法获取当前目录: {error}"))?
    } else {
        PathBuf::from(&config.working_directory)
    };
    if !working_directory.is_dir() {
        return Err(format!(
            "Agent 工作目录不存在: {}",
            working_directory.display()
        ));
    }

    let executable = if config.auto_start {
        let executable = resolve_executable(&config.child_exec, &working_directory);
        if (config.child_exec.contains('/') || config.child_exec.contains('\\'))
            && !executable.is_file()
        {
            return Err(format!("Agent 可执行文件不存在: {}", executable.display()));
        }
        Some(executable)
    } else {
        None
    };

    if config.auto_start {
        let mut guard = process_state
            .lock()
            .map_err(|_| "Agent 进程状态锁已损坏".to_string())?;
        if let Some(mut existing) = guard.take() {
            existing.stop();
        }
    }
    {
        let mut client_guard = client_state
            .lock()
            .map_err(|_| "AgentClient 状态锁已损坏".to_string())?;
        if let Some(existing) = client_guard.take() {
            let _ = existing.disconnect();
        }
    }

    let resource = {
        let framework = maafw.lock().await;
        framework
            .as_ref()
            .and_then(|wrapper| wrapper.cloned_resource())
            .ok_or_else(|| "请先加载资源，再连接 Agent".to_string())?
    };
    let mut client = AgentClient::new(Some(&config.socket_id))
        .map_err(|error| format!("创建 AgentClient 失败: {error}"))?;
    client
        .bind(resource)
        .map_err(|error| format!("AgentClient 绑定资源失败: {error}"))?;
    client
        .set_timeout(5000)
        .map_err(|error| format!("设置 AgentClient 超时失败: {error}"))?;

    let mut pid = None;
    if let Some(executable) = executable {
        let mut guard = process_state
            .lock()
            .map_err(|_| "Agent 进程状态锁已损坏".to_string())?;
        let mut command = Command::new(&executable);
        command
            .args(&config.child_args)
            .arg(&config.socket_id)
            .current_dir(&working_directory)
            .envs(&config.environment)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        let mut child = command.spawn().map_err(|error| {
            format!(
                "启动 Agent 失败（{}，工作目录 {}）: {error}",
                executable.display(),
                working_directory.display()
            )
        })?;
        pid = Some(child.id());
        if let Some(stdout) = child.stdout.take() {
            pipe_agent_output(stdout, "stdout");
        }
        if let Some(stderr) = child.stderr.take() {
            pipe_agent_output(stderr, "stderr");
        }
        logging::agent_output("system", &format!("Agent 已启动，PID {}", child.id()));
        #[cfg(windows)]
        let job_handle = attach_kill_on_close_job(&child).map_err(|error| {
            let _ = child.kill();
            let _ = child.wait();
            error
        })?;
        *guard = Some(ManagedChild {
            child,
            #[cfg(windows)]
            job_handle,
        });
    }
    {
        let mut client_guard = client_state
            .lock()
            .map_err(|_| "AgentClient 状态锁已损坏".to_string())?;
        *client_guard = Some(client);
    }

    Ok(ApiResponse::ok_with_data(
        "Agent 已启动",
        serde_json::json!({
            "pid": pid,
            "socket_id": config.socket_id,
            "working_directory": working_directory
        }),
    ))
}

#[tauri::command]
pub fn agent_stop(
    process_state: State<'_, AgentProcessState>,
    client_state: State<'_, AgentClientState>,
) -> Result<ApiResponse, String> {
    if let Ok(mut client) = client_state.lock()
        && let Some(existing) = client.take()
    {
        let _ = existing.disconnect();
    }
    process_state.stop();
    logging::agent_output("system", "Agent 已停止");
    Ok(ApiResponse::ok("Agent 已停止"))
}

/// Connect to agent.
#[tauri::command]
pub async fn agent_connect(
    _maafw: State<'_, MaaFrameworkState>,
    client_state: State<'_, AgentClientState>,
    socket_id: String,
) -> Result<ApiResponse, String> {
    let shared_state = client_state.shared();
    tauri::async_runtime::spawn_blocking(move || {
        let client_guard = shared_state
            .lock()
            .map_err(|_| "AgentClient 状态锁已损坏".to_string())?;
        let client = client_guard
            .as_ref()
            .ok_or_else(|| "AgentClient 尚未创建，请先启动 Agent".to_string())?;
        client
            .connect()
            .map_err(|error| format!("连接 AgentServer 失败: {error}"))?;
        if !client.connected() {
            return Err("AgentServer 未建立连接".to_string());
        }
        Ok(())
    })
    .await
    .map_err(|error| format!("Agent 连接任务异常: {error}"))??;
    Ok(ApiResponse::ok_with_data(
        "Agent 已连接",
        serde_json::json!({ "info": { "Socket": socket_id } }),
    ))
}
