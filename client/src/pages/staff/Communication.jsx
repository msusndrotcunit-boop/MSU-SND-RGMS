import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Send, MessageCircle, User, Edit2, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Communication = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const listRef = useRef(null);

  const fetchMe = async () => {
    try {
      const res = await axios.get('/api/staff/me');
      setMe(res.data);
    } catch (err) {
      console.error('Failed to fetch profile', err);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get('/api/staff/chat/messages');
      setMessages(res.data || []);
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Faster polling for chat feel
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    // Update last seen message ID
    if (messages.length > 0) {
        const latest = messages[messages.length - 1];
        const lastSeen = parseInt(localStorage.getItem('lastSeenMessageId') || '0');
        if (latest.id > lastSeen) {
            localStorage.setItem('lastSeenMessageId', latest.id.toString());
        }
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setPosting(true);
    try {
      if (editingMessage) {
        await axios.put(`/api/staff/chat/messages/${editingMessage.id}`, { content: input.trim() });
        setEditingMessage(null);
      } else {
        await axios.post('/api/staff/chat/messages', { content: input.trim() });
      }
      setInput('');
      await fetchMessages();
    } catch (err) {
      console.error('Failed to send/update message', err);
      // alert(err.response?.data?.message || 'Failed to send message');
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (msg) => {
    setEditingMessage(msg);
    setInput(msg.content);
    // Optional: focus input
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInput('');
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this message?")) return;
    try {
        await axios.delete(`/api/staff/chat/messages/${id}`);
        await fetchMessages();
    } catch (err) {
        console.error("Failed to delete", err);
    }
  };

  const displayName = (m) => {
    const n = [m.rank, m.last_name, m.first_name].filter(Boolean).join(' ');
    return n || 'Staff';
  };

  const getProfileSrc = (path) => {
    if (!path) return null;
    const apiUrl = import.meta.env.VITE_API_URL || '';
    if (path.startsWith('http')) return path;
    return `${apiUrl}${path}`;
  };

  return (
    <div className="space-y-8 h-[calc(100vh-140px)] flex flex-col">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
          <span className="border-l-4 border-[var(--primary-color)] pl-3">Staff Communication Hub</span>
        </h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full border border-green-100 dark:border-green-800 shadow-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Live Chat Active</span>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)] overflow-hidden flex flex-col min-h-0">
        {/* Messages List */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth bg-gray-50 dark:bg-gray-950/30"
        >
          {loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <div className="w-8 h-8 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Connecting to staff hub...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
              <MessageCircle size={64} className="mb-4" />
              <p className="text-lg font-medium">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMine = me && m.staff_id === me.id;
              const profileSrc = getProfileSrc(m.profile_pic);

              return (
                <div 
                  key={m.id} 
                  className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMine ? "ml-auto items-end" : "mr-auto items-start"}`}
                >
                  {!isMine && (
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{displayName(m)}</span>
                    </div>
                  )}
                  <div className={`group relative p-3 rounded-2xl shadow-sm text-sm break-words ${
                    isMine 
                      ? "bg-[var(--primary-color)] text-white rounded-tr-none" 
                      : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-none"
                  }`}>
                    {m.content}
                    
                    {isMine && (
                      <div className="absolute right-0 top-0 -translate-y-full flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white dark:bg-gray-800 rounded-t-lg shadow-sm border border-b-0 border-gray-100 dark:border-gray-700">
                        <button 
                          onClick={() => startEdit(m)}
                          className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => handleDelete(m.id)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 px-1">
                    <span className="text-[9px] text-gray-400 font-medium">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
          <form onSubmit={sendMessage} className="relative flex flex-col gap-2">
            {editingMessage && (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Editing message...</span>
                <button 
                  type="button" 
                  onClick={cancelEdit}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message here..."
                disabled={posting}
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] dark:text-gray-100"
              />
              <button
                type="submit"
                disabled={posting || !input.trim()}
                className="bg-[var(--primary-color)] text-white p-2.5 rounded-xl shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Communication;
