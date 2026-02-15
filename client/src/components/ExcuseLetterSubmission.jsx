import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader2, Upload, FileText, CheckCircle, ExternalLink, Download } from 'lucide-react';
import ResponsiveTable from './ResponsiveTable';
import { MobileFormLayout, FormField, MobileInput, MobileTextarea, FormActions } from './MobileFormLayout';
import TouchTargetValidator from './TouchTargetValidator';

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
        <TouchTargetValidator autoCorrect={true}>
            <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded shadow">
                    <h3 className="text-lg font-bold mb-4 flex items-center dark:text-gray-100">
                        <FileText className="mr-2 text-blue-600" />
                        Submit Excuse Letter
                    </h3>
                    
                    {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
                    {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm flex items-center"><CheckCircle size={16} className="mr-2"/>{success}</div>}

                    <MobileFormLayout onSubmit={handleSubmit}>
                        <FormField label="Date of Absence" required>
                            <MobileInput
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </FormField>

                        <FormField label="Reason" required>
                            <MobileTextarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Explain why you were absent..."
                                rows={4}
                                disabled={loading}
                                required
                            />
                        </FormField>

                        <FormField label="Upload Letter/Proof" required>
                            <div 
                                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer touch-target"
                                onClick={() => setShowUploadConsent(true)}
                                style={{ minHeight: '120px' }}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    onChange={(e) => setFile(e.target.files[0])} 
                                    className="hidden"
                                    accept={ORIGINAL_ACCEPT}
                                />
                                {file ? (
                                    <div className="text-sm text-green-600 font-medium">
                                        <CheckCircle size={24} className="mx-auto mb-2" />
                                        Selected: {file.name}
                                    </div>
                                ) : (
                                    <div className="text-gray-500 dark:text-gray-400">
                                        <Upload size={32} className="mx-auto mb-2" />
                                        <p className="font-medium">Click to upload file</p>
                                        <p className="text-xs mt-1">PDF, Word, or Image files</p>
                                    </div>
                                )}
                            </div>
                        </FormField>

                        <FormActions alignment="right">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors touch-target flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        Submit Letter
                                    </>
                                )}
                            </button>
                        </FormActions>
                    </MobileFormLayout>
                </div>

                {/* History Section */}
                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded shadow">
                    <h3 className="text-lg font-bold mb-4 dark:text-gray-100">My Excuse Letters</h3>
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
                                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 touch-target"
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
                                className="px-4 py-2 text-sm rounded bg-green-700 text-white hover:bg-green-800 touch-target"
                            >
                                Choose Files
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </TouchTargetValidator>
    );
};

export default ExcuseLetterSubmission;
