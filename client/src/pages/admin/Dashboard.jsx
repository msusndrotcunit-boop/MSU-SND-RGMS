import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
    Activity, CheckCircle, AlertTriangle, XCircle, UserMinus, Calendar, Mail, Zap, ClipboardCheck, Calculator, MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSingleton, cacheSingleton } from '../../utils/db';
import WeatherAdvisory from '../../components/WeatherAdvisory';
import ChartWrapper from '../../components/ChartWrapper';

const STATUS_COLORS = {
    Ongoing: '#06b6d4', // cyan-500
    Completed: '#22c55e', // green-500
    Incomplete: '#f59e0b', // amber-500
    Failed: '#ef4444', // red-500
    Drop: '#6b7280' // gray-500
};

const Dashboard = () => {
    const [stats, setStats] = useState({
        ongoing: 0,
        completed: 0,
        incomplete: 0,
        failed: 0,
        drop: 0
    });
    const [courseData, setCourseData] = useState([]);
    const [courseCards, setCourseCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState([]);
    const [showLocations, setShowLocations] = useState(() => {
        try {
            const hide = typeof window !== 'undefined' ? (localStorage.getItem('rgms_hide_admin_map') === 'true') : true;
            return !hide;
        } catch {
            return false;
        }
    });
    const role = (typeof window !== 'undefined' ? (localStorage.getItem('role') || '').toLowerCase() : 'admin');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const cached = await getSingleton('analytics', 'dashboard_v2');
                if (cached && cached.timestamp && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
                    processData(cached.data);
                    setLoading(false);
                }
                const res = await axios.get('/api/admin/analytics');
                processData(res.data);
                await cacheSingleton('analytics', 'dashboard_v2', { 
                    data: res.data, 
                    timestamp: Date.now() 
                });
                setLoading(false);
            } catch (err) {
                console.error("Dashboard fetch error:", err);
                setLoading(false);
            }
        };
        fetchData();
        const getSseUrl = () => {
            const base = import.meta.env.VITE_API_URL || '';
            if (base && /^https?:/.test(String(base))) {
                return `${String(base).replace(/\/+$/, '')}/api/attendance/events`;
            }
            return '/api/attendance/events';
        };

        let es;
        const connect = () => {
            try {
                es = new EventSource(getSseUrl());
                es.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        const types = new Set([
                            'cadet_updated','cadet_created','cadet_deleted',
                            'cadet_profile_updated','attendance_updated','grade_updated',
                            'staff_attendance_updated'
                        ]);
                        if (types.has(data.type)) {
                            fetchData();
                            if (role === 'admin' && showLocations && data.type === 'location_update') {
                                fetchLocations();
                            }
                        }
                    } catch {}
                };
                es.onerror = () => {
                    try { es && es.close(); } catch {}
                    setTimeout(connect, 3000);
                };
            } catch {}
        };
        connect();
        return () => { try { es && es.close(); } catch {} };
    }, []);

    const fetchLocations = React.useCallback(async () => {
        try {
            const res = await axios.get('/api/admin/locations');
            setLocations(res.data || []);
        } catch (err) {
        }
    }, []);

    useEffect(() => {
        const onToggle = (e) => {
            try {
                const hide = e?.detail?.hide === true;
                setShowLocations(!hide);
            } catch {}
        };
        window.addEventListener('rgms:hide_admin_map', onToggle);
        return () => window.removeEventListener('rgms:hide_admin_map', onToggle);
    }, []);

    useEffect(() => {
        if (role !== 'admin' || !showLocations) return;
        fetchLocations();
        const id = setInterval(fetchLocations, 60000);
        return () => clearInterval(id);
    }, [role, showLocations, fetchLocations]);

    const processData = (data) => {
        const rawStats =
            (data && data.demographics && data.demographics.courseStats) ||
            (data && data.demographics && data.demographics.academicCourseStats) ||
            [];
        const total = { Ongoing: 0, Completed: 0, Incomplete: 0, Failed: 0, Drop: 0 };
        const byCourse = {};
        const allowed = new Set(['COQC','MS1', 'MS2', 'MS31', 'MS32', 'MS41', 'MS42']);
        const normalizeCourse = (s) => {
            const t = (s || '').toUpperCase().replace(/\s+/g, '').replace(/[-_.]/g, '');
            return allowed.has(t) ? t : null;
        };

        const courseAgg = {};
        rawStats.forEach(item => {
            const status = normalizeStatus(item.status);
            const courseRaw = item.cadet_course || item.course || '';
            const course = normalizeCourse(courseRaw);
            const count = Number(item.count) || 0;

            if (total[status] !== undefined) {
                total[status] += count;
            }

            if (!course) return;
            if (!byCourse[course]) {
                byCourse[course] = { name: course, total: 0 };
            }
            byCourse[course].total += count;
            if (!courseAgg[course]) {
                courseAgg[course] = { name: course, Ongoing: 0, Completed: 0, Incomplete: 0, Failed: 0, Drop: 0 };
            }
            if (courseAgg[course][status] !== undefined) {
                courseAgg[course][status] += count;
            }
        });

        setStats({
            ongoing: total.Ongoing,
            completed: total.Completed,
            incomplete: total.Incomplete,
            failed: total.Failed,
            drop: total.Drop
        });

        const chartData = Object.values(byCourse)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
        setCourseData(chartData);
        const ordered = ['COQC','MS1','MS2','MS31','MS32','MS41','MS42'].map(k => ({
            name: k,
            ...(courseAgg[k] || { name: k, Ongoing: 0, Completed: 0, Incomplete: 0, Failed: 0, Drop: 0 })
        }));
        setCourseCards(ordered);
    };

    const normalizeStatus = (status) => {
        if (!status) return 'Unknown';
        const s = status.toUpperCase();
        if (['ONGOING', 'ENROLLED', 'ACTIVE'].includes(s)) return 'Ongoing';
        if (['COMPLETED', 'GRADUATED', 'PASSED'].includes(s)) return 'Completed';
        if (['INC', 'INCOMPLETE', 'T', 'DO'].includes(s)) return 'Incomplete';
        if (['FAILED', 'FAIL'].includes(s)) return 'Failed';
        if (['DROP', 'DROPPED'].includes(s)) return 'Drop';
        return 'Ongoing'; // Default
    };

    return (
        <div className="space-y-8 p-2">
            
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="border-l-4 border-[var(--primary-color)] pl-3">ROTC Unit Dashboard</span>
                </h2>
            </div>

            <WeatherAdvisory />

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <StatusCard 
                    title="ONGOING (VERIFIED)" 
                    count={stats.ongoing} 
                    color="text-cyan-500" 
                    icon={<Activity className="h-10 w-10 text-cyan-500 mb-2" />} 
                />
                <StatusCard 
                    title="COMPLETED (VERIFIED)" 
                    count={stats.completed} 
                    color="text-green-500" 
                    icon={<CheckCircle className="h-10 w-10 text-green-500 mb-2" />} 
                />
                <StatusCard 
                    title="INCOMPLETE (VERIFIED)" 
                    count={stats.incomplete} 
                    color="text-amber-500" 
                    icon={<AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />} 
                />
                <StatusCard 
                    title="FAILED (VERIFIED)" 
                    count={stats.failed} 
                    color="text-red-500" 
                    icon={<XCircle className="h-10 w-10 text-red-500 mb-2" />} 
                />
                <StatusCard 
                    title="DROP (VERIFIED)" 
                    count={stats.drop} 
                    color="text-gray-500" 
                    icon={<UserMinus className="h-10 w-10 text-gray-500 mb-2" />} 
                />
            </div>

            {/* Chart Section */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border-t-4 border-[var(--primary-color)]">
                <div className="flex items-center mb-4">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">Cadet Status Distribution by Course (Verified Only)</h3>
                </div>
                <ChartWrapper className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={courseData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="total" fill="#2563eb" />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartWrapper>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {courseCards.map((c) => (
                    <div key={c.name} className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 border-t-4 border-[var(--primary-color)]">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-gray-800 dark:text-gray-100">{c.name}</h4>
                            <div className="text-xs text-gray-500">Total: {(c.Ongoing + c.Completed + c.Incomplete + c.Failed + c.Drop) || 0}</div>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            <MiniStat label="Ongoing" value={c.Ongoing} color="text-cyan-600" />
                            <MiniStat label="Completed" value={c.Completed} color="text-green-600" />
                            <MiniStat label="Incomplete" value={c.Incomplete} color="text-amber-600" />
                            <MiniStat label="Failed" value={c.Failed} color="text-red-600" />
                            <MiniStat label="Drop" value={c.Drop} color="text-gray-600" />
                        </div>
                    </div>
                ))}
            </div>
            {role === 'admin' && showLocations && locations.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border-t-4 border-[var(--primary-color)]">
                    <div className="flex items-center mb-4">
                        <MapPin className="text-[var(--primary-color)] mr-2" size={20} />
                        <h3 className="font-bold text-gray-800 dark:text-gray-100">Live User Locations</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">User</th>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Role</th>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Location</th>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Last Updated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {locations.map((u) => {
                                    const name =
                                        u.role === 'cadet'
                                            ? `${u.cadet_last_name || ''}, ${u.cadet_first_name || ''}`.trim()
                                            : u.role === 'training_staff'
                                            ? `${u.staff_rank || ''} ${u.staff_last_name || ''}`.trim()
                                            : u.username;
                                    const url = `https://www.google.com/maps?q=${u.last_latitude},${u.last_longitude}`;
                                    const when = u.last_location_at
                                        ? new Date(u.last_location_at).toLocaleString()
                                        : '';
                                    return (
                                        <tr key={u.id}>
                                            <td className="px-4 py-2 text-gray-800 dark:text-gray-100">{name || u.username}</td>
                                            <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-300">{u.role}</td>
                                            <td className="px-4 py-2">
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-[var(--primary-color)] hover:underline"
                                                >
                                                    {u.last_latitude.toFixed(4)}, {u.last_longitude.toFixed(4)}
                                                </a>
                                            </td>
                                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{when}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-lg p-6 text-white shadow-lg border border-green-700">
                <div className="flex items-center mb-4 border-b border-green-600 pb-2">
                    <Zap className="text-yellow-400 mr-2" size={20} />
                    <h3 className="font-bold text-yellow-50">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <ActionButton 
                        to="/admin/data-analysis" 
                        label="Data Analysis" 
                        icon={<Activity size={18} />} 
                        className="bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-all duration-200"
                    />
                    <ActionButton 
                        to="/admin/grading" 
                        label="Grading" 
                        icon={<Calculator size={18} />} 
                        className="bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-all duration-200"
                    />
                    <ActionButton 
                        to="/admin/attendance" 
                        label="Attendance" 
                        icon={<ClipboardCheck size={18} />} 
                        className="bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-all duration-200"
                    />
                    <ActionButton 
                        to="/admin/messages" 
                        label="Messages" 
                        icon={<Mail size={18} />} 
                        className="bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-all duration-200"
                    />
                    <ActionButton 
                        to="/admin/activities" 
                        label="Activities" 
                        icon={<Calendar size={18} />} 
                        className="bg-yellow-500 hover:bg-yellow-400 text-green-900 font-bold shadow-lg border-2 border-yellow-300"
                    />
                </div>
            </div>
            
            
            
        </div>
    );
};

export default Dashboard;


const StatusCard = ({ title, count, color, icon }) => (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 border-t-4 border-[var(--primary-color)]">
        <div className="flex flex-col items-center">
            {icon}
            <div className="text-xs text-gray-500 mt-1">{title}</div>
            <div className={`text-2xl font-bold ${color}`}>{count || 0}</div>
        </div>
    </div>
);

const ActionButton = ({ to, label, icon, className }) => (
    <Link
        to={to}
        className={`flex items-center justify-center px-4 py-2 rounded ${className}`}
    >
        <span className="mr-2">{icon}</span>
        <span className="text-xs md:text-sm">{label}</span>
    </Link>
);

const MiniStat = ({ label, value, color }) => (
    <div className="rounded bg-gray-50 dark:bg-gray-800 p-2 text-center">
        <div className="text-[10px] text-gray-500 dark:text-gray-400">{label}</div>
        <div className={`text-lg font-bold ${color}`}>{value || 0}</div>
    </div>
);
