import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { Download, RefreshCw } from 'lucide-react';

function toCSV(rows, headers) {
  const h = headers.map(h => `"${h.label}"`).join(',');
  const body = rows.map(r => headers.map(h => `"${String(r[h.key] ?? '')}"`).join(',')).join('\n');
  return `${h}\n${body}`;
}

const AbsenceAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    battalion: '',
    company: '',
    platoon: '',
    yearLevel: '',
    type: '',
    severity: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await axios.get('/api/analytics/absences', { params });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load absence analytics', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const es = new EventSource('/api/attendance/events');
    es.onmessage = () => fetchData();
    es.onerror = () => {};
    return () => { try { es.close(); } catch {} };
  }, [filters]);

  const cadetHeaders = useMemo(() => [
    { key: 'rank', label: 'Rank' },
    { key: 'cadetId', label: 'Cadet ID' },
    { key: 'name', label: 'Name' },
    { key: 'battalion', label: 'Battalion' },
    { key: 'company', label: 'Company' },
    { key: 'platoon', label: 'Platoon' },
    { key: 'year_level', label: 'Year Level' },
    { key: 'present', label: 'Present' },
    { key: 'total', label: 'Total Days' },
    { key: 'total_absences', label: 'Total Absences' },
    { key: 'excuse_events', label: 'Excuse Events' },
    { key: 'percent', label: 'Absence %' },
    { key: 'trend', label: '30d Trend' },
    { key: 'risk_score', label: 'Risk Score' },
  ], []);

  const exportCSV = () => {
    if (!data?.cadets) return;
    const csv = toCSV(data.cadets, cadetHeaders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'absence_analytics.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Absence Analytics</h2>
        <div className="flex gap-2">
          <button onClick={fetchData} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 border text-sm flex items-center gap-2">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={exportCSV} className="px-3 py-2 rounded bg-green-600 text-white text-sm flex items-center gap-2">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border rounded p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500">Start Date</label>
          <input type="date" className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white" value={filters.startDate} onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500">End Date</label>
          <input type="date" className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white" value={filters.endDate} onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Year Level</label>
          <input className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white" placeholder="e.g., 1st, 2nd" value={filters.yearLevel} onChange={(e) => setFilters(f => ({ ...f, yearLevel: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Battalion</label>
          <input className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white" value={filters.battalion} onChange={(e) => setFilters(f => ({ ...f, battalion: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Company</label>
          <input className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white" value={filters.company} onChange={(e) => setFilters(f => ({ ...f, company: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Platoon</label>
          <input className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white" value={filters.platoon} onChange={(e) => setFilters(f => ({ ...f, platoon: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Absence Type</label>
          <select className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white" value={filters.type} onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="">All</option>
            <option value="excused">Excused</option>
            <option value="unexcused">Unexcused</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Severity</label>
          <select className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white" value={filters.severity} onChange={(e) => setFilters(f => ({ ...f, severity: e.target.value }))}>
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={fetchData} className="w-full bg-[var(--primary-color)] text-white rounded p-2">Apply Filters</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-8">Loading...</div>
      ) : !data ? (
        <div className="text-center p-8 text-red-600">Failed to load data</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 border rounded p-4">
              <h4 className="text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">Temporal Absence Pattern</h4>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={data.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="absences" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border rounded p-4">
              <h4 className="text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">Average Absences by Company</h4>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={data.groups.company}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="key" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="avg_absences" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border rounded p-4">
            <h4 className="text-sm font-bold mb-3 text-gray-700 dark:text-gray-200">At-Risk Cadets</h4>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-600 dark:text-gray-300">
                  <tr>
                    {cadetHeaders.map(h => <th key={h.key} className="px-3 py-2 border-b">{h.label}</th>)}
                  </tr>
                </thead>
                <tbody className="text-gray-800 dark:text-gray-100">
                  {(data.at_risk || []).map(row => (
                    <tr key={row.cadetId} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      {cadetHeaders.map(h => <td key={h.key} className="px-3 py-2">{row[h.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AbsenceAnalytics;
