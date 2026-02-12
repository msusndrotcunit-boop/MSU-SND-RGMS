import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, Lock, Mail, Phone, Shield, MapPin, Calendar, Ruler, Activity, Flag, Globe, Facebook, Briefcase, Edit, Save, X, AlertTriangle, Camera } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getSingleton, cacheSingleton } from '../../utils/db';
import { getProfilePicUrl } from '../../utils/image';

// Dropdown Options
const UNIT_OPTIONS = ["MSU-SND ROTC UNIT"];
const MOBILIZATION_CENTER_OPTIONS = ["1002nd CDC", "10th RCDG", "RCPA"];
const NATIONALITY_OPTIONS = ["Filipino", "Others"];
const GENDER_OPTIONS = ["Male", "Female"];
const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed"];
const BLOOD_TYPE_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const LANGUAGE_OPTIONS = ["Tagalog", "Cebuano", "Meranao", "English"];
const COMBAT_BOOTS_OPTIONS = ["5R", "5W", "6R", "6W", "7R", "7W", "8R", "8W", "9R", "9W", "10R", "10W", "11R", "11W", "12R", "12W"];
const UNIFORM_SIZE_OPTIONS = ["Small Short", "Small Regular", "Small Long", "Medium Short", "Medium Regular", "Medium Long", "Large Short", "Large Regular", "Large Long"];
const BULLCAP_SIZE_OPTIONS = ["56", "57", "58", "59", "60"];
const AGE_OPTIONS = Array.from({ length: 48 }, (_, i) => (i + 18).toString());

const InfoItem = ({ icon: Icon, label, value, name, type = "text", options = null, multi = false, isEditing, formData, handleInputChange, toggleLanguage }) => {
    return (
        <div className="flex flex-col">
            <span className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                {Icon && <Icon size={12} />} {label}
            </span>
            {isEditing ? (
                options ? (
                    multi ? (
                        <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded bg-white">
                            {options.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => toggleLanguage(opt)}
                                    className={`px-2 py-1 text-xs rounded-full border ${
                                        (formData[name] || '').includes(opt)
                                            ? 'bg-green-600 text-white border-green-600'
                                            : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <select
                            name={name}
                            value={formData[name] || ''}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-green-500 bg-white"
                        >
                            <option value="">Select {label}</option>
                            {options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    )
                ) : (
                     <input
                        type={type}
                        name={name}
                        value={formData[name] || ''}
                        onChange={handleInputChange}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-green-500"
                        placeholder={label}
                    />
                )
            ) : (
                <span className="font-medium text-gray-900 break-words">{value || '-'}</span>
            )}
        </div>
    );
};

const StaffProfile = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [preview, setPreview] = useState(null);
    
    // For file upload
    const fileInputRef = useRef(null);
    const [showUploadConsent, setShowUploadConsent] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            // Try cache first
            const cached = await getSingleton('profiles', 'staff');
            if (cached) {
                // Handle both new { data, timestamp } and old formats
                let data = cached;
                let timestamp = 0;
                
                if (cached.data && cached.timestamp) {
                    data = cached.data;
                    timestamp = cached.timestamp;
                }
                
                setProfile(data);
                setFormData(data);
                const profilePicUrl = getProfilePicUrl(data.profile_pic, data.id, 'staff');
                setPreview(profilePicUrl);
                setLoading(false);

                // If cache is fresh (< 5 mins), skip fetch
                if (timestamp && (Date.now() - timestamp < 5 * 60 * 1000)) {
                    return;
                }
            }

            const res = await axios.get('/api/staff/me');
            setProfile(res.data);
            setFormData(res.data);
            const profilePicUrl = getProfilePicUrl(res.data.profile_pic, res.data.id, 'staff');
            setPreview(profilePicUrl);
            setLoading(false);
            
            // Update cache with timestamp
            await cacheSingleton('profiles', 'staff', {
                data: res.data,
                timestamp: Date.now()
            });
            
            // Check if profile is incomplete, if so, enable editing automatically
            if (!res.data.is_profile_completed) {
                setIsEditing(true);
                toast('Please complete your profile information.', { icon: 'ℹ️' });
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
            // If we have cached data, don't show error, just rely on cache
            if (!profile) {
                setError('Failed to load profile data.');
                setLoading(false);
            }
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleLanguageChange = (e) => {
        const options = e.target.options;
        const selectedValues = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                selectedValues.push(options[i].value);
            }
        }
        setFormData(prev => ({
            ...prev,
            language_spoken: selectedValues.join(', ')
        }));
    };
    
    // Helper to toggle language for custom multi-select UI
    const toggleLanguage = (lang) => {
        const currentLangs = formData.language_spoken ? formData.language_spoken.split(', ').filter(l => l) : [];
        let newLangs;
        if (currentLangs.includes(lang)) {
            newLangs = currentLangs.filter(l => l !== lang);
        } else {
            newLangs = [...currentLangs, lang];
        }
        setFormData(prev => ({
            ...prev,
            language_spoken: newLangs.join(', ')
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Basic validation
        const requiredFields = ['first_name', 'last_name', 'afpsn', 'address', 'contact_number', 'email', 'birthdate', 'gender'];
        const missing = requiredFields.filter(field => !formData[field]);
        if (missing.length > 0) {
            toast.error(`Please fill in required fields: ${missing.join(', ')}`);
            return;
        }

        try {
            let isMarkingComplete =
                formData.is_profile_completed === true ||
                formData.is_profile_completed === 'true' ||
                formData.is_profile_completed === 1 ||
                formData.is_profile_completed === '1';
            
            if (!profile.is_profile_completed) {
                isMarkingComplete = true;
                formData.is_profile_completed = true;
            }
            
            if (isMarkingComplete && !profile.is_profile_completed) {
                // Warn user about logout
                if (!window.confirm("Saving your profile will complete the setup and log you out. You will need to login again with your Email. Continue?")) {
                    return;
                }
            }

            const res = await axios.put('/api/staff/profile', formData);
            
            if (isMarkingComplete && !profile.is_profile_completed) {
                toast.success('Profile setup complete! Your username has been updated to your Email. Please login again using your Email.', { duration: 5000 });
                // Short delay to show toast
                setTimeout(() => {
                    logout();
                    navigate('/login');
                }, 3000);
            } else {
                const updatedData = { ...profile, ...formData };
                setProfile(updatedData);
                
                // Update cache
                await cacheSingleton('profiles', 'staff', {
                    data: updatedData,
                    timestamp: Date.now()
                });
                
                setIsEditing(false);
                toast.success('Profile updated successfully');
            }
            
        } catch (err) {
            console.error('Error updating profile:', err);
            toast.error(err.response?.data?.message || 'Failed to update profile');
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('image', file);

        try {
            const toastId = toast.loading('Uploading profile picture...');
            const res = await axios.post('/api/staff/profile/photo', uploadData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            toast.dismiss(toastId);
            toast.success('Profile picture updated');
            
            // Update profile with new image path
            const updatedProfile = { ...profile, profile_pic: res.data.filePath };
            setProfile(updatedProfile);
            setFormData(prev => ({ ...prev, profile_pic: res.data.filePath }));
            const profilePicUrl = getProfilePicUrl(res.data.filePath, profile.id, 'staff');
            setPreview(profilePicUrl);
            
            // Update cache
            await cacheSingleton('profiles', 'staff', {
                data: updatedProfile,
                timestamp: Date.now()
            });
            
        } catch (err) {
            console.error('Error uploading image:', err);
            toast.error('Failed to upload image');
        }
    };

    if (loading) return <div className="p-8 text-center">Loading profile...</div>;
    if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
    if (!profile) return <div className="p-8 text-center">No profile found.</div>;

    const commonProps = {
        isEditing,
        formData,
        handleInputChange,
        toggleLanguage
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                <div className="bg-gradient-to-r from-green-800 to-green-900 p-6 text-white relative">
                    
                    <div className="absolute top-4 right-4 flex gap-2">
                        {isEditing ? (
                            <>
                                <button 
                                    onClick={() => setIsEditing(false)}
                                    className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                                    title="Cancel"
                                >
                                    <X size={20} />
                                </button>
                            </>
                        ) : (
                            !profile.is_profile_completed ? (
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                                    title="Edit Profile"
                                >
                                    <Edit size={20} />
                                </button>
                            ) : (
                                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full" title="Profile Locked">
                                    <Lock size={20} className="text-white" />
                                </div>
                            )
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="relative group">
                            <div className="w-40 h-40 rounded-full bg-white/10 border-4 border-white overflow-hidden flex items-center justify-center shadow-xl relative">
                                <img 
                                    src={preview} 
                                    alt="Profile" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.src = `/api/images/staff/profile/${profile.id}`;
                                    }}
                                />
                                
                                {/* Camera Overlay */}
                                <div 
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    onClick={() => setShowUploadConsent(true)}
                                >
                                    <Camera className="text-white" size={32} />
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                        </div>
                        <div className="text-center md:text-left flex-1 w-full">
                            {isEditing ? (
                                <div className="space-y-3 text-gray-800 bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                                    <div className="flex flex-wrap gap-2">
                                        <input name="rank" value={formData.rank || ''} onChange={handleInputChange} placeholder="Rank" className="p-1 rounded w-20" />
                                        <input name="first_name" value={formData.first_name || ''} onChange={handleInputChange} placeholder="First Name" className="p-1 rounded flex-1" />
                                        <input name="last_name" value={formData.last_name || ''} onChange={handleInputChange} placeholder="Last Name" className="p-1 rounded flex-1" />
                                        <input name="suffix_name" value={formData.suffix_name || ''} onChange={handleInputChange} placeholder="Suffix" className="p-1 rounded w-20" />
                                    </div>
                                    <div className="flex gap-2">
                                        <input name="afpsn" value={formData.afpsn || ''} onChange={handleInputChange} placeholder="AFPSN" className="p-1 rounded w-full" />
                                    </div>
                                    <div className="flex gap-2">
                                        <input name="username" value={formData.username || ''} onChange={handleInputChange} placeholder="Username" className="p-1 rounded w-full bg-yellow-50" disabled title="Username will be updated to Email upon save" />
                                    </div>
                                    {/* Auto-completion notice */}
                                    {!profile.is_profile_completed && (
                                        <div className="mt-2 bg-blue-600/50 p-2 rounded text-xs text-white">
                                            <p>Completing this profile will update your username to your email address and require a re-login.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-3xl font-bold">{profile.rank} {profile.first_name} {profile.middle_name} {profile.last_name} {profile.suffix_name}</h1>
                                    <p className="text-green-200 text-lg mt-1">{profile.afpsn || 'No AFPSN'} | {profile.role || 'Training Staff'}</p>
                                    <p className="text-green-300 text-sm">@{profile.username || 'username'}</p>
                                </>
                            )}
                            
                            <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                                <div className="px-3 py-1 rounded-full bg-green-700/50 text-sm border border-green-600 flex items-center">
                                    <Briefcase size={14} className="mr-2" />
                                    {isEditing ? (
                                        <select name="rotc_unit" value={formData.rotc_unit || ''} onChange={handleInputChange} className="bg-transparent border-none text-white w-full focus:outline-none appearance-none">
                                            <option value="" className="text-black">Select Unit</option>
                                            {UNIT_OPTIONS.map(o => <option key={o} value={o} className="text-black">{o}</option>)}
                                        </select>
                                    ) : (
                                        profile.rotc_unit || 'No Unit'
                                    )}
                                </div>
                                <div className="px-3 py-1 rounded-full bg-green-700/50 text-sm border border-green-600 flex items-center">
                                    <MapPin size={14} className="mr-2" />
                                    {isEditing ? (
                                        <select name="mobilization_center" value={formData.mobilization_center || ''} onChange={handleInputChange} className="bg-transparent border-none text-white w-full focus:outline-none appearance-none">
                                            <option value="" className="text-black">Select Center</option>
                                            {MOBILIZATION_CENTER_OPTIONS.map(o => <option key={o} value={o} className="text-black">{o}</option>)}
                                        </select>
                                    ) : (
                                        profile.mobilization_center || 'No Center'
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Personal Details */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center text-green-800">
                                <User className="mr-2" size={20} /> Personal Information
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                                <InfoItem {...commonProps} icon={Calendar} label="Birthdate" value={profile.birthdate} name="birthdate" type="date" />
                                <InfoItem {...commonProps} icon={MapPin} label="Birthplace" value={profile.birthplace} name="birthplace" />
                                <InfoItem {...commonProps} icon={Activity} label="Age" value={profile.age} name="age" type="number" />
                                
                                <InfoItem {...commonProps} icon={Flag} label="Nationality" value={profile.nationality} name="nationality" options={NATIONALITY_OPTIONS} />
                                <InfoItem {...commonProps} icon={User} label="Gender" value={profile.gender} name="gender" options={GENDER_OPTIONS} />
                                <InfoItem {...commonProps} icon={User} label="Civil Status" value={profile.civil_status} name="civil_status" options={CIVIL_STATUS_OPTIONS} />
                                
                                <InfoItem {...commonProps} icon={Ruler} label="Height (cm)" value={profile.height} name="height" />
                                <InfoItem {...commonProps} icon={Activity} label="Weight (kg)" value={profile.weight} name="weight" />
                                <InfoItem {...commonProps} icon={Activity} label="Blood Type" value={profile.blood_type} name="blood_type" options={BLOOD_TYPE_OPTIONS} />
                                
                                <div className="col-span-2 md:col-span-3">
                                    <InfoItem {...commonProps} icon={Globe} label="Language Spoken" value={profile.language_spoken} name="language_spoken" options={LANGUAGE_OPTIONS} multi={true} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center text-green-800">
                                <Shield className="mr-2" size={20} /> Logistics & Sizes
                            </h3>
                            <div className="grid grid-cols-3 gap-6">
                                <InfoItem {...commonProps} label="Combat Boots" value={profile.combat_boots_size} name="combat_boots_size" options={COMBAT_BOOTS_OPTIONS} />
                                <InfoItem {...commonProps} label="Uniform Size" value={profile.uniform_size} name="uniform_size" options={UNIFORM_SIZE_OPTIONS} />
                                <InfoItem {...commonProps} label="Bullcap Size" value={profile.bullcap_size} name="bullcap_size" options={BULLCAP_SIZE_OPTIONS} />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Contact & QR (Mobile) */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center text-green-800">
                                <Phone className="mr-2" size={20} /> Contact Information
                            </h3>
                            <div className="space-y-4">
                                <InfoItem {...commonProps} icon={MapPin} label="Address" value={profile.address} name="address" />
                                <InfoItem {...commonProps} icon={Mail} label="Email Address" value={profile.email} name="email" type="email" />
                                <InfoItem {...commonProps} icon={Phone} label="Mobile Number" value={profile.contact_number} name="contact_number" />
                                <InfoItem {...commonProps} icon={Facebook} label="Facebook" value={profile.facebook_link} name="facebook_link" />
                            </div>
                        </div>

                        

                        {profile.is_profile_completed && !isEditing && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <Lock className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-yellow-700">
                                            Profile is locked. Contact admin for changes.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {!profile.is_profile_completed && !isEditing && (
                             <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700 font-bold">
                                            Action Required
                                        </p>
                                        <p className="text-sm text-red-700 mt-1">
                                            You must complete your profile information to access the Training Staff Portal features.
                                        </p>
                                        <button 
                                            onClick={() => setIsEditing(true)}
                                            className="mt-2 text-sm font-medium text-red-600 hover:text-red-500 underline"
                                        >
                                            Update Profile Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {isEditing && (
                    <div className="flex justify-end mt-6">
                        <button 
                            onClick={handleSubmit}
                            className="bg-green-700 hover:bg-green-800 text-white px-8 py-3 rounded-lg shadow-lg flex items-center text-lg font-bold transition-transform transform hover:scale-105"
                            title="Save Changes"
                        >
                            <Save size={24} className="mr-2" />
                            Save Profile
                        </button>
                    </div>
                )}
            </form>
            
            {showUploadConsent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <h4 className="text-lg font-bold text-gray-800 mb-2">Allow Camera or Files Access</h4>
                        <p className="text-sm text-gray-600 mb-4">
                            To update your profile picture, choose whether to use your camera or select from your gallery/files.
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

export default StaffProfile;
