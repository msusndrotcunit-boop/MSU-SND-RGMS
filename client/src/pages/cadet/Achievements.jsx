import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trophy, Award, TrendingUp, Users } from 'lucide-react';
import ResponsiveTable from '../../components/ResponsiveTable';
import { useAuth } from '../../context/AuthContext';

const Achievements = () => {
    const { user } = useAuth();
    const [achievements, setAchievements] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user || user.role !== 'cadet') {
                setLoading(false);
                return;
            }
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
    }, [user]);

    if (loading) return <div className="text-center p-10">Loading achievements...</div>;

    return (
        <div className="space-y-8">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="border-l-4 border-[var(--primary-color)] pl-3">My Achievements & Recognition</span>
                </h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition flex items-center shadow-sm min-h-[44px] hover-highlight"
                    >
                        <Trophy size={18} className="mr-2 text-yellow-500" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Current Status Card */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)] overflow-hidden">
                <div className="bg-gradient-to-r from-[var(--primary-color)] to-green-600 p-8 text-white relative overflow-hidden">
                    {/* Decorative background icon */}
                    <Trophy className="absolute -right-8 -bottom-8 text-white/10 w-48 h-48 rotate-12" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="text-center md:text-left">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white/80 mb-2">Lifetime Merit Achievement</h3>
                            <div className="flex items-center justify-center md:justify-start gap-6">
                                <span className="text-7xl font-black">{achievements?.lifetimeMerit || 0}</span>
                                <div className="text-left">
                                    <p className="text-lg font-bold">Total Merits Earned</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
                                            Current Rank: {achievements?.rank || 'Cadet'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl border border-white/20 shadow-2xl transform hover:scale-110 transition-transform duration-500">
                            <div className="text-7xl drop-shadow-lg">
                                {achievements?.rank === 'Platinum' && '💎'}
                                {achievements?.rank === 'Gold' && '🥇'}
                                {achievements?.rank === 'Silver' && '🥈'}
                                {achievements?.rank === 'Bronze' && '🥉'}
                                {!achievements?.rank && '🎖️'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Achievement Badges Grid */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)] p-6">
                <div className="flex items-center gap-2 mb-8 border-b border-gray-100 dark:border-gray-800 pb-4">
                    <Award className="text-[var(--primary-color)]" size={24} />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Achievement Badges</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                
                <ResponsiveTable
                    data={leaderboard}
                    columns={[
                        {
                            key: 'rank',
                            label: 'Rank',
                            render: (_, entry, index) => (
                                <span className={`font-bold ${
                                    index === 0 ? 'text-yellow-600 text-xl' :
                                    index === 1 ? 'text-gray-500 text-lg' :
                                    index === 2 ? 'text-orange-600 text-lg' :
                                    'text-gray-700'
                                }`}>
                                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${entry.rank}`}
                                </span>
                            )
                        },
                        {
                            key: 'name',
                            label: 'Name',
                            render: (_, entry) => (
                                <span className="font-medium">{entry.name}</span>
                            )
                        },
                        {
                            key: 'unit',
                            label: 'Unit',
                            render: (_, entry) => (
                                <span className="text-sm text-gray-600">
                                    {entry.company} / {entry.platoon}
                                </span>
                            )
                        },
                        {
                            key: 'lifetimeMerit',
                            label: 'Lifetime Merits',
                            align: 'right',
                            render: (_, entry) => (
                                <span className="font-bold text-lg text-purple-600">
                                    {entry.lifetimeMerit}
                                </span>
                            )
                        },
                        {
                            key: 'badge',
                            label: 'Badge',
                            align: 'center',
                            render: (_, entry) => (
                                <div className="flex items-center justify-center gap-2">
                                    <span className="font-bold text-sm text-purple-700">
                                        {entry.lifetimeMerit}
                                    </span>
                                    <span className="text-2xl">
                                        {entry.badge?.icon || '-'}
                                    </span>
                                </div>
                            )
                        }
                    ]}
                    loading={loading}
                    emptyMessage="No achievement data available."
                    pagination={true}
                    itemsPerPage={10}
                    className="bg-white"
                />
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
