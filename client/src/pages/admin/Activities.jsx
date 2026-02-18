import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2, Plus, Calendar, ChevronLeft, ChevronRight, X, Upload, Zap, Edit } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { getSingleton, cacheSingleton } from '../../utils/db';
import { Link } from 'react-router-dom';

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
            : activity.image_path;  // Don't prepend anything, let the browser resolve it
        return [src];
    }

    return imgs.map((src) => {
        // If it's a data URL or full HTTP URL, return as-is
        if (src.startsWith('data:') || src.startsWith('http')) {
            return src;
        }
        // Otherwise, it's a relative path like /uploads/filename - return as-is
        return src;
    });
};

const Activities = () => {
    const [activities, setActivities] = useState([]);
    const [activeTab, setActiveTab] = useState('activity');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Activity Form State
    const [form, setForm] = useState({ title: '', description: '', date: '', images: [] });
    const [existingImages, setExistingImages] = useState([]); // For edit mode
    
    // Announcement Form State
    const [announcement, setAnnouncement] = useState({
        what: '', when: '', where: '', who: '', how: '', note: '', reminders: ''
    });

    // View Modal State
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [slideDirection, setSlideDirection] = useState('right');

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
        if (!forceRefresh) {
            try {
                const cached = await getSingleton('admin', 'activities_list');
                if (cached) {
                    let data = cached.data || (Array.isArray(cached) ? cached : []);
                    let timestamp = cached.timestamp || 0;
                    if (Array.isArray(data)) {
                        setActivities(data);
                        if (timestamp && (Date.now() - timestamp < 5 * 60 * 1000)) return;
                    }
                }
            } catch (e) { console.warn(e); }
        }
        try {
            const res = await axios.get('/api/cadet/activities');
            setActivities(res.data);
            await cacheSingleton('admin', 'activities_list', { data: res.data, timestamp: Date.now() });
        } catch (err) { console.error(err); }
    };

    const [showUploadConsent, setShowUploadConsent] = useState(false);
    const fileInputRef = React.useRef(null);
    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        const processedImages = [];
        
        // Check if adding these files would exceed the limit for activities
        if (activeTab === 'activity') {
            const totalAfterUpload = existingImages.length + form.images.length + files.length;
            if (totalAfterUpload > 5) {
                alert(`Maximum 5 photos allowed for activities. You can only add ${5 - existingImages.length - form.images.length} more photo(s).`);
                return;
            }
        }
        
        // Validate file size (20MB max)
        const maxSize = 20 * 1024 * 1024; // 20MB in bytes
        for (const file of files) {
            if (file.size > maxSize) {
                alert(`File "${file.name}" is too large. Maximum size is 20MB.`);
                continue;
            }
            
            try {
                // For announcements, use lighter compression to preserve quality
                // For activities, use standard compression
                const options = activeTab === 'announcement' 
                    ? { maxSizeMB: 5, maxWidthOrHeight: 2048, useWebWorker: true }
                    : { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
                
                const compressed = await imageCompression(file, options);
                processedImages.push(compressed);
            } catch (error) {
                console.error("Compression error", error);
                processedImages.push(file);
            }
        }
        
        setForm(prev => ({ ...prev, images: [...prev.images, ...processedImages] }));
    };

    const removeImage = (index) => {
        setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const resetForms = () => {
        setForm({ title: '', description: '', date: '', images: [] });
        setAnnouncement({ what: '', when: '', where: '', who: '', how: '', note: '', reminders: '' });
        setExistingImages([]);
        setEditMode(false);
        setEditingId(null);
    };

    const handleEdit = (activity, e) => {
        if (e) e.stopPropagation();
        
        setEditMode(true);
        setEditingId(activity.id);
        setActiveTab(activity.type || 'activity');
        
        // Populate form
        setForm({
            title: activity.title,
            description: activity.description,
            date: activity.date,
            images: []
        });
        
        // Parse existing images
        const images = getImages(activity);
        setExistingImages(images);
        
        // Parse announcement fields if it's an announcement
        if (activity.type === 'announcement') {
            const desc = activity.description || '';
            const parseField = (label) => {
                const regex = new RegExp(`${label}:\\s*([^\\n]+)`, 'i');
                const match = desc.match(regex);
                return match ? match[1].trim() : '';
            };
            
            setAnnouncement({
                what: parseField('WHAT'),
                when: parseField('WHEN'),
                where: parseField('WHERE'),
                who: parseField('WHO'),
                how: parseField('HOW'),
                note: parseField('NOTE'),
                reminders: parseField('REMINDERS')
            });
        }
        
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        console.log('[Activities] Submit started', { editMode, editingId, activeTab });
        
        // Combine existing and new images for validation
        const totalImages = existingImages.length + form.images.length;
        
        console.log('[Activities] Image counts', { 
            existing: existingImages.length, 
            new: form.images.length, 
            total: totalImages 
        });
        
        // Validation
        if (activeTab === 'activity' && totalImages < 1) {
            alert('Please upload at least 1 photo for an activity.');
            return;
        }
        
        if (activeTab === 'activity' && totalImages > 5) {
            alert('Maximum 5 photos allowed for an activity.');
            return;
        }
        
        // Validation for announcements
        if (activeTab === 'announcement' && totalImages < 1) {
            alert('Please upload at least 1 photo for an announcement.');
            return;
        }

        const formData = new FormData();
        formData.append('title', form.title);
        formData.append('date', form.date || new Date().toISOString().split('T')[0]);
        formData.append('type', activeTab);
        
        if (activeTab === 'announcement') {
            const desc = `WHAT: ${announcement.what}\nWHEN: ${announcement.when}\nWHERE: ${announcement.where}\nWHO: ${announcement.who}\nHOW: ${announcement.how}\n\nNOTE: ${announcement.note}\nREMINDERS: ${announcement.reminders}`;
            formData.append('description', desc);
            console.log('[Activities] Announcement description:', desc);
        } else {
            formData.append('description', form.description);
        }

        // For edit mode, send existing images
        if (editMode) {
            formData.append('existingImages', JSON.stringify(existingImages));
            console.log('[Activities] Existing images:', existingImages);
        }

        // Append new images
        form.images.forEach((img) => {
            formData.append('images', img);
        });
        
        console.log('[Activities] FormData prepared, sending request...');

        try {
            if (editMode) {
                console.log('[Activities] Updating activity:', editingId);
                const response = await axios.put(`/api/admin/activities/${editingId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                console.log('[Activities] Update response:', response.data);
            } else {
                console.log('[Activities] Creating new activity');
                const response = await axios.post('/api/admin/activities', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                console.log('[Activities] Create response:', response.data);
            }
            fetchActivities(true);
            setIsModalOpen(false);
            resetForms();
        } catch (err) {
            console.error('[Activities] Error:', err);
            console.error('[Activities] Error response:', err.response?.data);
            alert(`Error ${editMode ? 'updating' : 'uploading'} activity: ` + (err.response?.data?.message || err.message));
        }
    };

    const handleDelete = async (id, e) => {
        if (e) e.stopPropagation();
        if (!confirm('Delete this item?')) return;
        try {
            await axios.delete(`/api/admin/activities/${id}`);
            const updated = activities.filter(a => a.id !== id);
            setActivities(updated);
            await cacheSingleton('admin', 'activities_list', { data: updated, timestamp: Date.now() });
        } catch (err) { alert('Error deleting item'); }
    };

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-3 bg-white dark:bg-gray-900 p-4 rounded shadow">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Activity Management</h2>
                <button 
                    onClick={() => {
                        resetForms();
                        setIsModalOpen(true);
                    }}
                    className="bg-[var(--primary-color)] text-white px-4 py-2 rounded flex items-center space-x-2 hover:opacity-90"
                >
                    <Plus size={18} />
                    <span>New Post</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 mb-6 border-b border-gray-200 dark:border-gray-700">
                <button 
                    onClick={() => setActiveTab('activity')}
                    className={`px-6 py-2 font-medium transition-colors ${
                        activeTab === 'activity' 
                            ? 'border-b-2 border-[var(--primary-color)] text-[var(--primary-color)]' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                    Activities
                </button>
                <button 
                    onClick={() => setActiveTab('announcement')}
                    className={`px-6 py-2 font-medium transition-colors ${
                        activeTab === 'announcement' 
                            ? 'border-b-2 border-[var(--primary-color)] text-[var(--primary-color)]' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                    Announcements
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {activities
                    .filter(a => (a.type || 'activity') === activeTab)
                    .map(activity => {
                        const images = getImages(activity);
                        const primary = images[0] || null;

                        return (
                            <div 
                                key={activity.id} 
                                className="bg-white dark:bg-gray-900 rounded shadow overflow-hidden border border-gray-100 dark:border-gray-800 cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => setSelectedActivity(activity)}
                            >
                                <div className="p-4">
                                    <h3 className="font-bold text-xl mb-2 text-gray-900 dark:text-gray-100">{activity.title}</h3>
                                    <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-3">
                                        <Calendar size={14} className="mr-1" />
                                        {new Date(activity.date).toLocaleDateString()}
                                    </div>
                                    
                                    <div className="w-full h-48 mb-4 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden relative">
                                        {primary ? (
                                            <img 
                                                src={primary}
                                                alt={activity.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                                    <polyline points="21 15 16 10 5 21"/>
                                                </svg>
                                            </div>
                                        )}
                                        {images.length > 1 && (
                                            <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                                                +{images.length - 1}
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-gray-600 dark:text-gray-300 mb-4 whitespace-pre-line line-clamp-3">{activity.description}</p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={(e) => handleEdit(activity, e)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center z-10 relative"
                                        >
                                            <Edit size={16} className="mr-1" /> Edit
                                        </button>
                                        <button 
                                            onClick={(e) => handleDelete(activity.id, e)}
                                            className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center z-10 relative"
                                        >
                                            <Trash2 size={16} className="mr-1" /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                })}
            </div>
            
            {activities.filter(a => (a.type || 'activity') === activeTab).length === 0 && (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                    No {activeTab}s found.
                </div>
            )}

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-[95vw] sm:max-w-md md:max-w-lg p-3 sm:p-4 my-4 sm:my-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">
                                {editMode ? 'Edit' : 'Add'} {activeTab === 'activity' ? 'Activity' : 'Announcement'}
                            </h3>
                            <button onClick={() => { setIsModalOpen(false); resetForms(); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Tab Toggle inside Modal */}
                        <div className="flex space-x-2 sm:space-x-4 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                             <button 
                                onClick={() => setActiveTab('activity')}
                                className={`font-medium text-xs sm:text-sm ${activeTab === 'activity' ? 'text-[var(--primary-color)]' : 'text-gray-500 dark:text-gray-400'}`}
                             >Activity</button>
                             <button 
                                onClick={() => setActiveTab('announcement')}
                                className={`font-medium text-xs sm:text-sm ${activeTab === 'announcement' ? 'text-[var(--primary-color)]' : 'text-gray-500 dark:text-gray-400'}`}
                             >Announcement</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Title</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                    value={form.title}
                                    onChange={e => setForm({...form, title: e.target.value})}
                                />
                            </div>
                            
                            {activeTab === 'activity' ? (
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
                                    <textarea 
                                        required 
                                        className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                        rows="3"
                                        value={form.description}
                                        onChange={e => setForm({...form, description: e.target.value})}
                                    ></textarea>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    <div className="col-span-1 sm:col-span-2">
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">WHAT</label>
                                        <input type="text" required className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" value={announcement.what} onChange={e => setAnnouncement({...announcement, what: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">WHEN</label>
                                        <input type="text" required className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" value={announcement.when} onChange={e => setAnnouncement({...announcement, when: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">WHERE</label>
                                        <input type="text" required className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" value={announcement.where} onChange={e => setAnnouncement({...announcement, where: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">WHO</label>
                                        <input type="text" required className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" value={announcement.who} onChange={e => setAnnouncement({...announcement, who: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">HOW</label>
                                        <input type="text" required className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" value={announcement.how} onChange={e => setAnnouncement({...announcement, how: e.target.value})} />
                                    </div>
                                    <div className="col-span-1 sm:col-span-2">
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">NOTE</label>
                                        <textarea className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" rows="2" value={announcement.note} onChange={e => setAnnouncement({...announcement, note: e.target.value})} />
                                    </div>
                                    <div className="col-span-1 sm:col-span-2">
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">REMINDERS</label>
                                        <textarea className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" rows="2" value={announcement.reminders} onChange={e => setAnnouncement({...announcement, reminders: e.target.value})} />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Date</label>
                                <input 
                                    type="date" 
                                    required 
                                    className="w-full border rounded p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                                    value={form.date}
                                    onChange={e => setForm({...form, date: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                                    Photos (Min: 1, Max: {activeTab === 'activity' ? '5' : 'Unlimited'})
                                </label>
                                
                                {/* Existing Images (Edit Mode) */}
                                {editMode && existingImages.length > 0 && (
                                    <div className="mt-2 mb-3">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Existing Images:</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {existingImages.map((imgSrc, index) => (
                                                <div key={index} className="relative h-16 sm:h-20 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden group">
                                                    <img 
                                                        src={imgSrc} 
                                                        alt="existing" 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => setExistingImages(existingImages.filter((_, i) => i !== index))}
                                                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="mt-2 flex items-center justify-center px-2 sm:px-4 pt-3 pb-4 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        <Upload className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-gray-400 dark:text-gray-500" />
                                        <div className="flex text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                                            <label 
                                                htmlFor="file-upload"
                                                className="relative cursor-pointer bg-white dark:bg-gray-900 rounded-md font-medium text-[var(--primary-color)] hover:opacity-90 focus-within:outline-none"
                                            >
                                                <span>{editMode ? 'Add More' : 'Upload'}</span>
                                                <input 
                                                    id="file-upload"
                                                    type="file" 
                                                    multiple 
                                                    className="sr-only" 
                                                    onChange={handleFileChange} 
                                                    accept="image/*" 
                                                    ref={fileInputRef}
                                                />
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG up to 20MB</p>
                                        {editMode && (
                                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                                Total: {existingImages.length + form.images.length}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* New Images */}
                                {form.images.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">New Images:</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {form.images.map((img, index) => (
                                                <div key={index} className="relative h-16 sm:h-20 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden group">
                                                    <img 
                                                        src={URL.createObjectURL(img)} 
                                                        alt="preview" 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => removeImage(index)}
                                                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-3 py-1.5 sm:px-4 sm:py-2 border rounded text-xs sm:text-sm text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[var(--primary-color)] text-white rounded text-xs sm:text-sm hover:opacity-90"
                                >
                                    {editMode ? 'Update' : 'Post'}
                                </button>
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

            <div className="mt-6 bg-[var(--primary-color)] text-white rounded-lg p-4 shadow-md">
                <div className="flex items-center mb-3 border-b border-white/20 pb-1">
                    <Zap size={18} className="text-yellow-400 mr-2" />
                    <span className="font-semibold text-sm uppercase tracking-wide">Quick Actions</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Link
                        to="/admin/data-analysis"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Data Analysis
                    </Link>
                    <Link
                        to="/admin/grading"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Grading
                    </Link>
                    <Link
                        to="/admin/activities"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/20 text-xs md:text-sm"
                    >
                        Activities
                    </Link>
                    <Link
                        to="/admin/messages"
                        className="flex items-center justify-center px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs md:text-sm"
                    >
                        Messages
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Activities;
