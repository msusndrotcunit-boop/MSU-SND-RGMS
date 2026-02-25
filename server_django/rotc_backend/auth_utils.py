import secrets
from functools import wraps
from django.http import JsonResponse

# Simple in-memory admin token store (volatile across restarts)
_ADMIN_TOKENS = set()


def issue_admin_token() -> str:
    token = secrets.token_urlsafe(32)
    _ADMIN_TOKENS.add(token)
    return token


def _extract_bearer_token(request):
    auth = request.META.get("HTTP_AUTHORIZATION") or ""
    if not auth.startswith("Bearer "):
        return None
    return auth.split(" ", 1)[1].strip()


def require_admin(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        token = _extract_bearer_token(request)
        if not token:
            return JsonResponse({"message": "Authorization required"}, status=401)
        if token not in _ADMIN_TOKENS:
            return JsonResponse({"message": "Forbidden: admin privileges required"}, status=403)
        return view_func(request, *args, **kwargs)

    return _wrapped


def require_auth(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        # Minimal check: require presence of Bearer token
        token = _extract_bearer_token(request)
        if not token:
            return JsonResponse({"message": "Authorization required"}, status=401)
        return view_func(request, *args, **kwargs)

    return _wrapped

