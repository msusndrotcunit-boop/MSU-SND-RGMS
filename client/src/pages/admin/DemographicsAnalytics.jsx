import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, BookOpen, Church } from 'lucide-react';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const DemographicsAnalytics = () => {
    const [demographics, setDemographics] = useState({
        religion: [],
        age: [],
        courses: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDemographics();
    }, []);

    const fetchDemographics = async () => {
        try {
            const res = await axios.get('/api/admin/analytics/demographics');
            setDemographics(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching demographics:', err);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    // Prepare data for charts
    const religionData = demographics.religion.map(item => ({
        name: item.religion,
        value: item.count
    }));

    const ageData = demographics.age.map(item => ({
        name: item.age_range,
        count: item.count
    }));

    const coursesData = demographics.courses.map(item => ({
        name: item.course.length > 30 ? item.course.substring(0, 30) + '...' : item.course,
        fullName: item.course,
        count: item.count
    }));

    const totalCadets = demographics.religion.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Demographics Analytics</h1>
                <button
                    onClick={fetchDemographics}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                    Refresh Data
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Total Cadets</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCadets}</p>
                    </div>
                    <Users className="text-primary-500" size={32} />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Religions</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{demographics.religion.length}</p>
                    </div>
                    <Church className="text-blue-500" size={32} />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Courses</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{demographics.courses.length}</p>
                    </div>
                    <BookOpen className="text-orange-500" size={32} />
                </div>
            </div>

            {/* Religion Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Religion Distribution</h2>
                {religionData.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={religionData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {religionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Breakdown</h3>
                            {demographics.religion.map((item, index) => (
                                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{item.religion}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">No religion data available</p>
                )}
            </div>

            {/* Age Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Age Distribution</h2>
                {ageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={ageData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#3b82f6" name="Number of Cadets" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">No age data available</p>
                )}
            </div>

            {/* Course Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Course Distribution</h2>
                {coursesData.length > 0 ? (
                    <>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={coursesData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={200} />
                                <Tooltip content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{payload[0].payload.fullName}</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">Count: {payload[0].value}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }} />
                                <Legend />
                                <Bar dataKey="count" fill="#22c55e" name="Number of Cadets" />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {demographics.courses.map((item, index) => (
                                <div key={index} className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{item.course}</span>
                                    <span className="text-gray-600 dark:text-gray-400 ml-2">({item.count})</span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">No course data available</p>
                )}
            </div>
        </div>
    );
};

export default DemographicsAnalytics;
