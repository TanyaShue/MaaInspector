use super::MaaFrameworkState;
use crate::config::AgentProfile;
use crate::response::ApiResponse;
use maa_framework::agent_client::AgentClient;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Default)]
pub struct AgentProcessState(Mutex<Option<Child>>);

impl AgentProcessState {
    fn lock(&self) -> std::sync::LockResult<std::sync::MutexGuard<'_, Option<Child>>> {
        self.0.lock()
    }
}

impl Drop for AgentProcessState {
    fn drop(&mut self) {
        if let Ok(process) = self.0.get_mut()
            && let Some(mut child) = process.take()
        {
            let _ = child.kill();
            let _ = child.wait();
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
            let _ = existing.kill();
            let _ = existing.wait();
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
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let child = command.spawn().map_err(|error| {
            format!(
                "启动 Agent 失败（{}，工作目录 {}）: {error}",
                executable.display(),
                working_directory.display()
            )
        })?;
        pid = Some(child.id());
        *guard = Some(child);
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
