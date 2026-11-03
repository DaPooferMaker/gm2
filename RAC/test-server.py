import asyncio
import hmac
import io
import json
import os
import ssl
import sys
import time
from collections import deque
from pathlib import Path

from aiohttp import web, WSMsgType
import mss
import pyautogui
from PIL import Image

# ======================================
# CONFIGURATION
# ======================================

BASE_DIR = Path(__file__).resolve().parent

HOST = "0.0.0.0"
PORT = int(os.environ.get("REMOTE_PORT", "8443"))

PASSWORD = os.environ.get("REMOTE_PASSWORD")
if not PASSWORD:
    sys.exit("Set the REMOTE_PASSWORD environment variable first.")

CERT = BASE_DIR / "server.crt"
KEY = BASE_DIR / "server.key"
CLIENT_FILE = BASE_DIR / "remote_client.html"

# Only needed if you open the client page from somewhere other than this
# server (e.g. GitHub Pages). Comma-separated, e.g.
#   ALLOWED_ORIGINS=https://yourname.github.io
ALLOWED_ORIGINS = {
    "https://puffcodewebsite.b-cdn.net",
} | {
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
}

FPS = 10
MAX_FRAME_SIZE = 1280
JPEG_QUALITY = 55

MOVE_LIMIT = 120      # mouse moves per second (extra moves are dropped)
ACTION_LIMIT = 300    # clicks / key presses / scrolls per second
MAX_FAILED_ATTEMPTS = 5
FAILED_WINDOW = 60    # seconds

# FAILSAFE would raise an exception whenever the pointer sits in a screen
# corner, and the remote user could never move out of it. Turned off.
# (Local emergency stop: just stop the server process.)
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0

VALID_KEYS = set(pyautogui.KEYBOARD_KEYS)
VALID_BUTTONS = ("left", "middle", "right")
RELEASE_ACTIONS = {"keyup", "mouseup", "releaseall"}

active_client = None
failed_attempts = {}


# ======================================
# HELPERS
# ======================================

class RateLimiter:
    def __init__(self, limit):
        self.limit = limit
        self.times = deque()

    def allow(self):
        now = time.monotonic()

        while self.times and now - self.times[0] >= 1:
            self.times.popleft()

        if len(self.times) >= self.limit:
            return False

        self.times.append(now)
        return True


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def origin_allowed(request):
    origin = request.headers.get("Origin")

    if not origin:
        return False

    return (
        origin == f"https://{request.host}"
        or origin in ALLOWED_ORIGINS
    )


def release_all(held_keys, held_buttons):
    for key in list(held_keys):
        try:
            pyautogui.keyUp(key)
        except Exception:
            pass

    for button in list(held_buttons):
        try:
            pyautogui.mouseUp(button=button)
        except Exception:
            pass

    held_keys.clear()
    held_buttons.clear()


# ======================================
# SCREEN CAPTURE
# ======================================

def capture_screen():
    with mss.mss() as sct:
        shot = sct.grab(sct.monitors[1])

        image = Image.frombytes("RGB", shot.size, shot.rgb)
        image.thumbnail((MAX_FRAME_SIZE, MAX_FRAME_SIZE))

        output = io.BytesIO()
        image.save(output, format="JPEG", quality=JPEG_QUALITY)

        return output.getvalue()


async def screen_stream(ws):
    while not ws.closed:
        started = time.monotonic()

        data = await asyncio.to_thread(capture_screen)
        await ws.send_bytes(data)

        await asyncio.sleep(
            max(0, (1 / FPS) - (time.monotonic() - started))
        )


# ======================================
# INPUT
# ======================================

def perform(data, held_keys, held_buttons):
    """Runs in a worker thread. Validates and executes one input event."""
    action = data.get("action")

    if action == "move":
        # The client sends positions as fractions (0..1) of the screen, so
        # it doesn't matter that the streamed image is downscaled.
        nx = data.get("nx")
        ny = data.get("ny")

        if not (is_number(nx) and is_number(ny)):
            return

        if not (0 <= nx <= 1 and 0 <= ny <= 1):
            return

        width, height = pyautogui.size()

        pyautogui.moveTo(
            min(int(nx * width), width - 1),
            min(int(ny * height), height - 1)
        )

    elif action == "mousedown":
        button = data.get("button")

        if button in VALID_BUTTONS:
            pyautogui.mouseDown(button=button)
            held_buttons.add(button)

    elif action == "mouseup":
        button = data.get("button")

        if button in VALID_BUTTONS:
            pyautogui.mouseUp(button=button)
            held_buttons.discard(button)

    elif action == "scroll":
        amount = data.get("amount")

        if type(amount) is int:
            pyautogui.scroll(max(-10, min(10, amount)))

    elif action == "keydown":
        key = data.get("key")

        if isinstance(key, str) and key.lower() in VALID_KEYS:
            key = key.lower()
            pyautogui.keyDown(key)
            held_keys.add(key)

    elif action == "keyup":
        key = data.get("key")

        if isinstance(key, str) and key.lower() in VALID_KEYS:
            key = key.lower()
            pyautogui.keyUp(key)
            held_keys.discard(key)

    elif action == "releaseall":
        release_all(held_keys, held_buttons)


async def handle_input(ws, held_keys, held_buttons):
    move_limiter = RateLimiter(MOVE_LIMIT)
    action_limiter = RateLimiter(ACTION_LIMIT)

    async for message in ws:
        if message.type == WSMsgType.ERROR:
            break

        if message.type != WSMsgType.TEXT:
            continue

        try:
            data = json.loads(message.data)
        except ValueError:
            continue

        if not isinstance(data, dict):
            continue

        action = data.get("action")

        # Moves are cheap to drop. Releases (keyup/mouseup) are never
        # dropped, so a flood of mouse moves can't cause stuck keys.
        if action == "move":
            if not move_limiter.allow():
                continue
        elif action not in RELEASE_ACTIONS:
            if not action_limiter.allow():
                continue

        try:
            await asyncio.to_thread(
                perform, data, held_keys, held_buttons
            )
        except Exception:
            continue


# ======================================
# WEBSOCKET
# ======================================

async def websocket_handler(request):
    global active_client

    if not origin_allowed(request):
        return web.Response(status=403)

    ip = request.remote
    now = time.monotonic()

    # Forget old failures so the dict doesn't grow forever.
    for old_ip in list(failed_attempts):
        failed_attempts[old_ip] = [
            t for t in failed_attempts[old_ip]
            if now - t < FAILED_WINDOW
        ]
        if not failed_attempts[old_ip]:
            del failed_attempts[old_ip]

    attempts = failed_attempts.get(ip, [])

    if len(attempts) >= MAX_FAILED_ATTEMPTS:
        return web.Response(status=429)

    if active_client is not None:
        return web.Response(status=409)

    ws = web.WebSocketResponse(
        max_msg_size=2048,
        heartbeat=30
    )

    await ws.prepare(request)

    held_keys = set()
    held_buttons = set()
    owns_slot = False

    try:
        # First message MUST authenticate.
        password_ok = False

        try:
            message = await asyncio.wait_for(ws.receive(), timeout=10)
        except asyncio.TimeoutError:
            message = None

        if message is not None and message.type == WSMsgType.TEXT:
            try:
                auth = json.loads(message.data)
            except ValueError:
                auth = None

            if isinstance(auth, dict):
                supplied = auth.get("password")

                if isinstance(supplied, str):
                    # Compare as bytes: compare_digest raises TypeError
                    # on non-ASCII str.
                    password_ok = hmac.compare_digest(
                        supplied.encode("utf-8"),
                        PASSWORD.encode("utf-8")
                    )

        if not password_ok:
            failed_attempts[ip] = attempts + [time.monotonic()]
            return ws

        # Re-check: someone else may have connected while we waited.
        if active_client is not None:
            return ws

        active_client = ws
        owns_slot = True

        await ws.send_json({"status": "authenticated"})

        sender = asyncio.create_task(screen_stream(ws))
        receiver = asyncio.create_task(
            handle_input(ws, held_keys, held_buttons)
        )

        done, pending = await asyncio.wait(
            [sender, receiver],
            return_when=asyncio.FIRST_COMPLETED
        )

        for task in pending:
            task.cancel()

        await asyncio.gather(
            *done, *pending,
            return_exceptions=True
        )

    except Exception:
        pass

    finally:
        if owns_slot and active_client is ws:
            active_client = None

        # Never leave keys or mouse buttons held after a disconnect.
        release_all(held_keys, held_buttons)

        await ws.close()

    return ws


async def index(request):
    return web.FileResponse(CLIENT_FILE)


app = web.Application(client_max_size=2048)

app.router.add_get("/", index)
app.router.add_get("/ws", websocket_handler)


if __name__ == "__main__":
    for path in (CERT, KEY, CLIENT_FILE):
        if not path.exists():
            sys.exit(f"Missing file: {path}")

    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
    ssl_context.load_cert_chain(str(CERT), str(KEY))

    print(f"Remote desktop server: https://{HOST}:{PORT}")

    web.run_app(
        app,
        host=HOST,
        port=PORT,
        ssl_context=ssl_context
    )