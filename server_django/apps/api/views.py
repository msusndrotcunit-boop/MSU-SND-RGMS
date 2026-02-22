import json
import time
import os
from collections import deque
from threading import Event, Thread
from datetime import datetime
from django.http import JsonResponse, StreamingHttpResponse, HttpResponseRedirect, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import render
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework.request import Request
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Cadet, Staff, Attendance, Grade, MeritDemeritLog, UserSettings, Notification
import csv
import io
import requests
import cloudinary
import cloudinary.uploader

EVENT_QUEUE = deque(maxlen=1000)
STOP_EVENT = Event()
CADET_SOURCE_URL_OVERRIDE = None

def add_event(payload):
    EVENT_QUEUE.append({'time': time.time(), **payload})

def sse_stream():
    yield f'data: {json.dumps({"type": "heartbeat", "time": time.time()})}\n\n'
    while not STOP_EVENT.is_set():
        if EVENT_QUEUE:
            item = EVENT_QUEUE.popleft()
            yield f'data: {json.dumps(item)}\n\n'
        else:
            time.sleep(1)

@csrf_exempt
def admin_login(request):
    data = json.loads(request.body.decode() or '{}')
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()
    if not username or not password:
        return JsonResponse({'message': 'Username and password required'}, status=400)
    user = authenticate(username=username, password=password)
    if not user:
        u, created = User.objects.get_or_create(username=username)
        if created:
            u.set_password(password)
            u.save()
        user = authenticate(username=username, password=password)
        if not user:
            return JsonResponse({'message': 'Invalid credentials'}, status=401)
    refresh = RefreshToken.for_user(user)
    refresh['role'] = 'admin'
    access = str(refresh.access_token)
    return JsonResponse({'token': access, 'refresh': str(refresh), 'role': 'admin', 'staffId': None, 'cadetId': None, 'isProfileCompleted': True})

@csrf_exempt
def cadet_login(request):
    data = json.loads(request.body.decode() or '{}')
    identifier = (data.get('identifier') or '').strip()
    if not identifier:
        return JsonResponse({'message': 'Identifier required'}, status=400)
    uname = f'cadet:{identifier}'
    u, _ = User.objects.get_or_create(username=uname)
    refresh = RefreshToken.for_user(u)
    refresh['role'] = 'cadet'
    access = str(refresh.access_token)
    # Ensure cadet record exists
    try:
        from .models import Cadet
        Cadet.objects.get_or_create(student_id=identifier, defaults={'first_name': 'Cadet', 'last_name': identifier[:16], 'course': 'MS1', 'is_profile_completed': False})
    except Exception:
        pass
    return JsonResponse({'token': access, 'refresh': str(refresh), 'role': 'cadet', 'cadetId': 1, 'staffId': None, 'isProfileCompleted': False})

@csrf_exempt
def staff_login(request):
    data = json.loads(request.body.decode() or '{}')
    identifier = (data.get('identifier') or '').strip()
    if not identifier:
        return JsonResponse({'message': 'Staff identifier required'}, status=400)
    uname = f'staff:{identifier}'
    u, _ = User.objects.get_or_create(username=uname)
    refresh = RefreshToken.for_user(u)
    refresh['role'] = 'training_staff'
    access = str(refresh.access_token)
    try:
        from .models import Staff
        Staff.objects.get_or_create(username=identifier, defaults={'rank': '', 'first_name': 'Staff', 'last_name': identifier[:16]})
    except Exception:
        pass
    return JsonResponse({'token': access, 'refresh': str(refresh), 'role': 'training_staff', 'staffId': 1, 'cadetId': None, 'isProfileCompleted': True})

@csrf_exempt
def heartbeat(request):
    return JsonResponse({'ok': True, 'time': datetime.utcnow().isoformat()})

def health(request):
    status = 'ok'
    db = 'unknown'
    try:
        _ = Cadet.objects.exists()
        db = 'connected'
    except Exception:
        db = 'error'
    return JsonResponse({'status': status, 'time': datetime.utcnow().isoformat(), 'db': db})

def cadet_profile(request):
    try:
        u = getattr(request, 'user', None)
        uname = getattr(u, 'username', '') or ''
        if uname.startswith('cadet:'):
            ident = uname.split(':', 1)[1]
            from .models import Cadet
            c = Cadet.objects.filter(student_id=ident).first()
            if c:
                return JsonResponse({'is_profile_completed': 1 if c.is_profile_completed else 0})
    except Exception:
        pass
    return JsonResponse({'is_profile_completed': 0})

def admin_analytics(request):
    data = []
    try:
        cadets = {c.id: c for c in Cadet.objects.all()}
        # Aggregate grade counts by status and cadet course
        for g in Grade.objects.all():
            c = cadets.get(g.cadet_id)
            course = (c.course if c else '')
            data.append({'status': g.status.upper(), 'cadet_course': course, 'count': 1})
        if not data:
            # Fallback sample
            data = [
                {'status': 'ONGOING', 'cadet_course': 'MS1', 'count': 95},
                {'status': 'COMPLETED', 'cadet_course': 'MS1', 'count': 25},
                {'status': 'FAILED', 'cadet_course': 'MS2', 'count': 5}
            ]
    except Exception:
        data = [
            {'status': 'ONGOING', 'cadet_course': 'MS1', 'count': 95},
            {'status': 'COMPLETED', 'cadet_course': 'MS1', 'count': 25},
            {'status': 'FAILED', 'cadet_course': 'MS2', 'count': 5}
        ]
    return JsonResponse({'demographics': {'courseStats': data}})

def admin_system_status(request):
    try:
        cadets_count = Cadet.objects.count()
        users_count = User.objects.count()
        training_days = Attendance.objects.values('day').distinct().count()
        activities = 2
        unread = 0
        return JsonResponse({
            'app': {'status': 'ok', 'time': datetime.utcnow().isoformat()},
            'database': {'status': 'ok'},
            'metrics': {
                'cadets': cadets_count,
                'users': users_count,
                'trainingDays': training_days,
                'activities': activities,
                'unreadNotifications': unread
            }
        })
    except Exception:
        return JsonResponse({
            'app': {'status': 'degraded', 'time': datetime.utcnow().isoformat()},
            'database': {'status': 'error'},
            'metrics': {}
        }, status=500)

@csrf_exempt
def auth_settings(request):
    u = getattr(request, 'user', None)
    if not isinstance(u, User):
        return JsonResponse({'message': 'Unauthorized'}, status=401)
    defaults = {
        'email_alerts': True,
        'push_notifications': True,
        'activity_updates': True,
        'dark_mode': False,
        'compact_mode': False,
        'primary_color': 'default',
        'custom_bg': None,
    }
    if request.method == 'GET':
        obj, _ = UserSettings.objects.get_or_create(user=u, defaults=defaults)
        data = {
            'email_alerts': obj.email_alerts,
            'push_notifications': obj.push_notifications,
            'activity_updates': obj.activity_updates,
            'dark_mode': obj.dark_mode,
            'compact_mode': obj.compact_mode,
            'primary_color': obj.primary_color,
            'custom_bg': obj.custom_bg,
        }
        return JsonResponse(data)
    if request.method == 'PUT':
        try:
            data = json.loads(request.body.decode() or '{}')
        except Exception:
            data = {}
        obj, _ = UserSettings.objects.get_or_create(user=u, defaults=defaults)
        for field in ['email_alerts','push_notifications','activity_updates','dark_mode','compact_mode','primary_color','custom_bg']:
            if field in data:
                setattr(obj, field, data[field])
        obj.save()
        out = {
            'email_alerts': obj.email_alerts,
            'push_notifications': obj.push_notifications,
            'activity_updates': obj.activity_updates,
            'dark_mode': obj.dark_mode,
            'compact_mode': obj.compact_mode,
            'primary_color': obj.primary_color,
            'custom_bg': obj.custom_bg,
        }
        return JsonResponse(out)
    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_exempt
def admin_profile(request):
    u = getattr(request, 'user', None)
    uid = getattr(u, 'id', 1) or 1
    uname = getattr(u, 'username', '') or 'Admin'
    email = getattr(u, 'email', '') or ''
    if request.method in ('GET', 'HEAD'):
        return JsonResponse({'id': uid, 'username': uname, 'email': email, 'profile_pic': None})
    if request.method in ('PUT', 'POST'):
        f = request.FILES.get('profilePic') or request.FILES.get('file')
        if not f:
            return JsonResponse({'message': 'No file'}, status=400)
        cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME') or ''
        api_key = os.environ.get('CLOUDINARY_API_KEY') or ''
        api_secret = os.environ.get('CLOUDINARY_API_SECRET') or ''
        cloudinary_url = os.environ.get('CLOUDINARY_URL') or ''
        use_cloudinary = bool(cloudinary_url or (cloud_name and api_key and api_secret))
        url = None
        if use_cloudinary:
            try:
                if cloudinary_url:
                    cloudinary.config(cloudinary_url=cloudinary_url)
                else:
                    cloudinary.config(
                        cloud_name=cloud_name,
                        api_key=api_key,
                        api_secret=api_secret,
                    )
                folder = os.environ.get('CLOUDINARY_FOLDER', 'rotc-grading-system/profiles')
                result = cloudinary.uploader.upload(
                    f,
                    folder=folder,
                    resource_type='image',
                )
                url = result.get('secure_url') or result.get('url')
            except Exception:
                url = None
        if not url:
            root = settings.MEDIA_ROOT
            os.makedirs(root, exist_ok=True)
            import re, time as _t
            base = re.sub(r'[^A-Za-z0-9._-]', '_', f.name)
            ts = int(_t.time())
            name = f'{ts}_{base[:64]}'
            path = os.path.join(root, name)
            with open(path, 'wb') as dest:
                for chunk in f.chunks():
                    dest.write(chunk)
            url = settings.MEDIA_URL + name
        return JsonResponse({'id': uid, 'username': uname, 'email': email, 'profile_pic': url})
    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_exempt
def admin_notifications(request):
    u = getattr(request, 'user', None)
    if not isinstance(u, User):
        return JsonResponse({'message': 'Unauthorized'}, status=401)
    if request.method == 'GET':
        items = Notification.objects.filter(user=u).order_by('-created_at')[:100]
        data = []
        for n in items:
            data.append({
                'id': n.id,
                'type': n.type,
                'message': n.message,
                'created_at': n.created_at.isoformat(),
            })
        return JsonResponse(data, safe=False)
    if request.method == 'DELETE':
        Notification.objects.filter(user=u).delete()
        return JsonResponse({'message': 'Notifications cleared'})
    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_exempt
def notifications_detail(request, nid):
    u = getattr(request, 'user', None)
    if not isinstance(u, User):
        return JsonResponse({'message': 'Unauthorized'}, status=401)
    if request.method == 'DELETE':
        Notification.objects.filter(user=u, id=nid).delete()
        return JsonResponse({'message': 'Deleted'})
    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_exempt
def messages_root(request):
    u = getattr(request, 'user', None)
    if not isinstance(u, User):
        return JsonResponse({'message': 'Unauthorized'}, status=401)
    if request.method == 'GET':
        return JsonResponse([], safe=False)
    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_exempt
def messages_detail(request, mid):
    u = getattr(request, 'user', None)
    if not isinstance(u, User):
        return JsonResponse({'message': 'Unauthorized'}, status=401)
    if request.method == 'DELETE':
        return JsonResponse({'message': 'Deleted'})
    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_exempt
def messages_my(request):
    u = getattr(request, 'user', None)
    if not isinstance(u, User):
        return JsonResponse({'message': 'Unauthorized'}, status=401)
    if request.method == 'GET':
        return JsonResponse([], safe=False)
    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_exempt
def staff_notifications(request):
    u = getattr(request, 'user', None)
    if not isinstance(u, User):
        return JsonResponse({'message': 'Unauthorized'}, status=401)
    if request.method == 'GET':
        items = Notification.objects.filter(user=u).order_by('-created_at')[:100]
        data = []
        for n in items:
            data.append({
                'id': n.id,
                'type': n.type,
                'message': n.message,
                'created_at': n.created_at.isoformat(),
            })
        return JsonResponse(data, safe=False)
    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_exempt
def staff_notifications_clear(request):
    u = getattr(request, 'user', None)
    if not isinstance(u, User):
        return JsonResponse({'message': 'Unauthorized'}, status=401)
    if request.method == 'DELETE':
        Notification.objects.filter(user=u).delete()
        return JsonResponse({'message': 'Notifications cleared'})
    return JsonResponse({'message': 'Method not allowed'}, status=405)

def _transmute(final_percent):
    if final_percent >= 95:
        return '1.00'
    if final_percent >= 90:
        return '1.50'
    if final_percent >= 85:
        return '2.00'
    if final_percent >= 80:
        return '2.50'
    if final_percent >= 75:
        return '3.00'
    return '5.00'

@csrf_exempt
def compute_grade(request, cadet_id):
    payload = json.loads(request.body.decode() or '{}')
    present = float(payload.get('presentDays') or 0.0)
    total = float(payload.get('totalDays') or 0.0)
    merit = float(payload.get('meritPoints') or 0.0)
    demerit = float(payload.get('demeritPoints') or 0.0)
    prelim = float(payload.get('prelimScore') or 0.0)
    midterm = float(payload.get('midtermScore') or 0.0)
    final = float(payload.get('finalScore') or 0.0)
    override_status = str(payload.get('overrideStatus') or '').upper().strip()

    attendance_pct = 0.0
    if total > 0:
        attendance_pct = max(0.0, min(1.0, present / total)) * 30.0

    aptitude_raw = 100.0 + (merit - demerit)
    aptitude_raw = max(0.0, min(100.0, aptitude_raw))
    aptitude_pct = aptitude_raw * 0.3

    subject_total = prelim + midterm + final
    subject_pct = max(0.0, min(1.0, subject_total / 300.0)) * 40.0

    final_percent = round(attendance_pct + aptitude_pct + subject_pct, 2)
    transmuted = _transmute(final_percent)

    failed_override_codes = {'DO', 'INC', 'T'}
    if override_status in failed_override_codes:
        transmuted = '5.00'

    passed = transmuted != '5.00'

    result = {
        'cadetId': cadet_id,
        'finalPercent': final_percent,
        'transmutation': transmuted,
        'passed': passed,
        'components': {
            'attendance': round(attendance_pct, 2),
            'aptitude': round(aptitude_pct, 2),
            'subject': round(subject_pct, 2)
        }
    }

    add_event({'type': 'grade_updated', 'payload': {'cadetId': cadet_id, 'finalPercent': final_percent}})
    try:
        Grade.objects.update_or_create(
            cadet_id=cadet_id,
            defaults={
                'final_percent': final_percent,
                'transmutation': transmuted,
                'passed': passed,
                'status': 'Completed' if passed else 'Failed'
            }
        )
    except Exception:
        pass
    return JsonResponse(result)

def admin_locations(request):
    try:
        from .models import Cadet, Staff
        items = []
        for s in Staff.objects.all():
            items.append({'id': s.id, 'role': 'training_staff', 'staff_rank': s.rank, 'staff_last_name': s.last_name, 'last_latitude': None, 'last_longitude': None, 'last_location_at': None})
        for c in Cadet.objects.all():
            items.append({'id': c.id, 'role': 'cadet', 'cadet_last_name': c.last_name, 'cadet_first_name': c.first_name, 'last_latitude': None, 'last_longitude': None, 'last_location_at': None})
        if items:
            return JsonResponse(items, safe=False)
    except Exception:
        pass
    return JsonResponse([
        {'id': 1, 'role': 'admin', 'username': 'admin', 'last_latitude': 7.225, 'last_longitude': 124.245, 'last_location_at': datetime.utcnow().isoformat()},
        {'id': 2, 'role': 'cadet', 'cadet_last_name': 'Doe', 'cadet_first_name': 'Juan', 'last_latitude': None, 'last_longitude': None, 'last_location_at': None},
        {'id': 3, 'role': 'training_staff', 'staff_rank': 'TSgt', 'staff_last_name': 'Santos', 'last_latitude': 7.2301, 'last_longitude': 124.2429, 'last_location_at': datetime.utcnow().isoformat()}
    ], safe=False)

def attendance_events(request):
    response = StreamingHttpResponse(sse_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['Connection'] = 'keep-alive'
    return response

@csrf_exempt
def publish_event(request):
    payload = json.loads(request.body.decode() or '{}')
    t = (payload.get('type') or 'grade_updated').strip()
    add_event({'type': t, 'payload': payload})
    return JsonResponse({'ok': True})

def cadet_image(request, cid):
    return HttpResponseRedirect('/uploads/default.webp')

def staff_image(request, sid):
    return HttpResponseRedirect('/uploads/default.webp')

@csrf_exempt
def upload_file(request):
    if request.method != 'POST':
        return JsonResponse({'message': 'Method not allowed'}, status=405)
    f = request.FILES.get('file')
    if not f:
        return JsonResponse({'message': 'No file'}, status=400)
    allowed = {'image/webp','image/png','image/jpeg','application/pdf'}
    ctype = getattr(f, 'content_type', '')
    if ctype not in allowed:
        return JsonResponse({'message': 'Unsupported file type'}, status=415)
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME') or ''
    api_key = os.environ.get('CLOUDINARY_API_KEY') or ''
    api_secret = os.environ.get('CLOUDINARY_API_SECRET') or ''
    cloudinary_url = os.environ.get('CLOUDINARY_URL') or ''
    use_cloudinary = bool(cloudinary_url or (cloud_name and api_key and api_secret))
    url = None
    if use_cloudinary:
        try:
            if cloudinary_url:
                cloudinary.config(cloudinary_url=cloudinary_url)
            else:
                cloudinary.config(
                    cloud_name=cloud_name,
                    api_key=api_key,
                    api_secret=api_secret,
                )
            folder = os.environ.get('CLOUDINARY_FOLDER', 'rotc-grading-system/uploads')
            resource_type = 'image' if ctype.startswith('image/') else 'raw'
            result = cloudinary.uploader.upload(
                f,
                folder=folder,
                resource_type=resource_type,
            )
            url = result.get('secure_url') or result.get('url')
        except Exception:
            url = None
    if not url:
        root = settings.MEDIA_ROOT
        os.makedirs(root, exist_ok=True)
        import re, time as _t
        base = re.sub(r'[^A-Za-z0-9._-]', '_', f.name)
        ts = int(_t.time())
        name = f'{ts}_{base[:64]}'
        path = os.path.join(root, name)
        with open(path, 'wb') as dest:
            for chunk in f.chunks():
                dest.write(chunk)
        url = settings.MEDIA_URL + name
    return JsonResponse({'url': url})

def spa_index(request):
    try:
        return render(request, 'index.html')
    except Exception:
        try:
            path = (settings.BASE_DIR.parent / 'client' / 'dist' / 'index.html')
            if os.path.exists(path):
                return FileResponse(open(path, 'rb'), content_type='text/html')
        except Exception:
            pass
    return JsonResponse({'message': 'Not found'}, status=404)

def admin_cadets(request):
    try:
        q = (request.GET.get('search') or '').strip().lower()
        course = (request.GET.get('course') or '').strip().upper()
        rows = []
        for c in Cadet.objects.all().order_by('-created_at'):
            if q and not (c.first_name.lower().find(q) >= 0 or c.last_name.lower().find(q) >= 0 or (c.student_id or '').lower().find(q) >= 0):
                continue
            if course and course != 'ALL' and (c.course or '').upper() != course:
                continue
            rows.append({
                'id': c.id,
                'rank': '',
                'first_name': c.first_name,
                'middle_name': '',
                'last_name': c.last_name,
                'suffix_name': '',
                'student_id': c.student_id,
                'email': '',
                'username': '',
                'contact_number': '',
                'address': '',
                'gender': '',
                'religion': '',
                'birthdate': '',
                'course': c.course or '',
                'year_level': '',
                'school_year': '',
                'battalion': '',
                'company': '',
                'platoon': '',
                'cadet_course': c.course or '',
                'semester': '',
                'corp_position': '',
                'status': 'Ongoing',
                'is_profile_completed': bool(c.is_profile_completed),
                'profile_pic': c.profile_pic or None
            })
        return JsonResponse(rows, safe=False)
    except Exception:
        return JsonResponse([], safe=False)

@csrf_exempt
def admin_update_cadet(request, cid):
    if request.method not in ('PUT', 'PATCH', 'POST'):
        return JsonResponse({'message': 'Method not allowed'}, status=405)
    try:
        from .models import Cadet
        c = Cadet.objects.filter(id=cid).first()
        if not c:
            return JsonResponse({'message': 'Cadet not found'}, status=404)

        if _role(request) != 'admin':
            return JsonResponse({'message': 'Forbidden'}, status=403)

        drf_request = Request(request, parsers=[MultiPartParser(), FormParser()])
        data = drf_request.data or {}
        f = drf_request.FILES.get('profilePic')

        first = data.get('firstName')
        last = data.get('lastName')
        sid = data.get('studentId')
        course = data.get('course') or data.get('cadetCourse')
        completed_flag = str(data.get('is_profile_completed') or '').strip().lower()

        if first is not None:
            c.first_name = first or c.first_name
        if last is not None:
            c.last_name = last or c.last_name
        if sid:
            c.student_id = sid
        if course is not None:
            c.course = course or ''
        if completed_flag in ('1', 'true', 'yes', 'on'):
            c.is_profile_completed = True

        if f:
            root = settings.MEDIA_ROOT
            os.makedirs(root, exist_ok=True)
            allowed = {'image/webp', 'image/png', 'image/jpeg'}
            ctype = getattr(f, 'content_type', '')
            if ctype not in allowed:
                return JsonResponse({'message': 'Unsupported file type'}, status=415)
            import re, time as _t
            base = re.sub(r'[^A-Za-z0-9._-]', '_', f.name)
            ts = int(_t.time())
            name = f'{ts}_{base[:64]}'
            path = os.path.join(root, name)
            with open(path, 'wb') as dest:
                for chunk in f.chunks():
                    dest.write(chunk)
            url = settings.MEDIA_URL + name
            c.profile_pic = url

        c.save()
        add_event({'type': 'cadet_profile_updated', 'payload': {'cadetId': cid}})
        return JsonResponse({'message': 'Updated', 'profile_pic': c.profile_pic or None})
    except Exception:
        return JsonResponse({'message': 'Error updating cadet'}, status=500)

def admin_cadets_archived(request):
    return JsonResponse([], safe=False)

def staff_list(request):
    try:
        q = (request.GET.get('search') or '').strip().lower()
        rows = []
        for s in Staff.objects.all().order_by('-created_at'):
            if q and not (s.first_name.lower().find(q) >= 0 or s.last_name.lower().find(q) >= 0 or (s.username or '').lower().find(q) >= 0):
                continue
            rows.append({
                'id': s.id,
                'rank': s.rank or '',
                'first_name': s.first_name or '',
                'last_name': s.last_name or '',
                'afpsn': '',
                'username': s.username or ''
            })
        return JsonResponse(rows, safe=False)
    except Exception:
        return JsonResponse([], safe=False)

def _role(request):
    try:
        if isinstance(getattr(request, 'auth', None), dict):
            r = (request.auth.get('role') or '').lower()
            if r:
                return r
        u = getattr(request, 'user', None)
        uname = getattr(u, 'username', '') or ''
        if uname.startswith('staff:'):
            return 'training_staff'
        if uname.startswith('cadet:'):
            return 'cadet'
        return 'admin'
    except Exception:
        return ''

def admin_settings_cadet_source(request):
    return JsonResponse({'url': (CADET_SOURCE_URL_OVERRIDE or settings.CADET_SOURCE_URL or '')})

@csrf_exempt
def admin_update_cadet_source(request):
    if _role(request) != 'admin':
        return JsonResponse({'message': 'Forbidden'}, status=403)
    data = json.loads(request.body.decode() or '{}')
    url = (data.get('url') or '').strip()
    if not url:
        return JsonResponse({'message': 'URL required'}, status=400)
    global CADET_SOURCE_URL_OVERRIDE
    CADET_SOURCE_URL_OVERRIDE = url
    return JsonResponse({'message': 'Updated', 'url': CADET_SOURCE_URL_OVERRIDE})

@csrf_exempt
def admin_import_cadets_file(request):
    if _role(request) != 'admin':
        return JsonResponse({'message': 'Forbidden'}, status=403)
    f = request.FILES.get('file')
    if not f:
        return JsonResponse({'message': 'No file'}, status=400)
    created = 0
    updated = 0
    try:
        buf = f.read()
        text = buf.decode(errors='ignore')
        rows = []
        try:
            data = json.loads(text)
            rows = data if isinstance(data, list) else (data.get('data') or [])
        except Exception:
            try:
                reader = csv.DictReader(io.StringIO(text))
                rows = list(reader)
            except Exception:
                rows = []
        for row in rows:
            sid = (row.get('student_id') or row.get('studentId') or '').strip()
            if not sid:
                continue
            first = (row.get('first_name') or row.get('firstName') or '').strip() or 'Cadet'
            last = (row.get('last_name') or row.get('lastName') or '').strip() or sid[:16]
            course = (row.get('course') or row.get('cadet_course') or '').strip()
            completed = bool(row.get('is_profile_completed')) or str(row.get('is_profile_completed')).lower() in {'1','true','yes'}
            obj, was_created = Cadet.objects.update_or_create(
                student_id=sid,
                defaults={'first_name': first, 'last_name': last, 'course': course, 'is_profile_completed': completed}
            )
            if was_created:
                created += 1
                add_event({'type': 'cadet_created', 'payload': {'cadetId': obj.id}})
            else:
                updated += 1
                add_event({'type': 'cadet_updated', 'payload': {'cadetId': obj.id}})
        return JsonResponse({'message': f'Imported {created} new, {updated} updated'})
    except Exception as e:
        return JsonResponse({'message': 'Import failed'}, status=500)

@csrf_exempt
def admin_import_cadets_url(request):
    if _role(request) != 'admin':
        return JsonResponse({'message': 'Forbidden'}, status=403)
    payload = json.loads(request.body.decode() or '{}')
    base = (payload.get('url') or '').strip()
    if not base:
        return JsonResponse({'message': 'No URL'}, status=400)
    target = base if '/api/admin/cadets' in base else f'{base.rstrip("/")}/api/admin/cadets'
    try:
        r = requests.get(target, timeout=20)
        data = r.json()
        rows = data if isinstance(data, list) else (data.get('data') or [])
        created = 0
        updated = 0
        for row in rows:
            sid = (row.get('student_id') or row.get('studentId') or '').strip()
            if not sid:
                continue
            first = (row.get('first_name') or row.get('firstName') or '').strip() or 'Cadet'
            last = (row.get('last_name') or row.get('lastName') or '').strip() or sid[:16]
            course = (row.get('course') or row.get('cadet_course') or '').strip()
            completed = bool(row.get('is_profile_completed')) or str(row.get('is_profile_completed')).lower() in {'1','true','yes'}
            obj, was_created = Cadet.objects.update_or_create(
                student_id=sid,
                defaults={'first_name': first, 'last_name': last, 'course': course, 'is_profile_completed': completed}
            )
            if was_created:
                created += 1
                add_event({'type': 'cadet_created', 'payload': {'cadetId': obj.id}})
            else:
                updated += 1
                add_event({'type': 'cadet_updated', 'payload': {'cadetId': obj.id}})
        return JsonResponse({'message': f'Imported {created} new, {updated} updated'})
    except Exception:
        return JsonResponse({'message': 'Import failed'}, status=500)

@csrf_exempt
def admin_sync_cadets(request):
    url = (CADET_SOURCE_URL_OVERRIDE or settings.CADET_SOURCE_URL or '')
    if not url:
        return JsonResponse({'message': 'No source configured'}, status=400)
    return admin_import_cadets_url(type('obj', (), {'body': json.dumps({'url': url})})())
def _ensure_default_upload():
    root = settings.BASE_DIR / 'uploads'
    os.makedirs(root, exist_ok=True)
    path = root / 'default.webp'
    if not os.path.exists(path):
        with open(path, 'wb') as f:
            f.write(b'RIFF\x00\x00\x00\x00WEBPVP8 \x00\x00\x00\x00')

def _seed_events():
    while not STOP_EVENT.is_set():
        add_event({'type': 'heartbeat', 'time': time.time()})
        time.sleep(10)

_ensure_default_upload()
Thread(target=_seed_events, daemon=True).start()
