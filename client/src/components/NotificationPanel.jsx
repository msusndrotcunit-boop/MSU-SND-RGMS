import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getCachedWithFreshness, cacheWithTimestamp } from '../utils/db';
import { Bell, X, Check, Clock, AlertTriangle, Info, Megaphone, Trash2, ChevronRight, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

const NotificationPanel = ({ isOpen, onClose, cadetId, onBadgeUpdate }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, urgent

  const fetchNotifications = async () => {
    if (!cadetId) return;
    try {
      setLoading(true);
      const cached = await getCachedWithFreshness('notifications', `cadet_${cadetId}`, 60000);
      const data = cached || (await (async () => {
        const res = await axios.get('/api/cadet/notifications', { params: { cadetId } });
        const d = Array.isArray(res.data) ? res.data : [];
        await cacheWithTimestamp('notifications', `cadet_${cadetId}`, d);
        return d;
      })());
      setNotifications(data);
      if (onBadgeUpdate) {
        const unreadCount = data.filter(n => !n.is_read).length;
        onBadgeUpdate(unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, cadetId]);

  const handleMarkRead = async (id) => {
    try {
      await axios.post(`/api/notifications/${id}/read`, {}, {
        params: { cadetId }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (onBadgeUpdate) {
        const newUnreadCount = notifications.filter(n => n.id !== id && !n.is_read).length;
        onBadgeUpdate(newUnreadCount);
      }
    } catch (err) {
      toast.error('Failed to mark as read');
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="text-red-500" size={18} />;
      case 'high': return <Megaphone className="text-orange-500" size={18} />;
      case 'medium': return <Info className="text-blue-500" size={18} />;
      default: return <Bell className="text-gray-500" size={18} />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'urgent') return n.priority === 'urgent' || n.priority === 'high';
    return true;
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex justify-end overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-panel-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl h-full flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between bg-green-700 text-white">
          <div className="flex items-center gap-2">
            <Bell size={20} />
            <h2 id="notification-panel-title" className="font-bold text-lg">Notifications</h2>
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {notifications.filter(n => !n.is_read).length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-2 border-b dark:border-gray-800 flex gap-2 bg-gray-50 dark:bg-gray-800/50">
          {['all', 'unread', 'urgent'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-1 text-xs rounded-full capitalize transition-all",
                filter === f 
                  ? "bg-green-600 text-white shadow-sm" 
                  : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700 mb-4"></div>
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center p-8">
              <Bell size={48} className="mb-4 opacity-20" />
              <p className="font-medium">No notifications found</p>
              <p className="text-sm opacity-60">When admin sends a broadcast, it will appear here.</p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-800">
              {filteredNotifications.map((notif) => (
                <div 
                  key={notif.id}
                  className={clsx(
                    "p-4 transition-colors relative group",
                    !notif.is_read ? "bg-green-50/50 dark:bg-green-900/10 border-l-4 border-green-600" : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-4 border-transparent"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="mt-1 shrink-0">
                      {getPriorityIcon(notif.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className={clsx("font-bold text-sm truncate", !notif.is_read ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400")}>
                          {notif.subject}
                        </h3>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap flex items-center gap-1">
                          <Clock size={10} />
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={clsx("text-sm line-clamp-2 mb-2", !notif.is_read ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-500")}>
                        {notif.message}
                      </p>
                      
                      {notif.image_url && (
                        <img 
                          src={notif.image_url} 
                          alt="Attachment" 
                          className="w-full h-32 object-cover rounded-lg mb-2 border dark:border-gray-700"
                        />
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                          {notif.category} • {notif.author}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {!notif.is_read && (
                            <button 
                              onClick={() => handleMarkRead(notif.id)}
                              className="text-xs text-green-600 dark:text-green-400 font-bold hover:underline flex items-center gap-1"
                            >
                              <Check size={12} /> Mark read
                            </button>
                          )}
                          {notif.action_url && (
                            <a 
                              href={notif.action_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
                            >
                              {notif.action_label || 'View'} <ChevronRight size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button 
            onClick={() => {/* Navigate to history */}}
            className="w-full py-2 text-sm text-green-700 dark:text-green-400 font-bold flex items-center justify-center gap-2 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition-colors"
          >
            View Notification History
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPanel;
