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
    devices = []
    if Toolkit and hasattr(Toolkit, "find_adb_devices"):
        try:
            raw = Toolkit.find_adb_devices()
            for d in raw or []:
                devices.append(
                    {
                        "name": getattr(d, "name", "ADB Device"),
                        "address": getattr(d, "address", "").strip(),
                        "adb_path": str(getattr(d, "adb_path", "") or ""),
                        "config": getattr(d, "config", {}) or {},
                    }
                )
        except Exception:
            pass
    return jsonify({"message": "OK", "devices": devices})

