# backend/untils/__init__.py
import os
import json
import re
from typing import Dict, Any, List, Union, Optional

JsonValue = Dict[str, Any]


class JsonNodeLoader:
    """
    JSON 节点加载器 - 增强版
    封装了加载、索引、搜索、保存和创建文件的逻辑。
    """

    def __init__(self, folder_path: str):
        self.folder_path = os.path.normpath(folder_path)
        self.files_data: Dict[str, Dict[str, Any]] = {}
        self.node_index: Dict[str, Dict[str, Any]] = {}
        self._load_all_json_files()

    def _load_all_json_files(self):
        if not os.path.isdir(self.folder_path):
            # 允许路径不存在时静默失败（或根据需求抛出），但在初始化时通常意味着没数据
            return

        for fname in os.listdir(self.folder_path):
            if not fname.lower().endswith(".json"):
                continue
            full = os.path.join(self.folder_path, fname)
            try:
                with open(full, "r", encoding="utf-8") as f:
                    content = json.load(f) or {}

                # 数据标准化：兼容 VueFlow List 格式转 Dict
                self.files_data[fname] = self._normalize_data(content)

                # 构建索引
                for node_name, node_val in self.files_data[fname].items():
                    self.node_index[str(node_name)] = {"file": fname, "value": node_val}

            except Exception as e:
                print(f"[JsonNodeLoader] failed to load {full}: {e}")

    def _normalize_data(self, data: Any) -> Dict[str, Any]:
        """将前端可能的 List 结构转为标准的 ID->Value Dict 结构"""
        if isinstance(data, dict):
            return data
        if isinstance(data, list):
            converted = {}
            for item in data:
                nid = item.get("id")
                # 处理嵌套: data.data
                ndata = item.get("data", {})
                if isinstance(ndata, dict) and "data" in ndata:
                    ndata = ndata["data"]
                if nid:
                    converted[nid] = ndata if isinstance(ndata, dict) else {}
            return converted
        return {}

    # ---------------------------
    # 核心读写
    # ---------------------------
    def get_nodes_by_file(self, filename: str) -> Optional[Dict[str, Any]]:
        return self.files_data.get(filename)

    def create_file(self, filename: str) -> bool:
        """创建一个新的空 JSON 文件"""
        if not filename.lower().endswith(".json"):
            filename += ".json"

        if not os.path.exists(self.folder_path):
            os.makedirs(self.folder_path, exist_ok=True)

        full_path = os.path.join(self.folder_path, filename)
        if os.path.exists(full_path):
            return False  # 文件已存在

        try:
            with open(full_path, "w", encoding="utf-8") as f:
                json.dump({}, f, ensure_ascii=False, indent=4)
            # 更新内存
            self.files_data[filename] = {}
            return True
        except Exception as e:
            raise IOError(f"Failed to create file: {e}")

    def save_file_content(self, filename: str, content: Union[Dict, List]) -> int:
        """接收前端数据（List或Dict），标准化后保存到文件"""
        if filename not in self.files_data:
            # 如果是新文件但内存里没有，尝试重新加载或允许保存
            pass

        normalized_data = self._normalize_data(content)

        # 更新内存
        self.files_data[filename] = normalized_data
        # 重新索引该文件的节点（简单起见，清除旧索引比较麻烦，这里主要用于持久化）
        # 如果需要保持 node_index 实时一致，这里需要更复杂的 diff 逻辑，
        # 但通常保存后前端会刷新或重新请求，持久化是第一位的。

        full_path = os.path.join(self.folder_path, filename)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, "w", encoding="utf-8") as f:
            json.dump(normalized_data, f, ensure_ascii=False, indent=4)

        return len(normalized_data)

    # ---------------------------
    # 搜索功能 (替代 app.py 中的逻辑)
    # ---------------------------
    def search_nodes(self, query: str, use_regex: bool = False, exclude_file: str = "") -> List[Dict[str, Any]]:
        """在当前目录下所有节点中搜索"""
        if not query:
            return []

        results = []
        pattern = None
        if use_regex:
            try:
                pattern = re.compile(query, re.IGNORECASE)
            except re.error:
                return []  # 或抛出异常

        query_lower = query.lower()

        # 遍历索引
        for node_id, info in self.node_index.items():
            fname = info["file"]
            if fname == exclude_file:
                continue

            node_data = info["value"]
            # 确定搜索目标：ID 和 display_id
            # 兼容处理：有些节点 value 可能不是 dict
            if not isinstance(node_data, dict):
                display_id = str(node_id)
            else:
                display_id = str(node_data.get("id", node_id))

            targets = [str(node_id), display_id]

            matched = False
            if pattern:
                if any(pattern.search(t) for t in targets):
                    matched = True
            else:
                if any(query_lower in t.lower() for t in targets):
                    matched = True

            if matched:
                results.append({
                    "filename": fname,
                    "source": os.path.join(self.folder_path, "pipeline"),  # 前端可能需要 source 路径
                    "node_id": node_id,
                    "display_id": display_id,
                    "type": node_data.get("recognition", "Unknown") if isinstance(node_data, dict) else "Unknown"
                })
                # 限制单次返回数量，防止过大？可在外部控制

        return results

    # ---------------------------
    # 其它原有辅助方法 (保持不变)
    # ---------------------------
    def get_node_value(self, node_name: str) -> Optional[Dict[str, Any]]:
        entry = self.node_index.get(node_name)
        return entry["value"] if entry else None