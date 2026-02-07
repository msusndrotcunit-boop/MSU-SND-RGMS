import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Send, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const AskAdmin = () => {
    const [messages, setMessages] = useState([]);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
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
        if (!subject.trim() || !message.trim()) return;

        try {
            setSubmitting(true);
            await axios.post('/api/messages', { subject, message });
            toast.success('Message sent successfully');
            setSubject('');
            setMessage('');
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
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <MessageSquare className="text-blue-600" />
                Ask the Admin
            </h1>

            {/* Message Form */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-4">Submit a Report or Question</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Brief subject of your concern..."
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none h-32"
                            placeholder="Describe your issue or question in detail..."
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? 'Sending...' : (
                            <>
                                <Send size={18} />
                                Send Message
                            </>
                        )}
                    </button>
                </form>
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
