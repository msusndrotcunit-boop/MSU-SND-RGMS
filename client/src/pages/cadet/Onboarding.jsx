import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserCheck, LogOut } from 'lucide-react';
import { 
    YEAR_LEVEL_OPTIONS, 
    SCHOOL_YEAR_OPTIONS, 
    BATTALION_OPTIONS, 
    COMPANY_OPTIONS, 
    PLATOON_OPTIONS, 
    SEMESTER_OPTIONS, 
    COURSE_OPTIONS,
    CADET_COURSE_OPTIONS 
} from '../../constants/options';

const Onboarding = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [formData, setFormData] = useState({
        studentId: '',
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
        username: '',
        password: '',
        confirmPassword: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!formData.studentId || !formData.firstName || !formData.lastName || !formData.email || !formData.username || !formData.password) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);

        try {
            await axios.post('/api/cadet/onboard', formData);
            alert('Registration successful! Please login with your new credentials.');
            logout();
            navigate('/login');
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 py-10 px-4">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
                <div className="bg-green-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <UserCheck size={28} />
                            Cadet Onboarding
                        </h1>
                        <p className="text-green-200 mt-1">Please complete your profile to access the system.</p>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="text-green-200 hover:text-white flex items-center gap-1 text-sm"
                    >
                        <LogOut size={16} /> Cancel
                    </button>
                </div>

                <div className="p-8">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded mb-6 border border-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Account Credentials */}
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Account Credentials</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                                    <input 
                                        name="username"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                        value={formData.username} 
                                        onChange={handleChange}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                                    <input 
                                        type="password"
                                        name="password"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                        value={formData.password} 
                                        onChange={handleChange}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                                    <input 
                                        type="password"
                                        name="confirmPassword"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                        value={formData.confirmPassword} 
                                        onChange={handleChange}
                                        required 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Personal Information */}
                        <div>
                            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Student ID <span className="text-red-500">*</span></label>
                                    <input 
                                        name="studentId"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                        value={formData.studentId} 
                                        onChange={handleChange}
                                        placeholder="e.g. 2023-0001"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                                    <input 
                                        type="email"
                                        name="email"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                        value={formData.email} 
                                        onChange={handleChange}
                                        required 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                                    <input 
                                        name="firstName"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                        value={formData.firstName} 
                                        onChange={handleChange}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                                    <input 
                                        name="middleName"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                        value={formData.middleName} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                                    <input 
                                        name="lastName"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                        value={formData.lastName} 
                                        onChange={handleChange}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Suffix</label>
                                    <input 
                                        name="suffixName"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                        value={formData.suffixName} 
                                        onChange={handleChange}
                                        placeholder="e.g. Jr, III"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <textarea 
                                    name="address"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                    rows="2"
                                    value={formData.address} 
                                    onChange={handleChange} 
                                ></textarea>
                            </div>
                             <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                                <input 
                                    name="contactNumber"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                    value={formData.contactNumber} 
                                    onChange={handleChange} 
                                />
                            </div>
                        </div>

                        {/* Military & School Info */}
                        <div>
                            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Military & School Info</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                                    <select
                                        name="course"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.course}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Course</option>
                                        {COURSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                                    <select
                                        name="yearLevel"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.yearLevel}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Year Level</option>
                                        {YEAR_LEVEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">School Year</label>
                                    <select
                                        name="schoolYear"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.schoolYear}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select School Year</option>
                                        {SCHOOL_YEAR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cadet Course</label>
                                    <select
                                        name="cadetCourse"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.cadetCourse}
                                        onChange={handleChange}
                                    >
                                        {CADET_COURSE_OPTIONS?.map(opt => <option key={opt} value={opt}>{opt}</option>) || <option value="MS1">MS1</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                                    <select
                                        name="semester"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.semester}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Semester</option>
                                        {SEMESTER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Battalion</label>
                                    <select
                                        name="battalion"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.battalion}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Battalion</option>
                                        {BATTALION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                                    <select
                                        name="company"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.company}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Company</option>
                                        {COMPANY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Platoon</label>
                                    <select
                                        name="platoon"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.platoon}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Platoon</option>
                                        {PLATOON_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <button 
                                type="submit" 
                                className="w-full bg-green-800 text-white py-2 px-4 rounded-md font-semibold hover:bg-green-900 transition flex justify-center items-center text-sm"
                                disabled={loading}
                            >
                                {loading ? 'Submitting...' : 'Complete Registration'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
