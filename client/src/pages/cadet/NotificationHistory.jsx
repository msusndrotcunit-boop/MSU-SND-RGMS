import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, Search, Filter, Calendar, AlertTriangle, Info, Megaphone, CheckCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

const NotificationHistory = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchSubject] = useState('');
  const [filters, setFilters] = useState({
    priority: 'all',
    category: 'all',
    status: 'all' // all, read, unread
  });

  const fetchNotifications = async () => {
    if (!user?.cadetId) return;
    try {
      setLoading(true);
      const res = await axios.get('/api/cadet/notifications', {
        params: { cadetId: user.cadetId }
      });
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = n.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         n.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = filters.priority === 'all' || n.priority === filters.priority;
    const matchesCategory = filters.category === 'all' || n.category === filters.category;
    const matchesStatus = filters.status === 'all' || 
                         (filters.status === 'read' && n.is_read) || 
                         (filters.status === 'unread' && !n.is_read);
    
    return matchesSearch && matchesPriority && matchesCategory && matchesStatus;
  });

  const getPriorityBadge = (priority) => {
    const styles = {
      urgent: "bg-red-100 text-red-700 border-red-200",
      high: "bg-orange-100 text-orange-700 border-orange-200",
      medium: "bg-blue-100 text-blue-700 border-blue-200",
      low: "bg-gray-100 text-gray-700 border-gray-200"
    };
    return (
      <span className={clsx("text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border", styles[priority])}>
        {priority}
      </span>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="text-green-700" />
            Notification History
          </h1>
          <p className="text-gray-500 text-sm">View and manage all your past broadcast messages</p>
        </div>
        <button 
          onClick={() => {/* Export logic */}}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
          <Download size={16} /> Export Logs
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700 mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by subject or message content..."
            className="w-full pl-10 pr-4 py-2 border dark:border-gray-700 dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchSubject(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</label>
            <select 
              className="bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none"
              value={filters.priority}
              onChange={(e) => setFilters({...filters, priority: e.target.value})}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
            <select 
              className="bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="all">All Status</option>
              <option value="unread">Unread Only</option>
              <option value="read">Read Only</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category</label>
            <select 
              className="bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none"
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
            >
              <option value="all">All Categories</option>
              <option value="General">General</option>
              <option value="Training">Training</option>
              <option value="Event">Event</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications Table/List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700 mb-4"></div>
            <p className="text-gray-500">Loading your history...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Bell className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No notifications found</h3>
            <p className="text-gray-500 max-w-xs mx-auto">Try adjusting your filters or search terms to find what you're looking for.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-12">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Notification</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {filteredNotifications.map((n) => (
                  <tr key={n.id} className={clsx("hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors", !n.is_read && "bg-green-50/20 dark:bg-green-900/5")}>
                    <td className="px-6 py-4">
                      {n.is_read ? (
                        <CheckCircle className="text-gray-300" size={18} />
                      ) : (
                        <div className="w-2.5 h-2.5 bg-green-600 rounded-full" title="Unread" />
                      )}
                    </td>
                    <td className="px-6 py-4 min-w-[300px]">
                      <div className="flex flex-col">
                        <span className={clsx("font-bold text-gray-900 dark:text-white", !n.is_read && "text-green-800 dark:text-green-400")}>
                          {n.subject}
                        </span>
                        <span className="text-sm text-gray-500 line-clamp-1">{n.message}</span>
                        <span className="text-[10px] text-gray-400 mt-1 uppercase font-medium">{n.category} • {n.author}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getPriorityBadge(n.priority)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(n.created_at), 'MMM dd, yyyy • hh:mm a')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination placeholder */}
        <div className="px-6 py-4 border-t dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
          <span className="text-xs text-gray-500">Showing {filteredNotifications.length} notifications</span>
          <div className="flex gap-2">
            <button className="p-1 border dark:border-gray-700 rounded opacity-50 cursor-not-allowed"><ChevronLeft size={16} /></button>
            <button className="p-1 border dark:border-gray-700 rounded opacity-50 cursor-not-allowed"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationHistory;
