import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { QrCode } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const StaffAttendanceScanner = () => {
    const [scanResult, setScanResult] = useState(null);
    const [trainingDays, setTrainingDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState('');
    const [pendingQrData, setPendingQrData] = useState(null);
    const [pendingStaff, setPendingStaff] = useState(null);
    const [isChoosingStatus, setIsChoosingStatus] = useState(false);
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

        const onScanSuccess = (decodedText) => {
            if (!decodedText || isChoosingStatus) return;
            try {
                const data = JSON.parse(decodedText);
                if (!data.id) {
                    toast.error('Invalid staff QR code');
                    return;
                }
                setPendingQrData(decodedText);
                setPendingStaff({
                    name: data.name || '',
                    afpsn: data.afpsn || ''
                });
                setIsChoosingStatus(true);
                if (navigator.vibrate) navigator.vibrate(40);
            } catch (e) {
                toast.error('Invalid QR Code format');
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

    const handleStatusChoice = async (status) => {
        if (!pendingQrData || !selectedDay) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/attendance/staff/scan', {
                dayId: selectedDay,
                qrData: pendingQrData,
                status
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setScanResult(res.data);
            setIsChoosingStatus(false);
            setPendingQrData(null);
            toast.success(`Staff marked as ${status}`);
            if (navigator.vibrate) navigator.vibrate(60);
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.message || 'Failed to record staff attendance';
            toast.error(message);
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-[var(--primary-color)]">Staff QR Attendance Scanner</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
                Scan each training staff&apos;s unique QR code to record their attendance.
            </p>
            
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Select Training Day</label>
                <select 
                    value={selectedDay} 
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="w-full md:w-1/3 p-2 border rounded shadow-sm bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
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
                <div className="w-full md:w-1/2 bg-white dark:bg-gray-900 p-4 rounded shadow">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-color-soft)] text-[var(--primary-color)]">
                            <QrCode size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Live QR Scanner</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Point the camera at the staff QR code.</div>
                        </div>
                    </div>
                    <div id="staff-qr-reader" className="w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" />
                </div>
                
                {/* Results Section */}
                <div className="w-full md:w-1/2">
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Last Scan Result</h3>
                    {isChoosingStatus && (
                        <div className="mb-4 p-4 bg-[var(--primary-color-soft)] border border-[var(--primary-color)] rounded">
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">
                                {pendingStaff?.name || 'Scanned staff'} {pendingStaff?.afpsn ? `(${pendingStaff.afpsn})` : ''}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                                Choose attendance status. First scan records time in (7:30–9:00 window), second scan records time out (11:30–12:00).
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleStatusChoice('present')}
                                    className="px-3 py-1.5 text-xs font-semibold rounded bg-[var(--primary-color)] text-white hover:bg-teal-800"
                                >
                                    Present
                                </button>
                                <button
                                    onClick={() => handleStatusChoice('absent')}
                                    className="px-3 py-1.5 text-xs font-semibold rounded bg-red-100 text-red-700 hover:bg-red-200"
                                >
                                    Absent
                                </button>
                                <button
                                    onClick={() => handleStatusChoice('excused')}
                                    className="px-3 py-1.5 text-xs font-semibold rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                >
                                    Excused
                                </button>
                            </div>
                        </div>
                    )}
                    {scanResult ? (
                        <div className="p-6 bg-white dark:bg-gray-900 border-l-4 border-[var(--primary-color)] rounded shadow animate-pulse-once">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100">{scanResult.staff?.name || scanResult.staff?.last_name}</h4>
                                <span className="px-2 py-1 text-xs font-semibold rounded bg-[var(--primary-color-soft)] text-[var(--primary-color)]">
                                    {scanResult.status?.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">{scanResult.message}</p>
                        </div>
                    ) : (
                        <div className="p-6 bg-gray-50 dark:bg-gray-800 border rounded text-center text-gray-500 dark:text-gray-300">
                            Waiting for scan...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StaffAttendanceScanner;
