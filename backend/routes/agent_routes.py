from flask import Blueprint, request

from backend.common.utils import json_response
from backend.untils.maafw import maafw

agent_bp = Blueprint("agent", __name__)


@agent_bp.route("/agent/connect", methods=["POST"])
def agent_connect():
    payload = request.get_json(force=True, silent=True) or {}
    socket_obj = payload.get("socket_id") or {}
    socket_id = socket_obj.get("socket_id")
    if not socket_id:
        return json_response(False, "Missing socket_id", status=400)

    maafw.create_agent(socket_id)
    maafw.connect_agent()
    return json_response(True, "Agent Linked", {"info": {"Socket": socket_id}})

