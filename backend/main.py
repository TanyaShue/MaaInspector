# app.py
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from flask import Flask
from flask_cors import CORS

# 确保在以脚本方式运行时也能找到 backend 包（嵌入式 Python 不一定读取 PYTHONPATH）
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.routes.agent_routes import agent_bp
from backend.routes.debug_routes import debug_bp
from backend.routes.device_routes import device_bp
from backend.routes.resource_routes import resource_bp
from backend.routes.system_routes import system_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(system_bp)
    app.register_blueprint(resource_bp)
    app.register_blueprint(device_bp)
    app.register_blueprint(agent_bp)
    app.register_blueprint(debug_bp)
    return app


app = create_app()


if __name__ == "__main__":
    env_port = os.environ.get("MAA_BACKEND_PORT")
    default_port = int(env_port) if env_port and env_port.isdigit() else 38081

    parser = argparse.ArgumentParser(description="Run MaaInspector backend")
    parser.add_argument(
        "--port",
        type=int,
        default=default_port,
        help="监听端口，默认读取环境变量 MAA_BACKEND_PORT，未设置则为 5000",
    )
    args = parser.parse_args()

    app.run(port=args.port, debug=True)
