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
            <div className="max-w-4xl mx-auto space-y-6 p-4">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <MessageSquare className="text-blue-600" />
                    Ask the Admin
                </h1>

                {/* Mobile-Optimized Message Form */}
                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">Submit a Report or Question</h2>
                    <ContactForm
                        formData={formData}
                        onChange={setFormData}
                        onSubmit={handleSubmit}
                        loading={submitting}
                        showSubject={true}
                        showCategory={false}
                    />
                </div>

            {/* Message History */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-4">My Messages</h2>
                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <AlertCircle className="mx-auto mb-2 opacity-50" size={32} />
                        No messages yet.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <div key={msg.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-lg">{msg.subject}</h3>
                                    <div className="flex items-center gap-1 text-sm font-medium">
                                        {getStatusIcon(msg.status)}
                                        <span className={clsx(
                                            msg.status === 'resolved' ? 'text-green-600' : 'text-yellow-600'
                                        )}>
                                            {msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}
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
    );
};

export default AskAdmin;
