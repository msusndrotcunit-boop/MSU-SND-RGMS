import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Calendar, X, AlertCircle, User, Info, Link } from 'lucide-react';
import ExcuseLetterSubmission from '../../components/ExcuseLetterSubmission';
import { cacheData, getCachedData, getSingleton, cacheSingleton } from '../../utils/db';

const CadetDashboard = () => {
    const navigate = useNavigate();
    const [grades, setGrades] = useState(null);
    const [logs, setLogs] = useState([]);
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

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

                if (!cachedGrades || (now - cachedGrades.timestamp > CACHE_TTL)) {
                    promises.push(
                        axios.get('/api/cadet/my-grades').then(async res => {
                            setGrades(res.data);
                            await cacheSingleton('dashboard', 'cadet_grades', { data: res.data, timestamp: now });
                        }).catch(e => console.warn("Grades fetch failed", e))
                    );
                }

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

    if (loading) return <div className="text-center p-10">Loading...</div>;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">My Portal</h1>

            {/* Grades Section */}
            <div className="bg-white rounded shadow p-6">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Grading Summary</h2>
                {grades ? (
                    <div className="space-y-6">
                        {/* Raw Scores */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div 
                                className="bg-blue-50 p-4 rounded text-center cursor-pointer hover:bg-blue-100 transition"
                                onClick={() => setIsAttendanceModalOpen(true)}
                            >
                                <h3 className="text-sm text-blue-800 font-semibold uppercase">Attendance (30%)</h3>
                                <div className="text-2xl font-bold mt-2">{grades.attendanceScore.toFixed(2)} pts</div>
                                <div className="text-xs text-gray-500 mt-1">{grades.attendance_present} / 15 days</div>
                            </div>
                            <div 
                                className="bg-green-50 p-4 rounded text-center cursor-pointer hover:bg-green-100 transition"
                                onClick={() => setIsLogsModalOpen(true)}
                            >
                                <h3 className="text-sm text-green-800 font-semibold uppercase">Aptitude (30%)</h3>
                                <div className="text-2xl font-bold mt-2">{grades.aptitudeScore.toFixed(2)} pts</div>
                                <div className="text-xs text-gray-500 mt-1">M: {grades.merit_points} | D: {grades.demerit_points}</div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded text-center">
                                <h3 className="text-sm text-purple-800 font-semibold uppercase">Proficiency (40%)</h3>
                                <div className="text-2xl font-bold mt-2">{grades.subjectScore.toFixed(2)} pts</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    P: {grades.prelim_score} | M: {grades.midterm_score} | F: {grades.final_score}
                                </div>
                            </div>
                        </div>

                        {/* Final Grades */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="bg-gray-100 p-4 rounded text-center border">
                                <h3 className="text-sm text-gray-800 font-semibold uppercase">Final Grade (Numerical)</h3>
                                <div className="text-4xl font-bold mt-2 text-gray-800">{grades.finalGrade.toFixed(2)}</div>
                            </div>
                            <div className={`p-4 rounded text-center shadow-lg transform md:scale-105 ${
                                grades.transmutedGrade === '5.00' || ['DO', 'INC', 'T'].includes(grades.transmutedGrade)
                                ? 'bg-red-600 text-white'
                                : 'bg-green-600 text-white'
                            }`}>
                                <h3 className="text-sm font-semibold uppercase">Transmuted Grade</h3>
                                <div className="text-5xl font-extrabold mt-2">{grades.transmutedGrade}</div>
                                <div className="text-lg font-medium mt-1 uppercase tracking-wide">
                                    {grades.remarks}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p>No grades available yet.</p>
                )}
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
                        href="https://www.facebook.com/msusndrotc" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors group"
                    >
                        <Link className="mr-3 text-indigo-600 group-hover:scale-110 transition-transform" size={24} />
                        <span className="font-semibold text-gray-700">Official Page</span>
                    </a>
                </div>
            </div>

            {/* Attendance Modal */}
            {isAttendanceModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative animate-fadeIn">
                        <button 
                            onClick={() => setIsAttendanceModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 className="text-2xl font-bold mb-4 flex items-center">
                            <Calendar className="mr-2 text-blue-600" />
                            Attendance History
                        </h2>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b">
                                        <th className="p-2">Date</th>
                                        <th className="p-2">Status</th>
                                        <th className="p-2">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attendanceLogs.length > 0 ? (
                                        attendanceLogs.map(log => (
                                            <tr key={log.id} className="border-b hover:bg-gray-50">
                                                <td className="p-2 text-sm">{new Date(log.date).toLocaleDateString()}</td>
                                                <td className="p-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                        log.status === 'present' ? 'bg-green-100 text-green-800' : 
                                                        log.status === 'late' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-sm">{log.remarks || '-'}</td>
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
                </div>
            )}

            {/* Logs Modal */}
            {isLogsModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative animate-fadeIn">
                        <button 
                            onClick={() => setIsLogsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 className="text-2xl font-bold mb-4 flex items-center">
                            <AlertCircle className="mr-2 text-blue-600" />
                            Merit & Demerit History
                        </h2>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b">
                                        <th className="p-2">Date</th>
                                        <th className="p-2">Type</th>
                                        <th className="p-2">Points</th>
                                        <th className="p-2">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length > 0 ? (
                                        logs.map(log => (
                                            <tr key={log.id} className="border-b hover:bg-gray-50">
                                                <td className="p-2 text-sm">{new Date(log.date_recorded).toLocaleDateString()}</td>
                                                <td className="p-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                        log.type === 'merit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {log.type}
                                                    </span>
                                                </td>
                                                <td className="p-2 font-bold">{log.points}</td>
                                                <td className="p-2 text-sm">{log.reason}</td>
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
                </div>
            )}
        </div>
    );
};

export default CadetDashboard;
