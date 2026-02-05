import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { cacheData, getCachedData, cacheSingleton, getSingleton } from '../../utils/db';
import WeatherAdvisory from '../../components/WeatherAdvisory';

const COLORS = {
  Passed: '#22c55e', // Green
  Failed: '#ef4444', // Red
  Incomplete: '#f59e0b' // Amber
};

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Dashboard = () => {
    const [stats, setStats] = useState({ totalCadets: 0, totalActivities: 0 });
    const [analytics, setAnalytics] = useState({ 
        attendance: [], 
        grades: [],
        demographics: { company: [], rank: [], status: [], totalCadets: 0 }
    });
    const [onlineCount, setOnlineCount] = useState(0);

    console.log('AdminDashboard rendered. onlineCount:', onlineCount);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                let shouldFetchAnalytics = true;
                
                try {
                    const cachedActivities = await getCachedData('activities');
                    const cachedAnalyticsWrapper = await getSingleton('analytics', 'dashboard');
                    
                    if (cachedActivities?.length) {
                        setStats(s => ({ ...s, totalActivities: cachedActivities.length }));
                    }

                    if (cachedAnalyticsWrapper) {
                        let analyticsData = cachedAnalyticsWrapper;
                        let timestamp = 0;

                        // Check for new format { data, timestamp }
                        if (cachedAnalyticsWrapper.data && cachedAnalyticsWrapper.timestamp) {
                            analyticsData = cachedAnalyticsWrapper.data;
                            timestamp = cachedAnalyticsWrapper.timestamp;
                        }

                        const gradeDataCached = [
                            { name: 'Passed', value: analyticsData.grades.passed },
                            { name: 'Failed', value: analyticsData.grades.failed },
                            { name: 'Incomplete', value: analyticsData.grades.incomplete }
                        ].filter(item => item.value > 0);
                        
                        setAnalytics({
                            attendance: analyticsData.attendance || [],
                            grades: gradeDataCached,
                            demographics: analyticsData.demographics || { company: [], rank: [], status: [], totalCadets: 0 }
                        });
                        
                        if (analyticsData.demographics?.totalCadets) {
                            setStats(s => ({ ...s, totalCadets: analyticsData.demographics.totalCadets }));
                        }

                        // If fresh (< 5 mins), skip fetch
                        if (timestamp && (Date.now() - timestamp < 5 * 60 * 1000)) {
                            shouldFetchAnalytics = false;
                        }
                    }
                } catch (e) {
                    console.warn("Cache read error", e);
                }
                
                const promises = [
                    axios.get('/api/cadet/activities'),
                    axios.get('/api/admin/online-users')
                ];

                if (shouldFetchAnalytics) {
                    promises.push(axios.get('/api/admin/analytics'));
                }

                const results = await Promise.allSettled(promises);
                
                // Map results back to variables
                const activitiesRes = results[0];
                const onlineRes = results[1];
                const analyticsRes = shouldFetchAnalytics ? results[2] : null;

                if (activitiesRes.status === 'fulfilled') {
                    setStats(s => ({ ...s, totalActivities: activitiesRes.value.data.length }));
                    await cacheData('activities', activitiesRes.value.data);
                }
                if (onlineRes.status === 'fulfilled') {
                    setOnlineCount(onlineRes.value.data.count);
                }

                if (analyticsRes && analyticsRes.status === 'fulfilled') {
                    const analyticsData = analyticsRes.value.data;
                    const gradeData = [
                        { name: 'Passed', value: analyticsData.grades.passed },
                        { name: 'Failed', value: analyticsData.grades.failed },
                        { name: 'Incomplete', value: analyticsData.grades.incomplete }
                    ].filter(item => item.value > 0);

                    setAnalytics({
                        attendance: analyticsData.attendance,
                        grades: gradeData,
                        demographics: analyticsData.demographics || { company: [], rank: [], status: [], totalCadets: 0 }
                    });
                    
                    if (analyticsData.demographics?.totalCadets) {
                        setStats(s => ({ ...s, totalCadets: analyticsData.demographics.totalCadets }));
                    }

                    await cacheSingleton('analytics', 'dashboard', { data: analyticsData, timestamp: Date.now() });
                }

            } catch (err) {
                console.error(err);
            }
        };
        fetchStats();
    }, []);

    // Analytics Data Computation (Replaced by Backend Demographics)
    const { companyData, rankData, statusData } = {
        companyData: analytics.demographics.company,
        rankData: analytics.demographics.rank,
        statusData: analytics.demographics.status
    };

    return (
        <div className="space-y-6">
            <WeatherAdvisory />
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <div className="bg-white p-6 rounded shadow border-l-4 border-indigo-500">
                    <h3 className="text-gray-500 text-sm font-medium">Online Cadets</h3>
                    <p className="text-3xl font-bold text-gray-800">{onlineCount}</p>
                </div>
            </div>

            {/* Demographics Section */}
            {stats.totalCadets > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Company Distribution */}
                    <div className="bg-white p-6 rounded shadow">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Cadets by Company</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={companyData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#3b82f6" name="Cadets">
                                        <LabelList dataKey="count" position="top" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Rank Distribution */}
                    <div className="bg-white p-6 rounded shadow">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Cadets by Rank</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rankData} margin={{ bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" interval={0} angle={-45} textAnchor="end" height={60} tick={{fontSize: 10}} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#10b981" name="Cadets">
                                        <LabelList dataKey="count" position="top" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Status Distribution */}
                    <div className="bg-white p-6 rounded shadow">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Cadet Status Overview</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

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
