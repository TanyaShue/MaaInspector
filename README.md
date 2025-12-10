# MaaInspector

为 [maafw](https://github.com/MaaAssistantArknights/framework) 设计的可视化节点编辑器，提供图形化、低代码的工作流创建与调试环境。

> 当前仍处于开发阶段，功能尚在完善中。

## 功能特性

- 可视化拖拽，直观构建 `maafw` 工作流
- 内置运行与调试，实时查看任务状态
- 节点属性面板，快速配置参数
- 画布缩放/平移/小地图，适配复杂流程
- 基于 Tauri，暂时仅支持 Windows
- 自动布局保持流程清晰

## 下载与快速体验

1. 前往仓库的 **Releases** 页面，下载与你系统匹配的安装包或压缩包。
2. Windows：解压后直接运行 `MaaInspector.exe`；macOS / Linux：给予可执行权限后运行对应二进制。
3. 如遇启动问题，请确保解压路径无中文/空格，并查看发行说明中的已知问题。

> 仅体验/使用时无需安装 Node.js、Rust、Python 等开发依赖。

## 开发与构建

仅在需要参与开发或自行构建时，才需要拉取代码并安装环境。

**环境要求**
- [Node.js](https://nodejs.org/en)
- [Rust](https://www.rust-lang.org/tools/install)（Tauri 构建）
- [Python](https://www.python.org/downloads/)（后端）

**1) 克隆仓库**
```bash
git clone https://github.com/your-username/MaaInspector.git
cd MaaInspector
```

**2) 安装前端依赖**
```bash
npm install
```

**3) 安装后端依赖**
```bash
pip install -r backend/requirements.txt
```

**4) 启动开发环境**
```bash
npm run tauri dev
```

**5) 构建安装包**
```bash
npm run tauri build
```

## 项目结构

```
.
├── backend/            # Python Flask 后端
│   ├── app.py
│   └── requirements.txt
├── src/                # Vue 3 前端源码
│   ├── components/
│   ├── App.vue
│   └── main.ts
├── src-tauri/          # Tauri Rust 核心
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
├── package.json        # 前端依赖与脚本
└── README.md
```
