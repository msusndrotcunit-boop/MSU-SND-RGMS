import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Megaphone, Send, AlertTriangle, Info, Bell, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminBroadcast = () => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('General');
  const [imageUrl, setImageUrl] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');
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
        priority,
        category,
        image_url: imageUrl,
        action_url: actionUrl,
        action_label: actionLabel,
      });
      toast.success(res.data?.message || 'Broadcast sent');
      setSubject('');
      setBody('');
      setImageUrl('');
      setActionUrl('');
      setActionLabel('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
          <Megaphone className="text-green-700" size={28} />
          Broadcast System
        </h1>
        <Link to="/admin/messages" className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
          Go to Feedback Reports
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 border dark:border-gray-800 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Subject Line</label>
              <input
                type="text"
                placeholder="Enter a catchy subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-green-600 outline-none transition-all"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Priority</label>
                <select 
                  className="w-full px-4 py-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                <select 
                  className="w-full px-4 py-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="General">General</option>
                  <option value="Training">Training</option>
                  <option value="Event">Event</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                <ImageIcon size={14} /> Image URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-4 py-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Message Content</label>
              <textarea
                placeholder="Type your message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-4 py-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-green-600 outline-none h-[116px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                  <LinkIcon size={14} /> Action Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. View Grades"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  className="w-full px-4 py-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                  <LinkIcon size={14} /> Action URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. /cadet/achievements"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between border-t dark:border-gray-800">
          <p className="text-xs text-gray-500 italic">
            Note: This will be sent instantly to all active cadets and training staff.
          </p>
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="bg-green-700 text-white px-8 py-3 rounded-lg hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 font-bold shadow-md hover:shadow-lg transition-all transform active:scale-95"
          >
            <Send size={18} />
            {sending ? 'Sending...' : 'Send Broadcast Now'}
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold mb-2">
            <Info size={18} />
            <h3>Reach</h3>
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-300 opacity-80">
            Messages are delivered instantly to active web sessions and stored in the cadet notification history.
          </p>
        </div>
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-bold mb-2">
            <Bell size={18} />
            <h3>Indicators</h3>
          </div>
          <p className="text-sm text-orange-600 dark:text-orange-300 opacity-80">
            New messages trigger a bounce animation and update the notification badge count on the navigation bar.
          </p>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-2">
            <AlertTriangle size={18} />
            <h3>Priority</h3>
          </div>
          <p className="text-sm text-red-600 dark:text-red-300 opacity-80">
            Urgent priority messages are highlighted in red and stay at the top of the notification panel until read.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcast;
