import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trophy, Award, TrendingUp, Users } from 'lucide-react';

const StaffAchievements = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch leaderboard (top 15 for staff view)
                const leaderboardRes = await axios.get('/api/recognition/leaderboard?limit=15');
                setLeaderboard(leaderboardRes.data);

            } catch (err) {
                console.error('Error fetching achievements:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="text-center p-10">Loading achievements...</div>;

    // Calculate some quick stats from leaderboard
    const totalLifetimeMerits = leaderboard.reduce((sum, entry) => sum + entry.lifetimeMerit, 0);
    const avgLifetimeMerit = leaderboard.length > 0 ? Math.round(totalLifetimeMerits / leaderboard.length) : 0;
    const topPerformer = leaderboard[0];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={32} />
                    Cadet Achievements
                </h1>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <Award size={32} className="opacity-80" />
                        <span className="text-3xl font-bold">{topPerformer?.lifetimeMerit || 0}</span>
                    </div>
                    <p className="text-sm opacity-90">Top Performer</p>
                    {topPerformer && (
                        <p className="text-xs opacity-75 mt-1">{topPerformer.name}</p>
                    )}
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <TrendingUp size={32} className="opacity-80" />
                        <span className="text-3xl font-bold">{avgLifetimeMerit}</span>
                    </div>
                    <p className="text-sm opacity-90">Average Lifetime Merit</p>
                    <p className="text-xs opacity-75 mt-1">Top 15 cadets</p>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <Users size={32} className="opacity-80" />
                        <span className="text-3xl font-bold">{leaderboard.length}</span>
                    </div>
                    <p className="text-sm opacity-90">Top Performers</p>
                    <p className="text-xs opacity-75 mt-1">Displayed</p>
                </div>
            </div>

            {/* Achievement Badges Legend */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Award className="text-blue-600" />
                    Achievement Levels
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { level: 'Bronze', icon: '🥉', threshold: '50+', color: 'bg-gradient-to-br from-yellow-700 to-yellow-900' },
                        { level: 'Silver', icon: '🥈', threshold: '100+', color: 'bg-gradient-to-br from-gray-300 to-gray-500' },
                        { level: 'Gold', icon: '🥇', threshold: '150+', color: 'bg-gradient-to-br from-yellow-400 to-yellow-600' },
                        { level: 'Platinum', icon: '💎', threshold: '200+', color: 'bg-gradient-to-br from-blue-300 to-purple-400' }
                    ].map(badge => (
                        <div 
                            key={badge.level}
                            className={`${badge.color} rounded-lg p-4 text-center text-white shadow`}
                        >
                            <div className="text-4xl mb-2">{badge.icon}</div>
                            <h3 className="text-sm font-bold">{badge.level}</h3>
                            <p className="text-xs opacity-90">{badge.threshold} Merits</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Performers Leaderboard */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Users className="text-green-600" />
                    Top 15 Performers
                </h2>
                
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 text-left font-semibold text-gray-600">Rank</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Name</th>
                                <th className="p-3 text-left font-semibold text-gray-600">Unit</th>
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

            {/* Motivational Message */}
            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg shadow p-6 border-l-4 border-green-500">
                <div className="flex items-start gap-4">
                    <TrendingUp className="text-green-600 flex-shrink-0" size={32} />
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Recognition System</h3>
                        <p className="text-gray-700">
                            The lifetime merit system tracks all cadet achievements throughout their ROTC journey. 
                            Even when cadets reach the 100-point ceiling, their continued excellence is recognized 
                            through lifetime merit points and achievement badges. Use this data to identify top 
                            performers for awards and leadership opportunities.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffAchievements;
