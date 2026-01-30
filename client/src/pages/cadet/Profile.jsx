import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Moon, Sun, Lock } from 'lucide-react';
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
        studentId: ''
    });
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

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
            studentId: data.student_id || ''
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
                            <div className="absolute bottom-0 right-0 bg-gray-500 p-2 rounded-full border-2 border-white cursor-not-allowed" title="Editing Disabled">
                                <Lock size={16} className="text-white" />
                            </div>
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl font-bold">{profile.rank} {profile.firstName} {profile.lastName} {profile.suffixName}</h1>
                            <p className="text-green-200 text-lg mt-1">{profile.studentId}</p>
                            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-green-700/50 text-sm border border-green-600">
                                <Lock size={14} className="mr-2" />
                                <span>Profile Locked</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Profile Details */}
                <div className="p-8">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Personal Info */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b dark:border-gray-700 pb-2 flex items-center">
                                <User className="mr-2 text-green-700 dark:text-green-400" size={20} />
                                Personal Information
                            </h3>
                            <div className="space-y-4">
                                <ProfileField label="Full Name" value={`${profile.firstName} ${profile.middleName} ${profile.lastName} ${profile.suffixName}`} darkMode={darkMode} />
                                <ProfileField label="Email Address" value={profile.email} darkMode={darkMode} />
                                <ProfileField label="Contact Number" value={profile.contactNumber} darkMode={darkMode} />
                                <ProfileField label="Address" value={profile.address} darkMode={darkMode} />
                            </div>
                        </div>

                        {/* Military Info */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b dark:border-gray-700 pb-2 flex items-center">
                                <ShieldIcon className="mr-2 text-green-700 dark:text-green-400" size={20} />
                                Military Unit Information
                            </h3>
                            <div className="space-y-4">
                                <ProfileField label="Battalion" value={profile.battalion} darkMode={darkMode} />
                                <ProfileField label="Company" value={profile.company} darkMode={darkMode} />
                                <ProfileField label="Platoon" value={profile.platoon} darkMode={darkMode} />
                                <ProfileField label="Cadet Course" value={profile.cadetCourse} darkMode={darkMode} />
                                <ProfileField label="Status" value={profile.status} darkMode={darkMode} />
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
                            <ProfileField label="Course" value={profile.course} darkMode={darkMode} />
                            <ProfileField label="Year Level" value={profile.yearLevel} darkMode={darkMode} />
                            <ProfileField label="School Year" value={profile.schoolYear} darkMode={darkMode} />
                            <ProfileField label="Semester" value={profile.semester} darkMode={darkMode} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProfileField = ({ label, value, darkMode }) => (
    <div>
        <label className={`block text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</label>
        <p className={`mt-1 font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'} bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600`}>
            {value || 'N/A'}
        </p>
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