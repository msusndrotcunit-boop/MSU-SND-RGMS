import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, Trash2, X, FileDown, Upload, Plus } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cacheData, getCachedData } from '../../utils/db';

const Cadets = () => {
    const [cadets, setCadets] = useState([]);
    const [selectedCadets, setSelectedCadets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentCadet, setCurrentCadet] = useState(null);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);

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

    useEffect(() => {
        fetchCadets();
    }, []);

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

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF();
            
            doc.setFontSize(18);
            doc.text(`MSU-SND ROTC UNIT - ${exportOptions.title}`, 14, 22);
            doc.setFontSize(11);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

            const tableColumn = ["Rank", "Name", "Student ID", "Unit", "Email", "Phone"];
            
            const tableRows = [];

            const filteredCadets = exportOptions.company === 'All' 
                ? cadets 
                : cadets.filter(c => c.company === exportOptions.company);

            filteredCadets.forEach(cadet => {
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
            studentId: cadet.student_id || '',
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

    if (loading) return <div className="text-center p-10">Loading...</div>;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold">Cadet Management</h2>
                <div className="flex space-x-2 w-full md:w-auto">
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
                                <td className="p-4 text-right space-x-2">
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
                                <input className="border p-2 rounded" required value={addForm.studentId} onChange={e => setAddForm({...addForm, studentId: e.target.value})} placeholder="Student ID *" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="border p-2 rounded" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} placeholder="Email (Login Username)" />
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

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Import Cadet List</h3>
                            <button onClick={() => setIsImportModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="text-sm text-gray-600 mb-4 space-y-2">
                            <p>Upload the official list of cadets from ROTCMIS.</p>
                            <p><b>Supported Format:</b> Excel (.xlsx, .xls) or CSV</p>
                            <p className="text-xs italic text-gray-500">
                                This will automatically create user accounts for new cadets and update existing information. 
                                Cadets can login using their Student ID or Email.
                            </p>
                        </div>
                        <form onSubmit={handleImport} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
                                <input 
                                    type="file" 
                                    accept=".csv, .xlsx, .xls"
                                    required
                                    className="w-full border p-2 rounded"
                                    onChange={e => setImportFile(e.target.files[0])}
                                />
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="flex-1 py-2 border rounded hover:bg-gray-50"
                                    disabled={importing}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex justify-center items-center"
                                    disabled={importing}
                                >
                                    {importing ? 'Importing...' : 'Import List'}
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
                                <input className="border p-2 rounded" value={editForm.studentId} onChange={e => setEditForm({...editForm, studentId: e.target.value})} placeholder="Student ID" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="border p-2 rounded" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} placeholder="Email" />
                                <input className="border p-2 rounded" value={editForm.contactNumber} onChange={e => setEditForm({...editForm, contactNumber: e.target.value})} placeholder="Contact Number" />
                            </div>

                            <input className="border p-2 rounded w-full" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} placeholder="Address" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="border p-2 rounded" value={editForm.course} onChange={e => setEditForm({...editForm, course: e.target.value})} placeholder="Course" />
                                <input className="border p-2 rounded" value={editForm.yearLevel} onChange={e => setEditForm({...editForm, yearLevel: e.target.value})} placeholder="Year Level" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input className="border p-2 rounded" value={editForm.battalion} onChange={e => setEditForm({...editForm, battalion: e.target.value})} placeholder="Battalion" />
                                <input className="border p-2 rounded" value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} placeholder="Company" />
                                <input className="border p-2 rounded" value={editForm.platoon} onChange={e => setEditForm({...editForm, platoon: e.target.value})} placeholder="Platoon" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <select className="border p-2 rounded" value={editForm.cadetCourse} onChange={e => setEditForm({...editForm, cadetCourse: e.target.value})}>
                                    <option value="MS1">MS1</option>
                                    <option value="MS2">MS2</option>
                                    <option value="MS3">MS3</option>
                                    <option value="MS4">MS4</option>
                                </select>
                                <input className="border p-2 rounded" value={editForm.semester} onChange={e => setEditForm({...editForm, semester: e.target.value})} placeholder="Semester" />
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
        </div>
    );
};

export default Cadets;
