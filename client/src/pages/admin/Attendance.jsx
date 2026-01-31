import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Plus, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, Save, Search, ChevronRight, Upload, FileText, Download, ChevronUp, ChevronDown } from 'lucide-react';
import ExcuseLetterManager from '../../components/ExcuseLetterManager';
import { cacheData, getCachedData, cacheSingleton, getSingleton } from '../../utils/db';
import { COMPANY_OPTIONS } from '../../constants/options';

const Attendance = () => {
    const [viewMode, setViewMode] = useState('attendance'); // 'attendance' | 'excuse'
    const [attendanceType, setAttendanceType] = useState('cadet'); // 'cadet' | 'staff'
    const [days, setDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ date: '', title: '', description: '' });
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);
    
    // Import State
    // Fix: Added handleDownloadReport for report generation
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importUrl, setImportUrl] = useState('');
    const [importing, setImporting] = useState(false);

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

    const fetchDays = async () => {
        try {
            try {
                const cached = await getCachedData('training_days');
                if (cached?.length) {
                    setDays(cached);
                    setLoading(false);
                }
            } catch {}
            const res = await axios.get('/api/attendance/days');
            setDays(res.data);
            await cacheData('training_days', res.data);
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
            fetchDays();
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
            fetchDays();
        } catch (err) {
            alert('Error deleting day');
        }
    };

    const selectDay = async (day) => {
        setSelectedDay(day);
        setLoading(true);
        try {
            // Removed caching to ensure real-time sync with Cadet/Staff management list
            const endpoint = attendanceType === 'cadet' 
                ? `/api/attendance/records/${day.id}`
                : `/api/attendance/records/staff/${day.id}`;

            const res = await axios.get(endpoint);
            setAttendanceRecords(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleImport = async (e) => {
        e.preventDefault();
        if ((!importFile && !importUrl) || !selectedDay) return;

        setImporting(true);

        try {
            let res;
            if (importFile) {
                const formData = new FormData();
                formData.append('file', importFile);
                formData.append('dayId', selectedDay.id);

                res = await axios.post('/api/attendance/import', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await axios.post('/api/attendance/import-url', {
                    url: importUrl,
                    dayId: selectedDay.id
                });
            }

            alert(res.data.message);
            if (res.data.errors && res.data.errors.length > 0) {
                alert('Errors:\n' + res.data.errors.join('\n'));
            }
            selectDay(selectedDay); // Refresh records
            setIsImportModalOpen(false);
            setImportFile(null);
            setImportUrl('');
        } catch (err) {
            console.error(err);
            alert('Import failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setImporting(false);
        }
    };

    const handleMarkAttendance = async (id, status) => {
        // Optimistic update
        const updatedRecords = attendanceRecords.map(r => 
            (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id) ? { ...r, status: status } : r
        );
        setAttendanceRecords(updatedRecords);

        try {
            if (attendanceType === 'cadet') {
                await axios.post('/api/attendance/mark', {
                    dayId: selectedDay.id,
                    cadetId: id,
                    status,
                    remarks: ''
                });
            } else {
                await axios.post('/api/attendance/mark/staff', {
                    dayId: selectedDay.id,
                    staffId: id,
                    status,
                    remarks: ''
                });
            }
        } catch (err) {
            console.error('Failed to save attendance', err);
        }
    };

    const handleDownloadReport = async (type) => {
        const targetType = type || attendanceType;
        try {
            const endpoint = targetType === 'cadet' 
                ? '/api/admin/reports/attendance/cadets' 
                : '/api/admin/reports/attendance/staff';
            
            const response = await axios.get(endpoint, { responseType: 'blob' });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${attendanceType === 'cadet' ? 'Cadet' : 'Staff'}_Attendance_Report.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Download failed", err);
            alert("Failed to download report");
        }
    };

    const handleRemarkChange = async (id, remarks) => {
        const updatedRecords = attendanceRecords.map(r => 
            (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id) ? { ...r, remarks: remarks } : r
        );
        setAttendanceRecords(updatedRecords);
    };
    
    const saveRemark = async (id, remarks, status) => {
         try {
            if (attendanceType === 'cadet') {
                await axios.post('/api/attendance/mark', {
                    dayId: selectedDay.id,
                    cadetId: id,
                    status: status || 'present', 
                    remarks
                });
            } else {
                await axios.post('/api/attendance/mark/staff', {
                    dayId: selectedDay.id,
                    staffId: id,
                    status: status || 'present',
                    remarks
                });
            }
        } catch (err) {
            console.error('Failed to save remark', err);
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



    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex justify-between items-center bg-white p-4 rounded shadow">
                <h1 className="text-2xl font-bold text-gray-800">Attendance Management</h1>
                <div className="flex space-x-2">
                    <div className="mr-4 flex space-x-2 border-r pr-4">
                        <button 
                            onClick={() => handleDownloadReport('cadet')}
                            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center text-sm"
                            title="Download Cadet Attendance Report"
                        >
                            <Download size={16} className="mr-2" /> Cadet Report
                        </button>
                        <button 
                            onClick={() => handleDownloadReport('staff')}
                            className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center text-sm"
                            title="Download Staff Attendance Report"
                        >
                            <Download size={16} className="mr-2" /> Staff Report
                        </button>
                    </div>
                    <button 
                        onClick={() => setViewMode('attendance')}
                        className={`px-4 py-2 rounded flex items-center transition ${viewMode === 'attendance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <Calendar size={18} className="mr-2" />
                        Training Days
                    </button>
                    <button 
                        onClick={() => setViewMode('excuse')}
                        className={`px-4 py-2 rounded flex items-center transition ${viewMode === 'excuse' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <FileText size={18} className="mr-2" />
                        Excuse Letters
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
                        <div className="border-b bg-gray-50 rounded-t transition-all duration-300">
                            <div className="p-4 flex flex-col md:flex-row justify-between items-start">
                                <div className="w-full">
                                    <button onClick={() => setSelectedDay(null)} className="md:hidden text-gray-500 mb-2 flex items-center text-sm">
                                        <ChevronRight className="rotate-180 mr-1" size={16} /> Back to List
                                    </button>
                                    <div className="flex items-center justify-between w-full">
                                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                            {selectedDay.title}
                                            <button 
                                                onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
                                                className="p-1 hover:bg-gray-200 rounded-full text-gray-600 focus:outline-none"
                                                title={isHeaderExpanded ? "Collapse Controls" : "Expand Controls"}
                                            >
                                                {isHeaderExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </button>
                                        </h2>
                                        {!isHeaderExpanded && (
                                            <div className="text-sm text-gray-500 flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded ${attendanceType === 'cadet' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                                                    {attendanceType === 'cadet' ? 'Cadets' : 'Staff'}
                                                </span>
                                                <span className="flex items-center text-green-700"><CheckCircle size={14} className="mr-1"/> {stats.present || 0}</span>
                                                <span className="flex items-center text-red-700"><XCircle size={14} className="mr-1"/> {stats.absent || 0}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isHeaderExpanded && (
                                        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <p className="text-gray-600 mb-4">{selectedDay.description || 'No description'}</p>
                                            
                                            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-end gap-4">
                                                {/* Left Side: Filters */}
                                                <div className="w-full md:w-auto flex-1 space-y-4">
                                                    <div className="flex bg-gray-200 rounded p-1 w-full md:w-fit overflow-x-auto">
                                                        <button
                                                            className={`px-4 py-1 rounded text-sm font-semibold transition whitespace-nowrap ${attendanceType === 'cadet' ? 'bg-white shadow text-green-800' : 'text-gray-600'}`}
                                                            onClick={() => setAttendanceType('cadet')}
                                                        >
                                                            Cadets
                                                        </button>
                                                        <button
                                                            className={`px-4 py-1 rounded text-sm font-semibold transition whitespace-nowrap ${attendanceType === 'staff' ? 'bg-white shadow text-green-800' : 'text-gray-600'}`}
                                                            onClick={() => setAttendanceType('staff')}
                                                        >
                                                            Training Staff
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="flex flex-col md:flex-row flex-wrap gap-2">
                                                        <input 
                                                            placeholder="Search Name..." 
                                                            className="border p-2 rounded text-sm w-full md:w-64"
                                                            value={searchTerm}
                                                            onChange={e => setSearchTerm(e.target.value)}
                                                        />
                                                        {attendanceType === 'cadet' && (
                                                            <>
                                                                <select 
                                                                    className="border p-2 rounded text-sm w-full md:w-32"
                                                                    value={filterCompany}
                                                                    onChange={e => setFilterCompany(e.target.value)}
                                                                >
                                                                    <option value="">All Companies</option>
                                                                    {COMPANY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                                <input 
                                                                    placeholder="Filter Platoon" 
                                                                    className="border p-2 rounded text-sm w-full md:w-32"
                                                                    value={filterPlatoon}
                                                                    onChange={e => setFilterPlatoon(e.target.value)}
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right Side: Import & Stats */}
                                                <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
                                                    <button 
                                                        onClick={() => setIsImportModalOpen(true)}
                                                        className="flex items-center justify-center md:justify-start text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition w-full md:w-auto"
                                                    >
                                                        <Upload size={16} className="mr-2" /> Import Attendance
                                                    </button>
                                                    <div className="flex flex-wrap gap-2 text-sm justify-start md:justify-end w-full">
                                                        <div className="flex items-center text-green-700 bg-green-50 px-2 py-1 rounded flex-1 md:flex-none justify-center"><CheckCircle size={16} className="mr-1"/> Present: {stats.present || 0}</div>
                                                        <div className="flex items-center text-red-700 bg-red-50 px-2 py-1 rounded flex-1 md:flex-none justify-center"><XCircle size={16} className="mr-1"/> Absent: {stats.absent || 0}</div>
                                                        <div className="flex items-center text-yellow-700 bg-yellow-50 px-2 py-1 rounded flex-1 md:flex-none justify-center"><Clock size={16} className="mr-1"/> Late: {stats.late || 0}</div>
                                                        <div className="flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded flex-1 md:flex-none justify-center"><AlertTriangle size={16} className="mr-1"/> Excused: {stats.excused || 0}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 border-b">{attendanceType === 'cadet' ? 'Cadet' : 'Staff Member'}</th>
                                        <th className="p-3 border-b text-center">Status</th>
                                        <th className="p-3 border-b">Remarks</th>
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
                                                        className={`p-1 rounded ${record.status === 'present' ? 'bg-green-100 text-green-700' : 'text-gray-300 hover:text-green-500'}`}
                                                        title="Present"
                                                    >
                                                        <CheckCircle size={20} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMarkAttendance(id, 'absent')}
                                                        className={`p-1 rounded ${record.status === 'absent' ? 'bg-red-100 text-red-700' : 'text-gray-300 hover:text-red-500'}`}
                                                        title="Absent"
                                                    >
                                                        <XCircle size={20} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMarkAttendance(id, 'late')}
                                                        className={`p-1 rounded ${record.status === 'late' ? 'bg-yellow-100 text-yellow-700' : 'text-gray-300 hover:text-yellow-500'}`}
                                                        title="Late"
                                                    >
                                                        <Clock size={20} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMarkAttendance(id, 'excused')}
                                                        className={`p-1 rounded ${record.status === 'excused' ? 'bg-blue-100 text-blue-700' : 'text-gray-300 hover:text-blue-500'}`}
                                                        title="Excused"
                                                    >
                                                        <AlertTriangle size={20} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center">
                                                    <input 
                                                        className="border-b border-gray-300 focus:border-green-500 outline-none w-full text-sm py-1 bg-transparent"
                                                        placeholder="Add remark..."
                                                        value={record.remarks || ''}
                                                        onChange={(e) => handleRemarkChange(id, e.target.value)}
                                                        onBlur={(e) => saveRemark(id, e.target.value, record.status)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                saveRemark(id, e.target.value, record.status);
                                                                e.target.blur();
                                                            }
                                                        }}
                                                    />
                                                </div>
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
            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">Import Attendance Records</h3>
                        <div className="text-sm text-gray-600 mb-4 space-y-2">
                            <p>Upload a file containing attendance data.</p>
                            <p><b>Supported Formats:</b> CSV, Excel, PDF, Word, Image (.png, .jpg).</p>
                            <div>
                                <b>Matching Logic:</b> The system matches cadets by:
                                <ul className="list-disc pl-5 mt-1">
                                    <li><b>Student ID</b> (Highest Priority)</li>
                                    <li><b>Email Address</b></li>
                                    <li><b>Student Name</b> (First & Last Name)</li>
                                </ul>
                            </div>
                            <p className="text-xs italic bg-gray-50 p-2 rounded">
                                For PDF/Word/Image, ensure lines contain identifiable info (ID, Email, or Name) and a status (Present, Absent, Late, Excused).
                                <br/>
                                <span className="text-blue-600 font-semibold">Note:</span> Image processing (OCR) may take a few seconds. Ensure the image text is clear.
                            </p>
                        </div>
                        <form onSubmit={handleImport} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Option 1: Upload File</label>
                                <input 
                                    type="file" 
                                    accept=".csv, .xlsx, .xls, .pdf, .docx, .doc, .png, .jpg, .jpeg, .webp, .bmp, .gif"
                                    className="w-full border p-2 rounded"
                                    onChange={e => {
                                        setImportFile(e.target.files[0]);
                                        if(e.target.files[0]) setImportUrl('');
                                    }}
                                    disabled={!!importUrl}
                                />
                            </div>

                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-gray-300"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">OR</span>
                                <div className="flex-grow border-t border-gray-300"></div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Option 2: Import from URL (Lightshot/Image)</label>
                                <input 
                                    type="url" 
                                    placeholder="https://prnt.sc/..."
                                    className="w-full border p-2 rounded"
                                    value={importUrl}
                                    onChange={e => {
                                        setImportUrl(e.target.value);
                                        if(e.target.value) setImportFile(null);
                                    }}
                                    disabled={!!importFile}
                                />
                                <p className="text-xs text-gray-500 mt-1">Paste a Lightshot link (prnt.sc) or a direct image URL.</p>
                            </div>
                            
                            <div className="flex space-x-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => { setIsImportModalOpen(false); setImportFile(null); setImportUrl(''); }}
                                    className="flex-1 py-2 border rounded hover:bg-gray-50"
                                    disabled={importing}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 flex justify-center items-center"
                                    disabled={importing || (!importFile && !importUrl)}
                                >
                                    {importing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Importing...
                                        </>
                                    ) : (
                                        'Import'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
            )}
        </div>
    );
};

export default Attendance;
