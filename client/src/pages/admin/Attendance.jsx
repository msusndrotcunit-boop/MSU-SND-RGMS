import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, Plus, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, Save, Search, ChevronRight, Camera, FileText, Download, RefreshCw, X } from 'lucide-react';
import ExcuseLetterManager from '../../components/ExcuseLetterManager';
import { cacheData, getCachedData, cacheSingleton, getSingleton } from '../../utils/db';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Attendance = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('attendance'); // 'attendance' | 'excuse'
    const [attendanceType, setAttendanceType] = useState('cadet'); // 'cadet' | 'staff'
    const [days, setDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ date: '', title: '', description: '' });
    
    // Scanner State (Smart OCR)
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanResults, setScanResults] = useState([]); // Array of detected records
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [capturedImage, setCapturedImage] = useState(null);

    // Import (PDF/Image) State
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    // Filters for marking
    const [filterCompany, setFilterCompany] = useState('');
    const [filterPlatoon, setFilterPlatoon] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [controlsOpen, setControlsOpen] = useState(true);

    // ROTCMIS Import (inline)
    const [rotcModalOpen, setRotcModalOpen] = useState(false);
    const [rotcFiles, setRotcFiles] = useState([]);
    const [rotcParsing, setRotcParsing] = useState(false);
    const [rotcRecords, setRotcRecords] = useState([]);
    const [rotcSummary, setRotcSummary] = useState(null);
    const [rotcSelected, setRotcSelected] = useState(new Set());
    const [rotcStrategy, setRotcStrategy] = useState('skip-duplicates');

    const handleRotcPick = (e) => {
        const picked = Array.from(e.target.files || []);
        setRotcFiles(prev => [...prev, ...picked]);
    };
    const handleRotcRemove = (idx) => {
        setRotcFiles(prev => prev.filter((_, i) => i !== idx));
    };
    const handleRotcValidate = async () => {
        if (rotcFiles.length === 0) { toast.error('Select at least one file'); return; }
        try {
            setRotcParsing(true);
            const fd = new FormData();
            rotcFiles.forEach(f => fd.append('files', f));
            const { data } = await axios.post('/api/integration/rotcmis/validate', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setRotcRecords(data.records || []);
            setRotcSummary(data.summary || null);
            setRotcSelected(new Set((data.records || []).map((_, i) => i)));
            toast.success('Parsed ROTCMIS export');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Validation failed');
        } finally {
            setRotcParsing(false);
        }
    };
    const toggleRotcRow = (i) => {
        const copy = new Set(rotcSelected);
        if (copy.has(i)) copy.delete(i); else copy.add(i);
        setRotcSelected(copy);
    };
    const handleRotcImport = async () => {
        try {
            const chosen = rotcRecords.filter((_, i) => rotcSelected.has(i));
            if (chosen.length === 0) { toast.error('No records selected'); return; }
            const payload = { strategy: rotcStrategy, records: chosen };
            const { data } = await axios.post('/api/integration/rotcmis/import', payload);
            toast.success(`Import done: ${data?.result?.inserted || 0} inserted, ${data?.result?.updated || 0} updated, ${data?.result?.skipped || 0} skipped`);
            setRotcModalOpen(false);
            if (selectedDay) selectDay(selectedDay, true);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Import failed');
        }
    };

    useEffect(() => {
        fetchDays();
    }, []);

    useEffect(() => {
        if (selectedDay) {
            selectDay(selectedDay);
        }
    }, [attendanceType]);

    const fetchDays = async (forceRefresh = false) => {
        try {
            if (!forceRefresh) {
                try {
                    const cached = await getSingleton('admin', 'training_days');
                    if (cached) {
                        let data = cached;
                        let timestamp = 0;
                        if (cached.data && cached.timestamp) {
                            data = cached.data;
                            timestamp = cached.timestamp;
                        } else if (Array.isArray(cached)) {
                            data = cached;
                        }

                        if (Array.isArray(data) && data.length > 0) {
                            setDays(data);
                            setLoading(false);
                            // If fresh (< 2 mins), skip API
                            if (timestamp && (Date.now() - timestamp < 120 * 1000)) {
                                return;
                            }
                        }
                    }
                } catch {}
            }

            const res = await axios.get('/api/attendance/days');
            setDays(res.data);
            await cacheSingleton('admin', 'training_days', {
                data: res.data,
                timestamp: Date.now()
            });
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
            await cacheSingleton('admin', 'training_days', null); // Explicit clear
            fetchDays(true); // Force refresh to update list and cache
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
            await cacheSingleton('admin', 'training_days', null); // Explicit clear
            fetchDays(true); // Force refresh
        } catch (err) {
            alert('Error deleting day');
        }
    };

    const selectDay = async (day, forceRefresh = false) => {
        setSelectedDay(day);
        setLoading(true);
        try {
            const cacheKey = `${day.id}_${attendanceType}`;
            
            if (!forceRefresh) {
                try {
                    const cached = await getSingleton('attendance_by_day', cacheKey);
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
                            setAttendanceRecords(data);
                            if (timestamp && (Date.now() - timestamp < 10 * 1000)) { // Reduced to 10s
                                setLoading(false);
                                return;
                            }
                        }
                    }
                } catch {}
            }
            
            const endpoint = attendanceType === 'cadet' 
                ? `/api/attendance/records/${day.id}`
                : `/api/attendance/records/staff/${day.id}`;

            const res = await axios.get(endpoint);
            setAttendanceRecords(res.data);
            await cacheSingleton('attendance_by_day', cacheKey, {
                data: res.data,
                timestamp: Date.now()
            });
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    // --- SMART SCANNER LOGIC ---

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraActive(true);
                setCapturedImage(null);
                setScanResults([]);
            }
        } catch (err) {
            console.error("Camera Error", err);
            toast.error("Failed to access camera. Please check permissions.");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            setIsCameraActive(false);
        }
    };

    useEffect(() => {
        if (!isScannerOpen) stopCamera();
        return () => stopCamera();
    }, [isScannerOpen]);

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
            setCapturedImage(dataUrl);
            stopCamera();

            // Check if Tesseract is loaded
            if (!window.Tesseract) {
                throw new Error("OCR Library not loaded. Check internet connection.");
            }

            const { data: { text } } = await window.Tesseract.recognize(dataUrl, 'eng');
            
            processOCRText(text);

        } catch (err) {
            console.error(err);
            toast.error(err.message || "OCR Failed");
            setIsProcessing(false);
        }
    };

    const processOCRText = (text) => {
        // We have the full text of the image.
        // We need to find which cadets from 'attendanceRecords' are present in this text.
        // Improved heuristic: Search for "Rank Lastname" or "Lastname, Firstname"
        
        const lines = text.split('\n');
        const matches = [];
        
        // Regex for time: 12-hour format with AM/PM (optional space, case insensitive)
        const timeRegex = /(\d{1,2}:\d{2}\s*[APap][Mm]?)/g;
        
        attendanceRecords.forEach(record => {
            // Construct patterns to search for
            // 1. Lastname, Firstname (Standard List format)
            // 2. Rank Lastname (e.g. Cdt Smith)
            
            const lastName = record.last_name.replace(/[^a-zA-Z0-9]/g, ''); // Clean for regex
            const firstName = record.first_name.split(' ')[0].replace(/[^a-zA-Z0-9]/g, ''); // First word of first name
            
            // Flexible pattern: Lastname followed by Firstname OR Rank followed by Lastname
            // We use the line as the context
            
            const namePattern = new RegExp(`${lastName}`, 'i');
            
            // Check if any line contains the last name
            const matchingLines = lines.filter(l => namePattern.test(l));
            
            let bestMatchLine = null;
            
            // Refine match: check for first name or rank in those lines
            for (const line of matchingLines) {
                if (line.toLowerCase().includes(firstName.toLowerCase())) {
                    bestMatchLine = line;
                    break;
                }
                if (record.rank && line.toLowerCase().includes(record.rank.toLowerCase())) {
                    bestMatchLine = line;
                    break;
                }
            }
            
            // If we found a line with the name
            if (bestMatchLine) {
                let status = 'present'; // Default to present if found on sheet
                const lowerLine = bestMatchLine.toLowerCase();
                
                if (lowerLine.includes('absent')) status = 'absent';
                else if (lowerLine.includes('excused')) status = 'excused';
                else if (lowerLine.includes('late')) status = 'late';

                // Extract times from this line
                const times = bestMatchLine.match(timeRegex) || [];
                // Sort times to ensure Time In is earlier (simple heuristic, or just take first two)
                // Usually Time In is first column, Time Out is second
                const timeIn = times[0] || '';
                const timeOut = times[1] || '';

                // Extract/Verify Course
                let detectedCourse = null;
                if (record.cadet_course) {
                    // Simple check if the course acronym is in the line
                    // We remove special chars from course code for regex
                    const cleanCourse = record.cadet_course.replace(/[^a-zA-Z0-9]/g, '');
                    if (cleanCourse.length > 0) {
                        const courseRegex = new RegExp(`\\b${cleanCourse}\\b`, 'i');
                        if (courseRegex.test(bestMatchLine.replace(/[^a-zA-Z0-9\s]/g, ''))) {
                             detectedCourse = record.cadet_course;
                        }
                    }
                }
                
                // If not found by record, try to find generic course pattern (optional enhancement)
                // const genericCourseMatch = bestMatchLine.match(/\b(BS\w+|AB\w+)\b/i);
                // if (!detectedCourse && genericCourseMatch) detectedCourse = genericCourseMatch[0];

                matches.push({
                    id: attendanceType === 'cadet' ? record.cadet_id : record.staff_id,
                    name: `${record.last_name}, ${record.first_name}`,
                    rank: record.rank, // Pass rank for display
                    detectedStatus: status,
                    timeIn,
                    timeOut,
                    detectedCourse,
                    recordCourse: record.cadet_course,
                    originalRecord: record
                });
            }
        });

        // Remove duplicates (in case multiple lines match the same person? Unlikely with this logic but possible)
        const uniqueMatches = Array.from(new Map(matches.map(m => [m.id, m])).values());

        setScanResults(uniqueMatches);
        setIsProcessing(false);
        
        if (uniqueMatches.length === 0) {
            toast.error("No matching names found in scan. Ensure the image is clear and contains names from the list.");
        } else {
            toast.success(`Found ${uniqueMatches.length} records! Review before confirming.`);
        }
    };

    const handleConfirmScan = async () => {
        if (scanResults.length === 0) return;

        try {
            const promises = scanResults.map(match => {
                const payload = {
                    dayId: selectedDay.id,
                    [attendanceType === 'cadet' ? 'cadetId' : 'staffId']: match.id,
                    status: match.detectedStatus,
                    remarks: `Smart Scan: ${match.timeIn ? 'In ' + match.timeIn : ''} ${match.timeOut ? 'Out ' + match.timeOut : ''}`.trim(),
                    time_in: match.timeIn,
                    time_out: match.timeOut
                };
                const endpoint = attendanceType === 'cadet' ? '/api/attendance/mark' : '/api/attendance/mark/staff';
                return axios.post(endpoint, payload);
            });

            await Promise.all(promises);
            
            toast.success(`Successfully updated ${scanResults.length} records`);
            
            // Refresh
            selectDay(selectedDay, true);
            
            // Reset
            setScanResults([]);
            setCapturedImage(null);
            setIsScannerOpen(false);

        } catch (err) {
            console.error(err);
            toast.error("Failed to update some records");
        }
    };

    const handleMarkAttendance = async (id, status) => {
        const record = attendanceRecords.find(r => (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id));
        const currentRemarks = record?.remarks || '';
        const currentTimeIn = record?.time_in || '';
        const currentTimeOut = record?.time_out || '';

        // Optimistic update
        const updatedRecords = attendanceRecords.map(r => 
            (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id) ? { ...r, status: status } : r
        );
        setAttendanceRecords(updatedRecords);
        
        // Update cache
        if (selectedDay) {
            const cacheKey = `${selectedDay.id}_${attendanceType}`;
            cacheSingleton('attendance_by_day', cacheKey, {
                data: updatedRecords,
                timestamp: Date.now()
            }).catch(console.error);
        }

        try {
            const payload = {
                dayId: selectedDay.id,
                [attendanceType === 'cadet' ? 'cadetId' : 'staffId']: id,
                status,
                remarks: currentRemarks,
                time_in: currentTimeIn,
                time_out: currentTimeOut
            };

            const endpoint = attendanceType === 'cadet' ? '/api/attendance/mark' : '/api/attendance/mark/staff';
            await axios.post(endpoint, payload);

            // Invalidate other modules
            if (attendanceType === 'cadet') {
                await cacheSingleton('grading', 'cadets_list', null);
                await cacheSingleton('admin', 'cadets_list', null);
            }
        } catch (err) {
            console.error('Failed to save attendance', err);
        }
    };

    const handleRemarkChange = async (id, remarks) => {
        const updatedRecords = attendanceRecords.map(r => 
            (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id) ? { ...r, remarks: remarks } : r
        );
        setAttendanceRecords(updatedRecords);

        // Update cache
        if (selectedDay) {
            const cacheKey = `${selectedDay.id}_${attendanceType}`;
            cacheSingleton('attendance_by_day', cacheKey, {
                data: updatedRecords,
                timestamp: Date.now()
            }).catch(console.error);
        }
    };
    
    const saveRemark = async (id, remarks, status) => {
        try {
            const record = attendanceRecords.find(r => (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id));
            const payload = {
                dayId: selectedDay.id,
                [attendanceType === 'cadet' ? 'cadetId' : 'staffId']: id,
                status: status || record?.status || 'present',
                remarks: record?.remarks || '',
                time_in: record?.time_in || '',
                time_out: record?.time_out || ''
            };
            const endpoint = attendanceType === 'cadet' ? '/api/attendance/mark' : '/api/attendance/mark/staff';
            await axios.post(endpoint, payload);

            // Invalidate other modules
            if (attendanceType === 'cadet') {
                await cacheSingleton('grading', 'cadets_list', null);
                await cacheSingleton('admin', 'cadets_list', null);
            }
        } catch (err) {
            console.error('Failed to save time fields', err);
        }
    };

    const handleTimeChange = (id, field, value) => {
        const updatedRecords = attendanceRecords.map(r => {
            if (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id) {
                return { ...r, [field]: value };
            }
            return r;
        });
        setAttendanceRecords(updatedRecords);

        // Update cache
        if (selectedDay) {
            const cacheKey = `${selectedDay.id}_${attendanceType}`;
            cacheSingleton('attendance_by_day', cacheKey, {
                data: updatedRecords,
                timestamp: Date.now()
            }).catch(console.error);
        }
    };

    const saveTime = async (id, field, value) => {
        try {
            const record = attendanceRecords.find(r => (attendanceType === 'cadet' ? r.cadet_id === id : r.staff_id === id));
            const payload = {
                dayId: selectedDay.id,
                [attendanceType === 'cadet' ? 'cadetId' : 'staffId']: id,
                status: record?.status || 'present',
                remarks: record?.remarks || '',
                time_in: field === 'time_in' ? value : (record?.time_in || ''),
                time_out: field === 'time_out' ? value : (record?.time_out || '')
            };
            const endpoint = attendanceType === 'cadet' ? '/api/attendance/mark' : '/api/attendance/mark/staff';
            await axios.post(endpoint, payload);

            // Invalidate other modules
            if (attendanceType === 'cadet') {
                await cacheSingleton('grading', 'cadets_list', null);
                await cacheSingleton('admin', 'cadets_list', null);
            }
        } catch (err) {
            console.error('Failed to save time', err);
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

    const handleExport = () => {
        if (!selectedDay) return;
        const headers = ["Cadet/Staff ID", "Name", "Role/Rank", "Status", "Time In", "Time Out", "Remarks"];
        const now = new Date();
        const generatedAt = now.toLocaleString();
        const totalRecords = filteredRecords.length;
        // Resolve dynamic signatories based on cadet positions
        let s1 = null;
        let commander = null;
        if (attendanceType === 'cadet') {
            const byPosition = (r) => (r.corp_position || r.battalion || '').toLowerCase();
            // Prefer Brigade S1; fallback to any S1
            s1 = attendanceRecords.find(r => byPosition(r).includes('bde s1')) 
                || attendanceRecords.find(r => byPosition(r).includes('s1'));
            // Match Corp Commander
            commander = attendanceRecords.find(r => {
                const p = byPosition(r);
                return p.includes('corp cmdr') || p.includes('corp commander') || p.includes('corps commander');
            });
        }
        const preparedName = s1 ? `${s1.first_name} ${s1.last_name}` : 'VINCENT R URTAL';
        const preparedRole = s1 ? `${s1.rank} • S1/Personnel Officer` : 'CDT LIEUTENANT COLONEL (1CL) • S1/Personnel Officer';
        const certifiedName = commander ? `${commander.first_name} ${commander.last_name}` : 'JOHN MARK C LANGUIDO';
        const certifiedRole = commander ? `${commander.rank} • Corp Commander` : 'CDT COLONEL (1CL) • Corp Commander';
        
        const headerBlock = [
            `Report,Attendance,Day,"${selectedDay.title}"`,
            `Generated,"${generatedAt}"`,
            ''
        ].join('\n');

        const bodyBlock = [
            headers.join(','),
            ...filteredRecords.map(r => {
                const name = `"${r.last_name}, ${r.first_name}"`;
                const id = attendanceType === 'cadet' ? r.cadet_id : r.staff_id;
                const role = attendanceType === 'cadet' ? r.rank : (r.role || 'Instructor');
                return [
                    id,
                    name,
                    role,
                    r.status,
                    r.time_in,
                    r.time_out,
                    `"${r.remarks || ''}"`
                ].join(',');
            })
        ].join('\n');

        const footerBlock = [
            '',
            `Prepared By,"${preparedName}","${preparedRole}"`,
            `Certified Correct,"${certifiedName}","${certifiedRole}"`,
            `Total Records,${totalRecords}`,
        ].join('\n');

        const csvContent = [headerBlock, bodyBlock, footerBlock].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${selectedDay.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-gray-900 p-4 rounded shadow gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">Attendance & Excuses</h1>
                <div className="flex flex-col w-full sm:w-auto sm:flex-row gap-2">
                    <button 
                        onClick={() => setViewMode('attendance')}
                        className={`flex-1 sm:flex-none justify-center px-3 md:px-4 py-2 rounded flex items-center transition text-sm md:text-base hover-highlight ${
                            viewMode === 'attendance' 
                                ? 'bg-[var(--primary-color)] text-white' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        <Calendar size={18} className="mr-2" />
                        <span className="whitespace-nowrap">Training Days</span>
                    </button>
                    <button 
                        onClick={() => setViewMode('excuse')}
                        className={`flex-1 sm:flex-none justify-center px-3 md:px-4 py-2 rounded flex items-center transition text-sm md:text-base hover-highlight ${
                            viewMode === 'excuse' 
                                ? 'bg-[var(--primary-color)] text-white' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        <FileText size={18} className="mr-2" />
                        <span className="whitespace-nowrap">Excuse Letters</span>
                    </button>
                </div>
            </div>

            {/* Smart Scanner Modal */}
            {isScannerOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-5xl h-full md:h-[90vh] flex flex-col md:flex-row overflow-hidden relative">
                        <button onClick={() => setIsScannerOpen(false)} className="absolute top-4 right-4 z-50 text-white bg-black bg-opacity-50 p-2 rounded-full hover:bg-opacity-80">
                            <X size={24} />
                        </button>

                        {/* Camera Section */}
                        <div className="w-full md:w-1/2 bg-black flex flex-col relative h-[60vh] md:h-auto md:flex-1">
                            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                                <video 
                                    ref={videoRef} 
                                    autoPlay playsInline muted 
                                    className={`absolute inset-0 w-full h-full object-cover ${capturedImage ? 'hidden' : ''}`}
                                />
                                <canvas ref={canvasRef} className="hidden" />
                                {capturedImage && (
                                    <img src={capturedImage} alt="Scan" className="absolute inset-0 w-full h-full object-contain" />
                                )}
                                
                                {!isCameraActive && !capturedImage && (
                                    <div className="text-white text-center">
                                        <Camera size={48} className="mx-auto mb-2 opacity-50" />
                                        <p>Camera is inactive</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-4 bg-gray-900 flex justify-center gap-4">
                                {!isCameraActive ? (
                                    <button 
                                        onClick={startCamera}
                                        className="bg-[var(--primary-color)] text-white px-6 py-2 rounded-full flex items-center gap-2 hover:opacity-90 hover-highlight"
                                    >
                                        <Camera size={20} /> Start Camera
                                    </button>
                                ) : (
                                    <button 
                                        onClick={captureAndScan}
                                        disabled={isProcessing}
                                        className="bg-[var(--primary-color)] text-white px-6 py-2 rounded-full flex items-center gap-2 disabled:opacity-50 hover:opacity-90 hover-highlight"
                                    >
                                        {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
                                        {isProcessing ? 'Processing...' : 'Capture & Scan'}
                                    </button>
                                )}
                                {capturedImage && (
                                    <button 
                                        onClick={() => { setCapturedImage(null); setScanResults([]); startCamera(); }}
                                        className="bg-gray-600 text-white px-4 py-2 rounded-full hover-highlight"
                                    >
                                        Retake
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Results Section */}
                        <div className="w-full md:w-1/2 bg-gray-50 dark:bg-gray-950 flex flex-col h-[40vh] md:h-auto md:flex-1">
                            <div className="p-4 border-b bg-white dark:bg-gray-900 dark:border-gray-800">
                                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Scan Results</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {scanResults.length > 0 ? `Found ${scanResults.length} records matching current list.` : 'Capture an attendance sheet to detect names.'}
                                </p>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {scanResults.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                                        <FileText size={48} className="mb-2 opacity-20" />
                                        <p>No records detected yet</p>
                                    </div>
                                ) : (
                                    scanResults.map((res, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded shadow-sm border flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-gray-800">{res.name}</div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                                        <span>{res.rank}</span>
                                                        {res.recordCourse && (
                                                            <span className={`px-1 rounded ${res.detectedCourse ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                {res.detectedCourse ? res.detectedCourse : `Mismatch: ${res.recordCourse}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-0.5 text-xs rounded font-bold uppercase ${
                                                    res.detectedStatus === 'present' ? 'bg-green-100 text-green-800' : 
                                                    res.detectedStatus === 'absent' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {res.detectedStatus}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 text-sm text-gray-600">
                                                <div className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                                    <span className="text-xs text-gray-400 mr-1">IN</span>
                                                    {res.timeIn || '--:--'}
                                                </div>
                                                <div className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                                    <span className="text-xs text-gray-400 mr-1">OUT</span>
                                                    {res.timeOut || '--:--'}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {scanResults.length > 0 && (
                                <div className="p-4 border-t bg-white dark:bg-gray-900 dark:border-gray-800">
                                    <button 
                                        onClick={handleConfirmScan}
                                        className="w-full bg-[var(--primary-color)] text-white py-3 rounded font-bold hover:opacity-90 flex justify-center items-center gap-2 hover-highlight"
                                    >
                                        <CheckCircle size={20} />
                                        Confirm & Update {scanResults.length} Records
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {rotcModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-5xl shadow-lg overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Import ROTCMIS Export</h3>
                            <button onClick={() => setRotcModalOpen(false)} className="text-gray-500 hover:text-gray-800">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="bg-white dark:bg-gray-900 border rounded p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm text-gray-600 dark:text-gray-300">Select ROTCMIS files</div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs">Strategy</label>
                                        <select value={rotcStrategy} onChange={e => setRotcStrategy(e.target.value)} className="border rounded px-2 py-1 text-sm">
                                            <option value="skip-duplicates">Skip duplicates</option>
                                            <option value="overwrite">Overwrite existing</option>
                                        </select>
                                    </div>
                                </div>
                                <input type="file" multiple accept=".csv,.xlsx,.xls,.json,.pdf" onChange={handleRotcPick} />
                                {rotcFiles.length > 0 && (
                                    <div className="mt-3 grid md:grid-cols-3 gap-2">
                                        {rotcFiles.map((f, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 border rounded bg-gray-50 dark:bg-gray-800">
                                                <div className="text-sm">{f.name}</div>
                                                <button onClick={() => handleRotcRemove(i)} className="text-xs text-red-600 hover:underline">Remove</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-3 flex items-center gap-2">
                                    <button onClick={handleRotcValidate} disabled={rotcParsing} className="px-4 py-2 rounded bg-gray-800 text-white hover:bg-black disabled:opacity-50">
                                        {rotcParsing ? 'Validating…' : 'Validate Files'}
                                    </button>
                                </div>
                            </div>
                            {rotcSummary && (
                                <div className="bg-white dark:bg-gray-900 border rounded p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold">Summary</div>
                                        <div className="text-sm text-gray-500">Total: {rotcSummary.total || 0} • Valid: {rotcSummary.valid || 0} • Invalid: {rotcSummary.invalid || 0} • Duplicates: {rotcSummary.duplicates || 0}</div>
                                    </div>
                                </div>
                            )}
                            {rotcRecords.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-gray-600">Select records to import</div>
                                        <button
                                            onClick={() => {
                                                if (rotcSelected.size === rotcRecords.length) {
                                                    setRotcSelected(new Set());
                                                } else {
                                                    setRotcSelected(new Set(rotcRecords.map((_, i) => i)));
                                                }
                                            }}
                                            className="text-sm text-green-700 hover:underline"
                                        >
                                            {rotcSelected.size === rotcRecords.length ? 'Deselect all' : 'Select all'}
                                        </button>
                                    </div>
                                    <div className="overflow-auto border rounded">
                                        <table className="min-w-full">
                                            <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
                                                <tr>
                                                    <th className="p-2 text-left">Pick</th>
                                                    <th className="p-2 text-left">Student ID</th>
                                                    <th className="p-2 text-left">Name</th>
                                                    <th className="p-2 text-left">Date</th>
                                                    <th className="p-2 text-left">Status</th>
                                                    <th className="p-2 text-left">Duplicate</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rotcRecords.map((r, i) => {
                                                    const err = r.errors?.length > 0;
                                                    return (
                                                        <tr key={i} className={err ? 'bg-red-50 dark:bg-red-900/20' : (r.isDuplicateInBatch ? 'bg-yellow-50 dark:bg-yellow-900/20' : '')}>
                                                            <td className="p-2">
                                                                <input type="checkbox" className="h-3 w-3" checked={rotcSelected.has(i)} onChange={() => toggleRotcRow(i)} />
                                                            </td>
                                                            <td className="p-2 font-mono text-sm">{r.student_id || '—'}</td>
                                                            <td className="p-2 text-sm">{r.name || '—'}</td>
                                                            <td className="p-2 text-sm">{r.date ? new Date(r.date).toLocaleString() : '—'}</td>
                                                            <td className="p-2 text-sm capitalize">
                                                                {r.status || '—'}
                                                            </td>
                                                            <td className="p-2 text-sm">
                                                                {r.isDuplicateInBatch ? 'Possible duplicate' : '—'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-end">
                                        <button onClick={handleRotcImport} className="px-4 py-2 rounded bg-green-700 text-white hover:bg-green-800">
                                            Confirm Import
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'excuse' ? (
                <ExcuseLetterManager />
            ) : (
                <div className="flex flex-col md:flex-row h-full md:h-[calc(100vh-180px)] gap-6">
                    {/* Sidebar List */}
                    <div className={`w-full md:w-1/3 bg-white dark:bg-gray-900 rounded shadow flex flex-col ${selectedDay ? 'hidden md:flex' : ''}`}>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800 rounded-t">
                            <h2 className="font-bold text-lg text-gray-700 dark:text-gray-100">Training Days</h2>
                            <button 
                                onClick={() => setIsCreateModalOpen(true)}
                                className="bg-[var(--primary-color)] text-white p-2 rounded hover:opacity-90 hover-highlight"
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
                                        selectedDay?.id === day.id 
                                            ? 'bg-[var(--primary-color)]/10 border-[var(--primary-color)]' 
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-gray-800 dark:text-gray-100">{day.title}</div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
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
                            {days.length === 0 && <div className="p-4 text-center text-gray-500 dark:text-gray-400">No training days found.</div>}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className={`w-full md:w-2/3 bg-white dark:bg-gray-900 rounded shadow flex flex-col ${!selectedDay ? 'hidden md:flex' : ''}`}>
                        {selectedDay ? (
                            <div className="flex flex-col h-full">
                        <div className="p-4 border-b bg-gray-50 dark:bg-gray-800 rounded-t">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-2 mb-2">
                                <div>
                                    <button onClick={() => setSelectedDay(null)} className="md:hidden text-gray-500 dark:text-gray-400 mb-2 flex items-center text-sm">
                                        <ChevronRight className="rotate-180 mr-1" size={16} /> Back to List
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{selectedDay.title}</h2>
                                        <button
                                            type="button"
                                            onClick={() => setControlsOpen(o => !o)}
                                            className="touch-target px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:bg-white/10 hover-highlight"
                                            aria-expanded={controlsOpen}
                                            aria-controls="attendance-controls"
                                            title={controlsOpen ? 'Collapse controls' : 'Expand controls'}
                                        >
                                            {controlsOpen ? 'Hide Controls' : 'Show Controls'}
                                        </button>
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-300 mt-1">{selectedDay.description || 'No description'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2 mt-2 md:mt-0">
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleExport}
                                            className="flex items-center text-sm bg-[var(--primary-color)] text-white px-3 py-1 rounded hover:opacity-90 transition hover-highlight"
                                            title="Export CSV"
                                        >
                                            <Download size={16} className="mr-2" /> Export
                                        </button>
                                        <input 
                                            ref={fileInputRef}
                                            type="file" 
                                            accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.bmp,.webp,.gif,.tiff"
                                            className="hidden"
                                            onChange={async (e) => {
                                                if (!selectedDay) return;
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                setIsImporting(true);
                                                try {
                                                    const formData = new FormData();
                                                    formData.append('file', file);
                                                    formData.append('dayId', selectedDay.id);
                                                    const res = await axios.post('/api/attendance/import', formData, {
                                                        headers: { 'Content-Type': 'multipart/form-data' }
                                                    });
                                                    const msg = res.data?.message || 'Import complete';
                                                    toast.success(msg);
                                                    selectDay(selectedDay, true);
                                                } catch (err) {
                                                    console.error(err);
                                                    const msg = err.response?.data?.message || 'Failed to import file';
                                                    toast.error(msg);
                                                } finally {
                                                    setIsImporting(false);
                                                    if (e.target) e.target.value = '';
                                                }
                                            }}
                                        />
                                        <button 
                                            onClick={() => setRotcModalOpen(true)}
                                            className="flex items-center text-sm bg-gray-700 text-white px-3 py-1 rounded hover:bg-black transition hover-highlight"
                                            title="Import ROTCMIS"
                                        >
                                            <FileText size={16} className="mr-2" /> Import ROTCMIS
                                        </button>
                                        <button 
                                            onClick={() => setIsScannerOpen(true)}
                                            className="flex items-center text-sm bg-gray-800 text-white px-3 py-1 rounded hover:bg-black transition hover-highlight"
                                        >
                                            <Camera size={16} className="mr-2" /> Smart Scan
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-sm">
                                        <div className="flex items-center text-green-700 bg-green-50 px-2 py-1 rounded"><CheckCircle size={16} className="mr-1"/> Present: {stats.present || 0}</div>
                                        <div className="flex items-center text-red-700 bg-red-50 px-2 py-1 rounded"><XCircle size={16} className="mr-1"/> Absent: {stats.absent || 0}</div>
                                        <div className="flex items-center text-yellow-700 bg-yellow-50 px-2 py-1 rounded"><Clock size={16} className="mr-1"/> Late: {stats.late || 0}</div>
                                        <div className="flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded"><AlertTriangle size={16} className="mr-1"/> Excused: {stats.excused || 0}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Attendance Summary Card */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                                {/* Left Side - Day Details */}
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                                        {/* Date */}
                                        <div className="flex items-start gap-1.5 md:gap-3 p-1.5 md:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:-rotate-1">
                                            <div className="bg-blue-500 p-1 md:p-2 rounded-md md:rounded-lg flex-shrink-0">
                                                <Calendar className="w-4 h-4 md:w-6 md:h-6 text-white" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[9px] md:text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase leading-tight">Date</div>
                                                <div className="text-[10px] md:text-sm font-bold text-gray-800 dark:text-gray-100 mt-0.5 md:mt-1 leading-tight">
                                                    {new Date(selectedDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Location */}
                                        <div className="flex items-start gap-1.5 md:gap-3 p-1.5 md:p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:rotate-1">
                                            <div className="bg-orange-500 p-1 md:p-2 rounded-md md:rounded-lg flex-shrink-0">
                                                <svg className="w-4 h-4 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[9px] md:text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase leading-tight">Location</div>
                                                <div className="text-[10px] md:text-sm font-bold text-gray-800 dark:text-gray-100 mt-0.5 md:mt-1 leading-tight truncate">
                                                    {selectedDay.location || 'Not specified'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Time */}
                                        <div className="flex items-start gap-1.5 md:gap-3 p-1.5 md:p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 hover:-rotate-1">
                                            <div className="bg-cyan-500 p-1 md:p-2 rounded-md md:rounded-lg flex-shrink-0">
                                                <Clock className="w-4 h-4 md:w-6 md:h-6 text-white" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[9px] md:text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase leading-tight">Time</div>
                                                <div className="text-[10px] md:text-sm font-bold text-gray-800 dark:text-gray-100 mt-0.5 md:mt-1 leading-tight">
                                                    {selectedDay.time || '7:30 AM - 12:30 PM'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Enrollment */}
                                        <div className="flex items-start gap-1.5 md:gap-3 p-1.5 md:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 hover:bg-green-100 dark:hover:bg-green-900/30 hover:rotate-1">
                                            <div className="bg-green-500 p-1 md:p-2 rounded-md md:rounded-lg flex-shrink-0">
                                                <svg className="w-4 h-4 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[9px] md:text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase leading-tight">Enrollment</div>
                                                <div className="flex flex-wrap gap-1 md:gap-2 mt-0.5 md:mt-1">
                                                    <span className="bg-blue-500 text-white text-[8px] md:text-xs font-bold px-1 md:px-2 py-0.5 md:py-1 rounded whitespace-nowrap">
                                                        {attendanceRecords.length} ENROLLED
                                                    </span>
                                                    <span className="bg-green-500 text-white text-[8px] md:text-xs font-bold px-1 md:px-2 py-0.5 md:py-1 rounded whitespace-nowrap">
                                                        {stats.present || 0} PRESENT
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side - Attendance Percentage */}
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 md:p-6 border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                                    {/* Circular Progress */}
                                    <div className="relative w-28 h-28 md:w-40 md:h-40 mb-2 md:mb-4">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle
                                                cx="56"
                                                cy="56"
                                                r="48"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                fill="none"
                                                className="text-gray-200 dark:text-gray-700 md:hidden"
                                            />
                                            <circle
                                                cx="56"
                                                cy="56"
                                                r="48"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                fill="none"
                                                strokeDasharray={`${2 * Math.PI * 48}`}
                                                strokeDashoffset={`${2 * Math.PI * 48 * (1 - (attendanceRecords.length > 0 ? (stats.present || 0) / attendanceRecords.length : 0))}`}
                                                className="text-blue-600 dark:text-blue-400 transition-all duration-1000 md:hidden"
                                                strokeLinecap="round"
                                            />
                                            <circle
                                                cx="80"
                                                cy="80"
                                                r="70"
                                                stroke="currentColor"
                                                strokeWidth="12"
                                                fill="none"
                                                className="text-gray-200 dark:text-gray-700 hidden md:block"
                                            />
                                            <circle
                                                cx="80"
                                                cy="80"
                                                r="70"
                                                stroke="currentColor"
                                                strokeWidth="12"
                                                fill="none"
                                                strokeDasharray={`${2 * Math.PI * 70}`}
                                                strokeDashoffset={`${2 * Math.PI * 70 * (1 - (attendanceRecords.length > 0 ? (stats.present || 0) / attendanceRecords.length : 0))}`}
                                                className="text-blue-600 dark:text-blue-400 transition-all duration-1000 hidden md:block"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl md:text-4xl font-bold text-gray-800 dark:text-gray-100">
                                                {attendanceRecords.length > 0 ? Math.round((stats.present || 0) / attendanceRecords.length * 100) : 0}%
                                            </span>
                                            <span className="text-[9px] md:text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Attendance</span>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 md:h-3 mb-2 md:mb-4">
                                        <div 
                                            className="bg-gradient-to-r from-blue-600 to-blue-400 h-1.5 md:h-3 rounded-full transition-all duration-1000"
                                            style={{ width: `${attendanceRecords.length > 0 ? (stats.present || 0) / attendanceRecords.length * 100 : 0}%` }}
                                        ></div>
                                    </div>

                                    {/* Status Badges */}
                                    <div className="flex gap-2 md:gap-4 justify-center">
                                        <div className="text-center cursor-pointer transition-all duration-300 hover:scale-110 hover:-rotate-3">
                                            <div className="bg-green-100 dark:bg-green-900/30 p-1.5 md:p-3 rounded-lg mb-1">
                                                <CheckCircle className="w-4 h-4 md:w-6 md:h-6 text-green-600 dark:text-green-400 mx-auto" />
                                            </div>
                                            <div className="text-lg md:text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.present || 0}</div>
                                            <div className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Present</div>
                                        </div>
                                        <div className="text-center cursor-pointer transition-all duration-300 hover:scale-110 hover:rotate-3">
                                            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-1.5 md:p-3 rounded-lg mb-1">
                                                <AlertTriangle className="w-4 h-4 md:w-6 md:h-6 text-yellow-600 dark:text-yellow-400 mx-auto" />
                                            </div>
                                            <div className="text-lg md:text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.excused || 0}</div>
                                            <div className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Excused</div>
                                        </div>
                                        <div className="text-center cursor-pointer transition-all duration-300 hover:scale-110 hover:-rotate-3">
                                            <div className="bg-red-100 dark:bg-red-900/30 p-1.5 md:p-3 rounded-lg mb-1">
                                                <XCircle className="w-4 h-4 md:w-6 md:h-6 text-red-600 dark:text-red-400 mx-auto" />
                                            </div>
                                            <div className="text-lg md:text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.absent || 0}</div>
                                            <div className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Absent</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                id="attendance-controls"
                                className={`grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 transition-all duration-300 ease-in-out overflow-hidden ${controlsOpen ? 'opacity-100 max-h-[800px]' : 'opacity-0 max-h-0 pointer-events-none'}`}
                                aria-hidden={!controlsOpen}
                            >
                                {/* Tabs */}
                                <div className="md:col-span-3 flex justify-center mb-2">
                                    <div className="bg-gray-200 dark:bg-gray-800 rounded p-1 flex">
                                        <button
                                            className={`px-4 py-1 rounded text-sm font-semibold transition ${
                                                attendanceType === 'cadet' 
                                                    ? 'bg-white dark:bg-gray-900 shadow text-[var(--primary-color)]' 
                                                    : 'text-gray-600 dark:text-gray-300'
                                            }`}
                                            onClick={() => setAttendanceType('cadet')}
                                        >
                                            Cadets
                                        </button>
                                        <button
                                            className={`px-4 py-1 rounded text-sm font-semibold transition ${
                                                attendanceType === 'staff' 
                                                    ? 'bg-white dark:bg-gray-900 shadow text-[var(--primary-color)]' 
                                                    : 'text-gray-600 dark:text-gray-300'
                                            }`}
                                            onClick={() => setAttendanceType('staff')}
                                        >
                                            Training Staff
                                        </button>
                                    </div>
                                </div>

                                <input 
                                    placeholder="Search Name..." 
                                    className="border p-2 rounded bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {/* Removed company/platoon boxes per request */}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {filteredRecords.length === 0 ? (
                                <div className="text-center text-gray-500 dark:text-gray-400 py-10">
                                    No records found matching filters.
                                </div>
                            ) : (
                                <div className="overflow-auto max-h-[70vh] overscroll-contain border rounded">
                                    <table className="w-full min-w-[1200px]">
                                        <thead className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                            <tr className="bg-gradient-to-r from-black/10 to-black/5 dark:from-white/5 dark:to-white/10 border-b border-gray-200 dark:border-gray-800">
                                                <th className="p-3 text-left font-semibold">Name</th>
                                                {attendanceType === 'cadet' && <th className="p-3 text-left font-semibold">Company/Platoon</th>}
                                                <th className="p-3 text-left font-semibold">Status</th>
                                                <th className="p-3 text-left font-semibold">Time</th>
                                                <th className="p-3 text-left font-semibold">Remarks</th>
                                                <th className="p-3 text-right font-semibold">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                            {filteredRecords.map(record => {
                                                const id = attendanceType === 'cadet' ? record.cadet_id : record.staff_id;
                                                const active = record.status;
                                                const pill = (label, tone) => {
                                                    const tones = {
                                                        present: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                                                        absent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                                                        excused: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                                                        late: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                                                    };
                                                    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${tones[tone]}`}>{label}</span>;
                                                };
                                                return (
                                                    <tr key={id} className="bg-white dark:bg-gray-900 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                                        <td className="p-3 align-middle">
                                                            <div className="font-semibold text-gray-800 dark:text-gray-100">{record.last_name}, {record.first_name}</div>
                                                            {attendanceType === 'staff' && <div className="text-xs text-gray-500">{record.role || 'Instructor'}</div>}
                                                        </td>
                                                        {attendanceType === 'cadet' && (
                                                            <td className="p-3 align-middle">
                                                                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                                                                    {record.company}/{record.platoon}
                                                                </span>
                                                            </td>
                                                        )}
                                                        <td className="p-3 align-middle">
                                                            {active === 'present' && pill('Present', 'present')}
                                                            {active === 'absent' && pill('Absent', 'absent')}
                                                            {active === 'excused' && pill('Excused', 'excused')}
                                                            {active === 'late' && pill('Late', 'late')}
                                                            {!active && <span className="text-xs text-gray-500">—</span>}
                                                        </td>
                                                        <td className="p-3 align-middle">
                                                            <div className="flex items-center gap-2">
                                                                <label className="sr-only" htmlFor={`in-${id}`}>Time In</label>
                                                                <input
                                                                    id={`in-${id}`}
                                                                    type="time"
                                                                    className="border rounded px-2 py-1 text-xs bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none transition-shadow"
                                                                    value={record.time_in || ''}
                                                                    onChange={(e) => handleTimeChange(id, 'time_in', e.target.value)}
                                                                    onBlur={(e) => saveTime(id, 'time_in', e.target.value)}
                                                                />
                                                                <span className="text-xs text-gray-400">–</span>
                                                                <label className="sr-only" htmlFor={`out-${id}`}>Time Out</label>
                                                                <input
                                                                    id={`out-${id}`}
                                                                    type="time"
                                                                    className="border rounded px-2 py-1 text-xs bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none transition-shadow"
                                                                    value={record.time_out || ''}
                                                                    onChange={(e) => handleTimeChange(id, 'time_out', e.target.value)}
                                                                    onBlur={(e) => saveTime(id, 'time_out', e.target.value)}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-3 align-middle">
                                                            <label className="sr-only" htmlFor={`remarks-${id}`}>Remarks</label>
                                                            <input
                                                                id={`remarks-${id}`}
                                                                className="w-full border-b border-gray-300 dark:border-gray-600 focus:border-[var(--primary-color)] outline-none text-xs bg-transparent dark:text-gray-100"
                                                                placeholder="Remarks…"
                                                                value={record.remarks || ''}
                                                                onChange={(e) => handleRemarkChange(id, e.target.value)}
                                                                onBlur={(e) => saveRemark(id, e.target.value, record.status)}
                                                            />
                                                        </td>
                                                        <td className="p-3 align-middle">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleMarkAttendance(id, 'present')}
                                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary-color)] ${active === 'present' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                                                                    aria-pressed={active === 'present'}
                                                                >
                                                                    Present
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMarkAttendance(id, 'absent')}
                                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary-color)] ${active === 'absent' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                                                                    aria-pressed={active === 'absent'}
                                                                >
                                                                    Absent
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMarkAttendance(id, 'excused')}
                                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary-color)] ${active === 'excused' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                                                                    aria-pressed={active === 'excused'}
                                                                >
                                                                    Excused
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMarkAttendance(id, 'late')}
                                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary-color)] ${active === 'late' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}
                                                                    aria-pressed={active === 'late'}
                                                                >
                                                                    Late
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-10">
                                <Calendar size={64} className="mb-4 opacity-20" />
                                <p className="text-lg font-medium">Select a training day to view attendance details</p>
                                <p className="text-sm opacity-60 mt-2">Manage cadet and staff records, export lists, and perform smart scans.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Create Day Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">New Training Day</h3>
                        <form onSubmit={handleCreateDay} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Date</label>
                                <input 
                                    type="date" required
                                    className="w-full border p-2 rounded bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                    value={createForm.date}
                                    onChange={e => setCreateForm({...createForm, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Title</label>
                                <input 
                                    type="text" required
                                    placeholder="e.g. Drill Day 1"
                                    className="w-full border p-2 rounded bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                    value={createForm.title}
                                    onChange={e => setCreateForm({...createForm, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Description</label>
                                <textarea 
                                    className="w-full border p-2 rounded bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                    value={createForm.description}
                                    onChange={e => setCreateForm({...createForm, description: e.target.value})}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-[var(--primary-color)] text-white rounded hover:opacity-90 hover-highlight"
                                >
                                    Create Day
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;
