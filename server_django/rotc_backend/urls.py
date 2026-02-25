from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, re_path
from django.views.generic import TemplateView
from django.db import connections
from django.db.utils import OperationalError
from django.utils.timezone import now

from . import auth_views, api_views


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
    path("health", health_view),
    path("api/auth/cadet-login", api_views.auth_cadet_login_view),
    path("api/auth/staff-login-no-pass", api_views.auth_staff_login_no_pass_view),
    path("api/auth/login", auth_views.admin_login_view),
    path("api/auth/heartbeat", auth_views.heartbeat_view),
    path("api/auth/settings", auth_views.settings_view),
    path("api/auth/location", api_views.auth_location_view),
    path("api/admin/system-status", auth_views.system_status_view),
    path("api/admin/export/<str:export_type>", api_views.admin_export_view),
    path("api/admin/analytics", api_views.admin_analytics_overview_view),
    path("api/admin/analytics/demographics", api_views.admin_analytics_demographics_view),
    path("api/admin/profile", api_views.admin_profile_view),
    path("api/admin/cadets", api_views.admin_cadets_collection_view),
    path("api/admin/cadets/<int:cadet_id>", api_views.admin_cadets_update_view),
    path("api/admin/cadets/archived", api_views.admin_cadets_archived_list_view),
    path("api/admin/cadets/export-completed", api_views.admin_cadets_export_completed_view),
    path("api/admin/cadets/prune-completed", api_views.admin_cadets_prune_completed_view),
    path("api/admin/cadets/delete", api_views.admin_cadets_bulk_delete_view),
    path("api/admin/cadets/restore", api_views.admin_cadets_bulk_restore_view),
    path("api/admin/cadets/unlock", api_views.admin_cadets_bulk_unlock_view),
    path("api/admin/import-cadets", api_views.admin_import_cadets_view),
    path("api/admin/import-staff", api_views.admin_import_staff_view),
    path("api/admin/notifications", api_views.admin_notifications_list_view),
    path("api/admin/notifications/clear", api_views.admin_notifications_clear_view),
    path("api/notifications/<int:notification_id>", api_views.admin_notifications_clear_view),
    path("api/staff", api_views.staff_collection_view),
    path("api/staff/list", api_views.staff_list_overview_view),
    path("api/staff/me", api_views.staff_me_view),
    path("api/staff/profile", api_views.staff_me_view),
    path("api/staff/profile/photo", api_views.staff_profile_photo_view),
    path("api/staff/analytics/overview", api_views.staff_analytics_overview_view),
    path("api/staff/<int:staff_id>", api_views.staff_detail_view),
    path("api/cadet/profile", api_views.cadet_profile_view),
    path("api/messages", api_views.messages_admin_list_view),
    path("api/messages/my", api_views.messages_my_list_view),
    path("api/messages/create", api_views.messages_create_view),
    path("api/messages/<int:message_id>", api_views.messages_delete_view),
    path("api/attendance/events", api_views.attendance_events_view),
    path("api/admin/locations", api_views.admin_locations_view),
    path("api/attendance/days", api_views.attendance_days_list_view),
    path("api/attendance/days/create", api_views.attendance_days_create_view),
    path("api/attendance/days/<int:day_id>", api_views.attendance_days_delete_view),
    path("api/attendance/records/<int:day_id>", api_views.attendance_records_view),
    path("api/attendance/records/staff/<int:day_id>", api_views.attendance_records_staff_view),
    path("api/attendance/my-history", api_views.attendance_my_history_view),
    path("api/attendance/my-history/staff", api_views.attendance_my_history_staff_view),
    path("api/attendance/mark", api_views.attendance_mark_view),
    path("api/attendance/mark/staff", api_views.attendance_mark_staff_view),
    path("api/attendance/import", api_views.attendance_import_view),
    path("api/cadet/my-merit-logs", api_views.cadet_my_merit_logs_view),
    path("api/cadet/my-grades", api_views.cadet_my_grades_view),
    path("api/admin/grades/<int:cadet_id>", api_views.admin_grades_update_view),
    path("api/admin/merit-logs/<int:cadet_id>", api_views.admin_merit_logs_list_view),
    path("api/admin/merit-logs", api_views.admin_merit_logs_create_view),
    path("api/admin/merit-logs/<int:log_id>", api_views.admin_merit_logs_delete_view),
    path("api/attendance/cadet/<int:cadet_id>", api_views.attendance_cadet_history_view),
    path("api/admin/sync-lifetime-merits", api_views.admin_sync_lifetime_merits_view),
    path("api/integration/rotcmis/validate", api_views.integration_rotcmis_validate_view),
    path("api/integration/rotcmis/import", api_views.integration_rotcmis_import_view),
    path("api/integration/grades/import", api_views.integration_grades_import_view),
    path("api/integration/ledger/import", api_views.integration_ledger_import_view),
    path("api/images/admin/<int:admin_id>", api_views.image_admin_view),
    path("api/images/staff/<int:staff_id>", api_views.image_staff_view),
    path("api/images/cadets/<int:cadet_id>", api_views.image_cadet_view),
    path("api/excuse", api_views.excuse_collection_view),
    re_path(
        r"^(?!api/|dj-admin/|static/|media/).*$",
        TemplateView.as_view(template_name="index.html"),
    ),
]
