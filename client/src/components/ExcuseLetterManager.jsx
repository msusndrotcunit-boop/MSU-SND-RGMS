import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, ExternalLink, Filter } from 'lucide-react';

const ExcuseLetterManager = () => {
    const [letters, setLetters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchLetters();
    }, []);

    const fetchLetters = async () => {
        try {
            const res = await axios.get('/api/excuse');
            setLetters(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id, status) => {
        if (!window.confirm(`Are you sure you want to mark this as ${status}?`)) return;
        try {
            await axios.put(`/api/excuse/${id}`, { status });
            fetchLetters();
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const filteredLetters = letters.filter(l => 
        filterStatus === 'all' ? true : l.status === filterStatus
    );

    if (loading) return <div>Loading excuse letters...</div>;

    return (
        <div className="bg-white p-6 rounded shadow">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Excuse Letter Review</h2>
                <div className="flex items-center space-x-2">
                    <Filter size={16} className="text-gray-500" />
                    <select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border rounded p-1 text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-gray-100 border-b">
                            <th className="p-3">Cadet</th>
                            <th className="p-3">Date Absent</th>
                            <th className="p-3">Reason</th>
                            <th className="p-3">Proof</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLetters.length > 0 ? filteredLetters.map(letter => (
                            <tr key={letter.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">
                                    {letter.last_name}, {letter.first_name}
                                </td>
                                <td className="p-3">{new Date(letter.date_absent).toLocaleDateString()}</td>
                                <td className="p-3 max-w-xs truncate" title={letter.reason}>{letter.reason}</td>
                                <td className="p-3">
                                    <a href={letter.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                                        <ExternalLink size={14} className="mr-1" /> View
                                    </a>
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                        letter.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        letter.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {letter.status}
                                    </span>
                                </td>
                                <td className="p-3 space-x-2">
                                    {letter.status === 'pending' && (
                                        <>
                                            <button 
                                                onClick={() => handleUpdateStatus(letter.id, 'approved')}
                                                className="text-green-600 hover:text-green-800"
                                                title="Approve"
                                            >
                                                <CheckCircle size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleUpdateStatus(letter.id, 'rejected')}
                                                className="text-red-600 hover:text-red-800"
                                                title="Reject"
                                            >
                                                <XCircle size={18} />
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="6" className="p-4 text-center text-gray-500">No excuse letters found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ExcuseLetterManager;