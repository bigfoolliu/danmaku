/**
 * WebSocket 组合式函数
 * 封装 WebSocket 连接、认证、心跳、消息收发逻辑
 */

import { ref, onUnmounted } from 'vue'

export function useWebSocket(options = {}) {
  const {
    url = 'ws://localhost:8765',
    roomId = 'demo-room',
    heartbeatInterval = 30000,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10
  } = options

  // 响应式状态
  const isConnected = ref(false)
  const isAuthenticated = ref(false)
  const reconnectAttempts = ref(0)
  const userId = ref('')
  const roomIdRef = ref(roomId)

  // 内部变量
  let ws = null
  let heartbeatTimer = null
  let reconnectTimer = null
  let username = '游客' + Math.floor(Math.random() * 1000)

  // 消息回调
  let onDanmaku = null
  let onSystemMessage = null
  let onAuthSuccess = null

  /**
   * 设置消息回调
   */
  function setCallbacks({ onDanmaku: cb1, onSystemMessage: cb2, onAuthSuccess: cb3 }) {
    onDanmaku = cb1
    onSystemMessage = cb2
    onAuthSuccess = cb3
  }

  /**
   * 连接到 WebSocket 服务器
   */
  function connect() {
    console.log(`正在连接到 ${url}...`)
    
    try {
      ws = new WebSocket(url)

      ws.onopen = handleOpen
      ws.onclose = handleClose
      ws.onerror = handleError
      ws.onmessage = handleMessage

    } catch (e) {
      console.error('创建 WebSocket 失败:', e)
      scheduleReconnect()
    }
  }

  /**
   * 处理连接打开
   */
  function handleOpen() {
    console.log('WebSocket 连接已建立')
    isConnected.value = true
    reconnectAttempts.value = 0

    // 延迟发送认证，确保连接完全就绪
    setTimeout(sendAuth, 100)
  }

  /**
   * 发送认证消息
   */
  function sendAuth() {
    send({
      type: 'auth',
      room_id: roomIdRef.value,
      username: username
    })
  }

  /**
   * 处理连接关闭
   */
  function handleClose(event) {
    console.log('WebSocket 连接已关闭', event.code, event.reason)
    isConnected.value = false
    isAuthenticated.value = false
    stopHeartbeat()
    scheduleReconnect()
  }

  /**
   * 处理错误
   */
  function handleError(error) {
    console.error('WebSocket 错误:', error)
  }

  /**
   * 处理收到消息
   */
  function handleMessage(event) {
    try {
      const message = JSON.parse(event.data)
      
      switch (message.type) {
        case 'auth_success':
          isAuthenticated.value = true
          userId.value = message.user_id
          roomIdRef.value = message.room_id
          console.log('认证成功，房间ID:', message.room_id)
          onAuthSuccess?.(message)
          startHeartbeat()
          break

        case 'error':
          console.error('服务器错误:', message.message)
          break

        case 'danmaku':
          // 转换为 vue3-danmaku 需要的格式
          onDanmaku?.({
            id: message.user_id + Date.now(),
            text: message.content,
            color: message.color,
            fontSize: message.font_size,
            username: message.username
          })
          break

        case 'system':
          onSystemMessage?.(message.message)
          break

        case 'heartbeat':
          sendHeartbeat()
          break
      }
    } catch (e) {
      console.error('解析消息失败:', e)
    }
  }

  /**
   * 发送弹幕
   */
  function sendDanmaku(content, color = '#FFFFFF', fontSize = 24) {
    if (!isAuthenticated.value) {
      console.warn('未认证，无法发送弹幕')
      return false
    }

    if (!content.trim()) return false

    return send({
      type: 'danmaku',
      content: content.trim(),
      color: color,
      font_size: fontSize
    })
  }

  /**
   * 发送消息到服务器
   */
  function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
      return true
    } else {
      console.warn('WebSocket 未连接')
      return false
    }
  }

  /**
   * 发送心跳
   */
  function sendHeartbeat() {
    send({ type: 'heartbeat' })
  }

  /**
   * 启动心跳
   */
  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      sendHeartbeat()
    }, heartbeatInterval)
  }

  /**
   * 停止心跳
   */
  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /**
   * 安排重连
   */
  function scheduleReconnect() {
    if (reconnectAttempts.value >= maxReconnectAttempts) {
      console.log('达到最大重连次数，停止重连')
      return
    }

    reconnectAttempts.value++
    console.log(`等待 ${reconnectInterval/1000} 秒后重连 (尝试 ${reconnectAttempts.value}/${maxReconnectAttempts})`)

    reconnectTimer = setTimeout(() => {
      connect()
    }, reconnectInterval)
  }

  /**
   * 断开连接
   */
  function disconnect() {
    stopHeartbeat()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }
    if (ws) {
      ws.close()
    }
  }

  // 组件卸载时清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    // 状态
    isConnected,
    isAuthenticated,
    reconnectAttempts,
    userId,
    roomIdRef,
    // 方法
    connect,
    disconnect,
    sendDanmaku,
    setCallbacks
  }
}
