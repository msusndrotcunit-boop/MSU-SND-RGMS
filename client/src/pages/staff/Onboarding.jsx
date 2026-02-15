import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserCheck, LogOut, QrCode, Lock, Save, Upload } from 'lucide-react';
import QRCode from 'qrcode';

const Onboarding = () => {
    const navigate = useNavigate();
    const { logout, user, login } = useAuth(); // login used to update user context
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'qr'
    const [isProfileCompleted, setIsProfileCompleted] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    const [formData, setFormData] = useState({
        rank: '',
        firstName: '',
        middleName: '',
        lastName: '',
        suffixName: '',
        afpsn: '',
        birthdate: '',
        birthplace: '',
        age: '',
        height: '', // CM
        weight: '', // KG
        blood_type: '',
        address: '',
        civil_status: '',
        nationality: '',
        gender: '',
        language_spoken: '',
        combat_boots_size: '',
        uniform_size: '',
        bullcap_size: '',
        email: '',
        contactNumber: '',
        facebook_link: '',
        rotc_unit: '',
        mobilization_center: '',
        profile_pic: '' // Base64 string
    });

    // Ranks
    const ranks = ['Pvt', 'PFC', 'Cpl', 'Sgt', 'SSg', 'TSg', 'MSg', '2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL', 'BGEN', 'MGEN', 'LTGEN', 'GEN'];

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await axios.get('/api/staff/me');
            const data = response.data;
            
            setFormData(prev => ({
                ...prev,
                rank: data.rank || '',
                firstName: data.first_name || '',
                middleName: data.middle_name || '',
                lastName: data.last_name || '',
                suffixName: data.suffix_name || '',
                email: data.email || '',
                contactNumber: data.contact_number || '',
                profile_pic: data.profile_pic || '',
                afpsn: data.afpsn || '',
                birthdate: data.birthdate || '',
                birthplace: data.birthplace || '',
                age: data.age || '',
                height: data.height || '',
                weight: data.weight || '',
                blood_type: data.blood_type || '',
                address: data.address || '',
                civil_status: data.civil_status || '',
                nationality: data.nationality || '',
                gender: data.gender || '',
                language_spoken: data.language_spoken || '',
                combat_boots_size: data.combat_boots_size || '',
                uniform_size: data.uniform_size || '',
                bullcap_size: data.bullcap_size || '',
                facebook_link: data.facebook_link || '',
                rotc_unit: data.rotc_unit || '',
                mobilization_center: data.mobilization_center || ''
            }));

            if (data.is_profile_completed) {
                setIsProfileCompleted(true);
                setActiveTab('qr');
                generateQRCode(data);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to fetch profile data.');
        } finally {
            setFetching(false);
        }
    };

    const generateQRCode = async (data) => {
        // Generate QR code from personal information
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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert('File is too large. Max 5MB.');
                return;
            }
            
            // Convert to base64
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profile_pic: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.put('/api/staff/profile', formData);
            alert('Profile updated successfully!');
            
            // Update context
            const updatedUser = { ...user, isProfileCompleted: true };
            login(updatedUser); // Reuse login to update user state

            setIsProfileCompleted(true);
            setActiveTab('qr');
            
            // Generate QR with the current form data plus ID from user context or fetched profile
            // We need to re-fetch to be sure or use formData
            // Better to re-fetch to get the ID if we didn't have it (though we should have it)
            fetchProfile();

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (fetching) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100 py-6 px-4">
            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-green-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <UserCheck size={28} />
                            Staff Profile Completion
                        </h1>
                        <p className="text-green-200 mt-1">
                            {isProfileCompleted 
                                ? "Profile Completed. Your QR Code is ready." 
                                : "Please complete your profile to access the system."}
                        </p>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="text-green-200 hover:text-white flex items-center gap-1 text-sm bg-green-800 py-2 px-4 rounded"
                    >
                        <LogOut size={16} /> Logout
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        className={`flex-1 py-4 font-semibold text-center flex justify-center items-center gap-2 ${activeTab === 'profile' ? 'border-b-4 border-green-700 text-green-800 bg-green-50' : 'text-gray-500'}`}
                        onClick={() => !isProfileCompleted && setActiveTab('profile')}
                        disabled={isProfileCompleted} // Locked if completed
                    >
                        {isProfileCompleted ? <Lock size={18} /> : <UserCheck size={18} />}
                        Profile Information
                    </button>
                    <button
                        className={`flex-1 py-4 font-semibold text-center flex justify-center items-center gap-2 ${activeTab === 'qr' ? 'border-b-4 border-green-700 text-green-800 bg-green-50' : 'text-gray-500'}`}
                        onClick={() => isProfileCompleted && setActiveTab('qr')}
                        disabled={!isProfileCompleted}
                    >
                        <QrCode size={18} />
                        QR Code Generation
                    </button>
                </div>

                <div className="p-8">
                    {activeTab === 'profile' && (
                        <form onSubmit={handleSubmit} className="animate-fade-in">
                            {error && (
                                <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded" role="alert">
                                    <p>{error}</p>
                                </div>
                            )}

                            {/* Profile Picture */}
                            <div className="mb-8 flex flex-col items-center">
                                <div className="w-32 h-32 rounded-full border-4 border-green-100 overflow-hidden bg-gray-200 mb-4 shadow-lg relative group">
                                    {formData.profile_pic ? (
                                        <img src={formData.profile_pic} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <UserCheck size={48} />
                                        </div>
                                    )}
                                </div>
                                <label className="cursor-pointer bg-green-700 text-white py-2 px-4 rounded-md hover:bg-green-800 transition flex items-center gap-2 text-sm">
                                    <Upload size={16} /> Upload Picture
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Column 1: Personal Basics */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg border-b pb-2 text-green-800">Identity</h3>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Rank</label>
                                        <select name="rank" value={formData.rank} onChange={handleChange} className="w-full p-2 border rounded" required>
                                            <option value="">Select Rank</option>
                                            {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">AFPSN</label>
                                        <input type="text" name="afpsn" value={formData.afpsn} onChange={handleChange} className="w-full p-2 border rounded" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">First Name</label>
                                        <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full p-2 border rounded" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                                        <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} className="w-full p-2 border rounded" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Last Name</label>
                                        <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full p-2 border rounded" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Suffix</label>
                                        <input type="text" name="suffixName" value={formData.suffixName} onChange={handleChange} className="w-full p-2 border rounded" />
                                    </div>
                                </div>

                                {/* Column 2: Demographics */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg border-b pb-2 text-green-800">Demographics</h3>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Birthdate</label>
                                            <input type="date" name="birthdate" value={formData.birthdate} onChange={handleChange} className="w-full p-2 border rounded" required />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Age</label>
                                            <input type="number" name="age" value={formData.age} onChange={handleChange} className="w-full p-2 border rounded" readOnly />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Birthplace</label>
                                        <input type="text" name="birthplace" value={formData.birthplace} onChange={handleChange} className="w-full p-2 border rounded" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
                                            <input type="text" name="height" value={formData.height} onChange={handleChange} className="w-full p-2 border rounded" required />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                                            <input type="text" name="weight" value={formData.weight} onChange={handleChange} className="w-full p-2 border rounded" required />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Blood Type</label>
                                            <input type="text" name="blood_type" value={formData.blood_type} onChange={handleChange} className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Gender</label>
                                            <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2 border rounded" required>
                                                <option value="">Select</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Civil Status</label>
                                        <select name="civil_status" value={formData.civil_status} onChange={handleChange} className="w-full p-2 border rounded" required>
                                            <option value="">Select</option>
                                            <option value="Single">Single</option>
                                            <option value="Married">Married</option>
                                            <option value="Widowed">Widowed</option>
                                            <option value="Separated">Separated</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Column 3: Contact & Logistics */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg border-b pb-2 text-green-800">Logistics & Contact</h3>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Address</label>
                                        <textarea name="address" value={formData.address} onChange={handleChange} className="w-full p-2 border rounded" rows="2" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Nationality</label>
                                        <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} className="w-full p-2 border rounded" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Language Spoken</label>
                                        <input type="text" name="language_spoken" value={formData.language_spoken} onChange={handleChange} className="w-full p-2 border rounded" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Boots</label>
                                            <input type="text" name="combat_boots_size" value={formData.combat_boots_size} onChange={handleChange} className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Uniform</label>
                                            <input type="text" name="uniform_size" value={formData.uniform_size} onChange={handleChange} className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Bullcap</label>
                                            <input type="text" name="bullcap_size" value={formData.bullcap_size} onChange={handleChange} className="w-full p-2 border rounded" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Contact Info</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="w-full p-2 border rounded" required />
                                            <input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleChange} placeholder="Mobile No." className="w-full p-2 border rounded" required />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Facebook Link</label>
                                        <input type="text" name="facebook_link" value={formData.facebook_link} onChange={handleChange} className="w-full p-2 border rounded" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">ROTC Unit</label>
                                        <input type="text" name="rotc_unit" value={formData.rotc_unit} onChange={handleChange} className="w-full p-2 border rounded" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Mobilization Center</label>
                                        <input type="text" name="mobilization_center" value={formData.mobilization_center} onChange={handleChange} className="w-full p-2 border rounded" required />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-green-700 text-white py-3 px-8 rounded-md hover:bg-green-800 shadow-lg flex items-center gap-2 font-bold"
                                >
                                    {loading ? 'Saving...' : <><Save size={20} /> Save Profile & Generate QR</>}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'qr' && (
                        <div className="flex flex-col items-center justify-center py-10 animate-fade-in">
                            <h2 className="text-2xl font-bold text-green-900 mb-6">Your Digital ID</h2>
                            <div className="bg-white p-6 rounded-lg shadow-2xl border-4 border-green-800">
                                {qrCodeUrl ? (
                                    <img src={qrCodeUrl} alt="Staff QR Code" className="w-64 h-64" />
                                ) : (
                                    <div className="w-64 h-64 flex items-center justify-center text-gray-400">Generating...</div>
                                )}
                            </div>
                            <p className="mt-6 text-gray-600 max-w-md text-center">
                                Present this QR code to the admin for attendance scanning.
                                You can access this code anytime from your dashboard.
                            </p>
                            <button
                                onClick={() => navigate('/staff/dashboard')}
                                className="mt-8 bg-green-700 text-white py-2 px-6 rounded hover:bg-green-800"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
