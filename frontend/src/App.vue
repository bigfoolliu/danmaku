<template>
  <div class="app">
    <h1>Vue 弹幕视频播放器</h1>
    
    <!-- 视频播放器 + 弹幕 -->
    <VideoPlayer
      ref="playerRef"
      :danmus="danmus"
      :show-danmaku="showDanmaku"
      :opacity="opacity"
      :speed="speed"
    />
    
    <!-- 弹幕输入 -->
    <div class="controls">
      <DanmakuInput
        :can-send="isAuthenticated"
        @send="handleSendDanmaku"
      />
    </div>
    
    <!-- 连接状态 -->
    <div class="status">
      <div class="status-item">
        <span class="status-dot" :class="{ connected: isConnected }"></span>
        <span>{{ isConnected ? '已连接' : '未连接' }}</span>
      </div>
      <div class="status-item">
        <span>房间: </span>
        <span>{{ roomIdRef }}</span>
      </div>
    </div>
    
    <!-- 弹幕设置 -->
    <div class="settings">
      <label>
        <input type="checkbox" v-model="showDanmaku">
        显示弹幕
      </label>
      <label>
        透明度: {{ opacity }}
        <input type="range" v-model.number="opacity" min="0.1" max="1" step="0.1">
      </label>
      <label>
        速度: {{ speed }}
        <input type="range" v-model.number="speed" min="50" max="200">
      </label>
    </div>
    
    <!-- 架构说明 -->
    <div class="docs">
      <h3>📚 弹幕系统架构说明</h3>
      <p><strong>1. WebSocket 通信：</strong> 客户端与服务器建立持久连接，实现实时双向通信。</p>
      <p><strong>2. 房间概念：</strong> 弹幕系统按"房间"隔离用户，同一房间内的用户可以看到彼此发送的弹幕。</p>
      <p><strong>3. 心跳机制：</strong> 客户端每隔30秒发送心跳包，维持连接活跃。</p>
      <p><strong>4. vue-danmaku：</strong> 使用 Vue 3 弹幕组件库，简化渲染逻辑。</p>
      <p><strong>5. Composables：</strong> 使用 Vue 3 Composition API 封装可复用的 WebSocket 逻辑。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import VideoPlayer from './components/VideoPlayer.vue'
import DanmakuInput from './components/DanmakuInput.vue'
import { useWebSocket } from './composables/useWebSocket.js'

// 弹幕数据
const danmus = ref([])
const playerRef = ref(null)

// 弹幕设置
const showDanmaku = ref(true)
const opacity = ref(1)
const speed = ref(100)

// WebSocket
const {
  isConnected,
  isAuthenticated,
  roomIdRef,
  connect,
  sendDanmaku,
  setCallbacks
} = useWebSocket()

// 设置消息回调
function handleDanmaku(danmaku) {
  if (playerRef.value) {
    playerRef.value.addDanmaku(danmaku)
  }
}

function handleSystemMessage(message) {
  if (playerRef.value) {
    playerRef.value.addDanmaku({
      id: Date.now(),
      text: message,
      color: '#888888',
      fontSize: 16
    })
  }
}

setCallbacks({
  onDanmaku: handleDanmaku,
  onSystemMessage: handleSystemMessage,
  onAuthSuccess: (data) => {
    console.log('认证成功:', data)
  }
})

// 发送弹幕（只发送给服务器，不本地添加，等待服务器广播）
function handleSendDanmaku({ content, color, fontSize }) {
  sendDanmaku(content, color, fontSize)
}

// 页面加载后连接
onMounted(() => {
  connect()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #eee;
  min-height: 100vh;
  padding: 20px;
}

.app {
  display: flex;
  flex-direction: column;
  align-items: center;
}

h1 {
  margin-bottom: 20px;
  font-size: 24px;
  color: #00d2ff;
}

.controls {
  width: 100%;
  max-width: 900px;
  margin-top: 20px;
  padding: 15px;
  background: #16213e;
  border-radius: 8px;
}

.status {
  width: 100%;
  max-width: 900px;
  margin-top: 15px;
  padding: 10px 15px;
  background: #16213e;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  gap: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
}

.status-dot.connected {
  background: #4ade80;
}

.settings {
  width: 100%;
  max-width: 900px;
  margin-top: 15px;
  padding: 15px;
  background: #16213e;
  border-radius: 8px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.settings label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.docs {
  width: 100%;
  max-width: 900px;
  margin-top: 20px;
  padding: 20px;
  background: #16213e;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.8;
}

.docs h3 {
  color: #00d2ff;
  margin-bottom: 10px;
}

.docs code {
  background: #0f3460;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}
</style>
