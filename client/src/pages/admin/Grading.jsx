import React, { useEffect, useState, useRef } from 'react';
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
    ChevronDown,
    Camera,
    ScanLine
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { cacheData, getCachedData, getSingleton, cacheSingleton } from '../../utils/db';

const Grading = () => {
    const [cadets, setCadets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCadet, setSelectedCadet] = useState(null);
    const [activeTab, setActiveTab] = useState('proficiency'); // proficiency, merit, attendance
    const [searchTerm, setSearchTerm] = useState('');

    // Scanner State
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanConfig, setScanConfig] = useState({
        examType: 'prelim', // prelim, midterm, final
        pointsPerItem: 1,
        correctAnswers: ''
    });
    const [lastScanned, setLastScanned] = useState(null);
    const scannerRef = useRef(null);
    const lastScanTimeRef = useRef(0);

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

    // Scanner Effect
    useEffect(() => {
        if (isScannerOpen && !scannerRef.current) {
            // Delay to ensure DOM is ready
            setTimeout(() => {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    /* verbose= */ false
                );
                scanner.render(onScanSuccess, onScanFailure);
                scannerRef.current = scanner;
            }, 100);
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
                scannerRef.current = null;
            }
        };
    }, [isScannerOpen]); // Re-init when opened

    // Re-bind scan success when config changes to capture latest state
    useEffect(() => {
        if (scannerRef.current) {
            // We can't easily re-bind the callback in Html5QrcodeScanner without clearing
            // So we rely on a ref or closure. 
            // Actually, React state in callback might be stale if not careful.
            // Using a ref for the latest config is safer.
        }
    }, [scanConfig, cadets]);
    
    // Use Ref for config to avoid stale closures in scanner callback
    const configRef = useRef(scanConfig);
    const cadetsRef = useRef(cadets);
    useEffect(() => { configRef.current = scanConfig; }, [scanConfig]);
    useEffect(() => { cadetsRef.current = cadets; }, [cadets]);

    const onScanSuccess = async (decodedText, decodedResult) => {
        const now = Date.now();
        if (now - lastScanTimeRef.current < 2000) return; // 2s cooldown
        lastScanTimeRef.current = now;

        try {
            const data = JSON.parse(decodedText);
            const { student_id, answers, exam_type } = data;

            if (!student_id || !answers) {
                alert('Invalid QR Data: Missing student_id or answers');
                return;
            }

            const currentConfig = configRef.current;
            const currentCadets = cadetsRef.current;

            // Determine Exam Type (QR overrides Config)
            const targetExam = (exam_type || currentConfig.examType).toLowerCase();
            let scoreField = '';
            if (targetExam.includes('prelim')) scoreField = 'prelim_score';
            else if (targetExam.includes('midterm')) scoreField = 'midterm_score';
            else if (targetExam.includes('final')) scoreField = 'final_score';
            else {
                alert(`Unknown exam type: ${targetExam}`);
                return;
            }

            // Calculate Score
            const key = currentConfig.correctAnswers.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Normalize key
            const studentAnswers = answers.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Normalize answers
            const points = Number(currentConfig.pointsPerItem) || 1;

            let score = 0;
            // Assuming simple char-by-char comparison or comma separated
            // If length matches, compare char by char
            const limit = Math.min(key.length, studentAnswers.length);
            for (let i = 0; i < limit; i++) {
                if (key[i] === studentAnswers[i]) score += points;
            }

            // Find Cadet
            const cadet = currentCadets.find(c => c.student_id === student_id);
            if (!cadet) {
                alert(`Cadet not found: ${student_id}`);
                return;
            }

            // Update Backend
            // We need to fetch the existing grades row first or assume we have it?
            // The /api/admin/grades/:id endpoint updates scores.
            // We need to send ALL scores to avoid overwriting with zeros if we only send one?
            // Let's check handleProficiencySubmit: it sends `updateData` with all fields.
            // We should use the cadet's existing scores for the other fields.
            
            const updateData = {
                prelimScore: cadet.prelim_score || 0,
                midtermScore: cadet.midterm_score || 0,
                finalScore: cadet.final_score || 0,
                attendancePresent: cadet.attendance_present || 0,
                meritPoints: cadet.merit_points || 0,
                demeritPoints: cadet.demerit_points || 0,
                status: cadet.grade_status || 'active'
            };

            // Update the specific field
            if (scoreField === 'prelim_score') updateData.prelimScore = score;
            if (scoreField === 'midterm_score') updateData.midtermScore = score;
            if (scoreField === 'final_score') updateData.finalScore = score;

            await axios.put(`/api/admin/grades/${cadet.id}`, updateData);

            // Update Local State
            setLastScanned({ name: `${cadet.last_name}, ${cadet.first_name}`, score, type: targetExam });
            
            // Refresh List
            fetchCadets(true);

            // Audio Feedback
            const audio = new Audio('/assets/beep.mp3'); // Optional
            // audio.play().catch(e => {});

        } catch (e) {
            console.error(e);
            alert('Scan Error: ' + e.message);
        }
    };

    const onScanFailure = (error) => {
        // console.warn(error);
    };

    const fetchCadets = async (forceRefresh = false) => {
        try {
            if (!forceRefresh) {
                // Try cache first
                const cached = await getSingleton('grading', 'cadets_list');
                if (cached) {
                    setCadets(cached.data);
                    setLoading(false);
                    
                    // If cache is fresh (< 2 mins), skip API
                    if (cached.timestamp && (Date.now() - cached.timestamp < 2 * 60 * 1000)) {
                        return;
                    }
                }
            }

            const res = await axios.get('/api/admin/cadets');
            setCadets(res.data);
            await cacheSingleton('grading', 'cadets_list', {
                data: res.data,
                timestamp: Date.now()
            });
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
            await cacheSingleton('admin', 'cadets_list', null); // Sync with admin list
            fetchCadets(true); // Force refresh
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
            await cacheSingleton('admin', 'cadets_list', null); // Sync with admin list
            fetchCadets(true); // Update total points
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
            await cacheSingleton('admin', 'cadets_list', null); // Sync with admin list
            fetchCadets(true);
        } catch (err) {
            alert('Error deleting log');
        }
    };

    // --- Filtered List ---
    const filteredCadets = cadets.filter(c => 
        (c.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.student_id.includes(searchTerm)) &&
        c.is_profile_completed // Only show verified cadets
    );

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="relative h-full">
            {/* Scanner Modal */}
            {isScannerOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-5xl h-[85vh] flex flex-col md:flex-row overflow-hidden shadow-2xl">
                        {/* Left: Config & Results */}
                        <div className="w-full md:w-1/3 border-r bg-gray-50 flex flex-col">
                            <div className="p-5 border-b bg-white flex justify-between items-center">
                                <h3 className="font-bold text-lg flex items-center text-gray-800">
                                    <ScanLine className="mr-2 text-blue-600" size={20} /> 
                                    Exam Scanner
                                </h3>
                                <button onClick={() => setIsScannerOpen(false)} className="text-gray-400 hover:text-gray-700 transition">
                                    <X size={24} />
                                </button>
                            </div>
                            
                            <div className="p-5 flex-1 overflow-y-auto space-y-5">
                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Exam Configuration</label>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                                            <select 
                                                className="w-full border-gray-300 border p-2.5 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                                value={scanConfig.examType}
                                                onChange={e => setScanConfig({...scanConfig, examType: e.target.value})}
                                            >
                                                <option value="prelim">Prelim Exam</option>
                                                <option value="midterm">Midterm Exam</option>
                                                <option value="final">Final Exam</option>
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Points per Item</label>
                                            <input 
                                                type="number" 
                                                min="1"
                                                className="w-full border-gray-300 border p-2.5 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                                value={scanConfig.pointsPerItem}
                                                onChange={e => setScanConfig({...scanConfig, pointsPerItem: Number(e.target.value)})}
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answers Key</label>
                                            <div className="relative">
                                                <textarea 
                                                    className="w-full border-gray-300 border p-3 rounded-md font-mono text-lg tracking-widest uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                                    rows="4"
                                                    placeholder="ABCD..."
                                                    value={scanConfig.correctAnswers}
                                                    onChange={e => setScanConfig({...scanConfig, correctAnswers: e.target.value})}
                                                />
                                                <div className="absolute bottom-2 right-2 text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">
                                                    {scanConfig.correctAnswers.replace(/[^A-Z0-9]/gi, '').length} items
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Enter keys without spaces (e.g., AABCC)</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Last Scanned Result */}
                                {lastScanned && (
                                    <div className="bg-green-50 border border-green-200 p-5 rounded-lg shadow-sm animate-pulse-once">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-green-700 uppercase tracking-wide bg-green-100 px-2 py-0.5 rounded">Success</span>
                                            <span className="text-xs text-green-600">{new Date().toLocaleTimeString()}</span>
                                        </div>
                                        <div className="font-bold text-lg text-gray-900 mb-1">{lastScanned.name}</div>
                                        <div className="flex justify-between items-end border-t border-green-200 pt-2 mt-2">
                                            <div className="text-sm text-gray-600 capitalize">{lastScanned.type.replace('_', ' ')}</div>
                                            <div className="text-2xl font-bold text-green-700">{lastScanned.score} <span className="text-sm font-normal text-green-600">pts</span></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Camera */}
                        <div className="w-full md:w-2/3 bg-gray-900 flex flex-col relative">
                            <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-md">
                                Camera Active
                            </div>
                            <div className="flex-1 flex items-center justify-center p-6">
                                <div id="reader" className="w-full max-w-lg bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700"></div>
                            </div>
                            <div className="p-4 bg-gray-800 text-center text-gray-400 text-sm">
                                Position the QR code within the frame to scan automatically.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex h-full flex-col md:flex-row gap-6">
            {/* Left Panel: Cadet List */}
            <div className={`w-full md:w-1/3 bg-white rounded shadow flex flex-col ${selectedCadet ? 'hidden md:flex' : ''}`}>
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Grading Management</h2>
                        <button 
                            onClick={() => setIsScannerOpen(true)}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 flex items-center text-sm transition"
                        >
                            <ScanLine size={16} className="mr-1.5" /> Scan Exams
                        </button>
                    </div>
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
                                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.type === 'merit' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                                        {log.type && typeof log.type === 'string' ? log.type.toUpperCase() : 'UNKNOWN'}
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
        </div>
    );
};

export default Grading;
