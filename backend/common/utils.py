import base64
import json
import mimetypes
import os
from io import BytesIO
from typing import Any, Dict, Optional

from PIL import Image
from flask import jsonify

CONFIG_FILE = "config.json"
DEFAULT_CONFIG = {
    "devices": [],
    "resource_profiles": [{"name": "Default Profile", "paths": []}],
    "current_state": {"device_index": 0, "resource_profile_index": 0},
}

# 运行时状态占位，后续需要时可扩展
states = {"device": {"connected": False}, "resource": {"loaded": False}, "agent": {"connected": False}}


def norm_path(path: Optional[str]) -> Optional[str]:
    return os.path.normpath(path) if path else None


def convert_node(node: dict) -> dict:
    if not node or "id" not in node:
        return {}
    new_dict = node.copy()
    node_id = new_dict.pop("id")
    return {node_id: new_dict}


def json_response(ok: bool, message: str = "", data: Optional[dict] = None, status: int = 200):
    payload = {"success": ok, "message": message}
    if data is not None:
        payload.update(data)
    return jsonify(payload), status


def sse_format(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


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
    except Exception:
        return False


def encode_image_to_base64(fullpath: str) -> Optional[str]:
    if not os.path.exists(fullpath):
        return None
    mime, _ = mimetypes.guess_type(fullpath)
    try:
        with open(fullpath, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
            return f"data:{mime or 'application/octet-stream'};base64,{encoded}"
    except Exception:
        return None


def encode_pil_image_to_base64(img: Image.Image, mime: str = "image/png") -> str:
    """将 PIL Image 对象转换为 base64 data URI。"""
    buffer = BytesIO()
    img.save(buffer, format=mime.split("/")[-1].upper())
    base64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:{mime};base64,{base64_str}"

