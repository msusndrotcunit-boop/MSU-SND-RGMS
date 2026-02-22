from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, re_path
from django.views.generic import TemplateView
from django.db import connections
from django.db.utils import OperationalError
from django.utils.timezone import now


def health_view(request):
    db_ok = True
    try:
        connections["default"].cursor()
    except OperationalError:
        db_ok = False
    return JsonResponse(
        {
            "status": "ok" if db_ok else "degraded",
            "time": now().isoformat(),
            "database": db_ok,
        }
    )


urlpatterns = [
    path("dj-admin/", admin.site.urls),
    path("api/health", health_view),
    re_path(
        r"^(?!api/|dj-admin/|static/|media/).*$",
        TemplateView.as_view(template_name="index.html"),
    ),
]
