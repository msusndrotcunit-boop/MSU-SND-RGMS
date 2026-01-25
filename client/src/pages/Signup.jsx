import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    RANK_OPTIONS, 
    YEAR_LEVEL_OPTIONS, 
    SCHOOL_YEAR_OPTIONS, 
    BATTALION_OPTIONS, 
    COMPANY_OPTIONS, 
    PLATOON_OPTIONS, 
    SEMESTER_OPTIONS, 
    COURSE_OPTIONS 
} from '../constants/options';

const Signup = () => {
    const [formData, setFormData] = useState({
        username: '', password: '', 
        rank: '', firstName: '', middleName: '', lastName: '', suffixName: '',
        studentId: '', email: '', contactNumber: '', address: '',
        course: '', yearLevel: '', schoolYear: '',
        battalion: '', company: '', platoon: '',
        cadetCourse: 'MS1', semester: '', status: 'Ongoing'
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/auth/signup', formData);
            alert('Registration successful! Your account is pending approval by the administrator.');
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 py-10">
            <div className="bg-white p-8 rounded shadow-md w-full max-w-2xl">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Cadet Registration</h2>
                {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Personal Info */}
                    <h3 className="font-semibold text-lg text-gray-700 border-b pb-2">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <input type="text" name="firstName" placeholder="First Name" onChange={handleChange} className="border p-2 rounded" required />
                         <input type="text" name="middleName" placeholder="Middle Name" onChange={handleChange} className="border p-2 rounded" />
                         <input type="text" name="lastName" placeholder="Last Name" onChange={handleChange} className="border p-2 rounded" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input type="text" name="suffixName" placeholder="Suffix (e.g., Jr.)" onChange={handleChange} className="border p-2 rounded" />
                        <select name="rank" onChange={handleChange} className="border p-2 rounded" value={formData.rank}>
                            <option value="">Select Rank</option>
                            {RANK_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <input type="text" name="studentId" placeholder="Student ID" onChange={handleChange} className="border p-2 rounded" required />
                    </div>
                    
                    {/* Contact Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="email" name="email" placeholder="Email" onChange={handleChange} className="border p-2 rounded" required />
                        <input type="text" name="contactNumber" placeholder="Contact Number" onChange={handleChange} className="border p-2 rounded" />
                    </div>
                    <input type="text" name="address" placeholder="Address" onChange={handleChange} className="w-full border p-2 rounded" />

                    {/* Academic Info */}
                    <h3 className="font-semibold text-lg text-gray-700 border-b pb-2 mt-4">Academic & ROTC Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select name="course" onChange={handleChange} className="border p-2 rounded" value={formData.course}>
                            <option value="">Select Course</option>
                            {COURSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <select name="yearLevel" onChange={handleChange} className="border p-2 rounded" value={formData.yearLevel}>
                            <option value="">Select Year Level</option>
                            {YEAR_LEVEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <select name="schoolYear" onChange={handleChange} className="border p-2 rounded" value={formData.schoolYear}>
                            <option value="">Select School Year</option>
                            {SCHOOL_YEAR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select name="battalion" onChange={handleChange} className="border p-2 rounded" value={formData.battalion}>
                            <option value="">Select Battalion</option>
                            {BATTALION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <select name="company" onChange={handleChange} className="border p-2 rounded" value={formData.company}>
                            <option value="">Select Company</option>
                            {COMPANY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <select name="platoon" onChange={handleChange} className="border p-2 rounded" value={formData.platoon}>
                            <option value="">Select Platoon</option>
                            {PLATOON_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Cadet Course</label>
                            <select name="cadetCourse" onChange={handleChange} className="w-full border p-2 rounded" value={formData.cadetCourse}>
                                <option value="MS1">MS1</option>
                                <option value="MS2">MS2</option>
                                <option value="COQC">COQC</option>
                                <option value="MS31">MS31</option>
                                <option value="MS32">MS32</option>
                                <option value="MS41">MS41</option>
                                <option value="MS42">MS42</option>
                            </select>
                        </div>
                        <div>
                             <label className="block text-sm text-gray-600 mb-1">Semester</label>
                             <select name="semester" onChange={handleChange} className="w-full border p-2 rounded" value={formData.semester}>
                                 <option value="">Select Semester</option>
                                 {SEMESTER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                             </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Status</label>
                            <select name="status" onChange={handleChange} className="w-full border p-2 rounded" value={formData.status}>
                                <option value="Ongoing">Ongoing</option>
                                <option value="Completed">Completed</option>
                                <option value="Incomplete">Incomplete</option>
                                <option value="Drop">Drop</option>
                                <option value="Failed">Failed</option>
                                <option value="Transferred">Transferred</option>
                            </select>
                        </div>
                    </div>

                    {/* Account Credentials */}
                    <h3 className="font-semibold text-lg text-green-800 border-b pb-2 mt-4">Account Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            name="username"
                            placeholder="Username"
                            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-700"
                            onChange={handleChange}
                            required
                        />
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-700"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <button type="submit" className="w-full bg-green-800 text-white py-3 rounded hover:bg-green-900 transition font-bold text-lg mt-6 shadow-lg">
                        Register
                    </button>
                    <div className="mt-4 text-center">
                         <p className="text-sm">Already registered? <Link to="/login" className="text-green-800 font-semibold hover:underline">Login</Link></p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Signup;
