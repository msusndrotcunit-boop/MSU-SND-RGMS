import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    Calculator, 
    BookOpen, 
    ShieldAlert, 
    CalendarCheck, 
    Search, 
    X, 
    Trash2, 
    Save,
    ChevronRight,
    ChevronDown
} from 'lucide-react';
import { cacheData, getCachedData } from '../../utils/db';

const Grading = () => {
    const [cadets, setCadets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCadet, setSelectedCadet] = useState(null);
    const [activeTab, setActiveTab] = useState('proficiency'); // proficiency, merit, attendance
    const [searchTerm, setSearchTerm] = useState('');

    // Merit/Demerit State
    const [ledgerLogs, setLedgerLogs] = useState([]);
    const [ledgerForm, setLedgerForm] = useState({ type: 'merit', points: 0, reason: '' });

    // Attendance State
    const [attendanceRecords, setAttendanceRecords] = useState([]);

    // Proficiency State
    const [proficiencyForm, setProficiencyForm] = useState({
        prelimScore: 0,
        midtermScore: 0,
        finalScore: 0
    });

    useEffect(() => {
        fetchCadets();
    }, []);

    const fetchCadets = async () => {
        try {
            try {
                const cached = await getCachedData('cadets');
                if (cached?.length) {
                    setCadets(cached);
                    setLoading(false);
                }
            } catch {}
            const res = await axios.get('/api/admin/cadets');
            setCadets(res.data);
            await cacheData('cadets', res.data);
            setLoading(false);
            
            // If a cadet is selected, update their data in the view
            if (selectedCadet) {
                const updated = res.data.find(c => c.id === selectedCadet.id);
                if (updated) setSelectedCadet(updated);
            }
        } catch (err) {
            console.error("Error fetching cadets", err);
            setLoading(false);
        }
    };

    const handleSelectCadet = (cadet) => {
        setSelectedCadet(cadet);
        setProficiencyForm({
            prelimScore: cadet.prelim_score || 0,
            midtermScore: cadet.midterm_score || 0,
            finalScore: cadet.final_score || 0
        });
        if (activeTab === 'merit') {
            fetchLedgerLogs(cadet.id);
        }
    };

    // --- Subject Proficiency Logic ---
    const handleProficiencySubmit = async (e) => {
        e.preventDefault();
        try {
            // We only want to update the scores, preserve other fields
            const updateData = {
                ...proficiencyForm,
                // These are required by the backend endpoint currently but we might not want to change them
                // We'll pass the current values for safety, though the backend might overwrite specific fields
                attendancePresent: selectedCadet.attendance_present,
                meritPoints: selectedCadet.merit_points,
                demeritPoints: selectedCadet.demerit_points,
                status: selectedCadet.grade_status
            };

            await axios.put(`/api/admin/grades/${selectedCadet.id}`, updateData);
            alert('Scores updated successfully');
            fetchCadets(); // Refresh to see new computed grades
        } catch (err) {
            alert('Error updating scores');
        }
    };

    // --- Merit/Demerit Logic ---
    const fetchLedgerLogs = async (cadetId) => {
        try {
            const res = await axios.get(`/api/admin/merit-logs/${cadetId}`);
            setLedgerLogs(res.data);
        } catch (err) {
            console.error("Error fetching logs", err);
        }
    };

    // --- Attendance Logic ---
    const fetchAttendanceRecords = async (cadetId) => {
        try {
            const res = await axios.get(`/api/attendance/cadet/${cadetId}`);
            setAttendanceRecords(res.data);
        } catch (err) {
            console.error("Error fetching attendance records", err);
        }
    };

    const handleLedgerSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/admin/merit-logs', {
                cadetId: selectedCadet.id,
                ...ledgerForm
            });
            fetchLedgerLogs(selectedCadet.id);
            fetchCadets(); // Update total points
            setLedgerForm({ type: 'merit', points: 0, reason: '' });
        } catch (err) {
            alert('Error adding log');
        }
    };

    const handleDeleteLog = async (logId) => {
        if(!confirm('Are you sure you want to delete this record?')) return;
        try {
            await axios.delete(`/api/admin/merit-logs/${logId}`);
            fetchLedgerLogs(selectedCadet.id);
            fetchCadets();
        } catch (err) {
            alert('Error deleting log');
        }
    };

    // --- Filtered List ---
    const filteredCadets = cadets.filter(c => 
        c.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.student_id.includes(searchTerm)
    );

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="flex h-full flex-col md:flex-row gap-6">
            {/* Left Panel: Cadet List */}
            <div className={`w-full md:w-1/3 bg-white rounded shadow flex flex-col ${selectedCadet ? 'hidden md:flex' : ''}`}>
                <div className="p-4 border-b">
                    <h2 className="text-xl font-bold mb-4">Grading Management</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 p-2 border rounded bg-gray-50" 
                            placeholder="Search cadets..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredCadets.map(cadet => (
                        <div 
                            key={cadet.id}
                            onClick={() => handleSelectCadet(cadet)}
                            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition ${selectedCadet?.id === cadet.id ? 'bg-green-50 border-l-4 border-green-600' : ''}`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-gray-800">{cadet.last_name}, {cadet.first_name}</div>
                                    <div className="text-sm text-gray-500">{cadet.company}/{cadet.platoon} • {cadet.student_id}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">Final</div>
                                    <div className={`font-bold ${cadet.finalGrade >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                                        {cadet.finalGrade.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Grading Details */}
            <div className={`w-full md:w-2/3 bg-white rounded shadow flex flex-col ${!selectedCadet ? 'hidden md:flex justify-center items-center text-gray-400' : ''}`}>
                {!selectedCadet ? (
                    <div className="text-center">
                        <Calculator size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Select a cadet to manage grades</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b flex justify-between items-start bg-gray-50">
                            <div>
                                <button onClick={() => setSelectedCadet(null)} className="md:hidden text-gray-500 mb-2 flex items-center">
                                    <ChevronDown className="rotate-90 mr-1" size={16} /> Back to List
                                </button>
                                <h2 className="text-2xl font-bold">{selectedCadet.rank} {selectedCadet.last_name}, {selectedCadet.first_name}</h2>
                                <p className="text-gray-600">{selectedCadet.student_id} • {selectedCadet.company}/{selectedCadet.platoon}</p>
                            </div>
                            <div className="text-right bg-white p-3 rounded shadow-sm border">
                                <div className="text-sm text-gray-500 uppercase tracking-wide">Final Grade</div>
                                <div className={`text-3xl font-bold ${selectedCadet.finalGrade >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                                    {selectedCadet.finalGrade.toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-400">Transmuted: {selectedCadet.transmutedGrade}</div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b">
                            <button 
                                onClick={() => setActiveTab('proficiency')}
                                className={`flex-1 py-4 text-center font-medium flex justify-center items-center space-x-2 border-b-2 transition ${activeTab === 'proficiency' ? 'border-green-600 text-green-700 bg-green-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <BookOpen size={18} />
                                <span>Subject Proficiency</span>
                            </button>
                            <button 
                                onClick={() => { setActiveTab('merit'); fetchLedgerLogs(selectedCadet.id); }}
                                className={`flex-1 py-4 text-center font-medium flex justify-center items-center space-x-2 border-b-2 transition ${activeTab === 'merit' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <ShieldAlert size={18} />
                                <span>Merit / Demerit</span>
                            </button>
                            <button 
                                onClick={() => setActiveTab('attendance')}
                                className={`flex-1 py-4 text-center font-medium flex justify-center items-center space-x-2 border-b-2 transition ${activeTab === 'attendance' ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <CalendarCheck size={18} />
                                <span>Attendance</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                            
                            {/* TAB 1: Subject Proficiency */}
                            {activeTab === 'proficiency' && (
                                <div className="max-w-xl mx-auto">
                                    <div className="bg-white p-6 rounded shadow-sm border mb-6">
                                        <h3 className="font-bold text-lg mb-4 flex items-center text-gray-800">
                                            <BookOpen className="mr-2 text-green-600" size={20} />
                                            Examination Scores (40%)
                                        </h3>
                                        <form onSubmit={handleProficiencySubmit} className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Prelim Score (0-100)</label>
                                                <input 
                                                    type="number" 
                                                    min="0" max="100"
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                                                    value={proficiencyForm.prelimScore}
                                                    onChange={e => setProficiencyForm({...proficiencyForm, prelimScore: Number(e.target.value)})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Midterm Score (0-100)</label>
                                                <input 
                                                    type="number" 
                                                    min="0" max="100"
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                                                    value={proficiencyForm.midtermScore}
                                                    onChange={e => setProficiencyForm({...proficiencyForm, midtermScore: Number(e.target.value)})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Final Score (0-100)</label>
                                                <input 
                                                    type="number" 
                                                    min="0" max="100"
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                                                    value={proficiencyForm.finalScore}
                                                    onChange={e => setProficiencyForm({...proficiencyForm, finalScore: Number(e.target.value)})}
                                                />
                                            </div>
                                            <div className="pt-4 border-t flex justify-between items-center">
                                                <div className="text-sm text-gray-500">
                                                    Computed Subject Score: <strong>{selectedCadet.subjectScore?.toFixed(2)} / 40</strong>
                                                </div>
                                                <button type="submit" className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800 flex items-center">
                                                    <Save size={18} className="mr-2" /> Save Scores
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: Merit/Demerit */}
                            {activeTab === 'merit' && (
                                <div className="space-y-6">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-4 rounded shadow-sm border border-l-4 border-l-blue-500">
                                            <div className="text-sm text-gray-500">Merits</div>
                                            <div className="text-2xl font-bold text-blue-600">+{selectedCadet.merit_points}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded shadow-sm border border-l-4 border-l-red-500">
                                            <div className="text-sm text-gray-500">Demerits</div>
                                            <div className="text-2xl font-bold text-red-600">-{selectedCadet.demerit_points}</div>
                                        </div>
                                    </div>

                                    {/* Add New Log */}
                                    <div className="bg-white p-6 rounded shadow-sm border">
                                        <h3 className="font-bold text-lg mb-4">Add Entry</h3>
                                        <form onSubmit={handleLedgerSubmit} className="flex flex-col md:flex-row gap-4 md:items-end">
                                            <div className="w-full md:w-1/4">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                                                <select 
                                                    className="w-full border p-2 rounded"
                                                    value={ledgerForm.type}
                                                    onChange={e => setLedgerForm({...ledgerForm, type: e.target.value})}
                                                >
                                                    <option value="merit">Merit</option>
                                                    <option value="demerit">Demerit</option>
                                                </select>
                                            </div>
                                            <div className="w-full md:w-1/4">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Points</label>
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    className="w-full border p-2 rounded"
                                                    value={ledgerForm.points}
                                                    onChange={e => setLedgerForm({...ledgerForm, points: Number(e.target.value)})}
                                                />
                                            </div>
                                            <div className="w-full md:flex-1">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Reason/Date</label>
                                                <input 
                                                    className="w-full border p-2 rounded"
                                                    placeholder="e.g. Leadership / Late"
                                                    value={ledgerForm.reason}
                                                    onChange={e => setLedgerForm({...ledgerForm, reason: e.target.value})}
                                                />
                                            </div>
                                            <button type="submit" className="w-full md:w-auto bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                                                Add
                                            </button>
                                        </form>
                                    </div>

                                    {/* History Table */}
                                    <div className="bg-white rounded shadow-sm border overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-100 border-b">
                                                <tr>
                                                    <th className="p-3">Date</th>
                                                    <th className="p-3">Type</th>
                                                    <th className="p-3">Points</th>
                                                    <th className="p-3">Reason</th>
                                                    <th className="p-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ledgerLogs.length === 0 ? (
                                                    <tr><td colSpan="5" className="p-4 text-center text-gray-500">No logs found</td></tr>
                                                ) : (
                                                    ledgerLogs.map(log => (
                                                        <tr key={log.id} className="border-b hover:bg-gray-50">
                                                            <td className="p-3 text-gray-600">{new Date(log.created_at).toLocaleDateString()}</td>
                                                            <td className="p-3">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${log.type === 'merit' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                                                    {log.type.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 font-mono">{log.points}</td>
                                                            <td className="p-3">{log.reason}</td>
                                                            <td className="p-3 text-right">
                                                                <button 
                                                                    onClick={() => handleDeleteLog(log.id)}
                                                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: Attendance */}
                            {activeTab === 'attendance' && (
                                <div className="max-w-xl mx-auto">
                                    <div className="bg-white p-6 rounded shadow-sm border text-center">
                                        <CalendarCheck size={48} className="mx-auto text-blue-600 mb-4" />
                                        <h3 className="text-xl font-bold mb-2">Attendance Summary</h3>
                                        <p className="text-gray-500 mb-6">Based on daily attendance records.</p>
                                        
                                        <div className="flex justify-center space-x-8 mb-8">
                                            <div>
                                                <div className="text-4xl font-bold text-gray-800">{selectedCadet.attendance_present}</div>
                                                <div className="text-sm text-gray-500">Days Present</div>
                                            </div>
                                            <div className="h-12 w-px bg-gray-200"></div>
                                            <div>
                                                <div className="text-4xl font-bold text-green-600">{selectedCadet.attendanceScore?.toFixed(2)}</div>
                                                <div className="text-sm text-gray-500">Points (Max 30)</div>
                                            </div>
                                        </div>

                                        <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
                                            <p>Attendance is automatically tracked from the <strong>Attendance</strong> page. Please use the main Attendance module to modify daily records.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Grading;
