import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, User, Moon, Sun, Camera } from 'lucide-react';
import imageCompression from 'browser-image-compression';
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
    CADET_COURSE_OPTIONS 
} from '../../constants/options';

const Profile = () => {
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
        status: 'Ongoing'
    });
    const [profilePic, setProfilePic] = useState(null);
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

    const fetchProfile = async () => {
        try {
            try {
                const cached = await getSingleton('profiles', 'cadet');
                if (cached) {
                    const data = cached;
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
                        status: data.status || 'Ongoing'
                    });
                    if (data.profile_pic) {
                        if (data.profile_pic.startsWith('data:')) {
                            setPreview(data.profile_pic);
                        } else {
                            const normalizedPath = data.profile_pic.replace(/\\/g, '/');
                            setPreview(`${import.meta.env.VITE_API_URL || ''}${normalizedPath}`);
                        }
                    }
                    setLoading(false);
                }
            } catch {}
            const res = await axios.get('/api/cadet/profile');
            const data = res.data;
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
                status: data.status || 'Ongoing'
            });
            if (data.profile_pic) {
                if (data.profile_pic.startsWith('data:')) {
                    setPreview(data.profile_pic);
                } else {
                    const normalizedPath = data.profile_pic.replace(/\\/g, '/');
                    setPreview(`${import.meta.env.VITE_API_URL || ''}${normalizedPath}`);
                }
            }
            await cacheSingleton('profiles', 'cadet', data);
            setLoading(false);
        } catch (err) {
            console.error(err);
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

    const handleFileChange = async (e) => {
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        
        // Append all text fields
        Object.keys(profile).forEach(key => {
            formData.append(key, profile[key]);
        });

        // Append file if exists
        if (profilePic) {
            formData.append('profilePic', profilePic);
        }

        try {
            const res = await axios.put('/api/cadet/profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Profile updated successfully!');
            if (res.data.profilePic) {
                setPreview(`${import.meta.env.VITE_API_URL || ''}${res.data.profilePic}`);
            }
        } catch (err) {
            console.error(err);
            alert('Error updating profile');
        }
    };

    if (loading) return <div className="text-center p-10 dark:text-white">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">My Profile</h1>
                <button 
                    onClick={toggleDarkMode}
                    className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-full transition"
                >
                    {darkMode ? <Sun className="text-yellow-400" size={20} /> : <Moon className="text-gray-600" size={20} />}
                    <span className="text-sm font-medium dark:text-white">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
            </div>

            {/* About the App Section */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-lg border border-indigo-100 dark:border-indigo-800 mb-8">
                <h2 className="text-xl font-bold text-indigo-800 dark:text-indigo-300 mb-2">About the App</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                    The ROTC Grading Management System is the official platform for the MSU-SND ROTC Unit. 
                    This system streamlines the management of cadet records, attendance tracking, grading, and merit/demerit points.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-semibold text-gray-900 dark:text-gray-200">Version:</span> 
                        <span className="text-gray-600 dark:text-gray-400 ml-2">2.3.18</span>
                    </div>
                    <div>
                        <span className="font-semibold text-gray-900 dark:text-gray-200">Developer:</span> 
                        <span className="text-gray-600 dark:text-gray-400 ml-2">MSU-SND ROTC Unit</span>
                    </div>
                    <div>
                        <span className="font-semibold text-gray-900 dark:text-gray-200">Contact:</span> 
                        <span className="text-gray-600 dark:text-gray-400 ml-2">msusndrotcunit@gmail.com</span>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Photo & Settings */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-center">
                        <div className="relative inline-block">
                            <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-100 mx-auto border-4 border-white dark:border-gray-700 shadow-lg">
                                {preview ? (
                                    <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <User size={64} />
                                    </div>
                                )}
                            </div>
                            <label className="absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-md">
                                <Camera size={18} />
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </label>
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
                <div className="md:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-lg shadow">
                    <h3 className="text-xl font-bold mb-6 border-b pb-2 dark:text-white">Personal Information</h3>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rank <span className="text-xs text-red-500">(Read-only)</span></label>
                                <input className="w-full border dark:border-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 p-2 rounded cursor-not-allowed" value={profile.rank} disabled />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Suffix</label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500" value={profile.suffixName} onChange={e => setProfile({...profile, suffixName: e.target.value})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500" value={profile.firstName} onChange={e => setProfile({...profile, firstName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Middle Name</label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500" value={profile.middleName} onChange={e => setProfile({...profile, middleName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500" value={profile.lastName} onChange={e => setProfile({...profile, lastName: e.target.value})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Number</label>
                                <input className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500" value={profile.contactNumber} onChange={e => setProfile({...profile, contactNumber: e.target.value})} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                            <textarea className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500" rows="2" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})}></textarea>
                        </div>

                        <h3 className="text-xl font-bold mt-8 mb-4 border-b pb-2 dark:text-white">Military &amp; School Info</h3>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course</label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    value={profile.course}
                                    onChange={e => setProfile({ ...profile, course: e.target.value })}
                                >
                                    <option value="">Select Course</option>
                                    {COURSE_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year Level</label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    value={profile.yearLevel}
                                    onChange={e => setProfile({ ...profile, yearLevel: e.target.value })}
                                >
                                    <option value="">Select Year Level</option>
                                    {YEAR_LEVEL_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School Year</label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    value={profile.schoolYear}
                                    onChange={e => setProfile({ ...profile, schoolYear: e.target.value })}
                                >
                                    <option value="">Select School Year</option>
                                    {SCHOOL_YEAR_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Battalion</label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    value={profile.battalion}
                                    onChange={e => setProfile({ ...profile, battalion: e.target.value })}
                                >
                                    <option value="">Select Battalion</option>
                                    {BATTALION_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    value={profile.company}
                                    onChange={e => setProfile({ ...profile, company: e.target.value })}
                                >
                                    <option value="">Select Company</option>
                                    {COMPANY_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platoon</label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    value={profile.platoon}
                                    onChange={e => setProfile({ ...profile, platoon: e.target.value })}
                                >
                                    <option value="">Select Platoon</option>
                                    {PLATOON_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cadet Course</label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    value={profile.cadetCourse}
                                    onChange={e => setProfile({ ...profile, cadetCourse: e.target.value })}
                                >
                                    <option value="">Select Cadet Course</option>
                                    {CADET_COURSE_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                                <select
                                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-500"
                                    value={profile.semester}
                                    onChange={e => setProfile({ ...profile, semester: e.target.value })}
                                >
                                    <option value="">Select Semester</option>
                                    {SEMESTER_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button type="submit" className="flex items-center justify-center w-full bg-green-700 text-white py-3 rounded hover:bg-green-800 transition shadow">
                                <Save className="mr-2" size={20} />
                                Save Profile
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default Profile;
