import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList, Legend } from 'recharts';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6']; // Green, Red, Amber, Blue

const StaffAnalytics = () => {
    const [stats, setStats] = useState({
        totalStaff: 0,
        staffByRank: [],
        attendanceStats: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/staff/analytics/overview', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching analytics:", err);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
            </div>
        );
    }

    // Process attendance stats for the cards
    const getCount = (status) => {
        const item = stats.attendanceStats.find(s => s.status === status);
        return item ? item.count : 0;
    };

    const totalAttendanceRecords = stats.attendanceStats.reduce((acc, curr) => acc + curr.count, 0);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Training Staff Analytics</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Total Staff</p>
                            <p className="text-2xl font-bold">{stats.totalStaff}</p>
                        </div>
                        <Users className="text-blue-500" size={24} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Total Present</p>
                            <p className="text-2xl font-bold">{getCount('present')}</p>
                        </div>
                        <UserCheck className="text-green-500" size={24} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Total Absent</p>
                            <p className="text-2xl font-bold">{getCount('absent')}</p>
                        </div>
                        <UserX className="text-red-500" size={24} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Total Late</p>
                            <p className="text-2xl font-bold">{getCount('late')}</p>
                        </div>
                        <Clock className="text-yellow-500" size={24} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rank Distribution Chart */}
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Staff by Rank</h3>
                    {stats.staffByRank.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={useMemo(() => {
                                    // Normalize and merge duplicate ranks (trim + title case)
                                    const merged = {};
                                    stats.staffByRank.forEach(r => {
                                        const keyRaw = (r.rank || 'Unverified').trim();
                                        const key = keyRaw.split(' ')
                                            .filter(Boolean)
                                            .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
                                            .join(' ');
                                        merged[key] = (merged[key] || 0) + (r.count || 0);
                                    });
                                    return Object.entries(merged).map(([rank, count]) => ({ rank, count }));
                                }, [stats.staffByRank])}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="rank" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#3b82f6" name="Staff Count">
                                        <LabelList dataKey="count" position="top" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">
                            No rank data available
                        </div>
                    )}
                </div>

                {/* Attendance Status Chart */}
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Attendance Overview</h3>
                    {stats.attendanceStats.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.attendanceStats}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="count"
                                        nameKey="status"
                                    >
                                        {stats.attendanceStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">
                            No attendance data available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StaffAnalytics;
