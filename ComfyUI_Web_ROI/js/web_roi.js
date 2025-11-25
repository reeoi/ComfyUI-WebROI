import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "ComfyUI.WebROI",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "WebROICapture") return;

        console.log("✅ WebROI: V5 Mouse Selection Loaded");

        // ============================================================
        // 1. 绘制函数 (负责画视频、画选框、截图)
        // ============================================================
        nodeType.prototype.onDrawForeground = function(ctx) {
            if (this.flags.collapsed) return;

            // 绘制左上角红点 (运行指示器)
            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.arc(10, 10, 5, 0, 2 * Math.PI);
            ctx.fill();

            const roi = this.webRoiCtx;
            if (!roi) return;

            // 绘制状态文字
            if (roi.statusText) {
                ctx.fillStyle = "white";
                ctx.font = "14px Arial";
                ctx.fillText(roi.statusText, 20, 50);
            }

            // 如果没有视频，就不继续了
            if (!roi.isSharing || !roi.video || roi.video.readyState < 2) return;

            try {
                // --- A. 计算显示区域 ---
                const nodeWidth = this.size[0];
                const contentWidth = nodeWidth - 20; // 左右留边
                const aspectRatio = roi.video.videoHeight / roi.video.videoWidth;
                const contentHeight = contentWidth * aspectRatio;
                
                // 记录视频在节点上的显示位置 (供鼠标事件使用)
                const drawX = 10;
                const drawY = 60; // 避开按钮
                roi.renderRect = { x: drawX, y: drawY, w: contentWidth, h: contentHeight };

                // --- B. 绘制视频到底层 ---
                ctx.drawImage(roi.video, drawX, drawY, contentWidth, contentHeight);

                // --- C. 绘制选框 (UI) ---
                // 计算当前的选框数据 (相对于节点坐标)
                let selRect = null;
                
                // 如果正在拖拽，优先显示拖拽框
                if (roi.dragStart && roi.dragCurrent) {
                    const x = Math.min(roi.dragStart[0], roi.dragCurrent[0]);
                    const y = Math.min(roi.dragStart[1], roi.dragCurrent[1]);
                    const w = Math.abs(roi.dragCurrent[0] - roi.dragStart[0]);
                    const h = Math.abs(roi.dragCurrent[1] - roi.dragStart[1]);
                    selRect = { x, y, w, h };
                    
                    // 拖拽时画黄色虚线
                    ctx.strokeStyle = "yellow";
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(x + drawX, y + drawY, w, h);
                    ctx.setLineDash([]);
                } 
                // 如果有已锁定的选区
                else if (roi.selection) {
                    // selection 存储的是相对比例 (0.0 - 1.0)，需要转回像素
                    const x = roi.selection.x * contentWidth;
                    const y = roi.selection.y * contentHeight;
                    const w = roi.selection.w * contentWidth;
                    const h = roi.selection.h * contentHeight;
                    
                    // 锁定后画红色实线
                    ctx.strokeStyle = "#ff0000";
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x + drawX, y + drawY, w, h);
                }

                // --- D. 截取数据 (Crop & Send) ---
                // 只有当尺寸变化或每一帧都更新时执行
                const vidW = roi.video.videoWidth;
                const vidH = roi.video.videoHeight;

                // 确定源坐标 (Source X, Y, W, H)
                let sx = 0, sy = 0, sW = vidW, sH = vidH;

                if (roi.selection) {
                    sx = Math.floor(roi.selection.x * vidW);
                    sy = Math.floor(roi.selection.y * vidH);
                    sW = Math.floor(roi.selection.w * vidW);
                    sH = Math.floor(roi.selection.h * vidH);
                }

                // 安全检查，防止超出边界
                if (sW <= 0) sW = 1; if (sH <= 0) sH = 1;

                // 调整画布尺寸以适应裁剪后的大小
                if (roi.cropCanvas.width !== sW || roi.cropCanvas.height !== sH) {
                    roi.cropCanvas.width = sW;
                    roi.cropCanvas.height = sH;
                }

                // 执行裁剪绘制: drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
                roi.cropCtx.drawImage(roi.video, sx, sy, sW, sH, 0, 0, sW, sH);
                
                // 更新数据给 Python
                const widget = this.widgets.find(w => w.name === "image_data");
                if (widget) {
                    widget.value = roi.cropCanvas.toDataURL("image/jpeg", 0.7);
                }

            } catch (e) {
                console.error("Draw error:", e);
            }
        };

        // ============================================================
        // 2. 鼠标交互逻辑
        // ============================================================
        
        // 按下鼠标
        nodeType.prototype.onMouseDown = function(e, pos) {
            const roi = this.webRoiCtx;
            if (!roi || !roi.renderRect) return;
            
            // 检查点击是否在视频区域内
            const r = roi.renderRect;
            const mx = pos[0];
            const my = pos[1];

            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                // 记录相对于视频左上角的坐标
                roi.dragStart = [mx - r.x, my - r.y];
                roi.dragCurrent = [mx - r.x, my - r.y];
                roi.selection = null; // 清除旧选区
                return true; // 捕获事件，防止拖动节点
            }
        };

        // 移动鼠标
        nodeType.prototype.onMouseMove = function(e, pos) {
            const roi = this.webRoiCtx;
            if (!roi || !roi.dragStart) return;

            const r = roi.renderRect;
            // 限制坐标在视频范围内
            let currX = pos[0] - r.x;
            let currY = pos[1] - r.y;
            
            // Clamp
            currX = Math.max(0, Math.min(currX, r.w));
            currY = Math.max(0, Math.min(currY, r.h));

            roi.dragCurrent = [currX, currY];
        };

        // 松开鼠标
        nodeType.prototype.onMouseUp = function(e, pos) {
            const roi = this.webRoiCtx;
            if (!roi || !roi.dragStart) return;

            // 计算最终选区
            const x1 = roi.dragStart[0];
            const y1 = roi.dragStart[1];
            const x2 = roi.dragCurrent[0];
            const y2 = roi.dragCurrent[1];

            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            const w = Math.abs(x1 - x2);
            const h = Math.abs(y1 - y2);

            // 如果选区太小（比如只是点了一下），视为取消选区
            if (w > 10 && h > 10) {
                // 保存为相对比例 (0.0 - 1.0)，这样分辨率改变也不怕
                roi.selection = {
                    x: x / roi.renderRect.w,
                    y: y / roi.renderRect.h,
                    w: w / roi.renderRect.w,
                    h: h / roi.renderRect.h
                };
            } else {
                roi.selection = null;
            }

            roi.dragStart = null;
            roi.dragCurrent = null;
        };

        // 双击重置
        nodeType.prototype.onDblClick = function(e, pos) {
            const roi = this.webRoiCtx;
            if (roi) {
                roi.selection = null;
                console.log("Selection Reset");
            }
        }

        // ============================================================
        // 3. 强制高度计算 (同 V4)
        // ============================================================
        const origComputeSize = nodeType.prototype.computeSize;
        nodeType.prototype.computeSize = function() {
            if (this.webRoiCtx && this.webRoiCtx.isSharing && this.webRoiCtx.video) {
                 const vid = this.webRoiCtx.video;
                 if (vid.videoWidth > 0) {
                     const ar = vid.videoHeight / vid.videoWidth;
                     return [this.size[0], (this.size[0] - 20) * ar + 100];
                 }
            }
            return origComputeSize ? origComputeSize.apply(this, arguments) : [200, 100];
        };

        // ============================================================
        // 4. 初始化与按钮
        // ============================================================
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            
            this.webRoiCtx = {
                video: document.createElement("video"),
                cropCanvas: document.createElement("canvas"),
                cropCtx: null,
                statusText: "Click Start ->",
                isSharing: false,
                renderRect: null, // 视频在节点上的位置
                selection: null,  // 最终选区 {x,y,w,h} (比例 0-1)
                dragStart: null,  // 拖拽起点
                dragCurrent: null // 拖拽终点
            };
            
            const roi = this.webRoiCtx;
            roi.cropCtx = roi.cropCanvas.getContext("2d");
            roi.video.autoplay = true;
            roi.video.muted = true;
            roi.video.style.display = "none";
            document.body.appendChild(roi.video);

            // 按钮 1: 开始捕捉
            this.addWidget("button", "🖥️ START", null, () => {
                startScreenShare(this, roi);
            });

            // 按钮 2: 重置选区
            this.addWidget("button", "❌ RESET ROI", null, () => {
                roi.selection = null;
            });

            setTimeout(() => {
                const w = this.widgets.find(w => w.name === "image_data");
                if (w) w.type = "hidden";
                this.setSize([360, 150]); 
            }, 100);

            return r;
        };

        async function startScreenShare(node, roi) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: { cursor: "always" }, audio: false 
                });
                roi.video.srcObject = stream;
                roi.video.onloadedmetadata = () => {
                    roi.video.play();
                    roi.statusText = "";
                    roi.isSharing = true;
                    node.setSize(node.computeSize());
                    renderLoop();
                };
            } catch (e) {
                roi.statusText = "Error: " + e.message;
            }
        }

        function renderLoop() {
            app.graph.setDirtyCanvas(true, false);
            requestAnimationFrame(renderLoop);
        }
    }
});
