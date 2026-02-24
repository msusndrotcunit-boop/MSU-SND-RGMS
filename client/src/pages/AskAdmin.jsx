import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Send, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { ContactForm } from '../components/StandardMobileForms';

const AskAdmin = () => {
    const [messages, setMessages] = useState([]);
    const [formData, setFormData] = useState({
        subject: '',
        message: ''
    });
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchMessages();
    }, []);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/messages/my');
            setMessages(res.data);
        } catch (err) {
            console.error('Error fetching messages:', err);
            toast.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.subject.trim() || !formData.message.trim()) return;

        try {
            setSubmitting(true);
            await axios.post('/api/messages', { 
                subject: formData.subject, 
                message: formData.message 
            });
            toast.success('Message sent successfully');
            setFormData({ subject: '', message: '' });
            fetchMessages();
        } catch (err) {
            console.error('Error sending message:', err);
            toast.error('Failed to send message');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusIcon = (status) => {
        if (status === 'resolved') return <CheckCircle className="text-green-500" size={20} />;
        return <Clock className="text-yellow-500" size={20} />;
    };

    return (
        <div className="space-y-8">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="border-l-4 border-[var(--primary-color)] pl-3">Ask the Admin / Support</span>
                </h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={fetchMessages}
                        className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition flex items-center shadow-sm min-h-[44px] hover-highlight"
                    >
                        <Clock size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh History
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)] p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                            <MessageSquare className="text-[var(--primary-color)]" size={20} />
                            <h3 className="font-bold text-gray-800 dark:text-gray-100">New Message</h3>
                        </div>
                        <ContactForm
                            formData={formData}
                            onChange={setFormData}
                            onSubmit={handleSubmit}
                            loading={submitting}
                            showSubject={true}
                            showCategory={false}
                        />
                    </div>
                </div>

                {/* History Section */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-blue-600 p-6 flex flex-col min-h-[500px]">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                            <Clock className="text-blue-600" size={20} />
                            <h3 className="font-bold text-gray-800 dark:text-gray-100">Message History</h3>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm font-medium">Loading history...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400 opacity-50">
                                    <AlertCircle size={48} className="mb-4" />
                                    <p className="text-lg font-medium">No messages yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 pr-2">
                                    {messages.map((msg) => (
                                        <div key={msg.id} className="group border border-gray-100 dark:border-gray-800 rounded-xl p-4 hover:shadow-md transition-all duration-300 bg-gray-50 dark:bg-gray-800/50">
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="font-bold text-gray-800 dark:text-gray-100 leading-tight">{msg.subject}</h4>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-gray-900 shadow-sm border border-gray-50 dark:border-gray-800">
                                                    {getStatusIcon(msg.status)}
                                                    <span className={clsx(
                                                        "text-[10px] font-bold uppercase tracking-wider",
                                                        msg.status === 'resolved' ? 'text-green-600' : 'text-yellow-600'
                                                    )}>
                                                        {msg.status}
                                                    </span>
                                                </div>
                                            </div>
                                <p className="text-gray-700 whitespace-pre-wrap mb-3">{msg.message}</p>
                                <div className="text-xs text-gray-500 mb-2">
                                    Sent on {new Date(msg.created_at).toLocaleDateString()} at {new Date(msg.created_at).toLocaleTimeString()}
                                </div>
                                
                                {msg.admin_reply && (
                                    <div className="bg-gray-50 border-l-4 border-blue-500 p-3 mt-3 rounded-r">
                                        <p className="text-sm font-semibold text-blue-800 mb-1">Admin Reply:</p>
                                        <p className="text-gray-800 whitespace-pre-wrap">{msg.admin_reply}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
</div>
</div>
);
};

export default AskAdmin;
