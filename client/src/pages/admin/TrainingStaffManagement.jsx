import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, Trash2, X, Upload, Plus, UserCog, Key } from 'lucide-react';

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
        email: '', contact_number: '', role: 'Instructor', username: ''
    });
    const [editForm, setEditForm] = useState({});

    // Password Reset State
    const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);
    const [passwordResetForm, setPasswordResetForm] = useState({ newPassword: '', confirmPassword: '' });

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            const res = await axios.get('/api/staff');
            if (Array.isArray(res.data)) {
                setStaffList(res.data);
            } else {
                console.error("API returned non-array:", res.data);
                setStaffList([]);
                // alert("Error loading staff list: Invalid data format");
            }
            setLoading(false);
        } catch (err) {
            console.error("Network request failed", err);
            setLoading(false);
            setStaffList([]); 
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
            
            alert(message);
            setIsImportModalOpen(false);
            setImportFile(null);
            fetchStaff();
        } catch (err) {
            console.error(err);
            alert('Import failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setImporting(false);
        }
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/staff', addForm);
            alert('Staff added successfully');
            setIsAddModalOpen(false);
            fetchStaff();
            setAddForm({
                rank: '', first_name: '', middle_name: '', last_name: '', suffix_name: '',
                email: '', contact_number: '', role: 'Instructor', username: ''
            });
        } catch (err) {
            console.error(err);
            alert('Failed to add staff: ' + (err.response?.data?.message || err.message));
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
            contact_number: staff.contact_number || '',
            role: staff.role || 'Instructor',
            username: staff.username || ''
        });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`/api/staff/${currentStaff.id}`, editForm);
            fetchStaff();
            setIsEditModalOpen(false);
            alert('Staff updated successfully');
        } catch (err) {
            alert('Error updating staff: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this staff member?')) return;
        try {
            await axios.delete(`/api/staff/${id}`);
            setStaffList(staffList.filter(s => s.id !== id));
        } catch (err) {
            alert('Error deleting staff: ' + (err.response?.data?.message || err.message));
        }
    };

    const openPasswordResetModal = (staff) => {
        setCurrentStaff(staff);
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
                type: 'staff',
                id: currentStaff.id,
                newPassword: passwordResetForm.newPassword
            });
            alert('Password reset successfully');
            setIsPasswordResetModalOpen(false);
        } catch (err) {
            alert('Failed to reset password: ' + (err.response?.data?.message || err.message));
        }
    };

    if (loading) return <div className="text-center p-10">Loading...</div>;

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

            <div className="bg-white rounded shadow overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                        <tr className="border-b shadow-sm">
                            <th className="p-4 bg-gray-100">Name & Rank</th>
                            <th className="p-4 bg-gray-100">Role</th>
                            <th className="p-4 bg-gray-100">Contact</th>
                            <th className="p-4 text-right bg-gray-100">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffList.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="p-8 text-center text-gray-500">
                                    No training staff found. Import or add one.
                                </td>
                            </tr>
                        ) : (
                            staffList.map(staff => (
                                <tr key={staff.id} className="border-b hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="font-medium">
                                            <span className="font-bold text-blue-900 mr-1">{staff.rank}</span>
                                            {staff.last_name}, {staff.first_name} {staff.middle_name} {staff.suffix_name}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded">
                                            {staff.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm">
                                        <div className="text-gray-900">{staff.email || '-'}</div>
                                        <div className="text-gray-500">{staff.contact_number || '-'}</div>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button 
                                            onClick={() => openEditModal(staff)}
                                            className="text-gray-600 hover:bg-gray-100 p-2 rounded"
                                            title="Edit Info"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button 
                                            onClick={() => openPasswordResetModal(staff)}
                                            className="text-yellow-600 hover:bg-yellow-50 p-2 rounded"
                                            title="Reset Password"
                                        >
                                            <Key size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(staff.id)}
                                            className="text-red-600 hover:bg-red-50 p-2 rounded"
                                            title="Delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

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

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Edit Staff</h3>
                            <button onClick={() => setIsEditModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Rank</label>
                                    <input className="w-full border p-2 rounded" value={editForm.rank} onChange={e => setEditForm({...editForm, rank: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Username</label>
                                    <input className="w-full border p-2 rounded" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} placeholder="Username" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Role</label>
                                <select className="w-full border p-2 rounded" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}>
                                    <option value="Instructor">Instructor</option>
                                    <option value="Admin">Admin</option>
                                    <option value="Commandant">Commandant</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">First Name *</label>
                                    <input required className="w-full border p-2 rounded" value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                                    <input required className="w-full border p-2 rounded" value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                                    <input className="w-full border p-2 rounded" value={editForm.middle_name} onChange={e => setEditForm({...editForm, middle_name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Suffix</label>
                                    <input className="w-full border p-2 rounded" value={editForm.suffix_name} onChange={e => setEditForm({...editForm, suffix_name: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input type="email" className="w-full border p-2 rounded" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                                <input className="w-full border p-2 rounded" value={editForm.contact_number} onChange={e => setEditForm({...editForm, contact_number: e.target.value})} />
                            </div>
                            <div className="pt-2">
                                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Save Changes</button>
                            </div>
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
                            Resetting password for <strong>{currentStaff?.last_name}, {currentStaff?.first_name}</strong>
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

export default TrainingStaffManagement;