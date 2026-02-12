import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, User, Moon, Sun, Camera, Image as ImageIcon, Lock, AlertTriangle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../../context/AuthContext';
import { cacheSingleton, getSingleton } from '../../utils/db';
import { 
    RANK_OPTIONS, 
    YEAR_LEVEL_OPTIONS, 
    SCHOOL_YEAR_OPTIONS, 
    BATTALION_OPTIONS, 
    COMPANY_OPTIONS, 
    PLATOON_OPTIONS, 
    SEMESTER_OPTIONS, 
    COURSE_OPTIONS,
    CADET_COURSE_OPTIONS,
    STATUS_OPTIONS,
    GENDER_OPTIONS
} from '../../constants/options';

const Profile = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState({
        username: '',
        rank: '',
        firstName: '',
        middleName: '',
        lastName: '',
        suffixName: '',
        email: '',
        contactNumber: '',
        address: '',
        gender: '',
        course: '',
        yearLevel: '',
        schoolYear: '',
        battalion: '',
        company: '',
        platoon: '',
        cadetCourse: 'MS1',
        semester: '',
        status: 'Ongoing'
    });
    const [profilePic, setProfilePic] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const fileInputRef = useRef(null);

    // If profile is completed, it's locked.
    // However, we rely on user.isProfileCompleted from context which might be stale if we just updated it.
    // But since we logout immediately after completion, the next login will have it true.
    const isLocked = user?.isProfileCompleted;

    useEffect(() => {
        fetchProfile();
        
        // Load Dark Mode Preference
        const isDark = localStorage.getItem('darkMode') === 'true';
        setDarkMode(isDark);
        if (isDark) {
            document.documentElement.classList.add('dark');
        }
    }, []);

    const fetchProfile = async () => {
        try {
            const cacheKey = user?.cadetId ? `cadet:${user.cadetId}` : 'cadet';
            // Try cache first
            try {
                const cached = await getSingleton('profiles', cacheKey);
                if (cached) {
                    let data = cached.data && cached.timestamp ? cached.data : cached;
                    updateProfileState(data);
                    setLoading(false);
                }
            } catch {}
            
            // Fetch fresh
            const res = await axios.get('/api/cadet/profile');
            const data = res.data;
            updateProfileState(data);
            
            await cacheSingleton('profiles', cacheKey, { data, timestamp: Date.now() });
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const updateProfileState = (data) => {
        setProfile({
            username: data.username || '',
            rank: data.rank || '',
            firstName: data.first_name,
            middleName: data.middle_name || '',
            lastName: data.last_name,
            suffixName: data.suffix_name || '',
            email: data.email,
            contactNumber: data.contact_number || '',
            address: data.address || '',
            gender: data.gender || '',
            course: data.course || '',
            yearLevel: data.year_level || '',
            schoolYear: data.school_year || '',
            battalion: data.battalion || '',
            company: data.company || '',
            platoon: data.platoon || '',
            cadetCourse: data.cadet_course || 'MS1',
            semester: data.semester || '',
            status: data.status || 'Ongoing'
        });
        
        // Handle profile picture URL
        if (data.profile_pic) {
            const pic = data.profile_pic;
            
            // Case 1: Already a complete URL (Cloudinary or external)
            if (pic.startsWith('http://') || pic.startsWith('https://')) {
                // Ensure Cloudinary URLs use HTTPS and apply auto-optimizations
                let optimizedUrl = pic.replace('http://', 'https://');
                if (optimizedUrl.includes('cloudinary.com') && optimizedUrl.includes('/upload/')) {
                    if (!optimizedUrl.includes('q_auto')) {
                        optimizedUrl = optimizedUrl.replace('/upload/', '/upload/q_auto,f_auto/');
                    }
                }
                setPreview(optimizedUrl);
                return;
            }
            
            // Case 2: Base64 data URL
            if (pic.startsWith('data:')) {
                setPreview(pic);
                return;
            }
            
            // Case 3: Local file path - construct full URL
            let normalizedPath = pic.replace(/\\/g, '/');
            
            // Extract /uploads/ path if it exists
            const uploadsIndex = normalizedPath.indexOf('/uploads/');
            if (uploadsIndex !== -1) {
                normalizedPath = normalizedPath.substring(uploadsIndex);
            } else if (normalizedPath.includes('uploads/')) {
                // Handle case where path is like "uploads/123.jpg"
                normalizedPath = '/' + normalizedPath;
            } else if (!normalizedPath.startsWith('/')) {
                normalizedPath = '/' + normalizedPath;
            }
            
            // Get base URL
            const baseURL = axios.defaults.baseURL || import.meta.env.VITE_API_URL || '';
            
            if (baseURL) {
                setPreview(`${baseURL.replace(/\/+$/, '')}${normalizedPath}`);
            } else {
                // Fallback to relative path
                setPreview(normalizedPath);
            }
        } else {
            // No profile pic - use fallback endpoint
            if (user?.cadetId) {
                const baseURL = axios.defaults.baseURL || import.meta.env.VITE_API_URL || '';
                if (baseURL) {
                    setPreview(`${baseURL.replace(/\/+$/, '')}/api/images/cadets/${user.cadetId}`);
                } else {
                    setPreview(`/api/images/cadets/${user.cadetId}`);
                }
            }
        }
    };

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        localStorage.setItem('darkMode', newMode);
        if (newMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const handleFileChange = async (e) => {
        if (isLocked) return;
        const file = e.target.files[0];
        if (file) {
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            };

            try {
                const compressedFile = await imageCompression(file, options);
                setProfilePic(compressedFile);
                setPreview(URL.createObjectURL(compressedFile));
            } catch (error) {
                console.error("Image compression error:", error);
                setProfilePic(file);
                setPreview(URL.createObjectURL(file));
            }
        }
    };
    const openFilePicker = (mode) => {
        if (!fileInputRef.current || isLocked) return;
        try {
            if (mode === 'camera') {
                fileInputRef.current.setAttribute('capture', 'environment');
            } else {
                fileInputRef.current.removeAttribute('capture');
            }
            if (fileInputRef.current.showPicker) {
                fileInputRef.current.showPicker();
            } else {
                fileInputRef.current.click();
            }
        } catch {
            try { fileInputRef.current.click(); } catch {}
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isLocked) return;

        // Validation for First Time Completion
        if (!isLocked) {
            // Check if all required fields are filled
            const requiredFields = ['username', 'firstName', 'lastName', 'email', 'contactNumber', 'address', 'gender', 'course', 'yearLevel', 'schoolYear', 'battalion', 'company', 'platoon', 'cadetCourse', 'semester'];
            const missingFields = requiredFields.filter(field => !profile[field]);
            
            if (missingFields.length > 0) {
                alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
                return;
            }

            // Profile picture optional
        }

        const formData = new FormData();
        
        // Append all text fields
        Object.keys(profile).forEach(key => {
            formData.append(key, profile[key]);
        });

        // Append file if exists
        if (profilePic) {
            formData.append('profilePic', profilePic);
        }

        // If not locked, we are completing the profile
        if (!isLocked) {
            formData.append('is_profile_completed', 'true');
        }

        try {
            const res = await axios.put('/api/cadet/profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000
            });
            
            if (!isLocked) {
                alert('Profile completed successfully! You will now be logged out. Please sign in with your new credentials.');
                try { await cacheSingleton('profiles', user?.cadetId ? `cadet:${user.cadetId}` : 'cadet', null); } catch {}
                logout();
                navigate('/login');
            } else {
                alert('Profile updated successfully!');
                if (res.data.profilePic) {
                    let pic = res.data.profilePic;
                    if (typeof pic === 'string') {
                        if (pic.startsWith('http') || pic.startsWith('data:')) {
                            setPreview(pic);
                        } else {
                            if (!pic.startsWith('/')) pic = '/' + pic;
                            const baseA = (axios && axios.defaults && axios.defaults.baseURL) || '';
                            const baseB = import.meta.env.VITE_API_URL || '';
                            const baseC = (typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin)) ? window.location.origin : '';
                            const selectedBase = [baseA, baseB, baseC].find(b => b && /^https?:/.test(b)) || '';
                            setPreview(`${selectedBase.replace(/\/+$/,'')}${pic}`);
                        }
                    }
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || '';
            const isTimeout = msg.toLowerCase().includes('timeout') || err.code === 'ECONNABORTED';
            if (isTimeout && profilePic) {
                try {
                    const retryData = new FormData();
                    Object.keys(profile).forEach(key => retryData.append(key, profile[key]));
                    if (!isLocked) retryData.append('is_profile_completed', 'true');
                    const res2 = await axios.put('/api/cadet/profile', retryData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        timeout: 60000
                    });
                    if (!isLocked) {
                        alert('Profile completed successfully! You will now be logged out. Please sign in with your new credentials.');
                        try { await cacheSingleton('profiles', user?.cadetId ? `cadet:${user.cadetId}` : 'cadet', null); } catch {}
                        logout();
                        navigate('/login');
                    } else {
                        alert('Profile updated successfully! (Saved without photo due to timeout)');
                    }
                    return;
                } catch (err2) {
                    const msg2 = err2.response?.data?.message || err2.message;
                    alert('Error updating profile after retry: ' + msg2);
                    return;
                }
            }
            alert('Error updating profile: ' + msg);
        }
    };

    if (loading) return <div className="text-center p-10 dark:text-white">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10 px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">My Profile</h1>
                <div className="flex space-x-2 self-start sm:self-auto">
                    <button 
                        onClick={toggleDarkMode}
                        className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-full transition"
                    >
                        {darkMode ? <Sun className="text-yellow-400" size={20} /> : <Moon className="text-gray-600" size={20} />}
                        <span className="text-sm font-medium dark:text-white">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                    <button 
                        onClick={logout}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Profile Status Banner */}
            {!isLocked ? (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <div className="flex items-center">
                        <AlertTriangle className="text-yellow-500 mr-2" />
                        <div>
                            <p className="font-bold text-yellow-700">Profile Completion Required</p>
                            <p className="text-sm text-yellow-600">Please complete all fields and upload a profile picture to secure your account. Once saved, your profile will be locked.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                    <div className="flex items-center">
                        <Lock className="text-blue-500 mr-2" />
                        <div>
                            <p className="font-bold text-blue-700">Profile Locked</p>
                            <p className="text-sm text-blue-600">Your profile is verified and locked. Contact your administrator for any changes.</p>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {/* Left Column: Photo & Settings */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-center">
                        <div className="relative inline-block">
                            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-gray-100 mx-auto border-4 border-white dark:border-gray-700 shadow-lg">
                                {preview ? (
                                    <img 
                                        src={preview} 
                                        alt="Profile" 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                            console.error('Profile picture failed to load:', e.target.src);
                                            e.target.onerror = null; 
                                            
                                            // Try fallback endpoint if not already using it
                                            if (user?.cadetId && !String(e.target.src).includes(`/api/images/cadets/${user.cadetId}`)) {
                                                const baseURL = axios.defaults.baseURL || import.meta.env.VITE_API_URL || '';
                                                const fallbackUrl = baseURL 
                                                    ? `${baseURL.replace(/\/+$/, '')}/api/images/cadets/${user.cadetId}`
                                                    : `/api/images/cadets/${user.cadetId}`;
                                                console.log('Trying fallback URL:', fallbackUrl);
                                                e.target.src = fallbackUrl;
                                                return;
                                            }
                                            
                                            // Hide broken img and show placeholder
                                            e.target.style.display = 'none';
                                            e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <User size={64} />
                                    </div>
                                )}
                            </div>
                            {!isLocked && (
                                <>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    <button type="button" onClick={() => openFilePicker('camera')} className="absolute bottom-2 left-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 shadow-md">
                                        <Camera size={18} />
                                    </button>
                                    <button type="button" onClick={() => openFilePicker('files')} className="absolute bottom-2 right-2 bg-gray-700 text-white p-2 rounded-full hover:bg-gray-800 shadow-md">
                                        <ImageIcon size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                        <h2 className="mt-4 text-xl font-bold dark:text-white">{profile.lastName}, {profile.firstName}</h2>
                        <p className="text-gray-500 dark:text-gray-400">{profile.rank || 'Cadet'}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                         <h3 className="font-bold mb-4 dark:text-white">Account Status</h3>
                         <div className={`text-center p-3 rounded font-bold ${
                             profile.status === 'Ongoing' ? 'bg-green-100 text-green-800' :
                             profile.status === 'Failed' || profile.status === 'Drop' ? 'bg-red-100 text-red-800' :
                             'bg-gray-100 text-gray-800'
                         }`}>
                             {profile.status}
                         </div>
                    </div>
                </div>

                {/* Right Column: Form Fields */}
                <div className="md:col-span-2 bg-white dark:bg-gray-800 p-4 sm:p-6 lg:p-8 rounded-lg shadow">
                    <h3 className="text-xl font-bold mb-6 border-b pb-2 dark:text-white">Personal Information</h3>
                    
                    <div className="space-y-4">
                        {/* Credentials Section */}
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-100 dark:border-green-800 mb-4">
                            <h4 className="font-bold text-green-800 dark:text-green-300 mb-3 text-sm uppercase tracking-wide">Login Credentials</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username <span className="text-red-500">*</span></label>
                                    <input 
                                        className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" 
                                        value={profile.username} 
                                        onChange={e => setProfile({...profile, username: e.target.value})}
                                        disabled={isLocked}
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Used for login (no password needed)</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-red-500">*</span></label>
                                    <input 
                                        type="email"
                                        className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" 
                                        value={profile.email} 
                                        onChange={e => setProfile({...profile, email: e.target.value})}
                                        disabled={isLocked}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rank <span className="text-xs text-red-500">(Read-only)</span></label>
                                <input className="w-full border dark:border-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 p-2 rounded cursor-not-allowed" value={profile.rank} disabled />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Suffix</label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" value={profile.suffixName} onChange={e => setProfile({...profile, suffixName: e.target.value})} disabled={isLocked} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name <span className="text-red-500">*</span></label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" value={profile.firstName} onChange={e => setProfile({...profile, firstName: e.target.value})} disabled={isLocked} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Middle Name</label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" value={profile.middleName} onChange={e => setProfile({...profile, middleName: e.target.value})} disabled={isLocked} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name <span className="text-red-500">*</span></label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" value={profile.lastName} onChange={e => setProfile({...profile, lastName: e.target.value})} disabled={isLocked} required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Number <span className="text-red-500">*</span></label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" value={profile.contactNumber} onChange={e => setProfile({...profile, contactNumber: e.target.value})} disabled={isLocked} required />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.gender}
                                    onChange={e => setProfile({ ...profile, gender: e.target.value })}
                                    disabled={isLocked}
                                    required
                                >
                                    <option value="">Select Gender</option>
                                    {GENDER_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address <span className="text-red-500">*</span></label>
                            <textarea className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" rows="2" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} disabled={isLocked} required></textarea>
                        </div>

                        <h3 className="text-xl font-bold mt-8 mb-4 border-b pb-2 dark:text-white">Military &amp; School Info</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.course}
                                    onChange={e => setProfile({ ...profile, course: e.target.value })}
                                    disabled={isLocked}
                                    required
                                >
                                    <option value="">Select Course</option>
                                    {COURSE_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year Level <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.yearLevel}
                                    onChange={e => setProfile({ ...profile, yearLevel: e.target.value })}
                                    disabled={isLocked}
                                    required
                                >
                                    <option value="">Select Year Level</option>
                                    {YEAR_LEVEL_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School Year <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.schoolYear}
                                    onChange={e => setProfile({ ...profile, schoolYear: e.target.value })}
                                    disabled={isLocked}
                                    required
                                >
                                    <option value="">Select School Year</option>
                                    {SCHOOL_YEAR_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Battalion <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.battalion}
                                    onChange={e => setProfile({ ...profile, battalion: e.target.value })}
                                    disabled={isLocked}
                                    required
                                >
                                    <option value="">Select Battalion</option>
                                    {BATTALION_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.company}
                                    onChange={e => setProfile({ ...profile, company: e.target.value })}
                                    disabled={isLocked}
                                    required
                                >
                                    <option value="">Select Company</option>
                                    {COMPANY_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platoon <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.platoon}
                                    onChange={e => setProfile({ ...profile, platoon: e.target.value })}
                                    disabled={isLocked}
                                    required
                                >
                                    <option value="">Select Platoon</option>
                                    {PLATOON_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cadet Course <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.cadetCourse}
                                    onChange={e => setProfile({ ...profile, cadetCourse: e.target.value })}
                                    disabled={isLocked}
                                    required
                                >
                                    <option value="">Select Cadet Course</option>
                                    {CADET_COURSE_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.semester}
                                    onChange={e => setProfile({ ...profile, semester: e.target.value })}
                                    disabled={isLocked}
                                    required
                                >
                                    <option value="">Select Semester</option>
                                    {SEMESTER_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={profile.status}
                                    onChange={e => setProfile({ ...profile, status: e.target.value })}
                                    disabled={isLocked}
                                >
                                    <option value="">Select Status</option>
                                    {STATUS_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="pt-4">
                            {!isLocked && (
                                <button type="submit" className="flex items-center justify-center w-full bg-green-700 text-white py-3 rounded hover:bg-green-800 transition shadow">
                                    <Save className="mr-2" size={20} />
                                    Complete Profile & Logout
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default Profile;
