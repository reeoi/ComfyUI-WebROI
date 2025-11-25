# ComfyUI-WebROI Capture 🖥️✂️

<div align="center">



**Capture screen, windows, or tabs directly in your browser and send them to ComfyUI.**  
**无需服务器显卡驱动，直接在浏览器内截取屏幕、窗口或标签页，并发送给 ComfyUI。**

</div>

---

<a name="english"></a>



**ComfyUI-WebROI** is a custom node that enables client-side screen capturing directly within the browser. It supports **Region of Interest (ROI)** selection, allowing you to crop specific parts of your screen before sending them to the workflow.

Since the capture happens locally in your browser and data is sent via Base64, it is **100% Cloud Compatible** (AutoDL, RunPod, Colab, AWS) and requires **no GUI or display drivers** on the server side.

### ✨ Key Features

*   **🖥️ Client-Side Capture**: Uses the browser's native `navigator.mediaDevices` API. No external software (like OBS) needed.
*   **🖱️ Interactive ROI Cropping**:
    *   **Draw**: Drag your mouse on the node preview to draw a selection box (Yellow).
    *   **Lock**: Release mouse to lock the crop area (Red). Only this area is sent to the backend.
    *   **Reset**: Double-click or press the `RESET` button to clear the selection.
*   **📐 Resizable UI**: The node is fully resizable. You can shrink it to save space on your canvas, and the preview will adapt automatically.
*   **☁️ Cloud Ready**: Works perfectly on headless cloud servers. As long as you can see the ComfyUI web page, you can stream your screen.
*   **⚡ Real-time Workflow**: Compatible with ComfyUI's `Auto Queue` for real-time Screen-to-Image generation.

### ⚠️ CRITICAL: HTTPS Requirement

**If you are using a remote server (Cloud), you MUST access ComfyUI via HTTPS.**

Modern browsers **block** screen sharing APIs on insecure (HTTP) connections.
*   ✅ `http://localhost` or `http://127.0.0.1` -> **Works** (Local)
*   ✅ `https://your-cloud-url.com` -> **Works** (Cloud with SSL)
*   ❌ `http://192.168.x.x` or `http://xx.xx.xx.xx:8188` -> **BLOCKED**

**How to fix on Cloud:**
1.  Use the **Cloudflare Tunnel** or **Ngrok** to get an `https` link.
2.  Use the official Proxy Link provided by services like RunPod.
3.  (Testing only) Enable `chrome://flags/#unsafely-treat-insecure-origin-as-secure` in Chrome and add your HTTP URL.

### 📦 Installation

1.  Navigate to your `custom_nodes` folder:
    ```bash
    cd ComfyUI/custom_nodes/
2.  Clone this repository：
     git clone https://github.com/reeoi/ComfyUI-WebROI.git
3.  Restart ComfyUI.

📖 Usage
1.  Add Node: Double-click and search for WebROICapture.
2.  Start Capture: Click the 🖥️ START button on the node. Your browser will ask which screen/window to share.
3.  Select Region (Optional):
     1)Drag on the video preview to draw a box.
     2)The generated image will only contain the selected area.
     3)Double-click to reset to full view.
4.Generate: Connect the IMAGE output to your workflow and click Queue Prompt.
5.Real-time: Check Auto Queue in the ComfyUI menu to stream frames continuously.


