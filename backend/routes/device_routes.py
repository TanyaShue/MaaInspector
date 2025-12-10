from flask import Blueprint, request

from backend.common.utils import encode_pil_image_to_base64, json_response
from backend.untils.maafw import maafw

device_bp = Blueprint("device", __name__)


@device_bp.route("/device/connect", methods=["POST"])
def device_connect():
    info = request.get_json(force=True, silent=True) or {}
    if maafw is None or not hasattr(maafw, "connect_adb"):
        return json_response(False, "Backend logic missing", status=500)
    try:
        result = maafw.connect_adb(info.get("adb_path"), info.get("address"), info.get("config"))
        success, msg = result if isinstance(result, tuple) else (False, "Unknown")
        if success:
            return json_response(True, "Device Ready", {"info": {"detail": msg}})
        return json_response(False, msg, status=400)
    except Exception as exc:
        return json_response(False, str(exc), status=500)


@device_bp.route("/device/screenshot", methods=["GET"])
def device_screenshot():
    image_base64 = None
    screenshot = maafw.screencap()
    if screenshot is not None:
        image_base64 = encode_pil_image_to_base64(screenshot)
    if image_base64:
        return json_response(True, "OK", {"image": image_base64, "size": [1280, 720]})
    return json_response(False, "No image", status=404)

