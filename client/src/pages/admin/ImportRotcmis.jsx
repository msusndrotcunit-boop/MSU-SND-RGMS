import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Layers, ListChecks, Filter, RotateCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const DetailLevel = {
  MIN: 'minimal',
  STD: 'standard',
  CMP: 'comprehensive'
};

function Summary({ summary, level }) {
  if (!summary) return null;
  const items = [
    { label: 'Total', value: summary.total },
    { label: 'Valid', value: summary.valid },
    { label: 'Invalid', value: summary.invalid },
    { label: 'Data quality', value: `${summary.dataQuality}%` },
  ];
  const byStatus = summary.byStatus || {};
  return (
    <div className="grid md:grid-cols-4 gap-3 my-3">
      {items.map(i => (
        <div key={i.label} className="p-3 rounded border bg-white hover-highlight">
          <div className="text-xs text-gray-500">{i.label}</div>
          <div className="text-lg font-semibold">{i.value}</div>
        </div>
      ))}
      {level !== DetailLevel.MIN && (
        <>
          {Object.keys(byStatus).map(k => (
            <div key={k} className="p-3 rounded border bg-white hover-highlight">
              <div className="text-xs text-gray-500 capitalize">{k}</div>
              <div className="text-lg font-semibold">{byStatus[k]}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function ImportRotcmis() {
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(DetailLevel.STD);
  const [selected, setSelected] = useState(new Set());
  const [strategy, setStrategy] = useState('skip-duplicates');

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const picked = Array.from(e.dataTransfer.files || []);
    setFiles(prev => [...prev, ...picked]);
  }, []);

  const onFilePick = (e) => {
    const picked = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...picked]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const validate = async () => {
    if (files.length === 0) { toast.error('Select at least one file'); return; }
    try {
      setParsing(true);
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const { data } = await axios.post('/api/integration/rotcmis/validate', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setRecords(data.records || []);
      setSummary(data.summary || null);
      setSelected(new Set((data.records || []).map((_, i) => i)));
      toast.success('Parsed ROTCMIS export');
    } catch (e) {
      toast.error(`Validation failed: ${e.response?.data?.message || e.message}`);
    } finally {
      setParsing(false);
    }
  };

  const bulk = (type) => {
    if (type === 'select-all') {
      setSelected(new Set(records.map((_, i) => i)));
    } else if (type === 'select-none') {
      setSelected(new Set());
    } else if (type === 'select-valid') {
      const s = new Set();
      records.forEach((r, i) => { if (!r.errors?.length) s.add(i); });
      setSelected(s);
    } else if (type === 'select-no-dup') {
      const s = new Set();
      records.forEach((r, i) => { if (!r.isDuplicateInBatch) s.add(i); });
      setSelected(s);
    }
  };

  const toggleRow = (i) => {
    const copy = new Set(selected);
    if (copy.has(i)) copy.delete(i); else copy.add(i);
    setSelected(copy);
  };

  const confirmImport = async () => {
    try {
      const chosen = records.filter((_, i) => selected.has(i));
      if (chosen.length === 0) { toast.error('No records selected'); return; }
      const payload = {
        strategy,
        records: chosen
      };
      const { data } = await axios.post('/api/integration/rotcmis/import', payload);
      toast.success(`Import done: ${data?.result?.inserted || 0} inserted, ${data?.result?.updated || 0} updated, ${data?.result?.skipped || 0} skipped`);
    } catch (e) {
      toast.error(`Import failed: ${e.response?.data?.message || e.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Import ROTCMIS Export</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Summary Detail</label>
          <select value={detail} onChange={e => setDetail(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value={DetailLevel.MIN}>Minimal</option>
            <option value={DetailLevel.STD}>Standard</option>
            <option value={DetailLevel.CMP}>Comprehensive</option>
          </select>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded p-6 bg-white hover-highlight ${dragOver ? 'border-green-600 bg-green-50' : 'border-gray-300'}`}
      >
        <div className="flex flex-col items-center text-center">
          <Upload className="text-green-700 mb-2" />
          <p className="font-medium">Drag and drop ROTCMIS export files</p>
          <p className="text-xs text-gray-500">CSV, XLSX, or JSON. Multiple files supported.</p>
          <input type="file" multiple accept=".csv,.xlsx,.xls,.json" onChange={onFilePick} className="mt-3" />
        </div>
        {files.length > 0 && (
          <div className="mt-4 grid md:grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2 border rounded bg-gray-50">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-gray-500" />
                  <span className="text-sm">{f.name}</span>
                </div>
                <button onClick={() => removeFile(i)} className="text-xs text-red-600 hover:underline">Remove</button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <button
            type="button"
            onClick={validate}
            disabled={parsing}
            className="px-4 py-2 rounded bg-green-700 text-white hover:bg-green-800 hover-highlight"
          >
            {parsing ? 'Parsing…' : 'Validate & Preview'}
          </button>
        </div>
      </div>

      <Summary summary={summary} level={detail} />

      {records.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} />
              <span className="text-sm font-medium">Batch Actions</span>
              <button onClick={() => bulk('select-all')} className="text-sm text-green-700 hover:underline">Select all</button>
              <button onClick={() => bulk('select-none')} className="text-sm text-green-700 hover:underline">Select none</button>
              <button onClick={() => bulk('select-valid')} className="text-sm text-green-700 hover:underline">Select valid only</button>
              <button onClick={() => bulk('select-no-dup')} className="text-sm text-green-700 hover:underline">Exclude duplicates</button>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} />
              <label className="text-sm">Duplicate Strategy</label>
              <select value={strategy} onChange={e => setStrategy(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="skip-duplicates">Skip duplicates</option>
                <option value="overwrite">Overwrite existing</option>
              </select>
              <button onClick={confirmImport} className="px-4 py-2 rounded bg-green-700 text-white hover:bg-green-800 hover-highlight">Confirm Import</button>
            </div>
          </div>

          <div className="overflow-auto bg-white border rounded">
            <table className="min-w-full">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-2 text-left">Pick</th>
                  <th className="p-2 text-left">Student ID</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Duplicate</th>
                  {detail === DetailLevel.CMP && <th className="p-2 text-left">Errors</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const err = r.errors?.length > 0;
                  return (
                    <tr key={i} className={err ? 'bg-red-50' : (r.isDuplicateInBatch ? 'bg-yellow-50' : '')}>
                      <td className="p-2">
                        <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)} />
                      </td>
                      <td className="p-2 font-mono text-sm">{r.student_id || '—'}</td>
                      <td className="p-2 text-sm">{r.name || '—'}</td>
                      <td className="p-2 text-sm">{r.date ? new Date(r.date).toLocaleString() : '—'}</td>
                      <td className="p-2 text-sm capitalize">
                        {r.status === 'present' && <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={14} /> present</span>}
                        {r.status === 'late' && <span className="inline-flex items-center gap-1 text-yellow-700"><AlertTriangle size={14} /> late</span>}
                        {r.status === 'excused' && <span className="inline-flex items-center gap-1 text-blue-700"><ListChecks size={14} /> excused</span>}
                        {!r.status && <span className="inline-flex items-center gap-1 text-red-700"><XCircle size={14} /> invalid</span>}
                        {r.status === 'absent' && <span className="inline-flex items-center gap-1 text-red-700"><XCircle size={14} /> absent</span>}
                      </td>
                      <td className="p-2 text-sm">
                        {r.isDuplicateInBatch ? <span className="text-yellow-700">Possible duplicate</span> : '—'}
                      </td>
                      {detail === DetailLevel.CMP && (
                        <td className="p-2 text-xs text-red-700">{(r.errors || []).join('; ') || '—'}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

