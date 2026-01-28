import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, X, AlertCircle } from 'lucide-react';
import ExcuseLetterSubmission from '../../components/ExcuseLetterSubmission';
import { cacheData, getCachedData } from '../../utils/db';

const CadetDashboard = () => {
    const [grades, setGrades] = useState(null);
    const [activities, setActivities] = useState([]);
    const [logs, setLogs] = useState([]);
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                try {
                    const cachedGrades = await getCachedData('grades');
                    if (cachedGrades && cachedGrades.length > 0) setGrades(cachedGrades[0]);
                } catch {}
                try {
                    const gradesRes = await axios.get('/api/cadet/my-grades');
                    setGrades(gradesRes.data);
                    await cacheData('grades', [gradesRes.data]);
                } catch {}

                try {
                    const cachedActivities = await getCachedData('activities');
                    if (cachedActivities && cachedActivities.length > 0) setActivities(cachedActivities);
                } catch {}
                try {
                    const activitiesRes = await axios.get('/api/cadet/activities');
                    setActivities(activitiesRes.data);
                    await cacheData('activities', activitiesRes.data);
                } catch {}

                try {
                    const cachedLogs = await getCachedData('merit_demerit_logs');
                    if (cachedLogs && cachedLogs.length > 0) setLogs(cachedLogs);
                } catch {}
                try {
                    const logsRes = await axios.get('/api/cadet/my-merit-logs');
                    setLogs(logsRes.data);
                    await cacheData('merit_demerit_logs', logsRes.data);
                } catch {}

                try {
                    const cachedAttendance = await getCachedData('attendance_records');
                    if (cachedAttendance && cachedAttendance.length > 0) setAttendanceLogs(cachedAttendance);
                } catch {}
                try {
                    const attendanceRes = await axios.get('/api/attendance/my-history');
                    setAttendanceLogs(attendanceRes.data);
                    await cacheData('attendance_records', attendanceRes.data);
                } catch {}

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

            {/* Activities Section */}
            <div>
                <h2 className="text-xl font-bold mb-4">Upcoming Activities</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activities.length > 0 ? activities.map(activity => (
                        <div key={activity.id} className="bg-white rounded shadow overflow-hidden">
                            {activity.image_path && (
                                <img 
                                    src={activity.image_path.startsWith('data:') ? activity.image_path : `/uploads/${activity.image_path.replace(/\\/g, '/')}`} 
                                    alt={activity.title} 
                                    className="w-full h-48 object-cover"
                                />
                            )}
                            <div className="p-4">
                                <h3 className="font-bold text-lg mb-2">{activity.title}</h3>
                                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{activity.description}</p>
                                <div className="flex items-center text-gray-500 text-sm">
                                    <Calendar size={16} className="mr-2" />
                                    {new Date(activity.date).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full bg-white p-6 rounded shadow text-center text-gray-500">
                            No upcoming activities.
                        </div>
                    )}
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

            {/* Secure Documents / Excuse Letters */}
            <div className="bg-white rounded shadow p-6">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Excuse Letters & Documents</h2>
                <ExcuseLetterSubmission />
            </div>

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
