import json
import os
import secrets

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

