# MaaInspector

一款为 [maafw](https://github.com/MaaAssistantArknights/framework) 设计的可视化节点编辑器，旨在提供一个图形化、低代码的工作流创建与调试环境。

## 功能特性

- **可视化编辑**: 通过拖拽节点和连接来直观地构建 `maafw` 工作流。
- **实时调试**: 直接在编辑器中运行和调试工作流，实时查看任务状态和结果。
- **节点属性配置**: 为每个节点提供详细的参数配置面板。
- **便捷的视图操作**: 支持画布缩放、平移和小地图导航，轻松应对复杂工作流。
- **跨平台运行**: 基于 Tauri 构建，可打包为 Windows, macOS 和 Linux 桌面应用。
- **自动布局**: 提供自动整理节点布局的功能，保持工作流清晰易读。

## 技术栈

- **前端**:
  - [Vue 3](https://vuejs.org/)
  - [Vite](https://vitejs.dev/)
  - [Tauri](https://tauri.app/) (v2)
  - [Vue Flow](https://vueflow.dev/)
  - [Element Plus](https://element-plus.org/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [TypeScript](https://www.typescriptlang.org/)

- **后端**:
  - [Python](https://www.python.org/)
  - [Flask](https://flask.palletsprojects.com/)
  - [maafw](https://github.com/MaaAssistantArknights/framework)

## 快速开始

**环境要求:**
- [Node.js](https://nodejs.org/en)
- [Rust](https://www.rust-lang.org/tools/install)
- [Python](https://www.python.org/downloads/)

**1. 克隆仓库**
```bash
git clone https://github.com/your-username/MaaInspector.git
cd MaaInspector
```

**2. 安装前端依赖**
```bash
npm install
```

**3. 安装后端依赖**
```bash
pip install -r backend/requirements.txt
```

**4. 启动开发环境**
```bash
npm run tauri dev
```

**5. 构建应用**
```bash
npm run tauri build
```

## 📂 项目结构

```
.
├── backend/         # Python Flask 后端
│   ├── app.py       # 后端主程序
│   └── requirements.txt # Python 依赖
├── src/             # Vue 3 前端源码
│   ├── components/  # Vue 组件
│   ├── App.vue      # 主应用组件
│   └── main.ts      # 前端入口
├── src-tauri/       # Tauri Rust 核心
│   ├── Cargo.toml   # Rust 依赖
│   └── src/
│       └── main.rs  # Rust 入口
├── package.json     # 前端依赖和脚本
└── README.md        # 项目说明
```
