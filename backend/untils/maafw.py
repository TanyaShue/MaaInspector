import re
from pathlib import Path
from typing import Callable, List, Optional, Tuple, Union

from PIL import Image
from maa.agent_client import AgentClient
from maa.context import ContextEventSink
from maa.controller import AdbController, Win32Controller
from maa.event_sink import NotificationType
from maa.resource import Resource
from maa.tasker import Tasker, RecognitionDetail, TaskerEventSink
from maa.toolkit import Toolkit, AdbDevice, DesktopWindow
from numpy import ndarray


class MaaFW:
    resource: Optional[Resource]
    controller: Union[AdbController, Win32Controller, None]
    tasker: Optional[Tasker]
    agent: Optional[AgentClient]

    def __init__(self):
        Toolkit.init_option("./")
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
            self, hwnd: Union[int, str], screencap_method: int, input_method: int
    ) -> Tuple[bool, Optional[str]]:
        if isinstance(hwnd, str):
            hwnd = int(hwnd, 16)

        self.controller = Win32Controller(
            hwnd, screencap_method=screencap_method, input_method=input_method
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
        return (True, None)

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
        self.tasker.add_context_sink(MyNotificationHandler())
        # self.tasker.add_sink(NotificationHandler())
        self.tasker.post_task(entry, pipeline_override)

        return None

    def stop_task(self):
        if not self.tasker:
            return

        self.tasker.post_stop().wait()

    def screencap(self, capture: bool = True) -> Optional[Image.Image]:
        if not self.controller:
            return None

        if capture:
            self.controller.post_screencap().wait()
        im = self.controller.cached_image
        if im is None:
            return None

        return cvmat_to_image(im)

    def click(self, x, y) -> bool:
        if not self.controller:
            return False

        return self.controller.post_click(x, y).wait().succeeded

    def get_reco_detail(self, reco_id: int) -> Optional[RecognitionDetail]:
        if not self.tasker:
            return None

        return self.tasker.get_recognition_detail(reco_id)

    def clear_cache(self) -> bool:
        if not self.tasker:
            return False

        return self.tasker.clear_cache()


class MyNotificationHandler(ContextEventSink):
    """通知处理器类，处理识别事件"""

    def __init__(self) -> None:
        super().__init__()

    def on_node_next_list(
            self,
            context: ContextEventSink,
            noti_type: NotificationType,
            detail: ContextEventSink.NodeNextListDetail,
    ):
        if noti_type != NotificationType.Starting:
            return
        print(f"开始识别:{detail}")

    def on_node_recognition(
            self,
            context: ContextEventSink,
            noti_type: ContextEventSink,
            detail: ContextEventSink.NodeRecognitionDetail,
    ):
        if noti_type == NotificationType.Starting:
            print(f"当前开始的节点的名称为:{detail.name},完整参数为:"
                  f"{detail}")
        if noti_type == NotificationType.Succeeded:
            print(f"当前成功识别的节点的名称为:{detail.name},识别id为:{detail.reco_id}")
        if noti_type == NotificationType.Failed:
            print(f"当前识别失败的节点的名称为:{detail.name},识别id为:{detail.reco_id}")

class NotificationHandler(TaskerEventSink):
    """通知处理器类，处理识别事件"""

    def __init__(self) -> None:
        super().__init__()
    def on_tasker_task(
        self, tasker: Tasker, noti_type: NotificationType, detail: TaskerEventSink.TaskerTaskDetail
    ):
        print(tasker)
        print(noti_type)
        print(detail)


def cvmat_to_image(cvmat: ndarray) -> Image.Image:
    pil = Image.fromarray(cvmat)
    b, g, r = pil.split()
    return Image.merge("RGB", (r, g, b))

maafw = MaaFW()