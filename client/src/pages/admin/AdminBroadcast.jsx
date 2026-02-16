import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Megaphone, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminBroadcast = () => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    if (!window.confirm('Broadcast this message to ALL cadets and training staff?')) return;
    try {
      setSending(true);
      const res = await axios.post('/api/messages/broadcast', {
        subject: subject.trim(),
        message: body.trim(),
      });
      toast.success(res.data?.message || 'Broadcast sent');
      setSubject('');
      setBody('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="text-green-700" />
          ROTC Admin Broadcast
        </h1>
        <Link to="/admin/messages" className="text-sm text-blue-600 hover:underline">
          Go to Feedback & Bug Reports
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="md:col-span-1 w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <textarea
            placeholder="Message body..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="md:col-span-2 w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-600 h-28"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={18} />
            {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Broadcasts appear in the message icon dropdown for cadets and training staff.
        Admin feedback panel does not list broadcasts.
      </div>
    </div>
  );
};

export default AdminBroadcast;
