import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2, Plus, Calendar, X, Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { getSingleton, cacheSingleton } from '../../utils/db';

const Activities = () => {
    const [activities, setActivities] = useState([]);
    const [activeTab, setActiveTab] = useState('activity');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Activity Form State
    const [form, setForm] = useState({ title: '', description: '', date: '', images: [] });
    
    // Announcement Form State
    const [announcement, setAnnouncement] = useState({
        what: '', when: '', where: '', who: '', how: '', note: '', reminders: ''
    });

    useEffect(() => {
        fetchActivities();
    }, []);

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

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        const processedImages = [];
        
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };

        for (const file of files) {
            try {
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (activeTab === 'activity' && form.images.length < 3) {
            alert('Please upload at least 3 photos for an activity.');
            return;
        }
        if (activeTab === 'announcement' && form.images.length < 1) {
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
        } else {
            formData.append('description', form.description);
        }

        form.images.forEach((img) => {
            formData.append('images', img);
        });

        try {
            await axios.post('/api/admin/activities', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchActivities(true);
            setIsModalOpen(false);
            resetForms();
        } catch (err) {
            alert('Error uploading activity: ' + (err.response?.data?.message || err.message));
        }
    };

    const resetForms = () => {
        setForm({ title: '', description: '', date: '', images: [] });
        setAnnouncement({ what: '', when: '', where: '', who: '', how: '', note: '', reminders: '' });
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this item?')) return;
        try {
            await axios.delete(`/api/admin/activities/${id}`);
            const updated = activities.filter(a => a.id !== id);
            setActivities(updated);
            await cacheSingleton('admin', 'activities_list', { data: updated, timestamp: Date.now() });
        } catch (err) { alert('Error deleting item'); }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Activity Management</h2>
                <button 
                    onClick={() => {
                        resetForms();
                        setIsModalOpen(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded flex items-center space-x-2 hover:bg-blue-700"
                >
                    <Plus size={18} />
                    <span>New Post</span>
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
                    <div key={activity.id} className="bg-white rounded shadow overflow-hidden">
                        <div className="p-4">
                            <h3 className="font-bold text-xl mb-2">{activity.title}</h3>
                            <div className="flex items-center text-gray-500 text-sm mb-3">
                                <Calendar size={14} className="mr-1" />
                                {new Date(activity.date).toLocaleDateString()}
                            </div>
                            
                            {/* Display Primary Image */}
                            <div className="w-full h-48 mb-4 bg-gray-200 rounded overflow-hidden">
                                <img 
                                    src={`/api/images/activities/${activity.id}`} 
                                    alt={activity.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.target.style.display = 'none'} 
                                />
                            </div>

                            <p className="text-gray-600 mb-4 whitespace-pre-line line-clamp-3">{activity.description}</p>
                            <button 
                                onClick={() => handleDelete(activity.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
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

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-lg w-full max-w-2xl p-6 my-8">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Add New {activeTab === 'activity' ? 'Activity' : 'Announcement'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={24} /></button>
                        </div>
                        
                        {/* Tab Toggle inside Modal */}
                        <div className="flex space-x-4 mb-4 border-b pb-2">
                             <button 
                                onClick={() => setActiveTab('activity')}
                                className={`font-medium ${activeTab === 'activity' ? 'text-blue-600' : 'text-gray-500'}`}
                             >Activity</button>
                             <button 
                                onClick={() => setActiveTab('announcement')}
                                className={`font-medium ${activeTab === 'announcement' ? 'text-blue-600' : 'text-gray-500'}`}
                             >Announcement</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Title</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="mt-1 w-full border rounded p-2"
                                    value={form.title}
                                    onChange={e => setForm({...form, title: e.target.value})}
                                />
                            </div>
                            
                            {activeTab === 'activity' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea 
                                        required 
                                        className="mt-1 w-full border rounded p-2"
                                        rows="4"
                                        value={form.description}
                                        onChange={e => setForm({...form, description: e.target.value})}
                                    ></textarea>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">WHAT</label>
                                        <input type="text" required className="mt-1 w-full border rounded p-2" value={announcement.what} onChange={e => setAnnouncement({...announcement, what: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">WHEN</label>
                                        <input type="text" required className="mt-1 w-full border rounded p-2" value={announcement.when} onChange={e => setAnnouncement({...announcement, when: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">WHERE</label>
                                        <input type="text" required className="mt-1 w-full border rounded p-2" value={announcement.where} onChange={e => setAnnouncement({...announcement, where: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">WHO</label>
                                        <input type="text" required className="mt-1 w-full border rounded p-2" value={announcement.who} onChange={e => setAnnouncement({...announcement, who: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">HOW</label>
                                        <input type="text" required className="mt-1 w-full border rounded p-2" value={announcement.how} onChange={e => setAnnouncement({...announcement, how: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">NOTE</label>
                                        <textarea className="mt-1 w-full border rounded p-2" rows="2" value={announcement.note} onChange={e => setAnnouncement({...announcement, note: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">REMINDERS</label>
                                        <textarea className="mt-1 w-full border rounded p-2" rows="2" value={announcement.reminders} onChange={e => setAnnouncement({...announcement, reminders: e.target.value})} />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date</label>
                                <input 
                                    type="date" 
                                    required 
                                    className="mt-1 w-full border rounded p-2"
                                    value={form.date}
                                    onChange={e => setForm({...form, date: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Photos (Min: {activeTab === 'activity' ? 3 : 1})
                                </label>
                                <div className="mt-1 flex items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="flex text-sm text-gray-600">
                                            <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                                                <span>Upload files</span>
                                                <input type="file" multiple className="sr-only" onChange={handleFileChange} accept="image/*" />
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    {form.images.map((img, index) => (
                                        <div key={index} className="relative h-20 bg-gray-100 rounded overflow-hidden group">
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

                            <div className="flex justify-end space-x-3 pt-4 border-t">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Post {activeTab === 'activity' ? 'Activity' : 'Announcement'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Activities;
