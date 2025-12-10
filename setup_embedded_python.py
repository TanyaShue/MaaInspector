"""
Utility script to download Windows embedded Python (default 3.13.x),
place it under `src-tauri/python-runtime`, enable pip, and install
dependencies from a requirements file.

Usage examples:
  python setup_embedded_python.py
  python setup_embedded_python.py --version 3.13.0 --requirements backend/requirements.txt
"""

from __future__ import annotations

import argparse
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_VERSION = "3.13.0"
DEFAULT_REQUIREMENTS = BASE_DIR / "backend" / "requirements.txt"
DEST_DIR = BASE_DIR / "src-tauri" / "python-runtime"
GET_PIP_URL = "https://bootstrap.pypa.io/get-pip.py"


def detect_windows_arch() -> str:
    machine = platform.machine().lower()
    print(f"[信息] 检测到平台: system={platform.system()}, machine={machine}")
    if "arm" in machine:
        raise RuntimeError("Embedded Python ARM builds are not supported by this script.")
    if "64" in machine or machine in {"amd64", "x86_64"}:
        return "amd64"
    if machine in {"x86", "i386", "i686"}:
        return "win32"
    raise RuntimeError(f"Unsupported architecture: {machine}")


def build_download_url(version: str, arch: str) -> str:
    filename = f"python-{version}-embed-{arch}.zip"
    return f"https://www.python.org/ftp/python/{version}/{filename}"


def _print_progress(prefix: str, current: int, total: int) -> None:
    if total <= 0:
        return
    percent = int(current / total * 100)
    sys.stdout.write(f"\r{prefix} {percent:3d}% ({current}/{total} bytes)")
    sys.stdout.flush()


def download_file(url: str, destination: Path) -> None:
    print(f"[下载] 开始下载: {url}")
    try:
        with urllib.request.urlopen(url) as response, destination.open("wb") as f:
            length_header = response.headers.get("Content-Length")
            total = int(length_header) if length_header is not None else -1
            downloaded = 0
            chunk_size = 1024 * 64
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    _print_progress("[下载] 进度", downloaded, total)
            if total > 0:
                sys.stdout.write("\n")
            else:
                print(f"[下载] 已读取 {downloaded} bytes（无 Content-Length）")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"下载失败，HTTP {exc.code}: {url}") from exc
    except OSError as exc:
        raise RuntimeError(f"无法写入文件 {destination}") from exc
    print(f"[下载] 保存到: {destination}")


def extract_zip(zip_path: Path, target_dir: Path) -> None:
    if target_dir.exists():
        print(f"[解压] 清理旧目录: {target_dir}")
        shutil.rmtree(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    print(f"[解压] 开始解压 {zip_path} -> {target_dir}")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(target_dir)
    print("[解压] 完成")


def ensure_import_site(target_dir: Path) -> None:
    pth_files = list(target_dir.glob("python*.pth")) + list(target_dir.glob("python*._pth"))
    if not pth_files:
        raise RuntimeError("未找到 *.pth 文件，无法启用 site。")
    pth_file = pth_files[0]
    print(f"[配置] 调整 {pth_file.name} 以启用 import site")
    lines = pth_file.read_text(encoding="utf-8").splitlines()
    new_lines = []
    has_import_site = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#import site"):
            new_lines.append("import site")
            has_import_site = True
        elif stripped == "import site":
            new_lines.append(line)
            has_import_site = True
        else:
            new_lines.append(line)
    if not has_import_site:
        new_lines.append("import site")
    pth_file.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    print("[配置] import site 已启用")


def install_pip(python_exe: Path, work_dir: Path) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        get_pip_path = Path(tmpdir) / "get-pip.py"
        download_file(GET_PIP_URL, get_pip_path)
        print(f"[pip] 运行 get-pip.py 安装 pip (工作目录: {work_dir})")
        subprocess.check_call(
            [str(python_exe), str(get_pip_path), "--upgrade", "pip"],
            cwd=work_dir,
        )
    print("[pip] 安装完成")


def install_requirements(python_exe: Path, requirements_path: Path, work_dir: Path) -> None:
    if not requirements_path.is_absolute():
        requirements_path = (BASE_DIR / requirements_path).resolve()
    if not requirements_path.exists():
        raise FileNotFoundError(f"找不到 requirements 文件: {requirements_path}")
    print(f"[依赖] 开始安装: {requirements_path} (工作目录: {work_dir})")
    subprocess.check_call(
        [str(python_exe), "-m", "pip", "install", "-r", str(requirements_path)],
        cwd=work_dir,
    )
    print("[依赖] 安装完成")


def main() -> None:
    parser = argparse.ArgumentParser(description="下载嵌入式 Python 并安装依赖。")
    parser.add_argument("--version", default=DEFAULT_VERSION, help="Python 版本，默认 3.13.0")
    parser.add_argument(
        "--requirements",
        default=str(DEFAULT_REQUIREMENTS),
        help="requirements.txt 路径，默认 backend/requirements.txt",
    )
    args = parser.parse_args()

    if platform.system().lower() != "windows":
        sys.exit("当前脚本仅支持 Windows 嵌入式 Python。")

    arch = detect_windows_arch()
    url = build_download_url(args.version, arch)

    print(f"[信息] 选择版本: {args.version}, 架构: {arch}")
    print(f"[信息] 下载地址: {url}")
    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = Path(tmpdir) / "python-embed.zip"
        download_file(url, zip_path)
        print(f"[信息] 下载完成: {zip_path}")

        extract_zip(zip_path, DEST_DIR)
        print(f"[信息] 解压到: {DEST_DIR}")

    python_exe = DEST_DIR / "python.exe"
    if not python_exe.exists():
        raise RuntimeError(f"未找到 python.exe 于 {DEST_DIR}")

    ensure_import_site(DEST_DIR)
    print("[信息] 已启用 import site。")

    print("[步骤] 安装 pip ...")
    install_pip(python_exe, DEST_DIR)

    req_path = Path(args.requirements)
    print(f"[步骤] 安装依赖: {req_path}")
    install_requirements(python_exe, req_path, DEST_DIR)

    print("[完成] 所有步骤执行完毕。")


if __name__ == "__main__":
    main()

