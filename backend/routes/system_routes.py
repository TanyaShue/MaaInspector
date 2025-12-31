from flask import Blueprint, jsonify, request
from maa.toolkit import Toolkit

from backend.common.utils import json_response, load_config, save_config

system_bp = Blueprint("system", __name__)


@system_bp.route("/system/init", methods=["GET"])
def system_init():
    return jsonify(load_config())


@system_bp.route("/system/config/save", methods=["POST"])
def system_save_config():
    data = request.get_json(force=True, silent=True) or {}
    if save_config(data):
        return json_response(True, "Saved")
    return json_response(False, "Save failed", status=500)


@system_bp.route("/system/devices/search", methods=["POST"])
def search_devices():
    payload = request.get_json(silent=True) or {}
    req_type = (payload.get("type") or "").lower()
    want_adb = not req_type or req_type == "adb"
    want_win32 = not req_type or req_type == "win32control"

    devices = []
    if want_adb and Toolkit and hasattr(Toolkit, "find_adb_devices"):
        try:
            raw = Toolkit.find_adb_devices()
            for d in raw or []:
                devices.append(
                    {
                        "name": getattr(d, "name", "ADB Device"),
                        "address": getattr(d, "address", "").strip(),
                        "adb_path": str(getattr(d, "adb_path", "") or ""),
                        "config": getattr(d, "config", {}) or {},
                        "type": "adb",
                    }
                )
        except Exception:
            pass

    if want_win32 and Toolkit and hasattr(Toolkit, "find_desktop_windows"):
        try:
            raw = Toolkit.find_desktop_windows()
            for w in raw or []:
                hwnd = getattr(w, "hwnd", None)
                window_name = getattr(w, "window_name", "") or "Win32 Window"
                class_name = getattr(w, "class_name", "") or ""
                devices.append(
                    {
                        "name": window_name,
                        "type": "win32control",
                        "hwnd": hwnd,
                        "class_name": class_name,
                        "window_name": window_name,
                    }
                )
        except Exception:
            pass

    return jsonify({"message": "OK", "devices": devices})

