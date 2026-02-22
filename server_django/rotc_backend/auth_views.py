import json
import os
import secrets
import time

from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods


ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")


@csrf_exempt
@require_http_methods(["POST"])
def admin_login_view(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"message": "Invalid JSON payload"}, status=400)

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        return JsonResponse(
            {"message": "Admin credentials are not configured on the server."},
            status=500,
        )

    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        return JsonResponse({"message": "Invalid username or password."}, status=401)

    token = secrets.token_urlsafe(32)

    return JsonResponse(
        {
            "token": token,
            "role": "admin",
            "cadetId": None,
            "staffId": None,
            "isProfileCompleted": True,
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def heartbeat_view(request):
    return JsonResponse({"status": "ok", "time": now().isoformat()})


@require_http_methods(["GET"])
def settings_view(request):
    return JsonResponse(
        {
            "email_alerts": True,
            "push_notifications": True,
            "activity_updates": True,
            "dark_mode": False,
            "compact_mode": False,
            "primary_color": "default",
            "custom_bg": None,
        }
    )


@require_http_methods(["GET"])
def system_status_view(request):
    started = time.monotonic()
    db_info = {
        "type": "Unknown",
        "status": "error",
        "latencyMs": None,
        "error": None,
    }
    metrics = {
        "cadets": None,
        "users": None,
        "trainingDays": None,
        "activities": None,
        "unreadNotifications": None,
    }

    conn = connections["default"]
    engine = conn.settings_dict.get("ENGINE", "")
    if "postgresql" in engine:
        db_info["type"] = "PostgreSQL"
    elif "sqlite" in engine:
        db_info["type"] = "SQLite"
    elif engine:
        db_info["type"] = engine

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        latency_ms = (time.monotonic() - started) * 1000
        db_info["status"] = "ok"
        db_info["latencyMs"] = round(latency_ms, 2)
    except OperationalError as exc:
        db_info["status"] = "error"
        db_info["error"] = str(exc)

    return JsonResponse({"database": db_info, "metrics": metrics})

