import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Moon, Sun, Lock, Save, Edit } from 'lucide-react';
import { cacheSingleton, getSingleton } from '../../utils/db';
import { useAuth } from '../../context/AuthContext';

const Profile = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState({
        rank: '',
        firstName: '',
        middleName: '',
        lastName: '',
        suffixName: '',
        username: '',
        email: '',
        contactNumber: '',
        address: '',
        course: '',
        yearLevel: '',
        schoolYear: '',
        battalion: '',
        company: '',
        platoon: '',
        cadetCourse: 'MS1',
        semester: '',
        status: 'Ongoing',
        studentId: '',
        profileCompleted: 0
    });
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchProfile();
        
        // Load Dark Mode Preference
        const isDark = localStorage.getItem('darkMode') === 'true';
        setDarkMode(isDark);
        if (isDark) {
            document.documentElement.classList.add('dark');
        }
    }, []);

    const updateProfileState = (data) => {
        setProfile({
            rank: data.rank || '',
            firstName: data.first_name,
            middleName: data.middle_name || '',
            lastName: data.last_name,
            suffixName: data.suffix_name || '',
            username: data.username || '',
            email: data.email,
            contactNumber: data.contact_number || '',
            address: data.address || '',
            course: data.course || '',
            yearLevel: data.year_level || '',
            schoolYear: data.school_year || '',
            battalion: data.battalion || '',
            company: data.company || '',
            platoon: data.platoon || '',
            cadetCourse: data.cadet_course || 'MS1',
            semester: data.semester || '',
            status: data.status || 'Ongoing',
            studentId: data.student_id || '',
            profileCompleted: data.profile_completed
        });

        if (data.profile_pic) {
            if (data.profile_pic.startsWith('data:')) {
                setPreview(data.profile_pic);
            } else {
                const normalizedPath = data.profile_pic.replace(/\\/g, '/');
                setPreview(`${import.meta.env.VITE_API_URL || ''}${normalizedPath}`);
            }
        }
    };

    const fetchProfile = async () => {
        try {
            // Try cache first
            try {
                const cached = await getSingleton('profiles', 'cadet');
                if (cached) {
                    updateProfileState(cached);
                    setLoading(false);
                }
            } catch {}

            const res = await axios.get('/api/cadet/profile');
            updateProfileState(res.data);
            await cacheSingleton('profiles', 'cadet', res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching profile:', err);
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await axios.put('/api/cadet/profile', profile);
            setSuccess('Profile updated. Logging out to apply changes...');
            
            // Logout and redirect to login
            setTimeout(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                // Force reload/redirect to login
                window.location.href = '/login';
            }, 1500);
            
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile');
            setSaving(false);
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

    const isLocked = profile.profileCompleted === 1;

    if (loading) return <div className="p-8 text-center dark:text-white">Loading profile...</div>;

    return (
        <div className={`max-w-4xl mx-auto p-6 transition-colors duration-200 ${darkMode ? 'dark:bg-gray-900' : ''}`}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* Header / Banner */}
                <div className="bg-gradient-to-r from-green-800 to-green-900 p-6 text-white relative">
                    <button 
                        onClick={toggleDarkMode}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
                        title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full bg-white/10 border-4 border-white overflow-hidden flex items-center justify-center">
                                {preview ? (
                                    <img 
                                        src={preview} 
                                        alt="Profile" 
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <User size={64} className="text-green-200" />
                                )}
                            </div>
                            <div className={`absolute bottom-0 right-0 p-2 rounded-full border-2 border-white ${isLocked ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 cursor-pointer'}`} title={isLocked ? "Editing Disabled" : "Edit Profile"}>
                                {isLocked ? <Lock size={16} className="text-white" /> : <Edit size={16} className="text-white" />}
                            </div>
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl font-bold">{profile.rank} {profile.firstName} {profile.lastName} {profile.suffixName}</h1>
                            <p className="text-green-200 text-lg mt-1">{profile.studentId}</p>
                            <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm border ${isLocked ? 'bg-green-700/50 border-green-600' : 'bg-yellow-500/50 border-yellow-400'}`}>
                                {isLocked ? <Lock size={14} className="mr-2" /> : <Edit size={14} className="mr-2" />}
                                <span>{isLocked ? 'Profile Locked' : 'Profile Editable'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Profile Details */}
                <div className="p-8">
                    {success && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                            {success}
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    {isLocked ? (
                         <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-8">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <Lock className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-200">
                                        Your profile is locked. To update your information, please contact your Training Staff or Administrator.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4 mb-8">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <Edit className="h-5 w-5 text-blue-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-blue-700 dark:text-blue-200">
                                        Please update your profile information below. Once you save, your profile will be <strong>locked</strong> and can only be changed by an administrator.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Personal Info */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b dark:border-gray-700 pb-2 flex items-center">
                                <User className="mr-2 text-green-700 dark:text-green-400" size={20} />
                                Personal Information
                            </h3>
                            <div className="space-y-4">
                                <ProfileField 
                                    label="Username" 
                                    name="username" 
                                    value={profile.username} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="First Name" 
                                    name="firstName" 
                                    value={profile.firstName} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Middle Name" 
                                    name="middleName" 
                                    value={profile.middleName} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Last Name" 
                                    name="lastName" 
                                    value={profile.lastName} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Suffix Name" 
                                    name="suffixName" 
                                    value={profile.suffixName} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Email Address" 
                                    name="email" 
                                    value={profile.email} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Contact Number" 
                                    name="contactNumber" 
                                    value={profile.contactNumber} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Address" 
                                    name="address" 
                                    value={profile.address} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                            </div>
                        </div>

                        {/* Military Info */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b dark:border-gray-700 pb-2 flex items-center">
                                <ShieldIcon className="mr-2 text-green-700 dark:text-green-400" size={20} />
                                Military Unit Information
                            </h3>
                            <div className="space-y-4">
                                <ProfileField 
                                    label="Battalion" 
                                    name="battalion" 
                                    value={profile.battalion} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Company" 
                                    name="company" 
                                    value={profile.company} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Platoon" 
                                    name="platoon" 
                                    value={profile.platoon} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Cadet Course" 
                                    name="cadetCourse" 
                                    value={profile.cadetCourse} 
                                    isLocked={isLocked} 
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                                <ProfileField 
                                    label="Status" 
                                    name="status" 
                                    value={profile.status} 
                                    isLocked={true} // Status always locked/admin managed
                                    onChange={handleChange} 
                                    darkMode={darkMode} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Academic Info */}
                    <div className="mt-8">
                         <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b dark:border-gray-700 pb-2 flex items-center">
                            <BookIcon className="mr-2 text-green-700 dark:text-green-400" size={20} />
                            Academic Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ProfileField 
                                label="Course" 
                                name="course" 
                                value={profile.course} 
                                isLocked={isLocked} 
                                onChange={handleChange} 
                                darkMode={darkMode} 
                            />
                            <ProfileField 
                                label="Year Level" 
                                name="yearLevel" 
                                value={profile.yearLevel} 
                                isLocked={isLocked} 
                                onChange={handleChange} 
                                darkMode={darkMode} 
                            />
                            <ProfileField 
                                label="School Year" 
                                name="schoolYear" 
                                value={profile.schoolYear} 
                                isLocked={isLocked} 
                                onChange={handleChange} 
                                darkMode={darkMode} 
                            />
                            <ProfileField 
                                label="Semester" 
                                name="semester" 
                                value={profile.semester} 
                                isLocked={isLocked} 
                                onChange={handleChange} 
                                darkMode={darkMode} 
                            />
                        </div>
                    </div>

                    {/* Save Button */}
                    {!isLocked && (
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50"
                            >
                                <Save className="mr-2" size={20} />
                                {saving ? 'Saving & Locking...' : 'Save & Lock Profile'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ProfileField = ({ label, name, value, isLocked, onChange, darkMode }) => (
    <div>
        <label className={`block text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</label>
        {isLocked ? (
            <p className={`mt-1 font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'} bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600`}>
                {value || 'N/A'}
            </p>
        ) : (
            <input 
                type="text" 
                name={name}
                value={value || ''} 
                onChange={onChange}
                className={`mt-1 block w-full rounded-md shadow-sm p-2 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-green-500 focus:border-green-500`}
            />
        )}
    </div>
);

// Helper Icons
const ShieldIcon = ({ size, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
);
const BookIcon = ({ size, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
);

export default Profile;