"""
Real-time notification bus via WebSocket.

Bridges Mashora's PostgreSQL NOTIFY/LISTEN system to WebSocket clients.
Used for: record locking, chatter live updates, notification toasts.
"""
import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.core.orm_adapter import mashora_env
from app.middleware.auth import get_current_user, CurrentUser

router = APIRouter(tags=["bus"])

_logger = logging.getLogger(__name__)

# Connected WebSocket clients: {channel: set of websockets}
_connections: dict[str, set[WebSocket]] = {}


class ConnectionManager:
    """Manages WebSocket connections and channel subscriptions."""

    def __init__(self):
        self.active: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channels: list[str]):
        await websocket.accept()
        for channel in channels:
            if channel not in self.active:
                self.active[channel] = set()
            self.active[channel].add(websocket)

    def disconnect(self, websocket: WebSocket):
        for channel_sockets in self.active.values():
            channel_sockets.discard(websocket)

    async def broadcast(self, channel: str, message: dict):
        if channel in self.active:
            dead = set()
            for ws in self.active[channel]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.active[channel].discard(ws)

    @property
    def connection_count(self) -> int:
        return sum(len(s) for s in self.active.values())


manager = ConnectionManager()


@router.websocket("/ws/bus")
async def websocket_bus(websocket: WebSocket):
    """
    WebSocket endpoint for real-time notifications.

    Client sends: {"subscribe": ["channel1", "channel2"]}
    Server sends: {"channel": "channel1", "type": "notification", "payload": {...}}
    """
    channels: list[str] = []
    try:
        await websocket.accept()

        # Wait for subscription message
        data = await websocket.receive_json()
        channels = data.get("subscribe", [])
        if not channels:
            channels = ["mashora_erp"]

        for ch in channels:
            if ch not in manager.active:
                manager.active[ch] = set()
            manager.active[ch].add(websocket)

        _logger.info("WebSocket connected, channels: %s", channels)

        # Send confirmation
        await websocket.send_json({
            "type": "subscribed",
            "channels": channels,
        })

        # Keep alive loop — listen for client messages
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=30)
                # Handle ping
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                # Handle additional subscriptions
                elif msg.get("subscribe"):
                    new_channels = msg["subscribe"]
                    for ch in new_channels:
                        if ch not in manager.active:
                            manager.active[ch] = set()
                        manager.active[ch].add(websocket)
                        channels.append(ch)
            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break

    except WebSocketDisconnect:
        _logger.info("WebSocket disconnected")
    except Exception as e:
        _logger.warning("WebSocket error: %s", e)
    finally:
        manager.disconnect(websocket)


@router.post("/bus/notify")
async def send_notification(channel: str, message: dict[str, Any], user: CurrentUser = Depends(get_current_user)):
    """
    Send a notification to all WebSocket clients on a channel.
    Used internally by backend services.
    """
    await manager.broadcast(channel, {
        "channel": channel,
        "type": "notification",
        "payload": message,
    })
    return {"sent": True, "channel": channel, "connections": manager.connection_count}


@router.get("/bus/status")
async def bus_status():
    """Get WebSocket bus status."""
    return {
        "connections": manager.connection_count,
        "channels": {ch: len(sockets) for ch, sockets in manager.active.items()},
    }
