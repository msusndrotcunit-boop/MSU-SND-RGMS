from flask import Flask, request, jsonify, Response, send_from_directory, redirect
from datetime import datetime
import json
import time
import os
from threading import Event, Thread
from collections import deque

app = Flask(__name__)

EVENT_QUEUE = deque(maxlen=1000)
STOP_EVENT = Event()

def add_event(payload):
    EVENT_QUEUE.append({'time': time.time(), **payload})

def sse_generator():
    yield f'data: {json.dumps({"type": "heartbeat", "time": time.time()})}\n\n'
    while not STOP_EVENT.is_set():
        if EVENT_QUEUE:
            item = EVENT_QUEUE.popleft()
            yield f'data: {json.dumps(item)}\n\n'
        else:
            time.sleep(1)

@app.after_request
def apply_cors(resp):
    origin = request.headers.get('Origin', '*')
    resp.headers['Access-Control-Allow-Origin'] = origin
    resp.headers['Access-Control-Allow-Credentials'] = 'true'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cache-Control'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return resp

@app.route('/api/auth/login', methods=['POST'])
def admin_login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()
    if not username or not password:
        return jsonify({'message': 'Username and password required'}), 400
    return jsonify({
        'token': 'dev-token',
        'role': 'admin',
        'staffId': None,
        'cadetId': None,
        'isProfileCompleted': True
    })

@app.route('/api/auth/cadet-login', methods=['POST'])
def cadet_login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get('identifier') or '').strip()
    if not identifier:
        return jsonify({'message': 'Identifier required'}), 400
    return jsonify({
        'token': 'dev-token',
        'role': 'cadet',
        'cadetId': 1,
        'staffId': None,
        'isProfileCompleted': False
    })

@app.route('/api/auth/staff-login-no-pass', methods=['POST'])
def staff_login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get('identifier') or '').strip()
    if not identifier:
        return jsonify({'message': 'Staff identifier required'}), 400
    return jsonify({
        'token': 'dev-token',
        'role': 'training_staff',
        'staffId': 1,
        'cadetId': None,
        'isProfileCompleted': True
    })

@app.route('/api/auth/heartbeat', methods=['POST'])
def heartbeat():
    return jsonify({'ok': True, 'time': datetime.utcnow().isoformat()})

@app.route('/api/cadet/profile', methods=['GET'])
def cadet_profile():
    return jsonify({'is_profile_completed': 0})

@app.route('/api/admin/analytics', methods=['GET'])
def admin_analytics():
    stats = [
        {'status': 'ONGOING', 'cadet_course': 'MS1', 'count': 120},
        {'status': 'COMPLETED', 'cadet_course': 'MS1', 'count': 35},
        {'status': 'FAILED', 'cadet_course': 'MS1', 'count': 5},
        {'status': 'ONGOING', 'cadet_course': 'MS2', 'count': 95},
        {'status': 'COMPLETED', 'cadet_course': 'MS2', 'count': 25}
    ]
    return jsonify({'demographics': {'courseStats': stats}})

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

@app.route('/api/admin/grades/<int:cadet_id>', methods=['POST'])
def compute_grade(cadet_id):
    payload = request.get_json(silent=True) or {}
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
    return jsonify(result)

@app.route('/api/admin/locations', methods=['GET'])
def admin_locations():
    data = [
        {'id': 1, 'role': 'admin', 'username': 'admin', 'last_latitude': 7.225, 'last_longitude': 124.245, 'last_location_at': datetime.utcnow().isoformat()},
        {'id': 2, 'role': 'cadet', 'cadet_last_name': 'Doe', 'cadet_first_name': 'Juan', 'last_latitude': None, 'last_longitude': None, 'last_location_at': None},
        {'id': 3, 'role': 'training_staff', 'staff_rank': 'TSgt', 'staff_last_name': 'Santos', 'last_latitude': 7.2301, 'last_longitude': 124.2429, 'last_location_at': datetime.utcnow().isoformat()}
    ]
    return jsonify(data)

@app.route('/api/attendance/events', methods=['GET'])
def attendance_events():
    return Response(sse_generator(), mimetype='text/event-stream')

@app.route('/api/admin/sync/publish', methods=['POST'])
def publish_event():
    payload = request.get_json(silent=True) or {}
    t = (payload.get('type') or 'grade_updated').strip()
    add_event({'type': t, 'payload': payload})
    return jsonify({'ok': True})

@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_uploads(filename):
    root = os.path.join(os.path.dirname(__file__), 'uploads')
    return send_from_directory(root, filename)

@app.route('/api/images/cadets/<int:cid>', methods=['GET'])
def cadet_image(cid):
    return redirect('/uploads/default.webp', 302)

@app.route('/api/images/staff/<int:sid>', methods=['GET'])
def staff_image(sid):
    return redirect('/uploads/default.webp', 302)

def start_event_seed():
    while not STOP_EVENT.is_set():
        add_event({'type': 'heartbeat', 'time': time.time()})
        time.sleep(10)

def create_default_upload():
    root = os.path.join(os.path.dirname(__file__), 'uploads')
    os.makedirs(root, exist_ok=True)
    path = os.path.join(root, 'default.webp')
    if not os.path.exists(path):
        with open(path, 'wb') as f:
            f.write(b'RIFF\x00\x00\x00\x00WEBPVP8 \x00\x00\x00\x00')

if __name__ == '__main__':
    create_default_upload()
    Thread(target=start_event_seed, daemon=True).start()
    port = int(os.environ.get('PORT', '5000'))
    app.run(host='0.0.0.0', port=port, threaded=True)
