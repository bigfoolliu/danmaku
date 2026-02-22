/**
 * WebSocket 客户端
 *
 * 功能：
 * 1. 连接服务器并进行认证
 * 2. 发送弹幕消息
 * 3. 接收并处理服务器消息
 * 4. 心跳保活和断线重连
 */

// import { addDanmaku } from "danmaku.js";

class DanmakuClient {
    constructor() {
        // WebSocket 连接
        this.ws = null;

        // 连接配置
        this.serverUrl = 'ws://localhost:8765';
        this.roomId = 'demo-room';
        this.username = '游客' + Math.floor(Math.random() * 1000);

        // 心跳配置
        this.heartbeatInterval = 30000;  // 30秒发送一次心跳
        this.heartbeatTimer = null;

        // 重连配置
        this.reconnectEnabled = true;
        this.reconnectInterval = 3000;   // 3秒尝试重连
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;

        // 状态
        this.isConnected = false;
        this.isAuthenticated = false;

        // UI 元素
        this.connectionDot = document.getElementById('connectionDot');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.roomIdSpan = document.getElementById('roomId');
        this.userCountSpan = document.getElementById('userCount');
    }

    /**
     * 连接到 WebSocket 服务器
     */
    connect() {
        console.log(`正在连接到 ${this.serverUrl}...`);

        try {
            this.ws = new WebSocket(this.serverUrl);

            // 绑定事件处理
            this.ws.onopen = this.onOpen.bind(this);
            this.ws.onclose = this.onClose.bind(this);
            this.ws.onerror = this.onError.bind(this);
            this.ws.onmessage = this.onMessage.bind(this);

        } catch (e) {
            console.error('创建 WebSocket 失败:', e);
            this.scheduleReconnect();
        }
    }

    /**
     * WebSocket 连接打开
     */
    onOpen(event) {
        console.log('WebSocket 连接已建立');
        this.isConnected = true;

        // 更新 UI
        this.updateConnectionStatus(true);

        // 延迟 100ms 发送认证，确保连接完全就绪
        setTimeout(() => this.sendAuth(), 100);
    }

    /**
     * 发送认证消息
     *
     * 认证消息格式：
     * {
     *   type: "auth",
     *   room_id: "房间ID",
     *   username: "用户名"
     * }
     */
    sendAuth() {
        const authMessage = {
            type: 'auth',
            room_id: this.roomId,
            username: this.username
        };

        this.send(authMessage);
    }

    /**
     * WebSocket 连接关闭
     */
    onClose(event) {
        console.log('WebSocket 连接已关闭', event.code, event.reason);
        this.isConnected = false;
        this.isAuthenticated = false;

        // 更新 UI
        this.updateConnectionStatus(false);

        // 清除心跳定时器
        this.stopHeartbeat();

        // 尝试重连
        if (this.reconnectEnabled) {
            this.scheduleReconnect();
        }
    }

    /**
     * WebSocket 错误
     */
    onError(error) {
        console.error('WebSocket 错误:', error);
    }

    /**
     * 收到服务器消息
     */
    onMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        } catch (e) {
            console.error('解析消息失败:', e);
        }
    }

    /**
     * 处理服务器消息
     *
     * 消息类型：
     * - auth_success: 认证成功
     * - error: 错误消息
     * - danmaku: 弹幕消息
     * - system: 系统消息
     * - heartbeat: 心跳
     */
    handleMessage(message) {
        console.log('收到消息:', message);

        switch (message.type) {
            case 'auth_success':
                // 认证成功
                this.isAuthenticated = true;
                this.reconnectAttempts = 0;
                this.roomIdSpan.textContent = message.room_id;
                console.log('认证成功，房间ID:', message.room_id);

                // 启动心跳
                this.startHeartbeat();

                // 显示欢迎消息
                this.showSystemMessage(message.message);
                break;

            case 'error':
                // 错误消息
                console.error('服务器错误:', message.message);
                alert('错误: ' + message.message);
                break;

            case 'danmaku':
                // 收到弹幕，渲染到屏幕
                addDanmaku({
                    content: message.content,
                    color: message.color,
                    font_size: message.font_size,
                    username: message.username
                });
                break;

            case 'system':
                // 系统消息
                this.showSystemMessage(message.message);
                break;

            case 'heartbeat':
                // 服务器心跳，响应客户端心跳
                this.sendHeartbeat();
                break;

            case 'pong':
                // 客户端 ping 的响应
                console.log('Pong received');
                break;

            default:
                console.log('未知消息类型:', message.type);
        }
    }

    /**
     * 发送弹幕
     *
     * 弹幕消息格式：
     * {
     *   type: "danmaku",
     *   content: "弹幕内容",
     *   color: "#FFFFFF",
     *   font_size: 24
     * }
     */
    sendDanmaku(content, color = '#FFFFFF', fontSize = 24) {
        if (!this.isAuthenticated) {
            console.warn('未认证，无法发送弹幕');
            return false;
        }

        if (!content.trim()) {
            return false;
        }

        const danmakuMessage = {
            type: 'danmaku',
            content: content.trim(),
            color: color,
            font_size: fontSize
        };

        return this.send(danmakuMessage);
    }

    /**
     * 发送心跳
     */
    sendHeartbeat() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'heartbeat'
            }));
        }
    }

    /**
     * 启动心跳定时器
     */
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatInterval);
    }

    /**
     * 停止心跳定时器
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * 安排重连
     */
    scheduleReconnect() {
        if (!this.reconnectEnabled) return;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('达到最大重连次数，停止重连');
            return;
        }

        this.reconnectAttempts++;
        console.log(`等待 ${this.reconnectInterval/1000} 秒后重连 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, this.reconnectInterval);
    }

    /**
     * 发送消息到服务器
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            return true;
        } else {
            console.warn('WebSocket 未连接');
            return false;
        }
    }

    /**
     * 更新连接状态 UI
     */
    updateConnectionStatus(connected) {
        if (this.connectionDot && this.connectionStatus) {
            if (connected) {
                this.connectionDot.className = 'status-dot connected';
                this.connectionStatus.textContent = '已连接';
            } else {
                this.connectionDot.className = 'status-dot disconnected';
                this.connectionStatus.textContent = '未连接';
            }
        }
    }

    /**
     * 显示系统消息（作为弹幕）
     */
    showSystemMessage(text) {
        addDanmaku({
            content: text,
            color: '#888888',
            font_size: 16
        });
    }

    /**
     * 断开连接
     */
    disconnect() {
        this.reconnectEnabled = false;
        this.stopHeartbeat();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        if (this.ws) {
            this.ws.close();
        }
    }
}


// ========== 页面交互逻辑 ==========

// 全局客户端实例
let danmakuClient = null;

/**
 * 初始化客户端并绑定事件
 */
function initClient() {
    console.log(window);

    // 创建客户端实例
    danmakuClient = new DanmakuClient();

    // 绑定发送按钮
    const sendBtn = document.getElementById('sendBtn');
    const danmakuInput = document.getElementById('danmakuInput');
    const colorSelect = document.getElementById('colorSelect');
    const fontSizeSelect = document.getElementById('fontSizeSelect');

    // 点击发送按钮
    sendBtn.addEventListener('click', () => {
        const content = danmakuInput.value;
        const color = colorSelect.value;
        const fontSize = parseInt(fontSizeSelect.value);

        if (danmakuClient.sendDanmaku(content, color, fontSize)) {
            danmakuInput.value = '';  // 发送成功后清空输入框
        }
    });

    // 回车发送
    danmakuInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendBtn.click();
        }
    });

    // 绑定设置控件
    const showDanmaku = document.getElementById('showDanmaku');
    const opacitySlider = document.getElementById('opacitySlider');
    const speedSlider = document.getElementById('speedSlider');

    showDanmaku.addEventListener('change', (e) => {
        setDanmakuEnabled(e.target.checked);
    });

    opacitySlider.addEventListener('input', (e) => {
        setDanmakuOpacity(parseFloat(e.target.value));
    });

    speedSlider.addEventListener('input', (e) => {
        // 将滑块值 (50-200) 转换为速度倍率 (0.5-2.0)
        const speedMultiplier = parseInt(e.target.value) / 100;
        setDanmakuSpeed(speedMultiplier);
    });

    // 连接服务器
    danmakuClient.connect();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initClient);
