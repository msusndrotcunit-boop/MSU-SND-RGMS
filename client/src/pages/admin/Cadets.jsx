import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, Trash2, GraduationCap, Save, X, FileDown, ShieldAlert } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cacheData, getCachedData } from '../../utils/db';

const Cadets = () => {
    const [cadets, setCadets] = useState([]);
    const [selectedCadets, setSelectedCadets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
    const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
    const [currentCadet, setCurrentCadet] = useState(null);
    const [ledgerLogs, setLedgerLogs] = useState([]);

    // Form States
    const [editForm, setEditForm] = useState({});
    const [gradeForm, setGradeForm] = useState({});
    const [ledgerForm, setLedgerForm] = useState({ type: 'merit', points: 0, reason: '' });

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        title: 'Summary of Grades',
        company: 'All',
        preparedBy: 'Admin',
        notedBy: 'Commandant'
    });

    // Get unique companies
    const companies = [...new Set(cadets.map(c => c.company).filter(Boolean))];

    useEffect(() => {
        fetchCadets();
    }, []);

    const fetchCadets = async () => {
        // 1. Load from Cache first (Instant load)
        try {
            const cachedCadets = await getCachedData('cadets');
            if (cachedCadets && cachedCadets.length > 0) {
                setCadets(cachedCadets);
                setLoading(false);
            }
        } catch (cacheErr) {
            console.warn("Failed to load from cache", cacheErr);
        }

        // 2. Fetch from Network (Background sync)
        try {
            const res = await axios.get('/api/admin/cadets');
            setCadets(res.data);
            await cacheData('cadets', res.data);
            setLoading(false);
        } catch (err) {
            console.error("Network request failed", err);
            // If cache was empty and network failed, stop loading
            setLoading(false);
        }
    };

    // Bulk Selection
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

    // PDF Export
    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        // Add Header
        doc.setFontSize(18);
        doc.text('MSU-SND ROTC UNIT - Summary of Grades', 14, 22);
        doc.setFontSize(11);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

        // Define columns
        const tableColumn = ["Rank", "Name", "Student ID", "Unit", "Final", "Transmuted", "Remarks"];
        
        // Define rows
        const tableRows = [];

        cadets.forEach(cadet => {
            const cadetData = [
                cadet.rank,
                `${cadet.last_name}, ${cadet.first_name}`,
                cadet.student_id,
                `${cadet.company || '-'}/${cadet.platoon || '-'}`,
                cadet.finalGrade ? cadet.finalGrade.toFixed(2) : '0.00',
                cadet.transmutedGrade || '-',
                cadet.remarks || '-'
            ];
            tableRows.push(cadetData);
        });

        // Generate table
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [22, 163, 74] } // Military green
        });

        doc.save('ROTC_Summary_of_Grades.pdf');
    };

    // Bulk Delete
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

    // Edit Cadet
    const openEditModal = (cadet) => {
        setCurrentCadet(cadet);
        setEditForm({
            firstName: cadet.first_name,
            lastName: cadet.last_name,
            studentId: cadet.student_id,
            email: cadet.email,
            phone: cadet.phone,
            platoon: cadet.platoon
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

    // Grading
    const openGradeModal = (cadet) => {
        setCurrentCadet(cadet);
        setGradeForm({
            attendancePresent: cadet.attendance_present || 0,
            meritPoints: cadet.merit_points || 0,
            demeritPoints: cadet.demerit_points || 0,
            prelimScore: cadet.prelim_score || 0,
            midtermScore: cadet.midterm_score || 0,
            finalScore: cadet.final_score || 0,
            status: cadet.status || 'active'
        });
        setIsGradeModalOpen(true);
    };

    const handleGradeSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`/api/admin/grades/${currentCadet.id}`, gradeForm);
            fetchCadets();
            setIsGradeModalOpen(false);
        } catch (err) {
            alert('Error updating grades');
        }
    };

    // Merit/Demerit Ledger
    const openLedgerModal = async (cadet) => {
        setCurrentCadet(cadet);
        setLedgerForm({ type: 'merit', points: 0, reason: '' });
        try {
            const res = await axios.get(`/api/admin/merit-logs/${cadet.id}`);
            setLedgerLogs(res.data);
            setIsLedgerModalOpen(true);
        } catch (err) {
            alert('Error fetching logs');
        }
    };

    const handleLedgerSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/admin/merit-logs', {
                cadetId: currentCadet.id,
                ...ledgerForm
            });
            // Refresh logs
            const res = await axios.get(`/api/admin/merit-logs/${currentCadet.id}`);
            setLedgerLogs(res.data);
            // Refresh main list (to update total points)
            fetchCadets();
            // Reset form
            setLedgerForm({ type: 'merit', points: 0, reason: '' });
        } catch (err) {
            alert('Error adding log');
        }
    };

    if (loading) return <div className="text-center p-10">Loading...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Cadet Management</h2>
                <div className="flex space-x-2">
                    <button 
                        onClick={handleExportPDF}
                        className="bg-green-700 text-white px-4 py-2 rounded flex items-center space-x-2 hover:bg-green-800"
                    >
                        <FileDown size={18} />
                        <span>Export PDF</span>
                    </button>
                    {selectedCadets.length > 0 && (
                        <button 
                            onClick={handleBulkDelete}
                            className="bg-red-600 text-white px-4 py-2 rounded flex items-center space-x-2 hover:bg-red-700"
                        >
                            <Trash2 size={18} />
                            <span>Delete ({selectedCadets.length})</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded shadow overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b">
                            <th className="p-4 w-10">
                                <input type="checkbox" onChange={handleSelectAll} checked={selectedCadets.length === cadets.length && cadets.length > 0} />
                            </th>
                            <th className="p-4">Name & Rank</th>
                            <th className="p-4">Student ID</th>
                            <th className="p-4 text-center">Unit (Coy/Plt)</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-center">Final</th>
                            <th className="p-4 text-center">Transmuted</th>
                            <th className="p-4 text-center">Remarks</th>
                            <th className="p-4 text-right">Actions</th>
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
                                <td className="p-4">{cadet.student_id}</td>
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
                                <td className="p-4 text-center">
                                    {cadet.finalGrade.toFixed(2)}
                                </td>
                                <td className="p-4 text-center font-bold">
                                    {cadet.transmutedGrade}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-sm font-semibold ${
                                        cadet.transmutedGrade === '5.00' || ['DO', 'INC'].includes(cadet.transmutedGrade) 
                                        ? 'bg-red-100 text-red-800' 
                                        : 'bg-green-100 text-green-800'
                                    }`}>
                                        {cadet.remarks}
                                    </span>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button 
                                        onClick={() => openGradeModal(cadet)}
                                        className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                                        title="Manage Grades"
                                    >
                                        <GraduationCap size={18} />
                                    </button>
                                    <button 
                                        onClick={() => openLedgerModal(cadet)}
                                        className="text-purple-600 hover:bg-purple-50 p-2 rounded"
                                        title="Merit/Demerit Ledger"
                                    >
                                        <ShieldAlert size={18} />
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

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Edit Cadet Info</h3>
                            <button onClick={() => setIsEditModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                            <div className="grid grid-cols-3 gap-4">
                                <input className="border p-2 rounded" value={editForm.rank} onChange={e => setEditForm({...editForm, rank: e.target.value})} placeholder="Rank" />
                                <input className="border p-2 rounded" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} placeholder="First Name" />
                                <input className="border p-2 rounded" value={editForm.middleName} onChange={e => setEditForm({...editForm, middleName: e.target.value})} placeholder="Middle Name" />
                                <input className="border p-2 rounded" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} placeholder="Last Name" />
                                <input className="border p-2 rounded" value={editForm.suffixName} onChange={e => setEditForm({...editForm, suffixName: e.target.value})} placeholder="Suffix" />
                                <input className="border p-2 rounded" value={editForm.studentId} onChange={e => setEditForm({...editForm, studentId: e.target.value})} placeholder="Student ID" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <input className="border p-2 rounded" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} placeholder="Email" />
                                <input className="border p-2 rounded" value={editForm.contactNumber} onChange={e => setEditForm({...editForm, contactNumber: e.target.value})} placeholder="Contact Number" />
                            </div>

                            <textarea className="w-full border p-2 rounded" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} placeholder="Address" rows="2"></textarea>

                            <div className="grid grid-cols-3 gap-4">
                                <input className="border p-2 rounded" value={editForm.course} onChange={e => setEditForm({...editForm, course: e.target.value})} placeholder="Course" />
                                <input className="border p-2 rounded" value={editForm.yearLevel} onChange={e => setEditForm({...editForm, yearLevel: e.target.value})} placeholder="Year Level" />
                                <input className="border p-2 rounded" value={editForm.schoolYear} onChange={e => setEditForm({...editForm, schoolYear: e.target.value})} placeholder="School Year" />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <input className="border p-2 rounded" value={editForm.battalion} onChange={e => setEditForm({...editForm, battalion: e.target.value})} placeholder="Battalion" />
                                <input className="border p-2 rounded" value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} placeholder="Company" />
                                <input className="border p-2 rounded" value={editForm.platoon} onChange={e => setEditForm({...editForm, platoon: e.target.value})} placeholder="Platoon" />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <select className="border p-2 rounded" value={editForm.cadetCourse} onChange={e => setEditForm({...editForm, cadetCourse: e.target.value})}>
                                    <option value="">Select Course</option>
                                    <option value="MS1">MS1</option>
                                    <option value="MS2">MS2</option>
                                    <option value="COQC">COQC</option>
                                    <option value="MS31">MS31</option>
                                    <option value="MS32">MS32</option>
                                    <option value="MS41">MS41</option>
                                    <option value="MS42">MS42</option>
                                </select>
                                <input className="border p-2 rounded" value={editForm.semester} onChange={e => setEditForm({...editForm, semester: e.target.value})} placeholder="Semester" />
                                <select className="border p-2 rounded" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Incomplete">Incomplete</option>
                                    <option value="Drop">Drop</option>
                                    <option value="Failed">Failed</option>
                                    <option value="Transferred">Transferred</option>
                                </select>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Save Changes</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Grading Modal */}
            {isGradeModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Grading Management: {currentCadet?.last_name}</h3>
                            <button onClick={() => setIsGradeModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleGradeSubmit} className="space-y-6">
                            
                            {/* Status */}
                            <div className="bg-gray-100 p-4 rounded">
                                <h4 className="font-semibold text-gray-800 mb-2">Cadet Status</h4>
                                <select 
                                    className="w-full border p-2 rounded"
                                    value={gradeForm.status}
                                    onChange={e => setGradeForm({...gradeForm, status: e.target.value})}
                                >
                                    <option value="active">Active (Standard Grading)</option>
                                    <option value="DO">Drop Officially (DO)</option>
                                    <option value="INC">Incomplete (INC)</option>
                                    <option value="T">Transfer (T)</option>
                                </select>
                            </div>

                            {/* Attendance */}
                            <div className="bg-blue-50 p-4 rounded">
                                <h4 className="font-semibold text-blue-800 mb-2">Attendance (30%)</h4>
                                <div className="flex items-center space-x-4">
                                    <label className="text-sm">Days Present:</label>
                                    <input 
                                        type="number" 
                                        max="15"
                                        className="border p-2 rounded w-24" 
                                        value={gradeForm.attendancePresent} 
                                        onChange={e => setGradeForm({...gradeForm, attendancePresent: parseInt(e.target.value) || 0})} 
                                    />
                                    <span className="text-sm text-gray-500">/ 15 Training Days</span>
                                </div>
                            </div>

                            {/* Aptitude */}
                            <div className="bg-green-50 p-4 rounded">
                                <h4 className="font-semibold text-green-800 mb-2">Military Aptitude (30%)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm mb-1">Merit Points</label>
                                        <input 
                                            type="number" 
                                            className="border p-2 rounded w-full" 
                                            value={gradeForm.meritPoints} 
                                            onChange={e => setGradeForm({...gradeForm, meritPoints: parseInt(e.target.value) || 0})} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">Demerit Points</label>
                                        <input 
                                            type="number" 
                                            className="border p-2 rounded w-full" 
                                            value={gradeForm.demeritPoints} 
                                            onChange={e => setGradeForm({...gradeForm, demeritPoints: parseInt(e.target.value) || 0})} 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Subject Proficiency */}
                            <div className="bg-yellow-50 p-4 rounded">
                                <h4 className="font-semibold text-yellow-800 mb-2">Subject Proficiency (40%)</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm mb-1">Prelim</label>
                                        <input 
                                            type="number" 
                                            max="100"
                                            className="border p-2 rounded w-full" 
                                            value={gradeForm.prelimScore} 
                                            onChange={e => setGradeForm({...gradeForm, prelimScore: parseInt(e.target.value) || 0})} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">Midterm</label>
                                        <input 
                                            type="number" 
                                            max="100"
                                            className="border p-2 rounded w-full" 
                                            value={gradeForm.midtermScore} 
                                            onChange={e => setGradeForm({...gradeForm, midtermScore: parseInt(e.target.value) || 0})} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">Final</label>
                                        <input 
                                            type="number" 
                                            max="100"
                                            className="border p-2 rounded w-full" 
                                            value={gradeForm.finalScore} 
                                            onChange={e => setGradeForm({...gradeForm, finalScore: parseInt(e.target.value) || 0})} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Save Grades</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Ledger Modal */}
            {isLedgerModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Merit/Demerit Ledger: {currentCadet?.last_name}</h3>
                            <button onClick={() => setIsLedgerModalOpen(false)}><X size={20} /></button>
                        </div>
                        
                        <div className="mb-6 grid grid-cols-2 gap-4">
                             <div className="bg-green-100 p-4 rounded text-center">
                                 <h4 className="text-green-800 font-bold text-xl">{currentCadet?.merit_points || 0}</h4>
                                 <span className="text-xs uppercase font-semibold text-green-600">Total Merits</span>
                             </div>
                             <div className="bg-red-100 p-4 rounded text-center">
                                 <h4 className="text-red-800 font-bold text-xl">{currentCadet?.demerit_points || 0}</h4>
                                 <span className="text-xs uppercase font-semibold text-red-600">Total Demerits</span>
                             </div>
                        </div>

                        <form onSubmit={handleLedgerSubmit} className="bg-gray-50 p-4 rounded mb-6 border">
                            <h4 className="font-semibold mb-2">Add New Entry</h4>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                                <select 
                                    className="border p-2 rounded"
                                    value={ledgerForm.type}
                                    onChange={e => setLedgerForm({...ledgerForm, type: e.target.value})}
                                >
                                    <option value="merit">Merit</option>
                                    <option value="demerit">Demerit</option>
                                </select>
                                <input 
                                    type="number" 
                                    placeholder="Points" 
                                    className="border p-2 rounded"
                                    value={ledgerForm.points}
                                    onChange={e => setLedgerForm({...ledgerForm, points: parseInt(e.target.value) || 0})}
                                    required
                                />
                                <input 
                                    type="text" 
                                    placeholder="Reason / Violation" 
                                    className="border p-2 rounded"
                                    value={ledgerForm.reason}
                                    onChange={e => setLedgerForm({...ledgerForm, reason: e.target.value})}
                                    required
                                />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-1 rounded text-sm">Add Entry</button>
                        </form>

                        <h4 className="font-bold mb-2">History</h4>
                        <div className="overflow-y-auto max-h-60 border rounded">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="p-2">Date</th>
                                        <th className="p-2">Type</th>
                                        <th className="p-2">Points</th>
                                        <th className="p-2">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledgerLogs.length === 0 ? (
                                        <tr><td colSpan="4" className="p-4 text-center text-gray-500">No records found</td></tr>
                                    ) : (
                                        ledgerLogs.map(log => (
                                            <tr key={log.id} className="border-b">
                                                <td className="p-2 text-gray-500">{new Date(log.date_recorded).toLocaleDateString()}</td>
                                                <td className="p-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                        log.type === 'merit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {log.type.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="p-2 font-bold">{log.points}</td>
                                                <td className="p-2">{log.reason}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cadets;
