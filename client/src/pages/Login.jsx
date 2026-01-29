import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { User, ShieldCheck, Briefcase } from 'lucide-react';

const Login = () => {
    const location = useLocation();
    const [loginType, setLoginType] = useState('cadet'); // 'cadet', 'staff', 'admin'
    const [formData, setFormData] = useState({ username: '', password: '', identifier: '', email: '' });
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (location.state?.type) {
            setLoginType(location.state.type);
        }
    }, [location.state]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            let response;
            if (loginType === 'cadet') {
                response = await axios.post('/api/auth/cadet-login', { identifier: formData.identifier });
            } else if (loginType === 'staff') {
                response = await axios.post('/api/auth/staff-login-no-pass', { identifier: formData.email });
            } else {
                response = await axios.post('/api/auth/login', { username: formData.username, password: formData.password });
            }

            login(response.data);
            if (response.data.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (response.data.role === 'training_staff') {
                navigate('/staff/dashboard');
            } else {
                navigate('/cadet/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        }
    };

    return (
        <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-gray-900 overflow-hidden">
            {/* Background Logo - Transparent RGMS Logo replacing the 3 logos */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 overflow-hidden">
                <img 
                    src="/assets/rgms_logo.png" 
                    alt="RGMS Background Logo" 
                    className="w-[80vmin] h-[80vmin] object-contain grayscale" 
                />
            </div>

            <div className="relative z-10 bg-white/90 backdrop-blur-md p-8 rounded-lg shadow-2xl w-full max-w-md border border-green-700/30">
                <div className="flex justify-center items-center mb-6">
                    {/* New RGMS Logo */}
                    <img 
                        src="/assets/rgms_logo.png" 
                        alt="RGMS Logo" 
                        className="w-32 h-32 object-contain drop-shadow-md"
                    />
                </div>
                <h2 className="text-2xl font-bold mb-6 text-center text-green-900">MSU-SND ROTC UNIT Grading Management</h2>
                
                {/* Login Type Toggle */}
                <div className="flex mb-6 bg-gray-200 rounded p-1">
                    <button
                        className={`flex-1 flex items-center justify-center py-2 rounded text-sm font-semibold transition ${loginType === 'cadet' ? 'bg-white shadow text-green-800' : 'text-gray-600 hover:text-green-800'}`}
                        onClick={() => setLoginType('cadet')}
                    >
                        <User size={18} className="mr-2" />
                        Cadet
                    </button>
                    <button
                        className={`flex-1 flex items-center justify-center py-2 rounded text-sm font-semibold transition ${loginType === 'staff' ? 'bg-white shadow text-green-800' : 'text-gray-600 hover:text-green-800'}`}
                        onClick={() => setLoginType('staff')}
                    >
                        <Briefcase size={18} className="mr-2" />
                        Staff
                    </button>
                    <button
                        className={`flex-1 flex items-center justify-center py-2 rounded text-sm font-semibold transition ${loginType === 'admin' ? 'bg-white shadow text-green-800' : 'text-gray-600 hover:text-green-800'}`}
                        onClick={() => setLoginType('admin')}
                    >
                        <ShieldCheck size={18} className="mr-2" />
                        Admin
                    </button>
                </div>

                {error && <p className="text-red-500 mb-4 text-center text-sm font-semibold bg-red-50 p-2 rounded border border-red-200">{error}</p>}
                
                <form onSubmit={handleSubmit}>
                    {loginType === 'cadet' && (
                        <div className="mb-6">
                            <label className="block text-gray-700 font-semibold mb-2">Login Credential</label>
                            <input
                                type="text"
                                name="identifier"
                                placeholder="Student ID, Username, or Email"
                                className="w-full border-gray-300 rounded px-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent bg-white shadow-inner"
                                onChange={handleChange}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2 italic">
                                Note: You must be included in the official ROTCMIS list to login. No password required.
                            </p>
                        </div>
                    )}

                    {loginType === 'staff' && (
                        <div className="mb-6">
                            <label className="block text-gray-700 font-semibold mb-2">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                placeholder="Enter your Email"
                                className="w-full border-gray-300 rounded px-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent bg-white shadow-inner"
                                onChange={handleChange}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2 italic">
                                Note: Training Staff login. No password required.
                            </p>
                        </div>
                    )}

                    {loginType === 'admin' && (
                        <>
                            <div className="mb-4">
                                <label className="block text-gray-700 font-semibold">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    className="w-full border-gray-300 rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    className="w-full border-gray-300 rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-green-800 text-white py-3 rounded font-bold uppercase tracking-wider hover:bg-green-900 transition shadow-lg mt-2"
                    >
                        {loginType === 'admin' ? 'Login as Admin' : 'Access Portal'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
