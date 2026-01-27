import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const CadetHome = () => {
    const [activities, setActivities] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const res = await axios.get('/api/cadet/activities');
                setActivities(res.data || []);
            } catch (err) {
                console.error('Error fetching activities:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, []);

    const hasActivities = activities && activities.length > 0;

    const goPrev = () => {
        if (!hasActivities) return;
        setCurrentIndex((prev) => (prev - 1 + activities.length) % activities.length);
    };

    const goNext = () => {
        if (!hasActivities) return;
        setCurrentIndex((prev) => (prev + 1) % activities.length);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Home</h1>
            <p className="text-gray-600">
                All ROTC activities and announcements from the administrator will appear here.
            </p>

            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Activities &amp; Announcements</h2>

                {!hasActivities && (
                    <div className="text-center text-gray-500 py-10">
                        No activities or announcements have been posted yet.
                    </div>
                )}

                {hasActivities && (
                    <div className="relative max-w-4xl mx-auto">
                        <div className="overflow-hidden rounded-lg shadow">
                            <div
                                className="flex transition-transform duration-500 ease-out"
                                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                            >
                                {activities.map((activity) => (
                                    <div key={activity.id} className="w-full flex-shrink-0 bg-white">
                                        {activity.image_path && (
                                            <img
                                                src={
                                                    activity.image_path.startsWith('data:')
                                                        ? activity.image_path
                                                        : `${import.meta.env.VITE_API_URL || ''}${activity.image_path.replace(/\\/g, '/')}`
                                                }
                                                alt={activity.title}
                                                className="w-full h-64 object-cover"
                                            />
                                        )}
                                        <div className="p-6">
                                            <div className="flex items-center text-gray-500 text-sm mb-2">
                                                <Calendar size={16} className="mr-2" />
                                                {activity.date}
                                            </div>
                                            <h3 className="text-2xl font-bold mb-2">{activity.title}</h3>
                                            <p className="text-gray-700 whitespace-pre-line">
                                                {activity.description || 'No description provided.'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {activities.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={goPrev}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-700 rounded-full p-2 shadow-md"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    type="button"
                                    onClick={goNext}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-700 rounded-full p-2 shadow-md"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </>
                        )}

                        {activities.length > 1 && (
                            <div className="flex justify-center mt-4 space-x-2">
                                {activities.map((activity, index) => (
                                    <button
                                        key={activity.id}
                                        type="button"
                                        onClick={() => setCurrentIndex(index)}
                                        className={`w-3 h-3 rounded-full ${
                                            index === currentIndex ? 'bg-green-700' : 'bg-gray-300'
                                        }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CadetHome;

