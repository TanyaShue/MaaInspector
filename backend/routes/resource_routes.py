from flask import Blueprint, jsonify, request

from backend.common.utils import (
    encode_image_to_base64,
    json_response,
    load_config,
    norm_path,
)
from backend.untils import ResourcesManager
from backend.untils.maafw import maafw

resource_bp = Blueprint("resource", __name__)


@resource_bp.route("/resource/load", methods=["POST"])
def resource_load():
    payload = request.get_json(force=True, silent=True) or {}
    if "path" in payload and isinstance(payload.get("path"), dict):
        payload = payload.get("path") or {}

    paths = payload.get("paths", []) or []
    result, message = maafw.load_resource(paths)
    manager = ResourcesManager(paths)
    results = manager.list_all_files() if result else []

    return jsonify(
        {
            "r": bool(result),
            "success": bool(result),
            "message": message or ("Loaded" if result else "Load failed"),
            "list": results,
        }
    )


@resource_bp.route("/resource/file/nodes", methods=["POST"])
def get_file_nodes():
    data = request.get_json(force=True, silent=True) or {}
    resource_path = norm_path(data.get("source"))
    filename = data.get("filename")

    if not resource_path or not filename:
        return json_response(False, "Missing params", status=400)

    try:
        manager = ResourcesManager(resource_path)
        nodes = manager.get_nodes_by_file(resource_path, filename)
        if nodes is None:
            return json_response(False, "File not found", {"nodes": {}}, 404)
        return json_response(True, "Loaded", {"nodes": nodes})
    except Exception as exc:
        return json_response(False, str(exc), status=500)


@resource_bp.route("/resource/file/save", methods=["POST"])
def resource_file_save():
    data = request.get_json(force=True, silent=True) or {}
    resource_path = norm_path(data.get("source"))
    filename = data.get("filename")
    nodes_data = data.get("nodes")

    if not resource_path or not filename or nodes_data is None:
        return json_response(False, "Missing params", status=400)

    try:
        manager = ResourcesManager(resource_path)
        count = manager.save_nodes(resource_path, filename, nodes_data)
        return json_response(True, f"Saved {count} nodes", {"saved_count": count})
    except Exception as exc:
        return json_response(False, f"Save failed: {exc}", status=500)


@resource_bp.route("/resource/file/create", methods=["POST"])
def resource_file_create():
    data = request.get_json(force=True, silent=True) or {}
    resource_path = norm_path(data.get("path"))
    filename = data.get("filename")

    if not resource_path or not filename:
        return json_response(False, "Missing params", status=400)

    try:
        manager = ResourcesManager(resource_path)
        if manager.create_file(resource_path, filename):
            final_filename = filename if filename.endswith(".json") else f"{filename}.json"
            return json_response(True, "Created", {"filename": final_filename, "source": resource_path})
        return json_response(False, "File already exists", status=409)
    except Exception as exc:
        return json_response(False, str(exc), status=500)


@resource_bp.route("/resource/search/nodes", methods=["POST"])
def search_nodes_globally():
    data = request.get_json(force=True, silent=True) or {}
    query = data.get("query", "")
    use_regex = data.get("use_regex", False)
    current_filename = data.get("current_filename", "")
    current_source = norm_path(data.get("current_source", ""))

    if not query:
        return jsonify({"results": []})

    cfg = load_config()
    target_paths = []
    profiles = cfg.get("resource_profiles", [])
    current_state = cfg.get("current_state", {})
    current_idx = int(current_state.get("resource_profile_index", 0))

    if profiles and 0 <= current_idx < len(profiles):
        raw_paths = profiles[current_idx].get("paths", []) or []
        for path in raw_paths:
            if path:
                target_paths.append(norm_path(path))

    manager = ResourcesManager(target_paths)
    results = manager.search_nodes(
        query,
        use_regex=use_regex,
        exclude_file=current_filename,
        exclude_source=current_source,
        max_results=50,
    )

    return jsonify({"results": results})


@resource_bp.route("/resource/file/templates", methods=["POST"])
def get_file_templates():
    data = request.get_json(force=True, silent=True) or {}
    resource_path = norm_path(data.get("source"))
    filename = data.get("filename")

    if not resource_path or not filename:
        return json_response(False, "Missing params", status=400)

    try:
        manager = ResourcesManager(resource_path)
        nodes = manager.get_nodes_by_file(resource_path, filename) or {}
        image_base = manager.get_image_base_path(resource_path)

        results = {}
        for node_id, content in nodes.items():
            if not isinstance(content, dict):
                continue

            templates = content.get("template")
            if not templates:
                continue
            if isinstance(templates, str):
                templates = [templates]

            node_images = []
            for tpl in templates:
                if not isinstance(tpl, str):
                    continue
                full_img = manager.get_image_path(resource_path, tpl)
                b64 = encode_image_to_base64(full_img)
                node_images.append({"path": tpl, "found": bool(b64), "base64": b64})

            if node_images:
                results[node_id] = node_images

        return json_response(True, "Loaded", {"base_image_path": image_base, "results": results})
    except Exception as exc:
        return json_response(False, str(exc), status=500)


@resource_bp.route("/resource/images/check-unused", methods=["POST"])
def check_unused_images():
    data = request.get_json(force=True, silent=True) or {}
    resource_path = norm_path(data.get("source"))
    current_filename = data.get("current_filename", "")
    del_images = data.get("del_images", [])

    if not resource_path or not del_images:
        return json_response(True, "No images to check", {"unused_images": [], "used_images": []})

    try:
        paths_to_check = [img.get("path") for img in del_images if img.get("path")]
        if not paths_to_check:
            return json_response(True, "No valid paths", {"unused_images": [], "used_images": []})

        manager = ResourcesManager(resource_path)
        used_map = manager.check_image_references(resource_path, paths_to_check, exclude_file=current_filename)

        unused_images = [p for p in paths_to_check if p not in used_map]
        used_images = [{"path": p, "used_by": nodes} for p, nodes in used_map.items()]

        return json_response(True, "Checked", {"unused_images": unused_images, "used_images": used_images})
    except Exception as exc:
        return json_response(False, str(exc), status=500)


@resource_bp.route("/resource/images/process", methods=["POST"])
def process_images():
    data = request.get_json(force=True, silent=True) or {}
    resource_path = norm_path(data.get("source"))
    delete_paths = data.get("delete_paths", [])
    save_images = data.get("save_images", [])

    if not resource_path:
        return json_response(False, "Missing source path", status=400)

    manager = ResourcesManager(resource_path)
    results = {"deleted": [], "delete_failed": [], "saved": [], "save_failed": []}

    for path in delete_paths:
        if not path:
            continue
        try:
            if manager.delete_image(resource_path, path):
                results["deleted"].append(path)
            else:
                results["delete_failed"].append({"path": path, "reason": "File not found"})
        except Exception as exc:
            results["delete_failed"].append({"path": path, "reason": str(exc)})

    for img in save_images:
        path = img.get("path")
        base64_data = img.get("base64")
        if not path or not base64_data:
            continue
        try:
            manager.save_image(resource_path, path, base64_data)
            results["saved"].append(path)
        except Exception as exc:
            results["save_failed"].append({"path": path, "reason": str(exc)})

    return json_response(True, "Processed", results)

