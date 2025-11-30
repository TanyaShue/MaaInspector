import os
import json
from typing import Dict, Any, Optional, List, Union


JsonValue = Dict[str, Any]


class JsonNodeLoader:
    def __init__(self, folder_path: str):
        """初始化：加载目录下所有 JSON 文件"""
        self.folder_path = folder_path
        self.files_data: Dict[str, Dict[str, Any]] = {}
        self.node_index: Dict[str, Dict[str, Any]] = {}

        self._load_all_json_files()

    def _load_all_json_files(self):
        """读取目录下的 json 文件并建立索引"""
        if not os.path.isdir(self.folder_path):
            raise NotADirectoryError(f"路径不存在: {self.folder_path}")

        for filename in os.listdir(self.folder_path):
            if filename.lower().endswith(".json"):
                path = os.path.join(self.folder_path, filename)

                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)

                    self.files_data[filename] = data

                    # 建立节点反向索引
                    for node_name, node_value in data.items():
                        self.node_index[node_name] = {
                            "file": filename,
                            "value": node_value
                        }

                except Exception as e:
                    print(f"加载失败 {filename}: {e}")

    def get_files(self):
        return list(self.files_data.keys())

    def get_all_nodes(self):
        return list(self.node_index.keys())

    def get_nodes_by_file(self, filename: str):
        return self.files_data.get(filename)

    def get_node_value(self, node_name: str):
        entry = self.node_index.get(node_name)
        return entry["value"] if entry else None

    def get_node_source_file(self, node_name: str):
        entry = self.node_index.get(node_name)
        return entry["file"] if entry else None

    def has_node(self, node_name: str) -> bool:
        return node_name in self.node_index

    def _field_contains(self, field_value: Union[str, List[str], None], target: str) -> bool:
        if field_value is None:
            return False
        if isinstance(field_value, str):
            return field_value == target
        if isinstance(field_value, list):
            return target in field_value
        return False

    def find_references_to(self, node_name: str) -> List[Dict[str, str]]:
        """返回所有引用到 node_name 的节点信息"""
        refs = []

        for other_node, info in self.node_index.items():
            node_val = info["value"]
            filename = info["file"]

            for field in ("next", "interrupt", "on_error"):
                if field in node_val:
                    if self._field_contains(node_val[field], node_name):
                        refs.append({
                            "file": filename,
                            "node": other_node,
                            "field": field
                        })
        return refs

    def is_referenced(self, node_name: str) -> bool:
        return len(self.find_references_to(node_name)) > 0

    def update_node_value(self, node_name: str, new_value: Dict[str, Any]):
        """修改节点的内容（不改变节点名字）"""
        if node_name not in self.node_index:
            raise KeyError(f"节点不存在: {node_name}")

        filename = self.node_index[node_name]["file"]
        self.files_data[filename][node_name] = new_value
        self.node_index[node_name]["value"] = new_value

    def rename_node(self, old_name: str, new_name: str, update_references: bool = False):
        """修改节点名称，可选择是否更新所有引用"""

        if old_name not in self.node_index:
            raise KeyError(f"节点不存在: {old_name}")
        if new_name in self.node_index:
            raise KeyError(f"目标节点名已存在: {new_name}")

        filename = self.node_index[old_name]["file"]
        node_value = self.node_index[old_name]["value"]

        # 1. 文件内重命名
        del self.files_data[filename][old_name]
        self.files_data[filename][new_name] = node_value

        # 2. 修正索引
        del self.node_index[old_name]
        self.node_index[new_name] = {
            "file": filename,
            "value": node_value
        }

        # 3. 是否更新引用
        if update_references:
            refs = self.find_references_to(old_name)
            for ref in refs:
                f = ref["file"]
                n = ref["node"]
                field = ref["field"]

                value = self.files_data[f][n][field]

                if isinstance(value, str):
                    if value == old_name:
                        self.files_data[f][n][field] = new_name

                elif isinstance(value, list):
                    self.files_data[f][n][field] = [
                        new_name if v == old_name else v for v in value
                    ]

        return True

    def save_file(self, filename: str):
        """保存指定文件"""
        if filename not in self.files_data:
            raise KeyError(f"文件不存在: {filename}")

        path = os.path.join(self.folder_path, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.files_data[filename], f, ensure_ascii=False, indent=4)

    def save_all(self):
        """保存所有已加载 JSON 文件"""
        for filename in self.files_data:
            self.save_file(filename)
    # ======================================================================
    # 🔍 递归查找：仅在当前文件内
    # ======================================================================
    def _extract_targets(self, value):
        """从 next/interrupt/on_error 字段中提取引用目标节点名称"""
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return value
        return []

    def _get_node_links(self, node_value):
        """给出 node_value，返回所有 next/interrupt/on_error 的节点列表"""
        result = []
        for key in ("next", "interrupt", "on_error"):
            if key in node_value:
                result.extend(self._extract_targets(node_value[key]))
        return result

    def get_node_chain_in_file(self, start_node: str):
        """
        从节点开始，递归查找 next/interrupt/on_error，
        只在节点所属文件内查找
        """
        if start_node not in self.node_index:
            raise KeyError(f"节点不存在: {start_node}")

        file_name = self.node_index[start_node]["file"]
        file_nodes = self.files_data[file_name]

        visited = set()
        result = []

        def dfs(node):
            if node in visited:
                return
            visited.add(node)
            result.append(node)

            if node not in file_nodes:
                return

            next_nodes = self._get_node_links(file_nodes[node])

            for n in next_nodes:
                if n in file_nodes:  # 仅在当前文件内查找
                    dfs(n)

        dfs(start_node)
        return result

    # ======================================================================
    # 🔍 递归查找：跨所有文件
    # ======================================================================
    def get_node_chain_across_files(self, start_node: str):
        """
        从节点开始，递归查找 next/interrupt/on_error，
        会跨文件查找，并返回节点及所属文件。
        """
        if start_node not in self.node_index:
            raise KeyError(f"节点不存在: {start_node}")

        visited = set()
        result = []

        def dfs(node):
            if node in visited:
                return
            visited.add(node)

            file_name = self.node_index[node]["file"]
            node_value = self.node_index[node]["value"]

            result.append({
                "node": node,
                "file": file_name
            })

            next_nodes = self._get_node_links(node_value)

            for n in next_nodes:
                if n in self.node_index:  # 跨文件查找
                    dfs(n)

        dfs(start_node)
        return result
# if __name__ == "__main__":
#     loader = JsonNodeLoader("D:\\DeveProject\\MFWPH\\assets\\resource\\MaaYYs\\resource_pack\\base\\pipeline")
#
#     # print("所有文件:", loader.get_files())
#     # print("所有节点:", loader.get_all_nodes())
#     print("某个文件的节点:", loader.get_nodes_by_file("test.json"))
#     # print("指定节点内容:", loader.get_node_value("999"))
#     # print("节点来自文件:", loader.get_node_source_file("999"))