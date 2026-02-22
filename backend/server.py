#!/usr/bin/env python3
"""
弹幕系统后端服务器
使用 Python websockets 库实现 WebSocket 服务

核心功能：
1. 管理多个房间的 WebSocket 连接
2. 接收客户端发送的弹幕消息
3. 广播弹幕给房间内的所有客户端
4. 心跳保活机制
"""

import asyncio
import json
import logging
import random
import uuid
from datetime import datetime
from typing import Dict, Set

import websockets
from websockets.server import WebSocketServerProtocol

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 服务器配置
HOST = "0.0.0.0"
PORT = 8765
# 心跳间隔（秒）- 客户端需要每隔30秒发送心跳
HEARTBEAT_INTERVAL = 30
# 房间字典：{room_id: {websocket连接集合}}
rooms: Dict[str, Set[WebSocketServerProtocol]] = {}
# 用户信息：{websocket: {user_id, username, room_id}}
users: Dict[WebSocketServerProtocol, dict] = {}


async def handle_client(websocket: WebSocketServerProtocol):
    """
    处理客户端连接

    WebSocket 连接生命周期：
    1. 客户端连接 -> 等待认证
    2. 客户端发送认证消息 -> 验证并加入房间
    3. 双方心跳保活
    4. 客户端断开 -> 清理资源

    注意：websockets 16.0+ 版本不再传递 path 参数
    """
    client_id = str(uuid.uuid4())[:8]
    logger.info(f"新客户端连接: {client_id} from {websocket.remote_address}")

    try:
        # 等待客户端认证消息
        # 弹幕系统通常需要先认证，才能接收/发送弹幕
        auth_data = await asyncio.wait_for(
            websocket.recv(),
            timeout=10  # 10秒内未收到认证消息则断开
        )

        # 解析认证消息
        message = json.loads(auth_data)
        if message.get("type") != "auth":
            await websocket.send(json.dumps({
                "type": "error",
                "message": "需要先进行认证"
            }))
            return

        # 从URL path或消息中获取房间ID
        # path 格式: /room/{room_id}
        room_id = message.get("room_id", "default")
        username = message.get("username", f"用户{random.randint(1000, 9999)}")

        # 将用户添加到房间
        if room_id not in rooms:
            rooms[room_id] = set()
        rooms[room_id].add(websocket)

        # 保存用户信息
        users[websocket] = {
            "user_id": client_id,
            "username": username,
            "room_id": room_id,
            "joined_at": datetime.now().isoformat()
        }

        logger.info(f"用户 {username} 加入房间 {room_id}")

        # 发送认证成功消息
        await websocket.send(json.dumps({
            "type": "auth_success",
            "room_id": room_id,
            "user_id": client_id,
            "message": "认证成功"
        }))

        # 向房间内其他人发送欢迎消息
        await broadcast_to_room(room_id, {
            "type": "system",
            "message": f"欢迎 {username} 进入直播间",
            "timestamp": datetime.now().isoformat()
        }, exclude=websocket)

        # 启动心跳任务和消息处理任务
        heartbeat_task = asyncio.create_task(send_heartbeat(websocket))
        message_task = asyncio.create_task(handle_messages(websocket, room_id))

        # 等待任一任务完成
        done, pending = await asyncio.wait(
            [heartbeat_task, message_task],
            return_when=asyncio.FIRST_COMPLETED
        )

        # 取消未完成的任务
        for task in pending:
            task.cancel()

    except asyncio.TimeoutError:
        logger.warning(f"客户端 {client_id} 认证超时")
    except websockets.exceptions.ConnectionClosedOK:
        logger.info(f"客户端 {client_id} 正常关闭连接")
    except Exception as e:
        logger.error(f"处理客户端 {client_id} 时发生错误: {e}", exc_info=True)
    finally:
        # 清理资源
        await cleanup_client(websocket, client_id)


async def handle_messages(websocket: WebSocketServerProtocol, room_id: str):
    """
    处理客户端消息

    消息类型：
    - danmaku: 弹幕消息，需要广播给房间内所有人
    - heartbeat: 心跳消息，仅更新最后活跃时间
    - gift: 礼物消息（可选扩展）
    """
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "danmaku":
                    # 收到弹幕消息，广播给房间内所有人
                    danmaku_data = {
                        "type": "danmaku",
                        "content": data.get("content", ""),
                        "color": data.get("color", "#FFFFFF"),
                        "font_size": data.get("font_size", 24),
                        "username": users.get(websocket, {}).get("username", "匿名"),
                        "user_id": users.get(websocket, {}).get("user_id", ""),
                        "timestamp": datetime.now().isoformat()
                    }
                    await broadcast_to_room(room_id, danmaku_data)
                    logger.info(f"弹幕: {danmaku_data['content']}")

                elif msg_type == "heartbeat":
                    # 收到客户端心跳，仅记录日志（实际可用作在线人数统计）
                    pass

                elif msg_type == "ping":
                    # 响应客户端的 ping 请求
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))

            except json.JSONDecodeError:
                logger.warning("收到无效的JSON消息")

    except websockets.exceptions.ConnectionClosed:
        pass


async def broadcast_to_room(room_id: str, message: dict, exclude: WebSocketServerProtocol = None):
    """
    向指定房间内的所有客户端广播消息

    参数：
    - room_id: 房间ID
    - message: 要发送的消息（dict，会被序列化为JSON）
    - exclude: 可选，要排除的WebSocket连接
    """
    if room_id not in rooms:
        return

    message_json = json.dumps(message, ensure_ascii=False)

    # 遍历房间内的所有连接并发送消息
    disconnected = set()
    for client in rooms[room_id]:
        if client == exclude:
            continue
        try:
            await client.send(message_json)
        except Exception as e:
            logger.warning(f"发送消息失败: {e}")
            disconnected.add(client)

    # 清理断开的连接
    for client in disconnected:
        rooms[room_id].discard(client)


async def send_heartbeat(websocket: WebSocketServerProtocol):
    """
    定期向客户端发送心跳包

    心跳机制作用：
    1. 检测连接是否仍然存活
    2. 保持防火墙/负载均衡器的连接活跃
    3. 可用于统计在线人数
    """
    try:
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            # 发送心跳消息
            await websocket.send(json.dumps({
                "type": "heartbeat",
                "timestamp": datetime.now().isoformat()
            }))
    except websockets.exceptions.ConnectionClosed:
        pass


async def cleanup_client(websocket: WebSocketServerProtocol, client_id: str):
    """
    清理客户端资源
    """
    # 从用户字典中移除
    user_info = users.pop(websocket, {})
    room_id = user_info.get("room_id")

    # 从房间中移除
    if room_id and room_id in rooms:
        rooms[room_id].discard(websocket)
        # 如果房间为空，删除房间
        if not rooms[room_id]:
            del rooms[room_id]

    logger.info(f"客户端 {client_id} 已清理，当前在线房间数: {len(rooms)}")


async def main():
    """
    启动 WebSocket 服务器
    """
    logger.info(f"弹幕服务器启动于 ws://{HOST}:{PORT}")
    logger.info("=" * 50)
    logger.info("弹幕系统架构说明：")
    logger.info("1. 客户端连接后需先认证 (type: auth)")
    logger.info("2. 认证通过后加入房间 (room_id)")
    logger.info("3. 客户端发送弹幕 (type: danmaku)")
    logger.info("4. 服务器广播弹幕给房间内所有人")
    logger.info("5. 心跳保活间隔: 30秒")
    logger.info("=" * 50)

    # 启动 WebSocket 服务器
    async with websockets.serve(handle_client, HOST, PORT):
        await asyncio.Future()  # 永久运行


if __name__ == "__main__":
    asyncio.run(main())
