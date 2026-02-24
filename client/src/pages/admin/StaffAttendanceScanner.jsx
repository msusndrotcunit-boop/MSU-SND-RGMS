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
        <div className="space-y-8">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="border-l-4 border-[var(--primary-color)] pl-3">Staff Attendance Scanner</span>
                </h2>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)] p-6">
                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Select Training Day</label>
                    <select 
                        value={selectedDay} 
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="w-full md:w-1/2 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                    >
                        {trainingDays.map(day => (
                            <option key={day.id} value={day.id}>{day.title} ({new Date(day.date).toLocaleDateString()})</option>
                        ))}
                    </select>
                </div>

                <div className="max-w-md mx-auto">
                    <div id="staff-qr-reader" className="overflow-hidden rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 shadow-inner"></div>
                </div>

                <div className="mt-8 text-center bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">Position staff QR code within the frame to automatically scan attendance status.</p>
                </div>
            </div>

            {isChoosingStatus && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm border-t-8 border-yellow-500 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 text-center">
                            <div className="bg-yellow-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <QrCode className="text-yellow-600" size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{pendingStaff?.name}</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-mono text-sm mb-8 uppercase tracking-widest">{pendingStaff?.afpsn}</p>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => handleStatusChoice('present')}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95 text-lg"
                                >
                                    PRESENT
                                </button>
                                <button 
                                    onClick={() => handleStatusChoice('late')}
                                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95 text-lg"
                                >
                                    LATE
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => setIsChoosingStatus(false)}
                                className="mt-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-semibold uppercase tracking-widest text-xs"
                            >
                                Cancel Scan
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
              #staff-qr-reader { min-height: 320px; }
              @media (min-width: 640px) { #staff-qr-reader { min-height: 380px; } }
            `}</style>
        </div>
    );
};

export default StaffAttendanceScanner;
