# 弹幕视频播放器

基于 WebSocket 的实时弹幕视频播放器。

## 技术栈

- **后端**: Python + websockets
- **前端**: Vue 3 + Vite + vue-danmaku

## 项目结构

```
danmaku/
├── backend/
│   └── server.py          # WebSocket 服务器
└── frontend/
    ├── src/
    │   ├── App.vue
    │   ├── main.js
    │   ├── components/
    │   │   ├── VideoPlayer.vue
    │   │   └── DanmakuInput.vue
    │   └── composables/
    │       └── useWebSocket.js
    └── package.json
```

## 快速开始

### 后端

```bash
cd backend
pip install -r requirements.txt
python server.py
```

服务器运行在 `ws://localhost:8765`

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:3000`

## 功能特性

- 房间隔离 - 弹幕按房间隔离
- 实时通信 - WebSocket 双向连接
- 弹幕自定义 - 支持颜色、字体大小
- 自动重连 - 断线自动重连

## License

MIT
