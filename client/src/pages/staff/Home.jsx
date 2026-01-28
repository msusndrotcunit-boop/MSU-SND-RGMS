import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const StaffHome = () => {
    const [activities, setActivities] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedActivity, setSelectedActivity] = useState(null);

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                // Reuse the same activities endpoint as cadets
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

    useEffect(() => {
        if (!hasActivities) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % activities.length);
        }, 8000); // 8s cycle

        return () => clearInterval(interval);
    }, [hasActivities, activities.length]);

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
                Welcome, Training Staff! All ROTC activities and announcements will appear here.
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
                        <div className="overflow-hidden rounded-lg shadow cursor-pointer">
                            <div
                                className="flex transition-transform duration-[2000ms] ease-in-out"
                                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                            >
                                {activities.map((activity) => (
                                    <div 
                                        key={activity.id} 
                                        className="w-full flex-shrink-0 bg-white"
                                        onClick={() => setSelectedActivity(activity)}
                                    >
                                        {activity.image_path && (
                                            <div className="w-full bg-gray-100 flex justify-center items-center h-[400px]">
                                                <img
                                                    src={
                                                        activity.image_path.startsWith('data:')
                                                            ? activity.image_path
                                                            : `${import.meta.env.VITE_API_URL || ''}${activity.image_path.replace(/\\/g, '/')}`
                                                    }
                                                    alt={activity.title}
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                            </div>
                                        )}
                                        <div className="p-4 bg-gray-50">
                                            <h3 className="text-xl font-bold text-gray-800">{activity.title}</h3>
                                            <div className="text-sm text-gray-500 flex items-center mt-1">
                                                <Calendar size={14} className="mr-1" />
                                                {new Date(activity.date).toLocaleDateString()}
                                            </div>
                                            <p className="mt-2 text-gray-600 line-clamp-2">{activity.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal for Activity Details */}
            {selectedActivity && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setSelectedActivity(null)}>
                    <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-2xl font-bold text-gray-800">{selectedActivity.title}</h2>
                            <button onClick={() => setSelectedActivity(null)} className="text-gray-500 hover:text-gray-800">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            {selectedActivity.image_path && (
                                <img
                                    src={
                                        selectedActivity.image_path.startsWith('data:')
                                            ? selectedActivity.image_path
                                            : `${import.meta.env.VITE_API_URL || ''}${selectedActivity.image_path.replace(/\\/g, '/')}`
                                    }
                                    alt={selectedActivity.title}
                                    className="w-full h-auto rounded mb-6 object-contain max-h-[500px]"
                                />
                            )}
                            <div className="flex items-center text-gray-500 mb-4">
                                <Calendar size={18} className="mr-2" />
                                {new Date(selectedActivity.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                                {selectedActivity.description}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffHome;
