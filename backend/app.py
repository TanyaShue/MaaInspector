import random
import json
import os
import time
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

CONFIG_FILE = 'config.json'

# --- 新的默认配置结构 ---
DEFAULT_CONFIG = {
    # 设备列表
    "devices": [],
    # 资源配置集列表 (每个配置集包含名字和有序路径列表)
    "resource_profiles": [
        {
            "name": "Default Profile",
            "paths": ["D:/Project/Assets/Common", "D:/Project/Assets/Level1"]
        }
    ],
    # Agent 设置
    "agent_socket_id": "",

    # --- 新增：记录当前UI选中状态 ---
    "current_state": {
        "device_index": 0,
        "resource_profile_index": 0,
        "resource_file": "",  # 当前选中的具体文件
        "agent_socket_id": ""  # 记录上次输入的ID
    }
}


def load_config():
    if not os.path.exists(CONFIG_FILE):
        return DEFAULT_CONFIG
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # 简单的合并策略，确保新字段存在
            for key in DEFAULT_CONFIG:
                if key not in data:
                    data[key] = DEFAULT_CONFIG[key]
            # 确保 current_state 字段完整
            if "current_state" not in data:
                data["current_state"] = DEFAULT_CONFIG["current_state"]
            return data
    except Exception as e:
        print(f"Error loading config: {e}")
        return DEFAULT_CONFIG


def save_config(data):
    try:
        current = load_config()
        # 全量更新传入的顶级字段
        for key in data:
            current[key] = data[key]

        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(current, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False


# 模拟运行时状态
states = {
    "device": {"connected": False},
    "resource": {"loaded": False},
    "agent": {"connected": False}
}


def mock_delay():
    time.sleep(random.uniform(0.2, 0.6))


# === 系统接口 ===

@app.route('/system/init', methods=['GET'])
def system_init():
    return jsonify(load_config())


@app.route('/system/config/save', methods=['POST'])
def system_save_config():
    # 前端可能只发部分更新（比如只更新选中状态），也可能发全量
    data = request.json
    if save_config(data):
        return jsonify({"message": "Saved"})
    else:
        return jsonify({"message": "Save failed"}), 500


@app.route('/system/devices/search', methods=['POST'])
def search_devices():
    time.sleep(1.0)
    found_devices = [
        {"name": "ADB Device (USB)", "address": "127.0.0.1:5555", "adb_path": "", "config": {}},
        {"name": "LDPlayer (Emulator)", "address": "emulator-5554", "adb_path": "", "config": {}}
    ]
    return jsonify({"message": "OK", "devices": found_devices})


# === 资源接口 (核心修改) ===
@app.route('/resource/load', methods=['POST'])
def resource_load():
    # 接收整个 profile 对象，包含 paths
    data = request.json
    paths = data.get('paths', [])
    profile_name = data.get('name', 'Unknown')
    print(data)
    mock_delay()
    states["resource"] = True

    # 模拟扫描多个路径
    # 格式：{"file": "文件名", "source": "路径别名或最后一段路径"}
    combined_files = []

    for idx, path in enumerate(paths):
        # 提取路径的最后一部分作为源标识，例如 "D:/Assets/Common" -> "Common"
        source_label = os.path.basename(os.path.normpath(path)) if path else f"Path_{idx + 1}"

        # 模拟不同路径下发现的文件
        # 实际逻辑应该是 os.listdir(path)
        mock_scan = []
        if "Common" in path:
            mock_scan = ["config.json", "styles.css", "base_model.pt"]
        elif "Level" in path:
            mock_scan = ["map_data.json", "enemy_config.json"]
        else:
            mock_scan = [f"unknown_{idx}.txt"]

        for f in mock_scan:
            combined_files.append({
                "label": f"{f} ({source_label})",  # 前端显示的文字：1.json (A)
                "value": f,  # 选中后实际使用的值
                "source": path,  # 文件的完整来源路径
                "filename": f
            })

    return jsonify({
        "message": f"Loaded {len(combined_files)} resources",
        "list": combined_files,  # 返回结构化列表
        "info": {"Profile": profile_name, "Paths": len(paths)}
    })


# === 设备与Agent接口 (保持简单兼容) ===
@app.route('/device/connect', methods=['POST'])
def device_connect():
    mock_delay()
    states["device"]["connected"] = True
    info = request.json or {}
    return jsonify({"message": "Device Ready", "info": {"ID": info.get('name'), "IP": info.get('address')}})


@app.route('/device/disconnect', methods=['POST'])
def device_disconnect():
    mock_delay()
    states["device"]["connected"] = False
    return jsonify({"message": "Device Offline"})


@app.route('/agent/connect', methods=['POST'])
def agent_connect():
    mock_delay()
    states["agent"] = True
    data = request.json
    return jsonify({"message": "Agent Linked", "info": {"Socket": data.get('socket_id')}})


@app.route('/agent/disconnect', methods=['POST'])
def agent_disconnect():
    mock_delay()
    states["agent"]["connected"] = False
    return jsonify({"message": "Agent Stopped"})


if __name__ == '__main__':
    app.run(port=5000, debug=True)