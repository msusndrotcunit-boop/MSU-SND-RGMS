import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, Plus, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, Save, Search, ChevronRight, Camera, FileText, Download } from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import ExcuseLetterManager from '../../components/ExcuseLetterManager';
import { cacheData, getCachedData, cacheSingleton, getSingleton } from '../../utils/db';

const Attendance = () => {
    const [viewMode, setViewMode] = useState('attendance'); // 'attendance' | 'excuse'
    const [attendanceType, setAttendanceType] = useState('cadet'); // 'cadet' | 'staff'
    const [days, setDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ date: '', title: '', description: '' });
    
    // Scanner State
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    const scannerRef = useRef(null);
    const lastScanRef = useRef(0);
    const beepRef = useRef(null);

    // Filters for marking
    const [filterCompany, setFilterCompany] = useState('');
    const [filterPlatoon, setFilterPlatoon] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchDays();
    }, []);

    useEffect(() => {
        if (selectedDay) {
            selectDay(selectedDay);
        }
    }, [attendanceType]);

    const fetchDays = async (forceRefresh = false) => {
        try {
            if (!forceRefresh) {
                try {
                    const cached = await getSingleton('admin', 'training_days');
                    if (cached) {
                        let data = cached;
                        let timestamp = 0;
                        if (cached.data && cached.timestamp) {
                            data = cached.data;
                            timestamp = cached.timestamp;
                        } else if (Array.isArray(cached)) {
                            data = cached;
                        }

                        if (Array.isArray(data) && data.length > 0) {
                            setDays(data);
                            setLoading(false);
                            // If fresh (< 2 mins), skip API
                            if (timestamp && (Date.now() - timestamp < 120 * 1000)) {
                                return;
                            }
                        }
                    }
                } catch {}
            }

            const res = await axios.get('/api/attendance/days');
            setDays(res.data);
            await cacheSingleton('admin', 'training_days', {
                data: res.data,
                timestamp: Date.now()
            });
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleCreateDay = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/attendance/days', createForm);
            await cacheSingleton('admin', 'training_days', null); // Explicit clear
            fetchDays(true); // Force refresh to update list and cache
            setIsCreateModalOpen(false);
            setCreateForm({ date: '', title: '', description: '' });
        } catch (err) {
            alert('Error creating training day');
        }
    };

    const handleDeleteDay = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Delete this training day and all associated records?')) return;
        try {
            await axios.delete(`/api/attendance/days/${id}`);
            if (selectedDay?.id === id) setSelectedDay(null);
            await cacheSingleton('admin', 'training_days', null); // Explicit clear
            fetchDays(true); // Force refresh
        } catch (err) {
            alert('Error deleting day');
        }
    };

    const selectDay = async (day, forceRefresh = false) => {
        setSelectedDay(day);
        setLoading(true);
        try {
            const cacheKey = `${day.id}_${attendanceType}`;
            
            if (!forceRefresh) {
                try {
                    const cached = await getSingleton('attendance_by_day', cacheKey);
                    if (cached) {
                        let data = cached;
                        let timestamp = 0;
                        if (cached.data && cached.timestamp) {
                            data = cached.data;
                            timestamp = cached.timestamp;
                        } else if (Array.isArray(cached)) {
                            data = cached;
                        }
                        
                        if (Array.isArray(data)) {
                            setAttendanceRecords(data);
                            if (timestamp && (Date.now() - timestamp < 10 * 1000)) { // Reduced to 10s
                                setLoading(false);
                                return;
                            }
                        }
                    }
                } catch {}
            }
            
            const endpoint = attendanceType === 'cadet' 
                ? `/api/attendance/records/${day.id}`
                : `/api/attendance/records/staff/${day.id}`;

            const res = await axios.get(endpoint);
            setAttendanceRecords(res.data);
            await cacheSingleton('attendance_by_day', cacheKey, {
                data: res.data,
                timestamp: Date.now()
            });
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        let scanner = null;
        if (isScannerOpen && !scanResult) {
            // Delay to ensure DOM is ready
            setTimeout(() => {
                if (!document.getElementById("reader")) return;
                
                scanner = new Html5QrcodeScanner(
                    "reader",
                    { 
                        fps: 10, 
                        qrbox: { width: 230, height: 230 },
                        aspectRatio: 1.0,
                        showTorchButtonIfSupported: true,
                        rememberLastUsedCamera: true,
                        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
                        useBarCodeDetectorIfSupported: true,
                        disableFlip: true
                    },
                    /* verbose= */ false
                );

                scanner.render(onScanSuccess, (err) => { /* ignore failures */ });
                scannerRef.current = scanner;
            }, 100);
        }

        return () => {
            if (scanner) {
                scanner.clear().catch(console.error);
            }
        };
    }, [isScannerOpen, scanResult]);

    const onScanSuccess = async (decodedText, decodedResult) => {
        const now = Date.now();
        if (now - lastScanRef.current < 2000) return;
        lastScanRef.current = now;

        if (scannerRef.current) {
            scannerRef.current.pause(true);
        }

        try { beepRef.current && beepRef.current.play(); } catch {}

        // Parse Data
        let data = { raw: decodedText, originalText: decodedText };
        try {
            const parsed = JSON.parse(decodedText);
            data = { ...data, ...parsed };
        } catch (e) {
            // Raw text
        }

        setScanResult(data);
    };

    const handleScanConfirm = async (status) => {
        if (!scanResult || !selectedDay) return;

        try {
            const endpoint = attendanceType === 'cadet' ? '/api/attendance/scan' : '/api/attendance/staff/scan';
            const payload = {
                dayId: selectedDay.id,
                qrData: JSON.stringify(scanResult), // Send as JSON string or raw if it was raw
                status: status
            };
            
            // If scanResult was just raw text and we stringify it, the backend should handle it.
            // My backend expects `qrData` which it tries to parse as JSON.
            // If `scanResult` is an object, `JSON.stringify` works.
            // If `scanResult` came from `JSON.parse` in `onScanSuccess`, it's an object.
            // If it failed parse, it's `{ raw: decodedText }`.
            // So I should probably just send `scanResult.raw` if I want to match my backend logic 
            // OR ensure `qrData` sent matches what backend expects.
            // Backend: `try { JSON.parse(qrData) ... }`
            // If I send `JSON.stringify({ raw: "..." })`, backend parses it. `parsed.student_id` or `parsed.id` might be missing.
            // The backend falls back to `cadetIdentifier = qrData` (the string) if JSON parse fails or keys missing.
            // But if I send a JSON string of `{raw: "..."}` it will parse successfully but might not have `id`.
            
            // Let's refine `onScanSuccess` to keep `decodedText` as the main payload source.
            // I'll send `qrData: scanResult.raw || JSON.stringify(scanResult)`?
            // Actually, best to just send the original `decodedText`.
            // So `scanResult` should store `originalText`.
            
            const res = await axios.post(endpoint, {
                dayId: selectedDay.id,
                qrData: scanResult.originalText,
                status: status
            });

            alert(`Marked ${status.toUpperCase()}: ${res.data.cadet?.name || res.data.staff?.name || 'Success'}`);
            
            // Refresh records
            selectDay(selectedDay);
            
            // Close result modal, resume scanner
            setScanResult(null);
            if (scannerRef.current) {
                setTimeout(() => scannerRef.current.resume(), 1000);
            }

        } catch (err) {
            console.error(err);
            alert('Scan failed: ' + (err.response?.data?.message || err.message));
            // Resume scanner even on error
            setScanResult(null);
            if (scannerRef.current) {
                setTimeout(() => scannerRef.current.resume(), 1000);
            }
        }
    };

    const closeScanner = () => {
        setIsScannerOpen(false);
        setScanResult(null);
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
            scannerRef.current = null;
        }
    };

    const handleMarkAttendance = async (id, status) => {
        const record = attendanceRecords.find(r => (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id));
        const currentRemarks = record?.remarks || '';
        const currentTimeIn = record?.time_in || '';
        const currentTimeOut = record?.time_out || '';

        // Optimistic update
        const updatedRecords = attendanceRecords.map(r => 
            (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id) ? { ...r, status: status } : r
        );
        setAttendanceRecords(updatedRecords);
        
        // Update cache
        if (selectedDay) {
            const cacheKey = `${selectedDay.id}_${attendanceType}`;
            cacheSingleton('attendance_by_day', cacheKey, {
                data: updatedRecords,
                timestamp: Date.now()
            }).catch(console.error);
        }

        try {
            const payload = {
                dayId: selectedDay.id,
                [attendanceType === 'cadet' ? 'cadetId' : 'staffId']: id,
                status,
                remarks: currentRemarks,
                time_in: currentTimeIn,
                time_out: currentTimeOut
            };

            const endpoint = attendanceType === 'cadet' ? '/api/attendance/mark' : '/api/attendance/mark/staff';
            await axios.post(endpoint, payload);

            // Invalidate other modules
            if (attendanceType === 'cadet') {
                await cacheSingleton('grading', 'cadets_list', null);
                await cacheSingleton('admin', 'cadets_list', null);
            }
        } catch (err) {
            console.error('Failed to save attendance', err);
        }
    };

    const handleRemarkChange = async (id, remarks) => {
        const updatedRecords = attendanceRecords.map(r => 
            (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id) ? { ...r, remarks: remarks } : r
        );
        setAttendanceRecords(updatedRecords);

        // Update cache
        if (selectedDay) {
            const cacheKey = `${selectedDay.id}_${attendanceType}`;
            cacheSingleton('attendance_by_day', cacheKey, {
                data: updatedRecords,
                timestamp: Date.now()
            }).catch(console.error);
        }
    };
    
    const saveRemark = async (id, remarks, status) => {
        try {
            const record = attendanceRecords.find(r => (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id));
            const payload = {
                dayId: selectedDay.id,
                [attendanceType === 'cadet' ? 'cadetId' : 'staffId']: id,
                status: status || record?.status || 'present',
                remarks: record?.remarks || '',
                time_in: record?.time_in || '',
                time_out: record?.time_out || ''
            };
            const endpoint = attendanceType === 'cadet' ? '/api/attendance/mark' : '/api/attendance/mark/staff';
            await axios.post(endpoint, payload);

            // Invalidate other modules
            if (attendanceType === 'cadet') {
                await cacheSingleton('grading', 'cadets_list', null);
                await cacheSingleton('admin', 'cadets_list', null);
            }
        } catch (err) {
            console.error('Failed to save time fields', err);
        }
    };

    const handleTimeChange = (id, field, value) => {
        const updatedRecords = attendanceRecords.map(r => {
            if (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id) {
                return { ...r, [field]: value };
            }
            return r;
        });
        setAttendanceRecords(updatedRecords);

        // Update cache
        if (selectedDay) {
            const cacheKey = `${selectedDay.id}_${attendanceType}`;
            cacheSingleton('attendance_by_day', cacheKey, {
                data: updatedRecords,
                timestamp: Date.now()
            }).catch(console.error);
        }
    };

    const saveTime = async (id, field, value) => {
        try {
            const record = attendanceRecords.find(r => (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id));
            const payload = {
                dayId: selectedDay.id,
                [attendanceType === 'cadet' ? 'cadetId' : 'staffId']: id,
                status: record?.status || 'present',
                remarks: record?.remarks || '',
                time_in: field === 'time_in' ? value : (record?.time_in || ''),
                time_out: field === 'time_out' ? value : (record?.time_out || '')
            };
            const endpoint = attendanceType === 'cadet' ? '/api/attendance/mark' : '/api/attendance/mark/staff';
            await axios.post(endpoint, payload);

            // Invalidate other modules
            if (attendanceType === 'cadet') {
                await cacheSingleton('grading', 'cadets_list', null);
                await cacheSingleton('admin', 'cadets_list', null);
            }
        } catch (err) {
            console.error('Failed to save time', err);
        }
    };

    // Filter logic
    const filteredRecords = attendanceRecords.filter(record => {
        if (attendanceType === 'cadet') {
            const matchesCompany = filterCompany ? record.company === filterCompany : true;
            const matchesPlatoon = filterPlatoon ? record.platoon === filterPlatoon : true;
            const matchesSearch = searchTerm ? 
                `${record.last_name} ${record.first_name}`.toLowerCase().includes(searchTerm.toLowerCase()) : true;
            return matchesCompany && matchesPlatoon && matchesSearch;
        } else {
            // Staff Filter
            const matchesSearch = searchTerm ? 
                `${record.last_name} ${record.first_name}`.toLowerCase().includes(searchTerm.toLowerCase()) : true;
            return matchesSearch;
        }
    });

    // Stats
    const stats = attendanceRecords.reduce((acc, curr) => {
        const status = curr.status || 'unmarked';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const handleExport = () => {
        if (!selectedDay) return;
        const headers = ["Cadet/Staff ID", "Name", "Role/Rank", "Status", "Time In", "Time Out", "Remarks"];
        
        const csvContent = [
            headers.join(','),
            ...filteredRecords.map(r => {
                const name = `"${r.last_name}, ${r.first_name}"`;
                const id = attendanceType === 'cadet' ? r.cadet_id : r.staff_id;
                const role = attendanceType === 'cadet' ? r.rank : (r.role || 'Instructor');
                return [
                    id,
                    name,
                    role,
                    r.status,
                    r.time_in,
                    r.time_out,
                    `"${r.remarks || ''}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${selectedDay.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded shadow gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Attendance & Excuses</h1>
                <div className="flex flex-col w-full sm:w-auto sm:flex-row gap-2">
                    <button 
                        onClick={() => setViewMode('attendance')}
                        className={`flex-1 sm:flex-none justify-center px-3 md:px-4 py-2 rounded flex items-center transition text-sm md:text-base ${viewMode === 'attendance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <Calendar size={18} className="mr-2" />
                        <span className="whitespace-nowrap">Training Days</span>
                    </button>
                    <button 
                        onClick={() => setViewMode('excuse')}
                        className={`flex-1 sm:flex-none justify-center px-3 md:px-4 py-2 rounded flex items-center transition text-sm md:text-base ${viewMode === 'excuse' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <FileText size={18} className="mr-2" />
                        <span className="whitespace-nowrap">Excuse Letters</span>
                    </button>
                </div>
            </div>

            {viewMode === 'excuse' ? (
                <ExcuseLetterManager />
            ) : (
                <div className="flex flex-col md:flex-row h-full md:h-[calc(100vh-180px)] gap-6">
                    {/* Sidebar List */}
                    <div className={`w-full md:w-1/3 bg-white rounded shadow flex flex-col ${selectedDay ? 'hidden md:flex' : ''}`}>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t">
                            <h2 className="font-bold text-lg text-gray-700">Training Days</h2>
                            <button 
                                onClick={() => setIsCreateModalOpen(true)}
                                className="bg-green-700 text-white p-2 rounded hover:bg-green-800"
                                title="Add Training Day"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {days.map(day => (
                                <div 
                                    key={day.id}
                                    onClick={() => selectDay(day)}
                                    className={`p-4 rounded border cursor-pointer transition ${
                                        selectedDay?.id === day.id ? 'bg-green-50 border-green-500' : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-gray-800">{day.title}</div>
                                            <div className="text-sm text-gray-500 flex items-center mt-1">
                                                <Calendar size={14} className="mr-1" />
                                                {new Date(day.date).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDeleteDay(day.id, e)}
                                            className="text-gray-400 hover:text-red-600"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {days.length === 0 && <div className="p-4 text-center text-gray-500">No training days found.</div>}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className={`w-full md:w-2/3 bg-white rounded shadow flex flex-col ${!selectedDay ? 'hidden md:flex' : ''}`}>
                        {selectedDay ? (
                            <>
                        <div className="p-4 border-b bg-gray-50 rounded-t">
                            <div className="flex flex-col md:flex-row justify-between items-start mb-4">
                                <div>
                                    <button onClick={() => setSelectedDay(null)} className="md:hidden text-gray-500 mb-2 flex items-center text-sm">
                                        <ChevronRight className="rotate-180 mr-1" size={16} /> Back to List
                                    </button>
                                    <h2 className="text-2xl font-bold text-gray-800">{selectedDay.title}</h2>
                                    <p className="text-gray-600 mt-1">{selectedDay.description || 'No description'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2 mt-2 md:mt-0">
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleExport}
                                            className="flex items-center text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
                                            title="Export CSV"
                                        >
                                            <Download size={16} className="mr-2" /> Export
                                        </button>
                                        <button 
                                            onClick={() => setIsScannerOpen(true)}
                                            className="flex items-center text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                                        >
                                            <Camera size={16} className="mr-2" /> Scan Attendance
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-sm">
                                        <div className="flex items-center text-green-700 bg-green-50 px-2 py-1 rounded"><CheckCircle size={16} className="mr-1"/> Present: {stats.present || 0}</div>
                                        <div className="flex items-center text-red-700 bg-red-50 px-2 py-1 rounded"><XCircle size={16} className="mr-1"/> Absent: {stats.absent || 0}</div>
                                        <div className="flex items-center text-yellow-700 bg-yellow-50 px-2 py-1 rounded"><Clock size={16} className="mr-1"/> Late: {stats.late || 0}</div>
                                        <div className="flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded"><AlertTriangle size={16} className="mr-1"/> Excused: {stats.excused || 0}</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <div className="md:col-span-3 flex justify-center mb-2">
                                    <div className="bg-gray-200 rounded p-1 flex">
                                        <button
                                            className={`px-4 py-1 rounded text-sm font-semibold transition ${attendanceType === 'cadet' ? 'bg-white shadow text-green-800' : 'text-gray-600'}`}
                                            onClick={() => setAttendanceType('cadet')}
                                        >
                                            Cadets
                                        </button>
                                        <button
                                            className={`px-4 py-1 rounded text-sm font-semibold transition ${attendanceType === 'staff' ? 'bg-white shadow text-green-800' : 'text-gray-600'}`}
                                            onClick={() => setAttendanceType('staff')}
                                        >
                                            Training Staff
                                        </button>
                                    </div>
                                </div>

                                <input 
                                    placeholder="Search Name..." 
                                    className="border p-2 rounded"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {attendanceType === 'cadet' && (
                                    <>
                                        <input 
                                            placeholder="Filter Company" 
                                            className="border p-2 rounded"
                                            value={filterCompany}
                                            onChange={e => setFilterCompany(e.target.value)}
                                        />
                                        <input 
                                            placeholder="Filter Platoon" 
                                            className="border p-2 rounded"
                                            value={filterPlatoon}
                                            onChange={e => setFilterPlatoon(e.target.value)}
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 border-b">{attendanceType === 'cadet' ? 'Cadet' : 'Staff Member'}</th>
                                        <th className="p-3 border-b text-center">Status</th>
                                        <th className="p-3 border-b">Time In</th>
                                        <th className="p-3 border-b">Time Out</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map(record => {
                                        const id = attendanceType === 'cadet' ? record.cadet_id : record.staff_id;
                                        return (
                                        <tr key={id} className="border-b hover:bg-gray-50">
                                            <td className="p-3">
                                                <div className="font-medium">{record.last_name}, {record.first_name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {record.rank} | {attendanceType === 'cadet' ? `${record.company || '-'}/${record.platoon || '-'}` : (record.role || 'Instructor')}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex justify-center space-x-1">
                                                    <button 
                                                        onClick={() => handleMarkAttendance(id, 'present')}
                                                        className={`p-0.5 rounded ${record.status === 'present' ? 'bg-green-100 text-green-700' : 'text-gray-300 hover:text-green-500'}`}
                                                        title="Present"
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMarkAttendance(id, 'absent')}
                                                        className={`p-0.5 rounded ${record.status === 'absent' ? 'bg-red-100 text-red-700' : 'text-gray-300 hover:text-red-500'}`}
                                                        title="Absent"
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMarkAttendance(id, 'late')}
                                                        className={`p-0.5 rounded ${record.status === 'late' ? 'bg-yellow-100 text-yellow-700' : 'text-gray-300 hover:text-yellow-500'}`}
                                                        title="Late"
                                                    >
                                                        <Clock size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMarkAttendance(id, 'excused')}
                                                        className={`p-0.5 rounded ${record.status === 'excused' ? 'bg-blue-100 text-blue-700' : 'text-gray-300 hover:text-blue-500'}`}
                                                        title="Excused"
                                                    >
                                                        <AlertTriangle size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="time"
                                                    className="border-b border-gray-300 focus:border-green-500 outline-none w-full text-sm py-1 bg-transparent"
                                                    value={record.time_in || ''}
                                                    onChange={(e) => handleTimeChange(id, 'time_in', e.target.value)}
                                                    onBlur={(e) => saveTime(id, 'time_in', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="time"
                                                    className="border-b border-gray-300 focus:border-green-500 outline-none w-full text-sm py-1 bg-transparent"
                                                    value={record.time_out || ''}
                                                    onChange={(e) => handleTimeChange(id, 'time_out', e.target.value)}
                                                    onBlur={(e) => saveTime(id, 'time_out', e.target.value)}
                                                />
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Calendar size={64} className="mb-4 opacity-50" />
                        <p className="text-lg">Select a training day to view or mark attendance</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">New Training Day</h3>
                        <form onSubmit={handleCreateDay} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date</label>
                                <input 
                                    type="date" 
                                    required
                                    className="w-full border p-2 rounded"
                                    value={createForm.date}
                                    onChange={e => setCreateForm({...createForm, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Title</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="e.g., Drill Day 1"
                                    className="w-full border p-2 rounded"
                                    value={createForm.title}
                                    onChange={e => setCreateForm({...createForm, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea 
                                    className="w-full border p-2 rounded"
                                    rows="3"
                                    value={createForm.description}
                                    onChange={e => setCreateForm({...createForm, description: e.target.value})}
                                ></textarea>
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 py-2 border rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-2 bg-green-700 text-white rounded hover:bg-green-800"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Scanner Modal */}
            {isScannerOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg relative">
                        <button 
                            onClick={closeScanner}
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                        >
                            <XCircle size={24} />
                        </button>
                        
                        <h3 className="text-xl font-bold mb-4">Scan QR Code</h3>
                        
                        {!scanResult ? (
                            <div className="relative">
                                <div className="absolute -top-4 right-0 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-xs">Camera Active</div>
                                <div id="reader" className="w-full border-2 border-gray-200 rounded-lg overflow-hidden"></div>
                                <div className="text-xs text-gray-500 text-center mt-2">Position the QR code within the frame to scan automatically.</div>
                            </div>
                        ) : (
                            <div className="text-center space-y-4">
                                <div className="bg-green-100 text-green-800 p-4 rounded">
                                    <p className="font-bold text-lg">Scanned Successfully!</p>
                                    <p className="font-mono mt-2 break-all">{scanResult.raw}</p>
                                    {scanResult.name && <p className="text-lg font-semibold mt-2">{scanResult.name}</p>}
                                </div>
                                
                                <p className="text-gray-600">Mark attendance as:</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => handleScanConfirm('present')} className="bg-green-600 text-white p-3 rounded font-bold hover:bg-green-700">PRESENT</button>
                                    <button onClick={() => handleScanConfirm('late')} className="bg-yellow-500 text-white p-3 rounded font-bold hover:bg-yellow-600">LATE</button>
                                    <button onClick={() => handleScanConfirm('excused')} className="bg-blue-500 text-white p-3 rounded font-bold hover:bg-blue-600">EXCUSED</button>
                                    <button onClick={() => { setScanResult(null); if(scannerRef.current) setTimeout(() => scannerRef.current.resume(), 500); }} className="bg-gray-500 text-white p-3 rounded font-bold hover:bg-gray-600">CANCEL</button>
                                </div>
                            </div>
                        )}
                        <audio ref={beepRef} src="data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAFAAABAAACAAACcQBhdWRpby1tcDMAAABNAAACcAAACmYAAABaQW5kcmV3b2xmcwAAABQAAP/9AAA=" />
                    </div>
                </div>
            )}
            </div>
            )}
        </div>
    );
};

export default Attendance;
