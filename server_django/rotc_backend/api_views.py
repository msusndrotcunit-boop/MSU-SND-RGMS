import base64
import json

from django.http import HttpResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from rgms.models import Cadet, MeritDemeritLog


def transmute_grade(value):
    if value >= 95:
        return "1.00"
    if value >= 90:
        return "1.50"
    if value >= 85:
        return "2.00"
    if value >= 80:
        return "2.50"
    if value >= 75:
        return "3.00"
    return "5.00"


def compute_cadet_grades(cadet):
    if cadet.attendance_total > 0:
        attendance_score = (cadet.attendance_present / cadet.attendance_total) * 30
    else:
        attendance_score = 0
    base_aptitude = 100 + cadet.merit_points - cadet.demerit_points
    if base_aptitude < 0:
        base_aptitude = 0
    if base_aptitude > 100:
        base_aptitude = 100
    aptitude_score = base_aptitude * 0.3
    subject_score = (
        (cadet.prelim_score + cadet.midterm_score + cadet.final_score) / 300
    ) * 40
    final_grade = attendance_score + aptitude_score + subject_score
    cadet.attendance_score = attendance_score
    cadet.aptitude_score = aptitude_score
    cadet.subject_score = subject_score
    cadet.final_grade = final_grade
    cadet.transmuted_grade = transmute_grade(final_grade)


def transparent_png_response():
    data = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII="
    )
    return HttpResponse(data, content_type="image/png")


def cadet_to_dict(cadet):
    return {
        "id": cadet.id,
        "student_id": cadet.student_id,
        "first_name": cadet.first_name,
        "last_name": cadet.last_name,
        "middle_name": cadet.middle_name,
        "suffix_name": cadet.suffix_name,
        "rank": cadet.rank,
        "email": cadet.email,
        "username": cadet.username,
        "contact_number": cadet.contact_number,
        "address": cadet.address,
        "gender": cadet.gender,
        "religion": cadet.religion,
        "birthdate": cadet.birthdate.isoformat() if cadet.birthdate else None,
        "course": cadet.course,
        "year_level": cadet.year_level,
        "school_year": cadet.school_year,
        "battalion": cadet.battalion,
        "company": cadet.company,
        "platoon": cadet.platoon,
        "cadet_course": cadet.cadet_course,
        "semester": cadet.semester,
        "corp_position": cadet.corp_position,
        "status": cadet.status,
        "is_profile_completed": cadet.is_profile_completed,
        "profile_pic": cadet.profile_pic,
        "attendance_present": cadet.attendance_present,
        "attendance_total": cadet.attendance_total,
        "attendanceScore": cadet.attendance_score,
        "merit_points": cadet.merit_points,
        "demerit_points": cadet.demerit_points,
        "aptitudeScore": cadet.aptitude_score,
        "prelim_score": cadet.prelim_score,
        "midterm_score": cadet.midterm_score,
        "final_score": cadet.final_score,
        "subjectScore": cadet.subject_score,
        "finalGrade": cadet.final_grade,
        "transmutedGrade": cadet.transmuted_grade,
        "grade_status": cadet.grade_status,
        "grade_remarks": cadet.grade_remarks,
    }


@require_http_methods(["GET"])
def admin_profile_view(request):
    return JsonResponse(
        {
            "id": 1,
            "username": "admin",
            "first_name": "System",
            "last_name": "Administrator",
            "email": "",
            "role": "admin",
            "profile_completed": True,
        }
    )


@require_http_methods(["GET"])
def admin_cadets_list_view(request):
    cadets = Cadet.objects.all().order_by("last_name", "first_name")
    data = [cadet_to_dict(c) for c in cadets]
    return JsonResponse(data, safe=False)


@require_http_methods(["GET"])
def admin_cadets_archived_list_view(request):
    cadets = Cadet.objects.filter(status="Completed").order_by(
        "last_name", "first_name"
    )
    data = [cadet_to_dict(c) for c in cadets]
    return JsonResponse(data, safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def admin_import_cadets_view(request):
    return JsonResponse(
        {
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
        }
    )


@require_http_methods(["GET"])
def admin_notifications_list_view(request):
    return JsonResponse({"notifications": [], "unread_count": 0})


@csrf_exempt
@require_http_methods(["DELETE"])
def admin_notifications_clear_view(request):
    return JsonResponse({"cleared": True})


@require_http_methods(["GET"])
def staff_list_view(request):
    return JsonResponse({"results": [], "count": 0})


@require_http_methods(["GET"])
def staff_me_view(request):
    return JsonResponse(
        {
            "id": None,
            "first_name": "",
            "last_name": "",
            "rank": "",
            "role": "training_staff",
            "profile_pic": None,
            "username": None,
        }
    )


@require_http_methods(["GET"])
def staff_list_overview_view(request):
    return JsonResponse({"results": [], "count": 0})


@require_http_methods(["GET"])
def staff_analytics_overview_view(request):
    return JsonResponse(
        {
            "totals": {},
            "trends": [],
        }
    )


@require_http_methods(["GET"])
def messages_admin_list_view(request):
    return JsonResponse({"messages": []})


@require_http_methods(["GET"])
def messages_my_list_view(request):
    return JsonResponse({"messages": []})


@csrf_exempt
@require_http_methods(["POST"])
def messages_create_view(request):
    return JsonResponse({"created": True})


@csrf_exempt
@require_http_methods(["DELETE"])
def messages_delete_view(request, message_id):
    return JsonResponse({"deleted": True, "id": message_id})


def attendance_events_view(request):
    def event_stream():
        yield "event: heartbeat\n"
        yield 'data: {"status":"ok"}\n\n'

    return StreamingHttpResponse(event_stream(), content_type="text/event-stream")


@csrf_exempt
@require_http_methods(["POST"])
def auth_cadet_login_view(request):
    return JsonResponse(
        {
            "token": "cadet-token",
            "role": "cadet",
            "cadetId": 1,
            "staffId": None,
            "isProfileCompleted": False,
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def auth_staff_login_no_pass_view(request):
    return JsonResponse(
        {
            "token": "staff-token",
            "role": "training_staff",
            "cadetId": None,
            "staffId": 1,
            "isProfileCompleted": False,
        }
    )


@require_http_methods(["GET"])
def admin_analytics_overview_view(request):
    return JsonResponse(
        {
            "summary": {},
            "charts": [],
        }
    )


@require_http_methods(["GET"])
def admin_analytics_demographics_view(request):
    return JsonResponse(
        {
            "segments": [],
            "totals": {},
        }
    )


@require_http_methods(["GET"])
def admin_locations_view(request):
    return JsonResponse({"locations": []})


@require_http_methods(["GET"])
def attendance_days_list_view(request):
    return JsonResponse([], safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def attendance_days_create_view(request):
    return JsonResponse({"created": True})


@csrf_exempt
@require_http_methods(["DELETE"])
def attendance_days_delete_view(request, day_id):
    return JsonResponse({"deleted": True, "id": day_id})


@require_http_methods(["GET"])
def attendance_my_history_view(request):
    return JsonResponse([], safe=False)


@require_http_methods(["GET"])
def attendance_my_history_staff_view(request):
    return JsonResponse([], safe=False)


@require_http_methods(["GET"])
def cadet_my_merit_logs_view(request):
    cadet_id = request.GET.get("cadetId")
    if not cadet_id:
        return JsonResponse({"logs": []})
    logs = MeritDemeritLog.objects.filter(cadet_id=cadet_id).order_by("-created_at")
    data = []
    for log in logs:
        data.append(
            {
                "id": log.id,
                "type": log.type,
                "points": log.points,
                "reason": log.reason,
                "issued_by_name": log.issued_by_name,
                "created_at": log.created_at.isoformat(),
            }
        )
    return JsonResponse(data, safe=False)


@require_http_methods(["GET"])
def cadet_my_grades_view(request):
    cadet_id = request.GET.get("cadetId")
    if not cadet_id:
        return JsonResponse(
            {
                "attendanceScore": 0,
                "attendance_present": 0,
                "aptitudeScore": 0,
                "merit_points": 0,
                "demerit_points": 0,
                "subjectScore": 0,
                "prelim_score": 0,
                "midterm_score": 0,
                "final_score": 0,
                "finalGrade": 0,
                "transmutedGrade": "5.00",
                "remarks": "",
            }
        )
    try:
        cadet = Cadet.objects.get(id=cadet_id)
    except Cadet.DoesNotExist:
        return JsonResponse(
            {
                "attendanceScore": 0,
                "attendance_present": 0,
                "aptitudeScore": 0,
                "merit_points": 0,
                "demerit_points": 0,
                "subjectScore": 0,
                "prelim_score": 0,
                "midterm_score": 0,
                "final_score": 0,
                "finalGrade": 0,
                "transmutedGrade": "5.00",
                "remarks": "",
            }
        )
    return JsonResponse(
        {
            "attendanceScore": cadet.attendance_score,
            "attendance_present": cadet.attendance_present,
            "aptitudeScore": cadet.aptitude_score,
            "merit_points": cadet.merit_points,
            "demerit_points": cadet.demerit_points,
            "subjectScore": cadet.subject_score,
            "prelim_score": cadet.prelim_score,
            "midterm_score": cadet.midterm_score,
            "final_score": cadet.final_score,
            "finalGrade": cadet.final_grade,
            "transmutedGrade": cadet.transmuted_grade,
            "remarks": cadet.grade_remarks,
        }
    )


@require_http_methods(["GET"])
def attendance_records_view(request, day_id):
    return JsonResponse([], safe=False)


@require_http_methods(["GET"])
def attendance_records_staff_view(request, day_id):
    return JsonResponse([], safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def attendance_mark_view(request):
    return JsonResponse({"saved": True})


@csrf_exempt
@require_http_methods(["POST"])
def attendance_mark_staff_view(request):
    return JsonResponse({"saved": True})


@csrf_exempt
@require_http_methods(["POST"])
def attendance_import_view(request):
    return JsonResponse(
        {
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def integration_rotcmis_validate_view(request):
    return JsonResponse(
        {
            "valid": True,
            "issues": [],
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def integration_rotcmis_import_view(request):
    return JsonResponse(
        {
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
        }
    )


@csrf_exempt
@require_http_methods(["PUT"])
def admin_grades_update_view(request, cadet_id):
    try:
        cadet = Cadet.objects.get(id=cadet_id)
    except Cadet.DoesNotExist:
        return JsonResponse({"message": "Cadet not found"}, status=404)
    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        payload = {}
    cadet.prelim_score = float(payload.get("prelimScore", cadet.prelim_score or 0))
    cadet.midterm_score = float(payload.get("midtermScore", cadet.midterm_score or 0))
    cadet.final_score = float(payload.get("finalScore", cadet.final_score or 0))
    cadet.attendance_present = int(
        payload.get("attendancePresent", cadet.attendance_present or 0)
    )
    cadet.merit_points = int(payload.get("meritPoints", cadet.merit_points or 0))
    cadet.demerit_points = int(payload.get("demeritPoints", cadet.demerit_points or 0))
    status = payload.get("status") or ""
    cadet.grade_status = status
    compute_cadet_grades(cadet)
    if status in {"DO", "INC", "T"}:
        cadet.transmuted_grade = "5.00"
        cadet.grade_remarks = "Failed"
    else:
        cadet.grade_remarks = "Passed" if cadet.transmuted_grade != "5.00" else "Failed"
    cadet.save()
    return JsonResponse(cadet_to_dict(cadet))


@require_http_methods(["GET"])
def admin_merit_logs_list_view(request, cadet_id):
    logs = MeritDemeritLog.objects.filter(cadet_id=cadet_id).order_by("-created_at")
    data = []
    for log in logs:
        data.append(
            {
                "id": log.id,
                "type": log.type,
                "points": log.points,
                "reason": log.reason,
                "issued_by_name": log.issued_by_name,
                "created_at": log.created_at.isoformat(),
            }
        )
    return JsonResponse(data, safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def admin_merit_logs_create_view(request):
    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        payload = {}
    cadet_id = payload.get("cadetId")
    if not cadet_id:
        return JsonResponse({"message": "cadetId is required"}, status=400)
    try:
        cadet = Cadet.objects.get(id=cadet_id)
    except Cadet.DoesNotExist:
        return JsonResponse({"message": "Cadet not found"}, status=404)
    log = MeritDemeritLog.objects.create(
        cadet=cadet,
        type=payload.get("type") or "merit",
        points=int(payload.get("points", 0)),
        reason=payload.get("reason") or "",
        issued_by_name=payload.get("issuedByName") or "",
    )
    totals = MeritDemeritLog.objects.filter(cadet=cadet).values("type").order_by()
    merit_total = 0
    demerit_total = 0
    for entry in MeritDemeritLog.objects.filter(cadet=cadet):
        if entry.type == "merit":
            merit_total += entry.points
        else:
            demerit_total += entry.points
    cadet.merit_points = merit_total
    cadet.demerit_points = demerit_total
    compute_cadet_grades(cadet)
    if cadet.grade_status in {"DO", "INC", "T"}:
        cadet.transmuted_grade = "5.00"
        cadet.grade_remarks = "Failed"
    else:
        cadet.grade_remarks = "Passed" if cadet.transmuted_grade != "5.00" else "Failed"
    cadet.save()
    return JsonResponse(
        {
            "id": log.id,
            "cadetId": cadet.id,
            "type": log.type,
            "points": log.points,
            "reason": log.reason,
            "issued_by_name": log.issued_by_name,
        }
    )


@csrf_exempt
@require_http_methods(["DELETE"])
def admin_merit_logs_delete_view(request, log_id):
    try:
        log = MeritDemeritLog.objects.get(id=log_id)
    except MeritDemeritLog.DoesNotExist:
        return JsonResponse({"message": "Log not found"}, status=404)
    cadet = log.cadet
    log.delete()
    merit_total = 0
    demerit_total = 0
    for entry in MeritDemeritLog.objects.filter(cadet=cadet):
        if entry.type == "merit":
            merit_total += entry.points
        else:
            demerit_total += entry.points
    cadet.merit_points = merit_total
    cadet.demerit_points = demerit_total
    compute_cadet_grades(cadet)
    if cadet.grade_status in {"DO", "INC", "T"}:
        cadet.transmuted_grade = "5.00"
        cadet.grade_remarks = "Failed"
    else:
        cadet.grade_remarks = "Passed" if cadet.transmuted_grade != "5.00" else "Failed"
    cadet.save()
    return JsonResponse({"deleted": True, "id": log_id})


@require_http_methods(["GET"])
def attendance_cadet_history_view(request, cadet_id):
    return JsonResponse([], safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def admin_sync_lifetime_merits_view(request):
    cadets = Cadet.objects.all()
    synced = 0
    for cadet in cadets:
        merit_total = 0
        demerit_total = 0
        for entry in MeritDemeritLog.objects.filter(cadet=cadet):
            if entry.type == "merit":
                merit_total += entry.points
            else:
                demerit_total += entry.points
        cadet.merit_points = merit_total
        cadet.demerit_points = demerit_total
        compute_cadet_grades(cadet)
        if cadet.grade_status in {"DO", "INC", "T"}:
            cadet.transmuted_grade = "5.00"
            cadet.grade_remarks = "Failed"
        else:
            cadet.grade_remarks = (
                "Passed" if cadet.transmuted_grade != "5.00" else "Failed"
            )
        cadet.save()
        synced += 1
    return JsonResponse(
        {
            "synced": True,
            "syncedCount": synced,
            "totalCadets": cadets.count(),
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def integration_grades_import_view(request):
    return JsonResponse({"imported": 0, "updated": 0, "skipped": 0, "errors": []})


@csrf_exempt
@require_http_methods(["POST"])
def integration_ledger_import_view(request):
    return JsonResponse({"imported": 0, "updated": 0, "skipped": 0, "errors": []})


@csrf_exempt
@require_http_methods(["POST"])
def admin_import_staff_view(request):
    return JsonResponse(
        {
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def staff_create_view(request):
    return JsonResponse({"created": True, "id": 1})


@csrf_exempt
@require_http_methods(["PUT"])
def staff_update_view(request, staff_id):
    return JsonResponse({"updated": True, "id": staff_id})


@csrf_exempt
@require_http_methods(["DELETE"])
def staff_delete_view(request, staff_id):
    return JsonResponse({"deleted": True, "id": staff_id})


@csrf_exempt
@require_http_methods(["POST"])
def auth_location_view(request):
    return JsonResponse({"saved": True})


@require_http_methods(["GET"])
def admin_cadets_export_completed_view(request):
    return JsonResponse({"message": "no completed cadets", "has_data": False}, status=404)


@csrf_exempt
@require_http_methods(["DELETE"])
def admin_cadets_prune_completed_view(request):
    return JsonResponse({"message": "No completed cadets to delete."})


@require_http_methods(["GET"])
def admin_export_view(request, export_type):
    return JsonResponse(
        {
            "message": "export generated",
            "type": export_type,
        }
    )


@require_http_methods(["GET"])
def image_admin_view(request, admin_id):
    return transparent_png_response()


@require_http_methods(["GET"])
def image_staff_view(request, staff_id):
    return transparent_png_response()


@require_http_methods(["GET"])
def image_cadet_view(request, cadet_id):
    return transparent_png_response()

