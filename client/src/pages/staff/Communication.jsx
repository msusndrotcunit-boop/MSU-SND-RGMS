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
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-3 flex items-center gap-2 shadow-sm shrink-0">
        <MessageCircle className="text-green-700" size={24} />
        <h2 className="text-lg font-bold text-gray-800">Staff Chat</h2>
      </div>

      {/* Messages List */}
      <div 
        ref={listRef} 
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {loading ? (
          <div className="text-center text-gray-500 py-10">Loading conversation...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
            <MessageCircle size={48} className="opacity-20" />
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = me && m.staff_id === me.id;
            const profileSrc = getProfileSrc(m.profile_pic);

            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 mb-1">
                    {profileSrc ? (
                        <img 
                            src={profileSrc} 
                            alt="Avatar" 
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                            onError={(e) => {
                                e.target.onerror = null; // Prevent infinite loop
                                e.target.style.display = 'none'; // Hide broken image
                                e.target.nextSibling.style.display = 'flex'; // Show fallback
                            }}
                        />
                    ) : null}
                    <div 
                        className={`w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 border border-gray-300 ${profileSrc ? 'hidden' : 'flex'}`}
                    >
                        <User size={14} />
                    </div>
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[75%] md:max-w-[60%] px-4 py-2 rounded-2xl shadow-sm text-sm ${
                    isMine 
                        ? 'bg-green-600 text-white rounded-br-none' 
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                  }`}
                >
                  {!isMine && (
                      <div className="text-xs font-bold text-green-700 mb-1">
                          {displayName(m)}
                      </div>
                  )}
                  <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
                  <div className={`text-[10px] mt-1 text-right ${isMine ? 'text-green-100' : 'text-gray-400'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Actions (Only if mine) */}
                {isMine && (
                    <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity self-center mb-2">
                        <button 
                            onClick={() => startEdit(m)} 
                            className="p-1.5 text-gray-400 hover:text-blue-500 bg-gray-100 hover:bg-blue-50 rounded-full shadow-sm" 
                            title="Edit"
                        >
                            <Edit2 size={12} />
                        </button>
                        <button 
                            onClick={() => handleDelete(m.id)} 
                            className="p-1.5 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full shadow-sm" 
                            title="Delete"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input Area - Fixed/Sticky Bottom Look */}
      <div className="bg-white p-3 border-t shrink-0">
        {editingMessage && (
            <div className="flex items-center justify-between bg-blue-50 px-4 py-2 text-xs text-blue-600 mb-2 rounded-lg border border-blue-100">
                <span>Editing message...</span>
                <button onClick={cancelEdit} className="text-blue-400 hover:text-blue-700">
                    <X size={14} />
                </button>
            </div>
        )}
        <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 text-gray-800 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
          />
          <button
            type="submit"
            disabled={posting || !input.trim()}
            className={`p-3 rounded-full flex-shrink-0 transition-colors ${
              posting || !input.trim() 
                ? 'bg-gray-200 text-gray-400 cursor-default' 
                : 'bg-green-600 text-white hover:bg-green-700 shadow-md'
            }`}
          >
            <Send size={20} className={posting ? 'animate-pulse' : ''} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Communication;
