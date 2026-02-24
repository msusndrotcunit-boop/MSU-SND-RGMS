import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trophy, Award, TrendingUp, Users } from 'lucide-react';
import ResponsiveTable from '../../components/ResponsiveTable';

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
                        Refresh
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-purple-600 p-6 flex items-center gap-4">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full text-purple-600">
                        <Award size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Top Performer</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{topPerformer?.lifetimeMerit || 0}</div>
                        {topPerformer && (
                            <div className="text-[10px] text-purple-600 font-bold mt-1 uppercase">{topPerformer.name}</div>
                        )}
                    </div>
                </div>
                
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-green-600 p-6 flex items-center gap-4">
                    <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full text-green-600">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Avg Merit</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{avgLifetimeMerit}</div>
                        <div className="text-[10px] text-green-600 font-bold mt-1 uppercase">Top 15 cadets</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-blue-600 p-6 flex items-center gap-4">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full text-blue-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Analyzed</div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{leaderboard.length}</div>
                        <div className="text-[10px] text-blue-600 font-bold mt-1 uppercase">Performers displayed</div>
                    </div>
                </div>
            </div>

            {/* Achievement Levels Legend */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)] p-6">
                <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                    <Award className="text-[var(--primary-color)]" size={24} />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Achievement Levels</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
