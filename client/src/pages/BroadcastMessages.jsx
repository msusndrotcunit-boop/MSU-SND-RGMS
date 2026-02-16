import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BroadcastMessages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const role = (user?.role || '').toLowerCase();
  const basePath =
    role === 'admin' ? '/api/admin/notifications' :
    role === 'training_staff' ? '/api/staff/notifications' :
    '/api/cadet/notifications';

  const clearAllPath =
    role === 'admin' ? '/api/admin/notifications' :
    role === 'training_staff' ? '/api/staff/notifications/delete-all' :
    '/api/cadet/notifications/delete-all';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(basePath);
      const all = res.data || [];
      const broadcasts = (all || []).filter(n => n.user_id === null);
      setItems(broadcasts);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/notifications/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const handleClearAll = async () => {
    try {
      await axios.delete(clearAllPath);
      setItems([]);
    } catch {}
  };

  const title =
    role === 'admin' ? 'Admin Broadcasts' :
    role === 'training_staff' ? 'Unit Broadcasts' :
    'Announcements';

  const backPath =
    role === 'admin' ? '/admin/dashboard' :
    role === 'training_staff' ? '/staff/dashboard' :
    '/cadet/dashboard';

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return (
    <div className="p-6">
      <div className="text-red-600 mb-3">{error}</div>
      <button onClick={fetchData} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded">
        <RefreshCw size={16} className="mr-2" /> Retry
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleClearAll} className="px-3 py-2 bg-red-600 text-white rounded inline-flex items-center">
            <Trash2 size={16} className="mr-2" /> Clear All
          </button>
          <button onClick={() => navigate(backPath)} className="px-3 py-2 bg-gray-200 rounded">Back</button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="p-6 bg-white rounded shadow text-gray-600">No broadcast messages</div>
      ) : (
        <div className="space-y-3">
          {items.map(n => (
            <div key={n.id} className="bg-white rounded shadow p-4 flex justify-between items-start">
              <div>
                <div className="font-medium">{n.message}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              <button onClick={() => handleDelete(n.id)} className="text-gray-500 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BroadcastMessages;
