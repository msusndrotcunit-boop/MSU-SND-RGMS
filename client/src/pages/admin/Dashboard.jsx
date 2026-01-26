import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
    const [stats, setStats] = useState({ totalCadets: 0, totalActivities: 0 });
    const [analytics, setAnalytics] = useState({ attendance: [], grades: [] });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [cadetsRes, activitiesRes, analyticsRes] = await Promise.all([
                    axios.get('/api/admin/cadets'),
                    axios.get('/api/cadet/activities'),
                    axios.get('/api/admin/analytics')
                ]);

                setStats({
                    totalCadets: cadetsRes.data.length,
                    totalActivities: activitiesRes.data.length
                });

                // Format grade data for Pie Chart
                const gradeData = [
                    { name: 'Passed', value: analyticsRes.data.grades.passed },
                    { name: 'Failed', value: analyticsRes.data.grades.failed },
                    { name: 'Incomplete', value: analyticsRes.data.grades.incomplete }
                ].filter(item => item.value > 0);

                setAnalytics({
                    attendance: analyticsRes.data.attendance,
                    grades: gradeData
                });

            } catch (err) {
                console.error(err);
            }
        };
        fetchStats();
    }, []);

    const COLORS = {
        Passed: '#22c55e', // Green
        Failed: '#ef4444', // Red
        Incomplete: '#f59e0b' // Amber
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500">
                    <h3 className="text-gray-500 text-sm font-medium">Total Cadets</h3>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalCadets}</p>
                </div>
                <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
                    <h3 className="text-gray-500 text-sm font-medium">Active Activities</h3>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalActivities}</p>
                </div>
                <div className="bg-white p-6 rounded shadow border-l-4 border-purple-500">
                    <h3 className="text-gray-500 text-sm font-medium">Training Days</h3>
                    <p className="text-3xl font-bold text-gray-800">15</p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance Chart */}
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Attendance Trends (Last 10 Days)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.attendance}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="present" fill="#16a34a" name="Present" />
                                <Bar dataKey="absent" fill="#dc2626" name="Absent" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Grade Distribution Chart */}
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Grade Distribution</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analytics.grades}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {analytics.grades.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#8884d8'} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
