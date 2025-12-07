# app.py
import os
import json
import base64
import mimetypes
import time
from io import BytesIO
from typing import Any, Dict, List, Optional

from PIL import Image
from flask import Flask, jsonify, request
from flask_cors import CORS
from maa.resource import Resource

# 假设这些模块依然存在
from maa.toolkit import Toolkit
from backend.untils import ResourcesManager
from backend.untils.maafw import maafw

app = Flask(__name__)
CORS(app)

CONFIG_FILE = "config.json"
DEFAULT_CONFIG = {
    "devices": [],
    "resource_profiles": [{"name": "Default Profile", "paths": []}],
    "current_state": {"device_index": 0, "resource_profile_index": 0}
}
states = {"device": {"connected": False}, "resource": {"loaded": False}, "agent": {"connected": False}}


# ---------------------------
# 基础工具
# ---------------------------
def _norm_path(p: Optional[str]) -> Optional[str]:
    return os.path.normpath(p) if p else None


def _json_response(ok: bool, message: str = "", data: Optional[dict] = None, status: int = 200):
    payload = {"success": ok, "message": message}
    if data is not None:
        payload.update(data)
    return jsonify(payload), status


def load_config() -> Dict[str, Any]:
    if not os.path.exists(CONFIG_FILE):
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f) or {}
        for k, v in DEFAULT_CONFIG.items():
            if k not in cfg:
                cfg[k] = v
        return cfg
    except Exception:
        return DEFAULT_CONFIG.copy()


def save_config(data: Dict[str, Any]) -> bool:
    try:
        current = load_config()
        current.update(data)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(current, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        return False


def _encode_image_to_base64(fullpath: str) -> Optional[str]:
    if not os.path.exists(fullpath):
        return None
    mime, _ = mimetypes.guess_type(fullpath)
    try:
        with open(fullpath, "rb") as f:
            return f"data:{mime or 'application/octet-stream'};base64,{base64.b64encode(f.read()).decode('utf-8')}"
    except:
        return None


def encode_pil_image_to_base64(img: Image.Image, mime: str = "image/png") -> str:
    """将 PIL Image 对象转换为 base64 data URI。"""
    buffer = BytesIO()
    format = mime.split("/")[-1].upper()
    img.save(buffer, format=format)
    base64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:{mime};base64,{base64_str}"


# ---------------------------
# 系统接口
# ---------------------------
@app.route("/system/init", methods=["GET"])
def system_init():
    return jsonify(load_config())


@app.route("/system/config/save", methods=["POST"])
def system_save_config():
    data = request.get_json(force=True, silent=True) or {}
    if save_config(data):
        return _json_response(True, "Saved")
    return _json_response(False, "Save failed", status=500)


@app.route("/system/devices/search", methods=["POST"])
def search_devices():
    devices = []
    if Toolkit and hasattr(Toolkit, "find_adb_devices"):
        try:
            raw = Toolkit.find_adb_devices()
            for d in raw or []:
                devices.append({
                    "name": getattr(d, "name", "ADB Device"),
                    "address": getattr(d, "address", "").strip(),
                    "adb_path": str(getattr(d, "adb_path", "") or ""),
                    "config": getattr(d, "config", {}) or {}
                })
        except Exception:
            pass
    return jsonify({"message": "OK", "devices": devices})


# ---------------------------
# 资源管理接口
# ---------------------------
@app.route("/resource/load", methods=["POST"])
def resource_load():
    """
    加载资源配置，返回所有可用的 JSON 文件列表
    
    请求体: { "paths": ["资源根目录1", "资源根目录2", ...] }
    或: { "path": { "paths": [...] } }
    
    返回: {
        "message": "Loaded",
        "list": [
            {"label": "filename (source_label)", "value": "filename", 
             "source": "资源根目录", "filename": "filename"},
            ...
        ]
    }
    """
    payload = request.get_json(force=True, silent=True) or {}
    if "path" in payload and isinstance(payload["path"], dict):
        payload = payload["path"]

    paths = payload.get("paths", []) or []
    print(paths)
    r=maafw.load_resource(paths)
    print(r)

    manager = ResourcesManager(paths)
    results = manager.list_all_files()

    return jsonify({"message": "Loaded", "list": results})


@app.route("/resource/file/nodes", methods=["POST"])
def get_file_nodes():
    """
    获取指定文件的所有节点
    
    请求体: { "source": "资源根目录", "filename": "文件名.json" }
    返回: { "success": true, "nodes": {...} }
    """
    data = request.get_json(force=True, silent=True) or {}
    resource_path = _norm_path(data.get("source"))
    filename = data.get("filename")

    if not resource_path or not filename:
        return _json_response(False, "Missing params", status=400)

    try:
        manager = ResourcesManager(resource_path)
        nodes = manager.get_nodes_by_file(resource_path, filename)
        
        if nodes is None:
            return _json_response(False, "File not found", {"nodes": {}}, 404)
        return _json_response(True, "Loaded", {"nodes": nodes})
    except Exception as e:
        return _json_response(False, str(e), status=500)


@app.route("/resource/file/save", methods=["POST"])
def resource_file_save():
    """
    保存节点数据到文件
    
    请求体: { "source": "资源根目录", "filename": "文件名.json", "nodes": {...} }
    """
    data = request.get_json(force=True, silent=True) or {}
    resource_path = _norm_path(data.get("source"))
    filename = data.get("filename")
    nodes_data = data.get("nodes")

    if not resource_path or not filename or nodes_data is None:
        return _json_response(False, "Missing params", status=400)

    try:
        manager = ResourcesManager(resource_path)
        count = manager.save_nodes(resource_path, filename, nodes_data)
        return _json_response(True, f"Saved {count} nodes", {"saved_count": count})
    except Exception as e:
        return _json_response(False, f"Save failed: {e}", status=500)


@app.route("/resource/file/create", methods=["POST"])
def resource_file_create():
    """
    创建新的空 JSON 文件
    
    请求体: { "path": "资源根目录", "filename": "文件名" }
    """
    data = request.get_json(force=True, silent=True) or {}
    resource_path = _norm_path(data.get("path"))
    filename = data.get("filename")

    if not resource_path or not filename:
        return _json_response(False, "Missing params", status=400)

    try:
        manager = ResourcesManager(resource_path)
        if manager.create_file(resource_path, filename):
            final_filename = filename if filename.endswith(".json") else f"{filename}.json"
            return _json_response(True, "Created", {
                "filename": final_filename,
                "source": resource_path
            })
        else:
            return _json_response(False, "File already exists", status=409)
    except Exception as e:
        return _json_response(False, str(e), status=500)


@app.route("/resource/search/nodes", methods=["POST"])
def search_nodes_globally():
    """
    全局搜索节点 (仅限当前选中的资源配置)

    请求体: {
        "query": "搜索词",
        "use_regex": false,
        "current_filename": "当前文件名",
        "current_source": "当前资源路径"
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    query = data.get("query", "")
    use_regex = data.get("use_regex", False)
    current_filename = data.get("current_filename", "")
    current_source = _norm_path(data.get("current_source", ""))

    if not query:
        return jsonify({"results": []})

    cfg = load_config()

    target_paths = []

    profiles = cfg.get("resource_profiles", [])
    current_state = cfg.get("current_state", {})

    # 获取当前选中的索引，默认为 0
    current_idx = int(current_state.get("resource_profile_index", 0))

    # 确保索引有效
    if profiles and 0 <= current_idx < len(profiles):
        current_profile = profiles[current_idx]
        raw_paths = current_profile.get("paths", []) or []
        for path in raw_paths:
            if path:
                target_paths.append(_norm_path(path))
    manager = ResourcesManager(target_paths)
    results = manager.search_nodes(
        query,
        use_regex=use_regex,
        exclude_file=current_filename,
        exclude_source=current_source,
        max_results=50
    )

    return jsonify({"results": results})

@app.route("/resource/file/templates", methods=["POST"])
def get_file_templates():
    """
    获取节点引用的图片模板
    
    请求体: { "source": "资源根目录", "filename": "文件名.json" }
    """
    data = request.get_json(force=True, silent=True) or {}
    resource_path = _norm_path(data.get("source"))
    filename = data.get("filename")

    if not resource_path or not filename:
        return _json_response(False, "Missing params", status=400)

    try:
        manager = ResourcesManager(resource_path)
        nodes = manager.get_nodes_by_file(resource_path, filename) or {}
        image_base = manager.get_image_base_path(resource_path)

        results = {}
        for node_id, content in nodes.items():
            if not isinstance(content, dict):
                continue

            tpls = content.get("template")
            if not tpls:
                continue
            if isinstance(tpls, str):
                tpls = [tpls]

            node_images = []
            for t in tpls:
                if not isinstance(t, str):
                    continue
                full_img = manager.get_image_path(resource_path, t)
                b64 = _encode_image_to_base64(full_img)
                node_images.append({
                    "path": t,
                    "found": bool(b64),
                    "base64": b64
                })

            if node_images:
                results[node_id] = node_images
                
        return _json_response(True, "Loaded", {"base_image_path": image_base, "results": results})
    except Exception as e:
        return _json_response(False, str(e), status=500)


@app.route("/resource/images/check-unused", methods=["POST"])
def check_unused_images():
    """
    检查待删除图片是否被其他节点引用
    
    请求体: {
        "source": "资源根目录",
        "current_filename": "当前文件名",
        "del_images": [{"path": "图片路径", ...}, ...]
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    resource_path = _norm_path(data.get("source"))
    current_filename = data.get("current_filename", "")
    del_images = data.get("del_images", [])

    if not resource_path or not del_images:
        return _json_response(True, "No images to check", {"unused_images": [], "used_images": []})

    try:
        paths_to_check = [img.get("path") for img in del_images if img.get("path")]
        if not paths_to_check:
            return _json_response(True, "No valid paths", {"unused_images": [], "used_images": []})

        manager = ResourcesManager(resource_path)
        used_map = manager.check_image_references(resource_path, paths_to_check, exclude_file=current_filename)

        unused_images = [p for p in paths_to_check if p not in used_map]
        used_images = [{"path": p, "used_by": nodes} for p, nodes in used_map.items()]

        return _json_response(True, "Checked", {
            "unused_images": unused_images,
            "used_images": used_images
        })
    except Exception as e:
        return _json_response(False, str(e), status=500)


@app.route("/resource/images/process", methods=["POST"])
def process_images():
    """
    处理图片：删除指定图片并保存临时图片
    
    请求体: {
        "source": "资源根目录",
        "delete_paths": ["要删除的图片路径列表"],
        "save_images": [{"path": "保存路径", "base64": "base64数据"}, ...]
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    resource_path = _norm_path(data.get("source"))
    delete_paths = data.get("delete_paths", [])
    save_images = data.get("save_images", [])

    if not resource_path:
        return _json_response(False, "Missing source path", status=400)

    manager = ResourcesManager(resource_path)
    
    results = {
        "deleted": [],
        "delete_failed": [],
        "saved": [],
        "save_failed": []
    }

    # 删除图片
    for path in delete_paths:
        if not path:
            continue
        try:
            if manager.delete_image(resource_path, path):
                results["deleted"].append(path)
            else:
                results["delete_failed"].append({"path": path, "reason": "File not found"})
        except Exception as e:
            results["delete_failed"].append({"path": path, "reason": str(e)})

    # 保存图片
    for img in save_images:
        path = img.get("path")
        base64_data = img.get("base64")
        if not path or not base64_data:
            continue
        try:
            manager.save_image(resource_path, path, base64_data)
            results["saved"].append(path)
        except Exception as e:
            results["save_failed"].append({"path": path, "reason": str(e)})

    return _json_response(True, "Processed", results)


# ---------------------------
# 设备接口
# ---------------------------
@app.route("/device/connect", methods=["POST"])
def device_connect():
    info = request.get_json(force=True, silent=True) or {}
    if maafw is None or not hasattr(maafw, "connect_adb"):
        return _json_response(False, "Backend logic missing", status=500)
    try:
        r = maafw.connect_adb(info.get("adb_path"), info.get("address"), info.get("config"))
        success, msg = r if isinstance(r, tuple) else (False, "Unknown")
        if success:
            return _json_response(True, "Device Ready", {"info": {"detail": msg}})
        return _json_response(False, msg, status=400)
    except Exception as e:
        return _json_response(False, str(e), status=500)


@app.route("/device/disconnect", methods=["POST"])
def device_disconnect():
    return _json_response(True, "Device Offline")


@app.route("/device/screenshot", methods=["GET"])
def device_screenshot():
    b64 = encode_pil_image_to_base64(maafw.screencap())
    if b64:
        return _json_response(True, "OK", {"image": b64, "size": [1280, 720]})
    return _json_response(False, "No image", status=404)


# ---------------------------
# Agent 接口
# ---------------------------
@app.route("/agent/connect", methods=["POST"])
def agent_connect():
    time.sleep(0.2)
    socket_id = (request.get_json(force=True, silent=True) or {}).get("socket_id")
    states["agent"]["connected"] = True
    return _json_response(True, "Agent Linked", {"info": {"Socket": socket_id}})


@app.route("/agent/disconnect", methods=["POST"])
def agent_disconnect():
    states["agent"]["connected"] = False
    return _json_response(True, "Agent Stopped")

@app.route("/debug/node", methods=["POST"])
def debug_node():
    data = request.get_json()
    node=data.get("node")
    # node["next"] = []
    node["on_error"] = []
    id=node.get("id")
    node=convert_node(node)
    print(node)
    print(data.get("debug_mode"))
    print(maafw.run_task(id, node))
    return _json_response(True, "debug_return Succest",{})


def convert_node(node: dict) -> dict:
    if not node or "id" not in node:
        return {}

    new_dict = node.copy()       # 复制避免修改原数据
    node_id = new_dict.pop("id") # 拿出 id
    return {node_id: new_dict}



if __name__ == "__main__":
    app.run(port=5001, debug=True)
