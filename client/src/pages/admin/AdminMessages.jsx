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

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                                <div className="w-8 h-8 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm font-medium">Loading messages...</p>
                            </div>
                        ) : filteredMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400 opacity-50">
                                <MessageSquare size={48} className="mb-4" />
                                <p className="text-lg font-medium">No messages found.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filteredMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        onClick={() => setSelectedMessage(msg)}
                                        className={clsx(
                                            "p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                                            selectedMessage?.id === msg.id ? "bg-[var(--primary-color)]/5 border-l-4 border-[var(--primary-color)]" : "border-l-4 border-transparent",
                                            msg.status === 'pending' ? "font-bold" : "text-gray-600 dark:text-gray-400"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="text-[10px] font-bold uppercase tracking-wider">
                                                {msg.sender_role === 'cadet' ? (
                                                    <span className="text-blue-600">Cadet {msg.cadet_last || msg.username}</span>
                                                ) : (
                                                    <span className="text-green-600">Staff {msg.staff_last || msg.username}</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-400">
                                                {new Date(msg.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate mb-1">{msg.subject}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{msg.message}</div>
                                        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                                            {msg.status === 'resolved' ? (
                                                <span className="flex items-center gap-1 text-green-600">
                                                    <CheckCircle size={12} /> Resolved
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-amber-600">
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
                <div className={clsx(
                    "flex-1 bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-blue-600 flex flex-col h-full overflow-hidden min-h-[600px]",
                    !selectedMessage && "hidden md:flex justify-center items-center text-gray-400 p-12"
                )}>
                    {!selectedMessage ? (
                        <div className="text-center">
                            <MessageSquare size={64} className="mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-medium">Select a message from the list to view details and reply.</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{selectedMessage.subject}</h2>
                                <button onClick={() => setSelectedMessage(null)} className="md:hidden text-gray-500 hover:text-gray-700 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-8">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-700">
                                        <User size={28} className="text-gray-400" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 dark:text-gray-100">
                                            {selectedMessage.sender_role === 'cadet' ? 
                                                `Cadet ${selectedMessage.cadet_first || ''} ${selectedMessage.cadet_last || selectedMessage.username}` : 
                                                `Staff ${selectedMessage.staff_first || ''} ${selectedMessage.staff_last || selectedMessage.username}`
                                            }
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider mt-0.5">
                                            {selectedMessage.sender_role} • {selectedMessage.user_email || 'No Email'}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1 italic">
                                            {new Date(selectedMessage.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 mb-8 leading-relaxed text-gray-800 dark:text-gray-200">
                                    <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
                                </div>

                                {selectedMessage.admin_reply && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 mb-8">
                                        <div className="text-[10px] font-bold text-blue-800 dark:text-blue-400 uppercase tracking-widest mb-3">Previous Admin Reply</div>
                                        <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 italic">{selectedMessage.admin_reply}</p>
                                    </div>
                                )}

                                <div className="border-t border-gray-100 dark:border-gray-800 pt-8">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-widest">Your Reply</label>
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] h-40 text-sm leading-relaxed"
                                        placeholder="Type your reply to resolve this message..."
                                    />
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={handleReply}
                                            disabled={replying || !replyText.trim()}
                                            className="bg-green-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-800 transition flex items-center gap-2 shadow-lg disabled:opacity-50 active:scale-95"
                                        >
                                            {replying ? 'Sending...' : (
                                                <>
                                                    <Send size={18} />
                                                    Send & Resolve
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="mt-8 bg-gradient-to-r from-green-900 to-green-800 text-white rounded-lg p-6 shadow-lg border border-green-700">
                <div className="flex items-center mb-4 border-b border-green-700/50 pb-2">
                    <Zap size={20} className="text-yellow-400 mr-2" />
                    <h3 className="font-bold text-sm uppercase tracking-widest">Admin Quick Navigation</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link
                        to="/admin/data-analysis"
                        className="flex items-center justify-center px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-xs md:text-sm font-medium"
                    >
                        Data Analysis
                    </Link>
                    <Link
                        to="/admin/grading"
                        className="flex items-center justify-center px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-xs md:text-sm font-medium"
                    >
                        Grading
                    </Link>
                    <Link
                        to="/admin/activities"
                        className="flex items-center justify-center px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-xs md:text-sm font-medium"
                    >
                        Activities
                    </Link>
                    <Link
                        to="/admin/messages"
                        className="flex items-center justify-center px-4 py-3 rounded-lg bg-white/20 border border-white/20 transition-all text-xs md:text-sm font-bold"
                    >
                        Messages Hub
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdminMessages;
