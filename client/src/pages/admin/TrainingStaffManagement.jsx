import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, Trash2, X, Upload, Plus, UserCog, MapPin, ChevronLeft, Sun, Moon, User, MoreVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getSingleton, cacheSingleton, clearCache } from '../../utils/db';
import { getProfilePicUrl } from '../../utils/image';
import { STAFF_RANK_OPTIONS } from '../../constants/options';
 

const TrainingStaffManagement = () => {
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentStaff, setCurrentStaff] = useState(null);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);

    // Form States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        rank: '', first_name: '', middle_name: '', last_name: '', suffix_name: '',
        email: '', contact_number: '', role: 'Instructor'
    });
    const [editForm, setEditForm] = useState({});
    const [locationInfo, setLocationInfo] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [preview, setPreview] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [sortDir, setSortDir] = useState('asc');
    const [openActionsId, setOpenActionsId] = useState(null);

    useEffect(() => {
        fetchStaff();
    }, []);

    const toggleDarkMode = () => setDarkMode(!darkMode);

    const fetchStaff = async (forceRefresh = false) => {
        try {
            if (!forceRefresh) {
                const cached = await getSingleton('admin', 'staff_list');
                if (cached && Array.isArray(cached.data)) {
                    setStaffList(cached.data);
                    setLoading(false);
                    // 2 minute cache
                    if (Date.now() - cached.timestamp < 2 * 60 * 1000) {
                        return;
                    }
                }
            }

            const res = await axios.get('/api/staff');
            setStaffList(res.data);
            await cacheSingleton('admin', 'staff_list', {
                data: res.data,
                timestamp: Date.now()
            });
            setLoading(false);
        } catch (err) {
            console.error("Network request failed", err);
            setLoading(false);
        }
    };

    const handleImport = async (e) => {
        e.preventDefault();
        if (!importFile) return;

        setImporting(true);
        
        try {
            const formData = new FormData();
            formData.append('file', importFile);
            const res = await axios.post('/api/admin/import-staff', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            let message = res.data.message || 'Import successful!';
            
            if (res.data.errors && res.data.errors.length > 0) {
                message += '\n\nErrors encountered:\n' + res.data.errors.join('\n');
            }
            
            toast.success(message);
            setIsImportModalOpen(false);
            setImportFile(null);
            
            // Clear cache and force refresh
            await cacheSingleton('admin', 'staff_list', null);
            await clearCache('attendance_by_day'); // Sync with attendance
            fetchStaff(true);
        } catch (err) {
            console.error(err);
            toast.error('Import failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setImporting(false);
        }
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/staff', addForm);
            toast.success('Staff added successfully');
            setIsAddModalOpen(false);
            
            // Clear cache and force refresh
            await cacheSingleton('admin', 'staff_list', null);
            fetchStaff(true);
            
            setAddForm({
                rank: '', first_name: '', middle_name: '', last_name: '', suffix_name: '',
                email: '', contact_number: '', role: 'Instructor'
            });
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message;
            toast.error('Failed to add staff: ' + msg);
        }
    };

    const openEditModal = (staff) => {
        setCurrentStaff(staff);
        setEditForm({
            rank: staff.rank || '',
            first_name: staff.first_name || '',
            middle_name: staff.middle_name || '',
            last_name: staff.last_name || '',
            suffix_name: staff.suffix_name || '',
            email: staff.email || '',
            username: staff.username || '',
            contact_number: staff.contact_number || '',
            role: staff.role || 'Instructor'
        });
        // Prepare profile picture preview using centralized utility
        const profilePicUrl = getProfilePicUrl(staff.profile_pic, staff.id, 'staff');
        setPreview(profilePicUrl);
        
        setLocationInfo(null);
        setLocationLoading(true);
        axios.get('/api/admin/locations')
            .then(res => {
                const rows = res.data || [];
                const match = rows.find(u => u.role === 'training_staff' && Number(u.staff_id) === Number(staff.id));
                setLocationInfo(match || null);
            })
            .catch(() => {
                setLocationInfo(null);
            })
            .finally(() => {
                setLocationLoading(false);
            });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`/api/staff/${currentStaff.id}`, editForm);
            await cacheSingleton('admin', 'staff_list', null);
            await clearCache('attendance_by_day'); // Sync with attendance
            fetchStaff(true);
            setIsEditModalOpen(false);
            toast.success('Staff updated successfully');
        } catch (err) {
            toast.error('Error updating staff: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this staff member?')) return;
        try {
            await axios.delete(`/api/staff/${id}`);
            await cacheSingleton('admin', 'staff_list', null);
            fetchStaff(true);
        } catch (err) {
            toast.error('Error deleting staff: ' + (err.response?.data?.message || err.message));
        }
    };

    if (loading) return <div className="text-center p-10">Loading...</div>;

    const statusOf = (s) => {
        if (s.is_archived) return 'completed';
        if (s.is_profile_completed) return 'active';
        return 'pending';
    };

    const compareBy = (a, b) => {
        if (sortBy === 'name') {
            const na = `${a.last_name || ''}, ${a.first_name || ''}`.toLowerCase();
            const nb = `${b.last_name || ''}, ${b.first_name || ''}`.toLowerCase();
            return na.localeCompare(nb);
        }
        if (sortBy === 'role') {
            return (a.role || '').localeCompare(b.role || '');
        }
        if (sortBy === 'status') {
            const order = { active: 0, pending: 1, completed: 2 };
            return (order[statusOf(a)] ?? 3) - (order[statusOf(b)] ?? 3);
        }
        const rankA = STAFF_RANK_OPTIONS.indexOf(a.rank);
        const rankB = STAFF_RANK_OPTIONS.indexOf(b.rank);
        return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
    };

    const sortedStaffList = [...staffList].sort((a, b) => {
        const res = compareBy(a, b);
        return sortDir === 'asc' ? res : -res;
    });

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <UserCog /> Training Staff Management
                </h2>
                <div className="flex space-x-2 w-full md:w-auto">
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-blue-700"
                    >
                        <Upload size={18} />
                        <span>Import List</span>
                    </button>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-1 md:flex-none bg-green-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-green-700"
                    >
                        <Plus size={18} />
                        <span>Add Staff</span>
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">Sort by</div>
                <div className="flex items-center space-x-2">
                    <select
                        aria-label="Sort by"
                        className="border rounded px-2 py-1 text-sm"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="name">Name</option>
                        <option value="role">Role</option>
                        <option value="status">Status</option>
                    </select>
                    <button
                        type="button"
                        aria-label="Toggle sort direction"
                        onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                        className="inline-flex items-center px-2 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                        {sortDir === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {sortedStaffList.length === 0 ? (
                <div className="bg-white rounded border border-dashed p-8 text-center text-gray-600">
                    <div className="mb-2 font-semibold">No training staff found.</div>
                    <div className="text-sm mb-4">Import a list or add staff to get started.</div>
                    <div className="flex items-center justify-center space-x-2">
                        <button onClick={() => setIsImportModalOpen(true)} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
                            Import List
                        </button>
                        <button onClick={() => setIsAddModalOpen(true)} className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700">
                            Add Staff
                        </button>
                    </div>
                </div>
            ) : (
                <ul role="list" className="bg-white rounded shadow divide-y">
                    {sortedStaffList.map((s) => {
                        const status = statusOf(s);
                        const badge =
                            status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-700';
                        return (
                            <li key={s.id} className="flex items-center justify-between px-4 py-4 focus-within:bg-gray-50">
                                <div className="min-w-0 pr-4">
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(s)}
                                        className="text-left font-semibold text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-green-600 rounded"
                                        aria-label={`Open details for ${s.last_name}, ${s.first_name}`}
                                    >
                                        <span className="mr-2 text-blue-900">{s.rank}</span>
                                        {s.last_name}, {s.first_name} {s.middle_name} {s.suffix_name}
                                    </button>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                        <span className="text-gray-600">{s.role || 'Instructor'}</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge}`} aria-label={`Status: ${status}`}>
                                            {status}
                                        </span>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-gray-500 break-all">{s.email || '-'}</span>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-gray-500">{s.contact_number || '-'}</span>
                                    </div>
                                </div>
                                <div className="hidden md:flex items-center space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(s)}
                                        className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
                                        aria-label="View details"
                                    >
                                        View
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(s)}
                                        className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50 inline-flex items-center"
                                        aria-label="Edit"
                                    >
                                        <Pencil size={16} className="mr-1" /> Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(s.id)}
                                        className="px-3 py-1.5 rounded border text-sm text-red-700 hover:bg-red-50 inline-flex items-center"
                                        aria-label="Remove"
                                    >
                                        <Trash2 size={16} className="mr-1" /> Remove
                                    </button>
                                </div>
                                <div className="md:hidden relative">
                                    <button
                                        type="button"
                                        aria-haspopup="true"
                                        aria-expanded={openActionsId === s.id}
                                        onClick={() => setOpenActionsId(openActionsId === s.id ? null : s.id)}
                                        className="p-2 rounded border hover:bg-gray-50"
                                    >
                                        <MoreVertical size={18} />
                                    </button>
                                    {openActionsId === s.id && (
                                        <div className="absolute right-0 mt-2 w-36 bg-white border rounded shadow-lg z-50">
                                            <button
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                                onClick={() => { setOpenActionsId(null); openEditModal(s); }}
                                            >
                                                View
                                            </button>
                                            <button
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                                onClick={() => { setOpenActionsId(null); openEditModal(s); }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                                                onClick={() => { setOpenActionsId(null); handleDelete(s.id); }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Import Staff List</h3>
                            <button onClick={() => setIsImportModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleImport} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Excel File</label>
                                <div className="border-2 border-dashed border-gray-300 rounded p-6 text-center cursor-pointer hover:bg-gray-50 relative">
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls" 
                                        onChange={e => setImportFile(e.target.files[0])}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="flex flex-col items-center pointer-events-none">
                                        <Upload className="text-gray-400 mb-2" size={32} />
                                        <span className="text-sm text-gray-600">
                                            {importFile ? importFile.name : 'Click to upload Excel file'}
                                        </span>
                                        <span className="text-xs text-gray-400 mt-1">Supported formats: .xlsx, .xls</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                <p className="font-semibold mb-1">Required Columns:</p>
                                <p>First Name, Last Name</p>
                                <p className="font-semibold mt-1">Optional Columns:</p>
                                <p>Middle Name, Suffix, Rank, Email, Username, Role</p>
                            </div>
                            <button 
                                type="submit" 
                                disabled={importing || !importFile}
                                className={`w-full py-2 rounded text-white font-medium ${importing || !importFile ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {importing ? 'Importing...' : 'Start Import'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Add Training Staff</h3>
                            <button onClick={() => setIsAddModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddSubmit} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Rank</label>
                                    <input className="w-full border p-2 rounded" value={addForm.rank} onChange={e => setAddForm({...addForm, rank: e.target.value})} placeholder="e.g. Sgt" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Role</label>
                                    <select className="w-full border p-2 rounded" value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value})}>
                                        <option value="Instructor">Instructor</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Commandant">Commandant</option>
                                        <option value="Assistant Commandant">Assistant Commandant</option>
                                        <option value="NSTP Director">NSTP Director</option>
                                        <option value="ROTC Coordinator">ROTC Coordinator</option>
                                        <option value="Admin NCO">Admin NCO</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">First Name *</label>
                                    <input required className="w-full border p-2 rounded" value={addForm.first_name} onChange={e => setAddForm({...addForm, first_name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                                    <input required className="w-full border p-2 rounded" value={addForm.last_name} onChange={e => setAddForm({...addForm, last_name: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                                    <input className="w-full border p-2 rounded" value={addForm.middle_name} onChange={e => setAddForm({...addForm, middle_name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Suffix</label>
                                    <input className="w-full border p-2 rounded" value={addForm.suffix_name} onChange={e => setAddForm({...addForm, suffix_name: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input type="email" className="w-full border p-2 rounded" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                                <input className="w-full border p-2 rounded" value={addForm.contact_number} onChange={e => setAddForm({...addForm, contact_number: e.target.value})} />
                            </div>
                            <div className="pt-2">
                                <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Add Staff</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
                                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                                    Edit Training Staff
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
                                <button
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
                            <div className="md:col-span-1 space-y-6">
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg shadow-inner text-center">
                                    <div className="relative inline-block">
                                        <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 mx-auto border-4 border-white dark:border-gray-600 shadow-lg">
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
                                                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-200">
                                                    <User size={64} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <h2 className="mt-4 text-xl font-bold text-gray-800 dark:text-white">
                                        {editForm.last_name || ''}, {editForm.first_name || ''}
                                    </h2>
                                    <p className="text-gray-500 dark:text-gray-300 font-medium">
                                        {editForm.rank || 'Training Staff'}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {editForm.role || 'Instructor'}
                                    </p>
                                </div>

                                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow border dark:border-gray-600 text-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MapPin size={16} className="text-green-700 dark:text-green-400" />
                                        <span className="font-semibold text-gray-800 dark:text-gray-100">Last Known Location</span>
                                    </div>
                                    {locationLoading && (
                                        <div className="text-gray-500 dark:text-gray-300">Loading location...</div>
                                    )}
                                    {!locationLoading && !locationInfo && (
                                        <div className="text-gray-500 dark:text-gray-300">
                                            No location data yet for this staff account.
                                        </div>
                                    )}
                                    {!locationLoading && locationInfo && Number.isFinite(locationInfo.last_latitude) && Number.isFinite(locationInfo.last_longitude) && (
                                        <div className="space-y-2">
                                            <div className="text-gray-800 dark:text-gray-100">
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

                            <div className="md:col-span-2 space-y-6 pb-4 sm:pb-6">
                                <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg border border-green-100 dark:border-green-800">
                                    <h4 className="font-bold text-green-800 dark:text-green-300 mb-4 text-sm uppercase tracking-wide">
                                        Profile Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rank</label>
                                            <select
                                                className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                value={editForm.rank}
                                                onChange={e => setEditForm({ ...editForm, rank: e.target.value })}
                                            >
                                                <option value="">Select Rank</option>
                                                {STAFF_RANK_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                                            <select
                                                className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                value={editForm.role}
                                                onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                            >
                                                <option value="Instructor">Instructor</option>
                                                <option value="Admin">Admin</option>
                                                <option value="Commandant">Commandant</option>
                                                <option value="Assistant Commandant">Assistant Commandant</option>
                                                <option value="NSTP Director">NSTP Director</option>
                                                <option value="ROTC Coordinator">ROTC Coordinator</option>
                                                <option value="Admin NCO">Admin NCO</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold mb-4 pb-2 border-b dark:border-gray-700 text-gray-800 dark:text-white">
                                        Personal Information
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                                                <input
                                                    required
                                                    className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                    value={editForm.first_name}
                                                    onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                                                <input
                                                    required
                                                    className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                    value={editForm.last_name}
                                                    onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Middle Name</label>
                                                <input
                                                    className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                    value={editForm.middle_name}
                                                    onChange={e => setEditForm({ ...editForm, middle_name: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Suffix</label>
                                                <input
                                                    className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                    value={editForm.suffix_name}
                                                    onChange={e => setEditForm({ ...editForm, suffix_name: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold mb-4 pb-2 border-b dark:border-gray-700 text-gray-800 dark:text-white">
                                        Account & Contact
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                    value={editForm.email}
                                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                                                <input
                                                    className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                    value={editForm.username}
                                                    onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Number</label>
                                            <input
                                                className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                value={editForm.contact_number}
                                                onChange={e => setEditForm({ ...editForm, contact_number: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

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

                                <div className="mt-4 pt-3 border-t dark:border-gray-700 md:hidden">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="w-full inline-flex items-center justify-center px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 text-sm font-medium"
                                    >
                                        <ChevronLeft size={16} className="mr-1" />
                                        Back to Staff List
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

export default TrainingStaffManagement;
