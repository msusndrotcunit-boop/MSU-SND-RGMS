import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
    Activity, CheckCircle, AlertTriangle, XCircle, UserMinus, 
    BookOpen, Calendar, Mail, Zap, ClipboardCheck, Facebook, Twitter, Linkedin, Calculator, MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSingleton, cacheSingleton } from '../../utils/db';
import WeatherAdvisory from '../../components/WeatherAdvisory';

const STATUS_COLORS = {
    Ongoing: '#06b6d4', // cyan-500
    Completed: '#22c55e', // green-500
    Incomplete: '#f59e0b', // amber-500
    Failed: '#ef4444', // red-500
    Drop: '#6b7280' // gray-500
};

const Dashboard = () => {
    const { user } = useAuth();
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const hasMapsKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const [hideAdminMap, setHideAdminMap] = useState(false);

    const loadGoogleMaps = (key) => {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.maps) {
                resolve();
                return;
            }
            const existing = document.querySelector('script[data-google-maps]');
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', reject);
                return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
            script.async = true;
            script.defer = true;
            script.setAttribute('data-google-maps', 'true');
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Google Maps'));
            document.head.appendChild(script);
        });
    };

    const updateMarkers = () => {
        if (!mapInstanceRef.current || !window.google || !window.google.maps) return;
        markersRef.current.forEach((marker) => { try { marker.setMap(null); } catch {} });
        markersRef.current = [];
        if (!locations || locations.length === 0) return;
        const bounds = new window.google.maps.LatLngBounds();
        locations.slice(0, 200).forEach(u => {
            const pos = { lat: Number(u.last_latitude), lng: Number(u.last_longitude) };
            const marker = new window.google.maps.Marker({
                position: pos,
                map: mapInstanceRef.current,
                title: `${u.username || ''} • ${u.role || ''}`
            });
            markersRef.current.push(marker);
            bounds.extend(pos);
        });
        try { mapInstanceRef.current.fitBounds(bounds); } catch {}
    };

    useEffect(() => {
        if (user?.role !== 'admin' || !hasMapsKey || hideAdminMap) return;
        loadGoogleMaps(import.meta.env.VITE_GOOGLE_MAPS_API_KEY).then(() => {
            if (!mapInstanceRef.current && mapRef.current) {
                mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                    mapTypeId: 'roadmap',
                    disableDefaultUI: true
                });
            }
            updateMarkers();
        }).catch(() => {});
    }, [user, hasMapsKey, locations, hideAdminMap]);
    const [stats, setStats] = useState({
        ongoing: 0,
        completed: 0,
        incomplete: 0,
        failed: 0,
        drop: 0
    });
    const [courseData, setCourseData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState([]);

    useEffect(() => {
        try {
            const v = localStorage.getItem('rgms_hide_admin_map') === 'true';
            setHideAdminMap(v);
        } catch {}
        const onToggle = (e) => {
            try {
                const next = !!(e && e.detail && e.detail.hide);
                setHideAdminMap(next);
            } catch {}
        };
        window.addEventListener('rgms:hide_admin_map', onToggle);
        return () => window.removeEventListener('rgms:hide_admin_map', onToggle);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Try cache first
                const cached = await getSingleton('analytics', 'dashboard_v2');
                if (cached && cached.timestamp && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
                    processData(cached.data);
                    setLoading(false);
                }

                // Fetch fresh data
                const res = await axios.get('/api/admin/analytics');
                processData(res.data);
                
                // Update cache
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
    }, []);

    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const res = await axios.get('/api/admin/locations');
                setLocations(res.data || []);
            } catch (err) {
                console.error('Location fetch error:', err);
            }
        };
        fetchLocations();
        const id = setInterval(fetchLocations, 60000);
        return () => clearInterval(id);
    }, []);

    

    const processData = (data) => {
        const rawStats = data.demographics?.courseStats || [];
        const total = { Ongoing: 0, Completed: 0, Incomplete: 0, Failed: 0, Drop: 0 };
        const byCourse = {};
        const courses = ['COQC', 'MS1', 'MS2', 'MS31', 'MS32', 'MS41', 'MS42'];
        const verifiedCourses = new Set(['MS1', 'MS2', 'MS31', 'MS32', 'MS41', 'MS42']);

        courses.forEach(c => {
            byCourse[c] = { name: c, Ongoing: 0, Completed: 0, Incomplete: 0, Failed: 0, Drop: 0, total: 0 };
        });

        rawStats.forEach(item => {
            const status = normalizeStatus(item.status);
            const course = (item.cadet_course || 'Unknown').toUpperCase();
            const count = Number(item.count) || 0;
            const includeInTotals = verifiedCourses.has(course);

            if (includeInTotals && total[status] !== undefined) {
                total[status] += count;
            }

            const courseKey = course || 'Unknown';

            if (!byCourse[courseKey] && courseKey !== 'Unknown') {
                byCourse[courseKey] = { 
                    name: courseKey, 
                    Ongoing: 0, Completed: 0, Incomplete: 0, Failed: 0, Drop: 0, total: 0 
                };
            }

            if (byCourse[courseKey] && byCourse[courseKey][status] !== undefined) {
                byCourse[courseKey][status] += count;
                byCourse[courseKey].total += count;
            }
        });

        setStats({
            ongoing: total.Ongoing,
            completed: total.Completed,
            incomplete: total.Incomplete,
            failed: total.Failed,
            drop: total.Drop
        });

        // Convert byCourse object to array for Recharts, filtering out empty unknown courses
        const chartData = Object.values(byCourse);
        setCourseData(chartData);
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
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border-t-4 border-gray-800 dark:border-[var(--primary-color)]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center">
                        <BookOpen size={20} className="text-[var(--primary-color)] mr-2" />
                        Cadet Status Distribution by Course (Verified Only)
                    </h3>
                </div>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={courseData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                cursor={{ fill: '#f3f4f6' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            <Bar dataKey="Ongoing" fill={STATUS_COLORS.Ongoing} radius={[4, 4, 0, 0]} barSize={40} />
                            <Bar dataKey="Completed" fill={STATUS_COLORS.Completed} radius={[4, 4, 0, 0]} barSize={40} />
                            <Bar dataKey="Incomplete" fill={STATUS_COLORS.Incomplete} radius={[4, 4, 0, 0]} barSize={40} />
                            <Bar dataKey="Failed" fill={STATUS_COLORS.Failed} radius={[4, 4, 0, 0]} barSize={40} />
                            <Bar dataKey="Drop" fill={STATUS_COLORS.Drop} radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            

            {/* Course Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {courseData.map((course) => (
                    <CourseCard key={course.name} data={course} />
                ))}
            </div>

            {user?.role === 'admin' && locations.length > 0 && !hideAdminMap && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border-t-4 border-[var(--primary-color)]">
                    <div className="flex items-center mb-4">
                        <MapPin className="text-[var(--primary-color)] mr-2" size={20} />
                        <h3 className="font-bold text-gray-800 dark:text-gray-100">Live User Locations</h3>
                    </div>
                    <div className="mb-4">
                        {hasMapsKey ? (
                            <div ref={mapRef} className="w-full h-56 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" />
                        ) : (
                            <div className="relative w-full h-56 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
                                {(() => {
                                    const lats = locations.map(u => u.last_latitude);
                                    const lons = locations.map(u => u.last_longitude);
                                    const minLat = Math.min(...lats);
                                    const maxLat = Math.max(...lats);
                                    const minLon = Math.min(...lons);
                                    const maxLon = Math.max(...lons);
                                    const latSpan = Math.max(0.0001, maxLat - minLat);
                                    const lonSpan = Math.max(0.0001, maxLon - minLon);
                                    return locations.slice(0, 50).map((u) => {
                                        const xPos = ((u.last_longitude - minLon) / lonSpan) * 100;
                                        const yPos = (1 - (u.last_latitude - minLat) / latSpan) * 100;
                                        const url = `https://www.google.com/maps?q=${u.last_latitude},${u.last_longitude}`;
                                        return (
                                            <a
                                                key={`m-${u.id}-${u.last_location_at || ''}`}
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="absolute"
                                                style={{ left: `${isFinite(xPos) ? xPos : 0}%`, top: `${isFinite(yPos) ? yPos : 0}%` }}
                                                title={`${u.username || ''} • ${new Date(u.last_location_at).toLocaleString()}`}
                                            >
                                                <span className="block w-3 h-3 rounded-full bg-red-600 border border-white shadow" />
                                            </a>
                                        );
                                    });
                                })()}
                            </div>
                        )}
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

const StatusCard = ({ title, count, color, icon }) => (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow">
        {icon}
        <div className={`text-4xl font-bold ${color} mb-1`}>{count}</div>
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{title}</div>
    </div>
);

const CourseCard = ({ data }) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gray-800 p-3 flex items-center">
            <span className="text-yellow-500 mr-2">🎓</span>
            <h3 className="text-white font-bold">{data.name}</h3>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-center">
            <MiniStatus label="Ongoing" count={data.Ongoing} color="bg-cyan-100 text-cyan-800" />
            <MiniStatus label="Completed" count={data.Completed} color="bg-green-100 text-green-800" />
            <MiniStatus label="Incomplete" count={data.Incomplete} color="bg-amber-100 text-amber-800" />
            <MiniStatus label="Failed" count={data.Failed} color="bg-red-100 text-red-800" />
            <MiniStatus label="Drop" count={data.Drop} color="bg-gray-100 text-gray-800" />
        </div>
        <div className="px-4 pb-3 text-center">
            <span className="text-xs font-bold text-gray-500">Total: {data.total}</span>
        </div>
    </div>
);

const MiniStatus = ({ label, count, color }) => (
    <div className={`rounded p-2 flex flex-col items-center justify-center ${color}`}>
        <span className="text-base md:text-lg font-bold">{count}</span>
        <span className="text-[9px] md:text-[10px] uppercase tracking-wide">{label}</span>
    </div>
);

const ActionButton = ({ to, label, icon, className }) => (
    <Link to={to} className={`flex items-center justify-center p-3 rounded text-white font-medium transition-colors hover-highlight ${className}`}>
        <span className="mr-2">{icon}</span>
        {label}
    </Link>
);

export default Dashboard;
