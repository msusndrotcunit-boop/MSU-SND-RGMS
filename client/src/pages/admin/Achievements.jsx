import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trophy, Award, TrendingUp, Users, BarChart3 } from 'lucide-react';

const AdminAchievements = () => {
    const [stats, setStats] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch system-wide statistics
                const statsRes = await axios.get('/api/recognition/stats');
                setStats(statsRes.data);

                // Fetch leaderboard (top 20 for admin view)
                const leaderboardRes = await axios.get('/api/recognition/leaderboard?limit=20');
                setLeaderboard(leaderboardRes.data);

            } catch (err) {
                console.error('Error fetching achievements:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="text-center p-10">Loading achievements data...</div>;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={32} />
                    Cadet Achievements & Recognition
                </h1>
            </div>

            {/* System Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <Users size={32} className="opacity-80" />
                        <span className="text-3xl font-bold">{stats?.totalCadets || 0}</span>
                    </div>
                    <p className="text-sm opacity-90">Total Cadets</p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <TrendingUp size={32} className="opacity-80" />
                        <span className="text-3xl font-bold">{stats?.averageLifetimeMerit || 0}</span>
                    </div>
                    <p className="text-sm opacity-90">Average Lifetime Merit</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <Award size={32} className="opacity-80" />
                        <span className="text-3xl font-bold">{stats?.maxLifetimeMerit || 0}</span>
                    </div>
                    <p className="text-sm opacity-90">Highest Lifetime Merit</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <BarChart3 size={32} className="opacity-80" />
                        <span className="text-3xl font-bold">{stats?.totalWastedPoints || 0}</span>
                    </div>
                    <p className="text-sm opacity-90">Total Wasted Points</p>
                    <p className="text-xs opacity-75 mt-1">Points beyond 100 ceiling</p>
                </div>
            </div>

            {/* Achievement Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Award className="text-blue-600" />
                    Achievement Distribution
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { level: 'Bronze', count: stats?.achievementCounts?.bronze || 0, icon: '🥉', color: 'from-yellow-700 to-yellow-900', threshold: '50+' },
                        { level: 'Silver', count: stats?.achievementCounts?.silver || 0, icon: '🥈', color: 'from-gray-300 to-gray-500', threshold: '100+' },
                        { level: 'Gold', count: stats?.achievementCounts?.gold || 0, icon: '🥇', color: 'from-yellow-400 to-yellow-600', threshold: '150+' },
                        { level: 'Platinum', count: stats?.achievementCounts?.platinum || 0, icon: '💎', color: 'from-blue-300 to-purple-400', threshold: '200+' }
                    ].map(badge => {
                        const percentage = stats?.totalCadets > 0 
                            ? ((badge.count / stats.totalCadets) * 100).toFixed(1)
                            : 0;
                        
                        return (
                            <div 
                                key={badge.level}
                                className={`bg-gradient-to-br ${badge.color} rounded-lg p-6 text-center text-white shadow-lg`}
                            >
                                <div className="text-6xl mb-3">{badge.icon}</div>
                                <h3 className="text-xl font-bold mb-1">{badge.level}</h3>
                                <p className="text-sm mb-3 opacity-90">{badge.threshold} Merits</p>
                                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                                    <p className="text-3xl font-bold">{badge.count}</p>
                                    <p className="text-xs opacity-90">cadets ({percentage}%)</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Top Performers Leaderboard */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Users className="text-green-600" />
                    Top 20 Performers
                </h2>
                
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 text-left font-semibold text-gray-600">Rank</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Name</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Unit</th>
                                <th className="p-3 text-right font-semibold text-gray-600">Current Merit</th>
                                <th className="p-3 text-right font-semibold text-gray-600">Demerits</th>
                                <th className="p-3 text-right font-semibold text-gray-600">Lifetime Merits</th>
                                <th className="p-3 text-center font-semibold text-gray-600">Badge</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((entry, index) => (
                                <tr 
                                    key={entry.cadetId} 
                                    className={`border-b hover:bg-gray-50 ${
                                        index < 3 ? 'bg-yellow-50' : ''
                                    }`}
                                >
                                    <td className="p-3">
                                        <span className={`font-bold ${
                                            index === 0 ? 'text-yellow-600 text-xl' :
                                            index === 1 ? 'text-gray-500 text-lg' :
                                            index === 2 ? 'text-orange-600 text-lg' :
                                            'text-gray-700'
                                        }`}>
                                            {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${entry.rank}`}
                                        </span>
                                    </td>
                                    <td className="p-3 font-medium">{entry.name}</td>
                                    <td className="p-3 text-sm text-gray-600">
                                        {entry.company} / {entry.platoon}
                                    </td>
                                    <td className="p-3 text-right font-semibold text-blue-600">
                                        {entry.currentMerit}
                                    </td>
                                    <td className="p-3 text-right font-semibold text-red-600">
                                        {entry.demerits}
                                    </td>
                                    <td className="p-3 text-right">
                                        <span className="font-bold text-lg text-purple-600">
                                            {entry.lifetimeMerit}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="font-bold text-sm text-purple-700">
                                                {entry.lifetimeMerit}
                                            </span>
                                            <span className="text-2xl">
                                                {entry.badge?.icon || '-'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Insights */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow p-6 border-l-4 border-indigo-500">
                <div className="flex items-start gap-4">
                    <TrendingUp className="text-indigo-600 flex-shrink-0" size={32} />
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Recognition System Insights</h3>
                        <div className="space-y-2 text-gray-700">
                            <p>
                                • <strong>{stats?.totalWastedPoints || 0} merit points</strong> have been earned beyond the 100-point ceiling, 
                                demonstrating exceptional cadet performance.
                            </p>
                            <p>
                                • <strong>{((stats?.achievementCounts?.silver || 0) / (stats?.totalCadets || 1) * 100).toFixed(1)}%</strong> of cadets 
                                have achieved Silver level (100+ lifetime merits) or higher.
                            </p>
                            <p>
                                • The average lifetime merit of <strong>{stats?.averageLifetimeMerit || 0} points</strong> shows 
                                {stats?.averageLifetimeMerit >= 75 ? ' excellent' : stats?.averageLifetimeMerit >= 50 ? ' good' : ' developing'} unit performance.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminAchievements;
