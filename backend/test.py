import maa
from maa.resource import Resource
from maa.toolkit import Toolkit

# r=Toolkit.find_adb_devices()
# print(r)

resource=Resource()
resource.post_bundle("D:\\DeveProject\\MFWPH\\assets\\resource\\MaaYYs\\resource_pack\\base").wait()
print(resource.node_list)