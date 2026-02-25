import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Camera, User, Mail, Shield, Info, LayoutDashboard, Users, Calendar, GraduationCap, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cacheSingleton, getSingleton } from '../../utils/db';
import { getProfilePicUrl, getProfilePicFallback } from '../../utils/image';
import imageCompression from 'browser-image-compression';
import { toast } from 'react-hot-toast';

const AdminProfile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [showUploadConsent, setShowUploadConsent] = useState(false);
    const fileInputRef = React.useRef(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            try {
                const cached = await getSingleton('profiles', 'admin');
                if (cached) {
                    setProfile(cached);
                    const profilePicUrl = getProfilePicUrl(cached.profile_pic, user?.id, 'admin');
                    setPreview(profilePicUrl);
                }
            } catch {}
            const response = await axios.get('/api/admin/profile');
            setProfile(response.data);
            const profilePicUrl = getProfilePicUrl(response.data.profile_pic, user?.id, 'admin');
            setPreview(profilePicUrl);
            await cacheSingleton('profiles', 'admin', response.data);
        } catch (error) {
            console.error('Error fetching profile:', error);
            setError(error.response?.data?.message || 'Failed to load profile.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (e) => {
        setUploadError('');
        const selectedFile = e.target.files[0];
        if (!selectedFile) {
            setFile(null);
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(selectedFile.type)) {
            setUploadError('Invalid file type. Please upload a JPEG, PNG, or GIF image.');
            setFile(null);
            return;
        }

        const maxBytes = 5 * 1024 * 1024;
        let workingFile = selectedFile;

        try {
            if (selectedFile.size > maxBytes) {
                const options = {
                    maxSizeMB: 4.9,
                    maxWidthOrHeight: 1600,
                    useWebWorker: true,
                };
                const compressed = await imageCompression(selectedFile, options);
                if (compressed.size > maxBytes) {
                    setUploadError('Image is too large even after compression (max 5MB). Please choose a smaller image.');
                    setFile(null);
                    return;
                }
                workingFile = new File([compressed], selectedFile.name.replace(/\.(jpg|jpeg|png|gif)$/i, '.jpg'), { type: 'image/jpeg' });
            }
        } catch (err) {
            setUploadError('Failed to process the image. Please try another file.');
            setFile(null);
            return;
        }

        setFile(workingFile);
        setPreview(URL.createObjectURL(workingFile));
    };

    const handleUpload = async () => {
        setUploadError('');
        if (!file) return;

        const formData = new FormData();
        formData.append('profilePic', file);
        if (profile?.gender) formData.append('gender', profile.gender);

        try {
            setUploading(true);
            setUploadProgress(0);
            const toastId = toast.loading('Uploading profile picture...');
            await axios.put('/api/admin/profile', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (evt) => {
                    if (!evt.total) return;
                    const pct = Math.round((evt.loaded * 100) / evt.total);
                    setUploadProgress(pct);
                }
            });
            toast.dismiss(toastId);
            toast.success('Profile picture updated!');
            fetchProfile();
            setFile(null);
            setPreview(getProfilePicUrl(profile?.profile_pic, user?.id, 'admin'));
        } catch (error) {
            console.error('Error updating profile:', error);
            const msg = error.response?.data?.message || 'Failed to update profile.';
            setUploadError(msg);
            toast.error(msg);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };
    
    

    if (loading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!profile) return <div className="p-8 text-center text-red-500">Profile not found.</div>;

    return (
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">My Profile</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Picture Section */}
                <div className="md:col-span-1">
                    <div className="bg-white rounded shadow p-6 flex flex-col items-center h-full">
                        <div className="relative w-40 h-40 mb-6">
                            <img 
                                src={preview} 
                                alt="Profile" 
                                className="w-full h-full object-cover rounded-full border-4 border-gray-200 shadow-sm"
                                onError={(e) => {
                                    try {
                                        const fallback = getProfilePicFallback(profile?.id || 1, 'admin');
                                        e.target.src = fallback;
                                    } catch {
                                        e.target.src = '';
                                    }
                                }}
                            />
                            
                            <label 
                                className="absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-md transition-colors"
                                onClick={(e) => { e.preventDefault(); setShowUploadConsent(true); }}
                            >
                                <Camera size={20} />
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={handleFileChange} 
                                    ref={fileInputRef}
                                />
                            </label>
                        </div>

                        {file && (
                            <button 
                                onClick={handleUpload}
                                disabled={uploading}
                                className={`w-full px-4 py-2 rounded transition mb-2 font-medium ${uploading ? 'bg-green-400 text-white cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                            >
                                {uploading ? `Uploading… ${uploadProgress}%` : 'Save New Picture'}
                            </button>
                        )}
                        {uploadError && (
                            <div className="w-full text-sm text-red-600 mt-1 text-center">{uploadError}</div>
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
                                <div className="flex items-center text-gray-800 bg-gray-50 p-3 rounded border border-gray-100 overflow-hidden">
                                    <Mail size={18} className="mr-3 text-gray-400 flex-shrink-0" />
                                    <span className="font-medium break-all text-sm sm:text-base">{profile.email || 'msusndrotcunit@gmail.com'}</span>
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

            {/* Quick Links Section */}
            <div className="bg-white rounded shadow p-6">
                <h3 className="text-lg font-bold mb-6 flex items-center text-gray-800 border-b pb-2">
                    <ExternalLink className="mr-2 text-blue-600" size={20} /> Quick Links
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <button 
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex flex-col items-center justify-center p-4 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-600 transition-all border border-gray-100 group"
                    >
                        <LayoutDashboard className="mb-2 text-gray-400 group-hover:text-blue-500" size={24} />
                        <span className="text-xs font-semibold">Dashboard</span>
                    </button>
                    <button 
                        onClick={() => navigate('/admin/cadets')}
                        className="flex flex-col items-center justify-center p-4 rounded-lg bg-gray-50 hover:bg-green-50 hover:text-green-600 transition-all border border-gray-100 group"
                    >
                        <Users className="mb-2 text-gray-400 group-hover:text-green-500" size={24} />
                        <span className="text-xs font-semibold">Cadets</span>
                    </button>
                    <button 
                        onClick={() => navigate('/admin/attendance')}
                        className="flex flex-col items-center justify-center p-4 rounded-lg bg-gray-50 hover:bg-yellow-50 hover:text-yellow-600 transition-all border border-gray-100 group"
                    >
                        <Calendar className="mb-2 text-gray-400 group-hover:text-yellow-500" size={24} />
                        <span className="text-xs font-semibold">Attendance</span>
                    </button>
                    <button 
                        onClick={() => navigate('/admin/grading')}
                        className="flex flex-col items-center justify-center p-4 rounded-lg bg-gray-50 hover:bg-purple-50 hover:text-purple-600 transition-all border border-gray-100 group"
                    >
                        <GraduationCap className="mb-2 text-gray-400 group-hover:text-purple-500" size={24} />
                        <span className="text-xs font-semibold">Grading</span>
                    </button>
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
                            <span className="font-semibold text-gray-800">{import.meta.env.PACKAGE_VERSION}</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Developer</span>
                            <span className="font-semibold text-gray-800">JUNJIE L. BAHIAN</span>
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

            {showUploadConsent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <h4 className="text-lg font-bold text-gray-800 mb-2">Allow Camera or Files Access</h4>
                        <p className="text-sm text-gray-600 mb-4">
                            To update your profile photo, choose whether to use your camera or select from your gallery/files.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowUploadConsent(false)}
                                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        if (navigator.mediaDevices?.getUserMedia) {
                                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                                            try { stream.getTracks().forEach(t => t.stop()); } catch {}
                                        }
                                    } catch {}
                                    try {
                                        fileInputRef.current?.setAttribute('accept', 'image/*');
                                        fileInputRef.current?.setAttribute('capture', 'environment');
                                        fileInputRef.current?.click();
                                    } catch {}
                                    setShowUploadConsent(false);
                                }}
                                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                            >
                                Use Camera
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    try {
                                        fileInputRef.current?.setAttribute('accept', 'image/*');
                                        fileInputRef.current?.removeAttribute('capture');
                                        fileInputRef.current?.click();
                                    } catch {}
                                    setShowUploadConsent(false);
                                }}
                                className="px-4 py-2 text-sm rounded bg-green-700 text-white hover:bg-green-800"
                            >
                                Choose Files
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminProfile;
