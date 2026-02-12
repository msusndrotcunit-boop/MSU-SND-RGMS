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
    ScanLine,
    Download,
    CheckCircle,
    AlertCircle,
    RefreshCw,
    Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
    
    // Smart Scanner (Camera) State
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [capturedImage, setCapturedImage] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [targetCadetId, setTargetCadetId] = useState('');

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

    // Set target cadet when opening scanner if a cadet is already selected
    useEffect(() => {
        if (isScannerOpen && selectedCadet) {
            setTargetCadetId(selectedCadet.id);
        }
    }, [isScannerOpen, selectedCadet]);

    // Sync Proficiency Form with Selected Cadet (e.g. after scan update)
    useEffect(() => {
        if (selectedCadet) {
            setProficiencyForm({
                prelimScore: selectedCadet.prelim_score || 0,
                midtermScore: selectedCadet.midterm_score || 0,
                finalScore: selectedCadet.final_score || 0
            });
        }
    }, [selectedCadet]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setCameraActive(true);
                setCapturedImage(null);
                setScanResult(null);
            }
        } catch (err) {
            console.error("Camera Error", err);
            alert("Failed to access camera. Please check permissions.");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            setCameraActive(false);
        }
    };

    // Clean up camera on unmount or close
    useEffect(() => {
        if (!isScannerOpen) stopCamera();
        return () => stopCamera();
    }, [isScannerOpen]);

    const captureAndAnalyze = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsProcessing(true);
        setScanResult(null);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const dataUrl = canvas.toDataURL('image/png');
            setCapturedImage(dataUrl);
            stopCamera(); // Pause camera to show result

            // Check if Tesseract is loaded
            if (!window.Tesseract) {
                throw new Error("OCR Library not loaded. Check internet connection.");
            }

            const { data: { text } } = await window.Tesseract.recognize(dataUrl, 'eng');
            
            // --- VALIDATION: Check if it's a test paper ---
            // 1. Check for common keywords
            const keywords = ['NAME', 'SCORE', 'GRADE', 'TEST', 'EXAM', 'SUBJECT', 'DATE', 'SECTION', 'NO.', 'ITEM', 'TOTAL'];
            const upperText = text.toUpperCase();
            const hasKeyword = keywords.some(k => upperText.includes(k));

            // 2. Try to detect answers format (e.g., "1. A", "2. B")
            const answerRegex = /\b(\d+)\s*[.\-):]+\s*([A-E])\b/gi;
            const matches = [...text.matchAll(answerRegex)];
            
            // Reject if no keywords AND fewer than 3 detectable answers
            if (!hasKeyword && matches.length < 3) {
                alert("Non-test paper detected.\n\nPlease scan a valid test paper containing:\n- Headers (Name, Test, Score)\n- Or answers formatted as '1. A', '2. B'");
                setIsProcessing(false);
                return;
            }

            // --- GRADING LOGIC ---
            const key = scanConfig.correctAnswers.toUpperCase().replace(/[^A-Z]/g, '');
            let correctCount = 0;
            let wrongCount = 0;
            let totalItems = key.length || 0;
            let calculatedScore = 0;
            
            if (key.length > 0) {
                // Key Matching Mode
                if (matches.length === 0) {
                    // Try fallback: plain sequence of letters if explicit numbering isn't found
                    // Only if text looks like a block of answers
                    const possibleAnswers = upperText.replace(/[^A-E]/g, '');
                    if (possibleAnswers.length >= key.length * 0.5) {
                        // Very basic fallback: just compare sequence
                        const limit = Math.min(possibleAnswers.length, key.length);
                        for (let i = 0; i < limit; i++) {
                            if (possibleAnswers[i] === key[i]) correctCount++;
                            else wrongCount++;
                        }
                        if (key.length > limit) wrongCount += (key.length - limit);
                    } else {
                        alert("Could not detect answer format.\nPlease format answers as '1. A', '2. B' for best results.");
                        setIsProcessing(false);
                        return;
                    }
                } else {
                    // Smart Matching using Question Numbers
                    const studentAnswers = {};
                    matches.forEach(m => {
                        const qNum = parseInt(m[1], 10);
                        const ans = m[2].toUpperCase();
                        studentAnswers[qNum] = ans;
                    });

                    for (let i = 0; i < key.length; i++) {
                        const qNum = i + 1;
                        const correct = key[i];
                        const student = studentAnswers[qNum];
                        
                        if (student) {
                            if (student === correct) correctCount++;
                            else wrongCount++;
                        } else {
                            wrongCount++; // Unanswered or undetected
                        }
                    }
                }
                totalItems = key.length;
            } else {
                // No key provided: Look for Score/Grade
                const scoreMatch = text.match(/(?:Score|Grade|Total)\s*[:\-\s]?\s*(\d+)(?:\s*\/\s*(\d+))?/i);
                const fractionMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
                
                if (scoreMatch) {
                    correctCount = parseInt(scoreMatch[1], 10);
                    totalItems = scoreMatch[2] ? parseInt(scoreMatch[2], 10) : 100; // Default to 100 items if denominator missing
                    wrongCount = totalItems - correctCount;
                } else if (fractionMatch) {
                    correctCount = parseInt(fractionMatch[1], 10);
                    totalItems = parseInt(fractionMatch[2], 10);
                    wrongCount = totalItems - correctCount;
                } else {
                    alert("No Answer Key provided and no Score found on paper.\n\nPlease either:\n1. Enter an Answer Key (e.g. ABCD)\n2. Or write 'Score: XX/YY' on the paper.");
                    setIsProcessing(false);
                    return;
                }
            }

            const pointsPerItem = Number(scanConfig.pointsPerItem) || 1;
            calculatedScore = correctCount * pointsPerItem;

            setScanResult({
                totalItems,
                wrongCount,
                score: calculatedScore,
                examType: scanConfig.examType,
                rawText: text
            });

            // --- AUTO-SAVE LOGIC ---
            // If validated (which it is if we reached here) and cadet selected, save automatically
            if (targetCadetId) {
                const cadet = cadets.find(c => c.id === Number(targetCadetId));
                if (cadet) {
                    try {
                        const scoreField = 
                            scanConfig.examType === 'prelim' ? 'prelimScore' :
                            scanConfig.examType === 'midterm' ? 'midtermScore' :
                            'finalScore';

                        const updateData = {
                            prelimScore: cadet.prelim_score || 0,
                            midtermScore: cadet.midterm_score || 0,
                            finalScore: cadet.final_score || 0,
                            attendancePresent: cadet.attendance_present || 0,
                            meritPoints: cadet.merit_points || 0,
                            demeritPoints: cadet.demerit_points || 0,
                            status: cadet.grade_status || 'active',
                            [scoreField]: Number(calculatedScore)
                        };

                        await axios.put(`/api/admin/grades/${cadet.id}`, updateData);
                        
                        // Update UI to show saved
                        setLastScanned({
                            name: `${cadet.last_name}, ${cadet.first_name}`,
                            score: calculatedScore,
                            type: scanConfig.examType
                        });

                        // Refresh cadet list in background
                        fetchCadets(true);
                        
                        // Optional: Brief success indicator or just rely on Last Scanned box
                        // We keep the captured image/result open so they can review, but it's already saved.
                    } catch (saveErr) {
                        console.error("Auto-save failed:", saveErr);
                        alert("Auto-save failed. Please try syncing manually.");
                    }
                }
            } else {
                alert("Score calculated but NOT saved: Please select a cadet first.");
            }

        } catch (err) {
            console.error("Scan analysis error:", err);
            alert("Analysis Failed: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmScanResult = async () => {
        if (!scanResult || !targetCadetId) {
            alert("Please select a cadet first.");
            return;
        }

        const cadet = cadets.find(c => c.id === Number(targetCadetId));
        if (!cadet) return;

        try {
            const scoreField = 
                scanResult.examType === 'prelim' ? 'prelimScore' :
                scanResult.examType === 'midterm' ? 'midtermScore' :
                'finalScore';

            const updateData = {
                prelimScore: cadet.prelim_score || 0,
                midtermScore: cadet.midterm_score || 0,
                finalScore: cadet.final_score || 0,
                attendancePresent: cadet.attendance_present || 0,
                meritPoints: cadet.merit_points || 0,
                demeritPoints: cadet.demerit_points || 0,
                status: cadet.grade_status || 'active',
                [scoreField]: Number(scanResult.score)
            };

            await axios.put(`/api/admin/grades/${cadet.id}`, updateData);
            
            // Update local state
            setLastScanned({
                name: `${cadet.last_name}, ${cadet.first_name}`,
                score: scanResult.score,
                type: scanResult.examType
            });

            // Refresh data
            fetchCadets(true);
            
            // Reset for next scan
            setScanResult(null);
            setCapturedImage(null);
            startCamera(); // Restart camera

        } catch (err) {
            console.error(err);
            alert("Failed to update grade.");
        }
    };

    const fetchCadets = async (forceRefresh = false) => {
        try {
            if (!forceRefresh) {
                // Try cache first
                const cached = await getSingleton('admin', 'cadets_list');
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
                        // Filter unverified cadets
                        const verifiedData = data.filter(c => c.is_profile_completed);
                        setCadets(verifiedData);
                        setLoading(false);
                        
                        // If cache is fresh (< 2 mins), skip API
                        if (timestamp && (Date.now() - timestamp < 2 * 60 * 1000)) {
                            return;
                        }
                    }
                }
            }

            const res = await axios.get('/api/admin/cadets');
            // Filter unverified cadets
            const verifiedRes = res.data.filter(c => c.is_profile_completed);
            setCadets(verifiedRes);
            await cacheSingleton('admin', 'cadets_list', {
                data: res.data, // Cache ALL data (Cadet Management needs all)
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

    const handleExport = () => {
        const headers = ["Student ID", "Last Name", "First Name", "Company", "Platoon", "Prelim", "Midterm", "Final", "Subject Score", "Merits", "Demerits", "Attendance Present", "Attendance Score", "Final Grade", "Transmuted"];
        const now = new Date();
        const generatedAt = now.toLocaleString();
        const totalRecords = filteredCadets.length;
        
        const headerBlock = [
            `Report,Grading List`,
            `Generated,"${generatedAt}"`,
            ''
        ].join('\n');

        const bodyBlock = [
            headers.join(','),
            ...filteredCadets.map(c => [
                c.student_id,
                `"${c.last_name}"`,
                `"${c.first_name}"`,
                c.company,
                c.platoon,
                c.prelim_score,
                c.midterm_score,
                c.final_score,
                c.subjectScore,
                c.merit_points,
                c.demerit_points,
                c.attendance_present,
                c.attendanceScore,
                c.finalGrade,
                c.transmutedGrade
            ].join(','))
        ].join('\n');

        const footerBlock = [
            '',
            `Prepared By,"Wilmer B Montejo","SSg (Inf) PA • Admin NCO"`,
            `Certified Correct,"INDIHRA D TAWANTAWAN","LTC (RES) PA • Commandant"`,
            `Total Records,${totalRecords}`,
        ].join('\n');

        const csvContent = [headerBlock, bodyBlock, footerBlock].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grading_list_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="relative h-full">
            {/* Scanner Modal */}
            {isScannerOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-none md:rounded-xl w-full max-w-6xl h-full md:h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl">
                        {/* Left: Config & Results */}
                        <div className="w-full md:w-1/3 border-r bg-gray-50 flex flex-col h-1/3 md:h-auto overflow-y-auto">
                            <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0 z-10">
                                <h3 className="font-bold text-lg flex items-center text-gray-800">
                                    <ScanLine className="mr-2 text-blue-600" size={20} /> 
                                    Smart Exam Scanner
                                </h3>
                                <button onClick={() => setIsScannerOpen(false)} className="text-gray-400 hover:text-gray-700 transition">
                                    <X size={24} />
                                </button>
                            </div>
                            
                            <div className="p-4 space-y-6">
                                {/* Cadet Selection */}
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
                                    <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Target Cadet</label>
                                    <select 
                                        value={targetCadetId}
                                        onChange={e => setTargetCadetId(e.target.value)}
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- Select Cadet --</option>
                                        {filteredCadets.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.last_name}, {c.first_name} ({c.student_id})
                                            </option>
                                        ))}
                                    </select>
                                    {!targetCadetId && <p className="text-xs text-red-500 mt-1">Please select a cadet before scanning</p>}
                                </div>

                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Configuration</label>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                                            <select 
                                                className="w-full border p-2 rounded"
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
                                                type="number" min="1"
                                                className="w-full border p-2 rounded"
                                                value={scanConfig.pointsPerItem}
                                                onChange={e => setScanConfig({...scanConfig, pointsPerItem: Number(e.target.value)})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Key (Length determines items)</label>
                                            <input 
                                                className="w-full border p-2 rounded font-mono uppercase"
                                                placeholder="ANSWERKEY..."
                                                value={scanConfig.correctAnswers}
                                                onChange={e => setScanConfig({...scanConfig, correctAnswers: e.target.value})}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Total Items: {scanConfig.correctAnswers.length || 100}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Last Scanned Result */}
                                {lastScanned && (
                                    <div className="bg-green-50 border border-green-200 p-5 rounded-lg shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-green-700 uppercase tracking-wide bg-green-100 px-2 py-0.5 rounded">Saved</span>
                                            <span className="text-xs text-green-600">{new Date().toLocaleTimeString()}</span>
                                        </div>
                                        <div className="font-bold text-lg text-gray-900 mb-1">{lastScanned.name}</div>
                                        <div className="flex justify-between items-end border-t border-green-200 pt-2 mt-2">
                                            <div className="text-sm text-gray-600 capitalize">{lastScanned.type}</div>
                                            <div className="text-2xl font-bold text-green-700">{lastScanned.score} <span className="text-sm font-normal text-green-600">pts</span></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Camera & Analysis */}
                        <div className="w-full md:w-2/3 bg-gray-900 flex flex-col relative flex-1 md:flex-auto">
                            <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                                {/* Camera View */}
                                <video 
                                    ref={videoRef} 
                                    autoPlay playsInline muted 
                                    className={`absolute inset-0 w-full h-full object-cover ${capturedImage ? 'hidden' : ''}`}
                                />
                                <canvas ref={canvasRef} className="hidden" />
                                
                                {/* Captured Image View */}
                                {capturedImage && (
                                    <img src={capturedImage} alt="Captured Exam" className="absolute inset-0 w-full h-full object-contain bg-black" />
                                )}

                                {/* Overlay / HUD */}
                                {!capturedImage && cameraActive && (
                                    <div className="absolute inset-0 border-2 border-blue-500 opacity-50 pointer-events-none m-8 rounded-lg">
                                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1"></div>
                                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1"></div>
                                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1"></div>
                                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <p className="text-white text-opacity-80 font-bold bg-black bg-opacity-50 px-3 py-1 rounded">Align Exam Paper</p>
                                        </div>
                                    </div>
                                )}

                                {/* Start Camera Button */}
                                {!cameraActive && !capturedImage && (
                                    <div className="text-center">
                                        <button 
                                            onClick={startCamera}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full flex items-center gap-2 transition transform hover:scale-105"
                                        >
                                            <Camera size={24} /> Activate Smart Camera
                                        </button>
                                        <p className="text-gray-500 mt-4 text-sm">Camera permission required</p>
                                    </div>
                                )}
                            </div>

                            {/* Controls Bar */}
                            <div className="p-4 bg-gray-800 border-t border-gray-700 flex justify-between items-center">
                                {cameraActive && !isProcessing && (
                                    <div className="flex gap-4 w-full justify-center">
                                        <button 
                                            onClick={captureAndAnalyze}
                                            className="bg-white text-gray-900 px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-200 transition"
                                        >
                                            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                                            Capture & Grade
                                        </button>
                                        <button onClick={stopCamera} className="text-gray-400 hover:text-white px-4 py-2">Cancel</button>
                                    </div>
                                )}

                                {isProcessing && (
                                    <div className="w-full text-center text-white flex items-center justify-center gap-3">
                                        <RefreshCw className="animate-spin" />
                                        <span>Analyzing Answers & Computing Score...</span>
                                    </div>
                                )}

                                {scanResult && (
                                    <div className="w-full flex items-center justify-between animate-slide-up">
                                        <div className="text-white">
                                            <div className="text-xs text-gray-400 uppercase">Computed Score</div>
                                            <div className="text-2xl font-bold text-green-400">{scanResult.score} / {scanResult.totalItems * scanConfig.pointsPerItem}</div>
                                            <div className="text-xs text-red-400 flex items-center gap-1">
                                                <AlertCircle size={12} /> {scanResult.wrongCount} Wrong Answers Detected
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => { setCapturedImage(null); setScanResult(null); startCamera(); }}
                                                className="px-4 py-2 text-gray-300 hover:text-white"
                                            >
                                                Retake
                                            </button>
                                            <button 
                                                onClick={confirmScanResult}
                                                className="bg-[var(--primary-color)] hover:opacity-90 text-white px-6 py-2 rounded font-bold flex items-center gap-2"
                                            >
                                                <CheckCircle size={18} /> Sync to Gradebook
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex h-full flex-col md:flex-row gap-6">
            {/* Left Panel: Cadet List */}
            <div className={`w-full md:w-1/3 bg-white dark:bg-gray-900 rounded shadow flex flex-col ${selectedCadet ? 'hidden md:flex' : ''}`}>
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Grading Management</h2>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleExport}
                                className="bg-[var(--primary-color)] text-white px-3 py-1.5 rounded hover:opacity-90 flex items-center text-sm transition"
                                title="Export CSV"
                            >
                                <Download size={16} />
                            </button>
                            <button 
                                onClick={() => setIsScannerOpen(true)}
                                className="bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-black flex items-center text-sm transition"
                            >
                                <ScanLine size={16} className="mr-1.5" /> Scan Exams
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 p-2 border rounded bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" 
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
                            className={`p-4 border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition ${selectedCadet?.id === cadet.id ? 'bg-[var(--primary-color)]/10 border-l-4 border-[var(--primary-color)]' : ''}`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-gray-800 dark:text-gray-100">{cadet.last_name}, {cadet.first_name}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">{cadet.company}/{cadet.platoon} • {cadet.student_id}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">Final</div>
                                    <div className={`font-bold ${(cadet.finalGrade || 0) >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                                        {(cadet.finalGrade || 0).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Grading Details */}
            <div className={`w-full md:w-2/3 bg-white dark:bg-gray-900 rounded shadow flex flex-col ${!selectedCadet ? 'hidden md:flex justify-center items-center text-gray-400 dark:text-gray-500' : ''}`}>
                {!selectedCadet ? (
                    <div className="text-center">
                        <Calculator size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Select a cadet to manage grades</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b flex justify-between items-start bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                            <div>
                                <button onClick={() => setSelectedCadet(null)} className="md:hidden text-gray-500 mb-2 flex items-center">
                                    <ChevronDown className="rotate-90 mr-1" size={16} /> Back to List
                                </button>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{selectedCadet.rank} {selectedCadet.last_name}, {selectedCadet.first_name}</h2>
                                <p className="text-gray-600 dark:text-gray-300">{selectedCadet.student_id} • {selectedCadet.company}/{selectedCadet.platoon}</p>
                            </div>
                            <div className="text-right bg-white dark:bg-gray-900 p-3 rounded shadow-sm border dark:border-gray-700">
                                <div className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Final Grade</div>
                                <div className={`text-3xl font-bold ${(selectedCadet.finalGrade || 0) >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                                    {(selectedCadet.finalGrade || 0).toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-400">Transmuted: {selectedCadet.transmutedGrade || 'N/A'}</div>
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
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Prelim Score (0-100)</label>
                                                <input 
                                                    type="number" 
                                                    min="0" max="100"
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                                    value={proficiencyForm.prelimScore}
                                                    onChange={e => setProficiencyForm({...proficiencyForm, prelimScore: Number(e.target.value)})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Midterm Score (0-100)</label>
                                                <input 
                                                    type="number" 
                                                    min="0" max="100"
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                                    value={proficiencyForm.midtermScore}
                                                    onChange={e => setProficiencyForm({...proficiencyForm, midtermScore: Number(e.target.value)})}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Final Score (0-100)</label>
                                                <input 
                                                    type="number" 
                                                    min="0" max="100"
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                                    value={proficiencyForm.finalScore}
                                                    onChange={e => setProficiencyForm({...proficiencyForm, finalScore: Number(e.target.value)})}
                                                />
                                            </div>
                                            <div className="pt-4">
                                                <button type="submit" className="w-full bg-[var(--primary-color)] text-white py-2 rounded hover:opacity-90 flex justify-center items-center">
                                                    <Save size={18} className="mr-2" />
                                                    Save Scores
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: Merit/Demerit */}
                            {activeTab === 'merit' && (
                                <div className="max-w-4xl mx-auto">
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="w-full md:w-1/3">
                                            <div className="bg-white p-4 rounded shadow-sm border mb-4">
                                                <h3 className="font-bold mb-3 text-gray-800">Add Record</h3>
                                                <form onSubmit={handleLedgerSubmit} className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                                                        <div className="flex gap-2">
                                                            <button 
                                                                type="button"
                                                                onClick={() => setLedgerForm({...ledgerForm, type: 'merit'})}
                                                                className={`flex-1 py-2 text-sm rounded border ${ledgerForm.type === 'merit' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}
                                                            >
                                                                Merit
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => setLedgerForm({...ledgerForm, type: 'demerit'})}
                                                                className={`flex-1 py-2 text-sm rounded border ${ledgerForm.type === 'demerit' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600'}`}
                                                            >
                                                                Demerit
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Points</label>
                                                        <input 
                                                            type="number" min="1" required
                                                            className="w-full border p-2 rounded"
                                                            value={ledgerForm.points}
                                                            onChange={e => setLedgerForm({...ledgerForm, points: Number(e.target.value)})}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason</label>
                                                        <input 
                                                            type="text" required
                                                            className="w-full border p-2 rounded"
                                                            value={ledgerForm.reason}
                                                            onChange={e => setLedgerForm({...ledgerForm, reason: e.target.value})}
                                                        />
                                                    </div>
                                                    <button type="submit" className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-700 text-sm">
                                                        Add Entry
                                                    </button>
                                                </form>
                                            </div>
                                            
                                            <div className="bg-white p-4 rounded shadow-sm border">
                                                <h3 className="font-bold mb-2 text-gray-800">Summary</h3>
                                                <div className="flex justify-between items-center py-2 border-b">
                                                    <span className="text-gray-600">Total Merits</span>
                                                    <span className="font-bold text-blue-600">{selectedCadet.merit_points}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b">
                                                    <span className="text-gray-600">Total Demerits</span>
                                                    <span className="font-bold text-red-600">{selectedCadet.demerit_points}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b">
                                                    <span className="font-bold text-gray-800">Net Score</span>
                                                    <span className="font-bold text-xl">{Math.min(100, Math.max(0, 100 + selectedCadet.merit_points - selectedCadet.demerit_points))}</span>
                                                </div>
                                                {(() => {
                                                    const rawScore = 100 + selectedCadet.merit_points - selectedCadet.demerit_points;
                                                    const cappedScore = Math.min(100, Math.max(0, rawScore));
                                                    const isAtCeiling = cappedScore === 100 && rawScore >= 100;
                                                    const wastedPoints = Math.max(0, rawScore - 100);
                                                    const lifetimeMerit = selectedCadet.lifetime_merit_points || selectedCadet.merit_points || 0;
                                                    
                                                    return (
                                                        <>
                                                            <div className="flex justify-between items-center py-2 pt-3 bg-purple-50 px-2 rounded mt-2">
                                                                <span className="text-sm text-purple-700 flex items-center gap-1">
                                                                    <span>🏆</span>
                                                                    Lifetime Merit
                                                                </span>
                                                                <span className="font-bold text-purple-700">{lifetimeMerit}</span>
                                                            </div>
                                                            {isAtCeiling && wastedPoints > 0 && (
                                                                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                                                    <p className="text-yellow-800 font-semibold">⚠️ At Ceiling</p>
                                                                    <p className="text-yellow-700 mt-1">
                                                                        {wastedPoints} merit points beyond 100 ceiling
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        <div className="w-full md:w-2/3">
                                            <div className="bg-white rounded shadow-sm border overflow-hidden">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                                                        <tr>
                                                            <th className="p-3">Date</th>
                                                            <th className="p-3">Type</th>
                                                            <th className="p-3">Reason</th>
                                                            <th className="p-3 text-right">Pts</th>
                                                            <th className="p-3"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {ledgerLogs.length === 0 ? (
                                                            <tr><td colSpan="5" className="p-4 text-center text-gray-500">No records found</td></tr>
                                                        ) : (
                                                            ledgerLogs.map(log => (
                                                                <tr key={log.id} className="border-b hover:bg-gray-50">
                                                                    <td className="p-3">{new Date(log.created_at).toLocaleDateString()}</td>
                                                                    <td className="p-3">
                                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${log.type === 'merit' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                                                            {log.type.toUpperCase()}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3">{log.reason}</td>
                                                                    <td className="p-3 text-right font-bold">{log.points}</td>
                                                                    <td className="p-3 text-right">
                                                                        <button onClick={() => handleDeleteLog(log.id)} className="text-red-400 hover:text-red-600">
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
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: Attendance */}
                            {activeTab === 'attendance' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-white p-4 rounded shadow-sm border text-center">
                                            <div className="text-gray-500 text-sm uppercase">Present</div>
                                            <div className="text-3xl font-bold text-green-600">{selectedCadet.attendance_present}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded shadow-sm border text-center">
                                            <div className="text-gray-500 text-sm uppercase">Total Days</div>
                                            <div className="text-3xl font-bold text-gray-800">{selectedCadet.totalTrainingDays || 0}</div> 
                                        </div>
                                        <div className="bg-white p-4 rounded shadow-sm border text-center">
                                            <div className="text-gray-500 text-sm uppercase">Attendance Score</div>
                                            <div className="text-3xl font-bold text-blue-600">{(selectedCadet.attendanceScore || 0).toFixed(2)}</div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded shadow-sm border overflow-hidden">
                                        <h3 className="font-bold p-4 border-b bg-gray-50">Attendance History</h3>
                                        {/* Attendance List would go here - using simplified view for now */}
                                        <div className="p-8 text-center text-gray-500 italic">
                                            Detailed attendance logs are managed in the Attendance Module.
                                            <br/>
                                            <button 
                                                onClick={() => window.location.href='/admin/attendance'}
                                                className="mt-2 text-blue-600 hover:underline"
                                            >
                                                Go to Attendance Module
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                )}
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
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/20 text-xs md:text-sm"
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

export default Grading;
