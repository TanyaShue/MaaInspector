from flask import Flask, jsonify, request
from flask_cors import CORS
import time
import random

app = Flask(__name__)
CORS(app)

# 模拟各模块状态
states = {
    "device": {"connected": False},
    "resource": {"loaded": False},
    "agent": {"connected": False}
}

# --- 通用辅助函数 ---
def mock_delay():
    time.sleep(random.uniform(0.5, 1.5))

# === 1. 设备接口 ===
@app.route('/device/connect', methods=['POST'])
def device_connect():
    mock_delay()
    states["device"]["connected"] = True
    return jsonify({"message": "Device Ready", "info": {"ID": "Arm-V2", "IP": "192.168.1.10"}})

@app.route('/device/disconnect', methods=['POST'])
def device_disconnect():
    mock_delay()
    states["device"]["connected"] = False
    return jsonify({"message": "Device Offline"})

# === 2. 资源接口 (只加载) ===
@app.route('/resource/load', methods=['POST'])
def resource_load():
    data = request.json
    path = data.get('path', '')

    mock_delay()
    states["resource"] = True

    # 模拟根据路径扫描到的文件列表
    mock_files = [
        f"config_{path}_v1.json",
        "model_weights.pt",
        "labels.txt",
        "calibration_data.csv"
    ]

    return jsonify({
        "message": "Loaded",
        "list": mock_files,  # 返回给前端下拉框用
        "info": {"Path": path, "Files": len(mock_files)}
    })

# === 3. Agent 接口 ===
@app.route('/agent/connect', methods=['POST'])
def agent_connect():
    data = request.json
    socket_id = data.get('socket_id', 'unknown')

    mock_delay()
    states["agent"] = True
    return jsonify({
        "message": "Agent Linked",
        "info": {"Socket": socket_id, "Latency": "12ms"}
    })
@app.route('/agent/disconnect', methods=['POST'])
def agent_disconnect():
    mock_delay()
    states["agent"]["connected"] = False
    return jsonify({"message": "Agent Stopped"})

if __name__ == '__main__':
    app.run(port=5000, debug=True)