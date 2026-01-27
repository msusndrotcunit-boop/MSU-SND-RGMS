import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Upload, FileText, CheckCircle, ExternalLink } from 'lucide-react';

const ExcuseLetterSubmission = ({ onSubmitted }) => {
    const [file, setFile] = useState(null);
    const [date, setDate] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [history, setHistory] = useState([]);

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
                        <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center cursor-pointer hover:bg-gray-50 transition relative">
                            <input 
                                type="file" 
                                onChange={(e) => setFile(e.target.files[0])} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept="image/*,application/pdf"
                            />
                            {file ? (
                                <div className="text-sm text-green-600 font-medium truncate">
                                    Selected: {file.name}
                                </div>
                            ) : (
                                <div className="text-gray-500 text-sm">
                                    <Upload className="mx-auto mb-2 text-gray-400" />
                                    Click to upload (PDF or Image)
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
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-100 border-b">
                                <th className="p-2">Date Absent</th>
                                <th className="p-2">Reason</th>
                                <th className="p-2">Status</th>
                                <th className="p-2">Proof</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length > 0 ? history.map(item => (
                                <tr key={item.id} className="border-b">
                                    <td className="p-2">{new Date(item.date_absent).toLocaleDateString()}</td>
                                    <td className="p-2 max-w-xs truncate" title={item.reason}>{item.reason}</td>
                                    <td className="p-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                            item.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-2">
                                        <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                                            <ExternalLink size={14} className="mr-1" /> View
                                        </a>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="p-4 text-center text-gray-500">No excuse letters submitted.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ExcuseLetterSubmission;