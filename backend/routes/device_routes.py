from flask import Blueprint, request

from backend.common.utils import encode_pil_image_to_base64, json_response, save_config, load_config
from backend.untils.maafw import maafw

device_bp = Blueprint("device", __name__)


@device_bp.route("/device/connect/adb", methods=["POST"])
def device_connect_adb():
    """连接 ADB 设备"""
    info = request.get_json(force=True, silent=True) or {}
    if maafw is None:
        return json_response(False, "Backend logic missing", status=500)
    
    try:
        # 获取必需参数
        adb_path = info.get("adb_path")
        address = info.get("address")
        config = info.get("config") or {}
        name = info.get("name", "ADB Device")
        
        # 参数验证
        if not adb_path:
            return json_response(False, "adb_path is required", status=400)
        if not address:
            return json_response(False, "address is required", status=400)
        
        # 调用连接方法
        result = maafw.connect_adb(adb_path, address, config)
        success, msg = result if isinstance(result, tuple) else (False, "Unknown")
        
        if success:
            # 保存最后连接成功的设备配置
            last_device = {
                "type": "adb",
                "name": name,
                "adb_path": adb_path,
                "address": address,
                "config": config
            }
            current_config = load_config()
            current_config["last_connected_device"] = last_device
            save_config(current_config)
            
            return json_response(True, "ADB Device Connected", {"info": {"detail": msg}})
        return json_response(False, msg or "Connect failed", status=400)
    except Exception as exc:
        return json_response(False, f"ADB connection error: {str(exc)}", status=500)


@device_bp.route("/device/connect/win32", methods=["POST"])
def device_connect_win32():
    """连接 Win32 窗口设备"""
    info = request.get_json(force=True, silent=True) or {}
    if maafw is None:
        return json_response(False, "Backend logic missing", status=500)
    
    try:
        # 获取必需参数
        hwnd = info.get("hwnd")
        if hwnd is None:
            return json_response(False, "hwnd is required for win32", status=400)
        
        # 获取可选参数
        name = info.get("name", "Win32 Window")
        window_name = info.get("window_name", "")
        class_name = info.get("class_name", "")
        screencap_method = info.get("screencap_method")
        mouse_method = info.get("mouse_method")
        keyboard_method = info.get("keyboard_method")
        
        # 调用连接方法
        result = maafw.connect_win32hwnd(
            hwnd=hwnd,
            screencap_method=screencap_method,
            mouse_method=mouse_method,
            keyboard_method=keyboard_method
        )
        success, msg = result if isinstance(result, tuple) else (False, "Unknown")
        
        if success:
            # 保存最后连接成功的设备配置
            last_device = {
                "type": "win32",
                "name": name,
                "hwnd": hwnd,
                "window_name": window_name,
                "class_name": class_name,
                "screencap_method": screencap_method,
                "mouse_method": mouse_method,
                "keyboard_method": keyboard_method
            }
            current_config = load_config()
            current_config["last_connected_device"] = last_device
            save_config(current_config)
            
            return json_response(True, "Win32 Device Connected", {"info": {"detail": msg}})
        return json_response(False, msg or "Connect failed", status=400)
    except Exception as exc:
        return json_response(False, f"Win32 connection error: {str(exc)}", status=500)


@device_bp.route("/device/screenshot", methods=["GET"])
def device_screenshot():
    image_base64 = None
    screenshot = maafw.screencap()
    if screenshot is not None:
        image_base64 = encode_pil_image_to_base64(screenshot)
    if image_base64:
        return json_response(True, "OK", {"image": image_base64, "size": [1280, 720]})
    return json_response(False, "No image", status=404)

