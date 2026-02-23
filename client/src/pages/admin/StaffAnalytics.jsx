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
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-gray-800">Training Staff Analytics</h1>
                <button
                    type="button"
                    onClick={handleExportReport}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded bg-emerald-700 text-white text-xs md:text-sm hover:bg-emerald-800"
                >
                    <FileText size={16} />
                    <span>Export PDF</span>
                </button>
            </div>

            {aiSummary && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-emerald-500" />
                        <span className="font-semibold text-xs uppercase tracking-wide text-emerald-700">
                            AI overview
                        </span>
                    </div>
                    <div>{aiSummary.text}</div>
                    {aiInsights && aiInsights.length > 0 && (
                        <div className="text-xs text-emerald-800">
                            Highlight: {aiInsights[0].title}
                        </div>
                    )}
                    <div className="mt-1 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div className="text-[11px] text-emerald-800">
                            Ask the AI about staff attendance or ranks
                        </div>
                        <div className="flex flex-col md:flex-row gap-2">
                            <input
                                value={aiQuery}
                                onChange={e => setAiQuery(e.target.value)}
                                placeholder="Example: Which rank has unusually many staff?"
                                className="border border-emerald-300 rounded px-2 py-1 text-xs bg-white/70 focus:outline-none focus:ring-1 focus:ring-emerald-400"
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
                                className="px-3 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                            >
                                Ask AI
                            </button>
                        </div>
                    </div>
                    {aiQueryResult && (
                        <div className="mt-1 text-xs text-emerald-900 bg-white/60 border border-emerald-200 rounded p-2">
                            {aiQueryResult.answer}
                        </div>
                    )}
                </div>
            )}

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
                <div id="staff-rank-chart" className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Staff by Rank</h3>
                    {stats.staffByRank.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
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
                <div id="staff-attendance-chart" className="bg-white p-4 rounded-lg shadow">
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
