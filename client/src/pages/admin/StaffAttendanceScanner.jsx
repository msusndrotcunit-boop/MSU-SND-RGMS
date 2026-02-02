import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const StaffAttendanceScanner = () => {
    const [scanResult, setScanResult] = useState(null);
    const [trainingDays, setTrainingDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState('');
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
        // Initialize scanner
        // We use a small timeout to ensure DOM is ready
        const timeoutId = setTimeout(() => {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                /* verbose= */ false
            );

            scanner.render(onScanSuccess, onScanFailure);
            scannerRef.current = scanner;
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear html5-qrcode scanner. ", error);
                });
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
            // Pause while processing
            if (scannerRef.current) {
                scannerRef.current.pause(true);
            }

            const token = localStorage.getItem('token');
            const res = await axios.post('/api/attendance/staff/scan', {
                dayId: selectedDayRef.current,
                qrData: decodedText
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setScanResult(res.data);
            toast.success(`Scanned: ${res.data.staff.name}`);
            
            // Resume after short delay
            setTimeout(() => {
                if (scannerRef.current) scannerRef.current.resume();
            }, 1500);

        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Scan failed");
            
            // Resume after short delay even on error
            setTimeout(() => {
                if (scannerRef.current) scannerRef.current.resume();
            }, 1500);
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
        </div>
    );
};

export default StaffAttendanceScanner;
