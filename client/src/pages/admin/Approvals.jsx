import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Check, X } from 'lucide-react';

const Approvals = () => {
    const { token } = useAuth();
    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetchPendingUsers();
    }, []);

    const fetchPendingUsers = async () => {
        try {
            const response = await axios.get('/api/admin/users?pending=true', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleApprove = async (id) => {
        try {
            await axios.put(`/api/admin/users/${id}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPendingUsers();
        } catch (error) {
            console.error('Error approving user:', error);
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm('Are you sure you want to reject and delete this user?')) return;
        try {
            await axios.delete(`/api/admin/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPendingUsers();
        } catch (error) {
            console.error('Error rejecting user:', error);
        }
    };

    return (
        <div className="bg-white rounded shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Pending Approvals</h2>
                <button 
                    onClick={fetchPendingUsers}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm flex items-center gap-2"
                >
                    Refresh List
                </button>
            </div>
            {users.length === 0 ? (
                <p className="text-gray-500">No pending approvals.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-b">
                                <th className="p-3">Name</th>
                                <th className="p-3">Username</th>
                                <th className="p-3">Email</th>
                                <th className="p-3">Student ID</th>
                                <th className="p-3">Role</th>
                                <th className="p-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3">
                                        {user.first_name ? `${user.first_name} ${user.last_name}` : 'N/A'}
                                    </td>
                                    <td className="p-3">{user.username}</td>
                                    <td className="p-3">{user.email || 'N/A'}</td>
                                    <td className="p-3">{user.student_id || 'N/A'}</td>
                                    <td className="p-3 capitalize">
                                        {user.role}
                                        {user.is_approved === 1 && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Approved</span>}
                                        {user.is_approved === 0 && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Pending</span>}
                                    </td>
                                    <td className="p-3 flex space-x-2">
                                        {user.is_approved === 0 && (
                                            <button 
                                                onClick={() => handleApprove(user.id)}
                                                className="bg-green-600 text-white p-2 rounded hover:bg-green-700"
                                                title="Approve"
                                            >
                                                <Check size={16} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleReject(user.id)}
                                            className="bg-red-600 text-white p-2 rounded hover:bg-red-700"
                                            title="Reject / Delete"
                                        >
                                            <X size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Approvals;
