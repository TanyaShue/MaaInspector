import base64
import mimetypes
import random
import json
import os
import time
from flask import Flask, jsonify, request
from flask_cors import CORS
from maa.toolkit import Toolkit

from backend.untils import JsonNodeLoader
from backend.untils.maafw import maafw

app = Flask(__name__)
CORS(app)

CONFIG_FILE = 'config.json'

DEFAULT_CONFIG = {
    "devices": [],
    "resource_profiles": [
        {
            "name": "Default Profile",
            "paths": ["D:/Project/Assets/Common", "D:/Project/Assets/Level1"]
        }
    ],
    "agent_socket_id": "",
    "current_state": {
        "device_index": 0,
        "resource_profile_index": 0,
        "resource_file": "",
        "agent_socket_id": ""
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


@app.route('/system/init', methods=['GET'])
def system_init():
    return jsonify(load_config())


@app.route('/system/config/save', methods=['POST'])
def system_save_config():
    data = request.json
    if save_config(data):
        return jsonify({"message": "Saved"})
    else:
        return jsonify({"message": "Save failed"}), 500


@app.route('/system/devices/search', methods=['POST'])
def search_devices():
    devices=Toolkit.find_adb_devices()
    formatted_devices = []
    for d in devices:
        formatted_devices.append({
            "name": "ADB Device",  # 你可以改成 d.name  或自定义
            "address": d.address.strip(),  # 去掉换行符
            "adb_path": str(d.adb_path) if d.adb_path else "",
            "config": d.config or {}
        })
    return jsonify({"message": "OK", "devices": formatted_devices})


# === 资源接口 (核心修改) ===
@app.route('/resource/load', methods=['POST'])
def resource_load():
    data = request.json

    if "path" in data:
        data = data["path"]

    paths = data.get('paths', [])
    profile_name = data.get('name', 'Unknown')

    combined_files = []

    for idx, path in enumerate(paths):
        if not path:
            continue

        # 路径最后一段
        source_label = os.path.basename(os.path.normpath(path))

        if not os.path.exists(path):
            combined_files.append({
                "label": f"[Missing Folder] ({source_label})",
                "value": None,
                "source": path,
                "filename": None
            })
            continue

        # ================================
        # 2. pipeline 子文件夹判断
        # ================================
        pipeline_dir = os.path.join(path, "pipeline")

        if not os.path.exists(pipeline_dir) or not os.path.isdir(pipeline_dir):
            combined_files.append({
                "label": f"[No pipeline folder] ({source_label})",
                "value": None,
                "source": path,
                "filename": None
            })
            continue

        # ================================
        # 3. 扫描 pipeline 目录下的所有 JSON 文件
        # ================================
        json_files = [f for f in os.listdir(pipeline_dir) if f.lower().endswith(".json")]

        if not json_files:
            combined_files.append({
                "label": f"[No JSON Files] ({source_label})",
                "value": None,
                "source": pipeline_dir,
                "filename": None
            })
            continue

        # ================================
        # 4. 加入返回列表
        # ================================
        for f in json_files:
            combined_files.append({
                "label": f"{f} ({source_label})",
                "value": f,
                "source": pipeline_dir,
                "filename": f
            })

    return jsonify({
        "message": f"Loaded {len(combined_files)} resources",
        "list": combined_files,
        "info": {"Profile": profile_name, "Paths": len(paths)}
    })


@app.route('/resource/file/nodes', methods=['POST'])
def get_file_nodes():
    """
    获取指定文件的节点内容
    Payload: { "source": "文件夹路径", "filename": "文件名.json" }
    """
    data = request.json
    folder_path = data.get('source')
    filename = data.get('filename')

    if not folder_path or not filename:
        return jsonify({"message": "Missing path or filename"}), 400

    try:
        # 实例化 Loader (仅针对当前请求的文件夹)
        loader = JsonNodeLoader(folder_path)

        # 获取该文件下的所有节点数据
        # 格式: { "node_id_1": { ...content... }, "node_id_2": { ... } }
        nodes_data = loader.get_nodes_by_file(filename)

        if nodes_data is None:
            return jsonify({"message": "File not found or empty", "nodes": {}}), 404

        return jsonify({
            "message": "Nodes loaded",
            "nodes": nodes_data
        })
    except Exception as e:
        print(f"Error loading nodes: {e}")
        return jsonify({"message": f"Error: {str(e)}"}), 500


@app.route('/resource/file/save', methods=['POST'])
def resource_file_save():
    """
    保存节点数据到指定 JSON 文件
    """
    try:
        data = request.json
        # print(data) # 调试用
        folder_path = data.get('source')
        filename = data.get('filename')
        nodes_data = data.get('nodes', {})  # 变量名改一下，避免歧义

        if not folder_path or not filename:
            return jsonify({"message": "Missing path or filename"}), 400

        full_path = os.path.join(folder_path, filename)

        save_content = {}

        # === 核心修复逻辑 ===
        # 判断前端传的是 字典(已处理) 还是 列表(VueFlow原始数据)
        if isinstance(nodes_data, dict):
            # 情况 A: 前端已经把数据格式化为 { "ID": { ... } }
            # 直接使用，或者做简单的清理
            save_content = nodes_data

        elif isinstance(nodes_data, list):
            # 情况 B: 前端传的是数组 [ {id: "xx", data: { ... }}, ... ]
            # 需要执行之前的提取逻辑
            for node in nodes_data:
                node_id = node.get('id')

                # 获取 data.data (业务数据)
                node_data_wrapper = node.get('data', {})
                # 兼容处理：有的节点可能直接把数据放在 data 下，有的在 data.data 下
                business_data = node_data_wrapper.get('data', node_data_wrapper)

                clean_data = business_data.copy() if isinstance(business_data, dict) else {}

                # 移除冗余的 id
                if 'id' in clean_data:
                    del clean_data['id']

                save_content[node_id] = clean_data
        else:
            return jsonify({"message": "Invalid nodes format (must be dict or list)"}), 400

        # === 写入文件 ===
        # 确保父目录存在
        parent_dir = os.path.dirname(full_path)
        if not os.path.exists(parent_dir):
            os.makedirs(parent_dir)  # 自动创建缺失的文件夹

        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(save_content, f, indent=4, ensure_ascii=False)

        return jsonify({
            "success": True,
            "message": f"Saved {len(save_content)} nodes to {filename}"
        })

    except Exception as e:
        print(f"Error saving file: {e}")
        import traceback
        traceback.print_exc()  # 打印完整堆栈方便调试
        return jsonify({"message": f"Save failed: {str(e)}", "success": False}), 500

@app.route('/resource/file/templates', methods=['POST'])
def get_file_templates():
    """
    获取指定文件中所有节点 template 属性对应的图片数据 (Base64)
    Payload: { "source": "pipeline文件夹路径", "filename": "文件名.json" }
    """
    data = request.json
    pipeline_path = data.get('source')
    filename = data.get('filename')

    if not pipeline_path or not filename:
        return jsonify({"message": "Missing path or filename"}), 400

    # 1. 推导 image 目录路径
    # source 传入的是 .../resource_v1/pipeline
    # 我们需要找到 .../resource_v1/image
    try:
        # 去掉路径末尾可能的斜杠以确保 dirname 工作正常
        clean_pipeline_path = os.path.normpath(pipeline_path)
        profile_path = os.path.dirname(clean_pipeline_path)  # 回退一级
        image_base_path = os.path.join(profile_path, "image")  # 进入 image 目录

        if not os.path.exists(image_base_path):
            return jsonify({
                "message": "Image directory not found",
                "image_path": image_base_path,
                "results": {}
            }), 404

        # 2. 加载节点数据
        loader = JsonNodeLoader(pipeline_path)
        nodes_data = loader.get_nodes_by_file(filename)

        if not nodes_data:
            return jsonify({"message": "File empty or not found", "results": {}}), 404

        results = {}

        # 3. 遍历节点查找 template
        for node_id, node_content in nodes_data.items():
            if "template" not in node_content:
                continue

            templates = node_content["template"]

            # 统一转为列表处理
            if isinstance(templates, str):
                templates = [templates]
            elif not isinstance(templates, list):
                continue  # 如果既不是str也不是list，跳过

            node_images = []

            for img_rel_path in templates:
                # 拼接完整路径: image_base_path + template值 (e.g. "寮30/寮301.png")
                full_img_path = os.path.join(image_base_path, img_rel_path)

                img_info = {
                    "path": img_rel_path,
                    "found": False,
                    "base64": None
                }

                if os.path.exists(full_img_path):
                    try:
                        # 识别 mime type (e.g., image/png)
                        mime_type, _ = mimetypes.guess_type(full_img_path)
                        if not mime_type:
                            mime_type = "image/png"  # 默认 fallback

                        with open(full_img_path, "rb") as img_f:
                            # 读取二进制并转为 Base64
                            b64_data = base64.b64encode(img_f.read()).decode('utf-8')
                            img_info["found"] = True
                            img_info["base64"] = f"data:{mime_type};base64,{b64_data}"
                    except Exception as e:
                        print(f"Error reading image {full_img_path}: {e}")

                node_images.append(img_info)

            if node_images:
                results[node_id] = node_images

        return jsonify({
            "message": "Images loaded",
            "base_image_path": image_base_path,
            "results": results
        })

    except Exception as e:
        print(f"Error processing templates: {e}")
        return jsonify({"message": f"Error: {str(e)}"}), 500

@app.route('/resource/file/create', methods=['POST'])
def resource_file_create():
    data = request.json
    base_path = data.get('path')  # 用户选择的基础路径 (resource profile path)
    filename = data.get('filename')

    if not base_path or not filename:
        return jsonify({"message": "Path and filename are required"}), 400

    if not filename.endswith('.json'):
        filename += '.json'

    # 逻辑适配：根据你的 resource_load 逻辑，文件应位于 pipeline 子目录
    pipeline_dir = os.path.join(base_path, "pipeline")

    try:
        # 如果 pipeline 目录不存在，自动创建
        if not os.path.exists(pipeline_dir):
            os.makedirs(pipeline_dir)

        full_path = os.path.join(pipeline_dir, filename)

        if os.path.exists(full_path):
            return jsonify({"message": "File already exists"}), 409  # Conflict

        # 创建空的 JSON 结构，或者包含基础 ID 的结构
        initial_content = {}

        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(initial_content, f, indent=4, ensure_ascii=False)

        return jsonify({
            "message": "File created successfully",
            "filename": filename,
            "full_path": full_path
        })
    except Exception as e:
        print(f"Error creating file: {e}")
        return jsonify({"message": f"Create failed: {str(e)}"}), 500
# === 设备与Agent接口 (保持简单兼容) ===
@app.route('/device/connect', methods=['POST'])
def device_connect():
    info = request.json or {}

    adb_path = info.get("adb_path")
    address = info.get("address")
    config = info.get("config")
    name = info.get("name")
    print(config)
    # 调用底层 adb 连接
    r = maafw.connect_adb(adb_path, address, config)
    print("connect result:", r)

    # r 结构形如：(True/False, "Message...")
    success, message = r if isinstance(r, tuple) and len(r) == 2 else (False, "Invalid return value from connect_adb")

    if success:
        # 连接成功
        return jsonify({
            "success": True,
            "message": "Device Ready",
            "info": {
                "id": name,
                "ip": address,
                "detail": message
            }
        }), 200

    # 连接失败
    return jsonify({
        "success": False,
        "message": "Device Not Ready",
        "error": message
    }), 400

@app.route('/device/disconnect', methods=['POST'])
def device_disconnect():
    return jsonify({"message": "Device Offline"})

@app.route('/device/screenshot', methods=['GET'])
def device_screenshot():
    """
    获取设备截图
    目前返回静态图片 banner_placeholder.jpg
    """
    try:
        print("111111111111")
        # 假设图片在 static 或者当前目录下，这里为了方便直
        # 接在根目录或 backend 目录下找
        # 你需要确保目录下有一张名为 banner_placeholder.jpg 的图片
        img_path = 'banner_placeholder.jpg'

        # 如果文件不存在，为了防止报错，创建一个简单的提示 (仅演示逻辑，实际请放入一张图片)
        if not os.path.exists(img_path):
            return jsonify({"success": False, "message": "Placeholder image not found on server"}), 404

        mime_type, _ = mimetypes.guess_type(img_path)
        if not mime_type:
            mime_type = "image/jpeg"

        with open(img_path, "rb") as img_f:
            b64_data = base64.b64encode(img_f.read()).decode('utf-8')
            return jsonify({
                "success": True,
                "image": f"data:{mime_type};base64,{b64_data}",
                "size": [1280, 720]  # 告知前端原始尺寸
            })

    except Exception as e:
        print(f"Error getting screenshot: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

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