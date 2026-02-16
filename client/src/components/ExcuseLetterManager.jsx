import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, ExternalLink, Filter, Trash2, Download } from 'lucide-react';
import { cacheData, getCachedData } from '../utils/db';
import ResponsiveTable from './ResponsiveTable';

const ExcuseLetterManager = () => {
    const [letters, setLetters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchLetters();
    }, []);

    const fetchLetters = async () => {
        try {
            try {
                const cached = await getCachedData('excuse_letters');
                if (cached?.length) setLetters(cached);
            } catch {}
            const res = await axios.get('/api/excuse');
            setLetters(res.data);
            await cacheData('excuse_letters', res.data);
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

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this excuse letter? This action cannot be undone.')) return;
        try {
            await axios.delete(`/api/excuse/${id}`);
            setLetters(letters.filter(l => l.id !== id));
            // Update cache
            const newLetters = letters.filter(l => l.id !== id);
            await cacheData('excuse_letters', newLetters);
        } catch (err) {
            console.error(err);
            alert('Failed to delete excuse letter');
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

            <ResponsiveTable
                data={filteredLetters}
                columns={[
                    {
                        key: 'cadet',
                        label: 'Cadet',
                        render: (_, letter) => (
                            <span className="font-medium">
                                {letter.last_name}, {letter.first_name}
                            </span>
                        )
                    },
                    {
                        key: 'date_absent',
                        label: 'Date Absent',
                        render: (_, letter) => new Date(letter.date_absent).toLocaleDateString()
                    },
                    {
                        key: 'reason',
                        label: 'Reason',
                        render: (_, letter) => (
                            <div className="max-w-xs truncate" title={letter.reason}>
                                {letter.reason}
                            </div>
                        )
                    },
                    {
                        key: 'proof',
                        label: 'Proof',
                        render: (_, letter) => (
                            <div className="flex flex-col space-y-1">
                                <a 
                                    href={letter.file_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 hover:underline flex items-center"
                                >
                                    <ExternalLink size={14} className="mr-1" /> View
                                </a>
                                <a 
                                    href={letter.file_url} 
                                    download 
                                    className="text-green-700 hover:underline flex items-center text-xs"
                                >
                                    <Download size={12} className="mr-1" /> Download
                                </a>
                            </div>
                        )
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (_, letter) => (
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                letter.status === 'approved' ? 'bg-green-100 text-green-800' :
                                letter.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                                {letter.status}
                            </span>
                        )
                    }
                ]}
                loading={loading}
                emptyMessage="No excuse letters found."
                actions={[
                    ...(filteredLetters.some(l => l.status === 'pending') ? [
                        {
                            icon: CheckCircle,
                            label: 'Approve',
                            onClick: (letter) => handleUpdateStatus(letter.id, 'approved'),
                            className: 'text-green-600 hover:text-green-800 hover:bg-green-50'
                        },
                        {
                            icon: XCircle,
                            label: 'Reject',
                            onClick: (letter) => handleUpdateStatus(letter.id, 'rejected'),
                            className: 'text-red-600 hover:text-red-800 hover:bg-red-50'
                        }
                    ] : []),
                    {
                        icon: Trash2,
                        label: 'Delete',
                        onClick: (letter) => handleDelete(letter.id),
                        className: 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                    }
                ]}
                filterable={true}
                pagination={true}
                itemsPerPage={10}
                className="bg-white"
            />
        </div>
    );
};

export default ExcuseLetterManager;
