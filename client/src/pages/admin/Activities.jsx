import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2, Plus, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { getSingleton, cacheSingleton } from '../../utils/db';

const Activities = () => {
    const [activities, setActivities] = useState([]);
    const [activeTab, setActiveTab] = useState('activity');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', date: '', images: [], type: 'activity' });
    
    // View Modal State
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [slideDirection, setSlideDirection] = useState('right');

    const announcementTemplate = `WHAT: 
WHEN: 
WHERE: 
WHO: 
HOW: 

NOTE: 
REMINDERS: `;

    useEffect(() => {
        fetchActivities();
    }, []);

    useEffect(() => {
        if (selectedActivity) {
            setLightboxIndex(0);
            setSlideDirection('right');
        }
    }, [selectedActivity]);

    const fetchActivities = async (forceRefresh = false) => {
        // 1. Load from Cache first
        if (!forceRefresh) {
            try {
                const cached = await getSingleton('admin', 'activities_list');
                if (cached) {
                    let data = cached;
                    let timestamp = 0;
                    
                    if (cached.data && cached.timestamp) {
                        data = cached.data;
                        timestamp = cached.timestamp;
                    } else if (Array.isArray(cached)) {
                        data = cached;
                    }

                    if (Array.isArray(data)) {
                        setActivities(data);
                        // If fresh (< 5 mins), return
                        if (timestamp && (Date.now() - timestamp < 5 * 60 * 1000)) {
                            return;
                        }
                    }
                }
            } catch (cacheErr) {
                console.warn("Failed to load from cache", cacheErr);
            }
        }

        // 2. Network Fetch
        try {
            const res = await axios.get('/api/cadet/activities');
            setActivities(res.data);
            await cacheSingleton('admin', 'activities_list', {
                data: res.data,
                timestamp: Date.now()
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            };

            const processedFiles = await Promise.all(files.map(async (file) => {
                try {
                    return await imageCompression(file, options);
                } catch (error) {
                    console.error("Image compression error:", error);
                    return file;
                }
            }));

            setForm({ ...form, images: processedFiles });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('title', form.title);
        formData.append('description', form.description);
        formData.append('date', form.date);
        formData.append('type', form.type);
        
        if (form.images && form.images.length > 0) {
            form.images.forEach(image => {
                formData.append('images', image);
            });
        }

        try {
            await axios.post('/api/admin/activities', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchActivities(true);
            setIsModalOpen(false);
            setForm({ title: '', description: '', date: '', images: [], type: activeTab });
        } catch (err) {
            alert('Error uploading activity');
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation(); // Prevent opening modal
        if (!confirm('Delete this activity?')) return;
        try {
            await axios.delete(`/api/admin/activities/${id}`);
            const updated = activities.filter(a => a.id !== id);
            setActivities(updated);
            await cacheSingleton('admin', 'activities_list', {
                data: updated,
                timestamp: Date.now()
            });
        } catch (err) {
            alert('Error deleting activity');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Activity Management</h2>
                <button 
                    onClick={() => {
                        setForm({ ...form, type: activeTab });
                        setIsModalOpen(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded flex items-center space-x-2 hover:bg-blue-700"
                >
                    <Plus size={18} />
                    <span>New {activeTab === 'activity' ? 'Activity' : 'Announcement'}</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 mb-6 border-b">
                <button 
                    onClick={() => setActiveTab('activity')}
                    className={`px-6 py-2 font-medium transition-colors ${activeTab === 'activity' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Activities
                </button>
                <button 
                    onClick={() => setActiveTab('announcement')}
                    className={`px-6 py-2 font-medium transition-colors ${activeTab === 'announcement' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Announcements
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities
                    .filter(a => (a.type || 'activity') === activeTab)
                    .map(activity => (
                    <div 
                        key={activity.id} 
                        className="bg-white rounded shadow overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setSelectedActivity(activity)}
                    >
                        <div className="p-4">
                            <h3 className="font-bold text-xl mb-2">{activity.title}</h3>
                            <div className="flex items-center text-gray-500 text-sm mb-3">
                                <Calendar size={14} className="mr-1" />
                                {new Date(activity.date).toLocaleDateString()}
                            </div>
                            
                            {/* Image served via caching route */}
                            <div className="w-full h-48 mb-4 bg-gray-200 rounded overflow-hidden">
                                <img 
                                    src={
                                        activity.images && activity.images.length > 0 
                                        ? `/api/images/activity-images/${activity.images[0]}`
                                        : `/api/images/activities/${activity.id}`
                                    }
                                    alt={activity.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.target.style.display = 'none'} // Hide if no image
                                />
                                {activity.images && activity.images.length > 1 && (
                                    <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                                        +{activity.images.length - 1}
                                    </div>
                                )}
                            </div>

                            <p className="text-gray-600 mb-4 line-clamp-3">{activity.description}</p>
                            <button 
                                onClick={(e) => handleDelete(activity.id, e)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center z-10 relative"
                            >
                                <Trash2 size={16} className="mr-1" /> Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            {activities.filter(a => (a.type || 'activity') === activeTab).length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    No {activeTab}s found.
                </div>
            )}

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Add New {form.type === 'activity' ? 'Activity' : 'Announcement'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select 
                                    className="w-full border p-2 rounded" 
                                    value={form.type} 
                                    onChange={e => setForm({...form, type: e.target.value})}
                                >
                                    <option value="activity">Activity</option>
                                    <option value="announcement">Announcement</option>
                                </select>
                            </div>
                            
                            <input 
                                className="w-full border p-2 rounded" 
                                placeholder="Title" 
                                value={form.title} 
                                onChange={e => setForm({...form, title: e.target.value})} 
                                required 
                            />
                            <div className="relative">
                                <textarea 
                                    className="w-full border p-2 rounded h-48 font-mono text-sm" 
                                    placeholder={form.type === 'announcement' ? announcementTemplate : "Description"} 
                                    value={form.description} 
                                    onChange={e => setForm({...form, description: e.target.value})} 
                                />
                                {form.type === 'announcement' && !form.description && (
                                    <button 
                                        type="button"
                                        onClick={() => setForm({...form, description: announcementTemplate})}
                                        className="absolute top-2 right-2 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded border text-gray-600"
                                    >
                                        Insert Template
                                    </button>
                                )}
                            </div>
                            {form.type === 'announcement' && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Announcements must include WHAT, WHEN, WHERE, WHO, HOW, NOTE, and REMINDERS.
                                </p>
                            )}
                            <input 
                                type="date" 
                                className="w-full border p-2 rounded" 
                                value={form.date} 
                                onChange={e => setForm({...form, date: e.target.value})} 
                            />
                            <input 
                                type="file" 
                                className="w-full border p-2 rounded" 
                                onChange={handleFileChange} 
                                accept="image/*"
                                multiple
                            />
                            <div className="flex space-x-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="w-1/2 border py-2 rounded hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="w-1/2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Upload</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Modal (Facebook Style with Sliding) */}
            {selectedActivity && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-90 backdrop-blur-sm"
                    onClick={() => setSelectedActivity(null)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto flex flex-col md:flex-row overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Image Section */}
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
                                const hasMultipleImages = selectedActivity.images && selectedActivity.images.length > 0;
                                const currentImageSrc = hasMultipleImages
                                    ? `/api/images/activity-images/${selectedActivity.images[lightboxIndex]}`
                                    : (selectedActivity.image_path?.startsWith('data:')
                                        ? selectedActivity.image_path
                                        : `/api/images/activities/${selectedActivity.id}`); // Fallback for admin

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

                                        {/* Navigation Arrows */}
                                        {hasMultipleImages && selectedActivity.images.length > 1 && (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSlideDirection('left');
                                                        setTimeout(() => {
                                                            setLightboxIndex(prev => (prev - 1 + selectedActivity.images.length) % selectedActivity.images.length);
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
                                                            setLightboxIndex(prev => (prev + 1) % selectedActivity.images.length);
                                                        }, 0);
                                                    }}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-50 text-white rounded-full p-2 transition-all z-10"
                                                >
                                                    <ChevronRight size={32} />
                                                </button>
                                                
                                                {/* Image Counter */}
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm z-10">
                                                    {lightboxIndex + 1} / {selectedActivity.images.length}
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

export default Activities;