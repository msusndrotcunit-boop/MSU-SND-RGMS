import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Plus, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, Save, Search, ChevronRight } from 'lucide-react';

const Attendance = () => {
    const [days, setDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ date: '', title: '', description: '' });
    
    // Filters for marking
    const [filterCompany, setFilterCompany] = useState('');
    const [filterPlatoon, setFilterPlatoon] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchDays();
    }, []);

    const fetchDays = async () => {
        try {
            const res = await axios.get('/api/attendance/days');
            setDays(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleCreateDay = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/attendance/days', createForm);
            fetchDays();
            setIsCreateModalOpen(false);
            setCreateForm({ date: '', title: '', description: '' });
        } catch (err) {
            alert('Error creating training day');
        }
    };

    const handleDeleteDay = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Delete this training day and all associated records?')) return;
        try {
            await axios.delete(`/api/attendance/days/${id}`);
            if (selectedDay?.id === id) setSelectedDay(null);
            fetchDays();
        } catch (err) {
            alert('Error deleting day');
        }
    };

    const selectDay = async (day) => {
        setSelectedDay(day);
        setLoading(true);
        try {
            const res = await axios.get(`/api/attendance/records/${day.id}`);
            setAttendanceRecords(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleMarkAttendance = async (cadetId, status) => {
        // Optimistic update
        const updatedRecords = attendanceRecords.map(r => 
            r.cadet_id === cadetId ? { ...r, status: status } : r
        );
        setAttendanceRecords(updatedRecords);

        try {
            await axios.post('/api/attendance/mark', {
                dayId: selectedDay.id,
                cadetId,
                status,
                remarks: ''
            });
        } catch (err) {
            console.error('Failed to save attendance', err);
            // Revert on failure would be better, but keeping it simple
        }
    };

    const handleRemarkChange = async (cadetId, remarks) => {
        const updatedRecords = attendanceRecords.map(r => 
            r.cadet_id === cadetId ? { ...r, remarks: remarks } : r
        );
        setAttendanceRecords(updatedRecords);
    };
    
    const saveRemark = async (cadetId, remarks, status) => {
         try {
            await axios.post('/api/attendance/mark', {
                dayId: selectedDay.id,
                cadetId,
                status: status || 'present', // Default to present if null
                remarks
            });
        } catch (err) {
            console.error('Failed to save remark', err);
        }
    };

    // Filter logic
    const filteredRecords = attendanceRecords.filter(record => {
        const matchesCompany = filterCompany ? record.company === filterCompany : true;
        const matchesPlatoon = filterPlatoon ? record.platoon === filterPlatoon : true;
        const matchesSearch = searchTerm ? 
            `${record.last_name} ${record.first_name}`.toLowerCase().includes(searchTerm.toLowerCase()) : true;
        return matchesCompany && matchesPlatoon && matchesSearch;
    });

    // Stats
    const stats = attendanceRecords.reduce((acc, curr) => {
        const status = curr.status || 'unmarked';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="flex flex-col md:flex-row h-full md:h-[calc(100vh-100px)] gap-6">
            {/* Sidebar List */}
            <div className={`w-full md:w-1/3 bg-white rounded shadow flex flex-col ${selectedDay ? 'hidden md:flex' : ''}`}>
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t">
                    <h2 className="font-bold text-lg text-gray-700">Training Days</h2>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-green-700 text-white p-2 rounded hover:bg-green-800"
                        title="Add Training Day"
                    >
                        <Plus size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {days.map(day => (
                        <div 
                            key={day.id}
                            onClick={() => selectDay(day)}
                            className={`p-4 rounded border cursor-pointer transition ${
                                selectedDay?.id === day.id ? 'bg-green-50 border-green-500' : 'hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-gray-800">{day.title}</div>
                                    <div className="text-sm text-gray-500 flex items-center mt-1">
                                        <Calendar size={14} className="mr-1" />
                                        {new Date(day.date).toLocaleDateString()}
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => handleDeleteDay(day.id, e)}
                                    className="text-gray-400 hover:text-red-600"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {days.length === 0 && <div className="p-4 text-center text-gray-500">No training days found.</div>}
                </div>
            </div>

            {/* Main Content */}
            <div className={`w-full md:w-2/3 bg-white rounded shadow flex flex-col ${!selectedDay ? 'hidden md:flex' : ''}`}>
                {selectedDay ? (
                    <>
                        <div className="p-4 border-b bg-gray-50 rounded-t">
                            <div className="flex flex-col md:flex-row justify-between items-start mb-4">
                                <div>
                                    <button onClick={() => setSelectedDay(null)} className="md:hidden text-gray-500 mb-2 flex items-center text-sm">
                                        <ChevronRight className="rotate-180 mr-1" size={16} /> Back to List
                                    </button>
                                    <h2 className="text-2xl font-bold text-gray-800">{selectedDay.title}</h2>
                                    <p className="text-gray-600 mt-1">{selectedDay.description || 'No description'}</p>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2 md:mt-0 text-sm">
                                    <div className="flex items-center text-green-700 bg-green-50 px-2 py-1 rounded"><CheckCircle size={16} className="mr-1"/> Present: {stats.present || 0}</div>
                                    <div className="flex items-center text-red-700 bg-red-50 px-2 py-1 rounded"><XCircle size={16} className="mr-1"/> Absent: {stats.absent || 0}</div>
                                    <div className="flex items-center text-yellow-700 bg-yellow-50 px-2 py-1 rounded"><Clock size={16} className="mr-1"/> Late: {stats.late || 0}</div>
                                    <div className="flex items-center text-blue-700 bg-blue-50 px-2 py-1 rounded"><AlertTriangle size={16} className="mr-1"/> Excused: {stats.excused || 0}</div>
                                </div>
                            </div>
                            
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <input 
                                    placeholder="Search Name..." 
                                    className="border p-2 rounded"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                <input 
                                    placeholder="Filter Company" 
                                    className="border p-2 rounded"
                                    value={filterCompany}
                                    onChange={e => setFilterCompany(e.target.value)}
                                />
                                <input 
                                    placeholder="Filter Platoon" 
                                    className="border p-2 rounded"
                                    value={filterPlatoon}
                                    onChange={e => setFilterPlatoon(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 border-b">Cadet</th>
                                        <th className="p-3 border-b text-center">Status</th>
                                        <th className="p-3 border-b">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map(record => (
                                        <tr key={record.cadet_id} className="border-b hover:bg-gray-50">
                                            <td className="p-3">
                                                <div className="font-medium">{record.last_name}, {record.first_name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {record.rank} | {record.company || '-'}/{record.platoon || '-'}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex justify-center space-x-1">
                                                    {[
                                                        { val: 'present', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
                                                        { val: 'absent', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
                                                        { val: 'late', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
                                                        { val: 'excused', icon: AlertTriangle, color: 'text-blue-600', bg: 'bg-blue-100' }
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.val}
                                                            onClick={() => handleMarkAttendance(record.cadet_id, opt.val)}
                                                            className={`p-2 rounded-full transition ${
                                                                record.status === opt.val ? `${opt.bg} ${opt.color} ring-2 ring-offset-1 ring-${opt.color.split('-')[1]}-400` : 'text-gray-300 hover:bg-gray-100'
                                                            }`}
                                                            title={opt.val.charAt(0).toUpperCase() + opt.val.slice(1)}
                                                        >
                                                            <opt.icon size={20} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="relative">
                                                    <input 
                                                        className="border-b border-gray-300 focus:border-blue-500 outline-none w-full py-1 text-sm bg-transparent"
                                                        placeholder="Add remark..."
                                                        value={record.remarks || ''}
                                                        onChange={e => handleRemarkChange(record.cadet_id, e.target.value)}
                                                        onBlur={() => saveRemark(record.cadet_id, record.remarks, record.status)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Calendar size={64} className="mb-4 opacity-50" />
                        <p className="text-lg">Select a training day to view or mark attendance</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">New Training Day</h3>
                        <form onSubmit={handleCreateDay} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date</label>
                                <input 
                                    type="date" 
                                    required
                                    className="w-full border p-2 rounded"
                                    value={createForm.date}
                                    onChange={e => setCreateForm({...createForm, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Title</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="e.g., Drill Day 1"
                                    className="w-full border p-2 rounded"
                                    value={createForm.title}
                                    onChange={e => setCreateForm({...createForm, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea 
                                    className="w-full border p-2 rounded"
                                    rows="3"
                                    value={createForm.description}
                                    onChange={e => setCreateForm({...createForm, description: e.target.value})}
                                ></textarea>
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 py-2 border rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-2 bg-green-700 text-white rounded hover:bg-green-800"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;
