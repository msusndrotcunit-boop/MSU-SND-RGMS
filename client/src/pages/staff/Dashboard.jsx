import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, CheckCircle, XCircle, Users, ClipboardCheck } from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { getSingleton, cacheSingleton } from '../../utils/db';
import ExcuseLetterManager from '../../components/ExcuseLetterManager';
import WeatherAdvisory from '../../components/WeatherAdvisory';
import { useAuth } from '../../context/AuthContext';

const StaffDashboard = () => {
    const { user } = useAuth();
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [staffRole, setStaffRole] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [staffAnalytics, setStaffAnalytics] = useState({ totalStaff: 0, staffByRank: [], attendanceStats: [] });

    useEffect(() => {
        const fetchData = async () => {
            if (!user || user.role !== 'training_staff') {
                setLoading(false);
                return;
            }
            try {
                // Try cache first
                const cached = await getSingleton('dashboard', 'staff_history');
                if (cached) {
                     let data = cached;
                     let timestamp = 0;
                     if (cached.data && cached.timestamp) {
                         data = cached.data;
                         timestamp = cached.timestamp;
                     }
                     
                     setAttendanceLogs(data);
                     setLoading(false);
                     
                     // If fresh (< 5 mins), skip fetch
                     if (timestamp && (Date.now() - timestamp < 5 * 60 * 1000)) {
                         return;
                     }
                }

                const attendanceRes = await axios.get('/api/attendance/my-history/staff');
                setAttendanceLogs(attendanceRes.data);
                
                await cacheSingleton('dashboard', 'staff_history', {
                    data: attendanceRes.data,
                    timestamp: Date.now()
                });
            } catch (err) {
                console.error("Fetch error:", err);
                // If we have data from cache, suppress error for user
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    useEffect(() => {
        const fetchStaffRole = async () => {
            if (!user || user.role !== 'training_staff') return;
            try {
                const res = await axios.get('/api/staff/me');
                setStaffRole(res.data?.role || null);
            } catch {}
        };
        fetchStaffRole();
    }, [user]);

    const canReviewExcuses =
        staffRole === 'Commandant' ||
        staffRole === 'Assistant Commandant' ||
        staffRole === 'NSTP Director' ||
        staffRole === 'ROTC Coordinator' ||
        staffRole === 'Admin NCO';

    useEffect(() => {
        if (
            staffRole !== 'Commandant' &&
            staffRole !== 'Assistant Commandant' &&
            staffRole !== 'NSTP Director' &&
            staffRole !== 'ROTC Coordinator' &&
            staffRole !== 'Admin NCO'
        ) {
            return;
        }
        const fetchStaffData = async () => {
            try {
                const cachedList = await getSingleton('analytics', 'cg_staff_list_dashboard');
                const cachedAnalytics = await getSingleton('analytics', 'cg_staff_analytics_dashboard');
                if (cachedList && cachedList.data && (Date.now() - cachedList.timestamp < 5 * 60 * 1000)) {
                    setStaffList(cachedList.data);
                }
                if (cachedAnalytics && cachedAnalytics.data && (Date.now() - cachedAnalytics.timestamp < 5 * 60 * 1000)) {
                    setStaffAnalytics(cachedAnalytics.data);
                }
                const [listRes, analyticsRes] = await Promise.allSettled([
                    axios.get('/api/staff/list'),
                    axios.get('/api/staff/analytics/overview')
                ]);
                if (listRes.status === 'fulfilled' && Array.isArray(listRes.value.data)) {
                    setStaffList(listRes.value.data);
                    await cacheSingleton('analytics', 'cg_staff_list_dashboard', { data: listRes.value.data, timestamp: Date.now() });
                }
                if (analyticsRes.status === 'fulfilled' && analyticsRes.value && analyticsRes.value.data) {
                    setStaffAnalytics(analyticsRes.value.data);
                    await cacheSingleton('analytics', 'cg_staff_analytics_dashboard', { data: analyticsRes.value.data, timestamp: Date.now() });
                }
            } catch {}
        };
        fetchStaffData();
    }, [staffRole]);

    if (loading) return <div className="text-center p-10">Loading...</div>;

    const presentCount = attendanceLogs.filter(log => log.status === 'present').length;
    const absentCount = attendanceLogs.filter(log => log.status === 'absent').length;
    const excusedCount = attendanceLogs.filter(log => log.status === 'excused').length;

    return (
        <div className="space-y-8">
            <WeatherAdvisory />
            <h1 className="text-3xl font-bold text-gray-800">My Portal</h1>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-50 p-6 rounded shadow border-l-4 border-green-500">
                    <h3 className="text-green-800 font-bold uppercase text-sm">Present</h3>
                    <p className="text-3xl font-bold mt-2">{presentCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Training Days</p>
                </div>
                <div className="bg-red-50 p-6 rounded shadow border-l-4 border-red-500">
                    <h3 className="text-red-800 font-bold uppercase text-sm">Absent</h3>
                    <p className="text-3xl font-bold mt-2">{absentCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Training Days</p>
                </div>
                <div className="bg-blue-50 p-6 rounded shadow border-l-4 border-blue-500">
                    <h3 className="text-blue-800 font-bold uppercase text-sm">Excused</h3>
                    <p className="text-3xl font-bold mt-2">{excusedCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Training Days</p>
                </div>
            </div>

            {canReviewExcuses && (
                <div>
                    <ExcuseLetterManager />
                </div>
            )}

            {canReviewExcuses && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-[var(--primary-color)]">
                        <div className="flex items-center mb-4">
                            <Users className="text-[var(--primary-color)] mr-2" size={20} />
                            <h3 className="font-bold text-gray-800">Training Staff Overview</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded bg-gray-50 p-4 text-center">
                                <div className="text-xs text-gray-500">Total Staff</div>
                                <div className="text-2xl font-bold text-gray-900">{staffAnalytics.totalStaff || 0}</div>
                            </div>
                            <div className="rounded bg-gray-50 p-4 text-center">
                                <div className="text-xs text-gray-500">Roles</div>
                                <div className="text-2xl font-bold text-gray-900">{new Set(staffList.map(s => s.role)).size || 0}</div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={staffAnalytics.staffByRank || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="rank" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-[var(--primary-color)] md:col-span-2">
                        <div className="flex items-center mb-4">
                            <ClipboardCheck className="text-[var(--primary-color)] mr-2" size={20} />
                            <h3 className="font-bold text-gray-800">Staff Attendance Stats</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={(staffAnalytics.attendanceStats || []).map(a => ({ status: a.status, count: a.count }))} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="status" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {canReviewExcuses && (
                <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-[var(--primary-color)]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <Users size={20} className="text-[var(--primary-color)] mr-2" />
                            Training Staff List
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Rank</th>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Name</th>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Role</th>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Email</th>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Contact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(staffList || []).slice(0, 20).map((s) => (
                                    <tr key={s.id}>
                                        <td className="px-4 py-2 text-gray-800">{s.rank || '-'}</td>
                                        <td className="px-4 py-2 text-gray-800">{`${s.last_name || ''}, ${s.first_name || ''}`}</td>
                                        <td className="px-4 py-2 text-gray-600">{s.role || '-'}</td>
                                        <td className="px-4 py-2 text-gray-600">{s.email || '-'}</td>
                                        <td className="px-4 py-2 text-gray-600">{s.contact_number || '-'}</td>
                                    </tr>
                                ))}
                                {(!staffList || staffList.length === 0) && (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-6 text-center text-gray-500">No training staff found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="bg-white rounded shadow p-6">
                <h2 className="text-xl font-bold mb-4 border-b pb-2 flex items-center">
                    <Calendar className="mr-2" size={20} />
                    Attendance History
                </h2>
                {attendanceLogs.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No attendance records found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {attendanceLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(log.date).toLocaleDateString(undefined, {
                                                weekday: 'short',
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${log.status === 'present' ? 'bg-green-100 text-green-800' : 
                                                  log.status === 'absent' ? 'bg-red-100 text-red-800' : 
                                                  'bg-blue-100 text-blue-800'}`}>
                                                {log.status && typeof log.status === 'string' ? log.status.toUpperCase() : 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {log.remarks || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffDashboard;

const MiniStat = ({ label, value, color }) => (
    <div className="rounded bg-gray-50 p-2 text-center">
        <div className="text-[10px] text-gray-500">{label}</div>
        <div className={`text-lg font-bold ${color}`}>{value || 0}</div>
    </div>
);
