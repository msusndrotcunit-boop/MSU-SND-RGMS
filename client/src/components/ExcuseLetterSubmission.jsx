import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader2, Upload, FileText, CheckCircle, ExternalLink, Download } from 'lucide-react';
import ResponsiveTable from '../ResponsiveTable';

const ExcuseLetterSubmission = ({ onSubmitted }) => {
    const [file, setFile] = useState(null);
    const [date, setDate] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [history, setHistory] = useState([]);
    const [showUploadConsent, setShowUploadConsent] = useState(false);
    const fileInputRef = useRef(null);
    const ORIGINAL_ACCEPT = "image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get('/api/excuse');
            setHistory(res.data);
        } catch (err) {
            console.error("Failed to fetch excuse history", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file || !date || !reason) {
            setError('Please fill in all fields and upload a file.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const formData = new FormData();
            formData.append('date_absent', date);
            formData.append('reason', reason);
            formData.append('file', file);

            await axios.post('/api/excuse', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setSuccess('Excuse letter submitted successfully.');
            setFile(null);
            setDate('');
            setReason('');
            fetchHistory(); // Refresh list
            if (onSubmitted) onSubmitted();

        } catch (err) {
            console.error(err);
            setError('Failed to submit excuse letter. ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded shadow">
                <h3 className="text-lg font-bold mb-4 flex items-center">
                    <FileText className="mr-2 text-blue-600" />
                    Submit Excuse Letter
                </h3>
                
                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
                {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm flex items-center"><CheckCircle size={16} className="mr-2"/>{success}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Absence</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={(e) => setDate(e.target.value)} 
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                        <textarea 
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)} 
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 h-24"
                            placeholder="Explain why you were absent..."
                            required
                        ></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Upload Letter/Proof</label>
                        <div 
                            className="border-2 border-dashed border-gray-300 rounded p-4 text-center hover:bg-gray-50 transition relative"
                            onClick={() => setShowUploadConsent(true)}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={(e) => setFile(e.target.files[0])} 
                                className="absolute inset-0 w-full h-full opacity-0"
                                style={{ pointerEvents: 'none' }}
                                tabIndex={-1}
                                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            />
                            {file ? (
                                <div className="text-sm text-green-600 font-medium truncate">
                                    Selected: {file.name}
                                </div>
                            ) : (
                                <div className="text-gray-500 text-sm">
                                    <Upload className="mx-auto mb-2 text-gray-400" />
                                    Click to upload (PDF, Word, or Image)
                                </div>
                            )}
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition flex justify-center items-center"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : 'Submit Excuse'}
                    </button>
                </form>
            </div>

            {/* History Section */}
            <div className="bg-white p-6 rounded shadow">
                <h3 className="text-lg font-bold mb-4">My Excuse Letters</h3>
                <ResponsiveTable
                    data={history}
                    columns={[
                        {
                            key: 'date_absent',
                            label: 'Date Absent',
                            render: (_, item) => new Date(item.date_absent).toLocaleDateString()
                        },
                        {
                            key: 'reason',
                            label: 'Reason',
                            render: (_, item) => (
                                <div className="max-w-xs truncate" title={item.reason}>
                                    {item.reason}
                                </div>
                            )
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (_, item) => (
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                    item.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {item.status}
                                </span>
                            )
                        },
                        {
                            key: 'proof',
                            label: 'Proof',
                            render: (_, item) => (
                                <div className="flex flex-col space-y-1">
                                    <a 
                                        href={item.file_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-blue-600 hover:underline flex items-center"
                                    >
                                        <ExternalLink size={14} className="mr-1" /> View
                                    </a>
                                    <a 
                                        href={item.file_url} 
                                        download 
                                        className="text-green-700 hover:underline flex items-center text-xs"
                                    >
                                        <Download size={12} className="mr-1" /> Download
                                    </a>
                                </div>
                            )
                        }
                    ]}
                    loading={false}
                    emptyMessage="No excuse letters submitted."
                    pagination={true}
                    itemsPerPage={5}
                    className="bg-white"
                />
            </div>

            {showUploadConsent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <h4 className="text-lg font-bold text-gray-800 mb-2">Allow Camera or Files Access</h4>
                        <p className="text-sm text-gray-600 mb-4">
                            To submit your excuse letter, choose whether to use your camera to take a photo or select from your gallery/files.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowUploadConsent(false);
                                }}
                                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        if (navigator.mediaDevices?.getUserMedia) {
                                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                                            try { stream.getTracks().forEach(t => t.stop()); } catch {}
                                        }
                                    } catch {}
                                    try {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.setAttribute('accept', 'image/*');
                                            fileInputRef.current.setAttribute('capture', 'environment');
                                            fileInputRef.current.click();
                                        }
                                    } catch {}
                                    setShowUploadConsent(false);
                                }}
                                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                            >
                                Use Camera
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    try {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.setAttribute('accept', ORIGINAL_ACCEPT);
                                            fileInputRef.current.removeAttribute('capture');
                                            fileInputRef.current.click();
                                        }
                                    } catch {}
                                    setShowUploadConsent(false);
                                }}
                                className="px-4 py-2 text-sm rounded bg-green-700 text-white hover:bg-green-800"
                            >
                                Choose Files
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExcuseLetterSubmission;
