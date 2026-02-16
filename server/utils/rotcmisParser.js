const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

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

const MAX_ROWS = 10000;

async function parseXLSXExcelJS(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = normalizeHeader(cell?.value?.text || cell?.value || '');
  });
  const rows = [];
  const max = Math.min(sheet.rowCount, MAX_ROWS + 1);
  for (let r = 2; r <= max; r++) {
    const row = sheet.getRow(r);
    if (!row || row.cellCount === 0) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      let val = cell?.value;
      if (val && typeof val === 'object') {
        if ('text' in val) val = val.text;
        else if ('result' in val) val = val.result;
        else val = String(val);
      }
      obj[h] = val ?? '';
    });
    rows.push(obj);
  }
  return rows;
}

function extractFromRawLine(rawLine) {
  const line = String(rawLine || '').trim();
  if (!line) return {};
  const lower = line.toLowerCase();
  let status = null;
  if (lower.includes(' present')) status = 'present';
  else if (lower.includes(' absent')) status = 'absent';
  else if (lower.includes(' excused')) status = 'excused';
  else if (lower.includes(' late')) status = 'late';
  if (!status) return {};
  const idx = lower.indexOf(status);
  let left = line.slice(0, idx);
  // strip leading numbering and trailing usernames
  left = left.replace(/^\s*\d{1,4}[.)]?\s+/, '').replace(/\s+[A-Za-z0-9._-]{3,}\s*$/, '').trim();
  if (!left) return { status };
  // Normalize "LAST, FIRST" to "FIRST LAST"
  let name = left;
  if (left.includes(',')) {
    const parts = left.split(',');
    const last = parts[0].trim();
    const first = parts.slice(1).join(' ').trim();
    if (last && first) name = `${first} ${last}`;
  }
  return { name, status };
}

async function parsePDFToRows(buffer) {
  try {
    const { text } = await pdfParse(buffer);
    const lines = String(text || '').split(/\r?\n/);
    const rows = [];
    for (const l of lines) {
      const r = extractFromRawLine(l);
      if (r && (r.name || r.status)) rows.push(r);
      if (rows.length >= MAX_ROWS) break;
    }
    return rows;
  } catch (_) {
    return [];
  }
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
  // Accept either student_id or name (PDFs may not include IDs)
  if (!rec.student_id && !rec.name) errors.push('Missing student_id or name');
  if (!rec.date) errors.push('Invalid or missing date');
  if (!rec.status) errors.push('Invalid or missing status');
  return { ...rec, errors };
}

async function parseFileAsync(filePathOrBuffer, filename) {
  let rows = [];
  const ext = (filename || '').toLowerCase();
  if (Buffer.isBuffer(filePathOrBuffer)) {
    if (ext.endsWith('.pdf')) rows = await parsePDFToRows(filePathOrBuffer);
    else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) rows = await parseXLSXExcelJS(filePathOrBuffer);
    else {
      const text = filePathOrBuffer.toString('utf8');
      if (ext.endsWith('.json')) rows = parseJSON(text);
      else rows = parseCSV(text);
    }
  } else {
    const abs = path.resolve(filePathOrBuffer);
    const buf = fs.readFileSync(abs);
    return parseFileAsync(buf, filename || abs);
  }
  // If rows came from PDF and lack a date, set today's date by default
  const today = new Date();
  const normalized = rows.map(r => {
    if ((ext.endsWith('.pdf')) && (r.date == null)) {
      return normalizeRecord({ ...r, date: today.toISOString().slice(0,10) });
    }
    return normalizeRecord(r);
  }).map(validateRecord);
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
  parseFileAsync,
  summarize
};

