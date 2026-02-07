import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
    Activity, CheckCircle, AlertTriangle, XCircle, UserMinus, 
    BookOpen, Users, Calendar, Mail, Zap, ClipboardCheck, Facebook, Twitter, Linkedin, Calculator
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSingleton, cacheSingleton } from '../../utils/db';

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
    const [loading, setLoading] = useState(true);

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

    const processData = (data) => {
        const rawStats = data.demographics?.courseStats || [];
        
        // Initialize aggregation
        const total = { Ongoing: 0, Completed: 0, Incomplete: 0, Failed: 0, Drop: 0 };
        const byCourse = {};

        // Courses we expect (ordered)
        const courses = ['COQC', 'MS1', 'MS2', 'MS31', 'MS32', 'MS41', 'MS42'];
        courses.forEach(c => {
            byCourse[c] = { name: c, Ongoing: 0, Completed: 0, Incomplete: 0, Failed: 0, Drop: 0, total: 0 };
        });

        rawStats.forEach(item => {
            const status = normalizeStatus(item.status);
            const course = item.cadet_course || 'Unknown';
            const count = item.count;

            if (total[status] !== undefined) {
                total[status] += count;
            }

            if (byCourse[course]) {
                byCourse[course][status] += count;
                byCourse[course].total += count;
            } else if (course !== 'Unknown') {
                // Handle unexpected courses if any
                byCourse[course] = { 
                    name: course, 
                    Ongoing: 0, Completed: 0, Incomplete: 0, Failed: 0, Drop: 0, total: 0 
                };
                if (byCourse[course][status] !== undefined) {
                    byCourse[course][status] += count;
                    byCourse[course].total += count;
                }
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
        if (!status) return 'Ongoing'; // Default
        const s = status.toLowerCase();
        if (s.includes('complete') && !s.includes('in')) return 'Completed';
        if (s.includes('incomplete') || s.includes('inc')) return 'Incomplete';
        if (s.includes('fail')) return 'Failed';
        if (s.includes('drop')) return 'Drop';
        return 'Ongoing'; // Default/Active
    };

    return (
        <div className="space-y-8 p-2">
            
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <span className="border-l-4 border-yellow-500 pl-3">ROTC Unit Dashboard</span>
                </h2>
            </div>

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
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <BookOpen size={20} className="text-yellow-600 mr-2" />
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

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-lg p-6 text-white shadow-lg border border-green-700">
                <div className="flex items-center mb-4 border-b border-green-600 pb-2">
                    <Zap className="text-yellow-400 mr-2" size={20} />
                    <h3 className="font-bold text-yellow-50">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <ActionButton 
                        to="/admin/cadets" 
                        label="Cadet Management" 
                        icon={<Users size={18} />} 
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
                        to="/admin/activities" 
                        label="Activities" 
                        icon={<Calendar size={18} />} 
                        className="bg-yellow-500 hover:bg-yellow-400 text-green-900 font-bold shadow-lg border-2 border-yellow-300"
                    />
                </div>
            </div>
            
            {/* Footer Info */}
            <div className="bg-gray-900 text-gray-400 p-8 rounded-lg mt-8 border-t-4 border-yellow-600">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm mb-8">
                    <div>
                        <div className="flex items-center text-white text-xl font-bold mb-4">
                            <span className="bg-yellow-500 text-gray-900 p-1.5 rounded mr-3 shadow-lg shadow-yellow-500/20">🛡️</span>
                            <div>
                                <div className="tracking-wide">MSU-SND RGMS</div>
                                <div className="text-[10px] font-normal text-gray-500 uppercase tracking-wider">integrated with Training Staff Attendance System</div>
                            </div>
                        </div>
                        <p className="mb-4 text-gray-500 leading-relaxed">MSU-Sultan Naga Dimporo ROTC Unit Grading Management System</p>
                        <p className="text-xs font-mono text-yellow-500/80">Version 2.3.19</p>
                    </div>
                    <div className="flex flex-col space-y-2">
                        <h4 className="text-yellow-500 font-bold mb-2">QUICK LINKS</h4>
                        <Link to="/admin/dashboard" className="hover:text-white flex items-center"><span className="mr-2">🏠</span> Dashboard</Link>
                        <Link to="/admin/cadets" className="hover:text-white flex items-center"><span className="mr-2">📂</span> Cadet Management</Link>
                        <Link to="/admin/search" className="hover:text-white flex items-center"><span className="mr-2">🔍</span> Searching Cadets</Link>
                    </div>
                    <div className="flex flex-col space-y-2">
                        <h4 className="text-yellow-500 font-bold mb-2">INFORMATION</h4>
                        <Link to="/about" className="hover:text-white flex items-center"><span className="mr-2">ℹ️</span> About of the App</Link>
                        <Link to="/docs" className="hover:text-white flex items-center"><span className="mr-2">📄</span> Documentation</Link>
                        <Link to="/support" className="hover:text-white flex items-center"><span className="mr-2">🎧</span> Support</Link>
                    </div>
                </div>
                
                <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center text-xs">
                    <div className="flex items-center mb-4 md:mb-0">
                        <span className="bg-yellow-600 text-white p-1 rounded-full mr-2 font-bold text-[10px]">C</span>
                        <div>
                            <p className="text-gray-300 font-bold">2026 MSU-SND ROTC UNIT</p>
                            <p>All rights reserved.</p>
                        </div>
                    </div>
                    <div className="flex space-x-4">
                        <a href="#" className="bg-gray-800 p-2 rounded hover:bg-blue-600 hover:text-white transition-colors"><Facebook size={16} /></a>
                        <a href="#" className="bg-gray-800 p-2 rounded hover:bg-sky-500 hover:text-white transition-colors"><Twitter size={16} /></a>
                        <a href="#" className="bg-gray-800 p-2 rounded hover:bg-blue-700 hover:text-white transition-colors"><Linkedin size={16} /></a>
                        <a href="#" className="bg-gray-800 p-2 rounded hover:bg-red-500 hover:text-white transition-colors"><Mail size={16} /></a>
                    </div>
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
        <div className="p-4 grid grid-cols-5 gap-2 text-center">
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
        <span className="text-lg font-bold">{count}</span>
        <span className="text-[10px] uppercase">{label}</span>
    </div>
);

const ActionButton = ({ to, label, icon, className }) => (
    <Link to={to} className={`flex items-center justify-center p-3 rounded text-white font-medium transition-colors ${className}`}>
        <span className="mr-2">{icon}</span>
        {label}
    </Link>
);

export default Dashboard;
