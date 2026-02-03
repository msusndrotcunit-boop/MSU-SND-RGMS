import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Send, MessageCircle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
 
const Communication = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
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
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);
 
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);
 
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setPosting(true);
    try {
      await axios.post('/api/staff/chat/messages', { content: input.trim() });
      setInput('');
      await fetchMessages();
    } catch (err) {
      console.error('Failed to send message', err);
      alert(err.response?.data?.message || 'Failed to send message');
    } finally {
      setPosting(false);
    }
  };
 
  const displayName = (m) => {
    const n = [m.rank, m.last_name, m.first_name].filter(Boolean).join(' ');
    return n || 'Staff';
  };
 
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="text-green-700" />
        <h2 className="text-2xl font-bold">Staff Communication</h2>
      </div>
 
      <div className="bg-white rounded shadow p-4">
        {/* Messages List */}
        <div ref={listRef} className="h-96 overflow-y-auto space-y-3 border rounded p-3 bg-gray-50">
          {loading ? (
            <div className="text-center text-gray-500">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500">No messages yet. Start the conversation!</div>
          ) : (
            messages.map((m) => {
              const isMine = me && m.staff_id === me.id;
              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
                      isMine ? 'bg-green-600 text-white' : 'bg-white'
                    }`}
                  >
                    <div className="text-xs opacity-75 mb-1 flex items-center gap-1">
                      <User size={14} />
                      <span>{displayName(m)}</span>
                      <span className="ml-2">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
 
        {/* Composer */}
        <form onSubmit={sendMessage} className="mt-4 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <button
            type="submit"
            disabled={posting || !input.trim()}
            className={`px-4 py-2 rounded text-white flex items-center gap-2 ${
              posting || !input.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-700 hover:bg-green-800'
            }`}
          >
            <Send size={18} />
            <span>{posting ? 'Sending...' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
 
export default Communication;
