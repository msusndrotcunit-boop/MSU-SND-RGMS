import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, CartesianGrid, XAxis, YAxis
} from 'recharts';
import { FileText, Printer, Building2, Download, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSingleton, cacheSingleton } from '../../utils/db';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { addReportHeader, addReportFooter, addSignatories } from '../../utils/pdf';

// Refined Color Scheme
const COLORS = {
    MS1: '#3b82f6', // Blue 500
    MS2: '#2563eb', // Blue 600
    MS31: '#ef4444', // Red 500
    MS32: '#dc2626', // Red 600
    MS41: '#f59e0b', // Amber 500
    MS42: '#d97706', // Amber 600
    Basic: '#1e40af', // Blue 800
    Advance: '#b91c1c', // Red 700
    Completed: '#22c55e', // Green 500
    Incomplete: '#6b7280' // Gray 500
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    const shortName = (name || '').length > 12 ? `${(name || '').slice(0, 12)}…` : (name || '');
    const fontSize = 10;

    return percent > 0 ? (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={fontSize} fontWeight="bold">
            {`${shortName}: ${value} (${(percent * 100).toFixed(0)}%)`}
        </text>
    ) : null;
};

const DataAnalysis = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        ongoing: {
            basic: { MS1: 0, MS2: 0, total: 0 },
            advance: { MS31: 0, MS32: 0, MS41: 0, MS42: 0, total: 0 },
            total: 0
        },
        completed: {
            basic: { total: 0 },
            advance: { total: 0 },
            total: 0
        },
        incomplete: {
            basic: { total: 0 },
            advance: { total: 0 },
            total: 0
        }
    });
    const [genderByCourse, setGenderByCourse] = useState([]);
    const [courseTotals, setCourseTotals] = useState([]);

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

    const fetchData = async () => {
        try {
            // Check cache first (5 min TTL)
            // Use 'analytics' store and 'data_analysis' key
            const cached = await getSingleton('analytics', 'data_analysis');
            if (cached && cached.timestamp && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
                processData(cached.data);
                setLoading(false);
                return;
            }

            const res = await axios.get('/api/admin/analytics');
            if (res.data) {
                await cacheSingleton('analytics', 'data_analysis', {
                    data: res.data,
                    timestamp: Date.now()
                });
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
        const genderRows = data.demographics?.genderByCourse || [];
        const courseRows = data.demographics?.courseTotals || [];
        
        const newStats = {
            ongoing: {
                basic: { MS1: 0, MS2: 0, total: 0 },
                advance: { MS31: 0, MS32: 0, MS41: 0, MS42: 0, total: 0 },
                total: 0
            },
            completed: {
                basic: { total: 0 },
                advance: { total: 0 },
                total: 0
            },
            incomplete: {
                basic: { total: 0 },
                advance: { total: 0 },
                total: 0
            }
        };

        rawStats.forEach(item => {
            const status = normalizeStatus(item.status);
            const course = (item.cadet_course || '').toUpperCase();
            const count = parseInt(item.count, 10) || 0;

            const isBasic = ['MS1', 'MS2'].includes(course);
            const isAdvance = ['MS31', 'MS32', 'MS41', 'MS42'].includes(course);

            if (status === 'Ongoing') {
                if (isBasic) {
                    newStats.ongoing.basic[course] = (newStats.ongoing.basic[course] || 0) + count;
                    newStats.ongoing.basic.total += count;
                } else if (isAdvance) {
                    newStats.ongoing.advance[course] = (newStats.ongoing.advance[course] || 0) + count;
                    newStats.ongoing.advance.total += count;
                }
                newStats.ongoing.total += count;
            } else if (status === 'Completed') {
                if (isBasic) newStats.completed.basic.total += count;
                if (isAdvance) newStats.completed.advance.total += count;
                newStats.completed.total += count;
            } else if (status === 'Incomplete') {
                if (isBasic) newStats.incomplete.basic.total += count;
                if (isAdvance) newStats.incomplete.advance.total += count;
                newStats.incomplete.total += count;
            }
        });

        setStats(newStats);

        // Gender by course aggregation
        const map = {};
        genderRows.forEach(r => {
            const course = (r.cadet_course || 'Unknown').toUpperCase();
            const gender = (r.gender || 'Unknown');
            const count = parseInt(r.count, 10) || 0;
            if (!map[course]) {
                map[course] = { name: course, Male: 0, Female: 0, Unknown: 0 };
            }
            if (gender === 'Male') map[course].Male += count;
            else if (gender === 'Female') map[course].Female += count;
            else map[course].Unknown += count;
        });
        setGenderByCourse(Object.values(map));


        // Course totals (include courses even with zero counts)
        const knownCourses = ['COQC', 'MS1', 'MS2', 'MS31', 'MS32', 'MS41', 'MS42'];
        const counts = Object.fromEntries(knownCourses.map(k => [k, 0]));
        courseRows.forEach(r => {
            const name = (r.cadet_course || '').toUpperCase();
            const value = parseInt(r.count, 10) || 0;
            if (knownCourses.includes(name)) counts[name] = value;
        });
        const courseData = knownCourses.map(name => ({ name, value: counts[name] }));
        setCourseTotals(courseData);
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        let es;
        const connect = () => {
            try {
                es = new EventSource('/api/attendance/events');
                es.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        const types = new Set(['attendance_updated', 'grade_updated', 'staff_attendance_updated']);
                        if (types.has(data.type)) {
                            fetchData();
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
    const handleDownloadChart = async (elementId, title) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        try {
            const canvas = await html2canvas(element);
            const link = document.createElement('a');
            link.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL();
            link.click();
        } catch (err) {
            console.error('Failed to download chart:', err);
        }
    };

    const handlePrintChart = async (elementId) => {
        const element = document.getElementById(elementId);
        if (!element) return;

        try {
            const canvas = await html2canvas(element);
            const imgData = canvas.toDataURL('image/png');
            const windowContent = `
                <!DOCTYPE html>
                <html>
                <head><title>Print Chart</title></head>
                <body onload="window.print();window.close()">
                    <img src="${imgData}" style="width:100%;">
                </body>
                </html>
            `;
            const printWindow = window.open('', '', 'width=800,height=600');
            printWindow.document.write(windowContent);
            printWindow.document.close();
        } catch (err) {
            console.error('Failed to print chart:', err);
        }
    };

    const generatePDF = async () => {
        const doc = new jsPDF();
        const date = new Date().toLocaleDateString();
        let yPos = 50;
        addReportHeader(doc, { title: 'Data Analysis Report', dateText: date, leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null, rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null });
        addReportFooter(doc);

        // Capture Charts
        const chartIds = ['chart-basic', 'chart-advance', 'chart-combined'];
        
        for (const id of chartIds) {
            const element = document.getElementById(id);
            if (element) {
                try {
                    const canvas = await html2canvas(element);
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = doc.internal.pageSize.getWidth() - 28;
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    
                    // Check if new page needed
                    if (yPos + pdfHeight > doc.internal.pageSize.getHeight() - 20) {
                        doc.addPage();
                        addReportHeader(doc, { title: 'Data Analysis Report', dateText: date, leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null, rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null });
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
            addReportHeader(doc, { title: 'Data Analysis Report', dateText: date });
            addReportFooter(doc);
            yPos = 50;
        }

        // Ongoing Summary Table
        doc.autoTable({
            startY: yPos,
            head: [['Category', 'Count', 'Details']],
            body: [
                ['Total Ongoing Cadets', stats.ongoing.total, 'All enrolled'],
                ['Basic Corps', stats.ongoing.basic.total, `MS1: ${stats.ongoing.basic.MS1}, MS2: ${stats.ongoing.basic.MS2}`],
                ['Advance Corps', stats.ongoing.advance.total, `MS31: ${stats.ongoing.advance.MS31}, MS32: ${stats.ongoing.advance.MS32}, MS41: ${stats.ongoing.advance.MS41}, MS42: ${stats.ongoing.advance.MS42}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [255, 193, 7] },
            margin: { top: 40, bottom: 20 },
            didDrawPage: () => {
                addReportHeader(doc, { title: 'Data Analysis Report', dateText: date, leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null, rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null });
                addReportFooter(doc);
            }
        });

        // Completed & Incomplete Summary
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Status', 'Basic', 'Advance', 'Total']],
            body: [
                ['Completed/Graduated', stats.completed.basic.total, stats.completed.advance.total, stats.completed.total],
                ['Incomplete/Dropped', stats.incomplete.basic.total, stats.incomplete.advance.total, stats.incomplete.total],
            ],
            theme: 'grid',
            headStyles: { fillColor: [33, 33, 33] },
            margin: { top: 40, bottom: 20 },
            didDrawPage: () => {
                addReportHeader(doc, { title: 'Data Analysis Report', dateText: date, leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null, rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null });
                addReportFooter(doc);
            }
        });

        const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || yPos;
        addSignatories(doc, finalY, {
            preparedBy: 'Wilmer B Montejo',
            preparedRole: 'SSg (Inf) PA • Admin NCO',
            certifiedBy: 'INDIHRA D TAWANTAWAN',
            certifiedRole: 'LTC (RES) PA • Commandant'
        });

        doc.save(`ROTC_Data_Analysis_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // Prepare Chart Data
    const basicData = [
        { name: 'MS1', value: stats.ongoing.basic.MS1 },
        { name: 'MS2', value: stats.ongoing.basic.MS2 }
    ].filter(d => d.value > 0);

    const advanceData = [
        { name: 'MS31', value: stats.ongoing.advance.MS31 },
        { name: 'MS32', value: stats.ongoing.advance.MS32 },
        { name: 'MS41', value: stats.ongoing.advance.MS41 },
        { name: 'MS42', value: stats.ongoing.advance.MS42 }
    ].filter(d => d.value > 0);

    const combinedData = [
        { name: 'Basic', value: stats.ongoing.basic.total },
        { name: 'Advance', value: stats.ongoing.advance.total }
    ].filter(d => d.value > 0);

    // Completed Data for simple pie
    const completedData = [
        { name: 'Basic', value: stats.completed.basic.total },
        { name: 'Advance', value: stats.completed.advance.total }
    ].filter(d => d.value > 0);

    // Incomplete Data for simple pie
    const incompleteData = [
        { name: 'Basic', value: stats.incomplete.basic.total },
        { name: 'Advance', value: stats.incomplete.advance.total }
    ].filter(d => d.value > 0);


    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-gray-200 shadow-md rounded text-sm">
                    <p className="font-semibold" style={{ color: payload[0].fill }}>{`${payload[0].name}: ${payload[0].value}`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-4 md:p-6 min-h-screen bg-gray-50 font-sans">

            {/* School Info Card */}
            <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden border-t-4 border-yellow-500">
                <div className="bg-gray-900 px-6 py-3">
                    <h2 className="text-white font-bold">Selected Details</h2>
                </div>
                <div className="p-8 text-center">
                    <h3 className="text-2xl font-bold text-gray-800">Mindanao State University-Sultan Naga Dimaporo</h3>
                    <p className="text-gray-500">ROTC Unit Data Analysis</p>
                </div>
            </div>

            {/* Charts Grid - Ongoing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                
                {/* Basic ROTC Chart */}
                <div id="chart-basic" className="bg-white rounded-lg shadow-md border-t-4 border-blue-900">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Ongoing Basic ROTC Cadets</h3>
                        <div className="space-x-2 text-gray-400">
                            <button onClick={() => handlePrintChart('chart-basic')} className="hover:text-white transition-colors"><Printer size={16} /></button>
                            <button onClick={() => handleDownloadChart('chart-basic', 'Basic ROTC Chart')} className="hover:text-white transition-colors"><Download size={16} /></button>
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
                <div id="chart-advance" className="bg-white rounded-lg shadow-md border-t-4 border-blue-900">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Ongoing Advance ROTC Cadets</h3>
                        <div className="space-x-2 text-gray-400">
                            <button onClick={() => handlePrintChart('chart-advance')} className="hover:text-white transition-colors"><Printer size={16} /></button>
                            <button onClick={() => handleDownloadChart('chart-advance', 'Advance ROTC Chart')} className="hover:text-white transition-colors"><Download size={16} /></button>
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
                <div id="chart-combined" className="bg-white rounded-lg shadow-md border-t-4 border-blue-900">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Ongoing Basic and Advance ROTC Cadets</h3>
                        <div className="space-x-2 text-gray-400">
                            <button onClick={() => handlePrintChart('chart-combined')} className="hover:text-white transition-colors"><Printer size={16} /></button>
                            <button onClick={() => handleDownloadChart('chart-combined', 'Combined ROTC Chart')} className="hover:text-white transition-colors"><Download size={16} /></button>
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
                        <h3 className="text-white font-bold">Ongoing Summary</h3>
                    </div>
                    <div className="p-6">
                        <div className="bg-gray-900 text-white p-3 font-bold flex justify-between items-center rounded-t mb-4">
                            <span>TOTAL NUMBER OF CADETS (ONGOING)</span>
                            <span>{stats.ongoing.total}</span>
                        </div>

                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between items-center border-b pb-2 font-bold text-gray-700">
                                <span>Total Basic Cadets (Ongoing)</span>
                                <span>{stats.ongoing.basic.total}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS1</span>
                                <span>{stats.ongoing.basic.MS1}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS2</span>
                                <span>{stats.ongoing.basic.MS2}</span>
                            </div>

                            <div className="flex justify-between items-center border-b pb-2 font-bold text-gray-700 mt-4">
                                <span>Total Advance Cadets (Ongoing)</span>
                                <span>{stats.ongoing.advance.total}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS31</span>
                                <span>{stats.ongoing.advance.MS31}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS32</span>
                                <span>{stats.ongoing.advance.MS32}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS41</span>
                                <span>{stats.ongoing.advance.MS41}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2 pl-4 text-gray-600">
                                <span>Total MS42</span>
                                <span>{stats.ongoing.advance.MS42}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Completed & Incomplete Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                
                {/* Completed Chart */}
                <div className="bg-white rounded-lg shadow-md border-t-4 border-green-600 h-80">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Completed Cadets</h3>
                        <div className="space-x-2 text-gray-400">
                            <button><Printer size={16} /></button>
                            <button><Download size={16} /></button>
                        </div>
                    </div>
                    <div className="p-4 h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={completedData.length > 0 ? completedData : [{name: 'No Data', value: 1}]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={80}
                                    fill="#22c55e"
                                    dataKey="value"
                                >
                                    {completedData.length > 0 ? completedData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Basic' ? COLORS.Basic : COLORS.Advance} />
                                    )) : <Cell fill="#eee" />}
                                </Pie>
                                <Legend layout="vertical" verticalAlign="middle" align="right" />
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Incomplete Chart */}
                <div className="bg-white rounded-lg shadow-md border-t-4 border-amber-500 h-80">
                    <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold">Incomplete Cadets</h3>
                        <div className="space-x-2 text-gray-400">
                            <button><Printer size={16} /></button>
                            <button><Download size={16} /></button>
                        </div>
                    </div>
                    <div className="p-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={incompleteData.length > 0 ? incompleteData : [{name: 'No Data', value: 1}]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={80}
                                    fill="#f59e0b"
                                    dataKey="value"
                                >
                                    {incompleteData.length > 0 ? incompleteData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Basic' ? COLORS.Basic : COLORS.Advance} />
                                    )) : <Cell fill="#eee" />}
                                </Pie>
                                <Legend layout="vertical" verticalAlign="middle" align="right" />
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Additional Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Gender by Course */}
                <div className="bg-white rounded-lg shadow-md border-t-4 border-blue-900">
                    <div className="bg-gray-900 px-4 py-3">
                        <h3 className="text-white font-bold">Gender by Cadet Course</h3>
                    </div>
                    <div className="p-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={genderByCourse}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Male" stackId="g" fill="#3b82f6" />
                                <Bar dataKey="Female" stackId="g" fill="#ef4444" />
                                <Bar dataKey="Unknown" stackId="g" fill="#6b7280" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>


                {/* Course Distribution */}
                <div className="bg-white rounded-lg shadow-md border-t-4 border-blue-900">
                    <div className="bg-gray-900 px-4 py-3">
                        <h3 className="text-white font-bold">Course Distribution</h3>
                    </div>
                    <div className="p-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={courseTotals}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="value" fill="#16a34a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="mt-4 bg-green-900 text-white rounded-lg p-4 shadow-md">
                <div className="flex items-center mb-3 border-b border-green-700 pb-1">
                    <Zap size={18} className="text-yellow-400 mr-2" />
                    <span className="font-semibold text-sm uppercase tracking-wide">Quick Actions</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Link
                        to="/admin/data-analysis"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Data Analysis
                    </Link>
                    <Link
                        to="/admin/grading"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Grading
                    </Link>
                    <Link
                        to="/admin/activities"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Activities
                    </Link>
                    <Link
                        to="/admin/messages"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Messages
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default DataAnalysis;
