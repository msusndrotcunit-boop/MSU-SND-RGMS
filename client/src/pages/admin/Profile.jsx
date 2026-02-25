import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Camera, User, Mail, Shield, Info, LayoutDashboard, Users, Calendar, GraduationCap, ExternalLink, Image as ImageIcon, X, RefreshCw } from 'lucide-react';
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
                        <div className="relative w-40 h-40 mb-6 group">
                            <img 
                                src={preview} 
                                alt="Profile" 
                                className={`w-full h-full object-cover rounded-full border-4 shadow-sm transition-all duration-300 ${file ? 'border-green-500 scale-105' : 'border-gray-200 group-hover:border-blue-400'}`}
                                onError={(e) => {
                                    try {
                                        const fallback = getProfilePicFallback(profile?.id || 1, 'admin');
                                        e.target.src = fallback;
                                    } catch {
                                        e.target.src = '';
                                    }
                                }}
                            />
                            
                            {/* Camera Overlay Button */}
                            <button 
                                type="button"
                                className="absolute bottom-1 right-1 bg-blue-600 text-white p-3 rounded-full cursor-pointer hover:bg-blue-700 shadow-lg transition-all hover:scale-110 active:scale-95 z-10"
                                onClick={(e) => { e.preventDefault(); setShowUploadConsent(true); }}
                                title="Update Photo"
                            >
                                <Camera size={20} />
                            </button>

                            {/* Hidden File Input */}
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleFileChange} 
                                ref={fileInputRef}
                            />
                        </div>

                        {file ? (
                            <div className="w-full space-y-2 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleUpload}
                                        disabled={uploading}
                                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-70"
                                    >
                                        {uploading ? (
                                            <>
                                                <RefreshCw size={18} className="animate-spin" />
                                                <span>{uploadProgress}%</span>
                                            </>
                                        ) : (
                                            <>
                                                <ImageIcon size={18} />
                                                <span>Confirm Upload</span>
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setFile(null);
                                            setPreview(getProfilePicUrl(profile?.profile_pic, user?.id, 'admin'));
                                        }}
                                        disabled={uploading}
                                        className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all border border-gray-200 disabled:opacity-50"
                                        title="Cancel / Retake"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <p className="text-[10px] text-center text-green-600 font-medium bg-green-50 py-1 rounded-full border border-green-100">
                                    Ready to upload • { (file.size / 1024).toFixed(1) } KB
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500 text-center mt-2 bg-gray-50 px-3 py-1.5 rounded-full">
                                Tap camera to change photo
                            </p>
                        )}
                        
                        {uploadError && (
                            <div className="w-full text-xs text-red-600 mt-2 text-center bg-red-50 py-2 px-3 rounded-lg border border-red-100 animate-in shake-in duration-300">
                                {uploadError}
                            </div>
                        )}
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

            {/* Quick Links Section - Redesigned & Relocated to bottom */}
            <div className="bg-[#F8FAFC] rounded-2xl shadow-sm p-6 sm:p-8 mt-8 border border-gray-100">
                <h3 className="text-xl font-bold mb-8 flex items-center text-gray-800 border-b border-gray-200 pb-3">
                    <ExternalLink className="mr-3 text-blue-600" size={24} /> Quick Management Links
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Dashboard */}
                    <button 
                        onClick={() => navigate('/admin/dashboard')}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white hover:bg-[#00D4FF] text-gray-700 hover:text-gray-900 transition-all duration-500 shadow-sm hover:shadow-xl border border-gray-100 min-h-[140px] relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#00D4FF]/5 rounded-bl-full group-hover:bg-white/10 transition-colors duration-500" />
                        <div className="mb-4 p-4 rounded-2xl bg-blue-50 group-hover:bg-white/20 transition-all duration-500 transform group-hover:scale-110">
                            <LayoutDashboard className="text-[#0062cc] group-hover:text-gray-900 transition-all duration-500 group-hover:rotate-[15deg]" size={32} />
                        </div>
                        <span className="text-sm font-extrabold uppercase tracking-widest">Dashboard</span>
                    </button>

                    {/* Cadets */}
                    <button 
                        onClick={() => navigate('/admin/cadets')}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white hover:bg-[#10B981] text-gray-700 hover:text-gray-900 transition-all duration-500 shadow-sm hover:shadow-xl border border-gray-100 min-h-[140px] relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#10B981]/5 rounded-bl-full group-hover:bg-white/10 transition-colors duration-500" />
                        <div className="mb-4 p-4 rounded-2xl bg-emerald-50 group-hover:bg-white/20 transition-all duration-500 transform group-hover:scale-110">
                            <Users className="text-[#059669] group-hover:text-gray-900 transition-all duration-500 group-hover:rotate-[15deg]" size={32} />
                        </div>
                        <span className="text-sm font-extrabold uppercase tracking-widest">Cadets</span>
                    </button>

                    {/* Attendance */}
                    <button 
                        onClick={() => navigate('/admin/attendance')}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white hover:bg-[#F59E0B] text-gray-700 hover:text-gray-900 transition-all duration-500 shadow-sm hover:shadow-xl border border-gray-100 min-h-[140px] relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#F59E0B]/5 rounded-bl-full group-hover:bg-white/10 transition-colors duration-500" />
                        <div className="mb-4 p-4 rounded-2xl bg-yellow-50 group-hover:bg-white/20 transition-all duration-500 transform group-hover:scale-110">
                            <Calendar className="text-[#D97706] group-hover:text-gray-900 transition-all duration-500 group-hover:rotate-[15deg]" size={32} />
                        </div>
                        <span className="text-sm font-extrabold uppercase tracking-widest">Attendance</span>
                    </button>

                    {/* Grading */}
                    <button 
                        onClick={() => navigate('/admin/grading')}
                        className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white hover:bg-[#8B5CF6] text-gray-700 hover:text-gray-900 transition-all duration-500 shadow-sm hover:shadow-xl border border-gray-100 min-h-[140px] relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#8B5CF6]/5 rounded-bl-full group-hover:bg-white/10 transition-colors duration-500" />
                        <div className="mb-4 p-4 rounded-2xl bg-purple-50 group-hover:bg-white/20 transition-all duration-500 transform group-hover:scale-110">
                            <GraduationCap className="text-[#7C3AED] group-hover:text-gray-900 transition-all duration-500 group-hover:rotate-[15deg]" size={32} />
                        </div>
                        <span className="text-sm font-extrabold uppercase tracking-widest">Grading</span>
                    </button>
                </div>
            </div>

            {showUploadConsent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="bg-blue-600 p-6 text-white text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Camera size={32} />
                            </div>
                            <h4 className="text-xl font-bold">Update Profile Photo</h4>
                            <p className="text-blue-100 text-sm mt-1">Choose your preferred method</p>
                        </div>

                        {/* Modal Options */}
                        <div className="p-4 grid grid-cols-1 gap-3">
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        if (navigator.mediaDevices?.getUserMedia) {
                                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                                            try { stream.getTracks().forEach(t => t.stop()); } catch {}
                                        }
                                        fileInputRef.current?.setAttribute('accept', 'image/*');
                                        fileInputRef.current?.setAttribute('capture', 'environment');
                                        fileInputRef.current?.click();
                                        setShowUploadConsent(false);
                                    } catch (err) {
                                        toast.error("Camera access denied or unavailable.");
                                        setShowUploadConsent(false);
                                    }
                                }}
                                className="flex items-center gap-4 p-4 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all group"
                            >
                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Camera size={20} />
                                </div>
                                <div className="text-left">
                                    <span className="block font-bold text-gray-800">Use Camera</span>
                                    <span className="text-xs text-gray-500">Take a new photo now</span>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    fileInputRef.current?.setAttribute('accept', 'image/*');
                                    fileInputRef.current?.removeAttribute('capture');
                                    fileInputRef.current?.click();
                                    setShowUploadConsent(false);
                                }}
                                className="flex items-center gap-4 p-4 rounded-xl hover:bg-green-50 border border-transparent hover:border-green-100 transition-all group"
                            >
                                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                                    <ImageIcon size={20} />
                                </div>
                                <div className="text-left">
                                    <span className="block font-bold text-gray-800">Gallery / Files</span>
                                    <span className="text-xs text-gray-500">Choose an existing image</span>
                                </div>
                            </button>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50 flex justify-center">
                            <button
                                type="button"
                                onClick={() => setShowUploadConsent(false)}
                                className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminProfile;
