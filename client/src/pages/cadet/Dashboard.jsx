import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Calendar, AlertCircle, User, Info, Link } from 'lucide-react';
import ExcuseLetterSubmission from '../../components/ExcuseLetterSubmission';
import { cacheData, getCachedData, getSingleton, cacheSingleton } from '../../utils/db';
import { useAuth } from '../../context/AuthContext';
import { analyzeCadetDashboard } from '../../services/aiAnalytics';

const CadetDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth ? useAuth() : { user: null };
    const [grades, setGrades] = useState(null);
    const [logs, setLogs] = useState([]);
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [esConnected, setEsConnected] = useState(false);
    const [logFilters, setLogFilters] = useState({ type: 'all', start: '', end: '', page: 1, pageSize: 10 });
    const [attendanceFilters, setAttendanceFilters] = useState({ order: 'asc' });
    const [aiSummary, setAiSummary] = useState(null);
    const fetchAttendance = async (filters = attendanceFilters) => {
        const params = {};
        params.order = filters.order || 'asc';
        let shaped = { items: [], total: 0, page: 1, pageSize: 0 };
        try {
            const res = await axios.get('/api/attendance/my-history', { params });
            const data = res.data;
            shaped = Array.isArray(data) ? { items: data, total: data.length, page: 1, pageSize: data.length || 15 } : (data || shaped);
        } catch {
            shaped = { items: [], total: 0, page: 1, pageSize: 0 };
        }
        if (!shaped.items || shaped.items.length === 0) {
            try {
                const daysRes = await axios.get('/api/attendance/days');
                const days = Array.isArray(daysRes.data) ? daysRes.data : [];
                const fallbackItems = days
                    .map(d => ({ id: null, date: d.date, title: d.title, status: 'absent', remarks: null, time_in: null, time_out: null }))
                    .sort((a, b) => new Date(a.date) - new Date(b.date));
                shaped = { items: fallbackItems, total: fallbackItems.length, page: 1, pageSize: fallbackItems.length };
            } catch {}
        }
        setAttendanceLogs(shaped);
        await cacheSingleton('dashboard', 'cadet_attendance', { data: shaped, timestamp: Date.now() });
    };
    const fetchLogs = async () => {
        const res = await axios.get(`/api/cadet/my-merit-logs?t=${Date.now()}`).catch(() => ({ data: [] }));
        const data = Array.isArray(res.data) ? res.data : [];
        setLogs(data);
        await cacheSingleton('dashboard', 'cadet_logs', { data, timestamp: Date.now() });
    };
    const refreshAll = async () => {
        try {
            const now = Date.now();
            const g = await axios.get(`/api/cadet/my-grades?t=${Date.now()}`);
            setGrades(g.data);
            await cacheSingleton('dashboard', 'cadet_grades', { data: g.data, timestamp: now });
            await fetchLogs({ ...logFilters, page: 1 });
            await fetchAttendance({ ...attendanceFilters, page: 1 });
        } catch {}
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!user || user.role !== 'cadet') {
                setLoading(false);
                return;
            }
            try {
                // Always fetch latest grades first for real-time sync
                let hasCachedData = false;
                try {
                    const fresh = await axios.get(`/api/cadet/my-grades?t=${Date.now()}`);
                    setGrades(fresh.data);
                    await cacheSingleton('dashboard', 'cadet_grades', { data: fresh.data, timestamp: Date.now() });
                } catch (e) {
                    // Fallback to cached grades if network fails
                    const cachedGrades = await getSingleton('dashboard', 'cadet_grades');
                    if (cachedGrades) {
                        setGrades(cachedGrades.data);
                        hasCachedData = true;
                    }
                }

                const cachedLogs = await getSingleton('dashboard', 'cadet_logs');
                if (cachedLogs) {
                    const shaped = Array.isArray(cachedLogs.data) ? cachedLogs.data : [];
                    setLogs(shaped);
                    hasCachedData = true;
                }

                const cachedAttendance = await getSingleton('dashboard', 'cadet_attendance');
                if (cachedAttendance) {
                    const shaped = cachedAttendance.data && cachedAttendance.data.items ? cachedAttendance.data : (Array.isArray(cachedAttendance.data) ? { items: cachedAttendance.data, total: cachedAttendance.data.length, page: 1, pageSize: cachedAttendance.data.length || 15 } : cachedAttendance.data);
                    setAttendanceLogs(shaped);
                    hasCachedData = true;
                }

                // If we have ANY cached data, stop loading spinner so user sees something
                if (hasCachedData) {
                    setLoading(false);
                }

                // 2. Background Fetch (Stale-While-Revalidate)
                // Only fetch if cache is old (> 5 mins) or missing
                const now = Date.now();
                const CACHE_TTL = 5 * 60 * 1000;

                const promises = [];

                const shouldFetchLogs = (!cachedLogs || (now - cachedLogs.timestamp > CACHE_TTL) || (cachedLogs && (!cachedLogs.data || (Array.isArray(cachedLogs.data) ? cachedLogs.data.length === 0 : true))));
                if (shouldFetchLogs) {
                    promises.push(
                        fetchLogs().catch(e => console.warn("Logs fetch failed", e))
                    );
                }

                const shouldFetchAttendance = (!cachedAttendance || (now - cachedAttendance.timestamp > CACHE_TTL) || (cachedAttendance && (!cachedAttendance.data || (Array.isArray(cachedAttendance.data) ? cachedAttendance.data.length === 0 : (cachedAttendance.data.items || []).length === 0))));
                if (shouldFetchAttendance) {
                    promises.push(fetchAttendance(attendanceFilters).catch(e => console.warn("Attendance fetch failed", e)));
                }

                await Promise.allSettled(promises);

            } catch (err) {
                console.error("General fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    useEffect(() => {
        if (!user || user.role !== 'cadet') return;
        const refresh = async () => {
            try {
                const res = await axios.get(`/api/cadet/my-grades?t=${Date.now()}`);
                setGrades(res.data);
                await cacheSingleton('dashboard', 'cadet_grades', { data: res.data, timestamp: Date.now() });
            } catch {}
        };
        const onVisible = () => {
            if (document.visibilityState === 'visible') refresh();
        };
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [user]);

    useEffect(() => {
        if (!user || user.role !== 'cadet') return;
        const getSseUrl = () => {
            const base = import.meta.env.VITE_API_URL || '';
            if (base && /^https?:/.test(String(base))) {
                return `${String(base).replace(/\/+$/, '')}/api/attendance/events`;
            }
            return '/api/attendance/events';
        };

        let es;
        const connectSSE = () => {
            try {
                es = new EventSource(getSseUrl());
                es.onopen = () => setEsConnected(true);
                es.onmessage = async (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        if (data.type === 'grade_updated') {
                            const res = await axios.get(`/api/cadet/my-grades?t=${Date.now()}`);
                            setGrades(res.data);
                            await cacheSingleton('dashboard', 'cadet_grades', { data: res.data, timestamp: Date.now() });
                            
                            // Also refresh logs
                            try { await fetchLogs(); } catch {}
                            
                            // Also refresh attendance list to keep sections in sync
                            try { await fetchAttendance(attendanceFilters); } catch {}
                        } else if (data.type === 'attendance_updated') {
                            try { await fetchAttendance(attendanceFilters); } catch {}
                        }
                    } catch {}
                };
                es.onerror = () => {
                    setEsConnected(false);
                    if (es) es.close();
                    setTimeout(connectSSE, 3000);
                };
            } catch {}
        };
        connectSSE();
        return () => { try { es && es.close(); } catch {} };
    }, [user]);

    useEffect(() => {
        if (!user || user.role !== 'cadet') return;
        const summary = analyzeCadetDashboard({
            grades,
            attendance: attendanceLogs
        });
        setAiSummary(summary);
    }, [user, grades, attendanceLogs]);

    if (loading) return <div className="text-center p-10">Loading...</div>;

    return (
        <div className="space-y-6 md:space-y-8 p-4 md:p-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">My Portal</h1>
                <div className="flex items-center gap-2 md:gap-3">
                    <span className={`px-2 md:px-3 py-1 rounded text-xs font-bold ${esConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                        {esConnected ? 'Live Sync On' : 'Offline'}
                    </span>
                    <button
                        onClick={refreshAll}
                        className="px-3 py-2 rounded bg-[var(--primary-color)] text-white text-sm hover:opacity-90 min-h-[44px] hover-highlight"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {aiSummary && aiSummary.text && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {aiSummary.text}
                </div>
            )}

            {/* Grades Section */}
            <div className="space-y-4 md:space-y-6">
                {(() => {
                    const gradeData = grades || {
                        attendanceScore: 0,
                        attendance_present: 0,
                        totalTrainingDays: 0,
                        aptitudeScore: 0,
                        merit_points: 0,
                        demerit_points: 0,
                        subjectScore: 0,
                        prelim_score: 0,
                        midterm_score: 0,
                        final_score: 0,
                        finalGrade: 0,
                        transmutedGrade: '5.00',
                        remarks: 'No Data'
                    };
                    return (
                    <>
                        <div className="bg-white rounded shadow p-4 md:p-6">
                            <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 border-b pb-2">Final Assessment</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                <div className="bg-gray-100 p-4 md:p-6 rounded text-center border">
                                    <h3 className="text-xs md:text-sm text-gray-800 font-semibold uppercase tracking-wider">Final Grade (Numerical)</h3>
                                    <div className="text-4xl md:text-5xl font-bold mt-2 md:mt-3 text-gray-800">{Number(gradeData.finalGrade).toFixed(2)}</div>
                                </div>
                                <div className={`p-4 md:p-6 rounded text-center shadow-md transform transition-transform ${
                                    gradeData.transmutedGrade === '5.00' || ['DO', 'INC', 'T'].includes(gradeData.transmutedGrade)
                                    ? 'bg-red-600 text-white'
                                    : 'bg-green-600 text-white'
                                }`}>
                                    <h3 className="text-xs md:text-sm font-semibold uppercase tracking-wider opacity-90">Transmuted Grade</h3>
                                    <div className="text-5xl md:text-6xl font-extrabold mt-2">{gradeData.transmutedGrade}</div>
                                    <div className="text-lg md:text-xl font-medium mt-2 uppercase tracking-wide border-t border-white/30 pt-2 inline-block px-3 md:px-4">
                                        {gradeData.remarks}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Subject Proficiency */}
                        <div className="bg-white rounded shadow p-4 md:p-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 md:mb-4 border-b pb-2 gap-2">
                            <h2 className="text-lg md:text-xl font-bold text-purple-800 flex items-center">
                                    <Info className="mr-2 tilt-media" size={18} />
                                    Subject Proficiency (40%)
                                </h2>
                                <div>
                                    <span className="text-xl md:text-2xl font-bold text-purple-900">{Number(gradeData.subjectScore).toFixed(2)} pts</span>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded -mx-4 md:mx-0">
                                <div className="inline-block min-w-full align-middle px-4 md:px-0">
                                    <table className="w-full text-left border-collapse min-w-[300px]">
                                        <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                                            <tr className="border-b">
                                                <th className="p-2 md:p-3 font-semibold text-gray-600 text-sm">Prelim</th>
                                                <th className="p-2 md:p-3 font-semibold text-gray-600 text-sm">Midterm</th>
                                                <th className="p-2 md:p-3 font-semibold text-gray-600 text-sm">Final</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="p-2 md:p-3 font-bold text-sm">{gradeData.prelim_score}</td>
                                                <td className="p-2 md:p-3 font-bold text-sm">{gradeData.midterm_score}</td>
                                                <td className="p-2 md:p-3 font-bold text-sm">{gradeData.final_score}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 3. Attendance Section */}
                        <div className="bg-white rounded shadow p-4 md:p-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 md:mb-4 border-b pb-2 gap-2">
                                <h2 className="text-lg md:text-xl font-bold text-blue-800 flex items-center">
                                    <Calendar className="mr-2 tilt-media" size={18} />
                                    Attendance History (30%)
                                </h2>
                                <div className="text-left md:text-right">
                                    <span className="text-xl md:text-2xl font-bold text-blue-900">{Number(gradeData.attendanceScore).toFixed(2)} pts</span>
                                    <span className="text-xs md:text-sm text-gray-500 ml-2">({gradeData.attendance_present} / {gradeData.totalTrainingDays} days)</span>
                                    <span className="text-xs text-gray-500 ml-2 block">
                                        Present: {gradeData.attendance_present} • Absent: {Math.max(0, (gradeData.totalTrainingDays || 0) - (gradeData.attendance_present || 0))}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded -mx-4 md:mx-0">
                                <div className="inline-block min-w-full align-middle px-4 md:px-0">
                                    <table className="w-full text-left border-collapse min-w-[300px]">
                                        <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                                            <tr className="border-b">
                                                <th className="p-2 md:p-3 font-semibold text-gray-600 text-sm">Date</th>
                                                <th className="p-2 md:p-3 font-semibold text-gray-600 text-sm">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                        {(() => {
                                            const paged = attendanceLogs && attendanceLogs.items ? attendanceLogs : { items: Array.isArray(attendanceLogs) ? attendanceLogs : [], total: attendanceLogs?.total || 0, page: 1, pageSize: attendanceLogs?.pageSize || (attendanceLogs?.total || 0) };
                                            return paged.items.length > 0 ? paged.items.map(log => (
                                                <tr key={log.id || `${log.date}-${log.title}`} className="border-b hover:bg-gray-50">
                                                    <td className="p-2 md:p-3 text-xs md:text-sm">{new Date(log.date).toLocaleDateString()}</td>
                                                    <td className="p-2 md:p-3">
                                                        {(() => {
                                                            const s = (log.status || 'unmarked').toLowerCase();
                                                            const cls = s === 'present' ? 'bg-green-100 text-green-800'
                                                                : s === 'late' ? 'bg-yellow-100 text-yellow-800'
                                                                : s === 'excused' ? 'bg-blue-100 text-blue-800'
                                                                : s === 'absent' ? 'bg-red-100 text-red-800'
                                                                : 'bg-gray-100 text-gray-700';
                                                            const label = s.charAt(0).toUpperCase() + s.slice(1);
                                                            return (
                                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${cls}`}>
                                                                    {label}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="6" className="p-4 text-center text-gray-500">No attendance records found.</td>
                                                </tr>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                            
                        </div>

                        {
                            <div className="bg-white rounded shadow p-4 md:p-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 md:mb-4 border-b pb-2 gap-2">
                                    <h2 className="text-lg md:text-xl font-bold text-green-800 flex items-center">
                                        <AlertCircle className="mr-2 tilt-media" size={18} />
                                        Merit & Demerit Records (30%)
                                    </h2>
                                    <div className="text-left md:text-right">
                                        <span className="text-xl md:text-2xl font-bold text-green-900">{Number(gradeData.aptitudeScore).toFixed(2)} pts</span>
                                        <span className="text-xs md:text-sm text-gray-500 ml-2 block">
                                            (Merits: {gradeData.merit_points} | Demerits: {gradeData.demerit_points})
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Lifetime Merit & Ceiling Status */}
                                {(() => {
                                    const rawAptitude = 100 + (gradeData.merit_points || 0) - (gradeData.demerit_points || 0);
                                    const cappedAptitude = Math.min(100, Math.max(0, rawAptitude));
                                    const isAtCeiling = cappedAptitude === 100 && rawAptitude >= 100;
                                    const wastedPoints = Math.max(0, rawAptitude - 100);
                                    const lifetimeMerit = gradeData.lifetime_merit_points || gradeData.merit_points || 0;
                                    
                                    return (
                                        <div className="mb-3 md:mb-4 space-y-3">
                                            {/* Current Aptitude Score */}
                                            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 md:p-4 rounded-lg border border-green-200">
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
                                                    <div className="flex-1">
                                                        <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1">Current Aptitude Score</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-2xl md:text-3xl font-bold text-green-700">{cappedAptitude}</span>
                                                            <span className="text-base md:text-lg text-gray-500">/ 100</span>
                                                            {isAtCeiling && (
                                                                <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full border border-yellow-300">
                                                                    AT CEILING
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            Formula: 100 + Merits ({gradeData.merit_points}) - Demerits ({gradeData.demerit_points}) = {rawAptitude} → {cappedAptitude}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 md:border-8 border-green-500 flex items-center justify-center bg-white shadow-lg tilt-media">
                                                            <span className="text-xl md:text-2xl font-bold text-green-700">{cappedAptitude}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Lifetime Merit Achievement */}
                                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 md:p-4 rounded-lg border border-purple-200">
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
                                                    <div className="flex-1">
                                                        <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                                                            <span className="text-purple-600">🏆</span>
                                                            Lifetime Merit Achievement
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-2xl md:text-3xl font-bold text-purple-700">{lifetimeMerit}</span>
                                                            <span className="text-xs md:text-sm text-gray-600">total merits earned</span>
                                                        </div>
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            This tracks all merit points you've earned throughout your ROTC career
                                                        </p>
                                                    </div>
                                                    {lifetimeMerit >= 100 && (
                                                        <div className="text-center">
                                                            <div className="text-3xl md:text-4xl mb-1">🌟</div>
                                                            <p className="text-xs font-bold text-purple-700">Century Club</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Wasted Points Warning */}
                                            {wastedPoints > 0 && (
                                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                                    <div className="flex items-start">
                                                        <div className="flex-shrink-0">
                                                            <AlertCircle className="h-5 w-5 text-yellow-400" />
                                                        </div>
                                                        <div className="ml-3">
                                                            <h3 className="text-sm font-medium text-yellow-800">
                                                                Merit Points at Ceiling
                                                            </h3>
                                                            <div className="mt-2 text-sm text-yellow-700">
                                                                <p>
                                                                    You've earned <strong>{wastedPoints} extra merit points</strong> beyond the 100-point ceiling. 
                                                                    These points are tracked in your lifetime total but don't increase your current aptitude score.
                                                                </p>
                                                                <p className="mt-1 text-xs">
                                                                    💡 Your lifetime achievement of <strong>{lifetimeMerit} merits</strong> is still recognized for awards and honors!
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                
                                <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded -mx-4 md:mx-0">
                                    <div className="inline-block min-w-full align-middle px-4 md:px-0">
                                        <table className="w-full text-left border-collapse min-w-[400px]">
                                            <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                                                <tr className="border-b">
                                                    <th className="p-2 md:p-3 font-semibold text-gray-600 text-xs md:text-sm">Date</th>
                                                    <th className="p-2 md:p-3 font-semibold text-gray-600 text-xs md:text-sm">Type</th>
                                                    <th className="p-2 md:p-3 font-semibold text-gray-600 text-xs md:text-sm">Points</th>
                                                    <th className="p-2 md:p-3 font-semibold text-gray-600 text-xs md:text-sm">Reason</th>
                                                    <th className="p-2 md:p-3 font-semibold text-gray-600 text-xs md:text-sm">Issued By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Array.isArray(logs) && logs.length > 0 ? logs.map(log => (
                                                        <tr key={log.id || `${log.type}-${log.points}-${log.date_recorded}`} className="border-b hover:bg-gray-50">
                                                            <td className="p-2 md:p-3 text-xs md:text-sm">{new Date(log.date_recorded).toLocaleDateString()}</td>
                                                            <td className="p-2 md:p-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                                log.type === 'merit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                            }`}>
                                                                {log.type}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 md:p-3 font-bold text-xs md:text-sm">{log.points}</td>
                                                        <td className="p-2 md:p-3 text-xs md:text-sm text-gray-600">{log.reason || '-'}</td>
                                                        <td className="p-2 md:p-3 text-xs md:text-sm text-gray-600">{log.issued_by_name || '-'}</td>
                                                    </tr>
                                            )) : (
                                                    <tr>
                                                        <td colSpan="5" className="p-3 md:p-4 text-center text-gray-500 text-sm">No records found.</td>
                                                    </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    </div>
                                </div>
                            </div>
                        }
                    </>
                    );
                })()}
            </div>



            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-4 border border-gray-100">
                <div className="flex items-center mb-3 border-b pb-1.5">
                    <Info className="text-[var(--primary-color)] mr-2 tilt-media" size={18} />
                    <h3 className="font-bold text-gray-800 text-sm">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <button 
                        onClick={() => navigate('/cadet/profile')}
                        className="flex items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors group min-h-[44px]"
                    >
                        <User className="mr-2 text-blue-600 group-hover:scale-110 transition-transform" size={18} />
                        <span className="font-semibold text-gray-700 text-xs md:text-sm">My Profile</span>
                    </button>
                    <button 
                        onClick={() => navigate('/cadet/about')}
                        className="flex items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors group min-h-[44px]"
                    >
                        <Info className="mr-2 text-green-600 group-hover:scale-110 transition-transform" size={18} />
                        <span className="font-semibold text-gray-700 text-xs md:text-sm">About System</span>
                    </button>
                    <a 
                        href="https://www.facebook.com/share/14SweZHYBFR/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors group min-h-[44px]"
                    >
                        <Link className="mr-2 text-indigo-600 group-hover:scale-110 transition-transform" size={18} />
                        <span className="font-semibold text-gray-700 text-xs md:text-sm">Official Page</span>
                    </a>
                </div>
            </div>

        </div>
    );
};

export default CadetDashboard;
