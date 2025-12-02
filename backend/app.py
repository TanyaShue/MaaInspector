# app.py
import os
import json
import base64
import mimetypes
import random
import time
from typing import Any, Dict, List, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

# 假设这些模块依然存在
from maa.toolkit import Toolkit
from backend.untils import JsonNodeLoader
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
    if data is not None: payload.update(data)
    return jsonify(payload), status


def load_config() -> Dict[str, Any]:
    if not os.path.exists(CONFIG_FILE): return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f) or {}
        # 简单的合并逻辑，保证 key 存在
        for k, v in DEFAULT_CONFIG.items():
            if k not in cfg: cfg[k] = v
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
        print(f"Save config error: {e}")
        return False


def _encode_image_to_base64(fullpath: str) -> Optional[str]:
    if not os.path.exists(fullpath): return None
    mime, _ = mimetypes.guess_type(fullpath)
    try:
        with open(fullpath, "rb") as f:
            return f"data:{mime or 'application/octet-stream'};base64,{base64.b64encode(f.read()).decode('utf-8')}"
    except:
        return None


# ---------------------------
# 路由：系统 & 配置
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
# 路由：资源管理 (重构重点)
# ---------------------------
@app.route("/resource/load", methods=["POST"])
def resource_load():
    payload = request.get_json(force=True, silent=True) or {}
    if "path" in payload and isinstance(payload["path"], dict):
        payload = payload["path"]

    paths = payload.get("paths", []) or []
    results = []

    for p in paths:
        if not p: continue
        p = _norm_path(p)
        pipeline_path = os.path.join(p, "pipeline")
        source_label = os.path.basename(p)

        # 这里使用 JsonNodeLoader 仅仅为了获取文件列表（复用其逻辑）
        # 或者为了轻量级，直接 os.listdir 也可以，但为了统一，我们只做简单的列表
        if not os.path.isdir(pipeline_path):
            results.append({"label": f"[No pipeline] ({source_label})", "value": None, "source": p, "filename": None})
            continue

        try:
            # 实例化 Loader 来获取文件列表（虽然有点重，但保证逻辑一致）
            # 如果性能敏感，可以直接 os.listdir
            files = [f for f in os.listdir(pipeline_path) if f.lower().endswith(".json")]
            if not files:
                results.append(
                    {"label": f"[Empty] ({source_label})", "value": None, "source": pipeline_path, "filename": None})
            else:
                for f in files:
                    results.append(
                        {"label": f"{f} ({source_label})", "value": f, "source": pipeline_path, "filename": f})
        except Exception:
            pass

    return jsonify({"message": "Loaded", "list": results})


@app.route("/resource/file/nodes", methods=["POST"])
def get_file_nodes():
    data = request.get_json(force=True, silent=True) or {}
    folder_path = _norm_path(data.get("source"))
    filename = data.get("filename")

    if not folder_path or not filename:
        return _json_response(False, "Missing params", status=400)

    try:
        # 委托给 Loader
        loader = JsonNodeLoader(folder_path)
        nodes = loader.get_nodes_by_file(filename)
        if nodes is None:
            return _json_response(False, "File not found", {"nodes": {}}, 404)
        return _json_response(True, "Loaded", {"nodes": nodes})
    except Exception as e:
        return _json_response(False, str(e), status=500)


@app.route("/resource/file/save", methods=["POST"])
def resource_file_save():
    data = request.get_json(force=True, silent=True) or {}
    folder_path = _norm_path(data.get("source"))
    filename = data.get("filename")
    nodes_data = data.get("nodes")  # List 或 Dict

    if not folder_path or not filename or nodes_data is None:
        return _json_response(False, "Missing params", status=400)

    try:
        # 委托给 Loader 处理保存逻辑
        loader = JsonNodeLoader(folder_path)
        count = loader.save_file_content(filename, nodes_data)
        return _json_response(True, f"Saved {count} nodes", {"saved_count": count})
    except Exception as e:
        print(f"Save error: {e}")
        return _json_response(False, f"Save failed: {e}", status=500)


@app.route("/resource/file/create", methods=["POST"])
def resource_file_create():
    data = request.get_json(force=True, silent=True) or {}
    base_path = _norm_path(data.get("path"))
    filename = data.get("filename")

    if not base_path or not filename:
        return _json_response(False, "Missing params", status=400)

    pipeline_dir = os.path.join(base_path, "pipeline")
    try:
        loader = JsonNodeLoader(pipeline_dir)
        if loader.create_file(filename):
            full_path = os.path.join(pipeline_dir, filename if filename.endswith(".json") else f"{filename}.json")
            return _json_response(True, "Created", {"filename": filename, "full_path": full_path})
        else:
            return _json_response(False, "File already exists", status=409)
    except Exception as e:
        return _json_response(False, str(e), status=500)


@app.route("/resource/search/nodes", methods=["POST"])
def search_nodes_globally():
    """
    全局搜索节点：遍历配置中的所有 Path，使用 JsonNodeLoader 进行搜索
    """
    data = request.get_json(force=True, silent=True) or {}
    query = data.get("query", "")
    use_regex = data.get("use_regex", False)
    current_filename = data.get("current_filename", "")

    if not query:
        return jsonify({"results": []})

    cfg = load_config()
    results = []

    # 遍历所有配置的资源路径
    # 以前这里手动写了三层循环和文件打开逻辑，现在简化为调用 Loader
    for profile in cfg.get("resource_profiles", []):
        for base_path in profile.get("paths", []) or []:
            pipeline_dir = os.path.join(_norm_path(base_path) or "", "pipeline")
            if not os.path.isdir(pipeline_dir):
                continue

            try:
                # 实例化 Loader (它会自动索引该目录下所有文件)
                # 注意：如果目录文件巨多，频繁实例化会有性能损耗。
                # 但考虑到这是桌面端工具或低频操作，且为了逻辑解耦，这样是可以接受的。
                loader = JsonNodeLoader(pipeline_dir)

                # 调用 Loader 的搜索
                hits = loader.search_nodes(query, use_regex=use_regex, exclude_file=current_filename)

                # 限制每个目录的返回数量防止爆炸，或者全部加进去
                results.extend(hits)

                if len(results) > 50:  # 全局截断
                    break
            except Exception as e:
                print(f"Search error in {pipeline_dir}: {e}")

        if len(results) > 50:
            break

    return jsonify({"results": results[:50]})


@app.route("/resource/file/templates", methods=["POST"])
def get_file_templates():
    """获取节点引用的图片模板"""
    data = request.get_json(force=True, silent=True) or {}
    pipeline_path = _norm_path(data.get("source"))
    filename = data.get("filename")

    if not pipeline_path or not filename:
        return _json_response(False, "Missing params", status=400)

    try:
        profile_path = os.path.dirname(pipeline_path)
        image_base = os.path.join(profile_path, "image")

        loader = JsonNodeLoader(pipeline_path)
        nodes = loader.get_nodes_by_file(filename) or {}

        results = {}
        for node_id, content in nodes.items():
            if not isinstance(content, dict): continue

            # 处理 template 字段 (str 或 list)
            tpls = content.get("template")
            if not tpls: continue
            if isinstance(tpls, str): tpls = [tpls]

            node_images = []
            for t in tpls:
                if not isinstance(t, str): continue
                full_img = os.path.join(image_base, t)
                b64 = _encode_image_to_base64(full_img)
                node_images.append({
                    "path": t,
                    "found": bool(b64),
                    "base64": b64
                })

            if node_images:
                results[node_id] = node_images
        # safe_results = {}
        # for node_id, imgs in results.items():
        #     safe_results[node_id] = []
        #     for item in imgs:
        #         # 复制字典避免修改原始数据
        #         new_item = dict(item)
        #         new_item["base64"] = "base64..."
        #         safe_results[node_id].append(new_item)
        #
        # print(safe_results)
        return _json_response(True, "Loaded", {"base_image_path": image_base, "results": results})
    except Exception as e:
        return _json_response(False, str(e), status=500)


@app.route("/resource/images/check-unused", methods=["POST"])
def check_unused_images():
    """
    检查待删除图片是否被其他节点引用
    请求体: {
        "source": "pipeline文件夹路径",
        "current_filename": "当前文件名",
        "del_images": [{"path": "图片路径", ...}, ...]
    }
    返回: {
        "unused_images": ["未被引用的图片路径列表"],
        "used_images": [{"path": "被引用的图片路径", "used_by": ["引用的节点ID"]}]
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    source = _norm_path(data.get("source"))
    current_filename = data.get("current_filename", "")
    del_images = data.get("del_images", [])

    if not source or not del_images:
        return _json_response(True, "No images to check", {"unused_images": [], "used_images": []})

    try:
        # 获取所有待检查的图片路径
        paths_to_check = [img.get("path") for img in del_images if img.get("path")]
        if not paths_to_check:
            return _json_response(True, "No valid paths", {"unused_images": [], "used_images": []})

        # 遍历所有 JSON 文件，检查 template 属性
        used_map = {}  # path -> [nodeId, ...]
        for filename in os.listdir(source):
            if not filename.lower().endswith(".json"):
                continue
            # 跳过当前文件（当前文件的引用由前端处理）
            if filename == current_filename:
                continue

            filepath = os.path.join(source, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    file_content = json.load(f)

                for node_id, node_data in file_content.items():
                    if not isinstance(node_data, dict):
                        continue
                    template = node_data.get("template")
                    if not template:
                        continue
                    if isinstance(template, str):
                        template = [template]

                    for path in paths_to_check:
                        if path in template:
                            if path not in used_map:
                                used_map[path] = []
                            used_map[path].append(f"{filename}:{node_id}")
            except Exception as e:
                print(f"Error reading {filepath}: {e}")
                continue

        # 分类结果
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
        "source": "pipeline文件夹路径",
        "delete_paths": ["要删除的图片路径列表"],
        "save_images": [{"path": "保存路径", "base64": "base64数据"}, ...]
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    source = _norm_path(data.get("source"))
    delete_paths = data.get("delete_paths", [])
    save_images = data.get("save_images", [])

    if not source:
        return _json_response(False, "Missing source path", status=400)

    # 计算 image 文件夹路径（pipeline 的同级目录）
    profile_path = os.path.dirname(source)
    image_base = os.path.join(profile_path, "image")

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
        full_path = os.path.join(image_base, path)
        try:
            if os.path.exists(full_path):
                os.remove(full_path)
                results["deleted"].append(path)
                # 尝试删除空的父目录
                parent_dir = os.path.dirname(full_path)
                if parent_dir != image_base and os.path.isdir(parent_dir) and not os.listdir(parent_dir):
                    os.rmdir(parent_dir)
            else:
                results["delete_failed"].append({"path": path, "reason": "File not found"})
        except Exception as e:
            results["delete_failed"].append({"path": path, "reason": str(e)})

    # 保存临时图片
    for img in save_images:
        path = img.get("path")
        base64_data = img.get("base64")
        if not path or not base64_data:
            continue

        full_path = os.path.join(image_base, path)
        try:
            # 创建目录（如果不存在）
            parent_dir = os.path.dirname(full_path)
            if not os.path.exists(parent_dir):
                os.makedirs(parent_dir)

            # 解码并保存图片
            # base64 格式: "data:image/png;base64,xxxx"
            if ";base64," in base64_data:
                base64_data = base64_data.split(";base64,")[1]

            with open(full_path, "wb") as f:
                f.write(base64.b64decode(base64_data))

            results["saved"].append(path)
        except Exception as e:
            results["save_failed"].append({"path": path, "reason": str(e)})

    return _json_response(True, "Processed", results)


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
    # 占位符逻辑
    img_path = os.path.join(os.getcwd(), "banner_placeholder.jpg")
    b64 = _encode_image_to_base64(img_path)
    if b64:
        return _json_response(True, "OK", {"image": b64, "size": [1280, 720]})
    return _json_response(False, "No image", status=404)


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


if __name__ == "__main__":
    app.run(port=5000, debug=True)