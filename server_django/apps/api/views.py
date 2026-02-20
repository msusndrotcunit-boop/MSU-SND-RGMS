import json
import time
import os
from collections import deque
from threading import Event, Thread
from datetime import datetime
from django.http import JsonResponse, StreamingHttpResponse, HttpResponseRedirect, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

EVENT_QUEUE = deque(maxlen=1000)
STOP_EVENT = Event()

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
    return JsonResponse({'token': 'dev-token', 'role': 'admin', 'staffId': None, 'cadetId': None, 'isProfileCompleted': True})

@csrf_exempt
def cadet_login(request):
    data = json.loads(request.body.decode() or '{}')
    identifier = (data.get('identifier') or '').strip()
    if not identifier:
        return JsonResponse({'message': 'Identifier required'}, status=400)
    return JsonResponse({'token': 'dev-token', 'role': 'cadet', 'cadetId': 1, 'staffId': None, 'isProfileCompleted': False})

@csrf_exempt
def staff_login(request):
    data = json.loads(request.body.decode() or '{}')
    identifier = (data.get('identifier') or '').strip()
    if not identifier:
        return JsonResponse({'message': 'Staff identifier required'}, status=400)
    return JsonResponse({'token': 'dev-token', 'role': 'training_staff', 'staffId': 1, 'cadetId': None, 'isProfileCompleted': True})

@csrf_exempt
def heartbeat(request):
    return JsonResponse({'ok': True, 'time': datetime.utcnow().isoformat()})

def cadet_profile(request):
    return JsonResponse({'is_profile_completed': 0})

def admin_analytics(request):
    stats = [
        {'status': 'ONGOING', 'cadet_course': 'MS1', 'count': 120},
        {'status': 'COMPLETED', 'cadet_course': 'MS1', 'count': 35},
        {'status': 'FAILED', 'cadet_course': 'MS1', 'count': 5},
        {'status': 'ONGOING', 'cadet_course': 'MS2', 'count': 95},
        {'status': 'COMPLETED', 'cadet_course': 'MS2', 'count': 25}
    ]
    return JsonResponse({'demographics': {'courseStats': stats}})

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
    return JsonResponse(result)

def admin_locations(request):
    data = [
        {'id': 1, 'role': 'admin', 'username': 'admin', 'last_latitude': 7.225, 'last_longitude': 124.245, 'last_location_at': datetime.utcnow().isoformat()},
        {'id': 2, 'role': 'cadet', 'cadet_last_name': 'Doe', 'cadet_first_name': 'Juan', 'last_latitude': None, 'last_longitude': None, 'last_location_at': None},
        {'id': 3, 'role': 'training_staff', 'staff_rank': 'TSgt', 'staff_last_name': 'Santos', 'last_latitude': 7.2301, 'last_longitude': 124.2429, 'last_location_at': datetime.utcnow().isoformat()}
    ]
    return JsonResponse(data, safe=False)

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
