import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { MessageSquare, Search, Filter, CheckCircle, Clock, Send, User, Zap } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

const AdminMessages = () => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // all, pending, resolved
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [replying, setReplying] = useState(false);
    // broadcast removed

    useEffect(() => {
        fetchMessages();
    }, []);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/messages');
            setMessages(res.data);
        } catch (err) {
            console.error('Error fetching messages:', err);
            toast.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    const handleReply = async () => {
        if (!selectedMessage || !replyText.trim()) return;

        try {
            setReplying(true);
            await axios.put(`/api/messages/${selectedMessage.id}/reply`, {
                admin_reply: replyText,
                status: 'resolved'
            });
            toast.success('Reply sent successfully');
            setReplyText('');
            setSelectedMessage(null);
            fetchMessages();
        } catch (err) {
            console.error('Error replying:', err);
            toast.error('Failed to send reply');
        } finally {
            setReplying(false);
        }
    };

    // broadcast removed

    const filteredMessages = messages.filter(msg => {
        const matchesFilter = filter === 'all' || msg.status === filter;
        const matchesSearch = 
            msg.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (msg.cadet_last && msg.cadet_last.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (msg.staff_last && msg.staff_last.toLowerCase().includes(searchTerm.toLowerCase())) ||
            msg.username.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

 
    return (
        <div className="space-y-8">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="border-l-4 border-[var(--primary-color)] pl-3">Message Center</span>
                </h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={fetchMessages}
                        className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition flex items-center shadow-sm min-h-[44px] hover-highlight"
                    >
                        <Zap size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* List View */}
                <div className={clsx(
                    "w-full md:w-1/3 bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)] flex flex-col min-h-[600px]",
                    selectedMessage ? "hidden md:flex" : "flex"
                )}>
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex flex-col gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search messages..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] text-sm"
                                />
                            </div>
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                                <button 
                                    onClick={() => setFilter('all')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition ${filter === 'all' ? 'bg-white dark:bg-gray-700 text-[var(--primary-color)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    ALL
                                </button>
                                <button 
                                    onClick={() => setFilter('pending')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition ${filter === 'pending' ? 'bg-white dark:bg-gray-700 text-[var(--primary-color)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    PENDING
                                </button>
                                <button 
                                    onClick={() => setFilter('resolved')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition ${filter === 'resolved' ? 'bg-white dark:bg-gray-700 text-[var(--primary-color)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    RESOLVED
                                </button>
                            </div>
                        </div>
                    </div>
                                <option value="resolved">Resolved</option>
                            </select>
                            <Filter className="absolute right-2 top-2.5 text-gray-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : filteredMessages.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No messages found.</div>
                    ) : (
                        <div className="divide-y">
                            {filteredMessages.map((msg) => (
                                <div
                                    key={msg.id}
                                    onClick={() => setSelectedMessage(msg)}
                                    className={clsx(
                                        "p-4 cursor-pointer hover:bg-gray-50 transition-colors",
                                        selectedMessage?.id === msg.id ? "bg-blue-50 border-l-4 border-blue-500" : "border-l-4 border-transparent",
                                        msg.status === 'pending' ? "font-medium" : "text-gray-600"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="text-sm font-semibold">
                                            {msg.sender_role === 'cadet' ? (
                                                <span className="text-blue-600">Cadet {msg.cadet_last || msg.username}</span>
                                            ) : (
                                                <span className="text-green-600">Staff {msg.staff_last || msg.username}</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(msg.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold truncate mb-1">{msg.subject}</div>
                                    <div className="text-sm text-gray-500 truncate">{msg.message}</div>
                                    <div className="mt-2 flex items-center gap-1 text-xs">
                                        {msg.status === 'resolved' ? (
                                            <span className="flex items-center gap-1 text-green-600">
                                                <CheckCircle size={12} /> Resolved
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-yellow-600">
                                                <Clock size={12} /> Pending
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail View */}
            {selectedMessage ? (
                <div className="flex-1 bg-white rounded-lg shadow-md flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h2 className="text-lg font-bold">{selectedMessage.subject}</h2>
                        <button onClick={() => setSelectedMessage(null)} className="md:hidden text-gray-500">Close</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <User size={24} className="text-gray-500" />
                            </div>
                            <div>
                                <div className="font-semibold">
                                    {selectedMessage.sender_role === 'cadet' ? 
                                        `Cadet ${selectedMessage.cadet_first || ''} ${selectedMessage.cadet_last || selectedMessage.username}` : 
                                        `Staff ${selectedMessage.staff_first || ''} ${selectedMessage.staff_last || selectedMessage.username}`
                                    }
                                </div>
                                <div className="text-sm text-gray-500">
                                    {selectedMessage.sender_role.toUpperCase()} • {selectedMessage.user_email || 'No Email'}
                                </div>
                                <div className="text-xs text-gray-400">
                                    {new Date(selectedMessage.created_at).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border mb-6">
                            <p className="whitespace-pre-wrap text-gray-800">{selectedMessage.message}</p>
                        </div>

                        {selectedMessage.admin_reply && (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                                <div className="text-sm font-semibold text-blue-800 mb-2">Previous Reply:</div>
                                <p className="whitespace-pre-wrap text-gray-800">{selectedMessage.admin_reply}</p>
                            </div>
                        )}

                        <div className="border-t pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Reply to User</label>
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-32"
                                placeholder="Type your reply here..."
                            />
                            <div className="mt-3 flex justify-end">
                                <button
                                    onClick={handleReply}
                                    disabled={replying || !replyText.trim()}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {replying ? 'Sending...' : (
                                        <>
                                            <Send size={18} />
                                            Send Reply & Resolve
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 bg-gray-50 rounded-lg border border-dashed border-gray-300 items-center justify-center text-gray-400">
                    Select a message to view details
                </div>
            )}

            <div className="mt-2 bg-green-900 text-white rounded-lg p-4 shadow-md">
                <div className="flex items-center mb-3 border-b border-green-700 pb-1">
                    <Zap size={18} className="text-yellow-400 mr-2" />
                    <span className="font-semibold text-sm uppercase tracking-wide">Quick Actions</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Link
                        to="/admin/data-analysis"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Data Analysis
                    </Link>
                    <Link
                        to="/admin/grading"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Grading
                    </Link>
                    <Link
                        to="/admin/activities"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Activities
                    </Link>
                    <Link
                        to="/admin/messages"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/20 text-xs md:text-sm"
                    >
                        Messages
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdminMessages;
