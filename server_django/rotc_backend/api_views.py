import base64
import csv
import json
from datetime import datetime

from django.http import HttpResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from openpyxl import load_workbook

from rgms.models import Cadet, MeritDemeritLog, TrainingStaff, AdminProfile


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
        "profile_pic": cadet.profile_pic.url if cadet.profile_pic else None,
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


def parse_date(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
    return None


def build_cadet_payload(data):
    return {
        "rank": data.get("rank", ""),
        "first_name": data.get("firstName") or data.get("first_name", ""),
        "middle_name": data.get("middleName") or data.get("middle_name", ""),
        "last_name": data.get("lastName") or data.get("last_name", ""),
        "suffix_name": data.get("suffixName") or data.get("suffix_name", ""),
        "student_id": data.get("studentId") or data.get("student_id", ""),
        "email": data.get("email", ""),
        "username": data.get("username", ""),
        "contact_number": data.get("contactNumber") or data.get("contact_number", ""),
        "address": data.get("address", ""),
        "gender": data.get("gender", ""),
        "religion": data.get("religion", ""),
        "birthdate": parse_date(data.get("birthdate")),
        "course": data.get("course", ""),
        "year_level": data.get("yearLevel") or data.get("year_level", ""),
        "school_year": data.get("schoolYear") or data.get("school_year", ""),
        "battalion": data.get("battalion", ""),
        "company": data.get("company", ""),
        "platoon": data.get("platoon", ""),
        "cadet_course": data.get("cadetCourse") or data.get("cadet_course", ""),
        "semester": data.get("semester", ""),
        "corp_position": data.get("corpPosition") or data.get("corp_position", ""),
        "status": data.get("status", "Ongoing"),
    }


def find_column_value(row, candidates):
    if not row:
        return None
    normalized_candidates = [
        c.strip().lower().replace(" ", "").replace("_", "").replace("-", "") for c in candidates
    ]
    for key, value in row.items():
        if value is None or value == "":
            continue
        norm_key = str(key).strip().lower().replace(" ", "").replace("_", "").replace("-", "")
        for cand in normalized_candidates:
            if norm_key == cand:
                return value
    return None


def load_rows_from_upload(uploaded_file):
    name = (uploaded_file.name or "").lower()
    if name.endswith(".csv"):
        decoded = uploaded_file.read().decode("utf-8", errors="ignore")
        reader = csv.DictReader(decoded.splitlines())
        return [dict(row) for row in reader]
    if name.endswith(".xlsx") or name.endswith(".xls"):
        wb = load_workbook(uploaded_file, read_only=True, data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h).strip() if h is not None else "" for h in rows[0]]
        data_rows = []
        for row in rows[1:]:
            if all(cell is None or str(cell).strip() == "" for cell in row):
                continue
            item = {}
            for idx, header in enumerate(headers):
                if not header:
                    continue
                item[header] = row[idx] if idx < len(row) else None
            data_rows.append(item)
        return data_rows
    raise ValueError("Unsupported file type. Please upload CSV or Excel (.xlsx) file.")


@csrf_exempt
@require_http_methods(["GET", "PUT"])
def admin_profile_view(request):
    admin_profile, _ = AdminProfile.objects.get_or_create(username="admin")

    if request.method == "GET":
        return JsonResponse(
            {
                "id": admin_profile.id,
                "username": admin_profile.username,
                "first_name": admin_profile.first_name,
                "last_name": admin_profile.last_name,
                "email": admin_profile.email,
                "profile_pic": admin_profile.profile_pic.url if admin_profile.profile_pic else None,
                "role": "admin",
                "profile_completed": True,
            }
        )

    if request.method == "PUT":
        # Handle profile picture upload
        profile_pic = request.FILES.get("profilePic")
        if profile_pic:
            # Basic validation
            allowed_types = ["image/jpeg", "image/png", "image/gif"]
            if profile_pic.content_type not in allowed_types:
                return JsonResponse({"message": "Invalid file type. Only JPG, PNG, and GIF are allowed."}, status=400)
            
            if profile_pic.size > 5 * 1024 * 1024:
                return JsonResponse({"message": "File size exceeds 5MB limit."}, status=400)

            admin_profile.profile_pic = profile_pic
            admin_profile.save()
            
            return JsonResponse({
                "message": "Profile picture updated successfully",
                "profile_pic": admin_profile.profile_pic.url
            })
        
        return JsonResponse({"message": "No profile picture provided"}, status=400)


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
@require_http_methods(["GET", "POST"])
def admin_cadets_collection_view(request):
    if request.method == "GET":
        return admin_cadets_list_view(request)
    return admin_cadets_create_view(request)


@csrf_exempt
@require_http_methods(["POST"])
def admin_cadets_create_view(request):
    if request.content_type and "application/json" in request.content_type:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    else:
        payload = request.POST
    cadet_data = build_cadet_payload(payload)
    if not cadet_data.get("student_id"):
        return JsonResponse({"message": "studentId is required"}, status=400)
    cadet, created = Cadet.objects.get_or_create(
        student_id=cadet_data["student_id"], defaults=cadet_data
    )
    if not created:
        for key, value in cadet_data.items():
            setattr(cadet, key, value)
        cadet.save()
    return JsonResponse(cadet_to_dict(cadet), status=201 if created else 200)


@csrf_exempt
@require_http_methods(["PUT"])
def admin_cadets_update_view(request, cadet_id):
    try:
        cadet = Cadet.objects.get(id=cadet_id)
    except Cadet.DoesNotExist:
        return JsonResponse({"message": "Cadet not found"}, status=404)
    if request.content_type and "application/json" in request.content_type:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    else:
        payload = request.POST
    cadet_data = build_cadet_payload(payload)
    for key, value in cadet_data.items():
        setattr(cadet, key, value)
    cadet.save()
    return JsonResponse(cadet_to_dict(cadet))


@csrf_exempt
@require_http_methods(["POST"])
def admin_cadets_bulk_delete_view(request):
    payload = json.loads(request.body.decode("utf-8") or "{}")
    ids = payload.get("ids") or []
    Cadet.objects.filter(id__in=ids).update(status="Completed")
    return JsonResponse({"deleted_ids": ids})


@csrf_exempt
@require_http_methods(["POST"])
def admin_cadets_bulk_restore_view(request):
    payload = json.loads(request.body.decode("utf-8") or "{}")
    ids = payload.get("ids") or []
    Cadet.objects.filter(id__in=ids).update(status="Ongoing")
    return JsonResponse({"restored_ids": ids})


@csrf_exempt
@require_http_methods(["POST"])
def admin_cadets_bulk_unlock_view(request):
    payload = json.loads(request.body.decode("utf-8") or "{}")
    ids = payload.get("ids") or []
    Cadet.objects.filter(id__in=ids).update(is_profile_completed=False)
    return JsonResponse({"unlocked_ids": ids})


@csrf_exempt
@require_http_methods(["POST"])
def admin_import_cadets_view(request):
    uploaded = request.FILES.get("file")
    if not uploaded:
        return JsonResponse({"message": "No file uploaded"}, status=400)
    try:
        rows = load_rows_from_upload(uploaded)
    except ValueError as exc:
        return JsonResponse({"message": str(exc)}, status=400)

    imported = 0
    updated = 0
    skipped = 0
    errors = []

    for row in rows:
        try:
            custom_username = find_column_value(row, ["Username", "User Name", "username"])
            email = find_column_value(row, ["Email", "E-mail", "Email Address", "email"])
            first_name = find_column_value(row, ["First Name", "first_name", "FName", "Given Name"])
            last_name = find_column_value(row, ["Last Name", "last_name", "LName", "Surname"])
            middle_name = (
                find_column_value(row, ["Middle Name", "middle_name", "MName", "Middle Initial"]) or ""
            )
            rank = find_column_value(row, ["Rank", "rank", "Grade"]) or "Cdt"
            raw_student_id = find_column_value(
                row, ["Student ID", "student_id", "ID", "Student Number", "USN"]
            )

            if not first_name or not last_name:
                full_name = find_column_value(
                    row, ["Name", "name", "Full Name", "Cadet Name"]
                )
                if full_name:
                    parts = str(full_name).split(",")
                    if len(parts) >= 2:
                        last_name = parts[0].strip()
                        rest = parts[1].strip().split(" ")
                        first_name = rest[0]
                        middle_name = " ".join(rest[1:]) if len(rest) > 1 else middle_name
                    else:
                        space_parts = str(full_name).split(" ")
                        if len(space_parts) >= 2:
                            last_name = space_parts[-1]
                            first_name = " ".join(space_parts[:-1])
                        else:
                            first_name = full_name
                            last_name = last_name or "Unknown"

            student_id = raw_student_id or custom_username or email
            if not student_id and first_name:
                base = str(first_name).strip().lower()
                base = "".join(ch for ch in base if ch.isalnum())
                student_id = f"{base}{Cadet.objects.count()+1}"

            if not student_id:
                skipped += 1
                errors.append(
                    "Could not determine identity (Missing Student ID, Username, Email, or Name)"
                )
                continue

            cadet_defaults = {
                "last_name": last_name or "Cadet",
                "first_name": first_name or "Unknown",
                "middle_name": middle_name,
                "suffix_name": "",
                "rank": rank,
                "email": email or "",
                "contact_number": "",
                "address": "",
                "course": "",
                "year_level": "",
                "school_year": "",
                "battalion": "",
                "company": "",
                "platoon": "",
                "cadet_course": "",
                "semester": "",
            }

            cadet, created = Cadet.objects.get_or_create(
                student_id=str(student_id), defaults=cadet_defaults
            )
            if not created:
                for key, value in cadet_defaults.items():
                    setattr(cadet, key, value)
                cadet.save()
                updated += 1
            else:
                imported += 1
        except Exception as exc:
            skipped += 1
            errors.append(str(exc))

    return JsonResponse(
        {
            "imported": imported,
            "updated": updated,
            "skipped": skipped,
            "errors": errors[:10],
            "message": f"Import complete. Success: {imported + updated}, Failed: {skipped}",
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
    staff = TrainingStaff.objects.filter(is_archived=False).order_by("last_name", "first_name")
    data = [
        {
            "id": s.id,
            "rank": s.rank,
            "first_name": s.first_name,
            "middle_name": s.middle_name,
            "last_name": s.last_name,
            "suffix_name": s.suffix_name,
            "email": s.email,
            "contact_number": s.contact_number,
            "role": s.role,
            "profile_pic": s.profile_pic.url if s.profile_pic else None,
            "is_profile_completed": s.is_profile_completed,
            "is_archived": s.is_archived,
        }
        for s in staff
    ]
    return JsonResponse(data, safe=False)


@csrf_exempt
@require_http_methods(["GET", "PUT"])
def cadet_profile_view(request):
    # In a real app, we'd get the cadet from the authenticated user
    # For now, we'll use the first cadet or a mock
    cadet = Cadet.objects.first()
    if not cadet:
        return JsonResponse({"message": "No cadet found"}, status=404)

    if request.method == "GET":
        return JsonResponse(cadet_to_dict(cadet))

    if request.method == "PUT":
        if request.content_type and "application/json" in request.content_type:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        else:
            payload = request.POST
        
        # Handle file upload if present
        profile_pic = request.FILES.get("profilePic")
        if profile_pic:
            cadet.profile_pic = profile_pic

        # Update other fields
        for key in payload:
            if hasattr(cadet, key):
                setattr(cadet, key, payload[key])
        
        cadet.save()
        return JsonResponse(cadet_to_dict(cadet))


@csrf_exempt
@require_http_methods(["GET", "PUT"])
def staff_me_view(request):
    staff = TrainingStaff.objects.first()
    if not staff:
        return JsonResponse({"message": "No staff found"}, status=404)

    if request.method == "GET":
        return JsonResponse({
            "id": staff.id,
            "first_name": staff.first_name,
            "last_name": staff.last_name,
            "rank": staff.rank,
            "role": staff.role,
            "profile_pic": staff.profile_pic.url if staff.profile_pic else None,
            "is_profile_completed": staff.is_profile_completed,
            "email": staff.email,
        })

    if request.method == "PUT":
        payload = json.loads(request.body.decode("utf-8") or "{}")
        for key in payload:
            if hasattr(staff, key):
                setattr(staff, key, payload[key])
        staff.save()
        return JsonResponse({"updated": True})


@csrf_exempt
@require_http_methods(["POST"])
def staff_profile_photo_view(request):
    staff = TrainingStaff.objects.first()
    if not staff:
        return JsonResponse({"message": "No staff found"}, status=404)
    
    uploaded = request.FILES.get("image")
    if not uploaded:
        return JsonResponse({"message": "No image provided"}, status=400)
    
    staff.profile_pic = uploaded
    staff.save()
    
    return JsonResponse({
        "message": "Photo updated",
        "filePath": staff.profile_pic.url
    })


@require_http_methods(["GET"])
def staff_list_overview_view(request):
    return staff_list_view(request)


@require_http_methods(["GET"])
def staff_analytics_overview_view(request):
    return JsonResponse(
        {
            "totals": {},
            "trends": [],
        }
    )


@csrf_exempt
def staff_collection_view(request):
    if request.method == "GET":
        return staff_list_view(request)
    if request.method == "POST":
        return staff_create_view(request)
    return JsonResponse({"message": "Method not allowed"}, status=405)


@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def staff_detail_view(request, staff_id):
    if request.method == "PUT":
        return staff_update_view(request, staff_id)
    return staff_delete_view(request, staff_id)


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
    uploaded = request.FILES.get("file")
    if not uploaded:
        return JsonResponse({"message": "No file uploaded"}, status=400)
    try:
        rows = load_rows_from_upload(uploaded)
    except ValueError as exc:
        return JsonResponse({"message": str(exc)}, status=400)

    imported = 0
    updated = 0
    skipped = 0
    errors = []

    for row in rows:
        try:
            email = find_column_value(row, ["Email", "email", "E-mail"])
            first_name = find_column_value(row, ["First Name", "first_name", "FName"])
            last_name = find_column_value(row, ["Last Name", "last_name", "LName"])
            middle_name = (
                find_column_value(row, ["Middle Name", "middle_name", "MName"]) or ""
            )

            if not first_name or not last_name:
                full_name = find_column_value(
                    row, ["Name", "name", "Full Name", "Staff Name"]
                )
                if full_name:
                    parts = str(full_name).split(" ")
                    if len(parts) >= 2:
                        first_name = " ".join(parts[:-1])
                        last_name = parts[-1]

            if not first_name or not last_name:
                skipped += 1
                errors.append("Missing staff first/last name")
                continue

            rank = find_column_value(row, ["Rank", "rank"]) or ""
            contact_number = find_column_value(
                row, ["Contact Number", "Phone", "contact_number"]
            ) or ""
            role = find_column_value(row, ["Role", "role", "Position"]) or "Instructor"

            staff_defaults = {
                "rank": rank,
                "first_name": first_name,
                "middle_name": middle_name,
                "last_name": last_name,
                "suffix_name": "",
                "email": email or "",
                "contact_number": contact_number,
                "role": role,
            }

            lookup_email = staff_defaults["email"] or None

            if lookup_email:
                staff, created = TrainingStaff.objects.get_or_create(
                    email=lookup_email, defaults=staff_defaults
                )
            else:
                staff, created = TrainingStaff.objects.get_or_create(
                    first_name=first_name,
                    last_name=last_name,
                    rank=rank,
                    defaults=staff_defaults,
                )

            if not created:
                for key, value in staff_defaults.items():
                    setattr(staff, key, value)
                staff.save()
                updated += 1
            else:
                imported += 1
        except Exception as exc:
            skipped += 1
            errors.append(str(exc))

    return JsonResponse(
        {
            "imported": imported,
            "updated": updated,
            "skipped": skipped,
            "errors": errors[:10],
            "message": f"Import complete. Success: {imported + updated}, Failed: {skipped}",
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def staff_create_view(request):
    if request.content_type and "application/json" in request.content_type:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    else:
        payload = request.POST
    staff = TrainingStaff.objects.create(
        rank=payload.get("rank", ""),
        first_name=payload.get("first_name", ""),
        middle_name=payload.get("middle_name", ""),
        last_name=payload.get("last_name", ""),
        suffix_name=payload.get("suffix_name", ""),
        email=payload.get("email", ""),
        contact_number=payload.get("contact_number", ""),
        role=payload.get("role", "Instructor"),
    )
    return JsonResponse({"created": True, "id": staff.id})


@csrf_exempt
@require_http_methods(["PUT"])
def staff_update_view(request, staff_id):
    try:
        staff = TrainingStaff.objects.get(id=staff_id)
    except TrainingStaff.DoesNotExist:
        return JsonResponse({"message": "Staff not found"}, status=404)
    if request.content_type and "application/json" in request.content_type:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    else:
        payload = request.POST
    staff.rank = payload.get("rank", staff.rank)
    staff.first_name = payload.get("first_name", staff.first_name)
    staff.middle_name = payload.get("middle_name", staff.middle_name)
    staff.last_name = payload.get("last_name", staff.last_name)
    staff.suffix_name = payload.get("suffix_name", staff.suffix_name)
    staff.email = payload.get("email", staff.email)
    staff.contact_number = payload.get("contact_number", staff.contact_number)
    staff.role = payload.get("role", staff.role)
    staff.save()
    return JsonResponse({"updated": True, "id": staff.id})


@csrf_exempt
@require_http_methods(["DELETE"])
def staff_delete_view(request, staff_id):
    try:
        staff = TrainingStaff.objects.get(id=staff_id)
    except TrainingStaff.DoesNotExist:
        return JsonResponse({"message": "Staff not found"}, status=404)
    staff.is_archived = True
    staff.save()
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
    try:
        admin_profile = AdminProfile.objects.get(id=admin_id)
        if admin_profile.profile_pic:
            from django.shortcuts import redirect
            return redirect(admin_profile.profile_pic.url)
    except AdminProfile.DoesNotExist:
        pass
    return transparent_png_response()


@require_http_methods(["GET"])
def image_staff_view(request, staff_id):
    try:
        staff = TrainingStaff.objects.get(id=staff_id)
        if staff.profile_pic:
            from django.shortcuts import redirect
            return redirect(staff.profile_pic.url)
    except TrainingStaff.DoesNotExist:
        pass
    return transparent_png_response()


@require_http_methods(["GET"])
def image_cadet_view(request, cadet_id):
    try:
        cadet = Cadet.objects.get(id=cadet_id)
        if cadet.profile_pic:
            from django.shortcuts import redirect
            return redirect(cadet.profile_pic.url)
    except Cadet.DoesNotExist:
        pass
    return transparent_png_response()

