import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cacheData, getCachedData } from '../../utils/db';
import { toast } from 'react-hot-toast';
import WeatherAdvisory from '../../components/WeatherAdvisory';

const CadetHome = () => {
    const [activities, setActivities] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [slideDirection, setSlideDirection] = useState('right');
    const [activeTab, setActiveTab] = useState('activities');

    const getImages = (activity) => {
        if (!activity) return [];
        let imgs = [];

        if (Array.isArray(activity.images)) {
            imgs = activity.images;
        } else if (typeof activity.images === 'string') {
            try {
                const parsed = JSON.parse(activity.images);
                if (Array.isArray(parsed)) imgs = parsed;
            } catch {}
        }

        imgs = (imgs || []).filter(Boolean);

        if (imgs.length === 0 && activity.image_path) {
            const src = activity.image_path.startsWith('data:') || activity.image_path.startsWith('http')
                ? activity.image_path
                : activity.image_path;  // Return as-is, let browser resolve
            return [src];
        }

        return imgs.map((src) => {
            // If it's a data URL or full HTTP URL, return as-is
            if (src.startsWith('data:') || src.startsWith('http')) {
                return src;
            }
            // Otherwise, it's a relative path - return as-is
            return src;
        });
    };

    useEffect(() => {
        if (selectedActivity) {
            setLightboxIndex(0);
            setSlideDirection('right');
        }
    }, [selectedActivity]);

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                try {
                    const cached = await getCachedData('activities');
                    if (cached?.length) setActivities(cached);
                } catch {}
                const res = await axios.get('/api/cadet/activities');
                setActivities(res.data || []);
                await cacheData('activities', res.data || []);

            } catch (err) {
                console.error('Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, []);

    const filteredActivities = activities.filter(a => {
        const type = (a.type || 'activity').toLowerCase();
        return activeTab === 'activities' ? type === 'activity' : type === 'announcement';
    });

    const hasActivities = filteredActivities && filteredActivities.length > 0;

    useEffect(() => {
        if (!hasActivities) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % filteredActivities.length);
        }, 15000);

        return () => clearInterval(interval);
    }, [hasActivities, filteredActivities.length]);

    const goPrev = (e) => {
        e.stopPropagation();
        if (!hasActivities) return;
        setCurrentIndex((prev) => (prev - 1 + filteredActivities.length) % filteredActivities.length);
    };

    const goNext = (e) => {
        e.stopPropagation();
        if (!hasActivities) return;
        setCurrentIndex((prev) => (prev + 1) % filteredActivities.length);
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
            <WeatherAdvisory />
            <h1 className="text-3xl font-bold text-gray-800">Home</h1>
            <p className="text-gray-600">
                All ROTC activities and announcements from the administrator will appear here.
            </p>

            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex border-b mb-4">
                    <button
                        className={`py-2 px-4 font-bold ${activeTab === 'activities' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-green-600'}`}
                        onClick={() => { setActiveTab('activities'); setCurrentIndex(0); }}
                    >
                        Activities
                    </button>
                    <button
                        className={`py-2 px-4 font-bold ${activeTab === 'announcements' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500 hover:text-green-600'}`}
                        onClick={() => { setActiveTab('announcements'); setCurrentIndex(0); }}
                    >
                        Announcements
                    </button>
                </div>

                {!hasActivities && (
                    <div className="text-center text-gray-500 py-10">
                        No {activeTab} posted yet.
                    </div>
                )}

                {hasActivities && (
                    <div className="relative max-w-4xl mx-auto">
                        <div className="overflow-hidden rounded-lg shadow cursor-pointer">
                            <div
                                className="flex transition-transform duration-[2000ms] ease-in-out"
                                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                            >
                                {filteredActivities.map((activity) => (
                                    <div 
                                        key={activity.id} 
                                        className="w-full flex-shrink-0 bg-white"
                                        onClick={() => setSelectedActivity(activity)}
                                    >
                                        {(() => {
                                            const images = getImages(activity);
                                            const primary = images[0];
                                            if (!primary) return null;
                                            return (
                                                <div className="w-full bg-gray-100 flex justify-center items-center h-[400px]">
                                                    <img
                                                        src={primary}
                                                        alt={activity.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            );
                                        })()}
                                        <div className="p-6">
                                            <div className="flex items-center text-gray-500 text-sm mb-2">
                                                <Calendar size={16} className="mr-2" />
                                                {activity.date}
                                            </div>
                                            <h3 className="text-2xl font-bold mb-2">{activity.title}</h3>
                                            <p className="text-gray-700 whitespace-pre-line line-clamp-3">
                                                {activity.description || 'No description provided.'}
                                            </p>
                                            <p className="text-blue-600 text-sm mt-2">Click to view details</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {filteredActivities.length > 1 && (
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

                        {filteredActivities.length > 1 && (
                            <div className="flex justify-center mt-4 space-x-2">
                                {filteredActivities.map((activity, index) => (
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

            {/* Activity Detail Modal */}
            {selectedActivity && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-90 backdrop-blur-sm"
                    onClick={() => setSelectedActivity(null)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto flex flex-col md:flex-row overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Image Section (Facebook Style) */}
                        <div className="w-full md:w-2/3 bg-black flex items-center justify-center relative min-h-[300px] md:min-h-[600px] overflow-hidden">
                             {/* CSS for Sliding Animation */}
                             <style>{`
                                @keyframes slideInRight {
                                    from { transform: translateX(100%); opacity: 0; }
                                    to { transform: translateX(0); opacity: 1; }
                                }
                                @keyframes slideInLeft {
                                    from { transform: translateX(-100%); opacity: 0; }
                                    to { transform: translateX(0); opacity: 1; }
                                }
                                .animate-slide-in-right { animation: slideInRight 0.3s ease-out forwards; }
                                .animate-slide-in-left { animation: slideInLeft 0.3s ease-out forwards; }
                             `}</style>

                             {(() => {
                                const images = getImages(selectedActivity);
                                const hasImages = images.length > 0;
                                const currentImageSrc = hasImages ? images[lightboxIndex] : null;

                                return (
                                    <>
                                        {currentImageSrc ? (
                                            <img
                                                key={lightboxIndex}
                                                src={currentImageSrc}
                                                alt={selectedActivity.title}
                                                className={`max-w-full max-h-full object-contain ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
                                            />
                                        ) : (
                                            <div className="text-gray-500">No image available</div>
                                        )}

                                        {images.length > 1 && (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSlideDirection('left');
                                                        setTimeout(() => {
                                                            setLightboxIndex(prev => (prev - 1 + images.length) % images.length);
                                                        }, 0);
                                                    }}
                                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-50 text-white rounded-full p-2 transition-all z-10"
                                                >
                                                    <ChevronLeft size={32} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSlideDirection('right');
                                                        setTimeout(() => {
                                                            setLightboxIndex(prev => (prev + 1) % images.length);
                                                        }, 0);
                                                    }}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-50 text-white rounded-full p-2 transition-all z-10"
                                                >
                                                    <ChevronRight size={32} />
                                                </button>
                                                
                                                {/* Image Counter */}
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm z-10">
                                                    {lightboxIndex + 1} / {images.length}
                                                </div>
                                            </>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        {/* Details Section */}
                        <div className="w-full md:w-1/3 flex flex-col h-full bg-white">
                            <div className="flex justify-between items-center p-4 border-b">
                                <h3 className="text-xl font-bold text-gray-900 pr-4 truncate">{selectedActivity.title}</h3>
                                <button 
                                    onClick={() => setSelectedActivity(null)}
                                    className="text-gray-500 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            
                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="flex items-center text-gray-500 text-sm mb-4 bg-gray-50 p-2 rounded inline-block">
                                    <Calendar size={16} className="mr-2" />
                                    <span className="font-medium">{selectedActivity.date}</span>
                                </div>
                                
                                <div className="prose max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {selectedActivity.description}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CadetHome;

