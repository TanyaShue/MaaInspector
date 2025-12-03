# backend/untils/__init__.py
import os
import json
import re
from typing import Dict, Any, List, Union, Optional

JsonValue = Dict[str, Any]


class ResourcesManager:
    """
    资源管理器 - 统一管理多个资源路径
    
    每个资源目录结构：
    resource_path/
    ├── pipeline/    # JSON 节点文件
    ├── image/       # 图片模板
    └── model/       # 模型文件（可选）
    
    使用方式：
    1. 单资源路径: manager = ResourcesManager(resource_path)
    2. 多资源路径: manager = ResourcesManager([path1, path2, ...])
    """

    def __init__(self, paths: Union[str, List[str]]):
        """
        初始化资源管理器
        
        Args:
            paths: 单个资源路径或资源路径列表（资源根目录，不是 pipeline 目录）
        """
        if isinstance(paths, str):
            paths = [paths]
        
        # 规范化并过滤有效路径
        self.resource_paths: List[str] = []
        for p in paths:
            if p:
                normalized = os.path.normpath(p)
                if normalized not in self.resource_paths:
                    self.resource_paths.append(normalized)
        
        # 缓存：resource_path -> {filename: {node_id: node_data}}
        self._files_cache: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # 全局节点索引：列表形式，支持同名节点
        # [{resource_path, filename, node_id, data}, ...]
        self._node_index: List[Dict[str, Any]] = []
        
        # 初始化时加载所有数据
        self._load_all()

    def _get_pipeline_path(self, resource_path: str) -> str:
        """获取 pipeline 目录路径"""
        return os.path.join(resource_path, "pipeline")

    def _get_image_path(self, resource_path: str) -> str:
        """获取 image 目录路径"""
        return os.path.join(resource_path, "image")

    def _get_model_path(self, resource_path: str) -> str:
        """获取 model 目录路径"""
        return os.path.join(resource_path, "model")

    def _load_all(self):
        """加载所有资源路径下的 JSON 文件"""
        self._files_cache.clear()
        self._node_index = []
        
        for resource_path in self.resource_paths:
            pipeline_path = self._get_pipeline_path(resource_path)
            if not os.path.isdir(pipeline_path):
                continue
            
            self._files_cache[resource_path] = {}
            
            for fname in os.listdir(pipeline_path):
                if not fname.lower().endswith(".json"):
                    continue
                
                full_path = os.path.join(pipeline_path, fname)
                try:
                    with open(full_path, "r", encoding="utf-8") as f:
                        content = json.load(f) or {}
                    
                    normalized = self._normalize_data(content)
                    self._files_cache[resource_path][fname] = normalized
                    
                    # 建立索引（使用列表，支持同名节点）
                    for node_id, node_data in normalized.items():
                        self._node_index.append({
                            "resource_path": resource_path,
                            "filename": fname,
                            "node_id": str(node_id),
                            "data": node_data
                        })
                except Exception as e:
                    print(f"[ResourcesManager] Failed to load {full_path}: {e}")

    def _normalize_data(self, data: Any) -> Dict[str, Any]:
        """将前端可能的 List 结构转为标准的 ID->Value Dict 结构"""
        if isinstance(data, dict):
            return data
        if isinstance(data, list):
            converted = {}
            for item in data:
                nid = item.get("id")
                ndata = item.get("data", {})
                if isinstance(ndata, dict) and "data" in ndata:
                    ndata = ndata["data"]
                if nid:
                    converted[nid] = ndata if isinstance(ndata, dict) else {}
            return converted
        return {}

    # ---------------------------
    # 文件列表操作
    # ---------------------------
    def list_all_files(self) -> List[Dict[str, Any]]:
        """
        列出所有资源路径下的 JSON 文件
        
        Returns:
            [{"label": "filename (source_label)", "value": "filename", 
              "source": "resource_path", "filename": "filename"}, ...]
        """
        results = []
        
        for resource_path in self.resource_paths:
            pipeline_path = self._get_pipeline_path(resource_path)
            source_label = os.path.basename(resource_path)
            
            if not os.path.isdir(pipeline_path):
                results.append({
                    "label": f"[No pipeline] ({source_label})",
                    "value": None,
                    "source": resource_path,
                    "filename": None
                })
                continue
            
            try:
                files = [f for f in os.listdir(pipeline_path) if f.lower().endswith(".json")]
                if not files:
                    results.append({
                        "label": f"[Empty] ({source_label})",
                        "value": None,
                        "source": resource_path,
                        "filename": None
                    })
                else:
                    for f in files:
                        results.append({
                            "label": f"{f} ({source_label})",
                            "value": f,
                            "source": resource_path,
                            "filename": f
                        })
            except Exception as e:
                print(f"[ResourcesManager] Error listing {pipeline_path}: {e}")
        
        return results

    # ---------------------------
    # 节点读写操作
    # ---------------------------
    def get_nodes_by_file(self, resource_path: str, filename: str) -> Optional[Dict[str, Any]]:
        """
        获取指定资源路径下指定文件的所有节点
        
        Args:
            resource_path: 资源根目录路径
            filename: JSON 文件名
            
        Returns:
            节点字典 {node_id: node_data} 或 None
        """
        resource_path = os.path.normpath(resource_path)
        
        # 先尝试从缓存获取
        if resource_path in self._files_cache:
            if filename in self._files_cache[resource_path]:
                return self._files_cache[resource_path][filename]
        
        # 缓存未命中，尝试直接读取
        pipeline_path = self._get_pipeline_path(resource_path)
        full_path = os.path.join(pipeline_path, filename)
        
        if not os.path.exists(full_path):
            return None
        
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                content = json.load(f) or {}
            normalized = self._normalize_data(content)
            
            # 更新缓存
            if resource_path not in self._files_cache:
                self._files_cache[resource_path] = {}
            self._files_cache[resource_path][filename] = normalized
            
            return normalized
        except Exception as e:
            print(f"[ResourcesManager] Error reading {full_path}: {e}")
            return None

    def save_nodes(self, resource_path: str, filename: str, content: Union[Dict, List]) -> int:
        """
        保存节点数据到指定文件
        
        Args:
            resource_path: 资源根目录路径
            filename: JSON 文件名
            content: 节点数据（Dict 或 List）
            
        Returns:
            保存的节点数量
        """
        resource_path = os.path.normpath(resource_path)
        normalized = self._normalize_data(content)
        
        pipeline_path = self._get_pipeline_path(resource_path)
        full_path = os.path.join(pipeline_path, filename)
        
        # 确保目录存在
        os.makedirs(pipeline_path, exist_ok=True)
        
        with open(full_path, "w", encoding="utf-8") as f:
            json.dump(normalized, f, ensure_ascii=False, indent=4)
        
        # 更新缓存
        if resource_path not in self._files_cache:
            self._files_cache[resource_path] = {}
        self._files_cache[resource_path][filename] = normalized
        
        return len(normalized)

    def create_file(self, resource_path: str, filename: str) -> bool:
        """
        创建新的空 JSON 文件
        
        Args:
            resource_path: 资源根目录路径
            filename: 文件名
            
        Returns:
            是否创建成功
        """
        resource_path = os.path.normpath(resource_path)
        
        if not filename.lower().endswith(".json"):
            filename += ".json"
        
        pipeline_path = self._get_pipeline_path(resource_path)
        full_path = os.path.join(pipeline_path, filename)
        
        if os.path.exists(full_path):
            return False
        
        os.makedirs(pipeline_path, exist_ok=True)
        
        with open(full_path, "w", encoding="utf-8") as f:
            json.dump({}, f, ensure_ascii=False, indent=4)
        
        # 更新缓存
        if resource_path not in self._files_cache:
            self._files_cache[resource_path] = {}
        self._files_cache[resource_path][filename] = {}
        
        return True

    # ---------------------------
    # 搜索功能
    # ---------------------------
    def search_nodes(self, query: str, use_regex: bool = False, 
                     exclude_file: str = "", exclude_source: str = "",
                     max_results: int = 50) -> List[Dict[str, Any]]:
        """
        全局搜索节点
        
        Args:
            query: 搜索关键词
            use_regex: 是否使用正则表达式
            exclude_file: 排除的文件名
            exclude_source: 排除的资源路径（配合 exclude_file 使用）
            max_results: 最大返回数量
            
        Returns:
            匹配的节点列表（按节点名称排序）
        """
        if not query:
            return []
        
        results = []
        pattern = None
        
        if use_regex:
            try:
                pattern = re.compile(query, re.IGNORECASE)
            except re.error:
                return []
        
        query_lower = query.lower()
        exclude_source_norm = os.path.normpath(exclude_source) if exclude_source else ""
        
        for info in self._node_index:
            node_id = info["node_id"]
            
            # 排除当前正在编辑的文件（需要同时匹配 source 和 filename）
            if exclude_file and info["filename"] == exclude_file:
                if not exclude_source_norm or info["resource_path"] == exclude_source_norm:
                    continue
            
            node_data = info["data"]
            display_id = str(node_data.get("id", node_id)) if isinstance(node_data, dict) else str(node_id)
            targets = [str(node_id), display_id]
            
            matched = False
            if pattern:
                matched = any(pattern.search(t) for t in targets)
            else:
                matched = any(query_lower in t.lower() for t in targets)
            
            if matched:
                results.append({
                    "filename": info["filename"],
                    "source": info["resource_path"],
                    "node_id": node_id,
                    "display_id": display_id,
                    "type": node_data.get("recognition", "Unknown") if isinstance(node_data, dict) else "Unknown"
                })
        
        # 按节点名称排序
        results.sort(key=lambda x: x["display_id"].lower())
        
        # 限制返回数量
        return results[:max_results]

    # ---------------------------
    # 图片操作
    # ---------------------------
    def get_image_path(self, resource_path: str, relative_path: str) -> str:
        """
        获取图片的完整路径
        
        Args:
            resource_path: 资源根目录路径
            relative_path: 图片相对路径
            
        Returns:
            图片完整路径
        """
        resource_path = os.path.normpath(resource_path)
        image_base = self._get_image_path(resource_path)
        return os.path.join(image_base, relative_path)

    def get_image_base_path(self, resource_path: str) -> str:
        """获取图片根目录路径"""
        return self._get_image_path(os.path.normpath(resource_path))

    def check_image_references(self, resource_path: str, image_paths: List[str], 
                               exclude_file: str = "") -> Dict[str, List[str]]:
        """
        检查图片是否被其他节点引用
        
        Args:
            resource_path: 资源根目录路径
            image_paths: 要检查的图片路径列表
            exclude_file: 排除的文件名
            
        Returns:
            {image_path: [引用的节点列表]}
        """
        resource_path = os.path.normpath(resource_path)
        used_map: Dict[str, List[str]] = {}
        
        files_data = self._files_cache.get(resource_path, {})
        
        for filename, nodes in files_data.items():
            if filename == exclude_file:
                continue
            
            for node_id, node_data in nodes.items():
                if not isinstance(node_data, dict):
                    continue
                
                template = node_data.get("template")
                if not template:
                    continue
                
                if isinstance(template, str):
                    template = [template]
                
                for img_path in image_paths:
                    if img_path in template:
                        if img_path not in used_map:
                            used_map[img_path] = []
                        used_map[img_path].append(f"{filename}:{node_id}")
        
        return used_map

    def save_image(self, resource_path: str, relative_path: str, base64_data: str) -> bool:
        """
        保存图片
        
        Args:
            resource_path: 资源根目录路径
            relative_path: 图片相对路径
            base64_data: Base64 编码的图片数据
            
        Returns:
            是否保存成功
        """
        import base64
        
        resource_path = os.path.normpath(resource_path)
        full_path = self.get_image_path(resource_path, relative_path)
        
        # 确保目录存在
        parent_dir = os.path.dirname(full_path)
        os.makedirs(parent_dir, exist_ok=True)
        
        # 解码 base64
        if ";base64," in base64_data:
            base64_data = base64_data.split(";base64,")[1]
        
        with open(full_path, "wb") as f:
            f.write(base64.b64decode(base64_data))
        
        return True

    def delete_image(self, resource_path: str, relative_path: str) -> bool:
        """
        删除图片
        
        Args:
            resource_path: 资源根目录路径
            relative_path: 图片相对路径
            
        Returns:
            是否删除成功
        """
        resource_path = os.path.normpath(resource_path)
        full_path = self.get_image_path(resource_path, relative_path)
        
        if not os.path.exists(full_path):
            return False
        
        os.remove(full_path)
        
        # 尝试删除空的父目录
        parent_dir = os.path.dirname(full_path)
        image_base = self._get_image_path(resource_path)
        if parent_dir != image_base and os.path.isdir(parent_dir) and not os.listdir(parent_dir):
            os.rmdir(parent_dir)
        
        return True

    # ---------------------------
    # 辅助方法
    # ---------------------------
    def reload(self):
        """重新加载所有数据"""
        self._load_all()

    def get_node_value(self, node_id: str) -> Optional[Dict[str, Any]]:
        """通过节点 ID 获取节点数据（返回第一个匹配的）"""
        for entry in self._node_index:
            if entry["node_id"] == node_id:
                return entry["data"]
        return None

    def get_node_location(self, node_id: str) -> Optional[Dict[str, str]]:
        """通过节点 ID 获取节点位置信息（返回第一个匹配的）"""
        for entry in self._node_index:
            if entry["node_id"] == node_id:
                return {
                    "resource_path": entry["resource_path"],
                    "filename": entry["filename"]
                }
        return None


# 保留旧类名的兼容性别名（可选，方便迁移）
JsonNodeLoader = ResourcesManager
