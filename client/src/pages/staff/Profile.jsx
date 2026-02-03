import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, Lock, Mail, Phone, Shield, QrCode, MapPin, Calendar, Ruler, Activity, Flag, Globe, Facebook, Briefcase, Edit, Save, X, Printer, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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

const StaffProfile = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    
    // For printing QR
    const qrRef = useRef(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await axios.get('/api/staff/me');
            setProfile(res.data);
            setFormData(res.data);
            generateQRCode(res.data);
            setLoading(false);
            
            // Check if profile is incomplete, if so, enable editing automatically
            if (!res.data.is_profile_completed) {
                setIsEditing(true);
                toast('Please complete your profile information.', { icon: 'ℹ️' });
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
            setError('Failed to load profile data.');
            setLoading(false);
        }
    };

    const generateQRCode = async (data) => {
        if (!data) return;
        const qrData = JSON.stringify({
            id: data.id,
            name: `${data.rank} ${data.first_name} ${data.last_name}`,
            afpsn: data.afpsn,
            role: 'training_staff'
        });
        
        try {
            const url = await QRCode.toDataURL(qrData);
            setQrCodeUrl(url);
        } catch (err) {
            console.error(err);
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
            // Check if this is a completion event (transition from 0 to 1)
            // If profile is currently incomplete, we FORCE completion on save.
            let isMarkingComplete = formData.is_profile_completed == 1;
            
            if (!profile.is_profile_completed) {
                // Force completion for first-time setup
                isMarkingComplete = true;
                formData.is_profile_completed = 1;
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
                setProfile(prev => ({ ...prev, ...formData }));
                setIsEditing(false);
                toast.success('Profile updated successfully');
            }
            
        } catch (err) {
            console.error('Error updating profile:', err);
            toast.error(err.response?.data?.message || 'Failed to update profile');
        }
    };

    const handlePrintQR = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Staff QR Code - ${profile.rank} ${profile.last_name}</title>
                    <style>
                        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                        img { width: 300px; height: 300px; }
                        h2 { margin-top: 20px; }
                        p { color: #666; }
                    </style>
                </head>
                <body>
                    <img src="${qrCodeUrl}" />
                    <h2>${profile.rank} ${profile.first_name} ${profile.last_name}</h2>
                    <p>AFPSN: ${profile.afpsn}</p>
                    <p>Role: Training Staff</p>
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (loading) return <div className="p-8 text-center">Loading profile...</div>;
    if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
    if (!profile) return <div className="p-8 text-center">No profile found.</div>;

    const getProfileImage = () => {
        if (profile.profile_pic) {
             if (profile.profile_pic.startsWith('data:')) return profile.profile_pic;
             const normalizedPath = profile.profile_pic.replace(/\\/g, '/');
             return `${import.meta.env.VITE_API_URL || ''}${normalizedPath}`;
        }
        return null;
    };

    const InfoItem = ({ icon: Icon, label, value, name, type = "text", options = null, multi = false }) => {
        const isEditMode = isEditing;
        
        return (
            <div className="flex flex-col">
                <span className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                    {Icon && <Icon size={12} />} {label}
                </span>
                {isEditMode ? (
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
                                <button 
                                    onClick={handleSubmit}
                                    className="bg-blue-500/80 hover:bg-blue-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                                    title="Save Changes"
                                >
                                    <Save size={20} />
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
                            <div className="w-40 h-40 rounded-full bg-white/10 border-4 border-white overflow-hidden flex items-center justify-center shadow-xl">
                                {getProfileImage() ? (
                                    <img 
                                        src={getProfileImage()} 
                                        alt="Profile" 
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <User size={64} className="text-green-200" />
                                )}
                            </div>
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
                        
                        {/* QR Code Card */}
                        <div className="bg-white p-3 rounded-lg shadow-lg hidden md:flex flex-col items-center">
                            {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32" />}
                            <div className="text-center text-green-900 text-xs font-bold mt-1">SCAN ME</div>
                            <button 
                                onClick={handlePrintQR}
                                className="mt-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded flex items-center gap-1"
                            >
                                <Printer size={12} /> Print
                            </button>
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
                                <InfoItem icon={Calendar} label="Birthdate" value={profile.birthdate} name="birthdate" type="date" />
                                <InfoItem icon={MapPin} label="Birthplace" value={profile.birthplace} name="birthplace" />
                                <InfoItem icon={Activity} label="Age" value={profile.age} name="age" type="number" />
                                
                                <InfoItem icon={Flag} label="Nationality" value={profile.nationality} name="nationality" options={NATIONALITY_OPTIONS} />
                                <InfoItem icon={User} label="Gender" value={profile.gender} name="gender" options={GENDER_OPTIONS} />
                                <InfoItem icon={User} label="Civil Status" value={profile.civil_status} name="civil_status" options={CIVIL_STATUS_OPTIONS} />
                                
                                <InfoItem icon={Ruler} label="Height (cm)" value={profile.height} name="height" />
                                <InfoItem icon={Activity} label="Weight (kg)" value={profile.weight} name="weight" />
                                <InfoItem icon={Activity} label="Blood Type" value={profile.blood_type} name="blood_type" options={BLOOD_TYPE_OPTIONS} />
                                
                                <div className="col-span-2 md:col-span-3">
                                    <InfoItem icon={Globe} label="Language Spoken" value={profile.language_spoken} name="language_spoken" options={LANGUAGE_OPTIONS} multi={true} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center text-green-800">
                                <Shield className="mr-2" size={20} /> Logistics & Sizes
                            </h3>
                            <div className="grid grid-cols-3 gap-6">
                                <InfoItem label="Combat Boots" value={profile.combat_boots_size} name="combat_boots_size" options={COMBAT_BOOTS_OPTIONS} />
                                <InfoItem label="Uniform Size" value={profile.uniform_size} name="uniform_size" options={UNIFORM_SIZE_OPTIONS} />
                                <InfoItem label="Bullcap Size" value={profile.bullcap_size} name="bullcap_size" options={BULLCAP_SIZE_OPTIONS} />
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
                                <InfoItem icon={MapPin} label="Address" value={profile.address} name="address" />
                                <InfoItem icon={Mail} label="Email Address" value={profile.email} name="email" type="email" />
                                <InfoItem icon={Phone} label="Mobile Number" value={profile.contact_number} name="contact_number" />
                                <InfoItem icon={Facebook} label="Facebook" value={profile.facebook_link} name="facebook_link" />
                            </div>
                        </div>

                        {/* QR Code for Mobile */}
                        <div className="bg-white rounded-lg shadow p-6 md:hidden flex flex-col items-center">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 text-green-800">My QR Code</h3>
                            {qrCodeUrl ? (
                                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 border-4 border-green-800 rounded-lg" />
                            ) : (
                                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-gray-400">Loading...</div>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button 
                                    type="button"
                                    onClick={handlePrintQR}
                                    className="bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-800"
                                >
                                    <Printer size={16} /> Print QR
                                </button>
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
            </form>
        </div>
    );
};

export default StaffProfile;