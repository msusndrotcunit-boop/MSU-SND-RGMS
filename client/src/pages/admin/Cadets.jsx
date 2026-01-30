import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, Trash2, X, FileDown, Upload, Plus, RefreshCw, PieChart as PieChartIcon, BarChart3, Key } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cacheData, getCachedData } from '../../utils/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

import { 
    CADET_COURSE_OPTIONS,
    COMPANY_OPTIONS
} from '../../constants/options';

const Cadets = () => {
    const [cadets, setCadets] = useState([]);
    const [selectedCadets, setSelectedCadets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentCadet, setCurrentCadet] = useState(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);
    const [passwordResetForm, setPasswordResetForm] = useState({ newPassword: '', confirmPassword: '' });

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

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        title: 'Cadet Master List',
        company: 'All',
        preparedBy: 'Admin',
        notedBy: 'Commandant'
    });

    // Get unique companies
    const companies = [...new Set(cadets.map(c => c.company).filter(Boolean))];

    // Analytics Data
    const getAnalyticsData = () => {
        // By Company
        const companyCount = {};
        cadets.forEach(c => {
            const company = c.company || 'Unknown';
            companyCount[company] = (companyCount[company] || 0) + 1;
        });
        const companyData = Object.keys(companyCount).map(key => ({
            name: key,
            count: companyCount[key]
        }));

        // By Rank
        const rankCount = {};
        cadets.forEach(c => {
            const rank = c.rank || 'Unknown';
            rankCount[rank] = (rankCount[rank] || 0) + 1;
        });
        const rankData = Object.keys(rankCount).map(key => ({
            name: key,
            count: rankCount[key]
        }));

        // By Status
        const statusCount = {};
        cadets.forEach(c => {
            const status = c.status || 'Unknown';
            statusCount[status] = (statusCount[status] || 0) + 1;
        });
        const statusData = Object.keys(statusCount).map(key => ({
            name: key,
            value: statusCount[key]
        }));

        return { companyData, rankData, statusData };
    };

    const { companyData, rankData, statusData } = getAnalyticsData();

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
            alert(res.data.message);
            fetchCadets();
        } catch (err) {
            console.error("Sync failed", err);
            alert(err.response?.data?.message || 'Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    const fetchCadets = async () => {
        try {
            const cachedCadets = await getCachedData('cadets');
            if (cachedCadets && cachedCadets.length > 0) {
                setCadets(cachedCadets);
                setLoading(false);
            }
        } catch (cacheErr) {
            console.warn("Failed to load from cache", cacheErr);
        }

        try {
            const res = await axios.get('/api/admin/cadets');
            setCadets(res.data);
            await cacheData('cadets', res.data);
            setLoading(false);
        } catch (err) {
            console.error("Network request failed", err);
            setLoading(false);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedCadets(cadets.map(c => c.id));
        } else {
            setSelectedCadets([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedCadets.includes(id)) {
            setSelectedCadets(selectedCadets.filter(cid => cid !== id));
        } else {
            setSelectedCadets([...selectedCadets, id]);
        }
    };

    const handleExportPDF = async () => {
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF();
            
            doc.setFontSize(18);
            doc.text(`MSU-SND ROTC UNIT - ${exportOptions.title}`, 14, 22);
            doc.setFontSize(11);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

            const tableColumn = ["Rank", "Name", "Username", "Unit", "Email", "Phone"];
            
            const tableRows = [];

            const filteredCadets = exportOptions.company === 'All' 
                ? cadets 
                : cadets.filter(c => c.company === exportOptions.company);

            filteredCadets.forEach(cadet => {
                const cadetData = [
                    cadet.rank,
                    `${cadet.last_name}, ${cadet.first_name}`,
                    cadet.username || cadet.student_id,
                    `${cadet.company || '-'}/${cadet.platoon || '-'}`,
                    cadet.email || '-',
                    cadet.contact_number || '-'
                ];
                tableRows.push(cadetData);
            });

            // Use explicit autoTable function
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 40,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [22, 163, 74] } 
            });

            doc.save('ROTC_Cadet_List.pdf');
        } catch (err) {
            console.error("PDF Export Error:", err);
            alert(`Failed to generate PDF: ${err.message}`);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedCadets.length} cadets? This action cannot be undone.`)) return;
        try {
            await axios.post('/api/admin/cadets/delete', { ids: selectedCadets });
            setCadets(cadets.filter(c => !selectedCadets.includes(c.id)));
            setSelectedCadets([]);
        } catch (err) {
            alert('Error deleting cadets');
        }
    };

    const openEditModal = (cadet) => {
        setCurrentCadet(cadet);
        setEditForm({
            rank: cadet.rank || '',
            firstName: cadet.first_name || '',
            middleName: cadet.middle_name || '',
            lastName: cadet.last_name || '',
            suffixName: cadet.suffix_name || '',
            username: cadet.username || cadet.student_id || '',
            email: cadet.email || '',
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

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`/api/admin/cadets/${currentCadet.id}`, editForm);
            fetchCadets();
            setIsEditModalOpen(false);
        } catch (err) {
            alert('Error updating cadet');
        }
    };

    const openPasswordResetModal = (cadet) => {
        setCurrentCadet(cadet);
        setPasswordResetForm({ newPassword: '', confirmPassword: '' });
        setIsPasswordResetModalOpen(true);
    };

    const handlePasswordResetSubmit = async (e) => {
        e.preventDefault();
        if (passwordResetForm.newPassword !== passwordResetForm.confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        try {
            await axios.post('/api/admin/reset-password', {
                type: 'cadet',
                id: currentCadet.id,
                newPassword: passwordResetForm.newPassword
            });
            alert('Password reset successfully');
            setIsPasswordResetModalOpen(false);
        } catch (err) {
            alert('Failed to reset password: ' + (err.response?.data?.message || err.message));
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
            
            // Check for errors in the response
            if (res.data.errors && res.data.errors.length > 0) {
                message += '\n\nErrors encountered:\n' + res.data.errors.join('\n');
            }
            
            alert(message);
            setIsImportModalOpen(false);
            setImportFile(null);
            setImportUrl('');
            fetchCadets();
            fetchSettings();
        } catch (err) {
            console.error(err);
            const status = err.response?.status;
            const isAuthError = status === 401 || status === 403 || err.message.includes('401') || err.message.includes('403');

            if (isAuthError) {
                alert('Session expired. Please log in again.');
                window.location.href = '/login';
            } else {
                alert('Import failed: ' + (err.response?.data?.message || err.message));
            }
        } finally {
            setImporting(false);
        }
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/admin/cadets', addForm);
            alert('Cadet added successfully');
            setIsAddModalOpen(false);
            fetchCadets();
            setAddForm({
                rank: '', firstName: '', middleName: '', lastName: '', suffixName: '',
                studentId: '', email: '', contactNumber: '', address: '',
                course: '', yearLevel: '', schoolYear: '',
                battalion: '', company: '', platoon: '',
                cadetCourse: '', semester: '', status: 'Ongoing'
            });
        } catch (err) {
            console.error(err);
            alert('Failed to add cadet: ' + (err.response?.data?.message || err.message));
        }
    };

    if (loading) return <div className="text-center p-10">Loading...</div>;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold">Cadet Management</h2>
                <div className="flex space-x-2 w-full md:w-auto">
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
                        <span>Add Cadet</span>
                    </button>
                    <button 
                        onClick={() => setIsExportModalOpen(true)}
                        className="flex-1 md:flex-none bg-green-700 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-green-800"
                    >
                        <FileDown size={18} />
                        <span>Export PDF</span>
                    </button>
                    {selectedCadets.length > 0 && (
                        <button 
                            onClick={handleBulkDelete}
                            className="flex-1 md:flex-none bg-red-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-red-700"
                        >
                            <Trash2 size={18} />
                            <span>Delete ({selectedCadets.length})</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded shadow overflow-auto max-h-[calc(100vh-200px)] relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr className="border-b shadow-sm">
                            <th className="p-4 w-10 bg-gray-100">
                                <input type="checkbox" onChange={handleSelectAll} checked={selectedCadets.length === cadets.length && cadets.length > 0} />
                            </th>
                            <th className="p-4 bg-gray-100">Name & Rank</th>
                            <th className="p-4 bg-gray-100">Username</th>
                            <th className="p-4 text-center bg-gray-100">Unit (Coy/Plt)</th>
                            <th className="p-4 text-center bg-gray-100">Status</th>
                            <th className="p-4 text-right bg-gray-100">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cadets.map(cadet => (
                            <tr key={cadet.id} className="border-b hover:bg-gray-50">
                                <td className="p-4">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedCadets.includes(cadet.id)}
                                        onChange={() => handleSelectOne(cadet.id)}
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
                                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                        cadet.status === 'Ongoing' ? 'bg-blue-100 text-blue-800' :
                                        cadet.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {cadet.status}
                                    </span>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button 
                                        onClick={() => openEditModal(cadet)}
                                        className="text-gray-600 hover:bg-gray-50 p-2 rounded"
                                        title="Edit Info"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button 
                                        onClick={() => openPasswordResetModal(cadet)}
                                        className="text-yellow-600 hover:bg-yellow-50 p-2 rounded"
                                        title="Reset Password"
                                    >
                                        <Key size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
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
                                    <p><strong>Excel/CSV:</strong> Required: "First Name", "Last Name". Optional: "Student ID", "Username", "Email".</p>
                                    <p><strong>PDF:</strong> Requires lines with "Student ID" (e.g., 2023-1234) and "Name". Email is optional.</p>
                                    <p><strong>Note:</strong> If Student ID is missing in Excel, it will be auto-generated. Login uses Username (defaults to Student ID) or Email.</p>
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
                                <input className="border p-2 rounded" value={addForm.rank} onChange={e => setAddForm({...addForm, rank: e.target.value})} placeholder="Rank" />
                                <input className="border p-2 rounded" required value={addForm.firstName} onChange={e => setAddForm({...addForm, firstName: e.target.value})} placeholder="First Name *" />
                                <input className="border p-2 rounded" value={addForm.middleName} onChange={e => setAddForm({...addForm, middleName: e.target.value})} placeholder="Middle Name" />
                                <input className="border p-2 rounded" required value={addForm.lastName} onChange={e => setAddForm({...addForm, lastName: e.target.value})} placeholder="Last Name *" />
                                <input className="border p-2 rounded" value={addForm.suffixName} onChange={e => setAddForm({...addForm, suffixName: e.target.value})} placeholder="Suffix" />
                                <input className="border p-2 rounded" required value={addForm.username} onChange={e => setAddForm({...addForm, username: e.target.value})} placeholder="Username *" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="border p-2 rounded" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} placeholder="Email" />
                                <input className="border p-2 rounded" value={addForm.contactNumber} onChange={e => setAddForm({...addForm, contactNumber: e.target.value})} placeholder="Contact Number" />
                            </div>

                            <input className="border p-2 rounded w-full" value={addForm.address} onChange={e => setAddForm({...addForm, address: e.target.value})} placeholder="Address" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="border p-2 rounded" value={addForm.course} onChange={e => setAddForm({...addForm, course: e.target.value})} placeholder="Course" />
                                <input className="border p-2 rounded" value={addForm.yearLevel} onChange={e => setAddForm({...addForm, yearLevel: e.target.value})} placeholder="Year Level" />
                                <input className="border p-2 rounded" value={addForm.schoolYear} onChange={e => setAddForm({...addForm, schoolYear: e.target.value})} placeholder="School Year" />
                                <input className="border p-2 rounded" value={addForm.semester} onChange={e => setAddForm({...addForm, semester: e.target.value})} placeholder="Semester" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input className="border p-2 rounded" value={addForm.battalion} onChange={e => setAddForm({...addForm, battalion: e.target.value})} placeholder="Battalion" />
                                <input className="border p-2 rounded" value={addForm.company} onChange={e => setAddForm({...addForm, company: e.target.value})} placeholder="Company" />
                                <input className="border p-2 rounded" value={addForm.platoon} onChange={e => setAddForm({...addForm, platoon: e.target.value})} placeholder="Platoon" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select className="border p-2 rounded" value={addForm.cadetCourse} onChange={e => setAddForm({...addForm, cadetCourse: e.target.value})}>
                                    <option value="">Select Cadet Course</option>
                                    {CADET_COURSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <input className="border p-2 rounded" value={addForm.status} onChange={e => setAddForm({...addForm, status: e.target.value})} placeholder="Status" />
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


            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-lg mx-4 p-6 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Edit Cadet Info</h3>
                            <button onClick={() => setIsEditModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-4 overflow-y-auto pr-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input className="border p-2 rounded" value={editForm.rank} onChange={e => setEditForm({...editForm, rank: e.target.value})} placeholder="Rank" />
                                <input className="border p-2 rounded" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} placeholder="First Name" />
                                <input className="border p-2 rounded" value={editForm.middleName} onChange={e => setEditForm({...editForm, middleName: e.target.value})} placeholder="Middle Name" />
                                <input className="border p-2 rounded" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} placeholder="Last Name" />
                                <input className="border p-2 rounded" value={editForm.suffixName} onChange={e => setEditForm({...editForm, suffixName: e.target.value})} placeholder="Suffix" />
                                <input className="border p-2 rounded" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} placeholder="Username" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="border p-2 rounded" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} placeholder="Email" />
                                <input className="border p-2 rounded" value={editForm.contactNumber} onChange={e => setEditForm({...editForm, contactNumber: e.target.value})} placeholder="Contact Number" />
                            </div>

                            <input className="border p-2 rounded w-full" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} placeholder="Address" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select className="border p-2 rounded" value={editForm.course} onChange={e => setEditForm({...editForm, course: e.target.value})}>
                                    <option value="">Select Course</option>
                                    {['BSCS', 'BSIT', 'BSCrim', 'BEEd', 'BSEd', 'BSHM', 'BSTM', 'BSBA', 'BSN', 'Other'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <select className="border p-2 rounded" value={editForm.yearLevel} onChange={e => setEditForm({...editForm, yearLevel: e.target.value})}>
                                    <option value="">Select Year Level</option>
                                    {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <select className="border p-2 rounded" value={editForm.battalion} onChange={e => setEditForm({...editForm, battalion: e.target.value})}>
                                    <option value="">Select BN</option>
                                    <option value="1st BN">1st BN</option>
                                </select>
                                <select className="border p-2 rounded" value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})}>
                                    <option value="">Select Coy</option>
                                    {COMPANY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <select className="border p-2 rounded" value={editForm.platoon} onChange={e => setEditForm({...editForm, platoon: e.target.value})}>
                                    <option value="">Select Platoon</option>
                                    {['1st PLT', '2nd PLT', '3rd PLT'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <select className="border p-2 rounded" value={editForm.cadetCourse} onChange={e => setEditForm({...editForm, cadetCourse: e.target.value})}>
                                    <option value="">Select Cadet Course</option>
                                    {CADET_COURSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <select className="border p-2 rounded" value={editForm.semester} onChange={e => setEditForm({...editForm, semester: e.target.value})}>
                                    <option value="">Select Sem</option>
                                    <option value="1st Semester">1st Semester</option>
                                    <option value="2nd Semester">2nd Semester</option>
                                    <option value="Summer">Summer</option>
                                </select>
                                <select className="border p-2 rounded" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Dropped">Dropped</option>
                                </select>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Update Cadet</button>
                        </form>
                    </div>
                </div>
            )}
            {/* Password Reset Modal */}
            {isPasswordResetModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Reset Password</h3>
                            <button onClick={() => setIsPasswordResetModalOpen(false)}><X size={20} /></button>
                        </div>
                        <p className="mb-4 text-sm text-gray-600">
                            Resetting password for <strong>{currentCadet?.last_name}, {currentCadet?.first_name}</strong>
                        </p>
                        <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">New Password</label>
                                <input 
                                    type="password" 
                                    required 
                                    className="w-full border p-2 rounded"
                                    value={passwordResetForm.newPassword}
                                    onChange={e => setPasswordResetForm({...passwordResetForm, newPassword: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                <input 
                                    type="password" 
                                    required 
                                    className="w-full border p-2 rounded"
                                    value={passwordResetForm.confirmPassword}
                                    onChange={e => setPasswordResetForm({...passwordResetForm, confirmPassword: e.target.value})}
                                />
                            </div>
                            <button type="submit" className="w-full bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700">
                                Update Password
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cadets;
