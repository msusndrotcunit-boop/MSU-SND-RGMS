import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, User, Camera } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { RANK_OPTIONS } from '../../constants/options';

const StaffProfile = () => {
    const [profile, setProfile] = useState({
        rank: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        suffix_name: '',
        email: '',
        contact_number: '',
        role: ''
    });
    const [profilePic, setProfilePic] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await axios.get('/api/staff/me'); // We need to create this endpoint or use /api/staff/:id if we know ID
            // Wait, standard pattern is /api/cadet/profile using session.
            // I need a /api/staff/profile endpoint in backend. 
            // Currently I have /api/staff CRUD (admin only). 
            // I should add a /profile endpoint in staff.js or modify it.
            // For now, let's assume /api/staff/profile exists, similar to cadet.
            setProfile(res.data);
            if (res.data.profile_pic) {
                if (res.data.profile_pic.startsWith('data:')) {
                    setPreview(res.data.profile_pic);
                } else {
                    const normalizedPath = res.data.profile_pic.replace(/\\/g, '/');
                    setPreview(`${import.meta.env.VITE_API_URL || ''}${normalizedPath}`);
                }
            }
            setLoading(false);
        } catch (err) {
            console.error('Error fetching profile:', err);
            // Fallback for dev if endpoint missing
            setLoading(false); 
        }
    };

    const handleChange = (e) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 800,
                    useWebWorker: true,
                };
                const compressedFile = await imageCompression(file, options);
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreview(reader.result);
                    setProfilePic(reader.result); // Store base64
                };
                reader.readAsDataURL(compressedFile);
            } catch (error) {
                console.error("Image compression error:", error);
                setMessage('Error processing image.');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            const payload = { ...profile };
            if (profilePic) {
                payload.profile_pic = profilePic;
            }

            await axios.put('/api/staff/profile', payload); // Need this endpoint too
            setMessage('Profile updated successfully!');
        } catch (err) {
            setMessage('Error updating profile: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>

            <div className="bg-white rounded-lg shadow p-8">
                {message && (
                    <div className={`p-4 rounded mb-6 ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Profile Picture */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative w-32 h-32 mb-4">
                            {preview ? (
                                <img src={preview} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-green-100" />
                            ) : (
                                <div className="w-full h-full rounded-full bg-green-100 flex items-center justify-center text-green-700">
                                    <User size={48} />
                                </div>
                            )}
                            <label className="absolute bottom-0 right-0 bg-green-700 text-white p-2 rounded-full cursor-pointer hover:bg-green-800 transition shadow-lg">
                                <Camera size={16} />
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                            </label>
                        </div>
                        <p className="text-sm text-gray-500">Click camera icon to update photo</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Read-Only Fields */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Rank</label>
                            <input
                                type="text"
                                value={profile.rank || ''}
                                disabled
                                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm px-3 py-2 cursor-not-allowed"
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Role</label>
                            <input
                                type="text"
                                value={profile.role || ''}
                                disabled
                                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm px-3 py-2 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">First Name</label>
                            <input
                                type="text"
                                value={profile.first_name || ''}
                                disabled
                                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm px-3 py-2 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Last Name</label>
                            <input
                                type="text"
                                value={profile.last_name || ''}
                                disabled
                                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm px-3 py-2 cursor-not-allowed"
                            />
                        </div>

                        {/* Editable Fields */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={profile.email || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                            <input
                                type="text"
                                name="contact_number"
                                value={profile.contact_number || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800 transition disabled:opacity-50"
                        >
                            <Save size={18} className="mr-2" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StaffProfile;
