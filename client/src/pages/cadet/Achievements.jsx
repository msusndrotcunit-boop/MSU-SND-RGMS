import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trophy, Award, TrendingUp, Users } from 'lucide-react';

const Achievements = () => {
    const [achievements, setAchievements] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get current user's cadet ID
                const profileRes = await axios.get('/api/cadet/profile');
                const cadetId = profileRes.data.id;

                // Fetch achievements
                const achievementsRes = await axios.get(`/api/recognition/cadet/${cadetId}/achievements`);
                setAchievements(achievementsRes.data);

                // Fetch leaderboard
                const leaderboardRes = await axios.get('/api/recognition/leaderboard?limit=10');
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

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={32} />
                    My Achievements
                </h1>
            </div>

            {/* Current Status */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-8 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Lifetime Merit Achievement</h2>
                        <div className="flex items-center gap-4">
                            <span className="text-6xl font-extrabold">{achievements?.lifetimeMerit || 0}</span>
                            <div>
                                <p className="text-lg opacity-90">Total Merits Earned</p>
                                <p className="text-sm opacity-75">Current Rank: {achievements?.rank || 'Cadet'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-8xl">
                        {achievements?.rank === 'Platinum' && '💎'}
                        {achievements?.rank === 'Gold' && '🥇'}
                        {achievements?.rank === 'Silver' && '🥈'}
                        {achievements?.rank === 'Bronze' && '🥉'}
                        {!achievements?.rank && '🎖️'}
                    </div>
                </div>
            </div>

            {/* Achievement Badges */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Award className="text-blue-600" />
                    Achievement Badges
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { level: 'Bronze', threshold: 50, icon: '🥉', color: 'from-yellow-700 to-yellow-900' },
                        { level: 'Silver', threshold: 100, icon: '🥈', color: 'from-gray-300 to-gray-500' },
                        { level: 'Gold', threshold: 150, icon: '🥇', color: 'from-yellow-400 to-yellow-600' },
                        { level: 'Platinum', threshold: 200, icon: '💎', color: 'from-blue-300 to-purple-400' }
                    ].map(badge => {
                        const earned = achievements?.achievements?.some(a => a.level === badge.level);
                        const progress = Math.min(100, ((achievements?.lifetimeMerit || 0) / badge.threshold) * 100);
                        
                        return (
                            <div 
                                key={badge.level}
                                className={`relative rounded-lg p-6 text-center transition-all ${
                                    earned 
                                        ? `bg-gradient-to-br ${badge.color} text-white shadow-lg transform hover:scale-105` 
                                        : 'bg-gray-100 text-gray-400 opacity-60'
                                }`}
                            >
                                <div className="text-6xl mb-3">{badge.icon}</div>
                                <h3 className="text-xl font-bold mb-1">{badge.level}</h3>
                                <p className="text-sm mb-3">{badge.threshold}+ Merits</p>
                                
                                {!earned && (
                                    <div className="mt-3">
                                        <div className="w-full bg-gray-300 rounded-full h-2 mb-2">
                                            <div 
                                                className="bg-blue-500 h-2 rounded-full transition-all"
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-xs">
                                            {badge.threshold - (achievements?.lifetimeMerit || 0)} more needed
                                        </p>
                                    </div>
                                )}
                                
                                {earned && (
                                    <div className="absolute top-2 right-2">
                                        <span className="bg-white text-green-600 rounded-full px-2 py-1 text-xs font-bold">
                                            ✓ EARNED
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Next Milestone */}
            {achievements?.nextMilestone && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-6 border-2 border-blue-200">
                    <div className="flex items-center gap-4">
                        <div className="text-5xl">{achievements.nextMilestone.icon}</div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                Next Milestone: {achievements.nextMilestone.level}
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
                                        <div 
                                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-4 rounded-full transition-all"
                                            style={{ 
                                                width: `${((achievements.lifetimeMerit || 0) / achievements.nextMilestone.threshold) * 100}%` 
                                            }}
                                        ></div>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        {achievements.lifetimeMerit} / {achievements.nextMilestone.threshold} merits
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-indigo-600">
                                        {achievements.nextMilestone.pointsNeeded}
                                    </p>
                                    <p className="text-sm text-gray-600">more needed</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Leaderboard */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Users className="text-green-600" />
                    Top Performers
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
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Keep Up the Great Work!</h3>
                        <p className="text-gray-700">
                            Your lifetime merit points represent your dedication and excellence throughout your ROTC journey. 
                            Every merit earned contributes to your legacy, even when you've reached the 100-point ceiling. 
                            Continue striving for excellence!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Achievements;
