import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Camera, RefreshCw, Check, X, FileText } from 'lucide-react';

const StaffAttendanceScanner = () => {
    const [scanResult, setScanResult] = useState(null);
    const [trainingDays, setTrainingDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState('');
    
    // Camera & OCR State
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrText, setOcrText] = useState('');

    // Modal State
    const [scannedData, setScannedData] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const [staffList, setStaffList] = useState([]);
    const [manualStaffId, setManualStaffId] = useState('');
    const [manualRemarks, setManualRemarks] = useState('');

    // Fetch training days
    useEffect(() => {
        fetchTrainingDays();
    }, []);

    const fetchTrainingDays = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/attendance/days', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTrainingDays(res.data);
            if (res.data.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const todayDay = res.data.find(d => d.date === today);
                setSelectedDay(todayDay ? todayDay.id : res.data[0].id);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load training days");
        }
    };

    // Load Staff List for Matching
    useEffect(() => {
        const loadStaff = async () => {
            if (!selectedDay) {
                setStaffList([]);
                return;
            }
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`/api/attendance/records/staff/${selectedDay}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStaffList(res.data || []);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load staff list");
            }
        };
        loadStaff();
    }, [selectedDay]);

    // Camera Control
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraActive(true);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to access camera. Please allow permissions.");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            setIsCameraActive(false);
        }
    };

    useEffect(() => {
        return () => stopCamera();
    }, []);

    // OCR Logic
    const captureAndScan = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        setIsProcessing(true);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const dataUrl = canvas.toDataURL('image/png');
            
            // Check if Tesseract is loaded
            if (!window.Tesseract) {
                throw new Error("OCR Library not loaded. Check internet connection.");
            }

            const { data: { text } } = await window.Tesseract.recognize(dataUrl, 'eng', {
                logger: m => console.log(m)
            });

            setOcrText(text);
            parseAttendanceText(text);

        } catch (err) {
            console.error(err);
            toast.error(err.message || "OCR Failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const parseAttendanceText = (text) => {
        // Attempt to extract fields based on user description
        // "Rank, name of cadets, program/course, status (if present, absent or excused), Time in and Time out"
        
        // Simple heuristic: Try to find lines with these keywords
        const lines = text.split('\n');
        let extracted = {
            name: '',
            rank: '',
            status: 'present',
            timeIn: '',
            timeOut: ''
        };

        // Naive parsing logic (can be improved with regex)
        lines.forEach(line => {
            const lower = line.toLowerCase();
            if (lower.includes('name:')) extracted.name = line.split(/name:/i)[1].trim();
            else if (lower.includes('rank:')) extracted.rank = line.split(/rank:/i)[1].trim();
            else if (lower.includes('status:')) extracted.status = line.split(/status:/i)[1].trim().toLowerCase();
            else if (lower.includes('in:')) extracted.timeIn = line.split(/in:/i)[1].trim();
            else if (lower.includes('out:')) extracted.timeOut = line.split(/out:/i)[1].trim();
        });

        // Fallback: If no labels, try to fuzzy match names from staffList in the whole text
        if (!extracted.name && staffList.length > 0) {
            const foundStaff = staffList.find(s => text.toLowerCase().includes(s.last_name.toLowerCase()));
            if (foundStaff) {
                extracted.name = `${foundStaff.last_name}, ${foundStaff.first_name}`;
                extracted.matchedStaffId = foundStaff.staff_id;
            }
        }

        setScannedData(extracted);
        setShowModal(true);
    };

    const handleConfirmAttendance = async () => {
        if (!selectedDay) return;

        // If we matched a staff ID, use it. Otherwise, we might need a manual selection in the modal.
        // For this patch, if we don't have a staff ID, we'll ask the user to map it manually or fail.
        let targetStaffId = scannedData.matchedStaffId;

        if (!targetStaffId) {
             // Try to find in staff list by name again if edited
             const found = staffList.find(s => 
                scannedData.name.toLowerCase().includes(s.last_name.toLowerCase()) || 
                `${s.first_name} ${s.last_name}`.toLowerCase() === scannedData.name.toLowerCase()
             );
             if (found) targetStaffId = found.staff_id;
        }

        if (!targetStaffId) {
            toast.error("Could not match Name to Staff Record. Please select manually below.");
            return; // Or show a dropdown in the modal
        }

        try {
            const token = localStorage.getItem('token');
            // We reuse the 'manual' endpoint since we are not scanning a QR code with ID
            const res = await axios.post('/api/attendance/mark/staff', {
                dayId: selectedDay,
                staffId: targetStaffId,
                status: scannedData.status || 'present',
                remarks: `Scanned: In ${scannedData.timeIn || '-'} Out ${scannedData.timeOut || '-'}`
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setScanResult(res.data);
            toast.success("Attendance Recorded via Smart Scan");
            setShowModal(false);
            setScannedData(null);
            
            // Refresh list
            const updatedListRes = await axios.get(`/api/attendance/records/staff/${selectedDay}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStaffList(updatedListRes.data);

        } catch (err) {
            console.error(err);
            toast.error("Failed to update attendance");
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-green-800">Smart Attendance Scanner (OCR)</h2>
            <p className="mb-4 text-gray-600">Scan printed attendance sheets to record staff attendance.</p>
            
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Training Day</label>
                <select 
                    value={selectedDay} 
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="w-full md:w-1/3 p-2 border rounded shadow-sm focus:ring-green-500 focus:border-green-500"
                >
                    <option value="">-- Select Day --</option>
                    {trainingDays.map(day => (
                        <option key={day.id} value={day.id}>
                            {day.date} - {day.title}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Camera Section */}
                <div className="w-full md:w-1/2 bg-white p-4 rounded shadow">
                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`}
                        />
                        {!isCameraActive && (
                            <div className="absolute inset-0 flex items-center justify-center text-white">
                                Camera Off
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>

                    <div className="flex gap-2 justify-center">
                        {!isCameraActive ? (
                            <button 
                                onClick={startCamera}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                <Camera size={20} /> Start Camera
                            </button>
                        ) : (
                            <>
                                <button 
                                    onClick={captureAndScan}
                                    disabled={isProcessing}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <FileText size={20} />}
                                    {isProcessing ? 'Scanning...' : 'Capture & Scan'}
                                </button>
                                <button 
                                    onClick={stopCamera}
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                    Stop
                                </button>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Results Section */}
                <div className="w-full md:w-1/2">
                    <h3 className="text-lg font-semibold mb-3">Last Scan Result</h3>
                    {scanResult ? (
                        <div className="p-6 bg-white border-l-4 border-green-500 rounded shadow animate-pulse-once">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-xl font-bold text-gray-800">{scanResult.staff?.name || scanResult.staff?.last_name}</h4>
                                <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                                    {scanResult.status?.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">{scanResult.message}</p>
                        </div>
                    ) : (
                        <div className="p-6 bg-gray-50 border rounded text-center text-gray-500">
                            Waiting for scan...
                        </div>
                    )}
                </div>
            </div>

            {/* Verification Modal */}
            {showModal && scannedData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">Verify Scanned Data</h3>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Detected Name</label>
                                <input 
                                    type="text" 
                                    value={scannedData.name} 
                                    onChange={e => setScannedData({...scannedData, name: e.target.value})}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                <select 
                                    value={scannedData.status}
                                    onChange={e => setScannedData({...scannedData, status: e.target.value})}
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                    <option value="excused">Excused</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Time In</label>
                                    <input 
                                        type="text" 
                                        value={scannedData.timeIn} 
                                        onChange={e => setScannedData({...scannedData, timeIn: e.target.value})}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Time Out</label>
                                    <input 
                                        type="text" 
                                        value={scannedData.timeOut} 
                                        onChange={e => setScannedData({...scannedData, timeOut: e.target.value})}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                            </div>

                            {!scannedData.matchedStaffId && (
                                <div className="p-2 bg-yellow-50 text-yellow-800 text-sm rounded">
                                    Warning: Could not automatically match to a staff member. Please ensure the name matches the record.
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button 
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmAttendance}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                Confirm & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffAttendanceScanner;
