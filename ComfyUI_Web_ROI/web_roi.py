import torch
import numpy as np
from PIL import Image
import base64
from io import BytesIO
import re

class WebROICapture:
    def __init__(self):
        pass
  
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # 必须有这个输入项，前端JS才会把图片数据塞进来
                "image_data": ("STRING", {"default": "", "multiline": True}), 
            },
            "optional": {
                # 用作触发器，每次数字变化时触发
                "trigger_always": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff, "forceInput": True}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "capture_screen"
    CATEGORY = "WebROI"

    def capture_screen(self, image_data, trigger_always=0):
        try:
            # 1. 检查数据是否为空
            if not image_data or "," not in image_data:
                # 返回一张黑图防止报错
                print("⚠️ WebROI: Waiting for image data...")
                empty_img = torch.zeros((1, 512, 512, 3), dtype=torch.float32)
                return (empty_img,)

            # 2. 解码 Base64
            base64_data = image_data.split(",")[1]
            image_bytes = base64.b64decode(base64_data)
            img = Image.open(BytesIO(image_bytes))
          
            # 3. 转换为 ComfyUI 格式 (Tensor)
            img = img.convert("RGB")
            img_np = np.array(img).astype(np.float32) / 255.0
            img_tensor = torch.from_numpy(img_np)[None,]
          
            return (img_tensor,)
          
        except Exception as e:
            print(f"❌ WebROI Error: {e}")
            empty_img = torch.zeros((1, 512, 512, 3), dtype=torch.float32)
            return (empty_img,)

# 节点映射名称，JS 必须用这个名字 "WebROICapture" 才能找到它
NODE_CLASS_MAPPINGS = {
    "WebROICapture": WebROICapture
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WebROICapture": "🖥️ Web ROI Capture"
}

