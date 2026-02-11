import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, ChevronLeft, Trash2, RefreshCw, KeyRound } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cacheSingleton, clearCache } from '../../utils/db';

const ArchivedCadets = () => {
  const [cadets, setCadets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCadets, setSelectedCadets] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchArchived = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/cadets/archived');
      setCadets(res.data || []);
      await cacheSingleton('admin', 'archived_cadets_list', {
        data: res.data,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Failed to load archived cadets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const cached = await cacheSingleton('admin', 'archived_cadets_list', null);
        if (cached?.data && cached?.timestamp && (Date.now() - cached.timestamp < 2 * 60 * 1000)) {
          setCadets(cached.data);
          setLoading(false);
        }
      } catch {}
      await fetchArchived();
    })();
    let es;
    const connect = () => {
      try {
        es = new EventSource('/api/attendance/events');
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data || '{}');
            const types = new Set(['cadet_deleted','cadet_updated','cadet_created']);
            if (types.has(data.type)) {
              fetchArchived();
            }
          } catch {}
        };
        es.onerror = () => {
          try { es && es.close(); } catch {}
          setTimeout(connect, 3000);
        };
      } catch {}
    };
    connect();
    return () => { try { es && es.close(); } catch {} };
  }, []);

  const filteredCadets = cadets.filter((c) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (c.first_name && c.first_name.toLowerCase().includes(q)) ||
      (c.last_name && c.last_name.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.student_id && c.student_id.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedCadets(filteredCadets.map(c => c.id));
    } else {
      setSelectedCadets([]);
    }
  };

  const handleSelectCadet = (id) => {
    setSelectedCadets(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleRestore = async () => {
    if (selectedCadets.length === 0) return;
    if (!window.confirm(`Restore ${selectedCadets.length} archived cadets? Their access may be re-enabled.`)) return;
    try {
      await axios.post('/api/admin/cadets/restore', { ids: selectedCadets });
      toast.success('Cadets restored successfully');
      setSelectedCadets([]);
      await clearCache('attendance_by_day');
      await cacheSingleton('admin', 'cadets_list', null);
      fetchArchived();
    } catch (err) {
      console.error(err);
      toast.error('Failed to restore cadets');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await cacheSingleton('admin', 'archived_cadets_list', null);
      await fetchArchived();
      toast.success('Refreshed');
    } catch (err) {
      console.error('Refresh failed', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleReclaim = async () => {
    if (selectedCadets.length === 0) return;
    if (!window.confirm(`Reclaim credentials for ${selectedCadets.length} archived cadets? Their usernames will be renamed and emails cleared.`)) return;
    try {
      const res = await axios.post('/api/admin/cadets/reclaim-credentials', { cadetIds: selectedCadets });
      const updated = (res.data?.results || []).filter(r => r.updated > 0).length;
      toast.success(`Reclaimed ${updated} accounts`);
      setSelectedCadets([]);
      await fetchArchived();
    } catch (err) {
      console.error('Reclaim failed', err);
      toast.error('Failed to reclaim credentials');
    }
  };

  if (loading) return <div className="text-center p-10">Loading...</div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold">Archived Cadets</h2>
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search archived cadets..."
              className="pl-10 pr-4 py-2 border rounded w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {selectedCadets.length > 0 && (
            <button
              onClick={handleRestore}
              className="flex-1 md:flex-none bg-green-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-green-700 animate-fade-in"
            >
              <ChevronLeft size={18} />
              <span>Restore ({selectedCadets.length})</span>
            </button>
          )}
          {selectedCadets.length > 0 && (
            <button
              onClick={handleReclaim}
              className="flex-1 md:flex-none bg-amber-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-amber-700 animate-fade-in"
            >
              <KeyRound size={18} />
              <span>Reclaim ({selectedCadets.length})</span>
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex-1 md:flex-none bg-gray-600 text-white px-4 py-2 rounded flex items-center justify-center space-x-2 hover:bg-gray-700 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-auto max-h-[calc(100vh-200px)] relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr className="border-b shadow-sm">
              <th className="p-4 bg-gray-100 text-center w-12">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={filteredCadets.length > 0 && selectedCadets.length === filteredCadets.length}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
              <th className="p-4 bg-gray-100">Name & Rank</th>
              <th className="p-4 bg-gray-100">Username</th>
              <th className="p-4 text-center bg-gray-100">Unit (Coy/Plt)</th>
              <th className="p-4 text-center bg-gray-100">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredCadets.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-500">No archived cadets found.</td>
              </tr>
            ) : (
              filteredCadets.map(cadet => (
                <tr key={cadet.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedCadets.includes(cadet.id)}
                      onChange={() => handleSelectCadet(cadet.id)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-4">
                    <div className="font-medium">
                      <span className="font-bold text-blue-900 mr-1">{cadet.rank}</span>
                      {cadet.last_name}, {cadet.first_name}
                    </div>
                    <div className="text-xs text-gray-500">{cadet.email}</div>
                  </td>
                  <td className="p-4">{cadet.username || cadet.student_id}</td>
                  <td className="p-4 text-center">{cadet.company || '-'}/{cadet.platoon || '-'}</td>
                  <td className="p-4 text-center">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-800 border border-gray-200">
                      Archived
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArchivedCadets;
