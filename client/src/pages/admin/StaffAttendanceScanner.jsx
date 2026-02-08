import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { QrCode } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const StaffAttendanceScanner = () => {
    const [scanResult, setScanResult] = useState(null);
    const [trainingDays, setTrainingDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState('');
    const scannerRef = useRef(null);

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

    // Initialize QR scanner for staff QR codes
    useEffect(() => {
        if (!selectedDay) {
            return;
        }

        if (scannerRef.current) {
            scannerRef.current.clear().catch(() => {});
            scannerRef.current = null;
        }

        const config = {
            fps: 10,
            qrbox: {
                width: 250,
                height: 250
            }
        };

        const scanner = new Html5QrcodeScanner('staff-qr-reader', config, false);

        const onScanSuccess = async (decodedText) => {
            if (!decodedText) return;
            try {
                const token = localStorage.getItem('token');
                const res = await axios.post('/api/attendance/staff/scan', {
                    dayId: selectedDay,
                    qrData: decodedText,
                    status: 'present'
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setScanResult(res.data);
                toast.success('Staff attendance recorded via QR');
                if (navigator.vibrate) navigator.vibrate(60);

                await axios.get(`/api/attendance/records/staff/${selectedDay}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch (err) {
                console.error(err);
                const message = err.response?.data?.message || 'Failed to record staff attendance';
                toast.error(message);
            }
        };

        const onScanFailure = () => {};

        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(() => {});
                scannerRef.current = null;
            }
        };
    }, [selectedDay]);

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-green-800">Staff QR Attendance Scanner</h2>
            <p className="mb-4 text-gray-600">
                Scan each training staff&apos;s unique QR code to record their attendance.
            </p>
            
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
                {/* QR Scanner Section */}
                <div className="w-full md:w-1/2 bg-white p-4 rounded shadow">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                            <QrCode size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-gray-800">Live QR Scanner</div>
                            <div className="text-xs text-gray-500">Point the camera at the staff QR code.</div>
                        </div>
                    </div>
                    <div id="staff-qr-reader" className="w-full rounded-lg overflow-hidden border border-gray-200" />
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
        </div>
    );
};

export default StaffAttendanceScanner;
