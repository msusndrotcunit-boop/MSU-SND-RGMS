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
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="border-l-4 border-[var(--primary-color)] pl-3">Cadet Achievements & Recognition</span>
                </h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition flex items-center shadow-sm min-h-[44px] hover-highlight"
                    >
                        <Trophy size={18} className="mr-2 text-yellow-500" />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* System Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-blue-600 p-6 flex items-center gap-4">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full text-blue-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Cadets</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats?.totalCadets || 0}</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-green-600 p-6 flex items-center gap-4">
                    <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full text-green-600">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Avg Merit</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats?.averageLifetimeMerit || 0}</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-purple-600 p-6 flex items-center gap-4">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full text-purple-600">
                        <Award size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Max Merit</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats?.maxLifetimeMerit || 0}</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-amber-600 p-6 flex items-center gap-4">
                    <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full text-amber-600">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Wasted Pts</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats?.totalWastedPoints || 0}</div>
                    </div>
                </div>
            </div>

            {/* Achievement Distribution */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)] p-6">
                <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                    <Award className="text-[var(--primary-color)]" size={24} />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Achievement Distribution</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <ul role="list" className="divide-y divide-gray-200">
                    {leaderboard && leaderboard.length > 0 ? (
                        leaderboard.map((entry, index) => {
                            const rankEl = index < 3 
                                ? ['🥇', '🥈', '🥉'][index] 
                                : `#${entry.rank || index + 1}`;
                            const rankColor = index === 0
                                ? 'text-yellow-600'
                                : index === 1
                                ? 'text-gray-500'
                                : index === 2
                                ? 'text-orange-600'
                                : 'text-gray-700';
                            return (
                                <li key={`${entry.id || entry.name}-${index}`} className="py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <span className={`font-bold ${rankColor} ${index < 3 ? 'text-xl' : ''}`}>
                                            {rankEl}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="font-medium text-gray-900 truncate">{entry.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {entry.company} / {entry.platoon}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <span className="font-semibold text-purple-600">
                                            {entry.lifetimeMerit}
                                        </span>
                                        <span className="text-lg leading-none">
                                            {entry.badge?.icon || ''}
                                        </span>
                                    </div>
                                </li>
                            );
                        })
                    ) : (
                        <li className="py-6 text-center text-gray-500">No achievement data available.</li>
                    )}
                </ul>
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
