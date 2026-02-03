import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const StaffAttendanceScanner = () => {
    const [scanResult, setScanResult] = useState(null);
    const [trainingDays, setTrainingDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState('');
    
    // New State for Modal
    const [scannedData, setScannedData] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const scannerRef = useRef(null);
    const selectedDayRef = useRef(selectedDay);

    // Sync ref with state
    useEffect(() => {
        selectedDayRef.current = selectedDay;
    }, [selectedDay]);

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
                // Select today if exists, else first
                const today = new Date().toISOString().split('T')[0];
                const todayDay = res.data.find(d => d.date === today);
                setSelectedDay(todayDay ? todayDay.id : res.data[0].id);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load training days");
        }
    };

    useEffect(() => {
        let isMounted = true;

        const initScanner = async () => {
            // Check if element exists
            if (!document.getElementById("reader")) return;
            
            // If scanner exists, clear it first
            if (scannerRef.current) {
                try {
                    await scannerRef.current.clear();
                } catch (e) {
                    console.error("Error clearing existing scanner:", e);
                }
                scannerRef.current = null;
            }

            if (!isMounted) return;

            try {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    { 
                        fps: 10, 
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                        showTorchButtonIfSupported: true
                    },
                    /* verbose= */ false
                );

                scanner.render(onScanSuccess, onScanFailure);
                scannerRef.current = scanner;
            } catch (err) {
                console.error("Failed to initialize scanner:", err);
                toast.error("Failed to start camera");
            }
        };

        // Initialize scanner with a slight delay to ensure DOM is ready
        const timeoutId = setTimeout(initScanner, 500);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear html5-qrcode scanner. ", error);
                });
                scannerRef.current = null;
            }
        };
    }, []);

    const onScanSuccess = async (decodedText, decodedResult) => {
        if (!selectedDayRef.current) {
            toast.error("Please select a training day first.");
            // Pause to avoid spamming errors
            if (scannerRef.current) {
                scannerRef.current.pause(true);
                setTimeout(() => scannerRef.current.resume(), 2000);
            }
            return;
        }
        
        try {
            // Pause scanner immediately
            if (scannerRef.current) {
                scannerRef.current.pause(true);
            }

            // Try to parse JSON from QR
            let data = {};
            try {
                data = JSON.parse(decodedText);
            } catch (e) {
                // If not JSON, assume it's just an ID? Or fail.
                console.error("QR Parse Error", e);
                // For now, if it's not JSON, we can't easily display a name unless we fetch it.
                // But let's wrap it in an object to pass through.
                data = { id: decodedText, name: 'Unverified Staff' }; 
            }

            setScannedData({ ...data, rawQr: decodedText });
            setShowModal(true);

        } catch (err) {
            console.error(err);
            toast.error("Scan processing failed");
            if (scannerRef.current) scannerRef.current.resume();
        }
    };

    const handleAttendanceAction = async (status) => {
        if (!scannedData || !selectedDayRef.current) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/attendance/staff/scan', {
                dayId: selectedDayRef.current,
                qrData: scannedData.rawQr,
                status: status
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setScanResult(res.data);
            toast.success(`Marked as ${status.toUpperCase()}`);
            
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Attendance update failed");
        } finally {
            // Close modal and resume scanner
            setShowModal(false);
            setScannedData(null);
            if (scannerRef.current) {
                // Resume after short delay to prevent immediate re-scan
                setTimeout(() => scannerRef.current.resume(), 1000);
            }
        }
    };

    const onScanFailure = (error) => {
        // console.warn(`Code scan error = ${error}`);
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-green-800">Staff Attendance Scanner</h2>
            <p className="mb-4 text-gray-600">Select a training day and scan staff QR codes to record attendance.</p>
            
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
                <div className="w-full md:w-1/2 bg-white p-4 rounded shadow">
                    <div id="reader" width="100%"></div>
                </div>
                
                <div className="w-full md:w-1/2">
                    <h3 className="text-lg font-semibold mb-3">Last Scan Result</h3>
                    {scanResult ? (
                        <div className="p-6 bg-white border-l-4 border-green-500 rounded shadow animate-pulse-once">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-xl font-bold text-gray-800">{scanResult.staff.name}</h4>
                                <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                                    {scanResult.status.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-gray-600 mb-1"><strong>AFPSN:</strong> {scanResult.staff.afpsn}</p>
                            <p className="text-sm text-gray-500 mt-4 italic">{scanResult.message}</p>
                        </div>
                    ) : (
                        <div className="p-6 bg-gray-50 border rounded text-center text-gray-500">
                            Waiting for scan...
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for Present/Absent Selection */}
            {showModal && scannedData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Mark Attendance</h3>
                        
                        <div className="bg-gray-50 p-4 rounded mb-6 text-center">
                            <p className="text-sm text-gray-500 mb-1">Scanned Staff</p>
                            <p className="font-bold text-lg text-gray-800">{scannedData.name || 'Staff Member'}</p>
                            <p className="text-xs text-gray-400 break-all truncate">{scannedData.id || scannedData.rawQr}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleAttendanceAction('present')}
                                className="flex flex-col items-center justify-center p-4 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition border border-green-200"
                            >
                                <span className="text-2xl mb-1">✅</span>
                                <span className="font-bold">PRESENT</span>
                            </button>
                            
                            <button
                                onClick={() => handleAttendanceAction('absent')}
                                className="flex flex-col items-center justify-center p-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition border border-red-200"
                            >
                                <span className="text-2xl mb-1">❌</span>
                                <span className="font-bold">ABSENT</span>
                            </button>
                        </div>
                        
                        <button
                            onClick={() => {
                                setShowModal(false);
                                setScannedData(null);
                                if (scannerRef.current) scannerRef.current.resume();
                            }}
                            className="mt-6 w-full py-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffAttendanceScanner;
