import re
import time
from pathlib import Path
from queue import Empty, Queue
from threading import Lock
from typing import Callable, List, Optional, Tuple, Union

from PIL import Image
from maa.agent_client import AgentClient
from maa.context import ContextEventSink
from maa.controller import AdbController, Win32Controller
from maa.define import MaaWin32ScreencapMethodEnum
from maa.event_sink import NotificationType
from maa.resource import Resource
from maa.tasker import Tasker, RecognitionDetail, TaskerEventSink
from maa.toolkit import Toolkit, AdbDevice, DesktopWindow
from numpy import ndarray


class DebugStreamBroker:
    """简易的 SSE 事件分发器"""

    def __init__(self):
        self._clients: List[Queue] = []
        self._lock = Lock()

    def register(self) -> Queue:
        q = Queue()
        with self._lock:
            self._clients.append(q)
        return q

    def unregister(self, q: Queue):
        with self._lock:
            if q in self._clients:
                self._clients.remove(q)

    def publish(self, payload: dict):
        if not payload:
            return
        with self._lock:
            for q in list(self._clients):
                try:
                    q.put_nowait(payload)
                except Exception:
                    # 忽略单个客户端队列的异常，避免阻塞其他客户端
                    pass


debug_broker = DebugStreamBroker()


class MaaFW:
    resource: Optional[Resource]
    controller: Union[AdbController, Win32Controller, None]
    tasker: Optional[Tasker]
    agent: Optional[AgentClient]
    context_sink=False
    tasker_sink=False

    def __init__(self):
        self.im = None
        Toolkit.init_option("/")
        Tasker.set_debug_mode(True)

        self.resource = None
        self.controller = None
        self.tasker = None
        self.agent = None
        self.notification_handler = None

    @staticmethod
    def detect_adb() -> List[AdbDevice]:
        return Toolkit.find_adb_devices()

    @staticmethod
    def detect_win32hwnd(window_regex: str) -> List[DesktopWindow]:
        windows = Toolkit.find_desktop_windows()
        result = []
        for win in windows:
            if not re.search(window_regex, win.window_name):
                continue

            result.append(win)

        return result

    def connect_adb(
            self, path: Path, address: str, config: dict
    ) -> Tuple[bool, Optional[str]]:
        self.controller = AdbController(path, address, config=config)
        connected = self.controller.post_connection().wait().succeeded
        if not connected:
            return (False, f"Failed to connect {path} {address}")

        return True, None


    def connect_win32hwnd(
            self, hwnd: Union[int, str], screencap_method: int =None, mouse_method: int =None,keyboard_method:int =None
    ) -> Tuple[bool, Optional[str]]:
        if isinstance(hwnd, str):
            hwnd = int(hwnd, 16)

        self.controller = Win32Controller(
            hwnd, screencap_method=screencap_method, mouse_method=mouse_method,keyboard_method=keyboard_method
        )
        connected = self.controller.post_connection().wait().succeeded
        if not connected:
            return (False, f"Failed to connect {hex(hwnd)}")

        return True, None

    def load_resource(self, dir: List[Path]) -> Tuple[bool, Optional[str]]:
        if not self.resource:
            self.resource = Resource()
        dir = [Path(p) for p in dir]
        for d in dir:
            if not d.exists():
                return (False, f"{d} does not exist.")

            status = self.resource.post_bundle(d).wait().succeeded
            if not status:
                return (
                    False,
                    "Fail to load resource,please check the outputs of CLI.",
                )
        return True, None

    def create_agent(self, identifier: str) -> str:
        if not self.resource:
            self.resource = Resource()

        self.agent = AgentClient(identifier)
        self.agent.bind(self.resource)
        if not self.agent.identifier:
            raise RuntimeError("Failed to create agent")

        return self.agent.identifier

    def connect_agent(self) -> Tuple[bool, Optional[str]]:
        ret = self.agent.connect()
        if not ret:
            return (None, "Failed to connect agent")
        return True, None

    def disconnect_adb(self):
        if self.controller:
            self.controller=None
            self.tasker.controller=None
        return True

    def run_task(
            self, entry: str, pipeline_override: dict = {}
    ):

        if not self.tasker:
            self.tasker = Tasker()

        if not self.resource or not self.controller:
            return (False, "Resource or Controller not initialized")

        self.tasker.bind(self.resource, self.controller)
        if not self.tasker.inited:
            return (False, "Failed to init MaaFramework tasker")
        if not self.context_sink:
            self.tasker.add_context_sink(MyNotificationHandler(debug_broker))
            self.context_sink=True
        if not self.tasker_sink:
            self.tasker.add_sink(NotificationHandler(debug_broker))
            self.tasker_sink=True
        self.tasker.post_task(entry, pipeline_override)

        return None
    def run_re(self):

        if not self.tasker:
            self.tasker = Tasker()

        if not self.resource or not self.controller:
            return (False, "Resource or Controller not initialized")

        self.tasker.bind(self.resource, self.controller)
        if not self.tasker.inited:
            return (False, "Failed to init MaaFramework tasker")
        if not self.context_sink:
            self.tasker.add_context_sink(MyNotificationHandler(debug_broker))
            self.context_sink=True
        if not self.tasker_sink:
            self.tasker.add_sink(NotificationHandler(debug_broker))
            self.tasker_sink=True

        return self.tasker

    def stop_task(self):
        if not self.tasker:
            return

        self.tasker.post_stop().wait()

    def screencap(self, capture: bool = True) -> Optional[Image.Image]:
        if not self.controller:
            return None

        if capture:
            self.im=self.controller.post_screencap().wait().get()
        # self.im = self.controller.cached_image
        if self.im is None:
            return None
        return cvmat_to_image(self.im)

    def click(self, x, y) -> bool:
        if not self.controller:
            return False

        return self.controller.post_click(x, y).wait().succeeded

    def get_reco_detail(self, reco_id: int) -> Optional[RecognitionDetail]:
        """根据 reco_id 获取识别详情，并预先将绘制结果转换为 PIL Image"""
        if not self.tasker:
            return None
        detail = self.tasker.get_recognition_detail(reco_id)
        if not detail:
            return None
        try:
            if getattr(detail, "raw_image", None) is not None and not isinstance(detail.raw_image, Image.Image):
                detail.raw_image = cvmat_to_image(detail.raw_image)
            if getattr(detail, "draw_images", None):
                detail.draw_images = [cvmat_to_image(img) for img in detail.draw_images if img is not None]
        except Exception:
            # 转换失败不影响后续流程
            pass

        return detail

    def clear_cache(self) -> bool:
        if not self.tasker:
            return False

        return self.tasker.clear_cache()


# 单例实例，供路由直接使用
maafw = MaaFW()


class MyNotificationHandler(ContextEventSink):
    """通知处理器类，处理识别事件并透传到 SSE"""

    def __init__(self, broker: DebugStreamBroker) -> None:
        super().__init__()
        self.broker = broker

    @staticmethod
    def _normalize_next_list(next_list):
        result = []
        for item in next_list or []:
            result.append(
                {
                    "name": getattr(item, "name", "") or "",
                    "jump_back": bool(getattr(item, "jump_back", False)),
                    "anchor": bool(getattr(item, "anchor", False)),
                }
            )
        return result

    def on_node_next_list(
        self,
        context: ContextEventSink,
        noti_type: NotificationType,
        detail: ContextEventSink.NodeNextListDetail,
    ):
        if noti_type != NotificationType.Starting:
            return

        payload = {
            "type": "node_next_list",
            "task_id": detail.task_id,
            "name": detail.name,
            "next_list": self._normalize_next_list(detail.next_list),
            "focus": getattr(detail, "focus", None),
            "timestamp": int(time.time() * 1000),
        }
        print(f"开始识别:{detail}")
        self.broker.publish(payload)

    def on_node_recognition(
        self,
        context: ContextEventSink,
        noti_type: NotificationType,
        detail: ContextEventSink.NodeRecognitionDetail,
    ):
        status_map = {
            NotificationType.Starting: "starting",
            NotificationType.Succeeded: "succeeded",
            NotificationType.Failed: "failed",
        }
        status = status_map.get(noti_type, "unknown")

        payload = {
            "type": "node_recognition",
            "task_id": detail.task_id,
            "reco_id": detail.reco_id,
            "name": detail.name,
            "status": status,
            "focus": getattr(detail, "focus", None),
            "timestamp": int(time.time() * 1000),
        }

        self.broker.publish(payload)

class NotificationHandler(TaskerEventSink):
    def __init__(self, broker: DebugStreamBroker) -> None:
        super().__init__()
        self.broker = broker

    def on_tasker_task(self, tasker: Tasker, noti_type: NotificationType, detail: TaskerEventSink.TaskerTaskDetail):
        pass


def cvmat_to_image(cvmat: ndarray) -> Image.Image:
    pil = Image.fromarray(cvmat)
    b, g, r = pil.split()
    return Image.merge("RGB", (r, g, b))

maafw = MaaFW()