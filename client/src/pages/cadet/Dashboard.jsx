import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Calendar, AlertCircle, User, Info, Link } from 'lucide-react';
import ExcuseLetterSubmission from '../../components/ExcuseLetterSubmission';
import { cacheData, getCachedData, getSingleton, cacheSingleton } from '../../utils/db';

const CadetDashboard = () => {
    const navigate = useNavigate();
    const [grades, setGrades] = useState(null);
    const [logs, setLogs] = useState([]);
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [esConnected, setEsConnected] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Try Cache First & Render Immediately
                let hasCachedData = false;
                
                const cachedGrades = await getSingleton('dashboard', 'cadet_grades');
                if (cachedGrades) {
                    setGrades(cachedGrades.data);
                    hasCachedData = true;
                }

                const cachedLogs = await getSingleton('dashboard', 'cadet_logs');
                if (cachedLogs) {
                    setLogs(cachedLogs.data);
                    hasCachedData = true;
                }

                const cachedAttendance = await getSingleton('dashboard', 'cadet_attendance');
                if (cachedAttendance) {
                    setAttendanceLogs(cachedAttendance.data);
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

                promises.push(
                    axios.get('/api/cadet/my-grades').then(async res => {
                        setGrades(res.data);
                        await cacheSingleton('dashboard', 'cadet_grades', { data: res.data, timestamp: now });
                    }).catch(e => {
                        console.warn("Grades fetch failed", e);
                        setGrades({
                            attendanceScore: 0,
                            attendance_present: 0,
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
                        });
                    })
                );

                if (!cachedLogs || (now - cachedLogs.timestamp > CACHE_TTL)) {
                    promises.push(
                        axios.get('/api/cadet/my-merit-logs').then(async res => {
                            setLogs(res.data);
                            await cacheSingleton('dashboard', 'cadet_logs', { data: res.data, timestamp: now });
                        }).catch(e => console.warn("Logs fetch failed", e))
                    );
                }

                if (!cachedAttendance || (now - cachedAttendance.timestamp > CACHE_TTL)) {
                    promises.push(
                        axios.get('/api/attendance/my-history').then(async res => {
                            setAttendanceLogs(res.data);
                            await cacheSingleton('dashboard', 'cadet_attendance', { data: res.data, timestamp: now });
                        }).catch(e => console.warn("Attendance fetch failed", e))
                    );
                }

                await Promise.allSettled(promises);

            } catch (err) {
                console.error("General fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const refresh = async () => {
            try {
                const res = await axios.get('/api/cadet/my-grades');
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
    }, []);

    useEffect(() => {
        let es;
        const connectSSE = () => {
            try {
                es = new EventSource('/api/attendance/events');
                es.onopen = () => setEsConnected(true);
                es.onmessage = async (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        if (data.type === 'grade_updated') {
                            const res = await axios.get('/api/cadet/my-grades');
                            setGrades(res.data);
                            await cacheSingleton('dashboard', 'cadet_grades', { data: res.data, timestamp: Date.now() });
                            
                            // Also refresh logs
                            const logRes = await axios.get('/api/cadet/my-merit-logs');
                            setLogs(logRes.data);
                            await cacheSingleton('dashboard', 'cadet_logs', { data: logRes.data, timestamp: Date.now() });
                            
                            // Also refresh attendance list to keep sections in sync
                            try {
                                const attRes = await axios.get('/api/attendance/my-history');
                                setAttendanceLogs(attRes.data);
                                await cacheSingleton('dashboard', 'cadet_attendance', { data: attRes.data, timestamp: Date.now() });
                            } catch {}
                        } else if (data.type === 'attendance_updated') {
                            const res = await axios.get('/api/attendance/my-history');
                            setAttendanceLogs(res.data);
                            await cacheSingleton('dashboard', 'cadet_attendance', { data: res.data, timestamp: Date.now() });
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
    }, []);

    if (loading) return <div className="text-center p-10">Loading...</div>;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">My Portal</h1>

            {/* Grades Section */}
            <div className="space-y-6">
                {(() => {
                    const gradeData = grades || {
                        attendanceScore: 0,
                        attendance_present: 0,
                        totalTrainingDays: 15,
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
                        {/* 1. Attendance Section */}
                        <div className="bg-white rounded shadow p-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-2">
                                <h2 className="text-xl font-bold text-blue-800 flex items-center">
                                    <Calendar className="mr-2" size={20} />
                                    Attendance History (30%)
                                </h2>
                                <div className="mt-2 md:mt-0 text-right">
                                    <span className="text-2xl font-bold text-blue-900">{Number(gradeData.attendanceScore).toFixed(2)} pts</span>
                                    <span className="text-sm text-gray-500 ml-2">({gradeData.attendance_present} / {gradeData.totalTrainingDays} days)</span>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                                        <tr className="border-b">
                                            <th className="p-3 font-semibold text-gray-600">Date</th>
                                            <th className="p-3 font-semibold text-gray-600">Status</th>
                                            <th className="p-3 font-semibold text-gray-600">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceLogs.length > 0 ? (
                                            attendanceLogs.map(log => (
                                                <tr key={log.id} className="border-b hover:bg-gray-50">
                                                    <td className="p-3 text-sm">{new Date(log.date).toLocaleDateString()}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                            log.status === 'present' ? 'bg-green-100 text-green-800' : 
                                                            log.status === 'late' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                            {log.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-600">{log.remarks || '-'}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="3" className="p-4 text-center text-gray-500">No attendance records found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 2. Merit & Demerit Records */}
                        <div className="bg-white rounded shadow p-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-2">
                                <h2 className="text-xl font-bold text-green-800 flex items-center">
                                    <AlertCircle className="mr-2" size={20} />
                                    Merit & Demerit Records (30%)
                                </h2>
                                <div className="mt-2 md:mt-0 text-right">
                                    <span className="text-2xl font-bold text-green-900">{Number(gradeData.aptitudeScore).toFixed(2)} pts</span>
                                    <span className="text-sm text-gray-500 ml-2 block md:inline">
                                        (Merits: {gradeData.merit_points} | Demerits: {gradeData.demerit_points})
                                    </span>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                                        <tr className="border-b">
                                            <th className="p-3 font-semibold text-gray-600">Date</th>
                                            <th className="p-3 font-semibold text-gray-600">Type</th>
                                            <th className="p-3 font-semibold text-gray-600">Points</th>
                                            <th className="p-3 font-semibold text-gray-600">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.length > 0 ? (
                                            logs.map(log => (
                                                <tr key={log.id} className="border-b hover:bg-gray-50">
                                                    <td className="p-3 text-sm">{new Date(log.date_recorded).toLocaleDateString()}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                            log.type === 'merit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                            {log.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-bold">{log.points}</td>
                                                    <td className="p-3 text-sm text-gray-600">{log.reason}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="p-4 text-center text-gray-500">No records found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 3. Subject Proficiency */}
                        <div className="bg-white rounded shadow p-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-2">
                                <h2 className="text-xl font-bold text-purple-800 flex items-center">
                                    <Info className="mr-2" size={20} />
                                    Subject Proficiency (40%)
                                </h2>
                                <div className="mt-2 md:mt-0">
                                    <span className="text-2xl font-bold text-purple-900">{Number(gradeData.subjectScore).toFixed(2)} pts</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gray-50 p-4 rounded text-center border">
                                    <div className="text-sm font-semibold text-gray-500 uppercase">Prelim</div>
                                    <div className="text-2xl font-bold text-gray-800 mt-1">{gradeData.prelim_score}</div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded text-center border">
                                    <div className="text-sm font-semibold text-gray-500 uppercase">Midterm</div>
                                    <div className="text-2xl font-bold text-gray-800 mt-1">{gradeData.midterm_score}</div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded text-center border">
                                    <div className="text-sm font-semibold text-gray-500 uppercase">Final</div>
                                    <div className="text-2xl font-bold text-gray-800 mt-1">{gradeData.final_score}</div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Final Grades */}
                        <div className="bg-white rounded shadow p-6">
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">Final Assessment</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gray-100 p-6 rounded text-center border">
                                    <h3 className="text-sm text-gray-800 font-semibold uppercase tracking-wider">Final Grade (Numerical)</h3>
                                    <div className="text-5xl font-bold mt-3 text-gray-800">{Number(gradeData.finalGrade).toFixed(2)}</div>
                                </div>
                                <div className={`p-6 rounded text-center shadow-md transform transition-transform ${
                                    gradeData.transmutedGrade === '5.00' || ['DO', 'INC', 'T'].includes(gradeData.transmutedGrade)
                                    ? 'bg-red-600 text-white'
                                    : 'bg-green-600 text-white'
                                }`}>
                                    <h3 className="text-sm font-semibold uppercase tracking-wider opacity-90">Transmuted Grade</h3>
                                    <div className="text-6xl font-extrabold mt-2">{gradeData.transmutedGrade}</div>
                                    <div className="text-xl font-medium mt-2 uppercase tracking-wide border-t border-white/30 pt-2 inline-block px-4">
                                        {gradeData.remarks}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                    );
                })()}
            </div>



            {/* Secure Documents / Excuse Letters */}
            <div className="bg-white rounded shadow p-6">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Excuse Letters & Documents</h2>
                <ExcuseLetterSubmission />
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded shadow p-6">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Quick Links</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button 
                        onClick={() => navigate('/cadet/profile')}
                        className="flex items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors group"
                    >
                        <User className="mr-3 text-blue-600 group-hover:scale-110 transition-transform" size={24} />
                        <span className="font-semibold text-gray-700">My Profile</span>
                    </button>
                    <button 
                        onClick={() => navigate('/cadet/about')}
                        className="flex items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors group"
                    >
                        <Info className="mr-3 text-green-600 group-hover:scale-110 transition-transform" size={24} />
                        <span className="font-semibold text-gray-700">About System</span>
                    </button>
                    <a 
                        href="https://www.facebook.com/share/14SweZHYBFR/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors group"
                    >
                        <Link className="mr-3 text-indigo-600 group-hover:scale-110 transition-transform" size={24} />
                        <span className="font-semibold text-gray-700">Official Page</span>
                    </a>
                </div>
            </div>


        </div>
    );
};

export default CadetDashboard;
