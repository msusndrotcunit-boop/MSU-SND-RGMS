import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend 
} from 'recharts';
import { FileText, Printer, Building2, Download } from 'lucide-react';
import { getSingleton, cacheSingleton } from '../../utils/db';

const COLORS = {
    MS1: '#0088FE',
    MS2: '#00C49F',
    MS31: '#FFBB28',
    MS32: '#FF8042',
    MS41: '#AF19FF',
    MS42: '#FF1919',
    Basic: '#0088FE',
    Advance: '#FF8042'
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return percent > 0 ? (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
            {`${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
        </text>
    ) : null;
};

const DataAnalysis = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        basic: { MS1: 0, MS2: 0, total: 0 },
        advance: { MS31: 0, MS32: 0, MS41: 0, MS42: 0, total: 0 },
        totalOngoing: 0
    });

    const normalizeStatus = (status) => {
        if (!status) return 'Unknown';
        const s = status.toUpperCase();
        if (['ONGOING', 'ENROLLED', 'ACTIVE'].includes(s)) return 'Ongoing';
        if (['COMPLETED', 'GRADUATED', 'PASSED'].includes(s)) return 'Completed';
        if (['INC', 'INCOMPLETE'].includes(s)) return 'Incomplete';
        if (['FAILED', 'FAIL'].includes(s)) return 'Failed';
        if (['DROP', 'DROPPED'].includes(s)) return 'Drop';
        return 'Ongoing'; // Default to Ongoing if unsure, or create 'Other'
    };

    const fetchData = async () => {
        try {
            // Check cache first (5 min TTL)
            const cached = getSingleton('admin_analytics');
            if (cached) {
                processData(cached);
                setLoading(false);
                return;
            }

            const res = await axios.get('/api/admin/analytics');
            if (res.data) {
                cacheSingleton('admin_analytics', res.data, 5 * 60 * 1000); // 5 mins
                processData(res.data);
            }
        } catch (err) {
            console.error("Failed to load analytics:", err);
        } finally {
            setLoading(false);
        }
    };

    const processData = (data) => {
        const rawStats = data.demographics?.courseStats || [];
        
        const newStats = {
            basic: { MS1: 0, MS2: 0, total: 0 },
            advance: { MS31: 0, MS32: 0, MS41: 0, MS42: 0, total: 0 },
            totalOngoing: 0
        };

        rawStats.forEach(item => {
            const status = normalizeStatus(item.status);
            const course = (item.cadet_course || '').toUpperCase();
            
            // Only care about ONGOING for the main charts as per screenshot
            if (status === 'Ongoing') {
                if (['MS1', 'MS2'].includes(course)) {
                    newStats.basic[course] = (newStats.basic[course] || 0) + item.count;
                    newStats.basic.total += item.count;
                } else if (['MS31', 'MS32', 'MS41', 'MS42'].includes(course)) {
                    newStats.advance[course] = (newStats.advance[course] || 0) + item.count;
                    newStats.advance.total += item.count;
                }
                newStats.totalOngoing += item.count;
            }
        });

        setStats(newStats);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Prepare Chart Data
    const basicData = [
        { name: 'MS1', value: stats.basic.MS1 },
        { name: 'MS2', value: stats.basic.MS2 }
    ].filter(d => d.value > 0); // Filter 0s to avoid ugly chart segments? Or keep them for completeness? Screenshot shows 0% labels.

    const advanceData = [
        { name: 'MS31', value: stats.advance.MS31 },
        { name: 'MS32', value: stats.advance.MS32 },
        { name: 'MS41', value: stats.advance.MS41 },
        { name: 'MS42', value: stats.advance.MS42 }
    ].filter(d => d.value > 0);

    const combinedData = [
        { name: 'Basic Cadets', value: stats.basic.total },
        { name: 'Advance Cadets', value: stats.advance.total }
    ].filter(d => d.value > 0);

    // If empty, provide placeholder to avoid Recharts errors
    const safeBasicData = basicData.length > 0 ? basicData : [{ name: 'No Data', value: 1 }];
    const safeAdvanceData = advanceData.length > 0 ? advanceData : [{ name: 'No Data', value: 1 }];
    const safeCombinedData = combinedData.length > 0 ? combinedData : [{ name: 'No Data', value: 1 }];

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-gray-200 shadow-md rounded text-sm">
                    <p className="font-semibold">{`${payload[0].name}: ${payload[0].value}`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-6 min-h-screen bg-gray-50 font-sans">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between">
                <div>
                    <div className="flex items-center text-sm text-blue-600 mb-1">
                        <span className="mr-1">🏠</span> Home <span className="mx-2">›</span> <span className="font-semibold">Data Analysis</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-yellow-500 text-2xl">📊</span>
                        <h1 className="text-2xl font-bold text-gray-800">Generate Data Analysis</h1>
                    </div>
                </div>
                <button className="mt-4 md:mt-0 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center shadow-lg transition-all">
                    <FileText size={18} className="mr-2" />
                    Generate Data Analysis Form
                </button>
            </div>

            {/* School Info Card */}
            <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden border-t-4 border-yellow-500">
                <div className="bg-gray-900 px-6 py-3">
                    <h2 className="text-white font-bold">Selected Details</h2>
                </div>
                <div className="p-8 text-center">
                    <h3 className="text-2xl font-bold text-gray-800">Mindanao State University-Sultan Naga Dimaporo</h3>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                
                {/* Basic ROTC Chart */}
                <div className="bg-white rounded-lg shadow-md border-t-4 border-blue-900">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Ongoing Basic ROTC Cadets</h3>
                        <div className="space-x-2 text-gray-400">
                            <button><Printer size={16} /></button>
                            <button><Download size={16} /></button>
                        </div>
                    </div>
                    <div className="p-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={basicData.length > 0 ? basicData : [{name: 'No Data', value: 1}]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {basicData.length > 0 ? basicData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#ccc'} />
                                    )) : <Cell fill="#eee" />}
                                </Pie>
                                <Legend layout="vertical" verticalAlign="middle" align="right" />
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Advance ROTC Chart */}
                <div className="bg-white rounded-lg shadow-md border-t-4 border-blue-900">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Ongoing Advance ROTC Cadets</h3>
                        <div className="space-x-2 text-gray-400">
                            <button><Printer size={16} /></button>
                            <button><Download size={16} /></button>
                        </div>
                    </div>
                    <div className="p-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={advanceData.length > 0 ? advanceData : [{name: 'No Data', value: 1}]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {advanceData.length > 0 ? advanceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#ccc'} />
                                    )) : <Cell fill="#eee" />}
                                </Pie>
                                <Legend layout="vertical" verticalAlign="middle" align="right" />
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Combined Chart & Summary Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                
                {/* Combined Chart */}
                <div className="bg-white rounded-lg shadow-md border-t-4 border-blue-900">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Ongoing Basic and Advance ROTC Cadets</h3>
                        <div className="space-x-2 text-gray-400">
                            <button><Printer size={16} /></button>
                            <button><Download size={16} /></button>
                        </div>
                    </div>
                    <div className="p-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={combinedData.length > 0 ? combinedData : [{name: 'No Data', value: 1}]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {combinedData.length > 0 ? combinedData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[entry.name.split(' ')[0]] || '#ccc'} />
                                    )) : <Cell fill="#eee" />}
                                </Pie>
                                <Legend layout="vertical" verticalAlign="middle" align="right" />
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Summary Table */}
                <div className="bg-white rounded-lg shadow-md border-t-4 border-blue-900">
                    <div className="bg-gray-900 px-4 py-3">
                        <h3 className="text-white font-bold">Ongoing</h3>
                    </div>
                    <div className="p-6">
                        <div className="bg-gray-900 text-white p-3 font-bold flex justify-between items-center rounded-t mb-4">
                            <span>TOTAL NUMBER OF CADETS (ONGOING)</span>
                            <span>{stats.totalOngoing}</span>
                        </div>

                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between items-center border-b pb-2 font-bold text-gray-700">
                                <span>Total Basic Cadets (Ongoing)</span>
                                <span>{stats.basic.total}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS1</span>
                                <span>{stats.basic.MS1}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS2</span>
                                <span>{stats.basic.MS2}</span>
                            </div>

                            <div className="flex justify-between items-center border-b pb-2 font-bold text-gray-700 mt-4">
                                <span>Total Advance Cadets (Ongoing)</span>
                                <span>{stats.advance.total}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS31</span>
                                <span>{stats.advance.MS31}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS32</span>
                                <span>{stats.advance.MS32}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS41</span>
                                <span>{stats.advance.MS41}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS42</span>
                                <span>{stats.advance.MS42}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Empty Placeholders (Completed/Incomplete) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-md border-t-4 border-blue-900 h-48">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Basic ROTC Cadets (Completed)</h3>
                        <div className="space-x-2 text-gray-400">
                            <button><Printer size={16} /></button>
                            <button><Download size={16} /></button>
                        </div>
                    </div>
                    <div className="p-4 flex items-center justify-center h-full text-gray-400">
                        No Data Available
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-md border-t-4 border-blue-900 h-48">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Basic ROTC Cadets (Incomplete)</h3>
                        <div className="space-x-2 text-gray-400">
                            <button><Printer size={16} /></button>
                            <button><Download size={16} /></button>
                        </div>
                    </div>
                    <div className="p-4 flex items-center justify-center h-full text-gray-400">
                        No Data Available
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataAnalysis;
