import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Camera, User, Mail, Shield, Info } from 'lucide-react';
import { cacheSingleton, getSingleton } from '../../utils/db';

const AdminProfile = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            try {
                const cached = await getSingleton('profiles', 'admin');
                if (cached) setProfile(cached);
            } catch {}
            const response = await axios.get('/api/admin/profile');
            setProfile(response.data);
            await cacheSingleton('profiles', 'admin', response.data);
        } catch (error) {
            console.error('Error fetching profile:', error);
            setError(error.response?.data?.message || 'Failed to load profile.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        if (selectedFile) {
            setPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        const formData = new FormData();
        formData.append('profilePic', file);

        try {
            await axios.put('/api/admin/profile', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert('Profile picture updated!');
            fetchProfile();
            setFile(null);
            setPreview(null);
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile.');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!profile) return <div className="p-8 text-center text-red-500">Profile not found.</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">My Profile</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Picture Section */}
                <div className="md:col-span-1">
                    <div className="bg-white rounded shadow p-6 flex flex-col items-center h-full">
                        <div className="relative w-40 h-40 mb-6">
                            {preview || profile.profile_pic ? (
                                <img 
                                    src={preview || (profile.profile_pic.startsWith('data:') ? profile.profile_pic : `${import.meta.env.VITE_API_URL || ''}${profile.profile_pic.replace(/\\/g, '/')}`)} 
                                    alt="Profile" 
                                    className="w-full h-full object-cover rounded-full border-4 border-gray-200 shadow-sm"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                                    <User size={80} />
                                </div>
                            )}
                            
                            <label className="absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-md transition-colors">
                                <Camera size={20} />
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </label>
                        </div>

                        {file && (
                            <button 
                                onClick={handleUpload}
                                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition mb-2 font-medium"
                            >
                                Save New Picture
                            </button>
                        )}
                        
                        <p className="text-sm text-gray-500 text-center mt-2">
                            Click the camera icon to update your profile photo.
                        </p>
                    </div>
                </div>

                {/* Account Information Section */}
                <div className="md:col-span-2">
                    <div className="bg-white rounded shadow p-6 h-full">
                        <h3 className="text-lg font-bold mb-6 flex items-center text-gray-800 border-b pb-2">
                            <User className="mr-2 text-blue-600" size={20} /> Account Information
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Username</label>
                                <div className="flex items-center text-gray-800 bg-gray-50 p-3 rounded border border-gray-100">
                                    <User size={18} className="mr-3 text-gray-400" />
                                    <span className="font-medium">{profile.username}</span>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Email Address</label>
                                <div className="flex items-center text-gray-800 bg-gray-50 p-3 rounded border border-gray-100">
                                    <Mail size={18} className="mr-3 text-gray-400" />
                                    <span className="font-medium">{profile.email || 'No email provided'}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Account Role</label>
                                <div className="flex items-center text-gray-800 bg-gray-50 p-3 rounded border border-gray-100">
                                    <Shield size={18} className="mr-3 text-gray-400" />
                                    <span className="font-medium capitalize">Administrator</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* About the App Section */}
            <div className="bg-white rounded shadow p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center text-gray-800 border-b pb-2">
                    <Info className="mr-2 text-blue-600" size={20} /> About the App
                </h3>
                <div className="prose max-w-none text-gray-600">
                    <p className="mb-4">
                        The <strong>ROTC Grading Management System</strong> is a comprehensive platform designed to streamline the administrative and operational tasks of the ROTC unit. It facilitates efficient management of cadet records, grading, attendance tracking, and performance evaluation.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 bg-gray-50 p-4 rounded border border-gray-100">
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">System Name</span>
                            <span className="font-semibold text-gray-800">ROTC Grading Management System</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Version</span>
                            <span className="font-semibold text-gray-800">2.3.1</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Developer</span>
                            <span className="font-semibold text-gray-800">MSU-SND ROTC Unit</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Release Date</span>
                            <span className="font-semibold text-gray-800">January 2026</span>
                        </div>
                    </div>
                    
                    <div className="mt-6">
                        <h4 className="font-bold text-gray-800 mb-2">Key Features</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>Comprehensive Cadet Profiling & Management</li>
                            <li>Automated Grading & Transmutation System</li>
                            <li>Activity & Attendance Tracking</li>
                            <li>Secure Admin & Cadet Portals</li>
                            <li>User Approval & Access Control</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminProfile;
