import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, X, FileDown, Upload, Plus, RefreshCw, Search, Trash2, Eye, Camera, User, Sun, Moon, MapPin, ChevronLeft } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import imageCompression from 'browser-image-compression';
import { addReportHeader, addReportFooter, addSignatories } from '../../utils/pdf';
import { getSingleton, cacheSingleton, clearCache } from '../../utils/db';
import { toast } from 'react-hot-toast';
import { 
    RANK_OPTIONS, 
    YEAR_LEVEL_OPTIONS, 
    SCHOOL_YEAR_OPTIONS, 
    BATTALION_OPTIONS, 
    COMPANY_OPTIONS, 
    PLATOON_OPTIONS, 
    SEMESTER_OPTIONS, 
    COURSE_OPTIONS,
    CADET_COURSE_OPTIONS,
    STATUS_OPTIONS
} from '../../constants/options';

const Cadets = () => {
    const [cadets, setCadets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [currentCadet, setCurrentCadet] = useState(null);
    const [profilePic, setProfilePic] = useState(null);
    const [preview, setPreview] = useState(null);
    const [darkMode, setDarkMode] = useState(false);
    const [locationInfo, setLocationInfo] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);

    useEffect(() => {
        const isDark = localStorage.getItem('darkMode') === 'true';
        setDarkMode(isDark);
        if (isDark) {
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        localStorage.setItem('darkMode', newMode);
        if (newMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            };

            try {
                const compressedFile = await imageCompression(file, options);
                setProfilePic(compressedFile);
                setPreview(URL.createObjectURL(compressedFile));
            } catch (error) {
                console.error("Image compression error:", error);
                setProfilePic(file);
                setPreview(URL.createObjectURL(file));
            }
        }
    };

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importUrl, setImportUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [linkedUrl, setLinkedUrl] = useState(null);
    const [syncing, setSyncing] = useState(false);

    // Form States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        rank: '', firstName: '', middleName: '', lastName: '', suffixName: '',
        studentId: '', email: '', contactNumber: '', address: '',
        course: '', yearLevel: '', schoolYear: '',
        battalion: '', company: '', platoon: '',
        cadetCourse: '', semester: '', status: 'Ongoing'
    });
    const [editForm, setEditForm] = useState({});
    
    // Filter State
    const [selectedCadetCourse, setSelectedCadetCourse] = useState('All');
    
    // Bulk Selection State
    const [selectedCadets, setSelectedCadets] = useState([]);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        title: 'Cadet Master List',
        company: 'All',
        preparedBy: 'Admin',
        notedBy: 'Commandant'
    });

    // Get unique companies
    const companies = [...new Set(cadets.map(c => c.company).filter(Boolean))];

    useEffect(() => {
        fetchCadets();
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/admin/settings/cadet-source');
            setLinkedUrl(res.data.url);
        } catch (err) {
            console.error("Failed to fetch settings", err);
        }
    };

    const handleSync = async () => {
        if (!linkedUrl) return;
        setSyncing(true);
        try {
            const res = await axios.post('/api/admin/sync-cadets');
            toast.success(res.data.message);
            fetchCadets(true);
        } catch (err) {
            console.error("Sync failed", err);
            toast.error(err.response?.data?.message || 'Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    const fetchCadets = async (forceRefresh = false) => {
        if (!forceRefresh) {
            try {
                const cached = await getSingleton('admin', 'cadets_list');
                if (cached) {
                    // Handle both new { data, timestamp } and old formats
                    let data = cached;
                    let timestamp = 0;
                    
                    if (cached.data && cached.timestamp) {
                        data = cached.data;
                        timestamp = cached.timestamp;
                    } else if (Array.isArray(cached)) {
                        // Handle legacy array format
                        data = cached;
                    }
                    
                    if (Array.isArray(data)) {
                        setCadets(data);
                        setLoading(false);
                        
                        // If fresh (< 2 mins), skip fetch
                        if (timestamp && (Date.now() - timestamp < 2 * 60 * 1000)) {
                            return;
                        }
                    }
                }
            } catch (cacheErr) {
                console.warn("Failed to load from cache", cacheErr);
            }
        }

        try {
            const res = await axios.get('/api/admin/cadets');
            setCadets(res.data);
            setLoading(false);
            
            await cacheSingleton('admin', 'cadets_list', {
                data: res.data,
                timestamp: Date.now()
            });
        } catch (err) {
            console.error("Network request failed", err);
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF();

            const tableColumn = ["Rank", "Name", "Student ID", "Unit", "Email", "Phone"];
            
            const tableRows = [];

            const filteredForExport = exportOptions.company === 'All' 
                ? cadets 
                : cadets.filter(c => c.company === exportOptions.company);

            filteredForExport.forEach(cadet => {
                const cadetData = [
                    cadet.rank,
                    `${cadet.last_name}, ${cadet.first_name}`,
                    cadet.student_id,
                    `${cadet.company || '-'}/${cadet.platoon || '-'}`,
                    cadet.email || '-',
                    cadet.contact_number || '-'
                ];
                tableRows.push(cadetData);
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 50,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [22, 163, 74] },
                margin: { top: 40, bottom: 20 },
                didDrawPage: () => {
                    addReportHeader(doc, {
                        title: `${exportOptions.title || 'Cadet List'}`,
                        dateText: new Date().toLocaleDateString(),
                        leftLogo: import.meta.env.VITE_REPORT_LEFT_LOGO || null,
                        rightLogo: import.meta.env.VITE_REPORT_RIGHT_LOGO || null
                    });
                    addReportFooter(doc);
                }
            });

            const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || 60;
            addSignatories(doc, finalY, {
                preparedBy: 'Wilmer B Montejo',
                preparedRole: 'SSg (Inf) PA • Admin NCO',
                certifiedBy: 'INDIHRA D TAWANTAWAN',
                certifiedRole: 'LTC (RES) PA • Commandant'
            });

            doc.save('ROTC_Cadet_List.pdf');
        } catch (err) {
            console.error("PDF Export Error:", err);
            toast.error(`Failed to generate PDF: ${err.message}`);
        }
    };

    const openEditModal = (cadet) => {
        setIsViewMode(false);
        setCurrentCadet(cadet);
        
        // Handle Profile Pic Preview
        if (cadet.profile_pic) {
            if (cadet.profile_pic.startsWith('data:') || cadet.profile_pic.startsWith('http')) {
                setPreview(cadet.profile_pic);
            } else {
                let normalizedPath = cadet.profile_pic.replace(/\\/g, '/');
                // Remove absolute path prefix if present (look for /uploads/)
                const uploadsIndex = normalizedPath.indexOf('/uploads/');
                if (uploadsIndex !== -1) {
                    normalizedPath = normalizedPath.substring(uploadsIndex);
                } else if (!normalizedPath.startsWith('/')) {
                    normalizedPath = '/' + normalizedPath;
                }
                setPreview(`${import.meta.env.VITE_API_URL || ''}${normalizedPath}`);
            }
        } else {
            setPreview(null);
        }
        setProfilePic(null);

        setLocationInfo(null);
        setLocationLoading(true);
        axios.get('/api/admin/locations')
            .then(res => {
                const rows = res.data || [];
                const match = rows.find(u => u.role === 'cadet' && Number(u.cadet_id) === Number(cadet.id));
                setLocationInfo(match || null);
            })
            .catch(() => {
                setLocationInfo(null);
            })
            .finally(() => {
                setLocationLoading(false);
            });

        setEditForm({
            rank: cadet.rank || '',
            firstName: cadet.first_name || '',
            middleName: cadet.middle_name || '',
            lastName: cadet.last_name || '',
            suffixName: cadet.suffix_name || '',
            studentId: cadet.student_id || '',
            email: cadet.email || '',
            username: cadet.username || '',
            contactNumber: cadet.contact_number || '',
            address: cadet.address || '',
            course: cadet.course || '',
            yearLevel: cadet.year_level || '',
            schoolYear: cadet.school_year || '',
            battalion: cadet.battalion || '',
            company: cadet.company || '',
            platoon: cadet.platoon || '',
            cadetCourse: cadet.cadet_course || '',
            semester: cadet.semester || '',
            status: cadet.status || 'Ongoing'
        });
        setIsEditModalOpen(true);
    };

    const openViewModal = (cadet) => {
        openEditModal(cadet);
        setIsViewMode(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            
            // Append all text fields
            Object.keys(editForm).forEach(key => {
                formData.append(key, editForm[key]);
            });

            // Append file if exists
            if (profilePic) {
                formData.append('profilePic', profilePic);
            }

            await axios.put(`/api/admin/cadets/${currentCadet.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await cacheSingleton('admin', 'cadets_list', null);
            await clearCache('attendance_by_day'); // Sync attendance lists
            fetchCadets(true);
            setIsEditModalOpen(false);
            toast.success('Cadet updated successfully');
        } catch (err) {
            console.error(err);
            toast.error('Error updating cadet');
        }
    };

    const handleImport = async (e) => {
        e.preventDefault();
        if (!importFile && !importUrl) return;

        setImporting(true);
        
        try {
            let res;
            if (importFile) {
                const formData = new FormData();
                formData.append('file', importFile);
                res = await axios.post('/api/admin/import-cadets', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await axios.post('/api/admin/import-cadets-url', { url: importUrl });
            }
            
            let message = res.data.message || 'Import successful!';
            
            if (res.data.errors && res.data.errors.length > 0) {
                message += '\n\nErrors encountered:\n' + res.data.errors.join('\n');
            }
            
            toast.success(message);
            setIsImportModalOpen(false);
            setImportFile(null);
            setImportUrl('');
            
            try {
                await clearCache('attendance_by_day'); // Sync attendance lists
                await cacheSingleton('analytics', 'dashboard', null);
            } catch (cacheErr) {
                console.warn('Failed to clear cache:', cacheErr);
            }
            
            fetchCadets(true);
            fetchSettings();
        } catch (err) {
            console.error(err);
            const status = err.response?.status;
            const isAuthError = status === 401 || status === 403 || err.message.includes('401') || err.message.includes('403');

            if (isAuthError) {
                toast.error('Session expired. Please log in again.');
                window.location.href = '/login';
            } else {
                toast.error('Import failed: ' + (err.response?.data?.message || err.message));
            }
        } finally {
            setImporting(false);
        }
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();

        // Check if limit reached
        if (cadets.length >= 500) {
            alert('Cannot add more cadets. The maximum limit of 500 cadets has been reached.');
            return;
        }

        try {
            await axios.post('/api/admin/cadets', addForm);
            toast.success('Cadet added successfully. Please verify the profile in the Unverified tab.');
            setIsAddModalOpen(false);
            
            // Switch to Unverified tab to show the new cadet
            setSelectedCadetCourse('Unverified');
            
            // Clear cache and force refresh
            await cacheSingleton('admin', 'cadets_list', null);
            await clearCache('attendance_by_day'); // Sync attendance lists
            await fetchCadets(true);
            
            setAddForm({
                rank: '', firstName: '', middleName: '', lastName: '', suffixName: '',
                studentId: '', email: '', contactNumber: '', address: '',
                course: '', yearLevel: '', schoolYear: '',
                battalion: '', company: '', platoon: '',
                cadetCourse: '', semester: '', status: 'Ongoing'
            });
        } catch (err) {
            console.error(err);
            toast.error('Failed to add cadet: ' + (err.response?.data?.message || err.message));
        }
    };

    const filteredCadets = cadets.filter(cadet => {
        // Filter by Cadet Course
        if (selectedCadetCourse === 'Unverified') {
            // Show only incomplete profiles (treating null/0/false as incomplete)
            if (cadet.is_profile_completed) return false;
        } else if (selectedCadetCourse !== 'All') {
            if (cadet.cadet_course !== selectedCadetCourse) return false;
            // Also enforce verification for specific course tabs
            if (!cadet.is_profile_completed) return false;
        }

        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            (cadet.first_name && cadet.first_name.toLowerCase().includes(lowerTerm)) ||
            (cadet.last_name && cadet.last_name.toLowerCase().includes(lowerTerm)) ||
            (cadet.student_id && cadet.student_id.toLowerCase().includes(lowerTerm)) ||
            (cadet.rank && cadet.rank.toLowerCase().includes(lowerTerm)) ||
            (cadet.company && cadet.company.toLowerCase().includes(lowerTerm))
        );
    }).sort((a, b) => {
        const rankA = RANK_OPTIONS.indexOf(a.rank);
        const rankB = RANK_OPTIONS.indexOf(b.rank);
        // Put unknown ranks at the end
        const valA = rankA === -1 ? -1 : rankA;
        const valB = rankB === -1 ? -1 : rankB;
        return valB - valA;
    });

    // Bulk Selection Handlers
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedCadets(filteredCadets.map(c => c.id));
        } else {
            setSelectedCadets([]);
        }
    };

    const handleSelectCadet = (id) => {
        setSelectedCadets(prev => 
            prev.includes(id) 
                ? prev.filter(cId => cId !== id) 
                : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedCadets.length} cadets? This action cannot be undone.`)) return;

        try {
            await axios.post('/api/admin/cadets/delete', { ids: selectedCadets });
            toast.success('Cadets deleted successfully');
            setSelectedCadets([]);
            await cacheSingleton('admin', 'cadets_list', null);
            await clearCache('attendance_by_day'); // Sync attendance lists
            fetchCadets();
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete cadets');
        }
    };

    if (loading) return <div className="text-center p-10">Loading...</div>;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold">Cadet Management</h2>
                <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
                    {/* Search Bar */}
                    <div className="relative flex-1 md:flex-none">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search cadets..."
                            className="pl-10 pr-4 py-2 border rounded w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {linkedUrl && (
                        <button 
                            onClick={handleSync}
                            disabled={syncing}
                            className={`flex-1 md:flex-none bg-indigo-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-indigo-700 ${syncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={`Synced with: ${linkedUrl}`}
                        >
                            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                            <span>{syncing ? 'Syncing...' : 'Sync'}</span>
                        </button>
                    )}
                    {selectedCadets.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex-1 md:flex-none bg-red-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-red-700 animate-fade-in"
                        >
                            <Trash2 size={18} />
                            <span>Delete ({selectedCadets.length})</span>
                        </button>
                    )}
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-blue-700"
                    >
                        <Upload size={18} />
                        <span>Import</span>
                    </button>
                    <button 
                        onClick={() => {
                            if (cadets.length >= 500) {
                                alert('Cannot add more cadets. The maximum limit of 500 cadets has been reached.');
                                return;
                            }
                            setIsAddModalOpen(true);
                        }}
                        className="flex-1 md:flex-none bg-green-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-green-700"
                    >
                        <Plus size={18} />
                        <span>Add Cadet</span>
                    </button>
                    <button 
                        onClick={() => setIsExportModalOpen(true)}
                        className="flex-1 md:flex-none bg-green-700 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-green-800"
                    >
                        <FileDown size={18} />
                        <span>PDF</span>
                    </button>
                </div>
            </div>

            {/* Cadet Course Tabs */}
            <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setSelectedCadetCourse('All')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                        selectedCadetCourse === 'All'
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-white text-gray-600 border hover:bg-gray-50'
                    }`}
                >
                    All Cadets
                </button>
                <button
                    onClick={() => setSelectedCadetCourse('Unverified')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                        selectedCadetCourse === 'Unverified'
                            ? 'bg-yellow-500 text-white shadow'
                            : 'bg-white text-gray-600 border hover:bg-gray-50'
                    }`}
                >
                    Unverified
                </button>
                {CADET_COURSE_OPTIONS.map(course => (
                    <button
                        key={course}
                        onClick={() => setSelectedCadetCourse(course)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                            selectedCadetCourse === course
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-white text-gray-600 border hover:bg-gray-50'
                        }`}
                    >
                        {course}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded shadow overflow-auto max-h-[calc(100vh-200px)] relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr className="border-b shadow-sm">
                            <th className="p-4 bg-gray-100 text-center w-12">
                                <input
                                    type="checkbox"
                                    onChange={handleSelectAll}
                                    checked={filteredCadets.length > 0 && selectedCadets.length === filteredCadets.length}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                />
                            </th>
                            <th className="p-4 bg-gray-100">Name & Rank</th>
                            <th className="p-4 bg-gray-100">Username</th>
                            <th className="p-4 text-center bg-gray-100">Unit (Coy/Plt)</th>
                            <th className="p-4 text-center bg-gray-100">Status</th>
                            <th className="p-4 text-right bg-gray-100">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCadets.length === 0 ? (
                             <tr>
                                <td colSpan="6" className="p-4 text-center text-gray-500">No cadets found.</td>
                             </tr>
                        ) : (
                            filteredCadets.map(cadet => (
                                <tr key={cadet.id} className="border-b hover:bg-gray-50">
                                    <td className="p-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedCadets.includes(cadet.id)}
                                            onChange={() => handleSelectCadet(cadet.id)}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium">
                                            <span className="font-bold text-blue-900 mr-1">{cadet.rank}</span>
                                            {cadet.last_name}, {cadet.first_name}
                                        </div>
                                        <div className="text-xs text-gray-500">{cadet.email}</div>
                                    </td>
                                    <td className="p-4">{cadet.username || cadet.student_id}</td>
                                    <td className="p-4 text-center">{cadet.company || '-'}/{cadet.platoon || '-'}</td>
                                    <td className="p-4 text-center">
                                        {!cadet.is_profile_completed ? (
                                            <span className="text-xs font-semibold px-2 py-1 rounded bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                Unverified
                                            </span>
                                        ) : (
                                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                                cadet.status === 'Ongoing' ? 'bg-blue-100 text-blue-800' :
                                                cadet.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {cadet.status}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button 
                                            onClick={() => openViewModal(cadet)}
                                            className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                                            title="View Profile"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button 
                                            onClick={() => openEditModal(cadet)}
                                            className="text-gray-600 hover:bg-gray-50 p-2 rounded"
                                            title="Edit Info"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Export Settings</h3>
                            <button onClick={() => setIsExportModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Document Title</label>
                                <input 
                                    className="w-full border p-2 rounded" 
                                    value={exportOptions.title} 
                                    onChange={e => setExportOptions({...exportOptions, title: e.target.value})} 
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Company</label>
                                <select 
                                    className="w-full border p-2 rounded"
                                    value={exportOptions.company}
                                    onChange={e => setExportOptions({...exportOptions, company: e.target.value})}
                                >
                                    <option value="All">All Companies</option>
                                    {companies.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prepared By</label>
                                    <input 
                                        className="w-full border p-2 rounded" 
                                        value={exportOptions.preparedBy} 
                                        onChange={e => setExportOptions({...exportOptions, preparedBy: e.target.value})} 
                                        placeholder="Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Noted By</label>
                                    <input 
                                        className="w-full border p-2 rounded" 
                                        value={exportOptions.notedBy} 
                                        onChange={e => setExportOptions({...exportOptions, notedBy: e.target.value})} 
                                        placeholder="Commandant"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex space-x-3">
                                <button 
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="flex-1 px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleExportPDF}
                                    className="flex-1 px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 flex justify-center items-center"
                                >
                                    <FileDown size={18} className="mr-2" />
                                    Generate PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Import Cadet List</h3>
                            <button onClick={() => setIsImportModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleImport} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Upload File (ROTCMIS Format)
                                </label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                    <input 
                                        type="file" 
                                        accept=".xlsx,.xls,.csv,.pdf"
                                        onChange={(e) => setImportFile(e.target.files[0])}
                                        className="hidden" 
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                        <Upload size={32} className="text-gray-400 mb-2" />
                                        <span className="text-blue-600 hover:text-blue-800">Choose file</span>
                                        <span className="text-sm text-gray-500 mt-1">
                                            {importFile ? importFile.name : 'or drag and drop here'}
                                        </span>
                                    </label>
                                </div>
                                <div className="text-xs text-gray-500 mt-2 space-y-1">
                                    <p><strong>Supported formats:</strong> .xlsx, .xls, .csv, .pdf</p>
                                    <p><strong>Supported Columns:</strong> No (ignored), Rank, First Name, Middle Name, Last Name, Username, Email, Student ID</p>
                                    <p><strong>Note:</strong> Login uses Username (defaults to Student ID) or Email.</p>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Import via OneDrive/SharePoint Link
                                </label>
                                <input
                                    type="url"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    placeholder="Paste OneDrive/SharePoint direct download link..."
                                    value={importUrl}
                                    onChange={(e) => {
                                        setImportUrl(e.target.value);
                                        setImportFile(null);
                                    }}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Ensure the link is accessible. For OneDrive/SharePoint, use a shared link and append <code>?download=1</code> if needed.
                                </p>
                            </div>
                            
                            <div className="pt-4 flex space-x-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="flex-1 px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={(!importFile && !importUrl) || importing}
                                    className={`flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex justify-center items-center ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {importing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={18} className="mr-2" />
                                            Import
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-lg mx-4 p-6 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Add New Cadet</h3>
                            <button onClick={() => setIsAddModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddSubmit} className="space-y-4 overflow-y-auto pr-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <select className="border p-2 rounded" value={addForm.rank} onChange={e => setAddForm({...addForm, rank: e.target.value})}>
                                    <option value="">Select Rank</option>
                                    {RANK_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <input className="border p-2 rounded" required value={addForm.firstName} onChange={e => setAddForm({...addForm, firstName: e.target.value})} placeholder="First Name *" />
                                <input className="border p-2 rounded" value={addForm.middleName} onChange={e => setAddForm({...addForm, middleName: e.target.value})} placeholder="Middle Name" />
                                <input className="border p-2 rounded" required value={addForm.lastName} onChange={e => setAddForm({...addForm, lastName: e.target.value})} placeholder="Last Name *" />
                                <input className="border p-2 rounded" value={addForm.suffixName} onChange={e => setAddForm({...addForm, suffixName: e.target.value})} placeholder="Suffix" />
                                <input className="border p-2 rounded" required value={addForm.studentId} onChange={e => setAddForm({...addForm, studentId: e.target.value})} placeholder="Student ID *" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="border p-2 rounded" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} placeholder="Email (Login Username)" />
                                <input className="border p-2 rounded" value={addForm.contactNumber} onChange={e => setAddForm({...addForm, contactNumber: e.target.value})} placeholder="Contact Number" />
                            </div>

                            <input className="border p-2 rounded w-full" value={addForm.address} onChange={e => setAddForm({...addForm, address: e.target.value})} placeholder="Address" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select className="border p-2 rounded" value={addForm.course} onChange={e => setAddForm({...addForm, course: e.target.value})}>
                                    <option value="">Select Course</option>
                                    {COURSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <select className="border p-2 rounded" value={addForm.yearLevel} onChange={e => setAddForm({...addForm, yearLevel: e.target.value})}>
                                    <option value="">Select Year Level</option>
                                    {YEAR_LEVEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <select className="border p-2 rounded" value={addForm.schoolYear} onChange={e => setAddForm({...addForm, schoolYear: e.target.value})}>
                                    <option value="">Select School Year</option>
                                    {SCHOOL_YEAR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <select className="border p-2 rounded" value={addForm.semester} onChange={e => setAddForm({...addForm, semester: e.target.value})}>
                                    <option value="">Select Semester</option>
                                    {SEMESTER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <select className="border p-2 rounded" value={addForm.battalion} onChange={e => setAddForm({...addForm, battalion: e.target.value})}>
                                    <option value="">Select Battalion</option>
                                    {BATTALION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <select className="border p-2 rounded" value={addForm.company} onChange={e => setAddForm({...addForm, company: e.target.value})}>
                                    <option value="">Select Company</option>
                                    {COMPANY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <select className="border p-2 rounded" value={addForm.platoon} onChange={e => setAddForm({...addForm, platoon: e.target.value})}>
                                    <option value="">Select Platoon</option>
                                    {PLATOON_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select className="border p-2 rounded" value={addForm.cadetCourse} onChange={e => setAddForm({...addForm, cadetCourse: e.target.value})}>
                                    <option value="">Select Cadet Course</option>
                                    {CADET_COURSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <select className="border p-2 rounded" value={addForm.status} onChange={e => setAddForm({...addForm, status: e.target.value})}>
                                    <option value="">Select Status</option>
                                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            
                            <div className="pt-4 flex space-x-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 py-2 border rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Add Cadet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* Edit / View Cadet Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start md:items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
                    <div className={`bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col my-6 sm:my-8 shadow-xl max-h-[90vh] overflow-y-auto text-sm sm:text-base ${darkMode ? 'dark' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 border-b pb-3 sm:pb-4 dark:border-gray-700 gap-3">
                            <div className="flex items-center space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                                >
                                    <ChevronLeft size={16} className="mr-1" />
                                    Back to List
                                </button>
                                <h3 className="text-lg sm:text-2xl font-bold dark:text-white">
                                    {isViewMode ? 'View Cadet Profile' : 'Edit Cadet Info'}
                                </h3>
                            </div>
                            <div className="flex items-center space-x-4">
                                <button 
                                    onClick={toggleDarkMode}
                                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title="Toggle Dark Mode Preview"
                                >
                                    {darkMode ? <Sun className="text-yellow-400" size={20} /> : <Moon className="text-gray-600" size={20} />}
                                </button>
                                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>
                        
                        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
                            {/* Left Column: Photo & Status */}
                            <div className="md:col-span-1 space-y-6">
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg shadow-inner text-center">
                                    <div className="relative inline-block">
                                        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 mx-auto border-4 border-white dark:border-gray-600 shadow-lg">
                                            {preview ? (
                                                <img 
                                                    src={preview} 
                                                    alt="Profile" 
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-300">
                                                    <User size={64} />
                                                </div>
                                            )}
                                        </div>
                                        {!isViewMode && (
                                            <label className="absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-md transition-transform hover:scale-105">
                                                <Camera size={18} />
                                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                            </label>
                                        )}
                                    </div>
                                    <h2 className="mt-4 text-xl font-bold text-gray-800 dark:text-white">{editForm.lastName}, {editForm.firstName}</h2>
                                    <p className="text-gray-500 dark:text-gray-300 font-medium">{editForm.rank || 'Cadet'}</p>
                                </div>

                                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow border dark:border-gray-600">
                                     <h3 className="font-bold mb-3 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider">Account Status</h3>
                                     <select 
                                        disabled={isViewMode}
                                        value={editForm.status} 
                                        onChange={e => setEditForm({...editForm, status: e.target.value})}
                                        className={`w-full p-2 rounded font-bold border-0 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 ${
                                            editForm.status === 'Ongoing' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                            editForm.status === 'Failed' || editForm.status === 'Drop' ? 'bg-red-50 text-red-700 ring-red-600/20' :
                                            'bg-gray-50 text-gray-600 ring-gray-500/10'
                                        }`}
                                     >
                                        {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                     </select>
                                </div>

                                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow border dark:border-gray-600">
                                    <h3 className="font-bold mb-3 text-gray-700 dark:text-gray-200 uppercase text-xs tracking-wider flex items-center gap-2">
                                        <MapPin size={16} />
                                        Last Known Location
                                    </h3>
                                    {locationLoading && (
                                        <div className="text-sm text-gray-500 dark:text-gray-300">Loading location...</div>
                                    )}
                                    {!locationLoading && !locationInfo && (
                                        <div className="text-sm text-gray-500 dark:text-gray-300">
                                            No location data yet for this account.
                                        </div>
                                    )}
                                    {!locationLoading && locationInfo && (
                                        <div className="space-y-2 text-sm">
                                            <div className="text-gray-700 dark:text-gray-200">
                                                {locationInfo.last_latitude.toFixed(4)}, {locationInfo.last_longitude.toFixed(4)}
                                            </div>
                                            {locationInfo.last_location_at && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    Updated {new Date(locationInfo.last_location_at).toLocaleString()}
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const url = `https://www.google.com/maps?q=${locationInfo.last_latitude},${locationInfo.last_longitude}`;
                                                    window.open(url, '_blank', 'noopener,noreferrer');
                                                }}
                                                className="mt-2 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                                            >
                                                <MapPin size={14} className="mr-1" />
                                                Ping Location
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Form Fields */}
                            <div className="md:col-span-2 space-y-6 pb-4 sm:pb-6">
                                {/* Credentials */}
                                <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg border border-green-100 dark:border-green-800">
                                    <h4 className="font-bold text-green-800 dark:text-green-300 mb-4 text-sm uppercase tracking-wide flex items-center">
                                        <User size={16} className="mr-2" /> Login Credentials
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                                            <input 
                                                disabled={isViewMode}
                                                className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed" 
                                                value={editForm.username} 
                                                onChange={e => setEditForm({...editForm, username: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                            <input 
                                                disabled={isViewMode}
                                                className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed" 
                                                value={editForm.email} 
                                                onChange={e => setEditForm({...editForm, email: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Personal Info */}
                                <div>
                                    <h3 className="text-lg font-bold mb-4 pb-2 border-b dark:border-gray-700 text-gray-800 dark:text-white">Personal Information</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rank</label>
                                                <select disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.rank} onChange={e => setEditForm({...editForm, rank: e.target.value})}>
                                                    <option value="">Select Rank</option>
                                                    {RANK_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Suffix</label>
                                                <input disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.suffixName} onChange={e => setEditForm({...editForm, suffixName: e.target.value})} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                                                <input disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Middle Name</label>
                                                <input disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.middleName} onChange={e => setEditForm({...editForm, middleName: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                                                <input disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Number</label>
                                                <input disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.contactNumber} onChange={e => setEditForm({...editForm, contactNumber: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student ID</label>
                                                <input disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.studentId} onChange={e => setEditForm({...editForm, studentId: e.target.value})} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                                            <input disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                {/* Military & School Info */}
                                <div>
                                    <h3 className="text-lg font-bold mb-4 pb-2 border-b dark:border-gray-700 text-gray-800 dark:text-white">Military & School Information</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course</label>
                                                <select disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.course} onChange={e => setEditForm({...editForm, course: e.target.value})}>
                                                    <option value="">Select Course</option>
                                                    {COURSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year Level</label>
                                                <select disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.yearLevel} onChange={e => setEditForm({...editForm, yearLevel: e.target.value})}>
                                                    <option value="">Select Level</option>
                                                    {YEAR_LEVEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School Year</label>
                                                <select disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.schoolYear} onChange={e => setEditForm({...editForm, schoolYear: e.target.value})}>
                                                    <option value="">Select S.Y.</option>
                                                    {SCHOOL_YEAR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Battalion</label>
                                                <select disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.battalion} onChange={e => setEditForm({...editForm, battalion: e.target.value})}>
                                                    <option value="">Select Battalion</option>
                                                    {BATTALION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
                                                <select disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})}>
                                                    <option value="">Select Company</option>
                                                    {COMPANY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platoon</label>
                                                <select disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.platoon} onChange={e => setEditForm({...editForm, platoon: e.target.value})}>
                                                    <option value="">Select Platoon</option>
                                                    {PLATOON_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cadet Course</label>
                                                <select disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.cadetCourse} onChange={e => setEditForm({...editForm, cadetCourse: e.target.value})}>
                                                    <option value="">Select Course</option>
                                                    {CADET_COURSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                                                <select disabled={isViewMode} className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded disabled:opacity-60" value={editForm.semester} onChange={e => setEditForm({...editForm, semester: e.target.value})}>
                                                    <option value="">Select Semester</option>
                                                    {SEMESTER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {!isViewMode && (
                                    <div className="pt-4 border-t dark:border-gray-700 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditModalOpen(false)}
                                            className="px-4 sm:px-6 py-2 border rounded text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 dark:border-gray-600 transition-colors text-sm sm:text-base"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-md transition-transform hover:scale-105 text-sm sm:text-base"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                )}

                                {/* Mobile Back Button */}
                                <div className="mt-4 pt-3 border-t dark:border-gray-700 md:hidden">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="w-full inline-flex items-center justify-center px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 text-sm font-medium"
                                    >
                                        <ChevronLeft size={16} className="mr-1" />
                                        Back to Cadet List
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cadets;
