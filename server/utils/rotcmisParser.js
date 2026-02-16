const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const row = {};
    headers.forEach((h, idx) => row[h] = (parts[idx] || '').trim());
    rows.push(row);
  }
  return rows;
}

function parseXLSX(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = xlsx.utils.sheet_to_json(sheet, { raw: false });
  return json.map(r => {
    const out = {};
    Object.keys(r).forEach(k => out[normalizeHeader(k)] = r[k]);
    return out;
  });
}

function parseJSON(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    return data.map(obj => {
      const out = {};
      Object.keys(obj).forEach(k => out[normalizeHeader(k)] = obj[k]);
      return out;
    });
  }
  if (data && Array.isArray(data.records)) {
    return data.records.map(obj => {
      const out = {};
      Object.keys(obj).forEach(k => out[normalizeHeader(k)] = obj[k]);
      return out;
    });
  }
  return [];
}

function coerceDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d;
  // Try dd/mm/yyyy or mm/dd/yyyy
  const m = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const a = new Date(`${m[3]}-${m[1]}-${m[2]}`);
    if (!isNaN(a.getTime())) return a;
  }
  return null;
}

function normalizeStatus(s) {
  const v = String(s || '').trim().toLowerCase();
  if (['present', 'p', '1', 'yes', 'y'].includes(v)) return 'present';
  if (['late', 'l'].includes(v)) return 'late';
  if (['excused', 'e'].includes(v)) return 'excused';
  if (['absent', 'a', '0', 'no', 'n'].includes(v)) return 'absent';
  return null;
}

function inferFields(row) {
  const keys = Object.keys(row);
  const get = (...candidates) => {
    for (const c of candidates) {
      if (keys.includes(c)) return row[c];
    }
    return undefined;
  };
  return {
    student_id: get('student_id', 'id', 'studentno', 'student_number', 'cadet_id', 'qr', 'qr_code', 'qrvalue'),
    name: get('name', 'full_name', 'fullname', 'cadet_name'),
    date: get('date', 'attendance_date', 'datetime', 'time', 'timestamp'),
    status: get('status', 'attendance', 'attendancestatus', 'present'),
    company: get('company'),
    platoon: get('platoon'),
  };
}

function normalizeRecord(row) {
  const f = inferFields(row);
  const studentId = String(f.student_id || '').trim();
  const date = coerceDate(f.date);
  const status = normalizeStatus(f.status);
  return {
    raw: row,
    student_id: studentId || null,
    name: f.name ? String(f.name).trim() : null,
    date,
    status,
    company: f.company ? String(f.company).trim() : null,
    platoon: f.platoon ? String(f.platoon).trim() : null,
    errors: []
  };
}

function validateRecord(rec) {
  const errors = [];
  if (!rec.student_id) errors.push('Missing student_id/QR');
  if (!rec.date) errors.push('Invalid or missing date');
  if (!rec.status) errors.push('Invalid or missing status');
  return { ...rec, errors };
}

function parseFile(filePathOrBuffer, filename) {
  let rows = [];
  const ext = (filename || '').toLowerCase();
  if (Buffer.isBuffer(filePathOrBuffer)) {
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) rows = parseXLSX(filePathOrBuffer);
    else {
      const text = filePathOrBuffer.toString('utf8');
      if (ext.endsWith('.json')) rows = parseJSON(text);
      else rows = parseCSV(text);
    }
  } else {
    const abs = path.resolve(filePathOrBuffer);
    const buf = fs.readFileSync(abs);
    return parseFile(buf, filename || abs);
  }
  const normalized = rows.map(normalizeRecord).map(validateRecord);
  return normalized;
}

function summarize(records) {
  const total = records.length;
  const valid = records.filter(r => r.errors.length === 0).length;
  const invalid = total - valid;
  const byStatus = records.reduce((acc, r) => {
    const k = r.status || 'invalid';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const dataQuality = total ? Math.round((valid / total) * 100) : 0;
  return { total, valid, invalid, byStatus, dataQuality };
}

module.exports = {
  parseFile,
  summarize
};

