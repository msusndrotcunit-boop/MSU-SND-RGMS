import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList, Legend } from 'recharts';
import { Users, UserCheck, UserX, Clock, Sparkles, FileText } from 'lucide-react';
import { getSingleton, cacheSingleton } from '../../utils/db';
import { analyzeStaffAnalytics, queryAnalyticsInsights } from '../../services/aiAnalytics';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { addReportHeader, addReportFooter } from '../../utils/pdf';

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6']; // Green, Red, Amber, Blue

const StaffAnalytics = () => {
    const [stats, setStats] = useState({
        totalStaff: 0,
        staffByRank: [],
        attendanceStats: []
    });
    const [loading, setLoading] = useState(true);
    const [aiSummary, setAiSummary] = useState(null);
    const [aiInsights, setAiInsights] = useState([]);
    const [aiAlerts, setAiAlerts] = useState([]);
    const [aiQuery, setAiQuery] = useState('');
    const [aiQueryResult, setAiQueryResult] = useState(null);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    useEffect(() => {
        let es;
        const connect = () => {
            try {
                es = new EventSource('/api/attendance/events');
                es.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        if (data.type === 'staff_attendance_updated') {
                            fetchAnalytics();
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

    const fetchAnalytics = async () => {
        try {
            // Try cache first
            try {
                const cached = await getSingleton('admin', 'staff_analytics');
                if (cached) {
                    let data = cached;
                    let timestamp = 0;
                    if (cached.data && cached.timestamp) {
                        data = cached.data;
                        timestamp = cached.timestamp;
                    }
                    
                    setStats(data);
                    setLoading(false);
                    
                    if (timestamp && (Date.now() - timestamp < 5 * 60 * 1000)) {
                        return;
                    }
                }
            } catch (e) {
                console.warn(e);
            }

            const token = localStorage.getItem('token');
            const res = await axios.get('/api/staff/analytics/overview', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
            setLoading(false);
            
            await cacheSingleton('admin', 'staff_analytics', {
                data: res.data,
                timestamp: Date.now()
            });
        } catch (err) {
            console.error("Error fetching analytics:", err);
            setLoading(false);
        }
    };

    // Process rank data
    const chartData = useMemo(() => {
        if (!stats.staffByRank || stats.staffByRank.length === 0) return [];
        
        const merged = {};
        stats.staffByRank.forEach(r => {
            const keyRaw = (r.rank || 'Unverified').trim();
            const key = keyRaw.split(' ')
                .filter(Boolean)
                .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
                .join(' ');
            merged[key] = (merged[key] || 0) + parseInt(r.count || 0, 10);
        });
        return Object.entries(merged).map(([rank, count]) => ({ rank, count }));
    }, [stats.staffByRank]);

    useEffect(() => {
        const analysis = analyzeStaffAnalytics({ stats });
        setAiSummary(analysis.summary);
        setAiInsights(analysis.insights);
        setAiAlerts(analysis.alerts);
    }, [stats]);

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

    const handleExportReport = async () => {
        const doc = new jsPDF();
        const date = new Date().toLocaleDateString();
        let yPos = 50;
        addReportHeader(doc, { title: 'Training Staff Analytics Report', dateText: date, leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null, rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null });
        addReportFooter(doc);

        const chartIds = ['staff-rank-chart', 'staff-attendance-chart'];
        for (const id of chartIds) {
            const element = document.getElementById(id);
            if (element) {
                try {
                    const canvas = await html2canvas(element);
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = doc.internal.pageSize.getWidth() - 28;
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    if (yPos + pdfHeight > doc.internal.pageSize.getHeight() - 20) {
                        doc.addPage();
                        addReportHeader(doc, { title: 'Training Staff Analytics Report', dateText: date, leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null, rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null });
                        addReportFooter(doc);
                        yPos = 50;
                    }
                    doc.addImage(imgData, 'PNG', 14, yPos, pdfWidth, pdfHeight);
                    yPos += pdfHeight + 10;
                } catch (err) {
                    console.error(`Failed to capture chart ${id}:`, err);
                }
            }
        }

        if (yPos > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage();
            addReportHeader(doc, { title: 'Training Staff Analytics Report', dateText: date, leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null, rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null });
            addReportFooter(doc);
            yPos = 50;
        }

        doc.autoTable({
            startY: yPos,
            head: [['Metric', 'Value']],
            body: [
                ['Total staff', stats.totalStaff],
                ['Total attendance records', totalAttendanceRecords],
                ['Present', getCount('present')],
                ['Absent', getCount('absent')],
                ['Late', getCount('late')]
            ],
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] },
            margin: { top: 40, bottom: 20 },
            didDrawPage: () => {
                addReportHeader(doc, { title: 'Training Staff Analytics Report', dateText: date, leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null, rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null });
                addReportFooter(doc);
            }
        });

        let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || yPos;

        if (aiSummary && aiSummary.text) {
            if (finalY > doc.internal.pageSize.getHeight() - 60) {
                doc.addPage();
                addReportHeader(doc, { title: 'Training Staff Analytics Report', dateText: date, leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null, rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null });
                addReportFooter(doc);
                finalY = 50;
            }
            doc.setFontSize(12);
            doc.text('AI Summary and Key Findings', 14, finalY + 15);
            doc.setFontSize(10);
            const textLines = doc.splitTextToSize(aiSummary.text, doc.internal.pageSize.getWidth() - 28);
            doc.text(textLines, 14, finalY + 25);
        }

        doc.save(`ROTC_Staff_Analytics_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="space-y-8">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="border-l-4 border-[var(--primary-color)] pl-3">Training Staff Analytics</span>
                </h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleExportReport}
                        className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 transition flex items-center shadow-md min-h-[44px] hover-highlight"
                    >
                        <FileText size={18} className="mr-2" />
                        Download Report
                    </button>
                    <button
                        onClick={fetchAnalytics}
                        className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition flex items-center shadow-sm min-h-[44px] hover-highlight"
                    >
                        <Sparkles size={18} className="mr-2" />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* AI Insights Section */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-green-600">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Sparkles className="text-yellow-500" size={20} />
                        <h3 className="text-gray-800 dark:text-gray-100 font-bold">AI Analytics Insights</h3>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                        {aiSummary?.text || 'The AI engine is analyzing staff patterns...'}
                    </div>
                    {aiInsights && aiInsights.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {aiInsights.slice(0, 3).map(insight => (
                                <div
                                    key={insight.id}
                                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-xs bg-gray-50 dark:bg-gray-800/50"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-bold text-gray-800 dark:text-gray-100 line-clamp-2">
                                            {insight.title}
                                        </div>
                                        <span
                                            className={
                                                insight.severity === 'high'
                                                    ? 'px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700'
                                                    : insight.severity === 'medium'
                                                    ? 'px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700'
                                                    : 'px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700'
                                            }
                                        >
                                            {insight.severity || 'info'}
                                        </span>
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400">{insight.detail}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                            Ask about staff trends
                        </div>
                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                value={aiQuery}
                                onChange={e => setAiQuery(e.target.value)}
                                placeholder="Example: Who has the highest attendance rate?"
                                className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-4 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const result = queryAnalyticsInsights(aiQuery, {
                                        summary: aiSummary,
                                        insights: aiInsights
                                    });
                                    setAiQueryResult(result);
                                }}
                                className="px-6 py-2.5 rounded bg-green-700 text-white text-sm font-bold hover:bg-green-800 transition shadow-sm hover-highlight"
                            >
                                Ask AI
                            </button>
                        </div>
                        {aiQueryResult && (
                            <div className="mt-3 text-xs text-gray-800 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded p-3 leading-relaxed">
                                <span className="font-bold text-blue-800 dark:text-blue-300 mr-2">AI Response:</span>
                                {aiQueryResult.answer}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-blue-600 p-6 flex items-center gap-4">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full text-blue-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Staff</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.totalStaff || 0}</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-green-600 p-6 flex items-center gap-4">
                    <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full text-green-600">
                        <UserCheck size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Active Staff</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.staffByRank?.length || 0}</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-amber-600 p-6 flex items-center gap-4">
                    <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full text-amber-600">
                        <Clock size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Present Today</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            {getCount('present')}
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-red-600 p-6 flex items-center gap-4">
                    <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full text-red-600">
                        <UserX size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Absent Today</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            {getCount('absent')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Attendance Trends */}
                <div id="staff-attendance-chart" className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)]">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                        <h3 className="text-gray-800 dark:text-gray-100 font-bold">Attendance Overview</h3>
                    </div>
                    <div className="p-6 h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.attendanceStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="count"
                                    nameKey="status"
                                >
                                    {stats.attendanceStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                <Legend layout="vertical" verticalAlign="middle" align="right" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Rank Distribution */}
                <div id="staff-rank-chart" className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)]">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                        <h3 className="text-gray-800 dark:text-gray-100 font-bold">Training Staff Rank Distribution</h3>
                    </div>
                    <div className="p-6 h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                <XAxis dataKey="rank" fontSize={10} tick={{fill: '#888'}} />
                                <YAxis fontSize={10} tick={{fill: '#888'}} />
                                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Staff Count">
                                    <LabelList dataKey="count" position="top" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffAnalytics;
