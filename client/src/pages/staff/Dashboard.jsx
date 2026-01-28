import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';

const StaffDashboard = () => {
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const attendanceRes = await axios.get('/api/attendance/my-history/staff');
                setAttendanceLogs(attendanceRes.data);
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="text-center p-10">Loading...</div>;

    const presentCount = attendanceLogs.filter(log => log.status === 'present').length;
    const absentCount = attendanceLogs.filter(log => log.status === 'absent').length;
    const excusedCount = attendanceLogs.filter(log => log.status === 'excused').length;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">My Portal</h1>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-50 p-6 rounded shadow border-l-4 border-green-500">
                    <h3 className="text-green-800 font-bold uppercase text-sm">Present</h3>
                    <p className="text-3xl font-bold mt-2">{presentCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Training Days</p>
                </div>
                <div className="bg-red-50 p-6 rounded shadow border-l-4 border-red-500">
                    <h3 className="text-red-800 font-bold uppercase text-sm">Absent</h3>
                    <p className="text-3xl font-bold mt-2">{absentCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Training Days</p>
                </div>
                <div className="bg-blue-50 p-6 rounded shadow border-l-4 border-blue-500">
                    <h3 className="text-blue-800 font-bold uppercase text-sm">Excused</h3>
                    <p className="text-3xl font-bold mt-2">{excusedCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Training Days</p>
                </div>
            </div>

            {/* Attendance History */}
            <div className="bg-white rounded shadow p-6">
                <h2 className="text-xl font-bold mb-4 border-b pb-2 flex items-center">
                    <Calendar className="mr-2" size={20} />
                    Attendance History
                </h2>
                {attendanceLogs.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No attendance records found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {attendanceLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(log.date).toLocaleDateString(undefined, {
                                                weekday: 'short',
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${log.status === 'present' ? 'bg-green-100 text-green-800' : 
                                                  log.status === 'absent' ? 'bg-red-100 text-red-800' : 
                                                  'bg-blue-100 text-blue-800'}`}>
                                                {log.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {log.remarks || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffDashboard;
