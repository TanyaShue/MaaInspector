import time
from queue import Empty
from typing import Optional

from PIL import Image
from flask import Blueprint, Response, jsonify, request, stream_with_context

from backend.common.utils import (
    convert_node,
    encode_pil_image_to_base64,
    json_response,
    sse_format,
)
from backend.untils.maafw import debug_broker, maafw

debug_bp = Blueprint("debug", __name__)


@debug_bp.route("/debug/stream", methods=["GET"])
def debug_stream():
    queue = debug_broker.register()

    def event_stream():
        try:
            yield sse_format({"type": "hello", "timestamp": int(time.time() * 1000)})
            while True:
                try:
                    payload = queue.get(timeout=15)
                    yield sse_format(payload)
                except Empty:
                    yield ": keep-alive\n\n"
        finally:
            debug_broker.unregister(queue)

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@debug_bp.route("/debug/node", methods=["POST"])
def debug_node():
    data = request.get_json()
    node = (data or {}).get("node") or {}
    node_id = node.get("id")
    if data.get("debug_mode") == "recognition_only":
        node["next"] = []
        node["on_error"] = []
        node["action"] = "DoNothing"
        converted = convert_node(node)
        maafw.run_task(node_id, converted)
    else:
        converted = convert_node(node)
        maafw.run_task(node_id, converted)
    return json_response(True, "debug_return", {})


@debug_bp.route("/debug/stop", methods=["POST"])
def debug_stop():
    maafw.stop_task()
    return json_response(True, "debug_return", {})


@debug_bp.route("/debug/status", methods=["POST"])
def debug_status():
    running = getattr(getattr(maafw, "tasker", None), "running", False)
    return json_response(True, "debug_return_running", {"running": running})


@debug_bp.route("/debug/ocr_text", methods=["POST"])
def debug_ocr_text():
    data = request.get_json(force=True, silent=True) or {}
    roi = data.get("roi")
    if not roi or not isinstance(roi, list) or len(roi) != 4:
        return json_response(False, "Missing or invalid roi", status=400)

    task_payload = {"debug_ocr_text": {"roi": roi, "next": "", "on_error": ""}}
    result = maafw.tasker.post_recognition("OCR",task_payload,maafw.im).wait().get()
    text = getattr(getattr(result, "beast", None), "text", "") or ""
    return json_response(True, "OK", {"text": text})


@debug_bp.route("/debug/get_reco_details", methods=["POST"])
def get_reco_details():
    data = request.get_json(force=True, silent=True) or {}
    reco_id = data.get("reco_id")
    if reco_id is None:
        return json_response(False, "Missing reco_id", status=400)

    try:
        detail = maafw.get_reco_detail(reco_id)
        if detail is None:
            return json_response(False, "No detail", {"detail": None}, status=404)

        def _box_score_to_dict(item):
            if not item:
                return None
            return {"box": list(getattr(item, "box", []) or []), "score": getattr(item, "score", None)}

        def _image_to_b64(img: Image.Image) -> Optional[str]:
            if not isinstance(img, Image.Image):
                return None
            return encode_pil_image_to_base64(img)

        algorithm = getattr(detail, "algorithm", None)
        algorithm_value = getattr(algorithm, "value", None) if algorithm is not None else None
        algorithm_value = algorithm_value or (str(algorithm) if algorithm is not None else None)

        raw_image_b64 = _image_to_b64(getattr(detail, "raw_image", None))
        draw_images_b64 = []
        for img in getattr(detail, "draw_images", []) or []:
            encoded = _image_to_b64(img)
            if encoded:
                draw_images_b64.append(encoded)

        payload = {
            "reco_id": getattr(detail, "reco_id", None),
            "name": getattr(detail, "name", None),
            "algorithm": algorithm_value,
            "hit": bool(getattr(detail, "hit", False)),
            "box": getattr(detail, "box"),
            "all_results": getattr(detail, "all_results", []),
            "filtered_results": getattr(detail, "filtered_results", []),
            "best_result": getattr(detail, "best_result", None),
            "raw_detail": getattr(detail, "raw_detail", None),
            "raw_image": raw_image_b64,
            "draw_images": draw_images_b64,
        }

        return json_response(True, "detail", {"detail": payload})
    except Exception as exc:
        return json_response(False, str(exc), status=500)

